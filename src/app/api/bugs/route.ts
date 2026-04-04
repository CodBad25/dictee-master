import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — Créer un signalement
export async function POST(request: Request) {
  const body = await request.json();
  const { description, screenshot, pageUrl, userAgent, reporterName, reporterType } = body;

  if (!description || description.length < 1) {
    return NextResponse.json({ error: "Description requise" }, { status: 400 });
  }

  const id = `bug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const supabase = await createClient();

  const { error } = await supabase.from("bug_reports").insert({
    id,
    description: description.slice(0, 2000),
    screenshot: screenshot?.slice(0, 2_000_000) || null,
    page_url: pageUrl?.slice(0, 500) || null,
    user_agent: userAgent?.slice(0, 500) || null,
    reporter_name: reporterName?.slice(0, 100) || null,
    reporter_type: reporterType === "teacher" ? "teacher" : "student",
    status: "new",
  });

  if (error) {
    console.error("Bug report insert error:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id });
}

// GET — Lister les signalements
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reporterName = searchParams.get("reporterName");
  const admin = searchParams.get("admin");
  const supabase = await createClient();

  if (admin === "true") {
    // Vérifier le mot de passe enseignant ou admin
    const password = request.headers.get("x-teacher-password") || request.headers.get("x-admin-password");
    if (password !== process.env.TEACHER_PASSWORD && password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: "Erreur de lecture" }, { status: 500 });
    }
    return NextResponse.json(data || []);
  }

  // Signalements d'un élève (sans screenshot pour alléger)
  if (!reporterName) {
    return NextResponse.json({ error: "reporterName requis" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("bug_reports")
    .select("id, description, status, admin_note, created_at, resolved_at")
    .eq("reporter_name", reporterName)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Erreur de lecture" }, { status: 500 });
  }
  return NextResponse.json(data || []);
}
