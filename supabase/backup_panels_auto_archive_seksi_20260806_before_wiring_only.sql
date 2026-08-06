-- Backup source function panels_auto_archive_seksi() SEBELUM perubahan 6 Agu 2026
-- (nambah kondisi "wiring-only" - lihat commit terkait untuk penjelasan).
-- Kalau perlu rollback, jalankan CREATE OR REPLACE FUNCTION di bawah ini.

CREATE OR REPLACE FUNCTION panels_auto_archive_seksi()
RETURNS trigger AS $$
DECLARE
  wo_proyek text;
  wo_nomor text;
  v_kode text;
  v_cl jsonb;
  v_asm numeric;
  v_wir numeric;
  v_nama_komponen text;
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

  -- Pasang Komponen (per kode Box Control/Pintu - dikenali dari KEBERADAAN key
  -- pasangKomponenTahap, bukan lookup nama komponen ke bom_master, karena key ini CUMA
  -- pernah ditulis Vista Pekerja utk kode Box Control/Pintu - lihat
  -- PASANG_KOMPONEN_TAHAP_KOMPONEN_NAMA di App.tsx). Selesai = tahap ASSEMBLING dan WIRING
  -- dua-duanya 100.
  IF NEW.checklist IS DISTINCT FROM OLD.checklist THEN
    FOR v_kode, v_cl IN SELECT key,value FROM jsonb_each(COALESCE(NEW.checklist,'{}'::jsonb)) LOOP
      IF v_cl ? 'pasangKomponenTahap' THEN
        v_asm := COALESCE((v_cl->'pasangKomponenTahap'->'ASSEMBLING'->>'progress')::numeric,0);
        v_wir := COALESCE((v_cl->'pasangKomponenTahap'->'WIRING'->>'progress')::numeric,0);
        IF v_asm=100 AND v_wir=100 THEN
          SELECT bm.nama_komponen INTO v_nama_komponen FROM bom_master bm WHERE bm.tipe_panel=NEW.tipe AND bm.kode_komponen=v_kode LIMIT 1;
          INSERT INTO panel_seksi_archived(panel_id,wo_id,seksi,kode,komponen_nama,data,panel_nama,panel_tipe,proyek_snapshot,wo_number_snapshot,diarsipkan_oleh)
          VALUES (NEW.id,NEW.wo_id,'pasang_komponen',v_kode,v_nama_komponen,
            jsonb_build_object('pasangKomponenTahap',v_cl->'pasangKomponenTahap','fotoPemasangan',v_cl->'fotoPemasangan'),
            NEW.nama,NEW.tipe,wo_proyek,wo_nomor,'Sistem (otomatis)')
          ON CONFLICT (panel_id,seksi,kode) DO UPDATE SET data=EXCLUDED.data,komponen_nama=EXCLUDED.komponen_nama,diarsipkan_pada=now(),
            panel_nama=EXCLUDED.panel_nama,panel_tipe=EXCLUDED.panel_tipe,proyek_snapshot=EXCLUDED.proyek_snapshot,wo_number_snapshot=EXCLUDED.wo_number_snapshot;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
