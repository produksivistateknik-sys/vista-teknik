-- Fix (6 Sep 2026, code review WO Digital) - 2 celah race-condition di level database, kelas
-- yang SAMA dengan wi_revisions_one_current (migrasi 20260831030000): upload dari client
-- ngitung "revision_number berikutnya"/"apa panel ini sudah punya dokumen" dari state lokal
-- browser (revList/wiList), bukan query fresh - kalau 2 admin upload ke panel yang SAMA
-- nyaris bersamaan, keduanya bisa lihat state lama yang sama dan hasilnya:
--   1. 2 baris wi_revisions dengan revision_number KEMBAR untuk 1 work_instruction, ATAU
--   2. 2 baris work_instructions BEDA untuk 1 panel_id yang SAMA (wiOfPanel() cuma .find()
--      pertama, jadi salah satu dokumen jadi "hilang" secara efektif dari UI manapun).
-- Belum pernah kejadian (dicek data live, semua bersih), tapi ini bom waktu yang sama
-- persis kelasnya kayak yang sudah diantisipasi utk is_current - jangan tunggu sampai kejadian
-- baru dikasih constraint.
create unique index if not exists wi_revisions_wi_id_revnum_uidx
  on public.wi_revisions(work_instruction_id, revision_number);

create unique index if not exists work_instructions_panel_id_uidx
  on public.work_instructions(panel_id) where panel_id is not null;
