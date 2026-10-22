-- VERIFIKASI TIMER BATAL - jalankan SESUDAH migration. Menguji batal -> pulihkan di dalam transaksi yang
-- DIBATALKAN (rollback di akhir) memakai SATU timer selesai nyata yang lama (bukan hari ini) - tidak ada sisa.
-- Harus muncul NOTICE 'SEMUA LULUS'. Setelahnya query cek sisa di bawah harus 0 baris.
begin;
do $$
declare v_id bigint; v_asli jsonb; v_batal bigint; v_hasil jsonb; gagal text[] := '{}'; v_tolak boolean;
begin
  if to_regclass('public.fcs_timer_kerja_batal') is null then raise exception 'GAGAL: tabel fcs_timer_kerja_batal tidak ada'; end if;
  select t.id, to_jsonb(t) into v_id, v_asli from public.fcs_timer_kerja t
   where t.selesai is not null and t.tanggal < (now() at time zone 'Asia/Jakarta')::date - 7 order by t.id desc limit 1;
  if v_id is null then raise exception 'GAGAL: tidak ada timer contoh'; end if;
  -- validasi alasan
  v_tolak := false; begin perform public.batalkan_timer_salah_pilih(array[v_id], 'x', 'Uji'); exception when others then v_tolak := true; end;
  if not v_tolak then gagal := gagal || 'alasan pendek tidak ditolak'::text; end if;
  -- operator tidak boleh membatalkan timer lampau
  v_tolak := false; begin perform public.batalkan_timer_salah_pilih(array[v_id], 'uji verifikasi', 'Uji', 'operator'); exception when others then v_tolak := true; end;
  if not v_tolak then gagal := gagal || 'operator boleh batal timer lampau'::text; end if;
  -- id tidak ada -> ditolak seluruhnya
  v_tolak := false; begin perform public.batalkan_timer_salah_pilih(array[v_id, -1], 'uji verifikasi', 'Uji'); exception when others then v_tolak := true; end;
  if not v_tolak then gagal := gagal || 'id tidak ada tidak ditolak'::text; end if;
  if not exists (select 1 from public.fcs_timer_kerja where id = v_id) then gagal := gagal || 'penolakan menghapus baris'::text; end if;
  -- batal (admin)
  v_hasil := public.batalkan_timer_salah_pilih(array[v_id], 'uji verifikasi', 'Uji');
  if exists (select 1 from public.fcs_timer_kerja where id = v_id) then gagal := gagal || 'baris masih di fcs_timer_kerja'::text; end if;
  select id into v_batal from public.fcs_timer_kerja_batal where timer_id = v_id;
  if v_batal is null then gagal := gagal || 'log batal tidak tercatat'::text; end if;
  if not exists (select 1 from public.activity_log where action = 'BATAL TIMER' and description like '%timer ' || v_id || ' %') then gagal := gagal || 'activity_log BATAL TIMER tidak ada'::text; end if;
  -- pulihkan -> baris kembali identik (id sama)
  v_hasil := public.pulihkan_timer_batal(v_batal, 'uji verifikasi', 'Uji');
  if (select to_jsonb(t) from public.fcs_timer_kerja t where id = v_id) is distinct from v_asli then gagal := gagal || 'baris pulihan tidak identik'::text; end if;
  -- pulihkan dua kali -> ditolak
  v_tolak := false; begin perform public.pulihkan_timer_batal(v_batal, 'uji verifikasi', 'Uji'); exception when others then v_tolak := true; end;
  if not v_tolak then gagal := gagal || 'pulihkan dua kali tidak ditolak'::text; end if;
  if array_length(gagal, 1) is null then raise notice 'SEMUA LULUS (timer uji %)', v_id; else raise exception 'GAGAL: %', array_to_string(gagal, ' | '); end if;
end $$;
rollback;
-- cek sisa (harus 0 baris)
select * from public.fcs_timer_kerja_batal where dibatalkan_oleh = 'Uji';
select * from public.activity_log where user_name = 'Uji' and action in ('BATAL TIMER', 'PULIHKAN TIMER') and created_at > now() - interval '1 hour';
