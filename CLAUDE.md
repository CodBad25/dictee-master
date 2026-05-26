# CLAUDE.md — DictéeMaster

Notes essentielles pour reprendre le projet sans perdre de contexte. À compléter au fur et à mesure des sessions.

## Vision « Distracteurs apprenants » (25/05/2026)

**Idée directrice de Badri.** Le moteur de distracteurs du mode « Choix orthographique » doit s'auto-améliorer dans le temps en exploitant les vraies fautes des élèves. Trois étages, dans l'ordre de priorité :

1. **Bootstrap auto-généré** : pour chaque mot, on part de distracteurs générés via les règles GAFF / Catach (`src/lib/distractor-generator.ts`). Si GAFF ne sort rien sur un mot donné (cas typique : « vertu », « joli », « table », « chien »…), on s'autorise à **inventer** des distracteurs plausibles (LLM ou règles complémentaires) plutôt que de laisser l'exercice vide. Ces distracteurs sont marqués comme « auto » en base.
2. **Capture des vraies fautes** : à chaque session de dictée (`fill_blanks`, `audio_dictation`, `audio_word`), on log les réponses incorrectes des élèves dans une table dédiée (table `dm_word_attempts` déjà existante). On agrège par `mot × faute écrite` : « pour le mot *vertu*, l'élève X a écrit *vertue*, l'élève Y a écrit *verthu* », etc.
3. **Remplacement progressif** : un job (manuel au début, puis automatique) **promeut** les fautes les plus fréquentes au rang de distracteurs officiels en base (`dictee_words.spelling_errors`), et **évince** les distracteurs auto-générés artificiels. Critère de promotion à définir (ex : seuil de 3 élèves distincts ayant fait la même faute sur le même mot).

**Effet pédagogique recherché** : au fil du temps, le mode Choix orthographique présente à l'élève **les fautes que ses pairs commettent vraiment** plutôt que des fautes théoriques. Le moteur devient un outil de remédiation collective, alimenté par les données du collège.

**État au 25/05/2026** : étage 1 implémenté partiellement (générateur lexique-pure, filtre `isLexicalDistractor` qui rejette les fautes d'accord). Étages 2 et 3 pas encore conçus — à designer : schéma `dm_observed_errors` (mot, faute, classe, fréquence, première/dernière occurrence), UI prof pour valider/promouvoir, règles de purge des distracteurs artificiels obsolètes.

**Garde-fou (Nadia, 25/05/2026)** : un distracteur officiel ne doit JAMAIS tester un accord (nombre/genre) ni une conjugaison sur un mot à l'infinitif — seulement l'orthographe lexicale. Ce filtre s'applique aussi bien aux distracteurs auto-générés qu'aux fautes capturées avant promotion.

## Public et identités

DictéeMaster est conçu par **M. Mohamed Belhaj** (prof, collège Chaissac à Pouzauges) pour ses élèves et ses collègues du même établissement. Authentification déléguée au **Hub Beltools** (`https://hub.beltools.fr/api/v1`), pas d'auth Supabase utilisée.

Identités importantes (Hub) :
- **Mohamed BELHAJ** (enseignant) : `a38205b6-5e3c-469e-9314-52a7e293a97f`
- **Lambda BELHAJ** (élève fictif de démonstration), présent dans 3 classes :
  - 6T → eleveId `cmn2ca8bp00rt01rx2gxh72nw`, classeId `cmn2c6ta500rs01rxg75gtr3m`
  - 5T → eleveId `0242ceab-2f0d-49e6-8f44-12328657d312`
  - 4T → eleveId `cmn5x7ccb004m01qogofkj3lp`

Le compte Lambda est partagé par tous les profs (test) et les visiteurs (démo). Si on régénère Lambda dans le Hub, il faudra mettre à jour les IDs codés en dur (notamment dans le bouton 🧪 Tester de `src/app/teacher/page.tsx`).

## Trois modes de connexion sur l'accueil (`src/app/page.tsx`)

1. **Enseignant(e)** → `LoginEnseignant` → Hub avec PIN par enseignant. `user.id = enseignantId Hub`.
2. **Élève** → `LoginEleve` → choix de classe + élève + PIN. `user.role = "student"`, `connectedEleve` setté.
3. **Visiteur / Démo** → `LoginTeacher` (nom historique trompeur) → connexion directe sans mot de passe (le formulaire affiche un champ pré-rempli en lecture seule, à titre purement cosmétique). `user.id = "visitor"`, `user.role = "teacher"`.

## Mode Visiteur — règles RGPD

Le visiteur a `user.id === "visitor"` et était auparavant exposé à toutes les vraies classes Hub avec les vrais prénoms d'élèves. **Garde-fou actuel** : `loadHub()` dans `src/app/teacher/page.tsx` filtre les classes Hub pour ne garder que `"6T"` quand `user.id === "visitor"`. Seule 6T contient des élèves démo (ceux dont le `student_id` commence par `6t-`, cf. `teacher/page.tsx:326-332`).

**TODO** : refonte propre du mode Visiteur avec un dataset complètement fictif (court-circuiter les appels Hub et Supabase). À faire en même temps que la migration vers le VPS Oracle Cloud (cf. section Infra DB).

## Bouton 🧪 Tester (header prof)

Permet au prof de basculer en vue élève sans passer par un compte élève. À chaque clic, il injecte `setConnectedEleve(Lambda 6T)` puis navigue vers `/student`. Toute dictée jouée en mode Tester s'enregistre **réellement** dans `dm_results` sous le student_id de Lambda 6T (souhait explicite : générer des données pour le « regard prof »).

Avant le 01/05/2026, le bouton ne faisait que `router.push("/student")` sans rien injecter. Il marchait par effet de bord (résidu Zustand persisté). Si le store était vidé → vue élève à 0/26 dictées. Le fix le rend idempotent.

**Garde-fou supplémentaire (02/05/2026)** : `src/app/student/page.tsx` affiche désormais un écran "⚠️ Aucun élève connecté" + bouton retour à l'accueil quand le store est hydraté (`_hasHydrated === true`) et que `connectedEleve` est null, au lieu du fallback silencieux "Élève / 0/26 dictées" qui prêtait à confusion.

## Bouton 🧪 Aperçu Éval (header prof, ambre)

Modale `EvalPreviewModal` qui prévisualise une fonctionnalité « sélectionner les dictées qui comptent pour la note ». **Aucune persistance**, aucun impact sur l'export Pronote ou la note officielle. Vise à recueillir l'avis des collègues avant de l'implémenter pour de bon (pattern inspiré de MathExpress / `calcul-mental-prix-v2`).

## Architecture multi-tenant (depuis 02/05/2026)

Tous les bugs multi-tenant historiques sont corrigés. **`dm_classes.hub_class_id`** est désormais la **clé universelle** qui relie le monde Hub (élèves, classes, enseignants) au monde Supabase (`dm_classes`, `dm_results`, `dm_unlock_requests`). Schéma :

- `dm_classes.id` (UUID Supabase, FK depuis `dm_results.class_id` etc.)
- `dm_classes.hub_class_id` (TEXT UNIQUE) — pointe vers le `classeId` Hub
- `dm_classes.teacher_id` (TEXT) — désormais le vrai `enseignantId` Hub (plus de `"teacher"` hardcodé)

**Helper central** : `getDmClassIdByHub(hubClassId)` dans `src/lib/dictee-service.ts` résout l'UUID interne. Toujours l'utiliser côté élève (où on a `connectedEleve.classeId` = ID Hub) avant tout INSERT/SELECT sur `dm_results` ou `dm_unlock_requests`.

Migration appliquée : `supabase/migration-multi-tenant.sql` (idempotente). Garde-fou : index UNIQUE partiel `idx_dm_classes_hub_class_id` empêche désormais les doublons.

Côté élève, ne **jamais** unionner les `unlocked_dictees` de toutes les classes (bug pré-fix) — toujours filtrer sur la `dm_classes` correspondant à `connectedEleve.classeId`.

## Demandes de déverrouillage — pattern intégré (refonte 02/05/2026)

Composant `src/components/unlock-requests-panel.tsx` rendu **directement au-dessus de la grille de dictées prof**, scoped sur `dmClassId` courant. Pas de page séparée, pas de dropdown classe (l'ancien `unlock-requests-manager.tsx` et la page `/teacher/unlock-requests` ont été supprimés).

- Polling 5s (`loadPendingUnlockRequests`). Auto-cache si zéro demande en attente.
- Pour chaque demande : nom élève + chip dictée + temps relatif + **chips d'historique D1..Dn-1** avec score % + nb essais + code couleur (vert ≥90, vert clair 70-89, ambre 40-69, rouge <40, gris si jamais essayé).
- Boutons ✓ (approuver) / ✕ (refuser) — la valeur de status en base est `denied` (pas `rejected`, contrainte CHECK).

**Côté élève** (`src/app/student/page.tsx`), polling 5s qui (a) recharge `unlocked_dictees` de SA classe (filtrée), (b) détecte les transitions de status sur ses propres demandes → toast `🔓 Dictée n°X déverrouillée !` ou erreur si `denied`.

Pattern inspiré de `~/Dev/calcul-mental-prix-v2` (déployé sous math-express.vercel.app).

## Édition manuelle des pièges (depuis 02/05/2026)

Le prof peut personnaliser les `spelling_errors` (distracteurs du mode « Choix orthographique ») de chaque mot via le panneau **🎯 Parcours** → sélection de la dictée → bouton **🪤 N pièges** sur l'item « Choix orthographique » (qui scrolle vers la grille de mots) → clic sur le 🪤 d'un mot → éditeur ambre.

- **Édition globale** (partagée entre tous les profs). Pas d'override par classe pour aujourd'hui — à reconsidérer si Nadia veut un contenu pédagogique différent.
- Migration SQL associée : `supabase/migration-edit-distracteurs.sql` (policies UPDATE/INSERT/DELETE sur `dictee_words`).
- Helper côté code : `updateWordSpellingErrors(dicteeId, position, errors)` dans `src/lib/dictee-service.ts`.
- L'auth réelle est garantie côté UI (panneau Parcours accessible uniquement à un user prof Hub).

## Décisions en attente — Nadia

Les mots à variantes lexicographiques (`"flou (e)"`, `"coucher (se)"`) en `dictee_words` posent un souci UX (l'élève voit littéralement la parenthèse). En attente de la décision pédagogique de Nadia (collègue) entre 3 options : (A) garder le format en base et masquer côté élève, (B) reformater la base sans annotation, (C) garder tel quel + ajouter une consigne dans le mode Choix orthographique. Voir signalements `kr18su` et `3tlpjn` dans `bug_reports` (status `read`).

## Infra DB

DictéeMaster pointe sur Supabase project `szlsapcumkldapomrsqn` (org **Foollmuun's Org**, plan free). Contrainte free = 2 projets actifs max. Quand on veut réveiller `dicteemaster`, il faut pauser **SUIVI STAG** (le projet stagiaire, sans impact). Ne **jamais** pauser **MathEval** = en réalité la DB de `calcul-mental-prix-v2` utilisée par les élèves.

**Symptôme typique de projet pausé** : Lambda voit du vide partout, l'app affiche une grille à zéro. Les `try/catch` silencieux masquent l'erreur réseau. Vérifier d'abord le statut Supabase avant de chercher un bug code.

**Migration cible : VPS Oracle Cloud** (abonnement déjà existant) — c'est le serveur qui héberge déjà le **Hub Beltools** (`hub.beltools.fr`). Détails confirmés côté Hub (`~/Dev/chaissac-hub/CLAUDE.md`) :
- IP : `89.168.61.230`, ARM64 Ampere, Ubuntu, user SSH `ubuntu`, clé `~/Downloads/ssh-key-2026-02-22.key`
- Le Hub tourne en **Docker** sur port 3004, exposé via **Nginx reverse proxy** + **Let's Encrypt** (auto-renew)
- DB du Hub : **Neon Postgres** (serverless), via Prisma 7
- Domaine `hub.beltools.fr` géré sur **DNS OVH** → 89.168.61.230

Le plan VPS OVH évoqué dans une ancienne version de cette doc est **abandonné** : on consolide tout sur le VPS Oracle existant. Pour DictéeMaster, options à trancher : (a) lui ajouter un container Docker à côté du Hub (port libre + nouveau bloc Nginx + sous-domaine), (b) utiliser Neon Postgres au lieu de Supabase pour la DB. Pas encore fait — DictéeMaster pointe toujours sur Supabase free pour aujourd'hui.

## Conventions UI

- **Jamais de menu déroulant `<select>`** pour des choix multiples. Utiliser des chips/tags cliquables ou des boutons toggle.
- Toujours en français correct avec accents (é, è, ê, à, ù, ç…). Ne jamais écrire « etape » au lieu de « étape ».

## Export Pronote

Pattern réutilisable documenté dans le `CLAUDE.md` global de l'utilisateur. Implémentation de référence : `~/Dev/calcul-mental-prix-v2/src/components/teacher/DashboardTable.tsx`. Si on l'ajoute ici, prévoir le **mode aligné Pronote** (textarea pour coller la liste Pronote, matching tolérant des noms, diff visible avant copie).

## Persistance localStorage (Zustand)

Le store `useAppStore` persiste sous la clé `dictee-master-storage` : `user`, `apiConfig`, `connectedEleve`, `lastSelectedClasseId`, `currentStudentName`, `streak`, `badges`, `demoLists`, `demoWords`, `sessionHistory` (limité à 50 entrées). Attention : le localStorage est partagé entre tous les utilisateurs du même navigateur. Si un visiteur passe après un enseignant sans déconnexion explicite, ça peut créer des comportements bizarres (résidus de `connectedEleve`, etc.).

**`lastSelectedClasseId`** — mémorise la classe consultée par le prof pour la restaurer au refresh. Attention : Zustand persist hydrate de manière asynchrone côté client. Tout `useEffect` qui lit une valeur persistée au mount **doit attendre `_hasHydrated`** dans sa dépendance, sinon il s'exécute avec les defaults (= `null`) et le reload écrase la valeur restaurée. Pattern de référence : `loadHub()` dans `src/app/teacher/page.tsx`.
