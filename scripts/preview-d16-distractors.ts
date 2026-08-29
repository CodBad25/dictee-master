/**
 * Pré-visualise les distracteurs auto-générés pour D16 (étage 1 du bootstrap).
 *
 * Lance le nouveau moteur `generateDistractors` sur chaque mot de D16,
 * compare avec les `spelling_errors` actuels en base, et affiche un tableau.
 *
 * Usage :
 *   npx tsx scripts/preview-d16-distractors.ts        # dry-run (affichage seul)
 *   npx tsx scripts/preview-d16-distractors.ts --apply  # écrit en base
 *
 * En mode --apply : on écrase `spelling_errors` UNIQUEMENT si la cellule est
 * vide en base. Les mots déjà enrichis (par Nadia ou par le bootstrap)
 * restent intacts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateDistractors } from "../src/lib/distractor-generator.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APPLY = process.argv.includes("--apply");
const TARGET_POSITION = 16;

async function sb<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: init?.method === "PATCH" ? "return=representation" : "return=representation",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

type Dictee = { id: string; title: string; position: number };
type Word = {
  id: string;
  position: number;
  word: string;
  spelling_errors: string[] | null;
  grammatical_class: string | null;
};

const dictees = await sb<Dictee[]>(
  `dictees?select=id,title,position&position=eq.${TARGET_POSITION}`,
);
if (dictees.length === 0) {
  console.error(`Aucune dictée à la position ${TARGET_POSITION}`);
  process.exit(1);
}
const d16 = dictees[0];
console.log(`\n📖 D${d16.position} — ${d16.title}\n   id : ${d16.id}\n`);

const words = await sb<Word[]>(
  `dictee_words?dictee_id=eq.${d16.id}&select=id,position,word,spelling_errors,grammatical_class&order=position`,
);

const updates: { id: string; word: string; proposed: string[] }[] = [];

console.log("pos │ mot                 │ gc        │ base                              │ proposés (générateur)");
console.log("────┼─────────────────────┼───────────┼───────────────────────────────────┼──────────────────────────");
for (const w of words) {
  const proposed = generateDistractors(w.word, { grammaticalClass: w.grammatical_class });
  const base = (w.spelling_errors ?? []).filter((s) => s && s.trim() !== "");
  const baseStr = base.length > 0 ? base.join(", ") : "—";
  const propStr = proposed.length > 0 ? proposed.join(", ") : "(rien)";
  const flag = base.length === 0 && proposed.length > 0 ? "✏️" : "  ";
  console.log(
    `${String(w.position).padStart(3, " ")} │ ${w.word.padEnd(19, " ").slice(0, 19)} │ ${(w.grammatical_class ?? "—").padEnd(9, " ").slice(0, 9)} │ ${baseStr.padEnd(33, " ").slice(0, 33)} │ ${flag} ${propStr}`,
  );
  if (proposed.length > 0) {
    updates.push({ id: w.id, word: w.word, proposed });
  }
}

console.log(
  `\n${updates.length} mot(s) candidat(s) à l'enrichissement (cellule vide en base).`,
);

if (!APPLY) {
  console.log("\n🟡 Mode dry-run. Relance avec --apply pour écrire en base.\n");
  process.exit(0);
}

console.log("\n🟢 Mode --apply : écriture en base...\n");
let ok = 0;
for (const u of updates) {
  await sb(`dictee_words?id=eq.${u.id}`, {
    method: "PATCH",
    body: JSON.stringify({ spelling_errors: u.proposed }),
  });
  console.log(`  ✓ ${u.word} → [${u.proposed.join(", ")}]`);
  ok++;
}
console.log(`\n${ok}/${updates.length} mots mis à jour.\n`);
