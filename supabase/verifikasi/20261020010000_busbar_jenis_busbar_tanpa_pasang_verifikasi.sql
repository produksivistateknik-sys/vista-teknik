-- VERIFIKASI 20261020010000_busbar_jenis_busbar_tanpa_pasang (jalankan SESUDAH migration). Semua di transaksi yang
-- di-ROLLBACK (panel nyata dipakai sbg bahan uji, perubahan tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_bb bigint; v_lain bigint; v_ok boolean;
begin
  if pg_get_functiondef('public.panels_validate_busbar_cap_progress()'::regprocedure) not like '%array[''FABRIKASI'',''PLATING''];%' then
    raise exception 'GAGAL V0: fungsi trigger belum versi 2 tahap';
  end if;
  raise notice 'LULUS V0: fungsi trigger versi 2 tahap terpasang';
  select id into v_bb from public.panels where tipe = 'BUSBAR' order by id limit 1;
  select id into v_lain from public.panels where tipe is distinct from 'BUSBAR' order by id limit 1;
  if v_bb is null or v_lain is null then raise exception 'GAGAL: butuh 1 panel jenis BUSBAR & 1 panel jenis lain'; end if;

  -- V1: jenis BUSBAR, sisa isian PASANG 100 (dari aplikasi lama) di atas PLATING 50 -> diabaikan, diterima
  update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
    '{"FABRIKASI":{"progress":100},"PLATING":{"progress":50},"PASANG":{"progress":100}}'::jsonb)) where id = v_bb;
  raise notice 'LULUS V1: jenis BUSBAR - PASANG diabaikan';

  -- V2: jenis BUSBAR, PLATING melebihi FABRIKASI -> tetap ditolak
  v_ok := false;
  begin
    update public.panels set checklist = checklist || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
      '{"FABRIKASI":{"progress":40},"PLATING":{"progress":60}}'::jsonb)) where id = v_bb;
  exception when others then v_ok := sqlerrm like '%PLATING (60%) tidak boleh melebihi FABRIKASI (40%)%'; end;
  if not v_ok then raise exception 'GAGAL V2: PLATING > FABRIKASI tidak ditolak dgn benar'; end if;
  raise notice 'LULUS V2: jenis BUSBAR - PLATING > FABRIKASI ditolak';

  -- V3: jenis LAIN tidak berubah - H-BUS PASANG 50 dgn HEATSHRINK 0 -> ditolak
  v_ok := false;
  begin
    update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
      '{"FABRIKASI":{"progress":100},"PLATING":{"progress":100},"HEATSHRINK":{"progress":0},"PASANG":{"progress":50}}'::jsonb)) where id = v_lain;
  exception when others then v_ok := sqlerrm like '%PASANG (50%) tidak boleh melebihi HEATSHRINK (0%)%'; end;
  if not v_ok then raise exception 'GAGAL V3: jenis lain kehilangan tahap'; end if;
  raise notice 'LULUS V3: jenis lain tetap 4 tahap';

  -- V4: jenis lain, GROUND tetap 3 tahap (PASANG > PLATING ditolak)
  v_ok := false;
  begin
    update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('GROUND', jsonb_build_object('busbarTahap',
      '{"FABRIKASI":{"progress":100},"PLATING":{"progress":40},"PASANG":{"progress":50}}'::jsonb)) where id = v_lain;
  exception when others then v_ok := sqlerrm like '%PASANG (50%) tidak boleh melebihi PLATING (40%)%'; end;
  if not v_ok then raise exception 'GAGAL V4: GROUND jenis lain berubah'; end if;
  raise notice 'LULUS V4: jenis lain - GROUND tetap 3 tahap';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
