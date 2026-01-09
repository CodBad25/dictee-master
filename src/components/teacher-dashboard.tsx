"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Users,
  Target,
  Clock,
  TrendingUp,
  Trophy,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Download,
  RefreshCw,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppStore, SessionHistoryEntry } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";

export default function TeacherDashboard() {
  const { sessionHistory: localHistory } = useAppStore();
  const { loadAllSessions } = useSupabaseSync();
  const [isExpanded, setIsExpanded] = useState(true); // Toujours ouvert par défaut
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "week" | "month">("all");
  const [supabaseSessions, setSupabaseSessions] = useState<SessionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionHistoryEntry | null>(null);

  // Charger les sessions Supabase
  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const sessions = await loadAllSessions();
      // Convertir les sessions Supabase en format SessionHistoryEntry
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

  // Charger automatiquement au mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Combiner sessions locales et Supabase (dédupliquer par id)
  const allSessionIds = new Set<string>();
  const sessionHistory: SessionHistoryEntry[] = [];

  // Priorité aux sessions Supabase (plus complètes)
  [...supabaseSessions, ...localHistory].forEach(session => {
    if (!allSessionIds.has(session.id)) {
      allSessionIds.add(session.id);
      sessionHistory.push(session);
    }
  });

  // Trier par date décroissante
  sessionHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter sessions by period
  const filteredSessions = sessionHistory.filter(session => {
    if (selectedPeriod === "all") return true;
    const sessionDate = new Date(session.date);
    const now = new Date();
    if (selectedPeriod === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return sessionDate >= weekAgo;
    }
    if (selectedPeriod === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return sessionDate >= monthAgo;
    }
    return true;
  });

  // Calculate stats
  const totalSessions = filteredSessions.length;
  const avgScore = totalSessions > 0
    ? Math.round(filteredSessions.reduce((sum, s) => sum + s.percentage, 0) / totalSessions)
    : 0;
  const perfectSessions = filteredSessions.filter(s => s.percentage === 100).length;
  const uniqueStudents = new Set(filteredSessions.map(s => s.studentName).filter(Boolean)).size;

  // Calculate average time per session
  const avgTime = totalSessions > 0
    ? Math.round(filteredSessions.reduce((sum, s) => sum + s.timeSpent, 0) / totalSessions)
    : 0;

  // Find most missed words across all sessions
  const wordErrors: Record<string, { count: number; listTitle: string }> = {};
  filteredSessions.forEach(session => {
    session.answers.forEach(answer => {
      if (!answer.isCorrect) {
        if (!wordErrors[answer.word]) {
          wordErrors[answer.word] = { count: 0, listTitle: session.listTitle };
        }
        wordErrors[answer.word].count++;
      }
    });
  });
  const mostMissedWords = Object.entries(wordErrors)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  // Students leaderboard
  const studentScores: Record<string, { sessions: number; avgScore: number; perfectCount: number }> = {};
  filteredSessions.forEach(session => {
    const name = session.studentName || "Anonyme";
    if (!studentScores[name]) {
      studentScores[name] = { sessions: 0, avgScore: 0, perfectCount: 0 };
    }
    studentScores[name].sessions++;
    studentScores[name].avgScore = (studentScores[name].avgScore * (studentScores[name].sessions - 1) + session.percentage) / studentScores[name].sessions;
    if (session.percentage === 100) studentScores[name].perfectCount++;
  });
  const leaderboard = Object.entries(studentScores)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10);

  // Recent sessions
  const recentSessions = filteredSessions.slice(0, 5);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Aujourd'hui ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (days === 1) {
      return `Hier ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (days < 7) {
      return `Il y a ${days} jours`;
    } else {
      return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    }
  };

  const formatDateFull = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleExportCSV = () => {
    if (filteredSessions.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    // Create CSV content
    const headers = ["Date", "Élève", "Liste", "Score (%)", "Mots corrects", "Total mots", "Temps (s)", "Mots ratés"];
    const rows = filteredSessions.map(session => {
      const missedWords = session.answers
        .filter(a => !a.isCorrect)
        .map(a => a.word)
        .join("; ");
      return [
        formatDateFull(session.date),
        session.studentName || "Anonyme",
        session.listTitle,
        session.percentage.toString(),
        session.correctCount.toString(),
        session.totalWords.toString(),
        session.timeSpent.toString(),
        missedWords || "-",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Add BOM for Excel UTF-8 compatibility
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dictee-master-resultats-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${filteredSessions.length} sessions exportées`);
  };

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl shadow-xl shadow-purple-200 hover:shadow-2xl transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            {isLoading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <BarChart3 className="w-5 h-5" />
            )}
          </div>
          <div className="text-left">
            <h2 className="font-bold">Statistiques élèves</h2>
            <p className="text-xs text-white/80">
              {isLoading ? "Chargement..." : `${totalSessions} sessions`}
            </p>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Period filter + Export */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {[
                  { value: "all", label: "Tout" },
                  { value: "week", label: "7 jours" },
                  { value: "month", label: "30 jours" },
                ].map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value as typeof selectedPeriod)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      selectedPeriod === period.value
                        ? "bg-purple-500 text-white shadow-lg shadow-purple-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={fetchSessions}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  className="gap-2 rounded-xl border-2 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl border-2 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </Button>
              </div>
            </div>

            {/* Stats grid - compact */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 text-center">
                <p className="text-2xl font-bold text-green-600">{avgScore}%</p>
                <p className="text-xs text-green-600/70">Score moy.</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-100 text-center">
                <p className="text-2xl font-bold text-amber-600">{perfectSessions}</p>
                <p className="text-xs text-amber-600/70">Parfaits</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center">
                <p className="text-2xl font-bold text-blue-600">{uniqueStudents}</p>
                <p className="text-xs text-blue-600/70">Élèves</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl border border-purple-100 text-center">
                <p className="text-2xl font-bold text-purple-600">{formatTime(avgTime)}</p>
                <p className="text-xs text-purple-600/70">Temps moy.</p>
              </div>
            </div>

            {/* Combined: Stats par liste + Mots ratés */}
            {(() => {
              // Regrouper les sessions par liste
              const listStats: Record<string, {
                listId: string;
                listTitle: string;
                sessions: number;
                uniqueStudents: Set<string>;
                avgScore: number;
                perfectCount: number;
                totalScore: number;
                missedWords: Record<string, number>;
              }> = {};

              filteredSessions.forEach(session => {
                if (!listStats[session.listId]) {
                  listStats[session.listId] = {
                    listId: session.listId,
                    listTitle: session.listTitle,
                    sessions: 0,
                    uniqueStudents: new Set(),
                    avgScore: 0,
                    perfectCount: 0,
                    totalScore: 0,
                    missedWords: {},
                  };
                }
                const stat = listStats[session.listId];
                stat.sessions++;
                stat.totalScore += session.percentage;
                stat.avgScore = Math.round(stat.totalScore / stat.sessions);
                if (session.studentName) stat.uniqueStudents.add(session.studentName);
                if (session.percentage === 100) stat.perfectCount++;

                session.answers.forEach(a => {
                  if (!a.isCorrect) {
                    stat.missedWords[a.word] = (stat.missedWords[a.word] || 0) + 1;
                  }
                });
              });

              const listStatsArray = Object.values(listStats)
                .sort((a, b) => b.sessions - a.sessions);

              if (listStatsArray.length === 0) return null;

              return (
                <div className="space-y-2">
                  {listStatsArray.map(stat => {
                    const topMissed = Object.entries(stat.missedWords)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4);

                    return (
                      <div
                        key={stat.listId}
                        className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-500" />
                            <h4 className="font-bold text-gray-800">{stat.listTitle}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {stat.uniqueStudents.size} élèves • {stat.sessions} sessions
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              stat.avgScore >= 80 ? 'bg-green-100 text-green-700' :
                              stat.avgScore >= 60 ? 'bg-blue-100 text-blue-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {stat.avgScore}%
                            </span>
                            {stat.perfectCount > 0 && (
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <Trophy className="w-3 h-3" />
                                <span className="text-xs font-bold">{stat.perfectCount}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {topMissed.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                            {topMissed.map(([word, count]) => (
                              <span
                                key={word}
                                className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-xs"
                              >
                                {word} ({count})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Classement + Sessions récentes - side by side on larger screens */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Leaderboard */}
              {leaderboard.length > 0 && leaderboard[0].name !== "Anonyme" && (
                <div className="p-3 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-amber-800 text-sm">Top élèves</h3>
                  </div>
                  <div className="space-y-1.5">
                    {leaderboard.filter(s => s.name !== "Anonyme").slice(0, 3).map((student, index) => (
                      <div
                        key={student.name}
                        className="flex items-center gap-2 p-2 bg-white/70 rounded-lg"
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                          index === 0 ? "bg-amber-400 text-white" :
                          index === 1 ? "bg-gray-300 text-gray-700" :
                          "bg-amber-600 text-white"
                        }`}>
                          {index + 1}
                        </div>
                        <span className="flex-1 font-medium text-gray-800 text-sm truncate">{student.name}</span>
                        <span className="font-bold text-green-600 text-sm">{Math.round(student.avgScore)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent sessions */}
              {recentSessions.length > 0 && (
                <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-purple-500" />
                    <h3 className="font-bold text-gray-700 text-sm">Dernières sessions</h3>
                  </div>
                  <div className="space-y-1.5">
                    {recentSessions.slice(0, 4).map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="w-full flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-purple-50 transition-all text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-800 text-sm truncate">
                            {session.studentName || "Anonyme"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {session.listTitle} • {formatDate(session.date)}
                          </p>
                        </div>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                          session.percentage === 100 ? "bg-amber-100 text-amber-700" :
                          session.percentage >= 80 ? "bg-green-100 text-green-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {session.percentage}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* All sessions - compact list */}
            {filteredSessions.length > 4 && (
              <details className="group">
                <summary className="flex items-center justify-between p-3 bg-gray-100 rounded-xl cursor-pointer hover:bg-gray-200 transition-colors">
                  <span className="font-medium text-gray-700 text-sm">
                    Voir toutes les sessions ({filteredSessions.length})
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="mt-2 p-2 bg-white rounded-xl border border-gray-200 max-h-48 overflow-y-auto space-y-1">
                  {filteredSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-all text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-800 truncate">
                          {session.studentName || "Anonyme"}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {session.listTitle} • {formatDate(session.date)}
                        </span>
                      </div>
                      <span className={`ml-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                        session.percentage >= 80 ? "text-green-600" : "text-orange-600"
                      }`}>
                        {session.percentage}%
                      </span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session detail modal */}
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
              className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className={`p-6 bg-gradient-to-br ${
                selectedSession.percentage === 100 ? "from-yellow-400 to-amber-500" :
                selectedSession.percentage >= 80 ? "from-green-400 to-emerald-500" :
                selectedSession.percentage >= 60 ? "from-blue-400 to-cyan-500" :
                "from-orange-400 to-red-400"
              } text-white`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-xl mb-1">
                      {selectedSession.studentName || "Anonyme"}
                    </h3>
                    <p className="text-white/80 text-sm">{selectedSession.listTitle}</p>
                    <p className="text-white/60 text-xs mt-1">{formatDateFull(selectedSession.date)}</p>
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
                    <span className="text-sm font-medium">{formatTime(selectedSession.timeSpent)}</span>
                  </div>
                </div>
              </div>

              {/* Word list with errors highlighted */}
              <div className="p-4 max-h-[45vh] overflow-y-auto">
                <h4 className="font-semibold text-gray-600 mb-3 flex items-center gap-2 text-sm">
                  Détail des réponses
                </h4>

                {/* Errors first */}
                {selectedSession.answers.filter(a => !a.isCorrect).length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-bold text-red-500 mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Mots ratés ({selectedSession.answers.filter(a => !a.isCorrect).length})
                    </p>
                    <div className="space-y-2">
                      {selectedSession.answers.filter(a => !a.isCorrect).map((answer, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-red-50 border border-red-100">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-gray-800">{answer.word}</p>
                              {answer.userAnswer && (
                                <p className="text-sm text-red-500">
                                  Réponse : <span className="line-through">{answer.userAnswer}</span>
                                </p>
                              )}
                            </div>
                            <span className="text-red-500 text-xl">✗</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Correct answers */}
                {selectedSession.answers.filter(a => a.isCorrect).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-green-500 mb-2">
                      Mots réussis ({selectedSession.answers.filter(a => a.isCorrect).length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSession.answers.filter(a => a.isCorrect).map((answer, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm border border-green-100"
                        >
                          {answer.word} ✓
                        </span>
                      ))}
                    </div>
                  </div>
                )}
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
