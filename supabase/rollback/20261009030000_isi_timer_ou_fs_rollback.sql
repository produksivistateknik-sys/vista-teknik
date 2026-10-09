-- ROLLBACK isi timer OU_FS (9 Okt 2026): kembalikan ke KOSONG hanya baris yang diisi migrasi
-- 20261009030000 (keterangan 'salin timer dari <JENIS> <KODE> (9 Okt 2026)'). 18 timer POTONG OU_FS lama,
-- BOM OU_FS, dan timer jenis sumber tidak disentuh. Catatan: kalau setelah migrasi admin mengubah angka
-- salah satu baris itu lewat aplikasi, baris itu tetap ikut terhapus (penandanya tetap).

begin;

do $$
declare v_n int;
begin
  delete from public.fcs_process_time
   where tipe_panel = 'OU_FS' and keterangan like 'salin timer dari % (9 Okt 2026)';
  get diagnostics v_n = row_count;
  if v_n > 26 then
    raise exception 'Akan menghapus % baris (> 26 yang pernah diisi) - dibatalkan.', v_n;
  end if;
  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('SQL Editor (rollback isi timer OU_FS)', 'ROLLBACK ISI TIMER',
    format('Rollback isi timer OU_FS: %s baris dihapus (kembali kosong)', v_n), 'master_data', 'Kapasitas Pekerjaan');
  raise notice 'Rollback: % baris timer OU_FS dihapus', v_n;
end $$;

commit;

-- Cek: harus 0
select count(*) sisa from public.fcs_process_time where tipe_panel = 'OU_FS' and keterangan like 'salin timer dari % (9 Okt 2026)';
