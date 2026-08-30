-- Fix bug (30 Agu 2026): arsip panel gagal - "column bobot_komponen of relation
-- raw_schedule_archived does not exist". Kolom `bobot_komponen` ditambahkan ke raw_schedule
-- (live) tapi kelewat ditambahkan juga ke raw_schedule_archived - RPC arsip_panel() nyoba nyalin
-- kolom itu pas INSERT ke tabel arsip, gagal karena kolomnya gak ada di sana.
--
-- Dikonfirmasi lewat perbandingan langsung struktur kedua tabel (generated types + sample query
-- live DB): SATU-SATUNYA kolom yang beda cuma bobot_komponen - busbar_jejak/busbar_schedule
-- (kolom terkait revisi wiring kapasitas) sudah ada di kedua tabel, aman.
--
-- Tipe jsonb null, sama seperti kolom JSON lain di raw_schedule_archived (schedule,
-- busbar_schedule, busbar_jejak) - konsisten dengan raw_schedule aslinya.
alter table public.raw_schedule_archived
  add column if not exists bobot_komponen jsonb;
