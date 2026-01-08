/**
 * Generateur d'erreurs orthographiques realistes
 * Base sur les erreurs classiques des eleves francais
 */

// Confusions phonetiques courantes
const PHONETIC_CONFUSIONS: Record<string, string[]> = {
  // Sons similaires
  'an': ['en', 'ant', 'ent'],
  'en': ['an', 'ant', 'ent'],
  'on': ['ont', 'om'],
  'in': ['ain', 'ein', 'im'],
  'ain': ['in', 'ein'],
  'ou': ['ous', 'oue', 'oux'],
  'oi': ['oie', 'ois'],
  'ai': ['é', 'ais', 'ait', 'è'],
  'é': ['ai', 'er', 'ez', 'ée'],
  'è': ['ai', 'ê', 'e'],
  'eau': ['o', 'au', 'eaux'],
  'au': ['o', 'eau'],
  // Consonnes doubles
  'ss': ['s', 'c'],
  's': ['ss', 'c', 'ç'],
  'tt': ['t'],
  't': ['tt'],
  'mm': ['m'],
  'm': ['mm'],
  'nn': ['n'],
  'n': ['nn'],
  'll': ['l'],
  'l': ['ll'],
  'pp': ['p'],
  'p': ['pp'],
  'ff': ['f', 'ph'],
  'f': ['ff', 'ph'],
  'ph': ['f', 'ff'],
  // Autres confusions
  'qu': ['c', 'k'],
  'c': ['qu', 'k', 's'],
  'g': ['j', 'gu'],
  'j': ['g'],
  'ch': ['sh'],
};

// Homophones courants
const HOMOPHONES: Record<string, string[]> = {
  'a': ['à'],
  'à': ['a'],
  'ou': ['où'],
  'où': ['ou'],
  'et': ['est', 'ai', 'ait'],
  'est': ['et', 'ai'],
  'son': ['sont'],
  'sont': ['son'],
  'on': ['ont'],
  'ont': ['on'],
  'ce': ['se'],
  'se': ['ce'],
  'ces': ['ses', 'c\'est', 'sait'],
  'ses': ['ces', 'c\'est'],
  'c\'est': ['ces', 'ses', 's\'est'],
  's\'est': ['c\'est'],
  'leur': ['leurs'],
  'leurs': ['leur'],
  'ma': ['m\'a'],
  'm\'a': ['ma'],
  'ta': ['t\'a'],
  't\'a': ['ta'],
  'la': ['l\'a', 'là'],
  'l\'a': ['la'],
  'là': ['la'],
  'ni': ['n\'y'],
  'si': ['s\'y'],
  'quand': ['quant', 'qu\'en'],
  'quant': ['quand'],
  'dans': ['d\'en'],
  'sans': ['s\'en', 'sang'],
  'peu': ['peux', 'peut'],
  'peux': ['peu', 'peut'],
  'peut': ['peu', 'peux'],
  'près': ['prêt', 'prêts'],
  'prêt': ['près'],
  'plus tôt': ['plutôt'],
  'plutôt': ['plus tôt'],
};

// Terminaisons verbales confondues
const VERB_ENDINGS: Record<string, string[]> = {
  'er': ['é', 'ez', 'ée', 'és', 'ées'],
  'é': ['er', 'ez', 'ée'],
  'ez': ['er', 'é'],
  'ée': ['é', 'er'],
  'és': ['é', 'ées', 'er'],
  'ées': ['és', 'é', 'er'],
  'ais': ['ai', 'ait', 'aient'],
  'ait': ['ai', 'ais', 'aient'],
  'aient': ['ais', 'ait'],
  'ons': ['ont'],
  'ont': ['ons'],
};

// Erreurs d'accord frequentes
const AGREEMENT_ERRORS: Record<string, string[]> = {
  's': [''], // oubli du pluriel
  '': ['s'], // ajout du pluriel
  'e': [''], // oubli du feminin
  'x': ['s'], // confusion pluriel
};

// Mots souvent mal orthographies
const COMMON_MISSPELLINGS: Record<string, string[]> = {
  'toujours': ['toujour', 'toujous'],
  'beaucoup': ['baucoup', 'beaucou', 'bocoup'],
  'maintenant': ['maintenan', 'mentenant'],
  'aujourd\'hui': ['aujourdhui', 'aujourd hui'],
  'longtemps': ['lontemps', 'longtemp'],
  'quelquefois': ['quelque fois', 'kelquefois'],
  'peut-être': ['peut être', 'peutêtre'],
  'parce que': ['parceque', 'par ce que'],
  'afin': ['a fin'],
  'enfin': ['en fin'],
  'cependant': ['cepandant', 'cependan'],
  'également': ['egallement', 'égallement'],
  'certainement': ['certainnement', 'certainemen'],
  'apparemment': ['apparament', 'aparemment'],
  'évidemment': ['evidemment', 'évidament'],
  'vraiment': ['vraiement', 'vraiman'],
  'gentiment': ['gentiement', 'jentiment'],
  'couramment': ['courament', 'courrament'],
  'notamment': ['notament', 'notamant'],
};

/**
 * Genere des variantes erronees d'un mot
 */
export function generateSpellingErrors(word: string, count: number = 3): string[] {
  const errors: Set<string> = new Set();
  const lowerWord = word.toLowerCase();

  // 1. Verifier si c'est un homophone connu
  if (HOMOPHONES[lowerWord]) {
    HOMOPHONES[lowerWord].forEach(h => errors.add(h));
  }

  // 2. Verifier si c'est un mot souvent mal orthographie
  if (COMMON_MISSPELLINGS[lowerWord]) {
    COMMON_MISSPELLINGS[lowerWord].forEach(m => errors.add(m));
  }

  // 3. Appliquer des confusions phonetiques
  for (const [sound, confusions] of Object.entries(PHONETIC_CONFUSIONS)) {
    if (lowerWord.includes(sound)) {
      confusions.forEach(confusion => {
        const errorWord = lowerWord.replace(sound, confusion);
        if (errorWord !== lowerWord) {
          errors.add(errorWord);
        }
      });
    }
  }

  // 4. Erreurs de terminaisons verbales
  for (const [ending, wrongEndings] of Object.entries(VERB_ENDINGS)) {
    if (lowerWord.endsWith(ending)) {
      wrongEndings.forEach(wrongEnding => {
        const errorWord = lowerWord.slice(0, -ending.length) + wrongEnding;
        if (errorWord !== lowerWord && errorWord.length > 1) {
          errors.add(errorWord);
        }
      });
    }
  }

  // 5. Erreurs d'accord (ajout/suppression de s, e, x)
  if (lowerWord.endsWith('s')) {
    errors.add(lowerWord.slice(0, -1)); // oubli du s
  } else if (!lowerWord.endsWith('s') && !lowerWord.endsWith('x')) {
    errors.add(lowerWord + 's'); // ajout errone du s
  }

  if (lowerWord.endsWith('e')) {
    errors.add(lowerWord.slice(0, -1)); // oubli du e feminin
  }

  // 6. Doublement/dedoublement de consonnes
  const doubleConsonants = ['ll', 'mm', 'nn', 'pp', 'rr', 'ss', 'tt', 'ff'];
  doubleConsonants.forEach(dc => {
    if (lowerWord.includes(dc)) {
      errors.add(lowerWord.replace(dc, dc[0])); // dedoubler
    }
    const single = dc[0];
    const regex = new RegExp(`([^${single}])${single}([^${single}])`, 'g');
    const doubled = lowerWord.replace(regex, `$1${dc}$2`);
    if (doubled !== lowerWord) {
      errors.add(doubled); // doubler
    }
  });

  // 7. Erreurs de lettres muettes
  if (lowerWord.endsWith('t') || lowerWord.endsWith('d') || lowerWord.endsWith('s')) {
    errors.add(lowerWord.slice(0, -1)); // oubli lettre muette finale
  }

  // 8. Confusion accents
  const accentConfusions: Record<string, string> = {
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'à': 'a', 'â': 'a',
    'ù': 'u', 'û': 'u',
    'î': 'i', 'ï': 'i',
    'ô': 'o',
    'ç': 'c',
  };
  let noAccent = lowerWord;
  for (const [accent, plain] of Object.entries(accentConfusions)) {
    noAccent = noAccent.replace(new RegExp(accent, 'g'), plain);
  }
  if (noAccent !== lowerWord) {
    errors.add(noAccent);
  }

  // Filtrer les erreurs valides et limiter au nombre demande
  const validErrors = Array.from(errors)
    .filter(e => e !== lowerWord && e.length > 1)
    .slice(0, count * 2); // Prendre plus pour avoir du choix

  // Melanger et retourner
  return shuffleArray(validErrors).slice(0, count);
}

/**
 * Genere un exercice de choix orthographique pour un mot
 */
export interface SpellingChoice {
  word: string;
  correct: string;
  wrong: string;
  position: 'left' | 'right';
}

export function generateSpellingChoice(word: string): SpellingChoice {
  const errors = generateSpellingErrors(word, 1);
  const wrongOption = errors[0] || generateFallbackError(word);

  // Position aleatoire (gauche ou droite)
  const position = Math.random() > 0.5 ? 'left' : 'right';

  return {
    word,
    correct: word,
    wrong: wrongOption,
    position,
  };
}

/**
 * Genere une erreur de secours si aucune n'a ete trouvee
 */
function generateFallbackError(word: string): string {
  const strategies = [
    // Doubler une consonne
    () => {
      const consonants = 'bcdfghjklmnpqrstvwxz';
      for (let i = 0; i < word.length; i++) {
        if (consonants.includes(word[i].toLowerCase())) {
          return word.slice(0, i + 1) + word[i] + word.slice(i + 1);
        }
      }
      return word + 's';
    },
    // Supprimer une lettre
    () => {
      if (word.length > 3) {
        const i = Math.floor(Math.random() * (word.length - 2)) + 1;
        return word.slice(0, i) + word.slice(i + 1);
      }
      return word + 'e';
    },
    // Ajouter/supprimer accent
    () => {
      if (word.includes('e')) {
        return word.replace('e', 'é');
      }
      if (word.includes('é')) {
        return word.replace('é', 'e');
      }
      return word + 's';
    },
  ];

  const strategy = strategies[Math.floor(Math.random() * strategies.length)];
  const result = strategy();
  return result !== word ? result : word + 's';
}

/**
 * Melange un tableau (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Genere les variantes accordees d'un mot
 * Ex: "absent(e)" -> ["absent", "absente"]
 * Ex: "lourd" -> ["lourd", "lourde", "lourds", "lourdes"]
 */
export function generateWordVariants(word: string): string[] {
  const variants: string[] = [];

  // Si le mot contient deja des variantes entre parentheses
  const variantMatch = word.match(/^(.+)\(([^)]+)\)$/);
  if (variantMatch) {
    const base = variantMatch[1];
    const suffix = variantMatch[2];
    variants.push(base); // forme masculine/singulier
    variants.push(base + suffix); // forme feminine/autre

    // Ajouter les pluriels
    if (!base.endsWith('s') && !base.endsWith('x')) {
      variants.push(base + 's');
      variants.push(base + suffix + 's');
    }
  } else {
    variants.push(word);

    // Generer automatiquement des variantes pour les adjectifs courants
    if (word.endsWith('eux')) {
      variants.push(word.slice(0, -1) + 'se'); // dangereux -> dangereuse
    } else if (word.endsWith('if')) {
      variants.push(word.slice(0, -1) + 've'); // actif -> active
    } else if (word.endsWith('er')) {
      variants.push(word.slice(0, -2) + 'ère'); // premier -> première
    } else if (!word.endsWith('e') && !word.endsWith('s')) {
      // Ajouter forme feminine et pluriel
      variants.push(word + 'e');
      variants.push(word + 's');
      variants.push(word + 'es');
    }
  }

  return [...new Set(variants)];
}
