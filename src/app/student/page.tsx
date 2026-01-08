"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  LogOut,
  Trophy,
  Flame,
  Play,
  Search,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";
import TrainingMode from "@/components/training-mode";
import FillBlanksMode from "@/components/fill-blanks-mode";
import ComprehensiveTraining from "@/components/comprehensive-training";
import SessionHistory from "@/components/session-history";

export default function StudentPage() {
  const router = useRouter();
  const {
    user,
    setUser,
    demoLists,
    demoWords,
    streak,
    badges,
    currentList,
    currentWords,
    setCurrentTraining,
    clearCurrentTraining,
  } = useAppStore();
  const { findListByCode, isSyncing } = useSupabaseSync();

  const [searchCode, setSearchCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleLogout = () => {
    setUser(null);
    clearCurrentTraining();
    router.push("/");
  };

  const handleSearchList = async () => {
    if (!searchCode.trim()) {
      toast.error("Veuillez entrer un code");
      return;
    }

    setIsSearching(true);

    // D'abord chercher en local
    const localList = demoLists.find(
      (l) => l.share_code.toUpperCase() === searchCode.toUpperCase()
    );

    if (localList) {
      const words = demoWords[localList.id] || [];
      setCurrentTraining(localList, words);
      toast.success(`Liste "${localList.title}" trouvée !`);
      setSearchCode("");
      setIsSearching(false);
      return;
    }

    // Sinon chercher dans Supabase
    const result = await findListByCode(searchCode);

    if (result) {
      setCurrentTraining(result.list, result.words);
      toast.success(`Liste "${result.list.title}" trouvée !`);
      setSearchCode("");
    } else {
      toast.error("Code introuvable");
    }
    setIsSearching(false);
  };

  const handleStartTraining = (list: typeof demoLists[0]) => {
    const words = demoWords[list.id] || [];
    if (words.length === 0) {
      toast.error("Cette liste est vide");
      return;
    }
    setCurrentTraining(list, words);
  };

  // If in training mode, show the appropriate training interface
  if (currentList && currentWords.length > 0) {
    if (currentList.mode === "fill-blanks") {
      return <FillBlanksMode />;
    }
    if (currentList.mode === "progression") {
      return <ComprehensiveTraining />;
    }
    return <TrainingMode />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-50 pb-safe">
      {/* Header avec profondeur */}
      <header className="sticky top-0 z-10 bg-gradient-to-b from-white to-white/95 backdrop-blur-xl border-b shadow-lg shadow-purple-100/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-xl bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              DictéeMaster
            </h1>
            <p className="text-xs text-gray-400 font-medium">Espace élève</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Streak avec effet 3D */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-400 to-amber-400 rounded-full shadow-lg shadow-orange-200">
              <Flame className="w-4 h-4 text-white animate-streak-flame" />
              <span className="text-sm font-bold text-white">{streak}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats avec effet 3D */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl transform rotate-2 opacity-50" />
            <Card className="relative bg-gradient-to-br from-orange-400 to-orange-500 text-white border-0 rounded-2xl shadow-xl shadow-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Flame className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{streak}</p>
                    <p className="text-xs opacity-80">Jours de suite</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl transform -rotate-2 opacity-50" />
            <Card className="relative bg-gradient-to-br from-yellow-400 to-amber-500 text-white border-0 rounded-2xl shadow-xl shadow-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{badges.length}</p>
                    <p className="text-xs opacity-80">Badges gagnés</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recherche par code */}
        <Card className="rounded-2xl border-2 border-purple-100 shadow-lg shadow-purple-50">
          <CardContent className="p-5">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-500" />
              Rejoindre une liste
            </h2>
            <div className="flex gap-2">
              <Input
                placeholder="Entrer le code..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                className="font-mono uppercase text-lg h-12 rounded-xl border-2 border-gray-100 focus:border-purple-300"
                maxLength={8}
                onKeyDown={(e) => e.key === "Enter" && handleSearchList()}
              />
              <Button
                onClick={handleSearchList}
                disabled={isSearching}
                className="h-12 px-5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl shadow-lg shadow-purple-200"
              >
                {isSearching ? "..." : "Go !"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Listes disponibles */}
        <div className="space-y-4">
          <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-500" />
            Listes disponibles
          </h2>
          <AnimatePresence mode="popLayout">
            {demoLists.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                  <BookOpen className="w-10 h-10 text-gray-300" />
                </div>
                <p className="font-medium text-gray-600">Aucune liste disponible</p>
                <p className="text-sm text-gray-400">Demande le code à ton enseignant !</p>
              </motion.div>
            ) : (
              demoLists.map((list, index) => {
                const words = demoWords[list.id] || [];
                return (
                  <motion.div
                    key={list.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => handleStartTraining(list)}
                      className="w-full p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-lg shadow-gray-100 hover:shadow-xl hover:border-purple-200 transition-all hover:scale-[1.02] text-left flex items-center gap-4"
                    >
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{list.title}</h3>
                        <p className="text-sm text-gray-400">{words.length} mots à apprendre</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-green-200">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Mes badges
            </h2>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge, index) => (
                <motion.div
                  key={badge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-3 bg-gradient-to-br from-yellow-100 to-amber-100 rounded-xl shadow-md"
                >
                  <span className="text-2xl">{badge}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Historique des sessions */}
        <SessionHistory />
      </div>
    </main>
  );
}
