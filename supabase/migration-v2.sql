-- ============================================
-- DictéeMaster V2 — Migration
-- Système de cartes avec parcours imposé
-- ============================================

-- Dictées (les 26 pré-générées)
CREATE TABLE IF NOT EXISTS dictees (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  dictation_text TEXT DEFAULT '',
  fill_blanks_text TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mots par dictée
CREATE TABLE IF NOT EXISTS dictee_words (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dictee_id TEXT NOT NULL REFERENCES dictees(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  definition TEXT DEFAULT '',
  spelling_errors JSONB DEFAULT '[]',
  position INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dictee_words_dictee ON dictee_words(dictee_id);

-- Classes enseignant (liées au Hub via teacher_id = identifiant enseignant)
CREATE TABLE IF NOT EXISTS dm_classes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  -- Dictées déverrouillées (positions). Par défaut seule la 1ère est ouverte.
  unlocked_dictees JSONB DEFAULT '[1]',
  -- Ordre des activités par défaut pour cette classe
  default_activity_order JSONB DEFAULT '["flashcard","spelling_choice","definitions","fill_blanks","audio"]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ordre des activités personnalisé par dictée (override du défaut)
CREATE TABLE IF NOT EXISTS dictee_activity_overrides (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES dm_classes(id) ON DELETE CASCADE,
  dictee_id TEXT NOT NULL REFERENCES dictees(id) ON DELETE CASCADE,
  activity_order JSONB NOT NULL,
  UNIQUE(class_id, dictee_id)
);

-- Déverrouillages individuels par élève
CREATE TABLE IF NOT EXISTS student_unlocked_dictees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES dm_classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  dictee_position INTEGER NOT NULL,
  UNIQUE(class_id, student_id, dictee_position)
);

-- Demandes de déverrouillage
CREATE TABLE IF NOT EXISTS dm_unlock_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES dm_classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  dictee_position INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  deny_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(class_id, student_id, dictee_position)
);

-- Résultats par élève par dictée par activité
CREATE TABLE IF NOT EXISTS dm_results (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  class_id TEXT NOT NULL REFERENCES dm_classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  dictee_id TEXT NOT NULL REFERENCES dictees(id),
  activity_mode TEXT NOT NULL CHECK (activity_mode IN ('flashcard', 'audio', 'spelling_choice', 'definitions', 'fill_blanks')),
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  time_spent INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_results_class ON dm_results(class_id);
CREATE INDEX IF NOT EXISTS idx_dm_results_student ON dm_results(student_id);
CREATE INDEX IF NOT EXISTS idx_dm_results_dictee ON dm_results(dictee_id);

-- Tentatives mot par mot
CREATE TABLE IF NOT EXISTS dm_word_attempts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  result_id TEXT NOT NULL REFERENCES dm_results(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dm_word_attempts_result ON dm_word_attempts(result_id);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE dictees ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictee_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_unlock_requests ENABLE ROW LEVEL SECURITY;

-- Les dictées et mots sont publics en lecture
CREATE POLICY "dictees_read_all" ON dictees FOR SELECT USING (true);
CREATE POLICY "dictee_words_read_all" ON dictee_words FOR SELECT USING (true);

-- Les classes : lecture publique, écriture par le propriétaire
CREATE POLICY "dm_classes_read_all" ON dm_classes FOR SELECT USING (true);
CREATE POLICY "dm_classes_insert" ON dm_classes FOR INSERT WITH CHECK (true);
CREATE POLICY "dm_classes_update" ON dm_classes FOR UPDATE USING (true);
CREATE POLICY "dm_classes_delete" ON dm_classes FOR DELETE USING (true);

-- Les résultats : lecture et écriture publiques (l'auth est gérée par le Hub)
CREATE POLICY "dm_results_all" ON dm_results FOR ALL USING (true);
CREATE POLICY "dm_unlock_requests_all" ON dm_unlock_requests FOR ALL USING (true);
