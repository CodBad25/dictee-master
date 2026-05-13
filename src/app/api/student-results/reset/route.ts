import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/student-results/reset
 * Headers : x-teacher-password
 * Body :
 *   - studentId: string       (requis)
 *   - dicteeId?: string       (optionnel — si fourni : reset uniquement cette dictée)
 *   - activityMode?: string   (optionnel — si fourni avec dicteeId : reset uniquement ce mode)
 *
 * Supprime les entrées correspondantes dans dm_results.
 * dm_word_attempts est nettoyé automatiquement via ON DELETE CASCADE
 * (voir supabase/migration-v2.sql).
 *
 * ⚠️ Ne touche pas à dm_unlock_requests : le verrouillage reste inchangé.
 */
export async function POST(request: Request) {
  // --- Auth ---
  const password = request.headers.get("x-teacher-password");
  if (!process.env.TEACHER_PASSWORD || password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // --- Body ---
  let studentId: string | undefined;
  let dicteeId: string | undefined;
  let activityMode: string | undefined;
  try {
    const body = await request.json();
    studentId = typeof body?.studentId === "string" ? body.studentId : undefined;
    dicteeId = typeof body?.dicteeId === "string" ? body.dicteeId : undefined;
    activityMode = typeof body?.activityMode === "string" ? body.activityMode : undefined;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  if (!studentId) {
    return NextResponse.json({ error: "studentId requis" }, { status: 400 });
  }

  // activityMode ne fait sens qu'avec un dicteeId — sinon on refuse pour éviter
  // une suppression trop large par accident.
  if (activityMode && !dicteeId) {
    return NextResponse.json(
      { error: "activityMode nécessite un dicteeId" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Construire la requête DELETE en retournant les lignes supprimées pour compter.
  let query = supabase
    .from("dm_results")
    .delete()
    .eq("student_id", studentId);

  if (dicteeId) {
    query = query.eq("dictee_id", dicteeId);
  }
  if (activityMode) {
    query = query.eq("activity_mode", activityMode);
  }

  const { data, error } = await query.select("id");

  if (error) {
    console.error("[student-results/reset] Supabase:", error.message);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 },
    );
  }

  const deletedCount = data?.length ?? 0;
  console.log(
    `[student-results/reset] student=${studentId} dictee=${dicteeId ?? "*"} mode=${activityMode ?? "*"} → ${deletedCount} session(s) supprimée(s)`,
  );

  return NextResponse.json({ success: true, deletedCount });
}
