/**
 * Génération de distracteurs orthographiques plausibles pour le mode
 * « Choix orthographique ». Utilisé en fallback quand `spelling_errors`
 * n'a pas été défini en base pour un mot.
 *
 * Règles portées et adaptées du projet GAFF (GPL-3.0)
 *   https://github.com/momenttech/GAFF
 * Cadre théorique : typologie des erreurs de Nina Catach
 *   (phonogrammes, morphogrammes, logogrammes).
 */

const ARTICLE_RE = /^(le |la |l'|un |une |les |des |du |au |aux )/i;

function splitArticle(full: string): { article: string; word: string } {
  const m = full.match(ARTICLE_RE);
  return m ? { article: m[0], word: full.slice(m[0].length) } : { article: "", word: full };
}

// Homophones grammaticaux et lexicaux (match sur le mot entier sans article).
// Source : GAFF/phoneme/homophones.txt.
const HOMOPHONES: Record<string, string[]> = {
  a: ["à", "as"],
  à: ["a", "as"],
  as: ["à", "a"],
  an: ["en"],
  en: ["an"],
  ce: ["se"],
  se: ["ce"],
  ces: ["ses", "c'est", "s'est", "sais", "sait"],
  ses: ["ces", "c'est", "s'est"],
  "c'est": ["ces", "ses", "s'est"],
  "s'est": ["ces", "ses", "c'est"],
  sais: ["ces", "ses", "sait"],
  sait: ["ces", "ses", "sais"],
  dans: ["d'en", "dent"],
  dent: ["dans", "d'en"],
  don: ["donc", "dont"],
  donc: ["don", "dont"],
  dont: ["don", "donc"],
  la: ["là", "l'a", "l'as"],
  là: ["la", "l'a", "l'as"],
  mon: ["m'ont", "mont"],
  ni: ["n'y", "nie", "nies", "nid"],
  nid: ["ni", "n'y", "nie"],
  notre: ["nôtre"],
  nôtre: ["notre"],
  on: ["ont"],
  ont: ["on"],
  ou: ["où", "houx"],
  où: ["ou", "houx"],
  pris: ["prit", "prie", "prix"],
  prit: ["pris", "prie", "prix"],
  prie: ["pris", "prit", "prix"],
  prix: ["pris", "prit", "prie"],
  quand: ["qu'en", "camp"],
  "qu'en": ["quand", "camp"],
  sa: ["ça", "çà"],
  ça: ["sa", "çà"],
  sans: ["c'en", "sens", "sent", "sang", "cent"],
  sens: ["sans", "c'en", "sent", "sang", "cent"],
  sent: ["sans", "c'en", "sens", "sang", "cent"],
  son: ["sont"],
  sont: ["son"],
  ton: ["t'ont", "thon", "taon"],
  thon: ["ton", "taon"],
  tout: ["tous", "toux"],
  tous: ["tout", "toux"],
  toux: ["tout", "tous"],
  votre: ["vôtre"],
  vôtre: ["votre"],
  // Confusions lexicales très fréquentes en 6e
  ver: ["vers", "vert", "verre"],
  vers: ["ver", "vert", "verre"],
  vert: ["ver", "vers", "verre"],
  verre: ["ver", "vers", "vert"],
  mer: ["mère", "maire"],
  mère: ["mer", "maire"],
  maire: ["mer", "mère"],
  cou: ["coup", "coût", "coût"],
  coup: ["cou", "coût"],
  fin: ["faim"],
  faim: ["fin"],
  cent: ["sans", "sens", "sang", "sent", "c'en"],
  sang: ["sans", "sens", "sent", "cent", "c'en"],
};

// Substitutions phonétiques (sous-chaîne dans le mot).
// Règle clé : on n'applique JAMAIS une substitution qui touche la fin du mot
// si le mot fait ≤ 4 lettres (sinon `sont` → `somt`, etc.). Les mots courts
// utilisent uniquement la table HOMOPHONES.
// Source : GAFF/phoneme/restriction_no, filtré et durci.
const PHONETIC_SUBS: Array<{ pattern: RegExp; replacements: string[] }> = [
  // Voyelles nasales (uniquement à l'intérieur du mot, pas en finale)
  { pattern: /ain(?=[a-zéèêà])/, replacements: ["in"] },
  { pattern: /am(?=[bp])/, replacements: ["em"] }, // règle m/m,b,p
  { pattern: /an(?=[a-zéèêà])/, replacements: ["en"] },
  { pattern: /en(?=[a-zéèêà])/, replacements: ["an"] },
  { pattern: /om(?=[bp])/, replacements: ["on"] },
  // Sons « o »
  { pattern: /eau/, replacements: ["au", "o"] },
  { pattern: /au/, replacements: ["eau", "o"] },
  { pattern: /ô/, replacements: ["o", "au"] },
  // Diphtongues
  { pattern: /oi/, replacements: ["oua"] },
  { pattern: /ou(?=[a-zéèêà])/, replacements: ["u"] },
  // -ère / -ere
  { pattern: /ère/, replacements: ["aire"] },
  { pattern: /ere/, replacements: ["aire", "ère"] },
  // -ss- / -s- intervocalique
  { pattern: /([aeiou])ss([aeiou])/, replacements: ["$1s$2"] },
  { pattern: /([aeiou])s([aeiou])/, replacements: ["$1ss$2"] },
  // Consonnes
  { pattern: /ph/, replacements: ["f"] },
  { pattern: /qu/, replacements: ["k"] },
  { pattern: /ill/, replacements: ["y"] },
  // g → j (devant e, i)
  { pattern: /g(?=[eiéè])/, replacements: ["j"] },
];

// Confusions sur les finales verbales (son /e/).
// Source : GAFF/phoneme/finsdemot.txt.
const ENDING_SUBS: Array<{ ending: string; replacements: string[] }> = [
  { ending: "er", replacements: ["é", "ai", "ait", "ez", "ée"] },
  { ending: "é", replacements: ["er", "ai", "et", "ez"] },
  { ending: "ée", replacements: ["er", "é", "ait"] },
  { ending: "ai", replacements: ["é", "ait", "er", "ais"] },
  { ending: "ais", replacements: ["ai", "é", "ait", "er"] },
  { ending: "ait", replacements: ["ai", "ais", "é", "er"] },
  { ending: "aient", replacements: ["ait", "ai", "é"] },
  { ending: "ez", replacements: ["er", "é", "ai"] },
  { ending: "et", replacements: ["é", "er", "ai"] },
];

function tryHomophone(word: string): string[] {
  const lower = word.toLowerCase();
  return HOMOPHONES[lower] ?? [];
}

function tryEnding(word: string): string[] {
  const out: string[] = [];
  for (const { ending, replacements } of ENDING_SUBS) {
    if (word.endsWith(ending)) {
      const stem = word.slice(0, -ending.length);
      for (const rep of replacements) out.push(stem + rep);
      break;
    }
  }
  return out;
}

function tryPhonetic(word: string): string[] {
  // Pas de substitution phonétique sur les mots courts : ils ont leur propre
  // table d'homophones, et toute manipulation est à risque (sont → somt).
  if (word.length <= 4) return [];
  const out: string[] = [];
  for (const { pattern, replacements } of PHONETIC_SUBS) {
    if (pattern.test(word)) {
      for (const rep of replacements) {
        const candidate = word.replace(pattern, rep);
        if (candidate !== word) out.push(candidate);
      }
    }
  }
  return out;
}

function tryMorphology(word: string): string[] {
  const out: string[] = [];

  // Accents supprimés (faute fréquente)
  const noAccent = word
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a")
    .replace(/[ùûü]/g, "u").replace(/[ôö]/g, "o")
    .replace(/[îï]/g, "i").replace(/ç/g, "c");
  if (noAccent !== word) out.push(noAccent);

  // Confusion é ↔ è (très fréquente)
  if (/é/.test(word)) out.push(word.replace(/é/g, "è"));
  else if (/è/.test(word)) out.push(word.replace(/è/g, "é"));

  // Double consonne supprimée (belle → bele, mettre → metre)
  const dedoubled = word.replace(/([bcdfgklmnprstz])\1/, "$1");
  if (dedoubled !== word) out.push(dedoubled);

  // Simple → double (l, n, t, p)
  const doubled = word.replace(/([aeiou])([lnpt])([eè])/, "$1$2$2$3");
  if (doubled !== word) out.push(doubled);

  // Lettre muette finale supprimée (s, t, d, x, p)
  if (/[stdxp]$/.test(word) && word.length > 3) {
    out.push(word.slice(0, -1));
  }
  // -ent → -e (faute classique sur les verbes 3e personne pluriel)
  if (word.endsWith("ent") && word.length > 4) out.push(word.slice(0, -3) + "e");

  // -al → -als (faute classique au lieu de -aux)
  if (word.endsWith("al") && word.length > 3) out.push(word + "s");

  // h initial oublié (huile → uile, héros → éros)
  if (word.startsWith("h") && word.length > 2) out.push(word.slice(1));

  // -e final supprimé (vague → vagu, table → tabl)
  if (word.endsWith("e") && word.length > 3) out.push(word.slice(0, -1));

  // -s final ajouté/supprimé (faute d'accord en nombre)
  if (word.endsWith("s") && word.length > 3) out.push(word.slice(0, -1));
  else if (/[aeioulmnrdfgvb]$/.test(word) && word.length > 3) out.push(word + "s");

  // g → j (faute phonétique courante : gentil → jentil, dangereux → danjereux)
  if (/g[eiéè]/.test(word)) out.push(word.replace(/g([eiéè])/, "j$1"));

  // Confusion s/ss intervocalique (poison ↔ poisson)
  if (/[aeiou]s[aeiou]/.test(word)) out.push(word.replace(/([aeiou])s([aeiou])/, "$1ss$2"));
  else if (/[aeiou]ss[aeiou]/.test(word)) out.push(word.replace(/([aeiou])ss([aeiou])/, "$1s$2"));

  return out;
}

/**
 * Génère 3 distracteurs plausibles pour un mot français.
 * Ordre de priorité :
 *   1. Homophone connu (cas le plus pédagogiquement riche)
 *   2. Finale verbale alternative (-er/-é/-ai…)
 *   3. Substitution phonétique
 *   4. Erreur morphologique (accent, double consonne, lettre muette)
 *
 * Le mot reçu peut contenir un article ("le héros"), qui est préservé.
 */
export function generateDistractors(full: string): string[] {
  const { article, word } = splitArticle(full);
  if (!word) return [];

  const seen = new Set<string>();
  const add = (variant: string) => {
    if (!variant || variant === word) return;
    const withArticle = article + variant;
    if (withArticle !== full) seen.add(withArticle);
  };

  // Les homophones sont prioritaires (les fautes les plus riches
  // pédagogiquement). On les ajoute en premier dans un set séparé.
  const priority = new Set<string>();
  const addPriority = (v: string) => {
    if (!v || v === word) return;
    const wa = article + v;
    if (wa !== full) priority.add(wa);
  };
  tryHomophone(word).forEach(addPriority);

  tryEnding(word).forEach(add);
  tryPhonetic(word).forEach(add);
  tryMorphology(word).forEach(add);

  // Évite les doublons entre priority et seen
  for (const p of priority) seen.delete(p);

  // Mélange chaque pool, puis concatène : homophones d'abord, puis le reste.
  const prio = Array.from(priority).sort(() => Math.random() - 0.5);
  const rest = Array.from(seen).sort(() => Math.random() - 0.5);
  return [...prio, ...rest].slice(0, 3);
}
