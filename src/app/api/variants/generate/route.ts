import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FillBlanksVariant } from "@/lib/dictee-service";
import {
  VARIANT_META,
  ALL_VARIANT_TYPES,
  type VariantType,
} from "@/lib/variant-types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Claude Haiku 4.5 — coût négligeable (~5 centimes pour les 28 dictées au total)
// Seul modèle qui respecte vraiment les consignes structurées (marqueurs [[Bn]])
const OPENROUTER_MODEL = "anthropic/claude-haiku-4.5";
const OLLAMA_MODEL = "gemma4:latest";

// === Définition des transformations =====================================
// Pour ajouter une nouvelle transformation, ajouter une entrée ici. C'est tout.

interface TransformationSpec {
  label: string;            // utilisé pour FillBlanksVariant.label
  promptInstruction: string; // décrit la transformation au LLM
  // Règles spécifiques additionnelles (ex: pronoms qui changent le sujet)
  extraRules?: string;
}

const TRANSFORMATIONS: Record<VariantType, TransformationSpec> = {
  pluriel: {
    label: "Variante pluriel",
    promptInstruction:
      "Mets TOUS les noms communs et adjectifs au pluriel partout où c'est grammaticalement possible. Adapte les articles, déterminants et accords sujet-verbe. Les noms propres restent au singulier. Les expressions idiomatiques (« prendre soin de ») restent au singulier.",
  },
  singulier: {
    label: "Variante singulier",
    promptInstruction:
      "Mets TOUS les noms communs et adjectifs au singulier partout où c'est grammaticalement possible. Adapte les articles, déterminants et accords sujet-verbe. Si le texte original est déjà majoritairement au singulier, garde-le tel quel.",
  },
  imparfait: {
    label: "Variante imparfait",
    promptInstruction:
      "Transpose les verbes conjugués à l'imparfait de l'indicatif. Ne change pas la personne ni le nombre du sujet. Garde le reste du texte tel quel.",
  },
  passe_compose: {
    label: "Variante passé composé",
    promptInstruction:
      "Transpose les verbes conjugués au passé composé (auxiliaire être ou avoir + participe passé). Attention aux accords du participe passé (avec être : accord avec le sujet ; avec avoir : accord avec le COD si placé avant). Ne change pas la personne du sujet.",
  },
  passe_simple: {
    label: "Variante passé simple",
    promptInstruction:
      "Transpose les verbes conjugués au passé simple de l'indicatif (temps littéraire du récit : il marcha, elle vit, ils prirent…). Ne change pas la personne du sujet.",
  },
  futur_simple: {
    label: "Variante futur simple",
    promptInstruction:
      "Transpose les verbes conjugués au futur simple de l'indicatif (il marchera, elle verra, ils prendront…). Ne change pas la personne du sujet.",
  },
  plus_que_parfait: {
    label: "Variante plus-que-parfait",
    promptInstruction:
      "Transpose les verbes conjugués au plus-que-parfait (auxiliaire à l'imparfait + participe passé : il avait marché, elle était partie…). Attention aux accords du participe passé. Ne change pas la personne du sujet.",
  },
  pronom_je: {
    label: "Variante à la 1re personne du singulier (je)",
    promptInstruction:
      "Réécris le texte à la 1re personne du singulier : remplace le sujet principal par « je » (« j' » devant voyelle). Adapte les verbes, les pronoms personnels, les possessifs (« son » → « mon », « ses » → « mes »), les accords du participe passé avec être.",
    extraRules:
      "Le sujet propre original (ex : Clara) disparaît au profit de « je ». Si le sujet original est pluriel ou un autre pronom, garde la cohérence narrative.",
  },
  pronom_tu: {
    label: "Variante à la 2e personne du singulier (tu)",
    promptInstruction:
      "Réécris le texte à la 2e personne du singulier : remplace le sujet principal par « tu ». Adapte les verbes, les pronoms, les possessifs (« son » → « ton », « ses » → « tes »), les accords du participe passé.",
    extraRules:
      "Le sujet propre original (ex : Clara) disparaît au profit de « tu ».",
  },
  pronom_nous: {
    label: "Variante à la 1re personne du pluriel (nous)",
    promptInstruction:
      "Réécris le texte à la 1re personne du pluriel : remplace le sujet principal par « nous ». Adapte les verbes (-ons), les pronoms, les possessifs (« son » → « notre », « ses » → « nos »), les accords du participe passé avec être (accord avec le sujet pluriel).",
    extraRules:
      "Le sujet propre original (ex : Clara) disparaît au profit de « nous ».",
  },
  pronom_vous: {
    label: "Variante à la 2e personne du pluriel (vous)",
    promptInstruction:
      "Réécris le texte à la 2e personne du pluriel : remplace le sujet principal par « vous ». Adapte les verbes (-ez), les pronoms, les possessifs (« son » → « votre », « ses » → « vos »), les accords du participe passé avec être.",
    extraRules:
      "Le sujet propre original (ex : Clara) disparaît au profit de « vous ».",
  },
  pronom_elles: {
    label: "Variante à la 3e personne du pluriel (elles)",
    promptInstruction:
      "Réécris le texte à la 3e personne du pluriel féminin : le sujet devient « elles ». Adapte les verbes (-ent), les pronoms personnels, les possessifs (« son » → « leur », « ses » → « leurs »), les accords du participe passé avec être (féminin pluriel).",
    extraRules:
      "Le sujet propre original au singulier (ex : Clara) devient pluriel féminin (« elles »). Cohérence narrative à conserver.",
  },
};

// === Schéma de réponse LLM ==============================================
// Pour chaque variante : full_text (sans marqueurs) + forms (chaque mot de vocab dans sa forme transformée).

interface VariantLlmResult {
  full_text: string;
  forms: string[];
}

// === Appel LLM brut ======================================================

async function callLlmRaw(
  prompt: string,
  systemPrompt: string,
): Promise<{ content: string; modelUsed: string; cost: number; tokens: number }> {
  const ollamaUrl = process.env.OLLAMA_URL;
  const isLocal = !!ollamaUrl;
  const modelUsed = isLocal ? `Ollama · ${OLLAMA_MODEL}` : `OpenRouter · ${OPENROUTER_MODEL}`;

  const url = isLocal ? `${ollamaUrl}/v1/chat/completions` : OPENROUTER_URL;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isLocal) {
    headers["Authorization"] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
    headers["HTTP-Referer"] = "https://dicteemaster.vercel.app";
  }

  const body = {
    model: isLocal ? OLLAMA_MODEL : OPENROUTER_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };

  console.log(`[LLM] Appel ${isLocal ? "Ollama (local)" : "OpenRouter"} → modèle ${body.model}`);
  const t0 = Date.now();
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  console.log(`[LLM] Réponse reçue en ${((Date.now() - t0) / 1000).toFixed(1)}s — status ${res.status}`);

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[LLM ${isLocal ? "Ollama" : "OpenRouter"}] ${res.status}:`, errText);
    throw new Error(`LLM ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const cost: number = json.usage?.cost ?? 0;
  const tokens: number = json.usage?.total_tokens ?? 0;
  console.log(`[LLM] Coût : $${cost.toFixed(6)} · ${tokens} tokens`);

  return { content: cleaned, modelUsed, cost, tokens };
}

const VARIANT_SYSTEM_PROMPT =
  "Tu es un assistant pédagogique expert en grammaire française pour des élèves de 6ème. Réponds UNIQUEMENT avec un objet JSON valide, sans balise markdown.";

// === Génération d'une variante (1 appel LLM) =============================

async function generateOneVariant(
  type: VariantType,
  originalText: string,
  cleanedVocab: string[],
): Promise<{ result: VariantLlmResult; modelUsed: string; cost: number; tokens: number }> {
  const spec = TRANSFORMATIONS[type];
  const vocabList = cleanedVocab.map((w, i) => `${i + 1}. ${w}`).join("\n");

  const prompt = `Texte original :
"""
${originalText}
"""

Mots de vocabulaire (${cleanedVocab.length} mots, dans l'ordre) :
${vocabList}

TÂCHE : génère UNE variante grammaticale du texte original (type : ${spec.label}), sans inventer ni ajouter de contenu, en respectant le sens du texte. Ne PAS modifier les noms propres sauf instruction contraire.

INSTRUCTION DE TRANSFORMATION :
${spec.promptInstruction}
${spec.extraRules ? "\nRÈGLES SUPPLÉMENTAIRES :\n" + spec.extraRules : ""}

Format JSON attendu :
{
  "full_text": "le texte transformé complet, SANS marquage spécial",
  "forms": ["forme1", "forme2", ...]  // ${cleanedVocab.length} éléments, DANS LE MÊME ORDRE que la liste de vocabulaire ci-dessus
}

RÈGLES IMPÉRATIVES :
- "forms" doit contenir EXACTEMENT ${cleanedVocab.length} éléments
- Chaque élément doit être UN SEUL MOT, sans article, sans guillemets, sans ponctuation, sans parenthèses
- Chaque forme doit être la forme EXACTE telle qu'elle apparaît dans full_text (au pluriel si le mot l'est, au singulier sinon ; conjugué selon le temps demandé pour les verbes)
- Chaque forme doit pouvoir être retrouvée mot pour mot dans full_text
- Ne JAMAIS modifier l'orthographe d'un mot de vocabulaire au-delà de la transformation demandée (un nom commun peut prendre un "s", un verbe peut être conjugué — c'est tout)`;

  const { content, modelUsed, cost, tokens } = await callLlmRaw(prompt, VARIANT_SYSTEM_PROMPT);
  try {
    const parsed = JSON.parse(content) as VariantLlmResult;
    if (!parsed.full_text || !Array.isArray(parsed.forms)) {
      throw new Error("Champs requis absents (full_text, forms).");
    }
    return { result: parsed, modelUsed, cost, tokens };
  } catch {
    throw new Error(`Réponse JSON invalide : ${content.slice(0, 200)}`);
  }
}

// === 2e passe : relecture/correction d'UNE variante ======================

async function reviewAndCorrectOne(
  type: VariantType,
  text: string,
  vocabWords: string[],
): Promise<{ corrected: string; cost: number; tokens: number }> {
  const spec = TRANSFORMATIONS[type];
  const prompt = `Tu reçois un texte généré par IA (variante « ${spec.label} » d'une dictée). Relis-le et corrige UNIQUEMENT les fautes suivantes :
- Accords sujet-verbe incorrects
- Possessifs incohérents avec le sujet (ex: « Clara » au singulier → « ses » et non « leurs » ; « nous » → « nos » ; « tu » → « tes »)
- Fautes d'orthographe (ex: « cramonnés » → « cramponnés »)
- Accords du participe passé incorrects
- Pluriels manquants ou en trop sur les noms communs et adjectifs

⚠️ INTERDICTIONS ABSOLUES :
- NE PAS modifier les mots de la liste de vocabulaire (ils doivent rester EXACTEMENT comme dans le texte que tu reçois) : ${vocabWords.join(", ")}
- NE PAS modifier la structure des phrases ni le sens
- NE PAS ajouter ni supprimer de contenu
- NE PAS modifier les noms propres sauf si la transformation l'a explicitement fait

Texte à relire :
"""
${text}
"""

Format JSON attendu (corrige le texte si besoin, sinon renvoie-le tel quel) :
{
  "corrected": "..."
}`;

  const { content, cost, tokens } = await callLlmRaw(prompt, VARIANT_SYSTEM_PROMPT);
  try {
    const parsed = JSON.parse(content) as { corrected: string };
    if (!parsed.corrected) throw new Error("Champ corrected absent");
    return { corrected: parsed.corrected, cost, tokens };
  } catch {
    console.warn(`[reviewAndCorrect/${type}] Réponse invalide, on garde le texte original. Aperçu : ${content.slice(0, 200)}`);
    return { corrected: text, cost, tokens };
  }
}

// === Marquage déterministe côté serveur =================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markFirstOccurrence(text: string, word: string): { result: string; count: number } {
  if (!word.trim()) return { result: text, count: 0 };
  const escaped = escapeRegex(word.trim());
  const regex = new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, "iu");
  const match = text.match(regex);
  if (!match || match.index === undefined) return { result: text, count: 0 };
  const result =
    text.slice(0, match.index) +
    `«${match[0]}»` +
    text.slice(match.index + match[0].length);
  return { result, count: 1 };
}

function markVocabularyWords(
  text: string,
  vocabForms: string[],
): { marked: string; totalMarked: number; missing: string[] } {
  let result = text;
  const missing: string[] = [];
  let totalMarked = 0;

  const seen = new Set<string>();
  const orderedForms = vocabForms
    .filter((f) => {
      const key = f.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.length - a.length);

  for (const form of orderedForms) {
    let { result: newResult, count } = markFirstOccurrence(result, form);

    if (count === 0 && !form.endsWith("s")) {
      const pluralAttempt = markFirstOccurrence(result, form + "s");
      if (pluralAttempt.count > 0) {
        newResult = pluralAttempt.result;
        count = pluralAttempt.count;
      }
    }

    if (count === 0 && form.endsWith("s")) {
      const singularAttempt = markFirstOccurrence(result, form.slice(0, -1));
      if (singularAttempt.count > 0) {
        newResult = singularAttempt.result;
        count = singularAttempt.count;
      }
    }

    if (count === 0) {
      missing.push(form);
    } else {
      totalMarked += count;
      result = newResult;
    }
  }

  return { marked: result, totalMarked, missing };
}

function parseMarkedText(marked: string): { full: string; fillBlanks: string; blankCount: number } {
  const full = marked.replace(/[«»]/g, "");
  const fillBlanks = marked.replace(/«[^»]+»/g, "___");
  const blankCount = (fillBlanks.match(/___/g) || []).length;
  return { full, fillBlanks, blankCount };
}

// === Route handler =======================================================

export async function POST(request: Request) {
  // --- Auth ---
  const password = request.headers.get("x-teacher-password");
  if (password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // --- Body ---
  let dicteeId: string;
  let requestedTransformations: VariantType[];
  try {
    const body = await request.json();
    dicteeId = body?.dicteeId;
    const raw = body?.transformations;
    if (Array.isArray(raw) && raw.length > 0) {
      requestedTransformations = raw.filter((t: unknown): t is VariantType =>
        typeof t === "string" && (ALL_VARIANT_TYPES as string[]).includes(t),
      );
    } else {
      // Compat ascendante : si aucune transformation précisée, on garde les 2 historiques.
      requestedTransformations = ["pluriel", "imparfait"];
    }
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!dicteeId) {
    return NextResponse.json({ error: "dicteeId requis" }, { status: 400 });
  }

  if (requestedTransformations.length === 0) {
    return NextResponse.json({ error: "Aucune transformation valide demandée" }, { status: 400 });
  }

  // --- Charger la dictée ---
  const supabase = await createClient();

  const { data: dictee, error: dicteeError } = await supabase
    .from("dictees")
    .select("fill_blanks_text, fill_blanks_variants")
    .eq("id", dicteeId)
    .maybeSingle();

  if (dicteeError) {
    console.error("[variants/generate] Supabase dictée:", dicteeError.message);
    return NextResponse.json({ error: "Erreur de lecture de la dictée" }, { status: 500 });
  }

  if (!dictee?.fill_blanks_text) {
    return NextResponse.json(
      { error: "Aucun texte à trous pour cette dictée" },
      { status: 422 },
    );
  }

  // --- Charger les mots ---
  const { data: wordsData, error: wordsError } = await supabase
    .from("dictee_words")
    .select("word")
    .eq("dictee_id", dicteeId)
    .order("position");

  if (wordsError) {
    console.error("[variants/generate] Supabase mots:", wordsError.message);
    return NextResponse.json({ error: "Erreur de lecture des mots" }, { status: 500 });
  }

  const words = (wordsData || []).map((r) => r.word);

  // Nettoyer les mots de vocabulaire (enlever annotations "(e)", "(se)", "(ée)" + articles)
  const cleanedWords = words.map((w) => {
    let cleaned = w.replace(/\s*\([^)]+\)\s*/g, "").trim();
    cleaned = cleaned.replace(/^(le |la |l'|l’|les |un |une |des |du )/i, "");
    return cleaned;
  });

  console.log(
    `[variants/generate] Début pour dictée ${dicteeId} — ${words.length} mots vocab · ${requestedTransformations.length} transformations : ${requestedTransformations.join(", ")}`,
  );

  // --- Génération + relecture en parallèle pour chaque transformation ---
  let modelUsed = "";
  let totalCost = 0;
  let totalTokens = 0;
  const now = new Date().toISOString();
  const newVariants: FillBlanksVariant[] = [];
  const errors: { type: VariantType; message: string }[] = [];

  const results = await Promise.allSettled(
    requestedTransformations.map(async (type) => {
      const gen = await generateOneVariant(type, dictee.fill_blanks_text, cleanedWords);
      const review = await reviewAndCorrectOne(type, gen.result.full_text, cleanedWords);
      return { type, gen, review };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const type = requestedTransformations[i];
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error(`[variants/generate] Échec ${type} :`, msg);
      errors.push({ type, message: msg });
      continue;
    }

    const { gen, review } = r.value;
    if (!modelUsed) modelUsed = gen.modelUsed;
    totalCost += gen.cost + review.cost;
    totalTokens += gen.tokens + review.tokens;

    const marking = markVocabularyWords(review.corrected, gen.result.forms);
    const parsed = parseMarkedText(marking.marked);

    console.log(
      `[variants/generate] ${type.toUpperCase()} — ${parsed.blankCount} blancs marqués (${marking.totalMarked} occurrences pour ${gen.result.forms.length} mots vocab)${marking.missing.length > 0 ? ` · ⚠️ Mots introuvables : ${marking.missing.join(", ")}` : ""}`,
    );

    newVariants.push({
      id: `variant-${type}-${Date.now()}-${i}`,
      label: TRANSFORMATIONS[type].label,
      variant_type: type,
      fill_blanks_text: parsed.fillBlanks,
      full_text: parsed.full,
      status: "draft",
      created_at: now,
    });
  }

  if (newVariants.length === 0) {
    return NextResponse.json(
      {
        error: "Toutes les générations ont échoué",
        details: errors,
      },
      { status: 502 },
    );
  }

  console.log(
    `[variants/generate] 💰 TOTAL : $${totalCost.toFixed(6)} (~${(totalCost * 0.92).toFixed(4)}€) · ${totalTokens} tokens · ${newVariants.length}/${requestedTransformations.length} variantes OK`,
  );

  // --- Fusionner avec variantes existantes (remplace par variant_type) ---
  const existingVariants: FillBlanksVariant[] =
    (dictee.fill_blanks_variants as FillBlanksVariant[]) || [];
  const existingByType = new Map(existingVariants.map((v) => [v.variant_type, v]));
  for (const v of newVariants) {
    existingByType.set(v.variant_type, v);
  }
  // Préserver l'ordre canonique (ALL_VARIANT_TYPES)
  const mergedVariants: FillBlanksVariant[] = [];
  for (const t of ALL_VARIANT_TYPES) {
    const v = existingByType.get(t);
    if (v) mergedVariants.push(v);
  }
  // Au cas où il existerait des variant_type inconnus en base, les conserver en queue.
  for (const v of existingByType.values()) {
    if (!ALL_VARIANT_TYPES.includes(v.variant_type) && !mergedVariants.includes(v)) {
      mergedVariants.push(v);
    }
  }

  // --- Sauvegarder ---
  const { error: saveError } = await supabase
    .from("dictees")
    .update({ fill_blanks_variants: mergedVariants })
    .eq("id", dicteeId);

  if (saveError) {
    console.error("[variants/generate] Sauvegarde:", saveError.message);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    variants: mergedVariants,
    model: modelUsed,
    cost: totalCost,
    tokens: totalTokens,
    errors: errors.length > 0 ? errors : undefined,
    // Expose les méta pour info (pas obligatoire, mais pratique côté client)
    generated_types: newVariants.map((v) => v.variant_type),
    meta: VARIANT_META,
  });
}
