# DictéeMaster - Document de Contexte

## 1. Vision du Projet
DictéeMaster est une application PWA pour enseignants et élèves de 6ème. Elle transforme des listes de mots issues de documents ODT en exercices interactifs.

## 2. Stack Technique
- **Frontend** : Next.js 16, React 19, TypeScript, Tailwind CSS
- **UI** : shadcn/ui, Radix UI, Framer Motion
- **Gestion d'état** : Zustand avec persistance localStorage
- **Backend** : Supabase (PostgreSQL)
- **IA** : Définitions pré-générées (pas d'API côté élève)

## 3. Les 5 Modes d'Entraînement

| Mode | Identifiant | Description |
|------|-------------|-------------|
| Flashcard | `flashcard` | Voir le mot → le mémoriser → l'écrire |
| Audio | `audio` | Entendre le mot (TTS) → l'écrire |
| Définitions | `definition` | Associer mot ↔ définition |
| Dictée à trous | `fill-blanks` | Remplir les blancs dans un texte |
| Progression | `progression` | Flashcard → Audio → Contexte (adaptatif) |

### Mode Progression
- Après 3 réussites en Flashcard → passage en Audio
- Erreur en Audio → retour en Flashcard

## 4. Architecture V2 (Important!)

### Problème V1
- Définitions générées côté élève avec clé API
- Clé API stockée côté enseignant (localStorage) → inaccessible aux élèves

### Solution V2
- **TOUT est pré-généré** par l'enseignant
- Stocké en base de données
- L'élève utilise les données pré-générées (zéro API côté élève)

## 5. Structure des fichiers ODT

Chaque fichier (ex: "Dictées 1 et 2.odt") contient :

1. **Tableau de mots** : 2 colonnes (Liste n°1 et n°2), ~20 mots chacune
2. **Dictée préparée n°X** : Texte complet + Mot à expliquer + Texte à trous

## 6. Workflow

### Enseignant (une seule fois)
1. Importer les 14 fichiers ODT
2. Système extrait : listes, textes de dictée, textes à trous
3. IA génère : définitions, erreurs orthographiques
4. Stocker en base
5. Partager codes aux élèves

### Élève
1. Entrer le code
2. Choisir le mode d'exercice
3. S'entraîner avec données PRÉ-GÉNÉRÉES
4. Voir ses résultats

## 7. Fichiers clés

| Fichier | Description |
|---------|-------------|
| `/lib/dictees-data.ts` | Données pré-générées (26 dictées, 519 mots, 519 définitions) |
| `/scripts/generate-data-fixed.js` | Script d'extraction ODT principal |
| `/scripts/definitions-complete.js` | Dictionnaire de 514 définitions niveau 6ème |
| `/scripts/generate-fill-blanks.js` | Script de génération des textes à trous |
| `/odt-sources/` | Les 14 fichiers ODT originaux |

## 8. État actuel des données (12 janvier 2026)

| Métrique | Valeur |
|----------|--------|
| Dictées | 26 |
| Mots | 519 |
| Définitions | **519/519 (100%)** |
| Textes de dictée | **26/26 (100%)** |
| Textes à trous | **26/26 (100%)** |

### Détail des textes à trous
- **8 dictées** (1-4, 7-8, 11-12) : extraits directement des fichiers ODT
- **16 dictées** : générés automatiquement en remplaçant les mots de vocabulaire par `_____`
- **2 dictées** (6 et 14) : textes contextuels créés car les textes d'origine ne contenaient pas assez de mots de leurs listes

## 9. Scripts de génération

### Ordre d'exécution
```bash
# 1. Générer les données de base depuis les ODT
node scripts/generate-data-fixed.js

# 2. Compléter les textes à trous manquants
node scripts/generate-fill-blanks.js
```

### Normalisation des apostrophes
Le script gère la conversion des apostrophes typographiques (`'` U+2019) vers les apostrophes droites (`'`) pour la correspondance des définitions.

## 10. Problèmes connus et solutions

### Apostrophes dans les mots
- Les fichiers ODT utilisent l'apostrophe typographique `'` (U+2019)
- Le dictionnaire utilise l'apostrophe droite `'` (U+0027)
- Solution : fonction `normalizeWord()` dans `generate-data-fixed.js`

### Dictées 6 et 14
- Les textes de dictée ne contiennent pas assez de mots de leurs listes
- Solution : textes à trous contextuels créés manuellement dans `fix-missing-blanks.js`

## 11. Commandes utiles

```bash
# Lancer le serveur de développement
npm run dev

# Construire pour la production
npm run build

# Régénérer toutes les données
node scripts/generate-data-fixed.js && node scripts/generate-fill-blanks.js
```

## 12. Codes de partage (exemples)

Les codes sont régénérés à chaque exécution du script. Exemples actuels :
- Dictée n°1 : `N92NW3`
- Dictée n°2 : `NBJZXF`
- (voir `/lib/dictees-data.ts` pour la liste complète)

---
*Document mis à jour le 12 janvier 2026 pour préserver le contexte entre sessions.*
