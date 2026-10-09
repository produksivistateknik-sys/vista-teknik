-- VERIFIKASI isi timer OU_FS dari FS + WM_MS/WM_POLY (SELECT saja; aman sebelum & sesudah migrasi).

-- A. Per sel (26): nilai OU_FS sekarang vs sumber. Sesudah migrasi: ou_fs_menit = sumber_menit, asal = 'diisi'.
with t(ou_kode, proses, src_tipe, src_kode, menit_harap) as (values
    ('OU_FS.1', 'BENDING', 'WM_MS', 'WM.3', 4),  -- Box (include ambang) BENDING: KOSONG -> 4 (= WM_MS WM.3)
    ('OU_FS.1', 'STEL', 'WM_MS', 'WM.3', 30),  -- Box (include ambang) STEL: KOSONG -> 30 (= WM_MS WM.3)
    ('OU_FS.3', 'BENDING', 'FS', 'FS.8', 2),  -- Dudukan ACB BENDING: KOSONG -> 2 (= FS FS.8)
    ('OU_FS.3', 'STEL', 'FS', 'FS.8', 5),  -- Dudukan ACB STEL: KOSONG -> 5 (= FS FS.8)
    ('OU_FS.3', 'FINISHING', 'FS', 'FS.8', 5),  -- Dudukan ACB FINISHING: KOSONG -> 5 (= FS FS.8)
    ('OU_FS.4', 'BENDING', 'FS', 'FS.4', 1),  -- Groundplate BENDING: KOSONG -> 1 (= FS FS.4)
    ('OU_FS.5', 'BENDING', 'FS', 'FS.7', 1),  -- Dudukan Lampu TL BENDING: KOSONG -> 1 (= FS FS.7)
    ('OU_FS.6', 'BENDING', 'FS', 'FS.6', 1),  -- Door Switch BENDING: KOSONG -> 1 (= FS FS.6)
    ('OU_FS.7', 'BENDING', 'FS', 'FS.9', 2),  -- Tulangan Support Busbar BENDING: KOSONG -> 2 (= FS FS.9)
    ('OU_FS.8', 'BENDING', 'FS', 'FS.3', 2),  -- Tulangan Tegak BENDING: KOSONG -> 2 (= FS FS.3)
    ('OU_FS.9', 'STEL', 'FS', 'FS.10', 30),  -- UNP STEL: KOSONG -> 30 (= FS FS.10)
    ('OU_FS.9', 'FINISHING', 'FS', 'FS.10', 30),  -- UNP FINISHING: KOSONG -> 30 (= FS FS.10)
    ('OU_FS.11', 'BENDING', 'WM_POLY', 'WM.5', 2),  -- Pintu Dalam BENDING: KOSONG -> 2 (= WM_POLY WM.5)
    ('OU_FS.12', 'BENDING', 'FS', 'FS.13', 4),  -- Pintu BENDING: KOSONG -> 4 (= FS FS.13)
    ('OU_FS.12', 'STEL', 'FS', 'FS.13', 30),  -- Pintu STEL: KOSONG -> 30 (= FS FS.13)
    ('OU_FS.12', 'FINISHING', 'FS', 'FS.13', 30),  -- Pintu FINISHING: KOSONG -> 30 (= FS FS.13)
    ('OU_FS.13', 'BENDING', 'FS', 'FS.14', 1),  -- Tulangan Pintu BENDING: KOSONG -> 1 (= FS FS.14)
    ('OU_FS.14', 'BENDING', 'WM_MS', 'WM.7', 1),  -- Tulangan Pintu Dalam BENDING: KOSONG -> 1 (= WM_MS WM.7)
    ('OU_FS.15', 'BENDING', 'FS', 'FS.22', 2),  -- Topi BENDING: KOSONG -> 2 (= FS FS.22)
    ('OU_FS.15', 'STEL', 'FS', 'FS.22', 20),  -- Topi STEL: KOSONG -> 20 (= FS FS.22)
    ('OU_FS.15', 'FINISHING', 'FS', 'FS.22', 10),  -- Topi FINISHING: KOSONG -> 10 (= FS FS.22)
    ('OU_FS.18', 'BENDING', 'FS', 'FS.28', 1),  -- Lantai Dasar BENDING: KOSONG -> 1 (= FS FS.28)
    ('OU_FS.19', 'BENDING', 'FS', 'FS.30', 2),  -- Tutup / Pintu Belakang BENDING: KOSONG -> 2 (= FS FS.30)
    ('OU_FS.19', 'STEL', 'FS', 'FS.30', 10),  -- Tutup / Pintu Belakang STEL: KOSONG -> 10 (= FS FS.30)
    ('OU_FS.19', 'FINISHING', 'FS', 'FS.30', 10),  -- Tutup / Pintu Belakang FINISHING: KOSONG -> 10 (= FS FS.30)
    ('OU_FS.22', 'BENDING', 'FS', 'FS.2', 2)   -- Tulangan Kedalaman BENDING: KOSONG -> 2 (= FS FS.2)
)
select t.ou_kode, o.nama_komponen, t.proses, t.src_tipe, t.src_kode, f.menit_per_pcs sumber_menit, p.menit_per_pcs ou_fs_menit,
       case when p.id is null then 'KOSONG' when p.keterangan like 'salin timer dari % (9 Okt 2026)' then 'diisi' else 'sudah ada sebelumnya' end asal
  from t
  left join public.bom_master o on o.tipe_panel = 'OU_FS' and o.kode_komponen = t.ou_kode
  left join public.fcs_process_time f on f.tipe_panel = t.src_tipe and f.kode_komponen = t.src_kode and f.jenis_pekerjaan = t.proses
  left join public.fcs_process_time p on p.tipe_panel = 'OU_FS' and p.kode_komponen = t.ou_kode and p.jenis_pekerjaan = t.proses
 order by t.ou_kode, t.proses;

-- B. Ringkasan OU_FS per proses (sebelum: POTONG 18 saja; sesudah: + 26 baris berpenanda)
select jenis_pekerjaan, count(*) total, count(*) filter (where keterangan like 'salin timer dari % (9 Okt 2026)') disalin
  from public.fcs_process_time where tipe_panel = 'OU_FS' group by 1 order by 1;

-- C. Tidak boleh ada: timer OU_FS dobel, timer OU_FS tanpa komponen BOM OU_FS (harus 0 baris)
select 'dobel' masalah, kode_komponen, jenis_pekerjaan from public.fcs_process_time where tipe_panel = 'OU_FS'
 group by 2, 3 having count(*) > 1
union all
select 'tanpa komponen BOM', p.kode_komponen, p.jenis_pekerjaan from public.fcs_process_time p
 where p.tipe_panel = 'OU_FS' and not exists (select 1 from public.bom_master b where b.tipe_panel = 'OU_FS' and b.kode_komponen = p.kode_komponen);

-- D. BOM OU_FS & timer sumber tidak tersentuh (harus: 19, 116, 3, 1, FS 84, WM_MS 23, WM_POLY 15)
select (select count(*) from public.bom_master where tipe_panel = 'OU_FS') bom,
       (select count(*) from public.bom_proses_relevan where tipe_panel = 'OU_FS') proses_relevan,
       (select count(*) from public.panel_wp_meta where tipe_panel = 'OU_FS') wp,
       (select count(*) from public.panel_type_meta where tipe_panel = 'OU_FS') jenis,
       (select count(*) from public.fcs_process_time where tipe_panel = 'FS') timer_fs,
       (select count(*) from public.fcs_process_time where tipe_panel = 'WM_MS') timer_wm_ms,
       (select count(*) from public.fcs_process_time where tipe_panel = 'WM_POLY') timer_wm_poly;
