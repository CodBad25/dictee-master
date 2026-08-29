"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Loader2, Search, X } from "lucide-react";
import {
  getClasses,
  isCurrentYearClasse,
  getEleves,
  checkPin,
  createPin,
  verifyPin,
  setConnectedEleve,
  type ConnectedEleve,
} from "@/lib/hub";

interface StudentEntry {
  id: string;
  prenom: string;
  nom: string;
  classe: string;
  classeId: string;
}

interface LoginEleveProps {
  onLogin: (eleve: ConnectedEleve) => void;
  onClose: () => void;
}

export default function LoginEleve({ onLogin, onClose }: LoginEleveProps) {
  const [step, setStep] = useState<"search" | "pin">("search");
  const [allStudents, setAllStudents] = useState<StudentEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentEntry | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hubOffline, setHubOffline] = useState(false);
  const [isNewPin, setIsNewPin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Charger toutes les classes + tous les élèves au démarrage
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Uniquement les classes de l'année en cours (+ classes de test « T »)
        const classes = (await getClasses()).filter(isCurrentYearClasse);
        const allEntries: StudentEntry[] = [];
        await Promise.all(
          (classes || []).map(async (cls) => {
            try {
              const eleves = await getEleves(cls.id);
              for (const e of eleves || []) {
                allEntries.push({
                  id: e.id,
                  prenom: e.prenom,
                  nom: e.nom,
                  classe: cls.nom,
                  classeId: cls.id,
                });
              }
            } catch {
              /* skip class on error */
            }
          })
        );
        // Trier par prénom puis nom
        allEntries.sort(
          (a, b) =>
            a.prenom.localeCompare(b.prenom, "fr") ||
            a.nom.localeCompare(b.nom, "fr")
        );
        setAllStudents(allEntries);
      } catch {
        setError("Impossible de contacter le serveur");
        setHubOffline(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Focus le champ de recherche quand les données sont chargées
  useEffect(() => {
    if (!loading && allStudents.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, allStudents.length]);

  // Filtrer les élèves selon la saisie
  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allStudents.filter(
      (s) =>
        s.prenom.toLowerCase().startsWith(q) ||
        s.nom.toLowerCase().startsWith(q) ||
        `${s.prenom} ${s.nom}`.toLowerCase().startsWith(q)
    );
  }, [query, allStudents]);

  const handleStudentSelect = async (student: StudentEntry) => {
    setSelectedStudent(student);
    setError("");
    try {
      const r = await checkPin(student.id);
      setIsNewPin(!r.hasPin);
    } catch {
      setIsNewPin(true);
    }
    setStep("pin");
  };

  const handlePinSubmit = async () => {
    if (!selectedStudent || pinInput.length !== 4) {
      setError("Le code PIN doit contenir 4 chiffres");
      return;
    }
    try {
      setLoading(true);
      setError("");
      if (isNewPin) {
        await createPin(selectedStudent.id, pinInput);
      } else {
        const r = await verifyPin(selectedStudent.id, pinInput);
        if (!r.valid) {
          setError("Code PIN incorrect");
          setLoading(false);
          return;
        }
      }
      const userData: ConnectedEleve = {
        eleveId: selectedStudent.id,
        prenom: selectedStudent.prenom,
        nom: selectedStudent.nom,
        classe: selectedStudent.classe,
        classeId: selectedStudent.classeId,
      };
      setConnectedEleve(userData);
      onLogin(userData);
    } catch {
      setError("Erreur lors de la vérification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <BookOpen className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-800">DictéeMaster</h1>
            <p className="text-gray-500 mt-1">Connecte-toi pour commencer</p>
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Mode test — localhost uniquement */}
          {hubOffline && typeof window !== "undefined" && window.location.hostname === "localhost" && (
            <Button
              onClick={() => {
                const testEleve: ConnectedEleve = {
                  eleveId: "test-dev",
                  prenom: "Élève",
                  nom: "Test",
                  classe: "6A",
                  classeId: "test",
                };
                setConnectedEleve(testEleve);
                onLogin(testEleve);
              }}
              variant="outline"
              className="w-full border-amber-300 text-amber-700 hover:bg-amber-50"
            >
              Mode test (dev uniquement)
            </Button>
          )}

          {step === "search" && (
            <div className="space-y-3">
              <p className="text-center text-gray-600 font-medium">
                Tape ton prénom pour te connecter
              </p>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : (
                <>
                  {/* Champ de recherche */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ton prénom..."
                      className="w-full border-2 border-gray-300 rounded-xl pl-10 pr-10 py-3 text-lg focus:border-purple-500 focus:outline-none transition-colors"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Résultats filtrés */}
                  {query.trim() && (
                    <div className="max-h-56 overflow-y-auto rounded-xl border bg-white">
                      {filtered.length > 0 ? (
                        filtered.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => handleStudentSelect(s)}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-50 transition-colors text-left border-b last:border-b-0"
                          >
                            <span className="font-medium text-gray-800">
                              {s.prenom} {s.nom}
                            </span>
                            <span className="text-xs text-purple-600 bg-purple-100 rounded-full px-2 py-0.5">
                              {s.classe}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="text-center text-gray-400 text-sm py-4">
                          Aucun élève trouvé
                        </p>
                      )}
                    </div>
                  )}

                  {/* Indication quand vide */}
                  {!query.trim() && allStudents.length > 0 && (
                    <p className="text-center text-gray-400 text-xs">
                      {allStudents.length} élèves disponibles
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {step === "pin" && selectedStudent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setStep("search");
                    setError("");
                    setPinInput("");
                    setQuery("");
                  }}
                  variant="ghost"
                  size="sm"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                </Button>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">
                  {selectedStudent.prenom} {selectedStudent.nom}
                </p>
                <p className="text-xs text-purple-600 mb-1">
                  {selectedStudent.classe}
                </p>
                <p className="text-gray-500 text-sm">
                  {isNewPin
                    ? "Choisis un code PIN à 4 chiffres"
                    : "Saisis ton code PIN à 4 chiffres"}
                </p>
              </div>
              <div className="flex gap-3 justify-center items-center">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) =>
                    setPinInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="0000"
                  className="border-2 border-gray-300 rounded-lg px-4 py-3 text-center text-3xl tracking-widest w-36 focus:border-purple-500 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && pinInput.length === 4)
                      handlePinSubmit();
                  }}
                  autoFocus
                />
                <Button
                  onClick={handlePinSubmit}
                  disabled={pinInput.length !== 4 || loading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Valider"
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="text-center pt-2 border-t">
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-gray-400"
            >
              <X className="w-4 h-4 mr-1" /> Fermer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
