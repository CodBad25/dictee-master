"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateUnlockedDictees } from "@/lib/dictee-service";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Dictee {
  id: string;
  title: string;
  position: number;
}

interface DmClass {
  id: string;
  name: string;
  unlocked_dictees: number[];
}

export default function ClassLocksManager() {
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [classes, setClasses] = useState<DmClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

  // Charger les données au montage
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const sb = createClient();

      // Charger les dictées
      const { data: dicts } = await sb
        .from("dictees")
        .select("id, title, position")
        .order("position");

      if (dicts) {
        setDictees(dicts);
      }

      // Charger les classes
      const { data: cls } = await sb
        .from("dm_classes")
        .select("id, name, unlocked_dictees")
        .order("created_at");

      if (cls) {
        setClasses(cls);
        if (cls.length > 0) {
          setSelectedClass(cls[0].id);
        }
      }

      setLoading(false);
    };

    load();
  }, []);

  const toggleDictee = async (classId: string, position: number) => {
    const dmClass = classes.find((c) => c.id === classId);
    if (!dmClass) return;

    const newPositions = dmClass.unlocked_dictees.includes(position)
      ? dmClass.unlocked_dictees.filter((p) => p !== position)
      : [...dmClass.unlocked_dictees, position].sort((a, b) => a - b);

    // Validation: au moins une dictée doit être déverrouillée
    if (newPositions.length === 0) {
      toast.error("Au moins une dictée doit être déverrouillée");
      return;
    }

    try {
      await updateUnlockedDictees(classId, newPositions);

      // Mettre à jour l'état local
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId ? { ...c, unlocked_dictees: newPositions } : c
        )
      );

      toast.success("Dictée mise à jour");
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const currentClass = classes.find((c) => c.id === selectedClass);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gestion du déverrouillage des dictées</h1>

      {classes.length === 0 ? (
        <p className="text-gray-500">Aucune classe trouvée</p>
      ) : (
        <>
          {/* Sélection de classe */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Sélectionner une classe</label>
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dictées */}
          {currentClass && (
            <div className="space-y-3">
              <h2 className="font-semibold text-lg mb-4">Dictées</h2>
              <div className="grid gap-2">
                {dictees.map((d) => {
                  const isUnlocked = currentClass.unlocked_dictees.includes(d.position);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDictee(currentClass.id, d.position)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isUnlocked
                          ? "bg-purple-50 border-purple-500 text-purple-900"
                          : "bg-gray-50 border-gray-300 text-gray-600"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isUnlocked
                              ? "bg-purple-500 text-white"
                              : "bg-gray-300 text-gray-600"
                          }`}
                        >
                          {d.position}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{d.title}</div>
                          <div className="text-xs opacity-70">
                            {isUnlocked ? "Déverrouillée" : "Verrouillée"}
                          </div>
                        </div>
                        <div className="text-xl">{isUnlocked ? "🔓" : "🔒"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
