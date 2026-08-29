#!/usr/bin/env node
// Génère supabase/seed-dictees-5e.sql depuis scripts/dictees-5e-data.mjs.
// Le SQL est idempotent (DELETE des dictee-5e-% puis INSERT) et s'exécute
// dans le SQL Editor de Supabase (contourne la RLS SELECT-only de `dictees`).
// Prérequis : migration-level.sql appliquée.
//
// Usage : node scripts/generate-seed-5e.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { DICTEES_5E_DATA } from "./dictees-5e-data.mjs";

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (arr) => `${q(JSON.stringify(arr))}::jsonb`;
// fill_blanks_text attendu par le moteur = texte BRUT (les {{marqueurs}} du
// prototype dictee-v2 sont retirés ; le moteur retrouve les mots lui-même)
const plain = (s) => s.replace(/\{\{(.*?)\}\}/g, "$1");

const lines = [
  "-- Seed des 16 dictées 5e (progression de la collègue de français, août 2026).",
  "-- Généré par scripts/generate-seed-5e.mjs — NE PAS ÉDITER À LA MAIN.",
  "-- Idempotent : rejouable sans risque (DELETE puis INSERT des dictee-5e-%).",
  "-- Prérequis : supabase/migration-level.sql appliquée.",
  "",
  "BEGIN;",
  "",
  "DELETE FROM dictee_words WHERE dictee_id LIKE 'dictee-5e-%';",
  "DELETE FROM dictees WHERE id LIKE 'dictee-5e-%';",
  "",
];

for (const [i, d] of DICTEES_5E_DATA.entries()) {
  const position = i + 1;
  const id = `dictee-5e-${position}`;
  const texte = plain(d.dictationText);
  lines.push(
    `-- ${d.title} — ${d.lexicalTheme} (⭐ ${d.starWord})`,
    "INSERT INTO dictees (id, title, position, share_code, dictation_text, fill_blanks_text, level, ortho_point, lexical_theme, star_word) VALUES",
    `  (${q(id)}, ${q(d.title)}, ${position}, ${q(d.shareCode)}, ${q(texte)}, ${q(plain(d.fillBlanksText))}, '5e', ${q(d.orthoPoint)}, ${q(d.lexicalTheme)}, ${q(d.starWord)});`,
    "",
    "INSERT INTO dictee_words (dictee_id, word, definition, spelling_errors, position) VALUES"
  );
  const rows = d.words.map(
    (w) => `  (${q(id)}, ${q(w.word)}, ${q(w.definition)}, ${jsonb(w.spellingErrors)}, ${w.position})`
  );
  lines.push(rows.join(",\n") + ";", "");
}

lines.push("COMMIT;", "");
lines.push("-- Vérification :");
lines.push("-- SELECT level, COUNT(*) FROM dictees GROUP BY level;   -- attendu : 6e=26+, 5e=16");
lines.push("-- SELECT COUNT(*) FROM dictee_words WHERE dictee_id LIKE 'dictee-5e-%';  -- attendu : 160");
lines.push("");

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "seed-dictees-5e.sql");
writeFileSync(out, lines.join("\n"), "utf-8");
console.log(`OK → ${out} (${DICTEES_5E_DATA.length} dictées, ${DICTEES_5E_DATA.reduce((s, d) => s + d.words.length, 0)} mots)`);
