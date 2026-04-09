"use client";

import { useState } from "react";

type ErrorCategory = "ortho" | "genre" | "def" | "dict";

interface ErrorTabsProps {
  wordAttempts: Record<string, any>;
  results: Record<string, any>;
  dictees: { id: string; title: string; position: number }[];
}

const MODE_MAP: Record<ErrorCategory, string[]> = {
  ortho: ["flashcard", "audio", "audio_word", "audio_dictation", "fill_blanks", "spelling_choice"],
  genre: ["genre"],
  def: ["definitions"],
  dict: ["dictionary"],
};

const TABS: { key: ErrorCategory; label: string }[] = [
  { key: "ortho", label: "✏️ Orthographe" },
  { key: "genre", label: "🏷️ Genre" },
  { key: "def", label: "📖 Définitions" },
  { key: "dict", label: "📚 Dictionnaire" },
];

export default function ErrorTabs({ wordAttempts, results, dictees }: ErrorTabsProps) {
  const [activeTab, setActiveTab] = useState<ErrorCategory>("ortho");

  const getErrors = (category: ErrorCategory) => {
    const targetModes = MODE_MAP[category];

    const rInfo: Record<string, { dictee_id: string; mode: string }> = {};
    Object.values(results).forEach((r: any) => {
      if (r.id && r.dictee_id) rInfo[r.id] = { dictee_id: r.dictee_id, mode: r.activity_mode || "" };
    });

    const agg: Record<string, { word: string; dicteeId: string; total: number; variants: Record<string, number> }> = {};
    Object.values(wordAttempts).forEach((wa: any) => {
      if (wa.is_correct) return;
      const ri = rInfo[wa.result_id];
      if (!ri || !targetModes.includes(ri.mode)) return;
      const key = `${wa.word}|${ri.dictee_id}`;
      if (!agg[key]) agg[key] = { word: wa.word, dicteeId: ri.dictee_id, total: 0, variants: {} };
      agg[key].total++;
      const v = wa.user_answer || "(vide)";
      agg[key].variants[v] = (agg[key].variants[v] || 0) + 1;
    });

    return Object.values(agg)
      .map(e => ({
        word: e.word,
        dicteeTitle: dictees.find(d => d.id === e.dicteeId)?.title || "?",
        total: e.total,
        variants: Object.entries(e.variants).sort(([, a], [, b]) => b - a) as [string, number][],
      }))
      .sort((a, b) => b.total - a.total);
  };

  const errors = getErrors(activeTab);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === t.key
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {errors.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Aucune erreur dans cette catégorie.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase border-b">
              <th className="py-2 px-3 w-12">#</th>
              <th className="py-2 px-3">Mot attendu</th>
              <th className="py-2 px-3">Dictée</th>
              <th className="py-2 px-3">Réponses des élèves</th>
            </tr>
          </thead>
          <tbody>
            {errors.slice(0, 80).map((err, idx) => (
              <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold ${
                    err.total >= 10 ? "bg-red-500" : err.total >= 5 ? "bg-orange-400" : "bg-yellow-400"
                  }`}>
                    {err.total}
                  </span>
                </td>
                <td className="py-2 px-3 font-semibold text-gray-900">{err.word}</td>
                <td className="py-2 px-3 text-gray-500 text-xs">{err.dicteeTitle}</td>
                <td className="py-2 px-3">
                  <div className="flex flex-wrap gap-1.5">
                    {err.variants.slice(0, 6).map(([variant, count], i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs">
                        <span className="line-through">{variant}</span>
                        <span className="font-bold text-red-500">×{count}</span>
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
