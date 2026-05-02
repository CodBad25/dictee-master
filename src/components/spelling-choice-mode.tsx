"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDmClassIdByHub } from "@/lib/dictee-service";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import { toast } from "sonner";

interface SpellingWord {
  word: string;
  definition: string;
  spelling_errors: string[];
}

export default function SpellingChoiceMode() {
  const { currentList, currentWords, clearCurrentTraining, connectedEleve } = useAppStore();
  const [words, setWords] = useState<SpellingWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [choices, setChoices] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ word: string; userAnswer: string; isCorrect: boolean }[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");
  const [loading, setLoading] = useState(true);

  // Load words with spelling errors from Supabase
  useEffect(() => {
    const load = async () => {
      if (!currentList) return;
      const sb = createClient();
      const { data } = await sb.from("dictee_words")
        .select("word, definition, spelling_errors, position")
        .eq("dictee_id", currentList.id)
        .order("position");
      if (data && data.length > 0) {
        const selectedPositions = useAppStore.getState().selectedWordPositions;
        const filtered = selectedPositions
          ? data.filter(w => selectedPositions.includes(w.position))
          : data;
        setWords(filtered);
        prepareChoices(filtered, 0);
      }
      setLoading(false);
    };
    load();
  }, [currentList]);

  // Prepare choices for a given word index
  const prepareChoices = (wordList: SpellingWord[], index: number) => {
    const w = wordList[index];
    if (!w) return;

    let errors = (w.spelling_errors || []).filter(e => e && e.trim() !== w.word);

    // Fallback: if no errors, generate a simple one
    if (errors.length === 0) {
      const base = w.word.replace(/^(le |la |l'|un |une |les |des |du )/i, "");
      // Simple accent removal as fallback
      const fallback = w.word.replace(/[éèê]/g, "e").replace(/[àâ]/g, "a").replace(/[ùû]/g, "u").replace(/ç/g, "c").replace(/[ôö]/g, "o").replace(/[îï]/g, "i");
      if (fallback !== w.word) {
        errors = [fallback];
      } else {
        // Double a consonant or remove last letter
        errors = [w.word + w.word[w.word.length - 2]];
      }
    }

    // Take 1-2 wrong choices
    const shuffledErrors = [...errors].sort(() => Math.random() - 0.5);
    const numWrong = shuffledErrors.length >= 2 ? (Math.random() > 0.5 ? 2 : 1) : 1;
    const wrongChoices = shuffledErrors.slice(0, numWrong);

    // ALWAYS at least 2 choices (1 correct + 1 wrong minimum)
    const allChoices = [w.word, ...wrongChoices].sort(() => Math.random() - 0.5);
    setChoices(allChoices);
    setSelected(null);
    setIsCorrect(null);
  };

  const handleChoice = (choice: string) => {
    if (selected) return; // Already answered

    const correct = choice === words[currentIndex].word;
    setSelected(choice);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);

    setAnswers(prev => [...prev, {
      word: words[currentIndex].word,
      userAnswer: choice,
      isCorrect: correct,
    }]);

    // Auto-advance after 1.2s
    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        prepareChoices(words, nextIndex);
      } else {
        setPhase("done");
        // Sauvegarder le résultat dans dm_results
        if (connectedEleve && currentList) {
          const finalScore = score + (correct ? 1 : 0);
          const pct = Math.round((finalScore / words.length) * 100);
          const sb = createClient();
          getDmClassIdByHub(connectedEleve.classeId).then((classId) => {
            if (!classId) {
              console.error("spelling-choice: dm_classes introuvable pour", connectedEleve.classeId);
              return;
            }
            sb.from("dm_results").insert({
              class_id: classId,
              student_id: connectedEleve.eleveId,
              student_name: `${connectedEleve.prenom} ${connectedEleve.nom}`,
              dictee_id: currentList.id,
              activity_mode: "spelling_choice",
              score: finalScore,
              total: words.length,
              percentage: pct,
              time_spent: 0,
            }).then(({ error }) => {
              if (error) console.error("Erreur sauvegarde spelling:", error.message);
            });
          });
        }
      }
    }, 1200);
  };

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center"><div className="text-purple-500">Chargement...</div></div>;
  }

  if (!currentList || words.length === 0) {
    return <div className="min-h-dvh flex items-center justify-center"><p>Aucun mot disponible</p></div>;
  }

  // Results screen
  if (phase === "done") {
    const pct = Math.round((score / words.length) * 100);
    // Import and use DicteeResults component
    const DicteeResults = require("@/components/dictee-results").default;
    return (
      <DicteeResults
        title={currentList.title + " — Choix orthographique"}
        answers={answers}
        timeSpent={0}
        onRetryErrors={() => {
          // Retry only wrong words
          const wrongWords = answers.filter(a => !a.isCorrect).map(a => a.word);
          const filtered = words.filter(w => wrongWords.includes(w.word));
          if (filtered.length > 0) {
            setWords(filtered);
            setCurrentIndex(0);
            setScore(0);
            setAnswers([]);
            setPhase("playing");
            prepareChoices(filtered, 0);
          }
        }}
        onRetryAll={() => {
          setCurrentIndex(0);
          setScore(0);
          setAnswers([]);
          setPhase("playing");
          prepareChoices(words, 0);
        }}
        onNext={() => clearCurrentTraining()}
      />
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <main className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => clearCurrentTraining()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quitter
        </Button>
        <span className="text-sm font-bold text-purple-600">{currentList.title}</span>
        <span className="text-sm text-gray-500">{currentIndex + 1}/{words.length}</span>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {/* Definition as hint */}
        {currentWord.definition && (
          <p className="text-sm text-gray-500 text-center max-w-md italic">
            « {currentWord.definition} »
          </p>
        )}

        {/* Question */}
        <h2 className="text-lg font-bold text-gray-800">Quelle est la bonne orthographe ?</h2>

        {/* Choices */}
        <div className="flex flex-col gap-3 w-full max-w-sm">
          {choices.map((choice, i) => {
            const isSelected = selected === choice;
            const isCorrectChoice = choice === currentWord.word;
            let bg = "bg-white border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50";

            if (selected) {
              if (isCorrectChoice) {
                bg = "bg-emerald-50 border-2 border-emerald-500";
              } else if (isSelected && !isCorrectChoice) {
                bg = "bg-red-50 border-2 border-red-400";
              } else {
                bg = "bg-white border-2 border-gray-100 opacity-50";
              }
            }

            return (
              <button
                key={i}
                onClick={() => handleChoice(choice)}
                disabled={!!selected}
                className={`${bg} rounded-xl px-6 py-4 text-lg font-bold text-center transition-all ${
                  !selected ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {selected && isCorrectChoice && <Check className="w-5 h-5 text-emerald-600" />}
                  {selected && isSelected && !isCorrectChoice && <X className="w-5 h-5 text-red-500" />}
                  <span>{choice}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Score */}
        <div className="text-sm text-gray-400">
          Score : {score}/{currentIndex + (selected ? 1 : 0)}
        </div>
      </div>
    </main>
  );
}
