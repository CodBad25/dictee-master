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
  genre: { label: "Genre", icon: "🏷️", desc: "Choisis le bon article pour chaque mot" },
  spelling_choice: { label: "Choix orthographique", icon: "✏️", desc: "Trouve la bonne orthographe parmi les propositions" },
  definitions: { label: "Définitions", icon: "📖", desc: "Associe chaque mot à sa définition" },
  fill_blanks: { label: "Texte à trous", icon: "📝", desc: "Complète le texte avec les bons mots" },
  audio_word: { label: "Audio mot", icon: "🎧", desc: "Écoute et écris le mot correctement" },
  audio_dictation: { label: "Dictée audio", icon: "🎙️", desc: "Écoute le texte et complète les trous" },
};

export default function DicteeDetail({
  dicteeId,
  dicteeTitle,
  dicteePosition,
  activityOrder,
  onBack,
  onStartActivity,
}: DicteeDetailProps) {
  const { connectedEleve, user } = useAppStore();
  const isTeacher = user?.role === "teacher";
  const [words, setWords] = useState<DicteeWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedActivities, setCompletedActivities] = useState<number>(0);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [sessionAttempts, setSessionAttempts] = useState<Record<string, any[]>>({});
  const [persistentErrors, setPersistentErrors] = useState<{ word: string; count: number; lastAnswer: string }[]>([]);

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

  // Charger TOUTES les sessions pour cette dictée
  useEffect(() => {
    const loadHistory = async () => {
      if (!connectedEleve) return;
      const sb = createClient();

      // Toutes les sessions
      const { data: results } = await sb.from("dm_results")
        .select("*")
        .eq("student_id", connectedEleve.eleveId)
        .eq("dictee_id", dicteeId)
        .order("created_at", { ascending: true });

      if (!results || results.length === 0) return;
      setAllSessions(results);

      // Charger les tentatives pour chaque session
      const attemptsMap: Record<string, any[]> = {};
      const errorCount: Record<string, { count: number; lastAnswer: string }> = {};

      for (const r of results) {
        const { data: att } = await sb.from("dm_word_attempts")
          .select("*")
          .eq("result_id", r.id);
        if (att) {
          attemptsMap[r.id] = att;
          // Compter les erreurs persistantes
          att.filter((a: any) => !a.is_correct).forEach((a: any) => {
            if (!errorCount[a.word]) errorCount[a.word] = { count: 0, lastAnswer: "" };
            errorCount[a.word].count++;
            errorCount[a.word].lastAnswer = a.user_answer;
          });
        }
      }
      setSessionAttempts(attemptsMap);

      // Mots avec erreurs dans 2+ sessions
      const persistent = Object.entries(errorCount)
        .filter(([_, v]) => v.count >= 2)
        .map(([word, v]) => ({ word, count: v.count, lastAnswer: v.lastAnswer }))
        .sort((a, b) => b.count - a.count);
      setPersistentErrors(persistent);
    };
    loadHistory();
  }, [dicteeId, connectedEleve]);

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
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Retour + Titre — compact en ligne */}
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-gray-500 shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-600 font-bold uppercase">N°{dicteePosition}</span>
              <h1 className="text-xl font-bold text-gray-800">{dicteeTitle}</h1>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                dicteePosition <= 8 ? "bg-emerald-100 text-emerald-700" :
                dicteePosition <= 16 ? "bg-amber-100 text-amber-700" :
                "bg-purple-100 text-purple-700"
              }`}>
                {dicteePosition <= 8 ? "🟢 Découverte" :
                 dicteePosition <= 16 ? "🟡 Consolidation" :
                 "🟣 Maîtrise"}
              </span>
              <span className="text-xs text-gray-400">{words.length} mots</span>
            </div>
          </div>
        </div>

        {/* Layout 2 colonnes sur desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Colonne gauche : Parcours */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
              Parcours
            </h2>
          {activityOrder.map((mode, index) => {
            const info = ACTIVITY_LABELS[mode] || { label: mode, icon: "📋", desc: "" };
            const isDone = isTeacher ? false : index < completedActivities;
            const isCurrent = isTeacher ? true : index === currentStep;
            const isLocked = isTeacher ? false : index > currentStep;

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
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 bg-gray-100 opacity-60 cursor-default"
                  }
                `}
              >
                {/* Numéro / État */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0
                    ${isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-purple-600 text-white" : "bg-gray-300 text-gray-500"}
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

          {/* Colonne droite : Mots */}
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

        </div>{/* Fin grid 2 colonnes */}

        {/* HISTORIQUE COMPLET */}
        {allSessions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
              📊 Historique — {allSessions.length} session{allSessions.length > 1 ? "s" : ""}
            </h2>

            {/* Courbe de progression */}
            <div className="bg-white rounded-xl border p-3">
              <div className="text-xs font-bold text-gray-500 mb-2">Progression</div>
              <div className="flex items-end gap-1 h-16">
                {allSessions.map((s, i) => {
                  const pct = s.percentage;
                  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                      <span className="text-[9px] font-bold text-gray-600">{pct}%</span>
                      <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(pct * 0.6, 4)}px` }} />
                      <span className="text-[8px] text-gray-400">#{i + 1}</span>
                    </div>
                  );
                })}
              </div>
              {allSessions.length >= 2 && (() => {
                const first = allSessions[0].percentage;
                const last = allSessions[allSessions.length - 1].percentage;
                const diff = last - first;
                return diff > 0 ? (
                  <div className="text-[10px] text-emerald-600 font-bold mt-1">📈 +{diff} points de progression</div>
                ) : diff < 0 ? (
                  <div className="text-[10px] text-red-500 font-bold mt-1">📉 {diff} points</div>
                ) : null;
              })()}
            </div>

            {/* Mots persistants (erreurs récurrentes) */}
            {persistentErrors.length > 0 && (
              <div className="bg-red-50 rounded-xl border border-red-200 p-3">
                <div className="text-xs font-bold text-red-700 mb-2">⚠️ Mots à retravailler en priorité</div>
                <div className="grid gap-2 grid-cols-2">
                  {persistentErrors.map((e, i) => {
                    const mnemonic = findMnemonicForError(e.word, e.lastAnswer);
                    return (
                      <div key={i} className="bg-white rounded-lg border border-red-100 p-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-800">{e.word}</span>
                          <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">{e.count}× raté</span>
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
              </div>
            )}

            {/* Détail de chaque session */}
            {allSessions.map((session, idx) => {
              const att = sessionAttempts[session.id] || [];
              const errors = att.filter((a: any) => !a.is_correct);
              const correct = att.filter((a: any) => a.is_correct);
              const categories = summarizeErrors(errors.map((a: any) => ({ word: a.word, userAnswer: a.user_answer, isCorrect: false })));

              return (
                <details key={session.id} className="bg-white rounded-xl border overflow-hidden" open={idx === allSessions.length - 1}>
                  <summary className="px-3 py-2 cursor-pointer hover:bg-purple-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${session.percentage >= 80 ? "bg-emerald-100 text-emerald-700" : session.percentage >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {session.percentage}%
                      </span>
                      <span className="text-xs text-gray-500">
                        Essai #{idx + 1} — {new Date(session.created_at).toLocaleDateString("fr-FR")} — {errors.length} erreur{errors.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {categories.length > 0 && (
                      <div className="flex gap-1">
                        {categories.map(c => <span key={c.category} className="text-xs">{c.icon}</span>)}
                      </div>
                    )}
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {errors.length > 0 && (
                      <div className="grid gap-1.5 grid-cols-2">
                        {errors.map((a: any, i: number) => {
                          const mnemonic = findMnemonicForError(a.word, a.user_answer);
                          return (
                            <div key={i} className="bg-gray-50 rounded p-1.5">
                              <div className="flex items-center gap-1">
                                {mnemonic && <span className="text-xs">{mnemonic.icon}</span>}
                                <span className="text-[10px] text-red-400 line-through">{a.user_answer}</span>
                                <span className="text-[10px]">→</span>
                                <span className="text-[10px] font-bold text-emerald-700">{a.word}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {correct.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {correct.map((a: any, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] rounded">{a.word}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
