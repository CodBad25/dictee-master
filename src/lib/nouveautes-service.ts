import { createClient } from "@/lib/supabase/client";
import { NOUVEAUTES } from "@/content/nouveautes";

// Curseur de lecture du journal Nouveautés.
// Enseignant Hub → table dm_nouveautes_vues (suivi par compte, tous appareils).
// Visiteur → localStorage (compte partagé, pas de suivi en base).

const LS_KEY = "dm_nouveautes_derniere_vue";

export async function loadDerniereNouveauteVue(teacherId: string): Promise<string | null> {
  if (teacherId === "visitor") {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LS_KEY);
  }
  const sb = createClient();
  const { data } = await sb
    .from("dm_nouveautes_vues")
    .select("derniere_vue_id")
    .eq("teacher_id", teacherId)
    .maybeSingle();
  return data?.derniere_vue_id ?? null;
}

export async function marquerNouveautesVues(teacherId: string): Promise<string | null> {
  const derniere = NOUVEAUTES[0];
  if (!derniere) return null;
  if (teacherId === "visitor") {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, derniere.id);
    return derniere.id;
  }
  const sb = createClient();
  const { error } = await sb
    .from("dm_nouveautes_vues")
    .upsert(
      { teacher_id: teacherId, derniere_vue_id: derniere.id, updated_at: new Date().toISOString() },
      { onConflict: "teacher_id" },
    );
  if (error) throw new Error(error.message);
  return derniere.id;
}

// Nombre de nouveautés non lues = index de la dernière vue dans la liste
// (triée du plus récent au plus ancien). Jamais vu → tout est non lu.
export function compterNonLues(derniereVueId: string | null): number {
  if (!derniereVueId) return NOUVEAUTES.length;
  const idx = NOUVEAUTES.findIndex((n) => n.id === derniereVueId);
  return idx === -1 ? NOUVEAUTES.length : idx;
}
