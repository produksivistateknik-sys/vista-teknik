-- DUPLIKAT JENIS PANEL FS -> FS_SS (9 Okt 2026) - salinan data biasa, FS TIDAK diubah.
--
-- Hasil investigasi (live, 9 Okt 2026):
-- - Data master 1 jenis panel ada di 5 tabel, semua berkunci TEKS (tipe_panel [+ kode_komponen / wp]),
--   TIDAK ada FK berbasis id antar tabel ini (pre-check 4 di bawah memastikan ini di DB; kalau ternyata
--   ada FK, migrasi BERHENTI sebelum menulis apa pun):
--     panel_type_meta     (tipe_panel, label)                                    FS: 1 baris
--     panel_wp_meta       (tipe_panel, wp, color, range_label, urutan)           FS: 4 baris
--     bom_master          (tipe_panel, kode_komponen, nama_komponen, wp, urutan) FS: 36 baris
--     bom_proses_relevan  (tipe_panel, kode_komponen, jenis_pekerjaan)           FS: 204 baris
--     fcs_process_time    (tipe_panel, kode_komponen, nama_komponen, wp,
--                          jenis_pekerjaan, menit_per_pcs, keterangan, is_active) FS: 84 baris
--   Relasi antar baris = (tipe_panel, kode_komponen) & (tipe_panel, wp) -> karena kode_komponen & wp
--   disalin apa adanya dan tipe_panel diganti 'FS_SS', semua relasi otomatis menunjuk ke baris FS_SS.
--   Tidak perlu pemetaan id_lama -> id_baru (tidak ada kolom id yang dirujuk).
-- - Tidak ada mekanisme alias / "mengikuti jenis lain" di aplikasi -> salinan data biasa.
-- - kode_komponen disalin APA ADANYA (FS.1 ... FS.36), TIDAK dinomori ulang. Pola kode yang sama di
--   2 jenis sudah ada di produksi (WM_MS & WM_POLY sama-sama WM.x).
-- - Tidak menyentuh panels / work_orders / raw_schedule / renhar / arsip apa pun.
--
-- Jalankan SEKALI di Supabase SQL Editor. Semua isi ada di 1 blok DO di dalam 1 transaksi: gagal di
-- langkah mana pun = TIDAK ADA yang tersimpan. Idempotent: kalau FS_SS sudah ada -> berhenti dgn pesan.
-- Rollback: supabase/rollback/20261009020000_duplikat_tipe_fs_ss_rollback.sql
-- Verifikasi (SELECT saja): supabase/verifikasi/20261009020000_duplikat_tipe_fs_ss_verifikasi.sql

begin;

do $$
declare
  v_tabel regclass[] := array['public.panel_type_meta','public.panel_wp_meta','public.bom_master',
                              'public.bom_proses_relevan','public.fcs_process_time']::regclass[];
  v_n int; v_teks text;
  v_tipe int; v_wp int; v_bom int; v_rel int; v_pt int;
begin
  -- PRE-CHECK 1: sumber FS ada (persis 'FS', bukan OU_FS / FS_xxx)
  if (select count(*) from public.panel_type_meta where tipe_panel = 'FS') <> 1 then
    raise exception 'Jenis FS tidak ditemukan (atau dobel) di panel_type_meta - dibatalkan, tidak ada yang diubah.';
  end if;

  -- PRE-CHECK 2: FS_SS belum ada di mana pun (master + panel live/arsip + jadwal/arsip seksi)
  select (select count(*) from public.panel_type_meta    where tipe_panel = 'FS_SS')
       + (select count(*) from public.panel_wp_meta      where tipe_panel = 'FS_SS')
       + (select count(*) from public.bom_master         where tipe_panel = 'FS_SS')
       + (select count(*) from public.bom_proses_relevan where tipe_panel = 'FS_SS')
       + (select count(*) from public.fcs_process_time   where tipe_panel = 'FS_SS')
       + (select count(*) from public.panels             where tipe = 'FS_SS')
       + (select count(*) from public.panels_archived    where tipe = 'FS_SS')
       + (select count(*) from public.panel_seksi_archived where panel_tipe = 'FS_SS')
    into v_n;
  if v_n > 0 then
    raise exception 'FS_SS SUDAH ADA (% baris di master/panel/arsip) - dibatalkan, tidak ada yang diubah.', v_n;
  end if;
  if exists (select 1 from public.panel_type_meta where lower(label) = 'fs_ss') then
    raise exception 'Label FS_SS sudah dipakai jenis lain di panel_type_meta - dibatalkan.';
  end if;

  -- PRE-CHECK 3: kolom tabel live = kolom yang disalin di bawah (ada kolom baru -> berhenti, jangan
  -- sampai kolom baru tidak ikut tersalin diam-diam)
  for v_teks in
    select format('%s: ada %s, diharapkan %s', t.tabel, coalesce(c.kolom, '-'), t.harap)
    from (values
      ('panel_type_meta',    'created_at,id,label,tipe_panel,updated_at'),
      ('panel_wp_meta',      'color,created_at,id,range_label,tipe_panel,urutan,wp'),
      ('bom_master',         'created_at,id,kode_komponen,nama_komponen,tipe_panel,updated_at,urutan,wp'),
      ('bom_proses_relevan', 'created_at,id,jenis_pekerjaan,kode_komponen,tipe_panel'),
      ('fcs_process_time',   'created_at,id,is_active,jenis_pekerjaan,keterangan,kode_komponen,menit_per_pcs,nama_komponen,tipe_panel,updated_at,wp')
    ) t(tabel, harap)
    left join (
      select table_name, string_agg(column_name, ',' order by column_name) as kolom
      from information_schema.columns where table_schema = 'public' group by table_name
    ) c on c.table_name = t.tabel
    where c.kolom is distinct from t.harap
  loop
    raise exception 'Struktur kolom berubah sejak investigasi (%) - dibatalkan, rencana perlu ditinjau.', v_teks;
  end loop;

  -- PRE-CHECK 4: tidak ada FOREIGN KEY yang menyentuh 5 tabel ini (asumsi rencana: relasi = teks)
  select string_agg(format('%s (%s -> %s)', conname, conrelid::regclass, confrelid::regclass), '; ')
    into v_teks
    from pg_constraint
   where contype = 'f' and (conrelid = any(v_tabel) or confrelid = any(v_tabel));
  if v_teks is not null then
    raise exception 'Ada foreign key pada tabel master BOM: % - dibatalkan, rencana perlu ditinjau (pemetaan id).', v_teks;
  end if;

  -- INFO: index UNIQUE yang TIDAK memuat tipe_panel (bisa bentrok walau jenis baru). Hanya dilaporkan;
  -- kalau benar-benar bentrok, INSERT di bawah gagal dan SELURUH transaksi batal (tidak ada yang tersimpan).
  select string_agg(format('%s pada %s(%s)', ic.relname, i.indrelid::regclass,
           (select string_agg(a.attname, ',') from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any(i.indkey))), '; ')
    into v_teks
    from pg_index i join pg_class ic on ic.oid = i.indexrelid
   where i.indrelid = any(v_tabel) and i.indisunique and not i.indisprimary
     and not exists (select 1 from pg_attribute a where a.attrelid = i.indrelid and a.attnum = any(i.indkey) and a.attname = 'tipe_panel');
  raise notice 'Index unik tanpa tipe_panel: %', coalesce(v_teks, 'tidak ada');

  -- SALIN (urut id lama supaya urutan tampil sama; id baru dari sequence; created_at/updated_at default)
  insert into public.panel_type_meta (tipe_panel, label)
  values ('FS_SS', 'FS_SS');
  get diagnostics v_tipe = row_count;

  insert into public.panel_wp_meta (tipe_panel, wp, color, range_label, urutan)
  select 'FS_SS', wp, color, range_label, urutan
    from public.panel_wp_meta where tipe_panel = 'FS' order by id;
  get diagnostics v_wp = row_count;

  insert into public.bom_master (kode_komponen, nama_komponen, tipe_panel, wp, urutan)
  select kode_komponen, nama_komponen, 'FS_SS', wp, urutan
    from public.bom_master where tipe_panel = 'FS' order by id;
  get diagnostics v_bom = row_count;

  insert into public.bom_proses_relevan (kode_komponen, tipe_panel, jenis_pekerjaan)
  select kode_komponen, 'FS_SS', jenis_pekerjaan
    from public.bom_proses_relevan where tipe_panel = 'FS' order by id;
  get diagnostics v_rel = row_count;

  insert into public.fcs_process_time (kode_komponen, nama_komponen, tipe_panel, wp, jenis_pekerjaan,
                                       menit_per_pcs, keterangan, is_active)
  select kode_komponen, nama_komponen, 'FS_SS', wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active
    from public.fcs_process_time where tipe_panel = 'FS' order by id;
  get diagnostics v_pt = row_count;

  -- POST-CHECK: jumlah & isi identik FS vs FS_SS (kecuali id/tipe/timestamp) - beda = batal semua
  if v_wp  <> (select count(*) from public.panel_wp_meta      where tipe_panel = 'FS')
  or v_bom <> (select count(*) from public.bom_master         where tipe_panel = 'FS')
  or v_rel <> (select count(*) from public.bom_proses_relevan where tipe_panel = 'FS')
  or v_pt  <> (select count(*) from public.fcs_process_time   where tipe_panel = 'FS') then
    raise exception 'Jumlah baris FS_SS tidak sama dengan FS - dibatalkan.';
  end if;

  select
     (select count(*) from ((select wp, color, range_label, urutan from public.panel_wp_meta where tipe_panel = 'FS')
                  except all (select wp, color, range_label, urutan from public.panel_wp_meta where tipe_panel = 'FS_SS')) x)
   + (select count(*) from ((select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel = 'FS')
                  except all (select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel = 'FS_SS')) x)
   + (select count(*) from ((select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel = 'FS')
                  except all (select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel = 'FS_SS')) x)
   + (select count(*) from ((select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel = 'FS')
                  except all (select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel = 'FS_SS')) x)
    into v_n;
  if v_n <> 0 then
    raise exception 'Isi FS_SS berbeda dari FS (% baris) - dibatalkan.', v_n;
  end if;

  insert into public.activity_log (user_name, action, description, module, halaman)
  values ('SQL Editor (duplikat FS -> FS_SS)', 'DUPLIKAT TIPE PANEL',
    format('Duplikat tipe panel FS -> FS_SS: %s jenis, %s WP, %s komponen BOM, %s mapping proses, %s process time (kode komponen disalin apa adanya)',
      v_tipe, v_wp, v_bom, v_rel, v_pt),
    'master_data', 'Kapasitas Pekerjaan');

  raise notice 'SELESAI: FS_SS dibuat - % jenis, % WP, % komponen BOM, % mapping proses, % process time', v_tipe, v_wp, v_bom, v_rel, v_pt;
end $$;

commit;
