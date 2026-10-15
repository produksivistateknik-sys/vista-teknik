-- VERIFIKASI tutup timer >12 jam (jalankan SESUDAH migration 20261015030000_tutup_timer_12jam.sql).
-- BAGIAN A (baca saja): timer yang AKAN ditutup oleh eksekusi berikutnya + perkiraan waktu selesainya.
select t.id, k.nama as operator, t.proses, t.tahap, t.kode_komponen, t.panel_id, t.mulai,
       round(extract(epoch from now() - t.mulai) / 3600.0, 1) as jam_jalan,
       (select max(c.ts::timestamptz) from public.progress_checkpoint_log c
         where c.panel_id = t.panel_id and c.kode_komponen = t.kode_komponen and c.proses = t.proses
           and c.ts::timestamptz > t.mulai and c.ts::timestamptz <= t.mulai + interval '12 hours') as akan_selesai_di
from public.fcs_timer_kerja t left join public.pekerja k on k.id = t.pekerja_id
where t.selesai is null and t.mulai < now() - interval '12 hours'
order by t.mulai;
-- (akan_selesai_di kosong = ditutup dgn durasi 0)

select jobname, schedule, command from cron.job where jobname = 'tutup-timer-12jam';   -- HARUS 1 baris, '5 * * * *'

-- BAGIAN B: uji dgn data tanam di transaksi yang di-ROLLBACK (tidak ada yang tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_pk bigint; v_panel bigint := 521; t1 bigint; t2 bigint; t3 bigint; t4 bigint; v_n int; v_cp timestamptz;
begin
  select id into v_pk from public.pekerja order by id limit 1;
  -- t1: 13 jam lalu, ada simpanan 2 jam setelah mulai -> selesai = simpanan itu
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai)
    values (v_pk, v_panel, 'UJI.T1', 'POTONG', current_date - 1, now() - interval '13 hours') returning id into t1;
  v_cp := now() - interval '11 hours';
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, ts)
    values (v_panel, 'UJI.T1', 'POTONG', 100, 'UJI', current_date - 1, v_cp);
  -- simpanan di LUAR 12 jam (diabaikan)
  insert into public.progress_checkpoint_log (panel_id, kode_komponen, proses, checkpoint, pekerja_nama, tanggal, ts)
    values (v_panel, 'UJI.T1', 'POTONG', 100, 'UJI', current_date, now() - interval '30 minutes');
  -- t2: 20 jam lalu, tanpa simpanan -> durasi 0
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai)
    values (v_pk, v_panel, 'UJI.T2', 'POTONG', current_date - 1, now() - interval '20 hours') returning id into t2;
  -- t3: baru 11 jam -> TIDAK disentuh
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai)
    values (v_pk, v_panel, 'UJI.T3', 'POTONG', current_date, now() - interval '11 hours') returning id into t3;
  -- t4: 15 jam lalu tapi sudah ditutup -> TIDAK diubah
  insert into public.fcs_timer_kerja (pekerja_id, panel_id, kode_komponen, proses, tanggal, mulai, selesai)
    values (v_pk, v_panel, 'UJI.T4', 'POTONG', current_date - 1, now() - interval '15 hours', now() - interval '14 hours') returning id into t4;

  v_n := public.tutup_timer_kelewat_12jam();
  raise notice 'timer ditutup: % (termasuk timer live lain yang memang >12 jam, kalau ada)', v_n;

  if (select selesai from public.fcs_timer_kerja where id = t1) is distinct from v_cp then raise exception 'GAGAL U1: t1 harus selesai di simpanan terakhir dalam 12 jam'; end if;
  raise notice 'LULUS U1: timer dgn simpanan ditutup di waktu simpanan terakhir (simpanan di luar 12 jam diabaikan)';
  if (select selesai = mulai from public.fcs_timer_kerja where id = t2) is not true then raise exception 'GAGAL U2: t2 harus durasi 0'; end if;
  raise notice 'LULUS U2: timer tanpa simpanan ditutup durasi 0';
  if (select selesai from public.fcs_timer_kerja where id = t3) is not null then raise exception 'GAGAL U3: t3 (<12 jam) tidak boleh ditutup'; end if;
  raise notice 'LULUS U3: timer < 12 jam tidak disentuh';
  if (select selesai from public.fcs_timer_kerja where id = t4) <> (select mulai + interval '1 hour' from public.fcs_timer_kerja where id = t4) then raise exception 'GAGAL U4: t4 yang sudah ditutup berubah'; end if;
  raise notice 'LULUS U4: timer yang sudah ditutup tidak diubah';
  if not exists (select 1 from public.activity_log where action = 'TUTUP TIMER OTOMATIS' and description like '%#' || t1 || ' %' and description like '%#' || t2 || ' %') then
    raise exception 'GAGAL U5: activity_log tidak mencatat t1/t2';
  end if;
  raise notice 'LULUS U5: tercatat di activity_log';
  if public.tutup_timer_kelewat_12jam() <> 0 then raise exception 'GAGAL U6: eksekusi kedua harus 0'; end if;
  raise notice 'LULUS U6: eksekusi ulang tidak menutup apa pun lagi';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
