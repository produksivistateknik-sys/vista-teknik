-- Hardening (10 Sep 2026): fungsi diagnostik read-only buat deteksi drift skema antara
-- tabel sumber dan *_archived pasangannya SEBELUM operator kena error "column X of relation
-- Y_archived does not exist" pas arsip panel.
--
-- Latar: RPC arsip_panel()/unarsip_panel() (helper arsip_pindah_tabel) membangun daftar
-- kolom INSERT dinamis dari information_schema.columns tabel SUMBER. Kalau tabel arsip
-- ketinggalan kolom -> arsip gagal runtime. Sudah 3x kejadian: busbar_jejak (Jul 2026),
-- bobot_komponen (Agu 2026), jumlah_cell (Sep 2026). Lihat supabase/ARSIP-SCHEMA-SYNC.md.
--
-- Pakai: SELECT * FROM public.cek_sync_skema_arsip();
--   arah='kurang_di_arsip'  -> BAHAYA, akan bikin arsip_panel() gagal. WAJIB di-ALTER.
--   arah='beda_tipe'        -> kolom ada di dua-duanya tapi tipe beda (mis. jsonb vs text).
--   arah='extra_di_arsip'   -> kolom cuma di arsip & bukan snapshot resmi (kemungkinan usang).
-- Idealnya query ini nol baris. Jalankan tiap habis migration yang add column ke tabel
-- sumber, dan bisa dipasang di CI (butuh service-role / DB access, bukan anon key).
--
-- Pasangan tabel dideteksi generik: setiap BASE TABLE `X` di schema public yang punya
-- `X_archived` juga -> otomatis ke-cover, termasuk pasangan baru di masa depan. Tabel
-- pola jsonb-blob (panel_seksi_archived tanpa sumber "panel_seksi"; fcs_arsip_wo tanpa
-- suffix _archived) otomatis TIDAK ke-scan - aman.

create or replace function public.cek_sync_skema_arsip()
returns table (
  tabel_sumber text,
  tabel_arsip  text,
  arah         text,
  kolom        text,
  detail       text
)
language sql
stable
security invoker
as $$
  with pasangan as (
    select t.table_name as src, t.table_name || '_archived' as arch
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and t.table_name not like '%\_archived'
      and exists (
        select 1 from information_schema.tables a
        where a.table_schema = 'public'
          and a.table_type = 'BASE TABLE'
          and a.table_name = t.table_name || '_archived'
      )
  ),
  kol_src as (
    select p.src, p.arch, col.column_name, col.data_type, col.udt_name
    from pasangan p
    join information_schema.columns col
      on col.table_schema = 'public' and col.table_name = p.src
  ),
  kol_arch as (
    select p.src, p.arch, col.column_name, col.data_type, col.udt_name
    from pasangan p
    join information_schema.columns col
      on col.table_schema = 'public' and col.table_name = p.arch
  ),
  arch_only_sah (column_name) as (
    values ('diarsipkan_pada'), ('diarsipkan_oleh'),
           ('progress_snapshot'), ('wo_number_snapshot'), ('proyek_snapshot')
  )
  select s.src, s.arch, 'kurang_di_arsip', s.column_name,
         'tipe di sumber: ' || s.data_type || ' (' || s.udt_name || ')'
  from kol_src s
  left join kol_arch a on a.src = s.src and a.column_name = s.column_name
  where a.column_name is null

  union all
  select a.src, a.arch, 'extra_di_arsip', a.column_name,
         'tipe di arsip: ' || a.data_type
  from kol_arch a
  left join kol_src s on s.src = a.src and s.column_name = a.column_name
  where s.column_name is null
    and a.column_name not in (select column_name from arch_only_sah)

  union all
  select s.src, s.arch, 'beda_tipe', s.column_name,
         'sumber=' || s.udt_name || '  arsip=' || a.udt_name
  from kol_src s
  join kol_arch a on a.src = s.src and a.column_name = s.column_name
  where s.udt_name is distinct from a.udt_name

  order by 3, 1, 4;
$$;

comment on function public.cek_sync_skema_arsip() is
  'Deteksi drift skema tabel sumber vs *_archived. arah=kurang_di_arsip -> akan bikin RPC arsip_panel() gagal, WAJIB di-ALTER. Idealnya nol baris. Jalankan tiap habis migration add-column & di CI. Lihat supabase/ARSIP-SCHEMA-SYNC.md.';
