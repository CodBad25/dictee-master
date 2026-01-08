import mammoth from 'mammoth';

// Mots à ignorer (titres, instructions, etc.)
const IGNORED_WORDS = new Set([
  // Titres et instructions
  'dictée', 'dictées', 'dictee', 'dictees',
  'flash', 'mots', 'mot', 'savoir', 'orthographier',
  'orthographe', 'apprendre', 'liste', 'listes',
  'semaine', 'période', 'leçon', 'lecon', 'série',
  'évaluation', 'evaluation', 'contrôle', 'controle',
  'exercice', 'exercices', 'révision', 'revision',
  // Articles et mots très courts communs dans les titres
  'le', 'la', 'les', 'de', 'du', 'des', 'au', 'aux',
  // Mots courants dans les PDF de dictées
  'ce1', 'ce2', 'cm1', 'cm2', 'cp',
]);

/**
 * Vérifie si un mot est un vrai mot de dictée (pas un titre ou instruction)
 */
function isValidWord(word: string): boolean {
  if (word.length < 2) return false;
  if (word === word.toUpperCase() && word.length > 2) return false;
  if (/\d/.test(word)) return false;
  if (IGNORED_WORDS.has(word.toLowerCase())) return false;
  if (/[▶►◀◄→←↑↓★☆●○■□▪▫]/.test(word)) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(word)) return false;
  return true;
}

/**
 * Nettoie un mot (enlève les caractères parasites)
 */
function cleanWord(word: string): string {
  return word
    .trim()
    .replace(/^[^a-zA-ZÀ-ÿ']+|[^a-zA-ZÀ-ÿ']+$/g, '')
    .trim();
}

/**
 * Représente une section/liste détectée dans le document
 */
export interface DetectedSection {
  id: string;
  title: string;
  words: string[];
}

/**
 * Détecte les sections (dictées) dans un texte
 * Retourne un tableau de sections avec leurs mots
 */
export function detectSections(text: string): DetectedSection[] {
  const sections: DetectedSection[] = [];

  // Pattern pour détecter les débuts de section : "dictée X", "liste X", "semaine X", etc.
  // Fonctionne même sans retour à la ligne (PDF souvent sur une ligne)
  const sectionPattern = /\b(dictée|liste|semaine|période|leçon|série)\s*(\d+)\s*[►▶:\-–—]?\s*/gi;

  // Trouver toutes les sections
  const matches: { index: number; title: string; number: string }[] = [];
  let match;

  while ((match = sectionPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      title: `${match[1]} ${match[2]}`,
      number: match[2]
    });
  }

  // Si on a trouvé des sections, extraire les mots de chaque section
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const sectionText = text.substring(start, end);

      // Extraire les mots de cette section
      const words = extractWordsFromSection(sectionText);

      if (words.length > 0) {
        sections.push({
          id: `section-${matches[i].number}`,
          title: matches[i].title.charAt(0).toUpperCase() + matches[i].title.slice(1).toLowerCase(),
          words
        });
      }
    }
  }

  return sections;
}

/**
 * Extrait les mots d'une section de texte
 */
function extractWordsFromSection(text: string): string[] {
  // Séparer par tirets et autres séparateurs
  const words = text
    .replace(/(?:dictée|liste|semaine|période|leçon|série)\s*\d+\s*[►▶:\-–—]?\s*/gi, ' ')
    .split(/\s*[-–—]\s*|\s*[,;•·▶►]\s*|\n|\t/)
    .map(cleanWord)
    .filter(isValidWord)
    .filter((word, index, self) =>
      self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
    );

  return words;
}

/**
 * Parse une chaîne de texte pour extraire les mots (mode simple, sans sections)
 */
export function parseWordsFromText(text: string): string[] {
  // D'abord, essayer de détecter des sections
  const sections = detectSections(text);

  // Si une seule section ou pas de section détectée, parser tout le texte
  if (sections.length <= 1) {
    return extractWordsFromSection(text);
  }

  // Si plusieurs sections, retourner tous les mots (l'utilisateur devra choisir via l'UI)
  return extractWordsFromSection(text);
}

/**
 * Extrait le texte d'un fichier Word (.docx)
 */
export async function extractTextFromWord(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extrait le texte d'un fichier PDF
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Extrait le texte brut d'un fichier
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return await extractTextFromPDF(file);
  } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
    return await extractTextFromWord(file);
  } else if (fileName.endsWith('.txt')) {
    return await file.text();
  } else {
    throw new Error('Format non supporté. Utilisez PDF, Word (.docx) ou texte (.txt)');
  }
}

/**
 * Extrait les mots d'un fichier (PDF, Word, ou texte)
 * Retourne aussi les sections détectées si plusieurs
 */
export async function extractWordsFromFile(file: File): Promise<{
  words: string[];
  sections: DetectedSection[];
  hasMultipleSections: boolean;
}> {
  const text = await extractTextFromFile(file);
  const sections = detectSections(text);

  return {
    words: sections.length === 1 ? sections[0].words : extractWordsFromSection(text),
    sections,
    hasMultipleSections: sections.length > 1
  };
}
