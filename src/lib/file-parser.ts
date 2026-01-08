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
 */
function isValidWord(word: string): boolean {
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
 * Nettoie un mot
 */
function cleanWord(word: string): string {
  return word
    .trim()
    .replace(/^(le|la|les|l'|un|une|des)\s+/i, '')
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
 * Parse le XML ODT et extrait les tableaux
 */
function parseODTXml(xmlString: string): { tables: string[][][] } {
  // Nettoyer le XML des namespaces pour simplifier le parsing
  const cleanXml = xmlString
    .replace(/<table:table-row/g, '<tablerow')
    .replace(/<\/table:table-row>/g, '</tablerow>')
    .replace(/<table:table-cell/g, '<tablecell')
    .replace(/<\/table:table-cell>/g, '</tablecell>')
    .replace(/<table:table /g, '<table ')
    .replace(/<table:table>/g, '<table>')
    .replace(/<\/table:table>/g, '</table>')
    .replace(/<text:p/g, '<p')
    .replace(/<\/text:p>/g, '</p>');

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, 'text/xml');

  const tables: string[][][] = [];
  const tableElements = doc.getElementsByTagName('table');

  for (let t = 0; t < tableElements.length; t++) {
    const table = tableElements[t];
    const tableData: string[][] = [];

    const rows = table.getElementsByTagName('tablerow');
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rowData: string[] = [];

      const cells = row.getElementsByTagName('tablecell');
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        // Recuperer tout le texte de la cellule
        const cellText = cell.textContent?.trim() || '';
        rowData.push(cellText);
      }

      if (rowData.length > 0) {
        tableData.push(rowData);
      }
    }

    if (tableData.length > 0) {
      tables.push(tableData);
    }
  }

  return { tables };
}

/**
 * Detecte les en-tetes "Liste X" dans la premiere ligne d'un tableau
 */
function detectListHeaders(firstRow: string[]): { headers: Map<number, string> } {
  const headers = new Map<number, string>();
  const headerPattern = /liste\s*(\d+)/i;

  firstRow.forEach((cell, index) => {
    const match = cell.match(headerPattern);
    if (match) {
      headers.set(index, `Liste ${match[1]}`);
    }
  });

  return { headers };
}

/**
 * Extrait les listes depuis un tableau ODT
 */
function extractListsFromTable(tableData: string[][]): DetectedSection[] {
  if (tableData.length === 0) return [];

  const firstRow = tableData[0];
  const { headers } = detectListHeaders(firstRow);

  // Si on a detecte des en-tetes "Liste X"
  if (headers.size >= 1) {
    const sections: DetectedSection[] = [];
    const headerIndices = Array.from(headers.keys()).sort((a, b) => a - b);

    // Pour chaque liste detectee
    headerIndices.forEach((startIndex, i) => {
      const listTitle = headers.get(startIndex) || `Liste ${i + 1}`;
      const words: string[] = [];

      // Determiner la fin de cette liste (debut de la suivante ou fin du tableau)
      const endIndex = i < headerIndices.length - 1
        ? headerIndices[i + 1]
        : firstRow.length;

      // Nombre de colonnes pour cette liste
      const numCols = endIndex - startIndex;

      // Parcourir les lignes (sauf la premiere = en-tete)
      for (let rowIndex = 1; rowIndex < tableData.length; rowIndex++) {
        const row = tableData[rowIndex];

        // Extraire les mots des colonnes de cette liste
        for (let colOffset = 0; colOffset < numCols; colOffset++) {
          const colIndex = startIndex + colOffset;
          if (colIndex < row.length) {
            const cellText = row[colIndex];
            if (cellText) {
              const cellWords = cellText
                .split(/[,\n]+/)
                .map(w => cleanWord(w))
                .filter(isValidWord);
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
          id: `liste-${listTitle.replace(/\s+/g, '-').toLowerCase()}`,
          title: listTitle,
          words: uniqueWords,
        });
      }
    });

    return sections;
  }

  // Pas d'en-tetes detectes - extraire tous les mots comme une seule liste
  const allWords: string[] = [];

  for (const row of tableData) {
    for (const cell of row) {
      if (cell) {
        const cellWords = cell
          .split(/[,\n]+/)
          .map(w => cleanWord(w))
          .filter(isValidWord);
        allWords.push(...cellWords);
      }
    }
  }

  const uniqueWords = allWords.filter((word, index, self) =>
    self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
  );

  if (uniqueWords.length > 0) {
    return [{
      id: 'liste-1',
      title: 'Liste 1',
      words: uniqueWords,
    }];
  }

  return [];
}

/**
 * Detecte les sections dans un texte
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
 * Extrait le contenu d'un fichier ODT (LibreOffice)
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

  // Parser les tableaux
  const { tables } = parseODTXml(contentXml);

  // Extraire les sections de chaque tableau
  const allSections: DetectedSection[] = [];

  for (const tableData of tables) {
    const tableSections = extractListsFromTable(tableData);
    allSections.push(...tableSections);
  }

  // Dedupliquer les sections par titre (garder la premiere de chaque titre)
  const uniqueSections: DetectedSection[] = [];
  const seenTitles = new Set<string>();

  for (const section of allSections) {
    if (!seenTitles.has(section.title)) {
      seenTitles.add(section.title);
      uniqueSections.push(section);
    }
  }

  // Extraire le texte brut pour fallback
  const cleanXml = contentXml
    .replace(/<text:p/g, '<p')
    .replace(/<\/text:p>/g, '</p>');
  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, 'text/xml');
  const textElements = doc.getElementsByTagName('p');
  let fullText = '';
  for (let i = 0; i < textElements.length; i++) {
    fullText += textElements[i].textContent + '\n';
  }

  return { text: fullText, sections: uniqueSections };
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

  // Traitement special pour ODT
  if (fileName.endsWith('.odt')) {
    const { text, sections } = await extractFromODT(file);

    if (sections.length > 0) {
      return {
        words: sections.length === 1 ? sections[0].words : sections.flatMap(s => s.words),
        sections,
        hasMultipleSections: sections.length > 1,
      };
    }

    // Fallback sur detection texte
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
