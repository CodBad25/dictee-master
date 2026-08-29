-- Migration : notion de NIVEAU (6e / 5e) sur les dictées et les classes.
-- Contexte : intégration des 16 dictées 5e de la collègue de français (août 2026).
-- Le corpus historique (26 dictées) devient le niveau '6e' ; les dictées 5e
-- auront des ids `dictee-5e-N` et leurs propres positions 1..16.
-- Chaque dm_classes porte son niveau : le front filtre grilles, notes /20,
-- exports et déverrouillages sur les dictées du niveau de la classe.
-- Idempotente : peut être rejouée sans risque.
-- À exécuter dans le SQL Editor de Supabase.

-- 1) Niveau sur les dictées (tout l'existant = 6e)
ALTER TABLE dictees
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT '6e';

COMMENT ON COLUMN dictees.level IS
  'Niveau scolaire du corpus : ''6e'', ''5e'' (extensible ''4e'', ''3e''). Pas de contrainte CHECK pour rester souple.';

-- 2) La position n'est unique QUE dans un niveau (D1 de 6e ≠ D1 de 5e)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dictees_level_position
  ON dictees(level, position);

-- 2 bis) Métadonnées pédagogiques des dictées 5e (NULL pour les 6e existantes)
ALTER TABLE dictees
  ADD COLUMN IF NOT EXISTS ortho_point TEXT,
  ADD COLUMN IF NOT EXISTS lexical_theme TEXT,
  ADD COLUMN IF NOT EXISTS star_word TEXT;

COMMENT ON COLUMN dictees.ortho_point IS
  'Point orthographique principal travaillé (colonne 2 du doc de progression — sans les révisions systématiques).';
COMMENT ON COLUMN dictees.lexical_theme IS 'Thème du champ lexical (ex. « l''observation »).';
COMMENT ON COLUMN dictees.star_word IS 'Mot vedette ⭐ de la dictée.';

-- 3) Niveau sur les classes (l'existant = 6e, backfill par le nom sinon)
ALTER TABLE dm_classes
  ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT '6e';

COMMENT ON COLUMN dm_classes.level IS
  'Niveau de la classe (''6e'', ''5e''…). Rempli à la création depuis HubClasse.niveau ; le front ne montre à la classe que les dictées de son niveau.';

-- Backfill de sécurité : classes dont le nom commence par 5 (ex. « 5T », « 5A »)
UPDATE dm_classes SET level = '5e' WHERE name LIKE '5%' AND level = '6e';

-- Vérification (à exécuter après la migration) :
-- SELECT level, COUNT(*) FROM dictees GROUP BY level;
-- SELECT name, level FROM dm_classes ORDER BY name;
