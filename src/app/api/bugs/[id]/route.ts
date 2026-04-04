import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH — Mettre à jour le statut (admin)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const password = request.headers.get("x-teacher-password");
  if (password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { status, adminNote } = body;
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (adminNote !== undefined) update.admin_note = adminNote;
  if (status === "resolved") update.resolved_at = new Date().toISOString();

  const { error } = await supabase.from("bug_reports").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Erreur de mise à jour" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// DELETE — Supprimer un signalement (admin)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const password = request.headers.get("x-teacher-password");
  if (password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bug_reports").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Erreur de suppression" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
