#!/usr/bin/env python3
"""
Applique les distracteurs (spelling_errors) à dictee_words via l'API REST
Supabase. Utilisé en lieu et place d'un copier/coller SQL.

Usage :
  python3 scripts/apply-distractors.py D13           # applique uniquement D13
  python3 scripts/apply-distractors.py D13 --dry-run # voit sans écrire
  python3 scripts/apply-distractors.py all           # toutes les dictées définies

Les données vivent dans scripts/distractors_data.py.
"""
import sys
import json
import urllib.request
import urllib.error
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
ENV_FILE = PROJECT_DIR / ".env.local"

env = {}
for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip()

URL = env["NEXT_PUBLIC_SUPABASE_URL"]
KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]

sys.path.insert(0, str(SCRIPT_DIR))
from distractors_data import DISTRACTORS  # noqa: E402

dry_run = "--dry-run" in sys.argv
targets = [a for a in sys.argv[1:] if not a.startswith("--")]
if not targets:
    print("Usage : python3 scripts/apply-distractors.py D13 [--dry-run]")
    sys.exit(1)

if targets == ["all"]:
    keys = list(DISTRACTORS.keys())
else:
    keys = targets

total_updates = 0
errors = 0

for k in keys:
    if k not in DISTRACTORS:
        print(f"❌ {k} : pas de données définies dans distractors_data.py")
        continue
    dictee_id = DISTRACTORS[k]["dictee_id"]
    entries = DISTRACTORS[k]["words"]
    print(f"\n=== {k} ({dictee_id}, {len(entries)} mots) ===")

    for pos, word, errs in entries:
        label = f"  [{pos:>2}] {word:<25} → {errs}"
        if dry_run:
            print(label, "[DRY-RUN]")
            continue
        body = json.dumps({"spelling_errors": errs}).encode("utf-8")
        url = f"{URL}/rest/v1/dictee_words?dictee_id=eq.{dictee_id}&position=eq.{pos}"
        req = urllib.request.Request(
            url, data=body, method="PATCH",
            headers={
                "apikey": KEY,
                "Authorization": f"Bearer {KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
        )
        try:
            with urllib.request.urlopen(req) as r:
                if r.status in (200, 204):
                    print(label, "✓")
                    total_updates += 1
                else:
                    print(label, f"⚠️ HTTP {r.status}")
                    errors += 1
        except urllib.error.HTTPError as e:
            print(label, f"❌ HTTP {e.code} — {e.read().decode()}")
            errors += 1

print(f"\n=== Résumé : {total_updates} mots mis à jour, {errors} erreurs ===")
