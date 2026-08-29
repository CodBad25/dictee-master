#!/usr/bin/env python3
"""
Réimport des mots de dictées depuis les fichiers sources ODT/DOCX.

CHOIX DÉLIBÉRÉ : les colonnes éditées par l'enseignant (spelling_errors,
grammatical_class, definition, audio_url, lemma, article) sont réinitialisées
à NULL lors du réimport. Comme les positions étaient mélangées avant ce fix,
ces overrides étaient de toute façon appliqués sur de mauvais mots. L'enseignant
les ré-éditera après validation du réimport.

Utilisation :
  python3 scripts/reimport-dictees.py           # dry-run (aucune écriture)
  python3 scripts/reimport-dictees.py --apply   # écriture réelle en base

Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY
sont lues depuis .env.local (à la racine du projet).
"""

import sys
import os
import re
import zipfile
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Parsing des arguments
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser(description="Réimport des dictées depuis les sources ODT/DOCX")
parser.add_argument("--apply", action="store_true", help="Écrire réellement en base (défaut : dry-run)")
args = parser.parse_args()

DRY_RUN = not args.apply

# ---------------------------------------------------------------------------
# Lecture des variables d'environnement depuis .env.local
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
ENV_FILE = PROJECT_DIR / ".env.local"

def lire_env(chemin: Path) -> dict:
    env = {}
    if not chemin.exists():
        return env
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, valeur = ligne.split("=", 1)
        env[cle.strip()] = valeur.strip()
    return env

env = lire_env(ENV_FILE)
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variables NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY manquantes dans .env.local")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Imports conditionnels (requêtes HTTP seulement si --apply)
# ---------------------------------------------------------------------------

if not DRY_RUN:
    try:
        import urllib.request
        import json
    except ImportError:
        print("❌ Module urllib manquant (inclus dans la bibliothèque standard Python)")
        sys.exit(1)

# ---------------------------------------------------------------------------
# Fonctions d'extraction ODT / DOCX
# ---------------------------------------------------------------------------

TEXT_REGEX = re.compile(r'<text:p[^>]*>([\s\S]*?)</text:p>')

def _texte_cellule_odt(cell_content: str) -> str:
    """Extrait le texte brut d'une cellule ODT."""
    parties = []
    for m in TEXT_REGEX.finditer(cell_content):
        texte = re.sub(r'<[^>]+>', '', m.group(1))
        texte = texte.replace('&apos;', "'").replace('&amp;', '&').replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>').strip()
        if texte:
            parties.append(texte)
    return '\n'.join(parties)


def extraire_tableaux_odt(xml: str):
    """Retourne list[ list[ list[str] ] ] et dict[table_idx → dict[col_idx → span]]."""
    tableaux = []
    spans_par_tableau = {}

    table_re = re.compile(r'<table:table[^>]*>([\s\S]*?)</table:table>')
    row_re = re.compile(r'<table:table-row[^>]*>([\s\S]*?)</table:table-row>')

    for t_idx, t_match in enumerate(table_re.finditer(xml)):
        contenu_tableau = t_match.group(1)
        lignes = []
        first_row_spans = {}

        for r_idx, r_match in enumerate(row_re.finditer(contenu_tableau)):
            contenu_ligne = r_match.group(1)
            cellules = []
            col_logique = 0
            pos = 0

            while pos < len(contenu_ligne):
                cell_start = contenu_ligne.find('<table:table-cell', pos)
                covered_start = contenu_ligne.find('<table:covered-table-cell', pos)

                if cell_start == -1 and covered_start == -1:
                    break

                is_covered = False
                if cell_start == -1:
                    next_pos = covered_start
                    is_covered = True
                elif covered_start == -1:
                    next_pos = cell_start
                elif covered_start < cell_start:
                    next_pos = covered_start
                    is_covered = True
                else:
                    next_pos = cell_start

                if is_covered:
                    cellules.append('__COVERED__')
                    col_logique += 1
                    end_tag = contenu_ligne.find('/>', next_pos)
                    pos = end_tag + 2 if end_tag != -1 else next_pos + 30
                else:
                    attr_end = contenu_ligne.find('>', next_pos)
                    attrs = contenu_ligne[next_pos:attr_end]
                    cell_end = contenu_ligne.find('</table:table-cell>', attr_end)
                    cell_content = contenu_ligne[attr_end + 1:cell_end]

                    texte = _texte_cellule_odt(cell_content)

                    repeat_m = re.search(r'table:number-columns-repeated="(\d+)"', attrs)
                    repeat = int(repeat_m.group(1)) if repeat_m else 1

                    span_m = re.search(r'table:number-columns-spanned="(\d+)"', attrs)
                    col_span = int(span_m.group(1)) if span_m else 1

                    if r_idx == 0 and col_span > 1:
                        first_row_spans[col_logique] = col_span

                    for _ in range(repeat):
                        cellules.append(texte)
                        col_logique += 1

                    pos = cell_end + 19

            if cellules:
                lignes.append(cellules)

        if lignes:
            tableaux.append(lignes)
            spans_par_tableau[t_idx] = first_row_spans

    return tableaux, spans_par_tableau


def _texte_cellule_docx(cell_content: str) -> str:
    """Extrait le texte brut d'une cellule DOCX OOXML."""
    parties = []
    for m in re.finditer(r'<w:t[^>]*>([^<]*)</w:t>', cell_content):
        t = m.group(1).strip()
        if t:
            parties.append(t)
    return ''.join(parties).strip()


def extraire_tableaux_docx(xml: str):
    """Retourne la même structure que extraire_tableaux_odt mais depuis OOXML."""
    tableaux = []
    spans_par_tableau = {}

    table_re = re.compile(r'<w:tbl>([\s\S]*?)</w:tbl>')
    row_re = re.compile(r'<w:tr[ >]([\s\S]*?)</w:tr>')
    cell_re = re.compile(r'<w:tc>([\s\S]*?)</w:tc>')

    for t_idx, t_match in enumerate(table_re.finditer(xml)):
        contenu_tableau = t_match.group(1)
        lignes = []
        first_row_spans = {}

        for r_idx, r_match in enumerate(row_re.finditer(contenu_tableau)):
            contenu_ligne = r_match.group(1)
            cellules = []
            col_logique = 0

            for c_match in cell_re.finditer(contenu_ligne):
                cell_content = c_match.group(1)

                gs_m = re.search(r'<w:gridSpan w:val="(\d+)"', cell_content)
                grid_span = int(gs_m.group(1)) if gs_m else 1

                texte = _texte_cellule_docx(cell_content)

                if r_idx == 0 and grid_span > 1:
                    first_row_spans[col_logique] = grid_span

                cellules.append(texte)
                col_logique += 1

                # Remplir les colonnes virtuelles couvertes par la fusion
                for _ in range(1, grid_span):
                    cellules.append('__COVERED__')
                    col_logique += 1

            if cellules:
                lignes.append(cellules)

        if lignes:
            tableaux.append(lignes)
            spans_par_tableau[t_idx] = first_row_spans

    return tableaux, spans_par_tableau

# ---------------------------------------------------------------------------
# Détection des en-têtes de listes
# ---------------------------------------------------------------------------

HEADER_PAT = re.compile(r'(liste|dictée|dictee|dict\.?)\s*n?[°º]?\s*(\d+)', re.I)
HEADER_PAT2 = re.compile(r'^n[°º]\s*(\d+)$', re.I)


def detecter_entetes(ligne: list, spans: dict) -> dict:
    """Retourne {col_index: {'titre': str, 'col_span': int}}."""
    entetes = {}
    for idx, cellule in enumerate(ligne):
        if not cellule or cellule.strip() == '' or cellule == '__COVERED__':
            continue
        texte = cellule.strip()
        m = HEADER_PAT.search(texte)
        if m:
            numero = m.group(2)
            g1 = m.group(1).lower()
            prefixe = 'Liste' if 'list' in g1 else 'Dictée'
            col_span = spans.get(idx, 1)
            entetes[idx] = {'titre': f'{prefixe} {numero}', 'col_span': col_span, 'numero': int(numero)}
            continue
        m2 = HEADER_PAT2.search(texte)
        if m2:
            col_span = spans.get(idx, 1)
            entetes[idx] = {'titre': f'Dictée {m2.group(1)}', 'col_span': col_span, 'numero': int(m2.group(1))}
    return entetes

# ---------------------------------------------------------------------------
# Extraction des mots depuis un tableau
# ---------------------------------------------------------------------------

MOTS_IGNORES = {
    'dictée', 'dictées', 'dictee', 'dictees', 'flash', 'mots', 'mot',
    'savoir', 'orthographier', 'orthographe', 'apprendre', 'liste', 'listes',
    'semaine', 'période', 'leçon', 'lecon', 'série', 'évaluation', 'evaluation',
    'contrôle', 'controle', 'exercice', 'exercices', 'révision', 'revision',
    'ce1', 'ce2', 'cm1', 'cm2', 'cp', '6e', '5e', '4e', '3e',
}


def est_valide(mot: str) -> bool:
    nettoyé = re.sub(r'\([^)]*\)', '', mot).strip()
    if len(nettoyé) < 2:
        return False
    if nettoyé == nettoyé.upper() and len(nettoyé) > 2:
        return False
    if re.match(r'^\d+$', nettoyé):
        return False
    if nettoyé.lower() in MOTS_IGNORES:
        return False
    if not re.search(r'[a-zA-ZÀ-ÿ]', nettoyé):
        return False
    return True


def extraire_mots_tableau(tableau: list, spans: dict) -> dict:
    """
    Retourne {numero_dictee: [mots...]} pour toutes les listes détectées.
    """
    if not tableau:
        return {}

    # Chercher la ligne d'en-tête dans les 3 premières lignes
    entetes = {}
    ligne_entete = -1
    for r_idx in range(min(3, len(tableau))):
        row_spans = spans if r_idx == 0 else {}
        candidats = detecter_entetes(tableau[r_idx], row_spans)
        if len(candidats) >= 2:
            entetes = candidats
            ligne_entete = r_idx
            break
        elif len(candidats) == 1 and not entetes:
            entetes = candidats
            ligne_entete = r_idx

    if not entetes:
        return {}

    resultat = {}
    for start_idx in sorted(entetes.keys()):
        info = entetes[start_idx]
        num_cols = info['col_span']
        numero = info['numero']
        mots = []

        for ligne in tableau[ligne_entete + 1:]:
            for offset in range(num_cols):
                col = start_idx + offset
                if col < len(ligne):
                    cellule = ligne[col]
                    if cellule and cellule.strip() and cellule != '__COVERED__':
                        # Une cellule = un item pédagogique. On split uniquement sur les
                        # vraies sauts de ligne (= mots séparés). Les virgules sont
                        # préservées car elles servent à noter les deux genres
                        # (ex: « las, lasse », « précis, précise »).
                        for fragment in re.split(r'\n+', cellule):
                            mot = fragment.strip()
                            if est_valide(mot):
                                mots.append(mot)

        # Dédupliquer en conservant l'ordre
        vus = set()
        mots_uniques = []
        for m in mots:
            cle = m.lower()
            if cle not in vus:
                vus.add(cle)
                mots_uniques.append(m)

        if mots_uniques:
            resultat[numero] = mots_uniques

    return resultat

# ---------------------------------------------------------------------------
# Lecture des fichiers sources
# ---------------------------------------------------------------------------

SOURCES_DIR = Path("/Users/macbelhaj/Dev/dictee-v2/odt-sources")


def lire_fichier(chemin: Path) -> dict:
    """Parse un fichier ODT ou DOCX et retourne {numero: [mots]}."""
    suffixe = chemin.suffix.lower()

    if suffixe == '.odt':
        with zipfile.ZipFile(chemin, 'r') as z:
            try:
                xml = z.read('content.xml').decode('utf-8')
            except KeyError:
                return {}
        tableaux, spans_par_tableau = extraire_tableaux_odt(xml)

    elif suffixe in ('.docx', '.doc'):
        with zipfile.ZipFile(chemin, 'r') as z:
            try:
                xml = z.read('word/document.xml').decode('utf-8')
            except KeyError:
                return {}
        tableaux, spans_par_tableau = extraire_tableaux_docx(xml)

    else:
        return {}

    # Chercher le tableau principal (au moins 2 en-têtes de listes)
    for t_idx, tableau in enumerate(tableaux):
        spans = spans_par_tableau.get(t_idx, {})
        resultat = extraire_mots_tableau(tableau, spans)
        if len(resultat) >= 2:
            return resultat

    # Fallback : un seul tableau
    for t_idx, tableau in enumerate(tableaux):
        spans = spans_par_tableau.get(t_idx, {})
        resultat = extraire_mots_tableau(tableau, spans)
        if resultat:
            return resultat

    return {}

# ---------------------------------------------------------------------------
# Appels Supabase (seulement si --apply)
# ---------------------------------------------------------------------------

import urllib.request
import json


def supabase_get(path: str) -> list:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def supabase_post(path: str, data: list) -> dict:
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def supabase_delete(path: str):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, method='DELETE', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req) as resp:
        return resp.status


def charger_dictees() -> dict:
    """Retourne {position: dictee_id} depuis la table dictees."""
    rows = supabase_get("dictees?select=id,position&order=position")
    return {row['position']: row['id'] for row in rows}


def reimporter_dictee(dictee_id: str, mots: list, dry_run: bool) -> tuple[int, list]:
    """
    Réécrit complètement les mots d'une dictée :
    1. Supprime tous les dictee_words existants pour cette dictée
    2. Insère les nouveaux mots (positions 0..N-1)
    Les colonnes éditées par l'enseignant (spelling_errors, etc.) sont à NULL.
    Retourne (nb_inserts, erreurs).
    """
    erreurs = []

    if dry_run:
        return len(mots), erreurs

    try:
        # Supprimer les mots existants
        supabase_delete(f"dictee_words?dictee_id=eq.{dictee_id}")
    except Exception as e:
        erreurs.append(f"Erreur DELETE dictee_id={dictee_id}: {e}")
        if "row-level security" in str(e).lower() or "403" in str(e) or "401" in str(e):
            erreurs.append(
                "⚠️  RLS bloque l'écriture. Solution :\n"
                "   1. Allez dans Supabase → Table Editor → dictee_words → Policies\n"
                "   2. Désactivez temporairement RLS (ou ajoutez une policy INSERT/DELETE pour anon)\n"
                "   3. Relancez le script avec --apply\n"
                "   4. Réactivez RLS après le réimport"
            )
        return 0, erreurs

    # Insérer les nouveaux mots
    nouveaux = [
        {
            'dictee_id': dictee_id,
            'position': i,
            'word': mot,
            'spelling_errors': None,
            'grammatical_class': None,
            'definition': None,
            'audio_url': None,
            'lemma': None,
            'article': None,
        }
        for i, mot in enumerate(mots)
    ]

    try:
        supabase_post("dictee_words", nouveaux)
    except Exception as e:
        erreurs.append(f"Erreur INSERT dictee_id={dictee_id}: {e}")
        if "row-level security" in str(e).lower() or "403" in str(e) or "401" in str(e):
            erreurs.append(
                "⚠️  RLS bloque l'écriture. Utilisez la service_role_key à la place de l'anon_key.\n"
                "   Ajoutez SUPABASE_SERVICE_ROLE_KEY=... dans .env.local et modifiez ce script\n"
                "   pour lire cette variable au lieu de NEXT_PUBLIC_SUPABASE_ANON_KEY."
            )
        return 0, erreurs

    return len(mots), erreurs

# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def main():
    print(f"{'[DRY-RUN]' if DRY_RUN else '[APPLY]'} Réimport des dictées depuis {SOURCES_DIR}\n")

    if not SOURCES_DIR.exists():
        print(f"❌ Dossier source introuvable : {SOURCES_DIR}")
        sys.exit(1)

    # Lister les fichiers sources
    fichiers = sorted(
        [f for f in SOURCES_DIR.iterdir() if f.suffix.lower() in ('.odt', '.docx', '.doc')],
        key=lambda p: p.name.lower()
    )

    if not fichiers:
        print(f"❌ Aucun fichier ODT/DOCX trouvé dans {SOURCES_DIR}")
        sys.exit(1)

    print(f"Fichiers trouvés : {len(fichiers)}")
    for f in fichiers:
        print(f"  • {f.name}")
    print()

    # Charger la table dictées (seulement si --apply)
    dictees_map = {}
    if not DRY_RUN:
        try:
            dictees_map = charger_dictees()
            print(f"Dictées en base : {len(dictees_map)} entrées\n")
        except Exception as e:
            print(f"❌ Impossible de lire la table dictees : {e}")
            sys.exit(1)

    # Collecter tous les mots parsés
    toutes_dictees = {}  # {numero: {'mots': [...], 'source': nom_fichier}}

    for chemin in fichiers:
        try:
            resultats = lire_fichier(chemin)
        except Exception as e:
            print(f"  ❌ Erreur lecture {chemin.name} : {e}")
            continue

        if not resultats:
            print(f"  ⚠️  {chemin.name} : aucune liste détectée")
            continue

        for numero, mots in sorted(resultats.items()):
            toutes_dictees[numero] = {'mots': mots, 'source': chemin.name}

    print(f"\nDictées parsées : {len(toutes_dictees)}")
    print()

    # Afficher / importer
    total_inserts = 0
    total_erreurs = []
    dictees_pretes = 0

    for numero in sorted(toutes_dictees.keys()):
        info = toutes_dictees[numero]
        mots = info['mots']
        source = info['source']

        if len(mots) == 0:
            print(f"  ⚠️  Dictée {numero:2d} | 0 mots | source: {source}")
            continue

        # Trouver le dictee_id en base
        if DRY_RUN:
            dictee_id = f"<id-dictee-{numero}>"
            print(f"  ✓ N={len(mots):2d} mots prêts pour position {numero} | source: {source}")
            dictees_pretes += 1
            total_inserts += len(mots)
        else:
            dictee_id = dictees_map.get(numero)
            if not dictee_id:
                print(f"  ⚠️  Dictée {numero:2d} | position {numero} absente de la table dictees | ignorée")
                continue

            nb, erreurs = reimporter_dictee(dictee_id, mots, dry_run=False)
            if erreurs:
                print(f"  ❌ Dictée {numero:2d} | {' | '.join(erreurs)}")
                total_erreurs.extend(erreurs)
            else:
                print(f"  ✓ Dictée {numero:2d} | {nb} mots importés | source: {source}")
                dictees_pretes += 1
                total_inserts += nb

    # Récapitulatif
    print()
    print("=" * 60)
    if DRY_RUN:
        print(f"[DRY-RUN] Récapitulatif :")
        print(f"  Dictées prêtes à importer : {dictees_pretes}")
        print(f"  Total mots                : {total_inserts}")
        print(f"  Erreurs                   : {len(total_erreurs)}")
        print()
        print("Pour effectuer l'import réel, relancez avec --apply :")
        print("  python3 scripts/reimport-dictees.py --apply")
    else:
        print(f"[APPLY] Récapitulatif :")
        print(f"  Dictées importées : {dictees_pretes}")
        print(f"  Total INSERT      : {total_inserts}")
        print(f"  Erreurs           : {len(total_erreurs)}")
        if total_erreurs:
            print("\nDétail des erreurs :")
            for e in total_erreurs:
                print(f"  {e}")


if __name__ == "__main__":
    main()
