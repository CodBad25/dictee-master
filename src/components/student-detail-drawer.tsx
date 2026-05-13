"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Loader2,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  computeStudentStats,
  groupResultsByDictee,
  topErrors,
  engagementMetrics,
  type StudentStats,
  type WordAttempt,
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

export interface StudentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  classId: string;        // dm_classes.id
  teacherPassword: string;
}

type PopoverKey = "score" | "dictees" | "sessions" | "time" | null;

// ── Couleurs selon valeurs ────────────────────────────────────────────────
function scoreColor(pct: number) {
  if (pct < 60) return {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    label: "text-red-700",
    ring: "hover:ring-red-300",
  };
  if (pct < 80) return {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    label: "text-amber-700",
    ring: "hover:ring-amber-300",
  };
  return {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    label: "text-emerald-700",
    ring: "hover:ring-emerald-300",
  };
}

function completionColor(pct: number) {
  if (pct < 30) return {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    label: "text-red-700",
    ring: "hover:ring-red-300",
  };
  if (pct < 70) return {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    label: "text-amber-700",
    ring: "hover:ring-amber-300",
  };
  return {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    label: "text-emerald-700",
    ring: "hover:ring-emerald-300",
  };
}

function sessionsColor(perWeek: number) {
  if (perWeek < 1) return {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-900",
    label: "text-red-700",
    ring: "hover:ring-red-300",
  };
  if (perWeek < 3) return {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    label: "text-amber-700",
    ring: "hover:ring-amber-300",
  };
  return {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-900",
    label: "text-emerald-700",
    ring: "hover:ring-emerald-300",
  };
}

const neutralIndigo = {
  bg: "bg-indigo-50",
  border: "border-indigo-200",
  text: "text-indigo-900",
  label: "text-indigo-700",
  ring: "hover:ring-indigo-300",
};

export default function StudentDetailDrawer({
  isOpen,
  onClose,
  studentId,
  studentName,
  classId,
  teacherPassword,
}: StudentDetailDrawerProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [studentResults, setStudentResults] = useState<DicteeResult[]>([]);
  const [classResults, setClassResults] = useState<DicteeResult[]>([]);
  const [attempts, setAttempts] = useState<WordAttempt[]>([]);

  // IA
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<StudentAnalysisJson | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{
    costUsd: number;
    tokens: number;
    model: string;
    updatedAt: string;
    fromCache: boolean;
  } | null>(null);

  // Réglages DeepSeek
  const [showSettings, setShowSettings] = useState(false);
  const [personalKey, setPersonalKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [balance, setBalance] = useState<{
    balanceUsd: number;
    currency: string;
    usingPersonalKey: boolean;
  } | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Popovers KPI
  const [openPopover, setOpenPopover] = useState<PopoverKey>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const kpiRowRef = useRef<HTMLDivElement | null>(null);

  // Fermeture popover au clic extérieur
  useEffect(() => {
    if (!openPopover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (kpiRowRef.current?.contains(target)) return;
      setOpenPopover(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openPopover]);

  // Charger la clé perso depuis localStorage à l'ouverture
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(DEEPSEEK_KEY_STORAGE) ?? "";
      setPersonalKey(saved);
    }
  }, [isOpen]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dicteesRes, studentRes, classRes] = await Promise.all([
        supabase
          .from("dictees")
          .select("id, title, position, share_code, fill_blanks_text")
          .order("position"),
        supabase
          .from("dm_results")
          .select("*")
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
        supabase.from("dm_results").select("*").eq("class_id", classId),
      ]);

      const allDictees = (dicteesRes.data || []) as Dictee[];
      const sResults = (studentRes.data || []) as DicteeResult[];
      const cResults = (classRes.data || []) as DicteeResult[];

      setDictees(allDictees);
      setStudentResults(sResults);
      setClassResults(cResults);

      if (sResults.length > 0) {
        const resultIds = sResults.map((r) => r.id);
        const { data: attData } = await supabase
          .from("dm_word_attempts")
          .select("result_id, word, user_answer, is_correct")
          .in("result_id", resultIds);
        setAttempts((attData || []) as WordAttempt[]);
      } else {
        setAttempts([]);
      }

      // Tenter de charger l'analyse en cache
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
          } else {
            setAnalysis(null);
            setAnalysisMeta(null);
          }
        }
      } catch {
        // silencieux
      }
    } catch (err) {
      console.error("[StudentDetailDrawer] loadData :", err);
      toast.error("Erreur lors du chargement de la fiche élève");
    } finally {
      setLoading(false);
    }
  }, [supabase, studentId, classId]);

  useEffect(() => {
    if (isOpen && studentId && classId) {
      loadData();
    }
  }, [isOpen, studentId, classId, loadData]);

  const runAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-teacher-password": teacherPassword,
      };
      if (personalKey.trim()) {
        headers["x-deepseek-key"] = personalKey.trim();
        if (typeof window !== "undefined") {
          localStorage.setItem(DEEPSEEK_KEY_STORAGE, personalKey.trim());
        }
      }

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
      console.error("[StudentDetailDrawer] runAnalysis :", err);
      toast.error("Erreur réseau pendant l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  const checkBalance = async () => {
    setBalanceLoading(true);
    try {
      const headers: Record<string, string> = {
        "x-teacher-password": teacherPassword,
      };
      if (personalKey.trim()) headers["x-deepseek-key"] = personalKey.trim();
      const r = await fetch("/api/deepseek/balance", { headers });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j?.error || "Impossible de récupérer le solde");
        return;
      }
      setBalance(j);
      toast.success(
        `Solde DeepSeek : $${(j.balanceUsd as number).toFixed(2)} (${j.usingPersonalKey ? "clé perso" : "clé partagée"})`,
      );
    } catch (err) {
      console.error("[StudentDetailDrawer] checkBalance :", err);
      toast.error("Erreur réseau");
    } finally {
      setBalanceLoading(false);
    }
  };

  if (!isOpen) return null;

  // === Stats déterministes ===
  const stats = computeStudentStats(studentResults, classResults);
  const dicteesSummary = groupResultsByDictee(studentResults, dictees);
  const errors = topErrors(attempts, 5);
  const engagement = engagementMetrics(studentResults);

  const top5Dictees = [...dicteesSummary]
    .sort((a, b) => b.bestPct - a.bestPct)
    .slice(0, 5);

  // Pour les popovers
  const completionPct =
    dictees.length > 0 ? (stats.dicteesTried / dictees.length) * 100 : 0;
  const triedDicteeIds = new Set(dicteesSummary.map((s) => s.dictee.id));
  const notTriedDictees = dictees.filter((d) => !triedDicteeIds.has(d.id));
  const errorsTotal = errors.reduce((acc, e) => acc + e.totalCount, 0);

  const scoreCols = scoreColor(stats.averagePct);
  const compCols = completionColor(completionPct);
  const sessCols = sessionsColor(engagement.sessionsPerWeek);
  const timeCols = neutralIndigo;

  const togglePopover = (k: PopoverKey) =>
    setOpenPopover((cur) => (cur === k ? null : k));

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-4 flex items-start justify-between sticky top-0 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate">{studentName}</h2>
            <p className="text-xs text-purple-100">
              Moyenne : {Math.round(stats.averagePct)}% · {stats.dicteesTried}/
              {dictees.length} dictées tentées
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a
              href={`/teacher/eleve/${encodeURIComponent(studentId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold inline-flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" /> Fiche complète
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Synthèse rapide */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                Synthèse rapide
              </h3>
              <div ref={kpiRowRef} className="relative">
                <div className="grid grid-cols-4 gap-3">
                  <ColoredKpi
                    label="Score moyen"
                    value={`${Math.round(stats.averagePct)}%`}
                    cols={scoreCols}
                    active={openPopover === "score"}
                    onClick={() => togglePopover("score")}
                  />
                  <ColoredKpi
                    label="Dictées"
                    value={`${stats.dicteesTried}/${dictees.length}`}
                    cols={compCols}
                    active={openPopover === "dictees"}
                    onClick={() => togglePopover("dictees")}
                  />
                  <ColoredKpi
                    label="Sessions/sem."
                    value={engagement.sessionsPerWeek.toFixed(1)}
                    cols={sessCols}
                    active={openPopover === "sessions"}
                    onClick={() => togglePopover("sessions")}
                  />
                  <ColoredKpi
                    label="Temps moy."
                    value={
                      engagement.averageSessionSec > 0
                        ? `${Math.round(engagement.averageSessionSec / 60)} min`
                        : "—"
                    }
                    cols={timeCols}
                    active={openPopover === "time"}
                    onClick={() => togglePopover("time")}
                  />
                </div>

                {openPopover && (
                  <div
                    ref={popoverRef}
                    className="absolute left-0 right-0 mt-2 z-20 rounded-xl border border-gray-200 bg-white shadow-xl p-4"
                  >
                    {openPopover === "score" && (
                      <ScorePopover stats={stats} />
                    )}
                    {openPopover === "dictees" && (
                      <DicteesPopover
                        notTried={notTriedDictees}
                        totalCount={dictees.length}
                        triedCount={stats.dicteesTried}
                      />
                    )}
                    {openPopover === "sessions" && (
                      <SessionsHeatmapPopover results={studentResults} />
                    )}
                    {openPopover === "time" && (
                      <TimeDistributionPopover results={studentResults} />
                    )}
                  </div>
                )}
              </div>

              {stats.rankInClass > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Classement : {stats.rankInClass}
                  <sup>{stats.rankInClass === 1 ? "er" : "e"}</sup> sur{" "}
                  {stats.classSize} dans la classe
                </p>
              )}
            </section>

            {/* Top 5 dictées */}
            <section>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">
                Top 5 dictées
              </h3>
              {top5Dictees.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Aucune dictée tentée pour le moment.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left p-2 font-semibold">Dictée</th>
                        <th className="text-center p-2 font-semibold">Score</th>
                        <th className="text-center p-2 font-semibold">Essais</th>
                        <th className="text-left p-2 font-semibold">Modes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top5Dictees.map((s) => (
                        <tr key={s.dictee.id} className="border-t">
                          <td className="p-2 font-medium">
                            D{s.dictee.position} — {s.dictee.title}
                          </td>
                          <td className="p-2 text-center font-bold">
                            {Math.round(s.bestPct)}%
                          </td>
                          <td className="p-2 text-center">{s.attempts}</td>
                          <td className="p-2 text-gray-600">
                            {s.modesPlayed.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Top 5 erreurs */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Top 5 erreurs
                </h3>
                {errors.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                    {errorsTotal} mots ratés au total
                  </span>
                )}
              </div>
              {errors.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Aucune erreur enregistrée.
                </p>
              ) : (
                <div className="space-y-2">
                  {errors.map((e) => (
                    <div
                      key={e.word}
                      className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold text-red-900">
                          {e.word}
                        </span>
                        <span className="text-red-700">×{e.totalCount}</span>
                      </div>
                      <div className="mt-1 text-gray-700">
                        Tentatives :{" "}
                        {e.wrongAttempts
                          .slice(0, 3)
                          .map((w) => `« ${w.user_answer} » (×${w.count})`)
                          .join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Analyse IA */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Analyse IA
                </h3>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing || errors.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-xs font-semibold disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Analyse en
                      cours…
                    </>
                  ) : analysis ? (
                    <>
                      <RefreshCw className="w-3 h-3" /> Relancer
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3" /> Analyser avec l&apos;IA
                    </>
                  )}
                </button>
              </div>

              {analysis ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-gray-800">
                    {analysis.summary}
                  </div>

                  {analysis.categories.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-600">
                        Catégories d&apos;erreurs
                      </p>
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
                              ex. {c.examples.slice(0, 3).join(" · ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {analysis.suggestions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">
                        Suggestions pédagogiques
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-gray-700">
                        {analysis.suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisMeta && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap">
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
                <p className="text-xs text-gray-500 italic">
                  {errors.length === 0
                    ? "Pas encore assez de données pour une analyse IA."
                    : "Lance l'analyse pour obtenir un diagnostic pédagogique automatique."}
                </p>
              )}
            </section>

            {/* Réglages DeepSeek */}
            <section className="border-t pt-4">
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                {showSettings ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                ⚙️ Réglages DeepSeek
              </button>

              {showSettings && (
                <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Clé API personnelle (optionnel, BYOK)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showKey ? "text" : "password"}
                        value={personalKey}
                        onChange={(e) => setPersonalKey(e.target.value)}
                        placeholder="sk-... (laisser vide pour clé partagée)"
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs font-mono"
                      />
                      <button
                        onClick={() => setShowKey((v) => !v)}
                        className="p-1.5 rounded text-gray-500 hover:bg-gray-200"
                        aria-label="Afficher/masquer"
                      >
                        {showKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Stockée dans le localStorage de ce navigateur uniquement.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={checkBalance}
                      disabled={balanceLoading}
                      className="px-3 py-1.5 rounded bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {balanceLoading && (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      )}
                      Vérifier le solde
                    </button>
                    {balance && (
                      <span className="text-xs text-gray-700">
                        Solde : ${balance.balanceUsd.toFixed(2)} (
                        {balance.usingPersonalKey ? "perso" : "partagée"})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI coloré cliquable ──────────────────────────────────────────────────
function ColoredKpi({
  label,
  value,
  cols,
  active,
  onClick,
}: {
  label: string;
  value: string;
  cols: { bg: string; border: string; text: string; label: string; ring: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg ${cols.bg} border ${cols.border} text-center transition hover:shadow-sm hover:ring-2 ${cols.ring} ${active ? "ring-2 ring-purple-400" : ""}`}
    >
      <p
        className={`text-[10px] uppercase tracking-wide font-semibold ${cols.label}`}
      >
        {label}
      </p>
      <p className={`text-sm font-bold mt-0.5 ${cols.text}`}>{value}</p>
    </button>
  );
}

// ── Popover : Score moyen ────────────────────────────────────────────────
function ScorePopover({ stats }: { stats: StudentStats }) {
  const values = stats.trend4weeks.map((w) => w.avgPct);
  const nonZero = values.filter((v) => v > 0);
  const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const max = nonZero.length > 0 ? Math.max(...nonZero) : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-700">
        Évolution des 4 dernières semaines
      </p>
      <MiniSparkline values={values} />
      <div className="grid grid-cols-4 gap-1 text-center">
        {stats.trend4weeks.map((w) => (
          <div key={w.week}>
            <p className="text-[9px] text-gray-400">{w.week.slice(5)}</p>
            <p className="text-[11px] font-bold text-gray-700">
              {w.avgPct > 0 ? `${Math.round(w.avgPct)}%` : "—"}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-gray-600">
        Score min : <strong>{Math.round(min)}%</strong> · max :{" "}
        <strong>{Math.round(max)}%</strong> · médiane :{" "}
        <strong>{Math.round(stats.medianPct)}%</strong>
      </p>
    </div>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  const width = 300;
  const height = 60;
  const padding = 6;
  const max = 100;
  const stepX = (width - padding * 2) / Math.max(1, values.length - 1);
  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (v / max) * (height - padding * 2);
    return `${x},${y}`;
  });
  const path = `M ${points.join(" L ")}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-14">
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
      {points.map((p, i) => {
        const [x, y] = p.split(",").map(Number);
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#7c3aed" />;
      })}
    </svg>
  );
}

// ── Popover : Dictées non tentées ────────────────────────────────────────
function DicteesPopover({
  notTried,
  totalCount,
  triedCount,
}: {
  notTried: Dictee[];
  totalCount: number;
  triedCount: number;
}) {
  const remaining = totalCount - triedCount;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">
        Dictées non tentées ({remaining} restantes)
      </p>
      {notTried.length === 0 ? (
        <p className="text-[11px] text-emerald-700 italic">
          Toutes les dictées ont été tentées au moins une fois.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {notTried.slice(0, 10).map((d) => (
            <span
              key={d.id}
              className="px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] text-gray-700"
            >
              D{d.position} — {d.title}
            </span>
          ))}
          {notTried.length > 10 && (
            <span className="px-2 py-0.5 text-[11px] text-gray-500 italic">
              … et {notTried.length - 10} de plus
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Popover : Heatmap sessions ───────────────────────────────────────────
function SessionsHeatmapPopover({ results }: { results: DicteeResult[] }) {
  // 28 derniers jours, ligne par semaine (du plus ancien au plus récent)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: { date: Date; key: string; count: number }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({
      date: d,
      key: d.toISOString().slice(0, 10),
      count: 0,
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const r of results) {
    const k = new Date(r.created_at).toISOString().slice(0, 10);
    const entry = byKey.get(k);
    if (entry) entry.count++;
  }

  // Organiser en 4 lignes de 7 colonnes (semaines)
  const cellColor = (c: number) => {
    if (c === 0) return "bg-gray-100";
    if (c === 1) return "bg-emerald-200";
    if (c === 2) return "bg-emerald-400";
    return "bg-emerald-600";
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-700">
        Activité des 4 dernières semaines
      </p>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => (
          <div
            key={d.key}
            title={`${d.date.toLocaleDateString("fr-FR")} — ${d.count} session${d.count > 1 ? "s" : ""}`}
            className={`aspect-square rounded ${cellColor(d.count)}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-600 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-gray-100 border border-gray-200" />
          Pas d&apos;activité
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-200" />1
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-400" />2
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-600" />
          3+
        </span>
      </div>
    </div>
  );
}

// ── Popover : Distribution du temps ──────────────────────────────────────
function TimeDistributionPopover({ results }: { results: DicteeResult[] }) {
  const withTime = results.filter(
    (r) => typeof r.time_spent === "number" && r.time_spent! > 0,
  );
  let short = 0;
  let medium = 0;
  let long = 0;
  for (const r of withTime) {
    const t = r.time_spent ?? 0;
    if (t < 120) short++;
    else if (t <= 300) medium++;
    else long++;
  }
  const total = withTime.length || 1;
  const pct = (n: number) => (n / total) * 100;

  const Row = ({
    label,
    count,
    color,
  }: {
    label: string;
    count: number;
    color: string;
  }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-gray-700">
        <span>{label}</span>
        <span className="font-semibold">{count} session{count > 1 ? "s" : ""}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${pct(count)}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-gray-700">
        Distribution du temps par session
      </p>
      {withTime.length === 0 ? (
        <p className="text-[11px] text-gray-500 italic">
          Aucune donnée de durée enregistrée.
        </p>
      ) : (
        <>
          <Row label="Court (< 2 min)" count={short} color="bg-amber-400" />
          <Row label="Moyen (2-5 min)" count={medium} color="bg-emerald-400" />
          <Row label="Long (> 5 min)" count={long} color="bg-indigo-400" />
        </>
      )}
    </div>
  );
}
