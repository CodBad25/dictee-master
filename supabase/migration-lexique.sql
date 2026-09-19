-- Migration : lexique par mot — mots de la même famille + synonymes (19/09/2026)
--
-- Demande de la collègue (mail du 06/09/2026, point 5) : un exercice sur les
-- mots de la même famille et les synonymes, pour exploiter le champ lexical
-- de chaque dictée 5e. Le contenu initial (160 mots) est généré par l'IA à
-- partir de ses définitions, puis RELU ET VALIDÉ par elle dans l'application
-- (panneau 🎯 Parcours → Personnaliser les mots → onglet 🧩 Famille & synonymes).
--
--  - word_family        : mots de la même famille (jsonb array de chaînes)
--  - synonyms           : synonymes dans le sens de la définition (jsonb array)
--  - lexicon_validated  : false tant que la collègue n'a pas validé le mot.
--                         L'exercice élève n'utilise QUE les mots validés.
--
-- Idempotente : peut être rejouée sans risque.

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS word_family jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS synonyms jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS lexicon_validated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN dictee_words.word_family IS
  'Mots de la même famille (jsonb array de chaînes, sans article). Contenu initial généré par IA, à valider par l''enseignant.';

COMMENT ON COLUMN dictee_words.synonyms IS
  'Synonymes du mot dans le sens de sa définition (jsonb array de chaînes, sans article). Contenu initial généré par IA, à valider par l''enseignant.';

COMMENT ON COLUMN dictee_words.lexicon_validated IS
  'true quand l''enseignant a relu et validé famille + synonymes. Seuls les mots validés alimentent l''exercice élève.';

-- Vérification : les trois colonnes doivent apparaître.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'dictee_words'
  AND column_name IN ('word_family', 'synonyms', 'lexicon_validated')
ORDER BY column_name;
