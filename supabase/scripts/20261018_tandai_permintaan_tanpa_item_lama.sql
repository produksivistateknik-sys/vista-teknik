-- ============================================================================================
-- TANDAI 9 PERMINTAAN LAMA TANPA ITEM (#51-59) "diketahui" di Kesehatan Data K15 (18 Okt 2026, keputusan user C.6).
-- Jalankan SESUDAH migration 20261018030000 + verifikasi LULUS. Kepala permintaan TIDAK diubah/dihapus.
-- Bukti (investigasi 18 Okt): item terhapus alur Arsip Panel lama (hapus item -> hapus kepala gagal -> arsip) saat
-- MCC TR 4/5 (CJI) diarsip INDRA 28 Sep 16.21 WIB; tidak ada sumber pemulihan (backup reset Sept & dump DB tertua 4 Okt
-- sudah tanpa item, activity_log mulai 11 Okt).
-- BAGIAN 1 dry-run -> BAGIAN 2 eksekusi -> BAGIAN 3 rollback.
-- ============================================================================================

-- BAGIAN 1: DRY-RUN - harus 9 baris, semua item_ada 0 & sudah_ditandai false
select m.id, m.jenis, m.divisi, m.created_at,
       (select count(*) from public.permintaan_item i where i.permintaan_id = m.id) as item_ada,
       exists (select 1 from public.kesehatan_temuan_diketahui d where d.aktif and d.sasaran = 'temuan' and d.kode = 'K15' and d.ref = m.id::text) as sudah_ditandai
from public.permintaan m where m.id between 51 and 59 order by m.id;

-- BAGIAN 2: EKSEKUSI
begin;
do $$
declare v_id bigint; v_n int := 0;
begin
  for v_id in select m.id from public.permintaan m where m.id between 51 and 59
      and not exists (select 1 from public.permintaan_item i where i.permintaan_id = m.id)
      and not exists (select 1 from public.kesehatan_temuan_diketahui d where d.aktif and d.sasaran = 'temuan' and d.kode = 'K15' and d.ref = m.id::text)
      order by m.id loop
    perform public.tandai_kesehatan('temuan', 'K15', v_id::text, 'diketahui', 'data hilang 28 Sep, alur arsip lama (investigasi 18 Okt)', 'Admin (SQL)');
    v_n := v_n + 1;
  end loop;
  if v_n <> 9 then raise exception 'DIBATALKAN: yang akan ditandai % (harus 9) - jalankan BAGIAN 1', v_n; end if;
end $$;
select count(*) as ditandai_harus_9 from public.kesehatan_temuan_diketahui where aktif and sasaran = 'temuan' and kode = 'K15' and ref in ('51','52','53','54','55','56','57','58','59');
commit;
-- sesudahnya: halaman Kesehatan Data > Jalankan cek -> K15 harus Aman (0).

-- BAGIAN 3: ROLLBACK (buka lagi ke-9 tanda; riwayat tanda tetap tersimpan)
-- begin;
-- select public.buka_tanda_kesehatan(d.id, 'rollback penandaan 9 permintaan lama', 'Admin (SQL)')
-- from public.kesehatan_temuan_diketahui d where d.aktif and d.sasaran = 'temuan' and d.kode = 'K15' and d.ref in ('51','52','53','54','55','56','57','58','59');
-- commit;
