#!/usr/bin/env python3
"""
Régénère les MP3 des mots individuels via ElevenLabs (voix Matilda).
Les fichiers sont dans /public/audio/*.mp3 (hors sous-dossier dictees/).
Un fichier est régénéré si sa taille est < 50 Ko (signe de mauvaise qualité).
"""

import os, sys, time, requests

# Clé active (2e clé, quota 1ère épuisé)
ELEVENLABS_KEY = "sk_cf6be57ae995d02bb3ec79d7fc4d0350a1150d87f94820ae"
# Clé de secours
ELEVENLABS_KEY_2 = "sk_57188d40f74f5fb250dff6b6084af81143d4cf195de8ec2b"
VOICE_ID = "XrExE9yKIg1WjnnlVkGX"   # Matilda
MODEL_ID = "eleven_multilingual_v2"

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "audio")
MIN_SIZE_OK = 50_000  # fichiers > 50 Ko considérés déjà en bonne qualité

active_key = ELEVENLABS_KEY


# Suffixes féminins/pluriels courts qui suivent un underscore simple
# ex : absent_e → "absent", vivant_e → "vivant"
VARIANT_SUFFIXES = {
    "e", "s", "ve", "ée", "se", "sse", "ille", "elle",
    "ette", "ière", "ier", "eur", "te", "ne", "nne", "le", "tte",
}


def filename_to_text(fname: str) -> str:
    """Convertit un nom de fichier MP3 en texte à prononcer."""
    name = fname.replace(".mp3", "")

    # Double underscore → variante parenthétique : "scellé__ée" → "scellé"
    if "__" in name:
        name = name.split("__")[0]
        return name.replace("_", " ").strip()

    # Single underscore : détecter les suffixes de variante (absent_e → absent)
    parts = name.split("_")
    if len(parts) >= 2 and parts[-1].lower() in VARIANT_SUFFIXES:
        name = "_".join(parts[:-1])

    # Underscores restants → espaces
    name = name.replace("_", " ")

    # Apostrophe : "l épaule" → "l'épaule"
    if name.startswith("l "):
        name = "l'" + name[2:]

    return name.strip()


def generate_mp3(text: str, dest: str, retries: int = 3) -> bool:
    global active_key
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}"
    headers = {
        "xi-api-key": active_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    body = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
    }
    for attempt in range(retries):
        try:
            r = requests.post(url, headers=headers, json=body, timeout=30)
        except Exception as e:
            print(f"    erreur réseau : {e}")
            time.sleep(5)
            continue

        if r.status_code == 200:
            with open(dest, "wb") as f:
                f.write(r.content)
            return True

        if r.status_code == 401:
            # Quota épuisé → basculer sur l'autre clé
            if active_key == ELEVENLABS_KEY:
                print(f"    clé principale épuisée → bascule sur clé de secours")
                active_key = ELEVENLABS_KEY_2
            else:
                print(f"    ✗ les deux clés sont épuisées — arrêt")
                return False
            continue

        if r.status_code == 429 and attempt < retries - 1:
            wait = 5 * (attempt + 1)
            print(f"    rate-limit, pause {wait}s…")
            time.sleep(wait)
            continue

        print(f"    ✗ ElevenLabs {r.status_code}: {r.text[:120]}")
        return False

    return False


def main():
    force = "--force" in sys.argv
    dry_run = "--apply" not in sys.argv

    # Lister tous les MP3 hors sous-dossier dictees/
    all_files = [
        f for f in os.listdir(AUDIO_DIR)
        if f.endswith(".mp3") and os.path.isfile(os.path.join(AUDIO_DIR, f))
    ]
    all_files.sort()

    # Filtrer ceux à régénérer
    to_regen = []
    for fname in all_files:
        path = os.path.join(AUDIO_DIR, fname)
        size = os.path.getsize(path)
        if force or size < MIN_SIZE_OK:
            to_regen.append((fname, size))

    skipped = len(all_files) - len(to_regen)
    print(f"Total fichiers : {len(all_files)}")
    print(f"Déjà OK (≥ 50 Ko) : {skipped}")
    print(f"À régénérer (< 50 Ko) : {len(to_regen)}")

    if dry_run:
        print("\n=== DRY RUN — ajouter --apply pour lancer la génération ===")
        for fname, size in to_regen[:10]:
            text = filename_to_text(fname)
            print(f"  {fname:45s} ({size:>6} o) → « {text} »")
        if len(to_regen) > 10:
            print(f"  … et {len(to_regen) - 10} autres")
        return

    print(f"\n=== Génération ElevenLabs (séquentiel, ~{len(to_regen) * 1.5 / 60:.0f} min estimées) ===\n")
    t0 = time.time()
    ok = 0
    fail = []

    for i, (fname, old_size) in enumerate(to_regen, 1):
        text = filename_to_text(fname)
        dest = os.path.join(AUDIO_DIR, fname)
        print(f"[{i:3d}/{len(to_regen)}] « {text} »", end="  ", flush=True)

        success = generate_mp3(text, dest)
        if success:
            new_size = os.path.getsize(dest)
            print(f"✓  ({old_size:>6} → {new_size:>6} o)")
            ok += 1
        else:
            print(f"✗")
            fail.append(fname)

        # Petite pause entre les appels
        time.sleep(0.3)

    elapsed = time.time() - t0
    print(f"\n{'='*50}")
    print(f"Terminé : {ok}/{len(to_regen)} régénérés en {elapsed:.0f}s")
    if fail:
        print(f"Échecs ({len(fail)}) : {', '.join(fail[:10])}")
        sys.exit(1)


if __name__ == "__main__":
    main()
