-- =====================================================================
-- Perbaikan 21 Okt 2026: komponen yang SUDAH 100% (selesai 20 Okt) ikut dipindah oleh
-- rebalance "Atur Kapasitas" (setOverrideAndRebalance, 20 Okt 20:48-20:53 WIB) ke 21/22 Okt,
-- sehingga terbit ulang di renhar & HP operator. Kembalikan ke tanggal selesainya (20 Okt).
-- Jalankan PER BAGIAN di SQL Editor. Bagian 1 dan 4 hanya baca.
-- =====================================================================

-- BAGIAN 0: daftar target + cadangan
create table if not exists public._fix_rebalance_20261021(
  raw_id bigint, panel_id bigint, proses text, wp text, kode text, dari text, ke text);
alter table public._fix_rebalance_20261021 enable row level security;
truncate public._fix_rebalance_20261021;
insert into public._fix_rebalance_20261021 values
 (7197,531,'POTONG','WP1','FS.10','2026-10-21','2026-10-20'),
 (7199,531,'STEL','WP1','FS.10','2026-10-21','2026-10-20'),
 (7200,531,'FINISHING','WP1','FS.10','2026-10-21','2026-10-20'),
 (7226,526,'FINISHING','WP1','FS.10','2026-10-21','2026-10-20'),
 (7251,529,'STEL','WP1','FS.10','2026-10-21','2026-10-20'),
 (7264,528,'STEL','WP1','FS.10','2026-10-21','2026-10-20'),
 (7265,528,'FINISHING','WP1','FS.10','2026-10-21','2026-10-20'),
 (7347,547,'STEL','WP2','FS.13','2026-10-21','2026-10-20'),
 (7212,532,'STEL','WP2','WM.4','2026-10-22','2026-10-20'),
 (7225,526,'STEL','WP1','FS.10','2026-10-22','2026-10-20'),
 (7348,547,'FINISHING','WP1','FS.1','2026-10-22','2026-10-20');

create table if not exists public._bak_raw_schedule_20261021 as
  select id, schedule, now() as dibackup from public.raw_schedule
  where id in (select raw_id from public._fix_rebalance_20261021);
alter table public._bak_raw_schedule_20261021 enable row level security;
select count(*) as jumlah_backup from public._bak_raw_schedule_20261021;  -- harus 11

-- BAGIAN 1: DRY-RUN (baca saja). Harapan: 11 baris, progress=100, entri_dari berisi kode,
-- entri_ke_wp null kecuali 7348 (WP1 FS.5/FS.8/FS.10), ada_di_renhar_ke = true.
select f.raw_id, f.proses, f.wp, f.kode, f.dari, f.ke,
  p.checklist->f.kode->'progress'->>f.proses               as progress,
  p.checklist->f.kode->'progressByDate'->f.proses          as progress_by_date,
  (select e from jsonb_array_elements(coalesce(r.schedule->f.dari,'[]')) e where e->>'wp'=f.wp) as entri_dari,
  (select e from jsonb_array_elements(coalesce(r.schedule->f.ke,'[]'))   e where e->>'wp'=f.wp) as entri_ke_wp,
  exists(select 1 from public.renhar h where h.raw_id=f.raw_id and h.tanggal::text=f.ke and to_jsonb(h.komponen) ? f.kode) as ada_di_renhar_ke
from public._fix_rebalance_20261021 f
join public.raw_schedule r on r.id=f.raw_id
join public.panels p on p.id=f.panel_id
order by f.dari, f.raw_id;

-- BAGIAN 2: EKSEKUSI (satu transaksi; baris yang tidak lolos guard dilewati + NOTICE)
do $$
declare f record; s jsonb; arr jsonb; n int := 0;
begin
  for f in select * from public._fix_rebalance_20261021 order by raw_id loop
    select schedule into s from public.raw_schedule where id=f.raw_id for update;
    if not exists(select 1 from jsonb_array_elements(coalesce(s->f.dari,'[]')) e
                  where e->>'wp'=f.wp and e->'komponen' ? f.kode
                    and not coalesce(e->'digeserKe' ? f.kode,false)) then
      raise notice 'LEWATI raw % % % %: tidak live lagi di %', f.raw_id,f.proses,f.wp,f.kode,f.dari; continue;
    end if;
    if coalesce((select (checklist->f.kode->'progress'->>f.proses)::numeric from public.panels where id=f.panel_id),0) < 100 then
      raise notice 'LEWATI raw % % %: progress < 100', f.raw_id,f.proses,f.kode; continue;
    end if;
    -- buang kode dari entri WP di tanggal 'dari' (entri kosong dibuang, tanggal kosong dihapus)
    select coalesce(jsonb_agg(x order by i),'[]'::jsonb) into arr from (
      select i, case when e->>'wp'=f.wp then
               jsonb_set(e #- array['orangPerKomponen',f.kode], '{komponen}',
                 coalesce((select jsonb_agg(k order by j) from jsonb_array_elements(e->'komponen') with ordinality kk(k,j)
                           where k #>> '{}' <> f.kode),'[]'::jsonb))
             else e end as x
      from jsonb_array_elements(s->f.dari) with ordinality t(e,i)) q
    where jsonb_array_length(x->'komponen')>0;
    if jsonb_array_length(arr)=0 then s := s - f.dari; else s := jsonb_set(s, array[f.dari], arr); end if;
    -- tambahkan ke entri WP di tanggal 'ke' (buat entri baru kalau WP belum ada)
    arr := coalesce(s->f.ke,'[]'::jsonb);
    if exists(select 1 from jsonb_array_elements(arr) e where e->>'wp'=f.wp) then
      select jsonb_agg(case when e->>'wp'=f.wp and not (e->'komponen' ? f.kode)
                         then jsonb_set(e,'{komponen}', coalesce(e->'komponen','[]'::jsonb) || to_jsonb(f.kode))
                         else e end order by i)
        into arr from jsonb_array_elements(arr) with ordinality t(e,i);
    else
      arr := arr || jsonb_build_array(jsonb_build_object('wp',f.wp,'komponen',jsonb_build_array(f.kode)));
    end if;
    s := jsonb_set(s, array[f.ke], arr, true);
    update public.raw_schedule set schedule=s where id=f.raw_id;
    n := n+1;
  end loop;
  insert into public.activity_log(user_name,action,description,module)
  values('Perbaikan data (SQL)','PERBAIKAN JADWAL',
         'Kembalikan '||n||' komponen 100% yang terbawa rebalance Atur Kapasitas 20 Okt ke tanggal selesai (2026-10-20)','raw');
  raise notice 'selesai: % baris diubah', n;
end $$;

-- BAGIAN 3: VERIFIKASI (baca saja). Harapan: semua baris masih_di_dari=false, sudah_di_ke=true.
select f.raw_id, f.proses, f.kode,
  exists(select 1 from jsonb_array_elements(coalesce(r.schedule->f.dari,'[]')) e where e->>'wp'=f.wp and e->'komponen' ? f.kode) as masih_di_dari,
  exists(select 1 from jsonb_array_elements(coalesce(r.schedule->f.ke,'[]'))   e where e->>'wp'=f.wp and e->'komponen' ? f.kode) as sudah_di_ke
from public._fix_rebalance_20261021 f join public.raw_schedule r on r.id=f.raw_id
order by f.raw_id;
-- Pastikan entri lain di baris yang sama tidak berubah (hanya tanggal 'dari' & 'ke' yang beda):
select r.id, array_agg(k order by k) as tanggal_berubah
from public.raw_schedule r join public._bak_raw_schedule_20261021 b on b.id=r.id,
     lateral (select key as k from jsonb_each(r.schedule) union select key from jsonb_each(b.schedule)) kk
where (r.schedule->kk.k) is distinct from (b.schedule->kk.k)
group by r.id order by r.id;

-- BAGIAN 4: ROLLBACK (HANYA kalau perlu). PERINGATAN: menimpa SELURUH schedule 11 baris
-- dengan cadangan - perubahan planner sesudah backup di baris itu ikut hilang. Cek dulu:
-- select r.id from public.raw_schedule r join public._bak_raw_schedule_20261021 b on b.id=r.id;
-- update public.raw_schedule r set schedule=b.schedule
--   from public._bak_raw_schedule_20261021 b where r.id=b.id;

-- BAGIAN 5: bersih-bersih (setelah yakin, mis. 1 minggu):
-- drop table public._fix_rebalance_20261021; drop table public._bak_raw_schedule_20261021;
