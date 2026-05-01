"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Loader2, X } from "lucide-react";

interface LoginTeacherProps {
  onLogin: () => void;
  onClose: () => void;
}

// Affichage cosmétique : suggère visuellement qu'il y a un mot de passe protégé,
// sans jamais exposer la vraie valeur (qui n'est plus envoyée).
const PREFILLED_DISPLAY = "demo-visiteur";

export default function LoginTeacher({ onLogin, onClose }: LoginTeacherProps) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    // Mode démo : connexion directe (le mot de passe n'a pas de raison d'être
    // demandé puisque le mode Visiteur est public — la suggestion visuelle suffit).
    localStorage.setItem("dictee_master_teacher", "true");
    onLogin();
    setLoading(false);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <GraduationCap className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-800">Mode Visiteur / Démo</h1>
            <p className="text-gray-500 mt-1">Cliquez pour accéder à la démo</p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              value={PREFILLED_DISPLAY}
              readOnly
              tabIndex={-1}
              aria-label="Mot de passe (pré-rempli)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg bg-gray-50 cursor-not-allowed select-none"
            />
            <Button
              onClick={handleSubmit}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
              disabled={loading}
              autoFocus
              className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-lg font-bold rounded-xl"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Se connecter"
              )}
            </Button>
          </div>

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
