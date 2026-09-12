# Archive — ancien dossier ~/Dev/dictee-v2

Sauvegarde du contenu versionné du dossier `~/Dev/dictee-v2`, supprimé le 12/09/2026
après vérification qu'il s'agissait d'un prototype abandonné (3 commits, aucun remote GitHub).

La version de référence de DictéeMaster est **ce dépôt** (`dictee-master`), déployé sur
https://dictee-master.vercel.app

## Pourquoi cette archive

Ces fichiers n'existaient nulle part ailleurs sur la machine (ni dans `~/Documents`,
ni dans Nextcloud, ni sur GitHub). Contenu à conserver en particulier :

- **`odt-sources/`** — les 14 fichiers ODT/DOCX originaux des dictées de la collègue
  (dictées 1 à 28). Documents pédagogiques sources : ne jamais supprimer.
- `dictes.zip` — archive des mêmes sources.
- `lib/odt-parser.ts` et `scripts/parse-all-odt.js` — chaîne de conversion ODT → données.
- `lib/dictees-5e-data.ts` — données 5e extraites des ODT.
- `CONTEXTE.md` — notes de contexte du prototype.

Le reste (composants React, `lib/supabase.ts`, schéma SQL) a été repris et retravaillé
dans `src/` du dépôt principal — conservé ici seulement à titre de référence historique.

Dernier commit du prototype : `d7db02c` — 28/08/2026 — « Niveau 5e : 16 dictées de la
collègue (champ lexical + mot vedette + point orthographique) ».
