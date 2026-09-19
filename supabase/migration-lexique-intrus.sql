-- Migration : intrus précalculés pour l'exercice « Famille & synonymes » (20/09/2026)
--
-- Tirer les intrus dans la même dictée donnait des mots voisins par le sens
-- (chaque dictée est un champ lexical homogène). Ils sont désormais tirés dans
-- les familles des AUTRES dictées, relus, stockés par mot et modifiables par
-- l'enseignant dans l'onglet 🧩 (validés avec le mot, via lexicon_validated).
-- Idempotente.

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS intrus jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dictee_words.intrus IS
  'Intrus de l''exercice Famille & synonymes (jsonb array de chaînes) : ni famille ni synonyme du mot, champ lexical différent.';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'dictee_words' AND column_name = 'intrus';
