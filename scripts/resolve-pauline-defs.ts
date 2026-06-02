import { createClient } from "@supabase/supabase-js";

const NOTE = [
  "Bonjour Pauline, c’est corrigé ! L’exercice « Mot ↔ Définition » affiche maintenant",
  "bien les mots et leurs définitions. Tu peux réessayer. Merci de l’avoir signalé",
  "(deux fois 😊). — M. Belhaj",
].join(" ");

const IDS = ["bug-1780127405694-rgygsb", "bug-1779290415150-v7kl6n"];

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  for (const id of IDS) {
    const { error } = await sb
      .from("bug_reports")
      .update({ status: "resolved", admin_note: NOTE, resolved_at: new Date().toISOString() })
      .eq("id", id);
    console.log(id, error ? "KO " + error.message : "résolu ✓");
  }
}

main().catch((e) => console.error(e));
