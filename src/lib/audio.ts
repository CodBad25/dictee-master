// Lecture audio des mots — fichiers MP3 pré-générés avec fallback Web Speech API

let currentAudio: HTMLAudioElement | null = null;
let isAudioPlaying = false;
let lastPlayedWord: string | null = null;
let lastPlayTime = 0;

/**
 * Convertit un mot de la base de données en nom de fichier audio.
 * Exemples :
 *   "le héros"     → "le_héros"
 *   "absent(e)"    → "absent_e"
 *   "actif (ve)"   → "actif__ve"
 *   "l'épaule"     → "l_épaule"  (essai) puis "l'épaule"
 *   "coucher (se)" → "coucher__se"
 */
function wordToFileName(word: string): string[] {
  const candidates: string[] = [];

  // Nettoyage de base : trim
  let base = word.trim();

  // 1. Format exact : espaces → underscores
  candidates.push(base.replace(/ /g, "_"));

  // 2. Parenthèses avec espace : "absent(e)" ou "actif (ve)" → "absent_e" ou "actif__ve"
  const parenMatch = base.match(/^(.+?)\s*\((.+?)\)$/);
  if (parenMatch) {
    const [, main, variant] = parenMatch;
    candidates.push(`${main.trim().replace(/ /g, "_")}__${variant.trim()}`);
    candidates.push(`${main.trim().replace(/ /g, "_")}_${variant.trim()}`);
  }

  // 3. Apostrophe : "l'épaule" → "l_épaule"
  if (base.includes("'") || base.includes("\u2019")) {
    candidates.push(base.replace(/['\u2019]/g, "_").replace(/ /g, "_"));
  }

  // 4. Slash : "la clé / la clef" → "la_clé"
  if (base.includes("/")) {
    candidates.push(base.split("/")[0].trim().replace(/ /g, "_"));
  }

  // 5. Sans article : "le héros" → "héros"
  const withoutArticle = base.replace(/^(le |la |l'|l\u2019|un |une |les |des |du )/i, "");
  if (withoutArticle !== base) {
    candidates.push(withoutArticle.replace(/ /g, "_"));
  }

  return [...new Set(candidates)];
}

/**
 * Joue le son d'un mot via fichier MP3 pré-enregistré.
 * Fallback sur Web Speech API si le fichier n'existe pas.
 */
export function playWordAudio(
  word: string,
  onStart?: () => void,
  onEnd?: () => void,
): void {
  console.trace(`[audio] playWordAudio("${word}") — isAudioPlaying=${isAudioPlaying}`);

  // Bloquer les rejeux du même mot dans les 1.5s (protection contre les boucles infinies)
  const now = Date.now();
  if (lastPlayedWord === word && (now - lastPlayTime) < 1500) {
    console.warn(`[audio] Ignoring duplicate play of "${word}" (last played ${now - lastPlayTime}ms ago)`);
    return;
  }

  lastPlayedWord = word;
  lastPlayTime = now;

  // Bloquer les appels concurrents (protection contre les boucles)
  if (isAudioPlaying) return;

  // Stopper l'audio précédent sans toucher au flag (on va le set juste après)
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
  }

  isAudioPlaying = true;

  const wrappedOnEnd = () => {
    isAudioPlaying = false;
    onEnd?.();
  };

  const candidates = wordToFileName(word);
  tryPlayAudio(candidates, word, onStart, wrappedOnEnd);
}

async function tryPlayAudio(
  candidates: string[],
  word: string,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  for (const fileName of candidates) {
    const url = `/audio/${fileName}.mp3`;
    try {
      // Vérifier si le fichier existe avant de créer l'Audio
      const res = await fetch(url, { method: "HEAD" });
      if (!res.ok) continue;

      const audio = new Audio(url);
      currentAudio = audio;

      return new Promise<void>((resolve) => {
        audio.onplay = () => onStart?.();
        audio.onended = () => {
          currentAudio = null;
          onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          currentAudio = null;
          resolve(); // passer au fallback
        };
        audio.play().catch(() => resolve());
      });
    } catch {
      continue;
    }
  }

  // Aucun fichier trouvé → fallback Web Speech API
  fallbackSpeak(word, onStart, onEnd);
}

function fallbackSpeak(
  word: string,
  onStart?: () => void,
  onEnd?: () => void,
): void {
  if (typeof speechSynthesis === "undefined") {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "fr-FR";
  utterance.rate = 0.85;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  speechSynthesis.speak(utterance);
}

/**
 * Joue un texte complet via Web Speech API (pas de fichier MP3 pour les textes longs).
 */
export function playTextAudio(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
): void {
  stopAudio();
  if (typeof speechSynthesis === "undefined") {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.8;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  speechSynthesis.speak(utterance);
}

/** Arrête tout son en cours (MP3 ou Speech). */
export function stopAudio(): void {
  isAudioPlaying = false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof speechSynthesis !== "undefined") {
    speechSynthesis.cancel();
  }
}
