/**
 * Generateur de textes a trous pour les dictees
 * Utilise des templates simples ou l'API DeepSeek
 */

// Templates de phrases avec placeholder {word} - SANS ARTICLES
const SENTENCE_TEMPLATES = [
  // Phrases simples sans article
  "{word} est tres important.",
  "{word} se trouve sur la table.",
  "{word} brille au soleil.",
  "{word} joue dans le jardin.",
  "{word} est magnifique.",
  "{word} est pres de la maison.",
  "{word} est vraiment extraordinaire.",
  "{word} peut etre grand ou petit.",
  "{word} a sa propre histoire.",

  // Phrases avec contexte
  "Dans la foret, on peut voir {word}.",
  "A l'ecole, nous avons appris {word}.",
  "Pendant les vacances, j'ai decouvert {word}.",
  "Mon ami prefere {word}.",
  "La maitresse a explique {word}.",
  "Sur le chemin, nous avons rencontre {word}.",
  "Dans mon livre, il y a {word}.",
  "Ce week-end, j'ai observe {word}.",

  // Phrases descriptives
  "J'ai vu {word} dans le jardin.",
  "Ma mere a achete {word}.",
  "Nous avons trouve {word}.",
  "Elle a dessine {word}.",
  "Nous aimons beaucoup {word}.",
  "J'ai decouvert {word} ce matin.",
  "Papa a repare {word}.",
];

// Templates pour 2 mots dans la meme phrase - SANS ARTICLES
const DOUBLE_TEMPLATES = [
  "{word1} et {word2} sont dans la classe.",
  "J'ai vu {word1} pres de {word2}.",
  "{word1} regarde {word2} avec attention.",
  "Entre {word1} et {word2}, je prefere le premier.",
  "{word1} et {word2} jouent ensemble.",
  "{word1} est plus grand que {word2}.",
];

/**
 * Interface pour un texte genere avec ses trous
 */
export interface GeneratedText {
  fullText: string;           // Texte complet pour la dictee audio
  displayText: string;        // Texte avec les trous (_____) pour l'affichage
  blanks: {
    word: string;             // Le mot a deviner
    position: number;         // Position du trou dans le texte
  }[];
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

  // Creer le texte avec les trous
  let displayText = fullText;
  // Remplacer les mots par des trous (du dernier au premier pour ne pas decaler les positions)
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
 * Genere un texte avec l'API DeepSeek (compatible OpenAI)
 */
export async function generateTextWithAI(
  words: string[],
  apiKey: string
): Promise<GeneratedText> {
  if (!apiKey) {
    return generateTextWithBlanks(words);
  }

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
            content: `Tu es un professeur de francais. Genere un court texte (3-5 phrases) de niveau ecole primaire qui utilise TOUS ces mots de vocabulaire de maniere naturelle. Le texte doit etre simple et comprehensible pour des enfants. IMPORTANT: N'ajoute PAS d'articles devant les mots de la liste - utilise-les tels quels.`,
          },
          {
            role: 'user',
            content: `Mots a inclure exactement tels quels (sans ajouter d'articles) : ${words.join(', ')}`,
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

    // Creer les trous pour les mots de la liste
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
  } catch (error) {
    console.error('Error generating text with AI:', error);
    return generateTextWithBlanks(words);
  }
}
