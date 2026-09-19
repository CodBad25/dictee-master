-- Migration : journal « Nouveautés » enseignant (19/09/2026)
--
-- Même mécanisme que sur les sites de maths (belmathen6eme, maths-5e…) :
-- le contenu des nouveautés est dans le code (src/content/nouveautes.ts) ;
-- la base ne mémorise que la DERNIÈRE ENTRÉE VUE par enseignant, pour
-- afficher un compteur de non-lues et surligner les nouvelles entrées.
--
-- Idempotente : peut être rejouée sans risque.

CREATE TABLE IF NOT EXISTS dm_nouveautes_vues (
  teacher_id TEXT PRIMARY KEY,          -- enseignantId Hub
  derniere_vue_id TEXT,                 -- id de l'entrée la plus récente vue
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dm_nouveautes_vues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dm_nouveautes_vues_all" ON dm_nouveautes_vues;
CREATE POLICY "dm_nouveautes_vues_all" ON dm_nouveautes_vues FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE dm_nouveautes_vues IS
  'Curseur de lecture du journal Nouveautés, par enseignant (le contenu est dans le code).';

-- Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'dm_nouveautes_vues'
ORDER BY ordinal_position;
