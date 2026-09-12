import JSZip from 'jszip';
import type { ParsedDictee, ParsedWordList } from '@/types/database';

/**
 * Parse un fichier ODT et extrait les données de dictée
 */
export async function parseODTFile(file: File): Promise<ParsedDictee[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new Error('Fichier ODT invalide : content.xml non trouvé');
  }

  // Extraire le texte brut du XML
  const text = extractTextFromXml(contentXml);

  // Parser les dictées (chaque fichier peut contenir 2 dictées)
  return parseDictees(text, file.name);
}

/**
 * Extrait le texte brut d'un contenu XML ODT
 */
function extractTextFromXml(xml: string): string {
  return xml
    .replace(/<text:p[^>]*>/g, '\n')
    .replace(/<text:span[^>]*>/g, '')
    .replace(/<text:tab[^>]*\/>/g, '\t')
    .replace(/<text:line-break[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Parse le texte pour extraire les dictées
 */
function parseDictees(text: string, filename: string): ParsedDictee[] {
  const dictees: ParsedDictee[] = [];

  // Extraire les numéros de dictée du nom de fichier (ex: "Dictées 1 et 2.odt")
  const match = filename.match(/(\d+)\s*et\s*(\d+)/i);
  const num1 = match ? parseInt(match[1]) : 1;
  const num2 = match ? parseInt(match[2]) : 2;

  // Extraire les listes de mots
  const wordLists = extractWordLists(text);

  // Extraire les dictées préparées
  const dicteeTexts = extractDicteeTexts(text);

  // Extraire les textes à trous
  const fillBlanksTexts = extractFillBlanksTexts(text);

  // Créer la première dictée
  if (dicteeTexts.length >= 1 || wordLists.list1.length > 0) {
    dictees.push({
      title: `Dictée n°${num1}`,
      lists: [
        {
          title: 'Liste n°1',
          words: wordLists.list1,
        },
      ],
      dictationText: dicteeTexts[0],
      fillBlanksText: fillBlanksTexts[0],
    });
  }

  // Créer la deuxième dictée
  if (dicteeTexts.length >= 2 || wordLists.list2.length > 0) {
    dictees.push({
      title: `Dictée n°${num2}`,
      lists: [
        {
          title: 'Liste n°2',
          words: wordLists.list2,
        },
      ],
      dictationText: dicteeTexts[1],
      fillBlanksText: fillBlanksTexts[1],
    });
  }

  return dictees;
}

/**
 * Extrait les listes de mots depuis le texte
 */
function extractWordLists(text: string): { list1: string[]; list2: string[] } {
  const list1: string[] = [];
  const list2: string[] = [];

  // Chercher la section avec les listes de mots
  // Format: lignes avec \t séparant n°1 et n°2
  const lines = text.split('\n');

  let inWordSection = false;
  let foundHeaders = false;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Détecter le début de la section des mots
    if (trimmedLine.match(/liste\s+de\s+mots/i) || trimmedLine.match(/^n°1\s*n°2$/i)) {
      inWordSection = true;
      continue;
    }

    // Détecter les en-têtes n°1 / n°2
    if (trimmedLine.match(/^n°1$/i) || trimmedLine.match(/^n°1\s+n°2$/i)) {
      foundHeaders = true;
      continue;
    }
    if (trimmedLine === 'n°2') {
      continue;
    }

    // Arrêter à la section dictée
    if (trimmedLine.match(/dict[ée]e\s+pr[ée]par[ée]e/i)) {
      break;
    }

    // Si on est dans la section des mots
    if (inWordSection || foundHeaders) {
      // Vérifier si c'est une ligne avec deux colonnes (tab séparé)
      if (line.includes('\t')) {
        const parts = line.split('\t').map(p => p.trim()).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const word1 = cleanWord(parts[0]);
          const word2 = cleanWord(parts[1]);
          if (word1 && !word1.match(/^n°/i)) list1.push(word1);
          if (word2 && !word2.match(/^n°/i)) list2.push(word2);
        } else if (parts.length === 1) {
          const word = cleanWord(parts[0]);
          if (word && !word.match(/^n°/i)) {
            // Alterner entre les listes si une seule colonne
            if (list1.length <= list2.length) {
              list1.push(word);
            } else {
              list2.push(word);
            }
          }
        }
      }
    }
  }

  return {
    list1: [...new Set(list1)].slice(0, 20), // Max 20 mots uniques
    list2: [...new Set(list2)].slice(0, 20),
  };
}

/**
 * Nettoie un mot
 */
function cleanWord(word: string): string {
  return word
    .trim()
    .toLowerCase()
    .replace(/^(le|la|l'|les|un|une|des|du|de la|de l')\s*/i, '') // Garder les articles pour certains mots
    .replace(/[0-9]+/g, '')
    .trim();
}

/**
 * Extrait les textes de dictée
 */
function extractDicteeTexts(text: string): string[] {
  const texts: string[] = [];

  // Pattern pour trouver les dictées préparées avec leur texte
  const pattern = /Dict[ée]e\s+pr[ée]par[ée]e\s+n°\s*(\d+)\s*:([^]*?)(?=Dict[ée]e\s+pr[ée]par[ée]e\s+n°|Mot\s+[àa]\s+expliquer|$)/gi;

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const content = match[2].trim();

    // Extraire le texte de dictée (pas le texte à trous)
    const lines = content.split('\n').filter(l => l.trim());

    // Le premier bloc de texte significatif (sans les ...)
    for (const line of lines) {
      const cleaned = line.trim();
      if (
        cleaned.length > 30 &&
        !cleaned.includes('…') &&
        !cleaned.includes('………') &&
        !cleaned.includes('/')
      ) {
        texts.push(cleaned);
        break;
      }
    }
  }

  return texts;
}

/**
 * Extrait les textes à trous
 */
function extractFillBlanksTexts(text: string): string[] {
  const texts: string[] = [];

  // Chercher les textes avec des blancs (………)
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Un texte à trous contient des séries de points
    if (trimmed.includes('………') && trimmed.length > 50) {
      // Convertir les points en underscores standard
      const normalized = trimmed.replace(/…+|\.{3,}/g, '_____');
      texts.push(normalized);
    }
  }

  return texts;
}

/**
 * Parse un fichier DOCX (pour les fichiers 9 et 10)
 */
export async function parseDOCXFile(file: File): Promise<ParsedDictee[]> {
  // Pour les DOCX, on utilise mammoth
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();

  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    // Utiliser le même parser que pour ODT
    return parseDictees(text, file.name);
  } catch {
    console.error('Erreur parsing DOCX:', file.name);
    return [];
  }
}

/**
 * Parse tous les fichiers d'un dossier
 */
export async function parseAllFiles(files: File[]): Promise<ParsedDictee[]> {
  const allDictees: ParsedDictee[] = [];

  for (const file of files) {
    try {
      let dictees: ParsedDictee[];

      if (file.name.endsWith('.odt')) {
        dictees = await parseODTFile(file);
      } else if (file.name.endsWith('.docx')) {
        dictees = await parseDOCXFile(file);
      } else {
        continue;
      }

      allDictees.push(...dictees);
    } catch (error) {
      console.error(`Erreur parsing ${file.name}:`, error);
    }
  }

  // Trier par numéro de dictée
  return allDictees.sort((a, b) => {
    const numA = parseInt(a.title.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.title.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });
}
