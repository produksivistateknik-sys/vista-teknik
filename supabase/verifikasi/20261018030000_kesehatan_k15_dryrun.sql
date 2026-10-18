-- DRY-RUN 20261018030000_kesehatan_k15 (jalankan SEBELUM migration; baca saja, transaksi di-ROLLBACK).
-- Hasil (1): jumlah & tingkat tiap cek K1-K14 dgn aturan SEKARANG pada data saat ini - simpan/screenshot utk dibandingkan
--            dgn hasil verifikasi sesudah migration.
-- Hasil (2): calon baris K15 (harus 9: #51-59, semua 'peringatan', penyebab 'data hilang, alur arsip lama').
-- Hasil (3): prasyarat.
begin;
create or replace function pg_temp.cek_lama(p_kode text) returns jsonb language plpgsql as $$
declare v_c record; v_sql text; v_jumlah int; v_sampel jsonb; v_status text;
begin
  select * into v_c from public.kesehatan_cek where kode = p_kode;
  v_sql := public._sql_cek_kesehatan(p_kode);
  execute 'with q as (' || v_sql || ') select (select count(*) from q)::int, (select coalesce(jsonb_agg(to_jsonb(s)), ''[]''::jsonb) from (select * from q limit 50) s)'
    into v_jumlah, v_sampel;
  v_status := case when v_c.ambang_kritis is not null and v_jumlah >= v_c.ambang_kritis then 'kritis'
                   when v_jumlah >= v_c.ambang_peringatan then 'peringatan'
                   when p_kode = 'K10' and v_jumlah > 0 then 'info'
                   else 'ok' end;
  if p_kode = 'K5' and exists (select 1 from jsonb_array_elements(v_sampel) e where e->>'tingkat' = 'kritis') then v_status := 'kritis'; end if;
  return jsonb_build_object('jumlah', v_jumlah, 'status', v_status);
exception when others then
  return jsonb_build_object('jumlah', null, 'status', 'error', 'pesan', sqlerrm);
end $$;

select c.kode, c.nama, (pg_temp.cek_lama(c.kode))->>'jumlah' as jumlah, (pg_temp.cek_lama(c.kode))->>'status' as tingkat
from public.kesehatan_cek c where c.aktif order by c.urutan;

select m.id as permintaan, m.jenis, m.divisi, m.created_at,
       case when m.created_at < timestamptz '2026-10-12 00:00:00+07' then 'data hilang, alur arsip lama' else 'rincian tidak tersimpan saat dikirim' end as penyebab,
       case when m.created_at > now() - interval '7 days' then 'kritis' else 'peringatan' end as tingkat
from public.permintaan m
where m.created_at < now() - interval '10 minutes' and not exists (select 1 from public.permintaan_item i where i.permintaan_id = m.id)
order by m.id;

select (select count(*) from public.kesehatan_cek where kode = 'K15') as k15_sudah_ada_harus_0,
       to_regclass('public.kesehatan_temuan_diketahui') is null as tabel_belum_ada_harus_true,
       (select count(*) from public.kesehatan_cek where kode = 'K14') as k14_ada_harus_1;
rollback;
