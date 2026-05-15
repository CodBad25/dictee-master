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
import { playWordAudio, playTextAudio, stopAudio } from "@/lib/audio";

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
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Map originalWord → audio_url pour le bouton 🔊 de chaque trou
  const wordAudioMap = useRef<Map<string, string | null | undefined>>(new Map());
  useEffect(() => {
    const map = new Map<string, string | null | undefined>();
    for (const w of currentWords) {
      map.set(w.word, w.audio_url);
    }
    wordAudioMap.current = map;
  }, [currentWords]);

  // Charger le texte depuis Supabase, fallback sur le générateur
  const generateText = useCallback(async () => {
    if (!currentWords.length || !currentList) return;

    setIsGenerating(true);
    try {
      const words = currentWords.map(w => w.word);
      const dicteeId = currentList.id;

      // 1. Essayer de charger le texte pré-écrit depuis Supabase
      const sb = (await import("@/lib/supabase/client")).createClient();
      const { data: dictee } = await sb
        .from("dictees")
        .select("fill_blanks_text, position")
        .eq("id", dicteeId)
        .maybeSingle();

      if (dictee?.position) setDicteePosition(dictee.position);

      if (dictee?.fill_blanks_text) {
        // Utiliser le texte pré-écrit : trouver les mots à transformer en trous
        const fullText = dictee.fill_blanks_text as string;
        const blanks: GeneratedText["blanks"] = [];

        // Positions déjà utilisées pour éviter les chevauchements
        const usedRanges: { start: number; end: number }[] = [];

        for (const originalWord of words) {
          // Essayer le mot complet d'abord, puis sans article
          const stripped = originalWord.replace(/^(le |la |l'|l\u2019|un |une |les |des |du )/i, "");
          const candidates = [originalWord];
          if (stripped !== originalWord) candidates.push(stripped);

          let found = false;
          for (const candidate of candidates) {
            const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            // Chercher avec frontière de mot pour éviter les faux positifs
            const regex = new RegExp(escaped, "gi");
            let match;
            while ((match = regex.exec(fullText)) !== null) {
              // Vérifier que cette position n'est pas déjà prise
              const overlaps = usedRanges.some(
                r => match!.index < r.end && match!.index + match![0].length > r.start
              );
              if (!overlaps) {
                blanks.push({ word: match[0], originalWord, position: match.index });
                usedRanges.push({ start: match.index, end: match.index + match[0].length });
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }

        // Créer le texte avec les trous
        let displayText = fullText;
        const sortedBlanks = [...blanks].sort((a, b) => b.position - a.position);
        for (const blank of sortedBlanks) {
          const before = displayText.substring(0, blank.position);
          const after = displayText.substring(blank.position + blank.word.length);
          displayText = before + "_".repeat(Math.max(5, blank.word.length)) + after;
        }

        setGeneratedText({
          fullText,
          displayText,
          blanks: blanks.sort((a, b) => a.position - b.position),
        });
        setUserAnswers({});
        setCheckedAnswers({});
        setIsGenerating(false);
        return;
      }

      // 2. Fallback : générateur de templates
      const text = generateTextWithBlanks(words);
      setGeneratedText(text);
      setUserAnswers({});
      setCheckedAnswers({});
    } catch (error) {
      console.error("Error generating text:", error);
      toast.error("Erreur lors de la génération du texte");
    } finally {
      setIsGenerating(false);
    }
  }, [currentWords, currentList]);

  // Position de la dictée (chargée dans generateText)
  const [dicteePosition, setDicteePosition] = useState<number | null>(null);
  const dicteeAudioRef = useRef<HTMLAudioElement | null>(null);

  // Lecture du texte via fichier MP3 pré-enregistré
  const speakText = useCallback(() => {
    if (!generatedText) return;

    // Arrêter tout audio en cours
    if (dicteeAudioRef.current) {
      dicteeAudioRef.current.pause();
      dicteeAudioRef.current = null;
    }
    stopAudio();

    if (dicteePosition) {
      const audio = new Audio(`/audio/dictees/dictee_${dicteePosition}.mp3`);
      dicteeAudioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); dicteeAudioRef.current = null; };
      audio.onerror = () => {
        dicteeAudioRef.current = null;
        playTextAudio(generatedText.fullText, () => setIsPlaying(true), () => setIsPlaying(false));
      };
      audio.play().catch(() => {
        dicteeAudioRef.current = null;
        playTextAudio(generatedText.fullText, () => setIsPlaying(true), () => setIsPlaying(false));
      });
      return;
    }

    playTextAudio(generatedText.fullText, () => setIsPlaying(true), () => setIsPlaying(false));
  }, [generatedText, dicteePosition]);

  const stopSpeaking = () => {
    if (dicteeAudioRef.current) {
      dicteeAudioRef.current.pause();
      dicteeAudioRef.current = null;
    }
    stopAudio();
    setIsPlaying(false);
  };

  const handleStartDictation = async () => {
    await generateText();
    setPhase("dictation");
    setStartTime(Date.now());
  };

  const handleInputChange = (index: number, value: string) => {
    setUserAnswers(prev => ({ ...prev, [index]: value }));
    // Retirer le feedback dès que l'élève retape : il pourra revalider au blur
    if (checkedAnswers[index]) {
      setCheckedAnswers(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const handleBlur = (index: number) => {
    const value = (userAnswers[index] || "").trim();
    if (!value) return; // Ne pas marquer une case vide comme vérifiée
    setCheckedAnswers(prev => ({ ...prev, [index]: true }));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      // Marquer la case courante comme vérifiée avant de passer à la suivante
      handleBlur(index);
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
      const userAnswer = (userAnswers[index] || "").trim();
      const correctAnswer = blank.word;
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
    setCheckedAnswers({});
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
      const userAnswer = (userAnswers[index] || "").trim();
      const correctAnswer = blank.word;
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
            {isPerfect ? "Parfait ! " : isGood ? "Bien joué !" : "Continue !"}
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
                <h1 className="text-2xl font-bold mb-2">Dictée à trous</h1>
                <p className="text-gray-500">
                  Écoute la dictée et complète les trous
                </p>
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
                      Écouter la dictée
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
                Valider mes réponses
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

      // Feedback live au blur OU à la validation finale
      const isChecked = checkedAnswers[index] || showResults;
      const userValue = (userAnswers[index] || "").trim();
      const isCorrect = isChecked && userValue === blank.word;
      const isWrong = isChecked && !isCorrect;

      parts.push(
        <span key={`blank-${index}`} className="inline-flex items-center mx-1 align-middle gap-0.5">
          <button
            type="button"
            onClick={() => {
              // Lire le mot SANS article (ex : "forêt" et non "la forêt")
              const wordWithoutArticle = blank.originalWord.replace(
                /^(le |la |l'|l’|un |une |les |des |du )/i,
                ""
              );
              const audioUrl = wordAudioMap.current.get(blank.originalWord);
              playWordAudio(wordWithoutArticle, undefined, undefined, audioUrl ?? null);
            }}
            className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0 transition-colors"
            title="Écouter le mot"
          >
            <Volume2 className="w-3 h-3" />
          </button>
          <input
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            value={userAnswers[index] || ""}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onBlur={() => handleBlur(index)}
            disabled={showResults}
            style={{ width: `${Math.max(8, blank.word.length + 2)}ch` }}
            className={`h-8 px-2 text-center font-bold rounded-lg border-2 outline-none transition-all ${
              isChecked
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
            data-gramm="false"
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
