"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadStudentDicteeStats, createUnlockRequest, getDmClassByHub } from "@/lib/dictee-service";
import { useAppStore } from "@/lib/store";
import { getLevel, computeXPFromStats } from "@/lib/gamification";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Dictee {
  id: string;
  title: string;
  position: number;
  share_code: string;
  fill_blanks_text: string;
}

interface DicteeStats {
  bestScore: number;
  attempts: number;
  lastMode: string;
}

interface DicteeGridProps {
  unlockedPositions?: number[];
  onCardClick?: (dictee: { id: string; title: string; position: number }) => void;
}

function getStars(bestScore: number): string {
  if (bestScore >= 90) return "⭐⭐⭐";
  if (bestScore >= 70) return "⭐⭐";
  if (bestScore >= 40) return "⭐";
  return "";
}

export default function DicteeGrid({ unlockedPositions = [1, 2, 3], onCardClick }: DicteeGridProps) {
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [wordCounts, setWordCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, DicteeStats>>({});
  const [loading, setLoading] = useState(true);
  const [classId, setClassId] = useState<string | null>(null);
  const [requestingDictee, setRequestingDictee] = useState<number | null>(null);
  const connectedEleve = useAppStore((s) => s.connectedEleve);

  useEffect(() => {
    const load = async () => {
      const sb = createClient();

      // Résoudre d'abord la classe de l'élève : son niveau détermine le corpus.
      // Fallback '6e' (visiteur/démo sans dm_classes, ex. classeId "test").
      let level: "6e" | "5e" = "6e";
      if (connectedEleve) {
        const dmClass = await getDmClassByHub(connectedEleve.classeId);
        if (dmClass) {
          setClassId(dmClass.id);
          level = dmClass.level;
        }
      }

      // Charger les dictées du niveau de la classe
      const { data: dicts } = await sb
        .from("dictees")
        .select("id, title, position, share_code, fill_blanks_text")
        .eq("level", level)
        .order("position");

      if (dicts) {
        setDictees(dicts);

        // Compter les mots
        const { data: words } = await sb
          .from("dictee_words")
          .select("dictee_id");
        if (words) {
          const counts: Record<string, number> = {};
          for (const w of words) {
            counts[w.dictee_id] = (counts[w.dictee_id] || 0) + 1;
          }
          setWordCounts(counts);
        }
      }

      // Charger les stats de l'élève connecté
      if (connectedEleve) {
        const s = await loadStudentDicteeStats(connectedEleve.eleveId);
        setStats(s);
      }

      setLoading(false);
    };
    load();
  }, [connectedEleve]);

  const handleUnlockRequest = async (position: number) => {
    if (!classId || !connectedEleve) {
      toast.error("Impossible de créer la demande");
      return;
    }

    setRequestingDictee(position);
    const result = await createUnlockRequest(
      classId,
      position,
      connectedEleve.eleveId,
      `${connectedEleve.prenom} ${connectedEleve.nom}`
    );

    if (result) {
      toast.success("Demande envoyée au professeur !");
    } else {
      toast.error("Erreur lors de l'envoi de la demande");
    }
    setRequestingDictee(null);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Calculer la progression
  const completedCount = Object.values(stats).filter((s) => s.bestScore >= 40).length;

  // Calculer XP et niveau
  const totalCorrect = Object.values(stats).reduce((sum, s) => sum + Math.round((s.bestScore / 100) * 15), 0);
  const totalAttempts = Object.values(stats).reduce((sum, s) => sum + s.attempts, 0);
  const perfectCount = Object.values(stats).filter((s) => s.bestScore >= 95).length;
  const xp = computeXPFromStats(totalCorrect, totalAttempts, perfectCount);
  const level = getLevel(xp);
  const totalStars = Object.values(stats).reduce((sum, s) => {
    if (s.bestScore >= 90) return sum + 3;
    if (s.bestScore >= 70) return sum + 2;
    if (s.bestScore >= 40) return sum + 1;
    return sum;
  }, 0);

  return (
    <>
      {/* Progress bar dynamique */}
      <div className="bg-white border-b border-purple-50 px-4 py-[6px] flex items-center gap-3 shrink-0">
        <span className="text-[11px] text-gray-500 whitespace-nowrap">
          {completedCount} / {dictees.length} dictées
        </span>
        <div className="flex-1 bg-gray-200 rounded h-[6px] overflow-hidden">
          <div
            className="bg-gradient-to-r from-purple-600 to-purple-400 h-full rounded transition-all"
            style={{ width: `${dictees.length > 0 ? (completedCount / dictees.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-[11px] text-gray-500 whitespace-nowrap">
          {level.emoji} {level.name} · {xp} XP · {totalStars} ⭐
        </span>
      </div>

      {/* Grille */}
      <div className="flex-1 p-[10px] grid grid-cols-7 gap-2 auto-rows-fr content-stretch
        max-[1024px]:grid-cols-5 max-[1024px]:overflow-y-auto
        max-[640px]:grid-cols-3 max-[640px]:gap-[6px] max-[640px]:p-2
        max-[400px]:grid-cols-2"
      >
        {dictees.map((d) => {
          const unlocked = unlockedPositions.includes(d.position);
          const stat = stats[d.id];
          const hasTried = stat && stat.attempts > 0;
          const stars = hasTried ? getStars(stat.bestScore) : "";
          const nextRequest =
            !unlocked &&
            d.position ===
              Math.min(
                ...dictees
                  .filter((x) => !unlockedPositions.includes(x.position))
                  .map((x) => x.position)
              );

          return (
            <div
              key={d.id}
              onClick={() => {
                if (unlocked && onCardClick) {
                  onCardClick({ id: d.id, title: d.title, position: d.position });
                }
              }}
              className={`
                relative overflow-hidden rounded-xl border-2 p-2 px-[10px] flex flex-col justify-center transition-all
                ${hasTried && unlocked ? "border-l-4 border-l-emerald-500 border-gray-200" : "border-gray-200"}
                ${unlocked && !hasTried ? "bg-white" : ""}
                ${unlocked ? "hover:border-purple-500 hover:shadow-md hover:-translate-y-[1px] cursor-pointer" : "cursor-default"}
              `}
            >
              {/* Lock overlay */}
              {!unlocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1">
                  <span className="bg-black/65 text-white px-[10px] py-[3px] rounded-lg text-[11px] font-semibold">
                    🔒
                  </span>
                  {nextRequest && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnlockRequest(d.position);
                      }}
                      disabled={requestingDictee === d.position}
                      className="bg-blue-500 text-white border-none px-[10px] py-1 rounded-lg text-[10px] font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-wait"
                    >
                      {requestingDictee === d.position ? "..." : "Demander"}
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className={!unlocked ? "opacity-30" : ""}>
                <div className="text-[10px] text-purple-600 font-bold tracking-wide">
                  N°{d.position}
                </div>
                <div className="text-[13px] font-bold text-gray-800 leading-tight my-[2px]">
                  {d.title}
                </div>
                <div className="text-[10px] text-gray-400 max-[640px]:hidden">
                  {wordCounts[d.id] || 0} mots
                </div>
                {stars && <div className="text-[12px] mt-[2px]">{stars}</div>}
                {hasTried && (
                  <div className="text-[10px] text-gray-500">
                    {stat.bestScore}% · {stat.attempts} essai{stat.attempts > 1 ? "s" : ""}
                  </div>
                )}
                {hasTried && stat.bestScore < 100 && (
                  <div className="text-[9px] text-purple-500 mt-0.5">📊 Voir détails</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
