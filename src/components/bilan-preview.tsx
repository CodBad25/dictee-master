"use client";

import { useState, useRef, useEffect } from "react";
import { X, Download, FileText, Printer, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDisplayName } from "@/lib/anonymize";
import { generateClassPDF, exportPronote, exportExcel } from "@/lib/pdf-export";
import { getCertificateLevel } from "@/lib/gamification";
import { toast } from "sonner";

interface StudentStat {
  name: string;
  lastName: string;
  scores: Record<string, number>;
  attemptsPerDictee: Record<string, number>;
  attempts: number;
  totalStars: number;
  note20: number;
}

interface DicteeInfo {
  id: string;
  position: number;
  title: string;
}

interface BilanPreviewProps {
  open: boolean;
  onClose: () => void;
  students: StudentStat[];
  dictees: DicteeInfo[];
  className: string;
}

function getStars(pct: number) { return pct >= 90 ? 3 : pct >= 70 ? 2 : pct >= 40 ? 1 : 0; }

function getMasteryLevel(note20: number) {
  if (note20 >= 17) return { emoji: "🏆", label: "Excellence", color: "bg-purple-100 text-purple-700 border-purple-300" };
  if (note20 >= 13) return { emoji: "👍", label: "Bien", color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (note20 >= 9) return { emoji: "📈", label: "En progrès", color: "bg-amber-100 text-amber-700 border-amber-300" };
  return { emoji: "💪", label: "À encourager", color: "bg-red-100 text-red-700 border-red-300" };
}

function getPerseveranceLevel(attempts: number) {
  if (attempts >= 30) return { emoji: "🌲", level: "Très engagé" };
  if (attempts >= 16) return { emoji: "🌳", level: "Motivé" };
  if (attempts >= 6) return { emoji: "🌿", level: "Déterminé" };
  return { emoji: "🌱", level: "Apprenti" };
}

export default function BilanPreview({ open, onClose, students, dictees, className }: BilanPreviewProps) {
  const dn = useDisplayName();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentStat | null>(null);

  const sorted = [...students].sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));

  // Stats globales
  const notes = sorted.map((s) => s.note20);
  const avg = notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
  const sortedNotes = [...notes].sort((a, b) => a - b);
  const median = sortedNotes.length === 0 ? 0 : sortedNotes.length % 2 === 0 ? (sortedNotes[sortedNotes.length / 2 - 1] + sortedNotes[sortedNotes.length / 2]) / 2 : sortedNotes[Math.floor(sortedNotes.length / 2)];
  const min = notes.length > 0 ? Math.min(...notes) : 0;
  const max = notes.length > 0 ? Math.max(...notes) : 0;

  const excellent = notes.filter((n) => n >= 17).length;
  const bien = notes.filter((n) => n >= 13 && n < 17).length;
  const fragile = notes.filter((n) => n >= 9 && n < 13).length;
  const insuffisant = notes.filter((n) => n < 9).length;

  // Histogramme
  useEffect(() => {
    if (!open || !canvasRef.current) return;
    const timer = setTimeout(drawHistogram, 100);
    return () => clearTimeout(timer);

    function drawHistogram() {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const w = canvas.width, h = canvas.height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);

      const bins = [0, 0, 0, 0, 0];
      notes.forEach((n) => { bins[n <= 4 ? 0 : n <= 8 ? 1 : n <= 12 ? 2 : n <= 16 ? 3 : 4]++; });
      const maxBin = Math.max(...bins, 1);
      const colors = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#a855f7"];
      const labels = ["0-4", "5-8", "9-12", "13-16", "17-20"];
      const px = 25, py = 20, pb = 22;
      const barW = (w - 2 * px) / 5;
      const chartH = h - py - pb;

      // Grille
      ctx.strokeStyle = "#f1f5f9";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const gy = py + chartH * (i / 4);
        ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(w - px, gy); ctx.stroke();
      }

      // Barres
      bins.forEach((count, i) => {
        const bh = (count / maxBin) * chartH;
        const bx = px + i * barW + 4;
        const bw = barW - 8;
        const by = py + chartH - bh;
        ctx.fillStyle = colors[i];
        if (bh > 0) {
          ctx.beginPath();
          const r = Math.min(4, bw / 2);
          ctx.moveTo(bx + r, by); ctx.lineTo(bx + bw - r, by);
          ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
          ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh);
          ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
          ctx.fill();
        }
        if (count > 0) {
          ctx.fillStyle = "#1e293b"; ctx.font = "bold 13px Inter, sans-serif"; ctx.textAlign = "center";
          ctx.fillText(count.toString(), bx + bw / 2, by - 5);
        }
        ctx.fillStyle = "#64748b"; ctx.font = "11px Inter, sans-serif";
        ctx.fillText(labels[i], bx + bw / 2, h - 6);
      });
    }
  }, [open, notes]);

  const exportData = sorted.map((s) => ({
    name: s.name, scores: s.scores, attempts: s.attempts, totalStars: s.totalStars, note20: s.note20,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-[95vw] max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-white to-purple-50/30 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">📊 Bilan de classe — {className}</h2>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — {sorted.length} élèves
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-xs" onClick={() => { generateClassPDF(exportData, dictees, className, dn); toast.success("PDF téléchargé !"); }}>
              <Download className="w-3.5 h-3.5 mr-1" /> PDF Classe
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => { exportPronote(exportData, dictees); toast.success("Copié ! Collez dans Pronote."); }}>
              <FileText className="w-3.5 h-3.5 mr-1" /> Pronote
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={async () => { await exportExcel(exportData, dictees, className, dn); toast.success("Excel téléchargé !"); }}>
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5 mr-1" /> Imprimer
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats cards */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: "Moyenne", value: avg.toFixed(1), sub: "/20", bg: "bg-purple-50 border-purple-200", text: "text-purple-600" },
              { label: "Médiane", value: median.toFixed(1), sub: "/20", bg: "bg-blue-50 border-blue-200", text: "text-blue-600" },
              { label: "Min", value: min.toString(), sub: "/20", bg: "bg-red-50 border-red-200", text: "text-red-600" },
              { label: "Max", value: max.toString(), sub: "/20", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-600" },
              { label: "Élèves", value: sorted.length.toString(), sub: "", bg: "bg-amber-50 border-amber-200", text: "text-amber-600" },
            ].map((c) => (
              <div key={c.label} className={`${c.bg} border rounded-xl p-3 text-center shadow-sm`}>
                <div className={`text-2xl font-black ${c.text}`}>{c.value}<span className="text-sm font-medium">{c.sub}</span></div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Histogramme + Niveaux */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border rounded-xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-gray-600 mb-2">Répartition des notes</h3>
              <canvas ref={canvasRef} width={400} height={180} className="w-full rounded bg-white" />
            </div>
            <div className="bg-gray-50 border rounded-xl p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-gray-600 mb-2">Niveaux de maîtrise</h3>
              {[
                { label: "Excellent (17-20)", count: excellent, color: "bg-purple-600", text: "text-purple-700" },
                { label: "Bien (13-16)", count: bien, color: "bg-emerald-500", text: "text-emerald-700" },
                { label: "Fragile (9-12)", count: fragile, color: "bg-amber-400", text: "text-amber-700" },
                { label: "Insuffisant (0-8)", count: insuffisant, color: "bg-red-500", text: "text-red-700" },
              ].map((lev) => {
                const pct = sorted.length > 0 ? (lev.count / sorted.length) * 100 : 0;
                return (
                  <div key={lev.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className={`${lev.text} font-medium`}>{lev.label}</span>
                      <span className={`${lev.text} font-bold`}>{lev.count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div className={`${lev.color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tableau élèves */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-purple-600 text-white">
                  <th className="p-1.5 px-2 text-left font-semibold border-r border-purple-500">Élève</th>
                  {dictees.map((d) => (
                    <th key={d.id} title={d.title} className="p-1 text-center font-semibold border-r border-purple-500 min-w-[36px]">{d.position}</th>
                  ))}
                  <th className="p-1 text-center font-semibold border-r border-purple-500">⭐</th>
                  <th className="p-1 text-center font-semibold border-r border-purple-500 min-w-[44px]">Note</th>
                  <th className="p-1 text-center font-semibold">Ess</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const name = dn(s.name);
                  const short = name.split(" ")[0] + " " + (name.split(" ").pop()?.[0] || "") + ".";
                  return (
                    <tr key={s.name} onClick={() => setSelectedStudent(s)}
                      className={`cursor-pointer hover:bg-purple-50 transition ${i % 2 === 0 ? "" : "bg-slate-50"}`}>
                      <td className="p-1.5 px-2 font-semibold border-r border-slate-200 whitespace-nowrap">{short}</td>
                      {dictees.map((d) => {
                        const pct = s.scores[d.id];
                        return (
                          <td key={d.id} className={`p-0.5 text-center border-r border-slate-200 font-bold ${
                            pct === undefined ? "text-slate-200" :
                            pct >= 80 ? "text-green-600 bg-green-50" :
                            pct >= 50 ? "text-amber-600 bg-amber-50" :
                            "text-red-600 bg-red-50"
                          }`}>
                            {pct !== undefined ? Math.round(pct * 20 / 100) : "—"}
                          </td>
                        );
                      })}
                      <td className="p-1 text-center border-r border-slate-200 text-amber-500 font-bold">{s.totalStars || "—"}</td>
                      <td className={`p-1 text-center border-r border-slate-200 font-bold ${
                        s.note20 >= 16 ? "text-green-600" : s.note20 >= 10 ? "text-amber-600" : s.note20 > 0 ? "text-red-600" : "text-slate-200"
                      }`}>{s.note20 > 0 ? `${s.note20}/20` : "—"}</td>
                      <td className="p-1 text-center border-slate-200 text-slate-400">{s.attempts || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
              {/* Ligne moyenne */}
              <tfoot>
                <tr className="bg-purple-600 text-white font-semibold">
                  <td className="p-1.5 px-2 border-r border-purple-500">Moyenne</td>
                  {dictees.map((d) => {
                    const scores = sorted.map((s) => s.scores[d.id]).filter((s) => s !== undefined);
                    const a = scores.length > 0 ? (scores.reduce((sum, s) => sum + s, 0) / scores.length * 20 / 100).toFixed(1) : "—";
                    return <td key={d.id} className="p-1 text-center border-r border-purple-500">{a}</td>;
                  })}
                  <td className="p-1 text-center border-r border-purple-500">
                    {sorted.length > 0 ? (sorted.reduce((sum, s) => sum + s.totalStars, 0) / sorted.length).toFixed(1) : "—"}
                  </td>
                  <td className="p-1 text-center border-r border-purple-500">{avg.toFixed(1)}/20</td>
                  <td className="p-1 text-center">
                    {sorted.length > 0 ? Math.round(sorted.reduce((sum, s) => sum + s.attempts, 0) / sorted.length) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Fiche élève sélectionné */}
          {selectedStudent && (() => {
            const mastery = getMasteryLevel(selectedStudent.note20);
            const perseverance = getPerseveranceLevel(selectedStudent.attempts);
            const dicteesDone = Object.keys(selectedStudent.scores).filter((id) => selectedStudent.scores[id] !== undefined).length;
            return (
              <div className="bg-gradient-to-br from-purple-50 via-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 shadow-md">
                {/* Header: Nom + Note + Badges */}
                <div className="flex justify-between items-start mb-5">
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-purple-900 mb-3">{dn(selectedStudent.name)}</h3>
                    <div className="flex gap-4 items-center">
                      {/* Cercle Note /20 */}
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-purple-700 flex items-center justify-center shadow-lg">
                        <div className="text-center">
                          <div className="text-3xl font-black text-white">{selectedStudent.note20}</div>
                          <div className="text-[10px] text-white font-semibold">/20</div>
                        </div>
                      </div>
                      {/* Badge Maîtrise */}
                      <div className={`border-2 rounded-lg px-3 py-2 text-center ${mastery.color}`}>
                        <div className="text-xl">{mastery.emoji}</div>
                        <div className="text-sm font-bold">{mastery.label}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white text-xs" onClick={() => { toast.info("PDF élève - à implémenter"); }}>
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedStudent(null)} className="text-xs hover:bg-purple-200">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Stats résumé */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-white border border-purple-200 rounded-lg p-3 text-center shadow-xs">
                    <div className="text-xs text-gray-500 font-medium mb-1">Dictées</div>
                    <div className="text-lg font-black text-purple-600">{dicteesDone}/{dictees.length}</div>
                  </div>
                  <div className="bg-white border border-amber-200 rounded-lg p-3 text-center shadow-xs">
                    <div className="text-xs text-gray-500 font-medium mb-1">Répétitions</div>
                    <div className="text-lg font-black text-amber-600">{selectedStudent.attempts}</div>
                  </div>
                  <div className={`bg-white border rounded-lg p-3 text-center shadow-xs ${perseverance.emoji === "🌱" ? "border-green-200" : perseverance.emoji === "🌿" ? "border-lime-200" : perseverance.emoji === "🌳" ? "border-emerald-200" : "border-teal-200"}`}>
                    <div className="text-xs text-gray-500 font-medium mb-1">Persévérance</div>
                    <div className="text-sm font-bold">{perseverance.emoji} {perseverance.level}</div>
                  </div>
                </div>

                {/* Scores par dictée - 2 lignes */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-gray-600 mb-3">Résultats par dictée</h4>
                  <div className="grid grid-cols-13 gap-2">
                    {dictees.slice(0, 13).map((d) => {
                      const pct = selectedStudent.scores[d.id];
                      const attempts = selectedStudent.attemptsPerDictee[d.id] || 0;
                      const stars = pct !== undefined ? getStars(pct) : 0;
                      return (
                        <div key={d.id} className="bg-white border border-purple-200 rounded-lg p-2 text-center shadow-xs hover:shadow-sm transition">
                          <div className="text-[10px] font-bold text-purple-700 mb-1">D{d.position}</div>
                          <div className={`text-base font-black mb-1 ${
                            pct === undefined ? "text-slate-300" : pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {pct !== undefined ? Math.round(pct * 20 / 100) : "—"}
                          </div>
                          {attempts > 0 && <div className="text-[9px] text-slate-500 font-semibold mb-1">×{attempts}</div>}
                          <div className="text-xs h-4 flex items-center justify-center">{stars > 0 ? "⭐".repeat(stars) : "—"}</div>
                        </div>
                      );
                    })}
                  </div>
                  {dictees.length > 13 && (
                    <div className="grid grid-cols-13 gap-2">
                      {dictees.slice(13).map((d) => {
                        const pct = selectedStudent.scores[d.id];
                        const attempts = selectedStudent.attemptsPerDictee[d.id] || 0;
                        const stars = pct !== undefined ? getStars(pct) : 0;
                        return (
                          <div key={d.id} className="bg-white border border-purple-200 rounded-lg p-2 text-center shadow-xs hover:shadow-sm transition">
                            <div className="text-[10px] font-bold text-purple-700 mb-1">D{d.position}</div>
                            <div className={`text-base font-black mb-1 ${
                              pct === undefined ? "text-slate-300" : pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600"
                            }`}>
                              {pct !== undefined ? Math.round(pct * 20 / 100) : "—"}
                            </div>
                            {attempts > 0 && <div className="text-[9px] text-slate-500 font-semibold mb-1">×{attempts}</div>}
                            <div className="text-xs h-4 flex items-center justify-center">{stars > 0 ? "⭐".repeat(stars) : "—"}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Certificate section */}
                {(() => {
                  const dicteesTried = Object.keys(selectedStudent.scores).filter((id) => selectedStudent.scores[id] !== undefined).length;
                  const cert = getCertificateLevel(selectedStudent.note20, dicteesTried, 3);
                  if (!cert) return (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-center mt-4">
                      <span className="text-[10px] text-gray-400">🎓 Certificat disponible après 3 dictées ({dicteesTried} actuellement)</span>
                    </div>
                  );
                  return (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-2.5 mt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{cert.emoji}</span>
                        <div>
                          <div className="font-bold text-amber-900 text-xs">{cert.name}</div>
                          <div className="text-[9px] text-amber-700">{cert.mention} — {selectedStudent.note20}/20</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
