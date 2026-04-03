"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  loadPendingUnlockRequests,
  approveUnlockRequest,
  rejectUnlockRequest,
  type UnlockRequest,
} from "@/lib/dictee-service";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

interface Dictee {
  id: string;
  title: string;
  position: number;
}

export default function UnlockRequestsManager() {
  const [dictees, setDictees] = useState<Dictee[]>([]);
  const [requests, setRequests] = useState<UnlockRequest[]>([]);
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);

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
        .select("id, name")
        .order("created_at");

      if (cls) {
        const classMap: Record<string, string> = {};
        cls.forEach((c) => {
          classMap[c.id] = c.name;
        });
        setClasses(classMap);
        if (cls.length > 0) {
          setSelectedClass(cls[0].id);
        }
      }

      setLoading(false);
    };

    load();
  }, []);

  // Charger les demandes quand la classe sélectionnée change
  useEffect(() => {
    if (!selectedClass) return;

    const load = async () => {
      const reqs = await loadPendingUnlockRequests(selectedClass);
      setRequests(reqs);
    };

    load();
    const interval = setInterval(load, 5000); // Rafraîchir toutes les 5s
    return () => clearInterval(interval);
  }, [selectedClass]);

  const handleApprove = async (request: UnlockRequest) => {
    const success = await approveUnlockRequest(
      request.id,
      request.class_id,
      request.dictee_position
    );

    if (success) {
      toast.success(
        `Demande approuvée pour ${request.student_name}`
      );
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } else {
      toast.error("Erreur lors de l'approbation");
    }
  };

  const handleReject = async (request: UnlockRequest) => {
    const success = await rejectUnlockRequest(request.id);

    if (success) {
      toast.success(`Demande rejetée`);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } else {
      toast.error("Erreur lors du rejet");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const classOptions = Object.entries(classes);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Demandes de déverrouillage</h1>

      {classOptions.length === 0 ? (
        <p className="text-gray-500">Aucune classe trouvée</p>
      ) : (
        <>
          {/* Sélection de classe */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Sélectionner une classe
            </label>
            <select
              value={selectedClass || ""}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 border rounded-md"
            >
              {classOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Demandes */}
          {requests.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Aucune demande en attente
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const dictee = dictees.find((d) => d.position === req.dictee_position);
                return (
                  <div
                    key={req.id}
                    className="bg-white border rounded-lg p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{req.student_name}</div>
                      <div className="text-sm text-gray-600">
                        Demande de déverrouillage pour{" "}
                        {dictee ? `${dictee.title} (D${dictee.position})` : `dictée ${req.dictee_position}`}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(req.created_at).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(req)}
                        className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-all"
                        title="Approuver"
                      >
                        <Check className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                        title="Rejeter"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
