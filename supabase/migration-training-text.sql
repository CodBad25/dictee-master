-- Migration : texte d'entraînement par dictée (20/09/2026)
--
-- Retour de Nadia (20/09/2026) : les modes « dictée audio » et « texte à trous »
-- servaient le texte de la dictée du jour J, que l'élève finissait par apprendre
-- par cœur. Chaque dictée reçoit donc un texte d'ENTRAÎNEMENT distinct, court
-- (≤ 25 mots, ≤ 3 phrases courtes), qui réemploie les mots de la liste.
--
-- Deuxième demande de Nadia : dans le texte à trous, les trous doivent porter
-- sur des ACCORDS (pluriel des noms et adjectifs, féminin des adjectifs,
-- verbes) et non sur l'orthographe du mot seul — sinon l'exercice fait double
-- emploi avec « audio mot ». Les mots à trouer sont donc choisis un par un et
-- marqués dans le texte entre guillemets français : «curieuses».
-- Le contexte qui porte l'indice d'accord (déterminant, sujet) reste visible.
--
-- Forme du JSONB :
--   {
--     "marked":    "Lina et Sarah sont «curieuses». …",   -- «…» = un trou
--     "rules":     { "curieuses": "Adjectif : féminin pluriel (Lina et Sarah)" },
--     "validated": true,        -- visible des élèves (dévalidable par le prof)
--     "audio_url": null,        -- MP3 ElevenLabs, généré dans un second temps
--     "updated_at": "2026-09-20T…"
--   }
--
-- Idempotente.

ALTER TABLE dictees
  ADD COLUMN IF NOT EXISTS training_text jsonb;

COMMENT ON COLUMN dictees.training_text IS
  'Texte d''entraînement de la dictée (≤25 mots, ≤3 phrases). Les mots entre «…» dans "marked" sont les trous du mode texte à trous, choisis pour tester un accord. Distinct du texte du jour J (fill_blanks_text).';

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'dictees' AND column_name = 'training_text';

-- ── Contenu initial : D1 des 5e (classe de Mme MANAï) ─────────────────────
--
-- Texte rédigé à partir des 10 mots de la dictée, tous réemployés :
-- scruter, examiner, apercevoir, observer, un détail, un indice, le regard,
-- curieux, visible, attentivement.
-- 22 mots, 3 phrases courtes. Les 5 trous couvrent les quatre types d'accord
-- cités par Nadia, et aucun trou ne dépend d'un autre (« détails » reste
-- visible pour que « examinés » soit déductible).
-- Sujet « les deux sœurs » et non des prénoms : le genre vient du sens du mot,
-- aucun élève ne peut s'y reconnaître.

UPDATE dictees SET training_text = jsonb_build_object(
  'marked',
    'Les deux sœurs sont «curieuses». Elles observent la vitrine : leurs «regards» scrutent des indices peu «visibles». Elles «aperçoivent» des détails attentivement «examinés».',
  'rules', jsonb_build_object(
    'curieuses',   'Adjectif au féminin pluriel : « les deux sœurs »',
    'regards',     'Nom au pluriel : « leurs »',
    'visibles',    'Adjectif accordé avec « des indices » : pluriel',
    'aperçoivent', 'Verbe à la 3e personne du pluriel : « Elles »',
    'examinés',    'Participe passé accordé avec « détails » : masculin pluriel'
  ),
  'validated', true,
  'audio_url', NULL,
  'updated_at', now()
)
WHERE id = 'dictee-5e-1';

SELECT id, training_text->>'marked' AS texte FROM dictees WHERE id = 'dictee-5e-1';
