// Génère 4 intrus par mot pour l'exercice « Famille & synonymes », à partir des
// mots de famille des AUTRES dictées (champs lexicaux disjoints). Tirage
// pseudo-aléatoire à graine fixe → relançable, résultat stable.
// Exclusions : tout élément (mot cible, famille, synonymes) de la dictée du mot,
// et tout candidat partageant un radical (5 premières lettres, sans accents)
// avec un élément de cette dictée.
// Sortie : scripts/intrus-5e-data.mjs (relu par un agent, puis chargé en base).
import fs from "node:fs";
import { LEXIQUE_5E } from "./lexique-5e-data.mjs";

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const bare = (w) => w.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ")
  .replace(/^(le |la |les |l'|un |une |des |du )/i, "").trim();
const stem = (s) => strip(bare(s)).replace(/^(se |s')/, "").slice(0, 5);

let seed = 20260919;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const shuffle = (a) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

// Mots trop génériques ou trop courts pour faire de bons intrus.
const TROP_GENERIQUES = new Set(["autre", "fois", "bien", "mal", "tour", "las", "son", "tape", "sûr", "avis", "terme", "venir", "prendre", "voir", "clair", "fort", "doux"]);

const dictees = Object.entries(LEXIQUE_5E);
const out = {};
for (const [dId, words] of dictees) {
  const dicteeItems = words.flatMap((w) => [bare(w.word), ...w.famille, ...w.synonymes]);
  const dicteeSet = new Set(dicteeItems.map(strip));
  const dicteeStems = new Set(dicteeItems.map(stem));
  const candidates = dictees
    .filter(([id]) => id !== dId)
    .flatMap(([, ws]) => ws.flatMap((w) => w.famille))
    .filter((c) => !dicteeSet.has(strip(c)) && !dicteeStems.has(stem(c)) && !c.includes(" ") && c.length >= 4 && !TROP_GENERIQUES.has(c));
  out[dId] = words.map((w) => {
    const picked = [];
    for (const c of shuffle(candidates)) {
      if (picked.length >= 4) break;
      if (!picked.some((p) => stem(p) === stem(c))) picked.push(c);
    }
    return { position: w.position, word: w.word, intrus: picked };
  });
}
const header = `// Intrus de l'exercice « Famille & synonymes » — GÉNÉRÉ par generate-intrus-5e.mjs
// (graine fixe). Mots de famille d'AUTRES dictées, champ lexical disjoint.
// Relus par agent le 20/09/2026 ; la collègue peut les modifier dans l'onglet 🧩.
export const INTRUS_5E = `;
fs.writeFileSync("scripts/intrus-5e-data.mjs", header + JSON.stringify(out, null, 1) + ";\n");
const lines = [];
for (const [dId, ws] of Object.entries(out)) for (const w of ws) {
  const src = LEXIQUE_5E[dId].find((x) => x.position === w.position);
  lines.push(`D${dId.split("-").pop()} | ${w.word} | famille: ${src.famille.join(", ") || "—"} | synonymes: ${src.synonymes.join(", ")} | INTRUS: ${w.intrus.join(", ")}`);
}
fs.writeFileSync(process.env.INTRUS_REVIEW_OUT || "/dev/null", lines.join("\n"));
console.log("mots:", lines.length, "| intrus <4:", lines.filter((l) => l.split("INTRUS: ")[1].split(", ").length < 4).length);
