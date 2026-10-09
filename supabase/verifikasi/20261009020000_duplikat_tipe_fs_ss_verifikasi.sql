-- VERIFIKASI duplikat FS -> FS_SS (SELECT saja, aman dijalankan kapan pun, sebelum maupun sesudah migrasi).

-- A. Jumlah baris per tabel: kolom fs & fs_ss harus sama (sebelum migrasi: fs_ss = 0)
select 'panel_type_meta' as tabel, count(*) filter (where tipe_panel='FS') fs, count(*) filter (where tipe_panel='FS_SS') fs_ss from public.panel_type_meta
union all select 'panel_wp_meta',      count(*) filter (where tipe_panel='FS'), count(*) filter (where tipe_panel='FS_SS') from public.panel_wp_meta
union all select 'bom_master',         count(*) filter (where tipe_panel='FS'), count(*) filter (where tipe_panel='FS_SS') from public.bom_master
union all select 'bom_proses_relevan', count(*) filter (where tipe_panel='FS'), count(*) filter (where tipe_panel='FS_SS') from public.bom_proses_relevan
union all select 'fcs_process_time',   count(*) filter (where tipe_panel='FS'), count(*) filter (where tipe_panel='FS_SS') from public.fcs_process_time;

-- B. Isi berbeda (selain id/tipe/timestamp) - HARUS 0 baris, dua arah
select 'FS tidak ada di FS_SS' arah, 'bom_master' tabel, kode_komponen, nama_komponen, wp, urutan::text, null jenis, null menit
  from ((select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel='FS')
        except all (select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel='FS_SS')) x
union all
select 'FS_SS tidak ada di FS', 'bom_master', kode_komponen, nama_komponen, wp, urutan::text, null, null
  from ((select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel='FS_SS')
        except all (select kode_komponen, nama_komponen, wp, urutan from public.bom_master where tipe_panel='FS')) x
union all
select 'FS tidak ada di FS_SS', 'bom_proses_relevan', kode_komponen, null, null, null, jenis_pekerjaan, null
  from ((select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel='FS')
        except all (select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel='FS_SS')) x
union all
select 'FS_SS tidak ada di FS', 'bom_proses_relevan', kode_komponen, null, null, null, jenis_pekerjaan, null
  from ((select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel='FS_SS')
        except all (select kode_komponen, jenis_pekerjaan from public.bom_proses_relevan where tipe_panel='FS')) x
union all
select 'FS tidak ada di FS_SS', 'fcs_process_time', kode_komponen, nama_komponen, wp, is_active::text, jenis_pekerjaan, menit_per_pcs::text
  from ((select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel='FS')
        except all (select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel='FS_SS')) x
union all
select 'FS_SS tidak ada di FS', 'fcs_process_time', kode_komponen, nama_komponen, wp, is_active::text, jenis_pekerjaan, menit_per_pcs::text
  from ((select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel='FS_SS')
        except all (select kode_komponen, nama_komponen, wp, jenis_pekerjaan, menit_per_pcs, keterangan, is_active from public.fcs_process_time where tipe_panel='FS')) x
union all
select 'beda', 'panel_wp_meta', null, null, wp, urutan::text, color, range_label
  from ((select wp, color, range_label, urutan from public.panel_wp_meta where tipe_panel='FS')
        except all (select wp, color, range_label, urutan from public.panel_wp_meta where tipe_panel='FS_SS')) x;

-- C. Relasi FS_SS tidak "yatim" / tidak menunjuk ke FS - HARUS 0 baris:
--    mapping proses & process time FS_SS yang kodenya tidak ada di bom_master FS_SS, dan komponen
--    FS_SS yang WP-nya tidak ada di panel_wp_meta FS_SS.
select 'bom_proses_relevan tanpa komponen FS_SS' masalah, r.kode_komponen from public.bom_proses_relevan r
 where r.tipe_panel='FS_SS' and not exists (select 1 from public.bom_master b where b.tipe_panel='FS_SS' and b.kode_komponen=r.kode_komponen)
union all
select 'fcs_process_time tanpa komponen FS_SS', p.kode_komponen from public.fcs_process_time p
 where p.tipe_panel='FS_SS' and not exists (select 1 from public.bom_master b where b.tipe_panel='FS_SS' and b.kode_komponen=p.kode_komponen)
union all
select 'bom_master FS_SS WP tidak terdaftar', b.kode_komponen||' '||b.wp from public.bom_master b
 where b.tipe_panel='FS_SS' and not exists (select 1 from public.panel_wp_meta w where w.tipe_panel='FS_SS' and w.wp=b.wp);

-- D. Skema: FK & index unik pada 5 tabel master (informasi; FK diharapkan 0 baris)
select 'FK' jenis, conname nama, conrelid::regclass::text tabel, confrelid::regclass::text merujuk
  from pg_constraint
 where contype='f' and (conrelid::regclass::text in ('panel_type_meta','panel_wp_meta','bom_master','bom_proses_relevan','fcs_process_time')
                     or confrelid::regclass::text in ('panel_type_meta','panel_wp_meta','bom_master','bom_proses_relevan','fcs_process_time'))
union all
select 'UNIQUE', ic.relname, i.indrelid::regclass::text,
       (select string_agg(a.attname, ',') from pg_attribute a where a.attrelid=i.indrelid and a.attnum=any(i.indkey))
  from pg_index i join pg_class ic on ic.oid=i.indexrelid
 where i.indisunique and i.indrelid::regclass::text in ('panel_type_meta','panel_wp_meta','bom_master','bom_proses_relevan','fcs_process_time');

-- E. Data panel/WO/jadwal FS tidak tersentuh: jumlah ini harus SAMA sebelum & sesudah migrasi
select (select count(*) from public.panels where tipe='FS') panels_fs,
       (select count(*) from public.panels_archived where tipe='FS') panels_arsip_fs,
       (select count(*) from public.panels where tipe='FS_SS') panels_fs_ss;
