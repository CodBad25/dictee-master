/**
 * Script corrigé pour extraire les VRAIES données des fichiers ODT
 * - Extrait les listes de mots depuis les tableaux
 * - Extrait les VRAIS textes de dictée (pas générés)
 * - Extrait les VRAIS textes à trous (pas générés)
 */

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

// Importer les définitions complètes (514 définitions)
const { DEFINITIONS } = require('./definitions-complete');

const ODT_DIR = path.join(__dirname, '../odt-sources');
const OUTPUT_FILE = path.join(__dirname, '../lib/dictees-data.ts');

/**
 * Génère des erreurs orthographiques réalistes
 */
function generateSpellingErrors(word) {
  const errors = new Set();
  // Nettoyer le mot (enlever les parenthèses de variantes)
  const w = word.replace(/\([^)]*\)/g, '').trim().toLowerCase();

  // Substitutions phonétiques courantes
  const subs = [
    ['é', ['ai', 'er', 'ez', 'è']],
    ['è', ['ai', 'e', 'ê']],
    ['ai', ['é', 'è']],
    ['eau', ['au', 'o']],
    ['au', ['eau', 'o']],
    ['an', ['en', 'am']],
    ['en', ['an', 'em']],
    ['in', ['ain', 'ein']],
    ['ain', ['in', 'ein']],
    ['on', ['om']],
    ['ph', ['f']],
    ['f', ['ph']],
    ['qu', ['k', 'c']],
    ['tion', ['sion']],
    ['sion', ['tion']],
    ['mm', ['m']],
    ['nn', ['n']],
    ['tt', ['t']],
    ['ss', ['s']],
    ['ll', ['l']],
  ];

  for (const [pattern, replacements] of subs) {
    if (w.includes(pattern)) {
      for (const r of replacements) {
        const err = w.replace(pattern, r);
        if (err !== w) errors.add(err);
      }
    }
  }

  // Oubli de lettre finale muette
  if (w.match(/[stdxz]$/)) {
    errors.add(w.slice(0, -1));
  }

  // Ajout de 'e' final erroné
  if (!w.endsWith('e') && w.match(/[bcdfghjklmnpqrstvwxz]$/)) {
    errors.add(w + 'e');
  }

  // Oubli d'accent
  const noAccent = w
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c');
  if (noAccent !== w) errors.add(noAccent);

  return Array.from(errors).filter(e => e !== w && e.length > 1).slice(0, 4);
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
 * Normalise les apostrophes et caractères spéciaux
 */
function normalizeWord(word) {
  return word
    .replace(/[\u2019\u0027\u02bc\u2018\u201b\u0060\u00b4]/g, "'")  // Toutes les apostrophes -> '
    .replace(/[\u0153]/g, "oe")     // œ -> oe
    .replace(/[\u00e6]/g, "ae")     // æ -> ae
    .toLowerCase()
    .trim();
}

/**
 * Trouve la définition d'un mot
 */
function findDefinition(word) {
  // Essayer le mot exact
  if (DEFINITIONS[word]) return DEFINITIONS[word];
  if (DEFINITIONS[word.toLowerCase()]) return DEFINITIONS[word.toLowerCase()];

  // Essayer sans les variantes entre parenthèses
  const cleanWord = word.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (DEFINITIONS[cleanWord]) return DEFINITIONS[cleanWord];
  if (DEFINITIONS[cleanWord.toLowerCase()]) return DEFINITIONS[cleanWord.toLowerCase()];

  // Essayer avec normalisation des apostrophes
  const normalizedWord = normalizeWord(word);
  const normalizedClean = normalizeWord(cleanWord);

  // Chercher dans toutes les clés en les normalisant aussi
  for (const key of Object.keys(DEFINITIONS)) {
    const normalizedKey = normalizeWord(key);
    if (normalizedKey === normalizedWord || normalizedKey === normalizedClean) {
      return DEFINITIONS[key];
    }
  }

  // Essayer avec différents articles
  const withoutArticle = word.replace(/^(le|la|l'|l'|les|un|une|des|du)\s*/i, '').trim();
  const normalizedWithout = normalizeWord(withoutArticle);

  for (const prefix of ['le ', 'la ', "l'", 'un ', 'une ']) {
    const test = prefix + withoutArticle;
    if (DEFINITIONS[test]) return DEFINITIONS[test];

    // Chercher avec normalisation
    for (const key of Object.keys(DEFINITIONS)) {
      if (normalizeWord(key) === normalizeWord(test)) {
        return DEFINITIONS[key];
      }
    }
  }

  return "Mot de vocabulaire à apprendre";
}

/**
 * Extrait le texte brut d'un XML ODT
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
 * Extrait les cellules d'un tableau ODT
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
 * Extrait les listes de mots depuis les cellules du tableau
 */
function extractWordLists(cells) {
  const list1 = [];
  const list2 = [];

  let startIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const nextCell = cells[i + 1];

    // Formats d'en-tête : "n°1" / "n°2" ou "Liste X" / "Liste Y"
    if ((cell === 'n°1' && nextCell === 'n°2') ||
        (cell.match(/^Liste\s*\d+$/i) && nextCell && nextCell.match(/^Liste\s*\d+$/i))) {
      startIndex = i + 2;
      break;
    }
  }

  if (startIndex === -1) return { list1, list2 };

  // Les mots alternent : list1, list2, list1, list2...
  for (let i = startIndex; i < cells.length; i += 2) {
    const word1 = cells[i];
    const word2 = cells[i + 1];

    if (word1 === 'n°1' || (word1 && word1.match(/^Liste\s*\d+$/i))) break;
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
 * Extrait les textes de dictée et textes à trous
 */
function extractDicteeContent(text, dicteeNum) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let dictationText = '';
  let fillBlanksText = '';
  let wordToExplain = '';

  // Patterns pour trouver la section dictée (plusieurs formats)
  // "Dictée n°3", "Dictée préparée n°3", "Dictée aménagée n°3"
  const dicteePatterns = [
    new RegExp(`Dict[ée]e\\s+pr[ée]par[ée]e\\s+n°\\s*${dicteeNum}\\s*:?`, 'i'),
    new RegExp(`Dict[ée]e\\s+am[ée]nag[ée]e\\s+n°\\s*${dicteeNum}\\s*:?`, 'i'),
    new RegExp(`Dict[ée]e\\s+n°\\s*${dicteeNum}\\s*:?`, 'i'),
  ];

  let inDicteeSection = false;
  let foundText = false;
  let foundBlanks = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Début de section dictée
    const matchesDictee = dicteePatterns.some(p => line.match(p));
    if (matchesDictee) {
      inDicteeSection = true;
      foundText = false;
      foundBlanks = false;
      continue;
    }

    // Sortir si on trouve une autre dictée (avec un numéro différent)
    if (inDicteeSection) {
      const otherDicteeMatch = line.match(/Dict[ée]e\s+(?:pr[ée]par[ée]e\s+)?(?:am[ée]nag[ée]e\s+)?n°\s*(\d+)/i);
      if (otherDicteeMatch && parseInt(otherDicteeMatch[1]) !== dicteeNum) {
        break;
      }
    }

    if (!inDicteeSection) continue;

    // Mot à expliquer
    if (line.match(/Mot\s+[àa]\s+expliquer/i)) {
      const parts = line.split(':');
      if (parts.length > 1) {
        wordToExplain = parts[1].trim();
      }
      continue;
    }

    // Ignorer les lignes "Surligne la bonne orthographe" ou avec des choix "/"
    if (line.match(/Surligne/i)) {
      continue;
    }

    // Ligne avec des choix orthographiques (contient "/")
    if ((line.match(/\//g) || []).length >= 2) {
      continue;
    }

    // Texte à trous (contient des "…" répétés ou "......." ou "___")
    // Doit contenir au moins 3 séquences de blancs pour être un vrai texte à trous
    const blanksCount = (line.match(/…{2,}|\.{4,}|_{3,}/g) || []).length;
    if (blanksCount >= 3 && line.length > 30) {
      if (!foundBlanks) {
        // Normaliser tous les types de blancs en _____
        fillBlanksText = line
          .replace(/…+/g, '_____')
          .replace(/\.{4,}/g, '_____')
          .replace(/_{3,}/g, '_____');
        foundBlanks = true;
      }
      continue;
    }

    // Texte de dictée complet (long, sans symboles spéciaux, pas de blancs)
    if (!foundText &&
        line.length > 40 &&
        !line.includes('_____') &&
        !line.includes('…') &&
        !line.includes('.......') &&
        !line.match(/\//)) {  // Pas de choix orthographiques
      dictationText = line;
      foundText = true;
    }
  }

  return { dictationText, fillBlanksText, wordToExplain };
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

  // Extraire les cellules du tableau pour les mots
  const cells = extractTableCells(contentXml);
  const wordLists = extractWordLists(cells);

  // Extraire le texte brut pour les dictées
  const text = extractTextFromXml(contentXml);

  // Extraire les numéros de dictée du nom de fichier
  const match = filename.match(/(\d+)\s*et\s*(\d+)/i);
  const num1 = match ? parseInt(match[1]) : 1;
  const num2 = match ? parseInt(match[2]) : 2;

  const dictees = [];

  // Dictée 1
  if (wordLists.list1.length > 0) {
    const content1 = extractDicteeContent(text, num1);
    dictees.push({
      id: `dictee-${num1}`,
      title: `Dictée n°${num1}`,
      shareCode: generateShareCode(),
      words: wordLists.list1.map((word, i) => ({
        word,
        definition: findDefinition(word),
        spellingErrors: generateSpellingErrors(word),
        position: i,
      })),
      dictationText: content1.dictationText,
      fillBlanksText: content1.fillBlanksText,
      wordToExplain: content1.wordToExplain,
    });
  }

  // Dictée 2
  if (wordLists.list2.length > 0) {
    const content2 = extractDicteeContent(text, num2);
    dictees.push({
      id: `dictee-${num2}`,
      title: `Dictée n°${num2}`,
      shareCode: generateShareCode(),
      words: wordLists.list2.map((word, i) => ({
        word,
        definition: findDefinition(word),
        spellingErrors: generateSpellingErrors(word),
        position: i,
      })),
      dictationText: content2.dictationText,
      fillBlanksText: content2.fillBlanksText,
      wordToExplain: content2.wordToExplain,
    });
  }

  return dictees;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('Extraction des données ODT...\n');

  const files = fs.readdirSync(ODT_DIR).filter(f => f.endsWith('.odt'));
  const allDictees = [];

  for (const filename of files) {
    const filePath = path.join(ODT_DIR, filename);
    console.log(`  Parsing: ${filename}`);

    try {
      const dictees = await parseODTFile(filePath);
      for (const d of dictees) {
        console.log(`    -> ${d.title}: ${d.words.length} mots`);
        if (d.dictationText) {
          console.log(`       Texte: "${d.dictationText.substring(0, 50)}..."`);
        } else {
          console.log(`       ⚠ Pas de texte de dictée trouvé`);
        }
        if (d.fillBlanksText) {
          console.log(`       Trous: "${d.fillBlanksText.substring(0, 50)}..."`);
        } else {
          console.log(`       ⚠ Pas de texte à trous trouvé`);
        }
      }
      allDictees.push(...dictees);
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

  // Compter les stats
  const withText = allDictees.filter(d => d.dictationText).length;
  const withBlanks = allDictees.filter(d => d.fillBlanksText).length;
  const totalWords = allDictees.reduce((a, d) => a + d.words.length, 0);
  const totalDefs = allDictees.reduce((a, d) => a + d.words.filter(w => w.definition !== "Mot de vocabulaire à apprendre").length, 0);

  // Générer le fichier TypeScript
  const output = `// Fichier généré automatiquement - NE PAS MODIFIER
// Généré le ${new Date().toISOString()}
// ${allDictees.length} dictées, ${totalWords} mots, ${totalDefs} définitions
// ${withText} avec texte de dictée, ${withBlanks} avec texte à trous

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
  wordToExplain?: string;
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

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✓ ${allDictees.length} dictées générées`);
  console.log(`✓ ${totalWords} mots au total`);
  console.log(`✓ ${totalDefs} définitions trouvées`);
  console.log(`✓ ${withText}/${allDictees.length} avec texte de dictée`);
  console.log(`✓ ${withBlanks}/${allDictees.length} avec texte à trous`);
  console.log(`✓ Fichier créé: ${OUTPUT_FILE}`);
}

main().catch(console.error);
