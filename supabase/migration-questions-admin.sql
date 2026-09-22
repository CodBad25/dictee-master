-- Migration : administration des questions aux enseignants (22/09/2026)
--
-- La table teacher_questions n'avait que des policies de lecture : les questions
-- devaient être insérées à la main en SQL, et Badri ne voyait nulle part ce que
-- ses collègues avaient répondu. L'onglet « Questions aux profs » de /admin lui
-- rend les deux bouts ; il lui faut donc le droit d'écrire.
--
-- L'écriture est protégée applicativement par le mot de passe administrateur
-- (route /api/teacher-questions), comme l'est déjà bug_reports.
--
-- Idempotente.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_questions' AND policyname = 'tq_insert') THEN
    CREATE POLICY "tq_insert" ON teacher_questions FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teacher_questions' AND policyname = 'tq_update') THEN
    CREATE POLICY "tq_update" ON teacher_questions FOR UPDATE USING (true);
  END IF;
END $$;

-- Question suivante : l'arbitrage demandé par Nadia le 21/09/2026.
--
-- Son signalement : « Il faudrait accepter "leur regard scrute" au singulier si
-- possible car pour moi c'est correct aussi. » Elle a raison à l'oreille — rien
-- dans le son ne distingue les deux — mais le texte d'entraînement de la dictée
-- n°1 des 5e a justement été construit pour travailler l'accord au pluriel
-- (« regards » : Nom au pluriel : « leurs »). C'est un arbitrage pédagogique,
-- pas un réglage technique : il lui revient.
INSERT INTO teacher_questions (id, question, context, options, target_name) VALUES (
  'q-homophones-audio-2026-09-22',
  'En dictée audio, quand deux orthographes s''entendent exactement pareil, faut-il accepter les deux ?',
  'Tu as signalé « leur regard scrute » face à « leurs regards scrutent » (dictée n°1 des 5e). À l''oral rien ne les distingue. Mais ce texte d''entraînement travaille justement l''accord au pluriel. Dans le texte à trous, le pluriel resterait exigé dans tous les cas : la question ne porte que sur la dictée audio.',
  '[{"label":"Accepter les deux, partout en dictée audio","description":"Si le son ne permet pas de trancher, l''élève ne peut pas deviner : aucune des deux n''est comptée fausse."},
    {"label":"Accepter seulement là où tu le décides","description":"Tu me signales les phrases concernées une par une, et je n''ouvre la tolérance que sur celles-là."},
    {"label":"Refuser : le pluriel reste exigé","description":"Le texte est fait pour travailler l''accord ; l''élève doit entendre le pluriel dans « Elles observent »."}]'::jsonb,
  NULL
) ON CONFLICT (id) DO NOTHING;

SELECT id, question, status, created_at FROM teacher_questions ORDER BY created_at DESC;
