import mammoth from 'mammoth';
import JSZip from 'jszip';

// Mots a ignorer (titres, instructions, etc.)
const IGNORED_WORDS = new Set([
  'dictée', 'dictées', 'dictee', 'dictees',
  'flash', 'mots', 'mot', 'savoir', 'orthographier',
  'orthographe', 'apprendre', 'liste', 'listes',
  'semaine', 'période', 'leçon', 'lecon', 'série',
  'évaluation', 'evaluation', 'contrôle', 'controle',
  'exercice', 'exercices', 'révision', 'revision',
  'ce1', 'ce2', 'cm1', 'cm2', 'cp', '6e', '5e', '4e', '3e',
]);

/**
 * Verifie si un mot est un vrai mot de dictee
 * Garde les mots avec variantes comme absent(e), lourd(e)
 */
function isValidWord(word: string): boolean {
  // Nettoyer pour la verification
  const cleanedForCheck = word.replace(/\([^)]*\)/g, '').trim();

  if (cleanedForCheck.length < 2) return false;
  if (cleanedForCheck === cleanedForCheck.toUpperCase() && cleanedForCheck.length > 2) return false;
  if (/^\d+$/.test(cleanedForCheck)) return false;
  if (IGNORED_WORDS.has(cleanedForCheck.toLowerCase())) return false;
  if (/[▶►◀◄→←↑↓★☆●○■□▪▫]/.test(word)) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(cleanedForCheck)) return false;
  return true;
}

/**
 * Nettoie un mot (enleve les caracteres parasites mais garde les variantes)
 * Ex: "absent(e)" reste "absent(e)", "le lendemain" devient "lendemain"
 */
function cleanWord(word: string): string {
  return word
    .trim()
    // Enlever les articles au debut
    .replace(/^(le|la|les|l'|un|une|des)\s+/i, '')
    // Enlever ponctuation debut/fin sauf parentheses pour variantes
    .replace(/^[^a-zA-ZÀ-ÿ'(]+/, '')
    .replace(/[^a-zA-ZÀ-ÿ')]+$/, '')
    .trim();
}

/**
 * Represente une section/liste detectee dans le document
 */
export interface DetectedSection {
  id: string;
  title: string;
  words: string[];
}

/**
 * Detecte les en-tetes de colonnes dans un tableau (Liste 7, Liste 8, etc.)
 */
function detectColumnHeaders(cells: string[]): { headers: string[]; headerIndices: number[] } {
  const headers: string[] = [];
  const headerIndices: number[] = [];

  // Pattern pour detecter "Liste X" ou "Dictee X"
  const headerPattern = /^(liste|dictée|dictee|semaine)\s*(\d+)/i;

  cells.forEach((cell, index) => {
    const match = cell.match(headerPattern);
    if (match) {
      headers.push(`${match[1]} ${match[2]}`);
      headerIndices.push(index);
    }
  });

  return { headers, headerIndices };
}

/**
 * Extrait les mots d'un tableau ODT en detectant les colonnes
 */
function extractWordsFromODTTable(tableElement: Element): DetectedSection[] {
  const sections: DetectedSection[] = [];

  // Recuperer toutes les lignes
  const rows = tableElement.getElementsByTagName('table:table-row');
  if (rows.length === 0) return sections;

  // Analyser la premiere ligne pour detecter les en-tetes
  const firstRowCells: string[] = [];
  const firstRow = rows[0];
  const firstRowCellElements = firstRow.getElementsByTagName('table:table-cell');

  for (let i = 0; i < firstRowCellElements.length; i++) {
    firstRowCells.push(firstRowCellElements[i].textContent?.trim() || '');
  }

  const { headers, headerIndices } = detectColumnHeaders(firstRowCells);

  // Si on a detecte des en-tetes de liste (Liste 7, Liste 8, etc.)
  if (headers.length >= 2 && headerIndices.length >= 2) {
    // Determiner le nombre de colonnes par liste
    const columnsPerList: number[] = [];
    for (let i = 0; i < headerIndices.length; i++) {
      const start = headerIndices[i];
      const end = i < headerIndices.length - 1 ? headerIndices[i + 1] : firstRowCells.length;
      columnsPerList.push(end - start);
    }

    // Extraire les mots pour chaque liste
    for (let listIndex = 0; listIndex < headers.length; listIndex++) {
      const words: string[] = [];
      const startCol = headerIndices[listIndex];
      const numCols = columnsPerList[listIndex];

      // Parcourir toutes les lignes (sauf la premiere qui contient les en-tetes)
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const cells = row.getElementsByTagName('table:table-cell');

        // Extraire les mots des colonnes de cette liste
        for (let colOffset = 0; colOffset < numCols; colOffset++) {
          const cellIndex = startCol + colOffset;
          if (cellIndex < cells.length) {
            const cellText = cells[cellIndex].textContent?.trim() || '';
            if (cellText) {
              // Une cellule peut contenir plusieurs mots separes par des virgules ou retours a la ligne
              const cellWords = cellText.split(/[,\n]+/).map(w => cleanWord(w)).filter(isValidWord);
              words.push(...cellWords);
            }
          }
        }
      }

      // Dedupliquer
      const uniqueWords = words.filter((word, index, self) =>
        self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
      );

      if (uniqueWords.length > 0) {
        sections.push({
          id: `liste-${listIndex + 1}`,
          title: headers[listIndex].charAt(0).toUpperCase() + headers[listIndex].slice(1).toLowerCase(),
          words: uniqueWords,
        });
      }
    }
  } else {
    // Pas d'en-tetes detectes, extraire tous les mots du tableau
    const allWords: string[] = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const cells = row.getElementsByTagName('table:table-cell');

      for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
        const cellText = cells[cellIndex].textContent?.trim() || '';
        if (cellText) {
          const cellWords = cellText.split(/[,\n]+/).map(w => cleanWord(w)).filter(isValidWord);
          allWords.push(...cellWords);
        }
      }
    }

    const uniqueWords = allWords.filter((word, index, self) =>
      self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
    );

    if (uniqueWords.length > 0) {
      sections.push({
        id: 'table-1',
        title: 'Liste 1',
        words: uniqueWords,
      });
    }
  }

  return sections;
}

/**
 * Detecte les sections (dictees) dans un texte
 */
export function detectSections(text: string): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const sectionPattern = /\b(dictée|liste|semaine|période|leçon|série)\s*(\d+)\s*[►▶:\-–—]?\s*/gi;

  const matches: { index: number; title: string; number: string }[] = [];
  let match;

  while ((match = sectionPattern.exec(text)) !== null) {
    matches.push({
      index: match.index,
      title: `${match[1]} ${match[2]}`,
      number: match[2]
    });
  }

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const sectionText = text.substring(start, end);
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
 * Parse une chaine de texte pour extraire les mots
 */
export function parseWordsFromText(text: string): string[] {
  const sections = detectSections(text);

  if (sections.length <= 1) {
    return extractWordsFromSection(text);
  }

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
 * Extrait le texte et les tableaux d'un fichier ODT (LibreOffice)
 */
export async function extractFromODT(file: File): Promise<{
  text: string;
  sections: DetectedSection[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new Error('Fichier ODT invalide');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(contentXml, 'text/xml');

  // Extraire le texte brut
  const textElements = doc.getElementsByTagName('text:p');
  let fullText = '';
  for (let i = 0; i < textElements.length; i++) {
    fullText += textElements[i].textContent + '\n';
  }

  // Extraire les sections depuis les tableaux
  const sections: DetectedSection[] = [];
  const tableElements = doc.getElementsByTagName('table:table');

  for (let t = 0; t < tableElements.length; t++) {
    const tableSections = extractWordsFromODTTable(tableElements[t]);
    sections.push(...tableSections);
  }

  return { text: fullText, sections };
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
  } else if (fileName.endsWith('.odt')) {
    const result = await extractFromODT(file);
    return result.text;
  } else if (fileName.endsWith('.txt')) {
    return await file.text();
  } else {
    throw new Error('Format non supporte. Utilisez PDF, Word (.docx), LibreOffice (.odt) ou texte (.txt)');
  }
}

/**
 * Extrait les mots d'un fichier (PDF, Word, ODT ou texte)
 */
export async function extractWordsFromFile(file: File): Promise<{
  words: string[];
  sections: DetectedSection[];
  hasMultipleSections: boolean;
}> {
  const fileName = file.name.toLowerCase();

  // Traitement special pour ODT : extraire les tableaux avec detection des colonnes
  if (fileName.endsWith('.odt')) {
    const { text, sections } = await extractFromODT(file);

    if (sections.length > 0) {
      return {
        words: sections.length === 1 ? sections[0].words : sections.flatMap(s => s.words),
        sections,
        hasMultipleSections: sections.length > 1,
      };
    }

    // Sinon, traiter comme du texte normal
    const textSections = detectSections(text);
    return {
      words: textSections.length === 1 ? textSections[0].words : extractWordsFromSection(text),
      sections: textSections,
      hasMultipleSections: textSections.length > 1,
    };
  }

  // Traitement standard pour les autres formats
  const text = await extractTextFromFile(file);
  const sections = detectSections(text);

  return {
    words: sections.length === 1 ? sections[0].words : extractWordsFromSection(text),
    sections,
    hasMultipleSections: sections.length > 1
  };
}
