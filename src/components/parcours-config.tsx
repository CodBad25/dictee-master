"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, Reorder, AnimatePresence } from "framer-motion";
import { GripVertical, X, Save, RotateCcw, Check, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  loadClassDefaultOrder,
  loadAllDicteeOverrides,
  updateActivityOrder,
  saveDicteeOverride,
  deleteDicteeOverride,
} from "@/lib/dictee-service";

const ACTIVITY_LABELS: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  flashcard: { label: "Flashcard", icon: "🃏", desc: "Mémorise l'orthographe de chaque mot", color: "from-blue-400 to-blue-600" },
  genre: { label: "Genre", icon: "🏷️", desc: "Choisis le bon article pour chaque mot", color: "from-pink-400 to-pink-600" },
  spelling_choice: { label: "Choix orthographique", icon: "✏️", desc: "Trouve la bonne orthographe parmi les propositions", color: "from-amber-400 to-amber-600" },
  definitions: { label: "Définitions", icon: "📖", desc: "Associe chaque mot à sa définition", color: "from-emerald-400 to-emerald-600" },
  dictionary: { label: "Dictionnaire", icon: "📚", desc: "Cherche les mots dans ton dictionnaire", color: "from-teal-400 to-teal-600" },
  audio_word: { label: "Audio mot", icon: "🎧", desc: "Écoute et écris le mot correctement", color: "from-indigo-400 to-indigo-600" },
  fill_blanks: { label: "Texte à trous", icon: "📝", desc: "Complète le texte avec les bons mots", color: "from-orange-400 to-orange-600" },
  audio_dictation: { label: "Dictée audio", icon: "🎙️", desc: "Écoute la dictée phrase par phrase et écris", color: "from-purple-400 to-purple-600" },
};

const ALL_ACTIVITIES = Object.keys(ACTIVITY_LABELS);

interface ParcoursConfigProps {
  open: boolean;
  onClose: () => void;
  dmClassId: string;
  className: string;
  dictees: { id: string; title: string; position: number }[];
  students?: { id: string; name: string }[];
}

export default function ParcoursConfig({
  open,
  onClose,
  dmClassId,
  className,
  dictees,
  students = [],
}: ParcoursConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ordre par défaut de la classe (toujours les 8 activités, order = position)
  const [defaultOrder, setDefaultOrder] = useState<string[]>(ALL_ACTIVITIES);
  const [defaultDisabled, setDefaultDisabled] = useState<Set<string>>(new Set());
  const [defaultOrderDirty, setDefaultOrderDirty] = useState(false);

  // Mode : classe entière ou élève spécifique
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Dictée sélectionnée
  const [selectedDicteeId, setSelectedDicteeId] = useState<string | null>(null);
  const [selectedDicteePos, setSelectedDicteePos] = useState<number | null>(null);

  // Overrides par dictée
  const [overrides, setOverrides] = useState<Record<string, { activityOrder: string[]; selectedWords: number[] | null }>>({});
  const [overridesDirty, setOverridesDirty] = useState<Set<string>>(new Set());

  // Mots de la dictée sélectionnée
  const [dicteeWords, setDicteeWords] = useState<{ word: string; position: number }[]>([]);

  // Chargement au montage et quand on change d'élève
  useEffect(() => {
    const load = async () => {
      const [order, allOverrides] = await Promise.all([
        loadClassDefaultOrder(dmClassId),
        loadAllDicteeOverrides(dmClassId, selectedStudentId),
      ]);
      const savedOrder = order || ALL_ACTIVITIES;
      // L'ordre sauvegardé ne contient que les activités actives
      // Reconstruire l'ordre complet : actives en premier (dans l'ordre), puis désactivées
      const disabled = new Set(ALL_ACTIVITIES.filter(a => !savedOrder.includes(a)));
      const fullOrder = [...savedOrder, ...ALL_ACTIVITIES.filter(a => !savedOrder.includes(a))];
      setDefaultOrder(fullOrder);
      setDefaultDisabled(disabled);
      setOverrides(allOverrides);
      setLoading(false);
    };
    if (open) {
      setLoading(true);
      load();
    }
  }, [open, dmClassId, selectedStudentId]);

  // Chargement des mots quand on sélectionne une dictée
  useEffect(() => {
    if (!selectedDicteeId) {
      setDicteeWords([]);
      return;
    }
    const load = async () => {
      const sb = createClient();
      const { data } = await sb
        .from("dictee_words")
        .select("word, position")
        .eq("dictee_id", selectedDicteeId)
        .order("position");
      setDicteeWords(data || []);
    };
    load();
  }, [selectedDicteeId]);

  // Fonctions de sauvegarde
  const handleSaveDefault = async () => {
    setSaving(true);
    try {
      const activeOrder = defaultOrder.filter(a => !defaultDisabled.has(a));
      await updateActivityOrder(dmClassId, activeOrder);
      setDefaultOrderDirty(false);
      toast.success("Ordre par défaut sauvegardé");
    } catch {
      toast.error("Erreur de sauvegarde");
    }
    setSaving(false);
  };

  const handleSaveOverride = async (dicteeId: string) => {
    const ov = overrides[dicteeId];
    if (!ov) return;
    setSaving(true);
    try {
      await saveDicteeOverride(dmClassId, dicteeId, ov.activityOrder, ov.selectedWords, selectedStudentId);
      setOverridesDirty((prev) => {
        const n = new Set(prev);
        n.delete(dicteeId);
        return n;
      });
      toast.success("Configuration sauvegardée");
    } catch {
      toast.error("Erreur de sauvegarde");
    }
    setSaving(false);
  };

  const handleResetOverride = async (dicteeId: string) => {
    setSaving(true);
    try {
      await deleteDicteeOverride(dmClassId, dicteeId, selectedStudentId);
      setOverrides((prev) => {
        const n = { ...prev };
        delete n[dicteeId];
        return n;
      });
      setOverridesDirty((prev) => {
        const n = new Set(prev);
        n.delete(dicteeId);
        return n;
      });
      toast.success("Retour au parcours par défaut");
    } catch {
      toast.error("Erreur");
    }
    setSaving(false);
  };

  // Helpers pour gérer les overrides
  const getOverrideOrder = (dicteeId: string): string[] => {
    const saved = overrides[dicteeId]?.activityOrder;
    if (!saved) return defaultOrder;
    // Reconstituer : actives (dans l'ordre sauvegardé) + désactivées
    return [...saved, ...ALL_ACTIVITIES.filter(a => !saved.includes(a))];
  };

  const getOverrideDisabled = (dicteeId: string): Set<string> => {
    const saved = overrides[dicteeId]?.activityOrder;
    if (!saved) return defaultDisabled;
    return new Set(ALL_ACTIVITIES.filter(a => !saved.includes(a)));
  };

  const getSelectedWords = (dicteeId: string): number[] | null => {
    return overrides[dicteeId]?.selectedWords ?? null;
  };

  const setOverrideOrder = (dicteeId: string, order: string[]) => {
    setOverrides((prev) => ({
      ...prev,
      [dicteeId]: {
        ...prev[dicteeId],
        activityOrder: order,
        selectedWords: prev[dicteeId]?.selectedWords ?? null,
      },
    }));
    setOverridesDirty((prev) => new Set(prev).add(dicteeId));
  };

  const toggleWord = (dicteeId: string, position: number) => {
    const current = getSelectedWords(dicteeId);
    let next: number[] | null;
    if (current === null) {
      // Tous actifs → désactiver ce mot
      next = dicteeWords.map((w) => w.position).filter((p) => p !== position);
    } else if (current.includes(position)) {
      next = current.filter((p) => p !== position);
      if (next.length === dicteeWords.length) next = null; // Tous actifs → null
    } else {
      next = [...current, position].sort((a, b) => a - b);
      if (next.length === dicteeWords.length) next = null;
    }
    setOverrides((prev) => ({
      ...prev,
      [dicteeId]: {
        ...prev[dicteeId],
        activityOrder: prev[dicteeId]?.activityOrder || defaultOrder,
        selectedWords: next,
      },
    }));
    setOverridesDirty((prev) => new Set(prev).add(dicteeId));
  };

  const toggleAllWords = (dicteeId: string, selectAll: boolean) => {
    const next = selectAll ? null : [];
    setOverrides((prev) => ({
      ...prev,
      [dicteeId]: {
        ...prev[dicteeId],
        activityOrder: prev[dicteeId]?.activityOrder || defaultOrder,
        selectedWords: next,
      },
    }));
    setOverridesDirty((prev) => new Set(prev).add(dicteeId));
  };

  const toggleActivity = (order: string[], activity: string): string[] => {
    return order.includes(activity)
      ? order.filter((a) => a !== activity)
      : [...order, activity];
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold">Configuration du parcours</h2>
            <p className="text-purple-200 text-sm">{className}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sélecteur : classe entière ou élève */}
        {students.length > 0 && (
          <div className="px-5 py-3 border-b bg-gray-50 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-gray-600">Configurer pour :</span>
            <motion.button
              onClick={() => { setSelectedStudentId(null); setSelectedDicteeId(null); }}
              whileTap={{ scale: 0.95 }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                !selectedStudentId
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
              }`}
            >
              Toute la classe
            </motion.button>
            {students.map(s => (
              <motion.button
                key={s.id}
                onClick={() => { setSelectedStudentId(s.id); setSelectedDicteeId(null); }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedStudentId === s.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
                }`}
              >
                {s.name}
              </motion.button>
            ))}
          </div>
        )}

        {/* Content scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Indicateur élève sélectionné */}
              {selectedStudentId && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="font-semibold text-purple-800">
                      Parcours personnalisé pour {students.find(s => s.id === selectedStudentId)?.name}
                    </p>
                    <p className="text-sm text-purple-600">Sélectionnez une dictée ci-dessous pour configurer son parcours individuel.</p>
                  </div>
                </div>
              )}

              {/* Section 1 — Ordre par défaut (uniquement en mode classe) */}
              {!selectedStudentId && (
              <div data-tour="default-order-section">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Ordre par défaut de la classe</h3>
                  {defaultOrderDirty && (
                    <motion.button
                      onClick={handleSaveDefault}
                      disabled={saving}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Enregistrer
                    </motion.button>
                  )}
                </div>
                <Reorder.Group
                  axis="y"
                  values={defaultOrder}
                  onReorder={(newOrder) => {
                    setDefaultOrder(newOrder);
                    setDefaultOrderDirty(true);
                  }}
                  className="space-y-2"
                >
                  {defaultOrder.map((activity) => {
                    const info = ACTIVITY_LABELS[activity];
                    if (!info) return null;
                    const isDisabled = defaultDisabled.has(activity);
                    return (
                      <Reorder.Item
                        key={activity}
                        value={activity}
                        whileDrag={{
                          scale: 1.02,
                          boxShadow: "0 8px 25px rgba(124,58,237,0.3)",
                          zIndex: 50,
                        }}
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className={`rounded-xl p-4 flex items-center gap-4 transition-all cursor-grab active:cursor-grabbing border ${
                          isDisabled
                            ? "bg-gray-50 border-gray-200 opacity-50"
                            : "bg-white border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="text-3xl flex-shrink-0">
                          {info.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold ${isDisabled ? "text-gray-400 line-through" : "text-gray-900"}`}>{info.label}</p>
                          <p className={`text-sm ${isDisabled ? "text-gray-300" : "text-gray-600"}`}>{info.desc}</p>
                        </div>
                        <motion.button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDefaultDisabled(prev => {
                              const next = new Set(prev);
                              if (next.has(activity)) next.delete(activity);
                              else next.add(activity);
                              return next;
                            });
                            setDefaultOrderDirty(true);
                          }}
                          whileTap={{ scale: 0.9 }}
                          className={`w-12 h-7 rounded-full flex-shrink-0 flex items-center px-1 transition-colors ${
                            isDisabled ? "bg-gray-300" : "bg-purple-600"
                          }`}
                        >
                          <motion.div
                            layout
                            className="w-5 h-5 bg-white rounded-full shadow-sm"
                            animate={{ x: isDisabled ? 0 : 20 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          />
                        </motion.button>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>
              )}

              {/* Section 2 — Configuration par dictée */}
              <div data-tour="dictee-selector">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Personnaliser par dictée</h3>
                <div className="flex flex-wrap gap-2">
                  {dictees
                    .sort((a, b) => a.position - b.position)
                    .map((d) => {
                      const hasOverride = !!overrides[d.id];
                      const isSelected = selectedDicteeId === d.id;
                      return (
                        <motion.button
                          key={d.id}
                          data-tour={d.position === 1 ? "dictee-first-button" : undefined}
                          onClick={() => {
                            setSelectedDicteeId(isSelected ? null : d.id);
                            setSelectedDicteePos(isSelected ? null : d.position);
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all relative ${
                            isSelected
                              ? "bg-purple-600 text-white shadow-lg scale-110"
                              : hasOverride
                              ? "bg-purple-100 text-purple-700 ring-2 ring-purple-300"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {d.position}
                          {hasOverride && !isSelected && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full" />
                          )}
                        </motion.button>
                      );
                    })}
                </div>
              </div>

              {/* Section 3 — Détail dictée */}
              <AnimatePresence mode="popLayout">
                {selectedDicteeId && (
                  <motion.div
                    key={selectedDicteeId}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="space-y-6 border-t pt-6"
                  >
                    {/* Titre dictée */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">
                          Dictée n°{selectedDicteePos} — {dictees.find((d) => d.id === selectedDicteeId)?.title}
                        </h4>
                        {overrides[selectedDicteeId] && (
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                            Personnalisé
                          </span>
                        )}
                      </div>
                      {overrides[selectedDicteeId] && (
                        <motion.button
                          onClick={() => handleResetOverride(selectedDicteeId)}
                          disabled={saving}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                          Utiliser le défaut
                        </motion.button>
                      )}
                    </div>

                    {/* Parcours de la dictée */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-3">Ordre des exercices</h5>
                      <Reorder.Group
                        axis="y"
                        values={getOverrideOrder(selectedDicteeId)}
                        onReorder={(newOrder) => setOverrideOrder(selectedDicteeId, newOrder)}
                        className="space-y-2"
                      >
                        {getOverrideOrder(selectedDicteeId).map((activity) => {
                          const info = ACTIVITY_LABELS[activity];
                          if (!info) return null;
                          const isOff = getOverrideDisabled(selectedDicteeId).has(activity);
                          return (
                            <Reorder.Item
                              key={activity}
                              value={activity}
                              whileDrag={{
                                scale: 1.02,
                                boxShadow: "0 8px 25px rgba(124,58,237,0.3)",
                                zIndex: 50,
                              }}
                              layout
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              className={`rounded-xl p-3 flex items-center gap-3 transition-all cursor-grab active:cursor-grabbing border ${
                                isOff
                                  ? "bg-gray-50 border-gray-200 opacity-50"
                                  : "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100 hover:border-purple-300"
                              }`}
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className="text-2xl flex-shrink-0">{info.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold text-sm ${isOff ? "text-gray-400 line-through" : "text-gray-900"}`}>{info.label}</p>
                              </div>
                              <motion.button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Toggle : ajouter/retirer de l'ordre actif
                                  const currentOrder = overrides[selectedDicteeId]?.activityOrder || defaultOrder.filter(a => !defaultDisabled.has(a));
                                  const newOrder = isOff
                                    ? [...currentOrder, activity]
                                    : currentOrder.filter(a => a !== activity);
                                  setOverrideOrder(selectedDicteeId, newOrder);
                                }}
                                whileTap={{ scale: 0.9 }}
                                className={`w-10 h-6 rounded-full flex-shrink-0 flex items-center px-0.5 transition-colors ${
                                  isOff ? "bg-gray-300" : "bg-purple-600"
                                }`}
                              >
                                <motion.div
                                  layout
                                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                                  animate={{ x: isOff ? 0 : 16 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                              </motion.button>
                            </Reorder.Item>
                          );
                        })}
                      </Reorder.Group>
                    </div>

                    {/* Grille de mots */}
                    {dicteeWords.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-semibold text-gray-700">Mots à inclure</h5>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {(() => {
                                const selected = getSelectedWords(selectedDicteeId);
                                const count =
                                  selected === null
                                    ? dicteeWords.length
                                    : selected.length;
                                return `${count}/${dicteeWords.length} mots actifs`;
                              })()}
                            </span>
                            <div className="flex gap-1">
                              <motion.button
                                onClick={() => toggleAllWords(selectedDicteeId, true)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
                              >
                                Tous
                              </motion.button>
                              <motion.button
                                onClick={() => toggleAllWords(selectedDicteeId, false)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                              >
                                Aucun
                              </motion.button>
                            </div>
                          </div>
                        </div>
                        <div data-tour="word-toggle-grid" className="flex flex-wrap gap-2">
                          {dicteeWords.map((w) => {
                            const selected = getSelectedWords(selectedDicteeId);
                            const isActive = selected === null || selected.includes(w.position);
                            return (
                              <motion.button
                                key={w.position}
                                onClick={() => toggleWord(selectedDicteeId, w.position)}
                                whileTap={{ scale: 0.95 }}
                                className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all border-2 ${
                                  isActive
                                    ? "bg-purple-50 border-purple-300 text-purple-800 shadow-sm"
                                    : "bg-gray-50 border-gray-200 text-gray-400 line-through"
                                }`}
                              >
                                {w.word}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Bouton sauvegarder cette dictée */}
                    {overridesDirty.has(selectedDicteeId) && (
                      <motion.button
                        onClick={() => handleSaveOverride(selectedDicteeId)}
                        disabled={saving}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Enregistrer cette configuration
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
