/**
 * Génère des erreurs orthographiques réalistes pour un mot français
 * Basé sur les erreurs typiques des élèves de 6ème
 */

// Règles de substitution courantes (erreurs phonétiques et grammaticales)
const SUBSTITUTIONS: Record<string, string[]> = {
  // Doubles consonnes
  'mm': ['m'],
  'nn': ['n'],
  'tt': ['t'],
  'pp': ['p'],
  'ff': ['f'],
  'ss': ['s'],
  'rr': ['r'],
  'll': ['l'],
  'cc': ['c'],
  // Sons similaires
  'ai': ['é', 'è', 'ei'],
  'ei': ['ai', 'é'],
  'é': ['ai', 'er', 'ez', 'ais'],
  'è': ['ai', 'ê', 'e'],
  'ê': ['è', 'ai', 'e'],
  'au': ['o', 'eau'],
  'eau': ['au', 'o'],
  'o': ['au', 'eau'],
  'an': ['en', 'am', 'em'],
  'en': ['an', 'em', 'am'],
  'am': ['an', 'em', 'en'],
  'em': ['en', 'am', 'an'],
  'in': ['ain', 'ein', 'im', 'un'],
  'ain': ['in', 'ein', 'im'],
  'ein': ['in', 'ain', 'im'],
  'im': ['in', 'aim', 'ein'],
  'on': ['om'],
  'om': ['on'],
  // Finales muettes
  'ent': ['ant', 'e'],
  'ant': ['ent', 'an'],
  'tion': ['sion', 'ssion'],
  'sion': ['tion', 'ssion'],
  // C/S/SS
  'c': ['s', 'ss', 'ç'],
  'ç': ['c', 's', 'ss'],
  's': ['c', 'ss', 'ç'],
  // G/J
  'g': ['j', 'gu'],
  'j': ['g', 'ge'],
  'gu': ['g'],
  'ge': ['j'],
  // PH/F
  'ph': ['f'],
  'f': ['ph'],
  // QU/K/C
  'qu': ['k', 'c'],
  'k': ['qu', 'c'],
  // Y/I
  'y': ['i', 'ie'],
  'i': ['y'],
  // Autres
  'oi': ['oua', 'oa'],
  'ou': ['oo', 'oue'],
  'eur': ['eure', 'eurs'],
  'eux': ['eu', 'euse'],
};

// Préfixes/suffixes souvent mal orthographiés
const SUFFIX_ERRORS: Record<string, string[]> = {
  'ment': ['mant', 'man'],
  'tion': ['sion', 'ssion', 'cion'],
  'sion': ['tion', 'ssion'],
  'eur': ['eure', 'eurt'],
  'eux': ['eu', 'euse'],
  'able': ['ables', 'abe'],
  'ible': ['ibles', 'ibe'],
  'ance': ['ence', 'anse'],
  'ence': ['ance', 'ense'],
  'ant': ['ent', 'an'],
  'ent': ['ant', 'en'],
};

/**
 * Génère des erreurs orthographiques pour un mot
 * @param word Le mot correct
 * @param count Nombre d'erreurs à générer (défaut: 3)
 * @returns Liste d'erreurs uniques
 */
export function generateSpellingErrors(word: string, count: number = 3): string[] {
  const errors = new Set<string>();
  const normalizedWord = word.toLowerCase().trim();

  // 1. Erreurs par substitution phonétique
  for (const [pattern, replacements] of Object.entries(SUBSTITUTIONS)) {
    if (normalizedWord.includes(pattern) && errors.size < count * 2) {
      for (const replacement of replacements) {
        const error = normalizedWord.replace(pattern, replacement);
        if (error !== normalizedWord && error.length > 1) {
          errors.add(error);
        }
      }
    }
  }

  // 2. Erreurs sur les suffixes
  for (const [suffix, wrongSuffixes] of Object.entries(SUFFIX_ERRORS)) {
    if (normalizedWord.endsWith(suffix)) {
      for (const wrongSuffix of wrongSuffixes) {
        const error = normalizedWord.slice(0, -suffix.length) + wrongSuffix;
        if (error !== normalizedWord) {
          errors.add(error);
        }
      }
    }
  }

  // 3. Doubler ou dédoubler une consonne
  const doubleConsonants = normalizedWord.match(/([bcdfghjklmnpqrstvwxz])\1/g);
  if (doubleConsonants) {
    for (const dc of doubleConsonants) {
      errors.add(normalizedWord.replace(dc, dc[0]));
    }
  } else {
    // Essayer de doubler une consonne
    const consonants = normalizedWord.match(/[bcdfghjklmnpqrstvwxz]/g);
    if (consonants) {
      const randomConsonant = consonants[Math.floor(Math.random() * consonants.length)];
      const index = normalizedWord.indexOf(randomConsonant);
      if (index > 0 && index < normalizedWord.length - 1) {
        errors.add(
          normalizedWord.slice(0, index + 1) + randomConsonant + normalizedWord.slice(index + 1)
        );
      }
    }
  }

  // 4. Oublier une lettre muette finale
  if (normalizedWord.match(/[stxz]$/)) {
    errors.add(normalizedWord.slice(0, -1));
  }
  if (normalizedWord.endsWith('ent')) {
    errors.add(normalizedWord.slice(0, -1)); // oubli du 't'
  }

  // 5. Erreur d'accent
  const accented = normalizedWord.replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e');
  if (accented !== normalizedWord) {
    errors.add(accented);
  }

  // 6. Inversion de lettres adjacentes
  if (normalizedWord.length > 3) {
    const pos = Math.floor(Math.random() * (normalizedWord.length - 2)) + 1;
    const chars = normalizedWord.split('');
    [chars[pos], chars[pos + 1]] = [chars[pos + 1], chars[pos]];
    errors.add(chars.join(''));
  }

  // Filtrer et retourner les erreurs uniques
  const uniqueErrors = Array.from(errors)
    .filter(e => e !== normalizedWord && e.length > 1)
    .slice(0, count);

  // Si on n'a pas assez d'erreurs, en générer des simples
  while (uniqueErrors.length < count && normalizedWord.length > 2) {
    // Supprimer une lettre au hasard
    const pos = Math.floor(Math.random() * normalizedWord.length);
    const error = normalizedWord.slice(0, pos) + normalizedWord.slice(pos + 1);
    if (!uniqueErrors.includes(error) && error !== normalizedWord) {
      uniqueErrors.push(error);
    } else {
      break; // Éviter boucle infinie
    }
  }

  return uniqueErrors;
}

/**
 * Mélange un tableau (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
