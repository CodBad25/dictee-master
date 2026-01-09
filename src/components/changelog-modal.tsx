"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_VERSION, CHANGELOG } from "@/lib/version";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-6 h-6" />
                    <h3 className="font-bold text-xl">Nouveautes</h3>
                  </div>
                  <p className="text-white/80 text-sm">DicteeMaster v{APP_VERSION}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-6">
              {CHANGELOG.map((entry, idx) => (
                <div key={entry.version}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      idx === 0
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                      v{entry.version}
                    </span>
                    <span className="text-xs text-gray-400">{entry.date}</span>
                    {idx === 0 && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                        Actuelle
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {entry.changes.map((change, changeIdx) => (
                      <li key={changeIdx} className="flex items-start gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <Button
                onClick={onClose}
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 rounded-xl font-bold"
              >
                Compris !
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Composant badge de version cliquable
export function VersionBadge() {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowChangelog(true)}
        className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors"
      >
        v{APP_VERSION}
      </button>
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </>
  );
}
