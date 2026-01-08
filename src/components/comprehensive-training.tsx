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
  Eye,
  EyeOff,
  ChevronRight,
  BookOpen,
  Headphones,
  PenTool,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { generateTextWithBlanks, generateTextWithAI, GeneratedText } from "@/lib/text-generator";
import { generateSpellingChoice, SpellingChoice, generateWordVariants } from "@/lib/spelling-errors";
import confetti from "canvas-confetti";

type Phase = "setup" | "flashcard" | "audio" | "spelling-choice" | "fill-blanks" | "result";

interface WordProgress {
  word: string;
  flashcardCorrect: boolean;
  audioCorrect: boolean;
  spellingCorrect: boolean;
  fillBlankCorrect: boolean;
}

export default function ComprehensiveTraining() {
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
    addSessionToHistory,
  } = useAppStore();
  const { saveSession } = useSupabaseSync();

  // Phase actuelle
  const [phase, setPhase] = useState<Phase>("setup");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [startTime, setStartTime] = useState(0);

  // Resultats par phase
  const [wordProgress, setWordProgress] = useState<WordProgress[]>([]);

  // Flashcard state
  const [showWord, setShowWord] = useState(true);
  const [userInput, setUserInput] = useState("");
  const [showResult, setShowResult] = useState(false);

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Spelling choice state
  const [spellingChoices, setSpellingChoices] = useState<SpellingChoice[]>([]);
  const [currentChoiceIndex, setCurrentChoiceIndex] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  // Fill blanks state
  const [generatedText, setGeneratedText] = useState<GeneratedText | null>(null);
  const [blankAnswers, setBlankAnswers] = useState<Record<number, string>>({});
  const [showBlankResults, setShowBlankResults] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Parler un mot
  const speakWord = useCallback((word: string) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = "fr-FR";
    utterance.rate = 0.85;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    speechRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, []);

  // Parler le texte complet
  const speakText = useCallback((text: string) => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 0.8;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    speechRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, []);

  // Demarrer l'entrainement
  const handleStart = () => {
    setPhase("flashcard");
    setStartTime(Date.now());
    setCurrentWordIndex(0);
    setWordProgress(currentWords.map(w => ({
      word: w.word,
      flashcardCorrect: false,
      audioCorrect: false,
      spellingCorrect: false,
      fillBlankCorrect: false,
    })));
    setShowWord(true);
    setUserInput("");
    setShowResult(false);
  };

  // Verifier la reponse flashcard
  const checkFlashcardAnswer = () => {
    const currentWord = currentWords[currentWordIndex]?.word || "";
    const variants = generateWordVariants(currentWord);
    const isCorrect = variants.some(v =>
      v.toLowerCase() === userInput.trim().toLowerCase()
    );

    setWordProgress(prev => {
      const updated = [...prev];
      if (updated[currentWordIndex]) {
        updated[currentWordIndex].flashcardCorrect = isCorrect;
      }
      return updated;
    });

    setShowResult(true);

    if (isCorrect) {
      toast.success("Correct !");
    } else {
      toast.error(`La bonne reponse etait: ${currentWord}`);
    }
  };

  // Passer au mot suivant (flashcard)
  const nextFlashcard = () => {
    if (currentWordIndex < currentWords.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setShowWord(true);
      setUserInput("");
      setShowResult(false);
    } else {
      // Passer a la phase audio
      setPhase("audio");
      setCurrentWordIndex(0);
      setUserInput("");
      setShowResult(false);
    }
  };

  // Verifier la reponse audio
  const checkAudioAnswer = () => {
    const currentWord = currentWords[currentWordIndex]?.word || "";
    const variants = generateWordVariants(currentWord);
    const isCorrect = variants.some(v =>
      v.toLowerCase() === userInput.trim().toLowerCase()
    );

    setWordProgress(prev => {
      const updated = [...prev];
      if (updated[currentWordIndex]) {
        updated[currentWordIndex].audioCorrect = isCorrect;
      }
      return updated;
    });

    setShowResult(true);

    if (isCorrect) {
      toast.success("Correct !");
    } else {
      toast.error(`La bonne reponse etait: ${currentWord}`);
    }
  };

  // Passer au mot suivant (audio)
  const nextAudio = () => {
    if (currentWordIndex < currentWords.length - 1) {
      setCurrentWordIndex(prev => prev + 1);
      setUserInput("");
      setShowResult(false);
    } else {
      // Passer a la phase choix orthographique
      prepareSpellingChoices();
    }
  };

  // Preparer les choix orthographiques
  const prepareSpellingChoices = () => {
    const choices = currentWords.map(w => generateSpellingChoice(w.word));
    setSpellingChoices(choices);
    setCurrentChoiceIndex(0);
    setSelectedChoice(null);
    setPhase("spelling-choice");
  };

  // Verifier le choix orthographique
  const checkSpellingChoice = (choice: string) => {
    const currentChoice = spellingChoices[currentChoiceIndex];
    const isCorrect = choice === currentChoice.correct;

    setWordProgress(prev => {
      const updated = [...prev];
      if (updated[currentChoiceIndex]) {
        updated[currentChoiceIndex].spellingCorrect = isCorrect;
      }
      return updated;
    });

    setSelectedChoice(choice);

    setTimeout(() => {
      if (currentChoiceIndex < spellingChoices.length - 1) {
        setCurrentChoiceIndex(prev => prev + 1);
        setSelectedChoice(null);
      } else {
        // Passer a la phase dictee a trous
        prepareFillBlanks();
      }
    }, 1000);
  };

  // Preparer la dictee a trous
  const prepareFillBlanks = async () => {
    setPhase("fill-blanks");
    const words = currentWords.map(w => w.word);

    let text: GeneratedText;
    if (apiConfig?.apiKey) {
      text = await generateTextWithAI(words, apiConfig.apiKey);
    } else {
      text = generateTextWithBlanks(words);
    }

    setGeneratedText(text);
    setBlankAnswers({});
    setShowBlankResults(false);
  };

  // Verifier les reponses de la dictee a trous
  const checkFillBlanks = () => {
    if (!generatedText) return;

    setShowBlankResults(true);

    generatedText.blanks.forEach((blank, index) => {
      const userAnswer = (blankAnswers[index] || "").trim().toLowerCase();
      const isCorrect = userAnswer === blank.word.toLowerCase();

      // Trouver l'index du mot original dans wordProgress
      const wordIndex = currentWords.findIndex(w => {
        const variants = generateWordVariants(w.word);
        return variants.some(v => v.toLowerCase() === blank.word.toLowerCase());
      });

      if (wordIndex !== -1) {
        setWordProgress(prev => {
          const updated = [...prev];
          if (updated[wordIndex]) {
            updated[wordIndex].fillBlankCorrect = isCorrect;
          }
          return updated;
        });
      }
    });

    setTimeout(() => {
      finishTraining();
    }, 2000);
  };

  // Terminer l'entrainement
  const finishTraining = () => {
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Calculer les resultats
    const flashcardCorrect = wordProgress.filter(w => w.flashcardCorrect).length;
    const audioCorrect = wordProgress.filter(w => w.audioCorrect).length;
    const spellingCorrect = wordProgress.filter(w => w.spellingCorrect).length;
    const fillBlankCorrect = wordProgress.filter(w => w.fillBlankCorrect).length;

    const totalCorrect = flashcardCorrect + audioCorrect + spellingCorrect + fillBlankCorrect;
    const totalPossible = currentWords.length * 4;
    const percentage = Math.round((totalCorrect / totalPossible) * 100);

    // Sauvegarder
    if (currentList) {
      const answers = wordProgress.map(wp => ({
        word: wp.word,
        userAnswer: wp.flashcardCorrect && wp.audioCorrect && wp.spellingCorrect && wp.fillBlankCorrect ? wp.word : "erreur",
        isCorrect: wp.flashcardCorrect && wp.audioCorrect && wp.spellingCorrect && wp.fillBlankCorrect,
      }));

      saveSession({
        listId: currentList.id,
        listTitle: currentList.title,
        studentName: currentStudentName.trim() || undefined,
        modeUsed: "audio",
        totalWords: currentWords.length,
        correctWords: wordProgress.filter(w => w.flashcardCorrect && w.audioCorrect).length,
        percentage,
        timeSpentSeconds: timeSpent,
        answers,
      });

      addSessionToHistory({
        listId: currentList.id,
        listTitle: currentList.title,
        studentName: currentStudentName.trim() || undefined,
        percentage,
        correctCount: totalCorrect,
        totalWords: totalPossible,
        timeSpent,
        answers,
      });
    }

    // Gamification
    updateStreak(streak + 1);
    if (percentage >= 80) {
      addBadge("⭐");
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }

    setPhase("result");
  };

  // Quitter
  const handleQuit = () => {
    speechSynthesis.cancel();
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

  // Calcul de la progression globale
  const getOverallProgress = () => {
    const phases = ["flashcard", "audio", "spelling-choice", "fill-blanks"];
    const currentPhaseIndex = phases.indexOf(phase);
    if (currentPhaseIndex === -1) return 0;

    const phaseProgress = currentPhaseIndex / phases.length;
    let wordProgress = 0;

    if (phase === "flashcard" || phase === "audio") {
      wordProgress = currentWordIndex / currentWords.length / phases.length;
    } else if (phase === "spelling-choice") {
      wordProgress = currentChoiceIndex / spellingChoices.length / phases.length;
    } else if (phase === "fill-blanks") {
      wordProgress = Object.keys(blankAnswers).length / (generatedText?.blanks.length || 1) / phases.length;
    }

    return Math.round((phaseProgress + wordProgress) * 100);
  };

  // ==================== RENDER ====================

  // Ecran de resultat
  if (phase === "result") {
    const flashcardScore = wordProgress.filter(w => w.flashcardCorrect).length;
    const audioScore = wordProgress.filter(w => w.audioCorrect).length;
    const spellingScore = wordProgress.filter(w => w.spellingCorrect).length;
    const fillBlankScore = wordProgress.filter(w => w.fillBlankCorrect).length;
    const totalScore = flashcardScore + audioScore + spellingScore + fillBlankScore;
    const maxScore = currentWords.length * 4;
    const percentage = Math.round((totalScore / maxScore) * 100);

    return (
      <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className={`w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-6 ${
              percentage >= 80
                ? "bg-gradient-to-br from-yellow-400 to-amber-500"
                : percentage >= 60
                ? "bg-gradient-to-br from-purple-400 to-indigo-500"
                : "bg-gradient-to-br from-blue-400 to-cyan-500"
            }`}
          >
            {percentage >= 80 ? (
              <Trophy className="w-14 h-14 text-white" />
            ) : (
              <Sparkles className="w-14 h-14 text-white" />
            )}
          </motion.div>

          <h1 className="text-3xl font-bold mb-2">
            {percentage >= 80 ? "Excellent !" : percentage >= 60 ? "Bien joue !" : "Continue !"}
          </h1>

          <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6 my-6 space-y-4">
            <div className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              {percentage}%
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Flashcard</span>
                </div>
                <span className="text-lg font-bold text-blue-600">{flashcardScore}/{currentWords.length}</span>
              </div>
              <div className="p-3 bg-green-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <Headphones className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Audio</span>
                </div>
                <span className="text-lg font-bold text-green-600">{audioScore}/{currentWords.length}</span>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <PenTool className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">Orthographe</span>
                </div>
                <span className="text-lg font-bold text-orange-600">{spellingScore}/{currentWords.length}</span>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Dictee</span>
                </div>
                <span className="text-lg font-bold text-purple-600">{fillBlankScore}/{generatedText?.blanks.length || 0}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPhase("setup");
                setWordProgress([]);
              }}
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
      {/* Header avec progression */}
      {phase !== "setup" && (
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {phase === "flashcard" && <BookOpen className="w-5 h-5 text-blue-500" />}
                {phase === "audio" && <Headphones className="w-5 h-5 text-green-500" />}
                {phase === "spelling-choice" && <PenTool className="w-5 h-5 text-orange-500" />}
                {phase === "fill-blanks" && <FileText className="w-5 h-5 text-purple-500" />}
                <span className="font-bold text-gray-800">
                  {phase === "flashcard" && "Flashcard"}
                  {phase === "audio" && "Audio"}
                  {phase === "spelling-choice" && "Choix orthographique"}
                  {phase === "fill-blanks" && "Dictee a trous"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleQuit}
                className="hover:bg-red-50 hover:text-red-500"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <Progress value={getOverallProgress()} className="h-2" />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Progression globale</span>
              <span>{getOverallProgress()}%</span>
            </div>
          </div>
        </header>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {/* Setup */}
          {phase === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-8">
                <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <BookOpen className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold mb-2">{currentList.title}</h1>
                <p className="text-gray-500">{currentWords.length} mots a apprendre</p>
              </div>

              {/* Workflow */}
              <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 mb-6">
                <h3 className="font-bold text-gray-700 mb-3">Parcours d'entrainement</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-blue-50">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold">1</div>
                    <div>
                      <span className="font-medium text-blue-700">Flashcard</span>
                      <span className="text-xs text-blue-500 block">Voir et ecrire</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-green-50">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold">2</div>
                    <div>
                      <span className="font-medium text-green-700">Audio</span>
                      <span className="text-xs text-green-500 block">Ecouter et ecrire</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-orange-50">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold">3</div>
                    <div>
                      <span className="font-medium text-orange-700">Choix orthographique</span>
                      <span className="text-xs text-orange-500 block">Choisir la bonne orthographe</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-purple-50">
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white font-bold">4</div>
                    <div>
                      <span className="font-medium text-purple-700">Dictee a trous</span>
                      <span className="text-xs text-purple-500 block">Completer le texte</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prenom */}
              <div className="mb-4 p-4 rounded-2xl border-2 border-gray-100 bg-white">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-indigo-600" />
                  <span className="font-bold text-gray-800">Ton prenom</span>
                </div>
                <Input
                  value={currentStudentName}
                  onChange={(e) => setCurrentStudentName(e.target.value)}
                  placeholder="Entre ton prenom..."
                  className="h-12 text-lg border-2 border-gray-100 rounded-xl"
                />
              </div>

              <Button
                size="lg"
                onClick={handleStart}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 shadow-xl rounded-2xl gap-2"
              >
                <Play className="w-5 h-5" />
                Commencer
              </Button>
            </motion.div>
          )}

          {/* Flashcard */}
          {phase === "flashcard" && (
            <motion.div
              key="flashcard"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-4">
                <span className="text-sm text-gray-400">
                  Mot {currentWordIndex + 1} / {currentWords.length}
                </span>
              </div>

              {/* Carte du mot */}
              <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-xl p-8 mb-6 min-h-[200px] flex flex-col items-center justify-center">
                {showWord && !showResult ? (
                  <>
                    <p className="text-4xl font-bold text-gray-800 mb-4">
                      {currentWords[currentWordIndex]?.word}
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => setShowWord(false)}
                      className="gap-2"
                    >
                      <EyeOff className="w-4 h-4" />
                      Je l'ai memorise
                    </Button>
                  </>
                ) : showResult ? (
                  <div className="text-center">
                    <p className={`text-2xl font-bold mb-2 ${
                      wordProgress[currentWordIndex]?.flashcardCorrect ? "text-green-600" : "text-red-600"
                    }`}>
                      {wordProgress[currentWordIndex]?.flashcardCorrect ? "Correct !" : "Incorrect"}
                    </p>
                    <p className="text-xl text-gray-600">
                      Reponse: <span className="font-bold">{currentWords[currentWordIndex]?.word}</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkFlashcardAnswer()}
                      placeholder="Ecris le mot..."
                      className="text-center text-2xl h-14 border-2 border-gray-200 rounded-xl mb-4"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowWord(true)} className="gap-2">
                        <Eye className="w-4 h-4" />
                        Revoir
                      </Button>
                      <Button onClick={checkFlashcardAnswer} className="bg-blue-500 hover:bg-blue-600 gap-2">
                        <Check className="w-4 h-4" />
                        Verifier
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {showResult && (
                <Button
                  onClick={nextFlashcard}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl gap-2"
                >
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </motion.div>
          )}

          {/* Audio */}
          {phase === "audio" && (
            <motion.div
              key="audio"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-4">
                <span className="text-sm text-gray-400">
                  Mot {currentWordIndex + 1} / {currentWords.length}
                </span>
              </div>

              <div className="bg-white rounded-3xl border-2 border-green-100 shadow-xl p-8 mb-6 min-h-[200px] flex flex-col items-center justify-center">
                {!showResult ? (
                  <>
                    <Button
                      onClick={() => speakWord(currentWords[currentWordIndex]?.word || "")}
                      className={`w-20 h-20 rounded-full mb-6 ${
                        isPlaying
                          ? "bg-gradient-to-r from-green-400 to-emerald-500"
                          : "bg-gradient-to-r from-green-500 to-emerald-600"
                      }`}
                    >
                      <Volume2 className={`w-10 h-10 text-white ${isPlaying ? "animate-pulse" : ""}`} />
                    </Button>
                    <Input
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkAudioAnswer()}
                      placeholder="Ecris ce que tu entends..."
                      className="text-center text-xl h-14 border-2 border-gray-200 rounded-xl mb-4"
                      autoFocus
                    />
                    <Button onClick={checkAudioAnswer} className="bg-green-500 hover:bg-green-600 gap-2">
                      <Check className="w-4 h-4" />
                      Verifier
                    </Button>
                  </>
                ) : (
                  <div className="text-center">
                    <p className={`text-2xl font-bold mb-2 ${
                      wordProgress[currentWordIndex]?.audioCorrect ? "text-green-600" : "text-red-600"
                    }`}>
                      {wordProgress[currentWordIndex]?.audioCorrect ? "Correct !" : "Incorrect"}
                    </p>
                    <p className="text-xl text-gray-600">
                      Reponse: <span className="font-bold">{currentWords[currentWordIndex]?.word}</span>
                    </p>
                  </div>
                )}
              </div>

              {showResult && (
                <Button
                  onClick={nextAudio}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl gap-2"
                >
                  Suivant
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
            </motion.div>
          )}

          {/* Spelling Choice */}
          {phase === "spelling-choice" && spellingChoices.length > 0 && (
            <motion.div
              key="spelling"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-md"
            >
              <div className="text-center mb-4">
                <span className="text-sm text-gray-400">
                  Mot {currentChoiceIndex + 1} / {spellingChoices.length}
                </span>
              </div>

              <div className="bg-white rounded-3xl border-2 border-orange-100 shadow-xl p-8 mb-6">
                <p className="text-center text-lg text-gray-600 mb-6">
                  Choisis la bonne orthographe :
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const choice = spellingChoices[currentChoiceIndex];
                    const options = choice.position === 'left'
                      ? [choice.correct, choice.wrong]
                      : [choice.wrong, choice.correct];

                    return options.map((option, idx) => {
                      const isSelected = selectedChoice === option;
                      const isCorrect = option === choice.correct;
                      const showFeedback = selectedChoice !== null;

                      return (
                        <button
                          key={idx}
                          onClick={() => !selectedChoice && checkSpellingChoice(option)}
                          disabled={selectedChoice !== null}
                          className={`p-6 text-2xl font-bold rounded-2xl border-2 transition-all ${
                            showFeedback
                              ? isCorrect
                                ? "border-green-400 bg-green-50 text-green-700"
                                : isSelected
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-gray-200 text-gray-400"
                              : "border-gray-200 hover:border-orange-400 hover:bg-orange-50"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            </motion.div>
          )}

          {/* Fill Blanks */}
          {phase === "fill-blanks" && generatedText && (
            <motion.div
              key="fill-blanks"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="w-full max-w-2xl"
            >
              <div className="flex justify-center mb-6">
                <Button
                  onClick={() => speakText(generatedText.fullText)}
                  className={`h-14 px-8 text-lg font-bold rounded-2xl gap-3 ${
                    isPlaying
                      ? "bg-gradient-to-r from-red-400 to-rose-500"
                      : "bg-gradient-to-r from-purple-500 to-indigo-600"
                  }`}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  {isPlaying ? "Pause" : "Ecouter la dictee"}
                </Button>
              </div>

              <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6 mb-6">
                <p className="text-lg leading-relaxed text-gray-700">
                  {renderTextWithBlanks()}
                </p>
              </div>

              {!showBlankResults && (
                <Button
                  onClick={checkFillBlanks}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl gap-2"
                >
                  <Check className="w-5 h-5" />
                  Valider mes reponses
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );

  // Fonction pour rendre le texte avec les champs a remplir
  function renderTextWithBlanks() {
    if (!generatedText) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    const sortedBlanks = [...generatedText.blanks].sort((a, b) => a.position - b.position);

    sortedBlanks.forEach((blank, index) => {
      if (blank.position > lastIndex) {
        parts.push(
          <span key={`text-${index}`}>
            {generatedText.fullText.substring(lastIndex, blank.position)}
          </span>
        );
      }

      const userAnswer = blankAnswers[index] || "";
      const isCorrect = showBlankResults && userAnswer.trim().toLowerCase() === blank.word.toLowerCase();
      const isWrong = showBlankResults && !isCorrect;

      parts.push(
        <span key={`blank-${index}`} className="inline-block mx-1 align-middle">
          <input
            ref={el => { inputRefs.current[index] = el; }}
            type="text"
            value={userAnswer}
            onChange={(e) => setBlankAnswers(prev => ({ ...prev, [index]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const next = index + 1;
                if (next < generatedText.blanks.length) {
                  inputRefs.current[next]?.focus();
                }
              }
            }}
            disabled={showBlankResults}
            className={`w-28 h-8 px-2 text-center font-bold rounded-lg border-2 outline-none transition-all ${
              showBlankResults
                ? isCorrect
                  ? "border-green-400 bg-green-50 text-green-700"
                  : "border-red-400 bg-red-50 text-red-700"
                : "border-purple-300 bg-purple-50 focus:border-purple-500"
            }`}
            placeholder="..."
          />
          {isWrong && (
            <span className="ml-1 text-green-600 font-bold">({blank.word})</span>
          )}
        </span>
      );

      lastIndex = blank.position + blank.word.length;
    });

    if (lastIndex < generatedText.fullText.length) {
      parts.push(
        <span key="text-end">{generatedText.fullText.substring(lastIndex)}</span>
      );
    }

    return parts;
  }
}
