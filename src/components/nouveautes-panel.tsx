"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { NOUVEAUTES, type NouveauteAction } from "@/content/nouveautes";

// Panneau latéral droit « Nouveautés » — calqué sur les sites de maths :
// entrées du plus récent au plus ancien, les `nonLues` premières surlignées
// en ambre, bouton d'accès direct à la fonctionnalité. L'ouverture marque
// tout lu (le surlignage reste visible pendant la lecture).

interface NouveautesPanelProps {
  open: boolean;
  onClose: () => void;
  nonLues: number;
  onToutLu: () => void;
  onAction: (action: NouveauteAction) => void;
}

const dateLisible = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default function NouveautesPanel({ open, onClose, nonLues, onToutLu, onAction }: NouveautesPanelProps) {
  useEffect(() => {
    if (open) onToutLu();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/30 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Nouveautés du site"
            className="fixed top-0 right-0 h-full w-full sm:max-w-md bg-white shadow-2xl z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <header className="px-5 pt-5 pb-3 border-b flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Nouveautés du site
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Ce qui a changé, expliqué en quelques lignes. Les entrées surlignées sont nouvelles depuis ta dernière visite.
                </p>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Fermer">
                <X className="w-5 h-5" />
              </button>
            </header>

            <ol className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {NOUVEAUTES.map((n, i) => {
                const nouvelle = i < nonLues;
                return (
                  <li
                    key={n.id}
                    className={`rounded-xl border p-3 ${nouvelle ? "border-amber-300 bg-amber-50/70" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5">{n.icone ?? "✨"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 leading-tight">{n.titre}</h3>
                          {nouvelle && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-400 text-white px-1.5 py-0.5 rounded">
                              nouveau
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{dateLisible(n.date)}</p>
                        <p className="text-sm text-gray-700 mt-2 leading-snug">{n.description}</p>
                        {n.action && (
                          <button
                            onClick={() => { onClose(); onAction(n.action!); }}
                            className="mt-2 inline-flex items-center gap-1 h-7 px-2.5 text-xs font-semibold rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-gray-800"
                          >
                            {n.actionLibelle ?? "Ouvrir"} <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <footer className="px-5 py-3 border-t text-center">
              <button
                onClick={() => { onClose(); onAction("tour"); }}
                className="text-xs text-purple-700 hover:underline"
              >
                🧭 Revoir la visite guidée du Parcours
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
