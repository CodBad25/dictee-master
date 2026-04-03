"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import { ArrowLeft, Check, ChevronRight, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { findMnemonicForError, summarizeErrors } from "@/lib/mnemonics";

interface DicteeWord {
  word: string;
  definition: string;
  spelling_errors: string[];
  position: number;
}

interface DicteeDetailProps {
  dicteeId: string;
  dicteeTitle: string;
  dicteePosition: number;
  activityOrder: string[];
  onBack: () => void;
  onStartActivity: (mode: string, words: DicteeWord[]) => void;
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  flashcard: { label: "Flashcard", icon: "🃏", desc: "Mémorise l'orthographe de chaque mot" },
  spelling_choice: { label: "Choix orthographique", icon: "✏️", desc: "Trouve la bonne orthographe parmi les propositions" },
  definitions: { label: "Définitions", icon: "📖", desc: "Associe chaque mot à sa définition" },
  fill_blanks: { label: "Texte à trous", icon: "📝", desc: "Complète le texte avec les bons mots" },
  audio: { label: "Dictée audio", icon: "🎧", desc: "Écoute et écris le mot correctement" },
};

export default function DicteeDetail({
  dicteeId,
  dicteeTitle,
  dicteePosition,
  activityOrder,
  onBack,
  onStartActivity,
}: DicteeDetailProps) {
  const { connectedEleve } = useAppStore();
  const [words, setWords] = useState<DicteeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedActivities, setCompletedActivities] = useState<number>(0);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastAttempts, setLastAttempts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const sb = createClient();
      const { data } = await sb
        .from("dictee_words")
        .select("word, definition, spelling_errors, position")
        .eq("dictee_id", dicteeId)
        .order("position");
      if (data) setWords(data);
      setLoading(false);
    };
    load();
  }, [dicteeId]);

  useEffect(() => {
    const checkCompletion = async () => {
      if (!connectedEleve) return;
      const sb = createClient();
      const { data } = await sb
        .from("dm_results")
        .select("activity_mode")
        .eq("student_id", connectedEleve.eleveId)
        .eq("dictee_id", dicteeId);

      if (data) {
        const completedModes = new Set(data.map(r => r.activity_mode));
        let completed = 0;
        for (const mode of activityOrder) {
          if (completedModes.has(mode)) completed++;
          else break;
        }
        setCompletedActivities(completed);
      }
    };
    checkCompletion();
  }, [dicteeId, connectedEleve, activityOrder]);

  useEffect(() => {
    const loadHistory = async () => {
      const connectedEleveState = useAppStore.getState().connectedEleve;
      if (!connectedEleveState) return;
      const sb = createClient();

      const { data: results } = await sb.from("dm_results")
        .select("*")
        .eq("student_id", connectedEleveState.eleveId)
        .eq("dictee_id", dicteeId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (results && results.length > 0) {
        setLastResult(results[0]);
        const { data: attempts } = await sb.from("dm_word_attempts")
          .select("*")
          .eq("result_id", results[0].id);
        if (attempts) setLastAttempts(attempts);
      }
    };
    loadHistory();
  }, [dicteeId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const currentStep = completedActivities;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Retour */}
        <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux dictées
        </Button>

        {/* Titre */}
        <div className="text-center">
          <div className="text-xs text-purple-600 font-bold uppercase tracking-wide">
            Dictée N°{dicteePosition}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">{dicteeTitle}</h1>
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mt-2 ${
            dicteePosition <= 8 ? "bg-emerald-100 text-emerald-700" :
            dicteePosition <= 16 ? "bg-amber-100 text-amber-700" :
            "bg-purple-100 text-purple-700"
          }`}>
            {dicteePosition <= 8 ? "🟢 Niveau 1 — Découverte" :
             dicteePosition <= 16 ? "🟡 Niveau 2 — Consolidation" :
             "🟣 Niveau 3 — Maîtrise"}
          </div>
          <p className="text-sm text-gray-400 mt-1">{words.length} mots à travailler</p>
        </div>

        {/* Parcours d'activités */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            Parcours
          </h2>
          {activityOrder.map((mode, index) => {
            const info = ACTIVITY_LABELS[mode] || { label: mode, icon: "📋", desc: "" };
            const isDone = index < completedActivities;
            const isCurrent = index === currentStep;
            const isLocked = index > currentStep;

            return (
              <button
                key={mode}
                onClick={() => {
                  if (isCurrent) onStartActivity(mode, words);
                }}
                disabled={isLocked || isDone}
                className={`
                  w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                  ${isCurrent
                    ? "border-purple-500 bg-purple-50 shadow-md shadow-purple-100 hover:shadow-lg cursor-pointer"
                    : isDone
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-gray-100 bg-gray-50 opacity-50 cursor-default"
                  }
                `}
              >
                {/* Numéro / État */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0
                    ${isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-400"}
                  `}
                >
                  {isDone ? <Check className="w-5 h-5" /> : isLocked ? <Lock className="w-4 h-4" /> : info.icon}
                </div>

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${isCurrent ? "text-purple-700" : isDone ? "text-emerald-700" : "text-gray-400"}`}>
                    {info.label}
                  </div>
                  <div className={`text-xs ${isCurrent ? "text-purple-500" : isDone ? "text-emerald-500" : "text-gray-300"}`}>
                    {info.desc}
                  </div>
                </div>

                {/* Flèche */}
                {isCurrent && (
                  <ChevronRight className="w-5 h-5 text-purple-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Aperçu des mots */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
            Mots de cette dictée
          </h2>
          <div className="flex flex-wrap gap-2">
            {words.map((w) => (
              <span
                key={w.position}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700"
              >
                {w.word}
              </span>
            ))}
          </div>
        </div>

        {/* Dernière tentative */}
        {lastResult && lastAttempts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
              Dernière tentative — {lastResult.percentage}% · {new Date(lastResult.created_at).toLocaleDateString("fr-FR")}
            </h2>

            {/* Error category badges */}
            <div className="flex flex-wrap gap-1.5">
              {summarizeErrors(lastAttempts.filter(a => !a.is_correct).map(a => ({
                word: a.word, userAnswer: a.user_answer, isCorrect: a.is_correct
              }))).map(s => (
                <span key={s.category} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold ${s.color}`}>
                  {s.icon} {s.category} ×{s.count}
                </span>
              ))}
            </div>

            {/* Errors with mnemonics */}
            <div className="grid gap-2 grid-cols-2">
              {lastAttempts.filter(a => !a.is_correct).map((a, i) => {
                const mnemonic = findMnemonicForError(a.word, a.user_answer);
                return (
                  <div key={i} className="bg-white rounded-lg border border-red-100 p-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-red-400 line-through">{a.user_answer}</div>
                        <div className="text-xs font-bold text-emerald-700">{a.word}</div>
                      </div>
                      {mnemonic && <span className="text-sm">{mnemonic.icon}</span>}
                    </div>
                    {mnemonic && (
                      <div className={`mt-1 px-2 py-1 rounded text-[10px] border ${mnemonic.color}`}>
                        {mnemonic.icon} {mnemonic.tip}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Words réussis */}
            {lastAttempts.filter(a => a.is_correct).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lastAttempts.filter(a => a.is_correct).map((a, i) => (
                  <span key={i} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] rounded-md">{a.word}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
