-- ============================================================================================
-- KENDALA: istilah "Selesai" + Admin boleh mengubah (23 Okt 2026, keputusan user untuk tampilan admin baru).
-- (A) ubah_kendala dapat parameter p_admin: Admin Produksi (konvensi aplikasi) boleh mengubah kendala SIAPA PUN yang
--     belum selesai & belum dihapus, kapan saja. Operator tetap: hanya miliknya di hari yang sama (WIB). Log 'ubah'
--     tetap menyimpan isi sebelum/sesudah + nama pengubah (Riwayat menampilkan "diubah oleh ...").
--     Fungsi lama (3 parameter) DI-DROP lalu dibuat versi 4 parameter (p_admin default false) - kalau dibiarkan dua-duanya,
--     panggilan 3 parameter dari aplikasi jadi ambigu. Pemanggilan aplikasi operator (3 parameter) tetap berjalan.
-- (B) Teks K21 di kesehatan_cek disamakan ke istilah "Selesai" (kolom DB tetap teratasi_*).
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja). Harap: 1 baris 'ubah_kendala(bigint,text,text)'; K21 nama lama "...belum teratasi...".
select p.oid::regprocedure as fungsi_sekarang from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'ubah_kendala';
select kode, nama, penjelasan from public.kesehatan_cek where kode = 'K21';

-- (1) EKSEKUSI
begin;
drop function if exists public.ubah_kendala(bigint, text, text);
create or replace function public.ubah_kendala(p_id bigint, p_teks text, p_oleh text, p_admin boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama wajib'; end if;
  select * into v_lama from public.kendala_produksi where id = p_id for update;
  if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
  if v_lama.teratasi_pada is not null then raise exception 'Kendala sudah selesai - buka kembali dulu bila perlu diubah'; end if;
  if not coalesce(p_admin, false) then
    if v_lama.pencatat is distinct from btrim(p_oleh) then raise exception 'Hanya pencatat yang boleh mengubah'; end if;
    if v_lama.tanggal <> (now() at time zone 'Asia/Jakarta')::date then raise exception 'Kendala sudah terkunci (hanya bisa diubah di hari yang sama)'; end if;
  end if;
  update public.kendala_produksi set teks = btrim(p_teks), diubah_pada = now() where id = p_id returning * into v_baru;
  insert into public.kendala_produksi_log (kendala_id, aksi, oleh, alasan, sebelum, sesudah)
  values (p_id, 'ubah', btrim(p_oleh), case when coalesce(p_admin, false) then 'diubah Admin Produksi' end, to_jsonb(v_lama), to_jsonb(v_baru));
  return to_jsonb(v_baru);
end $$;
revoke all on function public.ubah_kendala(bigint, text, text, boolean) from public;
grant execute on function public.ubah_kendala(bigint, text, text, boolean) to anon, authenticated;

update public.kesehatan_cek set
  nama = 'Kendala belum selesai lebih dari 7 hari',
  penjelasan = 'Kendala produksi yang dicatat lebih dari 7 hari lalu dan belum ditandai Selesai oleh Admin Produksi.',
  apa_terjadi = $t$Ada kendala yang tercatat lebih dari seminggu dan masih berstatus belum selesai.$t$,
  penyebab_umum = $t$Kendala sebenarnya sudah beres tetapi lupa ditandai Selesai; atau kendala memang belum ada jalan keluarnya (menunggu material, gambar, informasi customer).$t$,
  langkah = array[
    $t$Buka menu Kendala di Vista Teknik, tab "Belum selesai".$t$,
    $t$Tanyakan ke pencatat / kepala bagian apakah kendala itu sudah beres.$t$,
    $t$Sudah beres: klik lingkaran centang (Selesai). Belum: tindak lanjuti (biarkan terbuka sampai beres).$t$]
 where kode = 'K21';
update public.kesehatan_cek set
  langkah = array[
    $t$Lihat proyek, panel, dan teks kendala di contoh baris.$t$,
    $t$Bila sudah tidak relevan: tandai Selesai atau hapus (Admin Produksi) di menu Kendala.$t$]
 where kode = 'K22';
commit;

-- (2) VERIFIKASI
--  a. hanya SATU fungsi ubah_kendala, 4 parameter (harap 1 baris ...boolean)
select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ubah_kendala';
--  b. teks K21 baru
select kode, nama from public.kesehatan_cek where kode in ('K21', 'K22') order by kode;
--  c. uji di transaksi yang DIBATALKAN: operator lain ditolak, admin boleh, kendala selesai ditolak. Harap: TIDAK ada error
--     (SQL Editor hanya menampilkan hasil perintah terakhir; kegagalan muncul sebagai error 'SALAH: ...'). Tidak meninggalkan data.
begin;
do $$
declare v jsonb; v_id bigint; v_proyek text;
begin
  select proyek into v_proyek from public.work_orders where deleted_at is null and coalesce(is_archived, false) = false order by id desc limit 1;
  v := public.catat_kendala(v_proyek, null, 'uji ubah admin', 'PENCATAT UJI', 'mekanik', 'operator'); v_id := (v->>'id')::bigint;
  v := public.ubah_kendala(v_id, 'uji ubah sendiri', 'PENCATAT UJI');               -- 3 parameter (aplikasi operator)
  begin perform public.ubah_kendala(v_id, 'oleh orang lain', 'ORANG LAIN'); raise exception 'SALAH: operator lain bisa mengubah';
  exception when others then if sqlerrm like 'SALAH%' then raise; end if; end;
  v := public.ubah_kendala(v_id, 'uji ubah oleh admin', 'ADMIN UJI', true);
  if (select oleh from public.kendala_produksi_log where kendala_id = v_id and aksi = 'ubah' order by id desc limit 1) <> 'ADMIN UJI' then raise exception 'SALAH: log ubah tidak mencatat admin'; end if;
  v := public.tandai_kendala_teratasi(v_id, 'ADMIN UJI');
  begin perform public.ubah_kendala(v_id, 'ubah sesudah selesai', 'ADMIN UJI', true); raise exception 'SALAH: kendala selesai bisa diubah';
  exception when others then if sqlerrm like 'SALAH%' then raise; end if; end;
  raise notice 'UJI LULUS';
end $$;
rollback;

-- (3) ROLLBACK (kembali ke versi 3 parameter & teks K21/K22 lama):
-- begin;
-- drop function if exists public.ubah_kendala(bigint, text, text, boolean);
-- create or replace function public.ubah_kendala(p_id bigint, p_teks text, p_oleh text)
-- returns jsonb language plpgsql security definer set search_path = public as $$
-- declare v_lama public.kendala_produksi; v_baru public.kendala_produksi;
-- begin
--   select * into v_lama from public.kendala_produksi where id = p_id for update;
--   if not found or v_lama.dihapus_pada is not null then raise exception 'Kendala tidak ditemukan'; end if;
--   if v_lama.pencatat is distinct from btrim(p_oleh) then raise exception 'Hanya pencatat yang boleh mengubah'; end if;
--   if v_lama.tanggal <> (now() at time zone 'Asia/Jakarta')::date then raise exception 'Kendala sudah terkunci (hanya bisa diubah di hari yang sama)'; end if;
--   if v_lama.teratasi_pada is not null then raise exception 'Kendala sudah ditandai teratasi'; end if;
--   update public.kendala_produksi set teks = btrim(p_teks), diubah_pada = now() where id = p_id returning * into v_baru;
--   insert into public.kendala_produksi_log (kendala_id, aksi, oleh, sebelum, sesudah) values (p_id, 'ubah', btrim(p_oleh), to_jsonb(v_lama), to_jsonb(v_baru));
--   return to_jsonb(v_baru);
-- end $$;
-- revoke all on function public.ubah_kendala(bigint, text, text) from public;
-- grant execute on function public.ubah_kendala(bigint, text, text) to anon, authenticated;
-- update public.kesehatan_cek set nama = 'Kendala belum teratasi lebih dari 7 hari',
--   penjelasan = 'Kendala produksi yang dicatat lebih dari 7 hari lalu dan belum ditandai Teratasi oleh Admin Produksi.',
--   apa_terjadi = $t$Ada kendala yang tercatat lebih dari seminggu dan masih berstatus belum teratasi.$t$,
--   penyebab_umum = $t$Kendala sebenarnya sudah selesai tetapi lupa ditandai Teratasi; atau kendala memang belum ada jalan keluarnya (menunggu material, gambar, informasi customer).$t$,
--   langkah = array[$t$Buka menu Kendala di Vista Teknik, centang "Hanya yang belum teratasi".$t$,
--     $t$Tanyakan ke pencatat / kepala bagian apakah kendala itu sudah beres.$t$,
--     $t$Sudah beres: tekan Teratasi. Belum: tindak lanjuti (biarkan terbuka sampai beres).$t$]
--  where kode = 'K21';
-- update public.kesehatan_cek set langkah = array[$t$Lihat proyek, panel, dan teks kendala di contoh baris.$t$,
--     $t$Bila sudah tidak relevan: tandai Teratasi atau hapus (Admin Produksi) di menu Kendala.$t$] where kode = 'K22';
-- commit;
