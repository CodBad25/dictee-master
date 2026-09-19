-- Migration : réglages de classe manquants en base (12/09/2026)
--
-- Deux colonnes sur dm_classes, regroupées ici parce qu'AUCUNE des deux
-- n'existe encore en production (vérifié le 12/09/2026 : la migration
-- migration-optional-activities.sql du 26/08 n'a jamais été appliquée).
--
--  1. optional_activities  — exercices FACULTATIFS : visibles côté élève mais
--     ne bloquent pas la progression vers l'exercice suivant.
--     (contenu identique à migration-optional-activities.sql, rejouable)
--
--  2. mnemonics_enabled    — commentaires explicatifs d'erreurs (règles
--     mnémotechniques) affichés à l'élève sur l'écran de résultats.
--     Demande de la collègue du 06/09/2026 : les explications sont parfois
--     fausses, mais « pourraient être utiles si elles sont faites
--     convenablement » → on garde la fonction et on la rend désactivable.
--     DEFAULT false : masqués tant que la qualité n'est pas validée.
--     Ne concerne QUE la vue élève ; côté prof (fiche élève, détail dictée)
--     les mnémoniques restent toujours affichées, c'est un outil de diagnostic.
--
-- Idempotente : peut être rejouée sans risque.

ALTER TABLE dm_classes
  ADD COLUMN IF NOT EXISTS optional_activities jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE dm_classes
  ADD COLUMN IF NOT EXISTS mnemonics_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN dm_classes.optional_activities IS
  'Liste des activités facultatives (jsonb array de clés d''activité : flashcard, genre, spelling_choice, fill_blanks, dictionary, ...). Visibles mais non bloquantes pour la progression.';

COMMENT ON COLUMN dm_classes.mnemonics_enabled IS
  'Affiche (true) ou masque (false) les commentaires explicatifs d''erreurs côté élève sur l''écran de résultats. Défaut false.';

-- Vérification : les deux colonnes doivent apparaître.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'dm_classes'
  AND column_name IN ('optional_activities', 'mnemonics_enabled')
ORDER BY column_name;
