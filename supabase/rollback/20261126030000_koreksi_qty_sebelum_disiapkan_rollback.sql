-- ROLLBACK Tahap 3 (koreksi sebelum disiapkan + K19 ketat). URUTAN: kembalikan aplikasi admin (vista-teknik) ke versi tanpa
-- tombol "Koreksi qty" DULU, baru jalankan ini. Riwayat koreksi admin yang sudah tercatat (sumber admin_sebelum_siap) DIBIARKAN.
-- Bila Tahap 3b (izinkan naik) sudah dijalankan, rollback Tahap 3b dulu.
begin;
do $$ begin
  if to_regprocedure('public._sql_cek_kesehatan_k1_k27(text)') is null then
    raise exception 'Lapisan _sql_cek_kesehatan_k1_k27 tidak ada - Tahap 3 belum dijalankan / sudah di-rollback - batal';
  end if;
end $$;
drop function if exists public.koreksi_qty_sebelum_disiapkan(bigint, numeric, numeric, text, text);
drop function public._sql_cek_kesehatan(text);
alter function public._sql_cek_kesehatan_k1_k27(text) rename to _sql_cek_kesehatan;
update public.kesehatan_cek
set penjelasan = 'Item permintaan yang qty-nya tidak sama dengan qty disetujui pada koreksi terakhir (qty_final; koreksi lama: qty_diusulkan).'
where kode = 'K19';
notify pgrst, 'reload schema';
commit;

-- Periksa: harus 0 baris & lapisan kembali
select p.oid::regprocedure from pg_proc p where p.proname in ('koreksi_qty_sebelum_disiapkan', '_sql_cek_kesehatan_k1_k27');
