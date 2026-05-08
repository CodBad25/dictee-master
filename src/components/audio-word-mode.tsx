"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Check, X, RotateCcw, Trophy, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { playWordAudio, stopAudio } from "@/lib/audio";
import confetti from "canvas-confetti";

type Phase = "listening" | "feedback" | "result";

function normalizeForComparison(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019\u02BC]/g, "'")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripArticle(text: string): string {
  return text.replace(/^(le |la |l'|l\u2019|un |une |les |des |du )/i, "").trim();
}

export default function AudioWordMode() {
  const {
    currentList,
    currentWords,
    clearCurrentTraining,
    updateStreak,
    streak,
    addBadge,
    currentStudentName,
  } = useAppStore();
  const { saveSession } = useSupabaseSync();

  // Tous les hooks AVANT le return conditionnel (Rules of Hooks)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>("listening");
  const [answers, setAnswers] = useState<{ word: string; userAnswer: string; isCorrect: boolean }[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [startTime] = useState(Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAutoPlayedIndex = useRef(-1);

  const currentWord = currentWords[currentIndex];

  if (!currentList || !currentWords.length) return null;
  const progress = ((currentIndex + 1) / currentWords.length) * 100;
  const correctCount = answers.filter(a => a.isCorrect).length;

  const playWord = useCallback(() => {
    if (!currentWord) return;
    setIsPlaying(true);
    playWordAudio(
      currentWord.word,
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, [currentWord]);

  useEffect(() => {
    if (phase === "listening" && lastAutoPlayedIndex.current !== currentIndex) {
      lastAutoPlayedIndex.current = currentIndex;
      const timer = setTimeout(() => playWord(), 300);
      return () => clearTimeout(timer);
    }
  }, [phase, currentIndex, playWord]);

  useEffect(() => {
    if (phase === "listening") {
      inputRef.current?.focus();
    }
  }, [phase, currentIndex]);

  const handleValidate = () => {
    if (!currentWord || answer.trim().length === 0) {
      toast.error("Écris une réponse !");
      return;
    }

    const userAnswer = answer.trim();
    const normalized = normalizeForComparison(userAnswer);
    const expectedNormalized = normalizeForComparison(currentWord.word);
    // Accepter : réponse exacte OU sans article
    const correct = normalized === expectedNormalized
      || normalizeForComparison(stripArticle(userAnswer)) === normalizeForComparison(stripArticle(currentWord.word))
      || normalized === normalizeForComparison(stripArticle(currentWord.word));

    setIsCorrect(correct);
    setAnswers(prev => [...prev, { word: currentWord.word, userAnswer, isCorrect: correct }]);
    setPhase("feedback");

    if (correct) {
      confetti({
        particleCount: 30,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < currentWords.length - 1) {
      setCurrentIndex(i => i + 1);
      setAnswer("");
      setIsCorrect(null);
      setPhase("listening");
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    stopAudio();
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    const percentage = Math.round((correctCount / currentWords.length) * 100);

    const newStreak = isCorrect ? streak + 1 : 0;
    updateStreak(newStreak);

    if (percentage >= 80) {
      addBadge("audio-master");
    }

    await saveSession({
      listId: currentList.id,
      listTitle: currentList.title,
      studentName: currentStudentName,
      modeUsed: "audio_word",
      totalWords: currentWords.length,
      correctWords: correctCount,
      percentage,
      timeSpentSeconds: timeSpent,
      answers,
    });

    setPhase("result");
  };

  const handleRetry = () => {
    clearCurrentTraining();
  };

  if (phase === "result") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">{currentList.title} — Audio</span>
          <span className="text-xs text-gray-400">{Math.floor((Date.now() - startTime) / 1000)}s</span>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-4 max-w-2xl mx-auto w-full">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center justify-center gap-6"
          >
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                correctCount >= currentWords.length * 0.8
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                  : correctCount >= currentWords.length * 0.5
                  ? "bg-gradient-to-br from-amber-400 to-amber-500"
                  : "bg-gradient-to-br from-red-400 to-red-500"
              }`}
            >
              <span className="text-2xl font-black text-white">
                {Math.round((correctCount / currentWords.length) * 100)}%
              </span>
            </div>
            <div>
              <div className="text-3xl font-black text-purple-600">
                {correctCount}/{currentWords.length}
              </div>
              <div className="text-xs text-gray-400">
                {correctCount >= currentWords.length * 0.8
                  ? "Excellent !"
                  : correctCount >= currentWords.length * 0.5
                  ? "Continue tes efforts !"
                  : "Courage, tu vas y arriver !"}
              </div>
            </div>
          </motion.div>

          <div className="mt-6 space-y-2">
            {answers.map((a, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg ${
                  a.isCorrect ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  {a.isCorrect ? (
                    <Check className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <X className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold text-gray-800">{a.word}</span>
                </div>
                {!a.isCorrect && (
                  <div className="text-sm text-gray-600 ml-7">Tu as écrit : {a.userAnswer}</div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="flex-1 rounded-2xl border-2 border-purple-200 hover:bg-purple-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Recommencer
            </Button>
            <Button
              onClick={handleRetry}
              className="flex-1 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg shadow-md"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Terminer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-800">{currentList.title} — Audio</span>
        <span className="text-xs text-gray-400 font-medium">
          Mot {currentIndex + 1}/{currentWords.length}
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <AnimatePresence mode="wait">
          {phase === "listening" && (
            <motion.div
              key="listening"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-6 w-full max-w-md"
            >
              <motion.button
                animate={{ scale: isPlaying ? 1.1 : 1 }}
                onClick={playWord}
                disabled={isPlaying}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 hover:shadow-xl shadow-lg disabled:opacity-70 flex items-center justify-center transition-all"
              >
                <Volume2 className="w-12 h-12 text-white" />
              </motion.button>

              <p className="text-gray-500 text-sm text-center">Clique sur le haut-parleur ou attends</p>

              <div className="w-full space-y-3">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Écris le mot..."
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleValidate()}
                  className="text-center text-lg h-12 rounded-xl border-2 border-purple-200"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-gramm="false"
                />

                <Button
                  onClick={handleValidate}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg shadow-md font-semibold"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Valider
                </Button>
              </div>
            </motion.div>
          )}

          {phase === "feedback" && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-6 w-full max-w-md"
            >
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
                  isCorrect ? "bg-emerald-500" : "bg-red-500"
                }`}
              >
                {isCorrect ? (
                  <Check className="w-10 h-10 text-white" />
                ) : (
                  <X className="w-10 h-10 text-white" />
                )}
              </div>

              <div className="text-center">
                <h3 className={`text-2xl font-bold ${isCorrect ? "text-emerald-600" : "text-red-600"}`}>
                  {isCorrect ? "Bonne réponse !" : "Pas tout à fait"}
                </h3>
              </div>

              <div className="bg-white rounded-xl p-4 w-full border-2 border-gray-100">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Réponse attendue</p>
                <p className="text-xl font-bold text-gray-800">{currentWord.word}</p>
              </div>

              {!isCorrect && (
                <div className="bg-blue-50 rounded-xl p-4 w-full border-2 border-blue-200">
                  <p className="text-xs text-blue-600 uppercase tracking-wide">Tu as écrit</p>
                  <p className="text-lg font-semibold text-blue-900">{answer}</p>
                </div>
              )}

              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:shadow-lg shadow-md font-semibold"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Suivant
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
