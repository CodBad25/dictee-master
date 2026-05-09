"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDmClassIdByHub } from "@/lib/dictee-service";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import DicteeResults from "@/components/dictee-results";
import {
  classifyWord,
  buildChoices,
  shuffleChoices,
  GRAMMAR_LABELS,
  type GrammaticalClass,
} from "@/lib/grammar-classifier";

type Row = {
  word: string;
  position: number;
  grammatical_class: GrammaticalClass | null;
};

// Affichage : retire les parenthèses et l'article pour ne montrer que le mot principal
function displayWord(raw: string): string {
  const noParens = raw.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return noParens.replace(/^(le |la |les |l['’]|un |une |des |du )/i, "").trim();
}

export default function GrammarClassMode() {
  const { currentList, clearCurrentTraining, connectedEleve } = useAppStore();
  const [rows, setRows] = useState<Row[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<GrammaticalClass | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ word: string; userAnswer: string; isCorrect: boolean }[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");

  useEffect(() => {
    if (!currentList) return;
    const sb = createClient();
    const selectedPositions = useAppStore.getState().selectedWordPositions;
    sb.from("dictee_words")
      .select("word, position, grammatical_class")
      .eq("dictee_id", currentList.id)
      .order("position")
      .then(({ data }) => {
        if (!data) return;
        let filtered = data as Row[];
        if (selectedPositions) {
          filtered = filtered.filter(w => selectedPositions.includes(w.position));
        }
        setRows(filtered);
      });
  }, [currentList]);

  const current = rows[currentIndex];
  const correctClass: GrammaticalClass | null = useMemo(() => {
    if (!current) return null;
    return current.grammatical_class ?? classifyWord(current.word);
  }, [current]);

  const choices = useMemo(() => {
    if (!correctClass || !current) return [] as GrammaticalClass[];
    return shuffleChoices(buildChoices(correctClass), current.word);
  }, [correctClass, current]);

  const handleChoice = (choice: GrammaticalClass) => {
    if (selected || !current || !correctClass) return;
    const correct = choice === correctClass;
    setSelected(choice);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
    setAnswers(prev => [...prev, {
      word: current.word,
      userAnswer: GRAMMAR_LABELS[choice],
      isCorrect: correct,
    }]);

    setTimeout(() => {
      if (currentIndex < rows.length - 1) {
        setCurrentIndex(i => i + 1);
        setSelected(null);
        setIsCorrect(null);
      } else {
        setPhase("done");
        if (connectedEleve && currentList) {
          const finalScore = score + (correct ? 1 : 0);
          const pct = Math.round((finalScore / rows.length) * 100);
          const sb = createClient();
          getDmClassIdByHub(connectedEleve.classeId).then((classId) => {
            if (!classId) return;
            sb.from("dm_results").insert({
              class_id: classId,
              student_id: connectedEleve.eleveId,
              student_name: `${connectedEleve.prenom} ${connectedEleve.nom}`,
              dictee_id: currentList.id,
              activity_mode: "grammar_class",
              score: finalScore,
              total: rows.length,
              percentage: pct,
              time_spent: 0,
            }).then(({ error }) => {
              if (error) console.error("Erreur sauvegarde grammar_class:", error.message);
            });
          });
        }
      }
    }, 1000);
  };

  if (!currentList || rows.length === 0) return null;

  if (phase === "done") {
    return (
      <DicteeResults
        title={currentList.title + " — Classes grammaticales"}
        answers={answers}
        timeSpent={0}
        onRetryErrors={() => {
          const wrong = answers.filter(a => !a.isCorrect).map(a => a.word);
          const filtered = rows.filter(r => wrong.includes(r.word));
          if (filtered.length) {
            setRows(filtered);
            setCurrentIndex(0);
            setScore(0);
            setAnswers([]);
            setPhase("playing");
            setSelected(null);
            setIsCorrect(null);
          }
        }}
        onRetryAll={() => {
          setCurrentIndex(0);
          setScore(0);
          setAnswers([]);
          setPhase("playing");
          setSelected(null);
          setIsCorrect(null);
        }}
        onNext={() => clearCurrentTraining()}
      />
    );
  }

  const progress = ((currentIndex + 1) / rows.length) * 100;
  const display = displayWord(current.word);

  return (
    <main className="min-h-dvh bg-gradient-to-br from-cyan-50 via-white to-sky-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => clearCurrentTraining()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quitter
        </Button>
        <span className="text-sm font-bold text-cyan-700">
          {currentList.title} — Classes grammaticales
        </span>
        <span className="text-sm text-gray-500">
          {currentIndex + 1}/{rows.length}
        </span>
      </header>
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-cyan-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h2 className="text-lg font-bold text-gray-600">Quelle est la classe grammaticale de ce mot ?</h2>
        <div className="text-4xl font-black text-gray-800">{display}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
          {choices.map(c => {
            let bg = "bg-white border-2 border-gray-200 hover:border-cyan-400 hover:bg-cyan-50";
            if (selected) {
              if (c === correctClass) bg = "bg-emerald-50 border-2 border-emerald-500";
              else if (c === selected) bg = "bg-red-50 border-2 border-red-400";
              else bg = "bg-white border-2 border-gray-100 opacity-50";
            }
            return (
              <button
                key={c}
                onClick={() => handleChoice(c)}
                disabled={!!selected}
                className={`${bg} rounded-xl px-6 py-4 text-lg font-bold transition-all ${
                  !selected ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {selected && c === correctClass && (
                  <Check className="w-5 h-5 text-emerald-600 inline mr-1" />
                )}
                {selected && c === selected && c !== correctClass && (
                  <X className="w-5 h-5 text-red-500 inline mr-1" />
                )}
                {GRAMMAR_LABELS[c]}
              </button>
            );
          })}
        </div>
        <div className="text-sm text-gray-400">
          Score : {score}/{currentIndex + (selected ? 1 : 0)}
        </div>
      </div>
    </main>
  );
}
