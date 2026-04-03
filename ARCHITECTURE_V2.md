# DictéeMaster V2 - Architecture

## Vision

Application d'entraînement à l'orthographe pour élèves de 6ème (11-12 ans).
L'enseignant prépare TOUT à l'avance, l'élève ne fait que s'entraîner.

---

## Scénario principal

### 1. Import des documents ODT (une seule fois)

L'enseignant (ou admin) importe les 14-15 fichiers ODT contenant les 29 dictées.

Le système extrait automatiquement :
- **Listes de mots** (Liste n°1, Liste n°2 par dictée)
- **Textes de dictée** (le texte complet)
- **Textes à trous** (version avec blancs)

### 2. Génération IA (une seule fois, côté serveur/enseignant)

Pour chaque mot extrait, le système génère et stocke :
- **Définition** (niveau 6ème, 10-15 mots)
- **Erreurs orthographiques réalistes** (3-4 variantes)
- **Phrase d'exemple** (optionnel)

### 3. Exercices pour les élèves

L'élève choisit une dictée et s'entraîne avec les données PRÉ-GÉNÉRÉES.
Aucune génération côté élève. Tout est instantané.

---

## Modèle de données

```
┌─────────────────────────────────────────────────────────────────┐
│                         DICTEE                                  │
├─────────────────────────────────────────────────────────────────┤
│ id, title, description, share_code                              │
│ dictation_text (texte complet pour audio)                       │
│ fill_blanks_text (texte à trous pour exercice)                  │
│ created_at, updated_at                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WORD_LIST                                  │
├─────────────────────────────────────────────────────────────────┤
│ id, dictee_id, title (ex: "Liste n°1")                          │
│ position (ordre dans la dictée)                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         WORD                                    │
├─────────────────────────────────────────────────────────────────┤
│ id, list_id, word, position                                     │
│ definition (généré par IA, stocké)                              │
│ spelling_errors JSON ["erreur1", "erreur2", "erreur3"]          │
│ example_sentence (optionnel)                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    TRAINING_SESSION                             │
├─────────────────────────────────────────────────────────────────┤
│ id, dictee_id, list_id (nullable), student_name                 │
│ mode_used, total_words, correct_words, percentage               │
│ time_spent_seconds, started_at, finished_at                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     WORD_ATTEMPT                                │
├─────────────────────────────────────────────────────────────────┤
│ id, session_id, word, user_answer, is_correct                   │
│ phase (flashcard, audio, spelling, definition, fill-blanks)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Modes d'exercice

### 1. Flashcard
- Élève voit le mot → le tape
- Données nécessaires : `word`

### 2. Audio
- Élève entend le mot (TTS) → le tape
- Données nécessaires : `word`

### 3. Choix orthographique
- Élève voit le mot correct + 1 erreur → clique sur le bon
- Données nécessaires : `word`, `spelling_errors[0]`

### 4. Définitions (NOUVEAU)
- Élève associe mots et définitions (clic-clic)
- Données nécessaires : `word`, `definition`
- **Tout est pré-stocké**, pas de génération

### 5. Dictée à trous
- Élève complète un texte avec les mots manquants
- Données nécessaires : `fill_blanks_text`, `words[]`

### 6. Parcours (combine plusieurs modes)
- Configurable par l'enseignant
- Ex: Flashcard → Audio → Choix ortho → Définitions

---

## Flux utilisateur

### Enseignant

```
┌──────────────────────────────────────────────────────────────┐
│  1. IMPORT                                                   │
│     └─> Upload ODT(s)                                        │
│         └─> Parser extrait : mots, texte dictée, texte trous │
│                                                              │
│  2. GÉNÉRATION (automatique avec clé API)                    │
│     └─> Pour chaque mot :                                    │
│         ├─> Définition (IA)                                  │
│         └─> Erreurs orthographiques (algorithme)             │
│                                                              │
│  3. VALIDATION                                               │
│     └─> Enseignant revoit/corrige si besoin                  │
│     └─> Sauvegarde en base                                   │
│                                                              │
│  4. PARTAGE                                                  │
│     └─> Code de partage pour les élèves                      │
└──────────────────────────────────────────────────────────────┘
```

### Élève

```
┌──────────────────────────────────────────────────────────────┐
│  1. ACCÈS                                                    │
│     └─> Entre le code de la dictée                           │
│                                                              │
│  2. CHOIX                                                    │
│     └─> Liste n°1 ou n°2                                     │
│     └─> Mode d'exercice (ou parcours complet)                │
│                                                              │
│  3. ENTRAÎNEMENT                                             │
│     └─> Exercices avec données pré-chargées                  │
│     └─> Feedback immédiat                                    │
│                                                              │
│  4. RÉSULTATS                                                │
│     └─> Score, mots à revoir, historique                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Import ODT - Structure attendue

Basé sur les documents des collègues, format typique :

```
┌────────────────────────────────────────┐
│ Dictée n°X - [Titre]                   │
├────────────────────────────────────────┤
│ Tableau des mots :                     │
│ ┌─────────────┬─────────────┐          │
│ │ Liste n°1   │ Liste n°2   │          │
│ ├─────────────┼─────────────┤          │
│ │ mot1        │ mot6        │          │
│ │ mot2        │ mot7        │          │
│ │ ...         │ ...         │          │
│ └─────────────┴─────────────┘          │
├────────────────────────────────────────┤
│ Texte de la dictée :                   │
│ "Lorem ipsum dolor sit amet..."        │
├────────────────────────────────────────┤
│ Texte à trous :                        │
│ "Lorem _____ dolor sit _____..."       │
└────────────────────────────────────────┘
```

---

## Stack technique

- **Frontend** : Next.js 16 + React + Tailwind + shadcn/ui
- **Backend** : Supabase (PostgreSQL + Auth)
- **IA** : DeepSeek API (génération définitions)
- **TTS** : Web Speech API (synthèse vocale française)
- **Déploiement** : Netlify (puis PlanetHoster)

---

## Ce qui change par rapport à V1

| Aspect | V1 (actuel) | V2 (nouveau) |
|--------|-------------|--------------|
| Définitions | Générées à la volée côté élève | Pré-générées et stockées |
| Clé API | Nécessaire côté élève | Uniquement côté enseignant |
| Config exercices | Élève choisit nb mots | Enseignant configure tout |
| Import | Un fichier = une liste | Un fichier = dictée complète |
| Structure | Liste de mots simple | Dictée avec listes + textes |

---

## Plan d'implémentation

### Phase 1 : Import et parsing (avec vrais ODT)
1. Recevoir les 14-15 fichiers ODT
2. Analyser la structure exacte
3. Créer le parser robuste
4. Extraire toutes les données

### Phase 2 : Génération des contenus
1. Générer toutes les définitions (IA)
2. Générer toutes les erreurs orthographiques
3. Stocker en base Supabase
4. Interface de validation enseignant

### Phase 3 : Exercices élève
1. Adapter les modes existants (flashcard, audio, choix)
2. Créer le mode Définitions (avec données pré-stockées)
3. Mode dictée à trous (avec vrai texte)
4. Parcours configurable

### Phase 4 : Polish
1. Dashboard enseignant amélioré
2. Statistiques par dictée
3. Export résultats
4. Déploiement PlanetHoster

---

## Prochaine étape

**Attendre les fichiers ODT des collègues** pour :
1. Valider la structure supposée
2. Adapter le parser
3. Commencer l'implémentation
