import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callDeepSeek } from "@/lib/deepseek-service";

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ATTEMPTS_FOR_PROMPT = 200; // évite des prompts trop longs

// === Types ==============================================================

export interface StudentAnalysisJson {
  top_errors: Array<{
    word: string;
    wrong_attempts: string[];
    count: number;
    pattern: string;
  }>;
  categories: Array<{
    name: string;
    percentage: number;
    examples: string[];
  }>;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
}

interface AnalysisRow {
  student_id: string;
  class_id: string | null;
  analysis: StudentAnalysisJson;
  cost_usd: number | null;
  tokens: number | null;
  model: string | null;
  source_count: number | null;
  created_at: string;
  updated_at: string;
}

// === Helpers ============================================================

function isCacheFresh(updatedAt: string): boolean {
  const updated = new Date(updatedAt).getTime();
  return Date.now() - updated < CACHE_DURATION_MS;
}

async function loadCached(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
): Promise<AnalysisRow | null> {
  const { data, error } = await supabase
    .from("dm_student_analyses")
    .select("*")
    .eq("student_id", studentId)
    .maybeSingle();
  if (error) {
    console.error("[student-analysis] lecture cache :", error.message);
    return null;
  }
  return (data as AnalysisRow | null) ?? null;
}

async function loadWrongAttempts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  studentId: string,
  classId: string,
): Promise<Array<{ word: string; user_answer: string }>> {
  // 1) IDs de résultats de l'élève dans cette classe
  const { data: results, error: resultsErr } = await supabase
    .from("dm_results")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId);

  if (resultsErr) {
    console.error("[student-analysis] dm_results :", resultsErr.message);
    return [];
  }
  if (!results || results.length === 0) return [];

  const resultIds = results.map((r) => r.id);

  // 2) Tentatives incorrectes
  const { data: attempts, error: attErr } = await supabase
    .from("dm_word_attempts")
    .select("word, user_answer, is_correct")
    .in("result_id", resultIds)
    .eq("is_correct", false);

  if (attErr) {
    console.error("[student-analysis] dm_word_attempts :", attErr.message);
    return [];
  }

  return (attempts || []).map((a) => ({
    word: a.word,
    user_answer: a.user_answer,
  }));
}

function buildPrompt(
  studentName: string,
  attempts: Array<{ word: string; user_answer: string }>,
): string {
  // On agrège par (word, user_answer) pour réduire la taille du prompt
  const aggMap = new Map<string, { word: string; user_answer: string; count: number }>();
  for (const a of attempts) {
    const key = `${a.word}||${a.user_answer}`;
    const existing = aggMap.get(key);
    if (existing) existing.count++;
    else aggMap.set(key, { word: a.word, user_answer: a.user_answer, count: 1 });
  }
  const aggregated = Array.from(aggMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_ATTEMPTS_FOR_PROMPT);

  const listing = aggregated
    .map(
      (a, i) =>
        `${i + 1}. mot attendu : « ${a.word} » → tentative : « ${a.user_answer} » (×${a.count})`,
    )
    .join("\n");

  return `Tu es un expert en orthographe française et en pédagogie pour des élèves de collège (6ème principalement).

L'élève « ${studentName} » a fait les erreurs suivantes en dictée :
${listing}

TÂCHE : analyse ces erreurs et renvoie un diagnostic pédagogique structuré au format JSON strict.

Le JSON doit avoir EXACTEMENT cette forme (sans champ supplémentaire) :
{
  "top_errors": [
    {
      "word": "mot attendu (ex: accueillir)",
      "wrong_attempts": ["liste des fausses orthographes les plus fréquentes"],
      "count": <nombre total d'erreurs sur ce mot>,
      "pattern": "explication courte de la difficulté orthographique (ex: 'Inversion ue/eu')"
    }
  ],
  "categories": [
    { "name": "Accents manqués", "percentage": 45, "examples": ["café→cafe", "..."] },
    { "name": "Consonnes doublées", "percentage": 30, "examples": ["..."] }
  ],
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": [
    "Conseil pédagogique concret (1 phrase)",
    "Liste de 5 mots à revoir cette semaine : ..."
  ],
  "summary": "Synthèse en 2-3 phrases (élève, profil, principales difficultés)."
}

CONSIGNES :
- top_errors : 5 à 10 entrées, classées par fréquence décroissante.
- categories : 3 à 6 catégories ; somme des pourcentages = 100 ; donne 2-4 exemples concrets par catégorie sous la forme "attendu→tentative".
- strengths : 1-3 points forts si discernables, sinon liste vide.
- weaknesses : 2-4 points faibles dominants.
- suggestions : 3-5 actions concrètes et bienveillantes, en français correct avec accents.
- summary : ton neutre et constructif, à destination de l'enseignant. Avec accents français (é, è, ê, à, ç…).

Réponds UNIQUEMENT avec le JSON. Pas de commentaire en dehors, pas de balise markdown.`;
}

const SYSTEM_PROMPT =
  "Tu es un assistant pédagogique expert en orthographe française et en analyse d'erreurs d'élèves de collège. Réponds toujours en français avec les accents corrects (é, è, ê, à, ù, ç…) et UNIQUEMENT en JSON valide.";

// === GET ================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ error: "studentId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const cached = await loadCached(supabase, studentId);

  if (cached && isCacheFresh(cached.updated_at)) {
    return NextResponse.json({
      analysis: cached.analysis,
      costUsd: cached.cost_usd ?? 0,
      tokens: cached.tokens ?? 0,
      model: cached.model ?? "",
      sourceCount: cached.source_count ?? 0,
      updatedAt: cached.updated_at,
      fromCache: true,
    });
  }

  // Pas de cache frais : on signale au client qu'il doit POSTer pour régénérer.
  return NextResponse.json(
    {
      analysis: null,
      fromCache: false,
      stale: !!cached,
      message: cached
        ? "Cache expiré, régénération requise (POST)."
        : "Aucune analyse en cache, génération requise (POST).",
    },
    { status: 200 },
  );
}

// === POST ===============================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  if (!studentId) {
    return NextResponse.json({ error: "studentId requis" }, { status: 400 });
  }

  const password = request.headers.get("x-teacher-password");
  if (!process.env.TEACHER_PASSWORD || password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const personalKey = request.headers.get("x-deepseek-key") || "";
  const apiKey = personalKey.trim() || process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Aucune clé DeepSeek configurée" },
      { status: 500 },
    );
  }

  let studentName = "Élève";
  let classId = "";
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.studentName === "string" && body.studentName.trim())
      studentName = body.studentName.trim();
    if (typeof body?.classId === "string" && body.classId.trim())
      classId = body.classId.trim();
  } catch {
    // body optionnel
  }

  const supabase = await createClient();

  // Si classId non fourni, tente de le récupérer depuis le 1er résultat de l'élève
  if (!classId) {
    const { data: anyResult } = await supabase
      .from("dm_results")
      .select("class_id")
      .eq("student_id", studentId)
      .limit(1)
      .maybeSingle();
    if (anyResult?.class_id) classId = anyResult.class_id;
  }

  if (!classId) {
    return NextResponse.json(
      { error: "Aucun résultat trouvé pour cet élève (classId introuvable)" },
      { status: 404 },
    );
  }

  const attempts = await loadWrongAttempts(supabase, studentId, classId);
  if (attempts.length === 0) {
    return NextResponse.json(
      {
        error:
          "Aucune erreur enregistrée pour cet élève — pas de matière à analyser.",
      },
      { status: 422 },
    );
  }

  const prompt = buildPrompt(studentName, attempts);

  let llmResult;
  try {
    llmResult = await callDeepSeek(prompt, apiKey, SYSTEM_PROMPT);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Échec DeepSeek", details: msg },
      { status: 502 },
    );
  }

  let analysis: StudentAnalysisJson;
  try {
    analysis = JSON.parse(llmResult.content);
  } catch {
    return NextResponse.json(
      {
        error: "Réponse DeepSeek invalide (JSON malformé)",
        rawPreview: llmResult.content.slice(0, 400),
      },
      { status: 502 },
    );
  }

  const totalTokens = llmResult.promptTokens + llmResult.completionTokens;

  // UPSERT par student_id
  const { error: upsertErr } = await supabase
    .from("dm_student_analyses")
    .upsert(
      {
        student_id: studentId,
        class_id: classId,
        analysis,
        cost_usd: llmResult.costUsd,
        tokens: totalTokens,
        model: llmResult.model,
        source_count: attempts.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    );

  if (upsertErr) {
    console.error("[student-analysis] upsert :", upsertErr.message);
    // On renvoie quand même l'analyse au client — la sauvegarde est best-effort.
  }

  return NextResponse.json({
    analysis,
    costUsd: llmResult.costUsd,
    tokens: totalTokens,
    model: llmResult.model,
    sourceCount: attempts.length,
    updatedAt: new Date().toISOString(),
    fromCache: false,
  });
}
