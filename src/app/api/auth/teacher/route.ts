import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.TEACHER_PASSWORD;

  // Refuser si le mot de passe serveur n'est pas configuré
  if (!expected || expected.length < 4) {
    return NextResponse.json({ valid: false, error: "Configuration manquante" }, { status: 500 });
  }

  if (password === expected) {
    return NextResponse.json({ valid: true });
  }
  return NextResponse.json({ valid: false }, { status: 401 });
}
