"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { VersionBadge } from "@/components/changelog-modal";
import DicteeGrid from "@/components/dictee-grid";
import DicteeDetail from "@/components/dictee-detail";
import TrainingMode from "@/components/training-mode";
import FillBlanksMode from "@/components/fill-blanks-mode";
import WordDefinitionMode from "@/components/word-definition-mode";
import ComprehensiveTraining from "@/components/comprehensive-training";
import SpellingChoiceMode from "@/components/spelling-choice-mode";
import GenreMode from "@/components/genre-mode";
import DictionaryMode from "@/components/dictionary-mode";
import AudioWordMode from "@/components/audio-word-mode";
import AudioDictationMode from "@/components/audio-dictation-mode";
import type { WordList, Word } from "@/types/database";
import { saveResult, loadActivityConfig } from "@/lib/dictee-service";
import { pingPresence } from "@/lib/presence";

const DEFAULT_ACTIVITY_ORDER = [
  "flashcard",
  "genre",
  "spelling_choice",
  "definitions",
  "dictionary",
  "audio_word",
  "fill_blanks",
  "audio_dictation",
];

interface SelectedDictee {
  id: string;
  title: string;
  position: number;
}

export default function StudentPage() {
  const router = useRouter();
  const {
    connectedEleve,
    setConnectedEleve,
    setUser,
    streak,
    badges,
    currentList,
    currentWords,
    setCurrentTraining,
    clearCurrentTraining,
  } = useAppStore();

  const [selectedDictee, setSelectedDictee] = useState<SelectedDictee | null>(null);
  const [unlockedPositions, setUnlockedPositions] = useState<number[]>([1]);
  const [activityOrder, setActivityOrder] = useState<string[]>(DEFAULT_ACTIVITY_ORDER);
  const [selectedWords, setSelectedWords] = useState<number[] | null>(null);

  // Charger les positions déverrouillées au montage
  useEffect(() => {
    const loadUnlockedPositions = async () => {
      const sb = createClient();
      const { data: classes } = await sb.from("dm_classes").select("unlocked_dictees");
      if (classes && classes.length > 0) {
        const allUnlocked = new Set<number>();
        for (const c of classes) {
          for (const pos of c.unlocked_dictees || []) {
            allUnlocked.add(pos);
          }
        }
        if (allUnlocked.size > 0) {
          setUnlockedPositions(Array.from(allUnlocked).sort((a, b) => a - b));
        }
      }
    };
    loadUnlockedPositions();
  }, []);

  // Ping de présence toutes les 30s
  useEffect(() => {
    if (!connectedEleve) return;
    const ping = () => {
      const activity = selectedDictee
        ? { dicteeId: selectedDictee.id, mode: "viewing", status: "working" as const }
        : currentList
        ? { dicteeId: currentList.id, mode: currentList.mode, status: "working" as const }
        : undefined;
      pingPresence(connectedEleve.eleveId, `${connectedEleve.prenom} ${connectedEleve.nom}`, activity);
    };
    ping();
    const interval = setInterval(ping, 30_000);
    return () => clearInterval(interval);
  }, [connectedEleve, selectedDictee, currentList]);

  const handleLogout = () => {
    setUser(null);
    setConnectedEleve(null);
    clearCurrentTraining();
    if (typeof window !== "undefined") {
      localStorage.removeItem("dictee_master_eleve");
      localStorage.removeItem("dictee_master_teacher");
      localStorage.removeItem("dictee_master_teacher_pwd");
    }
    router.push("/");
  };

  const handleCardClick = async (dictee: SelectedDictee) => {
    setSelectedDictee(dictee);
    // Charger la config du parcours pour cette dictée
    try {
      const config = await loadActivityConfig(
        connectedEleve?.classe || "",
        dictee.id,
      );
      setActivityOrder(config.activityOrder);
      setSelectedWords(config.selectedWords);
      useAppStore.getState().setSelectedWordPositions(config.selectedWords);
    } catch {
      setActivityOrder(DEFAULT_ACTIVITY_ORDER);
      setSelectedWords(null);
    }
  };

  const handleStartActivity = (mode: string, words: { word: string; definition: string; spelling_errors: string[]; position: number }[]) => {
    // Mapper le mode vers le format V1
    const modeMap: Record<string, string> = {
      flashcard: "flashcard",
      genre: "genre",
      spelling_choice: "spelling-choice",
      definitions: "definition",
      dictionary: "dictionary",
      audio_word: "audio-word",
      fill_blanks: "fill-blanks",
      audio_dictation: "audio-dictation",
    };

    const v1Mode = modeMap[mode] || "flashcard";

    // Filtrer les mots si une sélection est active
    const filteredWords = selectedWords
      ? words.filter(w => selectedWords.includes(w.position))
      : words;

    // Convertir les mots au format V1
    const v1Words: Word[] = filteredWords.map((w, i) => ({
      id: `word-${i}`,
      list_id: selectedDictee?.id || "dictee",
      word: w.word,
      hint: w.definition,
      order: w.position,
    }));

    // Créer une liste fictive pour les composants V1
    const v1List: WordList = {
      id: selectedDictee?.id || "dictee",
      teacher_id: "system",
      title: selectedDictee?.title || "Dictée",
      mode: v1Mode as any,
      share_code: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCurrentTraining(v1List, v1Words);
  };

  // Si un entraînement est en cours, afficher le composant correspondant
  if (currentList && currentWords.length > 0) {
    if (currentList.mode === "genre") {
      return <GenreMode />;
    }
    if (currentList.mode === "spelling-choice") {
      return <SpellingChoiceMode />;
    }
    if (currentList.mode === "progression") {
      return <ComprehensiveTraining />;
    }
    if (currentList.mode === "dictionary") {
      return <DictionaryMode />;
    }
    if (currentList.mode === "audio-word") {
      return <AudioWordMode />;
    }
    if (currentList.mode === "fill-blanks") {
      return <FillBlanksMode />;
    }
    if (currentList.mode === "definition") {
      return <WordDefinitionMode />;
    }
    if (currentList.mode === "audio-dictation") {
      return <AudioDictationMode />;
    }
    return <TrainingMode />;
  }

  return (
    <main className="min-h-dvh bg-[#f5f3ff] flex flex-col">
      {/* Header compact */}
      <header className="bg-white border-b-2 border-purple-100 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-extrabold text-purple-600">
              DictéeMaster
            </span>
            <VersionBadge />
          </div>
          <span className="text-xs text-gray-500">
            <strong className="text-gray-800">
              {connectedEleve
                ? `${connectedEleve.prenom} ${connectedEleve.nom}`
                : "Élève"}
            </strong>
            {connectedEleve && ` — ${connectedEleve.classe}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[13px] font-bold text-amber-500">
            <Flame className="w-4 h-4" /> {streak}
          </div>
          <div className="flex items-center gap-1 text-[13px] font-bold text-purple-600">
            <Star className="w-4 h-4" /> {badges.length}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="hover:bg-red-50 hover:text-red-500 h-8 w-8"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Contenu : grille (avec sa propre progress bar) ou détail */}
      {selectedDictee ? (
        <DicteeDetail
          dicteeId={selectedDictee.id}
          dicteeTitle={selectedDictee.title}
          dicteePosition={selectedDictee.position}
          activityOrder={activityOrder}
          selectedWords={selectedWords}
          onBack={() => setSelectedDictee(null)}
          onStartActivity={handleStartActivity}
        />
      ) : (
        <DicteeGrid
          unlockedPositions={unlockedPositions}
          onCardClick={handleCardClick}
        />
      )}
    </main>
  );
}
