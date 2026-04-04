-- Table de signalements / bug reports
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS bug_reports (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  screenshot TEXT,                -- base64 JPEG
  page_url TEXT,
  user_agent TEXT,
  reporter_name TEXT,             -- "Prénom (Classe)" ou "Enseignant"
  reporter_type TEXT DEFAULT 'student' CHECK (reporter_type IN ('student', 'teacher')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'resolved')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports (status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_reporter ON bug_reports (reporter_name);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports (created_at DESC);

-- RLS : accès via anon key (l'API route gère la logique d'accès)
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Politique : tout le monde peut insérer
CREATE POLICY "bug_reports_insert" ON bug_reports
  FOR INSERT WITH CHECK (true);

-- Politique : tout le monde peut lire (filtrage côté API)
CREATE POLICY "bug_reports_select" ON bug_reports
  FOR SELECT USING (true);

-- Politique : tout le monde peut mettre à jour (auth vérifiée côté API)
CREATE POLICY "bug_reports_update" ON bug_reports
  FOR UPDATE USING (true);

-- Politique : tout le monde peut supprimer (auth vérifiée côté API)
CREATE POLICY "bug_reports_delete" ON bug_reports
  FOR DELETE USING (true);
