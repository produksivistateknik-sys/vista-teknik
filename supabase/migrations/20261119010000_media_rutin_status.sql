-- 20261119010000_media_rutin_status.sql - FOTO/VIDEO MAINTENANCE RUTIN DIHAPUS OTOMATIS 30 HARI - TAHAP 1 (19 Nov 2026).
-- Jalankan SEKALI di Supabase SQL Editor (Run). Berhasil = NOTICE "Verifikasi LULUS ...". Gagal di tengah = seluruh file batal.
--
-- TAHAP 1 TIDAK MENGHAPUS APA PUN dan tidak mengubah isi data. Isinya hanya:
--   1) kolom penanda inv_jadwal_selesai.media_dihapus_pada (kosong semua; nanti diisi proses Tahap 2 saat foto/video baris itu
--      dihapus -> aplikasi menampilkan "Foto/video dihapus otomatis (lebih dari 30 hari)").
--   2) fungsi BACA SAJA inv_media_rutin_status() = SATU SUMBER aturan "boleh dihapus". Dipakai dry-run sekarang
--      (npm run dryrun:media-rutin di vista-teknik) dan oleh proses hapus Tahap 2 nanti - aturan tidak ditulis dua kali.
--
-- Aturan (keputusan user 18-19 Nov 2026 + tinjauan agent keamanan/data):
--   * HANYA inv_media tujuan='jadwal_selesai' & peran='selesai' (Maintenance Rutin). Kerusakan (laporan sebelum/sesudah/lama),
--     update laporan, datasheet/foto barang, dan media di luar Inventaris (QC, proyek, WO, dll.) tidak pernah ikut.
--   * 30 hari sejak inv_media.dibuat_pada, per berkas (= waktu unggah; dicek 18 Nov: sama dgn waktu berkas di R2, 64/64 selisih 0 mnt).
--   * Jalur berkas wajib PERSIS dikenal (selain itu 'jalur_tidak_dikenal' = tidak dihapus, dilaporkan):
--       host = host publik bucket R2 utama (bukan rahasia: sama dgn VITE_R2_PUBLIC_BASE_URL di bundle aplikasi);
--       folder = maintenance-rutin/<inv_jadwal.rutin_id_lama>/ (impor tab Maintenance lama; dicek 19 Nov: 39/39 cocok) atau
--                inventaris/<barang_id>/jadwal/<jadwal_id>/ milik baris riwayat itu sendiri;
--       nama berkas = <angka>_<huruf/angka/_>.<ekstensi> (pola unggahan aplikasi) - tanpa %, ?, #, .., /, \;
--       thumbnail (bila ada) wajib di folder yang sama dgn pola nama yang sama.
--   * Berkas yang juga dirujuk baris inv_media lain (url/thumb sama) -> 'dipakai_bersama' (tidak dihapus).
--   * Ditunda selama notifikasi 'maintenance_selesai' untuk penyelesaian itu (nilai_sesudah.selesai_id) belum diputuskan admin.
--   * Barang di tempat sampah dilewati (datanya membeku). Berkas yang sudah ditandai dihapus (dihapus_pada) dilewati.
-- Angka 30 hari SAMA dgn HARI_SIMPAN_MEDIA_RUTIN di src/lib/inventarisAturan.ts (identik di vista-teknik & vista-pekerja) - ubah bersamaan.
-- Fungsi security invoker: anon hanya melihat yang memang boleh dibaca anon (RLS); barang di tempat sampah tidak terlihat anon,
-- jadi dry-run (anon) tidak menampilkan status 'barang_di_sampah' - proses Tahap 2 (service role) melihat & melewatinya.
-- Tidak menyentuh Reset Permintaan Bulanan (tetap MATI), BOM, atau tabel lain. Aman di jam kerja (ALTER kolom nullable, sekejap).
-- Harapan saat dijalankan 19 Nov 2026: 64 foto/video Rutin, sekitar 33 'kandidat', sisanya 'belum_30_hari'.
-- Rollback: supabase/rollback/20261119010000_media_rutin_status_rollback.sql
begin;
set local lock_timeout = '5s';

do $$ begin
  if to_regclass('public.inv_media') is null or to_regclass('public.inv_jadwal_selesai') is null or to_regclass('public.inv_jadwal') is null
     or to_regclass('public.inv_notifikasi') is null or to_regclass('public.inv_barang') is null then
    raise exception 'Tabel inventaris tidak lengkap - batal';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'inv_jadwal_selesai'
             and column_name = 'media_dihapus_pada') then
    raise exception 'Kolom inv_jadwal_selesai.media_dihapus_pada sudah ada - file ini sudah pernah dijalankan, batal';
  end if;
  if to_regprocedure('public.inv_media_rutin_status()') is not null then
    raise exception 'Fungsi inv_media_rutin_status() sudah ada - batal';
  end if;
end $$;

-- 1) penanda di baris riwayat (baris riwayat TIDAK pernah dihapus)
alter table public.inv_jadwal_selesai add column media_dihapus_pada timestamptz;
comment on column public.inv_jadwal_selesai.media_dihapus_pada is
  'Diisi proses hapus otomatis (Tahap 2) saat foto/video penyelesaian ini dihapus dari R2 karena lewat 30 hari sejak diunggah. Null = belum pernah.';

-- 2) satu sumber aturan
create function public.inv_media_rutin_status()
returns table (media_id bigint, selesai_id bigint, jadwal_id bigint, barang_id bigint, url text, thumb text, mime text,
               dibuat_pada timestamptz, umur_hari numeric, boleh_dihapus_mulai timestamptz, status text)
language sql stable security invoker set search_path = public as $$
  with r as (
    select m.*, s.id as s_id, s.jadwal_id as s_jadwal, s.barang_id as s_barang,
           '^https://photo\.vistaproduksi\.com/(maintenance-rutin/' || coalesce(j.rutin_id_lama::text, 'x') || '|inventaris/' || s.barang_id
             || '/jadwal/' || s.jadwal_id || ')/[0-9]+_[A-Za-z0-9_]+\.[A-Za-z0-9]{2,5}$' as pola
      from public.inv_media m
      join public.inv_jadwal_selesai s on s.id = m.ref_id
      left join public.inv_jadwal j on j.id = s.jadwal_id
     where m.tujuan = 'jadwal_selesai' and m.peran = 'selesai'
  )
  select r.id, r.s_id, r.s_jadwal, r.s_barang, r.url, r.thumb, r.mime, r.dibuat_pada,
         round((extract(epoch from (now() - r.dibuat_pada)) / 86400)::numeric, 1),
         r.dibuat_pada + interval '30 days',
         case
           when r.dihapus_pada is not null then 'sudah_dihapus'
           when exists (select 1 from public.inv_barang b where b.id = r.s_barang and b.dihapus_pada is not null) then 'barang_di_sampah'
           when r.dibuat_pada > now() - interval '30 days' then 'belum_30_hari'
           when not (r.url ~ r.pola
                     and (r.thumb is null
                          or (r.thumb ~ r.pola and regexp_replace(r.thumb, '[^/]+$', '') = regexp_replace(r.url, '[^/]+$', ''))))
             then 'jalur_tidak_dikenal'
           when exists (select 1 from public.inv_media o
                         where o.id <> r.id and (o.url in (r.url, r.thumb) or o.thumb in (r.url, r.thumb))) then 'dipakai_bersama'
           when exists (select 1 from public.inv_notifikasi n
                         where n.jenis = 'maintenance_selesai' and n.status <> 'selesai'
                           and n.nilai_sesudah ->> 'selesai_id' = r.s_id::text) then 'ditunda_tinjauan'
           else 'kandidat'
         end
    from r
$$;
comment on function public.inv_media_rutin_status() is
  'BACA SAJA. Status tiap foto/video Maintenance Rutin terhadap aturan hapus otomatis 30 hari: kandidat / belum_30_hari / ditunda_tinjauan / jalur_tidak_dikenal / dipakai_bersama / barang_di_sampah / sudah_dihapus. Satu sumber utk dry-run & proses hapus Tahap 2.';
revoke all on function public.inv_media_rutin_status() from public;
grant execute on function public.inv_media_rutin_status() to anon, authenticated, service_role;

-- 3) verifikasi (gagal = seluruh file batal)
do $$
declare v_media int; v_yatim int; v_fungsi int; v_asing int; v_status text; v_terisi int; v_luar int;
begin
  if (select prosecdef from pg_proc where oid = 'public.inv_media_rutin_status()'::regprocedure) then
    raise exception 'Verifikasi GAGAL: fungsi harus security invoker';
  end if;
  select count(*) filter (where s.id is not null), count(*) filter (where s.id is null) into v_media, v_yatim
    from public.inv_media m left join public.inv_jadwal_selesai s on s.id = m.ref_id
   where m.tujuan = 'jadwal_selesai' and m.peran = 'selesai';
  select count(*) into v_fungsi from public.inv_media_rutin_status();
  if v_media <> v_fungsi then raise exception 'Verifikasi GAGAL: media rutin % baris, fungsi % baris', v_media, v_fungsi; end if;
  select count(*) into v_luar from public.inv_media_rutin_status() f join public.inv_media m on m.id = f.media_id
   where m.tujuan <> 'jadwal_selesai' or m.peran <> 'selesai';
  if v_luar > 0 then raise exception 'Verifikasi GAGAL: % media bukan Maintenance Rutin ikut terbaca', v_luar; end if;
  select count(*) into v_asing from public.inv_media_rutin_status()
   where status not in ('kandidat', 'belum_30_hari', 'ditunda_tinjauan', 'jalur_tidak_dikenal', 'dipakai_bersama', 'barang_di_sampah', 'sudah_dihapus');
  if v_asing > 0 then raise exception 'Verifikasi GAGAL: % status tidak dikenal', v_asing; end if;
  select count(*) into v_terisi from public.inv_jadwal_selesai where media_dihapus_pada is not null;
  if v_terisi > 0 then raise exception 'Verifikasi GAGAL: media_dihapus_pada sudah terisi % baris', v_terisi; end if;
  select string_agg(status || ' ' || n, ', ' order by status) into v_status
    from (select status, count(*) n from public.inv_media_rutin_status() group by status) x;
  raise notice 'Verifikasi LULUS - % foto/video Maintenance Rutin: % (TIDAK ADA YANG DIHAPUS - ini hanya status/simulasi; harapan 19 Nov: 64 total, sekitar 33 kandidat)%',
    v_media, coalesce(v_status, 'kosong'), case when v_yatim > 0 then '. Catatan: ' || v_yatim || ' media tanpa baris riwayat (tidak ikut)' else '' end;
end $$;

commit;

-- Lihat sendiri kapan saja (baca saja):
--   select status, count(*) from public.inv_media_rutin_status() group by status order by status;
