"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Volume2,
  Eye,
  Check,
  RotateCcw,
  ArrowRight,
  Trophy,
  Sparkles,
  Timer,
  Zap,
  Rocket,
  Clock,
  MousePointerClick,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import confetti from "canvas-confetti";

type Phase = "setup" | "memorize" | "write" | "result";

export default function TrainingMode() {
  const {
    currentList,
    currentWords,
    clearCurrentTraining,
    sessionProgress,
    startSession,
    submitAnswer,
    nextWord,
    endSession,
    updateStreak,
    streak,
    addBadge,
    currentStudentName,
    setCurrentStudentName,
  } = useAppStore();
  const { saveSession } = useSupabaseSync();

  // Store answers for history
  const [sessionAnswers, setSessionAnswers] = useState<{
    word: string;
    userAnswer: string;
    isCorrect: boolean;
  }[]>([]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [answer, setAnswer] = useState("");
  const [showWord, setShowWord] = useState(true);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    correctCount: number;
    totalWords: number;
    timeSpent: number;
  } | null>(null);

  // Performance chronometer (total session time)
  const [chronoEnabled, setChronoEnabled] = useState(false);
  const [chronoTime, setChronoTime] = useState(0); // seconds elapsed
  const [chronoRunning, setChronoRunning] = useState(false);

  // Auto-hide word settings
  const [autoHideEnabled, setAutoHideEnabled] = useState(false);
  const [autoHideDuration, setAutoHideDuration] = useState(3); // seconds to show word
  const [autoHideCountdown, setAutoHideCountdown] = useState(3);

  const inputRef = useRef<HTMLInputElement>(null);
  const mode = currentList?.mode || "progression";

  // Determine current mode based on list setting
  const getCurrentMode = useCallback((): "flashcard" | "audio" => {
    if (mode === "flashcard") return "flashcard";
    if (mode === "audio") return "audio";
    return "flashcard";
  }, [mode]);

  const currentMode = getCurrentMode();
  const currentWordIndex = sessionProgress?.currentWordIndex ?? 0;
  const currentWord = currentWords[currentWordIndex];

  // Start session when leaving setup phase
  const handleStartTraining = () => {
    setSessionAnswers([]); // Reset answers for new session
    if (!sessionProgress) {
      startSession(currentMode);
    }
    setPhase("memorize");
  };

  // Text-to-speech for audio mode
  const speakWord = useCallback(() => {
    if (!currentWord) return;
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = "fr-FR";
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
  }, [currentWord]);

  // Auto-speak in audio mode
  useEffect(() => {
    if (currentMode === "audio" && phase === "write" && currentWord) {
      speakWord();
    }
  }, [currentMode, phase, currentWord, speakWord]);

  // Focus input when in write phase - IMPROVED
  useEffect(() => {
    if (phase === "write") {
      // Multiple attempts to ensure focus works on mobile
      const focusInput = () => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.click();
        }
      };
      focusInput();
      setTimeout(focusInput, 100);
      setTimeout(focusInput, 300);
    }
  }, [phase]);

  // Performance chronometer - counts up during session
  useEffect(() => {
    if (!chronoEnabled || !chronoRunning) return;

    const interval = setInterval(() => {
      setChronoTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [chronoEnabled, chronoRunning]);

  // Start chrono when entering write phase, pause on result
  useEffect(() => {
    if (chronoEnabled) {
      if (phase === "write") {
        setChronoRunning(true);
      } else if (phase === "result") {
        setChronoRunning(false);
      }
    }
  }, [phase, chronoEnabled]);

  // Auto-hide word countdown
  useEffect(() => {
    if (!autoHideEnabled || phase !== "memorize" || currentMode !== "flashcard") return;

    setAutoHideCountdown(autoHideDuration);

    const interval = setInterval(() => {
      setAutoHideCountdown((prev) => {
        if (prev <= 1) {
          // Auto-transition to write phase
          handleShowAnswer();
          return autoHideDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoHideEnabled, phase, currentWordIndex, autoHideDuration, currentMode]);

  // Global keyboard handler for Enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (phase === "result") {
          e.preventDefault();
          handleNextWord();
        } else if (phase === "memorize" && currentMode === "flashcard") {
          e.preventDefault();
          handleShowAnswer();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, currentMode]);

  const handleShowAnswer = () => {
    setShowWord(false);
    setTimeout(() => {
      setPhase("write");
    }, 300);
  };

  const normalizeWord = (word: string): string => {
    return word
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  const handleSubmitAnswer = () => {
    if (!currentWord) return;

    const userAnswer = answer.trim();
    const normalizedAnswer = normalizeWord(userAnswer);
    const normalizedCorrect = normalizeWord(currentWord.word);
    const correct = normalizedAnswer === normalizedCorrect;

    setIsCorrect(correct);
    submitAnswer(currentWord.id, userAnswer, correct);

    // Track answer for history
    setSessionAnswers(prev => [...prev, {
      word: currentWord.word,
      userAnswer: userAnswer,
      isCorrect: correct,
    }]);

    setPhase("result");

    if (correct) {
      toast.success("Bravo !", { duration: 1000 });
    } else {
      toast.error(`La bonne réponse était : ${currentWord.word}`, {
        duration: 2000,
      });
    }
  };

  const handleNextWord = () => {
    if (currentWordIndex < currentWords.length - 1) {
      nextWord();
      setPhase("memorize");
      setShowWord(true);
      setAnswer("");
      setIsCorrect(null);
    } else {
      // Session complete
      const result = endSession();
      if (result && currentList) {
        setFinalResult(result);
        setSessionComplete(true);

        // Save to Supabase + local history
        const allAnswers = sessionAnswers.concat([{
          word: currentWord.word,
          userAnswer: answer.trim(),
          isCorrect: isCorrect ?? false,
        }]);

        saveSession({
          listId: currentList.id,
          listTitle: currentList.title,
          studentName: currentStudentName.trim() || undefined,
          modeUsed: currentMode,
          totalWords: result.totalWords,
          correctWords: result.correctCount,
          percentage: Math.round((result.correctCount / result.totalWords) * 100),
          timeSpentSeconds: result.timeSpent,
          chronoTimeSeconds: chronoEnabled ? chronoTime : undefined,
          answers: allAnswers,
        });

        // Update streak
        updateStreak(streak + 1);

        // Check for badges
        if (result.correctCount === result.totalWords) {
          addBadge("⭐");
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }

        if (streak === 2) {
          addBadge("🔥");
        }
      }
    }
  };

  const handleQuit = () => {
    clearCurrentTraining();
  };

  const handleRetry = () => {
    setSessionComplete(false);
    setFinalResult(null);
    setPhase("memorize");
    setShowWord(true);
    setAnswer("");
    setIsCorrect(null);
    setSessionAnswers([]); // Reset answers for new session
    // Reset chrono for new attempt
    if (chronoEnabled) {
      setChronoTime(0);
      setChronoRunning(false);
    }
    startSession(currentMode);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentList || !currentWord) {
    return null;
  }

  // Session complete screen
  if (sessionComplete && finalResult) {
    const percentage = Math.round(
      (finalResult.correctCount / finalResult.totalWords) * 100
    );
    const isPerfect = percentage === 100;
    const isGood = percentage >= 80;
    const avgTimePerWord = chronoEnabled && chronoTime > 0
      ? (chronoTime / finalResult.totalWords).toFixed(1)
      : null;

    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center w-full max-w-md"
        >
          {/* Trophy/Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
            className="relative mx-auto mb-6"
          >
            <div className={`w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 ${
              isPerfect
                ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-amber-200"
                : isGood
                ? "bg-gradient-to-br from-purple-400 to-indigo-500 shadow-purple-200"
                : "bg-gradient-to-br from-blue-400 to-cyan-500 shadow-blue-200"
            }`}>
              {isPerfect ? (
                <Trophy className="w-14 h-14 text-white" />
              ) : (
                <Sparkles className="w-14 h-14 text-white" />
              )}
            </div>
            {isPerfect && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5 }}
                className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center text-white text-xl shadow-lg"
              >
                🌟
              </motion.div>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold mb-2"
          >
            {isPerfect ? "Parfait ! 🎉" : isGood ? "Bien joué ! 👏" : "Continue comme ça ! 💪"}
          </motion.h1>

          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative my-6"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-3xl transform rotate-2 opacity-20" />
            <div className="relative bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6">
              <div className={`text-7xl font-bold bg-clip-text text-transparent mb-2 ${
                isPerfect
                  ? "bg-gradient-to-r from-yellow-500 to-amber-500"
                  : "bg-gradient-to-r from-purple-600 to-indigo-600"
              }`}>
                {percentage}%
              </div>
              <p className="text-gray-500 font-medium">
                {finalResult.correctCount} / {finalResult.totalWords} mots corrects
              </p>

              {/* Speed score when chrono was enabled */}
              {chronoEnabled && chronoTime > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-4 pt-4 border-t border-gray-100"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-full font-bold shadow-lg shadow-orange-200">
                    <Zap className="w-5 h-5" />
                    {formatTime(chronoTime)}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    ~{avgTimePerWord}s par mot • Bats ton record !
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex gap-3"
          >
            <Button
              variant="outline"
              onClick={handleRetry}
              className="flex-1 h-14 text-lg font-bold rounded-2xl gap-2 border-2 hover:bg-purple-50"
            >
              <RotateCcw className="w-5 h-5" />
              Rejouer
            </Button>
            <Button
              onClick={handleQuit}
              className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-xl shadow-purple-200 rounded-2xl"
            >
              Terminer
            </Button>
          </motion.div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header avec effet de profondeur - caché pendant le setup */}
      {phase !== "setup" && (
      <header className="sticky top-0 z-10 bg-gradient-to-b from-white to-white/95 backdrop-blur-xl border-b shadow-lg shadow-purple-100/50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-bold text-lg bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent truncate">
              {currentList.title}
            </h1>
            <div className="flex items-center gap-2">
              {/* Chrono display when active */}
              {chronoEnabled && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-full font-mono text-sm font-bold shadow-lg shadow-orange-200"
                >
                  <Zap className="w-4 h-4" />
                  {formatTime(chronoTime)}
                </motion.div>
              )}
              {/* Auto-hide indicator */}
              {autoHideEnabled && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-600 rounded-full text-xs font-medium">
                  <Eye className="w-3 h-3" />
                  {autoHideDuration}s
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleQuit}
                className="hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          {/* Progress bar améliorée */}
          <div className="relative">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentWordIndex + 1) / currentWords.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 100 }}
                />
              </div>
              <span className="text-sm font-bold text-purple-600 min-w-[3.5rem] text-right">
                {currentWordIndex + 1}/{currentWords.length}
              </span>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* Setup phase - Configuration avant de commencer */}
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-md"
            >
              {/* Welcome card */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-purple-200 rotate-3"
                >
                  <Rocket className="w-10 h-10 text-white" />
                </motion.div>
                <h1 className="text-2xl font-bold mb-2">Prêt à t'entraîner ?</h1>
                <p className="text-gray-500">
                  {currentWords.length} mots à mémoriser
                </p>
              </div>

              {/* Prénom de l'élève */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-4"
              >
                <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">Ton prénom</div>
                      <div className="text-xs text-gray-500">Pour suivre ta progression</div>
                    </div>
                  </div>
                  <Input
                    value={currentStudentName}
                    onChange={(e) => setCurrentStudentName(e.target.value)}
                    placeholder="Entre ton prénom..."
                    className="h-12 text-lg font-medium border-2 border-gray-100 rounded-xl focus:border-indigo-300"
                    maxLength={30}
                  />
                </div>
              </motion.div>

              {/* Mode défi */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="mb-4"
              >
                <button
                  onClick={() => setChronoEnabled(!chronoEnabled)}
                  className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${
                    chronoEnabled
                      ? "border-orange-400 bg-gradient-to-r from-orange-50 to-amber-50 shadow-lg shadow-orange-100"
                      : "border-gray-200 bg-white hover:border-orange-200 hover:shadow-md"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    chronoEnabled
                      ? "bg-gradient-to-br from-orange-400 to-amber-500 shadow-lg shadow-orange-200"
                      : "bg-gray-100"
                  }`}>
                    <Timer className={`w-6 h-6 ${chronoEnabled ? "text-white" : "text-gray-400"}`} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-800">Mode Défi</div>
                    <div className="text-sm text-gray-500">Chronomètre pour battre ton record !</div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    chronoEnabled
                      ? "border-orange-400 bg-orange-400"
                      : "border-gray-300"
                  }`}>
                    {chronoEnabled && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              </motion.div>

              {/* Durée d'affichage */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="mb-6"
              >
                <div className="p-4 rounded-2xl border-2 border-gray-200 bg-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-800">Temps de mémorisation</div>
                      <div className="text-xs text-gray-500">Combien de temps voir le mot ?</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { value: 3, label: "3s", desc: "Rapide" },
                      { value: 5, label: "5s", desc: "Normal" },
                      { value: 10, label: "10s", desc: "Tranquille" },
                      { value: 0, label: "Manuel", desc: "Je clique" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (option.value === 0) {
                            setAutoHideEnabled(false);
                          } else {
                            setAutoHideEnabled(true);
                            setAutoHideDuration(option.value);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                          (option.value === 0 && !autoHideEnabled) ||
                          (option.value !== 0 && autoHideEnabled && autoHideDuration === option.value)
                            ? "border-purple-400 bg-purple-50 shadow-md"
                            : "border-gray-100 bg-gray-50 hover:border-purple-200"
                        }`}
                      >
                        <div className={`font-bold text-lg ${
                          (option.value === 0 && !autoHideEnabled) ||
                          (option.value !== 0 && autoHideEnabled && autoHideDuration === option.value)
                            ? "text-purple-600"
                            : "text-gray-600"
                        }`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-400">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Start button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
              >
                <Button
                  size="lg"
                  onClick={handleStartTraining}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-xl shadow-purple-200 rounded-2xl gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  C'est parti !
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* Memorize phase (flashcard) or Audio start */}
          {phase === "memorize" && currentMode === "flashcard" && (
            <motion.div
              key="memorize"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-purple-500" />
                <p className="text-gray-600 font-medium">
                  Mémorise ce mot
                </p>
                {autoHideEnabled && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-sm font-bold">
                    {autoHideCountdown}s
                  </span>
                )}
              </div>

              {/* Card avec effet 3D */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleShowAnswer}
                className="cursor-pointer mb-8"
              >
                <div className="relative">
                  {/* Shadow card */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-3xl transform rotate-2 opacity-20" />
                  {/* Main card */}
                  <div className="relative bg-white rounded-3xl border-2 border-purple-100 shadow-2xl shadow-purple-100 overflow-hidden">
                    {/* Progress bar for auto-hide */}
                    {autoHideEnabled && (
                      <motion.div
                        className="absolute top-0 left-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500"
                        initial={{ width: "100%" }}
                        animate={{ width: "0%" }}
                        transition={{ duration: autoHideDuration, ease: "linear" }}
                        key={currentWordIndex}
                      />
                    )}
                    <div className="py-16 px-8">
                      <motion.p
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
                      >
                        {currentWord.word}
                      </motion.p>
                    </div>
                    {/* Hint to click */}
                    <div className="py-3 bg-gray-50 border-t flex items-center justify-center gap-2 text-gray-400 text-sm">
                      <MousePointerClick className="w-4 h-4" />
                      Clique quand tu es prêt(e)
                    </div>
                  </div>
                </div>
              </motion.div>

              <Button
                size="lg"
                onClick={handleShowAnswer}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-xl shadow-purple-200 rounded-2xl gap-2"
              >
                <Check className="w-5 h-5" />
                J'ai mémorisé !
              </Button>
              <p className="text-xs text-gray-400 mt-2">ou appuie sur Entrée ↵</p>
            </motion.div>
          )}

          {/* Audio mode - go directly to write */}
          {phase === "memorize" && currentMode === "audio" && (
            <motion.div
              key="audio-start"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center"
              onAnimationComplete={() => setPhase("write")}
            >
              <p className="text-sm text-muted-foreground mb-4">
                Écoute le mot...
              </p>
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto animate-pulse">
                <Volume2 className="w-8 h-8 text-purple-600" />
              </div>
            </motion.div>
          )}

          {/* Write phase */}
          {phase === "write" && (
            <motion.div
              key="write"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-md text-center"
            >
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-lg">✍️</span>
                </div>
                <p className="text-gray-600 font-medium">
                  {currentMode === "audio"
                    ? "Écoute et écris le mot"
                    : "Écris le mot de mémoire"}
                </p>
              </div>

              {currentMode === "audio" && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={speakWord}
                  className="mb-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 flex items-center gap-2 mx-auto"
                >
                  <Volume2 className="w-5 h-5" />
                  Réécouter
                </motion.button>
              )}

              {/* Input card */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-3xl transform -rotate-1 opacity-10" />
                <div className="relative bg-white rounded-3xl border-2 border-indigo-100 shadow-xl shadow-indigo-100 p-6">
                  <Input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && answer.trim()) {
                        e.preventDefault();
                        handleSubmitAnswer();
                      }
                    }}
                    placeholder="Tape le mot ici..."
                    className="text-center text-3xl h-16 font-bold border-2 border-gray-100 rounded-2xl focus:border-indigo-300 focus:ring-indigo-200 transition-all"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleSubmitAnswer}
                disabled={!answer.trim()}
                className={`w-full h-14 text-lg font-bold rounded-2xl gap-2 transition-all ${
                  answer.trim()
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-xl shadow-green-200"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                <Check className="w-5 h-5" />
                Valider
              </Button>
              <p className="text-xs text-gray-400 mt-2">ou appuie sur Entrée ↵</p>
            </motion.div>
          )}

          {/* Result phase */}
          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", duration: 0.5 }}
                className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl ${
                  isCorrect
                    ? "bg-gradient-to-br from-green-400 to-emerald-500 shadow-green-200"
                    : "bg-gradient-to-br from-orange-400 to-red-500 shadow-red-200"
                }`}
              >
                {isCorrect ? (
                  <Check className="w-12 h-12 text-white" />
                ) : (
                  <X className="w-12 h-12 text-white" />
                )}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={`text-3xl font-bold mb-6 ${
                  isCorrect ? "text-green-600" : "text-orange-600"
                }`}
              >
                {isCorrect ? "Bravo ! 🎉" : "Presque..."}
              </motion.h2>

              {/* Result card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative mb-6"
              >
                <div className={`absolute inset-0 rounded-3xl transform rotate-1 opacity-20 ${
                  isCorrect ? "bg-green-400" : "bg-orange-400"
                }`} />
                <div className="relative bg-white rounded-3xl border-2 border-gray-100 shadow-xl p-6">
                  <p className="text-sm text-gray-400 mb-2">La bonne réponse :</p>
                  <p className="text-4xl font-bold text-green-600 mb-2">
                    {currentWord.word}
                  </p>
                  {!isCorrect && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <p className="text-sm text-gray-400 mb-1">Ta réponse :</p>
                      <p className="text-2xl text-red-400 line-through">
                        {answer || "(vide)"}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  size="lg"
                  onClick={handleNextWord}
                  className={`w-full h-14 text-lg font-bold rounded-2xl gap-2 ${
                    currentWordIndex < currentWords.length - 1
                      ? "bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 shadow-xl shadow-purple-200"
                      : "bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-xl shadow-orange-200"
                  }`}
                >
                  {currentWordIndex < currentWords.length - 1 ? (
                    <>
                      Mot suivant
                      <ArrowRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Voir mes résultats
                      <Trophy className="w-5 h-5" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-400 mt-2">ou appuie sur Entrée ↵</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
