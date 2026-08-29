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
  updateClassOptionalActivities,
  loadClassOptionalActivities,
  saveDicteeOverride,
  deleteDicteeOverride,
  updateWordSpellingErrors,
  updateWordGrammaticalClass,
  loadFillBlanksVariants,
  type FillBlanksVariant,
} from "@/lib/dictee-service";
import {
  classifyWord,
  GRAMMAR_LABELS,
  type GrammaticalClass,
} from "@/lib/grammar-classifier";
import WordConfigModal, { type WordConfigRow } from "@/components/word-config-modal";
import WordConfigSection from "@/components/word-config-section";

const ACTIVITY_LABELS: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  flashcard: { label: "Flashcard", icon: "🃏", desc: "Mémorise l'orthographe de chaque mot", color: "from-blue-400 to-blue-600" },
  genre: { label: "Genre", icon: "🏷️", desc: "Choisis le bon article pour chaque mot", color: "from-pink-400 to-pink-600" },
  spelling_choice: { label: "Choix orthographique", icon: "✏️", desc: "Trouve la bonne orthographe parmi les propositions", color: "from-amber-400 to-amber-600" },
  definitions: { label: "Définitions", icon: "📖", desc: "Associe chaque mot à sa définition", color: "from-emerald-400 to-emerald-600" },
  dictionary: { label: "Dictionnaire", icon: "📚", desc: "Cherche les mots dans ton dictionnaire", color: "from-teal-400 to-teal-600" },
  audio_word: { label: "Audio mot", icon: "🎧", desc: "Écoute et écris le mot correctement", color: "from-indigo-400 to-indigo-600" },
  fill_blanks: { label: "Texte à trous", icon: "📝", desc: "Complète le texte avec les bons mots", color: "from-orange-400 to-orange-600" },
  audio_dictation: { label: "Dictée audio", icon: "🎙️", desc: "Écoute la dictée phrase par phrase et écris", color: "from-purple-400 to-purple-600" },
  grammar_class: { label: "Classes grammaticales", icon: "🔤", desc: "Choisis la classe grammaticale du mot", color: "from-cyan-400 to-cyan-600" },
};

const ALL_ACTIVITIES = Object.keys(ACTIVITY_LABELS);

interface ParcoursConfigProps {
  open: boolean;
  onClose: () => void;
  dmClassId: string;
  className: string;
  dictees: { id: string; title: string; position: number }[];
  students?: { id: string; name: string }[];
  displayName?: (name: string) => string;
}

export default function ParcoursConfig({
  open,
  onClose,
  dmClassId,
  className,
  dictees,
  students = [],
  displayName = (n) => n,
}: ParcoursConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ordre par défaut de la classe (toujours les 8 activités, order = position)
  const [defaultOrder, setDefaultOrder] = useState<string[]>(ALL_ACTIVITIES);
  const [defaultDisabled, setDefaultDisabled] = useState<Set<string>>(new Set());
  // Activités FACULTATIVES (niveau classe) : visibles côté élève mais ne bloquent
  // pas la progression vers l'exercice suivant.
  const [defaultOptional, setDefaultOptional] = useState<Set<string>>(new Set());
  const [defaultOrderDirty, setDefaultOrderDirty] = useState(false);

  // Mode : classe entière ou élève spécifique
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showStudentList, setShowStudentList] = useState(false);

  // Dictée sélectionnée
  const [selectedDicteeId, setSelectedDicteeId] = useState<string | null>(null);
  const [selectedDicteePos, setSelectedDicteePos] = useState<number | null>(null);

  // Overrides par dictée
  const [overrides, setOverrides] = useState<Record<string, { activityOrder: string[]; selectedWords: number[] | null }>>({});
  const [overridesDirty, setOverridesDirty] = useState<Set<string>>(new Set());

  // Mots de la dictée sélectionnée (avec leurs distracteurs et classe grammaticale éditables)
  const [dicteeWords, setDicteeWords] = useState<WordConfigRow[]>([]);

  // État de l'éditeur de distracteurs (un mot à la fois) — conservé pour compat,
  // mais l'édition se fait maintenant via la nouvelle modale WordConfigModal.
  const [editingWordPos, setEditingWordPos] = useState<number | null>(null);
  const [editingErrors, setEditingErrors] = useState<string[]>([]);
  const [newErrorDraft, setNewErrorDraft] = useState("");
  const [savingErrors, setSavingErrors] = useState(false);
  const [highlightWordGrid, setHighlightWordGrid] = useState(false);

  // État de l'éditeur de classe grammaticale (un mot à la fois) — idem, hérité.
  const [editingGrammarPos, setEditingGrammarPos] = useState<number | null>(null);
  const [savingGrammar, setSavingGrammar] = useState(false);

  // Nouvelle modale unifiée par mot
  const [modalWordPos, setModalWordPos] = useState<number | null>(null);

  // Section « Personnaliser les mots » (Variante 2 — tabs horizontales)
  const [showWordConfigSection, setShowWordConfigSection] = useState(false);

  // Variantes du texte à trous (onglet Variantes dans WordConfigSection)
  const [variants, setVariants] = useState<FillBlanksVariant[]>([]);
  const teacherPassword = process.env.NEXT_PUBLIC_TEACHER_PASSWORD || "";

  // Total des pièges sur toute la dictée (pour l'indicateur sur le chip Choix orthographique)
  const totalErrors = dicteeWords.reduce((s, w) => s + (w.spelling_errors?.length || 0), 0);

  const scrollToWordGrid = () => {
    const el = document.getElementById("word-grid-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlightWordGrid(true);
      setTimeout(() => setHighlightWordGrid(false), 1500);
    }
  };

  // Chargement au montage et quand on change d'élève
  useEffect(() => {
    const load = async () => {
      const [order, allOverrides, optional] = await Promise.all([
        loadClassDefaultOrder(dmClassId),
        loadAllDicteeOverrides(dmClassId, selectedStudentId),
        loadClassOptionalActivities(dmClassId),
      ]);
      const savedOrder = order || ALL_ACTIVITIES;
      // L'ordre sauvegardé ne contient que les activités actives
      // Reconstruire l'ordre complet : actives en premier (dans l'ordre), puis désactivées
      const disabled = new Set(ALL_ACTIVITIES.filter(a => !savedOrder.includes(a)));
      const fullOrder = [...savedOrder, ...ALL_ACTIVITIES.filter(a => !savedOrder.includes(a))];
      setDefaultOrder(fullOrder);
      setDefaultDisabled(disabled);
      setDefaultOptional(new Set(optional));
      setOverrides(allOverrides);
      setLoading(false);
    };
    if (open) {
      setLoading(true);
      load();
    }
  }, [open, dmClassId, selectedStudentId]);

  // Chargement des mots et des variantes quand on sélectionne une dictée
  useEffect(() => {
    if (!selectedDicteeId) {
      setDicteeWords([]);
      setVariants([]);
      return;
    }
    const load = async () => {
      const sb = createClient();
      const [wordsData, loadedVariants] = await Promise.all([
        sb
          .from("dictee_words")
          .select("word, position, spelling_errors, grammatical_class, lemma, article, definition, audio_url")
          .eq("dictee_id", selectedDicteeId)
          .order("position"),
        loadFillBlanksVariants(selectedDicteeId),
      ]);
      setDicteeWords(
        (wordsData.data || []).map((w: any) => ({
          word: w.word,
          position: w.position,
          spelling_errors: Array.isArray(w.spelling_errors) ? w.spelling_errors : [],
          grammatical_class: w.grammatical_class || null,
          lemma: w.lemma || null,
          article: w.article || null,
          definition: w.definition || null,
          audio_url: w.audio_url || null,
        })),
      );
      setVariants(loadedVariants);
      // Reset éditeurs si on change de dictée
      setEditingWordPos(null);
      setEditingErrors([]);
      setNewErrorDraft("");
      setEditingGrammarPos(null);
    };
    load();
  }, [selectedDicteeId]);

  // Helpers pour l'éditeur de distracteurs
  const startEditErrors = (position: number) => {
    const w = dicteeWords.find((x) => x.position === position);
    if (!w) return;
    setEditingWordPos(position);
    setEditingErrors([...w.spelling_errors]);
    setNewErrorDraft("");
  };

  const cancelEditErrors = () => {
    setEditingWordPos(null);
    setEditingErrors([]);
    setNewErrorDraft("");
  };

  const addErrorDraft = () => {
    const v = newErrorDraft.trim();
    if (!v) return;
    if (editingErrors.includes(v)) {
      toast.error("Ce piège existe déjà");
      return;
    }
    setEditingErrors([...editingErrors, v]);
    setNewErrorDraft("");
  };

  const removeErrorAt = (idx: number) => {
    setEditingErrors(editingErrors.filter((_, i) => i !== idx));
  };

  // Helpers éditeur classe grammaticale
  const startEditGrammar = (position: number) => {
    setEditingGrammarPos(position);
    // Ferme l'éditeur de pièges si ouvert
    if (editingWordPos !== null) {
      setEditingWordPos(null);
      setEditingErrors([]);
      setNewErrorDraft("");
    }
  };
  const cancelEditGrammar = () => setEditingGrammarPos(null);
  const setGrammarFor = async (position: number, gc: GrammaticalClass | null) => {
    if (!selectedDicteeId) return;
    setSavingGrammar(true);
    try {
      await updateWordGrammaticalClass(selectedDicteeId, position, gc);
      setDicteeWords((prev) =>
        prev.map((w) => (w.position === position ? { ...w, grammatical_class: gc } : w)),
      );
      toast.success(gc ? `Classe : ${GRAMMAR_LABELS[gc]}` : "Retour à l'auto-détection");
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || "sauvegarde impossible"}`);
    }
    setSavingGrammar(false);
  };

  const saveErrors = async () => {
    if (editingWordPos === null || !selectedDicteeId) return;
    setSavingErrors(true);
    try {
      await updateWordSpellingErrors(selectedDicteeId, editingWordPos, editingErrors);
      // Mettre à jour le state local pour refléter sans recharger
      setDicteeWords((prev) =>
        prev.map((w) =>
          w.position === editingWordPos ? { ...w, spelling_errors: editingErrors } : w,
        ),
      );
      toast.success("Pièges sauvegardés");
      cancelEditErrors();
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message || "sauvegarde impossible"}`);
    }
    setSavingErrors(false);
  };

  // Fonctions de sauvegarde
  const handleSaveDefault = async () => {
    setSaving(true);
    try {
      const activeOrder = defaultOrder.filter(a => !defaultDisabled.has(a));
      // Une activité désactivée ne peut pas rester marquée facultative.
      const optional = activeOrder.filter(a => defaultOptional.has(a));
      await updateActivityOrder(dmClassId, activeOrder);
      await updateClassOptionalActivities(dmClassId, optional);
      setDefaultOptional(new Set(optional));
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
      <div className="bg-white w-full max-w-4xl rounded-2xl max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200">
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
          <div className="px-5 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-600">Configurer pour :</span>
              <motion.button
                onClick={() => { setSelectedStudentId(null); setShowStudentList(false); setSelectedDicteeId(null); }}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  !selectedStudentId && !showStudentList
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
                }`}
              >
                Toute la classe
              </motion.button>
              <motion.button
                onClick={() => setShowStudentList(!showStudentList)}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  selectedStudentId || showStudentList
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-purple-300"
                }`}
              >
                🎯 Un élève {selectedStudentId ? `(${displayName(students.find(s => s.id === selectedStudentId)?.name || "")})` : ""}
              </motion.button>
            </div>
            <AnimatePresence>
              {showStudentList && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 mt-3 overflow-hidden"
                >
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
                      {displayName(s.name)}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
                      Parcours personnalisé pour {displayName(students.find(s => s.id === selectedStudentId)?.name || "")}
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
                    const isOptional = defaultOptional.has(activity);
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
                        {/* Chip « Facultatif » — l'exercice reste visible mais ne bloque
                            plus la progression (ex : Dictionnaire facultatif pour les 6A). */}
                        {!isDisabled && (
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultOptional(prev => {
                                const next = new Set(prev);
                                if (next.has(activity)) next.delete(activity);
                                else next.add(activity);
                                return next;
                              });
                              setDefaultOrderDirty(true);
                            }}
                            whileTap={{ scale: 0.95 }}
                            title={
                              isOptional
                                ? "Exercice facultatif : l'élève peut le sauter"
                                : "Exercice obligatoire : il faut le faire pour continuer"
                            }
                            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              isOptional
                                ? "bg-amber-100 border-amber-300 text-amber-800"
                                : "bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-700"
                            }`}
                          >
                            {isOptional ? "Facultatif" : "Obligatoire"}
                          </motion.button>
                        )}
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
                            const newId = isSelected ? null : d.id;
                            setSelectedDicteeId(newId);
                            setSelectedDicteePos(isSelected ? null : d.position);
                            if (newId) {
                              setTimeout(() => {
                                document.getElementById("dictee-detail-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
                              }, 120);
                            }
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          title={`Dictée n°${d.position} — configurer les exercices et modifier les pièges`}
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
                {!selectedDicteeId && (
                  <p className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                    <span>👆</span>
                    <span>Clique sur un numéro pour configurer les exercices et modifier les pièges du mode <strong>Choix orthographique</strong></span>
                  </p>
                )}
              </div>

              {/* Section 3 — Détail dictée */}
              <AnimatePresence mode="popLayout">
                {selectedDicteeId && showWordConfigSection && dicteeWords.length > 0 && (
                  <div className="border-t pt-4" style={{ minHeight: 600 }}>
                    <WordConfigSection
                      dicteeId={selectedDicteeId}
                      dicteePosition={selectedDicteePos!}
                      words={dicteeWords}
                      onBack={() => setShowWordConfigSection(false)}
                      onUpdated={(updated) =>
                        setDicteeWords((ws) =>
                          ws.map((w) => (w.position === updated.position ? updated : w))
                        )
                      }
                      variants={variants}
                      teacherPassword={teacherPassword}
                      onVariantsChange={setVariants}
                    />
                  </div>
                )}
                {selectedDicteeId && !showWordConfigSection && (
                  <motion.div
                    id="dictee-detail-section"
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
                      <div className="flex items-center gap-2">
                        {dicteeWords.length > 0 && (
                          <motion.button
                            onClick={() => setShowWordConfigSection(true)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl font-semibold text-sm shadow hover:opacity-90 transition"
                          >
                            🎯 Personnaliser les mots
                          </motion.button>
                        )}
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
                              className={`rounded-xl ${selectedStudentId ? "px-3 py-2" : "p-3"} flex items-center gap-2 transition-all cursor-grab active:cursor-grabbing border ${
                                isOff
                                  ? "bg-gray-50 border-gray-200 opacity-50"
                                  : "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-100 hover:border-purple-300"
                              }`}
                            >
                              <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <div className={`${selectedStudentId ? "text-lg" : "text-2xl"} flex-shrink-0`}>{info.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-semibold ${selectedStudentId ? "text-xs" : "text-sm"} ${isOff ? "text-gray-400 line-through" : "text-gray-900"}`}>{info.label}</p>
                              </div>
                              {activity === "spelling_choice" && !isOff && (
                                <motion.button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    scrollToWordGrid();
                                  }}
                                  whileTap={{ scale: 0.95 }}
                                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center gap-1.5 flex-shrink-0 shadow-sm"
                                  title="Modifier les fausses orthographes proposées à l'élève"
                                >
                                  🪤 Modifier les pièges
                                </motion.button>
                              )}
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
                      <div
                        id="word-grid-section"
                        className={`transition-all rounded-2xl ${
                          highlightWordGrid ? "ring-4 ring-amber-300 ring-offset-2 bg-amber-50/30 p-3" : ""
                        }`}
                      >
                        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                          🪤 <strong>Pièges du mode Choix orthographique :</strong> clique sur l'icône 🪤 d'un mot ci-dessous pour personnaliser ses fausses orthographes proposées à l'élève.
                        </div>
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
                        <p className="text-xs text-gray-500 mb-2">
                          <strong>Clique sur un mot</strong> pour configurer ses exercices · le ⊘ au survol l'exclut du parcours.
                        </p>
                        <div data-tour="word-toggle-grid" className="flex flex-wrap gap-2">
                          {dicteeWords.map((w) => {
                            const selected = getSelectedWords(selectedDicteeId);
                            const isActive = selected === null || selected.includes(w.position);
                            const customCount =
                              (w.spelling_errors?.length > 0 ? 1 : 0) +
                              (w.grammatical_class ? 1 : 0) +
                              (w.audio_url ? 1 : 0);
                            return (
                              <div
                                key={w.position}
                                className={`group relative inline-flex items-center rounded-xl border-2 transition-all overflow-hidden ${
                                  isActive
                                    ? "border-purple-300 bg-purple-50 shadow-sm hover:border-purple-500 hover:shadow-md"
                                    : "border-gray-200 bg-gray-50"
                                }`}
                              >
                                <button
                                  onClick={() => setShowWordConfigSection(true)}
                                  className={`px-3 py-2 text-sm font-semibold transition-colors ${
                                    isActive
                                      ? "text-purple-800"
                                      : "text-gray-400 line-through"
                                  }`}
                                  title="Configurer les exercices pour ce mot"
                                >
                                  {w.word}
                                  {customCount > 0 && (
                                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold align-middle">
                                      {customCount}
                                    </span>
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleWord(selectedDicteeId, w.position);
                                  }}
                                  className={`opacity-0 group-hover:opacity-100 transition-opacity ml-0 mr-1.5 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                    isActive
                                      ? "text-red-500 hover:bg-red-100"
                                      : "text-emerald-600 hover:bg-emerald-100"
                                  }`}
                                  title={isActive ? "Exclure ce mot du parcours" : "Inclure ce mot dans le parcours"}
                                >
                                  {isActive ? "⊘" : "✓"}
                                </button>
                              </div>
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

      {/* Modale unifiée : configuration d'un mot pour tous les exercices */}
      <WordConfigModal
        open={modalWordPos !== null}
        onClose={() => setModalWordPos(null)}
        dicteeId={selectedDicteeId || ""}
        dicteePosition={
          dictees.find((d) => d.id === selectedDicteeId)?.position ?? 0
        }
        word={
          modalWordPos !== null
            ? dicteeWords.find((w) => w.position === modalWordPos) || null
            : null
        }
        onUpdated={(updated) => {
          setDicteeWords((prev) =>
            prev.map((w) => (w.position === updated.position ? { ...w, ...updated } : w)),
          );
        }}
      />
    </div>
  );
}
