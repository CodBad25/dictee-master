#!/usr/bin/env python3
"""
Récupère toutes les dictées + mots pour positions ∈ [1-11, 13-26]
et écrit le résultat dans scripts/dictee-words-export.json.

Usage : python3 scripts/fetch-dictee-words.py
"""
import sys
import json
import urllib.request
import urllib.parse
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

def get(path):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"},
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

dictees = get("dictees?select=id,position,title,dictation_text&order=position.asc")
words = get("dictee_words?select=id,dictee_id,word,position,spelling_errors&order=position.asc")

by_dictee = {d["id"]: {**d, "words": []} for d in dictees}
for w in words:
    if w["dictee_id"] in by_dictee:
        by_dictee[w["dictee_id"]]["words"].append(w)

filtered = [
    by_dictee[d["id"]]
    for d in dictees
    if d["position"] != 12
]

out = SCRIPT_DIR / "dictee-words-export.json"
out.write_text(json.dumps(filtered, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"OK — {len(filtered)} dictées exportées → {out}")
print(f"Total mots : {sum(len(d['words']) for d in filtered)}")
