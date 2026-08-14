-- FIX (17 Agu 2026): panel_seksi_archived.seksi punya CHECK constraint
-- (panel_seksi_archived_seksi_check) yang belum mengizinkan 'nameplate' - trigger baru
-- panels_auto_archive_nameplate() (migrasi sebelumnya) gagal INSERT tanpa ini
-- (dikonfirmasi lewat error "violates check constraint" pas testing).
--
-- Constraint LAMA gak tersimpan di migrations manapun (dibuat langsung di database, sama
-- seperti panels_auto_archive_seksi() sendiri - lihat ARSIP-SCHEMA-SYNC.md) dan gak bisa
-- diintrospeksi dari sesi ini (butuh SQL editor/Docker). Supaya AMAN (gak sengaja
-- mempersempit constraint dan nolak insert seksi lama yang sah), daftar di bawah adalah
-- SUPERSET dari SEMUA nilai seksi yang pernah ditemukan referensinya di kedua codebase
-- (vista-teknik + vista-pekerja: ArsipSeksiView.tsx, backup trigger 6 Agu 2026) DITAMBAH
-- 'nameplate' yang baru - murni ADDITIVE, gak ada value lama yang dibuang.

ALTER TABLE "public"."panel_seksi_archived" DROP CONSTRAINT IF EXISTS "panel_seksi_archived_seksi_check";
ALTER TABLE "public"."panel_seksi_archived" ADD CONSTRAINT "panel_seksi_archived_seksi_check"
  CHECK (seksi IN ('warehouse','qs','qc','pasang_komponen','assembling_luar','wiring_control','nameplate'));
