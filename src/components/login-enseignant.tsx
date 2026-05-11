"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, GraduationCap, Loader2, Search, X, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

const HUB_URL = "https://hub.beltools.fr/api/v1";
const HUB_KEY = process.env.NEXT_PUBLIC_HUB_API_KEY || "";

async function hubFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${HUB_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "x-api-key": HUB_KEY, ...options?.headers },
  });
  if (!res.ok) throw new Error(`Hub API error: ${res.status}`);
  return res.json();
}

interface TeacherEntry {
  id: string;
  prenom: string;
  nom: string;
  matiere: string;
  classes: string[];
}

export interface ConnectedEnseignant {
  enseignantId: string;
  prenom: string;
  nom: string;
  matiere: string;
  classes: string[];
}

interface LoginEnseignantProps {
  onLogin: (enseignant: ConnectedEnseignant) => void;
  onClose: () => void;
}

const isRawId = (c: string) => /^cm[a-z0-9]{10,}$/i.test(c);

function classScore(classes: string[]): number {
  return classes.filter((c) => !isRawId(c)).length;
}

async function getEnseignants(): Promise<TeacherEntry[]> {
  const data = await hubFetch("/enseignants");
  const entries: TeacherEntry[] = (data.enseignants || []).map((e: any) => ({
    id: e.id,
    prenom: e.prenom || "",
    nom: e.nom || "",
    matiere: e.matiere || "",
    classes: e.classes || [],
  }));

  // Dédupliquer par (prenom + nom) : garder l'entrée avec les meilleurs noms de classes
  const byName = new Map<string, TeacherEntry>();
  for (const entry of entries) {
    const key = `${entry.prenom}|${entry.nom}`.toLowerCase();
    const existing = byName.get(key);
    if (!existing || classScore(entry.classes) > classScore(existing.classes)) {
      byName.set(key, entry);
    }
  }
  return Array.from(byName.values());
}

async function checkPinEnseignant(enseignantId: string): Promise<{ hasPin: boolean }> {
  return hubFetch("/enseignants/pin", {
    method: "POST",
    body: JSON.stringify({ enseignantId, action: "check" }),
  });
}

async function createPinEnseignant(enseignantId: string, pin: string): Promise<{ success: boolean }> {
  return hubFetch("/enseignants/pin", {
    method: "POST",
    body: JSON.stringify({ enseignantId, action: "create", pin }),
  });
}

async function verifyPinEnseignant(enseignantId: string, pin: string): Promise<{ valid: boolean }> {
  return hubFetch("/enseignants/pin", {
    method: "POST",
    body: JSON.stringify({ enseignantId, action: "verify", pin }),
  });
}

export default function LoginEnseignant({ onLogin, onClose }: LoginEnseignantProps) {
  const [step, setStep] = useState<"search" | "pin">("search");
  const [teachers, setTeachers] = useState<TeacherEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherEntry | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewPin, setIsNewPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await getEnseignants();
        data.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
        setTeachers(data);
      } catch {
        setError("Impossible de charger la liste des enseignants");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!loading && teachers.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, teachers.length]);

  useEffect(() => {
    if (step === "pin") {
      setTimeout(() => pinRef.current?.focus(), 100);
    }
  }, [step]);

  const filtered = useMemo(() => {
    if (!query.trim()) return teachers;
    const q = query.trim().toLowerCase();
    return teachers.filter(
      (t) =>
        t.prenom.toLowerCase().startsWith(q) ||
        t.nom.toLowerCase().startsWith(q) ||
        `${t.prenom} ${t.nom}`.toLowerCase().includes(q)
    );
  }, [query, teachers]);

  const handleSelect = async (teacher: TeacherEntry) => {
    setSelectedTeacher(teacher);
    setError("");
    setPinInput("");
    try {
      const r = await checkPinEnseignant(teacher.id);
      setIsNewPin(!r.hasPin);
    } catch {
      setIsNewPin(true);
    }
    setStep("pin");
  };

  const handlePinSubmit = async () => {
    if (!selectedTeacher || pinInput.length < 4) {
      setError("Le mot de passe doit contenir au moins 4 caractères");
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (isNewPin) {
        await createPinEnseignant(selectedTeacher.id, pinInput);
      } else {
        const r = await verifyPinEnseignant(selectedTeacher.id, pinInput);
        if (!r.valid) {
          setError("Mot de passe incorrect");
          setLoading(false);
          return;
        }
      }
      const data: ConnectedEnseignant = {
        enseignantId: selectedTeacher.id,
        prenom: selectedTeacher.prenom,
        nom: selectedTeacher.nom,
        matiere: selectedTeacher.matiere,
        classes: selectedTeacher.classes,
      };
      // Sauvegarder en localStorage
      localStorage.setItem("dictee_master_enseignant", JSON.stringify(data));
      localStorage.setItem("dictee_master_teacher", "true");
      onLogin(data);
    } catch {
      setError("Erreur lors de la connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (step === "pin") {
                  setStep("search");
                  setSelectedTeacher(null);
                  setPinInput("");
                  setError("");
                } else {
                  onClose();
                }
              }}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Espace enseignant</h2>
                <p className="text-xs text-muted-foreground">
                  {step === "search" ? "Trouvez votre nom" : isNewPin ? "Créez votre mot de passe" : "Entrez votre mot de passe"}
                </p>
              </div>
            </div>
          </div>

          {/* Étape 1 : Recherche */}
          {step === "search" && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Chargement...</p>
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher un enseignant..."
                      className="pl-10 h-12 text-base"
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {filtered.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleSelect(t)}
                        className="w-full text-left p-3 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all"
                      >
                        <p className="font-semibold text-gray-900">
                          {t.prenom} {t.nom}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.matiere} — {t.classes.filter((c) => !/^cm[a-z0-9]{10,}$/i.test(c)).join(", ") || "—"}
                        </p>
                      </button>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <p className="text-center text-gray-400 py-6 text-sm">
                        {query ? "Aucun enseignant trouvé" : "Aucun enseignant enregistré"}
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* Étape 2 : Mot de passe */}
          {step === "pin" && selectedTeacher && (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mx-auto mb-3">
                  <GraduationCap className="w-8 h-8 text-purple-600" />
                </div>
                <p className="font-bold text-lg">{selectedTeacher.prenom} {selectedTeacher.nom}</p>
                <p className="text-sm text-gray-500">{selectedTeacher.matiere}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-2">
                    {isNewPin ? "Choisissez un mot de passe" : "Mot de passe"}
                  </label>
                  <div className="relative">
                    <Input
                      ref={pinRef}
                      type={showPin ? "text" : "password"}
                      value={pinInput}
                      onChange={(e) => { setPinInput(e.target.value); setError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
                      placeholder={isNewPin ? "Créez votre mot de passe..." : "Votre mot de passe..."}
                      className="h-12 text-base pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {isNewPin && (
                    <p className="text-xs text-gray-400 mt-1">
                      Au moins 4 caractères. Vous en aurez besoin pour vos prochaines connexions.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="text-sm text-red-500 text-center">{error}</p>
                )}

                <Button
                  onClick={handlePinSubmit}
                  disabled={loading || pinInput.length < 4}
                  className="w-full h-12 text-base font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isNewPin ? (
                    "Créer mon compte"
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
