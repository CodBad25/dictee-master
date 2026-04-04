import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected || expected.length < 4) {
    return NextResponse.json({ valid: false, error: "Configuration manquante" }, { status: 500 });
  }

  if (password === expected) {
    return NextResponse.json({ valid: true });
  }
  return NextResponse.json({ valid: false }, { status: 401 });
}
