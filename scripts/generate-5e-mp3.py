#!/usr/bin/env python3
"""
Génère les MP3 ElevenLabs des 16 dictées 5e (voix Matilda, comme les 6e).
Nommage aligné sur dicteeMp3Path() : dictee-5e-3 → dictee_5e_3.mp3.
Ne régénère pas un fichier déjà présent et valide (> 50 Ko) — relançable.

Usage : python3 scripts/generate-5e-mp3.py
"""

import os
import re
import sys
import time
import json
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
AUDIO_DIR = PROJECT_DIR / "public" / "audio" / "dictees"

VOICE_ID = "XrExE9yKIg1WjnnlVkGX"  # Matilda — même voix que les 6e
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
SUPABASE_KEY = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

# Clé ElevenLabs : env d'abord, sinon celle du script historique (pour ne pas
# dupliquer le secret dans un fichier de plus)
ELEVENLABS_KEY = os.environ.get("ELEVENLABS_KEY", "")
if not ELEVENLABS_KEY:
    ancien = (SCRIPT_DIR / "regenerate-fill-blanks-and-mp3.py").read_text(encoding="utf-8")
    m = re.search(r'ELEVENLABS_KEY = "([^"]+)"', ancien)
    ELEVENLABS_KEY = m.group(1) if m else ""

if not (SUPABASE_URL and SUPABASE_KEY and ELEVENLABS_KEY):
    sys.exit("Configuration manquante (.env.local ou clé ElevenLabs)")


def supabase_get(path: str):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


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


dictees = supabase_get("dictees?select=id,title,dictation_text&level=eq.5e&order=position")
print(f"{len(dictees)} dictées 5e à traiter")

for d in dictees:
    nom = d["id"].replace("-", "_") + ".mp3"  # dictee-5e-3 → dictee_5e_3.mp3
    dest = AUDIO_DIR / nom
    if dest.exists() and dest.stat().st_size > 50_000:
        print(f"  {nom} : déjà présent, ignoré")
        continue
    texte = d["dictation_text"]
    print(f"  {nom} : génération ({len(texte)} caractères)…")
    tts(texte, dest)
    print(f"  {nom} : OK ({dest.stat().st_size // 1024} Ko)")
    time.sleep(1)

print("Terminé.")
