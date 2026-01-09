/**
 * Version de l'application et changelog
 */

export const APP_VERSION = "1.2.8";

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.2.8",
    date: "2026-01-09",
    changes: [
      "Dashboard enseignant : interface compacte et reorganisee",
      "Stats en 4 colonnes au lieu de 2x2",
      "Stats par liste avec mots rates combines",
      "Classement et sessions recentes cote a cote",
      "Section 'Toutes les sessions' repliable",
    ],
  },
  {
    version: "1.2.7",
    date: "2026-01-09",
    changes: [
      "Historique eleve reorganise : resultats groupes par liste",
      "Affiche le record et le nombre d'essais par liste",
      "Cliquer sur une liste pour voir toutes les tentatives",
      "Badge 'Maitrise' pour les listes a 100%",
    ],
  },
  {
    version: "1.2.6",
    date: "2026-01-09",
    changes: [
      "Correction bug : les sessions sont maintenant toujours sauvegardees localement",
      "L'historique s'affiche meme si Supabase echoue",
    ],
  },
  {
    version: "1.2.5",
    date: "2026-01-09",
    changes: [
      "Interface eleve : champ de saisie beaucoup plus grand (text-6xl)",
      "Interface eleve : instruction plus visible",
    ],
  },
  {
    version: "1.2.4",
    date: "2026-01-09",
    changes: [
      "Historique eleve : nouvelles cartes detaillees avec score, duree, apercu des mots",
      "Dashboard enseignant : statistiques par liste (nb eleves, sessions, mots rates)",
      "Dashboard enseignant : affiche mots a revoir par liste",
    ],
  },
  {
    version: "1.2.3",
    date: "2026-01-09",
    changes: [
      "Ecran resultat eleve : affiche les mots a revoir avec la bonne reponse",
      "Ecran resultat eleve : affiche les mots reussis",
      "Ecran setup : affiche la progression (record, dernier score, tendance)",
      "Interface eleve : polices agrandies pour meilleure lisibilite",
    ],
  },
  {
    version: "1.2.2",
    date: "2026-01-09",
    changes: [
      "Import ODT : correction du parsing des colonnes fusionnees (colspan)",
      "Import ODT : detection correcte des listes n°1 et n°2 avec leurs mots",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-01-09",
    changes: [
      "Mode local : creation de listes fonctionne meme sans connexion Supabase",
      "Badge version cliquable pour voir les nouveautes",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-01-09",
    changes: [
      "Ecran resultat eleve : affiche les mots a revoir avec les phases echouees",
      "Ecran resultat eleve : affiche les mots parfaits (reussis partout)",
      "Ecran setup : affiche la progression sur la liste (record, dernier score, tendance)",
      "Dashboard prof : toujours visible au demarrage avec les sessions recentes",
      "Dashboard prof : clic sur une session pour voir le detail des erreurs",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-01-08",
    changes: [
      "Import ODT : support des formats n°1, n°2 pour les en-tetes",
      "Import ODT : correction du parsing des cellules de tableau",
      "Nettoyage des articles : correction du bug 'e pensee' -> 'pensee'",
      "Interface eleve : police agrandie pour meilleure lisibilite",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-07",
    changes: [
      "Version initiale",
      "Mode flashcard, audio, choix orthographique, dictee a trous",
      "Import de listes depuis fichiers ODT/PDF",
      "Sauvegarde des sessions dans Supabase",
      "Gamification : streak et badges",
    ],
  },
];
