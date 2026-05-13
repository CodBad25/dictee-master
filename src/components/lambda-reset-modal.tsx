"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, X, Trash2, RotateCcw } from "lucide-react";

const LAMBDA_ID_6T = "cmn2ca8bp00rt01rx2gxh72nw";

interface DicteeResults {
  dicteeId: string;
  title: string;
  position: number;
  exerciseCount: number;
  bestScore: number;
}

interface LambdaResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LambdaResetModal({ isOpen, onClose }: LambdaResetModalProps) {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DicteeResults[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [confirmAllStep, setConfirmAllStep] = useState<0 | 1 | 2>(0);
  const [confirmDicteeId, setConfirmDicteeId] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb
        .from("dm_results")
        .select("dictee_id, percentage, dictees(id, title, position)")
        .eq("student_id", LAMBDA_ID_6T);

      if (!data || data.length === 0) {
        setResults([]);
        return;
      }

      // Grouper par dictée
      const grouped = new Map<string, DicteeResults>();
      for (const row of data) {
        const dictee = (row as { dictees: { id: string; title: string; position: number } | { id: string; title: string; position: number }[] | null }).dictees;
        const d = Array.isArray(dictee) ? dictee[0] : dictee;
        if (!d) continue;
        const existing = grouped.get(d.id);
        const pct = (row as { percentage: number }).percentage;
        if (existing) {
          existing.exerciseCount++;
          if (pct > existing.bestScore) existing.bestScore = pct;
        } else {
          grouped.set(d.id, {
            dicteeId: d.id,
            title: d.title,
            position: d.position,
            exerciseCount: 1,
            bestScore: pct,
          });
        }
      }

      const sorted = Array.from(grouped.values()).sort((a, b) => a.position - b.position);
      setResults(sorted);
    } catch (err) {
      console.error("[lambda-reset]", err);
      toast.error("Erreur lors du chargement des résultats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadResults();
      setConfirmAllStep(0);
      setConfirmDicteeId(null);
    }
  }, [isOpen, loadResults]);

  const reset = async (dicteeId: string | null) => {
    setResettingId(dicteeId ?? "ALL");
    try {
      const teacherPassword = process.env.NEXT_PUBLIC_TEACHER_PASSWORD || "";
      const body: Record<string, string> = { studentId: LAMBDA_ID_6T };
      if (dicteeId) body.dicteeId = dicteeId;

      const res = await fetch("/api/student-results/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-teacher-password": teacherPassword },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error || "Erreur lors de la réinitialisation");
        return;
      }
      const n = json.deletedCount || 0;
      toast.success(`${n} exercice${n > 1 ? "s" : ""} réinitialisé${n > 1 ? "s" : ""} ✓`);
      await loadResults();
      setConfirmAllStep(0);
      setConfirmDicteeId(null);
    } catch (err) {
      console.error("[lambda-reset]", err);
      toast.error("Erreur réseau");
    } finally {
      setResettingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              🗑️ Réinitialiser Lambda
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Lambda BELHAJ — Classe 6T · <span className="text-amber-700">compte partagé entre tous les profs</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-2xl mb-2">✨</p>
              <p>Lambda n&apos;a aucun résultat enregistré.</p>
              <p className="text-xs mt-1">Tout est déjà à blanc.</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-700 mb-3">
                Résultats actuels ({results.length} dictée{results.length > 1 ? "s" : ""})
              </p>
              <div className="space-y-2">
                {results.map((r) => {
                  const isConfirming = confirmDicteeId === r.dicteeId;
                  const isResetting = resettingId === r.dicteeId;
                  return (
                    <div
                      key={r.dicteeId}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {r.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.exerciseCount} exercice{r.exerciseCount > 1 ? "s" : ""} · meilleur score : {Math.round(r.bestScore)}%
                        </p>
                      </div>
                      {isConfirming ? (
                        <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-300 rounded-lg px-2 py-1">
                          <span className="text-xs text-amber-800">Confirmer ?</span>
                          <button
                            disabled={isResetting}
                            onClick={() => reset(r.dicteeId)}
                            className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
                          >
                            {isResetting ? "…" : "✓ Oui"}
                          </button>
                          <button
                            disabled={isResetting}
                            onClick={() => setConfirmDicteeId(null)}
                            className="text-xs px-2 py-0.5 rounded text-gray-600 hover:bg-gray-200"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDicteeId(r.dicteeId)}
                          disabled={resettingId !== null}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-semibold transition disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset cette dictée
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-red-50">
            {confirmAllStep === 0 && (
              <button
                onClick={() => setConfirmAllStep(1)}
                disabled={resettingId !== null}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Tout effacer
              </button>
            )}
            {confirmAllStep === 1 && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-800 flex-1">
                  ⚠️ Effacer TOUS les résultats de Lambda sur TOUTES les dictées ?
                </p>
                <button
                  onClick={() => setConfirmAllStep(2)}
                  className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold"
                >
                  Continuer
                </button>
                <button
                  onClick={() => setConfirmAllStep(0)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs"
                >
                  Annuler
                </button>
              </div>
            )}
            {confirmAllStep === 2 && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-red-800 flex-1 font-semibold">
                  🚨 Dernière confirmation — c&apos;est définitif :
                </p>
                <button
                  disabled={resettingId !== null}
                  onClick={() => reset(null)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {resettingId === "ALL" ? "…" : "✓ Tout effacer maintenant"}
                </button>
                <button
                  onClick={() => setConfirmAllStep(0)}
                  className="px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs"
                >
                  Annuler
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
