-- Schéma de base de données pour DictéeMaster V2
-- À exécuter dans Supabase SQL Editor

-- Table des dictées
CREATE TABLE IF NOT EXISTS dictees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  share_code TEXT UNIQUE NOT NULL,
  dictation_text TEXT, -- Texte complet pour audio
  fill_blanks_text TEXT, -- Texte à trous pour exercice
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par code de partage
CREATE INDEX IF NOT EXISTS idx_dictees_share_code ON dictees(share_code);

-- Table des listes de mots
CREATE TABLE IF NOT EXISTS word_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dictee_id UUID NOT NULL REFERENCES dictees(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- ex: "Liste n°1", "Liste n°2"
  position INTEGER NOT NULL DEFAULT 0
);

-- Index pour récupérer les listes d'une dictée
CREATE INDEX IF NOT EXISTS idx_word_lists_dictee ON word_lists(dictee_id);

-- Table des mots
CREATE TABLE IF NOT EXISTS words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES word_lists(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  definition TEXT, -- Généré par IA, stocké
  spelling_errors JSONB DEFAULT '[]'::jsonb, -- ["erreur1", "erreur2", "erreur3"]
  example_sentence TEXT
);

-- Index pour récupérer les mots d'une liste
CREATE INDEX IF NOT EXISTS idx_words_list ON words(list_id);

-- Table des sessions d'entraînement
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dictee_id UUID NOT NULL REFERENCES dictees(id) ON DELETE CASCADE,
  list_id UUID REFERENCES word_lists(id) ON DELETE SET NULL,
  student_name TEXT,
  mode_used TEXT NOT NULL,
  total_words INTEGER NOT NULL DEFAULT 0,
  correct_words INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- Index pour statistiques par dictée
CREATE INDEX IF NOT EXISTS idx_sessions_dictee ON training_sessions(dictee_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON training_sessions(started_at DESC);

-- Table des tentatives par mot
CREATE TABLE IF NOT EXISTS word_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  user_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  phase TEXT NOT NULL -- flashcard, audio, spelling, definition, fill-blanks
);

-- Index pour récupérer les tentatives d'une session
CREATE INDEX IF NOT EXISTS idx_attempts_session ON word_attempts(session_id);

-- Row Level Security (optionnel pour commencer)
-- ALTER TABLE dictees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE word_lists ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE words ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE word_attempts ENABLE ROW LEVEL SECURITY;

-- Politique publique pour lecture des dictées (élèves)
-- CREATE POLICY "Dictées lisibles par tous" ON dictees FOR SELECT USING (true);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at sur dictees
DROP TRIGGER IF EXISTS dictees_updated_at ON dictees;
CREATE TRIGGER dictees_updated_at
  BEFORE UPDATE ON dictees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
