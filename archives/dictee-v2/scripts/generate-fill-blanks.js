/**
 * Script pour générer les textes à trous manquants
 * Remplace les mots de vocabulaire par _____ dans les textes de dictée
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../lib/dictees-data.ts');

// Lire les données actuelles
const content = fs.readFileSync(DATA_FILE, 'utf-8');
const match = content.match(/DICTEES_DATA[^=]*=\s*(\[[\s\S]*?\n\]);/);

if (!match) {
  console.error('Impossible de parser le fichier de données');
  process.exit(1);
}

const data = eval(match[1]);

/**
 * Normalise un mot pour la comparaison
 */
function normalizeForMatch(word) {
  return word
    .replace(/[\u2019\u0027\u02bc\u2018\u201b\u0060\u00b4]/g, "'")
    .replace(/\s*\([^)]*\)\s*/g, '')  // Enlever les variantes (e), (ve), etc.
    .replace(/^(le|la|l'|les|un|une|des|du)\s*/i, '')  // Enlever les articles
    .toLowerCase()
    .trim();
}

/**
 * Crée une regex pour trouver un mot dans un texte
 */
function createWordRegex(word) {
  const normalized = normalizeForMatch(word);
  // Échapper les caractères spéciaux de regex
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Permettre différentes formes (avec/sans accent, pluriel, etc.)
  return new RegExp(`\\b${escaped}s?\\b`, 'gi');
}

/**
 * Génère toutes les formes possibles d'un mot (pluriel, féminin, conjugaisons)
 */
function getWordForms(word) {
  const forms = new Set();
  const base = normalizeForMatch(word);

  forms.add(base);

  // Formes plurielles et féminines
  forms.add(base + 's');
  forms.add(base + 'e');
  forms.add(base + 'es');

  // Si le mot finit par -eux, ajouter -euse/-euses
  if (base.endsWith('eux')) {
    const stem = base.slice(0, -3);
    forms.add(stem + 'euse');
    forms.add(stem + 'euses');
  }

  // Si le mot finit par -if, ajouter -ive/-ives
  if (base.endsWith('if')) {
    const stem = base.slice(0, -2);
    forms.add(stem + 'ive');
    forms.add(stem + 'ives');
  }

  // Si le mot finit par -il, ajouter -ille/-illes
  if (base.endsWith('il')) {
    forms.add(base + 'le');
    forms.add(base + 'les');
  }

  // Si le mot finit par -t, ajouter -te/-tes
  if (base.endsWith('t')) {
    forms.add(base + 'e');
    forms.add(base + 'es');
  }

  return Array.from(forms);
}

/**
 * Génère un texte à trous à partir du texte de dictée
 */
function generateFillBlanks(dictationText, words) {
  if (!dictationText) return '';

  let result = dictationText;

  // Trier les mots par longueur décroissante pour éviter les remplacements partiels
  const sortedWords = [...words].sort((a, b) => b.word.length - a.word.length);

  for (const wordObj of sortedWords) {
    const word = wordObj.word;
    const forms = getWordForms(word);

    // Trier les formes par longueur décroissante
    forms.sort((a, b) => b.length - a.length);

    for (const form of forms) {
      // Échapper les caractères spéciaux
      const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Pattern pour le mot avec frontières de mot
      const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(pattern, '_____');
    }
  }

  return result;
}

// Traiter chaque dictée
let updated = 0;
for (const dictee of data) {
  if (!dictee.fillBlanksText && dictee.dictationText) {
    const fillBlanks = generateFillBlanks(dictee.dictationText, dictee.words);

    // Vérifier qu'on a bien des blancs
    const blanksCount = (fillBlanks.match(/_____/g) || []).length;

    if (blanksCount >= 3) {
      dictee.fillBlanksText = fillBlanks;
      console.log(`✓ ${dictee.title}: ${blanksCount} blancs générés`);
      updated++;
    } else {
      console.log(`⚠ ${dictee.title}: seulement ${blanksCount} blancs trouvés`);
    }
  }
}

// Générer le nouveau fichier TypeScript
const withText = data.filter(d => d.dictationText).length;
const withBlanks = data.filter(d => d.fillBlanksText).length;
const totalWords = data.reduce((a, d) => a + d.words.length, 0);
const totalDefs = data.reduce((a, d) => a + d.words.filter(w => w.definition !== "Mot de vocabulaire à apprendre").length, 0);

const output = `// Fichier généré automatiquement - NE PAS MODIFIER
// Généré le ${new Date().toISOString()}
// ${data.length} dictées, ${totalWords} mots, ${totalDefs} définitions
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

export const DICTEES_DATA: DicteeData[] = ${JSON.stringify(data, null, 2)};

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

fs.writeFileSync(DATA_FILE, output);

console.log(`\n${'='.repeat(50)}`);
console.log(`✓ ${updated} textes à trous générés`);
console.log(`✓ ${withBlanks}/${data.length} dictées avec texte à trous`);
console.log(`✓ Fichier mis à jour: ${DATA_FILE}`);
