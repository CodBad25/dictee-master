"use client";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircleQuestion, Plus, Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Onglet « Questions aux profs » de l'administration.
//
// Les questions posées aux collègues partaient en SQL et leurs réponses étaient
// relues hors de l'appli : Badri avançait à l'aveugle sur des arbitrages qui
// sont les siens. Cet onglet lui rend les deux bouts — lire ce que Nadia a
// répondu, et poser la question suivante sans passer par une requête SQL.

interface Answer {
  id: string;
  teacher_name: string;
  choice: string | null;
  comment: string | null;
  created_at: string;
}

interface Question {
  id: string;
  question: string;
  context: string | null;
  options: { label: string; description?: string }[];
  target_name: string | null;
  status: string;
  created_at: string;
  answers: Answer[];
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminQuestions({ adminPwd }: { adminPwd: string }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [redaction, setRedaction] = useState(false);

  const headers = { "x-admin-password": adminPwd };

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher-questions", { headers });
      if (res.ok) {
        const { questions } = await res.json();
        setQuestions(questions);
      } else {
        toast.error("Lecture impossible");
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPwd]);

  useEffect(() => {
    charger();
  }, [charger]);

  const changerStatut = async (id: string, status: "open" | "closed") => {
    const res = await fetch("/api/teacher-questions", {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      toast.success(status === "closed" ? "Question close" : "Question rouverte");
      charger();
    } else {
      toast.error("Échec de la mise à jour");
    }
  };

  if (questions === null) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const ouvertes = questions.filter((q) => q.status === "open");
  const sansRéponse = ouvertes.filter((q) => q.answers.length === 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-400">
          {ouvertes.length} question{ouvertes.length > 1 ? "s" : ""} ouverte
          {ouvertes.length > 1 ? "s" : ""}
          {sansRéponse > 0 && ` · ${sansRéponse} sans réponse`}
        </div>
        <Button
          size="sm"
          onClick={() => setRedaction((v) => !v)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {redaction ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {redaction ? "Annuler" : "Poser une question"}
        </Button>
      </div>

      {redaction && (
        <Redaction
          adminPwd={adminPwd}
          onPosée={() => {
            setRedaction(false);
            charger();
          }}
        />
      )}

      {questions.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-500">
          Aucune question posée pour l&apos;instant.
        </p>
      )}

      {questions.map((q) => (
        <div
          key={q.id}
          className={`rounded-lg border p-4 ${
            q.status === "open"
              ? "border-gray-700 bg-gray-900"
              : "border-gray-800 bg-gray-900/40 opacity-70"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-1">
                <MessageCircleQuestion className="w-3.5 h-3.5 text-emerald-400" />
                <span>{dateCourte(q.created_at)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    q.status === "open"
                      ? "bg-emerald-900/50 text-emerald-300"
                      : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {q.status === "open" ? "Ouverte" : "Close"}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                  {q.target_name ? q.target_name : "Tous les enseignants"}
                </span>
              </div>
              <p className="font-medium text-gray-100">{q.question}</p>
              {q.context && <p className="text-sm text-gray-400 mt-1">{q.context}</p>}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-gray-700 text-gray-300 hover:text-white"
              onClick={() => changerStatut(q.id, q.status === "open" ? "closed" : "open")}
            >
              {q.status === "open" ? "Clore" : "Rouvrir"}
            </Button>
          </div>

          {q.options.length > 0 && (
            <ul className="mt-3 space-y-1">
              {q.options.map((o) => {
                const votes = q.answers.filter((a) => a.choice === o.label).length;
                return (
                  <li
                    key={o.label}
                    className={`text-sm px-2 py-1 rounded flex items-center justify-between gap-2 ${
                      votes > 0 ? "bg-emerald-900/30 text-emerald-200" : "text-gray-400"
                    }`}
                  >
                    <span>{o.label}</span>
                    {votes > 0 && (
                      <span className="text-xs shrink-0">
                        {votes} réponse{votes > 1 ? "s" : ""}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-3 border-t border-gray-800 pt-3">
            {q.answers.length === 0 ? (
              <p className="text-sm text-gray-500">Pas encore de réponse.</p>
            ) : (
              <div className="space-y-2">
                {q.answers.map((a) => (
                  <div key={a.id} className="text-sm bg-gray-950/60 rounded p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-200">{a.teacher_name}</span>
                      <span className="text-xs text-gray-500">{dateCourte(a.created_at)}</span>
                      {a.choice && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-300 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {a.choice}
                        </span>
                      )}
                    </div>
                    {/* Le champ libre porte souvent l'essentiel : on ne le tronque pas. */}
                    {a.comment && (
                      <p className="mt-1 text-gray-300 whitespace-pre-wrap">{a.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Rédaction d'une question ────────────────────────────────────────
function Redaction({ adminPwd, onPosée }: { adminPwd: string; onPosée: () => void }) {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [envoi, setEnvoi] = useState(false);

  const envoyer = async () => {
    if (!question.trim()) {
      toast.info("Écris la question.");
      return;
    }
    setEnvoi(true);
    try {
      const res = await fetch("/api/teacher-questions", {
        method: "POST",
        headers: { "x-admin-password": adminPwd, "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          context,
          options: options.filter((o) => o.trim()).map((label) => ({ label })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      toast.success("Question posée — elle apparaît dans l'espace enseignant.");
      onPosée();
    } catch (e) {
      toast.error(`Échec : ${(e as Error).message}`);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-4 space-y-3">
      <div>
        <label className="text-xs text-gray-400">La question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={2}
          placeholder="Ex : En dictée audio, faut-il accepter « leur regard scrute » au singulier ?"
          className="w-full mt-1 rounded bg-gray-900 border border-gray-700 p-2 text-sm text-gray-100"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">Le contexte (facultatif)</label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          placeholder="Ex : Dictée n°1 des 5e, texte d'entraînement."
          className="w-full mt-1 rounded bg-gray-900 border border-gray-700 p-2 text-sm text-gray-100"
        />
      </div>
      <div>
        <label className="text-xs text-gray-400">
          Les réponses proposées (facultatives — le champ libre reste toujours disponible)
        </label>
        <div className="space-y-2 mt-1">
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              onChange={(e) =>
                setOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
              placeholder={`Réponse ${i + 1}`}
              className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-sm text-gray-100"
            />
          ))}
        </div>
        <button
          onClick={() => setOptions((p) => [...p, ""])}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          + Ajouter une réponse
        </button>
      </div>
      <Button
        onClick={envoyer}
        disabled={envoi}
        className="bg-emerald-600 hover:bg-emerald-700 w-full"
      >
        {envoi ? (
          <Loader2 className="w-4 h-4 animate-spin mr-1" />
        ) : (
          <Send className="w-4 h-4 mr-1" />
        )}
        Poser la question
      </Button>
    </div>
  );
}
