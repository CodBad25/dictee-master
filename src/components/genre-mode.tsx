"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDmClassIdByHub } from "@/lib/dictee-service";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import DicteeResults from "@/components/dictee-results";

export default function GenreMode() {
  const { currentList, currentWords, clearCurrentTraining, connectedEleve } = useAppStore();
  const [words, setWords] = useState<{ word: string; definition: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<{ word: string; userAnswer: string; isCorrect: boolean }[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");

  useEffect(() => {
    if (!currentList) return;
    const sb = createClient();
    const selectedPositions = useAppStore.getState().selectedWordPositions;
    sb.from("dictee_words")
      .select("word, definition, position")
      .eq("dictee_id", currentList.id)
      .order("position")
      .then(({ data }) => {
        if (data) {
          let filtered = data.filter(w => /^(le |la |l'|un |une |les |des |du )/.test(w.word));
          if (selectedPositions) {
            filtered = filtered.filter(w => selectedPositions.includes(w.position));
          }
          setWords(filtered);
        }
      });
  }, [currentList]);

  // Extract article and base word
  const getArticleAndWord = (fullWord: string) => {
    const match = fullWord.match(/^(le |la |l'|un |une |les |des |du )(.*)/i);
    if (!match) return { article: "", base: fullWord };
    return { article: match[1].trim(), base: match[2] };
  };

  // Get possible article choices for current word
  const getChoices = (article: string) => {
    if (article === "l'") return ["le", "la", "l'"];
    if (article === "le" || article === "la") return ["le", "la", "l'"];
    if (article === "un" || article === "une") return ["un", "une"];
    if (article === "les" || article === "des") return ["les", "des"];
    return ["le", "la", "l'", "un", "une"];
  };

  const handleChoice = (choice: string) => {
    if (selected || words.length === 0) return;
    const { article, base } = getArticleAndWord(words[currentIndex].word);
    const correct = choice === article;
    setSelected(choice);
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
    setAnswers(prev => [...prev, { word: words[currentIndex].word, userAnswer: `${choice} ${base}`, isCorrect: correct }]);

    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        setCurrentIndex(i => i + 1);
        setSelected(null);
        setIsCorrect(null);
      } else {
        setPhase("done");
        // Sauvegarder le résultat dans dm_results
        if (connectedEleve && currentList) {
          const finalScore = score + (correct ? 1 : 0);
          const pct = Math.round((finalScore / words.length) * 100);
          const sb = createClient();
          getDmClassIdByHub(connectedEleve.classeId).then((classId) => {
            if (!classId) {
              console.error("genre: dm_classes introuvable pour", connectedEleve.classeId);
              return;
            }
            sb.from("dm_results").insert({
              class_id: classId,
              student_id: connectedEleve.eleveId,
              student_name: `${connectedEleve.prenom} ${connectedEleve.nom}`,
              dictee_id: currentList.id,
              activity_mode: "genre",
              score: finalScore,
              total: words.length,
              percentage: pct,
              time_spent: 0,
            }).then(({ error }) => {
              if (error) console.error("Erreur sauvegarde genre:", error.message);
            });
          });
        }
      }
    }, 1000);
  };

  if (!currentList || words.length === 0) return null;

  if (phase === "done") {
    return (
      <DicteeResults
        title={currentList.title + " — Genre"}
        answers={answers}
        timeSpent={0}
        onRetryErrors={() => {
          const wrong = answers.filter(a => !a.isCorrect).map(a => a.word);
          const filtered = words.filter(w => wrong.includes(w.word));
          if (filtered.length) {
            setWords(filtered);
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

  const { article, base } = getArticleAndWord(words[currentIndex].word);
  const choices = getChoices(article);
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <main className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => clearCurrentTraining()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quitter
        </Button>
        <span className="text-sm font-bold text-purple-600">
          {currentList.title} — Genre
        </span>
        <span className="text-sm text-gray-500">
          {currentIndex + 1}/{words.length}
        </span>
      </header>
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <h2 className="text-lg font-bold text-gray-600">Quel article pour ce mot ?</h2>
        <div className="text-4xl font-black text-gray-800">{base}</div>
        {words[currentIndex].definition && (
          <p className="text-sm text-gray-400 italic text-center max-w-md">
            « {words[currentIndex].definition} »
          </p>
        )}
        <div className="flex gap-3">
          {choices.map(c => {
            let bg = "bg-white border-2 border-gray-200 hover:border-purple-400 hover:bg-purple-50";
            if (selected) {
              if (c === article) bg = "bg-emerald-50 border-2 border-emerald-500";
              else if (c === selected) bg = "bg-red-50 border-2 border-red-400";
              else bg = "bg-white border-2 border-gray-100 opacity-50";
            }
            return (
              <button
                key={c}
                onClick={() => handleChoice(c)}
                disabled={!!selected}
                className={`${bg} rounded-xl px-8 py-4 text-xl font-bold transition-all ${
                  !selected ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {selected && c === article && (
                  <Check className="w-5 h-5 text-emerald-600 inline mr-1" />
                )}
                {selected && c === selected && c !== article && (
                  <X className="w-5 h-5 text-red-500 inline mr-1" />
                )}
                {c}
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
