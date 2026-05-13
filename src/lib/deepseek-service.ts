// Service serveur pour appeler l'API DeepSeek (DeepSeek-V3 / deepseek-chat).
// Utilisé pour l'analyse pédagogique des erreurs d'élèves.
// Tarifs officiels DeepSeek-V3 (standard, sans cache hit) au 2026 :
//   - input  : $0.27 / 1M tokens
//   - output : $1.10 / 1M tokens

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
const DEEPSEEK_MODEL = "deepseek-chat";

const INPUT_COST_PER_TOKEN = 0.27 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.10 / 1_000_000;

export interface DeepSeekResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  model: string;
}

export interface DeepSeekBalance {
  balanceUsd: number;
  currency: string;
}

/**
 * Appelle DeepSeek en mode JSON object.
 * Retourne le contenu brut (string JSON), les tokens consommés et le coût calculé.
 */
export async function callDeepSeek(
  prompt: string,
  apiKey: string,
  systemPrompt?: string,
): Promise<DeepSeekResult> {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    response_format: { type: "json_object" },
  };

  const t0 = Date.now();
  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[DeepSeek] ${res.status} :`, errText);
    throw new Error(`DeepSeek ${res.status} : ${errText}`);
  }

  const json = await res.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  const promptTokens: number = json.usage?.prompt_tokens ?? 0;
  const completionTokens: number = json.usage?.completion_tokens ?? 0;
  const costUsd =
    promptTokens * INPUT_COST_PER_TOKEN + completionTokens * OUTPUT_COST_PER_TOKEN;

  console.log(
    `[DeepSeek] ${((Date.now() - t0) / 1000).toFixed(1)}s · ${promptTokens}+${completionTokens} tokens · $${costUsd.toFixed(6)}`,
  );

  // Nettoyer un éventuel wrapper markdown (rare avec response_format=json_object).
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  return {
    content: cleaned,
    promptTokens,
    completionTokens,
    costUsd,
    model: DEEPSEEK_MODEL,
  };
}

/**
 * Récupère le solde DeepSeek du compte associé à la clé API.
 */
export async function getDeepSeekBalance(apiKey: string): Promise<DeepSeekBalance> {
  const res = await fetch(DEEPSEEK_BALANCE_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek balance ${res.status} : ${errText}`);
  }

  const json = await res.json();
  // Format documenté : { is_available, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }
  const infos = Array.isArray(json.balance_infos) ? json.balance_infos : [];
  // On privilégie USD si dispo, sinon la première entrée
  const usd =
    infos.find((b: { currency?: string }) => b.currency === "USD") ?? infos[0];

  if (!usd) {
    return { balanceUsd: 0, currency: "USD" };
  }

  const balance = parseFloat(usd.total_balance ?? "0");
  return { balanceUsd: balance, currency: usd.currency ?? "USD" };
}
