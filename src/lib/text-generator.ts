/**
 * Generateur de textes pour les dictees
 * Genere des textes coherents avec les mots de la liste
 * Gere les accords (masculin/feminin, singulier/pluriel)
 */

import { generateWordVariants } from './spelling-errors';

/**
 * Interface pour un texte genere avec ses trous
 */
export interface GeneratedText {
  fullText: string;           // Texte complet pour la dictee audio
  displayText: string;        // Texte avec les trous (_____) pour l'affichage
  blanks: {
    word: string;             // Le mot a deviner (forme utilisee dans le texte)
    originalWord: string;     // Le mot original de la liste
    position: number;         // Position du trou dans le texte
  }[];
}

// Templates de phrases avec contexte - utilisant {word} comme placeholder
// Les mots peuvent etre accordes selon le contexte
const SENTENCE_TEMPLATES = [
  // Narration simple
  "{word} etait vraiment important pour lui.",
  "Elle regardait {word} avec attention.",
  "Nous avons decouvert {word} ce matin.",
  "Il pensait souvent a {word}.",
  "{word} brillait sous le soleil.",

  // Descriptions
  "{word} semblait mysterieux.",
  "C'etait {word} magnifique.",
  "{word} paraissait immense.",

  // Actions
  "Il a trouve {word} dans le jardin.",
  "Elle a observe {word} pendant longtemps.",
  "Nous avons apercu {word} au loin.",
  "Papa a repare {word} hier.",
  "Maman a achete {word} au marche.",

  // Contexte scolaire
  "A l'ecole, nous avons etudie {word}.",
  "La maitresse a explique {word}.",
  "Les eleves ont appris {word}.",

  // Contexte quotidien
  "Dans la maison, il y avait {word}.",
  "Sur la table, on voyait {word}.",
  "Pres de la fenetre, {word} attendait.",
];

// Templates pour 2 mots
const DOUBLE_TEMPLATES = [
  "{word1} et {word2} etaient ensemble.",
  "Entre {word1} et {word2}, il hesitait.",
  "Il a vu {word1} puis {word2}.",
  "{word1} ressemblait a {word2}.",
  "Avec {word1} et {word2}, tout etait possible.",
];

/**
 * Choisit une variante appropriee du mot selon le contexte
 */
function chooseWordVariant(word: string, context: 'masculine' | 'feminine' | 'plural' | 'random' = 'random'): string {
  const variants = generateWordVariants(word);

  if (variants.length === 1) return variants[0];

  switch (context) {
    case 'masculine':
      return variants[0]; // Premiere forme = masculine singulier
    case 'feminine':
      return variants.find(v => v.endsWith('e') || v.endsWith('ve') || v.endsWith('se')) || variants[0];
    case 'plural':
      return variants.find(v => v.endsWith('s') || v.endsWith('x')) || variants[0];
    default:
      return variants[Math.floor(Math.random() * variants.length)];
  }
}

/**
 * Genere un texte a trous a partir d'une liste de mots
 * Utilise des templates simples
 */
export function generateTextWithBlanks(words: string[]): GeneratedText {
  const sentences: string[] = [];
  const blanks: GeneratedText['blanks'] = [];
  let currentPosition = 0;

  // Melanger les mots
  const shuffledWords = [...words].sort(() => Math.random() - 0.5);

  // Limiter a 10 mots max pour ne pas avoir un texte trop long
  const wordsToUse = shuffledWords.slice(0, Math.min(10, shuffledWords.length));

  let i = 0;
  while (i < wordsToUse.length) {
    // 20% de chance d'utiliser un template double si possible
    if (i + 1 < wordsToUse.length && Math.random() < 0.2) {
      const template = DOUBLE_TEMPLATES[Math.floor(Math.random() * DOUBLE_TEMPLATES.length)];
      const originalWord1 = wordsToUse[i];
      const originalWord2 = wordsToUse[i + 1];
      const word1 = chooseWordVariant(originalWord1);
      const word2 = chooseWordVariant(originalWord2);

      const sentence = template
        .replace('{word1}', word1)
        .replace('{word2}', word2);

      sentences.push(sentence);

      // Calculer les positions
      const pos1 = currentPosition + sentence.indexOf(word1);
      const pos2 = currentPosition + sentence.lastIndexOf(word2);

      blanks.push({ word: word1, originalWord: originalWord1, position: pos1 });
      blanks.push({ word: word2, originalWord: originalWord2, position: pos2 });

      currentPosition += sentence.length + 1;
      i += 2;
    } else {
      const template = SENTENCE_TEMPLATES[Math.floor(Math.random() * SENTENCE_TEMPLATES.length)];
      const originalWord = wordsToUse[i];
      const word = chooseWordVariant(originalWord);

      const sentence = template.replace('{word}', word);
      sentences.push(sentence);

      const pos = currentPosition + sentence.indexOf(word);
      blanks.push({ word, originalWord: originalWord, position: pos });

      currentPosition += sentence.length + 1;
      i += 1;
    }
  }

  const fullText = sentences.join(' ');

  // Creer le texte avec les trous
  let displayText = fullText;
  const sortedBlanks = [...blanks].sort((a, b) => b.position - a.position);
  for (const blank of sortedBlanks) {
    const before = displayText.substring(0, blank.position);
    const after = displayText.substring(blank.position + blank.word.length);
    displayText = before + '_'.repeat(Math.max(5, blank.word.length)) + after;
  }

  return {
    fullText,
    displayText,
    blanks: blanks.sort((a, b) => a.position - b.position),
  };
}

/**
 * Genere un texte avec l'API DeepSeek
 */
export async function generateTextWithAI(
  words: string[],
  apiKey: string
): Promise<GeneratedText> {
  if (!apiKey) {
    return generateTextWithBlanks(words);
  }

  // Limiter le nombre de mots pour l'IA aussi
  const wordsToUse = words.slice(0, Math.min(10, words.length));

  // Preparer les mots avec leurs variantes
  const wordsWithVariants = wordsToUse.map(w => {
    const variants = generateWordVariants(w);
    return variants.length > 1 ? `${w} (peut devenir: ${variants.slice(1).join(', ')})` : w;
  });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Tu es un professeur de francais qui cree des textes de dictee pour des collegiens (11-15 ans).
Genere un court texte (4-6 phrases) qui utilise TOUS les mots fournis de maniere naturelle.
Le texte doit:
- Etre coherent et raconter une petite histoire
- Utiliser les mots dans leur forme appropriee (accorde si necessaire)
- Etre simple mais pas enfantin
- Ne pas repeter les mots`,
          },
          {
            role: 'user',
            content: `Cree un texte utilisant ces mots: ${wordsWithVariants.join(', ')}`,
          },
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error('API Error:', await response.text());
      return generateTextWithBlanks(words);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content || '';

    if (!generatedText) {
      return generateTextWithBlanks(words);
    }

    // Trouver les mots dans le texte genere
    const blanks: GeneratedText['blanks'] = [];
    let displayText = generatedText;

    for (const originalWord of wordsToUse) {
      const variants = generateWordVariants(originalWord);

      // Chercher chaque variante dans le texte
      for (const variant of variants) {
        const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'gi');
        const match = regex.exec(generatedText);
        if (match) {
          blanks.push({
            word: match[0],
            originalWord,
            position: match.index
          });
          displayText = displayText.replace(
            new RegExp(`\\b${escapeRegex(match[0])}\\b`, 'i'),
            '_'.repeat(Math.max(5, match[0].length))
          );
          break; // Une seule occurrence par mot
        }
      }
    }

    return {
      fullText: generatedText,
      displayText,
      blanks: blanks.sort((a, b) => a.position - b.position),
    };
  } catch (error) {
    console.error('Error generating text with AI:', error);
    return generateTextWithBlanks(words);
  }
}

/**
 * Echappe les caracteres speciaux pour regex
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
