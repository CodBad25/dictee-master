// Charge le lexique 5e (famille + synonymes) dans dictee_words.
//
// Prérequis : supabase/migration-lexique.sql appliquée.
// Idempotent : chaque UPDATE écrase word_family / synonyms.
// Ne touche JAMAIS à lexicon_validated (sauf --reset-validation) : une
// relance ne doit pas annuler les validations de la collègue. Par sécurité,
// les mots déjà validés sont IGNORÉS (leurs listes sont désormais les siennes),
// sauf avec --force.
//
// Usage : node scripts/apply-lexique-5e.mjs [--dry-run] [--force] [--reset-validation]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { LEXIQUE_5E_ENTRIES } from "./lexique-5e-data.mjs";
import { INTRUS_5E } from "./intrus-5e-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error("ERR : variables Supabase absentes de .env.local"); process.exit(1); }

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const resetValidation = args.has("--reset-validation");
const sb = createClient(URL, KEY);

// Vérification préalable : les colonnes existent et les mots correspondent.
const { data: rows, error } = await sb
  .from("dictee_words")
  .select("dictee_id, position, word, lexicon_validated")
  .like("dictee_id", "dictee-5e-%");
if (error) { console.error("ERR lecture :", error.message, "— migration-lexique.sql appliquée ?"); process.exit(1); }
const byKey = new Map(rows.map((r) => [`${r.dictee_id}#${r.position}`, r]));

let updated = 0, skipped = 0, mismatch = 0;
for (const e of LEXIQUE_5E_ENTRIES) {
  const row = byKey.get(`${e.dicteeId}#${e.position}`);
  if (!row || row.word !== e.word) {
    console.error(`MISMATCH ${e.dicteeId} p${e.position} : fichier « ${e.word} » vs base « ${row?.word ?? "(absent)"} »`);
    mismatch++;
    continue;
  }
  if (row.lexicon_validated && !force) { skipped++; continue; }
  const intrus = INTRUS_5E[e.dicteeId]?.find((x) => x.position === e.position)?.intrus ?? [];
  const patch = { word_family: e.famille, synonyms: e.synonymes, intrus };
  if (resetValidation) patch.lexicon_validated = false;
  if (!dryRun) {
    const { error: upErr } = await sb
      .from("dictee_words").update(patch)
      .eq("dictee_id", e.dicteeId).eq("position", e.position);
    if (upErr) { console.error(`ERR ${e.dicteeId} p${e.position} :`, upErr.message); process.exit(1); }
  }
  updated++;
}
console.log(`${dryRun ? "[dry-run] " : ""}${updated} mots mis à jour, ${skipped} déjà validés ignorés, ${mismatch} incohérences.`);
if (mismatch) process.exit(2);
