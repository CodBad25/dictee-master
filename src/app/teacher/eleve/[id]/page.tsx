"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  Printer,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store";
import {
  computeStudentStats,
  groupResultsByDictee,
  topErrors,
  engagementMetrics,
  type DicteeSummary,
  type WordAttempt,
  type StudentStats,
  type TopError,
} from "@/lib/student-stats";
import type { Dictee, DicteeResult } from "@/lib/dictee-service";

const DEEPSEEK_KEY_STORAGE = "dictee-master-deepseek-key";

interface StudentAnalysisJson {
  top_errors: Array<{
    word: string;
    wrong_attempts: string[];
    count: number;
    pattern: string;
  }>;
  categories: Array<{ name: string; percentage: number; examples: string[] }>;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  summary: string;
}

// Couleur de bord gauche d'une card dictée selon bestScore
function scoreBorderColor(pct: number, hasAttempt: boolean): string {
  if (!hasAttempt) return "border-l-gray-300";
  if (pct >= 90) return "border-l-emerald-500";
  if (pct >= 70) return "border-l-lime-500";
  if (pct >= 50) return "border-l-amber-500";
  return "border-l-red-500";
}

function scoreEmoji(pct: number): string {
  if (pct >= 90) return "🟢";
  if (pct >= 70) return "🟡";
  if (pct >= 50) return "🟠";
  return "🔴";
}

// Badge médaille (or/argent/bronze) à partir d'un score
function medalForScore(pct: number): {
  emoji: string;
  bg: string;
  text: string;
  border: string;
} | null {
  if (pct >= 90)
    return {
      emoji: "🥇",
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      border: "border-yellow-300",
    };
  if (pct >= 75)
    return {
      emoji: "🥈",
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-300",
    };
  if (pct >= 60)
    return {
      emoji: "🥉",
      bg: "bg-orange-50",
      text: "text-orange-800",
      border: "border-orange-300",
    };
  return null;
}

export default function StudentFullPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const studentId = decodeURIComponent(params?.id ?? "");
  const supabase = createClient();

  const currentUser = useAppStore((s) => s.user);
  const teacherName = formatTeacherName(currentUser?.role === "teacher" ? currentUser.name : null);
  const [loading, setLoading] = useState(true);
  const [studentName, setStudentName] = useState("Élève");
  const [classId, setClassId] = useState<string>("");
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [studentResults, setStudentResults] = useState<DicteeResult[]>([]);
  const [classResults, setClassResults] = useState<DicteeResult[]>([]);
  const [attempts, setAttempts] = useState<WordAttempt[]>([]);

  const [analysis, setAnalysis] = useState<StudentAnalysisJson | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    costUsd: number;
    tokens: number;
    model: string;
    updatedAt: string;
    fromCache: boolean;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // 1) tous les résultats de l'élève (toutes classes confondues si plusieurs)
      const { data: sResults } = await supabase
        .from("dm_results")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      const sr = (sResults || []) as DicteeResult[];
      setStudentResults(sr);
      if (sr.length > 0) {
        setStudentName(sr[0].student_name || "Élève");
        setClassId(sr[0].class_id);
      }

      // 2) résultats de la classe pour le classement
      const cid = sr[0]?.class_id;
      if (cid) {
        const { data: cResults } = await supabase
          .from("dm_results")
          .select("*")
          .eq("class_id", cid);
        setClassResults((cResults || []) as DicteeResult[]);
      }

      // 3) dictées — corpus du niveau de la classe de l'élève
      let classLevel = "6e";
      if (cid) {
        const { data: dmClass } = await supabase
          .from("dm_classes")
          .select("level")
          .eq("id", cid)
          .maybeSingle();
        classLevel = (dmClass?.level as string) || "6e";
      }
      const { data: dicteesData } = await supabase
        .from("dictees")
        .select("id, title, position, share_code, fill_blanks_text")
        .eq("level", classLevel)
        .order("position");
      setDictees((dicteesData || []) as Dictee[]);

      // 4) tentatives
      if (sr.length > 0) {
        const resultIds = sr.map((r) => r.id);
        const { data: attData } = await supabase
          .from("dm_word_attempts")
          .select("result_id, word, user_answer, is_correct")
          .in("result_id", resultIds);
        setAttempts((attData || []) as WordAttempt[]);
      }

      // 5) analyse en cache
      try {
        const r = await fetch(`/api/student-analysis/${encodeURIComponent(studentId)}`);
        if (r.ok) {
          const j = await r.json();
          if (j.analysis) {
            setAnalysis(j.analysis as StudentAnalysisJson);
            setAnalysisMeta({
              costUsd: j.costUsd ?? 0,
              tokens: j.tokens ?? 0,
              model: j.model ?? "",
              updatedAt: j.updatedAt ?? new Date().toISOString(),
              fromCache: !!j.fromCache,
            });
          }
        }
      } catch {
        // silencieux
      }
    } catch (err) {
      console.error("[StudentFullPage] loadAll :", err);
      toast.error("Erreur lors du chargement de la fiche");
    } finally {
      setLoading(false);
    }
  }, [supabase, studentId]);

  useEffect(() => {
    if (studentId) loadAll();
  }, [studentId, loadAll]);

  const runAnalysis = async () => {
    if (analyzing) return;
    const teacherPassword = process.env.NEXT_PUBLIC_TEACHER_PASSWORD || "";
    setAnalyzing(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-teacher-password": teacherPassword,
      };
      const personalKey =
        typeof window !== "undefined"
          ? localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? ""
          : "";
      if (personalKey.trim()) headers["x-deepseek-key"] = personalKey.trim();

      const res = await fetch(
        `/api/student-analysis/${encodeURIComponent(studentId)}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ studentName, classId }),
        },
      );
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error || "Échec de l'analyse IA");
        return;
      }
      setAnalysis(j.analysis as StudentAnalysisJson);
      setAnalysisMeta({
        costUsd: j.costUsd ?? 0,
        tokens: j.tokens ?? 0,
        model: j.model ?? "",
        updatedAt: j.updatedAt ?? new Date().toISOString(),
        fromCache: false,
      });
      toast.success("Analyse IA terminée");
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = async () => {
    if (resetting) return;
    const ok = window.confirm(
      `Réinitialiser TOUS les résultats de ${studentName} ? Cette action supprime définitivement toutes ses sessions. Le verrouillage des dictées reste inchangé.`,
    );
    if (!ok) return;

    const teacherPassword = process.env.NEXT_PUBLIC_TEACHER_PASSWORD || "";
    setResetting(true);
    try {
      const res = await fetch("/api/student-results/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-teacher-password": teacherPassword,
        },
        body: JSON.stringify({ studentId }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j?.error || "Échec de la réinitialisation");
        return;
      }
      toast.success(
        `${j.deletedCount ?? 0} session(s) supprimée(s)`,
      );
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("Erreur réseau pendant la réinitialisation");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </main>
    );
  }

  if (studentResults.length === 0) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center bg-gray-50 p-6">
        <p className="text-gray-700 mb-4">
          Aucun résultat trouvé pour cet élève.
        </p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
        >
          Retour
        </button>
      </main>
    );
  }

  const stats = computeStudentStats(studentResults, classResults);
  const dicteesSummary = groupResultsByDictee(studentResults, dictees);
  const errors = topErrors(attempts, 20);
  const engagement = engagementMetrics(studentResults);

  // Top 3 erreurs (sidebar)
  const top3Errors = errors.slice(0, 3);

  // Activité récente (20 dernières sessions)
  const recentActivity = [...studentResults].slice(0, 20);

  // Sparkline data
  const sparkValues = stats.trend4weeks.map((w) => w.avgPct);

  // Badges = top dictées (jusqu'à 8)
  const badgeDictees = [...dicteesSummary]
    .filter((s) => s.bestPct >= 60)
    .sort((a, b) => b.bestPct - a.bestPct)
    .slice(0, 8);

  // Carte dictées détaillées : on affiche toutes les dictées tentées
  const dicteeCards = dicteesSummary;

  return (
    <main className="min-h-dvh bg-gray-50 print:bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-white/20"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">{studentName}</h1>
              <p className="text-xs text-purple-100">
                Fiche élève complète · DictéeMaster
              </p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimer
          </button>
        </div>
      </div>

      {/* Vue BILAN COMPACT pour l'impression (1 page A4) */}
      <PrintBilan
        studentName={studentName}
        teacherName={teacherName}
        stats={stats}
        dicteeCards={dicteesSummary}
        topErrorsList={errors}
        analysis={analysis}
        totalDictees={dictees.length}
      />

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 print:p-0 print:grid-cols-1">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-6 self-start space-y-4 print:hidden">
          {/* Synthèse + mini-graph */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-3">
              Synthèse
            </h2>
            <SideStat label="Score moyen" value={`${Math.round(stats.averagePct)}%`} />
            <SideStat label="Médiane" value={`${Math.round(stats.medianPct)}%`} />
            <SideStat
              label="Dictées tentées"
              value={`${stats.dicteesTried}/${dictees.length}`}
            />
            <SideStat label="Sessions" value={`${stats.totalAttempts}`} />
            <SideStat
              label="Sessions/sem."
              value={engagement.sessionsPerWeek.toFixed(1)}
            />
            <SideStat
              label="Régularité"
              value={`${Math.round(engagement.regularityScore)}%`}
            />
            {stats.rankInClass > 0 && (
              <SideStat
                label="Rang classe"
                value={`${stats.rankInClass} / ${stats.classSize}`}
              />
            )}
            <div className="mt-3">
              <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">
                Évolution 4 sem.
              </p>
              <SidebarSparkline values={sparkValues} />
            </div>
          </div>

          {/* Top 3 erreurs */}
          {top3Errors.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-red-700 mb-2">
                Top 3 erreurs
              </h2>
              <div className="space-y-1.5">
                {top3Errors.map((e) => (
                  <div
                    key={e.word}
                    className="px-2.5 py-1.5 rounded-md bg-red-50 border border-red-200 flex items-baseline justify-between"
                  >
                    <span className="text-xs font-bold text-red-900 truncate">
                      {e.word}
                    </span>
                    <span className="text-[11px] text-red-700 ml-2">
                      ×{e.totalCount}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="#erreurs"
                className="block mt-2 text-[11px] text-red-700 hover:underline"
              >
                Voir toutes les erreurs →
              </a>
            </div>
          )}

          {/* Badges */}
          {badgeDictees.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">
                Badges obtenus
              </h2>
              <div className="grid grid-cols-2 gap-1.5">
                {badgeDictees.map((s) => {
                  const medal = medalForScore(s.bestPct);
                  if (!medal) return null;
                  return (
                    <div
                      key={s.dictee.id}
                      title={`${s.dictee.title} — ${Math.round(s.bestPct)}%`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border ${medal.bg} ${medal.border} ${medal.text}`}
                    >
                      <span>{medal.emoji}</span>
                      <span className="text-[10px] font-semibold truncate">
                        D{s.dictee.position}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions rapides */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-600 mb-2">
              Actions rapides
            </h2>
            <div className="space-y-1.5">
              <button
                onClick={() => window.print()}
                className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimer la fiche
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-semibold text-red-700 disabled:opacity-50"
              >
                {resetting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                Réinitialiser cet élève
              </button>
              <a
                href="https://hub.beltools.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-50 hover:bg-purple-100 border border-purple-200 text-xs font-semibold text-purple-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Voir profil Hub
              </a>
            </div>
          </div>

          {/* Navigation */}
          <nav className="bg-white rounded-xl border border-gray-200 p-4 text-xs">
            <p className="font-bold uppercase text-gray-600 mb-2">Navigation</p>
            <ul className="space-y-1.5">
              <li>
                <a href="#evolution" className="text-purple-700 hover:underline">
                  📈 Évolution
                </a>
              </li>
              <li>
                <a href="#dictees" className="text-purple-700 hover:underline">
                  📝 Dictées détaillées
                </a>
              </li>
              <li>
                <a href="#erreurs" className="text-purple-700 hover:underline">
                  ⚠️ Erreurs
                </a>
              </li>
              <li>
                <a href="#analyse" className="text-purple-700 hover:underline">
                  ✨ Analyse IA
                </a>
              </li>
              <li>
                <a href="#activite" className="text-purple-700 hover:underline">
                  🕒 Activité récente
                </a>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <div className="space-y-6">
          {/* Évolution pleine largeur */}
          <section
            id="evolution"
            className="bg-white rounded-xl border border-gray-200 p-6 print:border-0 print:p-0"
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              📈 Évolution (4 dernières semaines)
            </h2>
            <Sparkline values={sparkValues} />
            <div className="grid grid-cols-4 gap-2 mt-3">
              {stats.trend4weeks.map((w) => (
                <div key={w.week} className="text-center">
                  <p className="text-[10px] text-gray-500">
                    sem. du {w.week.slice(5)}
                  </p>
                  <p className="font-bold text-sm text-gray-800">
                    {w.avgPct > 0 ? `${Math.round(w.avgPct)}%` : "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Grille 2 colonnes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonne A : Dictées + Activité */}
            <div className="space-y-6">
              <section
                id="dictees"
                className="bg-white rounded-xl border border-gray-200 p-6 print:border-0 print:p-0"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  📝 Dictées détaillées
                </h2>
                {dicteeCards.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucune dictée tentée.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dicteeCards.map((s) => (
                      <DicteeCard key={s.dictee.id} s={s} />
                    ))}
                  </div>
                )}
              </section>

              <section
                id="activite"
                className="bg-white rounded-xl border border-gray-200 p-6 print:border-0 print:p-0"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  🕒 Activité récente
                </h2>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucune activité.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left p-2 font-semibold">Date</th>
                          <th className="text-left p-2 font-semibold">Dictée</th>
                          <th className="text-left p-2 font-semibold">Mode</th>
                          <th className="text-center p-2 font-semibold">Score</th>
                          <th className="text-center p-2 font-semibold">Durée</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((r) => {
                          const d = dictees.find((x) => x.id === r.dictee_id);
                          return (
                            <tr key={r.id} className="border-t">
                              <td className="p-2 text-gray-500 whitespace-nowrap">
                                {new Date(r.created_at).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </td>
                              <td className="p-2">
                                {d ? `D${d.position}` : r.dictee_id.slice(0, 6)}
                              </td>
                              <td className="p-2 text-gray-700">
                                {r.activity_mode}
                              </td>
                              <td className="p-2 text-center font-bold">
                                {Math.round(r.percentage)}%
                              </td>
                              <td className="p-2 text-center text-gray-500">
                                {r.time_spent
                                  ? `${Math.round(r.time_spent / 60)} min`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* Colonne B : Erreurs + Analyse IA */}
            <div className="space-y-6">
              <section
                id="erreurs"
                className="bg-white rounded-xl border border-gray-200 p-6 print:border-0 print:p-0"
              >
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  ⚠️ Erreurs
                </h2>
                {errors.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucune erreur enregistrée.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {errors.map((e) => (
                      <div
                        key={e.word}
                        className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-red-900">
                            {e.word}
                          </span>
                          <span className="text-red-700 text-xs">
                            ×{e.totalCount}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-gray-700">
                          {e.wrongAttempts
                            .map(
                              (w) => `« ${w.user_answer} » (×${w.count})`,
                            )
                            .join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section
                id="analyse"
                className="bg-white rounded-xl border border-gray-200 p-6 print:border-0 print:p-0"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">
                    ✨ Analyse IA
                  </h2>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing || errors.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold disabled:opacity-50 print:hidden"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" /> Analyse…
                      </>
                    ) : analysis ? (
                      <>
                        <RefreshCw className="w-3 h-3" /> Relancer
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" /> Analyser
                      </>
                    )}
                  </button>
                </div>

                {analysis ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-gray-800">
                      {analysis.summary}
                    </div>

                    {analysis.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1">
                          Points forts
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 text-gray-700">
                          {analysis.strengths.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.weaknesses.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1">
                          Points faibles
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 text-gray-700">
                          {analysis.weaknesses.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysis.categories.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Catégories
                        </p>
                        <div className="space-y-1.5">
                          {analysis.categories.map((c, i) => (
                            <div key={i} className="text-xs">
                              <div className="flex items-baseline justify-between">
                                <span className="font-medium text-gray-800">
                                  {c.name}
                                </span>
                                <span className="text-gray-500">
                                  {c.percentage}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-400 to-purple-500"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, c.percentage))}%`,
                                  }}
                                />
                              </div>
                              {c.examples.length > 0 && (
                                <p className="text-[10px] text-gray-500 mt-0.5 italic">
                                  ex. {c.examples.join(" · ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {analysis.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-purple-700 mb-1">
                          Suggestions pédagogiques
                        </p>
                        <ul className="list-disc list-inside text-xs space-y-0.5 text-gray-700">
                          {analysis.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {analysisMeta && (
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap print:hidden">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100">
                          🤖 {analysisMeta.model || "DeepSeek"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100">
                          💰 ${analysisMeta.costUsd.toFixed(4)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100">
                          {analysisMeta.tokens} tokens
                        </span>
                        {analysisMeta.fromCache && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            en cache (24h)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">
                    {errors.length === 0
                      ? "Pas encore assez de données pour une analyse IA."
                      : "Lance l'analyse pour obtenir un diagnostic pédagogique automatique."}
                  </p>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        /* Vue bilan : cachée à l'écran, visible uniquement à l'impression */
        .bilan-print {
          display: none;
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          html, body {
            background: white !important;
          }
          /* Cache TOUT sauf le bilan */
          body > * {
            display: none !important;
          }
          main {
            display: block !important;
          }
          main > *:not(.bilan-print) {
            display: none !important;
          }
          /* Affiche le bilan */
          .bilan-print {
            display: block !important;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
            font-size: 9pt;
            color: #1f2937;
            line-height: 1.35;
          }
          /* Force les couleurs */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }

        /* ---- Styles du bilan (utilisés en print uniquement) ---- */
        .bilan-print {
          padding: 0;
          background: white;
        }
        .bilan-header {
          background: linear-gradient(90deg, #7c3aed, #6d28d9);
          color: white;
          padding: 6pt 8pt;
          margin-bottom: 6pt;
          border-radius: 3pt;
        }
        .bilan-title {
          font-size: 12pt;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .bilan-sub {
          font-size: 8pt;
          opacity: 0.9;
          margin-top: 1pt;
        }
        .bilan-row1 {
          display: grid;
          grid-template-columns: 35% 1fr;
          gap: 6pt;
          margin-bottom: 6pt;
        }
        .bilan-name-block {
          display: flex;
          flex-direction: column;
          gap: 2pt;
        }
        .bilan-name {
          font-size: 13pt;
          font-weight: 700;
          color: #111827;
        }
        .bilan-meta {
          font-size: 8pt;
          color: #4b5563;
        }
        .bilan-score-card {
          margin-top: 4pt;
          padding: 6pt;
          border-radius: 3pt;
          text-align: center;
        }
        .bilan-score-value {
          font-size: 22pt;
          font-weight: 800;
          line-height: 1;
        }
        .bilan-score-label {
          font-size: 8pt;
          margin-top: 2pt;
          opacity: 0.95;
        }
        .bilan-score-rank {
          font-size: 7.5pt;
          margin-top: 2pt;
          opacity: 0.85;
        }
        .bilan-apprec {
          background: #f3f4f6;
          padding: 6pt 8pt;
          border-radius: 3pt;
          border-left: 3pt solid #7c3aed;
        }
        .bilan-apprec-text {
          font-size: 8.5pt;
          color: #1f2937;
          margin: 2pt 0 0 0;
          line-height: 1.4;
        }
        .bilan-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4pt;
          margin-bottom: 6pt;
        }
        .bilan-stat {
          background: #f9fafb;
          border: 0.5pt solid #e5e7eb;
          padding: 4pt 6pt;
          border-radius: 2pt;
          text-align: center;
        }
        .bilan-stat span {
          display: block;
          font-size: 7pt;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .bilan-stat strong {
          font-size: 12pt;
          color: #111827;
        }
        .bilan-section {
          margin-bottom: 6pt;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .bilan-section-title {
          font-size: 8.5pt;
          font-weight: 700;
          color: #4c1d95;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 3pt;
          border-bottom: 1pt solid #e5e7eb;
          padding-bottom: 2pt;
        }
        .bilan-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8pt;
        }
        .bilan-table th {
          text-align: left;
          padding: 2pt 4pt;
          color: #6b7280;
          font-weight: 600;
          background: #f9fafb;
          border-bottom: 1pt solid #e5e7eb;
        }
        .bilan-table td {
          padding: 2pt 4pt;
          border-bottom: 0.5pt solid #f3f4f6;
        }
        .bilan-score-pill {
          display: inline-block;
          padding: 1pt 5pt;
          border-radius: 8pt;
          font-size: 7.5pt;
          font-weight: 700;
        }
        .bilan-modes {
          font-size: 7pt;
          color: #6b7280;
        }
        .bilan-row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8pt;
          margin-bottom: 6pt;
        }
        .bilan-errors {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .bilan-errors li {
          padding: 2pt 0;
          font-size: 8pt;
          border-bottom: 0.5pt solid #f3f4f6;
        }
        .bilan-err-count {
          color: #dc2626;
          font-weight: 700;
        }
        .bilan-err-attempts {
          color: #6b7280;
          font-size: 7.5pt;
          font-style: italic;
        }
        .bilan-cats {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .bilan-cats li {
          display: grid;
          grid-template-columns: 38% 1fr 30pt;
          gap: 4pt;
          align-items: center;
          padding: 2pt 0;
          font-size: 8pt;
        }
        .bilan-cat-bar {
          background: #e5e7eb;
          height: 5pt;
          border-radius: 3pt;
          overflow: hidden;
        }
        .bilan-cat-bar span {
          display: block;
          background: linear-gradient(90deg, #a78bfa, #7c3aed);
          height: 100%;
        }
        .bilan-cat-pct {
          text-align: right;
          font-weight: 600;
        }
        .bilan-suggestions {
          margin: 0;
          padding-left: 14pt;
        }
        .bilan-suggestions li {
          font-size: 8pt;
          padding: 1pt 0;
        }
        .bilan-footer {
          margin-top: 8pt;
          padding-top: 4pt;
          border-top: 0.5pt solid #e5e7eb;
          font-size: 7pt;
          color: #9ca3af;
          text-align: center;
        }
      `}</style>
    </main>
  );
}

// ── Sidebar stat row ─────────────────────────────────────────────────────
function SideStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b last:border-b-0 border-gray-100">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}

// ── Mini sparkline (sidebar) ─────────────────────────────────────────────
function SidebarSparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const width = 240;
  const height = 50;
  const padding = 4;
  const max = 100;
  const stepX = (width - padding * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (v / max) * (height - padding * 2);
    return `${x},${y}`;
  });
  const path = `M ${points.join(" L ")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-10"
      preserveAspectRatio="none"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      <path
        d={path}
        fill="none"
        stroke="#7c3aed"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Carte compacte d'une dictée ──────────────────────────────────────────
function DicteeCard({ s }: { s: DicteeSummary }) {
  const hasAttempt = s.attempts > 0;
  const border = scoreBorderColor(s.bestPct, hasAttempt);
  const lastDate = s.lastAttemptAt
    ? new Date(s.lastAttemptAt).toLocaleDateString("fr-FR")
    : "—";
  return (
    <div
      className={`rounded-lg border border-gray-200 ${border} border-l-4 bg-white p-3 hover:shadow-sm transition`}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <p className="text-xs font-bold text-gray-900 truncate">
          D{s.dictee.position} · {s.dictee.title}
        </p>
        <span className="text-xs font-bold whitespace-nowrap">
          {scoreEmoji(s.bestPct)} {Math.round(s.bestPct)}%
        </span>
      </div>
      <p className="text-[11px] text-gray-600">
        {s.attempts} essai{s.attempts > 1 ? "s" : ""} ·{" "}
        {s.modesPlayed.length} mode{s.modesPlayed.length > 1 ? "s" : ""}
      </p>
      <p className="text-[11px] text-gray-500 mt-0.5">📅 {lastDate}</p>
      {s.modesPlayed.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {s.modesPlayed.slice(0, 5).map((m) => (
            <span
              key={m}
              className="px-1.5 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[10px] text-purple-700"
            >
              {m}
            </span>
          ))}
          {s.modesPlayed.length > 5 && (
            <span className="text-[10px] text-gray-400">
              +{s.modesPlayed.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grand sparkline (section Évolution) ──────────────────────────────────
function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const width = 400;
  const height = 80;
  const padding = 8;
  const max = Math.max(100, ...values);
  const min = 0;
  const range = max - min || 1;
  const stepX = (width - padding * 2) / Math.max(1, values.length - 1);

  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const path = `M ${points.join(" L ")}`;
  const lastPoint = points[points.length - 1].split(",").map(Number);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-20"
      preserveAspectRatio="none"
    >
      <line
        x1={padding}
        y1={height - padding}
        x2={width - padding}
        y2={height - padding}
        stroke="#e5e7eb"
        strokeWidth="1"
      />
      <path
        d={path}
        fill="none"
        stroke="url(#sparkGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill="#7c3aed" />
    </svg>
  );
}

// Liste des prénoms féminins fréquents (à compléter si besoin)
const FEMININE_FIRST_NAMES = new Set([
  "nadia", "marie", "sophie", "stéphanie", "stephanie", "isabelle", "catherine",
  "sandrine", "delphine", "céline", "celine", "florence", "valérie", "valerie",
  "nathalie", "véronique", "veronique", "claire", "anne", "julie", "laure",
  "élodie", "elodie", "manon", "léa", "lea", "emma", "chloé", "chloe", "camille",
  "sarah", "laetitia", "amélie", "amelie", "fatima", "lila", "yasmine", "lina",
  "léna", "lena", "alice", "lucie", "emilie", "émilie", "audrey", "carole",
  "carine", "estelle", "hélène", "helene", "agathe", "alicia", "alexandra",
  "aurélie", "aurelie", "anaïs", "anais", "patricia", "pascale", "monique",
  "martine", "mireille", "michèle", "michele", "danielle", "dominique",
  "francine", "geneviève", "genevieve", "jacqueline", "joëlle", "joelle",
  "muriel", "nathalie", "odile", "régine", "regine", "sylvie", "thérèse",
  "therese", "yvonne", "manai",
]);

// Devine "M." ou "Mme" à partir du prénom (heuristique simple).
function guessCivility(firstName: string): "M." | "Mme" {
  return FEMININE_FIRST_NAMES.has(firstName.toLowerCase()) ? "Mme" : "M.";
}

// Formate "Mohamed BELHAJ" → "M. BELHAJ", "Nadia MANAI" → "Mme MANAI"
function formatTeacherName(raw: string | null | undefined): string {
  if (!raw) return "Enseignant·e";
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 2) return raw;
  const firstName = tokens[0];
  const lastName = tokens.slice(1).join(" ").toUpperCase();
  const civility = guessCivility(firstName);
  return `${civility} ${lastName}`;
}

// ── Bilan compact pour l'impression (1 page A4) ─────────────────────────────
function scoreColor(pct: number): { bg: string; text: string; label: string } {
  if (pct >= 80) return { bg: "#059669", text: "#fff", label: "Très bonne maîtrise" };
  if (pct >= 60) return { bg: "#65a30d", text: "#fff", label: "Maîtrise satisfaisante" };
  if (pct >= 40) return { bg: "#d97706", text: "#fff", label: "Maîtrise fragile" };
  return { bg: "#dc2626", text: "#fff", label: "Maîtrise insuffisante" };
}

interface PrintBilanProps {
  studentName: string;
  teacherName: string;
  stats: StudentStats;
  dicteeCards: DicteeSummary[];
  topErrorsList: TopError[];
  analysis: StudentAnalysisJson | null;
  totalDictees: number;
}

function PrintBilan({ studentName, teacherName, stats, dicteeCards, topErrorsList, analysis, totalDictees }: PrintBilanProps) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const triedCards = dicteeCards.filter((d) => d.attempts > 0);
  const sc = scoreColor(stats.averagePct);

  return (
    <div className="bilan-print">
      {/* En-tête bandeau violet */}
      <div className="bilan-header">
        <div>
          <div className="bilan-title">BILAN INDIVIDUEL — Orthographe & Dictée</div>
          <div className="bilan-sub">DictéeMaster · Collège Chaissac, Pouzauges · {today}</div>
        </div>
      </div>

      {/* Bloc identité + note + appréciation IA */}
      <div className="bilan-row1">
        <div className="bilan-name-block">
          <div className="bilan-name">{studentName}</div>
          <div className="bilan-meta">Enseignant·e : <strong>{teacherName}</strong></div>
          <div className="bilan-score-card" style={{ background: sc.bg, color: sc.text }}>
            <div className="bilan-score-value">{Math.round(stats.averagePct)}%</div>
            <div className="bilan-score-label">{sc.label}</div>
            <div className="bilan-score-rank">Rang {stats.rankInClass} / {stats.classSize}</div>
          </div>
        </div>
        <div className="bilan-apprec">
          <div className="bilan-section-title">Appréciation</div>
          <p className="bilan-apprec-text">
            {analysis?.summary
              ? analysis.summary
              : `${stats.dicteesTried} dictée${stats.dicteesTried > 1 ? "s" : ""} tentée${stats.dicteesTried > 1 ? "s" : ""} sur ${totalDictees} (${Math.round((stats.dicteesTried / Math.max(1, totalDictees)) * 100)}%). Score moyen ${Math.round(stats.averagePct)}%, médiane ${Math.round(stats.medianPct)}%. Pour générer une analyse IA détaillée, lancez "Analyser avec l'IA" sur la fiche en ligne.`}
          </p>
        </div>
      </div>

      {/* Statistiques en bandeau */}
      <div className="bilan-stats">
        <div className="bilan-stat"><span>Dictées tentées</span><strong>{stats.dicteesTried}/{totalDictees}</strong></div>
        <div className="bilan-stat"><span>Sessions</span><strong>{stats.totalAttempts}</strong></div>
        <div className="bilan-stat"><span>Meilleur</span><strong>{Math.round(stats.bestPct)}%</strong></div>
        <div className="bilan-stat"><span>Moyenne</span><strong>{Math.round(stats.averagePct)}%</strong></div>
        <div className="bilan-stat"><span>Médiane</span><strong>{Math.round(stats.medianPct)}%</strong></div>
      </div>

      {/* Dictées tentées (tableau ultra compact) */}
      {triedCards.length > 0 && (
        <div className="bilan-section">
          <div className="bilan-section-title">Dictées tentées ({triedCards.length})</div>
          <table className="bilan-table">
            <thead>
              <tr><th>Dictée</th><th>Meilleur</th><th>Essais</th><th>Modes testés</th></tr>
            </thead>
            <tbody>
              {triedCards.slice(0, 15).map((d) => {
                const c = scoreColor(d.bestPct);
                return (
                  <tr key={d.dictee.id}>
                    <td><strong>D{d.dictee.position}</strong> · {d.dictee.title}</td>
                    <td><span className="bilan-score-pill" style={{ background: c.bg, color: c.text }}>{Math.round(d.bestPct)}%</span></td>
                    <td>{d.attempts}</td>
                    <td className="bilan-modes">{d.modesPlayed.join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bilan-row2">
        {/* Top erreurs */}
        {topErrorsList.length > 0 && (
          <div className="bilan-section">
            <div className="bilan-section-title">Mots à retravailler</div>
            <ul className="bilan-errors">
              {topErrorsList.slice(0, 8).map((e) => (
                <li key={e.word}>
                  <strong>{e.word}</strong> <span className="bilan-err-count">×{e.totalCount}</span>
                  <span className="bilan-err-attempts"> · {e.wrongAttempts.slice(0, 3).map((a) => `"${a.user_answer}"`).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Catégories d'erreurs (si analyse IA disponible) */}
        {analysis?.categories && analysis.categories.length > 0 && (
          <div className="bilan-section">
            <div className="bilan-section-title">Catégories d&apos;erreurs</div>
            <ul className="bilan-cats">
              {analysis.categories.slice(0, 5).map((c) => (
                <li key={c.name}>
                  <span className="bilan-cat-name">{c.name}</span>
                  <span className="bilan-cat-bar"><span style={{ width: `${c.percentage}%` }} /></span>
                  <span className="bilan-cat-pct">{c.percentage}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Suggestions pédagogiques IA */}
      {analysis?.suggestions && analysis.suggestions.length > 0 && (
        <div className="bilan-section">
          <div className="bilan-section-title">Suggestions pédagogiques</div>
          <ul className="bilan-suggestions">
            {analysis.suggestions.slice(0, 4).map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Pied de page */}
      <div className="bilan-footer">
        DictéeMaster · {teacherName} · Bilan édité le {today}
      </div>
    </div>
  );
}
