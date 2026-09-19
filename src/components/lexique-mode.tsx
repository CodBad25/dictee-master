"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDmClassIdByHub, loadDicteeWords, type DicteeWord } from "@/lib/dictee-service";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X, Loader2 } from "lucide-react";
import DicteeResults from "@/components/dictee-results";

// Mode élève « Famille & synonymes » (id d'activité : "lexique").
//
// Pour chaque mot de la dictée, l'élève classe des étiquettes dans trois cases :
// Même famille / Synonyme / Intrus. Les étiquettes viennent EXCLUSIVEMENT des
// listes validées par l'enseignant (dictee_words.word_family / synonyms avec
// lexicon_validated = true). Les intrus sont pris dans les listes des AUTRES
// mots de la même dictée (d'abord leurs familles, lexicalement éloignées, puis
// leurs synonymes), en excluant tout ce qui figure dans les listes du mot cible
// et les mots cibles eux-mêmes — les dictées sont thématiques, un mot cible
// est souvent synonyme d'un autre.
//
// Score = étiquettes bien classées. Résultat enregistré dans dm_results avec
// activity_mode "lexique" (score = étiquettes justes, total = étiquettes).

type Bin = "famille" | "synonyme" | "intrus";

const BINS: { id: Bin; label: string; hint: string; color: string; ring: string }[] = [
  { id: "famille",  label: "Même famille", hint: "même radical",         color: "bg-violet-100 border-violet-300 text-violet-900",   ring: "ring-violet-400" },
  { id: "synonyme", label: "Synonyme",     hint: "même sens",            color: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900", ring: "ring-fuchsia-400" },
  { id: "intrus",   label: "Intrus",       hint: "rien à voir",          color: "bg-gray-100 border-gray-300 text-gray-800",         ring: "ring-gray-400" },
];
const BIN_LABEL: Record<Bin, string> = { famille: "Même famille", synonyme: "Synonyme", intrus: "Intrus" };

interface Tag { text: string; bin: Bin }
interface Round { word: DicteeWord; display: string; tags: Tag[] }

const FAMILLE_PAR_MOT = 2;
const SYNONYMES_PAR_MOT = 2;
const INTRUS_PAR_MOT = 2;

const bare = (w: string) =>
  w.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ")
   .replace(/^(le |la |les |l['’]|un |une |des |du )/i, "").trim();

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
const sample = <T,>(arr: T[], n: number) => shuffle(arr).slice(0, n);

const hasLexique = (w: DicteeWord) =>
  w.lexicon_validated && (w.word_family.length > 0 || w.synonyms.length > 0);

// Construit une manche pour `word` à partir de l'ensemble des mots validés.
function buildRound(word: DicteeWord, all: DicteeWord[]): Round {
  const own = new Set([...word.word_family, ...word.synonyms].map((s) => s.toLowerCase()));
  const targets = new Set(all.map((w) => bare(w.word).toLowerCase()));
  const excluded = (s: string) => own.has(s.toLowerCase()) || targets.has(s.toLowerCase());

  const others = all.filter((w) => w !== word);
  const intrusFamille = shuffle(others.flatMap((w) => w.word_family)).filter((s) => !excluded(s));
  const intrusSyn = shuffle(others.flatMap((w) => w.synonyms)).filter((s) => !excluded(s));
  const intrus: string[] = [];
  for (const s of [...intrusFamille, ...intrusSyn]) {
    if (intrus.length >= INTRUS_PAR_MOT) break;
    if (!intrus.includes(s)) intrus.push(s);
  }

  const tags: Tag[] = [
    ...sample(word.word_family, FAMILLE_PAR_MOT).map((text) => ({ text, bin: "famille" as Bin })),
    ...sample(word.synonyms, SYNONYMES_PAR_MOT).map((text) => ({ text, bin: "synonyme" as Bin })),
    ...intrus.map((text) => ({ text, bin: "intrus" as Bin })),
  ];
  return { word, display: bare(word.word), tags: shuffle(tags) };
}

export default function LexiqueMode() {
  const { currentList, clearCurrentTraining, connectedEleve } = useAppStore();
  const [pool, setPool] = useState<DicteeWord[] | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Record<string, Bin>>({});   // tag → case choisie
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [answers, setAnswers] = useState<{ word: string; userAnswer: string; correctAnswer: string; isCorrect: boolean }[]>([]);
  const [phase, setPhase] = useState<"playing" | "done">("playing");

  // Chargement : mots validés (et sélectionnés par le prof) de la dictée.
  useEffect(() => {
    if (!currentList) return;
    const selectedPositions = useAppStore.getState().selectedWordPositions;
    loadDicteeWords(currentList.id).then((words) => {
      let filtered = words.filter(hasLexique);
      if (selectedPositions) filtered = filtered.filter((w) => selectedPositions.includes(w.position));
      setPool(filtered);
      setRounds(shuffle(filtered).map((w) => buildRound(w, filtered)));
    });
  }, [currentList]);

  const startWith = useCallback((words: DicteeWord[]) => {
    if (!pool) return;
    setRounds(shuffle(words).map((w) => buildRound(w, pool)));
    setIndex(0); setPlaced({}); setSelectedTag(null); setChecked(false);
    setScore(0); setTotal(0); setAnswers([]); setPhase("playing");
  }, [pool]);

  const round = rounds[index];
  const allPlaced = !!round && round.tags.every((t) => placed[t.text] !== undefined);

  const assign = (bin: Bin) => {
    if (checked || !selectedTag) return;
    setPlaced((p) => ({ ...p, [selectedTag]: bin }));
    setSelectedTag(null);
  };
  const unassign = (text: string) => {
    if (checked) return;
    setPlaced((p) => { const n = { ...p }; delete n[text]; return n; });
    setSelectedTag(text);
  };

  const validate = () => {
    if (!round || !allPlaced) return;
    let ok = 0;
    const newAnswers = round.tags.map((t) => {
      const chosen = placed[t.text];
      const isCorrect = chosen === t.bin;
      if (isCorrect) ok++;
      return { word: `${round.display} → ${t.text}`, userAnswer: BIN_LABEL[chosen], correctAnswer: BIN_LABEL[t.bin], isCorrect };
    });
    setScore((s) => s + ok);
    setTotal((t) => t + round.tags.length);
    setAnswers((a) => [...a, ...newAnswers]);
    setChecked(true);
  };

  const next = () => {
    if (index < rounds.length - 1) {
      setIndex((i) => i + 1); setPlaced({}); setSelectedTag(null); setChecked(false);
      return;
    }
    setPhase("done");
    if (connectedEleve && currentList && total > 0) {
      const pct = Math.round((score / total) * 100);
      const sb = createClient();
      getDmClassIdByHub(connectedEleve.classeId).then((classId) => {
        if (!classId) return;
        sb.from("dm_results").insert({
          class_id: classId,
          student_id: connectedEleve.eleveId,
          student_name: `${connectedEleve.prenom} ${connectedEleve.nom}`,
          dictee_id: currentList.id,
          activity_mode: "lexique",
          score, total, percentage: pct, time_spent: 0,
        }).then(({ error }) => {
          if (error) console.error("Erreur sauvegarde lexique:", error.message);
        });
      });
    }
  };

  if (!currentList) return null;

  if (pool === null) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </main>
    );
  }

  if (pool.length === 0) {
    return (
      <main className="min-h-dvh bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <span className="text-5xl">🧩</span>
        <h2 className="text-lg font-bold text-gray-700">Pas encore disponible pour cette dictée</h2>
        <p className="text-sm text-gray-500 max-w-md">
          Les mots de la même famille et les synonymes de cette dictée n&apos;ont pas encore été validés par ton professeur.
        </p>
        <Button variant="outline" onClick={() => clearCurrentTraining()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <DicteeResults
        title={currentList.title + " — Famille & synonymes"}
        answers={answers}
        timeSpent={0}
        onRetryErrors={() => {
          const wrongDisplays = new Set(answers.filter((a) => !a.isCorrect).map((a) => a.word.split(" → ")[0]));
          const words = pool.filter((w) => wrongDisplays.has(bare(w.word)));
          if (words.length) startWith(words);
        }}
        onRetryAll={() => startWith(pool)}
        onNext={() => clearCurrentTraining()}
      />
    );
  }

  if (!round) return null;
  const progress = ((index + 1) / rounds.length) * 100;
  const remaining = round.tags.filter((t) => placed[t.text] === undefined);

  const tagClass = (t: Tag) => {
    if (checked) {
      return placed[t.text] === t.bin
        ? "bg-emerald-50 border-emerald-500 text-emerald-900"
        : "bg-red-50 border-red-400 text-red-900 line-through decoration-red-400";
    }
    return selectedTag === t.text
      ? "bg-violet-600 border-violet-700 text-white shadow-md scale-105"
      : "bg-white border-gray-300 text-gray-800 hover:border-violet-400 hover:bg-violet-50";
  };

  return (
    <main className="min-h-dvh bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => clearCurrentTraining()}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Quitter
        </Button>
        <span className="text-sm font-bold text-violet-700">{currentList.title} — Famille & synonymes</span>
        <span className="text-sm text-gray-500">{index + 1}/{rounds.length}</span>
      </header>
      <div className="h-1.5 bg-gray-100">
        <div className="h-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center p-4 sm:p-6 gap-5 w-full max-w-3xl mx-auto">
        <div className="text-center">
          <p className="text-sm text-gray-500">Classe chaque étiquette par rapport au mot :</p>
          <div className="text-4xl font-black text-gray-800 mt-1">{round.display}</div>
          {round.word.definition && (
            <p className="text-sm italic text-gray-500 mt-1">{round.word.definition}</p>
          )}
        </div>

        {/* Étiquettes restantes */}
        <div className="w-full min-h-[56px] flex flex-wrap justify-center gap-2">
          {remaining.length === 0 && !checked && (
            <span className="text-sm text-gray-400 italic self-center">Toutes les étiquettes sont placées : valide !</span>
          )}
          {remaining.map((t) => (
            <button
              key={t.text}
              onClick={() => setSelectedTag(selectedTag === t.text ? null : t.text)}
              className={`px-4 py-2 rounded-xl border-2 text-base font-semibold transition-all ${tagClass(t)}`}
            >
              {t.text}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 -mt-3">
          {selectedTag ? "Maintenant, clique sur une case." : "Clique sur une étiquette, puis sur une case."}
        </p>

        {/* Trois cases */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          {BINS.map((b) => {
            const inBin = round.tags.filter((t) => placed[t.text] === b.id);
            const clickable = !!selectedTag && !checked;
            return (
              <button
                key={b.id}
                onClick={() => assign(b.id)}
                disabled={!clickable}
                className={`rounded-2xl border-2 p-3 min-h-[120px] text-left transition-all flex flex-col ${b.color}
                  ${clickable ? `cursor-pointer ring-2 ring-offset-1 ${b.ring} hover:brightness-95` : "cursor-default"}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-bold">{b.label}</span>
                  <span className="text-[11px] opacity-70">{b.hint}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {inBin.map((t) => (
                    <span
                      key={t.text}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); unassign(t.text); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); unassign(t.text); } }}
                      title={checked ? undefined : "Retirer de la case"}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-sm font-medium bg-white ${tagClass(t)}`}
                    >
                      {checked && (placed[t.text] === t.bin
                        ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                        : <X className="w-3.5 h-3.5 text-red-500" />)}
                      {t.text}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Correction après validation */}
        {checked && round.tags.some((t) => placed[t.text] !== t.bin) && (
          <div className="w-full bg-white border border-amber-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-amber-800 mb-1">À retenir :</p>
            <ul className="space-y-0.5">
              {round.tags.filter((t) => placed[t.text] !== t.bin).map((t) => (
                <li key={t.text} className="text-gray-700">
                  <strong>{t.text}</strong> → {BIN_LABEL[t.bin]}
                  {t.bin === "famille" && " (même radical que " + round.display + ")"}
                  {t.bin === "synonyme" && " (même sens que " + round.display + ")"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-4 mt-auto">
          <span className="text-sm text-gray-400">Score : {score}/{total}</span>
          {checked ? (
            <Button onClick={next} className="bg-violet-600 hover:bg-violet-700">
              {index < rounds.length - 1 ? "Mot suivant →" : "Voir mes résultats"}
            </Button>
          ) : (
            <Button onClick={validate} disabled={!allPlaced} className="bg-violet-600 hover:bg-violet-700">
              <Check className="w-4 h-4 mr-1" /> Valider
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
