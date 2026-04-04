-- Table de présence en temps réel des élèves
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS dm_presence (
  student_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_status TEXT DEFAULT 'idle' CHECK (current_status IN ('idle', 'working', 'completed')),
  current_mode TEXT,
  current_dictee TEXT
);

-- Index pour la requête de cutoff (élèves vus dans les 60 dernières secondes)
CREATE INDEX IF NOT EXISTS idx_dm_presence_last_seen ON dm_presence (last_seen DESC);

-- RLS : accès public (ping élèves + lecture enseignant)
ALTER TABLE dm_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dm_presence_insert" ON dm_presence FOR INSERT WITH CHECK (true);
CREATE POLICY "dm_presence_select" ON dm_presence FOR SELECT USING (true);
CREATE POLICY "dm_presence_update" ON dm_presence FOR UPDATE USING (true);
