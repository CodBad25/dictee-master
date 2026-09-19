"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateWordLexicon, type WordLexiconPatch } from "@/lib/dictee-service";

// Éditeur du lexique d'un mot : mots de la même famille + synonymes + validation.
// Utilisé dans la vue tableau (WordConfigSection, layout "row") et dans la
// modale par mot (WordConfigModal, layout "card"). Chaque ajout / suppression
// est sauvegardé immédiatement, comme les pièges.

type ListKey = "word_family" | "synonyms" | "intrus";

interface LexiconEditorProps {
  dicteeId: string;
  position: number;
  word: string;
  family: string[];
  synonyms: string[];
  intrus: string[];
  validated: boolean;
  onChange: (patch: WordLexiconPatch) => void;
  layout?: "row" | "card";
}

const LISTS: { key: ListKey; label: string; chip: string; add: string; placeholder: string }[] = [
  {
    key: "word_family",
    label: "Famille",
    chip: "bg-violet-100 text-violet-800 border border-violet-300",
    add: "border-violet-300 text-violet-500 hover:bg-violet-50",
    placeholder: "mot de la même famille…",
  },
  {
    key: "synonyms",
    label: "Synonymes",
    chip: "bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-300",
    add: "border-fuchsia-300 text-fuchsia-500 hover:bg-fuchsia-50",
    placeholder: "synonyme…",
  },
  {
    key: "intrus",
    label: "Intrus",
    chip: "bg-gray-100 text-gray-700 border border-gray-300",
    add: "border-gray-300 text-gray-500 hover:bg-gray-50",
    placeholder: "intrus (ni famille ni synonyme)…",
  },
];

export default function LexiconEditor({
  dicteeId,
  position,
  word,
  family,
  synonyms,
  intrus,
  validated,
  onChange,
  layout = "row",
}: LexiconEditorProps) {
  const [lists, setLists] = useState<Record<ListKey, string[]>>({ word_family: family, synonyms, intrus });
  const [isValidated, setIsValidated] = useState(validated);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState<ListKey | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Resynchronise si le parent change de mot (modale) ou recharge les données.
  useEffect(() => {
    setLists({ word_family: family, synonyms, intrus });
    setIsValidated(validated);
    setAdding(null);
    setDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, family.join("|"), synonyms.join("|"), intrus.join("|"), validated]);

  const persist = async (patch: WordLexiconPatch, rollback: () => void) => {
    setSaving(true);
    try {
      await updateWordLexicon(dicteeId, position, patch);
      onChange(patch);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : "sauvegarde impossible"));
      rollback();
    } finally {
      setSaving(false);
    }
  };

  const remove = (key: ListKey, value: string) => {
    const prev = lists[key];
    const next = prev.filter((v) => v !== value);
    setLists((l) => ({ ...l, [key]: next }));
    persist({ [key]: next }, () => setLists((l) => ({ ...l, [key]: prev })));
  };

  const confirmAdd = (key: ListKey) => {
    const value = draft.trim().toLowerCase();
    setAdding(null);
    setDraft("");
    if (!value) return;
    const bare = word.replace(/^(un |une |le |la |l'|les )/i, "").toLowerCase();
    if (value === bare) { toast.error("C'est le mot lui-même"); return; }
    const prev = lists[key];
    if (prev.includes(value)) { toast.error("Déjà dans la liste"); return; }
    const next = [...prev, value];
    setLists((l) => ({ ...l, [key]: next }));
    persist({ [key]: next }, () => setLists((l) => ({ ...l, [key]: prev })));
  };

  const toggleValidated = () => {
    const next = !isValidated;
    setIsValidated(next);
    persist({ lexicon_validated: next }, () => setIsValidated(!next));
  };

  const startAdd = (key: ListKey) => {
    setAdding(key);
    setDraft("");
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  const renderList = (def: (typeof LISTS)[number]) => {
    const items = lists[def.key];
    return (
      <div key={def.key} className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-[68px] shrink-0">
          {def.label}
        </span>
        {items.length === 0 && adding !== def.key && (
          <span className="text-[11px] italic text-gray-400">aucun — à compléter</span>
        )}
        {items.map((v) => (
          <span key={v} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${def.chip}`}>
            {v}
            <button
              onClick={() => remove(def.key, v)}
              disabled={saving}
              className="ml-0.5 opacity-60 hover:opacity-100 hover:text-red-500 transition"
              title="Supprimer"
            >×</button>
          </span>
        ))}
        {adding === def.key ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirmAdd(def.key); }
              if (e.key === "Escape") { setAdding(null); setDraft(""); }
            }}
            onBlur={() => confirmAdd(def.key)}
            placeholder={def.placeholder}
            className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-violet-400"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        ) : (
          <button
            onClick={() => startAdd(def.key)}
            disabled={saving}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-dashed transition ${def.add}`}
          >+ ajouter</button>
        )}
      </div>
    );
  };

  const validateButton = (
    <button
      onClick={toggleValidated}
      disabled={saving}
      title={isValidated ? "Cliquer pour remettre « à relire »" : "Marquer ce mot comme relu et validé"}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition disabled:opacity-50 ${
        isValidated
          ? "bg-emerald-600 border-emerald-700 text-white hover:bg-emerald-700"
          : "bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
      }`}
    >
      {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      {isValidated ? "Validé" : "À relire — valider"}
    </button>
  );

  if (layout === "card") {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h4 className="font-bold text-violet-900">🧩 Famille & synonymes</h4>
            <p className="text-xs text-violet-800 mt-0.5">
              Famille et synonymes proposés par l&apos;IA à partir de la définition ; intrus pris dans
              d&apos;autres dictées (ni famille ni synonyme). Relis, corrige, puis valide : seuls les mots
              validés sont proposés aux élèves.
            </p>
          </div>
          {validateButton}
        </div>
        <div className="flex flex-col gap-2 mt-3">{LISTS.map(renderList)}</div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 w-full py-0.5">
      <div className="flex-1 min-w-0 flex flex-col gap-1">{LISTS.map(renderList)}</div>
      <div className="shrink-0 pt-0.5">{validateButton}</div>
    </div>
  );
}
