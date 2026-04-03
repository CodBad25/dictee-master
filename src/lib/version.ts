/**
 * Version de l'application et changelog
 */

export const APP_VERSION = "2.0.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2.0.0",
    date: "2026-04-03",
    changes: [
      "Grille de 26 dictées avec verrouillage progressif",
      "Parcours imposé : flashcard → choix ortho → définitions → texte à trous → audio",
      "Catégories d'erreurs visuelles (🎯🔄🏷️👯🤫💧✏️🐍🔀📍)",
      "Mnémotechniques validés par les enseignants",
      "Historique complet avec progression + mots persistants",
      "Dashboard enseignant façon MathExpress",
      "XP + Niveaux + Étoiles + Badges + Certificats",
      "Anonymisation avec écrivain(e)s célèbres",
      "Bilan de classe interactif + PDF + Pronote + Excel",
      "Auth Hub + PIN (élève) + mot de passe serveur (enseignant)",
    ],
  },
  {
    version: "1.4.0",
    date: "2026-01-10",
    changes: [
      "Nouveau mode : Definitions (associer mot et definition)",
      "Définitions générées par IA adaptees au niveau 6eme",
      "Interface clic-pour-associer intuitive",
    ],
  },
  {
    version: "1.3.0",
    date: "2026-01-10",
    changes: [
      "Dictée à trous : textes generes beaucoup plus coherents (niveau 6eme)",
      "Dictée à trous : meilleure voix française pour la synthese vocale",
      "Choix orthographique : erreurs plus réalistes (infirmier -> infirmie)",
      "Erreurs priorisées : terminaisons, accents, homophones en premier",
      "Prompt IA amélioré pour des dictées plus naturelles",
    ],
  },
  {
    version: "1.2.9",
    date: "2026-01-09",
    changes: [
      "Bouton Sync : synchronise les sessions locales vers Supabase",
      "Les sessions faites hors-ligne sont maintenant récupérables",
    ],
  },
  {
    version: "1.2.8",
    date: "2026-01-09",
    changes: [
      "Dashboard enseignant : interface compacte et réorganisée",
      "Stats en 4 colonnes au lieu de 2x2",
      "Stats par liste avec mots rates combines",
      "Classement et sessions recentes côte à côte",
      "Section 'Toutes les sessions' repliable",
    ],
  },
  {
    version: "1.2.7",
    date: "2026-01-09",
    changes: [
      "Historique eleve reorganise : resultats groupés par liste",
      "Affiche le record et le nombre d'essais par liste",
      "Cliquer sur une liste pour voir toutes les tentatives",
      "Badge 'Maîtrise' pour les listes a 100%",
    ],
  },
  {
    version: "1.2.6",
    date: "2026-01-09",
    changes: [
      "Correction bug : les sessions sont maintenant toujours sauvegardées localement",
      "L'historique s'affiche meme si Supabase échoue",
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
      "Interface eleve : polices agrandies pour meilleure lisibilité",
    ],
  },
  {
    version: "1.2.2",
    date: "2026-01-09",
    changes: [
      "Import ODT : correction du parsing des colonnes fusionnées (colspan)",
      "Import ODT : détection correcte des listes n°1 et n°2 avec leurs mots",
    ],
  },
  {
    version: "1.2.1",
    date: "2026-01-09",
    changes: [
      "Mode local : creation de listes fonctionne même sans connexion Supabase",
      "Badge version cliquable pour voir les nouveautes",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-01-09",
    changes: [
      "Ecran resultat eleve : affiche les mots a revoir avec les phases échouees",
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
      "Import ODT : support des formats n°1, n°2 pour les en-têtes",
      "Import ODT : correction du parsing des cellules de tableau",
      "Nettoyage des articles : correction du bug 'é pensée' -> 'pensee'",
      "Interface eleve : police agrandie pour meilleure lisibilité",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-01-07",
    changes: [
      "Version initiale",
      "Mode flashcard, audio, choix orthographique, dictée à trous",
      "Import de listes depuis fichiers ODT/PDF",
      "Sauvegarde des sessions dans Supabase",
      "Gamification : streak et badges",
    ],
  },
];
