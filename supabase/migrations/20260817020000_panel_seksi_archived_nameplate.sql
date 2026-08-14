-- FITUR (17 Agu 2026): tambah "Nameplate" ke sistem Arsip Seksi (panel_seksi_archived),
-- diminta setelah investigasi nemuin divisi nameplate belum punya tab Arsip sama sekali -
-- trigger panels_auto_archive_seksi() cuma handle warehouse/qs/qc/pasang_komponen
-- (assembling_luar+wiring_control), nameplate_progress belum pernah dicek.
--
-- SENGAJA bikin fungsi+trigger BARU YANG TERPISAH (bukan CREATE OR REPLACE ke
-- panels_auto_archive_seksi() yang sudah ada) - fungsi itu sudah beberapa kali direvisi
-- langsung di database (lihat backup_panels_auto_archive_seksi_20260806_before_wiring_only.sql,
-- ARSIP-SCHEMA-SYNC.md) dan source LENGKAPNYA yang sekarang gak bisa diintrospeksi dari sini
-- (butuh akses SQL editor/Docker yang gak tersedia di sesi ini) - REPLACE tanpa tau isi
-- lengkapnya berisiko diam-diam ngebalikin perubahan wiring-split 6 Agu 2026. Trigger baru
-- yang independen ini nol risiko ke logic warehouse/qs/qc/pasang_komponen yang sudah ada -
-- cuma nambah, gak mengubah apa pun yang lama.
--
-- Kolom panels.nameplate_progress/nameplate_photos/nameplate_history/nameplate_updated_by/
-- nameplate_updated_at strukturnya identik dengan warehouse_*/qs_* (dikonfirmasi lewat
-- supabase-generated.ts) - payload jsonb pakai key "photos" yang sama biar fotoListOf() di
-- ArsipSeksiView.tsx (Vista Pekerja) otomatis kebaca lewat fallback generik yang sudah ada
-- (row.data?.photos||[]), TANPA perlu ubah kode frontend itu sama sekali.

CREATE OR REPLACE FUNCTION panels_auto_archive_nameplate()
RETURNS trigger AS $$
DECLARE
  wo_proyek text;
  wo_nomor text;
BEGIN
  IF NEW.nameplate_progress=100 AND (
       OLD.nameplate_progress IS DISTINCT FROM NEW.nameplate_progress
    OR OLD.nameplate_photos IS DISTINCT FROM NEW.nameplate_photos
    OR OLD.nameplate_history IS DISTINCT FROM NEW.nameplate_history
  ) THEN
    SELECT wo.proyek, wo.wo INTO wo_proyek, wo_nomor FROM work_orders wo WHERE wo.id=NEW.wo_id;
    INSERT INTO panel_seksi_archived(panel_id,wo_id,seksi,kode,data,panel_nama,panel_tipe,proyek_snapshot,wo_number_snapshot,diarsipkan_oleh)
    VALUES (NEW.id,NEW.wo_id,'nameplate','',
      jsonb_build_object('progress',NEW.nameplate_progress,'photos',NEW.nameplate_photos,'history',NEW.nameplate_history,'updated_by',NEW.nameplate_updated_by,'updated_at',NEW.nameplate_updated_at),
      NEW.nama,NEW.tipe,wo_proyek,wo_nomor,COALESCE(NEW.nameplate_updated_by,'Sistem (otomatis)'))
    ON CONFLICT (panel_id,seksi,kode) DO UPDATE SET data=EXCLUDED.data,diarsipkan_pada=now(),diarsipkan_oleh=EXCLUDED.diarsipkan_oleh,
      panel_nama=EXCLUDED.panel_nama,panel_tipe=EXCLUDED.panel_tipe,proyek_snapshot=EXCLUDED.proyek_snapshot,wo_number_snapshot=EXCLUDED.wo_number_snapshot;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_panels_auto_archive_nameplate ON panels;
CREATE TRIGGER trg_panels_auto_archive_nameplate
AFTER UPDATE ON panels
FOR EACH ROW
EXECUTE FUNCTION panels_auto_archive_nameplate();
