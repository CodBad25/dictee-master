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
    <main className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Décor de fond */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-purple-200 rounded-full blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-20 translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/3 right-1/4 w-48 h-48 bg-amber-200 rounded-full blur-3xl opacity-15" />

      {/* Contenu centré */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="relative inline-block mb-5">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-300"
            >
              <BookOpen className="w-12 h-12 text-white" />
            </motion.div>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              className="absolute -top-3 -right-3"
            >
              <Sparkles className="w-7 h-7 text-yellow-500 drop-shadow-lg" />
            </motion.div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            DictéeMaster
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Apprends l&apos;orthographe en t&apos;amusant !
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">🃏 8 exercices</span>
            <span className="flex items-center gap-1">🎧 Dictée audio</span>
            <span className="flex items-center gap-1">🏆 Badges</span>
          </div>
        </motion.div>

        {/* Choix du rôle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md space-y-4"
        >
          {/* Bouton Enseignant */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="p-6 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-300 bg-white/80 backdrop-blur-sm"
              onClick={() => setShowTeacherLogin(true)}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-200">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg text-gray-900">Enseignant(e)</h2>
                  <p className="text-sm text-gray-500">
                    Suivre mes élèves et personnaliser le parcours
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Bouton Élève */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="p-6 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-indigo-300 bg-white/80 backdrop-blur-sm"
              onClick={() => setShowLogin(true)}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-200">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg text-gray-900">Élève</h2>
                  <p className="text-sm text-gray-500">
                    S&apos;entraîner et gagner des badges
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Bouton Visiteur */}
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Card
              className="p-4 cursor-pointer hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-gray-300 bg-white/60 backdrop-blur-sm"
              onClick={() => setShowVisitorLogin(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Eye className="w-5 h-5 text-gray-500" />
                </div>
                <div className="flex-1">
                  <h2 className="font-medium text-sm text-gray-700">Visiteur / Démo</h2>
                  <p className="text-xs text-gray-400">
                    Découvrir l&apos;application sans compte
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer — crédits */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="py-6 text-center space-y-1 relative z-10"
      >
        <p className="text-xs text-gray-500">
          Développé par <span className="font-semibold text-purple-600">M. Belhaj</span> — Collège Chaissac, Pouzauges
        </p>
        <p className="text-[11px] text-gray-400">
          Avec tous mes remerciements à Mme Manaï pour sa collaboration,
          et à Mmes Arrivé et Bousseau pour leurs documents et retours précieux.
        </p>
        <a href="/admin" className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors">
          Administration
        </a>
      </motion.footer>
    </main>
  );
}
