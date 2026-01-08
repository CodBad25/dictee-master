"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Volume2,
  Check,
  RotateCcw,
  Trophy,
  Sparkles,
  Play,
  Pause,
  User,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { generateTextWithBlanks, generateTextWithAI, GeneratedText } from "@/lib/text-generator";
import confetti from "canvas-confetti";

type Phase = "setup" | "dictation" | "result";

export default function FillBlanksMode() {
  const {
    currentList,
    currentWords,
    clearCurrentTraining,
    updateStreak,
    streak,
    addBadge,
    currentStudentName,
    setCurrentStudentName,
    apiConfig,
  } = useAppStore();
  const { saveSession } = useSupabaseSync();

  const [phase, setPhase] = useState<Phase>("setup");
  const [generatedText, setGeneratedText] = useState<GeneratedText | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Générer le texte au démarrage
  const generateText = useCallback(async () => {
    if (!currentWords.length) return;

    setIsGenerating(true);
    try {
      const words = currentWords.map(w => w.word);

      let text: GeneratedText;
      if (apiConfig?.apiKey) {
        text = await generateTextWithAI(words, apiConfig.apiKey, apiConfig.apiType);
      } else {
        text = generateTextWithBlanks(words);
      }

      setGeneratedText(text);
      setUserAnswers({});
    } catch (error) {
      console.error("Error generating text:", error);
      toast.error("Erreur lors de la génération du texte");
    } finally {
      setIsGenerating(false);
    }
  }, [currentWords, apiConfig]);

  // Synthèse vocale
  const speakText = useCallback(() => {
    if (!generatedText) return;

    // Arrêter la synthèse en cours
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(generatedText.fullText);
    utterance.lang = "fr-FR";
    utterance.rate = 0.85;
    utterance.pitch = 1;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    speechRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [generatedText]);

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const handleStartDictation = async () => {
    await generateText();
    setPhase("dictation");
    setStartTime(Date.now());
  };

  const handleInputChange = (index: number, value: string) => {
    setUserAnswers(prev => ({ ...prev, [index]: value }));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // Passer au champ suivant
      const nextIndex = index + 1;
      if (nextIndex < (generatedText?.blanks.length || 0)) {
        inputRefs.current[nextIndex]?.focus();
      }
    }
  };

  const handleSubmit = () => {
    if (!generatedText) return;

    setShowResults(true);

    // Calculer le score
    const results = generatedText.blanks.map((blank, index) => {
      const userAnswer = (userAnswers[index] || "").trim().toLowerCase();
      const correctAnswer = blank.word.toLowerCase();
      return {
        word: blank.word,
        userAnswer: userAnswers[index] || "",
        isCorrect: userAnswer === correctAnswer,
      };
    });

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalWords = results.length;
    const percentage = Math.round((correctCount / totalWords) * 100);
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Sauvegarder la session
    if (currentList) {
      saveSession({
        listId: currentList.id,
        listTitle: currentList.title,
        studentName: currentStudentName.trim() || undefined,
        modeUsed: "audio", // On utilise "audio" car fill-blanks n'est pas dans le schéma DB
        totalWords,
        correctWords: correctCount,
        percentage,
        timeSpentSeconds: timeSpent,
        answers: results,
      });
    }

    // Gamification
    updateStreak(streak + 1);
    if (percentage === 100) {
      addBadge("⭐");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    setTimeout(() => {
      setPhase("result");
    }, 2000);
  };

  const handleRetry = async () => {
    setShowResults(false);
    setUserAnswers({});
    await generateText();
    setStartTime(Date.now());
    setPhase("dictation");
  };

  const handleQuit = () => {
    stopSpeaking();
    clearCurrentTraining();
  };

  // Cleanup
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  if (!currentList || !currentWords.length) {
    return null;
  }

  // Calculer les résultats
  const getResults = () => {
    if (!generatedText) return { correctCount: 0, totalWords: 0, percentage: 0, results: [] };

    const results = generatedText.blanks.map((blank, index) => {
      const userAnswer = (userAnswers[index] || "").trim().toLowerCase();
      const correctAnswer = blank.word.toLowerCase();
      return {
        word: blank.word,
        userAnswer: userAnswers[index] || "",
        isCorrect: userAnswer === correctAnswer,
      };
    });

    const correctCount = results.filter(r => r.isCorrect).length;
    const totalWords = results.length;
    const percentage = Math.round((correctCount / totalWords) * 100);

    return { correctCount, totalWords, percentage, results };
  };

  // Écran de résultat final
  if (phase === "result") {
    const { correctCount, totalWords, percentage, results } = getResults();
    const isPerfect = percentage === 100;
    const isGood = percentage >= 80;

    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center w-full max-w-md"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className={`w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-6 ${
              isPerfect
                ? "bg-gradient-to-br from-yellow-400 to-amber-500 shadow-amber-200"
                : isGood
                ? "bg-gradient-to-br from-purple-400 to-indigo-500 shadow-purple-200"
                : "bg-gradient-to-br from-blue-400 to-cyan-500 shadow-blue-200"
            }`}
          >
            {isPerfect ? (
              <Trophy className="w-14 h-14 text-white" />
            ) : (
              <Sparkles className="w-14 h-14 text-white" />
            )}
          </motion.div>

          <h1 className="text-3xl font-bold mb-2">
            {isPerfect ? "Parfait ! " : isGood ? "Bien joue !" : "Continue !"}
          </h1>

          <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6 my-6">
            <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
              {percentage}%
            </div>
            <p className="text-gray-500">
              {correctCount} / {totalWords} mots corrects
            </p>

            {/* Détail des réponses */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 max-h-40 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                    r.isCorrect ? "bg-green-50" : "bg-red-50"
                  }`}
                >
                  <span className={r.isCorrect ? "text-green-700" : "text-red-700"}>
                    {r.word}
                  </span>
                  {!r.isCorrect && (
                    <span className="text-red-400 line-through">{r.userAnswer || "(vide)"}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRetry}
              className="flex-1 h-14 text-lg font-bold rounded-2xl gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Rejouer
            </Button>
            <Button
              onClick={handleQuit}
              className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl"
            >
              Terminer
            </Button>
          </div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
      {/* Header */}
      {phase !== "setup" && (
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b shadow-lg shadow-purple-100/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <h1 className="font-bold text-lg bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              {currentList.title}
            </h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleQuit}
                className="hover:bg-red-50 hover:text-red-500"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* Setup phase */}
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-orange-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-xl shadow-orange-200">
                  <Volume2 className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Dictee a trous</h1>
                <p className="text-gray-500">
                  Ecoute la dictee et complete les trous
                </p>
              </div>

              {/* Prénom */}
              <div className="mb-4 p-4 rounded-2xl border-2 border-gray-200 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">Ton prenom</div>
                    <div className="text-xs text-gray-500">Pour suivre ta progression</div>
                  </div>
                </div>
                <Input
                  value={currentStudentName}
                  onChange={(e) => setCurrentStudentName(e.target.value)}
                  placeholder="Entre ton prenom..."
                  className="h-12 text-lg font-medium border-2 border-gray-100 rounded-xl"
                />
              </div>

              <Button
                size="lg"
                onClick={handleStartDictation}
                disabled={isGenerating}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-500 hover:from-orange-500 hover:to-amber-600 shadow-xl shadow-orange-200 rounded-2xl gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Generation...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Commencer
                  </>
                )}
              </Button>
            </motion.div>
          )}

          {/* Dictation phase */}
          {phase === "dictation" && generatedText && (
            <motion.div
              key="dictation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-2xl"
            >
              {/* Contrôles audio */}
              <div className="flex justify-center mb-6">
                <Button
                  onClick={isPlaying ? stopSpeaking : speakText}
                  className={`h-14 px-8 text-lg font-bold rounded-2xl gap-3 ${
                    isPlaying
                      ? "bg-gradient-to-r from-red-400 to-rose-500 shadow-red-200"
                      : "bg-gradient-to-r from-blue-400 to-cyan-500 shadow-blue-200"
                  } shadow-xl`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-6 h-6" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-6 h-6" />
                      Ecouter la dictee
                    </>
                  )}
                </Button>
              </div>

              {/* Texte à trous */}
              <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6 mb-6">
                <p className="text-lg leading-relaxed text-gray-700">
                  {renderTextWithBlanks()}
                </p>
              </div>

              {/* Bouton valider */}
              <Button
                onClick={handleSubmit}
                disabled={showResults}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-xl shadow-green-200 rounded-2xl gap-2"
              >
                <Check className="w-5 h-5" />
                Valider mes reponses
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );

  // Fonction pour rendre le texte avec les champs à remplir
  function renderTextWithBlanks() {
    if (!generatedText) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Trier les blanks par position
    const sortedBlanks = [...generatedText.blanks].sort((a, b) => a.position - b.position);

    sortedBlanks.forEach((blank, index) => {
      // Texte avant le trou
      if (blank.position > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {generatedText.fullText.substring(lastIndex, blank.position)}
          </span>
        );
      }

      // Champ de saisie pour le trou
      const isCorrect = showResults && (userAnswers[index] || "").trim().toLowerCase() === blank.word.toLowerCase();
      const isWrong = showResults && !isCorrect;

      parts.push(
        <span key={`blank-${index}`} className="inline-block mx-1 align-middle">
          <input
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            value={userAnswers[index] || ""}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={showResults}
            className={`w-24 h-8 px-2 text-center font-bold rounded-lg border-2 outline-none transition-all ${
              showResults
                ? isCorrect
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
                : "border-purple-300 bg-purple-50 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            }`}
            placeholder="..."
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          {isWrong && (
            <span className="ml-1 text-green-600 font-bold">
              ({blank.word})
            </span>
          )}
        </span>
      );

      lastIndex = blank.position + blank.word.length;
    });

    // Texte après le dernier trou
    if (lastIndex < generatedText.fullText.length) {
      parts.push(
        <span key="text-end">
          {generatedText.fullText.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  }
}
