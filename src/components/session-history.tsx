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
  ChevronDown,
  History,
  Trash2,
  RefreshCw,
  BookOpen,
  TrendingUp,
  Award,
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
  const [expandedList, setExpandedList] = useState<string | null>(null);

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
        answers: (s.word_attempts || []).map((a: any) => ({
          word: a.word,
          userAnswer: a.user_answer,
          isCorrect: a.is_correct,
        })),
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

  // Regrouper par liste
  const groupedByList = sessionHistory.reduce((acc, session) => {
    if (!acc[session.listId]) {
      acc[session.listId] = {
        listId: session.listId,
        listTitle: session.listTitle,
        sessions: [],
        bestScore: 0,
        totalAttempts: 0,
      };
    }
    acc[session.listId].sessions.push(session);
    acc[session.listId].totalAttempts++;
    if (session.percentage > acc[session.listId].bestScore) {
      acc[session.listId].bestScore = session.percentage;
    }
    return acc;
  }, {} as Record<string, { listId: string; listTitle: string; sessions: SessionHistoryEntry[]; bestScore: number; totalAttempts: number }>);

  const listGroups = Object.values(groupedByList).sort((a, b) => {
    // Trier par date de dernière session
    const aLatest = new Date(a.sessions[0].date).getTime();
    const bLatest = new Date(b.sessions[0].date).getTime();
    return bLatest - aLatest;
  });

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
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <h2 className="font-bold text-gray-800">Mes résultats</h2>
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

      {/* Grouped by list */}
      <div className="space-y-3">
        {listGroups.map((group) => {
          const isExpanded = expandedList === group.listId;
          const latestSession = group.sessions[0];
          const hasPerfect = group.bestScore === 100;

          return (
            <motion.div
              key={group.listId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden"
            >
              {/* List header - always visible */}
              <button
                onClick={() => setExpandedList(isExpanded ? null : group.listId)}
                className="w-full p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                {/* Best score */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getScoreColor(group.bestScore)} flex flex-col items-center justify-center shadow-md flex-shrink-0`}>
                  <span className="text-white text-lg font-bold">{group.bestScore}%</span>
                  {hasPerfect && <Trophy className="w-3 h-3 text-white/80" />}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800">{group.listTitle}</h3>
                    {hasPerfect && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-full text-xs font-medium">
                        Maîtrisé
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Record: {group.bestScore}%
                    </span>
                    <span>{group.totalAttempts} essai{group.totalAttempts > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Expand icon */}
                <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </button>

              {/* Expanded: show all sessions */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-100 bg-gray-50"
                  >
                    <div className="p-3 space-y-2">
                      {group.sessions.map((session, idx) => {
                        const wrongWords = session.answers.filter(a => !a.isCorrect).map(a => a.word);

                        return (
                          <button
                            key={session.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSession(session);
                            }}
                            className={`w-full p-3 rounded-xl text-left transition-all hover:shadow-md ${
                              session.percentage === 100
                                ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200'
                                : 'bg-white border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${getScoreColor(session.percentage)} bg-gradient-to-br flex items-center justify-center`}>
                                  <span className="text-white text-sm font-bold">{session.percentage}%</span>
                                </div>
                                <div>
                                  <p className="text-sm text-gray-600">{formatDate(session.date)}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <span>{session.correctCount}/{session.totalWords}</span>
                                    <span>•</span>
                                    <span>{formatTime(session.timeSpent)}</span>
                                    {session.chronoTime && (
                                      <>
                                        <span>•</span>
                                        <span className="text-orange-500 flex items-center gap-0.5">
                                          <Zap className="w-3 h-3" />
                                          {formatTime(session.chronoTime)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Wrong words preview */}
                              {wrongWords.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-500">{wrongWords.length} erreur{wrongWords.length > 1 ? 's' : ''}</span>
                                  <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                              {wrongWords.length === 0 && (
                                <div className="flex items-center gap-1">
                                  <Trophy className="w-4 h-4 text-amber-400" />
                                  <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
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
