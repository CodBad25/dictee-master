#!/usr/bin/env python3
"""
Régénère fill_blanks_text (D13-D28) + MP3 ElevenLabs en PARALLÈLE.
Thèmes complètement différents des vrais textes de Nadia — pas de spoiler.
"""

import os, sys, time, shutil, requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

SUPABASE_URL = "https://szlsapcumkldapomrsqn.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bHNhcGN1bWtsZGFwb21yc3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNjE4NDUsImV4cCI6MjA4MjkzNzg0NX0.bcWw07IWajvTiIO57iCndvYIMZJ_wrSkJz8w5P_HTp0"
ELEVENLABS_KEY = "sk_57188d40f74f5fb250dff6b6084af81143d4cf195de8ec2b"
VOICE_ID = "XrExE9yKIg1WjnnlVkGX"
MODEL_ID = "eleven_multilingual_v2"

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio", "dictees")
BACKUP_DIR = os.path.join(os.path.dirname(__file__), "..", "backups")

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

# ---------------------------------------------------------------------------
# Textes d'entraînement — thèmes différents des vrais textes de Nadia
# Chaque texte utilise les 20 mots de sa dictée, niveau 6e, ~120 mots.
# ---------------------------------------------------------------------------

FILL_BLANKS = {
    "dictee-13": (
        "Pendant son congé de rentrée, Clara lisait un roman passionnant. Il racontait "
        "l'exploit d'un alpiniste chevronné qui réalisait l'ascension d'un sommet dangereux. "
        "Généralement, cet alpiniste prenait soin de chaque détail avant de partir : il cherchait "
        "la source d'eau la plus proche, notait la position d'un bloc rocheux et étudiait le "
        "principe de chaque passage. Un vrai défenseur de la nature, il soupira en découvrant "
        "un cerisier à demi épuisé, cramponné à la roche. Là, sur la chaussée d'une vieille "
        "cabane, il aperçut une femelle oiseau qui gardait son nid. Cette image, légère comme "
        "du lin, le toucha profondément."
    ),
    "dictee-14": (
        "La famille avait finalement trouvé une maison en pleine campagne. Curieux de cet endroit "
        "dénudé d'arbres, le père se lança dans la recherche d'un noyer à planter. Les préparatifs "
        "du déménagement coûtèrent cher, mais la position de la maison, face à une puissante "
        "falaise, était classique et sereine. Une abrupte montée de marches menait à une vieille "
        "grange aux murs épais. Devant une indication gravée dans la pierre, ils durent faire un "
        "détour pour présenter leurs documents à la mairie. Une tempête éclata au moment le plus "
        "urgent : tous les cartons restaient dehors ! Sans distraction possible, chacun s'activa "
        "pour tout rentrer avant que la pluie ne mouille le tout."
    ),
    "dictee-15": (
        "Chaque mercredi, la bibliothécaire chérie organisait une séance pour les enfants. Elle "
        "déposait précautionneusement un grand rouleau de papier luisant sur la table, posé sur "
        "une feuille de carton. Elle commençait par narrer à voix douce l'histoire d'un espiègle "
        "lutin prisonnier d'un sortilège. Les enfants aspiraient à chaque détail. Elle leur posait "
        "une question sur le caractère du personnage pour vérifier leur attention. Après la "
        "collation, elle distribuait un manuel illustré afin que chacun profite de ce loisir chez "
        "lui. Le bénéfice de ces séances était clair : chaque enfant attendait le mercredi avec "
        "impatience, évitant les flaques pour ne pas mouiller ses livres. Un pigeon roucoulait "
        "dehors."
    ),
    "dictee-16": (
        "Au bout d'une longue causerie, le directeur enchanté annonça une grande mission à "
        "l'atelier de musique : organiser un concert de hautbois. Malheureusement, l'humidité "
        "commençait à rider les vieilles partitions collées au mur. Le montant du budget était "
        "écrit en rouge sur le tableau. Le professeur souffrant d'un rhume ne tarda pas à faire "
        "la moue. Les gens du village, ébahis, étaient tous invités. Un élève téméraire retira "
        "son bonnet et dit, d'une façon très sérieuse : « Nous n'allons pas bouder cette "
        "occasion, peu importe le bout du chemin ! » Son discours toucha le cœur du royaume "
        "entier. Le soir, les portes furent fermées sur un concert inoubliable."
    ),
    "dictee-17": (
        "Après avoir croqué une pêche au bord de la fenêtre, le fermier était prêt pour le "
        "grand départ. Il devait labourer ses champs avant la pluie. Il vérifia soigneusement "
        "chaque lien du tracteur, car l'un d'eux était défectueux. Cet humain régulier dans ses "
        "habitudes contrôlait toujours la température du moteur avant de se déplacer. Sur le "
        "pavillon de la ferme, la girouette surgit dans le vent du matin. Dans son filet de "
        "rangement, il prit un flacon d'huile et un brin de ficelle. Son approche du travail "
        "était presque religieuse. Il hissa la bâche, puis fit un dernier tour pour vérifier "
        "que rien ne manquait avant de partir."
    ),
    "dictee-18": (
        "En vacances au bord de la mer, la famille choisit de loger dans une maison face au "
        "golfe. Le lendemain matin, ils se promenèrent au ralenti le long du port. Devant la "
        "capitainerie, de nombreux bateaux étaient amarrés. Le plus grand portait le nom d'un "
        "ancien président. Plus loin, à l'entrée d'une grotte, un vieux casier rouillé était "
        "recouvert d'algues. On pouvait deviner qu'autrefois quelqu'un avait voulu étendre ses "
        "filets là. Ils savourèrent ce moment pendant ce qui leur parut une éternité. Le soleil "
        "commençait à piquer, et les enfants durent changer de tee-shirt. Un garde leur offrit "
        "une carte du sentier et les remercia doucement."
    ),
    "dictee-19": (
        "Actuellement, la classe de CM2 organisait une fête pour l'anniversaire de l'école. "
        "Conformément aux règles, chaque invité devait apporter un présent. Le professeur, un "
        "vieux bonhomme maussade, surveillait les préparatifs d'un œil contrarié. « Quel malheur "
        "de perdre une heure de cours ! » s'écria-t-il. Pourtant, réellement touché par le cri "
        "de joie des élèves, il finit par sourire. Les enfants avaient couvert la table de "
        "cadeaux précieux : des livres, des paquets colorés. Un élève tenta d'organiser un jeu "
        "terrestre dans la cour. Il y a maintenant un an que cette classe fêtait ses succès. "
        "Pour marquer le moment, le bonhomme offrit même un gâteau."
    ),
    "dictee-20": (
        "Ce samedi, Léa rejoignit sa grand-mère au marché aux puces au pied d'une colline. Les "
        "étals étaient couverts d'objets en plastique, de vêtements froissés et de drôles de "
        "gadgets. La vieille dame aux cheveux roux suspendit un tableau rouillé à un fil de "
        "métal. Elle estima sa valeur à quelques euros seulement. Franchement, Léa ne comprenait "
        "pas la distinction entre les brocantes et les dépôts-ventes. Une antique draisienne "
        "fit son effet : elle fit un bruit retentissant en roulant sur les pavés. La vendeuse "
        "conclut la vente avec l'ivresse du succès. Un vieux crayon à peine taillé, une clé "
        "rouillée… chaque objet semblait avoir un vice caché. L'atmosphère insulaire du marché "
        "enchantait Léa."
    ),
    "dictee-21": (
        "Dans l'espace calme de l'atelier, le sculpteur bossu travaillait avec une flamme "
        "intérieure. Sa tâche était de bâtir une grande sculpture : un massif de rocaille "
        "entouré de fer forgé. Des idées violentes envahissaient son esprit créatif. Il voulait "
        "orner chaque recoin et peindre les détails à la chaux fraîche. Un jeune apprenti, un "
        "peu étourdi, vint l'épauler. L'officier du musée les observait d'un œil attentif. La "
        "glaise commença à couver sous ses doigts habiles. Il plia une plaque de métal et "
        "l'inséra dans le socle. Il fallait agir vite : le vernis était encore frais. Ce "
        "chef-d'œuvre allait bientôt envahir le grand hall d'exposition."
    ),
    "dictee-22": (
        "Le fameux pâtissier avait constitué un chef-d'œuvre : un gâteau décoré de roses en "
        "sucre. Son geste était fluide, comme s'il peignait une toile. Il remua délicatement "
        "la crème avant de disposer une grappe de raisin en pâte d'amande sur un parterre de "
        "bonbons. Il fallait transporter ce gâteau avec soin, car le moindre choc risquait de "
        "troubler son équilibre. Son chevalet de travail lui permettait de procurer à chaque "
        "détail une finition parfaite. Il remplaça au dernier moment les fleurs posées sur le "
        "pavé. Le judicieux pâtissier assura la défense de son choix de couleurs avec la "
        "facilité d'un artiste, ravi d'être transporté par les compliments et de décorer "
        "ainsi les plus belles tables."
    ),
    "dictee-23": (
        "Au printemps, la grand-mère et son petit-fils passèrent leurs vacances à transformer "
        "le vieux garage en atelier de jardinage. Elle revêtit une veste légère et sortit son "
        "calendrier précis pour planifier les semis. Le collégien, studieux à sa façon, répéta "
        "chaque geste pour convertir les pots en terre. Quand il commença à pleuvoir, ils durent "
        "se calmer et patienter. La monotonie des jours sans soleil pesait sur le garage "
        "solitaire. Mais le temps s'arrangea, et la grand-mère, pour éviter toute imprudence, "
        "organisa des révisions de jardinage chaque matin. « Ne répète pas la même erreur », "
        "disait-elle à son petit-fils en souriant."
    ),
    "dictee-24": (
        "Pour un projet scolaire, le garçon se rendit dans un haras situé à l'orée d'une "
        "forêt. Le palefrenier l'emmena vers les box où dormaient les chevaux. Après avoir "
        "brossé le crin d'une jument, il apprit à fixer les étriers. Il dut plusieurs fois se "
        "détourner des mouches agaçantes. L'activité lui plut : il alla au trot dans le manège. "
        "À midi, las de ses efforts, il s'installa dans le salon pour signer son cahier de "
        "bord. L'équitation ne lui était pas naturelle, mais il versa tout son enthousiasme "
        "dans cette découverte mélodieuse. Il obtint ainsi une bonne note. Le creux du chemin, "
        "au retour vers son appartement, lui parut bien long."
    ),
    "dictee-25": (
        "Avec ferveur, le chef cuisinier enseignait son art dans une grande école. Ses cours "
        "engendraient une stupéfaction constante chez les élèves ravis. Il préparait un velouté "
        "de légumes d'une abondance grandiose : en quelques coups de baguette de bois sur le "
        "bord de la casserole, il activait chaque arôme. Les confettis de poivron rouge "
        "descendaient en spirale dans le bouillon. Il encourageait ses étudiants sans répit, "
        "leur expliquant infiniment chaque geste. « L'intelligence d'un cuisinier se voit dans "
        "sa façon de tenir sa serviette ! » s'écriait-il. Un million de petits détails faisaient "
        "la différence. À ses côtés, même le plus maladroit devenait magicien des saveurs."
    ),
    "dictee-26": (
        "Dernièrement, l'artisan avait décidé de créer une composition murale prodigieuse. Une "
        "dizaine de carreaux multicolores, parsemés de paillettes étincelantes, étaient alignés "
        "sur une étagère. Il fallait les unir un par un avec soin. Malheureusement, lors du "
        "transport, il déchira l'emballage et un carreau disparut. Son inquiétude grandit. "
        "Habillé d'un imperméable pour travailler à l'humidité, il mesurait chaque pièce au "
        "centimètre près. En moyenne, la réalisation d'une telle fresque prenait plusieurs "
        "semaines. Un vrai prestidigitateur du carrelage ! L'administration de la mairie lui "
        "avait commandé ce travail étincelant. Au final, la mosaïque semblait parsemée "
        "d'étoiles."
    ),
    "dictee-27": (
        "Ce jour de sortie scolaire, les élèves adoraient participer à la foire du village. Au "
        "pied d'un vieux poteau d'affichage, une chèvre mignonne était attachée par un lien. "
        "L'humble fermier qui la surveillait informa les enfants de ne pas tromper l'animal. Un "
        "saut acrobatique d'un chevreau fit rire toute la classe. L'envie de liberté des petites "
        "bêtes était visible : elles tiraient en vain sur leurs cordes. Un élève s'accordait un "
        "délicieux beignet. Le sort en fut ainsi pour son voisin, qui n'en eut pas. La lumière "
        "céleste du soleil réchauffait la scène mieux que n'importe quel chauffage."
    ),
    "dictee-28": (
        "Tout à coup, un tourbillon de feuilles mortes enveloppa le randonneur égaré. Il était "
        "tant perdu qu'il ne reconnaissait plus rien. La poussière du chemin lui brouillait la "
        "vue, et il se sentait désorienté. Il longea un roncier épineux et faillit trébucher "
        "sur un vieux piquet de clôture. Un bêlement retentissant lui parvint de la cime de la "
        "colline. Il grimpa en direction du son, cherchant un abri derrière un oranger isolé "
        "par le vent. Le sort voulut qu'il trouve un refuge. Honteux de s'être ainsi égaré, il "
        "ne pouvait pas figurer sa gêne. Sa conquête de ce chemin l'avait guéri de sa naïveté, "
        "rompant définitivement avec ses habitudes de randonneur du dimanche."
    ),
}


def update_fill_blanks(dictee_id: str, text: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/dictees?id=eq.{dictee_id}"
    r = requests.patch(url, headers=HEADERS_SB, json={"fill_blanks_text": text}, timeout=15)
    return r.status_code in (200, 204)


def backup_mp3(n: int) -> None:
    src = os.path.join(AUDIO_DIR, f"dictee_{n}.mp3")
    if os.path.exists(src):
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        dst = os.path.join(BACKUP_DIR, f"dictee_{n}_old_{ts}.mp3")
        shutil.copy2(src, dst)


def generate_mp3(text: str, dest: str, retries: int = 3) -> bool:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": ELEVENLABS_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    for attempt in range(retries):
        r = requests.post(url, headers=headers, json=body, timeout=90)
        if r.status_code == 200:
            with open(dest, "wb") as f:
                f.write(r.content)
            return True
        if r.status_code == 429 and attempt < retries - 1:
            wait = 3 * (attempt + 1)
            print(f"    rate-limit, pause {wait}s…")
            time.sleep(wait)
            continue
        print(f"  ✗ ElevenLabs {r.status_code}: {r.text[:200]}")
        return False
    return False


def mp3_needs_regen(n: int) -> bool:
    """Retourne True si le MP3 de la dictée N doit encore être généré."""
    dest = os.path.join(AUDIO_DIR, f"dictee_{n}.mp3")
    # Si le fichier n'existe pas du tout, oui.
    if not os.path.exists(dest):
        return True
    # Si le fichier a été sauvegardé dans backups/ avec un suffix _old_, c'est
    # qu'on l'a déjà backé up → il faut donc vérifier si un nouveau a été écrit
    # (taille > 0 ET plus récent que le backup).
    ts = datetime.now().strftime("%Y%m%d")
    backups = [f for f in os.listdir(BACKUP_DIR)
               if f.startswith(f"dictee_{n}_old_") and f.endswith(".mp3")]
    return len(backups) == 0  # S'il y a un backup, c'est qu'on a déjà traité ce N


def process_mp3_only(dictee_id: str, text: str) -> dict:
    """Génère uniquement le MP3 (DB déjà mise à jour)."""
    n = int(dictee_id.split("-")[1])
    dest = os.path.join(AUDIO_DIR, f"dictee_{n}.mp3")
    backup_mp3(n)
    ok = generate_mp3(text, dest)
    return {"id": dictee_id, "n": n, "mp3": ok}


def main():
    dry_run = "--apply" not in sys.argv
    mp3_only = "--mp3-only" in sys.argv

    if dry_run:
        print("=== DRY RUN — aperçu des 16 textes (ajouter --apply pour appliquer) ===\n")
        for did, text in FILL_BLANKS.items():
            n = did.split("-")[1]
            print(f"D{n:>2} | {len(text)} chars | {text[:90]}…")
        print(f"\nTotal : {len(FILL_BLANKS)} dictées à régénérer.")
        return

    os.makedirs(BACKUP_DIR, exist_ok=True)

    # Étape 1 : DB (parallèle, Supabase n'a pas de rate-limit strict)
    if not mp3_only:
        print(f"=== DB — mise à jour fill_blanks_text ({len(FILL_BLANKS)} dictées) ===")
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(update_fill_blanks, did, text): did
                       for did, text in FILL_BLANKS.items()}
            ok_db = 0
            for fut in as_completed(futures):
                did = futures[fut]
                n = did.split("-")[1]
                ok = fut.result()
                ok_db += ok
                print(f"  D{n:>2} DB : {'✓' if ok else '✗'}")
        print(f"  → {ok_db}/{len(FILL_BLANKS)} mis à jour\n")

    # Étape 2 : MP3 (séquentiel + max 2 workers pour respecter le plan ElevenLabs)
    print("=== MP3 — génération ElevenLabs (max 2 en parallèle) ===")
    t0 = time.time()

    items = list(FILL_BLANKS.items())
    results = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = {pool.submit(process_mp3_only, did, text): did for did, text in items}
        for fut in as_completed(futures):
            r = fut.result()
            results[r["id"]] = r
            print(f"  D{r['n']:02d} MP3 : {'✓' if r['mp3'] else '✗'}")

    elapsed = time.time() - t0
    ok_mp3 = sum(1 for r in results.values() if r["mp3"])
    print(f"\n{'='*40}")
    print(f"MP3 : {ok_mp3}/{len(FILL_BLANKS)} générés  ({elapsed:.1f}s)")

    if ok_mp3 < len(FILL_BLANKS):
        failed = [r["id"] for r in results.values() if not r["mp3"]]
        print(f"⚠️ Échecs : {', '.join(failed)}")
        print("Relancer avec --apply --mp3-only pour réessayer uniquement les MP3.")
        sys.exit(1)


if __name__ == "__main__":
    main()
