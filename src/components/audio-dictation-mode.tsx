"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2,
  Check,
  X,
  RotateCcw,
  Trophy,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { playTextAudio, stopAudio } from "@/lib/audio";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";

type Phase = "loading" | "dictation" | "result";

interface Phrase {
  text: string;
  index: number;
}

interface PhraseDictation {
  phrase: string;
  userAnswer: string;
  isCorrect: boolean;
  correctWords: number;
  totalWords: number;
}

// Normaliser le texte pour comparaison (insensible à la casse et aux accents)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprimer les diacritiques
    .trim();
}

// Comparer deux textes mot par mot
function compareAnswers(original: string, userAnswer: string): PhraseDictation {
  const originalWords = original.split(/\s+/).filter((w) => w.length > 0);
  const userWords = userAnswer.split(/\s+/).filter((w) => w.length > 0);

  let correctCount = 0;
  for (let i = 0; i < Math.min(originalWords.length, userWords.length); i++) {
    if (
      normalizeText(originalWords[i]) === normalizeText(userWords[i])
    ) {
      correctCount++;
    }
  }

  const isCorrect = correctCount === originalWords.length &&
    userWords.length === originalWords.length;

  return {
    phrase: original,
    userAnswer: userAnswer,
    isCorrect,
    correctWords: correctCount,
    totalWords: originalWords.length,
  };
}

// Diviser le texte en phrases
function splitTextIntoPhrases(text: string): Phrase[] {
  const sentenceEndings = /([.!?])\s+/g;
  const parts = text.split(sentenceEndings);
  const phrases: Phrase[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    if (parts[i].trim()) {
      const phrase = parts[i] + (parts[i + 1] || "");
      phrases.push({
        text: phrase.trim(),
        index: phrases.length,
      });
    }
  }

  return phrases;
}

export default function AudioDictationMode() {
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

  const [phase, setPhase] = useState<Phase>("loading");
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [results, setResults] = useState<PhraseDictation[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [dicteePosition, setDicteePosition] = useState<number | null>(null);

  if (!currentList || !currentWords.length) {
    return null;
  }

  // Charger le texte depuis Supabase
  const loadText = useCallback(async () => {
    try {
      const sb = createClient();
      const { data: dictee } = await sb
        .from("dictees")
        .select("fill_blanks_text, position")
        .eq("id", currentList.id)
        .maybeSingle();

      if (dictee?.position) {
        setDicteePosition(dictee.position);
      }

      if (dictee?.fill_blanks_text) {
        const loadedPhrases = splitTextIntoPhrases(
          dictee.fill_blanks_text as string
        );
        setPhrases(loadedPhrases);
        setPhase("dictation");
        setStartTime(Date.now());
      } else {
        toast.error("Texte non trouvé pour cette dictée");
        clearCurrentTraining();
      }
    } catch (error) {
      console.error("Erreur lors du chargement du texte:", error);
      toast.error("Erreur lors du chargement");
      clearCurrentTraining();
    }
  }, [currentList, clearCurrentTraining]);

  useEffect(() => {
    if (phase === "loading") {
      loadText();
    }
  }, [phase, loadText]);

  // Jouer la phrase actuelle
  const playCurrentPhrase = useCallback(() => {
    if (currentPhraseIndex >= phrases.length) return;

    setIsPlaying(true);
    const phrase = phrases[currentPhraseIndex].text;

    playTextAudio(
      phrase,
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, [phrases, currentPhraseIndex]);

  // Aller à la phrase suivante
  const handleNextPhrase = useCallback(() => {
    if (currentPhraseIndex >= phrases.length) return;

    const currentPhrase = phrases[currentPhraseIndex];
    const comparison = compareAnswers(currentPhrase.text, currentAnswer);

    const newResults = [...results, comparison];
    setResults(newResults);

    if (currentPhraseIndex + 1 < phrases.length) {
      setCurrentPhraseIndex(currentPhraseIndex + 1);
      setCurrentAnswer("");
    } else {
      // Fin de la dictée
      setPhase("result");
    }
  }, [currentPhraseIndex, phrases, currentAnswer, results]);

  // Arrêter et retourner
  const handleQuit = useCallback(async () => {
    stopAudio();
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);

    // Sauvegarder si au moins une réponse a été donnée
    if (results.length > 0 || currentAnswer.trim()) {
      const allResults = currentAnswer.trim()
        ? [
            ...results,
            compareAnswers(
              phrases[currentPhraseIndex].text,
              currentAnswer
            ),
          ]
        : results;

      const correctCount = allResults.filter((r) => r.isCorrect).length;
      const totalPhrases = allResults.length;
      const percentage = totalPhrases > 0
        ? Math.round((correctCount / totalPhrases) * 100)
        : 0;

      await saveSession({
        listId: currentList.id,
        listTitle: currentList.title,
        studentName: currentStudentName || undefined,
        modeUsed: "audio_dictation",
        totalWords: totalPhrases,
        correctWords: correctCount,
        percentage,
        timeSpentSeconds: timeSpent,
        answers: allResults.map((r) => ({
          word: r.phrase,
          userAnswer: r.userAnswer,
          isCorrect: r.isCorrect,
        })),
      });
    }

    clearCurrentTraining();
  }, [
    startTime,
    results,
    currentAnswer,
    currentPhraseIndex,
    phrases,
    currentList,
    currentStudentName,
    saveSession,
    clearCurrentTraining,
  ]);

  // Phase de chargement
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-4">
            <div className="animate-spin">
              <Volume2 className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-gray-600 font-medium">Chargement de la dictée...</p>
        </div>
      </div>
    );
  }

  // Phase de dictation
  if (phase === "dictation" && currentPhraseIndex < phrases.length) {
    const phrase = phrases[currentPhraseIndex];
    const progress = ((currentPhraseIndex + 1) / phrases.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-800">
              {currentList.title}
            </h1>
            <p className="text-xs text-gray-400">
              Phrase {currentPhraseIndex + 1}/{phrases.length}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleQuit}
            className="text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-2xl mx-auto w-full">
          {/* Play button and audio instruction */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            key={currentPhraseIndex}
            className="text-center"
          >
            <p className="text-sm text-gray-500 mb-4">Écoutez la phrase</p>
            <Button
              size="lg"
              onClick={playCurrentPhrase}
              disabled={isPlaying}
              className="rounded-full w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg"
            >
              <Volume2 className="w-6 h-6" />
            </Button>
          </motion.div>

          {/* Textarea for typing */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
          >
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              Écrivez ce que vous avez entendu
            </label>
            <textarea
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Tapez ici..."
              className="w-full h-32 p-4 border-2 border-gray-200 rounded-2xl focus:border-purple-500 focus:outline-none resize-none"
            />
          </motion.div>

          {/* Next phrase button */}
          <Button
            onClick={handleNextPhrase}
            disabled={!currentAnswer.trim()}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-3"
          >
            Phrase suivante
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // Phase de résultats
  if (phase === "result") {
    const allResults = results;
    const correctCount = allResults.filter((r) => r.isCorrect).length;
    const totalCount = allResults.length;
    const percentage =
      totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    const scoreColor =
      percentage >= 80
        ? "text-emerald-600"
        : percentage >= 50
        ? "text-amber-600"
        : "text-red-500";

    const scoreBg =
      percentage >= 80
        ? "from-emerald-500 to-emerald-600"
        : percentage >= 50
        ? "from-amber-400 to-amber-500"
        : "from-red-400 to-red-500";

    useEffect(() => {
      if (percentage >= 80) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    }, [percentage]);

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-bold text-gray-800">
            {currentList.title}
          </h1>
          <span className="text-xs text-gray-400">Résultats</span>
        </div>

        <div className="flex-1 flex flex-col p-6 gap-6 max-w-2xl mx-auto w-full overflow-y-auto">
          {/* Score */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-6"
          >
            <div
              className={`w-20 h-20 rounded-full bg-gradient-to-br ${scoreBg} flex items-center justify-center shadow-lg`}
            >
              <span className="text-2xl font-black text-white">
                {percentage}%
              </span>
            </div>
            <div>
              <div className={`text-3xl font-black ${scoreColor}`}>
                {correctCount}/{totalCount}
              </div>
              <div className="text-xs text-gray-400">
                {percentage >= 80
                  ? "Excellent !"
                  : percentage >= 50
                  ? "Continue tes efforts !"
                  : "Courage, tu vas y arriver !"}
              </div>
            </div>
          </motion.div>

          {/* Results grid */}
          <AnimatePresence>
            {allResults.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2">📝</div>
                <div className="font-bold text-gray-600">
                  Aucune réponse enregistrée
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                  Résultats par phrase
                </div>
                {allResults.map((result, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl border p-3 space-y-2 ${
                      result.isCorrect
                        ? "bg-emerald-50 border-emerald-100"
                        : "bg-red-50 border-red-100"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {result.isCorrect ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-600">
                          Phrase {idx + 1}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">
                          <span className="font-bold text-emerald-700">
                            Attendu:{" "}
                          </span>
                          {result.phrase}
                        </div>
                        <div className="text-xs text-gray-700 mt-1">
                          <span
                            className={`font-bold ${
                              result.isCorrect
                                ? "text-emerald-700"
                                : "text-red-600"
                            }`}
                          >
                            Votre réponse:{" "}
                          </span>
                          {result.userAnswer || "(vide)"}
                        </div>
                        {!result.isCorrect && (
                          <div className="text-xs text-gray-600 mt-1">
                            {result.correctWords}/{result.totalWords} mot
                            {result.totalWords > 1 ? "s" : ""} correct
                            {result.correctWords > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => {
                clearCurrentTraining();
              }}
              variant="outline"
              className="flex-1 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
