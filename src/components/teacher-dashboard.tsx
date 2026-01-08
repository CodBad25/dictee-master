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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAppStore, SessionHistoryEntry } from "@/lib/store";
import { useSupabaseSync } from "@/hooks/useSupabaseSync";

export default function TeacherDashboard() {
  const { sessionHistory: localHistory } = useAppStore();
  const { loadAllSessions } = useSupabaseSync();
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"all" | "week" | "month">("all");
  const [supabaseSessions, setSupabaseSessions] = useState<SessionHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Charger les sessions Supabase
  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const sessions = await loadAllSessions();
      // Convertir les sessions Supabase en format SessionHistoryEntry
      const converted: SessionHistoryEntry[] = sessions.map((s: any) => ({
        id: s.id,
        date: s.started_at || s.finished_at,
        listId: s.word_list_id,
        listTitle: s.word_lists?.title || "Liste inconnue",
        studentName: s.student_name,
        percentage: s.percentage,
        correctCount: s.correct_words,
        totalWords: s.total_words,
        timeSpent: s.time_spent_seconds,
        chronoTime: s.chrono_time_seconds,
        answers: [], // Les answers ne sont pas chargées ici pour la perf
      }));
      setSupabaseSessions(converted);
    } catch (error) {
      console.error("Error loading sessions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Charger au premier expand
  useEffect(() => {
    if (isExpanded && supabaseSessions.length === 0) {
      fetchSessions();
    }
  }, [isExpanded]);

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

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-gray-500">Score moyen</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{avgScore}%</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-gray-500">100% parfaits</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{perfectSessions}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-gray-500">Élèves actifs</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{uniqueStudents}</p>
              </div>
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-gray-500">Temps moyen</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{formatTime(avgTime)}</p>
              </div>
            </div>

            {/* Most missed words */}
            {mostMissedWords.length > 0 && (
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-red-700 text-sm">Mots les plus ratés</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mostMissedWords.map(([word, data]) => (
                    <span
                      key={word}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                    >
                      {word} <span className="text-red-400">({data.count}x)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && leaderboard[0].name !== "Anonyme" && (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-amber-800 text-sm">Classement des élèves</h3>
                </div>
                <div className="space-y-2">
                  {leaderboard.filter(s => s.name !== "Anonyme").slice(0, 5).map((student, index) => (
                    <div
                      key={student.name}
                      className="flex items-center gap-3 p-2 bg-white rounded-xl"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0 ? "bg-amber-400 text-white" :
                        index === 1 ? "bg-gray-300 text-gray-700" :
                        index === 2 ? "bg-amber-600 text-white" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                        <p className="text-xs text-gray-400">
                          {student.sessions} sessions • {student.perfectCount} parfaits
                        </p>
                      </div>
                      <span className="font-bold text-green-600">{Math.round(student.avgScore)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent sessions */}
            {recentSessions.length > 0 && (
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  <h3 className="font-semibold text-gray-700 text-sm">Sessions récentes</h3>
                </div>
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"
                    >
                      <div>
                        <p className="font-medium text-gray-800 text-sm">
                          {session.studentName || "Anonyme"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {session.listTitle} • {formatDate(session.date)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded-lg text-sm font-bold ${
                        session.percentage === 100 ? "bg-amber-100 text-amber-700" :
                        session.percentage >= 80 ? "bg-green-100 text-green-700" :
                        session.percentage >= 60 ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {session.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
