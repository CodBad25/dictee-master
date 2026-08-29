-- Migration : exercices FACULTATIFS au niveau classe
-- Une activité listée ici reste visible côté élève, mais ne bloque pas la
-- progression vers l'exercice suivant (cas d'usage : Dictionnaire facultatif
-- pour les 6A). Le réglage s'applique à toutes les dictées de la classe.
-- Idempotente : peut être rejouée sans risque.

ALTER TABLE dm_classes
  ADD COLUMN IF NOT EXISTS optional_activities jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dm_classes.optional_activities IS
  'Liste des activités facultatives (jsonb array de clés d''activité : flashcard, genre, spelling_choice, fill_blanks, dictionnaire, ...). Visibles mais non bloquantes pour la progression.';
