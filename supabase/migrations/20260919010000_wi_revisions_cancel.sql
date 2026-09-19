-- Fitur "Batalkan Revisi" Dokumen Gambar Teknik (19 Sep 2026) - diminta user setelah kasus
-- Engineering (IHSAN) salah upload gambar utk panel YD EXPANDER - SIDOARJO 2 (WO 065), dan itu
-- langsung tayang sebagai "Berlaku" tanpa ada cara membatalkannya dari UI (fitur belum ada sama
-- sekali - dicek live, tidak ada tombol/fungsi hapus/rollback revisi di WoDigitalTab.tsx maupun
-- useWoDigitalDocs.ts).
--
-- SENGAJA cuma tambah kolom, TIDAK ADA DELETE/DROP - revisi yang "dibatalkan" tetap baris utuh
-- di wi_revisions (audit trail: siapa upload, siapa batalkan, kapan, kenapa), file PDF di R2
-- juga TIDAK disentuh sama sekali oleh fitur ini.
ALTER TABLE public.wi_revisions
  ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- wi_revisions_one_current (unique partial index, migration 20260831030000) TIDAK perlu diubah -
-- tetap valid karena aksi "Batalkan" selalu set is_current=false bersamaan (di kode aplikasi),
-- jadi tidak pernah ada 2 baris is_current=true, dan 0 baris is_current=true (slot "Belum ada
-- dokumen") sudah didukung index partial ini dari awal.

-- Banner in-app "WO diubah Engineering" (wo_engineering_events.jenis_perubahan) SEBELUMNYA cuma
-- CHECK constraint 2 nilai ('tambah'/'edit', dicek live via test insert 19 Sep 2026 - constraint
-- wo_engineering_events_jenis_perubahan_check). Aksi "Batalkan Revisi" butuh nilai baru 'batal'
-- supaya banner-nya kelihatan beda dari "Diedit" biasa (WoEngineeringBanner.tsx) - drop+recreate
-- constraint yang sama, tambah 'batal' ke daftar yang diizinkan. TIDAK ADA data existing yang
-- berubah nilainya - cuma menambah 1 nilai baru yang diizinkan.
ALTER TABLE public.wo_engineering_events DROP CONSTRAINT IF EXISTS wo_engineering_events_jenis_perubahan_check;
ALTER TABLE public.wo_engineering_events ADD CONSTRAINT wo_engineering_events_jenis_perubahan_check
  CHECK (jenis_perubahan IN ('tambah','edit','batal'));
