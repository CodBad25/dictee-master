# CLAUDE.md — DictéeMaster

Notes essentielles pour reprendre le projet sans perdre de contexte. À compléter au fur et à mesure des sessions.

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

**TODO** : refonte propre du mode Visiteur avec un dataset complètement fictif (court-circuiter les appels Hub et Supabase). À faire en même temps que la migration VPS OVH pour ne pas refondre la couche data deux fois.

## Bouton 🧪 Tester (header prof)

Permet au prof de basculer en vue élève sans passer par un compte élève. À chaque clic, il injecte `setConnectedEleve(Lambda 6T)` puis navigue vers `/student`. Toute dictée jouée en mode Tester s'enregistre **réellement** dans `dm_results` sous le student_id de Lambda 6T (souhait explicite : générer des données pour le « regard prof »).

Avant le 01/05/2026, le bouton ne faisait que `router.push("/student")` sans rien injecter. Il marchait par effet de bord (résidu Zustand persisté). Si le store était vidé → vue élève à 0/26 dictées. Le fix le rend idempotent.

## Bouton 🧪 Aperçu Éval (header prof, ambre)

Modale `EvalPreviewModal` qui prévisualise une fonctionnalité « sélectionner les dictées qui comptent pour la note ». **Aucune persistance**, aucun impact sur l'export Pronote ou la note officielle. Vise à recueillir l'avis des collègues avant de l'implémenter pour de bon (pattern inspiré de MathExpress / `calcul-mental-prix-v2`).

## Bugs multi-tenant identifiés (à corriger avant ouverture aux autres profs)

1. `src/lib/dictee-service.ts:75` — `class_id` UUID codé en dur (`'3a2441f8-fd51-46de-8d7c-b58a2b8f6f50'`). Toutes les sessions atterrissent dans la classe historique de Belhaj.
2. `src/app/teacher/page.tsx:227,239` — `teacher_id: "teacher"` codé en dur (au lieu de `user.id`). Tous les enseignants partagent le même record `dm_classes` par nom de classe.
3. `src/app/teacher/page.tsx:271` — typo `unlocked_positions` au lieu de `unlocked_dictees`. Le déverrouillage UI échoue silencieusement.

Le fix nécessite aussi une migration SQL pour ré-attribuer les `dm_results.class_id` historiques aux bons enseignants/classes (mapping `student_id` → `enseignantId` via Hub).

## Infra DB

DictéeMaster pointe sur Supabase project `szlsapcumkldapomrsqn` (org **Foollmuun's Org**, plan free). Contrainte free = 2 projets actifs max. Quand on veut réveiller `dicteemaster`, il faut pauser **SUIVI STAG** (le projet stagiaire, sans impact). Ne **jamais** pauser **MathEval** = en réalité la DB de `calcul-mental-prix-v2` utilisée par les élèves.

**Symptôme typique de projet pausé** : Lambda voit du vide partout, l'app affiche une grille à zéro. Les `try/catch` silencieux masquent l'erreur réseau. Vérifier d'abord le statut Supabase avant de chercher un bug code.

**Plan validé** : migration vers le **VPS OVH `vps-4560c090.vps.ovh.net`** (déjà payé ~12 €/mois TTC, 6 vCPU + 12 Go RAM + 100 Go SSD, Ubuntu 24.04, IPv4 91.134.135.96). Sur ce VPS : Coolify + Postgres unifié (1 schéma par projet) + Soketi (Realtime pour la vue live élèves) + Caddy + backups Backblaze B2. À faire en une session de ~4 h. Réversible (résiliation OVH possible à anniversaire mensuel).

## Conventions UI

- **Jamais de menu déroulant `<select>`** pour des choix multiples. Utiliser des chips/tags cliquables ou des boutons toggle.
- Toujours en français correct avec accents (é, è, ê, à, ù, ç…). Ne jamais écrire « etape » au lieu de « étape ».

## Export Pronote

Pattern réutilisable documenté dans le `CLAUDE.md` global de l'utilisateur. Implémentation de référence : `~/Dev/calcul-mental-prix-v2/src/components/teacher/DashboardTable.tsx`. Si on l'ajoute ici, prévoir le **mode aligné Pronote** (textarea pour coller la liste Pronote, matching tolérant des noms, diff visible avant copie).

## Persistance localStorage (Zustand)

Le store `useAppStore` persiste sous la clé `dictee-master-storage` : `user`, `apiConfig`, `connectedEleve`, `currentStudentName`, `streak`, `badges`, `demoLists`, `demoWords`, `sessionHistory` (limité à 50 entrées). Attention : le localStorage est partagé entre tous les utilisateurs du même navigateur. Si un visiteur passe après un enseignant sans déconnexion explicite, ça peut créer des comportements bizarres (résidus de `connectedEleve`, etc.).
