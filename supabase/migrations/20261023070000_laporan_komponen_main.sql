-- ============================================================================================
-- PENANDA KOMPONEN MAIN / PRINTILAN UNTUK LAPORAN OUTSTANDING (23 Okt 2026, keputusan user).
--  - Kunci (jenis_panel, kode_komponen) = (bom_master.tipe_panel, bom_master.kode_komponen). Kode saja TIDAK unik
--    lintas jenis (mis. WM.3 = "Box (include ambang)" di WM_MS tetapi "Pintu" di WM_POLY; FS_SS memakai FS.1-FS.36).
--  - Komponen yang TIDAK ada di tabel ini dianggap MAIN (default aman) - komponen BOM baru otomatis main.
--  - Dipakai HANYA oleh Laporan Outstanding (lib/laporanOutstanding turunkanPekerjaanPanel). Tidak mengubah progres,
--    overall, Rencana Harian, Raw Schedule, timer, aplikasi operator.
--  - Baca: anon (RLS select). Tulis: HANYA lewat RPC atur_komponen_main (jejak awet di laporan_komponen_main_log).
--    Konvensi aplikasi (tanpa Supabase Auth), sama seperti RPC kendala.
--  - Import: 182 baris dari bom_master; 55 PRINTILAN sesuai daftar user (sisanya 127 MAIN).
-- Jalankan per blok: (0) dry-run -> (1) buat tabel+RPC -> (2) import (satu perintah) -> (3) verifikasi. Rollback di (4).
-- ============================================================================================

-- (0) DRY-RUN (baca saja) - SATU baris hasil. Harap: tabel_sudah_ada=false, bom_baris=182, bom_unik=182,
--     printilan_daftar=55, printilan_cocok_bom=55, akan_main=127, akan_printilan=55, wp_tanpa_main=0.
with printilan(jenis_panel, kode_komponen) as (values
  ('BOX_KOSONG WM','BOX_KOSONG WM.6'),
  ('F3B','F3B.8'),('F3B','F3B.9'),('F3B','F3B.11'),('F3B','F3B.16'),('F3B','F3B.17'),('F3B','F3B.18'),('F3B','F3B.19'),('F3B','F3B.20'),
  ('F3B','F3B.23'),('F3B','F3B.25'),('F3B','F3B.26'),('F3B','F3B.27'),('F3B','F3B.28'),('F3B','F3B.33'),('F3B','F3B.38'),
  ('FS','FS.6'),('FS','FS.7'),('FS','FS.9'),('FS','FS.14'),('FS','FS.15'),('FS','FS.16'),('FS','FS.17'),('FS','FS.18'),('FS','FS.21'),('FS','FS.36'),
  ('FS_SS','FS.6'),('FS_SS','FS.7'),('FS_SS','FS.9'),('FS_SS','FS.14'),('FS_SS','FS.15'),('FS_SS','FS.16'),('FS_SS','FS.17'),('FS_SS','FS.18'),
  ('FS_SS','FS.21'),('FS_SS','FS.23'),('FS_SS','FS.24'),('FS_SS','FS.25'),('FS_SS','FS.26'),('FS_SS','FS.32'),('FS_SS','FS.36'),
  ('OU_FS','OU_FS.5'),('OU_FS','OU_FS.6'),('OU_FS','OU_FS.7'),('OU_FS','OU_FS.10'),('OU_FS','OU_FS.13'),('OU_FS','OU_FS.14'),('OU_FS','OU_FS.16'),
  ('OU_WM.MS','OU_WM.MS.8'),('OU_WM.MS','OU_WM.MS.9'),
  ('WM_MS','WM.6'),('WM_MS','WM.11'),
  ('WM_POLY','WM.8'),
  ('WM_SS','WM_SS.6'),('WM_SS','WM_SS.11')
), bom as (
  select tipe_panel as jenis_panel, kode_komponen, wp,
         exists (select 1 from printilan p where p.jenis_panel = b.tipe_panel and p.kode_komponen = b.kode_komponen) as printilan
    from public.bom_master b
)
select to_regclass('public.laporan_komponen_main') is not null as tabel_sudah_ada,
       (select count(*) from public.bom_master) as bom_baris,
       (select count(distinct (tipe_panel, kode_komponen)) from public.bom_master) as bom_unik,
       (select count(*) from printilan) as printilan_daftar,
       (select count(*) from printilan p where exists (select 1 from public.bom_master b where b.tipe_panel = p.jenis_panel and b.kode_komponen = p.kode_komponen)) as printilan_cocok_bom,
       (select count(*) from bom where not printilan) as akan_main,
       (select count(*) from bom where printilan) as akan_printilan,
       (select count(*) from (select jenis_panel, wp from bom group by jenis_panel, wp having bool_and(printilan)) x) as wp_tanpa_main;

-- (1) EKSEKUSI - tabel, log, RLS, RPC.
begin;
create table public.laporan_komponen_main (
  jenis_panel   text not null,
  kode_komponen text not null,
  is_main       boolean not null,
  diubah_oleh   text,
  diubah_pada   timestamptz not null default now(),
  primary key (jenis_panel, kode_komponen)
);
create table public.laporan_komponen_main_log (
  id            bigint generated always as identity primary key,
  jenis_panel   text not null,
  kode_komponen text not null,
  is_main_lama  boolean,          -- null = sebelumnya tidak ada baris (default MAIN)
  is_main_baru  boolean not null,
  oleh          text not null,
  alasan        text,
  waktu         timestamptz not null default now()
);
create index laporan_komponen_main_log_kunci on public.laporan_komponen_main_log (jenis_panel, kode_komponen, waktu desc);
alter table public.laporan_komponen_main enable row level security;
alter table public.laporan_komponen_main_log enable row level security;
create policy baca_laporan_komponen_main on public.laporan_komponen_main for select to anon, authenticated using (true);
create policy baca_laporan_komponen_main_log on public.laporan_komponen_main_log for select to anon, authenticated using (true);
-- tanpa policy insert/update/delete: tulis HANYA lewat RPC di bawah.

-- Ubah penanda satu komponen. Ditolak bila (jenis, kode) tidak ada di bom_master. Tanpa perubahan -> tidak dicatat.
create or replace function public.atur_komponen_main(p_jenis_panel text, p_kode_komponen text, p_is_main boolean, p_oleh text, p_alasan text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lama boolean; v_baru public.laporan_komponen_main;
begin
  if coalesce(btrim(p_oleh), '') = '' then raise exception 'Nama pengubah wajib diisi'; end if;
  if p_is_main is null then raise exception 'Nilai main/printilan wajib diisi'; end if;
  if not exists (select 1 from public.bom_master where tipe_panel = p_jenis_panel and kode_komponen = p_kode_komponen) then
    raise exception 'Komponen % tidak ada di BOM jenis panel %', p_kode_komponen, p_jenis_panel;
  end if;
  select is_main into v_lama from public.laporan_komponen_main where jenis_panel = p_jenis_panel and kode_komponen = p_kode_komponen for update;
  if v_lama is not distinct from p_is_main then
    select * into v_baru from public.laporan_komponen_main where jenis_panel = p_jenis_panel and kode_komponen = p_kode_komponen;
    return to_jsonb(v_baru);
  end if;
  insert into public.laporan_komponen_main (jenis_panel, kode_komponen, is_main, diubah_oleh, diubah_pada)
  values (p_jenis_panel, p_kode_komponen, p_is_main, btrim(p_oleh), now())
  on conflict (jenis_panel, kode_komponen) do update set is_main = excluded.is_main, diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada
  returning * into v_baru;
  insert into public.laporan_komponen_main_log (jenis_panel, kode_komponen, is_main_lama, is_main_baru, oleh, alasan)
  values (p_jenis_panel, p_kode_komponen, v_lama, p_is_main, btrim(p_oleh), nullif(btrim(p_alasan), ''));
  return to_jsonb(v_baru);
end $$;
revoke all on function public.atur_komponen_main(text, text, boolean, text, text) from public;
grant execute on function public.atur_komponen_main(text, text, boolean, text, text) to anon, authenticated;
commit;

-- (2) IMPORT - SATU perintah (atomik; SQL Editor hanya menampilkan hasil perintah terakhir). Harap: dimasukkan=182,
--     main=127, printilan=55, log=182. Aman diulang: baris yang sudah ada dilewati (hasil 0).
with printilan(jenis_panel, kode_komponen) as (values
  ('BOX_KOSONG WM','BOX_KOSONG WM.6'),
  ('F3B','F3B.8'),('F3B','F3B.9'),('F3B','F3B.11'),('F3B','F3B.16'),('F3B','F3B.17'),('F3B','F3B.18'),('F3B','F3B.19'),('F3B','F3B.20'),
  ('F3B','F3B.23'),('F3B','F3B.25'),('F3B','F3B.26'),('F3B','F3B.27'),('F3B','F3B.28'),('F3B','F3B.33'),('F3B','F3B.38'),
  ('FS','FS.6'),('FS','FS.7'),('FS','FS.9'),('FS','FS.14'),('FS','FS.15'),('FS','FS.16'),('FS','FS.17'),('FS','FS.18'),('FS','FS.21'),('FS','FS.36'),
  ('FS_SS','FS.6'),('FS_SS','FS.7'),('FS_SS','FS.9'),('FS_SS','FS.14'),('FS_SS','FS.15'),('FS_SS','FS.16'),('FS_SS','FS.17'),('FS_SS','FS.18'),
  ('FS_SS','FS.21'),('FS_SS','FS.23'),('FS_SS','FS.24'),('FS_SS','FS.25'),('FS_SS','FS.26'),('FS_SS','FS.32'),('FS_SS','FS.36'),
  ('OU_FS','OU_FS.5'),('OU_FS','OU_FS.6'),('OU_FS','OU_FS.7'),('OU_FS','OU_FS.10'),('OU_FS','OU_FS.13'),('OU_FS','OU_FS.14'),('OU_FS','OU_FS.16'),
  ('OU_WM.MS','OU_WM.MS.8'),('OU_WM.MS','OU_WM.MS.9'),
  ('WM_MS','WM.6'),('WM_MS','WM.11'),
  ('WM_POLY','WM.8'),
  ('WM_SS','WM_SS.6'),('WM_SS','WM_SS.11')
), masuk as (
  insert into public.laporan_komponen_main (jenis_panel, kode_komponen, is_main, diubah_oleh)
  select b.tipe_panel, b.kode_komponen,
         not exists (select 1 from printilan p where p.jenis_panel = b.tipe_panel and p.kode_komponen = b.kode_komponen),
         'Admin (import pilihan main 23 Okt 2026)'
    from public.bom_master b
  on conflict (jenis_panel, kode_komponen) do nothing
  returning jenis_panel, kode_komponen, is_main
), log as (
  insert into public.laporan_komponen_main_log (jenis_panel, kode_komponen, is_main_lama, is_main_baru, oleh, alasan)
  select jenis_panel, kode_komponen, null, is_main, 'Admin (import pilihan main 23 Okt 2026)', 'import awal dari pilihan user (55 printilan)'
    from masuk
  returning id
)
select (select count(*) from masuk) as dimasukkan,
       (select count(*) from masuk where is_main) as main,
       (select count(*) from masuk where not is_main) as printilan,
       (select count(*) from log) as log;

-- (3) VERIFIKASI - harap satu baris: total=182, main=127, printilan=55, yatim_bom=0, bom_tanpa_penanda=0,
--     wp_tanpa_main=0, status='LULUS'.
select count(*) as total,
       count(*) filter (where is_main) as main,
       count(*) filter (where not is_main) as printilan,
       (select count(*) from public.laporan_komponen_main m where not exists (select 1 from public.bom_master b where b.tipe_panel = m.jenis_panel and b.kode_komponen = m.kode_komponen)) as yatim_bom,
       (select count(*) from public.bom_master b where not exists (select 1 from public.laporan_komponen_main m where m.jenis_panel = b.tipe_panel and m.kode_komponen = b.kode_komponen)) as bom_tanpa_penanda,
       (select count(*) from (select b.tipe_panel, b.wp from public.bom_master b
                               left join public.laporan_komponen_main m on m.jenis_panel = b.tipe_panel and m.kode_komponen = b.kode_komponen
                              group by b.tipe_panel, b.wp having bool_and(coalesce(m.is_main, true) = false)) x) as wp_tanpa_main,
       case when count(*) = 182 and count(*) filter (where not is_main) = 55 then 'LULUS' else 'PERIKSA' end as status
  from public.laporan_komponen_main;

-- (4) ROLLBACK (hapus semuanya; laporan kembali menganggap semua komponen MAIN):
-- begin;
-- drop function if exists public.atur_komponen_main(text, text, boolean, text, text);
-- drop table if exists public.laporan_komponen_main_log;
-- drop table if exists public.laporan_komponen_main;
-- commit;
