/**
 * Service pour la génération de contenu IA via DeepSeek API
 * Utilisé uniquement côté serveur/enseignant
 */

import type { GeneratedWordData } from '@/types/database';
import { generateSpellingErrors } from './spelling-errors';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Génère une définition pour un mot via DeepSeek API
 */
export async function generateDefinition(
  word: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `Tu es un assistant pédagogique pour des élèves de 6ème (11-12 ans).
Tu dois donner des définitions simples, claires et adaptées à leur niveau.
Tes définitions doivent faire entre 10 et 15 mots maximum.
N'utilise pas de mots trop compliqués.
Réponds UNIQUEMENT avec la définition, sans phrase d'introduction.`;

  const userPrompt = `Donne une définition simple du mot "${word}" pour un élève de 6ème.`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] as DeepSeekMessage[],
      temperature: 0.7,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data: DeepSeekResponse = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Génère une phrase d'exemple pour un mot
 */
export async function generateExampleSentence(
  word: string,
  apiKey: string
): Promise<string> {
  const systemPrompt = `Tu es un assistant pédagogique pour des élèves de 6ème (11-12 ans).
Tu dois créer des phrases d'exemple simples utilisant un mot donné.
La phrase doit faire entre 8 et 15 mots.
Utilise des contextes familiers aux élèves (école, famille, loisirs, nature).
Réponds UNIQUEMENT avec la phrase, sans rien d'autre.`;

  const userPrompt = `Écris une phrase simple utilisant le mot "${word}".`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ] as DeepSeekMessage[],
      temperature: 0.8,
      max_tokens: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status}`);
  }

  const data: DeepSeekResponse = await response.json();
  return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Génère toutes les données pour un mot (définition + erreurs + exemple)
 */
export async function generateWordData(
  word: string,
  apiKey: string,
  includeExample: boolean = false
): Promise<GeneratedWordData> {
  // Génération de la définition via IA
  const definition = await generateDefinition(word, apiKey);

  // Génération des erreurs orthographiques (algorithme local)
  const spelling_errors = generateSpellingErrors(word, 4);

  // Génération de la phrase d'exemple (optionnel)
  let example_sentence: string | undefined;
  if (includeExample) {
    example_sentence = await generateExampleSentence(word, apiKey);
  }

  return {
    definition,
    spelling_errors,
    example_sentence,
  };
}

/**
 * Génère les données pour une liste de mots avec délai pour éviter rate limiting
 */
export async function generateWordsData(
  words: string[],
  apiKey: string,
  includeExamples: boolean = false,
  onProgress?: (current: number, total: number, word: string) => void
): Promise<Map<string, GeneratedWordData>> {
  const results = new Map<string, GeneratedWordData>();

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    try {
      const data = await generateWordData(word, apiKey, includeExamples);
      results.set(word, data);

      if (onProgress) {
        onProgress(i + 1, words.length, word);
      }

      // Délai de 500ms entre chaque requête pour éviter le rate limiting
      if (i < words.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Erreur pour le mot "${word}":`, error);
      // En cas d'erreur, générer au moins les erreurs orthographiques
      results.set(word, {
        definition: '',
        spelling_errors: generateSpellingErrors(word, 4),
      });
    }
  }

  return results;
}
