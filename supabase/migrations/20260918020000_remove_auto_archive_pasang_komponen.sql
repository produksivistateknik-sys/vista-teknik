-- Restrukturisasi Pasang Komponen + hapus auto-archive (18 Sep 2026, diminta user setelah
-- serangkaian bug WM.4/Pintu ter-archive otomatis padahal proses gabungannya belum 100%).
--
-- SCOPE (dikonfirmasi eksplisit user): CUMA blok "Pasang Komponen" (seksi assembling_luar/
-- wiring_control) yang dihapus dari panels_auto_archive_seksi() - blok Warehouse/QS/QC di
-- fungsi YANG SAMA, dan trigger panels_auto_archive_nameplate() yang TERPISAH, TIDAK disentuh,
-- tetap auto-archive seperti sekarang.
--
-- Kenapa aman dihapus tanpa operator kehilangan cara mengarsipkan: KomponenPasangView.tsx
-- (Vista Pekerja) SUDAH PUNYA jalur manual sendiri - tombol "Simpan Progress"
-- (simpanProgress()) SUDAH melakukan upsert ke panel_seksi_archived sendiri (berapapun
-- persennya, ON CONFLICT panel_id,seksi,kode), diberi label ulang jadi "Arsipkan Komponen"
-- pas progress genuinely 100% (lihat commit terkait vista-pekerja). Dua jalur (trigger
-- otomatis + upsert manual) SELAMA INI berjalan PARALEL ke tabel yang sama - trigger yang
-- otomatis inilah yang bikin komponen ter-archive TANPA operator sadar/putuskan (root cause
-- WM.4/PP-LANTAI 16B & 15B, TRANS ICON SURABAYA). Menghapus trigger TIDAK menghilangkan
-- kemampuan arsip - cuma menghilangkan jalur OTOMATIS-nya, jalur manual yang sudah ada &
-- sudah terbukti bekerja tetap utuh.
--
-- TIDAK ADA data yang dihapus - panel_seksi_archived (tabel) dan seluruh isinya (termasuk
-- baris lama hasil trigger otomatis sebelumnya) TIDAK disentuh sama sekali oleh migration
-- ini, murni ubah definisi fungsi trigger.
--
-- Source SEBELUM migrasi ini (byte-for-byte, diambil live via pg_get_functiondef 18 Sep 2026)
-- didokumentasikan di supabase/backup_panels_auto_archive_seksi_20260918_before_remove_pasang_komponen.sql
-- kalau suatu saat perlu rollback.
CREATE OR REPLACE FUNCTION public.panels_auto_archive_seksi()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  wo_proyek text;
  wo_nomor text;
BEGIN
  SELECT wo.proyek, wo.wo INTO wo_proyek, wo_nomor FROM work_orders wo WHERE wo.id=NEW.wo_id;

  -- Warehouse
  IF NEW.warehouse_progress=100 AND (
       OLD.warehouse_progress IS DISTINCT FROM NEW.warehouse_progress
    OR OLD.warehouse_photos IS DISTINCT FROM NEW.warehouse_photos
    OR OLD.warehouse_history IS DISTINCT FROM NEW.warehouse_history
  ) THEN
    INSERT INTO panel_seksi_archived(panel_id,wo_id,seksi,kode,data,panel_nama,panel_tipe,proyek_snapshot,wo_number_snapshot,diarsipkan_oleh)
    VALUES (NEW.id,NEW.wo_id,'warehouse','',
      jsonb_build_object('progress',NEW.warehouse_progress,'photos',NEW.warehouse_photos,'history',NEW.warehouse_history,'updated_by',NEW.warehouse_updated_by,'updated_at',NEW.warehouse_updated_at),
      NEW.nama,NEW.tipe,wo_proyek,wo_nomor,COALESCE(NEW.warehouse_updated_by,'Sistem (otomatis)'))
    ON CONFLICT (panel_id,seksi,kode) DO UPDATE SET data=EXCLUDED.data,diarsipkan_pada=now(),diarsipkan_oleh=EXCLUDED.diarsipkan_oleh,
      panel_nama=EXCLUDED.panel_nama,panel_tipe=EXCLUDED.panel_tipe,proyek_snapshot=EXCLUDED.proyek_snapshot,wo_number_snapshot=EXCLUDED.wo_number_snapshot;
  END IF;

  -- QS
  IF NEW.qs_progress=100 AND (
       OLD.qs_progress IS DISTINCT FROM NEW.qs_progress
    OR OLD.qs_photos IS DISTINCT FROM NEW.qs_photos
    OR OLD.qs_history IS DISTINCT FROM NEW.qs_history
  ) THEN
    INSERT INTO panel_seksi_archived(panel_id,wo_id,seksi,kode,data,panel_nama,panel_tipe,proyek_snapshot,wo_number_snapshot,diarsipkan_oleh)
    VALUES (NEW.id,NEW.wo_id,'qs','',
      jsonb_build_object('progress',NEW.qs_progress,'photos',NEW.qs_photos,'history',NEW.qs_history,'updated_by',NEW.qs_updated_by,'updated_at',NEW.qs_updated_at),
      NEW.nama,NEW.tipe,wo_proyek,wo_nomor,COALESCE(NEW.qs_updated_by,'Sistem (otomatis)'))
    ON CONFLICT (panel_id,seksi,kode) DO UPDATE SET data=EXCLUDED.data,diarsipkan_pada=now(),diarsipkan_oleh=EXCLUDED.diarsipkan_oleh,
      panel_nama=EXCLUDED.panel_nama,panel_tipe=EXCLUDED.panel_tipe,proyek_snapshot=EXCLUDED.proyek_snapshot,wo_number_snapshot=EXCLUDED.wo_number_snapshot;
  END IF;

  -- QC (selesai = _global.status berubah jadi 'complete' - flag manual dari operator QC,
  -- bukan hasil hitung otomatis 4 item checklist)
  IF (NEW.qc_checklist->'_global'->>'status')='complete' AND (
       (OLD.qc_checklist->'_global'->>'status') IS DISTINCT FROM 'complete'
    OR OLD.qc_checklist IS DISTINCT FROM NEW.qc_checklist
  ) THEN
    INSERT INTO panel_seksi_archived(panel_id,wo_id,seksi,kode,data,panel_nama,panel_tipe,proyek_snapshot,wo_number_snapshot,diarsipkan_oleh)
    VALUES (NEW.id,NEW.wo_id,'qc','',NEW.qc_checklist,
      NEW.nama,NEW.tipe,wo_proyek,wo_nomor,COALESCE(NEW.qc_checklist->'_global'->>'updated_by','Sistem (otomatis)'))
    ON CONFLICT (panel_id,seksi,kode) DO UPDATE SET data=EXCLUDED.data,diarsipkan_pada=now(),diarsipkan_oleh=EXCLUDED.diarsipkan_oleh,
      panel_nama=EXCLUDED.panel_nama,panel_tipe=EXCLUDED.panel_tipe,proyek_snapshot=EXCLUDED.proyek_snapshot,wo_number_snapshot=EXCLUDED.wo_number_snapshot;
  END IF;

  -- Pasang Komponen (assembling_luar/wiring_control) - DIHAPUS 18 Sep 2026, lihat komentar
  -- panjang di atas file ini. Arsip kode Box Control/Pintu SEKARANG cuma lewat jalur manual
  -- KomponenPasangView.tsx (simpanProgress(), sudah ada dari 8 Agu 2026, tombol "Arsipkan
  -- Komponen" pas progress 100%).

  RETURN NEW;
END;
$function$
;
