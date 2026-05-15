"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw, Check, X } from "lucide-react";
import { findMnemonicForError, summarizeErrors } from "@/lib/mnemonics";

interface Answer {
  word: string;
  userAnswer: string;
  isCorrect: boolean;
  // Pour le mode "classe grammaticale" : la bonne réponse n'est pas le mot,
  // mais sa classe (ex : word="amazonien", correctAnswer="Adjectif").
  correctAnswer?: string;
}

interface DicteeResultsProps {
  title: string;
  answers: Answer[];
  timeSpent: number;
  onRetryErrors: () => void;
  onRetryAll: () => void;
  onNext: () => void;
}

export default function DicteeResults({
  title,
  answers,
  timeSpent,
  onRetryErrors,
  onRetryAll,
  onNext,
}: DicteeResultsProps) {
  const correct = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  const pct = Math.round((correct / total) * 100);
  const errors = answers.filter((a) => !a.isCorrect);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;

  // Couleur du score
  const scoreColor =
    pct >= 80
      ? "text-emerald-600"
      : pct >= 50
      ? "text-amber-600"
      : "text-red-500";

  const scoreBg =
    pct >= 80
      ? "from-emerald-500 to-emerald-600"
      : pct >= 50
      ? "from-amber-400 to-amber-500"
      : "from-red-400 to-red-500";

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col">
      {/* Header compact */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800">{title}</span>
        <span className="text-xs text-gray-400">
          {minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`}
        </span>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 max-w-2xl mx-auto w-full">
        {/* Score en gros */}
        <div className="flex items-center justify-center gap-6">
          <div
            className={`w-20 h-20 rounded-full bg-gradient-to-br ${scoreBg} flex items-center justify-center shadow-lg`}
          >
            <span className="text-2xl font-black text-white">{pct}%</span>
          </div>
          <div>
            <div className={`text-3xl font-black ${scoreColor}`}>
              {correct}/{total}
            </div>
            <div className="text-xs text-gray-400">
              {pct >= 80
                ? "Excellent !"
                : pct >= 50
                ? "Continue tes efforts !"
                : "Courage, tu vas y arriver !"}
            </div>
          </div>
        </div>

        {/* Grille des résultats — tout visible */}
        <div className="flex-1 overflow-hidden">
          {errors.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">🎉</div>
              <div className="font-bold text-emerald-600">Parfait ! Aucune erreur !</div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Résumé par catégorie d'erreur */}
              {(() => {
                const summary = summarizeErrors(errors);
                return summary.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.map((s) => (
                      <span
                        key={s.category}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold ${s.color}`}
                      >
                        {s.icon} {s.category} ×{s.count}
                      </span>
                    ))}
                  </div>
                ) : null;
              })()}
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {errors.length} erreur{errors.length > 1 ? "s" : ""} à revoir
              </div>
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns:
                    errors.length <= 4
                      ? "1fr"
                      : "1fr 1fr",
                }}
              >
                {errors.map((a, i) => {
                  // Mode classe grammaticale : afficher la bonne classe + le mot en contexte
                  const isGrammarMode = !!a.correctAnswer;
                  const correctDisplay = a.correctAnswer ?? a.word;
                  // Pas de mnémonique orthographique en mode classe grammaticale
                  const mnemonic = isGrammarMode
                    ? null
                    : findMnemonicForError(a.word, a.userAnswer);
                  return (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-red-100 p-3 space-y-1"
                    >
                      {isGrammarMode && (
                        <div className="text-[11px] font-semibold text-gray-500 mb-1">
                          Mot : <span className="text-gray-800">{a.word}</span>
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
                            <span className="text-sm text-red-400 line-through truncate">
                              {a.userAnswer || "(vide)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="text-sm font-bold text-emerald-700 truncate">
                              {correctDisplay}
                            </span>
                          </div>
                        </div>
                        {mnemonic && (
                          <span className="text-lg shrink-0" title={mnemonic.category}>
                            {mnemonic.icon}
                          </span>
                        )}
                      </div>
                      {mnemonic && (
                        <div className={`rounded-lg px-2.5 py-1.5 mt-1 border ${mnemonic.color}`}>
                          <div className="text-[10px] font-bold flex items-center gap-1">
                            {mnemonic.icon} {mnemonic.title}
                          </div>
                          <div className="text-[11px] leading-tight opacity-90">
                            {mnemonic.tip}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mots réussis (compact) */}
              {correct > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-gray-400 mb-1">
                    ✅ {correct} mot{correct > 1 ? "s" : ""} réussi{correct > 1 ? "s" : ""}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {answers
                      .filter((a) => a.isCorrect)
                      .map((a, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-medium rounded-md"
                        >
                          {a.word}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Boutons */}
        <div className="flex flex-col gap-2 shrink-0 pb-2">
          {errors.length > 0 && (
            <Button
              variant="outline"
              onClick={onRetryErrors}
              className="w-full h-11 rounded-xl text-sm font-bold border-amber-200 text-amber-700 hover:bg-amber-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retravailler mes erreurs ({errors.length} mot{errors.length > 1 ? "s" : ""})
            </Button>
          )}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onRetryAll}
              className="flex-1 h-11 rounded-xl text-sm font-bold"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Recommencer tout
            </Button>
            <Button
              onClick={onNext}
              className="flex-1 h-11 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600"
            >
              Continuer <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
