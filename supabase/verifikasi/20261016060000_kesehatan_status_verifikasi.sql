-- VERIFIKASI status error & tunda cek (jalankan SESUDAH migration 20261016060000). Data uji ditanam di transaksi yang
-- di-ROLLBACK (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v jsonb; s record; v_kode text;
begin
  -- kelompok error uji, terjadi 3x di versi 1000000000100
  insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, pengguna, jumlah, waktu_pertama, waktu_terakhir)
    values ('vista-teknik', '1000000000100', 'crash', 'uji-status-1', 'UJI error status', 'UJI', 3, now() - interval '2 hours', now() - interval '2 hours');
  v := public.tandai_status_error('uji-status-1', 'selesai', 'diperbaiki commit uji', '1000000000200', 'UJI ADMIN');
  select * into s from public.kesehatan_status_error where sidik = 'uji-status-1';
  if s.status <> 'selesai' or s.jumlah_saat_ditandai <> 3 or s.versi_ditandai <> '1000000000200' or s.ditandai_oleh <> 'UJI ADMIN' then
    raise exception 'GAGAL U1: tandai selesai tidak tersimpan benar: %', row_to_json(s);
  end if;
  if not exists (select 1 from public.activity_log where action = 'STATUS ERROR APLIKASI' and user_name = 'UJI ADMIN' and description like 'baru -> selesai%') then
    raise exception 'GAGAL U1: activity_log tidak mencatat';
  end if;
  raise notice 'LULUS U1: tandai selesai (catatan, versi, jumlah saat ditandai, activity_log)';

  -- kejadian dari versi LEBIH LAMA sesudah ditandai -> tetap selesai
  insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, pengguna, jumlah, waktu_pertama, waktu_terakhir)
    values ('vista-teknik', '1000000000100', 'crash', 'uji-status-1', 'UJI error status', 'UJI', 1, now(), now() + interval '1 second');
  if (select status from public.kesehatan_status_error where sidik = 'uji-status-1') <> 'selesai' then
    raise exception 'GAGAL U2: versi lama membuka kembali';
  end if;
  raise notice 'LULUS U2: kejadian dari versi lama tidak membuka kembali';

  -- kejadian dari versi SAMA/LEBIH BARU sesudah ditandai -> baru + muncul lagi
  update public.log_error_app set jumlah = jumlah + 1, waktu_terakhir = now() + interval '2 seconds', versi = '1000000000200'
   where sidik = 'uji-status-1' and versi = '1000000000100' and waktu_pertama > now() - interval '1 minute';
  select * into s from public.kesehatan_status_error where sidik = 'uji-status-1';
  if s.status <> 'baru' or not s.muncul_lagi or s.muncul_lagi_versi <> '1000000000200' then
    raise exception 'GAGAL U3: tidak terbuka kembali: %', row_to_json(s);
  end if;
  raise notice 'LULUS U3: muncul lagi di versi sama -> status Baru + tanda muncul lagi';

  -- tandai diabaikan menghapus tanda muncul lagi; status tidak dikenal ditolak
  perform public.tandai_status_error('uji-status-1', 'diabaikan', null, '1000000000200', 'UJI ADMIN');
  if (select muncul_lagi from public.kesehatan_status_error where sidik = 'uji-status-1') then raise exception 'GAGAL U4: tanda muncul lagi tidak hilang'; end if;
  begin
    perform public.tandai_status_error('uji-status-1', 'ngawur', null, null, 'UJI');
    raise exception 'GAGAL U4: status tidak dikenal diterima';
  exception when sqlstate 'P0001' then null;
  end;
  raise notice 'LULUS U4: diabaikan & validasi status';

  -- tunda cek: Peringatan maks 7 hari (168 jam), Kritis maks 24 jam
  select kode into v_kode from public.kesehatan_cek order by urutan limit 1;
  insert into public.kesehatan_hasil (run_id, kode, jumlah, status, sampel) values (gen_random_uuid(), v_kode, 5, 'peringatan', '[]');
  v := public.tunda_cek_kesehatan(v_kode, 500, 'uji tunda', 'UJI ADMIN');
  if (v->>'jam')::int <> 168 or (select jumlah_saat_tunda from public.kesehatan_tunda_cek where kode = v_kode) <> 5 then raise exception 'GAGAL U5: tunda peringatan %', v; end if;
  insert into public.kesehatan_hasil (run_id, kode, jumlah, status, sampel, waktu) values (gen_random_uuid(), v_kode, 1, 'kritis', '[]', now() + interval '1 second');
  v := public.tunda_cek_kesehatan(v_kode, 168, 'uji tunda kritis', 'UJI ADMIN');
  if (v->>'jam')::int <> 24 then raise exception 'GAGAL U5: kritis bisa ditunda % jam', v->>'jam'; end if;
  perform public.batal_tunda_cek_kesehatan(v_kode, 'UJI ADMIN');
  if exists (select 1 from public.kesehatan_tunda_cek where kode = v_kode) then raise exception 'GAGAL U5: batal tunda tidak menghapus'; end if;
  raise notice 'LULUS U5: tunda Peringatan maks 7 hari, Kritis maks 24 jam, batal tunda';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
