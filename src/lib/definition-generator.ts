/**
 * Générateur de définitions pour les mots
 * Utilise l'IA pour créer des définitions adaptées au niveau 6ème
 */

export interface WordDefinition {
  word: string;
  definition: string;
}

/**
 * Génère des définitions pour une liste de mots via l'API DeepSeek
 */
export async function generateDefinitions(
  words: string[],
  apiKey: string
): Promise<WordDefinition[]> {
  console.log('[Definitions] API Key present:', !!apiKey, 'Words:', words);

  if (!apiKey) {
    console.log('[Definitions] No API key, using fallback');
    return generateFallbackDefinitions(words);
  }

  try {
    console.log('[Definitions] Calling DeepSeek API...');
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `Tu es un professeur de français qui crée des définitions de vocabulaire pour des élèves de 6ème (11-12 ans).

CONSIGNES STRICTES :
1. Chaque définition doit être COURTE (10-15 mots maximum)
2. Utilise un vocabulaire SIMPLE adapté aux 6èmes
3. La définition doit être PRÉCISE et CORRECTE (comme un dictionnaire)
4. Commence directement par le type de mot si pertinent (Nom, Verbe, Adjectif...)
5. Pas de phrases d'exemple, juste la définition
6. JAMAIS d'erreur de sens - la définition doit être exacte

FORMAT DE RÉPONSE (JSON strict) :
[
  {"word": "mot1", "definition": "définition courte et précise"},
  {"word": "mot2", "definition": "définition courte et précise"}
]

EXEMPLES de bonnes définitions niveau 6ème :
- héros : "Personnage principal d'une histoire, souvent courageux"
- jungle : "Grande forêt dense des régions tropicales"
- canif : "Petit couteau de poche dont la lame se replie"
- dangereux : "Qui peut causer du mal ou des accidents"`,
          },
          {
            role: 'user',
            content: `Génère les définitions pour ces mots : ${words.join(', ')}

Réponds UNIQUEMENT avec le JSON, sans commentaire.`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.3, // Basse température pour plus de précision
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Definitions] API Error:', response.status, errorText);
      return generateFallbackDefinitions(words);
    }

    const data = await response.json();
    console.log('[Definitions] API Response received');
    const content = data.choices[0]?.message?.content || '';

    // Parser le JSON
    try {
      // Nettoyer le contenu (enlever les backticks markdown si présents)
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const definitions: WordDefinition[] = JSON.parse(cleanContent);
      console.log('[Definitions] Parsed definitions:', definitions);

      // Vérifier que tous les mots ont une définition
      const result: WordDefinition[] = words.map(word => {
        const found = definitions.find(
          d => d.word.toLowerCase() === word.toLowerCase()
        );
        return found || { word, definition: `Mot de vocabulaire à apprendre` };
      });

      return result;
    } catch (parseError) {
      console.error('[Definitions] Error parsing JSON:', parseError, 'Content:', content);
      return generateFallbackDefinitions(words);
    }
  } catch (error) {
    console.error('[Definitions] Network error:', error);
    return generateFallbackDefinitions(words);
  }
}

/**
 * Génère des définitions de secours basiques
 * Base de données étendue de définitions niveau 6ème
 */
function generateFallbackDefinitions(words: string[]): WordDefinition[] {
  const knownDefinitions: Record<string, string> = {
    // Noms communs
    'héros': 'Personnage principal courageux d\'une histoire',
    'jungle': 'Grande forêt dense des régions tropicales',
    'canif': 'Petit couteau de poche dont la lame se replie',
    'statue': 'Sculpture représentant une personne ou un animal',
    'marteau': 'Outil avec un manche et une tête pour frapper',
    'aventure': 'Événement imprévu, souvent excitant',
    'trappe': 'Ouverture dans un plancher fermée par un panneau',
    'épaule': 'Partie du corps entre le cou et le bras',
    'corps': 'Ensemble des parties physiques d\'un être vivant',
    'berger': 'Personne qui garde les moutons',
    'gelée': 'Eau transformée en glace par le froid',
    'invitation': 'Action de demander à quelqu\'un de venir',
    'morceau': 'Partie séparée d\'un tout',
    'clairon': 'Instrument de musique à vent en cuivre',
    'cadeau': 'Objet offert à quelqu\'un pour lui faire plaisir',
    'but': 'Ce que l\'on cherche à atteindre',
    'pied': 'Partie du corps au bout de la jambe',
    'allée': 'Chemin bordé d\'arbres ou dans un jardin',
    'soirée': 'Partie de la journée entre le soir et la nuit',
    'aliment': 'Ce qui sert de nourriture aux êtres vivants',
    'animal': 'Être vivant qui peut se déplacer',
    'arbre': 'Grande plante avec un tronc en bois',
    'maison': 'Bâtiment où l\'on habite',
    'école': 'Lieu où l\'on apprend et étudie',
    'livre': 'Ensemble de pages reliées contenant un texte',
    'famille': 'Groupe de personnes unies par le sang',
    'ami': 'Personne que l\'on aime bien et en qui on a confiance',
    'jour': 'Période de 24 heures ou temps de lumière',
    'nuit': 'Période sans lumière du soleil',
    'eau': 'Liquide transparent nécessaire à la vie',
    'terre': 'Sol sur lequel on marche, ou notre planète',
    'ciel': 'Espace au-dessus de nos têtes',
    'soleil': 'Étoile qui nous éclaire et nous réchauffe',
    'lune': 'Astre qui tourne autour de la Terre',
    'mer': 'Grande étendue d\'eau salée',
    'montagne': 'Relief très élevé du sol',
    'forêt': 'Grand terrain couvert d\'arbres',
    'fleur': 'Partie colorée d\'une plante',
    'oiseau': 'Animal à plumes qui peut voler',
    'chien': 'Animal domestique fidèle à l\'homme',
    'chat': 'Petit animal domestique qui miaule',
    'voiture': 'Véhicule à moteur pour se déplacer',
    'train': 'Moyen de transport sur rails',
    'avion': 'Appareil volant avec des ailes',
    'bateau': 'Véhicule qui flotte sur l\'eau',
    'route': 'Voie de circulation pour les véhicules',
    'rue': 'Voie bordée de maisons en ville',
    'village': 'Petit groupe d\'habitations à la campagne',
    'ville': 'Grande agglomération avec beaucoup d\'habitants',
    'pays': 'Territoire avec ses habitants et son gouvernement',
    'monde': 'La Terre et tout ce qui s\'y trouve',
    'histoire': 'Récit d\'événements passés ou imaginaires',
    'temps': 'Durée qui passe ou conditions météorologiques',
    'travail': 'Activité pour gagner sa vie ou effort fourni',
    'jeu': 'Activité pour s\'amuser',
    'musique': 'Art des sons organisés de façon harmonieuse',
    'chanson': 'Texte mis en musique que l\'on chante',
    'film': 'Suite d\'images animées racontant une histoire',
    'image': 'Représentation visuelle de quelque chose',
    'couleur': 'Impression produite par la lumière sur l\'œil',
    'forme': 'Aspect extérieur d\'un objet',
    'taille': 'Dimension d\'une personne ou d\'un objet',
    'prix': 'Ce que coûte quelque chose',
    'argent': 'Métal précieux ou monnaie pour acheter',
    'question': 'Demande pour obtenir une information',
    'réponse': 'Ce qu\'on dit quand on nous interroge',
    'problème': 'Difficulté à résoudre',
    'solution': 'Moyen de résoudre un problème',
    'exemple': 'Cas qui sert à illustrer une règle',
    'idée': 'Pensée, conception de l\'esprit',
    'raison': 'Faculté de penser ou motif d\'une action',
    'vérité': 'Ce qui est conforme à la réalité',
    'mensonge': 'Affirmation contraire à la vérité',
    'secret': 'Ce que l\'on ne doit pas révéler',
    'surprise': 'Événement inattendu',
    'chance': 'Hasard favorable',
    'malheur': 'Événement triste et pénible',
    'bonheur': 'État de grande satisfaction',
    'peur': 'Sentiment face à un danger',
    'courage': 'Force de surmonter sa peur',
    'force': 'Puissance physique ou morale',
    'faiblesse': 'Manque de force ou de résistance',
    // Adjectifs
    'dangereux': 'Qui peut causer du mal ou des accidents',
    'électrique': 'Qui fonctionne grâce à l\'électricité',
    'grand': 'De taille importante',
    'petit': 'De taille réduite',
    'beau': 'Agréable à regarder',
    'laid': 'Désagréable à regarder',
    'bon': 'De qualité, agréable au goût',
    'mauvais': 'De mauvaise qualité, désagréable',
    'chaud': 'À température élevée',
    'froid': 'À basse température',
    'nouveau': 'Qui existe depuis peu',
    'ancien': 'Qui existe depuis longtemps',
    'jeune': 'Qui n\'est pas âgé',
    'vieux': 'Qui a beaucoup d\'âge',
    'rapide': 'Qui va vite',
    'lent': 'Qui va doucement',
    'facile': 'Qui ne demande pas d\'effort',
    'difficile': 'Qui demande beaucoup d\'effort',
    'possible': 'Qui peut se faire',
    'impossible': 'Qui ne peut pas se faire',
    'vrai': 'Conforme à la réalité',
    'faux': 'Contraire à la réalité',
    'content': 'Qui éprouve de la satisfaction',
    'triste': 'Qui éprouve du chagrin',
    'gentil': 'Aimable et agréable avec les autres',
    'méchant': 'Qui fait du mal aux autres',
    'fort': 'Qui a beaucoup de force',
    'faible': 'Qui manque de force',
    'heureux': 'Qui ressent du bonheur',
    'malheureux': 'Qui ressent du malheur',
    // Verbes
    'parcourir': 'Traverser un lieu dans toute son étendue',
    'ouvrir': 'Faire qu\'une chose ne soit plus fermée',
    'ronger': 'User peu à peu avec les dents',
    'voltiger': 'Voler de façon légère, en changeant de direction',
    'manger': 'Prendre de la nourriture',
    'boire': 'Avaler un liquide',
    'dormir': 'Se reposer les yeux fermés',
    'marcher': 'Se déplacer à pied',
    'courir': 'Se déplacer rapidement à pied',
    'sauter': 'S\'élever du sol par un mouvement brusque',
    'nager': 'Se déplacer dans l\'eau',
    'voler': 'Se déplacer dans l\'air',
    'tomber': 'Aller de haut en bas sans le vouloir',
    'monter': 'Aller vers le haut',
    'descendre': 'Aller vers le bas',
    'entrer': 'Aller à l\'intérieur',
    'sortir': 'Aller à l\'extérieur',
    'partir': 'S\'en aller, quitter un lieu',
    'arriver': 'Atteindre un lieu',
    'rester': 'Demeurer au même endroit',
    'chercher': 'Essayer de trouver',
    'trouver': 'Découvrir ce qu\'on cherchait',
    'perdre': 'Ne plus avoir ce qu\'on possédait',
    'gagner': 'Obtenir par la victoire ou le travail',
    'donner': 'Offrir quelque chose à quelqu\'un',
    'prendre': 'Saisir avec la main',
    'mettre': 'Placer à un endroit',
    'voir': 'Percevoir avec les yeux',
    'regarder': 'Diriger ses yeux vers quelque chose',
    'entendre': 'Percevoir par l\'oreille',
    'écouter': 'Prêter attention à un son',
    'parler': 'Dire des mots, s\'exprimer',
    'dire': 'Exprimer par la parole',
    'lire': 'Comprendre un texte écrit',
    'écrire': 'Tracer des lettres, rédiger',
    'apprendre': 'Acquérir des connaissances',
    'comprendre': 'Saisir le sens de quelque chose',
    'savoir': 'Avoir des connaissances',
    'connaître': 'Avoir dans sa mémoire',
    'penser': 'Former des idées dans son esprit',
    'croire': 'Tenir pour vrai',
    'aimer': 'Avoir de l\'affection pour',
    'détester': 'Ne pas aimer du tout',
    'vouloir': 'Avoir le désir de',
    'pouvoir': 'Avoir la capacité de',
    'devoir': 'Être obligé de',
    // Adverbes
    'tendrement': 'Avec douceur et affection',
    'rapidement': 'De manière rapide',
    'lentement': 'De manière lente',
    'facilement': 'Sans difficulté',
    'difficilement': 'Avec difficulté',
    'souvent': 'De nombreuses fois',
    'parfois': 'De temps en temps',
    'jamais': 'À aucun moment',
    'toujours': 'En permanence, sans cesse',
    'maintenant': 'En ce moment',
    'hier': 'Le jour avant aujourd\'hui',
    'demain': 'Le jour après aujourd\'hui',
    'ici': 'À cet endroit',
    'ailleurs': 'Dans un autre endroit',
    'ensemble': 'L\'un avec l\'autre',
    'seul': 'Sans personne d\'autre',
  };

  return words.map(word => ({
    word,
    definition: knownDefinitions[word.toLowerCase()] || `Mot à apprendre : cherche sa définition dans le dictionnaire`,
  }));
}

/**
 * Mélange un tableau (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
