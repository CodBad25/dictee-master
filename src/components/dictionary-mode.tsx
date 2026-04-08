"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Clock,
  Check,
  X,
  RotateCcw,
  Trophy,
  Sparkles,
  ArrowRight,
  Timer,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface DictionaryEntry {
  word: string;
  pageNumber: string;
  genre: string | null;
  classeGrammaticale: string | null;
}

type Phase = "setup" | "exercise" | "results";

export default function DictionaryMode() {
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

  // Phase management
  const [phase, setPhase] = useState<Phase>("setup");
  const [dictionaryName, setDictionaryName] = useState("");
  const [dictionaryYear, setDictionaryYear] = useState("");
  const [useChrono, setUseChrono] = useState(false);

  // Exercise state
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [chronoSeconds, setChronoSeconds] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Current word form state
  const [currentPageNumber, setCurrentPageNumber] = useState("");
  const [currentGenre, setCurrentGenre] = useState<string | null>(null);
  const [currentClasse, setCurrentClasse] = useState<string | null>(null);

  // Results state
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<
    { word: string; userAnswer: string; isCorrect: boolean }[]
  >([]);

  // Sélection de mots par round (3 mots aléatoires parmi tous les mots)
  const WORDS_PER_ROUND = 3;
  const [roundWords, setRoundWords] = useState<typeof currentWords>([]);
  const [seenWordIds, setSeenWordIds] = useState<Set<string>>(new Set());

  const pickNewRound = (seen: Set<string>) => {
    const available = currentWords.filter(w => !seen.has(w.id));
    const pool = available.length >= WORDS_PER_ROUND ? available : [...currentWords];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, Math.min(WORDS_PER_ROUND, pool.length));
    setRoundWords(picked);
    const newSeen = new Set(seen);
    picked.forEach(w => newSeen.add(w.id));
    if (newSeen.size >= currentWords.length) {
      setSeenWordIds(new Set(picked.map(w => w.id)));
    } else {
      setSeenWordIds(newSeen);
    }
  };

  useEffect(() => {
    if (currentWords.length > 0 && roundWords.length === 0) {
      pickNewRound(new Set());
    }
  }, [currentWords.length]);

  if (!currentList || !currentWords.length || !roundWords.length) return null;

  // Chrono effect
  useEffect(() => {
    if (phase !== "exercise" || !useChrono) return;

    if (startTime === null && phase === "exercise") {
      setStartTime(Date.now());
    }

    const interval = setInterval(() => {
      setChronoSeconds((s) => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, useChrono, startTime]);

  const extractGenre = (word: string): string => {
    const lowerWord = word.toLowerCase();
    if (
      lowerWord.startsWith("le ") ||
      lowerWord.startsWith("un ") ||
      lowerWord.startsWith("du ")
    ) {
      return "Masculin";
    }
    if (
      lowerWord.startsWith("la ") ||
      lowerWord.startsWith("une ") ||
      lowerWord.startsWith("des ")
    ) {
      return "Féminin";
    }
    if (lowerWord.startsWith("l'") || lowerWord.startsWith("les ")) {
      return "Ambigu";
    }
    return "Inconnu";
  };

  const extractClasse = (word: string, hint?: string): string => {
    const lowerWord = word.toLowerCase();
    const lowerHint = hint?.toLowerCase() || "";

    // Nom: starts with article
    if (
      /^(le |la |l'|un |une |les |des |du )/.test(lowerWord)
    ) {
      return "nom";
    }

    // Verbe: ends with -er, -ir, -re, or verb patterns
    if (/er$|ir$|re$/.test(lowerWord)) {
      return "verbe";
    }

    // Adverbe: -ment, -amment, -emment
    if (/ment$|amment$|emment$/.test(lowerWord)) {
      return "adverbe";
    }

    // Adjectif: check hint for common adjective patterns
    if (
      lowerHint.includes("adjectif") ||
      lowerHint.includes("qui qualifie") ||
      /^(petit|grand|bon|mauvais|beau|joli|gentil|méchant|heureux)/.test(
        lowerWord
      )
    ) {
      return "adjectif";
    }

    // Default guess based on hint
    if (lowerHint.includes("verbe")) return "verbe";
    if (lowerHint.includes("adjectif")) return "adjectif";
    if (lowerHint.includes("adverbe")) return "adverbe";

    return "nom";
  };

  const getCorrectGenre = (word: string): string => {
    return extractGenre(word);
  };

  const getCorrectClasse = (word: string, hint?: string): string => {
    return extractClasse(word, hint);
  };

  const handleStartExercise = () => {
    if (!dictionaryName.trim() || !dictionaryYear.trim()) {
      return;
    }
    setPhase("exercise");
    setStartTime(null);
    setChronoSeconds(0);
  };

  const handleNextWord = () => {
    if (!currentPageNumber.trim() || currentClasse === null) return;
    if (currentClasse === "nom" && currentGenre === null) return;

    const currentWord = roundWords[currentWordIndex];
    const correctGenre = getCorrectGenre(currentWord.word);
    const correctClasse = getCorrectClasse(currentWord.word, currentWord.hint);

    const skipGenre = currentClasse !== "nom";
    const genreCorrect = skipGenre || currentGenre === correctGenre;
    const classeCorrect = currentClasse === correctClasse;
    const isCorrect = genreCorrect && classeCorrect;

    if (isCorrect) {
      setScore((s) => s + 1);
    }

    setAnswers((prev) => [
      ...prev,
      {
        word: currentWord.word,
        userAnswer: `Page ${currentPageNumber} | Genre: ${currentGenre} | Classe: ${currentClasse}`,
        isCorrect,
      },
    ]);

    setEntries((prev) => [
      ...prev,
      {
        word: currentWord.word,
        pageNumber: currentPageNumber,
        genre: currentGenre,
        classeGrammaticale: currentClasse,
      },
    ]);

    if (currentWordIndex < roundWords.length - 1) {
      setCurrentWordIndex((i) => i + 1);
      setCurrentPageNumber("");
      setCurrentGenre(null);
      setCurrentClasse(null);
    } else {
      finishExercise();
    }
  };

  const finishExercise = async () => {
    const endTime = Date.now();
    const timeSpentSeconds = startTime ? Math.floor((endTime - startTime) / 1000) : 0;
    const percentage = Math.round((score / roundWords.length) * 100);

    setPhase("results");

    // Show confetti if perfect score
    if (score === roundWords.length) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      addBadge("perfect-dictionary");
    }

    // Update streak
    const newStreak = score === roundWords.length ? streak + 1 : 0;
    updateStreak(newStreak);

    // Save session
    await saveSession({
      listId: currentList.id,
      listTitle: currentList.title,
      studentName: currentStudentName,
      modeUsed: "dictionary",
      totalWords: roundWords.length,
      correctWords: score,
      percentage,
      timeSpentSeconds: useChrono ? chronoSeconds : timeSpentSeconds,
      chronoTimeSeconds: useChrono ? chronoSeconds : undefined,
      answers,
    });
  };

  const handleRetry = () => {
    const isPerfect = score === roundWords.length;
    if (isPerfect) {
      pickNewRound(seenWordIds);
    }
    setPhase("setup");
    setCurrentWordIndex(0);
    setEntries([]);
    setScore(0);
    setAnswers([]);
    setCurrentPageNumber("");
    setCurrentGenre(null);
    setCurrentClasse(null);
    setChronoSeconds(0);
    setStartTime(null);
  };

  const handleQuit = () => {
    clearCurrentTraining();
    handleRetry();
  };

  // ============================================
  // PHASE 1: SETUP
  // ============================================
  if (phase === "setup") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6"
      >
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                Mode Dictionnaire
              </h1>
            </div>
            <Button
              variant="ghost"
              onClick={handleQuit}
              className="text-gray-600"
            >
              Quitter
            </Button>
          </div>

          {/* Card */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-lg p-8 space-y-6"
          >
            <p className="text-gray-600 text-lg">
              Complétez les informations sur votre dictionnaire avant de
              commencer.
            </p>

            {/* Dictionary Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nom du dictionnaire
              </label>
              <input
                type="text"
                value={dictionaryName}
                onChange={(e) => setDictionaryName(e.target.value)}
                placeholder="ex. Le Robert Junior"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Dictionary Year */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Année d&apos;édition
              </label>
              <input
                type="text"
                value={dictionaryYear}
                onChange={(e) => setDictionaryYear(e.target.value)}
                placeholder="ex. 2024"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Chrono Toggle */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg">
              <input
                type="checkbox"
                id="chrono"
                checked={useChrono}
                onChange={(e) => setUseChrono(e.target.checked)}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <label htmlFor="chrono" className="flex items-center gap-2 cursor-pointer text-gray-700 font-medium">
                <Timer className="w-5 h-5 text-emerald-600" />
                Mode chronomètre
              </label>
            </div>

            {/* Start Button */}
            <Button
              onClick={handleStartExercise}
              disabled={!dictionaryName.trim() || !dictionaryYear.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Commencer
            </Button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ============================================
  // PHASE 2: EXERCISE
  // ============================================
  if (phase === "exercise") {
    const currentWord = roundWords[currentWordIndex];
    const currentEntry = entries[currentWordIndex];
    const correctGenre = getCorrectGenre(currentWord.word);
    const correctClasse = getCorrectClasse(currentWord.word, currentWord.hint);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6"
      >
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {dictionaryName} ({dictionaryYear})
            </h1>
            <div className="flex items-center gap-4">
              {useChrono && (
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  <span className="font-mono font-semibold text-gray-800">
                    {Math.floor(chronoSeconds / 60)}:
                    {String(chronoSeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              )}
              <Button variant="ghost" onClick={handleQuit} className="text-gray-600">
                Quitter
              </Button>
            </div>
          </div>

          {/* Progress */}
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Mot {currentWordIndex + 1}/{roundWords.length}</span>
              <span className="font-semibold">
                {score} correct{score !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${((currentWordIndex + 1) / roundWords.length) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
                className="h-full bg-emerald-600"
              />
            </div>
          </div>

          {/* Word Card */}
          <motion.div
            key={currentWordIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white rounded-2xl shadow-lg p-8 mb-6"
          >
            {/* Word Display */}
            <div className="text-center mb-8">
              <p className="text-sm text-gray-500 mb-2">Cherchez ce mot :</p>
              <p className="text-sm text-gray-400 font-medium mb-2">
                Mot {currentWordIndex + 1} / {roundWords.length}
              </p>
              <p className="text-4xl font-bold text-emerald-600">
                {currentWord.word.split(" ").slice(-1)[0]}
              </p>
              {currentWord.hint && (
                <p className="text-gray-600 italic mt-4 text-lg">
                  &quot;{currentWord.hint}&quot;
                </p>
              )}
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Page Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Page du dictionnaire
                </label>
                <input
                  type="text"
                  value={currentPageNumber}
                  onChange={(e) => setCurrentPageNumber(e.target.value)}
                  placeholder="ex. 45"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-emerald-500 focus:outline-none text-lg"
                />
              </div>

              {/* Classe Grammaticale (avant le genre pour savoir si on affiche le genre) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Classe grammaticale
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {["nom", "verbe", "adjectif", "adverbe"].map((option) => (
                    <button
                      key={option}
                      onClick={() => {
                        setCurrentClasse(option);
                        if (option === "verbe" || option === "adverbe" || option === "adjectif") {
                          setCurrentGenre("-");
                        } else if (currentGenre === "-") {
                          setCurrentGenre(null);
                        }
                      }}
                      className={`py-3 px-4 rounded-lg font-semibold transition-all capitalize ${
                        currentClasse === option
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genre — uniquement pour les noms */}
              {currentClasse === "nom" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Genre
                </label>
                <div className="flex gap-3">
                  {["Masculin", "Féminin"].map((option) => (
                    <button
                      key={option}
                      onClick={() => setCurrentGenre(option)}
                      className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                        currentGenre === option
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Classe grammaticale déjà affichée au-dessus */}

              {/* Next Button */}
              <Button
                onClick={handleNextWord}
                disabled={
                  !currentPageNumber.trim() ||
                  currentClasse === null ||
                  (currentClasse === "nom" && currentGenre === null)
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5 mr-2" />
                {currentWordIndex === roundWords.length - 1
                  ? "Terminer"
                  : "Suivant"}
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ============================================
  // PHASE 3: RESULTS
  // ============================================
  if (phase === "results") {
    const percentage = Math.round((score / roundWords.length) * 100);
    const isPerfect = score === roundWords.length;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6"
      >
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Résultats</h1>
            <Button variant="ghost" onClick={handleQuit} className="text-gray-600">
              Quitter
            </Button>
          </div>

          {/* Score Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`rounded-2xl shadow-lg p-8 mb-6 text-center ${
              isPerfect
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                : "bg-white text-gray-900"
            }`}
          >
            {isPerfect && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center mb-4"
              >
                <Trophy className="w-12 h-12" />
              </motion.div>
            )}
            <p className={`text-sm font-semibold mb-2 ${isPerfect ? "text-emerald-100" : "text-gray-600"}`}>
              Score final
            </p>
            <p className="text-5xl font-bold mb-2">
              {score}/{roundWords.length}
            </p>
            <p className={`text-2xl font-semibold ${isPerfect ? "" : "text-gray-700"}`}>
              {percentage}%
            </p>
            {useChrono && (
              <p className={`text-sm mt-3 flex items-center justify-center gap-2 ${isPerfect ? "text-emerald-100" : "text-gray-600"}`}>
                <Clock className="w-4 h-4" />
                Temps: {Math.floor(chronoSeconds / 60)}:
                {String(chronoSeconds % 60).padStart(2, "0")}
              </p>
            )}
          </motion.div>

          {/* Answers List */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-3 mb-6"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Détail des réponses
            </h2>
            <AnimatePresence>
              {entries.map((entry, idx) => {
                const answer = answers[idx];
                const isCorrect = answer.isCorrect;
                return (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.3 + idx * 0.05 }}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? "bg-emerald-50 border-emerald-300"
                        : "bg-red-50 border-red-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {isCorrect ? (
                          <Check className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <X className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">
                          {roundWords[idx].word}
                        </p>
                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                          <p>
                            <span className="font-medium">Page :</span>{" "}
                            {entry.pageNumber}
                          </p>
                          <p>
                            <span className="font-medium">Genre :</span>{" "}
                            {entry.genre}
                          </p>
                          <p>
                            <span className="font-medium">Classe :</span>{" "}
                            {entry.classeGrammaticale}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="flex-1 py-3 border-2 border-emerald-600 text-emerald-600 font-semibold rounded-lg hover:bg-emerald-50"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Recommencer
            </Button>
            <Button
              onClick={handleQuit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg"
            >
              Quitter
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}
