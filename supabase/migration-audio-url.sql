-- Migration : ajouter la colonne audio_url à dictee_words
-- Idempotente. Permet à l'enseignant d'enregistrer un audio personnalisé
-- pour chaque mot (remplace la synthèse vocale du navigateur).

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Vérification
SELECT
  COUNT(*) FILTER (WHERE audio_url IS NOT NULL) AS avec_audio,
  COUNT(*) FILTER (WHERE audio_url IS NULL)     AS sans_audio,
  COUNT(*)                                       AS total
FROM dictee_words;
