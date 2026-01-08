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
 * Gère les cellules répétées et fusionnées
 */
function parseODTXml(xmlString: string): { tables: string[][][] } {
  const tables: string[][][] = [];

  // Extraire les tableaux avec regex pour éviter les problèmes de namespace
  const tableRegex = /<table:table[^>]*>([\s\S]*?)<\/table:table>/g;
  const rowRegex = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  const cellRegex = /<table:table-cell([^>]*)>([\s\S]*?)<\/table:table-cell>|<table:covered-table-cell[^>]*\/>/g;
  const textRegex = /<text:p[^>]*>([\s\S]*?)<\/text:p>/g;
  const repeatAttrRegex = /table:number-columns-repeated="(\d+)"/;

  let tableMatch;
  while ((tableMatch = tableRegex.exec(xmlString)) !== null) {
    const tableContent = tableMatch[1];
    const tableData: string[][] = [];

    let rowMatch;
    const rowRegexLocal = new RegExp(rowRegex.source, 'g');
    while ((rowMatch = rowRegexLocal.exec(tableContent)) !== null) {
      const rowContent = rowMatch[1];
      const rowData: string[] = [];

      let cellMatch;
      const cellRegexLocal = new RegExp(cellRegex.source, 'g');
      while ((cellMatch = cellRegexLocal.exec(rowContent)) !== null) {
        const fullMatch = cellMatch[0];

        // Cellule couverte (fusionnée) = cellule vide
        if (fullMatch.includes('covered-table-cell')) {
          rowData.push('');
          continue;
        }

        const cellAttrs = cellMatch[1] || '';
        const cellContent = cellMatch[2] || '';

        // Extraire le texte des paragraphes
        let cellText = '';
        let textMatch;
        const textRegexLocal = new RegExp(textRegex.source, 'g');
        while ((textMatch = textRegexLocal.exec(cellContent)) !== null) {
          // Nettoyer les balises internes (text:span, etc.)
          const cleanText = textMatch[1]
            .replace(/<[^>]+>/g, '')
            .trim();
          if (cleanText) {
            cellText += (cellText ? '\n' : '') + cleanText;
          }
        }

        // Vérifier si la cellule est répétée
        const repeatMatch = cellAttrs.match(repeatAttrRegex);
        const repeatCount = repeatMatch ? parseInt(repeatMatch[1], 10) : 1;

        // Ajouter la cellule (ou les cellules répétées)
        for (let i = 0; i < repeatCount; i++) {
          rowData.push(cellText);
        }
      }

      if (rowData.length > 0) {
        tableData.push(rowData);
      }
    }

    if (tableData.length > 0) {
      tables.push(tableData);
      console.log('Parsed table with', tableData.length, 'rows and', tableData[0]?.length || 0, 'columns');
      console.log('First row:', tableData[0]);
    }
  }

  return { tables };
}

/**
 * Detecte les en-tetes "Liste X", "Dictee X", ou "n°X" dans une ligne
 * Gère plusieurs formats: "Liste 7", "n°7", "N° 7", "Dictée 1", etc.
 */
function detectListHeaders(row: string[]): Map<number, string> {
  const headers = new Map<number, string>();

  // Patterns pour différents formats
  const patterns = [
    // "Liste 7", "Dictée 7", etc.
    { regex: /(liste|dictée|dictee|dict\.?)\s*n?[°º]?\s*(\d+)/i, prefix: (m: RegExpMatchArray) => m[1].toLowerCase().includes('dict') ? 'Dictée' : 'Liste' },
    // "n°1", "N° 2", "n°7", etc. (format simple)
    { regex: /^n[°º]\s*(\d+)$/i, prefix: () => 'Dictée' },
  ];

  console.log('Checking row for headers:', row);

  row.forEach((cell, index) => {
    if (!cell || cell.trim() === '') return;

    const cleanCell = cell.trim();

    for (const pattern of patterns) {
      const match = cleanCell.match(pattern.regex);
      if (match) {
        // Pour le pattern "n°X", le numéro est dans match[1], sinon match[2]
        const number = match[2] || match[1];
        const prefix = pattern.prefix(match);
        headers.set(index, `${prefix} ${number}`);
        console.log(`Found header at col ${index}: "${prefix} ${number}" (from: "${cleanCell}")`);
        break;
      }
    }
  });

  return headers;
}

/**
 * Extrait les listes depuis un tableau ODT
 * Detecte automatiquement la structure (colonnes avec en-tetes)
 */
function extractListsFromTable(tableData: string[][]): DetectedSection[] {
  if (tableData.length === 0) return [];

  // Chercher les en-têtes dans les premières lignes (parfois il y a une ligne de titre avant)
  let headerRow = -1;
  let headers = new Map<number, string>();

  for (let rowIdx = 0; rowIdx < Math.min(3, tableData.length); rowIdx++) {
    const candidateHeaders = detectListHeaders(tableData[rowIdx]);
    if (candidateHeaders.size >= 2) {
      headers = candidateHeaders;
      headerRow = rowIdx;
      console.log(`Found headers in row ${rowIdx}:`, Array.from(headers.entries()));
      break;
    } else if (candidateHeaders.size === 1 && headers.size === 0) {
      // Garder la première ligne avec au moins 1 header comme fallback
      headers = candidateHeaders;
      headerRow = rowIdx;
    }
  }

  console.log('Final header row:', headerRow, 'with', headers.size, 'headers');

  // Si on a detecte des en-tetes
  if (headers.size >= 1) {
    const sections: DetectedSection[] = [];
    const headerIndices = Array.from(headers.keys()).sort((a, b) => a - b);
    const totalCols = Math.max(...tableData.map(row => row.length));

    headerIndices.forEach((startIndex, i) => {
      const listTitle = headers.get(startIndex) || `Liste ${i + 1}`;
      const words: string[] = [];

      // Fin = debut de la liste suivante ou fin de ligne
      const endIndex = i < headerIndices.length - 1
        ? headerIndices[i + 1]
        : totalCols;

      const numCols = endIndex - startIndex;

      console.log(`Processing ${listTitle}: cols ${startIndex} to ${endIndex - 1} (${numCols} cols)`);

      // Parcourir les lignes de donnees (apres l'en-tete)
      for (let rowIndex = headerRow + 1; rowIndex < tableData.length; rowIndex++) {
        const row = tableData[rowIndex];

        for (let colOffset = 0; colOffset < numCols; colOffset++) {
          const colIndex = startIndex + colOffset;
          if (colIndex < row.length) {
            const cellText = row[colIndex];
            if (cellText && cellText.trim()) {
              // Ne pas inclure les cellules qui sont elles-mêmes des titres
              if (detectListHeaders([cellText]).size > 0) continue;

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

      console.log(`${listTitle}: ${uniqueWords.length} unique words from ${words.length} total`);

      if (uniqueWords.length > 0) {
        sections.push({
          id: `${listTitle.replace(/\s+/g, '-').toLowerCase()}`,
          title: listTitle,
          words: uniqueWords,
        });
      }
    });

    return sections;
  }

  // Pas d'en-tetes - essayer de diviser le tableau en 2 moities
  const firstRow = tableData[0];
  const totalColsFallback = Math.max(...tableData.map(row => row.length));
  if (totalColsFallback >= 4) {
    // Supposer que le tableau est divise en 2 listes (gauche et droite)
    const midPoint = Math.floor(totalColsFallback / 2);

    const list1Words: string[] = [];
    const list2Words: string[] = [];

    for (const row of tableData) {
      // Premiere moitie -> Liste 1
      for (let c = 0; c < midPoint; c++) {
        if (row[c]) {
          const cellWords = row[c]
            .split(/[,\n]+/)
            .map(w => cleanWord(w))
            .filter(isValidWord);
          list1Words.push(...cellWords);
        }
      }

      // Deuxieme moitie -> Liste 2
      for (let c = midPoint; c < row.length; c++) {
        if (row[c]) {
          const cellWords = row[c]
            .split(/[,\n]+/)
            .map(w => cleanWord(w))
            .filter(isValidWord);
          list2Words.push(...cellWords);
        }
      }
    }

    const sections: DetectedSection[] = [];

    const unique1 = list1Words.filter((word, index, self) =>
      self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
    );
    const unique2 = list2Words.filter((word, index, self) =>
      self.findIndex(w => w.toLowerCase() === word.toLowerCase()) === index
    );

    if (unique1.length > 0) {
      sections.push({ id: 'liste-1', title: 'Liste 1', words: unique1 });
    }
    if (unique2.length > 0) {
      sections.push({ id: 'liste-2', title: 'Liste 2', words: unique2 });
    }

    if (sections.length > 0) {
      return sections;
    }
  }

  // Fallback: extraire tous les mots comme une seule liste
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
    return [{ id: 'liste-1', title: 'Liste 1', words: uniqueWords }];
  }

  return [];
}

/**
 * Detecte les sections dans un texte
 */
export function detectSections(text: string): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const sectionPattern = /\b(dictée|liste|semaine|période|leçon|série)\s*n?°?\s*(\d+)\s*[►▶:\-–—]?\s*/gi;

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
    .replace(/(?:dictée|liste|semaine|période|leçon|série)\s*n?°?\s*\d+\s*[►▶:\-–—]?\s*/gi, ' ')
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

  console.log(`Found ${tables.length} tables in ODT`);

  // Extraire les sections du PREMIER tableau seulement (celui avec les listes)
  // Les autres tableaux sont probablement des exercices
  let allSections: DetectedSection[] = [];

  if (tables.length > 0) {
    // Chercher le tableau qui contient des en-tetes "Liste X"
    for (const tableData of tables) {
      if (tableData.length > 0) {
        // Chercher les en-têtes dans les 3 premières lignes
        let maxHeaders = 0;
        for (let rowIdx = 0; rowIdx < Math.min(3, tableData.length); rowIdx++) {
          const headers = detectListHeaders(tableData[rowIdx]);
          maxHeaders = Math.max(maxHeaders, headers.size);
        }

        if (maxHeaders >= 2) {
          // C'est le tableau principal avec Liste 7 et Liste 8
          const tableSections = extractListsFromTable(tableData);
          if (tableSections.length >= 2) {
            allSections = tableSections;
            console.log('Found main table with lists:', tableSections.map(s => `${s.title} (${s.words.length} words)`));
            break;
          }
        }
      }
    }

    // Si pas trouve avec 2 listes, essayer avec 1 liste
    if (allSections.length === 0) {
      for (const tableData of tables) {
        const tableSections = extractListsFromTable(tableData);
        if (tableSections.length >= 1 && tableSections[0].words.length > 0) {
          allSections = tableSections;
          console.log('Using table with sections:', tableSections.map(s => `${s.title} (${s.words.length} words)`));
          break;
        }
      }
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

  return { text: fullText, sections: allSections };
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

    console.log('ODT sections found:', sections.map(s => `${s.title} (${s.words.length} words)`));

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
