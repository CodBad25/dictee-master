/**
 * Script pour générer les données complètes des dictées
 * - Extrait les mots des ODT
 * - Utilise le dictionnaire complet de définitions adaptées aux 6èmes
 * - Génère des erreurs orthographiques réalistes
 * - Crée des textes à trous d'entraînement (pas les textes d'évaluation)
 */

const JSZip = require('jszip');
const fs = require('fs');
const path = require('path');

// Importer le dictionnaire complet de définitions
const { DEFINITIONS: FULL_DEFINITIONS } = require('./definitions-complete.js');

const ODT_DIR = path.join(__dirname, '../odt-sources');
const OUTPUT_FILE = path.join(__dirname, '../lib/dictees-data.ts');

// ============================================================
// FONCTION POUR TROUVER UNE DÉFINITION
// ============================================================
function findDefinition(word) {
  // Normaliser les apostrophes (Unicode ' vers ASCII ') et œ vers oe
  const normalized = word
    .replace(/[\u2019\u2018\u0027]/g, "'")  // Tous types d'apostrophes
    .replace(/œ/g, 'oe')                     // Ligature œ
    .replace(/Œ/g, 'Oe');

  // Essayer différentes variations du mot
  const variations = [
    word,                                           // Mot original
    normalized,                                     // Mot normalisé
    normalized.toLowerCase(),                       // Minuscules
    normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase(), // Première lettre majuscule
    normalized.replace(/^(le |la |l'|les |un |une |des |du )/i, ''), // Sans article
    normalized.replace(/^(le |la |l'|les |un |une |des |du )/i, '').toLowerCase(),
  ];

  // Ajouter les variations avec articles
  const withoutArticle = normalized.replace(/^(le |la |l'|les |un |une |des |du )/i, '');
  variations.push(
    `le ${withoutArticle}`,
    `la ${withoutArticle}`,
    `l'${withoutArticle}`,
    `les ${withoutArticle}`,
    `un ${withoutArticle}`,
    `une ${withoutArticle}`,
  );

  // Essayer chaque variation
  for (const v of variations) {
    if (FULL_DEFINITIONS[v]) {
      return FULL_DEFINITIONS[v];
    }
  }

  // Essayer avec le mot nettoyé (sans parenthèses et caractères spéciaux)
  const cleaned = normalized.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s*\/\s*.*/g, '').trim();
  if (cleaned !== normalized && FULL_DEFINITIONS[cleaned]) {
    return FULL_DEFINITIONS[cleaned];
  }

  return "";
}

// ============================================================
// DÉFINITIONS SUPPLÉMENTAIRES (pour compléter si nécessaire)
// ============================================================
const EXTRA_DEFINITIONS = {
  // Dictée 1-2
  "le héros": "Personnage principal et courageux d'une histoire",
  "une allée": "Chemin bordé d'arbres ou passage dans un jardin",
  "l'épaule": "Partie du corps entre le cou et le bras",
  "d'abord": "En premier, avant tout le reste",
  "dangereux": "Qui peut causer du mal ou un accident",
  "un aliment": "Ce qu'on mange pour se nourrir",
  "sept": "Le chiffre 7",
  "le corps": "L'ensemble de notre être physique",
  "la soirée": "Moment de la journée entre le soir et la nuit",
  "le cortège": "Groupe de personnes qui défilent ensemble",
  "une statue": "Sculpture représentant une personne ou un animal",
  "électrique": "Qui fonctionne avec l'électricité",
  "un canif": "Petit couteau de poche qui se replie",
  "la vague": "Mouvement de l'eau qui monte et descend",
  "une trappe": "Petite porte dans le sol ou le plafond",
  "ouvrir": "Faire en sorte qu'on puisse entrer ou voir dedans",
  "une pensée": "Idée qui vient dans notre esprit",
  "un amusement": "Activité qui fait plaisir et divertit",
  "tendrement": "Avec douceur et affection",
  "l'aventure": "Expérience excitante avec des risques",
  "le particulier": "Ce qui est spécial, propre à quelqu'un",
  "la jungle": "Grande forêt tropicale très dense",
  "ronger": "Manger en grattant avec les dents",
  "un berger": "Personne qui garde les moutons",
  "le marteau": "Outil pour enfoncer les clous",
  "amazonien": "Qui vient de la forêt d'Amazonie",
  "le dos": "Partie arrière du corps, de la nuque aux fesses",
  "le suivant": "Celui qui vient après",
  "le prochain": "Celui qui va arriver bientôt",
  "méchant": "Qui fait du mal aux autres volontairement",
  "voltiger": "Voler légèrement dans les airs",
  "la gelée": "Dessert tremblotant ou eau transformée par le froid",
  "s'évanouir": "Perdre connaissance pendant un moment",
  "parcourir": "Traverser un endroit en se déplaçant",
  "une invitation": "Message demandant à quelqu'un de venir",
  "un morceau": "Une partie d'un tout",
  "le cadeau": "Objet offert à quelqu'un pour lui faire plaisir",
  "un but": "Objectif qu'on veut atteindre",
  "un clairon": "Instrument de musique à vent en cuivre",
  "le pied": "Partie du corps au bout de la jambe",

  // Dictée 3-4
  "septembre": "Neuvième mois de l'année, rentrée des classes",
  "le cultivateur": "Personne qui travaille la terre",
  "le repos": "Moment où on ne fait rien pour récupérer",
  "le champ": "Grande étendue de terre cultivée",
  "bientôt": "Dans peu de temps",
  "le bœuf": "Gros animal de la ferme utilisé pour le travail",
  "le veau": "Petit de la vache",
  "aujourd'hui": "Ce jour, maintenant",
  "le ciel": "Espace au-dessus de nos têtes",
  "relativement": "De manière assez modérée",
  "calme": "Sans agitation, tranquille",
  "le vol": "Action de se déplacer dans les airs",
  "l'hirondelle": "Petit oiseau noir et blanc qui migre",
  "digne": "Qui mérite le respect",
  "l'étable": "Bâtiment où vivent les vaches",
  "détourner": "Faire changer de direction",
  "le spectacle": "Ce qu'on regarde, représentation",
  "rustique": "Simple, de la campagne",
  "l'hiver": "Saison froide de l'année",
  "la mare": "Petite étendue d'eau stagnante",
  "la mélodie": "Suite de notes qui forme un air agréable",
  "la grenouille": "Petit animal vert qui saute et vit près de l'eau",
  "le silence": "Absence de bruit",
  "admirable": "Qui mérite d'être admiré, très beau",
  "le tableau": "Peinture ou ce qu'on voit devant soi",
  "rappeler": "Faire revenir à la mémoire",
  "entendre": "Percevoir les sons avec les oreilles",
  "couper": "Séparer en morceaux avec un objet tranchant",

  // Dictée 5-6
  "un meurtre": "Action de tuer quelqu'un volontairement",
  "une pièce": "Salle d'une maison ou objet de monnaie",
  "la vertu": "Qualité morale, bonne conduite",
  "la propriété": "Ce qui appartient à quelqu'un",
  "la médaille": "Petit objet en métal donné comme récompense",
  "taire (se)": "Arrêter de parler, garder le silence",
  "la propreté": "État de ce qui est propre, sans saleté",
  "le duvet": "Plumes légères et douces des oiseaux",
  "bête": "Animal ou qui manque d'intelligence",
  "redire": "Dire une nouvelle fois",
  "un pinson": "Petit oiseau chanteur",
  "gentil": "Aimable et agréable avec les autres",
  "la morale": "Ensemble des règles de bonne conduite",
  "habituellement": "De façon normale, comme d'habitude",
  "le renouvellement": "Action de remplacer par du neuf",
  "le pelage": "Ensemble des poils d'un animal",
  "drôle": "Qui fait rire, amusant",
  "un grain": "Petite graine ou petite quantité",
  "une dette": "Argent qu'on doit à quelqu'un",
  "le manque": "Absence de quelque chose dont on a besoin",
  "accrocher": "Fixer quelque chose à un support",
  "l'huile": "Liquide gras utilisé en cuisine",
  "un propriétaire": "Personne à qui appartient quelque chose",
  "la fureur": "Très grande colère",
  "flou": "Pas net, difficile à voir clairement",
  "la police": "Service qui fait respecter la loi",
  "le poumon": "Organe qui sert à respirer",
  "plaire": "Être agréable à quelqu'un",
  "coucher (se)": "S'allonger pour dormir",
  "la queue": "Partie du corps à l'arrière des animaux",
  "le domicile": "Endroit où on habite",
  "à merveille": "Très bien, parfaitement",
  "le piano": "Grand instrument de musique à touches",
  "l'effroi": "Très grande peur",
  "le témoin": "Personne qui a vu quelque chose",
  "une démarche": "Façon de marcher ou action entreprise",
  "répartir": "Distribuer, partager entre plusieurs",
  "un mobile": "Raison qui pousse à agir",
  "approcher": "Venir plus près",
  "un régiment": "Groupe de soldats",

  // Dictée 7-8
  "la sécheresse": "Période sans pluie, manque d'eau",
  "l'incendie": "Grand feu qui détruit tout",
  "la forêt": "Grande étendue couverte d'arbres",
  "le pompier": "Personne qui éteint les feux",
  "lutter": "Se battre contre quelque chose",
  "le fléau": "Grande catastrophe, malheur",
  "détruire": "Abîmer complètement, démolir",
  "la végétation": "Ensemble des plantes d'un lieu",
  "le hectare": "Unité de mesure de surface (10 000 m²)",
  "brûler": "Être consumé par le feu",
  "la fumée": "Gaz gris qui sort du feu",
  "étouffer": "Ne plus pouvoir respirer",
  "le canadair": "Avion qui largue de l'eau sur les feux",
  "survoler": "Voler au-dessus de quelque chose",
  "la zone": "Espace délimité, région",
  "sinistré": "Touché par une catastrophe",
  "évacuer": "Faire partir les gens d'un endroit dangereux",
  "le habitant": "Personne qui vit dans un lieu",
  "la prudence": "Attention pour éviter les dangers",
  "recommander": "Conseiller fortement",

  // Dictée 11-12
  "le château": "Grande et belle maison fortifiée",
  "la tour": "Construction haute et étroite",
  "le donjon": "Tour principale d'un château fort",
  "le pont-levis": "Pont qui se lève pour protéger l'entrée",
  "la douves": "Fossé rempli d'eau autour du château",
  "le chevalier": "Guerrier à cheval au Moyen Âge",
  "l'armure": "Vêtement en métal pour se protéger",
  "le bouclier": "Objet pour se protéger des coups",
  "l'épée": "Arme longue et pointue",
  "le tournoi": "Compétition entre chevaliers",
  "le seigneur": "Noble qui possède des terres",
  "le vassal": "Personne au service d'un seigneur",
  "le paysan": "Personne qui cultive la terre",
  "la récolte": "Action de ramasser ce qui a poussé",
  "le moulin": "Bâtiment pour moudre le grain",
  "le forgeron": "Artisan qui travaille le métal",
  "la taverne": "Ancien café où on buvait et mangeait",
  "le marché": "Lieu où on vend des produits",
  "la cathédrale": "Très grande église",
  "le vitrail": "Fenêtre décorée de verres colorés",

  // Dictée 13-14
  "le navire": "Grand bateau",
  "la voile": "Tissu qui capte le vent sur un bateau",
  "le mât": "Grand poteau qui porte les voiles",
  "l'équipage": "Ensemble des personnes sur un bateau",
  "le capitaine": "Chef d'un navire",
  "la boussole": "Instrument qui indique le nord",
  "l'horizon": "Ligne où le ciel semble toucher la terre",
  "la tempête": "Très mauvais temps avec vent et pluie",
  "le naufrage": "Accident d'un bateau qui coule",
  "le phare": "Tour avec une lumière pour guider les bateaux",
  "le port": "Endroit où les bateaux s'arrêtent",
  "la cargaison": "Marchandises transportées par un bateau",
  "le trésor": "Richesses cachées",
  "la carte": "Dessin qui représente un lieu",
  "l'île": "Terre entourée d'eau",
  "le pirate": "Bandit qui attaque les bateaux",
  "le coffre": "Grande boîte pour ranger des choses",
  "la plage": "Bord de mer avec du sable",
  "le coquillage": "Carapace d'un mollusque marin",
  "le palmier": "Arbre des pays chauds avec de grandes feuilles",

  // Dictée 15-16
  "la planète": "Corps céleste qui tourne autour d'une étoile",
  "l'étoile": "Astre qui brille dans le ciel la nuit",
  "la lune": "Satellite naturel de la Terre",
  "le soleil": "Étoile qui éclaire et réchauffe la Terre",
  "la fusée": "Véhicule qui va dans l'espace",
  "l'astronaute": "Personne qui voyage dans l'espace",
  "la station": "Base dans l'espace où vivent des astronautes",
  "l'orbite": "Chemin d'un astre autour d'un autre",
  "la gravité": "Force qui attire les objets vers le sol",
  "le satellite": "Objet qui tourne autour d'une planète",
  "le télescope": "Instrument pour voir les étoiles",
  "la galaxie": "Immense groupe d'étoiles dans l'univers",
  "l'univers": "Tout ce qui existe dans l'espace",
  "le cratère": "Grand trou à la surface d'une planète",
  "l'atmosphère": "Couche d'air qui entoure une planète",
  "la comète": "Astre avec une longue queue brillante",
  "l'astéroïde": "Petit corps rocheux dans l'espace",
  "la constellation": "Groupe d'étoiles formant un dessin",
  "l'apesanteur": "Absence de poids dans l'espace",
  "le cosmos": "L'espace infini qui nous entoure",

  // Dictée 17-18
  "le dinosaure": "Grand reptile disparu il y a très longtemps",
  "le fossile": "Reste d'un être vivant conservé dans la roche",
  "le squelette": "Ensemble des os du corps",
  "le paléontologue": "Scientifique qui étudie les fossiles",
  "l'extinction": "Disparition totale d'une espèce",
  "le prédateur": "Animal qui chasse pour se nourrir",
  "la proie": "Animal chassé par un prédateur",
  "le carnivore": "Animal qui mange de la viande",
  "l'herbivore": "Animal qui mange des plantes",
  "le reptile": "Animal à sang froid avec des écailles",
  "la griffe": "Ongle pointu des animaux",
  "la queue": "Partie allongée à l'arrière du corps",
  "le museau": "Partie avant de la tête des animaux",
  "gigantesque": "Très très grand, immense",
  "féroce": "Très agressif et dangereux",
  "la météorite": "Roche venue de l'espace",
  "le volcan": "Montagne qui crache du feu et de la lave",
  "l'ère": "Très longue période de temps",
  "préhistorique": "Qui date d'avant l'écriture",
  "le musée": "Lieu où on expose des objets intéressants",

  // Dictée 19-20
  "le réseau": "Ensemble de lignes ou de connexions",
  "l'ordinateur": "Machine électronique pour travailler et jouer",
  "l'écran": "Surface où s'affichent les images",
  "le clavier": "Ensemble de touches pour écrire",
  "la souris": "Petit appareil pour cliquer sur l'écran",
  "le logiciel": "Programme qui fait fonctionner l'ordinateur",
  "le fichier": "Document enregistré sur l'ordinateur",
  "le dossier": "Endroit où on range les fichiers",
  "télécharger": "Copier un fichier depuis internet",
  "sauvegarder": "Enregistrer pour ne pas perdre",
  "le mot de passe": "Code secret pour se connecter",
  "le virus": "Programme qui abîme les ordinateurs",
  "la connexion": "Lien qui permet de communiquer",
  "le navigateur": "Programme pour aller sur internet",
  "le moteur de recherche": "Site pour trouver des informations",
  "le lien": "Texte cliquable qui mène à une autre page",
  "la messagerie": "Service pour envoyer des messages",
  "le profil": "Page personnelle sur un site",
  "partager": "Donner accès à d'autres personnes",
  "publier": "Mettre en ligne pour que tous voient",

  // Dictée 21-22
  "le climat": "Temps qu'il fait habituellement dans une région",
  "la température": "Mesure du chaud ou du froid",
  "le thermomètre": "Instrument pour mesurer la température",
  "la météo": "Prévision du temps qu'il va faire",
  "le nuage": "Masse de vapeur d'eau dans le ciel",
  "la pluie": "Eau qui tombe du ciel",
  "la neige": "Eau gelée qui tombe en flocons blancs",
  "le vent": "Air qui se déplace",
  "l'orage": "Tempête avec éclairs et tonnerre",
  "l'éclair": "Lumière vive pendant un orage",
  "le tonnerre": "Bruit fort pendant un orage",
  "l'arc-en-ciel": "Bande de couleurs dans le ciel après la pluie",
  "le brouillard": "Nuage près du sol qui empêche de voir",
  "la canicule": "Période de très forte chaleur",
  "la sécheresse": "Longue période sans pluie",
  "l'inondation": "Débordement d'eau qui envahit tout",
  "le cyclone": "Tempête très violente qui tourne",
  "la prévision": "Ce qu'on pense qu'il va se passer",
  "le réchauffement": "Augmentation de la température",
  "la pollution": "Saleté qui abîme l'environnement",

  // Dictée 23-24
  "le muscle": "Partie du corps qui permet de bouger",
  "l'os": "Partie dure du squelette",
  "le sang": "Liquide rouge qui circule dans le corps",
  "le cœur": "Organe qui fait circuler le sang",
  "le cerveau": "Organe dans la tête qui permet de penser",
  "le nerf": "Fil qui transmet les messages dans le corps",
  "la digestion": "Transformation des aliments dans le ventre",
  "l'estomac": "Poche où vont les aliments mangés",
  "l'intestin": "Long tube où finit la digestion",
  "le foie": "Organe qui nettoie le sang",
  "le rein": "Organe qui filtre et produit l'urine",
  "la respiration": "Action de faire entrer et sortir l'air",
  "l'oxygène": "Gaz dans l'air dont on a besoin pour vivre",
  "la circulation": "Déplacement du sang dans le corps",
  "l'artère": "Tube qui transporte le sang du cœur",
  "la veine": "Tube qui ramène le sang vers le cœur",
  "le vaccin": "Produit qui protège des maladies",
  "le microbe": "Être vivant minuscule, parfois dangereux",
  "la fièvre": "Température du corps plus élevée que normal",
  "guérir": "Retrouver la santé après une maladie",

  // Dictée 25-26
  "le continent": "Très grande étendue de terre",
  "l'océan": "Immense étendue d'eau salée",
  "la montagne": "Très haute élévation de terrain",
  "la vallée": "Espace entre deux montagnes",
  "le fleuve": "Grand cours d'eau qui va vers la mer",
  "la rivière": "Cours d'eau qui se jette dans un fleuve",
  "le lac": "Grande étendue d'eau entourée de terre",
  "le désert": "Région très sèche avec peu de vie",
  "la savane": "Grande plaine avec peu d'arbres",
  "la banquise": "Immense étendue de glace sur la mer",
  "l'équateur": "Ligne imaginaire au milieu de la Terre",
  "le pôle": "Point tout au nord ou tout au sud de la Terre",
  "la frontière": "Limite entre deux pays",
  "la capitale": "Ville principale d'un pays",
  "la population": "Ensemble des habitants d'un lieu",
  "le drapeau": "Tissu avec les couleurs d'un pays",
  "la langue": "Façon de parler d'un peuple",
  "la culture": "Traditions et façons de vivre d'un peuple",
  "le monument": "Construction remarquable à visiter",
  "le patrimoine": "Richesses héritées du passé",

  // Dictée 27-28
  "l'athlète": "Sportif qui fait de l'athlétisme",
  "le champion": "Celui qui gagne une compétition",
  "la médaille": "Récompense donnée aux gagnants",
  "le podium": "Estrade pour les trois premiers",
  "l'entraînement": "Exercices pour s'améliorer",
  "la performance": "Résultat obtenu dans un sport",
  "le record": "Meilleur résultat jamais obtenu",
  "le stade": "Grand terrain pour le sport",
  "la piste": "Chemin pour courir ou faire du vélo",
  "le marathon": "Course à pied très longue (42 km)",
  "le sprint": "Course très rapide sur courte distance",
  "le saut": "Action de s'élever du sol",
  "le lancer": "Action d'envoyer un objet loin",
  "la natation": "Sport de nager",
  "le plongeon": "Saut dans l'eau la tête la première",
  "l'équipe": "Groupe de joueurs qui jouent ensemble",
  "l'arbitre": "Personne qui fait respecter les règles",
  "le supporter": "Personne qui encourage une équipe",
  "la victoire": "Fait de gagner",
  "la défaite": "Fait de perdre",
};

// ============================================================
// ERREURS ORTHOGRAPHIQUES RÉALISTES
// ============================================================
function generateSpellingErrors(word) {
  const errors = new Set();
  const w = word.toLowerCase();

  // Substitutions phonétiques courantes
  const subs = [
    ['ai', ['é', 'è', 'ei']],
    ['é', ['ai', 'er', 'ez', 'ais', 'ait']],
    ['è', ['ai', 'e', 'ê']],
    ['eau', ['au', 'o', 'ô']],
    ['au', ['eau', 'o']],
    ['an', ['en', 'am', 'em']],
    ['en', ['an', 'am', 'em']],
    ['in', ['ain', 'ein', 'im', 'yn']],
    ['ain', ['in', 'ein']],
    ['on', ['om']],
    ['om', ['on']],
    ['ph', ['f']],
    ['f', ['ph']],
    ['qu', ['k', 'c']],
    ['k', ['c', 'qu']],
    ['tion', ['sion', 'ssion']],
    ['sion', ['tion', 'ssion']],
    ['mm', ['m']],
    ['nn', ['n']],
    ['tt', ['t']],
    ['ss', ['s']],
    ['ll', ['l']],
    ['rr', ['r']],
    ['pp', ['p']],
    ['ff', ['f']],
    ['cc', ['c']],
    ['gu', ['g']],
    ['ge', ['j']],
    ['oi', ['oua', 'wa']],
    ['ou', ['oo', 'u']],
    ['eur', ['eure', 'eurt']],
    ['eux', ['eu', 'euse']],
    ['ille', ['ile', 'ye']],
    ['eil', ['eille', 'eye']],
    ['euil', ['euille', 'oeil']],
    ['gn', ['ni', 'ign']],
    ['ç', ['ss', 's', 'c']],
    ['c', ['ss', 'ç']],
  ];

  // Appliquer les substitutions
  for (const [pattern, replacements] of subs) {
    if (w.includes(pattern)) {
      for (const r of replacements) {
        const err = w.replace(pattern, r);
        if (err !== w) errors.add(err);
      }
    }
  }

  // Oubli de la lettre finale muette
  if (w.match(/[stdxzp]$/)) {
    errors.add(w.slice(0, -1));
  }

  // Oubli ou ajout de 'e' final
  if (w.endsWith('e')) {
    errors.add(w.slice(0, -1));
  } else if (w.match(/[bcdfghjklmnpqrstvwxz]$/)) {
    errors.add(w + 'e');
  }

  // Oubli d'accent
  const noAccent = w
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ÿ]/g, 'y')
    .replace(/[ç]/g, 'c');
  if (noAccent !== w) errors.add(noAccent);

  // Mauvais accent
  if (w.includes('é')) errors.add(w.replace('é', 'è'));
  if (w.includes('è')) errors.add(w.replace('è', 'é'));

  // Doublement d'une consonne qui ne devrait pas l'être
  for (const c of 'bcdfglmnprst') {
    if (w.includes(c) && !w.includes(c + c)) {
      const idx = w.indexOf(c);
      if (idx > 0 && idx < w.length - 1) {
        errors.add(w.slice(0, idx + 1) + c + w.slice(idx + 1));
      }
    }
  }

  // Inversion de lettres
  if (w.length > 3) {
    for (let i = 1; i < w.length - 1; i++) {
      const chars = w.split('');
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
      errors.add(chars.join(''));
    }
  }

  // Filtrer et retourner
  return Array.from(errors)
    .filter(e => e !== w && e.length > 1)
    .slice(0, 4);
}

// ============================================================
// GÉNÉRATION DE PHRASES D'ENTRAÎNEMENT
// ============================================================
function generateTrainingSentences(words) {
  // Créer des phrases variées et naturelles pour l'entraînement
  const templates = [
    (w) => `Le mot _____ est important à retenir.`,
    (w) => `Aujourd'hui, j'apprends à écrire _____ correctement.`,
    (w) => `Dans cette dictée, le mot _____ est essentiel.`,
    (w) => `Peux-tu épeler le mot _____ ?`,
    (w) => `Le professeur nous a appris le mot _____.`,
    (w) => `Il faut bien retenir l'orthographe de _____.`,
    (w) => `Attention à bien écrire le mot _____.`,
    (w) => `N'oublie pas les lettres du mot _____.`,
  ];

  // Sélectionner 5 mots maximum pour les phrases
  const selectedWords = words.slice(0, Math.min(5, words.length));

  const sentences = selectedWords.map((word, i) => {
    const template = templates[i % templates.length];
    return template(word);
  });

  return sentences.join(' ');
}

// ============================================================
// EXTRACTION DES CELLULES DU TABLEAU ODT
// ============================================================
function extractTableCells(xml) {
  const cells = [];
  const cellPattern = /<table:table-cell[^>]*>([\s\S]*?)<\/table:table-cell>/g;

  let match;
  while ((match = cellPattern.exec(xml)) !== null) {
    const cellContent = match[1]
      .replace(/<[^>]+>/g, '')
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    cells.push(cellContent);
  }

  return cells;
}

// ============================================================
// EXTRACTION DES LISTES DE MOTS
// ============================================================
function extractWordListsFromCells(cells) {
  const list1 = [];
  const list2 = [];

  let startIndex = -1;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const nextCell = cells[i + 1];

    if (cell === 'n°1' && nextCell === 'n°2') {
      startIndex = i + 2;
      break;
    }
    if (cell && cell.match(/^Liste\s*\d+$/i) && nextCell && nextCell.match(/^Liste\s*\d+$/i)) {
      startIndex = i + 2;
      break;
    }
  }

  if (startIndex === -1) return { list1, list2 };

  for (let i = startIndex; i < cells.length; i += 2) {
    const word1 = cells[i];
    const word2 = cells[i + 1];

    if (word1 === 'n°1' || (word1 && word1.match(/^Liste\s*\d+$/i))) break;
    if (word2 === 'n°1' || (word2 && word2.match(/^Liste\s*\d+$/i))) break;

    if (word1 && word1.length > 1 && !word1.match(/^(n°|Liste)/i)) {
      list1.push(word1);
    }
    if (word2 && word2.length > 1 && !word2.match(/^(n°|Liste)/i)) {
      list2.push(word2);
    }
  }

  return {
    list1: [...new Set(list1)].slice(0, 20),
    list2: [...new Set(list2)].slice(0, 20),
  };
}

// ============================================================
// GÉNÉRATION DU CODE DE PARTAGE
// ============================================================
function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ============================================================
// PARSING D'UN FICHIER ODT
// ============================================================
async function parseODTFile(filePath) {
  const filename = path.basename(filePath);
  const file = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(file);

  const contentXml = await zip.file('content.xml')?.async('string');
  if (!contentXml) {
    throw new Error(`Fichier ODT invalide: ${filename}`);
  }

  const cells = extractTableCells(contentXml);
  const wordLists = extractWordListsFromCells(cells);

  const match = filename.match(/(\d+)\s*et\s*(\d+)/i);
  const num1 = match ? parseInt(match[1]) : 1;
  const num2 = match ? parseInt(match[2]) : 2;

  const dictees = [];

  // Dictée 1
  if (wordLists.list1.length > 0) {
    const words = wordLists.list1.map((word, i) => {
      return {
        word,
        definition: findDefinition(word),
        spellingErrors: generateSpellingErrors(word),
        position: i,
      };
    });

    dictees.push({
      id: `dictee-${num1}`,
      title: `Dictée n°${num1}`,
      shareCode: generateShareCode(),
      words,
      dictationText: "", // Pas de texte d'évaluation
      fillBlanksText: generateTrainingSentences(wordLists.list1),
    });
  }

  // Dictée 2
  if (wordLists.list2.length > 0) {
    const words = wordLists.list2.map((word, i) => {
      return {
        word,
        definition: findDefinition(word),
        spellingErrors: generateSpellingErrors(word),
        position: i,
      };
    });

    dictees.push({
      id: `dictee-${num2}`,
      title: `Dictée n°${num2}`,
      shareCode: generateShareCode(),
      words,
      dictationText: "",
      fillBlanksText: generateTrainingSentences(wordLists.list2),
    });
  }

  return dictees;
}

// ============================================================
// FONCTION PRINCIPALE
// ============================================================
async function main() {
  console.log('Génération des données complètes...\n');

  const files = fs.readdirSync(ODT_DIR).filter(f => f.endsWith('.odt'));
  const allDictees = [];

  for (const filename of files) {
    const filePath = path.join(ODT_DIR, filename);
    console.log(`  ${filename}`);

    try {
      const dictees = await parseODTFile(filePath);
      allDictees.push(...dictees);

      for (const d of dictees) {
        const withDef = d.words.filter(w => w.definition).length;
        console.log(`    -> ${d.title}: ${d.words.length} mots, ${withDef} définitions`);
      }
    } catch (error) {
      console.error(`    -> Erreur: ${error.message}`);
    }
  }

  // Trier par numéro
  allDictees.sort((a, b) => {
    const numA = parseInt(a.title.match(/\d+/)?.[0] || '0');
    const numB = parseInt(b.title.match(/\d+/)?.[0] || '0');
    return numA - numB;
  });

  // Stats
  const totalWords = allDictees.reduce((a, d) => a + d.words.length, 0);
  const totalDefs = allDictees.reduce((a, d) => a + d.words.filter(w => w.definition).length, 0);

  // Générer le fichier TypeScript
  const output = `// Fichier généré automatiquement - NE PAS MODIFIER
// Généré le ${new Date().toISOString()}
// ${allDictees.length} dictées, ${totalWords} mots, ${totalDefs} définitions

export interface DicteeWord {
  word: string;
  definition: string;
  spellingErrors: string[];
  position: number;
}

export interface DicteeData {
  id: string;
  title: string;
  shareCode: string;
  words: DicteeWord[];
  dictationText: string;
  fillBlanksText: string;
}

export const DICTEES_DATA: DicteeData[] = ${JSON.stringify(allDictees, null, 2)};

// Map pour accès rapide par code
export const DICTEES_BY_CODE: Map<string, DicteeData> = new Map(
  DICTEES_DATA.map(d => [d.shareCode, d])
);

// Fonction pour trouver une dictée par code
export function getDicteeByCode(code: string): DicteeData | undefined {
  return DICTEES_BY_CODE.get(code.toUpperCase());
}

// Fonction pour obtenir toutes les dictées
export function getAllDictees(): DicteeData[] {
  return DICTEES_DATA;
}
`;

  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`\n✓ ${allDictees.length} dictées générées`);
  console.log(`✓ ${totalWords} mots au total`);
  console.log(`✓ ${totalDefs} définitions (${Math.round(totalDefs/totalWords*100)}%)`);
  console.log(`✓ Fichier: ${OUTPUT_FILE}`);
}

main().catch(console.error);
