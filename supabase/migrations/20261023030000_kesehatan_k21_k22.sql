-- ============================================================================================
-- KESEHATAN DATA K21 & K22 - kendala produksi (23 Okt 2026). Jalankan SESUDAH 20261023020000_kendala_produksi.sql.
--  K21 "Kendala belum teratasi lebih dari 7 hari" - pengingat Admin: kendala yang sudah beres tapi lupa ditandai
--      Teratasi (Laporan Outstanding jadi kotor) atau kendala yang memang macet lama. Batas 7 hari (keputusan user)
--      ada di SATU tempat: angka 7 di query K21 di bawah.
--  K22 "Kendala yatim" - panel_id yang tidak ada di panels maupun panels_archived (panel dihapus), atau proyek yang
--      tidak ada lagi di work_orders (WO dihapus). Datanya tetap ada (snapshot nama), cek ini supaya admin tahu.
-- Pola lapisan sama dgn K16-K20: fungsi sekarang di-rename _sql_cek_kesehatan_k1_k20; K1-K20 tidak berubah.
-- Jalankan per blok: (0) dry-run -> (1) eksekusi -> (2) verifikasi. Rollback di (3).
-- ============================================================================================

-- (0) DRY-RUN (baca saja): lapisan belum ada; tabel kendala_produksi sudah ada.
select case when to_regprocedure('public._sql_cek_kesehatan_k1_k20(text)') is not null then 'SUDAH ADA - jangan jalankan lagi' else 'ok, belum ada' end as lapisan_k1_k20,
       to_regclass('public.kendala_produksi') as tabel_kendala_harus_ada;

-- (1) EKSEKUSI
begin;
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k20;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K21' then $q$
   select k.id::text as ref, k.proyek, coalesce(k.panel_nama, 'Umum') as panel, k.teks, k.pencatat, k.tanggal,
          ((now() at time zone 'Asia/Jakarta')::date - k.tanggal) as umur_hari, 'peringatan' as tingkat
   from public.kendala_produksi k
   where k.teratasi_pada is null and k.dihapus_pada is null
     and k.tanggal < (now() at time zone 'Asia/Jakarta')::date - 7
   order by k.tanggal, k.id $q$
 when 'K22' then $q$
   select k.id::text as ref, k.proyek, coalesce(k.panel_nama, 'Umum') as panel, k.panel_id, k.teks, k.pencatat, k.tanggal,
          case when k.panel_id is not null and not exists (select 1 from public.panels p where p.id = k.panel_id)
                    and not exists (select 1 from public.panels_archived pa where pa.id = k.panel_id) then 'panel sudah dihapus'
               else 'proyek tidak ada lagi di Work Order' end as alasan,
          'peringatan' as tingkat
   from public.kendala_produksi k
   where k.dihapus_pada is null
     and ((k.panel_id is not null and not exists (select 1 from public.panels p where p.id = k.panel_id)
                                  and not exists (select 1 from public.panels_archived pa where pa.id = k.panel_id))
          or not exists (select 1 from public.work_orders w where w.proyek = k.proyek))
   order by k.id $q$
 else public._sql_cek_kesehatan_k1_k20(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K21', 'Kendala belum teratasi lebih dari 7 hari', 'Kendala',
  'Kendala produksi yang dicatat lebih dari 7 hari lalu dan belum ditandai Teratasi oleh Admin Produksi.', 'harian', 1, null, 64,
  array['Admin','Operator'],
  $t$Ada kendala yang tercatat lebih dari seminggu dan masih berstatus belum teratasi.$t$,
  $t$Kendala sebenarnya sudah selesai tetapi lupa ditandai Teratasi; atau kendala memang belum ada jalan keluarnya (menunggu material, gambar, informasi customer).$t$,
  $t$Laporan Outstanding tetap menampilkan kendala itu; jumlah kendala terbuka di menu Kendala terlihat lebih banyak dari kenyataan.$t$,
  array[
    $t$Buka menu Kendala di Vista Teknik, centang "Hanya yang belum teratasi".$t$,
    $t$Tanyakan ke pencatat / kepala bagian apakah kendala itu sudah beres.$t$,
    $t$Sudah beres: tekan Teratasi. Belum: tindak lanjuti (biarkan terbuka sampai beres).$t$]),
 ('K22', 'Kendala yatim (panel/proyek sudah dihapus)', 'Kendala',
  'Kendala produksi yang panelnya sudah dihapus (tidak ada di panel aktif maupun arsip) atau proyeknya tidak ada lagi di Work Order.', 'harian', 1, null, 65,
  array['Admin'],
  $t$Ada kendala yang menunjuk ke panel atau proyek yang sudah tidak ada. Isinya tetap tersimpan (nama proyek/panel ikut dicatat), tetapi tidak muncul di bawah panel mana pun.$t$,
  $t$Panel dihapus lewat Edit WO, atau Work Order dihapus, sesudah kendala dicatat.$t$,
  $t$Kendala itu tidak terlihat di rekap per panel; bila belum teratasi tetap ikut Laporan Outstanding tanpa panel yang jelas.$t$,
  array[
    $t$Lihat proyek, panel, dan teks kendala di contoh baris.$t$,
    $t$Bila sudah tidak relevan: tandai Teratasi atau hapus (Admin Produksi) di menu Kendala.$t$])
on conflict (kode) do nothing;
commit;

-- (2) VERIFIKASI - harus 'SEMUA LULUS'
do $$
declare k text; n int; gagal text[] := '{}';
begin
  foreach k in array array['K1','K5','K7','K8','K9','K10','K11','K12','K13','K14','K15','K16','K17','K18','K19','K20'] loop
    if public._sql_cek_kesehatan(k) is distinct from public._sql_cek_kesehatan_k1_k20(k) then gagal := gagal || ('query ' || k || ' berubah'); end if;
  end loop;
  foreach k in array array['K21','K22'] loop
    begin
      execute 'select count(*) from (' || public._sql_cek_kesehatan(k) || ') s' into n;
      raise notice '% sekarang: % baris', k, n;
    exception when others then gagal := gagal || (k || ' error: ' || sqlerrm);
    end;
    if not exists (select 1 from public.kesehatan_cek where kode = k and aktif) then gagal := gagal || ('baris kesehatan_cek ' || k || ' tidak ada'); end if;
  end loop;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS'; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;

-- (3) ROLLBACK:
-- begin;
-- delete from public.kesehatan_hasil where kode in ('K21','K22');
-- delete from public.kesehatan_temuan_diketahui where kode in ('K21','K22');
-- delete from public.kesehatan_cek where kode in ('K21','K22');
-- drop function public._sql_cek_kesehatan(text);
-- alter function public._sql_cek_kesehatan_k1_k20(text) rename to _sql_cek_kesehatan;
-- commit;
