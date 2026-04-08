-- Migration : Configuration du parcours enseignant
-- À exécuter dans le SQL Editor de Supabase

-- Ajouter la colonne selected_words pour stocker les mots sélectionnés par dictée
-- NULL = tous les mots actifs (comportement par défaut)
-- Valeur : tableau de positions de mots actifs, ex: [0, 2, 5, 8]
ALTER TABLE dictee_activity_overrides
  ADD COLUMN IF NOT EXISTS selected_words JSONB DEFAULT NULL;

-- RLS sur dictee_activity_overrides (manquante)
ALTER TABLE dictee_activity_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dictee_activity_overrides' AND policyname = 'overrides_select'
  ) THEN
    CREATE POLICY "overrides_select" ON dictee_activity_overrides FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dictee_activity_overrides' AND policyname = 'overrides_insert'
  ) THEN
    CREATE POLICY "overrides_insert" ON dictee_activity_overrides FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dictee_activity_overrides' AND policyname = 'overrides_update'
  ) THEN
    CREATE POLICY "overrides_update" ON dictee_activity_overrides FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dictee_activity_overrides' AND policyname = 'overrides_delete'
  ) THEN
    CREATE POLICY "overrides_delete" ON dictee_activity_overrides FOR DELETE USING (true);
  END IF;
END $$;
