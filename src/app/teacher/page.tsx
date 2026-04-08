"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { getClasses, getEleves, type HubClasse } from "@/lib/hub";
import { useAnonymize, useDisplayName } from "@/lib/anonymize";
import { loadOnlineStudents } from "@/lib/presence";
import {
  generateClassPDF,
  exportPronote,
  exportExcel,
} from "@/lib/pdf-export";
import {
  BADGES,
  getMasteryLevel,
  getPerseveranceLevel,
  generateAppreciation,
  getLevel,
  computeXPFromStats,
  getCertificateLevel,
} from "@/lib/gamification";
import BilanPreview from "@/components/bilan-preview";
import AdminBugs from "@/components/admin-bugs";
import ParcoursConfig from "@/components/parcours-config";
import GuidedTour, { shouldShowTour, type TourStep } from "@/components/guided-tour";
import type { DicteeResult } from "@/lib/dictee-service";

const PARCOURS_TOUR_STEPS: TourStep[] = [
  {
    target: "class-tabs",
    title: "Bienvenue sur DictéeMaster !",
    description: "Sélectionnez une classe pour commencer. Chaque classe a ses propres réglages : dictées déverrouillées, ordre des exercices, et mots à travailler.",
    position: "bottom",
  },
  {
    target: "lock-bar",
    title: "Gérez vos dictées",
    description: "Cliquez sur un numéro pour verrouiller ou déverrouiller une dictée. Les élèves ne peuvent accéder qu'aux dictées déverrouillées.",
    position: "bottom",
  },
  {
    target: "parcours-config-button",
    title: "Nouveau : le bouton Parcours !",
    description: "Personnalisez l'ordre des exercices, activez ou désactivez des activités, et choisissez quels mots sont travaillés dans chaque dictée.",
    position: "bottom",
  },
  {
    target: "default-order-section",
    title: "Glissez pour réordonner",
    description: "Maintenez et glissez les exercices pour changer leur ordre. Utilisez le toggle à droite pour activer ou désactiver une activité.",
    position: "right",
    clickBefore: "parcours-config-button",
  },
  {
    target: "dictee-selector",
    title: "Personnalisez par dictée",
    description: "Cliquez sur un numéro pour personnaliser le parcours d'une dictée spécifique : ordre des exercices et sélection des mots.",
    position: "top",
  },
];

// Interfaces
interface Dictee {
  id: string;
  title: string;
  position: number;
}

interface StudentRow {
  id: string;
  name: string;
  lastName: string;
  results: Record<string, { bestPct: number; attempts: number }>;
  totalAttempts: number;
  totalStars: number;
  note20: number;
  xp: number;
  level: { name: string; emoji: string };
}

interface CommonError {
  word: string;
  dicteeTitle: string;
  count: number;
  wrongAnswers: string[];
}

// Helper functions
function getLastName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : fullName;
}

function getStars(pct: number): number {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 40) return 1;
  return 0;
}

function note20(res: Record<string, { bestPct: number }>, maxD: number): number {
  if (maxD === 0) return 0;
  const stars = Object.values(res).reduce((a, r) => a + getStars(r.bestPct), 0);
  const maxStars = maxD * 3;
  return maxStars > 0 ? Math.round((stars / maxStars) * 20) : 0;
}

export default function TeacherPage() {
  const router = useRouter();
  const { user } = useAppStore();
  const supabase = createClient();
  const anon = useAnonymize();
  const dn = useDisplayName();

  // Data state
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [results, setResults] = useState<Record<string, DicteeResult>>({});
  const [wordAttempts, setWordAttempts] = useState<Record<string, any>>({});

  // Hub & class state
  const [hubClasses, setHubClasses] = useState<HubClasse[]>([]);
  const [hubStudents, setHubStudents] = useState<
    Record<string, { id: string; name: string }>
  >({});
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [selectedClasseName, setSelectedClasseName] = useState<string>("");

  // Presence state
  const [onlineStudents, setOnlineStudents] = useState<Map<string, any>>(new Map());

  // Lock state
  const [unlockedPos, setUnlockedPos] = useState<number[]>([]);
  const [dmClassId, setDmClassId] = useState<string | null>("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tableau" | "erreurs">("tableau");
  const [showBilan, setShowBilan] = useState(false);
  const [showBugs, setShowBugs] = useState(false);
  const [showParcours, setShowParcours] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(
    null
  );

  // Load data from Supabase
  const loadData = async () => {
    try {
      const { data: dicteesData } = await supabase
        .from("dictees")
        .select("*")
        .order("position", { ascending: true });

      if (dicteesData) {
        setDictees(dicteesData);
      }

      const { data: resultsData } = await supabase
        .from("dm_results")
        .select("*");

      if (resultsData) {
        const resultsMap: Record<string, DicteeResult> = {};
        resultsData.forEach((r: any) => {
          resultsMap[r.id] = r;
        });
        setResults(resultsMap);
      }

      const { data: wordsData } = await supabase
        .from("dm_word_attempts")
        .select("*");

      if (wordsData) {
        const wordsMap: Record<string, any> = {};
        wordsData.forEach((w: any) => {
          wordsMap[w.id] = w;
        });
        setWordAttempts(wordsMap);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erreur lors du chargement des données");
    }
  };

  // Load Hub classes
  const loadHub = async () => {
    try {
      const classes = await getClasses();
      setHubClasses(classes);
      if (classes.length > 0) {
        pickClass(classes[0].id, classes[0].nom);
      }
    } catch (error) {
      console.error("Error loading Hub classes:", error);
      toast.error("Erreur lors du chargement des classes");
    }
  };

  // Pick a class and load its students
  const pickClass = async (classId: string, className: string) => {
    try {
      setSelectedClasse(classId);
      setSelectedClasseName(className);

      const students = await getEleves(classId);
      const studentsMap: Record<string, { id: string; name: string }> = {};
      students.forEach((s: any) => {
        studentsMap[s.id] = { id: s.id, name: `${s.prenom} ${s.nom}` };
      });
      setHubStudents(studentsMap);

      // Load dm_class for lock state
      const { data: dmClassData } = await supabase
        .from("dm_classes")
        .select("*")
        .eq("name", className)
        .eq("teacher_id", "teacher")
        .maybeSingle();

      if (dmClassData) {
        setDmClassId(dmClassData.id);
        setUnlockedPos(dmClassData.unlocked_dictees || [1]);
      } else {
        // Auto-créer la classe si elle n'existe pas
        const { data: newClass } = await supabase
          .from("dm_classes")
          .insert({
            teacher_id: "teacher",
            name: className,
            unlocked_dictees: [1],
            default_activity_order: ["flashcard", "genre", "spelling_choice", "definitions", "dictionary", "audio_word", "fill_blanks", "audio_dictation"],
          })
          .select()
          .single();
        if (newClass) {
          setDmClassId(newClass.id);
        } else {
          setDmClassId(null);
        }
        setUnlockedPos([1]);
      }
    } catch (error) {
      console.error("Error picking class:", error);
      toast.error("Erreur lors du chargement de la classe");
    }
  };

  // Toggle lock/unlock
  const toggleLock = async (position: number) => {
    const newUnlocked = unlockedPos.includes(position)
      ? unlockedPos.filter((p) => p !== position)
      : [...unlockedPos, position];

    setUnlockedPos(newUnlocked);

    if (dmClassId) {
      try {
        await supabase
          .from("dm_classes")
          .update({ unlocked_positions: newUnlocked })
          .eq("id", dmClassId);
      } catch (error) {
        console.error("Error updating lock state:", error);
        toast.error("Erreur lors de la mise à jour");
      }
    }
  };

  // Refresh presence every 15s — silencieux si la table n'existe pas
  useEffect(() => {
    const refreshPresence = async () => {
      try {
        const online = await loadOnlineStudents();
        setOnlineStudents(online);
      } catch {
        // Silencieux — dm_presence peut ne pas exister encore
      }
    };

    refreshPresence();
    const interval = setInterval(refreshPresence, 15000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      await loadHub();
      setLoading(false);
      if (shouldShowTour("parcours")) setShowTour(true);
    };

    init();
  }, []);

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Build student rows
  const getStudentRows = (): StudentRow[] => {
    const maxDictees = dictees.length;
    const rows: StudentRow[] = [];

    // Hub students + demo students from results (for 6T)
    const allStudents: Record<string, { id: string; name: string }> = { ...hubStudents };

    // Ajouter les élèves démo issus des résultats pour 6T
    if (selectedClasseName === "6T") {
      Object.values(results).forEach((r: any) => {
        if (r.student_id?.startsWith("6t-") && !allStudents[r.student_id]) {
          allStudents[r.student_id] = { id: r.student_id, name: r.student_name || "Élève" };
        }
      });
    }

    Object.entries(allStudents).forEach(([studentId, student]) => {

      const studentResults = Object.values(results).filter(
        (r: any) => r.student_id === studentId
      );

      let totalStars = 0;
      let totalAttempts = 0;
      const resultsByDictee: Record<string, { bestPct: number; attempts: number }> =
        {};

      dictees.forEach((d) => {
        const dResults = studentResults.filter((r: any) => r.dictee_id === d.id);
        if (dResults.length > 0) {
          const bestPct = Math.max(...dResults.map((r: any) => r.percentage));
          const stars = getStars(bestPct);
          totalStars += stars;
          totalAttempts += dResults.length;
          resultsByDictee[d.id] = { bestPct, attempts: dResults.length };
        } else {
          resultsByDictee[d.id] = { bestPct: 0, attempts: 0 };
        }
      });

      const n20 = note20(resultsByDictee, maxDictees);
      const perfectCount = Object.values(resultsByDictee).filter(r => r.bestPct >= 95).length;
      const totalCorrect = Object.values(resultsByDictee).reduce((a, r) => a + Math.round(r.bestPct * 20 / 100), 0);
      const xp = computeXPFromStats(totalCorrect, totalAttempts, perfectCount);
      const level = getLevel(xp);
      const lastName = getLastName(student.name);

      rows.push({
        id: studentId,
        name: student.name,
        lastName,
        results: resultsByDictee,
        totalAttempts,
        totalStars,
        note20: n20,
        xp,
        level,
      });
    });

    return rows.sort((a, b) => a.lastName.localeCompare(b.lastName));
  };

  const studentRows = getStudentRows();
  const maxDictees = dictees.length;

  // Calculate common errors
  const getCommonErrors = (): CommonError[] => {
    const errorMap: Record<string, CommonError> = {};

    Object.values(wordAttempts).forEach((wa: any) => {
      const word = wa.word || "?";
      const dictee = dictees.find((d) => d.id === wa.dictee_id);
      const key = `${word}-${wa.dictee_id}`;

      if (!errorMap[key]) {
        errorMap[key] = {
          word,
          dicteeTitle: dictee?.title || "Dictée ?",
          count: 0,
          wrongAnswers: [],
        };
      }

      errorMap[key].count += wa.error_count || 0;
      if (wa.wrong_answers && !errorMap[key].wrongAnswers.includes(wa.wrong_answers)) {
        errorMap[key].wrongAnswers.push(wa.wrong_answers);
      }
    });

    return Object.values(errorMap).sort((a, b) => b.count - a.count);
  };

  const commonErrors = getCommonErrors();

  return (
    <main className="h-dvh flex flex-col overflow-hidden bg-gray-50">
      {/* Header - Purple bar */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 flex items-center justify-between z-20">
        <div data-tour="class-tabs" className="flex items-center gap-3">
          {hubClasses.map((hc) => (
            <button
              key={hc.id}
              onClick={() => pickClass(hc.id, hc.nom)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedClasse === hc.id
                  ? "bg-white text-purple-600"
                  : "bg-white/20 hover:bg-white/30"
              }`}
            >
              {hc.nom}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/student")}
            className="px-3 py-1 rounded text-sm hover:bg-white/10"
          >
            🧪 Tester
          </button>
          <button
            onClick={() => setShowBugs(true)}
            className="px-3 py-1 rounded text-sm hover:bg-white/10"
          >
            🐛 Signalements
          </button>
          <button
            onClick={() => setTab("erreurs")}
            className={`px-3 py-1 rounded text-sm ${
              tab === "erreurs"
                ? "bg-white/20"
                : "hover:bg-white/10"
            }`}
          >
            ⚠️ Erreurs
          </button>
          <button
            onClick={() => anon.toggle(studentRows.map(s => s.name))}
            className="px-3 py-1 rounded text-sm hover:bg-white/10"
          >
            {anon.active ? "🔓 Démasquer" : "🎭 Anonymiser"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-3 py-1 rounded text-sm bg-red-500 hover:bg-red-600"
          >
            Quitter
          </button>
        </div>
      </div>

      {/* Lock bar */}
      <div data-tour="lock-bar" className="bg-gray-50 border-b px-4 py-3 flex items-center gap-2 overflow-x-auto flex-shrink-0">
        <div className="flex items-center gap-2 flex-1">
          {Array.from({ length: 26 }).map((_, i) => {
            const pos = i + 1;
            const isUnlocked = unlockedPos.includes(pos);
            return (
              <button
                key={pos}
                onClick={() => toggleLock(pos)}
                className={`w-8 h-8 rounded text-xs font-bold transition-all ${
                  isUnlocked
                    ? "bg-purple-500 text-white"
                    : "bg-gray-300 text-gray-600"
                }`}
              >
                {pos}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            data-tour="parcours-config-button"
            onClick={() => {
              if (!dmClassId) {
                toast.error("Sélectionnez d'abord une classe");
                return;
              }
              setShowParcours(true);
            }}
            className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
          >
            🎯 Parcours
          </button>
          <button
            onClick={() => setShowBilan(true)}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            📊 Bilan
          </button>
          <button
            onClick={() => { const d = studentRows.map(s => ({ name: s.name, scores: Object.fromEntries(Object.entries(s.results).map(([k,v]) => [k, v.bestPct])), attempts: s.totalAttempts, totalStars: s.totalStars, note20: s.note20 })); exportPronote(d, dictees); toast.success("Copié !"); }}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
          >
            📋 Pronote
          </button>
          <button
            onClick={() => { const d = studentRows.map(s => ({ name: s.name, scores: Object.fromEntries(Object.entries(s.results).map(([k,v]) => [k, v.bestPct])), attempts: s.totalAttempts, totalStars: s.totalStars, note20: s.note20 })); exportExcel(d, dictees, selectedClasseName, dn); toast.success("CSV téléchargé !"); }}
            className="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600"
          >
            📥 Excel
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "tableau" ? (
          <>
            {/* Table */}
            <div
              className={`${selectedStudent ? "h-[55%]" : "h-full"} overflow-auto border-b`}
            >
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-20 bg-purple-600 text-white">
                  <tr>
                    <th className="p-1 px-2 text-left font-semibold sticky left-0 bg-purple-600 z-30 min-w-[100px]">Élève ▲</th>
                    {dictees.map((d) => (
                      <th key={d.id} className="p-1 text-center font-semibold min-w-[32px]" title={d.title}>
                        {d.position}
                      </th>
                    ))}
                    <th className="p-1 text-center font-semibold">⭐</th>
                    <th className="p-1 text-center font-semibold">XP</th>
                    <th className="p-1 text-center font-semibold">Niv</th>
                    <th className="p-1 text-center font-semibold min-w-[40px]">Note</th>
                    <th className="p-1 text-center font-semibold">Ess</th>
                  </tr>
                </thead>
                <tbody>
                  {studentRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedStudent(row)}
                      className={`cursor-pointer hover:bg-purple-100 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                      }`}
                    >
                      <td className="px-4 py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              onlineStudents.has(row.id)
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />
                          {anon.active ? (
                            <span>{dn(row.name)}</span>
                          ) : (
                            <span>
                              {(row.name || "").split(" ")[0]} {row.lastName?.[0] || ""}.
                            </span>
                          )}
                        </div>
                      </td>
                      {dictees.map((d) => {
                        const r = row.results[d.id];
                        const pct = r?.bestPct || 0;
                        const color = pct >= 80
                          ? "bg-green-100 text-green-700"
                          : pct >= 50
                            ? "bg-amber-100 text-amber-700"
                            : pct > 0
                              ? "bg-red-100 text-red-700"
                              : "";
                        return (
                          <td
                            key={d.id}
                            className={`p-0.5 text-center font-bold ${color}`}
                          >
                            {pct > 0 ? (
                              <>
                                {Math.round(pct * 20 / 100)}
                                {r?.attempts > 1 && <sub className="text-[8px] opacity-50">×{r.attempts}</sub>}
                              </>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        {row.totalStars}
                      </td>
                      <td className="px-2 py-2 text-center">{row.xp}</td>
                      <td className="px-2 py-2 text-center">
                        {row.level.emoji} {row.level.name}
                      </td>
                      <td className="px-2 py-2 text-center font-bold">
                        {row.note20}/20
                      </td>
                      <td className="px-2 py-2 text-center">
                        {row.totalAttempts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Student detail panel */}
            {selectedStudent && (
              <div className="h-[45%] bg-white border-t overflow-y-auto p-4">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>

                {/* Section A: Name + Note + Mastery + Stats */}
                <div className="mb-4 flex items-center gap-4 border-b pb-4">
                  <div>
                    <h3 className="font-bold text-lg">
                      {anon.active ? dn(selectedStudent.name) : selectedStudent.name}
                    </h3>
                  </div>
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl">
                    {selectedStudent.note20}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {getMasteryLevel(selectedStudent.note20).emoji}{" "}{getMasteryLevel(selectedStudent.note20).name}{" "}
                      {selectedStudent.level.emoji} {selectedStudent.level.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedStudent.totalStars} stars · {selectedStudent.totalAttempts} essais
                    </p>
                  </div>
                </div>

                {/* Section B: Dictées programmées (déverrouillées uniquement) */}
                <div className="mb-4">
                  <h4 className="font-bold mb-2">Dictées programmées ({unlockedPos.length})</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {dictees.filter(d => unlockedPos.includes(d.position)).map((d) => {
                      const r = selectedStudent.results[d.id];
                      const pct = r?.bestPct || 0;
                      const color =
                        pct >= 80
                          ? "bg-green-100 text-green-700"
                          : pct >= 50
                            ? "bg-amber-100 text-amber-700"
                            : pct > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-400";
                      return (
                        <div
                          key={d.id}
                          className={`p-2 rounded text-center text-xs font-bold ${color}`}
                        >
                          <div className="text-[9px] text-purple-600 mb-0.5">D{d.position}</div>
                          <div>{pct > 0 ? `${Math.round(pct * 20 / 100)}/20` : "—"}</div>
                          <div>
                            {pct > 0 ? "⭐".repeat(getStars(pct)) : ""}
                          </div>
                          {r.attempts > 1 && <div>×{r.attempts}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section C: Badges */}
                <div className="mb-4">
                  <h4 className="font-bold mb-2">Badges</h4>
                  <div className="grid grid-cols-8 gap-2">
                    {BADGES.map((badge) => {
                      const dicteesTried = Object.values(selectedStudent.results).filter(r => r.bestPct > 0).length;
                      const maxAttempts = Math.max(...Object.values(selectedStudent.results).map(r => r.attempts), 0);
                      const perfectCount = Object.values(selectedStudent.results).filter(r => r.bestPct >= 95).length;
                      const isEarned = badge.id === "premier-pas" ? dicteesTried >= 1 : badge.id === "perseverant" ? maxAttempts >= 10 : badge.id === "zero-faute" ? perfectCount >= 1 : badge.id === "marathonien" ? selectedStudent.totalAttempts >= 50 : badge.id === "explorateur" ? dicteesTried >= 10 : false;
                      return (
                        <div
                          key={badge.id}
                          className={`text-center p-2 rounded ${
                            isEarned
                              ? "bg-amber-100"
                              : "bg-gray-100 opacity-20 grayscale"
                          }`}
                        >
                          <div className="text-2xl">{badge.emoji}</div>
                          <div className="text-xs font-bold text-gray-600">
                            {badge.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section D: Auto-appreciation */}
                <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">📝</span>
                    <p className="text-sm text-gray-700">
                      {generateAppreciation({
                        totalAttempts: selectedStudent.totalAttempts,
                        dicteesTried: Object.values(selectedStudent.results).filter(r => r.bestPct > 0).length,
                        totalDictees: dictees.length,
                        avgBestPct: (() => { const tried = Object.values(selectedStudent.results).filter(r => r.bestPct > 0); return tried.length > 0 ? tried.reduce((a, r) => a + r.bestPct, 0) / tried.length : 0; })(),
                        perfectCount: Object.values(selectedStudent.results).filter(r => r.bestPct >= 95).length,
                        improvementCount: 0,
                        streak: 0,
                        weakDictees: Object.entries(selectedStudent.results).filter(([_,r]) => r.bestPct > 0 && r.bestPct < 50).map(([dId]) => dictees.find(d => d.id === dId)?.position || 0),
                        strongDictees: Object.entries(selectedStudent.results).filter(([_,r]) => r.bestPct >= 80).map(([dId]) => dictees.find(d => d.id === dId)?.position || 0),
                      })}
                    </p>
                  </div>
                </div>

                {/* Section E: Certificate level */}
                {(() => {
                  const dt = Object.values(selectedStudent.results).filter(r => r.bestPct > 0).length;
                  const cert = getCertificateLevel(selectedStudent.note20, dt, 3);
                  return cert ? (
                    <div className="p-3 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{cert.emoji}</span>
                        <div>
                          <div className="font-bold text-amber-900 text-xs">{cert.name}</div>
                          <div className="text-[9px] text-amber-700">{cert.mention}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-center">
                      <span className="text-[10px] text-gray-400">🎓 Certificat après 3 dictées ({dt} actuellement)</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        ) : (
          /* Erreurs tab */
          <div className="overflow-y-auto p-4">
            <h3 className="font-bold text-lg mb-4">Erreurs les plus fréquentes</h3>
            <div className="grid grid-cols-3 gap-4">
              {commonErrors.slice(0, 50).map((err, idx) => (
                <div
                  key={idx}
                  className="bg-white border rounded-lg p-4 shadow-sm"
                >
                  <div className="inline-block bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold mb-2">
                    {err.count}
                  </div>
                  <p className="font-bold text-lg mb-1">{err.word}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    {err.dicteeTitle}
                  </p>
                  <div className="space-y-1">
                    {err.wrongAnswers.slice(0, 3).map((wa, i) => (
                      <p key={i} className="text-xs text-gray-600 line-through">
                        {wa}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GuidedTour */}
      {showTour && <GuidedTour tourId="parcours" steps={PARCOURS_TOUR_STEPS} onComplete={() => { setShowTour(false); setShowParcours(false); }} />}

      {/* Admin Bugs Modal */}
      <AdminBugs open={showBugs} onClose={() => setShowBugs(false)} />

      {/* Parcours Config Modal */}
      {showParcours && dmClassId !== null && dmClassId !== "" && (
        <ParcoursConfig
          open={showParcours}
          onClose={() => setShowParcours(false)}
          dmClassId={dmClassId}
          className={selectedClasseName}
          dictees={dictees.map(d => ({ id: d.id, title: d.title, position: d.position }))}
        />
      )}

      {/* Bilan Preview Modal */}
      {showBilan && (
        <BilanPreview
          open={showBilan}
          onClose={() => setShowBilan(false)}
          students={studentRows.map(s => ({
            name: s.name,
            lastName: s.lastName,
            scores: Object.fromEntries(Object.entries(s.results).map(([k,v]) => [k, v.bestPct])),
            attemptsPerDictee: Object.fromEntries(Object.entries(s.results).map(([k,v]) => [k, v.attempts])),
            attempts: s.totalAttempts,
            totalStars: s.totalStars,
            note20: s.note20,
          }))}
          dictees={dictees}
          className={selectedClasseName}
        />
      )}
    </main>
  );
}
