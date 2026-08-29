/**
 * Génération de distracteurs orthographiques plausibles pour le mode
 * « Choix orthographique ». Utilisé en fallback quand `spelling_errors`
 * n'a pas été défini en base pour un mot.
 *
 * Règles portées et adaptées du projet GAFF (GPL-3.0)
 *   https://github.com/momenttech/GAFF
 * Cadre théorique : typologie des erreurs de Nina Catach
 *   (phonogrammes, morphogrammes, logogrammes).
 *
 * IMPORTANT — Décision pédagogique (Nadia, 25/05/2026) :
 * Ce générateur ne teste QUE l'orthographe LEXICALE. Il ne doit JAMAIS
 * produire de variantes qui changent :
 *   - la conjugaison du verbe (manger → mangé, mangeait, mangez…)
 *   - le nombre (chien → chiens, maisons → maison)
 *   - le genre (joli → jolie, étudiant → étudiante)
 * Ces aspects sont traités par d'autres exercices du parcours.
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
  { pattern: /ain(?=[a-zéèêà])/, replacements: ["in", "ein"] },
  { pattern: /ein(?=[a-zéèêà])/, replacements: ["ain", "in"] },
  { pattern: /in(?=[a-zéèêà])/, replacements: ["ain", "ein"] },
  { pattern: /am(?=[bp])/, replacements: ["em"] }, // règle m/m,b,p
  { pattern: /em(?=[bp])/, replacements: ["am"] },
  { pattern: /an(?=[a-zéèêà])/, replacements: ["en"] },
  { pattern: /en(?=[a-zéèêà])/, replacements: ["an"] },
  // en/an en finale aussi (souvent : « parent » ↔ « parant »), seulement
  // sur les mots longs pour éviter d'abîmer les courts (« on », « en »).
  { pattern: /an$/, replacements: ["en"] },
  { pattern: /en$/, replacements: ["an"] },
  { pattern: /om(?=[bp])/, replacements: ["on"] },
  // Sons « o » (o / au / eau / ô)
  { pattern: /eau/, replacements: ["au", "o"] },
  { pattern: /au/, replacements: ["eau", "o"] },
  { pattern: /ô/, replacements: ["o", "au"] },
  // Sons « eu » / « œu » (cœur ↔ ceur, sœur ↔ seur)
  { pattern: /œu/, replacements: ["eu"] },
  { pattern: /eu(?=[a-zéèêà])/, replacements: ["œu"] },
  // Son « è » : ai / ei / è / e+consonne double
  { pattern: /ai(?=[a-zéèêà])/, replacements: ["ei", "è"] },
  { pattern: /ei(?=[a-zéèêà])/, replacements: ["ai"] },
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

function tryHomophone(word: string): string[] {
  const lower = word.toLowerCase();
  return HOMOPHONES[lower] ?? [];
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

  // Accents supprimés (faute fréquente, lexicale)
  const noAccent = word
    .replace(/[éèêë]/g, "e").replace(/[àâä]/g, "a")
    .replace(/[ùûü]/g, "u").replace(/[ôö]/g, "o")
    .replace(/[îï]/g, "i").replace(/ç/g, "c");
  if (noAccent !== word) out.push(noAccent);

  // Confusion é ↔ è (lexicale)
  if (/é/.test(word)) out.push(word.replace(/é/g, "è"));
  else if (/è/.test(word)) out.push(word.replace(/è/g, "é"));

  // Double consonne supprimée (belle → bele, mettre → metre, ennemi → enemi)
  const dedoubled = word.replace(/([bcdfgklmnprstz])\1/, "$1");
  if (dedoubled !== word) out.push(dedoubled);

  // Simple → double, élargi à l, n, p, t, m, r, f, s
  // (appeler, immense, attaque, courrir, souffrir, dessous…)
  const doubled = word.replace(/([aeiouéèê])([lnptmrfs])([aeiouéèê])/, "$1$2$2$3");
  if (doubled !== word && doubled !== word.replace(/([aeiou])([lnpt])([eè])/, "$1$2$2$3")) {
    out.push(doubled);
  }
  // Variante ciblée avant -e/-è (forme la plus fréquente : -elle, -enne, -ette)
  const doubledEnd = word.replace(/([aeiou])([lnptmr])([eè])/, "$1$2$2$3");
  if (doubledEnd !== word) out.push(doubledEnd);

  // Lettre muette finale supprimée (chat → cha, sport → spor, pied → pie)
  // Lexical : l'élève doit savoir qu'il y a un -t/-d/-s/-x/-p muet.
  if (/[tdxp]$/.test(word) && word.length > 3) {
    out.push(word.slice(0, -1));
  }

  // h initial oublié (huile → uile, héros → éros) — lexical
  if (word.startsWith("h") && word.length > 2) out.push(word.slice(1));

  // g → j (faute phonétique courante : gentil → jentil) — lexical
  if (/g[eiéè]/.test(word)) out.push(word.replace(/g([eiéè])/, "j$1"));

  // Confusion s/ss intervocalique (poison ↔ poisson) — lexical
  if (/[aeiou]s[aeiou]/.test(word)) out.push(word.replace(/([aeiou])s([aeiou])/, "$1ss$2"));
  else if (/[aeiou]ss[aeiou]/.test(word)) out.push(word.replace(/([aeiou])ss([aeiou])/, "$1s$2"));

  // NB : règles intentionnellement RETIRÉES (faute d'accord, pas de lexique) :
  //   - -s final ajouté/supprimé (chien → chiens) → nombre
  //   - -ent → -e (mangent → mange) → conjugaison
  //   - -al → -als (cheval → chevals) → nombre
  //   - -e final supprimé (vague → vagu) → potentiellement genre, ambigu
  //   - tryEnding (-er/-é/-ai/-ait/-ez/-ée) → conjugaison

  return out;
}

/**
 * Filtre une variante candidate : rejette tout ce qui ressemble à une faute
 * d'accord (nombre/genre) plutôt qu'une faute d'orthographe lexicale.
 */
function isLexicalDistractor(word: string, candidate: string): boolean {
  // Diffère uniquement par un -s final → faute de nombre, on rejette.
  if (word + "s" === candidate || word === candidate + "s") return false;
  // Diffère uniquement par un -e final → faute de genre, on rejette.
  if (word + "e" === candidate || word === candidate + "e") return false;
  // -é ↔ -ée → genre, on rejette.
  if (word.endsWith("é") && candidate === word + "e") return false;
  if (candidate.endsWith("é") && word === candidate + "e") return false;
  // -er ↔ -é / -ée / -ai / -ait / -aient / -ais / -ez → conjugaison, on rejette.
  const verbalPairs: Array<[RegExp, RegExp]> = [
    [/er$/, /(é|ée|ai|ait|aient|ais|ez)$/],
    [/(é|ée|ai|ait|aient|ais|ez)$/, /er$/],
    [/é$/, /(ée|ai|ait|ais|aient|ez|et)$/],
    [/(ée|ai|ait|ais|aient|ez|et)$/, /é$/],
  ];
  for (const [a, b] of verbalPairs) {
    if (a.test(word) && b.test(candidate)) {
      const stemA = word.replace(a, "");
      const stemB = candidate.replace(b, "");
      if (stemA === stemB) return false;
    }
  }
  return true;
}

export interface DistractorOptions {
  /** Classe grammaticale du mot (si connue). Quand c'est un « nom », on
   * autorise des fautes lexicales typiques des noms (ex : *beautée*,
   * *couleure*) qui seraient sinon rejetées comme fautes de genre. */
  grammaticalClass?: string | null;
}

/**
 * Variantes spécifiques aux NOMS, qui ressemblent à des fautes d'accord
 * mais sont en réalité des fautes lexicales très fréquentes en 6e :
 *   - nom en -é (féminin) → -ée (la beauté → la beautée)
 *   - nom en -eur          → -eure (la couleur → la couleure)
 * Ces candidats bypass `isLexicalDistractor` (qui rejette le simple +e final).
 */
function tryNounEndings(word: string): string[] {
  const out: string[] = [];
  if (/[^e]é$/.test(word)) out.push(word + "e"); // beauté → beautée
  if (/eur$/.test(word)) out.push(word + "e");   // couleur → couleure
  return out;
}

/**
 * Génère 3 distracteurs plausibles pour un mot français.
 * Stratégie : variations LEXICALES uniquement (orthographe pure).
 * Aucune variation d'accord (nombre/genre) ni de conjugaison.
 *
 * Ordre de priorité :
 *   1. Homophone connu (cas le plus pédagogiquement riche)
 *   2. Substitution phonétique (eau/au/o, ph/f, qu/k…)
 *   3. Erreur morphologique lexicale (accent, double consonne, lettre muette)
 *
 * Le mot reçu peut contenir un article ("le héros"), qui est préservé.
 */
export function generateDistractors(full: string, opts: DistractorOptions = {}): string[] {
  const { article, word } = splitArticle(full);
  if (!word) return [];

  const seen = new Set<string>();
  const add = (variant: string) => {
    if (!variant || variant === word) return;
    if (!isLexicalDistractor(word, variant)) return;
    const withArticle = article + variant;
    if (withArticle !== full) seen.add(withArticle);
  };

  // Les homophones sont prioritaires (les fautes les plus riches
  // pédagogiquement). On les ajoute en premier dans un set séparé.
  const priority = new Set<string>();
  const addPriority = (v: string) => {
    if (!v || v === word) return;
    if (!isLexicalDistractor(word, v)) return;
    const wa = article + v;
    if (wa !== full) priority.add(wa);
  };
  tryHomophone(word).forEach(addPriority);

  // Spécifique nom : -é/-eur → +e, bypass le filtre genre.
  if (opts.grammaticalClass === "nom") {
    for (const v of tryNounEndings(word)) {
      if (v !== word) priority.add(article + v);
    }
  }

  tryPhonetic(word).forEach(add);
  tryMorphology(word).forEach(add);

  // Évite les doublons entre priority et seen
  for (const p of priority) seen.delete(p);

  // Mélange chaque pool, puis concatène : homophones d'abord, puis le reste.
  const prio = Array.from(priority).sort(() => Math.random() - 0.5);
  const rest = Array.from(seen).sort(() => Math.random() - 0.5);
  return [...prio, ...rest].slice(0, 3);
}
