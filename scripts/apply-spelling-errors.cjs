/**
 * Applique les décisions de bootstrap-spelling-errors.cjs directement
 * sur la base Supabase via le client JS (clé anon — policies ouvertes
 * en UPDATE/INSERT/DELETE depuis migration-edit-distracteurs.sql).
 *
 * Idempotent : on peut le relancer sans risque, chaque UPDATE écrase.
 * Dictée 13 EXCLUE (déjà enrichie à la main).
 *
 * Usage :
 *   node scripts/apply-spelling-errors.cjs [--dry-run]
 */
const fs = require("fs");
const path = require("path");

// Charge .env.local manuellement (évite la dépendance dotenv).
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("ERR : NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY absent dans .env.local");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// On charge les décisions depuis le bootstrap (export du module).
// Pour éviter de dupliquer 500 lignes, on lit le fichier et on évalue.
const bootstrapFile = fs.readFileSync(
  path.join(__dirname, "bootstrap-spelling-errors.cjs"),
  "utf8",
);
const decisionsMatch = bootstrapFile.match(/const DECISIONS = (\{[\s\S]*?^\};)/m);
if (!decisionsMatch) {
  console.error("ERR : impossible d'extraire DECISIONS depuis bootstrap-spelling-errors.cjs");
  process.exit(1);
}
// eslint-disable-next-line no-eval
const DECISIONS = eval("(" + decisionsMatch[1].replace(/;$/, "") + ")");

const exportPath = path.join(__dirname, "dictee-words-export.json");
const data = JSON.parse(fs.readFileSync(exportPath, "utf8"));

const DRY = process.argv.includes("--dry-run");

(async () => {
  let updated = 0;
  let skipped = 0;
  let empty = 0;
  let errors = 0;

  for (const dictee of data) {
    if (dictee.position === 13) {
      skipped += dictee.words.length;
      continue;
    }
    const decisions = DECISIONS[dictee.position];
    if (!decisions) {
      skipped += dictee.words.length;
      continue;
    }
    process.stdout.write(`D${dictee.position}: `);
    for (const word of dictee.words) {
      const errs = decisions[word.position];
      if (!errs || errs.length === 0) {
        empty++;
        process.stdout.write("·");
        continue;
      }
      if (DRY) {
        updated++;
        process.stdout.write("✓");
        continue;
      }
      const { error } = await sb
        .from("dictee_words")
        .update({ spelling_errors: errs })
        .eq("id", word.id);
      if (error) {
        errors++;
        process.stdout.write("✗");
        console.error(`\n  ERR ${word.word} (${word.id}):`, error.message);
      } else {
        updated++;
        process.stdout.write("✓");
      }
    }
    process.stdout.write("\n");
  }

  console.log();
  console.log(`${DRY ? "[DRY-RUN] " : ""}Stats :`);
  console.log(`  ✓ Mots ${DRY ? "à enrichir" : "enrichis"} : ${updated}`);
  console.log(`  · Mots laissés vides (pas de piège fort) : ${empty}`);
  console.log(`  - Mots sautés (D13 ou hors décisions) : ${skipped}`);
  console.log(`  ✗ Erreurs : ${errors}`);
  if (errors > 0) process.exit(1);
})();
