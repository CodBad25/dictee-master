"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Volume2, Check, X, RotateCcw, Trophy, Sparkles,
  ChevronRight, Pause, Play, Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import { createClient } from "@/lib/supabase/client";
import confetti from "canvas-confetti";

type Phase = "loading" | "firstListen" | "dictation" | "result";

interface PhraseResult {
  phrase: string;
  userAnswer: string;
  isCorrect: boolean;
  correctWords: number;
  totalWords: number;
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[.,;:!?'"()]/g, "").trim();
}

function comparePhrase(original: string, userAnswer: string): PhraseResult {
  const origWords = original.split(/\s+/).filter(w => w.length > 0);
  const userWords = userAnswer.split(/\s+/).filter(w => w.length > 0);
  let correct = 0;
  for (let i = 0; i < Math.min(origWords.length, userWords.length); i++) {
    if (normalizeText(origWords[i]) === normalizeText(userWords[i])) correct++;
  }
  return {
    phrase: original,
    userAnswer,
    isCorrect: correct === origWords.length && userWords.length === origWords.length,
    correctWords: correct,
    totalWords: origWords.length,
  };
}

function splitIntoPhrases(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter(p => p.trim().length > 0);
}

export default function AudioDictationMode() {
  const {
    currentList, currentWords, clearCurrentTraining,
    updateStreak, streak, addBadge, currentStudentName,
  } = useAppStore();
  const { saveSession } = useSupabaseSync();

  const [phase, setPhase] = useState<Phase>("loading");
  const [phrases, setPhrases] = useState<string[]>([]);
  const [fullText, setFullText] = useState("");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [results, setResults] = useState<PhraseResult[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [replayCount, setReplayCount] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [dicteePosition, setDicteePosition] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const phraseTimestampsRef = useRef<{ start: number; end: number }[]>([]);

  if (!currentList || !currentWords.length) return null;

  // Charger le texte et la position
  const loadData = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb
      .from("dictees")
      .select("fill_blanks_text, position")
      .eq("id", currentList.id)
      .maybeSingle();

    if (!data?.fill_blanks_text) {
      toast.error("Texte non trouvé pour cette dictée");
      clearCurrentTraining();
      return;
    }

    const text = data.fill_blanks_text as string;
    const p = splitIntoPhrases(text);
    setFullText(text);
    setPhrases(p);
    setDicteePosition(data.position);

    // Préparer l'audio
    const audio = new Audio(`/audio/dictees/dictee_${data.position}.mp3`);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      // Calculer les timestamps par phrase (ratio de caractères)
      const totalChars = p.reduce((acc, phrase) => acc + phrase.length, 0);
      const duration = audio.duration;
      let cumChars = 0;
      const timestamps: { start: number; end: number }[] = [];

      for (const phrase of p) {
        const start = (cumChars / totalChars) * duration;
        cumChars += phrase.length;
        const end = (cumChars / totalChars) * duration;
        timestamps.push({ start, end });
      }
      phraseTimestampsRef.current = timestamps;

      // Passer à la première écoute complète
      setPhase("firstListen");
      setStartTime(Date.now());
    });

    audio.addEventListener("error", () => {
      toast.error("Fichier audio introuvable, utilisation de la voix système");
      // Fallback : passer directement en dictation sans audio fichier
      setPhase("dictation");
      setStartTime(Date.now());
    });

    audio.load();
  }, [currentList, clearCurrentTraining]);

  useEffect(() => {
    if (phase === "loading") loadData();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Écouter le texte complet (première écoute)
  const playFullText = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    audio.currentTime = 0;
    setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.play();
  };

  const pauseAudio = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
  };

  // Passer en mode dictation phrase par phrase
  const startDictation = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setPhraseIndex(0);
    setCurrentAnswer("");
    setResults([]);
    setPhase("dictation");
  };

  const maxReplays = 3; // TODO: configurable par l'enseignant

  // Jouer la phrase courante (section du MP3)
  const playCurrentPhrase = () => {
    if (replayCount >= maxReplays) {
      toast.error(`Maximum ${maxReplays} écoutes par phrase`);
      return;
    }
    const audio = audioRef.current;
    const ts = phraseTimestampsRef.current[phraseIndex];
    if (!audio || !ts) return;

    audio.playbackRate = speed;
    audio.currentTime = ts.start;
    setIsPlaying(true);
    setReplayCount(r => r + 1);

    const checkEnd = () => {
      if (audio.currentTime >= ts.end - 0.1) {
        audio.pause();
        setIsPlaying(false);
        audio.removeEventListener("timeupdate", checkEnd);
      }
    };
    audio.addEventListener("timeupdate", checkEnd);
    audio.onended = () => {
      setIsPlaying(false);
      audio.removeEventListener("timeupdate", checkEnd);
    };
    audio.play();
  };

  // Phrase suivante
  const handleNext = () => {
    if (!currentAnswer.trim()) return;
    const result = comparePhrase(phrases[phraseIndex], currentAnswer);
    const newResults = [...results, result];
    setResults(newResults);
    setReplayCount(0);

    if (phraseIndex + 1 < phrases.length) {
      setPhraseIndex(phraseIndex + 1);
      setCurrentAnswer("");
    } else {
      finishDictation(newResults);
    }
  };

  const finishDictation = async (allResults: PhraseResult[]) => {
    setPhase("result");
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const totalCorrectWords = allResults.reduce((a, r) => a + r.correctWords, 0);
    const totalWords = allResults.reduce((a, r) => a + r.totalWords, 0);
    const percentage = totalWords > 0 ? Math.round((totalCorrectWords / totalWords) * 100) : 0;

    await saveSession({
      listId: currentList.id,
      listTitle: currentList.title,
      studentName: currentStudentName || undefined,
      modeUsed: "audio_dictation",
      totalWords,
      correctWords: totalCorrectWords,
      percentage,
      timeSpentSeconds: timeSpent,
      answers: allResults.map(r => ({ word: r.phrase, userAnswer: r.userAnswer, isCorrect: r.isCorrect })),
    });

    updateStreak(streak + 1);
    if (percentage >= 80) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  };

  const handleQuit = () => {
    audioRef.current?.pause();
    clearCurrentTraining();
  };

  const handleRetry = () => {
    setPhraseIndex(0);
    setCurrentAnswer("");
    setResults([]);
    setReplayCount(0);
    setPhase("firstListen");
  };

  // ─── LOADING ────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block mb-4">
            <Volume2 className="w-8 h-8 text-purple-500" />
          </div>
          <p className="text-gray-600">Chargement de la dictée...</p>
        </div>
      </div>
    );
  }

  // ─── PREMIÈRE ÉCOUTE ───────────────────────────────────
  if (phase === "firstListen") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-gray-800">{currentList.title}</h1>
          <Button variant="ghost" size="sm" onClick={handleQuit}><X className="w-4 h-4" /></Button>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 max-w-lg mx-auto w-full">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-xl">
            <Volume2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-center">Première écoute</h2>
          <p className="text-gray-500 text-center">Écoute le texte complet une première fois avant de commencer la dictée.</p>

          {/* Contrôle vitesse */}
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-gray-400" />
            {[0.75, 1].map(s => (
              <button
                key={s}
                onClick={() => {
                  setSpeed(s);
                  if (audioRef.current) audioRef.current.playbackRate = s;
                }}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  speed === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {s === 0.75 ? "Lent" : "Normal"}
              </button>
            ))}
          </div>

          <Button
            size="lg"
            onClick={isPlaying ? pauseAudio : playFullText}
            className={`h-14 px-8 text-lg font-bold rounded-2xl gap-3 shadow-xl ${
              isPlaying
                ? "bg-gradient-to-r from-red-400 to-rose-500"
                : "bg-gradient-to-r from-blue-400 to-cyan-500"
            }`}
          >
            {isPlaying ? <><Pause className="w-6 h-6" /> Pause</> : <><Play className="w-6 h-6" /> Écouter</>}
          </Button>

          <Button
            onClick={startDictation}
            variant="outline"
            className="rounded-2xl px-6 py-3 font-semibold"
          >
            Passer à la dictée <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── DICTATION PHRASE PAR PHRASE ────────────────────────
  if (phase === "dictation") {
    const progress = ((phraseIndex + 1) / phrases.length) * 100;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col">
        <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-gray-800">{currentList.title}</h1>
            <p className="text-xs text-gray-400">Phrase {phraseIndex + 1} / {phrases.length}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleQuit}><X className="w-4 h-4" /></Button>
        </header>

        {/* Barre de progression */}
        <div className="h-1 bg-gray-200">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 max-w-2xl mx-auto w-full">
          {/* Contrôles audio */}
          <div className="flex items-center gap-3">
            <Button
              size="lg"
              onClick={playCurrentPhrase}
              disabled={isPlaying || replayCount >= maxReplays}
              className="rounded-full w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg disabled:opacity-40"
            >
              <Volume2 className="w-6 h-6" />
            </Button>
          </div>

          {/* Vitesse + compteur réécoutes */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-gray-400" />
              {[0.75, 1].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSpeed(s);
                    if (audioRef.current) audioRef.current.playbackRate = s;
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    speed === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {s === 0.75 ? "Lent" : "Normal"}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-400">
              {replayCount} / {maxReplays} écoutes
            </span>
          </div>

          {/* Zone de saisie */}
          <div className="w-full">
            <label className="text-xs font-semibold text-gray-600 block mb-2">
              Écris ce que tu as entendu
            </label>
            <textarea
              value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder="Tape ici..."
              className="w-full h-32 p-4 border-2 border-gray-200 rounded-2xl focus:border-purple-500 focus:outline-none resize-none text-lg"
              autoFocus
            />
          </div>

          {/* Bouton suivant */}
          <Button
            onClick={handleNext}
            disabled={!currentAnswer.trim()}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl py-3 font-semibold"
          >
            {phraseIndex + 1 < phrases.length ? "Phrase suivante" : "Terminer"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  // ─── RÉSULTATS ──────────────────────────────────────────
  const totalCorrectWords = results.reduce((a, r) => a + r.correctWords, 0);
  const totalWords = results.reduce((a, r) => a + r.totalWords, 0);
  const percentage = totalWords > 0 ? Math.round((totalCorrectWords / totalWords) * 100) : 0;
  const isPerfect = percentage === 100;
  const isGood = percentage >= 80;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center w-full max-w-lg"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className={`w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl mx-auto mb-6 ${
            isPerfect ? "bg-gradient-to-br from-yellow-400 to-amber-500"
            : isGood ? "bg-gradient-to-br from-purple-400 to-indigo-500"
            : "bg-gradient-to-br from-blue-400 to-cyan-500"
          }`}
        >
          {isPerfect ? <Trophy className="w-14 h-14 text-white" /> : <Sparkles className="w-14 h-14 text-white" />}
        </motion.div>

        <h1 className="text-3xl font-bold mb-2">
          {isPerfect ? "Parfait !" : isGood ? "Bien joué !" : "Continue !"}
        </h1>

        <div className="bg-white rounded-3xl border-2 border-purple-100 shadow-xl p-6 my-6">
          <div className="text-6xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            {percentage}%
          </div>
          <p className="text-gray-500">{totalCorrectWords} / {totalWords} mots corrects</p>

          {/* Détail par phrase */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 max-h-60 overflow-y-auto text-left">
            {results.map((r, i) => (
              <div key={i} className={`p-3 rounded-xl text-sm ${r.isCorrect ? "bg-green-50" : "bg-red-50"}`}>
                <div className="flex items-start gap-2">
                  {r.isCorrect ? <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" /> : <X className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <p className={`font-medium ${r.isCorrect ? "text-green-700" : "text-red-700"}`}>{r.phrase}</p>
                    {!r.isCorrect && (
                      <p className="text-red-400 mt-1 line-through">{r.userAnswer || "(vide)"}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{r.correctWords}/{r.totalWords} mots</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleRetry} className="flex-1 h-14 text-lg font-bold rounded-2xl gap-2">
            <RotateCcw className="w-5 h-5" /> Rejouer
          </Button>
          <Button onClick={handleQuit} className="flex-1 h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-indigo-600 rounded-2xl">
            Terminer
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
