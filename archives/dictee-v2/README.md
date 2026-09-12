# DictéeMaster V2

Application d'entraînement à l'orthographe pour les élèves de 6ème.

## Démarrage rapide

```bash
# Lancer le serveur de développement
npm run dev

# Ouvrir http://localhost:3000
```

## Structure du projet

```
dictee-v2/
├── app/
│   ├── page.tsx              # Page d'accueil (choix élève/enseignant)
│   ├── eleve/
│   │   ├── page.tsx          # Page d'accès élève (saisie du code)
│   │   └── dictee/page.tsx   # Page d'exercices
│   └── enseignant/
│       └── page.tsx          # Liste des 26 dictées avec codes de partage
├── components/
│   └── exercises/            # Composants des 5 modes d'exercice
│       ├── FlashcardMode.tsx    # Voir le mot, le taper
│       ├── AudioMode.tsx        # Écouter le mot, l'écrire
│       ├── SpellingChoiceMode.tsx # Choisir la bonne orthographe
│       ├── DefinitionMode.tsx   # Associer mots et définitions
│       ├── FillBlanksMode.tsx   # Texte à trous
│       └── ResultsScreen.tsx    # Écran de résultats
├── lib/
│   └── dictees-data.ts       # Données générées (26 dictées, 519 mots)
├── odt-sources/              # Fichiers ODT sources
└── scripts/
    ├── generate-complete-data.js  # Script de génération des données
    └── definitions-complete.js    # Dictionnaire des définitions
```

## Données pré-chargées

Les 26 dictées sont déjà générées et prêtes à l'emploi :
- **519 mots** avec définitions adaptées aux 6èmes
- **Erreurs orthographiques** générées algorithmiquement
- **Codes de partage** uniques pour chaque dictée

## Régénérer les données (si nécessaire)

Si vous modifiez les fichiers ODT ou les définitions :

```bash
node scripts/generate-complete-data.js
```

## Utilisation

### Enseignant
1. Aller sur `/enseignant`
2. Voir la liste des 26 dictées
3. Copier le code de partage ou le lien pour les élèves

### Élève
1. Aller sur `/eleve`
2. Entrer le code fourni par l'enseignant (ou accéder via lien direct)
3. Choisir un mode d'exercice parmi les 5 disponibles
4. S'entraîner !

## Technologies

- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- shadcn/ui
- Web Speech API (synthèse vocale pour le mode audio)
