-- ============================================
-- DictéeMaster — Permettre l'édition manuelle des distracteurs
-- ============================================
-- Aujourd'hui dictee_words est en lecture seule via l'anon key.
-- Pour l'éditeur côté prof (panneau Parcours), on ouvre UPDATE/INSERT/DELETE.
-- L'auth réelle est garantie côté UI (panneau accessible uniquement à un user prof Hub).
-- À exécuter dans le SQL Editor Supabase. Idempotent (DROP IF EXISTS + CREATE).
-- ============================================

DROP POLICY IF EXISTS "dictee_words_update" ON dictee_words;
CREATE POLICY "dictee_words_update" ON dictee_words FOR UPDATE USING (true);

DROP POLICY IF EXISTS "dictee_words_insert" ON dictee_words;
CREATE POLICY "dictee_words_insert" ON dictee_words FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "dictee_words_delete" ON dictee_words;
CREATE POLICY "dictee_words_delete" ON dictee_words FOR DELETE USING (true);
