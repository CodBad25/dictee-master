/**
 * Snapshot des spelling_errors actuels avant bootstrap.
 * Permet un rollback complet si nécessaire.
 *
 * Usage :
 *   node scripts/snapshot-spelling-errors.cjs > backups/spelling-errors-snapshot-<date>.json
 */
const fs = require("fs");
const path = require("path");

const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

(async () => {
  const { data, error } = await sb
    .from("dictee_words")
    .select("id, dictee_id, position, word, spelling_errors")
    .order("dictee_id")
    .order("position");
  if (error) {
    console.error("ERR:", error.message);
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(data, null, 2));
})();
