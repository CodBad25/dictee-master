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
import type { DicteeResult } from "@/lib/dictee-service";

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
  const [dmClassId, setDmClassId] = useState<string>("");

  // UI state
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"tableau" | "erreurs">("tableau");
  const [showBilan, setShowBilan] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRow | null>(
    null
  );

  // Load data from Supabase
  const loadData = async () => {
    try {
      const { data: dicteesData } = await supabase
        .from("dm_dictees")
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
        studentsMap[s.id] = { id: s.id, name: s.name };
      });
      setHubStudents(studentsMap);

      // Load dm_class for lock state
      const { data: dmClassData } = await supabase
        .from("dm_classes")
        .select("*")
        .eq("class_id", classId)
        .single();

      if (dmClassData) {
        setDmClassId(dmClassData.id);
        const unlocked = dmClassData.unlocked_positions || [];
        setUnlockedPos(unlocked);
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

  // Refresh presence every 15s
  useEffect(() => {
    const refreshPresence = async () => {
      const online = await loadOnlineStudents();
      setOnlineStudents(online);
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

    // Filter students based on class
    const studentsToShow = Object.entries(hubStudents);

    studentsToShow.forEach(([studentId, student]) => {
      // Skip demo students if not 6T
      if (
        studentId.startsWith("6t-") &&
        selectedClasseName !== "6T"
      ) {
        return;
      }

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
      const totalCorrect = Object.values(resultsByDictee).reduce((a, r) => a + Math.round(r.bestPct * 15 / 100), 0);
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
        <div className="flex items-center gap-3">
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
      <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-2 overflow-x-auto flex-shrink-0">
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
              className={`${selectedStudent ? "h-[55%]" : "h-full"} overflow-y-auto border-b`}
            >
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-purple-600 text-white">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold">Élève ▲</th>
                    {dictees.map((d) => (
                      <th
                        key={d.id}
                        className="px-2 py-2 text-center font-bold text-xs"
                      >
                        D{d.position}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center font-bold">⭐</th>
                    <th className="px-2 py-2 text-center font-bold">XP</th>
                    <th className="px-2 py-2 text-center font-bold">Niv</th>
                    <th className="px-2 py-2 text-center font-bold">Note</th>
                    <th className="px-2 py-2 text-center font-bold">Ess</th>
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
                        const color =
                          r.bestPct >= 80
                            ? "bg-green-100 text-green-700"
                            : r.bestPct >= 50
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700";
                        return (
                          <td
                            key={d.id}
                            className={`px-2 py-2 text-center text-sm ${color}`}
                          >
                            {r.bestPct > 0 ? (
                              <>
                                {r.bestPct}%{r.attempts > 1 && <sub>×{r.attempts}</sub>}
                              </>
                            ) : (
                              "-"
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

                {/* Section B: Dictées travaillées */}
                <div className="mb-4">
                  <h4 className="font-bold mb-2">Dictées travaillées</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {dictees.map((d) => {
                      const r = selectedStudent.results[d.id];
                      const color =
                        r.bestPct >= 80
                          ? "bg-green-100 text-green-700"
                          : r.bestPct >= 50
                            ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700";
                      return (
                        <div
                          key={d.id}
                          className={`p-2 rounded text-center text-xs font-bold ${
                            r.bestPct > 0
                              ? color
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <div>{r.bestPct}%</div>
                          <div>
                            {getStars(r.bestPct)} ⭐
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
