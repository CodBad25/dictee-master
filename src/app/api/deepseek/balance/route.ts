import { NextResponse } from "next/server";
import { getDeepSeekBalance } from "@/lib/deepseek-service";

/**
 * GET /api/deepseek/balance
 * Headers :
 *   - x-teacher-password (requis)
 *   - x-deepseek-key (optionnel — BYOK ; sinon utilise DEEPSEEK_API_KEY env)
 *
 * Renvoie le solde DeepSeek du compte associé à la clé.
 */
export async function GET(request: Request) {
  const password = request.headers.get("x-teacher-password");
  if (!process.env.TEACHER_PASSWORD || password !== process.env.TEACHER_PASSWORD) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const personalKey = request.headers.get("x-deepseek-key") || "";
  const apiKey = personalKey.trim() || process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Aucune clé DeepSeek configurée" },
      { status: 500 },
    );
  }

  try {
    const balance = await getDeepSeekBalance(apiKey);
    return NextResponse.json({
      balanceUsd: balance.balanceUsd,
      currency: balance.currency,
      usingPersonalKey: !!personalKey.trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deepseek/balance] échec :", msg);
    return NextResponse.json(
      { error: "Impossible de récupérer le solde DeepSeek", details: msg },
      { status: 502 },
    );
  }
}
