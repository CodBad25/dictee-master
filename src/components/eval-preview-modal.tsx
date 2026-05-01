"use client";

import { useState, useMemo } from "react";
import { X, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DicteeLite {
  id: string;
  position: number;
  title: string;
}

interface StudentRowLite {
  id: string;
  name: string;
  results: Record<string, { bestPct: number; attempts: number }>;
}

interface EvalPreviewModalProps {
  students: StudentRowLite[];
  dictees: DicteeLite[];
  displayName: (n: string) => string;
  onClose: () => void;
}

function getStars(pct: number): number {
  if (pct >= 90) return 3;
  if (pct >= 70) return 2;
  if (pct >= 40) return 1;
  return 0;
}

function noteOnSubset(student: StudentRowLite, selectedIds: Set<string>): number {
  if (selectedIds.size === 0) return 0;
  let stars = 0;
  for (const dicteeId of selectedIds) {
    stars += getStars(student.results[dicteeId]?.bestPct ?? 0);
  }
  const maxStars = selectedIds.size * 3;
  return maxStars > 0 ? Math.round((stars / maxStars) * 20) : 0;
}

export default function EvalPreviewModal({
  students,
  dictees,
  displayName,
  onClose,
}: EvalPreviewModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(dictees.map((d) => d.id)),
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(dictees.map((d) => d.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const studentNotes = useMemo(
    () =>
      students
        .map((s) => ({ ...s, simulatedNote: noteOnSubset(s, selectedIds) }))
        .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [students, selectedIds],
  );

  const classAverage = useMemo(() => {
    if (studentNotes.length === 0) return 0;
    const sum = studentNotes.reduce((acc, s) => acc + s.simulatedNote, 0);
    return Math.round((sum / studentNotes.length) * 10) / 10;
  }, [studentNotes]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl my-8">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">🧪 Aperçu — Évaluation</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
            <strong>Aperçu de fonctionnalité.</strong> Vos choix ne sont pas enregistrés et l&apos;export Pronote n&apos;est pas modifié. Cliquez les dictées pour les inclure ou les exclure du calcul de la note.
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
            <div className="text-xs uppercase tracking-wide text-purple-600 mb-1">
              Moyenne de classe simulée
            </div>
            <div className="text-4xl font-bold text-purple-700">
              {classAverage} / 20
            </div>
            <div className="text-xs text-purple-600 mt-1">
              sur {selectedIds.size} dictée{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""} ({studentNotes.length} élève{studentNotes.length > 1 ? "s" : ""})
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={selectAll}>
              <CheckSquare className="w-4 h-4 mr-1" /> Tout cocher
            </Button>
            <Button size="sm" variant="outline" onClick={deselectAll}>
              <Square className="w-4 h-4 mr-1" /> Tout décocher
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {dictees.map((d) => {
              const selected = selectedIds.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggle(d.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                    selected
                      ? "bg-purple-600 border-purple-600 text-white"
                      : "bg-white border-gray-300 text-gray-500 hover:border-gray-400"
                  }`}
                  title={d.title}
                >
                  D{d.position}
                </button>
              );
            })}
          </div>

          <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Élève</th>
                  <th className="text-right px-3 py-2 font-semibold">Note simulée</th>
                </tr>
              </thead>
              <tbody>
                {studentNotes.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2">{displayName(s.name)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">
                      {s.simulatedNote} / 20
                    </td>
                  </tr>
                ))}
                {studentNotes.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-center text-gray-400">
                      Aucun élève dans cette classe
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
