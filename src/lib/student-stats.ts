// Utilitaires statistiques côté client/serveur pour la fiche élève.
// 100% déterministe — pas d'appel IA. Toutes les fonctions sont pures.

import type { Dictee, DicteeResult } from "./dictee-service";

export interface WordAttempt {
  result_id: string;
  word: string;
  user_answer: string;
  is_correct: boolean;
}

// ── 1. Statistiques générales ───────────────────────────────────────────

export interface StudentStats {
  averagePct: number;       // moyenne des meilleurs scores par dictée tentée
  medianPct: number;        // médiane des meilleurs scores
  totalAttempts: number;    // nombre total de sessions
  dicteesTried: number;     // nb de dictées distinctes tentées
  bestPct: number;          // meilleur score absolu
  worstPct: number;         // pire score absolu (sur dictées tentées)
  rankInClass: number;      // 1 = meilleur ; 0 si pas de classement calculable
  classSize: number;
  trend4weeks: { week: string; avgPct: number }[]; // 4 dernières semaines
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function weekKey(d: Date): string {
  // Lundi de la semaine ISO comme clé "YYYY-MM-DD"
  const day = (d.getDay() + 6) % 7; // 0=Lun, 6=Dim
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function computeStudentStats(
  results: DicteeResult[],
  classResults: DicteeResult[],
): StudentStats {
  // Meilleur score par dictée pour CET élève
  const bestByDictee = new Map<string, number>();
  for (const r of results) {
    const cur = bestByDictee.get(r.dictee_id) ?? -1;
    if (r.percentage > cur) bestByDictee.set(r.dictee_id, r.percentage);
  }
  const bests = Array.from(bestByDictee.values());

  const averagePct =
    bests.length > 0 ? bests.reduce((a, b) => a + b, 0) / bests.length : 0;

  // Classement : moyenne des meilleurs scores par élève dans la classe
  const bestByStudentMap = new Map<string, Map<string, number>>();
  for (const r of classResults) {
    let inner = bestByStudentMap.get(r.student_id);
    if (!inner) {
      inner = new Map();
      bestByStudentMap.set(r.student_id, inner);
    }
    const cur = inner.get(r.dictee_id) ?? -1;
    if (r.percentage > cur) inner.set(r.dictee_id, r.percentage);
  }
  const studentAverages: { studentId: string; avg: number }[] = [];
  for (const [sid, m] of bestByStudentMap) {
    const vs = Array.from(m.values());
    if (vs.length === 0) continue;
    studentAverages.push({
      studentId: sid,
      avg: vs.reduce((a, b) => a + b, 0) / vs.length,
    });
  }
  studentAverages.sort((a, b) => b.avg - a.avg);
  const rankIndex = studentAverages.findIndex((s) => s.avg <= averagePct);
  const rankInClass =
    bests.length === 0
      ? 0
      : rankIndex >= 0
        ? rankIndex + 1
        : studentAverages.length;

  // Évolution dernières 4 semaines (basée sur toutes les sessions, pas seulement meilleurs)
  const now = new Date();
  const weeks: string[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(weekKey(d));
  }
  const trend4weeks = weeks.map((wk) => {
    const sessions = results.filter((r) => weekKey(new Date(r.created_at)) === wk);
    const avg =
      sessions.length > 0
        ? sessions.reduce((a, r) => a + r.percentage, 0) / sessions.length
        : 0;
    return { week: wk, avgPct: avg };
  });

  return {
    averagePct,
    medianPct: median(bests),
    totalAttempts: results.length,
    dicteesTried: bestByDictee.size,
    bestPct: bests.length > 0 ? Math.max(...bests) : 0,
    worstPct: bests.length > 0 ? Math.min(...bests) : 0,
    rankInClass,
    classSize: studentAverages.length,
    trend4weeks,
  };
}

// ── 2. Groupage par dictée ──────────────────────────────────────────────

export interface DicteeSummary {
  dictee: Dictee;
  bestPct: number;
  attempts: number;
  modesPlayed: string[];
  lastAttemptAt: string | null;
}

export function groupResultsByDictee(
  results: DicteeResult[],
  dictees: Dictee[],
): DicteeSummary[] {
  const map = new Map<string, DicteeSummary>();
  for (const d of dictees) {
    map.set(d.id, {
      dictee: d,
      bestPct: 0,
      attempts: 0,
      modesPlayed: [],
      lastAttemptAt: null,
    });
  }
  for (const r of results) {
    const entry = map.get(r.dictee_id);
    if (!entry) continue;
    entry.attempts++;
    if (r.percentage > entry.bestPct) entry.bestPct = r.percentage;
    if (!entry.modesPlayed.includes(r.activity_mode)) {
      entry.modesPlayed.push(r.activity_mode);
    }
    if (!entry.lastAttemptAt || r.created_at > entry.lastAttemptAt) {
      entry.lastAttemptAt = r.created_at;
    }
  }
  return Array.from(map.values())
    .filter((s) => s.attempts > 0)
    .sort((a, b) => a.dictee.position - b.dictee.position);
}

// ── 3. Top erreurs ──────────────────────────────────────────────────────

export interface TopError {
  word: string;
  wrongAttempts: { user_answer: string; count: number }[];
  totalCount: number;
}

export function topErrors(attempts: WordAttempt[], limit = 10): TopError[] {
  const byWord = new Map<string, Map<string, number>>();
  for (const a of attempts) {
    if (a.is_correct) continue;
    let inner = byWord.get(a.word);
    if (!inner) {
      inner = new Map();
      byWord.set(a.word, inner);
    }
    inner.set(a.user_answer, (inner.get(a.user_answer) ?? 0) + 1);
  }

  const list: TopError[] = [];
  for (const [word, attemptsMap] of byWord) {
    const wrongAttempts = Array.from(attemptsMap.entries())
      .map(([user_answer, count]) => ({ user_answer, count }))
      .sort((a, b) => b.count - a.count);
    const totalCount = wrongAttempts.reduce((a, b) => a + b.count, 0);
    list.push({ word, wrongAttempts, totalCount });
  }

  return list.sort((a, b) => b.totalCount - a.totalCount).slice(0, limit);
}

// ── 4. Engagement ────────────────────────────────────────────────────────

export interface EngagementMetrics {
  sessionsPerWeek: number;     // moyenne dernières 4 semaines
  averageSessionSec: number;   // temps moyen par session (time_spent)
  regularityScore: number;     // 0-100 : sur 4 semaines, fraction de semaines actives × 25
  lastActivityAt: string | null;
}

export function engagementMetrics(results: DicteeResult[]): EngagementMetrics {
  if (results.length === 0) {
    return {
      sessionsPerWeek: 0,
      averageSessionSec: 0,
      regularityScore: 0,
      lastActivityAt: null,
    };
  }

  const now = new Date();
  const weeks: string[] = [];
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(weekKey(d));
  }

  let activeWeeks = 0;
  let totalSessionsLast4 = 0;
  for (const wk of weeks) {
    const n = results.filter((r) => weekKey(new Date(r.created_at)) === wk).length;
    if (n > 0) activeWeeks++;
    totalSessionsLast4 += n;
  }

  const withTime = results.filter((r) => typeof r.time_spent === "number" && r.time_spent! > 0);
  const averageSessionSec =
    withTime.length > 0
      ? withTime.reduce((a, r) => a + (r.time_spent ?? 0), 0) / withTime.length
      : 0;

  const sortedByDate = [...results].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return {
    sessionsPerWeek: totalSessionsLast4 / 4,
    averageSessionSec,
    regularityScore: (activeWeeks / 4) * 100,
    lastActivityAt: sortedByDate[0]?.created_at ?? null,
  };
}
