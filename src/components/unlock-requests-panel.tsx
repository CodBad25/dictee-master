"use client";

import { useEffect, useState } from "react";
import {
  loadPendingUnlockRequests,
  approveUnlockRequest,
  rejectUnlockRequest,
  loadAllDictees,
  loadStudentDicteeStats,
  type UnlockRequest,
  type Dictee,
} from "@/lib/dictee-service";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface UnlockRequestsPanelProps {
  classId: string | null;
}

type StudentStats = Record<string, { bestScore: number; attempts: number; lastMode: string }>;

function colorForScore(pct: number): string {
  if (pct >= 90) return "bg-green-100 text-green-900 border-green-300";
  if (pct >= 70) return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (pct >= 40) return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-red-50 text-red-800 border-red-200";
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.round(h / 24);
  return `il y a ${d}j`;
}

export default function UnlockRequestsPanel({ classId }: UnlockRequestsPanelProps) {
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [statsByStudent, setStatsByStudent] = useState<Record<string, StudentStats>>({});

  // Charger la liste des dictées (titre + position) une seule fois
  useEffect(() => {
    loadAllDictees().then(setDictees).catch(() => {});
  }, []);

  // Polling 5s sur les demandes pending de la classe sélectionnée
  useEffect(() => {
    if (!classId) {
      setRequests([]);
      return;
    }
    const load = async () => {
      try {
        const reqs = await loadPendingUnlockRequests(classId);
        setRequests(reqs);
      } catch (e) {
        console.error("UnlockRequestsPanel:", e);
      }
    };
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [classId]);

  // Charger les stats des élèves qui ont une demande active
  useEffect(() => {
    const ids = Array.from(new Set(requests.map((r) => r.student_id)));
    for (const sid of ids) {
      if (statsByStudent[sid]) continue;
      loadStudentDicteeStats(sid)
        .then((s) => setStatsByStudent((prev) => ({ ...prev, [sid]: s })))
        .catch(() => {});
    }
  }, [requests, statsByStudent]);

  if (!classId || requests.length === 0) {
    return null;
  }

  const handleApprove = async (req: UnlockRequest) => {
    try {
      const ok = await approveUnlockRequest(req.id, req.class_id, req.dictee_position);
      if (ok) {
        toast.success(`Demande approuvée pour ${req.student_name}`);
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
      } else {
        toast.error("Erreur lors de l'approbation — dictée non déverrouillée");
      }
    } catch {
      toast.error("Erreur inattendue lors de l'approbation");
    }
  };

  const handleReject = async (req: UnlockRequest) => {
    const ok = await rejectUnlockRequest(req.id);
    if (ok) {
      toast.success(`Demande refusée`);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } else {
      toast.error("Erreur lors du refus");
    }
  };

  // Pour une demande, retourner les chips d'historique pour les dictées précédentes (positions 1..pos-1)
  const historyChips = (req: UnlockRequest) => {
    const stats = statsByStudent[req.student_id];
    const previousDictees = dictees
      .filter((d) => d.position < req.dictee_position)
      .sort((a, b) => a.position - b.position);

    if (previousDictees.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {previousDictees.map((d) => {
          const s = stats?.[d.id];
          if (!s || s.attempts === 0) {
            return (
              <span
                key={d.id}
                className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200"
                title={`${d.title} : jamais essayée`}
              >
                D{d.position} : —
              </span>
            );
          }
          return (
            <span
              key={d.id}
              className={`text-[10px] px-1.5 py-0.5 rounded border ${colorForScore(s.bestScore)}`}
              title={`${d.title} · meilleur ${s.bestScore}% · ${s.attempts} essai${s.attempts > 1 ? "s" : ""}`}
            >
              D{d.position} : {s.bestScore}% ×{s.attempts}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold text-amber-900 text-sm">
          🔓 Demandes de déverrouillage
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-600 text-white font-bold">
          {requests.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {requests.map((req) => {
          const dictee = dictees.find((d) => d.position === req.dictee_position);
          return (
            <div
              key={req.id}
              className="bg-white border border-amber-300 rounded-md px-3 py-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{req.student_name}</span>
                    <span className="text-xs text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                      {dictee ? `${dictee.title} (D${dictee.position})` : `Dictée ${req.dictee_position}`}
                    </span>
                    <span className="text-[10px] text-gray-400">{relativeTime(req.created_at)}</span>
                  </div>
                  {historyChips(req)}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleApprove(req)}
                    className="p-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                    title="Approuver"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    className="p-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                    title="Refuser"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
