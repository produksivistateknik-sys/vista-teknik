-- Fix (10 Sep 2026): drift skema ketemu lewat cek_sync_skema_arsip() -
-- progress_checkpoint_log.checkpoint diubah integer -> numeric(5,1) di migration
-- 20260901000000 (biar progress gabungan BUSBAR/PASANG KOMPONEN kayak 62.5 gak hilang
-- presisinya di log audit), tapi progress_checkpoint_log_archived.checkpoint KELEWAT -
-- masih int4.
--
-- Dampak: RPC arsip_panel() nyalin baris progress_checkpoint_log ke arsip; nilai desimal
-- (mis. 62.5) ke-cast diam-diam ke integer pas INSERT ke kolom int4 arsip -> dibulatkan,
-- presisi audit hilang TANPA error. Per 10 Sep 2026 ada ~181 baris live dengan checkpoint
-- desimal; di arsip 0 (baris arsip lama semuanya sebelum migration numeric, aman).
--
-- Widening int4 -> numeric(5,1): baris arsip lama (semua integer) tetap valid (25 -> 25.0),
-- gak ada data loss. Kelas bug SAMA dgn jumlah_cell/busbar_jejak/bobot_komponen -
-- lihat supabase/ARSIP-SCHEMA-SYNC.md.
--
-- Dijalankan manual di Supabase SQL Editor 10 Sep 2026 (anon key gak bisa DDL).
alter table public.progress_checkpoint_log_archived
  alter column checkpoint type numeric(5,1);
