-- ============================================================================================
-- KESEHATAN DATA K19 "Qty item tidak sama dengan hasil koreksi terakhir" (22 Okt 2026, keputusan user)
-- Aturan qty efektif (lib/koreksiPermintaan.ts, kedua repo): qty efektif = permintaan_item.qty, yang SEHARUSNYA
-- sama dgn qty disetujui pada koreksi 'disetujui' TERAKHIR (qty_final; koreksi lama tanpa qty_final = qty_diusulkan).
-- Beda = ada jalur yang mengubah qty setelah koreksi tanpa catatan, atau admin mengubah qty final sebelum kolom
-- qty_final ada (kasus 1968 VINIL 8 BROWN: koreksi 297->0, qty item 3). Tingkat Peringatan, per jam.
-- Prasyarat: 20261022030000_koreksi_qty_final.sql. Pola lapisan sama dgn K16-K18: fungsi lapisan sekarang
-- di-rename _sql_cek_kesehatan_k1_k18, fungsi baru menangani K19 lalu mendelegasikan (K1-K18 tidak berubah).
-- Dry-run   : supabase/verifikasi/20261022040000_kesehatan_k19_dryrun.sql
-- Verifikasi: supabase/verifikasi/20261022040000_kesehatan_k19_verifikasi.sql (harus 'SEMUA LULUS')
-- Rollback  : supabase/rollback/20261022040000_kesehatan_k19_rollback.sql
-- ============================================================================================
begin;
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k18;

create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K19' then $q$
   with akhir as (
     select distinct on (k.permintaan_item_id) k.*
     from public.permintaan_item_koreksi k
     where k.status = 'disetujui'
     order by k.permintaan_item_id, k.diputuskan_at desc nulls last, k.id desc
   )
   select a.permintaan_item_id::text as ref, i.nama_komponen, i.qty as qty_item,
          coalesce(a.qty_final, a.qty_diusulkan) as qty_koreksi_terakhir, (a.qty_final is null) as qty_final_tidak_tercatat,
          a.qty_lama, a.qty_diusulkan, i.satuan, i.status as status_item, i.is_hutang,
          m.id as permintaan, m.wo_number, m.proyek, m.panel_nama, a.diajukan_oleh, a.disetujui_oleh, a.diputuskan_at,
          'peringatan' as tingkat
   from akhir a
   join public.permintaan_item i on i.id = a.permintaan_item_id
   join public.permintaan m on m.id = i.permintaan_id
   where i.qty is distinct from coalesce(a.qty_final, a.qty_diusulkan)
   order by a.diputuskan_at desc $q$
 else public._sql_cek_kesehatan_k1_k18(p_kode)
end
$f$;

insert into public.kesehatan_cek (kode, nama, kategori, penjelasan, frekuensi, ambang_peringatan, ambang_kritis, urutan,
  aplikasi, apa_terjadi, penyebab_umum, dampak_aplikasi, langkah) values
 ('K19', 'Qty permintaan beda dengan koreksi terakhir', 'Permintaan',
  'Item permintaan yang qty-nya tidak sama dengan qty disetujui pada koreksi terakhir (qty_final; koreksi lama: qty_diusulkan).', 'per_jam', 1, null, 62,
  array['Admin','Gudang'],
  $t$Ada item permintaan yang pernah dikoreksi (disetujui), tapi qty-nya sekarang berbeda dari hasil koreksi terakhir. Riwayat Gudang menampilkan kartu koreksi dengan angka X, sementara Rekap per Panel menjumlahkan angka lain.$t$,
  $t$Admin mengubah qty final di kotak persetujuan sebelum 22 Okt 2026 (angka itu dulu tidak disimpan), atau ada jalur lain yang menulis qty setelah koreksi.$t$,
  $t$Rekap per Panel / cetak rekap bisa menjumlahkan angka yang tidak sesuai koreksi; stok & pembukuan Gudang bisa selisih.$t$,
  array[
    $t$Lihat item & koreksinya di contoh baris (permintaan, WO, proyek, panel, siapa yang menyetujui).$t$,
    $t$Tanyakan ke penyetuju angka mana yang benar.$t$,
    $t$Kalau qty item yang salah: ajukan koreksi baru dari Riwayat Gudang. Kalau qty item yang benar: tekan "Tandai diketahui" dengan catatan.$t$])
on conflict (kode) do nothing;
commit;
