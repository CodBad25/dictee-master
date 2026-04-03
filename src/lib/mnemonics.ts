// Banque de règles mnémotechniques validées par des enseignants de français
// Sources : Bescherelle, Éducation Nationale, blogs enseignants
// Chaque catégorie d'erreur a un emoji dédié pour identification visuelle rapide

export interface MnemonicRule {
  id: string;
  category: string;
  icon: string;
  color: string; // Tailwind bg color
  title: string;
  tip: string;
}

// === CATÉGORIES D'ERREURS ===
// 🎯 Accent        — accent oublié ou mauvais
// 🔄 Confusion      — deux mots différents mélangés
// 🏷️ Genre         — erreur un/une (masculin/féminin)
// 👯 Double         — consonne double oubliée ou ajoutée
// 🤫 Muette         — lettre finale muette oubliée
// 💧 Terminaison    — terminaison -eau, -ée, -ment, etc.
// ✏️ é/er           — infinitif vs participe
// 🐍 s/ss           — confusion s et ss entre voyelles
// 🔀 Inversion      — lettres dans le mauvais ordre
// 📍 Homophones     — a/à, ou/où, etc.

const RULES: {
  test: (word: string, answer: string, definition?: string) => boolean;
  rule: MnemonicRule;
}[] = [
  // ===== 🔄 CONFUSION DE MOTS =====
  // Détecte quand la réponse est un mot réel différent du mot attendu
  // (distance d'édition faible + les deux existent)
  {
    test: (w, a) => {
      const wl = w.toLowerCase().replace(/^(le |la |l'|un |une |les |des |du )/g, "").trim();
      const al = a.toLowerCase().replace(/^(le |la |l'|un |une |les |des |du )/g, "").trim();
      // Mots complètement différents mais de longueur similaire
      if (wl === al) return false;
      if (Math.abs(wl.length - al.length) > 2) return false;
      // Au moins 3 lettres différentes = probable confusion de mots
      let diff = 0;
      for (let i = 0; i < Math.max(wl.length, al.length); i++) {
        if (wl[i] !== al[i]) diff++;
      }
      return diff >= 3 && al.length >= 3;
    },
    rule: {
      id: "confusion-mots",
      category: "Confusion",
      icon: "🔄",
      color: "bg-violet-50 border-violet-200 text-violet-800",
      title: "Confusion de mots",
      tip: "Ce mot existe mais ce n'est pas le bon ! Relis la définition.",
    },
  },

  // ===== 🏷️ ERREUR DE GENRE =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase();
      const al = a.toLowerCase();
      return (
        (wl.startsWith("un ") && al.startsWith("une ")) ||
        (wl.startsWith("une ") && al.startsWith("un ")) ||
        (wl.startsWith("le ") && al.startsWith("la ")) ||
        (wl.startsWith("la ") && al.startsWith("le "))
      );
    },
    rule: {
      id: "genre",
      category: "Genre",
      icon: "🏷️",
      color: "bg-pink-50 border-pink-200 text-pink-800",
      title: "Erreur de genre",
      tip: "Vérifie si le mot est masculin ou féminin — apprends-le avec son article.",
    },
  },

  // ===== 🎯 ACCENT SUR LE E =====
  {
    test: (w, a) => {
      const accented = (w.match(/[éèê]/g) || []).length;
      const plain = (a.match(/[éèê]/g) || []).length;
      return accented > plain;
    },
    rule: {
      id: "accent-e",
      category: "Accent",
      icon: "🎯",
      color: "bg-orange-50 border-orange-200 text-orange-800",
      title: "Accent oublié",
      tip: "Lis à voix haute : é = son fermé (café), è = son ouvert (père).",
    },
  },

  // ===== 📍 HOMOPHONES a/à =====
  {
    test: (w, a) =>
      (w.includes("à") && a.replace(/à/g, "a") === w.replace(/à/g, "a")) ||
      (w.includes(" a ") && a.includes(" à ")),
    rule: {
      id: "a-accent",
      category: "Homophones",
      icon: "📍",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      title: "a / à",
      tip: "Remplace par « avait » : si ça marche → pas d'accent.",
    },
  },

  // ===== 📍 HOMOPHONES ou/où =====
  {
    test: (w, a) =>
      (w.includes("où") && a.includes("ou") && !a.includes("où")) ||
      (w.includes("ou") && !w.includes("où") && a.includes("où")),
    rule: {
      id: "ou-accent",
      category: "Homophones",
      icon: "📍",
      color: "bg-blue-50 border-blue-200 text-blue-800",
      title: "ou / où",
      tip: "Remplace par « ou bien » : si ça marche → pas d'accent.",
    },
  },

  // ===== ✏️ CONFUSION é/er =====
  {
    test: (w, a) =>
      (w.endsWith("er") && a.endsWith("é")) ||
      (w.endsWith("é") && a.endsWith("er")) ||
      (w.endsWith("ier") && a.endsWith("ié")) ||
      (w.endsWith("ié") && a.endsWith("ier")),
    rule: {
      id: "er-e",
      category: "é/er",
      icon: "✏️",
      color: "bg-indigo-50 border-indigo-200 text-indigo-800",
      title: "é / er",
      tip: "Remplace par « prendre/pris » : j'aime manger → j'aime prendre = infinitif → er.",
    },
  },

  // ===== 💧 TERMINAISON -EAU =====
  {
    test: (w, a) => {
      return (
        (w.toLowerCase().endsWith("eau") && !a.toLowerCase().endsWith("eau") && a.toLowerCase().endsWith("au")) ||
        (w.toLowerCase().endsWith("eaux") && !a.toLowerCase().endsWith("eaux"))
      );
    },
    rule: {
      id: "terminaison-eau",
      category: "Terminaison",
      icon: "💧",
      color: "bg-cyan-50 border-cyan-200 text-cyan-800",
      title: "Terminaison -eau",
      tip: "Les mots en [o] s'écrivent souvent -eau : marteau, château, bateau.",
    },
  },

  // ===== 💧 TERMINAISON FÉMININE -ÉE =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase();
      const al = a.toLowerCase();
      return (
        (wl.endsWith("ée") && al.endsWith("é") && !al.endsWith("ée")) ||
        (wl.endsWith("ées") && al.endsWith("és"))
      );
    },
    rule: {
      id: "feminin-ee",
      category: "Terminaison",
      icon: "💧",
      color: "bg-cyan-50 border-cyan-200 text-cyan-800",
      title: "Féminin en -ée",
      tip: "Noms féminins en [e] → -ée : pensée, idée, dictée, arrivée.",
    },
  },

  // ===== 💧 ADVERBE EN -MENT =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase();
      const al = a.toLowerCase();
      return (
        (wl.endsWith("ment") && al.endsWith("mant")) ||
        (wl.endsWith("ment") && al.endsWith("mant"))
      );
    },
    rule: {
      id: "adverbe-ment",
      category: "Terminaison",
      icon: "💧",
      color: "bg-cyan-50 border-cyan-200 text-cyan-800",
      title: "Adverbe en -ment",
      tip: "Les adverbes se terminent par -ment (pas -mant) : tendrement, doucement.",
    },
  },

  // ===== 👯 CONSONNE DOUBLE — nourrir =====
  {
    test: (w, a) =>
      w.toLowerCase().includes("nourr") && !a.toLowerCase().includes("nourr"),
    rule: {
      id: "nourrir",
      category: "Double",
      icon: "👯",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      title: "Nourrir → 2 r",
      tip: "On se nourrit plusieurs fois par jour → deux r.",
    },
  },

  // ===== 👯 CONSONNE DOUBLE — mourir =====
  {
    test: (w, a) =>
      w.toLowerCase().includes("mourir") && a.toLowerCase().includes("mourrir"),
    rule: {
      id: "mourir",
      category: "Double",
      icon: "👯",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      title: "Mourir → 1 r",
      tip: "On ne meurt qu'une fois → un seul r.",
    },
  },

  // ===== 👯 CONSONNE DOUBLE — générique =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase();
      const al = a.toLowerCase();
      // Cherche une double consonne dans le mot correct absente de la réponse
      const doubles = wl.match(/([bcdfghlmnprst])\1/g);
      if (!doubles) return false;
      for (const d of doubles) {
        if (!al.includes(d) && al.includes(d[0])) return true;
      }
      // Ou une double consonne ajoutée à tort
      const doubleAnswer = al.match(/([bcdfghlmnprst])\1/g);
      if (doubleAnswer) {
        for (const d of doubleAnswer) {
          if (!wl.includes(d)) return true;
        }
      }
      return false;
    },
    rule: {
      id: "double-consonne",
      category: "Double",
      icon: "👯",
      color: "bg-emerald-50 border-emerald-200 text-emerald-800",
      title: "Consonne double",
      tip: "Prononce le mot lentement — la consonne double s'entend parfois (trappe, balle).",
    },
  },

  // ===== 🤫 LETTRE MUETTE FINALE =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase().replace(/^(le |la |l'|un |une )/g, "").trim();
      const al = a.toLowerCase().replace(/^(le |la |l'|un |une )/g, "").trim();
      // La réponse est le mot sans la dernière lettre (muette)
      if (al === wl.slice(0, -1) && /[stxdpz]$/.test(wl)) return true;
      // Ou la dernière lettre manque
      if (wl.length - al.length === 1 && wl.startsWith(al) && /[stxdpz]$/.test(wl)) return true;
      return false;
    },
    rule: {
      id: "lettre-muette",
      category: "Muette",
      icon: "🤫",
      color: "bg-gray-100 border-gray-300 text-gray-700",
      title: "Lettre muette finale",
      tip: "Cherche un mot de la même famille pour retrouver la lettre : dos → dorsal, bras → brassard.",
    },
  },

  // ===== 🐍 S / SS =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase();
      const al = a.toLowerCase();
      return (
        (wl.includes("ss") && al.includes("s") && !al.includes("ss")) ||
        (!wl.includes("ss") && al.includes("ss"))
      );
    },
    rule: {
      id: "s-ss",
      category: "s/ss",
      icon: "🐍",
      color: "bg-lime-50 border-lime-200 text-lime-800",
      title: "s / ss",
      tip: "Entre deux voyelles : ss = [s] (poisson), un seul s = [z] (poison).",
    },
  },

  // ===== 🔀 INVERSION DE LETTRES =====
  {
    test: (w, a) => {
      const wl = w.toLowerCase().replace(/^(le |la |l'|un |une )/g, "").trim();
      const al = a.toLowerCase().replace(/^(le |la |l'|un |une )/g, "").trim();
      if (wl.length !== al.length) return false;
      if (wl === al) return false;
      // Exactement 2 lettres inversées (transposition adjacente)
      let diffs: number[] = [];
      for (let i = 0; i < wl.length; i++) {
        if (wl[i] !== al[i]) diffs.push(i);
      }
      return (
        diffs.length === 2 &&
        diffs[1] - diffs[0] === 1 &&
        wl[diffs[0]] === al[diffs[1]] &&
        wl[diffs[1]] === al[diffs[0]]
      );
    },
    rule: {
      id: "inversion",
      category: "Inversion",
      icon: "🔀",
      color: "bg-amber-50 border-amber-200 text-amber-800",
      title: "Lettres inversées",
      tip: "Tu as inversé deux lettres — relis le mot lentement, syllabe par syllabe.",
    },
  },
];

/**
 * Trouve une règle mnémotechnique applicable à une erreur.
 * Retourne la règle + éventuellement la définition si c'est une confusion de mots.
 */
export function findMnemonicForError(
  correctWord: string,
  studentAnswer: string,
  definition?: string
): (MnemonicRule & { definition?: string }) | null {
  for (const { test, rule } of RULES) {
    try {
      if (test(correctWord, studentAnswer, definition)) {
        // Pour les confusions de mots, ajouter la définition
        if (rule.id === "confusion-mots" && definition) {
          return { ...rule, definition, tip: `Sens : ${definition}` };
        }
        return rule;
      }
    } catch {
      // Ignorer les erreurs
    }
  }
  return null;
}

/**
 * Résumé des catégories d'erreurs (pour affichage sur les cartes)
 */
export function summarizeErrors(
  answers: { word: string; userAnswer: string; isCorrect: boolean; definition?: string }[]
): { icon: string; category: string; count: number; color: string }[] {
  const counts: Record<string, { icon: string; category: string; count: number; color: string }> = {};

  for (const a of answers) {
    if (a.isCorrect) continue;
    const rule = findMnemonicForError(a.word, a.userAnswer, a.definition);
    if (rule) {
      const key = rule.category;
      if (!counts[key]) {
        counts[key] = { icon: rule.icon, category: rule.category, count: 0, color: rule.color };
      }
      counts[key].count++;
    }
  }

  return Object.values(counts).sort((a, b) => b.count - a.count);
}
