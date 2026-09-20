-- Migration : avis et suggestions des enseignants (20/09/2026)
--
-- Nadia passait par WhatsApp pour donner ses retours : le bouton de
-- signalement existait déjà et gérait reporter_type = 'teacher', mais il
-- annonçait « signaler un bug » — or elle ne signale pas un bug, elle donne un
-- avis et propose des idées. On ajoute donc la catégorie du message.
--
-- Deux corrections au passage :
--   - le nom du prof était enregistré en dur comme « Enseignant » : impossible
--     de savoir qui avait écrit, et tous les profs partageaient le même
--     historique de signalements. Le vrai nom (user.name du Hub) est désormais
--     envoyé.
--   - le contexte se résumait à « [Espace enseignant] » : on y ajoute la
--     dictée consultée, pour ne pas avoir à demander « c'était sur laquelle ? ».
--
-- Idempotente.

ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bug';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bug_reports_category_check'
  ) THEN
    ALTER TABLE bug_reports
      ADD CONSTRAINT bug_reports_category_check
      CHECK (category IN ('bug', 'suggestion', 'avis'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports (category);

COMMENT ON COLUMN bug_reports.category IS
  'bug = quelque chose ne marche pas · suggestion = idée d''amélioration · avis = retour pédagogique. Les élèves envoient toujours des bugs ; les enseignants choisissent.';

SELECT category, count(*) FROM bug_reports GROUP BY category;
