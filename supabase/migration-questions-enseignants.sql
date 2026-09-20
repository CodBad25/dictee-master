-- Migration : questions posées aux enseignants (20/09/2026)
--
-- Les arbitrages pédagogiques passaient par WhatsApp, au coup par coup. Cette
-- table permet de poser une question directement dans l'appli, avec des options
-- à choisir ET un champ libre — c'est le champ libre qui porte le plus
-- d'information (« 3 phrases, pas 3 textes » n'aurait été dans aucune option).
--
-- Les questions sont insérées en SQL à la demande de Badri ; les réponses sont
-- relues via le skill contenu-dictee. Pas d'interface de rédaction : l'usage est
-- occasionnel, une interface coûterait plus qu'elle ne rapporterait.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS teacher_questions (
  id           TEXT PRIMARY KEY,
  question     TEXT NOT NULL,
  context      TEXT,                     -- « Dictée 1 des 5e », « exercice 🧩 »…
  options      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{label, description}]
  target_name  TEXT,                     -- nom du prof visé ; NULL = tous
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_answers (
  id           TEXT PRIMARY KEY,
  question_id  TEXT NOT NULL REFERENCES teacher_questions(id) ON DELETE CASCADE,
  teacher_name TEXT NOT NULL,
  choice       TEXT,                     -- le label choisi ; NULL si réponse libre seule
  comment      TEXT,                     -- nuance, désaccord, précision
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (question_id, teacher_name)      -- une réponse par prof, modifiable
);

CREATE INDEX IF NOT EXISTS idx_teacher_questions_status ON teacher_questions (status);
CREATE INDEX IF NOT EXISTS idx_teacher_answers_question ON teacher_answers (question_id);

ALTER TABLE teacher_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_answers   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_questions' AND policyname = 'tq_select') THEN
    CREATE POLICY "tq_select" ON teacher_questions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_answers' AND policyname = 'ta_select') THEN
    CREATE POLICY "ta_select" ON teacher_answers FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_answers' AND policyname = 'ta_insert') THEN
    CREATE POLICY "ta_insert" ON teacher_answers FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_answers' AND policyname = 'ta_update') THEN
    CREATE POLICY "ta_update" ON teacher_answers FOR UPDATE USING (true);
  END IF;
END $$;

-- Première question : l'arbitrage audio en attente ce soir.
INSERT INTO teacher_questions (id, question, context, options, target_name) VALUES (
  'q-audio-decoupage-2026-09-20',
  'Sur la dictée audio, entends-tu une différence entre la dictée 1 et la dictée 2 ?',
  'Le premier mot coupé que tu as signalé a été corrigé de deux façons différentes, pour comparer.',
  '[{"label":"La dictée 2 est plus nette","description":"Le début des phrases est franchement meilleur sur la 2 que sur la 1."},
    {"label":"Les deux sont bonnes","description":"Plus aucun mot coupé ni sur la 1, ni sur la 2."},
    {"label":"Il reste un mot coupé","description":"Sur l''une des deux, ou sur les deux : précise laquelle ci-dessous."}]'::jsonb,
  NULL
) ON CONFLICT (id) DO NOTHING;

SELECT id, question, status FROM teacher_questions ORDER BY created_at DESC;
