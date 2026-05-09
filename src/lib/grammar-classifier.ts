// Classifieur heuristique de la classe grammaticale d'un mot français.
// Couverture cible : programme officiel 6e (BO 2020 / cycle 3).
// Précision attendue ≈ 85-90 % sur le vocabulaire d'une dictée 6e.
// Le prof corrige les ratés via le panneau Parcours.

export type GrammaticalClass =
  | "nom"
  | "nom_propre"
  | "verbe"
  | "adjectif"
  | "determinant"
  | "pronom"
  | "adverbe"
  | "preposition"
  | "conjonction";

export const GRAMMAR_LABELS: Record<GrammaticalClass, string> = {
  nom: "Nom",
  nom_propre: "Nom propre",
  verbe: "Verbe",
  adjectif: "Adjectif",
  determinant: "Déterminant",
  pronom: "Pronom",
  adverbe: "Adverbe",
  preposition: "Préposition",
  conjonction: "Conjonction",
};

const DETERMINANTS = new Set([
  "le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'",
  "ce", "cet", "cette", "ces",
  "mon", "ton", "son", "ma", "ta", "sa", "mes", "tes", "ses",
  "notre", "votre", "leur", "nos", "vos", "leurs",
  "aucun", "aucune", "chaque", "plusieurs", "quelques", "tout", "toute", "tous", "toutes",
  "quel", "quelle", "quels", "quelles",
]);

const PRONOMS = new Set([
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "me", "te", "se", "lui", "leur",
  "moi", "toi", "soi", "eux",
  "ce", "ça", "cela", "ceci",
  "celui", "celle", "ceux", "celles",
  "qui", "que", "quoi", "dont", "où",
  "lequel", "laquelle", "lesquels", "lesquelles",
  "le", "la", "les", "y", "en",
]);

const PREPOSITIONS = new Set([
  "à", "de", "d'", "en", "dans", "sur", "sous", "avec", "sans", "pour", "par",
  "chez", "vers", "entre", "parmi", "depuis", "pendant", "avant", "après",
  "contre", "derrière", "devant", "près", "selon", "malgré", "sauf", "jusqu'",
  "jusque", "au", "aux",
]);

const CONJONCTIONS = new Set([
  "et", "ou", "mais", "donc", "or", "ni", "car",
  "que", "quand", "lorsque", "puisque", "comme", "si",
  "parce", "pendant", "tandis", "quoique", "bien",
]);

const ADVERBES = new Set([
  "très", "trop", "peu", "beaucoup", "assez", "plus", "moins", "tant", "autant", "si",
  "bien", "mal", "mieux", "pire",
  "ici", "là", "partout", "ailleurs", "dehors", "dedans", "dessus", "dessous",
  "hier", "aujourd'hui", "demain", "maintenant", "toujours", "jamais", "souvent",
  "parfois", "déjà", "encore", "bientôt", "tard", "tôt",
  "oui", "non", "peut-être", "certes", "vraiment",
  "ainsi", "alors", "ensuite", "puis", "enfin", "aussi",
  "ne", "pas", "plus", "rien", "personne", "guère", "jamais",
]);

// Verbes irréguliers fréquents (formes infinitives ou conjuguées courantes)
const VERBES_IRR = new Set([
  "être", "suis", "es", "est", "sommes", "êtes", "sont", "était", "étaient", "fut", "sera",
  "avoir", "ai", "as", "a", "avons", "avez", "ont", "avait", "avaient", "eut", "aura",
  "aller", "vais", "vas", "va", "allons", "allez", "vont", "allait", "ira",
  "faire", "fais", "fait", "faisons", "faites", "font", "faisait",
  "dire", "dis", "dit", "disons", "dites", "disent",
  "voir", "vois", "voit", "voyons", "voyez", "voient",
  "savoir", "sais", "sait", "savons", "savez", "savent",
  "pouvoir", "peux", "peut", "pouvons", "pouvez", "peuvent",
  "vouloir", "veux", "veut", "voulons", "voulez", "veulent",
  "venir", "viens", "vient", "venons", "venez", "viennent",
  "prendre", "prends", "prend", "prenons", "prenez", "prennent",
  "mettre", "mets", "met", "mettons", "mettez", "mettent",
]);

// Adjectifs très fréquents avec terminaisons « pièges » ou substantivables.
// Ces adjectifs prennent la priorité MÊME quand ils sont précédés d'un article
// (cas "le prochain", "le petit", "le beau") car en contexte de dictée 6e
// le prof teste l'adjectif, pas l'adjectif substantivé.
const ADJECTIFS_FREQ = new Set([
  "grand", "grande", "grands", "grandes",
  "petit", "petite", "petits", "petites",
  "beau", "bel", "belle", "beaux", "belles",
  "bon", "bonne", "bons", "bonnes",
  "mauvais", "mauvaise", "mauvaises",
  "vieux", "vieille", "vieilles",
  "jeune", "jeunes",
  "nouveau", "nouvel", "nouvelle", "nouveaux", "nouvelles",
  "ancien", "ancienne", "anciens", "anciennes",
  "joli", "jolie", "jolis", "jolies",
  "haut", "haute", "hauts", "hautes",
  "bas", "basse", "basses",
  "long", "longue", "longs", "longues",
  "court", "courte", "courts", "courtes",
  "large", "larges",
  "étroit", "étroite", "étroits", "étroites",
  "fort", "forte", "forts", "fortes",
  "faible", "faibles",
  "chaud", "chaude", "chauds", "chaudes",
  "froid", "froide", "froids", "froides",
  "tiède", "tièdes",
  "doux", "douce", "douces",
  "dur", "dure", "durs", "dures",
  "mou", "molle", "mous", "molles",
  "prochain", "prochaine", "prochains", "prochaines",
  "premier", "première", "premiers", "premières",
  "dernier", "dernière", "derniers", "dernières",
  "même", "mêmes",
  "seul", "seule", "seuls", "seules",
  "vrai", "vraie", "vrais", "vraies",
  "faux", "fausse", "fausses",
  "plein", "pleine", "pleins", "pleines",
  "vide", "vides",
  "propre", "propres",
  "sale", "sales",
  "rouge", "rouges",
  "vert", "verte", "verts", "vertes",
  "bleu", "bleue", "bleus", "bleues",
  "jaune", "jaunes",
  "noir", "noire", "noirs", "noires",
  "blanc", "blanche", "blancs", "blanches",
  "gris", "grise", "grises",
  "rose", "roses",
  "marron",
  "rond", "ronde", "ronds", "rondes",
  "carré", "carrée", "carrés", "carrées",
  "triste", "tristes",
  "heureux", "heureuse", "heureuses",
  "fier", "fière", "fiers", "fières",
  "lourd", "lourde", "lourds", "lourdes",
  "léger", "légère", "légers", "légères",
  "rapide", "rapides",
  "lent", "lente", "lents", "lentes",
  "facile", "faciles",
  "difficile", "difficiles",
  "simple", "simples",
  "calme", "calmes",
  "sage", "sages",
  "gentil", "gentille", "gentils", "gentilles",
  "méchant", "méchante", "méchants", "méchantes",
  "drôle", "drôles",
]);

// Sépare l'article d'un mot stocké comme "le chien"
function stripLeadingArticle(word: string): { article: string | null; rest: string } {
  const m = word.match(/^(le |la |les |l['’]|un |une |des |du )/i);
  if (m) return { article: m[1].trim().toLowerCase(), rest: word.slice(m[0].length) };
  return { article: null, rest: word };
}

// Retire les annotations parenthétiques type "flou (e)" ou "coucher (se)"
function stripParens(word: string): string {
  return word.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
}

function lowerNoAccents(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function classifyWord(rawWord: string): GrammaticalClass {
  const cleaned = stripParens(rawWord).trim();
  const { article, rest } = stripLeadingArticle(cleaned);
  const w = rest.trim();
  const lw = w.toLowerCase();
  const lwNa = lowerNoAccents(w);

  // 1) Si article devant : adjectif fréquent → adjectif (priorité), sinon nom
  // (cas "le prochain", "le petit", "le beau" — en dictée 6e on teste l'adjectif)
  if (article) {
    if (ADJECTIFS_FREQ.has(lw)) return "adjectif";
    if (/^[A-ZÀ-Ÿ]/.test(w)) return "nom_propre";
    return "nom";
  }

  // 2) Mots-outils en liste fermée
  if (DETERMINANTS.has(lw)) return "determinant";
  if (PRONOMS.has(lw)) return "pronom";
  if (PREPOSITIONS.has(lw)) return "preposition";
  if (CONJONCTIONS.has(lw)) return "conjonction";
  if (ADVERBES.has(lw)) return "adverbe";

  // 3) Verbes irréguliers connus
  if (VERBES_IRR.has(lw)) return "verbe";

  // 4) Adjectifs très fréquents
  if (ADJECTIFS_FREQ.has(lw)) return "adjectif";

  // 5) Nom propre : commence par une majuscule
  if (/^[A-ZÀ-Ÿ]/.test(w)) return "nom_propre";

  // 6) Adverbes en -ment (rapidement, doucement…)
  if (lwNa.endsWith("ment") && lwNa.length > 5) return "adverbe";

  // 7) Adjectifs : terminaisons typiques
  if (/(eux|euse|euses|if|ive|ives|ifs|able|ible|ique|iques|al|ale|aux|ales|el|elle|elles|els)$/.test(lwNa)) {
    return "adjectif";
  }

  // 8) Verbes à l'infinitif : -er / -ir / -re / -oir
  if (/(er|ir|re|oir)$/.test(lwNa) && lwNa.length >= 4) {
    // évite les noms en -ier (boulanger), -oir (miroir), -ure → laisse passer ici, c'est l'arbitrage
    // les noms sans article seront mal classés mais l'utilisateur peut corriger
    return "verbe";
  }

  // 9) Verbes conjugués courants : terminaisons -ait/-ais/-aient/-ons/-ez/-ent
  if (/(ait|ais|aient|ions|iez|ons|ez)$/.test(lwNa) && lwNa.length >= 4) {
    return "verbe";
  }

  // 10) Par défaut : nom commun (la classe la plus fréquente)
  return "nom";
}

// Génère 3 propositions (1 correcte + 2 distracteurs plausibles).
export function buildChoices(correct: GrammaticalClass): GrammaticalClass[] {
  const distractorMap: Record<GrammaticalClass, GrammaticalClass[]> = {
    nom: ["adjectif", "verbe"],
    nom_propre: ["nom", "adjectif"],
    verbe: ["nom", "adjectif"],
    adjectif: ["nom", "adverbe"],
    determinant: ["pronom", "preposition"],
    pronom: ["determinant", "nom"],
    adverbe: ["adjectif", "preposition"],
    preposition: ["conjonction", "adverbe"],
    conjonction: ["preposition", "adverbe"],
  };
  const choices = [correct, ...distractorMap[correct]];
  // Mélange déterministe basé sur le mot pour éviter que la bonne réponse soit toujours en 1ère position
  return choices;
}

// Mélange Fisher-Yates avec graine = mot (déterministe, mais varié d'un mot à l'autre)
export function shuffleChoices<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
