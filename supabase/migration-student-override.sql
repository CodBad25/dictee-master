-- Migration : personnalisation par élève
-- À exécuter dans le SQL Editor de Supabase

-- Ajouter student_id optionnel à dictee_activity_overrides
ALTER TABLE dictee_activity_overrides ADD COLUMN IF NOT EXISTS student_id TEXT DEFAULT NULL;

-- Supprimer l'ancienne contrainte unique (class_id, dictee_id)
ALTER TABLE dictee_activity_overrides DROP CONSTRAINT IF EXISTS dictee_activity_overrides_class_id_dictee_id_key;

-- Nouvelle contrainte : (class_id, dictee_id, student_id) — student_id peut être NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_overrides_class_dictee_student
  ON dictee_activity_overrides (class_id, dictee_id, COALESCE(student_id, ''));
