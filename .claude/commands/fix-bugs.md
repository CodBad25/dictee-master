# Gestion des signalements élèves — DictéeMaster

## Contexte

Les élèves et enseignants signalent des bugs via le bouton flottant 🐛. Les signalements sont stockés dans la table `bug_reports` de Supabase.

Chaque signalement contient : description, prénom (classe), URL de la page, capture d'écran (base64), statut (new/read/resolved), note admin.

## Workflow

### Étape 1 : Lire les signalements

Exécuter ce script pour récupérer les signalements non résolus depuis Supabase :

```bash
source .env.local && curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bug_reports?status=neq.resolved&order=created_at.desc&select=id,description,reporter_name,reporter_type,status,page_url,admin_note,created_at" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
if (data.length === 0) { console.log('Aucun signalement en attente.'); process.exit(); }
for (const b of data) {
  console.log('===');
  console.log('ID:', b.id);
  console.log('De:', b.reporter_name || '(anonyme)', '—', b.reporter_type);
  console.log('Date:', new Date(b.created_at).toLocaleString('fr-FR'));
  console.log('Statut:', b.status);
  console.log('Description:', b.description);
  console.log('Page:', b.page_url);
  if (b.admin_note) console.log('Note admin:', b.admin_note);
}
console.log('=== Total:', data.length);
"
```

Pour voir la capture d'écran d'un signalement spécifique :

```bash
source .env.local && curl -s "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bug_reports?id=eq.ID_ICI&select=screenshot" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
if (data[0]?.screenshot) {
  const b64 = data[0].screenshot.replace(/^data:image\/\w+;base64,/, '');
  require('fs').writeFileSync('/tmp/bug_screenshot.jpg', Buffer.from(b64, 'base64'));
  console.log('Screenshot sauvegardé dans /tmp/bug_screenshot.jpg');
} else { console.log('Pas de capture pour ce signalement.'); }
"
```

### Étape 2 : Investiguer chaque signalement

Pour chaque signalement :

1. **Analyser la description** : est-ce un bug, une question, ou une préférence ?
2. **Si bug potentiel** :
   - Extraire le contexte depuis la description (entre crochets : `[Espace élève]`, `[Dictée X — Titre]`, etc.)
   - Chercher dans les composants concernés (`src/components/`)
   - Chercher dans les services (`src/lib/`)
   - Identifier la cause racine
3. **Présenter les trouvailles à l'utilisateur** avec une recommandation :
   - ✅ "Bug clair, je peux corriger" → décrire le fix proposé
   - ⚠️ "Bug possible mais j'ai besoin de ton avis" → expliquer le doute
   - ❌ "Pas un bug" → expliquer pourquoi

### Étape 3 : Corriger (avec autorisation)

- **Bugs clairs** (typos, contenu incorrect, coquilles) : corriger directement
- **Bugs de code** (logique, rendu, navigation) : proposer le fix et attendre le feu vert
- **Questions/préférences** : ne pas modifier le code, juste suggérer une réponse

### Étape 4 : Mettre à jour le signalement

Après correction, marquer le signalement comme résolu avec une note pour l'élève :

```bash
source .env.local && curl -s -X PATCH \
  "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bug_reports?id=eq.ID_ICI" \
  -H "apikey: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status": "resolved", "admin_note": "NOTE_ICI", "resolved_at": "DATETIME_ICI"}'
```

Remplacer :
- `ID_ICI` par l'ID du signalement
- `NOTE_ICI` par la réponse à l'élève (bienveillante, en le nommant par son prénom)
- `DATETIME_ICI` par la date/heure courante au format ISO (ex: `2026-04-04T12:00:00Z`)

## Structure du projet

- `src/components/` — Composants React (modes d'entraînement, grilles, etc.)
- `src/lib/` — Services (supabase, hub, dictee-service, gamification, etc.)
- `src/app/student/page.tsx` — Page élève
- `src/app/teacher/page.tsx` — Dashboard enseignant
- `src/app/admin/page.tsx` — Espace admin

## Règles importantes

- **JAMAIS corriger sans avoir vérifié** : toujours lire le code/contenu avant de modifier
- **JAMAIS push sans autorisation** : demander le feu vert de l'utilisateur avant git push
- **Messages bienveillants et personnalisés** : les réponses aux élèves doivent être encourageantes et utiliser le prénom de l'élève (ex: "Merci Inès, c'est corrigé !")
- **Anonymisation** : ne jamais stocker ni afficher le nom de famille des élèves
- **Priorité** : traiter les bugs "new" en premier, puis les "read"
- **Signature** : les réponses viennent de M. Belhaj
