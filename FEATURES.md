# DictéeMaster - Features

Application de dictée pour enseignants et élèves avec gamification.

---

## Fonctionnalités implémentées

### Enseignant

| Feature | Statut | Description |
|---------|--------|-------------|
| Création de listes | ✅ | Créer des listes de mots manuellement ou par import |
| Import PDF | ✅ | Extraire les mots depuis un fichier PDF |
| Import Word (.docx) | ✅ | Extraire les mots depuis un fichier Word |
| Import ODT | ✅ | Extraire les mots depuis LibreOffice avec détection des tableaux |
| Import TXT | ✅ | Extraire les mots depuis un fichier texte |
| Détection multi-sections | ✅ | Scinder automatiquement si plusieurs listes dans un document |
| Code de partage | ✅ | Générer un code unique pour partager avec les élèves |
| Statistiques élèves | ✅ | Voir les résultats de tous les élèves depuis Supabase |
| Export CSV | ✅ | Exporter les statistiques en CSV |
| Configuration API | ✅ | Configurer une clé API (OpenAI, Claude, Mistral) |

### Élève

| Feature | Statut | Description |
|---------|--------|-------------|
| Rejoindre par code | ✅ | Entrer un code pour accéder à une liste |
| Mode Flashcard | ✅ | Voir le mot → le mémoriser → l'écrire |
| Mode Audio | ✅ | Entendre le mot → l'écrire |
| Mode Progression | ✅ | Flashcard puis Audio après 3 réussites d'affilée |
| Mode Dictée à trous | ✅ | Texte généré avec trous + synthèse vocale |
| Chronomètre | ✅ | Mode défi avec temps chronométré |
| Historique | ✅ | Voir ses résultats passés (local + Supabase) |
| Gamification | ✅ | Streaks, badges, confettis |

### Technique

| Feature | Statut | Description |
|---------|--------|-------------|
| PWA | ✅ | Installable sur mobile |
| Supabase | ✅ | Base de données PostgreSQL |
| Synthèse vocale | ✅ | Text-to-speech français |
| Responsive | ✅ | Mobile-first design |

---

## Roadmap - À implémenter

### Organisation des listes (Priorité haute)

| Feature | Statut | Description |
|---------|--------|-------------|
| Champ "Classe" | ⏳ | Assigner une classe à chaque liste (CE1, CM2, etc.) |
| Groupement par classe | ⏳ | Afficher les listes regroupées par classe |
| Tri par date | ⏳ | Trier les listes par date de création (récentes d'abord) |
| Filtres rapides | ⏳ | Filtrer par classe, par mode |
| Recherche | ⏳ | Rechercher une liste par nom |

### Améliorations élève

| Feature | Statut | Description |
|---------|--------|-------------|
| Progression sauvegardée | ⏳ | Reprendre une dictée là où on s'est arrêté |
| Classement | ⏳ | Leaderboard par classe |
| Objectifs | ⏳ | Définir des objectifs de mots par semaine |

### Améliorations enseignant

| Feature | Statut | Description |
|---------|--------|-------------|
| Gestion des classes | ⏳ | Créer/gérer des classes d'élèves |
| Assignation de listes | ⏳ | Assigner des listes à des classes |
| Dates limites | ⏳ | Définir des échéances pour les dictées |
| Rapports détaillés | ⏳ | Analyse des erreurs fréquentes par élève |

### Génération IA

| Feature | Statut | Description |
|---------|--------|-------------|
| Templates améliorés | ⏳ | Plus de variété dans les phrases générées |
| Génération OpenAI | ⏳ | Utiliser GPT pour générer des textes cohérents |
| Génération Claude | ⏳ | Support API Claude |
| Contexte thématique | ⏳ | Générer des textes selon un thème (nature, sport...) |

### Authentification

| Feature | Statut | Description |
|---------|--------|-------------|
| Login enseignant | ⏳ | Authentification par email/mot de passe |
| Comptes élèves | ⏳ | Créer des comptes élèves par l'enseignant |
| SSO / LTI | ⏳ | Intégration avec les ENT scolaires |

---

## Légende

- ✅ Implémenté
- ⏳ À faire
- 🚧 En cours
- ❌ Abandonné

---

## Changelog

### v0.2.0 (2025-01-08)
- Ajout support fichiers ODT (LibreOffice) avec extraction tableaux
- Nouveau mode "Dictée à trous" avec texte généré et synthèse vocale
- Configuration API (OpenAI, Claude, Mistral) pour génération IA
- Correction affichage des résultats élèves/enseignant depuis Supabase
- Mode Progression intelligent (flashcard → audio après 3 réussites)

### v0.1.0 (2025-01-07)
- Version initiale
- Modes Flashcard, Audio, Progression
- Import PDF, Word, TXT
- Gamification (streaks, badges)
- PWA installable
