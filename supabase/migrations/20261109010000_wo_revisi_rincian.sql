-- 20261109010000_wo_revisi_rincian.sql - RINCIAN TERSTRUKTUR REVISI WO (tag jenis revisi di Manajemen WO), 9 Nov 2026.
-- Jalankan SEKALI di Supabase SQL Editor (Run). Berhasil = NOTICE "Verifikasi LULUS ...". Gagal di tengah = seluruh file batal.
-- Menumpang fitur penanda BARU/REVISI (20261024010000_wo_baru_revisi.sql, LIVE). Tidak mengubah work_orders/aturan WO.
-- 1. wo_revisi_log.rincian jsonb: array [{jenis, lama, baru, panel?}] - jenis: deadline|proyek|qty|panel_tambah|panel_hapus|gambar.
--    Baris lama (58 per 9 Nov) dibiarkan NULL: layar membaca kolom ringkas (format buatan aplikasi sendiri).
-- 2. catat_revisi_wo menerima p_rincian (default NULL). Fungsi 3 parameter DI-DROP lalu dibuat 4 parameter: kalau dua-duanya
--    ada, panggilan 3 argumen bernama menjadi ambigu (pelajaran ubah_kendala 23 Okt). HP/admin versi lama (3 argumen) tetap jalan.
begin;

do $$ begin
  if to_regclass('public.wo_revisi_log') is null or to_regprocedure('public.catat_revisi_wo(bigint,text,text)') is null
     and to_regprocedure('public.catat_revisi_wo(bigint,text,text,jsonb)') is null then
    raise exception 'fitur penanda WO (20261024010000) belum ada - batal';
  end if;
end $$;

alter table public.wo_revisi_log add column if not exists rincian jsonb;
alter table public.wo_revisi_log drop constraint if exists wo_revisi_log_rincian_array;
alter table public.wo_revisi_log add constraint wo_revisi_log_rincian_array check (rincian is null or jsonb_typeof(rincian) = 'array');

drop function if exists public.catat_revisi_wo(bigint, text, text);
create or replace function public.catat_revisi_wo(p_wo_id bigint, p_oleh text, p_ringkas text, p_rincian jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v timestamptz := clock_timestamp(); w public.work_orders;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi'; end if;
  if p_rincian is not null and jsonb_typeof(p_rincian) <> 'array' then raise exception 'p_rincian harus array'; end if;
  update public.work_orders set revisi_pada = v, revisi_oleh = btrim(p_oleh), revisi_ringkas = nullif(btrim(p_ringkas), '')
   where id = p_wo_id returning * into w;
  if w.id is null then raise exception 'WO % tidak ada', p_wo_id; end if;
  insert into public.wo_revisi_log (wo_id, wo, proyek, oleh, ringkas, rincian, waktu)
  values (w.id, w.wo, w.proyek, btrim(p_oleh), nullif(btrim(p_ringkas), ''), p_rincian, v);   -- waktu = revisi_pada (dulu now() sedikit lebih awal)
  insert into public.wo_dilihat_admin (wo_id, admin_nama, dilihat_pada) values (w.id, btrim(p_oleh), v + interval '1 millisecond')
  on conflict (wo_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
  return to_jsonb(w);
end $$;
grant execute on function public.catat_revisi_wo(bigint, text, text, jsonb) to anon, authenticated;

-- verifikasi: tulis lalu BATALKAN sendiri (VTUJI), tidak ada data uji tersisa
do $$
declare w bigint; n_lama int; r jsonb; adm text := 'UJI_VERIFIKASI';
begin
  if to_regprocedure('public.catat_revisi_wo(bigint,text,text)') is not null then raise exception 'CEK GAGAL: fungsi 3 parameter masih ada'; end if;
  select count(*) into n_lama from public.wo_revisi_log;
  select id into w from public.work_orders order by id limit 1;
  begin
    perform public.catat_revisi_wo(w, adm, 'deadline 2026-01-01 -> 2026-01-02');                       -- cara lama (3 argumen)
    perform public.catat_revisi_wo(w, adm, 'deadline 2026-01-02 -> 2026-01-03',
      '[{"jenis":"deadline","lama":"2026-01-02","baru":"2026-01-03"}]'::jsonb);
    select rincian into r from public.wo_revisi_log where wo_id = w and oleh = adm order by id desc limit 1;
    if r->0->>'jenis' <> 'deadline' then raise exception 'CEK GAGAL: rincian tidak tersimpan'; end if;
    begin perform public.catat_revisi_wo(w, adm, 'x', '{"bukan":"array"}'::jsonb); raise exception 'CEK GAGAL: rincian non-array diterima';
    exception when raise_exception then if sqlerrm like 'CEK GAGAL%' then raise; end if; end;
    raise exception 'uji selesai' using errcode = 'VTUJI';
  exception when sqlstate 'VTUJI' then null;
  end;
  if (select count(*) from public.wo_revisi_log) <> n_lama then raise exception 'CEK GAGAL: data uji tersisa'; end if;
  raise notice 'Verifikasi LULUS: kolom rincian ada, cara lama & baru jalan, data uji dibatalkan (% baris log tetap).', n_lama;
end $$;

commit;

-- ROLLBACK (rincian yang sudah tercatat hilang; layar kembali membaca kolom ringkas). Hapus tanda '-- ' lalu Run:
-- begin;
-- drop function if exists public.catat_revisi_wo(bigint, text, text, jsonb);
-- create or replace function public.catat_revisi_wo(p_wo_id bigint, p_oleh text, p_ringkas text)
-- returns jsonb language plpgsql security definer set search_path = public as $$
-- declare v timestamptz := clock_timestamp(); w public.work_orders;
-- begin
--   if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi'; end if;
--   update public.work_orders set revisi_pada = v, revisi_oleh = btrim(p_oleh), revisi_ringkas = nullif(btrim(p_ringkas), '')
--    where id = p_wo_id returning * into w;
--   if w.id is null then raise exception 'WO % tidak ada', p_wo_id; end if;
--   insert into public.wo_revisi_log (wo_id, wo, proyek, oleh, ringkas) values (w.id, w.wo, w.proyek, btrim(p_oleh), nullif(btrim(p_ringkas), ''));
--   insert into public.wo_dilihat_admin (wo_id, admin_nama, dilihat_pada) values (w.id, btrim(p_oleh), v + interval '1 millisecond')
--   on conflict (wo_id, admin_nama) do update set dilihat_pada = excluded.dilihat_pada;
--   return to_jsonb(w);
-- end $$;
-- grant execute on function public.catat_revisi_wo(bigint, text, text) to anon, authenticated;
-- alter table public.wo_revisi_log drop constraint if exists wo_revisi_log_rincian_array;
-- alter table public.wo_revisi_log drop column if exists rincian;
-- commit;
