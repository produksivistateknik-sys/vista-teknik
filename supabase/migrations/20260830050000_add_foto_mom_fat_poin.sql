-- Foto per poin checklist MOM FAT (30 Agu 2026) - QC bisa lampirkan foto bukti
-- pengerjaan/kondisi per poin, bukan cuma centang teks. Kolom JSONB array di baris
-- poin (bukan tabel relasi baru) - pola yang sama seperti proyek_luar.foto dan
-- panels.qc_checklist[itemKey].foto, skala per-poin kecil (bukti tempel, bukan
-- galeri besar) jadi tidak perlu relasi many-to-many.
alter table public.mom_fat_poin add column if not exists foto jsonb not null default '[]'::jsonb;
