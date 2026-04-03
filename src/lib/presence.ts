import { createClient } from "@/lib/supabase/client";

export interface OnlineStudent {
  student_id: string;
  student_name: string;
  current_status: string;
  current_mode: string | null;
  current_dictee: string | null;
}

// Ping de présence avec statut d'activité — appelé toutes les 30s par la page élève
export async function pingPresence(
  studentId: string,
  studentName: string,
  activity?: { dicteeId?: string; mode?: string; status?: "idle" | "working" | "completed" }
): Promise<void> {
  const sb = createClient();
  try {
    const { error } = await sb.from("dm_presence").upsert(
      {
        student_id: studentId,
        student_name: studentName,
        last_seen: new Date().toISOString(),
        current_dictee: activity?.dicteeId || null,
        current_mode: activity?.mode || null,
        current_status: activity?.status || "idle",
      },
      { onConflict: "student_id" }
    );
    if (error) {
      console.error("Erreur ping présence:", error.message);
      return;
    }
    console.log(`Ping OK pour ${studentName}`);
  } catch (e) {
    console.error("Exception ping présence:", e);
  }
}

// Charger les élèves connectés (last_seen < 60s)
export async function loadOnlineStudents(): Promise<Map<string, OnlineStudent>> {
  const sb = createClient();
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  try {
    const { data, error } = await sb
      .from("dm_presence")
      .select("student_id, student_name, current_status, current_mode, current_dictee")
      .gte("last_seen", cutoff);
    if (error) {
      console.error("Erreur chargement présence:", error.message);
      return new Map();
    }
    const map = new Map<string, OnlineStudent>();
    for (const d of data || []) map.set(d.student_id, d);
    return map;
  } catch (e) {
    console.error("Exception chargement présence:", e);
    return new Map();
  }
}
