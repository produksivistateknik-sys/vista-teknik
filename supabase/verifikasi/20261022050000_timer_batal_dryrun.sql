-- DRY-RUN TIMER BATAL (BACA SAJA) - jalankan SEBELUM migration 20261022050000_timer_batal.sql.
-- (1) Objek belum ada (harapan: semua false)
select to_regclass('public.fcs_timer_kerja_batal') is not null as tabel_sudah_ada,
       to_regprocedure('public.batalkan_timer_salah_pilih(bigint[],text,text,text)') is not null as rpc_batal_sudah_ada,
       to_regprocedure('public.pulihkan_timer_batal(bigint,text,text)') is not null as rpc_pulih_sudah_ada;
-- (2) Tipe kolom fcs_timer_kerja (id harus bisa ditampung bigint; dicatat utk pemulihan jsonb_populate_record)
select column_name, data_type, column_default, is_identity
from information_schema.columns where table_schema = 'public' and table_name = 'fcs_timer_kerja' order by ordinal_position;
-- (3) Trigger & FK yang menyentuh fcs_timer_kerja (harapan: tidak ada FK dari tabel lain; trigger dicatat)
select tgname as trigger, pg_get_triggerdef(t.oid) from pg_trigger t where tgrelid = 'public.fcs_timer_kerja'::regclass and not tgisinternal;
select conrelid::regclass as tabel_perujuk, conname from pg_constraint where confrelid = 'public.fcs_timer_kerja'::regclass;
-- (4) Calon pembatalan pertama (koreksi FS.4): harapan 1 baris IFAL (id 26043) panel 534 FS.4 WIRING CONTROL 22 Okt
select t.id, p.nama as pekerja, t.panel_id, t.kode_komponen, t.proses, t.tanggal, t.mulai, t.selesai, t.durasi_menit
from public.fcs_timer_kerja t left join public.pekerja p on p.id = t.pekerja_id
where t.panel_id = 534 and t.kode_komponen = 'FS.4' and t.proses = 'WIRING CONTROL' and t.tanggal = date '2026-10-22' order by t.id;
