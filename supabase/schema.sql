-- DictéeMaster - Schéma de base de données Supabase
-- À exécuter dans l'éditeur SQL de Supabase

-- Extension pour générer des UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES PRINCIPALES
-- ============================================

-- Table des enseignants (utilise auth.users de Supabase)
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des élèves (avec code unique - pas besoin d'email pour RGPD)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  student_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des classes
CREATE TABLE IF NOT EXISTS classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Élèves dans les classes (relation N-N)
CREATE TABLE IF NOT EXISTS class_students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, student_id)
);

-- Listes de mots
CREATE TABLE IF NOT EXISTS word_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'progression' CHECK (mode IN ('flashcard', 'audio', 'progression', 'fill-blanks')),
  share_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mots dans les listes
CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  hint TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions d'entraînement
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  list_id UUID REFERENCES word_lists(id) ON DELETE CASCADE,
  student_name TEXT,
  mode_used TEXT NOT NULL CHECK (mode_used IN ('flashcard', 'audio')),
  total_words INT NOT NULL,
  correct_words INT NOT NULL,
  percentage INT NOT NULL,
  time_spent_seconds INT NOT NULL,
  chrono_time_seconds INT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Réponses par mot dans une session
CREATE TABLE IF NOT EXISTS word_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Badges des élèves
CREATE TABLE IF NOT EXISTS student_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  badge TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, badge)
);

-- Streaks des élèves
CREATE TABLE IF NOT EXISTS student_streaks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  UNIQUE(student_id)
);

-- ============================================
-- INDEX POUR PERFORMANCES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_code ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_word_lists_teacher ON word_lists(teacher_id);
CREATE INDEX IF NOT EXISTS idx_word_lists_share_code ON word_lists(share_code);
CREATE INDEX IF NOT EXISTS idx_words_list ON words(list_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON training_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_list ON training_sessions(list_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON word_attempts(session_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_streaks ENABLE ROW LEVEL SECURITY;

-- Policies pour enseignants
CREATE POLICY "Teachers can manage their own data" ON teachers
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Teachers can manage their students" ON students
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can manage their classes" ON classes
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can manage their word lists" ON word_lists
  FOR ALL USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can manage words in their lists" ON words
  FOR ALL USING (
    list_id IN (SELECT id FROM word_lists WHERE teacher_id = auth.uid())
  );

-- Policies pour accès public (élèves)
CREATE POLICY "Anyone can read word lists" ON word_lists
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read words" ON words
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create sessions" ON training_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read sessions" ON training_sessions
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create attempts" ON word_attempts
  FOR INSERT WITH CHECK (true);

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Génère un code élève unique (ex: MARIE-7X3K)
CREATE OR REPLACE FUNCTION generate_student_code(student_name TEXT)
RETURNS TEXT AS $$
DECLARE
  base_name TEXT;
  random_suffix TEXT;
  new_code TEXT;
  exists_count INT;
BEGIN
  base_name := UPPER(LEFT(REGEXP_REPLACE(student_name, '[^a-zA-Z]', '', 'g'), 5));
  LOOP
    random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    new_code := base_name || '-' || random_suffix;
    SELECT COUNT(*) INTO exists_count FROM students WHERE student_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Génère un code de partage unique pour les listes
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  exists_count INT;
BEGIN
  LOOP
    new_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT COUNT(*) INTO exists_count FROM word_lists WHERE share_code = new_code;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER word_lists_updated_at
  BEFORE UPDATE ON word_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
