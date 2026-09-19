// Journal « Nouveautés » affiché aux enseignants (bouton ✨ dans la barre
// violette, pastille de non-lues, toast à la connexion).
//
// Convention (identique aux sites de maths) : plus récent EN PREMIER ; une
// nouveauté est ajoutée dans le MÊME commit que la fonctionnalité, rédigée
// en langage collègue (ce que ça change pour elle, où le trouver), sans jargon.
// L'id est stable : il sert de curseur de lecture en base (dm_nouveautes_vues).

export type NouveauteAction =
  | "parcours-lexique"   // ouvre 🎯 Parcours → 1re dictée → Personnaliser les mots → onglet 🧩
  | "parcours"           // ouvre 🎯 Parcours
  | "tour";              // relance la visite guidée

export interface Nouveaute {
  id: string;            // ex. "2026-09-19-famille-synonymes"
  date: string;          // AAAA-MM-JJ
  titre: string;
  description: string;   // 2-4 phrases, en langage collègue
  icone?: string;        // emoji (défaut ✨)
  action?: NouveauteAction;
  actionLibelle?: string; // défaut : « Ouvrir »
}

export const NOUVEAUTES: Nouveaute[] = [
  {
    id: "2026-09-19-famille-synonymes",
    date: "2026-09-19",
    icone: "🧩",
    titre: "Mots de la même famille et synonymes : à relire et valider",
    description:
      "Pour chaque mot des 16 dictées de 5e, l'application propose des mots de la même famille et des synonymes (160 mots, rédigés par l'IA à partir de tes définitions puis relus). Rien n'est encore montré aux élèves : tu relis chaque mot dans 🎯 Parcours → une dictée → Personnaliser les mots → onglet 🧩 Famille/syn., tu retires ou ajoutes ce que tu veux (croix et « + ajouter »), puis tu cliques « Valider » — ou « Valider les 10 mots » pour toute la dictée. Le futur exercice élève n'utilisera que les mots validés.",
    action: "parcours-lexique",
    actionLibelle: "Ouvrir l'onglet 🧩",
  },
  {
    id: "2026-09-12-commentaires-erreurs",
    date: "2026-09-12",
    icone: "💬",
    titre: "Commentaires d'erreurs : masqués par défaut, activables par classe",
    description:
      "Les explications automatiques affichées à l'élève après une dictée (« accent oublié », « doublement de consonne »…) étaient parfois fausses. Elles sont désormais masquées côté élève, sauf si tu les actives pour une classe dans 🎯 Parcours (chip 💬 Commentaires d'erreurs). Côté prof, elles restent toujours visibles dans la fiche élève : c'est un outil de diagnostic.",
    action: "parcours",
    actionLibelle: "Ouvrir le Parcours",
  },
  {
    id: "2026-09-12-melange-classes-grammaticales",
    date: "2026-09-12",
    icone: "🔤",
    titre: "Classes grammaticales : les mots sont mélangés",
    description:
      "L'exercice suivait l'ordre des listes, saisies par classe grammaticale (tous les verbes, puis tous les adjectifs…), ce qui donnait la réponse. Les mots sont maintenant tirés dans un ordre aléatoire, y compris quand l'élève refait l'exercice ou refait ses erreurs.",
  },
  {
    id: "2026-09-12-genre-dictionnaire-masques",
    date: "2026-09-12",
    icone: "🏷️",
    titre: "Exercices Genre et Dictionnaire retirés du parcours par défaut",
    description:
      "Ces deux exercices ne sont plus proposés aux élèves des nouvelles classes. Ils ne sont pas supprimés : dans 🎯 Parcours, un clic sur leur ligne les réactive pour une classe.",
    action: "parcours",
    actionLibelle: "Ouvrir le Parcours",
  },
  {
    id: "2026-08-29-corpus-5e",
    date: "2026-08-29",
    icone: "📚",
    titre: "Niveau 5e : 16 dictées avec leur audio",
    description:
      "Les classes de 5e ont leur propre corpus de 16 dictées (point d'orthographe, thème lexical et mot-étoile pour chacune), avec les MP3 de la dictée complète. Une classe dont le nom commence par 5 voit automatiquement ce corpus, les 6e gardent le leur.",
  },
];
