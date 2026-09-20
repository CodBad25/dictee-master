#!/usr/bin/env python3
"""
Génère les MP3 ElevenLabs des TEXTES D'ENTRAÎNEMENT (voix Matilda, comme les
dictées 6e et 5e).

Contexte : retour de Nadia du 20/09/2026. Les modes « dictée audio » et « texte
à trous » servaient le texte du jour J, que l'élève apprenait par cœur avant
l'évaluation. Chaque dictée a désormais un texte d'entraînement court, stocké
dans dictees.training_text, qui a besoin de son propre MP3 (celui de la dictée
ne correspond pas au texte lu).

Nommage : dictee-5e-1 → dictee_5e_1_entrainement.mp3, à côté des MP3 existants.
Ne régénère pas un fichier déjà présent et valide (> 20 Ko) — relançable.
Met à jour training_text.audio_url en base après génération.

Usage :
  python3 scripts/generate-training-mp3.py               # toutes les dictées qui ont un texte
  python3 scripts/generate-training-mp3.py dictee-5e-1   # une seule
"""

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = PROJECT_DIR / "public" / "audio" / "dictees"

VOICE_ID = "XrExE9yKIg1WjnnlVkGX"  # Matilda — même voix que les dictées
MODEL_ID = "eleven_multilingual_v2"


def lire_env(chemin: Path) -> dict:
    env = {}
    if not chemin.exists():
        return env
    for ligne in chemin.read_text(encoding="utf-8").splitlines():
        ligne = ligne.strip()
        if not ligne or ligne.startswith("#") or "=" not in ligne:
            continue
        cle, valeur = ligne.split("=", 1)
        env[cle.strip()] = valeur.strip().strip('"')
    return env


env = lire_env(PROJECT_DIR / ".env.local")
SUPABASE_URL = env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = env.get("SUPABASE_SERVICE_ROLE_KEY", "") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# Clé ElevenLabs : env d'abord, sinon celle du script historique (pour ne pas
# dupliquer le secret dans un fichier de plus)
ELEVENLABS_KEY = os.environ.get("ELEVENLABS_KEY", "")
if not ELEVENLABS_KEY:
    ancien = (SCRIPT_DIR / "regenerate-fill-blanks-and-mp3.py").read_text(encoding="utf-8")
    m = re.search(r'ELEVENLABS_KEY = "([^"]+)"', ancien)
    ELEVENLABS_KEY = m.group(1) if m else ""

if not (SUPABASE_URL and SUPABASE_KEY and ELEVENLABS_KEY):
    sys.exit("Configuration manquante (.env.local ou clé ElevenLabs)")

HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


def supabase_get(path: str):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS)
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def supabase_patch(path: str, payload: dict) -> None:
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req).read()


def tts(texte: str, destination: Path) -> None:
    corps = json.dumps({
        "text": texte,
        "model_id": MODEL_ID,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }).encode("utf-8")
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
        data=corps,
        headers={"xi-api-key": ELEVENLABS_KEY, "Content-Type": "application/json"},
    )
    for essai in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                destination.write_bytes(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code == 429 and essai < 2:
                time.sleep(15)
                continue
            raise


def texte_lu(marked: str) -> str:
    """Le texte tel qu'il doit être dicté : sans les guillemets de trou."""
    return marked.replace("«", "").replace("»", "").strip()


cible = sys.argv[1] if len(sys.argv) > 1 else None
filtre = f"&id=eq.{cible}" if cible else ""
dictees = supabase_get(f"dictees?select=id,title,training_text{filtre}&order=position")
avec_texte = [d for d in dictees if d.get("training_text") and d["training_text"].get("marked")]

print(f"{len(avec_texte)} texte(s) d'entraînement à traiter")

for d in avec_texte:
    nom = d["id"].replace("-", "_") + "_entrainement.mp3"
    dest = AUDIO_DIR / nom
    url_publique = f"/audio/dictees/{nom}"

    if dest.exists() and dest.stat().st_size > 20_000:
        print(f"  {nom} : déjà présent, ignoré")
    else:
        texte = texte_lu(d["training_text"]["marked"])
        print(f"  {nom} : génération ({len(texte)} caractères)…")
        tts(texte, dest)
        print(f"  {nom} : OK ({dest.stat().st_size // 1024} Ko)")
        time.sleep(1)

    # Renseigner audio_url sans écraser le reste du JSON (texte, règles, validation)
    if d["training_text"].get("audio_url") != url_publique:
        nouveau = {**d["training_text"], "audio_url": url_publique}
        supabase_patch(f"dictees?id=eq.{d['id']}", {"training_text": nouveau})
        print(f"  {d['id']} : audio_url → {url_publique}")

print("Terminé.")
