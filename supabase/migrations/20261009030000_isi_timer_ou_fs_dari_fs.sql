-- ISI TIMER (fcs_process_time) OU_FS YANG KOSONG, DISALIN DARI JENIS LAIN (9 Okt 2026).
-- Sumber (keputusan user): FS untuk 22 sel + WM_MS/WM_POLY untuk 4 sel yang FS tidak punya.
--
-- Hasil investigasi (live, 9 Okt 2026, read-only):
-- - Timer = fcs_process_time per (tipe_panel, kode_komponen, jenis_pekerjaan) -> menit_per_pcs.
--   Di SEMUA jenis panel timer hanya pernah diisi utk POTONG / BENDING / STEL / FINISHING.
-- - OU_FS: 19 komponen BOM; timer yang ada = 18 baris, semuanya POTONG. Sel kosong (proses relevan
--   menurut bom_proses_relevan OU_FS, tanpa timer) = 43 di 4 proses itu.
-- - Kode OU_FS (OU_FS.n) TIDAK sama dgn kode jenis lain -> pasangan dicocokkan lewat NAMA komponen
--   (bom_master, persis sama setelah trim/huruf kecil). 13 dari 14 timer POTONG OU_FS yang sudah ada
--   nilainya SAMA PERSIS dgn FS.
-- - 26 dari 43 sel kosong diisi (daftar di bawah); 17 sel lain TETAP KOSONG (tidak ada sumber).
-- - TIDAK menimpa timer OU_FS yang sudah ada (NOT EXISTS per tipe+kode+proses). TIDAK menyentuh
--   bom_master / bom_proses_relevan / panel_wp_meta / panel_type_meta OU_FS (bug BOM belum tuntas),
--   tidak menyentuh timer jenis sumber.
-- - Baris baru diberi keterangan 'salin timer dari <JENIS> <KODE> (9 Okt 2026)' (kolom ini tidak
--   ditampilkan/diubah aplikasi, sebelumnya kosong di semua baris) -> rollback menghapus HANYA baris ini.
-- - Saat ini 0 panel OU_FS aktif -> tidak ada jadwal/kapasitas berjalan yang langsung berubah.
--
-- Nilai sebelum -> sesudah (OU_FS kode, nama, proses, menit/pcs, sumber):
--   OU_FS.1   Box (include ambang)     BENDING    KOSONG ->   4   (WM_MS WM.3)
--   OU_FS.1   Box (include ambang)     STEL       KOSONG ->  30   (WM_MS WM.3)
--   OU_FS.3   Dudukan ACB              BENDING    KOSONG ->   2   (FS FS.8)
--   OU_FS.3   Dudukan ACB              STEL       KOSONG ->   5   (FS FS.8)
--   OU_FS.3   Dudukan ACB              FINISHING  KOSONG ->   5   (FS FS.8)
--   OU_FS.4   Groundplate              BENDING    KOSONG ->   1   (FS FS.4)
--   OU_FS.5   Dudukan Lampu TL         BENDING    KOSONG ->   1   (FS FS.7)
--   OU_FS.6   Door Switch              BENDING    KOSONG ->   1   (FS FS.6)
--   OU_FS.7   Tulangan Support Busbar  BENDING    KOSONG ->   2   (FS FS.9)
--   OU_FS.8   Tulangan Tegak           BENDING    KOSONG ->   2   (FS FS.3)
--   OU_FS.9   UNP                      STEL       KOSONG ->  30   (FS FS.10)
--   OU_FS.9   UNP                      FINISHING  KOSONG ->  30   (FS FS.10)
--   OU_FS.11  Pintu Dalam              BENDING    KOSONG ->   2   (WM_POLY WM.5)
--   OU_FS.12  Pintu                    BENDING    KOSONG ->   4   (FS FS.13)
--   OU_FS.12  Pintu                    STEL       KOSONG ->  30   (FS FS.13)
--   OU_FS.12  Pintu                    FINISHING  KOSONG ->  30   (FS FS.13)
--   OU_FS.13  Tulangan Pintu           BENDING    KOSONG ->   1   (FS FS.14)
--   OU_FS.14  Tulangan Pintu Dalam     BENDING    KOSONG ->   1   (WM_MS WM.7)
--   OU_FS.15  Topi                     BENDING    KOSONG ->   2   (FS FS.22)
--   OU_FS.15  Topi                     STEL       KOSONG ->  20   (FS FS.22)
--   OU_FS.15  Topi                     FINISHING  KOSONG ->  10   (FS FS.22)
--   OU_FS.18  Lantai Dasar             BENDING    KOSONG ->   1   (FS FS.28)
--   OU_FS.19  Tutup / Pintu Belakang   BENDING    KOSONG ->   2   (FS FS.30)
--   OU_FS.19  Tutup / Pintu Belakang   STEL       KOSONG ->  10   (FS FS.30)
--   OU_FS.19  Tutup / Pintu Belakang   FINISHING  KOSONG ->  10   (FS FS.30)
--   OU_FS.22  Tulangan Kedalaman       BENDING    KOSONG ->   2   (FS FS.2)
--
-- Jalankan SEKALI di SQL Editor. 1 transaksi (1 blok DO): gagal di langkah mana pun = tidak ada yang
-- tersimpan. Dijalankan ulang -> berhenti dgn pesan (tidak menambah baris).
-- Verifikasi: supabase/verifikasi/20261009030000_isi_timer_ou_fs_verifikasi.sql
-- Rollback:   supabase/rollback/20261009030000_isi_timer_ou_fs_rollback.sql

begin;

do $$
declare
  v_n int; v_teks text; v_isi int; v_lewati int;
begin
  create temp table _timer_ou_fs (ou_kode text, proses text, src_tipe text, src_kode text, menit_harap numeric) on commit drop;
  insert into _timer_ou_fs values
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
  ;

  -- PRE-CHECK 1: belum pernah dijalankan
  if exists (select 1 from public.fcs_process_time where tipe_panel = 'OU_FS' and keterangan like 'salin timer dari % (9 Okt 2026)') then
    raise exception 'Timer OU_FS dari jenis lain SUDAH PERNAH diisi (ada baris berketerangan "salin timer dari ... (9 Okt 2026)") - dibatalkan, tidak ada yang diubah.';
  end if;

  -- PRE-CHECK 2: komponen OU_FS masih ada (dibaca saja, BOM tidak diubah) & nama masih sama dgn sumber
  select string_agg(t.ou_kode, ', ') into v_teks from _timer_ou_fs t
   where not exists (select 1 from public.bom_master b where b.tipe_panel = 'OU_FS' and b.kode_komponen = t.ou_kode);
  if v_teks is not null then
    raise exception 'Komponen OU_FS tidak ditemukan di bom_master: % - dibatalkan (BOM berubah sejak investigasi).', v_teks;
  end if;
  select string_agg(t.ou_kode || '<>' || t.src_tipe || ' ' || t.src_kode, ', ') into v_teks from _timer_ou_fs t
    join public.bom_master o on o.tipe_panel = 'OU_FS' and o.kode_komponen = t.ou_kode
    left join public.bom_master s on s.tipe_panel = t.src_tipe and s.kode_komponen = t.src_kode
   where s.id is null or lower(trim(o.nama_komponen)) <> lower(trim(s.nama_komponen));
  if v_teks is not null then
    raise exception 'Pasangan nama komponen OU_FS/sumber sudah tidak cocok: % - dibatalkan.', v_teks;
  end if;

  -- PRE-CHECK 3: nilai sumber masih sama dgn yang dilaporkan & tidak dobel
  select string_agg(format('%s %s %s: sekarang %s, dilaporkan %s', t.src_tipe, t.src_kode, t.proses, coalesce(f.menit_per_pcs::text, 'TIDAK ADA'), t.menit_harap), '; ')
    into v_teks
    from _timer_ou_fs t
    left join public.fcs_process_time f on f.tipe_panel = t.src_tipe and f.kode_komponen = t.src_kode and f.jenis_pekerjaan = t.proses
   where f.id is null or f.menit_per_pcs <> t.menit_harap;
  if v_teks is not null then
    raise exception 'Timer sumber berubah sejak investigasi: % - dibatalkan, laporan perlu diperbarui.', v_teks;
  end if;
  select count(*) into v_n from (
    select t.src_tipe, t.src_kode, t.proses from _timer_ou_fs t
      join public.fcs_process_time f on f.tipe_panel = t.src_tipe and f.kode_komponen = t.src_kode and f.jenis_pekerjaan = t.proses
     group by 1, 2, 3 having count(*) > 1) x;
  if v_n > 0 then
    raise exception 'Timer sumber dobel (% pasangan jenis+kode+proses) - dibatalkan.', v_n;
  end if;

  -- Sel yang ternyata SUDAH terisi di OU_FS (diisi orang lain setelah investigasi) -> dilewati, tidak ditimpa
  select count(*), string_agg(t.ou_kode || ' ' || t.proses, ', ') into v_lewati, v_teks from _timer_ou_fs t
   where exists (select 1 from public.fcs_process_time p where p.tipe_panel = 'OU_FS' and p.kode_komponen = t.ou_kode and p.jenis_pekerjaan = t.proses);
  raise notice 'Dilewati karena sudah terisi di OU_FS: % (%)', v_lewati, coalesce(v_teks, '-');

  -- ISI (nama & WP dari bom_master OU_FS - sama dgn baris timer OU_FS lain; menit dari sumber)
  insert into public.fcs_process_time (kode_komponen, nama_komponen, tipe_panel, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active)
  select t.ou_kode, o.nama_komponen, 'OU_FS', o.wp, t.proses, f.menit_per_pcs,
         'salin timer dari ' || t.src_tipe || ' ' || t.src_kode || ' (9 Okt 2026)', true
    from _timer_ou_fs t
    join public.bom_master o on o.tipe_panel = 'OU_FS' and o.kode_komponen = t.ou_kode
    join public.fcs_process_time f on f.tipe_panel = t.src_tipe and f.kode_komponen = t.src_kode and f.jenis_pekerjaan = t.proses
   where not exists (select 1 from public.fcs_process_time p
                      where p.tipe_panel = 'OU_FS' and p.kode_komponen = t.ou_kode and p.jenis_pekerjaan = t.proses)
   order by t.ou_kode, t.proses;
  get diagnostics v_isi = row_count;

  -- POST-CHECK
  if v_isi + v_lewati <> 26 then
    raise exception 'Jumlah tidak cocok: diisi % + dilewati % <> 26 - dibatalkan.', v_isi, v_lewati;
  end if;
  select count(*) into v_n from (
    select kode_komponen, jenis_pekerjaan from public.fcs_process_time where tipe_panel = 'OU_FS'
     group by 1, 2 having count(*) > 1) x;
  if v_n > 0 then
    raise exception 'Timer OU_FS jadi dobel (% pasangan) - dibatalkan.', v_n;
  end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('SQL Editor (isi timer OU_FS)', 'ISI TIMER DARI JENIS LAIN',
    format('Isi timer OU_FS yang kosong dari FS (22) + WM_MS/WM_POLY (4): %s baris diisi, %s dilewati (sudah terisi). BOM OU_FS tidak diubah.', v_isi, v_lewati),
    'master_data', 'Kapasitas Pekerjaan');

  raise notice 'SELESAI: % timer OU_FS diisi, % dilewati', v_isi, v_lewati;
end $$;

commit;
