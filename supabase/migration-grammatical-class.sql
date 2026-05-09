-- Migration : ajout de la classe grammaticale par mot
-- Idempotente : peut être rejouée sans casser quoi que ce soit.

ALTER TABLE dictee_words
  ADD COLUMN IF NOT EXISTS grammatical_class TEXT;

-- Valeurs autorisées (commentaire informatif, pas de contrainte CHECK pour rester souple) :
-- 'nom', 'nom_propre', 'verbe', 'adjectif', 'determinant', 'pronom', 'adverbe', 'preposition', 'conjonction'
