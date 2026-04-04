"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, GraduationCap, Loader2, X } from "lucide-react";

interface LoginTeacherProps {
  onLogin: () => void;
  onClose: () => void;
}

export default function LoginTeacher({ onLogin, onClose }: LoginTeacherProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // Sauvegarder la session enseignant
        localStorage.setItem("dictee_master_teacher", "true");
        localStorage.setItem("dictee_master_teacher_pwd", password);
        onLogin();
      } else {
        setError("Mot de passe incorrect");
      }
    } catch (err) {
      setError("Erreur de connexion");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-purple-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <GraduationCap className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-gray-800">Espace enseignant</h1>
            <p className="text-gray-500 mt-1">Entrez le mot de passe</p>
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe..."
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 pr-12 text-lg focus:border-purple-500 focus:outline-none transition-colors"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password) handleSubmit();
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!password || loading}
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
