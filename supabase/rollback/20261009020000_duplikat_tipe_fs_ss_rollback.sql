-- ROLLBACK duplikat FS -> FS_SS (9 Okt 2026). Menghapus HANYA baris tipe_panel = 'FS_SS'. FS tidak disentuh.
--
-- Cara utama: RPC yang sudah ada & dipakai tombol "Hapus tipe" Master Data (migration 20261008010000).
-- RPC ini MENOLAK kalau FS_SS sudah dipakai panel (live/arsip), jadwal FCS (live/arsip) atau arsip seksi -
-- dalam kasus itu jangan dihapus: panel FS_SS butuh master datanya. Urutan hapus di dalam RPC aman:
-- fcs_process_time -> bom_proses_relevan -> bom_master -> panel_wp_meta -> panel_type_meta (1 transaksi,
-- dicatat di activity_log "HAPUS TIPE PANEL").

select public.hapus_tipe_panel('FS_SS', 'SQL Editor (rollback duplikat FS_SS)');

-- Cek setelah rollback (semua harus 0):
select (select count(*) from public.panel_type_meta    where tipe_panel='FS_SS') tipe,
       (select count(*) from public.panel_wp_meta      where tipe_panel='FS_SS') wp,
       (select count(*) from public.bom_master         where tipe_panel='FS_SS') bom,
       (select count(*) from public.bom_proses_relevan where tipe_panel='FS_SS') relevan,
       (select count(*) from public.fcs_process_time   where tipe_panel='FS_SS') process_time;
