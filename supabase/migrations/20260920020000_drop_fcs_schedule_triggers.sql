-- Retirement fcs_schedule Fase 1, poin 2 (20 Sep 2026) - hapus 3 trigger + fungsinya yang
-- SATU-SATUNYA efeknya nulis ke fcs_schedule (tabel 0 baris, gak ada jalur UI yang mengisinya
-- lagi - lihat riset "Fase 0" & audit database 20 Sep 2026, supabase/DATABASE_AUDIT_2026-09-20.md).
--
-- Definisi lengkap ketiganya (byte-for-byte, diambil live via pg_get_functiondef sebelum
-- dihapus, buat rollback kalau suatu saat perlu):
--
-- sync_fcs_from_panel_progress() - trigger trg_sync_fcs_from_panel (AFTER UPDATE ON panels):
--   CREATE OR REPLACE FUNCTION public.sync_fcs_from_panel_progress()
--    RETURNS trigger LANGUAGE plpgsql AS $function$
--   DECLARE
--     komponen_key TEXT; komponen_data JSONB; proses_key TEXT; progress_val NUMERIC; new_status TEXT;
--   BEGIN
--     IF NEW.checklist IS DISTINCT FROM OLD.checklist THEN
--       FOR komponen_key, komponen_data IN SELECT * FROM jsonb_each(NEW.checklist) LOOP
--         FOR proses_key, progress_val IN SELECT key, value::numeric FROM jsonb_each_text(komponen_data->'progress') LOOP
--           IF progress_val >= 100 THEN new_status := 'completed';
--           ELSIF progress_val > 0 THEN new_status := 'in_progress';
--           ELSE new_status := NULL; END IF;
--           IF new_status IS NOT NULL THEN
--             UPDATE fcs_schedule SET status = new_status
--             WHERE panel_id = NEW.id AND kode_komponen = komponen_key AND jenis_pekerjaan = proses_key
--               AND status NOT IN ('completed', 'cancelled');
--           END IF;
--         END LOOP;
--       END LOOP;
--     END IF;
--     RETURN NEW;
--   END; $function$
--
-- sync_fcs_status_on_renhar_insert() - trigger trg_sync_fcs_released (AFTER INSERT ON renhar):
--   CREATE OR REPLACE FUNCTION public.sync_fcs_status_on_renhar_insert()
--    RETURNS trigger LANGUAGE plpgsql AS $function$
--   DECLARE komp TEXT;
--   BEGIN
--     FOR komp IN SELECT jsonb_array_elements_text(NEW.komponen) LOOP
--       UPDATE fcs_schedule SET status = 'released'
--       WHERE wo_id = NEW.wo_id AND panel_id = NEW.panel_id AND jenis_pekerjaan = NEW.proses
--         AND tanggal = NEW.tanggal AND kode_komponen = komp AND status = 'planning';
--     END LOOP;
--     RETURN NEW;
--   END; $function$
--
-- cleanup_fcs_on_wo_delete() - trigger trg_cleanup_fcs_on_wo_delete (BEFORE DELETE ON work_orders):
--   CREATE OR REPLACE FUNCTION public.cleanup_fcs_on_wo_delete()
--    RETURNS trigger LANGUAGE plpgsql AS $function$
--   BEGIN
--     DELETE FROM fcs_schedule WHERE wo_id = OLD.id;
--     RETURN OLD;
--   END; $function$
--
-- Ketiganya HANYA menyentuh fcs_schedule, tidak ada RAISE EXCEPTION yang bisa membatalkan
-- operasi utama (update panels/insert renhar/delete work_orders tetap RETURN NEW/OLD normal).
-- Dicek live 20 Sep 2026: fcs_schedule 0 baris, jadi ketiganya sudah lama no-op murni.
DROP TRIGGER IF EXISTS trg_sync_fcs_from_panel ON public.panels;
DROP TRIGGER IF EXISTS trg_sync_fcs_released ON public.renhar;
DROP TRIGGER IF EXISTS trg_cleanup_fcs_on_wo_delete ON public.work_orders;

DROP FUNCTION IF EXISTS public.sync_fcs_from_panel_progress();
DROP FUNCTION IF EXISTS public.sync_fcs_status_on_renhar_insert();
DROP FUNCTION IF EXISTS public.cleanup_fcs_on_wo_delete();
