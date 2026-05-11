-- Migration : séparer article et lemma dans dictee_words
-- Idempotente, peut être rejouée sans risque.
--
-- Pourquoi : pour l'exercice « Classes grammaticales », on ne veut pas que
-- l'article stocké biaise la classification. "le prochain" → l'élève doit
-- répondre "adjectif", pas "nom". On garde `word` intact pour les autres
-- exercices (Genre, Flashcard) et on ajoute `article` + `lemma` à côté.

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS article TEXT,
  ADD COLUMN IF NOT EXISTS lemma TEXT;

-- Backfill : pour les mots commençant par un article (avec espace ou apostrophe),
-- on extrait l'article et on met le reste dans lemma.
UPDATE dictee_words
SET
  article = trim(lower(
    substring(word from '^(le |la |les |un |une |des |du |l[''’])')
  )),
  lemma = trim(regexp_replace(
    word,
    '^(le |la |les |un |une |des |du |l[''’])',
    ''
  ))
WHERE
  word ~* '^(le |la |les |un |une |des |du |l[''’])'
  AND (lemma IS NULL OR lemma = '');

-- Pour les mots sans article, lemma = word
UPDATE dictee_words
SET lemma = word
WHERE lemma IS NULL OR lemma = '';

-- Vérification (résultat retourné en console SQL editor)
SELECT
  COUNT(*) FILTER (WHERE article IS NOT NULL) AS avec_article,
  COUNT(*) FILTER (WHERE article IS NULL)     AS sans_article,
  COUNT(*)                                     AS total
FROM dictee_words;
