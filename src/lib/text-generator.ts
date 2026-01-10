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

// Templates de récits cohérents pour dictées niveau 6ème
// Chaque template est une histoire complète avec des placeholders {word1}, {word2}, etc.
const STORY_TEMPLATES = [
  // Histoire d'aventure
  {
    intro: "Ce matin-là, Lucas découvrit {word1} dans le grenier de sa grand-mère.",
    middle: [
      "Il observa {word2} avec curiosité.",
      "Cela lui rappelait {word3} qu'il avait vu dans un livre.",
      "{word4} semblait venir d'une époque lointaine.",
    ],
    end: "Le garçon décida de garder ce trésor précieux."
  },
  // Histoire de nature
  {
    intro: "Pendant les vacances, Marie se promenait près de {word1}.",
    middle: [
      "Elle aperçut soudain {word2} entre les arbres.",
      "Plus loin, {word3} attirait son attention.",
      "La jeune fille photographia {word4} pour s'en souvenir.",
    ],
    end: "Cette journée resterait gravée dans sa mémoire."
  },
  // Histoire quotidienne
  {
    intro: "À la maison, toute la famille préparait {word1} pour la fête.",
    middle: [
      "Papa s'occupait de {word2} dans le salon.",
      "Maman avait installé {word3} sur la grande table.",
      "Les enfants admiraient {word4} avec émerveillement.",
    ],
    end: "La soirée promettait d'être inoubliable."
  },
  // Histoire d'école
  {
    intro: "Au collège, le professeur présenta {word1} à toute la classe.",
    middle: [
      "Les élèves découvrirent {word2} pour la première fois.",
      "Certains comparaient cela à {word3} qu'ils connaissaient déjà.",
      "{word4} suscitait beaucoup de questions.",
    ],
    end: "Ce cours passionnant se termina trop vite."
  },
];

// Templates simples pour compléter si besoin
const FILLER_TEMPLATES = [
  "On pouvait également observer {word}.",
  "{word} complétait parfaitement le tableau.",
  "Sans oublier {word} qui jouait un rôle important.",
  "Il y avait aussi {word} non loin de là.",
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
 * Utilise des templates de récits cohérents niveau 6ème
 */
export function generateTextWithBlanks(words: string[]): GeneratedText {
  const blanks: GeneratedText['blanks'] = [];

  // Melanger les mots
  const shuffledWords = [...words].sort(() => Math.random() - 0.5);

  // Limiter a 10 mots max pour ne pas avoir un texte trop long
  const wordsToUse = shuffledWords.slice(0, Math.min(10, shuffledWords.length));

  // Choisir un template d'histoire au hasard
  const storyTemplate = STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];

  // Construire le texte
  const sentences: string[] = [];
  let wordIndex = 0;

  // Phrase d'introduction avec le premier mot
  if (wordIndex < wordsToUse.length) {
    const originalWord = wordsToUse[wordIndex];
    const word = chooseWordVariant(originalWord);
    sentences.push(storyTemplate.intro.replace('{word1}', word));
    wordIndex++;
  }

  // Phrases du milieu avec les mots suivants
  for (const middleTemplate of storyTemplate.middle) {
    if (wordIndex < wordsToUse.length) {
      const originalWord = wordsToUse[wordIndex];
      const word = chooseWordVariant(originalWord);
      const placeholder = `{word${wordIndex + 1}}`;
      sentences.push(middleTemplate.replace(placeholder, word));
      wordIndex++;
    }
  }

  // Si on a encore des mots, utiliser les templates de remplissage
  while (wordIndex < wordsToUse.length) {
    const originalWord = wordsToUse[wordIndex];
    const word = chooseWordVariant(originalWord);
    const fillerTemplate = FILLER_TEMPLATES[wordIndex % FILLER_TEMPLATES.length];
    sentences.push(fillerTemplate.replace('{word}', word));
    wordIndex++;
  }

  // Phrase de fin
  sentences.push(storyTemplate.end);

  const fullText = sentences.join(' ');

  // Trouver les positions des mots dans le texte final
  let searchStart = 0;
  for (let i = 0; i < wordsToUse.length; i++) {
    const originalWord = wordsToUse[i];
    const word = chooseWordVariant(originalWord);

    // Chercher le mot dans le texte à partir de la dernière position trouvée
    const pos = fullText.indexOf(word, searchStart);
    if (pos !== -1) {
      blanks.push({ word, originalWord, position: pos });
      searchStart = pos + word.length;
    }
  }

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
            content: `Tu es un professeur de français en classe de 6ème (collège français, élèves de 11-12 ans).

Tu dois créer un texte de dictée d'ENTRAÎNEMENT. Ce texte servira aux élèves pour s'exercer sur des mots de vocabulaire avant une vraie dictée en classe.

CONSIGNES STRICTES :
1. Écris un texte NARRATIF cohérent de 4 à 6 phrases qui raconte une petite histoire ou décrit une scène
2. Utilise TOUS les mots fournis de manière NATURELLE (pas forcée)
3. Accorde les mots correctement selon le contexte (masculin/féminin, singulier/pluriel)
4. Style adapté au niveau 6ème : phrases claires, vocabulaire accessible, mais pas enfantin
5. Le texte doit pouvoir être dicté à voix haute (phrases bien ponctuées)
6. N'utilise chaque mot qu'UNE SEULE fois
7. Évite les phrases trop courtes ou les énumérations

EXEMPLE de bon texte de dictée niveau 6ème :
"Ce matin-là, le héros de notre histoire traversait la jungle amazonienne. Il cherchait un trésor caché depuis des siècles. Son canif à la main, il écartait les branches qui lui barraient le passage. Soudain, il aperçut une statue imposante au milieu d'une clairière. Son cœur battait fort car il savait que son but était proche."

Réponds UNIQUEMENT avec le texte de la dictée, sans commentaire ni explication.`,
          },
          {
            role: 'user',
            content: `Crée un texte de dictée utilisant ces mots de vocabulaire : ${wordsWithVariants.join(', ')}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.8,
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
