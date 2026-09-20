"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Loader2, Send } from "lucide-react";

// Questions posées aux enseignants directement dans l'appli.
//
// Les arbitrages pédagogiques (« on garde le format ou pas ? ») passaient par
// WhatsApp au coup par coup. Ici la question est posée dans l'outil, avec des
// options à cliquer ET un champ libre — c'est le champ libre qui porte le plus
// d'information : « 3 phrases, pas 3 textes » n'aurait figuré dans aucune option.
//
// Les questions sont insérées en SQL ; les réponses sont relues côté Claude.

export interface TeacherQuestion {
  id: string;
  question: string;
  context: string | null;
  options: { label: string; description?: string }[];
  target_name: string | null;
  status: string;
}

interface Answer {
  question_id: string;
  choice: string | null;
  comment: string | null;
}

// Questions ouvertes adressées à ce prof (ou à tous), avec sa réponse éventuelle.
export async function loadQuestionsFor(teacherName: string) {
  const sb = createClient();
  const [{ data: qs }, { data: as }] = await Promise.all([
    sb.from("teacher_questions").select("*").eq("status", "open").order("created_at", { ascending: false }),
    sb.from("teacher_answers").select("question_id, choice, comment").eq("teacher_name", teacherName),
  ]);
  const questions = ((qs as TeacherQuestion[]) || []).filter(
    (q) => !q.target_name || q.target_name === teacherName,
  );
  const answers = (as as Answer[]) || [];
  return { questions, answers };
}

interface Props {
  teacherName: string;
  onAnsweredChange?: () => void;
}

export default function TeacherQuestions({ teacherName, onAnsweredChange }: Props) {
  const [questions, setQuestions] = useState<TeacherQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [comment, setComment] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { questions: qs, answers: as } = await loadQuestionsFor(teacherName);
    setQuestions(qs);
    const map: Record<string, Answer> = {};
    for (const a of as) map[a.question_id] = a;
    setAnswers(map);
    setChoice(Object.fromEntries(as.filter((a) => a.choice).map((a) => [a.question_id, a.choice!])));
    setComment(Object.fromEntries(as.filter((a) => a.comment).map((a) => [a.question_id, a.comment!])));
  }, [teacherName]);

  useEffect(() => { load(); }, [load]);

  const envoyer = async (q: TeacherQuestion) => {
    const c = choice[q.id];
    const txt = (comment[q.id] || "").trim();
    if (!c && !txt) {
      toast.info("Choisis une réponse ou écris un commentaire.");
      return;
    }
    setSaving(q.id);
    try {
      const sb = createClient();
      // Une réponse par prof et par question, modifiable tant que la question est ouverte.
      const { error } = await sb.from("teacher_answers").upsert(
        {
          id: `${q.id}--${teacherName}`.slice(0, 120),
          question_id: q.id,
          teacher_name: teacherName,
          choice: c || null,
          comment: txt || null,
        },
        { onConflict: "question_id,teacher_name" },
      );
      if (error) throw new Error(error.message);
      toast.success("Réponse enregistrée, merci !");
      await load();
      onAnsweredChange?.();
    } catch (e) {
      toast.error(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setSaving(null);
    }
  };

  if (questions === null) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-400">
        Aucune question en attente. Badri t&apos;en posera ici quand il aura besoin de ton avis.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => {
        const dejaRepondu = !!answers[q.id];
        return (
          <div key={q.id} className="border-2 border-violet-100 rounded-xl p-3 bg-violet-50/40">
            <p className="font-semibold text-gray-800 text-sm">{q.question}</p>
            {q.context && <p className="text-xs text-gray-500 mt-0.5">{q.context}</p>}

            {/* Options en chips — jamais de <select> (convention UI du projet) */}
            <div className="flex flex-col gap-1.5 mt-2.5">
              {q.options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setChoice((c) => ({ ...c, [q.id]: o.label }))}
                  className={`text-left px-3 py-2 rounded-xl border-2 transition-all ${
                    choice[q.id] === o.label
                      ? "bg-violet-600 border-violet-700 text-white shadow"
                      : "bg-white border-gray-200 text-gray-700 hover:border-violet-400"
                  }`}
                >
                  <span className="text-sm font-semibold">{o.label}</span>
                  {o.description && (
                    <span className={`block text-xs mt-0.5 ${choice[q.id] === o.label ? "text-violet-100" : "text-gray-500"}`}>
                      {o.description}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Le champ libre compte autant que les options : c'est souvent là
                que se trouve la vraie réponse. */}
            <textarea
              value={comment[q.id] || ""}
              onChange={(e) => setComment((c) => ({ ...c, [q.id]: e.target.value }))}
              rows={2}
              placeholder="Autre chose à dire ? Nuance, désaccord, précision…"
              className="w-full mt-2 border rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400 resize-none"
            />

            <div className="flex items-center gap-2 mt-2">
              {dejaRepondu && (
                <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Déjà répondu — tu peux modifier
                </span>
              )}
              <Button
                size="sm"
                onClick={() => envoyer(q)}
                disabled={saving === q.id}
                className="ml-auto bg-violet-600 hover:bg-violet-700 gap-1.5"
              >
                {saving === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {dejaRepondu ? "Modifier" : "Répondre"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
