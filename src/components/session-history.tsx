"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Clock,
  Zap,
  Check,
  X,
  ChevronRight,
  History,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore, SessionHistoryEntry } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";

export default function SessionHistory() {
  const { sessionHistory: localHistory, clearSessionHistory, currentStudentName } = useAppStore();
  const { loadStudentSessions } = useSupabaseSync();
  const [selectedSession, setSelectedSession] = useState<SessionHistoryEntry | null>(null);
  const [supabaseSessions, setSupabaseSessions] = useState<SessionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les sessions depuis Supabase quand le prénom change
  const fetchSessions = async () => {
    if (!currentStudentName.trim()) return;
    setIsLoading(true);
    try {
      const sessions = await loadStudentSessions(currentStudentName);
      const converted: SessionHistoryEntry[] = sessions.map((s: any) => ({
        id: s.id,
        date: s.started_at || s.finished_at,
        listId: s.list_id,
        listTitle: s.word_lists?.title || "Liste inconnue",
        studentName: s.student_name,
        percentage: s.percentage,
        correctCount: s.correct_words,
        totalWords: s.total_words,
        timeSpent: s.time_spent_seconds,
        chronoTime: s.chrono_time_seconds,
        answers: [], // Les détails sont en local uniquement
      }));
      setSupabaseSessions(converted);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger au mount si prénom renseigné
  useEffect(() => {
    if (currentStudentName.trim()) {
      fetchSessions();
    }
  }, [currentStudentName]);

  // Combiner sessions locales et Supabase (dédupliquer)
  const allSessionIds = new Set<string>();
  const sessionHistory: SessionHistoryEntry[] = [];

  // Priorité aux sessions locales (ont les détails des réponses)
  [...localHistory, ...supabaseSessions].forEach(session => {
    if (!allSessionIds.has(session.id)) {
      allSessionIds.add(session.id);
      sessionHistory.push(session);
    }
  });

  // Trier par date décroissante
  sessionHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Aujourd'hui à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (days === 1) {
      return `Hier à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (days < 7) {
      return `Il y a ${days} jours`;
    } else {
      return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (percentage: number) => {
    if (percentage === 100) return "from-yellow-400 to-amber-500";
    if (percentage >= 80) return "from-green-400 to-emerald-500";
    if (percentage >= 60) return "from-blue-400 to-cyan-500";
    return "from-orange-400 to-red-400";
  };

  const getScoreBg = (percentage: number) => {
    if (percentage === 100) return "bg-amber-50 border-amber-200";
    if (percentage >= 80) return "bg-green-50 border-green-200";
    if (percentage >= 60) return "bg-blue-50 border-blue-200";
    return "bg-orange-50 border-orange-200";
  };

  if (sessionHistory.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
          <History className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-600 mb-2">Pas encore d'historique</h3>
        <p className="text-gray-400 text-sm">
          Tes résultats apparaîtront ici après chaque entraînement
        </p>
        {currentStudentName && (
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchSessions}
            className="mt-4 text-purple-500"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Charger mes résultats
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
            <History className="w-4 h-4 text-purple-600" />
          </div>
          <h2 className="font-bold text-gray-800">Mes résultats</h2>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500">
            {sessionHistory.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {currentStudentName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSessions}
              disabled={isLoading}
              className="text-gray-400 hover:text-purple-500"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
          {sessionHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm("Effacer l'historique local ?")) {
                  clearSessionHistory();
                }
              }}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Session cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {sessionHistory.map((session, index) => (
          <motion.button
            key={session.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedSession(session)}
            className={`relative p-4 rounded-2xl border-2 text-left transition-all hover:scale-105 hover:shadow-lg ${getScoreBg(session.percentage)}`}
          >
            {/* Score badge */}
            <div className={`absolute -top-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br ${getScoreColor(session.percentage)} flex items-center justify-center shadow-lg`}>
              <span className="text-white text-xs font-bold">{session.percentage}%</span>
            </div>

            {/* Content */}
            <p className="font-semibold text-gray-800 text-sm mb-1 pr-8 line-clamp-1">
              {session.listTitle}
            </p>
            <p className="text-xs text-gray-400 mb-2">
              {formatDate(session.date)}
            </p>

            {/* Stats */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{session.correctCount}/{session.totalWords}</span>
              {session.chronoTime && (
                <span className="flex items-center gap-0.5">
                  <Zap className="w-3 h-3 text-orange-400" />
                  {formatTime(session.chronoTime)}
                </span>
              )}
            </div>

            {/* Perfect badge */}
            {session.percentage === 100 && (
              <div className="absolute bottom-2 right-2">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selectedSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedSession(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className={`p-6 bg-gradient-to-br ${getScoreColor(selectedSession.percentage)} text-white`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-1">{selectedSession.listTitle}</h3>
                    <p className="text-white/80 text-sm">{formatDate(selectedSession.date)}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-bold">{selectedSession.percentage}%</div>
                    <div className="text-white/80 text-sm">
                      {selectedSession.correctCount}/{selectedSession.totalWords} mots
                    </div>
                  </div>
                </div>

                {/* Time stats */}
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {formatTime(selectedSession.timeSpent)}
                    </span>
                  </div>
                  {selectedSession.chronoTime && (
                    <div className="flex items-center gap-2 bg-white/20 rounded-xl px-3 py-2">
                      <Zap className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {formatTime(selectedSession.chronoTime)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Word list */}
              <div className="p-4 max-h-[40vh] overflow-y-auto">
                <h4 className="font-semibold text-gray-600 mb-3 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" />
                  Détail des réponses
                </h4>
                <div className="space-y-2">
                  {selectedSession.answers.map((answer, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl flex items-center justify-between ${
                        answer.isCorrect ? "bg-green-50" : "bg-red-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          answer.isCorrect ? "bg-green-100" : "bg-red-100"
                        }`}>
                          {answer.isCorrect ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">{answer.word}</p>
                          {!answer.isCorrect && answer.userAnswer && (
                            <p className="text-sm text-red-400 line-through">
                              {answer.userAnswer}
                            </p>
                          )}
                        </div>
                      </div>
                      {answer.isCorrect && (
                        <span className="text-green-500 text-sm font-medium">Correct</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Close button */}
              <div className="p-4 border-t">
                <Button
                  onClick={() => setSelectedSession(null)}
                  className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl font-bold"
                >
                  Fermer
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
