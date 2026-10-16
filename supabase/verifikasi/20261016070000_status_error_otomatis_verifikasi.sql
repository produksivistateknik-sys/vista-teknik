-- VERIFIKASI selesai otomatis (jalankan SESUDAH migration 20261016070000). Data uji ditanam di transaksi yang
-- di-ROLLBACK (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
select jobname, schedule from cron.job where jobname = 'kesehatan-error-otomatis';   -- HARUS 1 baris, '20 * * * *'

begin;
do $$
declare s record;
begin
  insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, pengguna, jumlah, waktu_pertama, waktu_terakhir) values
    ('uji-app', '1000000000100', 'crash', 'uji-oto-lama',   'UJI sepi 50 jam',  'UJI', 2, now() - interval '50 hours', now() - interval '50 hours'),
    ('uji-app', '1000000000300', 'crash', 'uji-oto-baru',   'UJI masih terjadi', 'UJI', 1, now() - interval '1 hour',  now() - interval '1 hour'),
    ('uji-app', '1000000000100', 'crash', 'uji-oto-abaikan','UJI diabaikan',     'UJI', 1, now() - interval '60 hours', now() - interval '60 hours');
  perform public.tandai_status_error('uji-oto-abaikan', 'diabaikan', 'uji', null, 'UJI ADMIN');
  perform public.selesaikan_error_otomatis();

  select * into s from public.kesehatan_status_error where sidik = 'uji-oto-lama';
  if s.status is distinct from 'selesai' or not s.otomatis or s.versi_ditandai <> '1000000000300' or s.ditandai_oleh <> 'Sistem (otomatis)' then
    raise exception 'GAGAL U1: sepi 50 jam tidak jadi selesai otomatis dgn versi terbaru aplikasi: %', row_to_json(s);
  end if;
  raise notice 'LULUS U1: 50 jam tanpa kejadian -> Selesai (otomatis), versi patokan = versi terbaru aplikasi';
  if exists (select 1 from public.kesehatan_status_error where sidik = 'uji-oto-baru') then raise exception 'GAGAL U2: error 1 jam lalu ikut ditutup'; end if;
  if (select status from public.kesehatan_status_error where sidik = 'uji-oto-abaikan') <> 'diabaikan' then raise exception 'GAGAL U2: Diabaikan diubah'; end if;
  raise notice 'LULUS U2: error yang masih terjadi & yang Diabaikan tidak disentuh';
  if not exists (select 1 from public.activity_log where user_name = 'Sistem (otomatis)' and description like '%selesai (otomatis, 48 jam%UJI sepi 50 jam%') then
    raise exception 'GAGAL U3: activity_log tidak mencatat';
  end if;
  raise notice 'LULUS U3: tercatat di activity_log';

  -- muncul lagi dari versi LAMA (HP belum dimuat ulang) -> tetap selesai
  insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, pengguna, jumlah, waktu_pertama, waktu_terakhir)
    values ('uji-app', '1000000000100', 'crash', 'uji-oto-lama', 'UJI sepi 50 jam', 'UJI', 1, now(), now() + interval '1 second');
  if (select status from public.kesehatan_status_error where sidik = 'uji-oto-lama') <> 'selesai' then raise exception 'GAGAL U4: versi lama membuka kembali'; end if;
  -- muncul lagi dari versi terbaru -> Baru + muncul lagi, otomatis = false
  insert into public.log_error_app (aplikasi, versi, jenis, sidik, pesan, pengguna, jumlah, waktu_pertama, waktu_terakhir)
    values ('uji-app', '1000000000300', 'crash', 'uji-oto-lama', 'UJI sepi 50 jam', 'UJI', 1, now(), now() + interval '2 seconds');
  select * into s from public.kesehatan_status_error where sidik = 'uji-oto-lama';
  if s.status <> 'baru' or not s.muncul_lagi or s.otomatis then raise exception 'GAGAL U4: tidak terbuka kembali dgn benar: %', row_to_json(s); end if;
  raise notice 'LULUS U4: versi lama tidak membuka kembali; versi terbaru -> Baru + Muncul lagi';

  -- dijalankan lagi: yang baru terjadi tidak ditutup lagi; tandai manual -> otomatis false
  perform public.selesaikan_error_otomatis();
  if (select status from public.kesehatan_status_error where sidik = 'uji-oto-lama') <> 'baru' then raise exception 'GAGAL U5: kejadian baru ditutup lagi'; end if;
  perform public.tandai_status_error('uji-oto-lama', 'selesai', 'manual', '1000000000300', 'UJI ADMIN');
  if (select otomatis from public.kesehatan_status_error where sidik = 'uji-oto-lama') then raise exception 'GAGAL U5: tandai manual masih otomatis'; end if;
  raise notice 'LULUS U5: jalan ulang aman; tandai manual -> bukan otomatis';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
