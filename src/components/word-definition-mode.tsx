"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  X,
  Check,
  RotateCcw,
  Trophy,
  Sparkles,
  User,
  RefreshCw,
  GripVertical,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { createClient } from "@/lib/supabase/client";
import { shuffleArray } from "@/lib/definition-generator";

type WordDefinition = { word: string; definition: string };
import confetti from "canvas-confetti";

type Phase = "setup" | "exercise" | "result";

interface MatchedPair {
  word: string;
  selectedDefinition: string;
  correctDefinition: string;
  isCorrect: boolean;
}

export default function WordDefinitionMode() {
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
  const [definitions, setDefinitions] = useState<WordDefinition[]>([]);
  const [shuffledDefinitions, setShuffledDefinitions] = useState<string[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [results, setResults] = useState<MatchedPair[]>([]);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState<number>(5);

  // Options de nombre de mots disponibles
  const wordCountOptions = [3, 5, 7, 10].filter(n => n <= currentWords.length);

  // Charger les définitions depuis Supabase (pas d'API IA)
  const loadDefinitions = useCallback(async () => {
    if (!currentWords.length || !currentList) return;

    setIsLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb.from("dictee_words")
        .select("word, definition")
        .eq("dictee_id", currentList.id)
        .order("position")
        .limit(wordCount);

      if (data && data.length > 0) {
        const defs = data.filter(d => d.definition && d.definition.length > 5).map(d => ({
          word: d.word,
          definition: d.definition,
        }));
        setDefinitions(defs);
        setShuffledDefinitions(shuffleArray(defs.map(d => d.definition)));
        setMatches({});
      } else {
        toast.error("Aucune définition trouvée");
      }
    } catch (error) {
      console.error("Error loading definitions:", error);
      toast.error("Erreur lors du chargement des définitions");
    } finally {
      setIsLoading(false);
    }
  }, [currentWords, currentList, wordCount]);

  const handleStartExercise = async () => {
    await loadDefinitions();
    setPhase("exercise");
    setStartTime(Date.now());
  };

  const handleSelectWord = (word: string) => {
    setSelectedWord(word);
  };

  const handleSelectDefinition = (definition: string) => {
    if (!selectedWord) {
      toast.info("Sélectionnez d'abord un mot à gauche");
      return;
    }

    // Vérifier si cette définition est déjà associée
    const existingWord = Object.entries(matches).find(([_, def]) => def === definition)?.[0];
    if (existingWord && existingWord !== selectedWord) {
      // Retirer l'ancienne association
      const newMatches = { ...matches };
      delete newMatches[existingWord];
      newMatches[selectedWord] = definition;
      setMatches(newMatches);
    } else {
      setMatches(prev => ({ ...prev, [selectedWord]: definition }));
    }

    setSelectedWord(null);
  };

  const handleRemoveMatch = (word: string) => {
    setMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[word];
      return newMatches;
    });
  };

  const handleValidate = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    const matchResults: MatchedPair[] = definitions.map(def => ({
      word: def.word,
      selectedDefinition: matches[def.word] || "",
      correctDefinition: def.definition,
      isCorrect: matches[def.word] === def.definition,
    }));

    setResults(matchResults);

    const correctCount = matchResults.filter(r => r.isCorrect).length;
    const percentage = Math.round((correctCount / definitions.length) * 100);

    // Sauvegarder la session
    saveSession({
      listId: currentList?.id || "",
      listTitle: currentList?.title || "",
      studentName: currentStudentName,
      modeUsed: "flashcard", // On utilise flashcard comme type générique
      totalWords: definitions.length,
      correctWords: correctCount,
      percentage,
      timeSpentSeconds: timeSpent,
      answers: matchResults.map(r => ({
        word: r.word,
        userAnswer: r.selectedDefinition,
        isCorrect: r.isCorrect,
      })),
    });

    // Mettre à jour le streak
    if (percentage === 100) {
      updateStreak(streak + 1);
      if (streak + 1 >= 3) {
        addBadge("streak_3");
      }
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else if (percentage >= 80) {
      updateStreak(streak + 1);
    } else {
      updateStreak(0);
    }

    setPhase("result");
  };

  const handleRetry = () => {
    setMatches({});
    setSelectedWord(null);
    setShuffledDefinitions(shuffleArray(definitions.map(d => d.definition)));
    setPhase("exercise");
    setStartTime(Date.now());
  };

  const handleExit = () => {
    clearCurrentTraining();
  };

  const allMatched = definitions.length > 0 && Object.keys(matches).length === definitions.length;

  if (!currentList || !currentWords.length) {
    return null;
  }

  // Phase Setup
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-cyan-100 p-4">
        <div className="max-w-md mx-auto pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleExit}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <div className="flex items-center gap-2 bg-teal-100 px-4 py-2 rounded-full">
                <BookOpen className="w-5 h-5 text-teal-600" />
                <span className="font-bold text-teal-700">Mot ↔ Définition</span>
              </div>
            </div>

            {/* Titre */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {currentList.title}
              </h1>
              <p className="text-gray-500">
                Associe chaque mot à sa définition
              </p>
            </div>

            {/* Prénom */}
            {!currentStudentName && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ton prénom
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    value={currentStudentName || ""}
                    onChange={(e) => setCurrentStudentName(e.target.value)}
                    placeholder="Entre ton prénom..."
                    className="pl-10 h-12 text-lg rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Sélecteur nombre de mots */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de mots
              </label>
              <div className="flex gap-2">
                {wordCountOptions.map((count) => (
                  <button
                    key={count}
                    onClick={() => setWordCount(count)}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
                      wordCount === count
                        ? "bg-teal-500 text-white shadow-lg"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Info exercice */}
            <div className="bg-teal-50 rounded-xl p-4 mb-6">
              <p className="text-teal-700 text-sm">
                <strong>{wordCount} mots</strong> à associer à leurs définitions.
                Clique sur un mot, puis sur sa définition.
              </p>
            </div>

            {/* Bouton démarrer */}
            <Button
              onClick={handleStartExercise}
              disabled={isLoading}
              className="w-full h-14 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl text-lg font-bold shadow-lg"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              Commencer
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Phase Exercise
  if (phase === "exercise") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-teal-50 to-cyan-100 p-4">
        <div className="max-w-2xl mx-auto pt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl p-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleExit}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
              <div className="text-center">
                <p className="text-sm text-gray-500">Associés</p>
                <p className="text-xl font-bold text-teal-600">
                  {Object.keys(matches).length}/{definitions.length}
                </p>
              </div>
              <div className="w-10" />
            </div>

            {/* Instructions */}
            <div className="bg-teal-50 rounded-xl p-3 mb-4 text-center">
              <p className="text-teal-700 text-sm">
                {selectedWord ? (
                  <>Maintenant, clique sur la définition de <strong>"{selectedWord}"</strong></>
                ) : (
                  <>Clique sur un <strong>mot</strong> puis sur sa <strong>définition</strong></>
                )}
              </p>
            </div>

            {/* Colonnes Mots / Définitions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Colonne Mots */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 mb-2 text-center">MOTS</h3>
                <div className="space-y-2">
                  {definitions.map((def) => {
                    const isMatched = matches[def.word];
                    const isSelected = selectedWord === def.word;

                    return (
                      <motion.button
                        key={def.word}
                        onClick={() => isMatched ? handleRemoveMatch(def.word) : handleSelectWord(def.word)}
                        whileTap={{ scale: 0.98 }}
                        className={`w-full p-3 rounded-xl text-left font-medium transition-all ${
                          isMatched
                            ? "bg-teal-100 text-teal-700 border-2 border-teal-300"
                            : isSelected
                            ? "bg-teal-500 text-white border-2 border-teal-600"
                            : "bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isMatched && <Check className="w-4 h-4" />}
                          <span>{def.word}</span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Colonne Définitions */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 mb-2 text-center">DÉFINITIONS</h3>
                <div className="space-y-2">
                  {shuffledDefinitions.map((definition, index) => {
                    const matchedWord = Object.entries(matches).find(([_, def]) => def === definition)?.[0];

                    return (
                      <motion.button
                        key={index}
                        onClick={() => handleSelectDefinition(definition)}
                        whileTap={{ scale: 0.98 }}
                        disabled={!!matchedWord && !selectedWord}
                        className={`w-full p-3 rounded-xl text-left text-sm transition-all ${
                          matchedWord
                            ? "bg-teal-100 text-teal-700 border-2 border-teal-300"
                            : selectedWord
                            ? "bg-cyan-50 text-gray-700 border-2 border-cyan-300 hover:bg-cyan-100"
                            : "bg-gray-100 text-gray-600 border-2 border-transparent"
                        }`}
                      >
                        {definition}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bouton Valider */}
            <div className="mt-6">
              <Button
                onClick={handleValidate}
                disabled={!allMatched}
                className={`w-full h-14 rounded-xl text-lg font-bold shadow-lg ${
                  allMatched
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                }`}
              >
                <Check className="w-5 h-5 mr-2" />
                Valider mes réponses
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Phase Result
  const correctCount = results.filter(r => r.isCorrect).length;
  const percentage = Math.round((correctCount / results.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-cyan-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          {/* Header résultat */}
          <div className={`p-6 text-white text-center ${
            percentage === 100
              ? "bg-gradient-to-r from-yellow-400 to-amber-500"
              : percentage >= 80
              ? "bg-gradient-to-r from-green-400 to-emerald-500"
              : percentage >= 60
              ? "bg-gradient-to-r from-blue-400 to-cyan-500"
              : "bg-gradient-to-r from-orange-400 to-red-400"
          }`}>
            {percentage === 100 && (
              <Trophy className="w-16 h-16 mx-auto mb-2" />
            )}
            <h2 className="text-4xl font-bold mb-1">{percentage}%</h2>
            <p className="text-white/80">
              {correctCount}/{results.length} associations correctes
            </p>
          </div>

          {/* Détail des résultats */}
          <div className="p-4 max-h-[40vh] overflow-y-auto">
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl ${
                    result.isCorrect
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {result.isCorrect ? (
                      <Check className="w-5 h-5 text-green-500 mt-0.5" />
                    ) : (
                      <X className="w-5 h-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{result.word}</p>
                      {!result.isCorrect && (
                        <>
                          <p className="text-sm text-red-500 line-through">
                            {result.selectedDefinition || "(pas de réponse)"}
                          </p>
                          <p className="text-sm text-green-600">
                            → {result.correctDefinition}
                          </p>
                        </>
                      )}
                      {result.isCorrect && (
                        <p className="text-sm text-green-600">
                          {result.correctDefinition}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Boutons */}
          <div className="p-4 space-y-3">
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full h-12 rounded-xl font-bold border-2"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              Réessayer
            </Button>
            <Button
              onClick={handleExit}
              className="w-full h-12 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-xl font-bold"
            >
              Terminer
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
