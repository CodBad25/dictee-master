"use client";
import { useState, useRef } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  updateWordSpellingErrors,
  updateWordGrammaticalClass,
  updateWordDefinition,
} from "@/lib/dictee-service";
import { classifyWord, GRAMMAR_LABELS, type GrammaticalClass } from "@/lib/grammar-classifier";
import type { WordConfigRow } from "@/components/word-config-modal";

type TabId = "spelling_choice" | "grammar_class" | "definitions" | "audio_word" | "genre";

const TABS: { id: TabId; icon: string; label: string; short: string }[] = [
  { id: "spelling_choice", icon: "✏️", label: "Choix orthographique", short: "Pièges" },
  { id: "grammar_class",   icon: "🔤", label: "Classes grammaticales", short: "Classe gram." },
  { id: "definitions",     icon: "📖", label: "Définitions",           short: "Définitions" },
  { id: "audio_word",      icon: "🎧", label: "Audio mot",             short: "Audio mot" },
  { id: "genre",           icon: "🏷️", label: "Genre",                 short: "Genre" },
];

const FIXED_EXOS = [
  { icon: "🃏", label: "Flashcard" },
  { icon: "📚", label: "Dictionnaire" },
  { icon: "📝", label: "Trous" },
  { icon: "🎙️", label: "Dictée" },
];

const TAB_COLORS: Record<TabId, { active: string; banner: string; chip: string }> = {
  spelling_choice: {
    active: "border-b-[3px] border-amber-400 bg-amber-50 text-amber-900",
    banner: "bg-amber-50 border-amber-100 text-amber-800",
    chip: "bg-amber-100 text-amber-700 border border-amber-300",
  },
  grammar_class: {
    active: "border-b-[3px] border-cyan-400 bg-cyan-50 text-cyan-900",
    banner: "bg-cyan-50 border-cyan-100 text-cyan-800",
    chip: "bg-cyan-100 text-cyan-700 border border-cyan-300",
  },
  definitions: {
    active: "border-b-[3px] border-emerald-400 bg-emerald-50 text-emerald-900",
    banner: "bg-emerald-50 border-emerald-100 text-emerald-800",
    chip: "bg-emerald-100 text-emerald-700 border border-emerald-300",
  },
  audio_word: {
    active: "border-b-[3px] border-indigo-400 bg-indigo-50 text-indigo-900",
    banner: "bg-indigo-50 border-indigo-100 text-indigo-800",
    chip: "bg-indigo-100 text-indigo-700 border border-indigo-300",
  },
  genre: {
    active: "border-b-[3px] border-rose-400 bg-rose-50 text-rose-900",
    banner: "bg-rose-50 border-rose-100 text-rose-800",
    chip: "bg-rose-100 text-rose-700 border border-rose-300",
  },
};

const ARTICLE_OPTIONS = ["le", "la", "l'", "les", "un", "une", "des", ""];

interface Props {
  dicteeId: string;
  dicteePosition: number;
  words: WordConfigRow[];
  onBack: () => void;
  onUpdated: (updated: WordConfigRow) => void;
}

export default function WordConfigSection({ dicteeId, dicteePosition, words, onBack, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("spelling_choice");
  const [localWords, setLocalWords] = useState<WordConfigRow[]>(words);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  // State for inline "add piège" input per word position
  const [addingPos, setAddingPos] = useState<number | null>(null);
  const [addingVal, setAddingVal] = useState("");
  // State for expanded grammar selector
  const [gramPos, setGramPos] = useState<number | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const colors = TAB_COLORS[activeTab];

  const setSavingFor = (pos: number, val: boolean) =>
    setSaving((s) => ({ ...s, [pos]: val }));

  const patchWord = (pos: number, patch: Partial<WordConfigRow>) =>
    setLocalWords((ws) => ws.map((w) => (w.position === pos ? { ...w, ...patch } : w)));

  // ── Pièges ──────────────────────────────────────────────────────────────

  const removeError = async (pos: number, err: string) => {
    const w = localWords.find((x) => x.position === pos);
    if (!w) return;
    const next = w.spelling_errors.filter((e) => e !== err);
    patchWord(pos, { spelling_errors: next });
    setSavingFor(pos, true);
    try {
      await updateWordSpellingErrors(dicteeId, pos, next);
      onUpdated({ ...w, spelling_errors: next });
    } catch {
      toast.error("Erreur lors de la suppression");
      patchWord(pos, { spelling_errors: w.spelling_errors });
    } finally {
      setSavingFor(pos, false);
    }
  };

  const confirmAddError = async (pos: number) => {
    const val = addingVal.trim();
    if (!val) { setAddingPos(null); setAddingVal(""); return; }
    const w = localWords.find((x) => x.position === pos);
    if (!w) return;
    if (w.spelling_errors.includes(val)) {
      toast.error("Ce piège existe déjà");
      return;
    }
    const next = [...w.spelling_errors, val];
    patchWord(pos, { spelling_errors: next });
    setAddingPos(null); setAddingVal("");
    setSavingFor(pos, true);
    try {
      await updateWordSpellingErrors(dicteeId, pos, next);
      onUpdated({ ...w, spelling_errors: next });
    } catch {
      toast.error("Erreur lors de l'ajout");
      patchWord(pos, { spelling_errors: w.spelling_errors });
    } finally {
      setSavingFor(pos, false);
    }
  };

  // ── Classe gram. ─────────────────────────────────────────────────────────

  const setGramClass = async (pos: number, gc: GrammaticalClass | null) => {
    const w = localWords.find((x) => x.position === pos);
    if (!w) return;
    patchWord(pos, { grammatical_class: gc });
    setGramPos(null);
    setSavingFor(pos, true);
    try {
      await updateWordGrammaticalClass(dicteeId, pos, gc);
      onUpdated({ ...w, grammatical_class: gc });
    } catch {
      toast.error("Erreur lors de la mise à jour");
      patchWord(pos, { grammatical_class: w.grammatical_class });
    } finally {
      setSavingFor(pos, false);
    }
  };

  // ── Définitions ───────────────────────────────────────────────────────────

  const saveDefinition = async (pos: number, def: string) => {
    const w = localWords.find((x) => x.position === pos);
    if (!w || w.definition === def) return;
    setSavingFor(pos, true);
    try {
      await updateWordDefinition(dicteeId, pos, def);
      patchWord(pos, { definition: def });
      onUpdated({ ...w, definition: def });
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSavingFor(pos, false);
    }
  };

  // ── Compteurs pour les tabs ───────────────────────────────────────────────

  const count = (tab: TabId): number => {
    switch (tab) {
      case "spelling_choice": return localWords.filter((w) => w.spelling_errors.length > 0).length;
      case "grammar_class":   return localWords.filter((w) => w.grammatical_class).length;
      case "definitions":     return localWords.filter((w) => w.definition).length;
      case "audio_word":      return localWords.filter((w) => w.audio_url).length;
      case "genre":           return localWords.filter((w) => w.article).length;
    }
  };

  const n = localWords.length;

  // ── Rendu d'une cellule selon l'onglet actif ──────────────────────────────

  const renderCell = (w: WordConfigRow) => {
    const isSaving = saving[w.position];

    if (activeTab === "spelling_choice") {
      return (
        <div className="flex flex-wrap items-center gap-1">
          {w.spelling_errors.map((err) => (
            <span key={err} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.chip}`}>
              {err}
              <button
                onClick={() => removeError(w.position, err)}
                disabled={isSaving}
                className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-500 transition"
              >×</button>
            </span>
          ))}
          {addingPos === w.position ? (
            <span className="inline-flex items-center gap-1">
              <input
                ref={addInputRef}
                value={addingVal}
                onChange={(e) => setAddingVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAddError(w.position);
                  if (e.key === "Escape") { setAddingPos(null); setAddingVal(""); }
                }}
                onBlur={() => confirmAddError(w.position)}
                className="border border-amber-300 rounded px-1.5 py-0.5 text-xs w-28 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder="orthographe…"
                autoFocus
              />
            </span>
          ) : (
            <button
              onClick={() => { setAddingPos(w.position); setAddingVal(""); setTimeout(() => addInputRef.current?.focus(), 50); }}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border border-dashed border-amber-300 text-amber-500 hover:bg-amber-50 transition"
            >+ ajouter</button>
          )}
          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-amber-400 ml-1" />}
        </div>
      );
    }

    if (activeTab === "grammar_class") {
      const gc = w.grammatical_class as GrammaticalClass | null;
      const manualLabel = gc ? (GRAMMAR_LABELS[gc] ?? gc) : null;
      const suggested = classifyWord(w.word) as GrammaticalClass | null;
      const suggestedLabel = suggested ? (GRAMMAR_LABELS[suggested] ?? suggested) : null;
      return (
        <div className="flex flex-wrap items-center gap-1">
          {gramPos === w.position ? (
            <div className="flex flex-wrap gap-1">
              {(Object.entries(GRAMMAR_LABELS) as [GrammaticalClass, string][]).map(([key, lbl]) => (
                <button
                  key={key}
                  onClick={() => setGramClass(w.position, key)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition
                    ${gc === key ? "bg-cyan-200 border-cyan-400 text-cyan-900" : "bg-white border-gray-200 text-gray-600 hover:bg-cyan-50"}`}
                >{lbl}</button>
              ))}
              <button
                onClick={() => setGramClass(w.position, null)}
                className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50"
              >↺ auto</button>
              <button onClick={() => setGramPos(null)} className="px-2 py-0.5 rounded-full text-[11px] text-gray-400 hover:text-gray-600">✕</button>
            </div>
          ) : manualLabel ? (
            /* Classe définie manuellement */
            <button
              onClick={() => setGramPos(w.position)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition hover:opacity-80 ${colors.chip}`}
            >
              {manualLabel}
              {isSaving && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            </button>
          ) : suggestedLabel ? (
            /* Proposition auto — style pointillé + badge "auto" */
            <button
              onClick={() => setGramPos(w.position)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border border-dashed border-cyan-300 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 transition"
              title="Classe détectée automatiquement — cliquer pour confirmer ou modifier"
            >
              {suggestedLabel}
              <span className="text-[9px] bg-cyan-200 text-cyan-700 px-1 rounded-full font-semibold">auto</span>
              {isSaving && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
            </button>
          ) : (
            <button
              onClick={() => setGramPos(w.position)}
              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs border border-dashed border-gray-300 text-gray-400 hover:bg-gray-50 transition"
            >+ définir</button>
          )}
        </div>
      );
    }

    if (activeTab === "definitions") {
      return (
        <div className="flex items-center gap-2 w-full">
          <input
            defaultValue={w.definition ?? ""}
            onBlur={(e) => saveDefinition(w.position, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            placeholder="Ajouter une définition…"
            className={`flex-1 text-xs border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-400
              ${w.definition ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white text-gray-400"}`}
          />
          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-emerald-400 flex-shrink-0" />}
        </div>
      );
    }

    if (activeTab === "audio_word") {
      return (
        <span className={`inline-flex items-center gap-1 text-xs ${w.audio_url ? "text-indigo-600 font-medium" : "text-gray-300"}`}>
          {w.audio_url ? "🎧 Audio personnalisé" : "— synthèse vocale"}
        </span>
      );
    }

    if (activeTab === "genre") {
      const art = w.article ?? "";
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
          ${art ? colors.chip : "border-dashed border-gray-200 text-gray-300"}`}>
          {art || "— sans article"}
        </span>
      );
    }

    return null;
  };

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">

      {/* Header purple */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onBack}
          className="text-purple-200 hover:text-white transition text-sm flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div className="flex items-center gap-1 text-sm text-purple-200">
          <span>Parcours</span>
          <span>›</span>
          <span>Dictée n°{dicteePosition}</span>
          <span>›</span>
          <span className="text-white font-semibold">Personnaliser les mots</span>
        </div>
      </div>

      {/* Sous-header */}
      <div className="px-5 py-2 border-b border-gray-100 flex-shrink-0">
        <h2 className="font-semibold text-gray-800 text-sm">🎯 Personnaliser les mots — Dictée n°{dicteePosition}</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {n} mots · Sélectionnez un exercice ci-dessous pour éditer mot par mot
        </p>
      </div>

      {/* Tabs horizontales */}
      <div className="flex border-b border-gray-200 flex-shrink-0 bg-gray-50 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const c = TAB_COLORS[tab.id];
          const cnt = count(tab.id);
          const isDisabled = tab.id === "audio_word";
          return (
            <button
              key={tab.id}
              onClick={() => !isDisabled && setActiveTab(tab.id)}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-4 py-2.5 transition border-b-[3px] flex-shrink-0 text-left
                ${isActive ? c.active : "border-transparent text-gray-500 hover:bg-gray-100"}
                ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <span className="text-base">{tab.icon}</span>
              <div>
                <div className="text-xs font-semibold">{tab.short}</div>
                <div className={`text-[10px] ${isActive ? "" : "text-gray-400"}`}>
                  {isDisabled ? "via modale" : `${cnt}/${n}`}
                  {isActive && cnt > 0 && <span className="ml-1">●</span>}
                </div>
              </div>
            </button>
          );
        })}
        {/* Exos fixes */}
        <div className="ml-auto flex items-center px-4 gap-3 flex-shrink-0">
          <span className="text-[10px] text-gray-300 uppercase tracking-wider hidden xl:block">Exos fixes :</span>
          {FIXED_EXOS.map((e) => (
            <span key={e.label} className="text-[11px] text-gray-300 hidden lg:block">{e.icon} {e.label}</span>
          ))}
        </div>
      </div>

      {/* Bandeau exo actif */}
      <div className={`px-5 py-1.5 border-b flex items-center gap-2 flex-shrink-0 ${colors.banner}`}>
        <span className="text-sm">{activeTabDef.icon}</span>
        <span className="text-sm font-semibold">{activeTabDef.label}</span>
        <span className="text-xs opacity-70">
          {activeTab === "spelling_choice" && "· Saisissez les orthographes erronées que l'élève verra comme distracteurs."}
          {activeTab === "grammar_class"   && "· Cliquez sur un mot pour choisir sa classe grammaticale."}
          {activeTab === "definitions"     && "· Saisissez une définition courte. Validation sur Entrée ou perte de focus."}
          {activeTab === "audio_word"      && "· L'audio personnalisé se configure mot par mot via la modale individuelle."}
          {activeTab === "genre"           && "· Article issu du fichier source. Non modifiable ici."}
        </span>
        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${colors.chip}`}>
          {count(activeTab)} / {n} mots configurés
        </span>
      </div>

      {/* En-tête tableau */}
      <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200">
        <div className="grid px-5 py-1.5" style={{ gridTemplateColumns: "28px 48px 150px 1fr 80px" }}>
          <span className="text-[10px] font-semibold uppercase text-gray-400">#</span>
          <span className="text-[10px] font-semibold uppercase text-gray-400">Type</span>
          <span className="text-[10px] font-semibold uppercase text-gray-400">Mot</span>
          <span className="text-[10px] font-semibold uppercase text-gray-400">
            {activeTab === "spelling_choice" && "Pièges (distracteurs)"}
            {activeTab === "grammar_class"   && "Classe grammaticale"}
            {activeTab === "definitions"     && "Définition"}
            {activeTab === "audio_word"      && "Audio"}
            {activeTab === "genre"           && "Article"}
          </span>
          <span className="text-[10px] font-semibold uppercase text-gray-400 text-center">Statut</span>
        </div>
      </div>

      {/* Corps du tableau */}
      <div className="flex-1 overflow-y-auto">
        {localWords.map((w, idx) => {
          const hasValue =
            activeTab === "spelling_choice" ? w.spelling_errors.length > 0 :
            activeTab === "grammar_class"   ? !!w.grammatical_class :
            activeTab === "definitions"     ? !!w.definition :
            activeTab === "audio_word"      ? !!w.audio_url :
            activeTab === "genre"           ? !!w.article : false;

          const gcAbbr = w.grammatical_class
            ? (GRAMMAR_LABELS[w.grammatical_class as GrammaticalClass] ?? w.grammatical_class).split(" ")[0]
            : (w.article ? (w.article.endsWith("'") ? "n." : "n.") : "");

          return (
            <div
              key={w.position}
              className={`grid items-center px-5 py-1 border-b border-gray-100 transition-colors
                ${idx % 2 === 1 ? "bg-gray-50" : "bg-white"} hover:bg-blue-50`}
              style={{ gridTemplateColumns: "28px 48px 150px 1fr 80px", minHeight: "36px" }}
            >
              <span className="text-[11px] text-gray-400 font-mono">{w.position + 1}</span>
              <span className="text-[10px] text-gray-300 truncate">{gcAbbr}</span>
              <span className="text-sm font-semibold text-gray-800 truncate pr-2">{w.word}</span>
              <div className="min-w-0">{renderCell(w)}</div>
              <div className="flex justify-center">
                {saving[w.position] ? (
                  <Loader2 className="w-3 h-3 animate-spin text-gray-300" />
                ) : hasValue ? (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colors.chip}`}>
                    {activeTab === "spelling_choice" && `${w.spelling_errors.length} piège${w.spelling_errors.length > 1 ? "s" : ""}`}
                    {activeTab === "grammar_class"   && "✓"}
                    {activeTab === "definitions"     && "✓"}
                    {activeTab === "audio_word"      && "✓"}
                    {activeTab === "genre"           && w.article}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
