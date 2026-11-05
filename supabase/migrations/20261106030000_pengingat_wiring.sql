-- ============================================================================================
-- PENGINGAT WIRING (6 Nov 2026) - operator Wiring Control & Wiring Power diingatkan menyiapkan permintaan komponen ke gudang
-- saat groundplate / box control / pintu sudah masuk tahap akhir mekanik. Keputusan user:
--   panel biasa   : progres PAINTING pertama kali > 0 (timer tidak dipakai).
--   panel stainless (FS_SS, WM_SS, tidak punya PAINTING): FINISHING harus 100%.
--   penerima      : semua operator kedua divisi, tanda baca per orang; admin tidak menerima.
--   salah ketik   : pengingat tersembunyi selama progres kembali di bawah ambang.
-- HANYA MEMBACA panels/bom/work_orders lewat pg_cron tiap menit: tidak ada trigger di jalur simpan progres, tidak mengubah
-- progres/timer/jadwal. panels.updated_at tidak bergerak saat progres disimpan, jadi semua panel live dipindai (32 baris).
-- Dedup = unik panel+kode+jenis. Tanpa FK ke panels: arsip_panel menghapus baris panels, unarsip tidak boleh memicu ulang.
-- Daftar di HP: lib/pengingatWiring.ts vista-pekerja (baca view wiring_pengingat_v).
-- Satu file siap Run. Cek di bawah membatalkan seluruh transaksi bila hasilnya tidak sesuai. Rollback di paling bawah.
-- ============================================================================================
begin;

-- Komponen dicocokkan menurut NAMA di BOM (kode bisa bernomor ulang), BOM tidak diubah. tipe_panel null = semua jenis.
create table public.wiring_pengingat_aturan (
  id bigint generated always as identity primary key,
  tipe_panel text,
  nama_komponen text not null,
  label text not null,
  aktif boolean not null default true
);
create unique index wiring_pengingat_aturan_unik on public.wiring_pengingat_aturan (coalesce(tipe_panel, ''), nama_komponen);
insert into public.wiring_pengingat_aturan (nama_komponen, label) values
  ('Groundplate', 'Groundplate'), ('Groundplate Control', 'Groundplate'), ('Groundplate Omega', 'Groundplate'),
  ('Box Control', 'Box control'), ('Box (include ambang)', 'Box control'),
  ('Pintu', 'Pintu'), ('Pintu Dalam', 'Pintu');

create table public.wiring_pengingat (
  id bigint generated always as identity primary key,
  panel_id bigint not null,
  kode_komponen text not null,
  jenis text not null check (jenis in ('masuk_painting', 'selesai_finishing')),
  label text not null,
  nama_panel text not null,
  proyek text,
  penanda text,                                 -- "1 dari 2" bila nama panel kembar dalam satu proyek
  baseline boolean not null default false,      -- sudah lewat ambang sebelum fitur aktif: tidak pernah tampil
  dibuat_pada timestamptz not null default now(),
  unique (panel_id, kode_komponen, jenis)
);
create index wiring_pengingat_tampil on public.wiring_pengingat (id) where not baseline;

create table public.wiring_pengingat_dibaca (
  pengingat_id bigint not null references public.wiring_pengingat(id) on delete cascade,
  pekerja_id bigint not null,
  dibaca_pada timestamptz not null default now(),
  primary key (pengingat_id, pekerja_id)
);

alter table public.wiring_pengingat_aturan enable row level security;
alter table public.wiring_pengingat enable row level security;
alter table public.wiring_pengingat_dibaca enable row level security;
create policy baca_semua on public.wiring_pengingat_aturan for select to anon, authenticated using (true);
create policy baca_semua on public.wiring_pengingat for select to anon, authenticated using (true);
create policy baca_semua on public.wiring_pengingat_dibaca for select to anon, authenticated using (true);
-- Tanpa policy tulis: pengingat hanya dari pemindai, tanda baca hanya lewat wiring_pengingat_tandai.

create or replace function public.wiring_pengingat_pindai(p_baseline boolean default false)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  with panel_aktif as (
    select p.id, p.tipe, p.checklist, btrim(p.nama) as nama, w.proyek,
           p.tipe in ('FS_SS', 'WM_SS') as stainless,
           count(*) over (partition by w.proyek, btrim(p.nama)) as kembar,
           row_number() over (partition by w.proyek, btrim(p.nama) order by p.id) as urut
    from public.panels p
    join public.work_orders w on w.id = p.wo_id and coalesce(w.is_archived, false) = false and w.deleted_at is null
    where jsonb_typeof(p.checklist) = 'object'
  )
  insert into public.wiring_pengingat (panel_id, kode_komponen, jenis, label, nama_panel, proyek, penanda, baseline)
  select p.id, c.kode, case when p.stainless then 'selesai_finishing' else 'masuk_painting' end, a.label, p.nama,
         nullif(btrim(p.proyek), ''), case when p.kembar > 1 then p.urut || ' dari ' || p.kembar end, p_baseline
  from panel_aktif p
  cross join lateral jsonb_each(p.checklist) c(kode, isi)
  join public.bom_master b on b.tipe_panel = p.tipe and b.kode_komponen = c.kode
  join public.wiring_pengingat_aturan a on a.aktif and a.nama_komponen = btrim(b.nama_komponen)
       and (a.tipe_panel is null or a.tipe_panel = p.tipe)
  where jsonb_typeof(c.isi) = 'object'
    and public._angka_progres(c.isi->>'qty') > 0
    and case when p.stainless then public._angka_progres(c.isi->'progress'->>'FINISHING') >= 100
             else public._angka_progres(c.isi->'progress'->>'PAINTING') > 0 end
    and exists (select 1 from public.bom_proses_relevan r where r.tipe_panel = p.tipe and r.kode_komponen = c.kode
                and r.jenis_pekerjaan = case when p.stainless then 'FINISHING' else 'PAINTING' end)
    -- panel tanpa pekerjaan wiring (mis. BOX_KOSONG WM) tidak memicu
    and exists (select 1 from jsonb_each(p.checklist) k(kode, isi)
                join public.bom_proses_relevan r on r.tipe_panel = p.tipe and r.kode_komponen = k.kode
                     and r.jenis_pekerjaan in ('WIRING CONTROL', 'WIRING POWER')
                where jsonb_typeof(k.isi) = 'object' and public._angka_progres(k.isi->>'qty') > 0)
  on conflict (panel_id, kode_komponen, jenis) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.wiring_pengingat_pindai(boolean) from public, anon, authenticated;

-- Yang tampil: panel masih hidup, WO belum arsip, progres saat ini masih lewat ambang.
create view public.wiring_pengingat_v as
select g.id, g.panel_id, g.kode_komponen, g.jenis, g.label, g.nama_panel, g.proyek, g.penanda, g.dibuat_pada
from public.wiring_pengingat g
join public.panels p on p.id = g.panel_id
join public.work_orders w on w.id = p.wo_id and coalesce(w.is_archived, false) = false and w.deleted_at is null
where not g.baseline
  and case g.jenis when 'selesai_finishing' then public._angka_progres(p.checklist->g.kode_komponen->'progress'->>'FINISHING') >= 100
                   else public._angka_progres(p.checklist->g.kode_komponen->'progress'->>'PAINTING') > 0 end;
grant select on public.wiring_pengingat_v to anon, authenticated;

create or replace function public.wiring_pengingat_tandai(p_ids bigint[], p_aktor jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare a record; v_n int;
begin
  select * into a from public.inv_aktor(p_aktor);
  if a.peran <> 'operator' or a.divisi not in ('wiring_ctrl', 'wiring_pwr') then
    raise exception 'Hanya operator Wiring' using errcode = '42501';
  end if;
  insert into public.wiring_pengingat_dibaca (pengingat_id, pekerja_id)
  select g.id, a.pekerja_id from public.wiring_pengingat g where g.id = any(p_ids)
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public.wiring_pengingat_tandai(bigint[], jsonb) from public;
grant execute on function public.wiring_pengingat_tandai(bigint[], jsonb) to anon, authenticated;

-- Kondisi saat ini dicatat diam-diam supaya lonceng tidak banjir saat fitur aktif.
select public.wiring_pengingat_pindai(true);

do $$
declare n_base int; n_lagi int; n_view int;
begin
  select count(*) into n_base from public.wiring_pengingat where baseline;
  n_lagi := public.wiring_pengingat_pindai(false);
  select count(*) into n_view from public.wiring_pengingat_v;
  if n_base < 40 then raise exception 'Baseline terlalu sedikit (%), batal.', n_base; end if;
  if n_lagi <> 0 or n_view <> 0 then raise exception 'Pindai kedua % / view % harus 0, batal.', n_lagi, n_view; end if;
  raise notice 'SEMUA LULUS, baseline % baris', n_base;
end $$;

alter publication supabase_realtime add table public.wiring_pengingat;
select cron.schedule('wiring-pengingat-pindai', '* * * * *', $c$select public.wiring_pengingat_pindai(false)$c$);
commit;

select jobname, schedule, active from cron.job where jobname = 'wiring-pengingat-pindai'; -- harap 1 baris aktif

-- ROLLBACK:
-- select cron.unschedule('wiring-pengingat-pindai');
-- begin;
-- alter publication supabase_realtime drop table public.wiring_pengingat;
-- drop function public.wiring_pengingat_tandai(bigint[], jsonb);
-- drop view public.wiring_pengingat_v;
-- drop function public.wiring_pengingat_pindai(boolean);
-- drop table public.wiring_pengingat_dibaca;
-- drop table public.wiring_pengingat;
-- drop table public.wiring_pengingat_aturan;
-- commit;
