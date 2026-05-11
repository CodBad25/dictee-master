"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateWordSpellingErrors,
  updateWordGrammaticalClass,
  updateWordDefinition,
} from "@/lib/dictee-service";
import {
  classifyWord,
  GRAMMAR_LABELS,
  type GrammaticalClass,
} from "@/lib/grammar-classifier";
import AudioRecorder from "@/components/audio-recorder";

export type WordConfigRow = {
  word: string;
  position: number;
  spelling_errors: string[];
  grammatical_class: string | null;
  lemma: string | null;
  article?: string | null;
  definition?: string | null;
  audio_url?: string | null;
};

interface WordConfigModalProps {
  open: boolean;
  onClose: () => void;
  dicteeId: string;
  dicteePosition: number;
  word: WordConfigRow | null;
  onUpdated: (updated: WordConfigRow) => void;
}

type ExoId =
  | "flashcard"
  | "genre"
  | "spelling_choice"
  | "definitions"
  | "dictionary"
  | "audio_word"
  | "fill_blanks"
  | "audio_dictation"
  | "grammar_class";

type ExoDef = {
  id: ExoId;
  icon: string;
  label: string;
  perWord: boolean;
};

const EXOS: ExoDef[] = [
  { id: "flashcard", icon: "🃏", label: "Flashcard", perWord: false },
  { id: "genre", icon: "🏷️", label: "Genre", perWord: true },
  { id: "spelling_choice", icon: "✏️", label: "Choix orthographique", perWord: true },
  { id: "definitions", icon: "📖", label: "Définitions", perWord: true },
  { id: "dictionary", icon: "📚", label: "Dictionnaire", perWord: false },
  { id: "audio_word", icon: "🎧", label: "Audio mot", perWord: true },
  { id: "fill_blanks", icon: "📝", label: "Texte à trous", perWord: false },
  { id: "audio_dictation", icon: "🎙️", label: "Dictée audio", perWord: false },
  { id: "grammar_class", icon: "🔤", label: "Classes grammaticales", perWord: true },
];

export default function WordConfigModal({
  open,
  onClose,
  dicteeId,
  dicteePosition,
  word,
  onUpdated,
}: WordConfigModalProps) {
  const [activeExo, setActiveExo] = useState<ExoId | null>(null);
  const [localWord, setLocalWord] = useState<WordConfigRow | null>(word);

  useEffect(() => {
    setLocalWord(word);
    setActiveExo(null);
  }, [word?.position]);

  if (!open || !localWord) return null;

  const w = localWord;
  const lemma = w.lemma || w.word;

  // Calcul "exo a une perso pour ce mot"
  const hasCustom = (exoId: ExoId): boolean => {
    if (exoId === "spelling_choice") return (w.spelling_errors?.length ?? 0) > 0;
    if (exoId === "grammar_class") return !!w.grammatical_class;
    if (exoId === "definitions") return !!w.definition;
    if (exoId === "audio_word") return !!w.audio_url;
    if (exoId === "genre") return !!w.article;
    return false;
  };

  // Helper pour propager la modif locale + parent
  const updateLocal = (patch: Partial<WordConfigRow>) => {
    const next = { ...w, ...patch };
    setLocalWord(next);
    onUpdated(next);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto max-h-[88vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header purple/indigo */}
              <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4 rounded-t-2xl flex items-start justify-between sticky top-0 z-10">
                <div className="flex-1">
                  <p className="text-xs text-purple-100 uppercase tracking-wide">
                    Dictée n°{dicteePosition} · mot n°{w.position + 1}
                  </p>
                  <h2 className="text-2xl font-black mt-0.5">{w.word}</h2>
                  <p className="text-xs text-purple-100 mt-1">
                    Lemma : <strong>{lemma}</strong>
                    {w.article && <> · Article : <strong>{w.article}</strong></>}
                    {w.definition && <> · « {w.definition} »</>}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="hover:bg-white/20 rounded-lg p-2 transition shrink-0"
                  title="Fermer"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              {/* Body */}
              <div className="p-5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  Personnalisation pour ce mot — clique sur un exercice
                </h3>

                {/* Grille 3×3 */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {EXOS.map((exo) => {
                    const customized = hasCustom(exo.id);
                    const isActive = activeExo === exo.id;
                    return (
                      <button
                        key={exo.id}
                        onClick={() => setActiveExo(isActive ? null : exo.id)}
                        className={`relative p-4 rounded-xl border-2 text-center transition ${
                          isActive
                            ? "border-purple-600 bg-purple-50 shadow-md"
                            : exo.perWord
                            ? "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 cursor-pointer"
                            : "border-gray-100 bg-gray-50 text-gray-400 cursor-pointer"
                        }`}
                      >
                        {customized && (
                          <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
                            ✓
                          </span>
                        )}
                        <div className="text-3xl mb-1">{exo.icon}</div>
                        <div className="text-xs font-semibold leading-tight">{exo.label}</div>
                        {!exo.perWord && (
                          <div className="text-[10px] text-gray-400 mt-1">rien à personnaliser</div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Panneau d'édition */}
                <AnimatePresence mode="wait">
                  {activeExo && (
                    <motion.div
                      key={activeExo}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="border-t pt-4"
                    >
                      <ExoPanel
                        exoId={activeExo}
                        word={w}
                        dicteeId={dicteeId}
                        onUpdate={updateLocal}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// === Panneau d'édition par exercice ===

function ExoPanel({
  exoId,
  word,
  dicteeId,
  onUpdate,
}: {
  exoId: ExoId;
  word: WordConfigRow;
  dicteeId: string;
  onUpdate: (patch: Partial<WordConfigRow>) => void;
}) {
  switch (exoId) {
    case "spelling_choice":
      return <TrapsEditor word={word} dicteeId={dicteeId} onUpdate={onUpdate} />;
    case "grammar_class":
      return <GrammarEditor word={word} dicteeId={dicteeId} onUpdate={onUpdate} />;
    case "definitions":
      return <DefinitionEditor word={word} dicteeId={dicteeId} onUpdate={onUpdate} />;
    case "audio_word":
      return (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <h4 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
            🎧 Audio personnalisé
          </h4>
          <p className="text-xs text-indigo-700 mb-3">
            Enregistre ta voix pour remplacer la synthèse vocale du navigateur. L'élève entendra ton enregistrement quand il fera ce mot dans le mode Audio.
          </p>
          <AudioRecorder
            dicteeId={dicteeId}
            position={word.position}
            initialAudioUrl={word.audio_url ?? null}
            onUpdated={(url) => onUpdate({ audio_url: url })}
          />
        </div>
      );
    case "genre":
      return (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
          <h4 className="font-bold text-pink-900 mb-2">🏷️ Article (mode Genre)</h4>
          {word.article ? (
            <>
              <p className="text-sm text-pink-900">L'élève devra retrouver l'article correct :</p>
              <div className="mt-2 inline-block px-4 py-2 bg-white border-2 border-pink-300 rounded-lg font-bold text-pink-700 text-lg">
                {word.article}
              </div>
            </>
          ) : (
            <p className="text-sm text-pink-900">
              Ce mot n'a pas d'article. Le mode Genre l'ignorera.
            </p>
          )}
          <p className="text-xs text-pink-700 mt-3">
            Pour modifier l'article, il faut renommer le mot via une migration en base.
          </p>
        </div>
      );
    default:
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-600 text-sm">
          Cet exercice n'a pas de personnalisation au niveau du mot.
        </div>
      );
  }
}

// === Sous-éditeurs ===

function TrapsEditor({
  word,
  dicteeId,
  onUpdate,
}: {
  word: WordConfigRow;
  dicteeId: string;
  onUpdate: (patch: Partial<WordConfigRow>) => void;
}) {
  const [errors, setErrors] = useState<string[]>(word.spelling_errors || []);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setErrors(word.spelling_errors || []), [word.position]);

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (errors.includes(v)) {
      toast.error("Ce piège existe déjà");
      return;
    }
    setErrors([...errors, v]);
    setDraft("");
  };
  const remove = (idx: number) => setErrors(errors.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    try {
      await updateWordSpellingErrors(dicteeId, word.position, errors);
      onUpdate({ spelling_errors: errors });
      toast.success("Pièges sauvegardés");
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || "sauvegarde impossible"));
    }
    setSaving(false);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <h4 className="font-bold text-amber-900 mb-2">🪤 Pièges du mode Choix orthographique</h4>
      <p className="text-xs text-amber-800 mb-3">
        Orthographes fausses proposées comme distracteurs à l'élève.
      </p>
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {errors.length === 0 && (
          <span className="text-xs italic text-amber-700">
            Aucun piège — ajoute-en au moins 2 pour que ce mode fonctionne bien.
          </span>
        )}
        {errors.map((e, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-sm"
          >
            {e}
            <button
              onClick={() => remove(i)}
              className="text-red-500 hover:text-red-700"
              title="Supprimer"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Ajouter un piège…"
          className="flex-1 px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" /> Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function GrammarEditor({
  word,
  dicteeId,
  onUpdate,
}: {
  word: WordConfigRow;
  dicteeId: string;
  onUpdate: (patch: Partial<WordConfigRow>) => void;
}) {
  const [saving, setSaving] = useState(false);
  const lemma = word.lemma || word.word;
  const auto = classifyWord(lemma);
  const current = (word.grammatical_class as GrammaticalClass | null) || auto;
  const allClasses: GrammaticalClass[] = [
    "nom", "nom_propre", "verbe", "adjectif",
    "determinant", "pronom", "adverbe", "preposition", "conjonction",
  ];

  const setClass = async (gc: GrammaticalClass | null) => {
    setSaving(true);
    try {
      await updateWordGrammaticalClass(dicteeId, word.position, gc);
      onUpdate({ grammatical_class: gc });
      toast.success(gc ? `Classe : ${GRAMMAR_LABELS[gc]}` : "Retour à l'auto-détection");
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || "sauvegarde impossible"));
    }
    setSaving(false);
  };

  return (
    <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4">
      <h4 className="font-bold text-cyan-900 mb-1">🔤 Classe grammaticale</h4>
      <p className="text-xs text-cyan-800 mb-3">
        Auto-détection : <strong>{GRAMMAR_LABELS[auto]}</strong>
        {word.grammatical_class && (
          <> · Édité : <strong>{GRAMMAR_LABELS[word.grammatical_class as GrammaticalClass]}</strong></>
        )}
      </p>
      <div className="flex flex-wrap gap-2 mb-2">
        {allClasses.map((gc) => {
          const active = current === gc;
          const isManual = word.grammatical_class === gc;
          return (
            <button
              key={gc}
              onClick={() => setClass(gc)}
              disabled={saving}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition disabled:opacity-50 ${
                active
                  ? isManual
                    ? "bg-cyan-600 border-cyan-700 text-white"
                    : "bg-cyan-100 border-cyan-400 text-cyan-900"
                  : "bg-white border-gray-200 text-gray-700 hover:border-cyan-400 hover:bg-cyan-50"
              }`}
            >
              {GRAMMAR_LABELS[gc]}
            </button>
          );
        })}
      </div>
      {word.grammatical_class && (
        <button
          onClick={() => setClass(null)}
          disabled={saving}
          className="text-xs text-cyan-700 hover:underline disabled:opacity-50 mt-2"
        >
          ↺ Revenir à l'auto-détection
        </button>
      )}
    </div>
  );
}

function DefinitionEditor({
  word,
  dicteeId,
  onUpdate,
}: {
  word: WordConfigRow;
  dicteeId: string;
  onUpdate: (patch: Partial<WordConfigRow>) => void;
}) {
  const [text, setText] = useState(word.definition || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => setText(word.definition || ""), [word.position]);

  const save = async () => {
    setSaving(true);
    try {
      await updateWordDefinition(dicteeId, word.position, text);
      onUpdate({ definition: text });
      toast.success("Définition sauvegardée");
    } catch (e: any) {
      toast.error("Erreur : " + (e?.message || "sauvegarde impossible"));
    }
    setSaving(false);
  };

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
      <h4 className="font-bold text-emerald-900 mb-2">📖 Définition (mode Définitions)</h4>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
        placeholder="Ce qui définit ce mot, à associer côté élève…"
      />
      <div className="flex justify-end mt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…
            </>
          ) : (
            <>
              <Check className="w-4 h-4" /> Enregistrer
            </>
          )}
        </button>
      </div>
    </div>
  );
}
