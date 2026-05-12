// Service TTS (Text-to-Speech) multi-fournisseurs pour DictéeMaster.
// Gère la génération audio à partir d'un texte, avec persistance de la config
// dans le localStorage (jamais en base distante — RGPD).

export type TtsProvider = "elevenlabs" | "google" | "azure" | "webspeech";

export interface TtsConfig {
  provider: TtsProvider;
  apiKey: string;   // vide pour webspeech
  voiceId?: string; // ElevenLabs: voice_id | Google/Azure: code de voix
}

// Clé localStorage pour persister la config TTS du prof.
export const TTS_CONFIG_KEY = "dictee-master-tts-config";

// Voix Rachel — voix par défaut gratuite ElevenLabs (compatible free tier).
// Modèle multilingual_v2 pour bonne prononciation française.
const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

// ── Persistance localStorage ───────────────────────────────────────────────

export function loadTtsConfig(): TtsConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TTS_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TtsConfig;
  } catch {
    return null;
  }
}

export function saveTtsConfig(config: TtsConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TTS_CONFIG_KEY, JSON.stringify(config));
}

// ── Génération audio ───────────────────────────────────────────────────────

/**
 * Génère un Blob audio MP3 à partir d'un texte via le fournisseur configuré.
 * Retourne null si le provider est "webspeech" (pas de Blob possible — lecture
 * directe dans le navigateur via SpeechSynthesis).
 * Lance une erreur si l'appel API échoue.
 */
export async function generateTtsAudio(
  text: string,
  config: TtsConfig,
): Promise<Blob | null> {
  switch (config.provider) {
    case "webspeech":
      return null;

    case "elevenlabs":
      return generateElevenLabs(text, config);

    case "google":
      return generateGoogle(text, config);

    case "azure":
      return generateAzure(text, config);

    default:
      throw new Error(`Fournisseur TTS inconnu : ${config.provider}`);
  }
}

// ── ElevenLabs ─────────────────────────────────────────────────────────────

async function generateElevenLabs(text: string, config: TtsConfig): Promise<Blob> {
  const voiceId = config.voiceId || ELEVENLABS_DEFAULT_VOICE;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`ElevenLabs ${res.status} : ${errText.slice(0, 200)}`);
  }

  return res.blob();
}

// ── Google TTS ─────────────────────────────────────────────────────────────

async function generateGoogle(text: string, config: TtsConfig): Promise<Blob> {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: "fr-FR",
        name: config.voiceId || "fr-FR-Standard-A",
      },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Google TTS ${res.status} : ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!json.audioContent) {
    throw new Error("Google TTS : audioContent absent de la réponse");
  }

  // Décoder le base64 en Blob MP3
  const binary = atob(json.audioContent as string);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "audio/mpeg" });
}

// ── Azure TTS ──────────────────────────────────────────────────────────────

async function generateAzure(text: string, config: TtsConfig): Promise<Blob> {
  const voiceName = config.voiceId || "fr-FR-DeniseNeural";
  const ssml = `<speak version='1.0' xml:lang='fr-FR'>
  <voice xml:lang='fr-FR' name='${voiceName}'>
    ${escapeXml(text)}
  </voice>
</speak>`;

  const res = await fetch(
    "https://francecentral.tts.speech.microsoft.com/cognitiveservices/v1",
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.apiKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      },
      body: ssml,
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Azure TTS ${res.status} : ${errText.slice(0, 200)}`);
  }

  return res.blob();
}

// ── Utilitaires ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Lit un texte à voix haute directement dans le navigateur via Web Speech API.
 * Retourne une Promise qui se résout quand la lecture est terminée.
 * Utile comme fallback quand aucune clé API n'est configurée.
 */
export function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      reject(new Error("Web Speech API non disponible dans ce navigateur"));
      return;
    }
    window.speechSynthesis.cancel(); // annuler toute lecture en cours
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "fr-FR";
    utt.rate = 0.9;
    utt.onend = () => resolve();
    utt.onerror = (e) => reject(new Error(`SpeechSynthesis erreur : ${e.error}`));
    window.speechSynthesis.speak(utt);
  });
}
