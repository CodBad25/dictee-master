import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Questions posées aux enseignants — côté administration.
//
// La table a été créée le 20/09/2026 sans interface : les questions partaient en
// SQL et les réponses étaient relues hors de l'appli. Badri se retrouvait donc à
// l'aveugle sur ce que ses collègues avaient répondu. Cette route lui rend la
// main : lire les réponses, poser une question, clore un arbitrage rendu.
//
// Protection identique à /api/bugs : mot de passe administrateur ou enseignant.

function autorise(request: Request): boolean {
  const password =
    request.headers.get("x-admin-password") || request.headers.get("x-teacher-password");
  return password === process.env.ADMIN_PASSWORD || password === process.env.TEACHER_PASSWORD;
}

interface QuestionRow {
  id: string;
  question: string;
  context: string | null;
  options: { label: string; description?: string }[];
  target_name: string | null;
  status: string;
  created_at: string;
}

// GET — Toutes les questions, chacune avec les réponses reçues.
export async function GET(request: Request) {
  if (!autorise(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = await createClient();
  const [{ data: questions, error: qErr }, { data: answers, error: aErr }] = await Promise.all([
    supabase.from("teacher_questions").select("*").order("created_at", { ascending: false }),
    supabase.from("teacher_answers").select("*").order("created_at", { ascending: false }),
  ]);

  if (qErr || aErr) {
    return NextResponse.json({ error: "Erreur de lecture" }, { status: 500 });
  }

  const parRéponse = new Map<string, typeof answers>();
  for (const a of answers || []) {
    const liste = parRéponse.get(a.question_id) || [];
    liste.push(a);
    parRéponse.set(a.question_id, liste);
  }

  return NextResponse.json({
    questions: ((questions as QuestionRow[]) || []).map((q) => ({
      ...q,
      answers: parRéponse.get(q.id) || [],
    })),
  });
}

// POST — Poser une nouvelle question.
export async function POST(request: Request) {
  if (!autorise(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "La question est vide" }, { status: 400 });
  }

  // Les options sont facultatives : une question peut n'attendre qu'une réponse
  // libre, et c'est souvent le champ libre qui porte le plus d'information.
  const options = Array.isArray(body.options)
    ? body.options
        .map((o: { label?: string; description?: string }) => ({
          label: (o.label || "").trim(),
          description: (o.description || "").trim() || undefined,
        }))
        .filter((o: { label: string }) => o.label.length > 0)
    : [];

  const id =
    (body.id || "").trim() ||
    `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_questions").insert({
    id,
    question: question.slice(0, 2000),
    context: (body.context || "").trim().slice(0, 1000) || null,
    options,
    target_name: (body.targetName || "").trim() || null,
    status: "open",
  });

  if (error) {
    console.error("teacher_questions insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, id });
}

// PATCH — Clore une question dont l'arbitrage est rendu (ou la rouvrir).
export async function PATCH(request: Request) {
  if (!autorise(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id, status } = await request.json();
  if (!id || !["open", "closed"].includes(status)) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("teacher_questions").update({ status }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
