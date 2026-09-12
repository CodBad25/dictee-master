/**
 * Script pour parser tous les fichiers ODT et générer les données JSON
 * Usage: node scripts/parse-all-odt.js
 */

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

const ODT_DIR = path.join(__dirname, '../odt-sources');
const OUTPUT_FILE = path.join(__dirname, '../lib/dictees-data.ts');

/**
 * Extrait les cellules d'un tableau XML ODT
 */
function extractTableCells(xml) {
  const cells = [];
  const cellPattern = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g;

  let match;
  while ((match = cellPattern.exec(xml)) !== null) {
    const cellContent = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    cells.push(cellContent);
  }

  return cells;
}

/**
 * Extrait le texte brut d'un contenu XML ODT
 */
function extractTextFromXml(xml) {
  return xml
    .replace(/<text:p[^>]*>/g, '\n')
    .replace(/<text:span[^>]*>/g, '')
    .replace(/<text:tab[^>]*\/>/g, '\t')
    .replace(/<text:line-break[^>]*\/>/g, '\n')
    .replace(/<table:[^>]+>/g, '')
    .replace(/<\/table:[^>]+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

/**
 * Extrait les listes de mots depuis les cellules du tableau
 */
function extractWordListsFromCells(cells) {
  const list1 = [];
  const list2 = [];

  // Trouver où commencent les mots (après les en-têtes)
  // Formats: "n°1" / "n°2" ou "Liste X" / "Liste Y"
  let startIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const nextCell = cells[i + 1];

    // Format "n°1" / "n°2"
    if (cell === 'n°1' && nextCell === 'n°2') {
      startIndex = i + 2;
      break;
    }

    // Format "Liste X" / "Liste Y"
    if (cell.match(/^Liste\s*\d+$/i) && nextCell && nextCell.match(/^Liste\s*\d+$/i)) {
      startIndex = i + 2;
      break;
    }
  }

  if (startIndex === -1) return { list1, list2 };

  // Les mots sont en alternance : list1, list2, list1, list2...
  for (let i = startIndex; i < cells.length; i += 2) {
    const word1 = cells[i];
    const word2 = cells[i + 1];

    // Arrêter si on trouve un autre header (tableau dupliqué)
    if (word1 === 'n°1' || word1.match(/^Liste\s*\d+$/i)) break;
    if (word2 === 'n°1' || (word2 && word2.match(/^Liste\s*\d+$/i))) break;

    if (word1 && word1.length > 1 && !word1.match(/^(n°|Liste)/i)) {
      list1.push(word1);
    }
    if (word2 && word2.length > 1 && !word2.match(/^(n°|Liste)/i)) {
      list2.push(word2);
    }
  }

  return {
    list1: [...new Set(list1)].slice(0, 20),
    list2: [...new Set(list2)].slice(0, 20),
  };
}

/**
 * Extrait les textes de dictée
 */
function extractDicteeTexts(text) {
  const texts = [];

  // Pattern pour les textes de dictée (entre "Dictée préparée n°X :" et un mot-clé de fin)
  const lines = text.split('\n').filter(l => l.trim());

  let inDictee = false;
  let currentNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Détecter le début d'une dictée préparée
    const dicteeMatch = line.match(/Dict[ée]e\s+pr[ée]par[ée]e\s+n°\s*(\d+)/i);
    if (dicteeMatch) {
      currentNum = parseInt(dicteeMatch[1]);
      inDictee = true;
      continue;
    }

    // Si on est dans une section dictée, chercher le texte
    if (inDictee) {
      // Ignorer les titres et lignes courtes
      if (line.length > 40 && !line.includes('…') && !line.includes('_____') && !line.includes('/')) {
        // Vérifier que ce n'est pas juste un titre répété
        if (!line.match(/^(Le|La|Les|Un|Une)\s+\S+$/)) {
          texts.push({ num: currentNum, text: line });
          inDictee = false;
        }
      }

      // Arrêter si on trouve "Mot à expliquer" ou une autre dictée
      if (line.match(/Mot\s+[àa]\s+expliquer/i) || line.match(/Dict[ée]e\s+pr[ée]par[ée]e/i)) {
        inDictee = false;
      }
    }
  }

  return texts;
}

/**
 * Extrait les textes à trous
 */
function extractFillBlanksTexts(text) {
  const texts = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Un texte à trous contient des séries de points (…)
    if (trimmed.match(/…{2,}/) && trimmed.length > 40 && !trimmed.includes('/')) {
      const normalized = trimmed.replace(/…+/g, '_____');
      texts.push(normalized);
    }
  }

  return texts;
}

/**
 * Génère des erreurs orthographiques pour un mot
 */
function generateSpellingErrors(word) {
  const errors = [];
  const w = word.toLowerCase();

  // Substitutions phonétiques courantes
  const subs = {
    'ai': ['é', 'è'], 'é': ['ai', 'er', 'ez'], 'è': ['ai', 'e'],
    'au': ['o', 'eau'], 'eau': ['au', 'o'], 'an': ['en', 'am'], 'en': ['an'],
    'in': ['ain', 'ein'], 'ain': ['in'], 'on': ['om'], 'ph': ['f'], 'f': ['ph'],
    'qu': ['k', 'c'], 'tion': ['sion'], 'sion': ['tion'],
    'mm': ['m'], 'nn': ['n'], 'tt': ['t'], 'ss': ['s'], 'll': ['l'],
    'oi': ['oua'], 'ou': ['oo'],
  };

  for (const [pattern, replacements] of Object.entries(subs)) {
    if (w.includes(pattern)) {
      for (const r of replacements) {
        const err = w.replace(pattern, r);
        if (err !== w && !errors.includes(err)) {
          errors.push(err);
        }
      }
    }
  }

  // Oubli de lettre finale muette
  if (w.match(/[stxz]$/)) {
    errors.push(w.slice(0, -1));
  }

  // Oubli d'accent
  const noAccent = w.replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a').replace(/[îï]/g, 'i');
  if (noAccent !== w && !errors.includes(noAccent)) {
    errors.push(noAccent);
  }

  return errors.slice(0, 4);
}

/**
 * Génère un code de partage unique
 */
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Parse un fichier ODT
 */
async function parseODTFile(filePath) {
  const filename = path.basename(filePath);
  const file = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(file);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new Error(`Fichier ODT invalide: ${filename}`);
  }

  // Extraire les cellules du tableau
  const cells = extractTableCells(contentXml);
  const wordLists = extractWordListsFromCells(cells);

  // Extraire le texte brut pour les dictées
  const text = extractTextFromXml(contentXml);
  const dicteeTexts = extractDicteeTexts(text);
  const fillBlanksTexts = extractFillBlanksTexts(text);

  // Extraire les numéros de dictée du nom de fichier
  const match = filename.match(/(\d+)\s*et\s*(\d+)/i);
  const num1 = match ? parseInt(match[1]) : 1;
  const num2 = match ? parseInt(match[2]) : 2;

  const dictees = [];

  // Dictée 1
  if (wordLists.list1.length > 0) {
    const dicteeText1 = dicteeTexts.find(d => d.num === num1)?.text || '';
    dictees.push({
      id: `dictee-${num1}`,
      title: `Dictée n°${num1}`,
      shareCode: generateShareCode(),
      words: wordLists.list1.map((word, i) => ({
        word,
        definition: '',
        spellingErrors: generateSpellingErrors(word),
        position: i,
      })),
      dictationText: dicteeText1,
      fillBlanksText: fillBlanksTexts[0] || '',
    });
  }

  // Dictée 2
  if (wordLists.list2.length > 0) {
    const dicteeText2 = dicteeTexts.find(d => d.num === num2)?.text || '';
    dictees.push({
      id: `dictee-${num2}`,
      title: `Dictée n°${num2}`,
      shareCode: generateShareCode(),
      words: wordLists.list2.map((word, i) => ({
        word,
        definition: '',
        spellingErrors: generateSpellingErrors(word),
        position: i,
      })),
      dictationText: dicteeText2,
      fillBlanksText: fillBlanksTexts[1] || '',
    });
  }

  return dictees;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('Parsing des fichiers ODT...\n');

  const files = fs.readdirSync(ODT_DIR).filter(f => f.endsWith('.odt'));
  const allDictees = [];

  for (const filename of files) {
    const filePath = path.join(ODT_DIR, filename);
    console.log(`  Parsing: ${filename}`);

    try {
      const dictees = await parseODTFile(filePath);
      allDictees.push(...dictees);
      console.log(`    -> ${dictees.length} dictée(s), ${dictees.reduce((a, d) => a + d.words.length, 0)} mots`);
    } catch (error) {
      console.error(`    -> Erreur: ${error.message}`);
    }
  }

  // Trier par numéro
  allDictees.sort((a, b) => {
    const numA = parseInt(a.title.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.title.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  // Générer le fichier TypeScript
  const output = `// Fichier généré automatiquement - NE PAS MODIFIER
// Généré le ${new Date().toISOString()}

export interface DicteeWord {
  word: string;
  definition: string;
  spellingErrors: string[];
  position: number;
}

export interface DicteeData {
  id: string;
  title: string;
  shareCode: string;
  words: DicteeWord[];
  dictationText: string;
  fillBlanksText: string;
}

export const DICTEES_DATA: DicteeData[] = ${JSON.stringify(allDictees, null, 2)};

// Map pour accès rapide par code
export const DICTEES_BY_CODE: Map<string, DicteeData> = new Map(
  DICTEES_DATA.map(d => [d.shareCode, d])
);

// Fonction pour trouver une dictée par code
export function getDicteeByCode(code: string): DicteeData | undefined {
  return DICTEES_BY_CODE.get(code.toUpperCase());
}

// Fonction pour obtenir toutes les dictées
export function getAllDictees(): DicteeData[] {
  return DICTEES_DATA;
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\n✓ ${allDictees.length} dictées générées`);
  console.log(`✓ Total: ${allDictees.reduce((a, d) => a + d.words.length, 0)} mots`);
  console.log(`✓ Fichier créé: ${OUTPUT_FILE}`);

  // Afficher un résumé
  console.log('\nRésumé des dictées:');
  for (const d of allDictees) {
    console.log(`  ${d.title}: ${d.words.length} mots (code: ${d.shareCode})`);
  }
}

main().catch(console.error);
