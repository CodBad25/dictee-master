/**
 * Génère le SQL pour remplir les définitions manquantes des dictées en usage actif
 * (D1, D5, D6, D20, D22). N'altère que la colonne `definition` (UPDATE par dictee_id + position).
 * Les mots eux-mêmes (validés) ne sont pas touchés.
 *
 * Définitions rédigées niveau 6e : courtes, vocabulaire simple, exactes, sans exemple.
 */

type Def = { pos: number; word: string; definition: string };

const DEFS: Record<string, Def[]> = {
  "dictee-1": [
    { pos: 0, word: "le héros", definition: "Personnage principal d'une histoire, souvent courageux." },
    { pos: 1, word: "une allée", definition: "Chemin bordé d'arbres ou passage où l'on circule." },
    { pos: 2, word: "dangereux", definition: "Qui peut causer du mal ou des accidents." },
    { pos: 3, word: "un aliment", definition: "Ce que l'on mange pour se nourrir." },
    { pos: 4, word: "la soirée", definition: "Partie de la journée qui va du soir jusqu'à la nuit." },
    { pos: 5, word: "le cortège", definition: "Groupe de personnes qui avancent ensemble lors d'une cérémonie." },
    { pos: 6, word: "un canif", definition: "Petit couteau de poche dont la lame se replie." },
    { pos: 7, word: "la vague", definition: "Mouvement de l'eau qui se soulève à la surface de la mer." },
    { pos: 8, word: "une pensée", definition: "Idée ou réflexion qui se forme dans l'esprit." },
    { pos: 9, word: "un amusement", definition: "Activité agréable qui distrait et fait passer un bon moment." },
    { pos: 10, word: "le particulier", definition: "Personne ordinaire, qui n'agit pas pour une entreprise ni l'État." },
    { pos: 11, word: "la jungle", definition: "Grande forêt dense et humide des régions tropicales." },
    { pos: 12, word: "le marteau", definition: "Outil servant à enfoncer des clous en frappant." },
    { pos: 13, word: "amazonien", definition: "Qui concerne l'Amazonie, la grande forêt d'Amérique du Sud." },
    { pos: 14, word: "le prochain", definition: "Toute autre personne que soi, considérée comme un semblable." },
    { pos: 15, word: "méchant", definition: "Qui cherche à faire du mal aux autres." },
    { pos: 16, word: "s'évanouir", definition: "Perdre connaissance, tomber sans connaissance." },
    { pos: 17, word: "parcourir", definition: "Traverser un lieu dans toute son étendue." },
    { pos: 18, word: "le cadeau", definition: "Objet que l'on offre pour faire plaisir à quelqu'un." },
    { pos: 19, word: "un but", definition: "Objectif que l'on cherche à atteindre." },
  ],
  "dictee-5": [
    { pos: 0, word: "un meurtre", definition: "Action de tuer volontairement une personne." },
    { pos: 1, word: "une pièce", definition: "Salle d'une maison ; aussi petite monnaie de métal." },
    { pos: 2, word: "la médaille", definition: "Pièce de métal donnée en récompense." },
    { pos: 3, word: "taire (se)", definition: "Cesser de parler, rester silencieux." },
    { pos: 4, word: "bête", definition: "Qui manque d'intelligence ; sot." },
    { pos: 5, word: "redire", definition: "Dire de nouveau, répéter." },
    { pos: 6, word: "la morale", definition: "Règles du bien et du mal ; aussi leçon d'une histoire." },
    { pos: 7, word: "habituellement", definition: "De façon habituelle, le plus souvent." },
    { pos: 8, word: "drôle", definition: "Qui fait rire, amusant." },
    { pos: 9, word: "un grain", definition: "Petite graine d'une céréale ; aussi très petit morceau." },
    { pos: 10, word: "accrocher", definition: "Suspendre ou fixer à un crochet." },
    { pos: 11, word: "l'huile", definition: "Liquide gras tiré de plantes ou d'animaux." },
    { pos: 12, word: "flou (e)", definition: "Qui n'est pas net, dont les contours sont imprécis." },
    { pos: 13, word: "la police", definition: "Service chargé de faire respecter la loi et l'ordre." },
    { pos: 14, word: "coucher (se)", definition: "S'allonger pour dormir ou se reposer." },
    { pos: 15, word: "la queue", definition: "Partie allongée à l'arrière d'un animal ; aussi file d'attente." },
    { pos: 16, word: "le piano", definition: "Instrument de musique à clavier et à cordes." },
    { pos: 17, word: "l'effroi", definition: "Très grande peur, frayeur." },
    { pos: 18, word: "répartir", definition: "Partager, distribuer en plusieurs parts." },
    { pos: 19, word: "un mobile", definition: "Raison qui pousse quelqu'un à agir ; motif d'un acte." },
  ],
  "dictee-6": [
    { pos: 0, word: "la vertu", definition: "Qualité morale, tendance à faire le bien." },
    { pos: 1, word: "la propriété", definition: "Ce que l'on possède ; aussi qualité particulière d'une chose." },
    { pos: 2, word: "la propreté", definition: "État de ce qui est propre, sans saleté." },
    { pos: 3, word: "le duvet", definition: "Petites plumes douces des oiseaux ; aussi sac de couchage." },
    { pos: 4, word: "un pinson", definition: "Petit oiseau au chant joyeux." },
    { pos: 5, word: "gentil (ille)", definition: "Aimable, agréable et serviable avec les autres." },
    { pos: 6, word: "le renouvellement", definition: "Action de renouveler, de remplacer par du neuf." },
    { pos: 7, word: "le pelage", definition: "Ensemble des poils qui couvrent un animal." },
    { pos: 8, word: "une dette", definition: "Somme d'argent que l'on doit à quelqu'un." },
    { pos: 9, word: "le manque", definition: "Absence de quelque chose dont on a besoin." },
    { pos: 10, word: "un propriétaire", definition: "Personne qui possède un bien, une maison." },
    { pos: 11, word: "la fureur", definition: "Colère très violente." },
    { pos: 12, word: "le poumon", definition: "Organe du corps qui sert à respirer." },
    { pos: 13, word: "plaire", definition: "Être agréable, donner du plaisir à quelqu'un." },
    { pos: 14, word: "le domicile", definition: "Lieu où une personne habite." },
    { pos: 15, word: "à merveille", definition: "Très bien, parfaitement." },
    { pos: 16, word: "le témoin", definition: "Personne qui a vu ou entendu quelque chose et peut le raconter." },
    { pos: 17, word: "une démarche", definition: "Manière de marcher ; aussi action faite pour obtenir quelque chose." },
    { pos: 18, word: "approcher", definition: "Venir plus près." },
    { pos: 19, word: "un régiment", definition: "Grande troupe de soldats." },
  ],
  "dictee-20": [
    { pos: 0, word: "franchement", definition: "De façon sincère, sans mentir." },
    { pos: 1, word: "un bruit", definition: "Son que l'on entend, souvent désagréable." },
    { pos: 2, word: "suspendre", definition: "Accrocher en hauteur ; aussi arrêter pour un moment." },
    { pos: 3, word: "un vêtement", definition: "Ce que l'on porte pour s'habiller." },
    { pos: 4, word: "la clé / la clef", definition: "Objet de métal servant à ouvrir une serrure." },
    { pos: 5, word: "la distinction", definition: "Différence que l'on fait entre deux choses ; aussi élégance." },
    { pos: 6, word: "l'ivresse", definition: "État d'une personne qui a trop bu d'alcool." },
    { pos: 7, word: "rejoindre", definition: "Aller retrouver quelqu'un ou un endroit." },
    { pos: 8, word: "conclure", definition: "Terminer, finir ; aussi tirer une conclusion." },
    { pos: 9, word: "un crayon", definition: "Instrument à mine pour écrire ou dessiner." },
    { pos: 10, word: "le vice", definition: "Mauvais penchant, défaut grave." },
    { pos: 11, word: "plastique", definition: "Matière artificielle légère et solide." },
    { pos: 12, word: "roux", definition: "De couleur entre le rouge et le brun (cheveux, poil)." },
    { pos: 13, word: "un euro", definition: "Monnaie utilisée dans plusieurs pays d'Europe." },
    { pos: 14, word: "un fil", definition: "Brin long et mince de matière (coton, métal…)." },
    { pos: 15, word: "la colline", definition: "Petite élévation de terrain, plus basse qu'une montagne." },
    { pos: 16, word: "une draisienne", definition: "Petit vélo sans pédales pour apprendre l'équilibre." },
    { pos: 17, word: "drôle", definition: "Qui fait rire, amusant." },
    { pos: 18, word: "estimer", definition: "Évaluer une valeur ; aussi avoir du respect pour quelqu'un." },
    { pos: 19, word: "insulaire", definition: "Qui habite une île ou qui s'y rapporte." },
  ],
  "dictee-22": [
    { pos: 0, word: "un choix", definition: "Action de choisir entre plusieurs possibilités." },
    { pos: 1, word: "la facilité", definition: "Qualité de ce qui est facile, sans difficulté." },
    { pos: 2, word: "procurer", definition: "Faire obtenir quelque chose à quelqu'un." },
    { pos: 3, word: "fluide", definition: "Qui coule facilement, comme un liquide ou un gaz." },
    { pos: 4, word: "une grappe", definition: "Ensemble de fruits ou de fleurs serrés sur une tige." },
    { pos: 5, word: "constituer", definition: "Former, composer un ensemble." },
    { pos: 6, word: "un chevalet", definition: "Support en bois qui tient le tableau d'un peintre." },
    { pos: 7, word: "être transporté", definition: "Être emporté d'un lieu à un autre." },
    { pos: 8, word: "remplacer", definition: "Mettre une chose ou une personne à la place d'une autre." },
    { pos: 9, word: "la défense", definition: "Action de protéger ou de se protéger ; aussi dent d'éléphant." },
    { pos: 10, word: "transporter", definition: "Déplacer quelque chose ou quelqu'un d'un lieu à un autre." },
    { pos: 11, word: "peindre", definition: "Couvrir de peinture ; aussi représenter par la peinture." },
    { pos: 12, word: "remuer", definition: "Bouger, faire des mouvements ; aussi mélanger." },
    { pos: 13, word: "fameux", definition: "Très connu, célèbre ; aussi très bon." },
    { pos: 14, word: "un pavé", definition: "Bloc de pierre servant à couvrir le sol des rues." },
    { pos: 15, word: "décorer", definition: "Orner, embellir un lieu ou un objet." },
    { pos: 16, word: "troubler", definition: "Rendre moins clair ; aussi gêner, inquiéter." },
    { pos: 17, word: "un parterre", definition: "Partie d'un jardin où poussent des fleurs." },
    { pos: 18, word: "le geste", definition: "Mouvement du corps, surtout de la main ou du bras." },
    { pos: 19, word: "judicieux (se)", definition: "Qui montre du bon sens, bien pensé." },
  ],
};

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

const lines: string[] = ["-- Définitions D1, D5, D6, D20, D22 (UPDATE par dictee_id + position)", "BEGIN;"];
let total = 0;
for (const [dicteeId, defs] of Object.entries(DEFS)) {
  lines.push(`-- ${dicteeId}`);
  for (const d of defs) {
    lines.push(
      `UPDATE dictee_words SET definition = '${esc(d.definition)}' WHERE dictee_id = '${dicteeId}' AND position = ${d.pos};`
    );
    total++;
  }
}
lines.push("COMMIT;");

const sql = lines.join("\n");

// Mode "apply" : exécute les UPDATE via supabase-js puis recontrôle la couverture.
async function apply() {
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  let ok = 0;
  let ko = 0;
  for (const [dicteeId, defs] of Object.entries(DEFS)) {
    for (const d of defs) {
      const { error } = await sb
        .from("dictee_words")
        .update({ definition: d.definition })
        .eq("dictee_id", dicteeId)
        .eq("position", d.pos);
      if (error) {
        ko++;
        console.error(`KO ${dicteeId} pos ${d.pos}: ${error.message}`);
      } else {
        ok++;
      }
    }
  }
  console.log(`\nUPDATE: ${ok} OK, ${ko} échecs.`);
  // Recontrôle
  const { data: words } = await sb.from("dictee_words").select("dictee_id,definition,position");
  for (const dicteeId of Object.keys(DEFS)) {
    const ws = (words || []).filter((w: any) => w.dictee_id === dicteeId);
    const withDef = ws.filter((w: any) => w.definition && w.definition.length > 5).length;
    console.log(`  ${dicteeId}: ${withDef}/${ws.length} avec définition`);
  }
}

// Mode "review" : affiche le tableau lisible. Mode "sql" : sort le SQL brut (pour pbcopy).
if (process.argv.includes("--apply")) {
  apply().catch((e) => console.error(e));
} else if (process.argv.includes("--sql")) {
  console.log(sql);
} else {
  for (const [dicteeId, defs] of Object.entries(DEFS)) {
    console.log(`\n### ${dicteeId}`);
    for (const d of defs) console.log(`  ${d.word}  →  ${d.definition}`);
  }
  console.log(`\nTotal: ${total} définitions sur ${Object.keys(DEFS).length} dictées.`);
}
