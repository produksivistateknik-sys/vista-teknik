-- ============================================================================================
-- PENGINGAT WIRING - Groundplate FS_SS (6 Nov 2026). Groundplate di FS_SS tidak melewati FINISHING, jadi aturan stainless tidak
-- pernah memicu. Keputusan user: komponen ini memicu saat RAKIT di atas 0%, kalimat "sudah masuk rakit" (vista-pekerja
-- lib/pengingatWiring.ts). Komponen & jenis panel lain tidak berubah. Tetap hanya membaca panels.
-- Tidak perlu baseline: satu-satunya Groundplate FS_SS live (panel 525) masih RAKIT 0% saat file ini dibuat.
-- Satu file siap Run, cek di bawah membatalkan seluruh transaksi. Rollback di paling bawah.
-- ============================================================================================
begin;

alter table public.wiring_pengingat drop constraint wiring_pengingat_jenis_check;
alter table public.wiring_pengingat add constraint wiring_pengingat_jenis_check
  check (jenis in ('masuk_painting', 'selesai_finishing', 'masuk_rakit'));

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
  select p.id, c.kode, t.jenis, a.label, p.nama,
         nullif(btrim(p.proyek), ''), case when p.kembar > 1 then p.urut || ' dari ' || p.kembar end, p_baseline
  from panel_aktif p
  cross join lateral jsonb_each(p.checklist) c(kode, isi)
  join public.bom_master b on b.tipe_panel = p.tipe and b.kode_komponen = c.kode
  join public.wiring_pengingat_aturan a on a.aktif and a.nama_komponen = btrim(b.nama_komponen)
       and (a.tipe_panel is null or a.tipe_panel = p.tipe)
  cross join lateral (select * from (values
    (p.tipe = 'FS_SS' and a.nama_komponen = 'Groundplate', 'RAKIT', 'masuk_rakit'),
    (p.stainless and not (p.tipe = 'FS_SS' and a.nama_komponen = 'Groundplate'), 'FINISHING', 'selesai_finishing'),
    (not p.stainless, 'PAINTING', 'masuk_painting')) v(berlaku, proses, jenis) where v.berlaku) t
  where jsonb_typeof(c.isi) = 'object'
    and public._angka_progres(c.isi->>'qty') > 0
    and case when t.proses = 'FINISHING' then public._angka_progres(c.isi->'progress'->>t.proses) >= 100
             else public._angka_progres(c.isi->'progress'->>t.proses) > 0 end
    and exists (select 1 from public.bom_proses_relevan r where r.tipe_panel = p.tipe and r.kode_komponen = c.kode
                and r.jenis_pekerjaan = t.proses)
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

create or replace view public.wiring_pengingat_v as
select g.id, g.panel_id, g.kode_komponen, g.jenis, g.label, g.nama_panel, g.proyek, g.penanda, g.dibuat_pada
from public.wiring_pengingat g
join public.panels p on p.id = g.panel_id
join public.work_orders w on w.id = p.wo_id and coalesce(w.is_archived, false) = false and w.deleted_at is null
where not g.baseline
  and case g.jenis when 'selesai_finishing' then public._angka_progres(p.checklist->g.kode_komponen->'progress'->>'FINISHING') >= 100
                   when 'masuk_rakit' then public._angka_progres(p.checklist->g.kode_komponen->'progress'->>'RAKIT') > 0
                   else public._angka_progres(p.checklist->g.kode_komponen->'progress'->>'PAINTING') > 0 end;

do $$
declare n_baru int; n_dobel int;
begin
  n_baru := public.wiring_pengingat_pindai(false);
  select count(*) - count(distinct (panel_id, kode_komponen)) into n_dobel from public.wiring_pengingat;
  -- jenis lama tidak berubah: pemindaian ulang tidak boleh membuat baris kedua utk komponen yang sudah tercatat
  if n_dobel <> 0 then raise exception 'Ada % baris dobel per panel+komponen, batal.', n_dobel; end if;
  raise notice 'SEMUA LULUS, % pengingat baru dari pemindaian ini', n_baru;
end $$;
commit;

select jenis, count(*) from public.wiring_pengingat group by jenis order by jenis; -- harap masuk_painting 72+, selesai_finishing 1+

-- ROLLBACK: jalankan ulang isi fungsi & view dari 20261106030000_pengingat_wiring.sql, lalu:
-- delete from public.wiring_pengingat where jenis = 'masuk_rakit';
-- alter table public.wiring_pengingat drop constraint wiring_pengingat_jenis_check;
-- alter table public.wiring_pengingat add constraint wiring_pengingat_jenis_check check (jenis in ('masuk_painting', 'selesai_finishing'));
