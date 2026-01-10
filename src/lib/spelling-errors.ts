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

// Terminaisons verbales et nominales confondues (erreurs très fréquentes chez les élèves)
const ENDING_CONFUSIONS: Record<string, string[]> = {
  // Confusion -er/-é/-ée/-ez (la plus fréquente!)
  'er': ['é', 'ée', 'ez'],
  'é': ['er', 'ée', 'ez'],
  'ez': ['er', 'é'],
  'ée': ['é', 'er'],
  'és': ['ées', 'er', 'é'],
  'ées': ['és', 'er', 'é'],
  // Confusion -ier/-ié (très fréquent: infirmier -> infirmié)
  'ier': ['ié', 'iez', 'iers'],
  'ière': ['iere', 'iaire', 'ier'],
  // Imparfait
  'ais': ['ai', 'ait', 'és'],
  'ait': ['ai', 'ais', 'é'],
  'aient': ['ais', 'ait', 'é'],
  // Autres
  'ons': ['ont'],
  'ont': ['ons'],
  // Noms en -tion/-sion
  'tion': ['ssion', 'sion', 'cions'],
  'sion': ['tion', 'ssion'],
  // Noms en -ment
  'ment': ['man', 'mant', 'ments'],
  // Adjectifs en -eux/-euse
  'eux': ['eu', 'euse', 'eus'],
  'euse': ['euxe', 'euze'],
  // Noms en -eur
  'eur': ['eure', 'eurs', 'eurt'],
  // Pluriels irréguliers
  'aux': ['als', 'aus'],
  'eaux': ['os', 'aus', 'eau'],
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
 * Priorise les erreurs les plus realistes (celles que font vraiment les eleves)
 */
export function generateSpellingErrors(word: string, count: number = 3): string[] {
  // Erreurs haute priorité (très réalistes)
  const highPriority: string[] = [];
  // Erreurs moyenne priorité
  const mediumPriority: string[] = [];
  // Erreurs basse priorité (fallback)
  const lowPriority: string[] = [];

  const lowerWord = word.toLowerCase();

  // 1. HAUTE PRIORITÉ: Erreurs de terminaisons (infirmier -> infirmié)
  for (const [ending, wrongEndings] of Object.entries(ENDING_CONFUSIONS)) {
    if (lowerWord.endsWith(ending)) {
      wrongEndings.forEach(wrongEnding => {
        const errorWord = lowerWord.slice(0, -ending.length) + wrongEnding;
        if (errorWord !== lowerWord && errorWord.length > 1) {
          highPriority.push(errorWord);
        }
      });
      break; // Une seule terminaison par mot
    }
  }

  // 2. HAUTE PRIORITÉ: Homophones connus
  if (HOMOPHONES[lowerWord]) {
    highPriority.push(...HOMOPHONES[lowerWord]);
  }

  // 3. HAUTE PRIORITÉ: Mots souvent mal orthographiés
  if (COMMON_MISSPELLINGS[lowerWord]) {
    highPriority.push(...COMMON_MISSPELLINGS[lowerWord]);
  }

  // 4. HAUTE PRIORITÉ: Oubli d'accent (école -> ecole)
  const accentToPlain: Record<string, string> = {
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'à': 'a', 'â': 'a',
    'ù': 'u', 'û': 'u',
    'î': 'i', 'ï': 'i',
    'ô': 'o',
    'ç': 'c',
  };
  let noAccent = lowerWord;
  for (const [accent, plain] of Object.entries(accentToPlain)) {
    noAccent = noAccent.replace(new RegExp(accent, 'g'), plain);
  }
  if (noAccent !== lowerWord) {
    highPriority.push(noAccent);
  }

  // 5. MOYENNE PRIORITÉ: Confusions phonétiques
  for (const [sound, confusions] of Object.entries(PHONETIC_CONFUSIONS)) {
    if (lowerWord.includes(sound)) {
      confusions.slice(0, 2).forEach(confusion => {
        const errorWord = lowerWord.replace(sound, confusion);
        if (errorWord !== lowerWord) {
          mediumPriority.push(errorWord);
        }
      });
    }
  }

  // 6. MOYENNE PRIORITÉ: Lettres muettes finales
  if (lowerWord.endsWith('t') && lowerWord.length > 3) {
    mediumPriority.push(lowerWord.slice(0, -1)); // oubli du t (chat -> cha)
  }
  if (lowerWord.endsWith('d') && lowerWord.length > 3) {
    mediumPriority.push(lowerWord.slice(0, -1)); // oubli du d
  }
  if (lowerWord.endsWith('s') && lowerWord.length > 3 && !lowerWord.endsWith('ous') && !lowerWord.endsWith('ais')) {
    mediumPriority.push(lowerWord.slice(0, -1)); // oubli du s
  }

  // 7. BASSE PRIORITÉ: Doublement/dédoublement de consonnes
  const doubleConsonants = ['ll', 'mm', 'nn', 'pp', 'rr', 'ss', 'tt', 'ff'];
  doubleConsonants.forEach(dc => {
    if (lowerWord.includes(dc)) {
      lowPriority.push(lowerWord.replace(dc, dc[0]));
    }
  });

  // 8. BASSE PRIORITÉ: Erreurs d'accord
  if (!lowerWord.endsWith('s') && !lowerWord.endsWith('x') && lowerWord.length > 2) {
    lowPriority.push(lowerWord + 's');
  }

  // Combiner par priorité et dédupliquer
  const allErrors = [...new Set([...highPriority, ...mediumPriority, ...lowPriority])]
    .filter(e => e !== lowerWord && e.length > 1);

  // Retourner les erreurs par ordre de priorité (pas de mélange aléatoire!)
  return allErrors.slice(0, count);
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
