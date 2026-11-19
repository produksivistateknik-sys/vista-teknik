-- 20261119020000_media_rutin_hapus.sql - FOTO/VIDEO MAINTENANCE RUTIN DIHAPUS OTOMATIS 30 HARI - TAHAP 2 (19 Nov 2026).
-- Jalankan SEKALI di Supabase SQL Editor (Run), SESUDAH Tahap 1 (20261119010000) dan SESUDAH Edge Function hapus-media-rutin
-- ter-deploy. Berhasil = NOTICE "Verifikasi LULUS ...". Gagal di tengah = seluruh file batal.
--
-- FILE INI TIDAK MENGHAPUS APA PUN. Saklar dibuat MATI. Isinya:
--   1) saklar inv_pengaturan: hapus_media_rutin_mode = 'mati' | 'manual' | 'otomatis', hapus_media_rutin_batas = 20 (1-200).
--      Ubah HANYA lewat SQL Editor (anon tidak bisa menulis inv_pengaturan).
--   2) rahasia pemanggil Edge Function, dibuat acak di sini & disimpan di inv_rahasia_internal (tidak terbaca anon/authenticated,
--      tidak pernah ditampilkan). Cron & pemicu manual membacanya saat jalan; Edge Function mencocokkannya lewat RPC service role.
--   3) log PERMANEN inv_media_hapus_log (tidak bisa diubah/dihapus): proses_mulai, mulai (sebelum berkas dihapus), selesai,
--      gagal, dilewati, proses_selesai - siapa (pemicu), kapan, berkas (url/thumb), baris riwayat, ukuran.
--   4) RPC proses - HANYA service_role (Edge Function): mulai (cek saklar, satu proses sekaligus, ambil kandidat dari
--      inv_media_rutin_status = satu sumber aturan), klaim (cek ulang status tepat sebelum hapus + catat 'mulai'),
--      tandai (SESUDAH berkas terbukti hilang di R2: inv_media.dihapus_pada + inv_jadwal_selesai.media_dihapus_pada + log, satu
--      transaksi), gagal, akhiri. Baris riwayat & baris inv_media TIDAK dihapus (keputusan user: ditandai).
--   5) inv_media_rutin_jalankan_manual() - pemicu manual dari SQL Editor (hanya pemilik database).
--   6) cron 'hapus-media-rutin-harian' 02.00 WIB (19.00 UTC). Hanya menghapus bila saklar 'otomatis'.
--   7) Kesehatan Data K26 (foto Rutin lewat 30 hari masih ada / tak akan terhapus otomatis) & K27 (proses hapus tidak tuntas).
-- Urutan per berkas di Edge Function: klaim -> hapus berkas & thumbnail di R2 -> cek sudah hilang -> catat 'berkas_terhapus' -> tandai.
-- Berkas utama yang TIDAK DITEMUKAN di R2 sebelum dihapus & belum pernah tercatat 'berkas_terhapus' = GAGAL, tidak ditandai
-- (melindungi dari salah konfigurasi bucket / referensi palsu). Mati di tengah = aman diulang: proses berikutnya mengklaim lagi;
-- bila sudah tercatat 'berkas_terhapus', tinggal ditandai. K27 menampilkan berkas yang tertinggal di keadaan mulai/gagal > 1 jam.
-- Pengamanan tambahan (tinjauan agent keamanan): izin anon/authenticated ke RPC lama inv_migrasi_data_lama dicabut - hanya
-- dipakai sekali saat go-live 30 Okt (tidak dipanggil aplikasi), tapi bisa membuat baris media bertanggal mundur.
-- Tidak menyentuh Reset Permintaan Bulanan (tetap MATI), BOM, atau tabel lain. Keputusan user 19 Nov: tanpa "simpan permanen",
-- tanpa cadangan berkas, jam 02.00 WIB, penyelesaian yang dikembalikan admin = sudah ditinjau.
-- Rollback: supabase/rollback/20261119020000_media_rutin_hapus_rollback.sql (menolak bila sudah ada berkas terhapus).
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regprocedure('public.inv_media_rutin_status()') is null then
    raise exception 'Jalankan dulu Tahap 1 (20261119010000_media_rutin_status.sql) - batal';
  end if;
  if to_regclass('public.inv_media_hapus_log') is not null or to_regclass('public.inv_rahasia_internal') is not null
     or exists (select 1 from public.inv_pengaturan where kunci like 'hapus\_media\_rutin\_%') then
    raise exception 'Tahap 2 sudah pernah dijalankan - batal';
  end if;
  if to_regprocedure('public._sql_cek_kesehatan(text)') is null or to_regprocedure('public._sql_cek_kesehatan_k1_k25(text)') is not null then
    raise exception 'Lapisan cek Kesehatan Data tidak sesuai harapan (_sql_cek_kesehatan_k1_k25 sudah ada?) - batal';
  end if;
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    raise exception 'pg_cron / pg_net belum aktif - batal';
  end if;
  if exists (select 1 from cron.job where jobname = 'hapus-media-rutin-harian') then
    raise exception 'Jadwal cron hapus-media-rutin-harian sudah ada - batal';
  end if;
end $$;

-- 1) saklar (MATI)
insert into public.inv_pengaturan (kunci, nilai, keterangan) values
  ('hapus_media_rutin_mode', '"mati"',
   'Hapus otomatis foto/video Maintenance Rutin >30 hari: mati | manual (hanya lewat inv_media_rutin_jalankan_manual di SQL Editor) | otomatis (jadwal 02.00 WIB + manual). Ubah HANYA lewat SQL Editor.'),
  ('hapus_media_rutin_batas', '20', 'Maksimal foto/video Maintenance Rutin dihapus per proses (1-200).');

-- 2) rahasia pemanggil (tidak terbaca anon/authenticated; tidak ditampilkan)
create table public.inv_rahasia_internal (
  kunci text primary key,
  nilai text not null check (length(nilai) >= 32),
  dibuat_pada timestamptz not null default now()
);
alter table public.inv_rahasia_internal enable row level security;   -- tanpa policy = tidak ada baris yang terlihat lewat API
revoke all on public.inv_rahasia_internal from public, anon, authenticated;
insert into public.inv_rahasia_internal (kunci, nilai)
values ('hapus_media_rutin', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));

-- 3) log permanen
create table public.inv_media_hapus_log (
  id bigserial primary key,
  run_id uuid not null,
  waktu timestamptz not null default now(),
  jenis text not null check (jenis in ('proses_mulai', 'mulai', 'berkas_terhapus', 'selesai', 'gagal', 'dilewati', 'proses_selesai')),
  pemicu text check (pemicu in ('cron', 'manual')),
  media_id bigint,
  selesai_id bigint,
  barang_id bigint,
  url text,
  thumb text,
  ukuran_byte bigint,
  pesan text
);
create index inv_media_hapus_log_media on public.inv_media_hapus_log (media_id, id);
create index inv_media_hapus_log_run on public.inv_media_hapus_log (run_id, jenis);
alter table public.inv_media_hapus_log enable row level security;
create policy baca_inv_media_hapus_log on public.inv_media_hapus_log for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.inv_media_hapus_log from anon, authenticated;
grant select on public.inv_media_hapus_log to anon, authenticated;
create trigger inv_media_hapus_log_permanen before update or delete on public.inv_media_hapus_log
  for each row execute function public.inv_tolak_ubah();
create trigger inv_media_hapus_log_permanen_truncate before truncate on public.inv_media_hapus_log
  for each statement execute function public.inv_tolak_ubah();

-- 4) RPC proses (service_role saja)
create function public.inv_media_rutin_kunci_internal() returns text
language sql stable security definer set search_path = public as $$
  select nilai from public.inv_rahasia_internal where kunci = 'hapus_media_rutin'
$$;

create function public.inv_media_rutin_mulai(p_run uuid, p_pemicu text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_mode text; v_batas int; v_total int; v_kandidat jsonb;
begin
  if p_run is null or p_pemicu is null or p_pemicu not in ('cron', 'manual') then
    raise exception 'Parameter tidak sah' using errcode = '22023';
  end if;
  select nilai #>> '{}' into v_mode from public.inv_pengaturan where kunci = 'hapus_media_rutin_mode';
  v_mode := coalesce(v_mode, 'mati');
  if v_mode = 'mati' then return jsonb_build_object('jalan', false, 'alasan', 'saklar MATI'); end if;
  if v_mode not in ('manual', 'otomatis') then return jsonb_build_object('jalan', false, 'alasan', 'mode tidak dikenal: ' || v_mode); end if;
  if v_mode = 'manual' and p_pemicu = 'cron' then
    return jsonb_build_object('jalan', false, 'alasan', 'mode manual - jadwal harian tidak menghapus');
  end if;
  perform pg_advisory_xact_lock(hashtext('inv_media_rutin_hapus'));   -- dua pemicu bersamaan -> berurutan
  if exists (select 1 from public.inv_media_hapus_log a
              where a.jenis = 'proses_mulai' and a.waktu > now() - interval '15 minutes'
                and not exists (select 1 from public.inv_media_hapus_log b where b.run_id = a.run_id and b.jenis = 'proses_selesai')) then
    return jsonb_build_object('jalan', false, 'alasan', 'proses lain masih berjalan');
  end if;
  if exists (select 1 from public.inv_media_hapus_log where run_id = p_run) then
    raise exception 'run_id sudah dipakai' using errcode = '22023';
  end if;
  v_batas := least(greatest(coalesce((select (nilai #>> '{}')::int from public.inv_pengaturan where kunci = 'hapus_media_rutin_batas'), 20), 1), 200);
  select count(*) into v_total from public.inv_media_rutin_status() where status = 'kandidat';
  if v_total > 2000 then
    return jsonb_build_object('jalan', false, 'alasan', 'jumlah kandidat tidak wajar: ' || v_total);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('media_id', k.media_id) order by k.dibuat_pada, k.media_id), '[]'::jsonb) into v_kandidat
    from (select f.media_id, f.dibuat_pada from public.inv_media_rutin_status() f
           where f.status = 'kandidat' order by f.dibuat_pada, f.media_id limit v_batas) k;
  insert into public.inv_media_hapus_log (run_id, jenis, pemicu, pesan)
  values (p_run, 'proses_mulai', p_pemicu,
          format('mode %s, batas %s, kandidat %s, diambil %s', v_mode, v_batas, v_total, jsonb_array_length(v_kandidat)));
  return jsonb_build_object('jalan', true, 'batas', v_batas, 'total_kandidat', v_total, 'kandidat', v_kandidat);
end $$;

create function public.inv_media_rutin_klaim(p_run uuid, p_media_id bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_status text; v_selesai bigint; v_barang bigint; v_url text; v_thumb text;
begin
  if not exists (select 1 from public.inv_media_hapus_log where run_id = p_run and jenis = 'proses_mulai' and waktu > now() - interval '15 minutes')
     or exists (select 1 from public.inv_media_hapus_log where run_id = p_run and jenis = 'proses_selesai') then
    raise exception 'Proses % tidak aktif', p_run using errcode = '42501';
  end if;
  select f.status, f.selesai_id, f.barang_id, f.url, f.thumb into v_status, v_selesai, v_barang, v_url, v_thumb
    from public.inv_media_rutin_status() f where f.media_id = p_media_id;
  if v_status is distinct from 'kandidat' then
    insert into public.inv_media_hapus_log (run_id, jenis, media_id, selesai_id, barang_id, url, thumb, pesan)
    values (p_run, 'dilewati', p_media_id, v_selesai, v_barang, v_url, v_thumb, coalesce(v_status, 'tidak ditemukan'));
    return jsonb_build_object('ok', false, 'status', coalesce(v_status, 'tidak ditemukan'));
  end if;
  insert into public.inv_media_hapus_log (run_id, jenis, media_id, selesai_id, barang_id, url, thumb)
  values (p_run, 'mulai', p_media_id, v_selesai, v_barang, v_url, v_thumb);
  -- sudah_terhapus: proses sebelumnya sudah menghapus berkas ini di R2 tapi belum sempat menandai -> boleh langsung ditandai
  return jsonb_build_object('ok', true, 'media_id', p_media_id, 'url', v_url, 'thumb', v_thumb,
    'sudah_terhapus', exists (select 1 from public.inv_media_hapus_log where media_id = p_media_id and jenis = 'berkas_terhapus'));
end $$;

-- dicatat SEGERA setelah berkas terbukti hilang di R2 (transaksi sendiri, sebelum tandai): bila tandai gagal, proses berikutnya tahu
-- berkas ini memang sudah dihapus oleh proses ini (bukan hilang karena hal lain).
create function public.inv_media_rutin_terhapus(p_run uuid, p_media_id bigint, p_ukuran bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.inv_media_hapus_log where run_id = p_run and media_id = p_media_id and jenis = 'mulai') then
    raise exception 'Tidak ada klaim untuk media % di proses %', p_media_id, p_run using errcode = '42501';
  end if;
  insert into public.inv_media_hapus_log (run_id, jenis, media_id, ukuran_byte) values (p_run, 'berkas_terhapus', p_media_id, p_ukuran);
end $$;

create function public.inv_media_rutin_tandai(p_run uuid, p_media_id bigint, p_ukuran bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_selesai bigint; v_barang bigint; v_url text; v_thumb text; v_n int;
begin
  select l.selesai_id, l.barang_id, l.url, l.thumb into v_selesai, v_barang, v_url, v_thumb
    from public.inv_media_hapus_log l
   where l.run_id = p_run and l.media_id = p_media_id and l.jenis = 'mulai'
   order by l.id desc limit 1;
  if v_selesai is null then
    raise exception 'Tidak ada klaim untuk media % di proses %', p_media_id, p_run using errcode = '42501';
  end if;
  update public.inv_media set dihapus_pada = now(), dihapus_oleh = 'otomatis 30 hari'
   where id = p_media_id and tujuan = 'jadwal_selesai' and peran = 'selesai' and dihapus_pada is null;
  get diagnostics v_n = row_count;
  update public.inv_jadwal_selesai set media_dihapus_pada = coalesce(media_dihapus_pada, now()) where id = v_selesai;
  insert into public.inv_media_hapus_log (run_id, jenis, media_id, selesai_id, barang_id, url, thumb, ukuran_byte, pesan)
  values (p_run, 'selesai', p_media_id, v_selesai, v_barang, v_url, v_thumb, p_ukuran,
          case when v_n = 0 then 'sudah ditandai sebelumnya' end);
  return jsonb_build_object('ok', true, 'ditandai', v_n);
end $$;

create function public.inv_media_rutin_gagal(p_run uuid, p_media_id bigint, p_pesan text) returns void
language sql security definer set search_path = public as $$
  insert into public.inv_media_hapus_log (run_id, jenis, media_id, pesan)
  values (p_run, 'gagal', p_media_id, left(coalesce(p_pesan, ''), 500))
$$;

create function public.inv_media_rutin_akhiri(p_run uuid, p_ringkasan jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.inv_media_hapus_log (run_id, jenis, pesan)
  select p_run, 'proses_selesai', left(coalesce(p_ringkasan::text, ''), 2000)
   where exists (select 1 from public.inv_media_hapus_log where run_id = p_run and jenis = 'proses_mulai')
     and not exists (select 1 from public.inv_media_hapus_log where run_id = p_run and jenis = 'proses_selesai')
$$;

-- hak akses: fungsi baru di schema public otomatis bisa dipanggil anon/authenticated (default Supabase) -> dicabut eksplisit
do $$ declare f text; begin
  foreach f in array array['inv_media_rutin_kunci_internal()', 'inv_media_rutin_mulai(uuid,text)', 'inv_media_rutin_klaim(uuid,bigint)',
                           'inv_media_rutin_terhapus(uuid,bigint,bigint)', 'inv_media_rutin_tandai(uuid,bigint,bigint)', 'inv_media_rutin_gagal(uuid,bigint,text)',
                           'inv_media_rutin_akhiri(uuid,jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- 5) pemicu manual (SQL Editor; hanya pemilik database)
create function public.inv_media_rutin_jalankan_manual() returns text
language plpgsql security definer set search_path = public as $$
declare v_mode text; v_id bigint;
begin
  select nilai #>> '{}' into v_mode from public.inv_pengaturan where kunci = 'hapus_media_rutin_mode';
  if coalesce(v_mode, 'mati') not in ('manual', 'otomatis') then
    raise exception 'Saklar masih "%" - ubah dulu hapus_media_rutin_mode ke "manual"', coalesce(v_mode, 'mati');
  end if;
  select net.http_post(
    url := 'https://aoxhxfsqjnquwsxjrsmo.supabase.co/functions/v1/hapus-media-rutin',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pemicu', 'manual',
                                  'x-kunci-hapus', (select nilai from public.inv_rahasia_internal where kunci = 'hapus_media_rutin')),
    timeout_milliseconds := 150000) into v_id;
  return 'Permintaan dikirim (pg_net #' || v_id || '). Hasil 1-2 menit lagi: select * from public.inv_media_hapus_log order by id desc;';
end $$;
revoke all on function public.inv_media_rutin_jalankan_manual() from public, anon, authenticated, service_role;

-- 5b) RPC impor lama (go-live 30 Okt) tidak boleh lagi dipanggil anon/authenticated
do $$ begin
  if to_regprocedure('public.inv_migrasi_data_lama(boolean,jsonb)') is not null then
    revoke execute on function public.inv_migrasi_data_lama(boolean, jsonb) from public, anon, authenticated;
  end if;
end $$;

-- 6) jadwal harian 02.00 WIB (= 19.00 UTC); hanya menghapus bila saklar 'otomatis' (dicek Edge Function lewat inv_media_rutin_mulai)
select cron.schedule('hapus-media-rutin-harian', '0 19 * * *', $c$
  select net.http_post(
    url := 'https://aoxhxfsqjnquwsxjrsmo.supabase.co/functions/v1/hapus-media-rutin',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pemicu', 'cron',
                                  'x-kunci-hapus', (select nilai from public.inv_rahasia_internal where kunci = 'hapus_media_rutin')),
    timeout_milliseconds := 150000)
$c$);

-- 7) Kesehatan Data K26 & K27 (pola lapisan sama dgn K25: K1-K25 tidak berubah)
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k25;
create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K26' then $q$
   select f.media_id::text as ref, f.barang_id, b.nama as barang, b.nomor_inventaris, f.selesai_id as riwayat, f.dibuat_pada as diunggah,
          f.umur_hari, f.status,
          case f.status when 'kandidat' then 'proses harian tertinggal (lewat 32 hari)'
                        when 'jalur_tidak_dikenal' then 'jalur berkas tidak dikenal - tidak akan dihapus otomatis'
                        else 'berkas dirujuk baris lain - tidak akan dihapus otomatis' end as alasan,
          f.url, 'peringatan' as tingkat
     from public.inv_media_rutin_status() f
     join public.inv_barang b on b.id = f.barang_id
    where (f.status = 'kandidat' and f.umur_hari >= 32
           and (select nilai #>> '{}' from public.inv_pengaturan where kunci = 'hapus_media_rutin_mode') = 'otomatis')
       or (f.status in ('jalur_tidak_dikenal', 'dipakai_bersama') and f.umur_hari >= 30)
    order by f.dibuat_pada, f.media_id $q$
 when 'K27' then $q$
   select l.media_id::text as ref, l.media_id, m.ref_id as riwayat, l.jenis as keadaan_terakhir, l.waktu, l.pesan, m.url,
          'peringatan' as tingkat
     from (select distinct on (x.media_id) x.media_id, x.jenis, x.waktu, x.pesan
             from public.inv_media_hapus_log x
            where x.media_id is not null and x.jenis in ('mulai', 'berkas_terhapus', 'selesai', 'gagal', 'dilewati')
            order by x.media_id, x.id desc) l
     join public.inv_media m on m.id = l.media_id
    where l.jenis in ('mulai', 'berkas_terhapus', 'gagal') and l.waktu < now() - interval '1 hour' and m.dihapus_pada is null
    order by l.waktu $q$
 else public._sql_cek_kesehatan_k1_k25(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K26', 'Foto/video Maintenance Rutin lewat 30 hari masih ada', 'Inventaris',
  'Saat hapus otomatis aktif: foto/video Rutin yang sudah lewat 32 hari belum terhapus. Kapan pun: berkas lewat 30 hari yang jalurnya tidak dikenal atau dirujuk baris lain (tidak akan dihapus otomatis).', 'harian', 1, null, 69,
  array['Admin'],
  $t$Ada foto/video penyelesaian Maintenance Rutin yang seharusnya sudah dihapus otomatis, atau yang tidak akan pernah dihapus otomatis.$t$,
  $t$Proses harian 02.00 WIB gagal/tertinggal (lihat log inv_media_hapus_log), batas per proses lebih kecil dari jumlah antrean, atau berkas diunggah ke jalur di luar pola aplikasi.$t$,
  $t$Storage tidak berkurang sesuai rencana. Riwayat tetap tampil normal.$t$,
  array[
    $t$Lihat kolom alasan di contoh baris.$t$,
    $t$Proses tertinggal: cek log (select * from inv_media_hapus_log order by id desc) dan saklar hapus_media_rutin_mode.$t$,
    $t$Jalur tidak dikenal / dirujuk baris lain: periksa berkasnya; jangan dihapus manual tanpa memastikan tidak dipakai.$t$]),
 ('K27', 'Hapus foto/video Maintenance Rutin tidak tuntas', 'Inventaris',
  'Berkas yang proses hapusnya berhenti (mulai / berkas_terhapus / gagal) lebih dari 1 jam dan belum ditandai dihapus: berkasnya mungkin sudah hilang dari R2 sementara Riwayat masih menunjuknya, atau berkasnya memang tidak ditemukan.', 'harian', 1, null, 70,
  array['Admin'],
  $t$Proses hapus otomatis foto/video Maintenance Rutin berhenti di tengah untuk berkas ini.$t$,
  $t$Jaringan ke R2 putus, Edge Function kehabisan waktu, barang dipindah ke tempat sampah saat proses berjalan, atau berkas memang tidak ada di R2 (pesan 'tidak ditemukan').$t$,
  $t$Riwayat bisa menampilkan gambar patah sampai proses berikutnya menuntaskannya.$t$,
  array[
    $t$Lihat keadaan_terakhir dan pesan di contoh baris.$t$,
    $t$Saklar otomatis: proses 02.00 WIB berikutnya mencoba lagi. Saklar manual: jalankan lagi select public.inv_media_rutin_jalankan_manual(); (aman diulang).$t$,
    $t$Pesan 'tidak ditemukan' atau tetap muncul: laporkan media_id-nya - berkas/konfigurasi bucket perlu dicek, jangan ditandai manual.$t$]);

-- 8) verifikasi (gagal = seluruh file batal)
do $$
declare k text; f text; gagal text[] := '{}'; n26 int; n27 int; v_kandidat int;
begin
  if (select nilai #>> '{}' from public.inv_pengaturan where kunci = 'hapus_media_rutin_mode') <> 'mati' then gagal := gagal || 'saklar bukan mati'::text; end if;
  if (select (nilai #>> '{}')::int from public.inv_pengaturan where kunci = 'hapus_media_rutin_batas') <> 20 then gagal := gagal || 'batas bukan 20'::text; end if;
  if (select length(nilai) from public.inv_rahasia_internal where kunci = 'hapus_media_rutin') is distinct from 64 then gagal := gagal || 'rahasia tidak 64 karakter'::text; end if;
  if has_table_privilege('anon', 'public.inv_rahasia_internal', 'select') or has_table_privilege('authenticated', 'public.inv_rahasia_internal', 'select') then
    gagal := gagal || 'rahasia terbaca anon/authenticated'::text; end if;
  if exists (select 1 from public.inv_media_hapus_log) then gagal := gagal || 'log tidak kosong'::text; end if;
  foreach f in array array['inv_media_rutin_kunci_internal()', 'inv_media_rutin_mulai(uuid,text)', 'inv_media_rutin_klaim(uuid,bigint)',
                           'inv_media_rutin_terhapus(uuid,bigint,bigint)', 'inv_media_rutin_tandai(uuid,bigint,bigint)', 'inv_media_rutin_gagal(uuid,bigint,text)',
                           'inv_media_rutin_akhiri(uuid,jsonb)', 'inv_media_rutin_jalankan_manual()'] loop
    if has_function_privilege('anon', 'public.' || f, 'execute') or has_function_privilege('authenticated', 'public.' || f, 'execute') then
      gagal := gagal || ('anon/authenticated bisa menjalankan ' || f); end if;
    if f <> 'inv_media_rutin_jalankan_manual()' and not has_function_privilege('service_role', 'public.' || f, 'execute') then
      gagal := gagal || ('service_role tidak bisa menjalankan ' || f); end if;
  end loop;
  if has_function_privilege('service_role', 'public.inv_media_rutin_jalankan_manual()', 'execute') then
    gagal := gagal || 'service_role bisa memicu manual'::text; end if;
  if not exists (select 1 from cron.job where jobname = 'hapus-media-rutin-harian' and schedule = '0 19 * * *' and active) then
    gagal := gagal || 'cron hapus-media-rutin-harian tidak aktif'::text; end if;
  if coalesce(current_setting('cron.timezone', true), 'GMT') not in ('GMT', 'UTC', 'Etc/UTC', 'Etc/GMT') then
    gagal := gagal || ('zona waktu cron bukan UTC (' || current_setting('cron.timezone', true) || ') - 0 19 * * * tidak sama dgn 02.00 WIB'); end if;
  if (select count(*) from public.kesehatan_cek where kode in ('K26', 'K27') and aktif) <> 2 then gagal := gagal || 'baris kesehatan_cek K26/K27 tidak lengkap'::text; end if;
  if to_regprocedure('public.inv_migrasi_data_lama(boolean,jsonb)') is not null
     and (has_function_privilege('anon', 'public.inv_migrasi_data_lama(boolean,jsonb)', 'execute')
          or has_function_privilege('authenticated', 'public.inv_migrasi_data_lama(boolean,jsonb)', 'execute')) then
    gagal := gagal || 'inv_migrasi_data_lama masih bisa dipanggil anon/authenticated'::text; end if;
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16','K17','K18','K19','K20','K21','K22','K23','K24','K25'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k25(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  begin
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K26') || ') s' into n26;
    execute 'select count(*) from (' || public._sql_cek_kesehatan('K27') || ') s' into n27;
  exception when others then gagal := gagal || ('K26/K27 error: ' || sqlerrm);
  end;
  select count(*) into v_kandidat from public.inv_media_rutin_status() where status = 'kandidat';
  if array_length(gagal, 1) is not null then raise exception 'Verifikasi GAGAL: %', array_to_string(gagal, ' | '); end if;
  raise notice 'Verifikasi LULUS - saklar MATI, batas 20, jadwal 02.00 WIB terpasang, rahasia tersimpan, K26 % baris, K27 % baris, kandidat saat ini % (TIDAK ADA YANG DIHAPUS)',
    n26, n27, v_kandidat;
end $$;

commit;

-- Lihat sendiri (baca saja):
--   select kunci, nilai from public.inv_pengaturan where kunci like 'hapus_media_rutin_%';
--   select jobname, schedule, active from cron.job where jobname = 'hapus-media-rutin-harian';
-- Eksekusi pertama (SETELAH izin tertulis): supabase/scripts/20261119_hapus_media_rutin_manual_pertama.sql
