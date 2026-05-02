-- ============================================
-- DictéeMaster — Migration multi-tenant
-- ============================================
-- Objectif : préparer DictéeMaster à accueillir plusieurs profs
--   - Ajout d'un identifiant Hub stable sur dm_classes (hub_class_id)
--   - Backfill des classes existantes (mapping nom -> classeId Hub)
--   - Réattribution du teacher_id "teacher" vers le vrai enseignantId Hub
--     (Mohamed BELHAJ = a38205b6-5e3c-469e-9314-52a7e293a97f)
--
-- À exécuter dans le SQL Editor Supabase.
-- Idempotent : ré-exécutable sans casser l'état.
-- ============================================

-- 1) Ajouter la colonne hub_class_id (nullable au début pour permettre le backfill)
ALTER TABLE dm_classes
  ADD COLUMN IF NOT EXISTS hub_class_id TEXT;

-- 2) Backfill — mapper chaque dm_classes vers son classeId Hub
UPDATE dm_classes SET hub_class_id = 'cmmhtf8ko001fakvaiylj6joy'
  WHERE id = 'e7f1401f-6a25-42e4-be53-3a757fd2db4b' AND hub_class_id IS NULL;

UPDATE dm_classes SET hub_class_id = 'a4312b37-d151-4bd8-b0e7-fffe0f8f6909'
  WHERE id = '5618f28c-1ac2-4bf0-995e-be73245050af' AND hub_class_id IS NULL;

UPDATE dm_classes SET hub_class_id = 'cmmhswekd0000akvadkbvsx0i'
  WHERE id = '322f10ab-5484-4dd7-8802-448693cdd39c' AND hub_class_id IS NULL;

UPDATE dm_classes SET hub_class_id = 'cmn2c6ta500rs01rxg75gtr3m'
  WHERE id = '3a2441f8-fd51-46de-8d7c-b58a2b8f6f50' AND hub_class_id IS NULL;

-- 3) Index unique partiel — interdit deux dm_classes avec le même hub_class_id
--    (partiel pour tolérer NULL pendant la transition d'éventuelles classes orphelines)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_classes_hub_class_id
  ON dm_classes(hub_class_id)
  WHERE hub_class_id IS NOT NULL;

-- 4) Réattribution du teacher_id "teacher" -> identifiant Hub réel
--    Toutes les classes existantes appartiennent à Mohamed BELHAJ
UPDATE dm_classes
  SET teacher_id = 'a38205b6-5e3c-469e-9314-52a7e293a97f'
  WHERE teacher_id = 'teacher';

-- ============================================
-- Vérifications post-migration (à lancer pour contrôler)
-- ============================================
-- SELECT id, teacher_id, name, hub_class_id, unlocked_dictees FROM dm_classes ORDER BY name;
-- → 4 lignes, toutes avec teacher_id = 'a38205b6-...' et hub_class_id rempli
