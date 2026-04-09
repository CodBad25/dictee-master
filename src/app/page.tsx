"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, GraduationCap, Sparkles, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import LoginEleve from "@/components/login-eleve";
import LoginTeacher from "@/components/login-teacher";
import LoginEnseignant, { type ConnectedEnseignant } from "@/components/login-enseignant";
import type { ConnectedEleve } from "@/lib/hub";

export default function HomePage() {
  const router = useRouter();
  const { setUser, setConnectedEleve } = useAppStore();
  const connectedEleve = useAppStore((s) => s.connectedEleve);
  const [showLogin, setShowLogin] = useState(false);
  const [showVisitorLogin, setShowVisitorLogin] = useState(false);
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);

  useEffect(() => {
    if (connectedEleve) {
      router.push("/student");
    }
  }, [connectedEleve, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("dictee_master_teacher") === "true") {
        router.push("/teacher");
      }
    }
  }, [router]);

  // Visiteur : ancien mode enseignant (mot de passe partagé, données démo)
  const handleVisitorLogin = () => {
    setUser({
      id: "visitor",
      name: "Visiteur",
      role: "teacher",
    });
    router.push("/teacher");
  };

  // Enseignant authentifié via le Hub
  const handleTeacherLogin = (enseignant: ConnectedEnseignant) => {
    setUser({
      id: enseignant.enseignantId,
      name: `${enseignant.prenom} ${enseignant.nom}`,
      role: "teacher",
    });
    router.push("/teacher");
  };

  const handleStudentLogin = (eleve: ConnectedEleve) => {
    setUser({
      id: eleve.eleveId,
      name: `${eleve.prenom} ${eleve.nom}`,
      role: "student",
    });
    setConnectedEleve(eleve);
    router.push("/student");
  };

  if (showTeacherLogin) {
    return (
      <LoginEnseignant
        onLogin={handleTeacherLogin}
        onClose={() => setShowTeacherLogin(false)}
      />
    );
  }

  if (showVisitorLogin) {
    return (
      <LoginTeacher
        onLogin={handleVisitorLogin}
        onClose={() => setShowVisitorLogin(false)}
      />
    );
  }

  if (showLogin) {
    return (
      <LoginEleve
        onLogin={handleStudentLogin}
        onClose={() => setShowLogin(false)}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Logo et titre */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="relative inline-block mb-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
            <BookOpen className="w-10 h-10 text-white" />
          </div>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </motion.div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          DictéeMaster
        </h1>
        <p className="text-muted-foreground mt-2">
          Apprends l&apos;orthographe en t&apos;amusant !
        </p>
      </motion.div>

      {/* Choix du rôle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="w-full max-w-md space-y-4"
      >
        <p className="text-center text-sm text-muted-foreground mb-6">
          Qui es-tu ?
        </p>

        {/* Bouton Enseignant */}
        <Card
          className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-purple-300"
          onClick={() => setShowTeacherLogin(true)}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-purple-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Enseignant(e)</h2>
              <p className="text-sm text-muted-foreground">
                Suivre mes élèves et personnaliser le parcours
              </p>
            </div>
          </div>
        </Card>

        {/* Bouton Élève */}
        <Card
          className="p-6 cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 hover:border-indigo-300"
          onClick={() => setShowLogin(true)}
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-lg">Élève</h2>
              <p className="text-sm text-muted-foreground">
                S&apos;entraîner et gagner des badges
              </p>
            </div>
          </div>
        </Card>

        {/* Bouton Visiteur */}
        <Card
          className="p-4 cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.01] border hover:border-gray-300"
          onClick={() => setShowVisitorLogin(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1">
              <h2 className="font-medium text-sm text-gray-700">Visiteur / Démo</h2>
              <p className="text-xs text-muted-foreground">
                Découvrir l&apos;application avec des données fictives
              </p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Footer — crédits */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-12 text-center space-y-1"
      >
        <p className="text-xs text-gray-500">
          Développé par <span className="font-semibold text-purple-600">M. Belhaj</span> — Collège Chaissac, Pouzauges
        </p>
        <p className="text-[11px] text-gray-400">
          Avec tous mes remerciements à Mme Manaï pour sa collaboration,
        </p>
        <p className="text-[11px] text-gray-400">
          et à Mmes Arrivé et Bousseau pour leurs documents et retours précieux.
        </p>
        <a href="/admin" className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors">
          Administration
        </a>
      </motion.div>
    </main>
  );
}
