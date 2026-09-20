#!/usr/bin/env python3
"""
Textes d'entraînement des 16 dictées 5e + vérification des consignes de Nadia.

Consignes (retour du 20/09/2026) :
  - 25 mots maximum, 3 phrases maximum, phrases courtes ;
  - les trous portent sur des ACCORDS (pluriel des noms et adjectifs, féminin
    des adjectifs, verbes), jamais sur l'orthographe du mot seul ;
  - le mot qui donne l'indice d'accord reste VISIBLE à côté du trou, sinon
    l'accord est indevinable ;
  - deux trous ne doivent pas dépendre l'un de l'autre (si « détails » est
    troué, « examinés » ne peut pas l'être : une erreur en entraînerait deux).

Un trou peut porter sur un mot hors liste de vocabulaire (« épuisées ») : ce
qui compte ici est l'accord, pas la révision du mot — celle-ci est déjà faite
par « audio mot » et « choix orthographique ».

Usage :
  python3 scripts/training-texts-5e.py           # vérifie et affiche le rapport
  python3 scripts/training-texts-5e.py --sql     # écrit le SQL (et le copie)
"""

import re
import subprocess
import sys
import unicodedata

MAX_MOTS = 25
MAX_PHRASES = 3

# Formes réellement employées dans le texte pour les mots dont la conjugaison
# s'éloigne du radical (la détection automatique ne peut pas les relier).
FORMES = {
    "dictee-5e-1":  {"apercevoir": "aperçoivent"},
    "dictee-5e-6":  {"entreprendre": "entreprennent"},
    "dictee-5e-8":  {"disparaître": "disparaissent"},
    "dictee-5e-9":  {"feindre": "feignent"},
}

# Mots volontairement non réemployés, avec la raison. D10 aligne quatre verbes
# quasi synonymes (évoquer, se rappeler, se remémorer, se souvenir) : les caser
# tous les quatre en 25 mots imposerait une énumération artificielle, contraire
# aux « phrases courtes » demandées. Le mot reste travaillé par les autres modes.
ABSENTS = {
    "dictee-5e-10": {"se remémorer": "4 verbes synonymes : énumération artificielle en 25 mots"},
}

# id → (texte marqué, {réponse: règle affichée à l'élève})
TEXTES = {
    "dictee-5e-1": (
        "Les deux sœurs sont «curieuses». Elles observent la vitrine : leurs «regards» "
        "scrutent des indices peu «visibles». Elles «aperçoivent» des détails "
        "attentivement «examinés».",
        {
            "curieuses":   "Adjectif au féminin pluriel : « les deux sœurs »",
            "regards":     "Nom au pluriel : « leurs »",
            "visibles":    "Adjectif accordé avec « des indices » : pluriel",
            "aperçoivent": "Verbe à la 3e personne du pluriel : « Elles »",
            "examinés":    "Participe passé accordé avec « détails » : masculin pluriel",
        },
    ),
    "dictee-5e-2": (
        "Les randonneuses «épuisées» «arpentent» des sentiers «isolés». Elles "
        "«s'aventurent», contournent un rocher : ce détour révèle des paysages "
        "«inexplorés». Leur périple suit un itinéraire.",
        {
            "épuisées":     "Adjectif au féminin pluriel : « Les randonneuses »",
            "arpentent":    "Verbe à la 3e personne du pluriel : « Les randonneuses »",
            "isolés":       "Adjectif accordé avec « des sentiers » : masculin pluriel",
            "s'aventurent": "Verbe à la 3e personne du pluriel : « Elles »",
            "inexplorés":   "Adjectif accordé avec « des paysages » : masculin pluriel",
        },
    ),
    "dictee-5e-3": (
        "Des bruits «inhabituels» «présagent» une menace. Les sentinelles se «méfient», "
        "se dissimulent et guettent prudemment. Leur vigilance donne l'alerte malgré "
        "les «inquiétudes».",
        {
            "inhabituels": "Adjectif accordé avec « Des bruits » : masculin pluriel",
            "présagent":   "Verbe à la 3e personne du pluriel : « Des bruits »",
            "méfient":     "Verbe à la 3e personne du pluriel : « Les sentinelles »",
            "inquiétudes": "Nom au pluriel : « les »",
        },
    ),
    "dictee-5e-4": (
        "Dans la pénombre, des lueurs «scintillent». Les rayons «éblouissants» "
        "irradient et «illuminent» la salle. L'eau reflète ces «éclats», puis la clarté "
        "«faiblit».",
        {
            "scintillent":  "Verbe à la 3e personne du pluriel : « des lueurs »",
            "faiblit":      "Verbe au singulier : « la clarté »",
            "éblouissants": "Adjectif accordé avec « Les rayons » : masculin pluriel",
            "illuminent":   "Verbe à la 3e personne du pluriel : « Les rayons »",
            "éclats":       "Nom au pluriel : « ces »",
        },
    ),
    "dictee-5e-5": (
        "Les visiteuses «émerveillées» «admirent» des merveilles «fascinantes». Elles "
        "«contemplent» cet enchantement envoûtant et «s'extasient» profondément. Quel "
        "éblouissement !",
        {
            "émerveillées": "Adjectif au féminin pluriel : « Les visiteuses »",
            "admirent":     "Verbe à la 3e personne du pluriel : « Les visiteuses »",
            "fascinantes":  "Adjectif accordé avec « des merveilles » : féminin pluriel",
            "contemplent":  "Verbe à la 3e personne du pluriel : « Elles »",
            "s'extasient":  "Verbe à la 3e personne du pluriel : « Elles »",
        },
    ),
    "dictee-5e-6": (
        "Les élèves «déterminés» «entreprennent» un travail. Ils «s'efforcent» "
        "inlassablement : leur courage «tenace» impose des efforts «opiniâtres». La "
        "persévérance gagne résolument.",
        {
            "déterminés":  "Adjectif accordé avec « Les élèves » : masculin pluriel",
            "entreprennent": "Verbe à la 3e personne du pluriel : « Les élèves »",
            "s'efforcent": "Verbe à la 3e personne du pluriel : « Ils »",
            "tenace":      "Adjectif accordé avec « leur courage » : singulier, pas de -s",
            "opiniâtres":  "Adjectif accordé avec « des efforts » : masculin pluriel",
        },
    ),
    "dictee-5e-7": (
        "Le chemin serpente et «s'élève». Des falaises «abruptes» «surplombent» les "
        "versants «escarpés». Les sommets «culminent» majestueusement.",
        {
            "s'élève":     "Verbe au singulier : « Le chemin »",
            "abruptes":    "Adjectif accordé avec « Des falaises » : féminin pluriel",
            "surplombent": "Verbe à la 3e personne du pluriel : « Des falaises »",
            "escarpés":    "Adjectif accordé avec « les versants » : masculin pluriel",
            "culminent":   "Verbe à la 3e personne du pluriel : « Les sommets »",
        },
    ),
    "dictee-5e-8": (
        "Des silhouettes «étranges» «surgissent» mystérieusement. Ces apparitions "
        "«énigmatiques» disparaissent, «insaisissables». Le détective décèle un indice "
        "et «dévoile» la vérité.",
        {
            "étranges":      "Adjectif accordé avec « Des silhouettes » : pluriel",
            "surgissent":    "Verbe à la 3e personne du pluriel : « Des silhouettes »",
            "énigmatiques":  "Adjectif accordé avec « Ces apparitions » : pluriel",
            "insaisissables": "Adjectif accordé avec « Ces apparitions » : féminin pluriel",
            "dévoile":       "Verbe au singulier : « Le détective »",
        },
    ),
    "dictee-5e-9": (
        "Les traîtres «fourbes» «manigancent» astucieusement. Ils «feignent» la peur, "
        "dissimulent leur malice et leurrent la garde. Quels «stratagèmes» «sournois», "
        "quelle perfidie !",
        {
            "fourbes":     "Adjectif accordé avec « Les traîtres » : pluriel",
            "manigancent": "Verbe à la 3e personne du pluriel : « Les traîtres »",
            "feignent":    "Verbe à la 3e personne du pluriel : « Ils »",
            "stratagèmes": "Nom au pluriel : « Quels »",
            "sournois":    "Adjectif au masculin pluriel : se termine déjà par -s, invariable",
        },
    ),
    "dictee-5e-10": (
        "Autrefois, les grands-mères se «souvenaient» et se rappelaient des soirées "
        "«mémorables». Elles «évoquaient» ces fêtes «inoubliables». Leur mémoire, jamais "
        "«oublieuse», gardait la nostalgie.",
        {
            "souvenaient":  "Verbe à la 3e personne du pluriel : « les grands-mères »",
            "mémorables":   "Adjectif accordé avec « des soirées » : pluriel",
            "évoquaient":   "Verbe à la 3e personne du pluriel : « Elles »",
            "inoubliables": "Adjectif accordé avec « ces fêtes » : pluriel",
            "oublieuse":    "Adjectif accordé avec « Leur mémoire » : féminin singulier",
        },
    ),
    "dictee-5e-11": (
        "Les infirmières «indulgentes» «encouragent» et «réconfortent» les blessés. Elles "
        "«rassurent» généreusement, avec bienveillance. Leur altruisme «clément» et "
        "charitable montre une vraie magnanimité.",
        {
            "indulgentes":  "Adjectif au féminin pluriel : « Les infirmières »",
            "encouragent":  "Verbe à la 3e personne du pluriel : « Les infirmières »",
            "réconfortent": "Verbe à la 3e personne du pluriel : « Les infirmières »",
            "rassurent":    "Verbe à la 3e personne du pluriel : « Elles »",
            "clément":      "Adjectif accordé avec « Leur altruisme » : masculin singulier",
        },
    ),
    "dictee-5e-12": (
        "Des cris «éclatent» bruyamment. Le tonnerre «gronde», le fracas «retentit» et les "
        "murs «résonnent». Quel tumulte «assourdissant», quel vacarme, quel tapage !",
        {
            "éclatent":      "Verbe à la 3e personne du pluriel : « Des cris »",
            "gronde":        "Verbe au singulier : « Le tonnerre »",
            "retentit":      "Verbe au singulier : « le fracas »",
            "résonnent":     "Verbe à la 3e personne du pluriel : « les murs »",
            "assourdissant": "Adjectif accordé avec « Quel tumulte » : masculin singulier",
        },
    ),
    "dictee-5e-13": (
        "Le maître «irascible» «s'emporte» furieusement. «Exaspéré», il fulmine et enrage. "
        "Sa hargne et son courroux «nourrissent» l'animosité : les élèves «s'irritent».",
        {
            "irascible":   "Adjectif accordé avec « Le maître » : singulier",
            "s'emporte":   "Verbe au singulier : « Le maître »",
            "Exaspéré":    "Adjectif accordé avec « il » : masculin singulier",
            "nourrissent": "Verbe au pluriel : deux sujets, « Sa hargne et son courroux »",
            "s'irritent":  "Verbe à la 3e personne du pluriel : « les élèves »",
        },
    ),
    "dictee-5e-14": (
        "Les professeurs «avertis» «enseignent» savamment. Leurs leçons «éclairées» "
        "transmettent des «connaissances». Les élèves «studieux» assimilent cette érudition.",
        {
            "avertis":       "Adjectif accordé avec « Les professeurs » : masculin pluriel",
            "enseignent":    "Verbe à la 3e personne du pluriel : « Les professeurs »",
            "éclairées":     "Adjectif accordé avec « Leurs leçons » : féminin pluriel",
            "connaissances": "Nom au pluriel : « des »",
            "studieux":      "Adjectif au masculin pluriel : se termine déjà par -x, invariable",
        },
    ),
    "dictee-5e-15": (
        "La directrice «avisée» «s'assure» d'un examen clairvoyant. Ses raisonnements "
        "«réfléchis» mènent à des choix «judicieux». «Convaincue», elle garde sa lucidité.",
        {
            "avisée":     "Adjectif accordé avec « La directrice » : féminin singulier",
            "s'assure":   "Verbe au singulier : « La directrice »",
            "réfléchis":  "Adjectif accordé avec « Ses raisonnements » : masculin pluriel",
            "judicieux":  "Adjectif au masculin pluriel : se termine déjà par -x, invariable",
            "Convaincue": "Adjectif accordé avec « elle » : féminin singulier",
        },
    ),
    "dictee-5e-16": (
        "Des paroles «paisibles» «apaisent», adoucissent et soulagent. Elles «modèrent» les "
        "colères, pacifient les esprits «sereins». Cette consolation «rend» la tranquillité, "
        "la quiétude.",
        {
            "paisibles": "Adjectif accordé avec « Des paroles » : féminin pluriel",
            "apaisent":  "Verbe à la 3e personne du pluriel : « Des paroles »",
            "modèrent":  "Verbe à la 3e personne du pluriel : « Elles »",
            "sereins":   "Adjectif accordé avec « les esprits » : masculin pluriel",
            "rend":      "Verbe au singulier : « Cette consolation »",
        },
    ),
}


def sans_accent(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s.lower()) if unicodedata.category(c) != "Mn")


def texte_nu(marked: str) -> str:
    return marked.replace("«", "").replace("»", "")


def trous(marked: str) -> list:
    return re.findall(r"«([^»]+)»", marked)


def compte_mots(t: str) -> int:
    return len([m for m in t.split() if re.search(r"[^\W\d_]", m, re.UNICODE)])


def compte_phrases(t: str) -> int:
    return len([p for p in re.split(r"(?<=[.!?])\s+", t) if p.strip()])


def radical(mot: str) -> str:
    """Radical grossier d'un mot de la liste, pour repérer son réemploi accordé."""
    m = sans_accent(re.sub(r"^(le |la |les |l'|un |une |des |du |s')", "", mot.strip()))
    return m[: max(4, len(m) - 2)]


def verifier(dictee_id: str, marked: str, regles: dict, mots_liste: list) -> list:
    """Retourne la liste des problèmes détectés (vide si tout va bien)."""
    pbs = []
    nu = texte_nu(marked)
    t = trous(marked)

    n_mots, n_phrases = compte_mots(nu), compte_phrases(nu)
    if n_mots > MAX_MOTS:
        pbs.append(f"{n_mots} mots (max {MAX_MOTS})")
    if n_phrases > MAX_PHRASES:
        pbs.append(f"{n_phrases} phrases (max {MAX_PHRASES})")
    if not t:
        pbs.append("aucun trou")

    # Chaque trou doit avoir sa règle, et chaque règle correspondre à un trou.
    for r in t:
        if r not in regles:
            pbs.append(f"trou sans règle : {r}")
    for r in regles:
        if r not in t:
            pbs.append(f"règle sans trou : {r}")

    # Un trou ne doit pas servir d'indice à un autre trou : si la règle d'un
    # trou cite un mot entre « », ce mot doit être visible dans le texte.
    for rep, regle in regles.items():
        for cite in re.findall(r"«\s*([^»]+?)\s*»", regle):
            for mot_cite in cite.split():
                if mot_cite in t:
                    pbs.append(f"« {rep} » s'appuie sur « {mot_cite} », lui-même troué")

    # Réemploi des mots de la dictée : radical, ou forme déclarée dans FORMES
    # pour les verbes irréguliers, ou absence assumée et justifiée.
    nu_plat = sans_accent(nu)
    formes = FORMES.get(dictee_id, {})
    absents = ABSENTS.get(dictee_id, {})
    manquants = []
    for m in mots_liste:
        if radical(m) in nu_plat:
            continue
        if m in formes:
            if sans_accent(formes[m]) in nu_plat:
                continue
            pbs.append(f"forme déclarée absente du texte : {formes[m]}")
            continue
        if m in absents:
            continue
        manquants.append(m)
    if manquants:
        pbs.append(f"mots non réemployés : {', '.join(manquants)}")
    return pbs


def charger_mots() -> dict:
    """Mots de chaque dictée 5e, depuis Supabase."""
    import json
    import urllib.request
    from pathlib import Path

    env = {}
    for ligne in (Path(__file__).parent.parent / ".env.local").read_text(encoding="utf-8").splitlines():
        if "=" in ligne and not ligne.strip().startswith("#"):
            k, v = ligne.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

    out = {}
    for did in TEXTES:
        req = urllib.request.Request(
            f"{url}/rest/v1/dictee_words?select=word&dictee_id=eq.{did}&order=position",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        out[did] = [w["word"] for w in json.load(urllib.request.urlopen(req))]
    return out


def sql_literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    mots = charger_mots()
    total_pbs = 0

    for did, (marked, regles) in TEXTES.items():
        nu = texte_nu(marked)
        pbs = verifier(did, marked, regles, mots.get(did, []))
        total_pbs += len(pbs)
        etat = "OK " if not pbs else "KO "
        print(f"{etat}{did:<14} {compte_mots(nu):>2} mots · {compte_phrases(nu)} phrases · "
              f"{len(trous(marked))} trous · {len(mots.get(did, []))} mots de la liste")
        for p in pbs:
            print(f"      ⚠ {p}")
        for mot, raison in ABSENTS.get(did, {}).items():
            print(f"      · « {mot} » non réemployé — {raison}")

    print(f"\n{len(TEXTES)} textes · {total_pbs} problème(s)")

    if "--sql" in sys.argv:
        if total_pbs:
            sys.exit("SQL non généré : corrige d'abord les problèmes ci-dessus.")
        lignes = [
            "-- Textes d'entraînement des 16 dictées 5e (20/09/2026)",
            "-- Généré par scripts/training-texts-5e.py — vérifié : ≤25 mots, ≤3 phrases,",
            "-- une règle d'accord par trou, aucun trou dépendant d'un autre trou.",
            "",
        ]
        for did, (marked, regles) in TEXTES.items():
            paires = ",\n    ".join(f"{sql_literal(k)}, {sql_literal(v)}" for k, v in regles.items())
            lignes.append(
                f"UPDATE dictees SET training_text = jsonb_build_object(\n"
                f"  'marked', {sql_literal(marked)},\n"
                f"  'rules', jsonb_build_object(\n    {paires}\n  ),\n"
                f"  'validated', true,\n"
                f"  'audio_url', training_text->>'audio_url',\n"
                f"  'updated_at', now()\n"
                f") WHERE id = '{did}';\n"
            )
        lignes.append("SELECT id, training_text->>'marked' AS texte FROM dictees "
                      "WHERE level = '5e' ORDER BY position;")
        sql = "\n".join(lignes)
        chemin = "supabase/seed-training-texts-5e.sql"
        with open(chemin, "w", encoding="utf-8") as f:
            f.write(sql)
        subprocess.run(["pbcopy"], input=sql.encode("utf-8"), check=False)
        print(f"\nSQL écrit dans {chemin} et copié dans le presse-papier.")


if __name__ == "__main__":
    main()
