/**
 * Générateur de textes à trous pour les dictées
 * Utilise des templates simples ou une API IA
 */

// Templates de phrases avec placeholder {word}
const SENTENCE_TEMPLATES = [
  // Phrases simples
  "Le {word} est très important.",
  "J'ai vu un {word} dans le jardin.",
  "Ma mère a acheté un {word}.",
  "Le {word} se trouve sur la table.",
  "Nous avons trouvé un {word} magnifique.",
  "Il y a un {word} près de la maison.",
  "Le petit {word} joue dehors.",
  "Elle a dessiné un joli {word}.",
  "Le {word} brille au soleil.",
  "Nous aimons beaucoup le {word}.",

  // Phrases avec contexte
  "Dans la forêt, on peut voir un {word}.",
  "À l'école, nous avons appris le mot {word}.",
  "Pendant les vacances, j'ai découvert un {word}.",
  "Mon ami préfère le {word} bleu.",
  "La maîtresse a expliqué ce qu'est un {word}.",
  "Sur le chemin, nous avons rencontré un {word}.",
  "Dans mon livre, il y a un {word} intéressant.",
  "Le week-end dernier, j'ai observé un {word}.",

  // Phrases descriptives
  "Ce {word} est vraiment extraordinaire.",
  "Un {word} peut être grand ou petit.",
  "Le {word} de mon frère est cassé.",
  "Chaque {word} a sa propre histoire.",
  "Ce beau {word} appartient à ma sœur.",
  "Le vieux {word} était abandonné.",
  "Un nouveau {word} est arrivé ce matin.",
];

// Templates pour 2 mots dans la même phrase
const DOUBLE_TEMPLATES = [
  "Le {word1} et le {word2} sont dans la classe.",
  "J'ai vu un {word1} près du {word2}.",
  "Le {word1} regarde le {word2} avec attention.",
  "Entre le {word1} et le {word2}, je préfère le premier.",
  "Un {word1} et un {word2} jouent ensemble.",
  "Le {word1} est plus grand que le {word2}.",
];

/**
 * Interface pour un texte généré avec ses trous
 */
export interface GeneratedText {
  fullText: string;           // Texte complet pour la dictée audio
  displayText: string;        // Texte avec les trous (_____) pour l'affichage
  blanks: {
    word: string;             // Le mot à deviner
    position: number;         // Position du trou dans le texte
  }[];
}

/**
 * Génère un texte à trous à partir d'une liste de mots
 * Utilise des templates simples
 */
export function generateTextWithBlanks(words: string[]): GeneratedText {
  const sentences: string[] = [];
  const blanks: GeneratedText['blanks'] = [];
  let currentPosition = 0;

  // Mélanger les mots
  const shuffledWords = [...words].sort(() => Math.random() - 0.5);

  // Grouper les mots par 1 ou 2
  let i = 0;
  while (i < shuffledWords.length) {
    // 30% de chance d'utiliser un template double si possible
    if (i + 1 < shuffledWords.length && Math.random() < 0.3) {
      const template = DOUBLE_TEMPLATES[Math.floor(Math.random() * DOUBLE_TEMPLATES.length)];
      const word1 = shuffledWords[i];
      const word2 = shuffledWords[i + 1];

      const sentence = template
        .replace('{word1}', word1)
        .replace('{word2}', word2);

      sentences.push(sentence);

      // Calculer les positions
      const pos1 = currentPosition + sentence.indexOf(word1);
      const pos2 = currentPosition + sentence.indexOf(word2);

      blanks.push({ word: word1, position: pos1 });
      blanks.push({ word: word2, position: pos2 });

      currentPosition += sentence.length + 1; // +1 pour l'espace
      i += 2;
    } else {
      const template = SENTENCE_TEMPLATES[Math.floor(Math.random() * SENTENCE_TEMPLATES.length)];
      const word = shuffledWords[i];

      const sentence = template.replace('{word}', word);
      sentences.push(sentence);

      const pos = currentPosition + sentence.indexOf(word);
      blanks.push({ word, position: pos });

      currentPosition += sentence.length + 1;
      i += 1;
    }
  }

  const fullText = sentences.join(' ');

  // Créer le texte avec les trous
  let displayText = fullText;
  // Remplacer les mots par des trous (du dernier au premier pour ne pas décaler les positions)
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
 * Génère un texte avec une API IA (pour utilisation future)
 */
export async function generateTextWithAI(
  words: string[],
  apiKey: string,
  apiType: 'openai' | 'claude' | 'mistral' = 'openai'
): Promise<GeneratedText> {
  // Pour l'instant, fallback sur les templates
  // TODO: Implémenter les appels API

  if (!apiKey) {
    return generateTextWithBlanks(words);
  }

  try {
    if (apiType === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `Tu es un professeur de français. Génère un court texte (3-5 phrases) de niveau école primaire qui utilise TOUS ces mots de vocabulaire de manière naturelle. Le texte doit être simple et compréhensible pour des enfants.`,
            },
            {
              role: 'user',
              content: `Mots à inclure : ${words.join(', ')}`,
            },
          ],
          max_tokens: 300,
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

      // Créer les trous pour les mots de la liste
      const blanks: GeneratedText['blanks'] = [];
      let displayText = generatedText;

      for (const word of words) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const match = regex.exec(generatedText);
        if (match) {
          blanks.push({ word, position: match.index });
          displayText = displayText.replace(regex, '_'.repeat(Math.max(5, word.length)));
        }
      }

      return {
        fullText: generatedText,
        displayText,
        blanks: blanks.sort((a, b) => a.position - b.position),
      };
    }

    // Fallback pour les autres APIs
    return generateTextWithBlanks(words);
  } catch (error) {
    console.error('Error generating text with AI:', error);
    return generateTextWithBlanks(words);
  }
}
