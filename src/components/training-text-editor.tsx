"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Eye, EyeOff, Loader2, Save, Undo2 } from "lucide-react";
import {
  checkTrainingText,
  loadTrainingText,
  parseTrainingText,
  saveTrainingText,
  type TrainingText,
} from "@/lib/dictee-service";

// Éditeur enseignant du texte d'ENTRAÎNEMENT d'une dictée (retour de Nadia,
// 20/09/2026).
//
// Deux reproches à traiter :
//   1. les modes « dictée audio » et « texte à trous » servaient le texte du
//      jour J, que l'élève apprenait par cœur avant l'évaluation ;
//   2. les trous portaient sur l'orthographe du mot seul, ce qui faisait double
//      emploi avec « audio mot ». Ils doivent porter sur des ACCORDS.
//
// Convention : dans le texte, un mot entouré de « » devient un trou. Le
// contexte qui porte l'indice d'accord (déterminant, sujet) doit rester en
// dehors des guillemets, sinon l'accord est indevinable.

interface Props {
  dicteeId: string;
  words: string[]; // mots de la dictée, pour vérifier le réemploi
}

const MAX_WORDS = 25;
const MAX_SENTENCES = 3;

export default function TrainingTextEditor({ dicteeId, words }: Props) {
  const [marked, setMarked] = useState("");
  const [rules, setRules] = useState<Record<string, string>>({});
  const [validated, setValidated] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showStudentView, setShowStudentView] = useState(true);
  const initial = useRef<TrainingText | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTrainingText(dicteeId).then((t) => {
      if (cancelled) return;
      initial.current = t;
      setMarked(t?.marked ?? "");
      setRules(t?.rules ?? {});
      setValidated(t?.validated ?? true);
      setAudioUrl(t?.audio_url ?? null);
      setDirty(false);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dicteeId]);

  const current: TrainingText = { marked, rules, validated, audio_url: audioUrl };
  const parsed = marked ? parseTrainingText(current) : null;
  const problems = marked ? checkTrainingText(current) : [];

  const wordCount = parsed
    ? parsed.fullText.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length
    : 0;
  const sentenceCount = parsed
    ? parsed.fullText.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0).length
    : 0;

  // Mots de la dictée effectivement réemployés dans le texte (forme accordée
  // comprise : on compare sur le radical, article retiré).
  const reused = words.filter((w) => {
    const bare = w.replace(/^(le |la |les |l['’]|un |une |des |du )/i, "").trim();
    const stem = bare.length > 4 ? bare.slice(0, Math.max(4, bare.length - 2)) : bare;
    return parsed ? parsed.fullText.toLowerCase().includes(stem.toLowerCase()) : false;
  });

  // Entoure la sélection de guillemets pour en faire un trou (ou les retire).
  const toggleBlankOnSelection = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    if (a === b) {
      toast.info("Sélectionne d'abord le mot à trouer dans le texte.");
      return;
    }
    const sel = marked.slice(a, b);
    const next = sel.startsWith("«") && sel.endsWith("»")
      ? marked.slice(0, a) + sel.slice(1, -1) + marked.slice(b)
      : marked.slice(0, a) + "«" + sel + "»" + marked.slice(b);
    setMarked(next);
    setDirty(true);
  }, [marked]);

  const save = async () => {
    setSaving(true);
    try {
      await saveTrainingText(dicteeId, current);
      initial.current = current;
      setDirty(false);
      toast.success("Texte d'entraînement enregistré");
    } catch (e) {
      toast.error(`Échec de l'enregistrement : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    const t = initial.current;
    setMarked(t?.marked ?? "");
    setRules(t?.rules ?? {});
    setValidated(t?.validated ?? true);
    setDirty(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-900">
        <p>
          Ce texte <strong>remplace celui de la dictée</strong> dans « Dictée audio » et
          « Texte à trous », pour que les élèves ne s&apos;entraînent pas sur le texte de
          l&apos;évaluation.
        </p>
        <p className="mt-1">
          Les mots entre <strong>«guillemets»</strong> deviennent des trous. Choisis-les pour
          tester un <strong>accord</strong> (pluriel du nom ou de l&apos;adjectif, féminin de
          l&apos;adjectif, verbe) et laisse visible le mot qui donne l&apos;indice.
        </p>
      </div>

      {/* Contrôles des consignes */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
          wordCount > MAX_WORDS
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-emerald-50 border-emerald-300 text-emerald-700"
        }`}>
          {wordCount} mot{wordCount > 1 ? "s" : ""} / {MAX_WORDS} max
        </span>
        <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
          sentenceCount > MAX_SENTENCES
            ? "bg-red-50 border-red-300 text-red-700"
            : "bg-emerald-50 border-emerald-300 text-emerald-700"
        }`}>
          {sentenceCount} phrase{sentenceCount > 1 ? "s" : ""} / {MAX_SENTENCES} max
        </span>
        <span className="px-2.5 py-1 rounded-lg border bg-gray-50 border-gray-300 text-gray-700 font-semibold">
          {parsed?.blanks.length ?? 0} trou{(parsed?.blanks.length ?? 0) > 1 ? "s" : ""}
        </span>
        <span className={`px-2.5 py-1 rounded-lg border font-semibold ${
          reused.length === words.length
            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
            : "bg-amber-50 border-amber-300 text-amber-800"
        }`}>
          {reused.length} / {words.length} mots de la dictée réemployés
        </span>
      </div>

      {/* Saisie */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase text-gray-500">
            Texte d&apos;entraînement
          </label>
          <Button size="sm" variant="outline" onClick={toggleBlankOnSelection} className="h-7 text-xs">
            «&nbsp;»&nbsp; Trouer la sélection
          </Button>
        </div>
        <textarea
          ref={textareaRef}
          value={marked}
          onChange={(e) => { setMarked(e.target.value); setDirty(true); }}
          rows={4}
          placeholder="Les deux sœurs sont «curieuses». Elles observent la vitrine…"
          className="w-full rounded-xl border-2 border-gray-200 focus:border-orange-400 outline-none p-3 text-base leading-relaxed"
        />
        {problems.length > 0 && (
          <ul className="mt-2 text-xs text-red-700 list-disc list-inside space-y-0.5">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>

      {/* Règle d'accord par trou */}
      {parsed && parsed.blanks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500 mb-1.5">
            Ce que teste chaque trou <span className="normal-case font-normal">(affiché à l&apos;élève quand il se trompe)</span>
          </p>
          <div className="space-y-1.5">
            {parsed.blanks.map((b) => (
              <div key={b.answer} className="flex items-center gap-2">
                <span className="px-2 py-1 rounded-lg bg-orange-100 border border-orange-300 text-orange-900 text-sm font-bold min-w-[110px] text-center">
                  {b.answer}
                </span>
                <input
                  value={rules[b.answer] ?? ""}
                  onChange={(e) => {
                    setRules((r) => ({ ...r, [b.answer]: e.target.value }));
                    setDirty(true);
                  }}
                  placeholder="ex : pluriel du nom (« des »)"
                  className="flex-1 h-9 px-3 rounded-lg border border-gray-200 focus:border-orange-400 outline-none text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aperçu élève */}
      {parsed && (
        <div>
          <button
            onClick={() => setShowStudentView((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold uppercase text-gray-500 mb-1.5"
          >
            {showStudentView ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            Aperçu élève
          </button>
          {showStudentView && (
            <div className="bg-white border-2 border-purple-100 rounded-xl p-4 text-base leading-relaxed text-gray-700">
              {parsed.displayText}
            </div>
          )}
        </div>
      )}

      {/* Validation + enregistrement */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
        <button
          onClick={() => { setValidated((v) => !v); setDirty(true); }}
          className={`px-3 py-2 rounded-xl border-2 text-sm font-bold transition-colors ${
            validated
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "bg-gray-50 border-gray-300 text-gray-600"
          }`}
        >
          {validated ? "✓ Visible des élèves" : "◦ Masqué aux élèves"}
        </button>
        <span className="text-xs text-gray-500">
          {validated
            ? "Les élèves s'entraînent sur ce texte."
            : "Les élèves retrouvent le texte de la dictée tant que celui-ci est masqué."}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <Button size="sm" variant="ghost" onClick={reset} className="gap-1.5 text-gray-500">
              <Undo2 className="w-4 h-4" /> Annuler
            </Button>
          )}
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !dirty || !marked.trim()}
            className="gap-1.5 bg-orange-500 hover:bg-orange-600"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {audioUrl && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Check className="w-3 h-3" /> Audio enregistré pour ce texte.
        </p>
      )}
    </div>
  );
}
