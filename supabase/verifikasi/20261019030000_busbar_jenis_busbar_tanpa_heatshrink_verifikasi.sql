-- VERIFIKASI 20261019030000_busbar_jenis_busbar_tanpa_heatshrink (jalankan SESUDAH migration). Semua di transaksi yang
-- di-ROLLBACK (panel nyata dipakai sbg bahan uji, perubahan tidak tersisa). Harus berakhir 'SEMUA LULUS'.
begin;
do $$
declare v_bb bigint; v_lain bigint; v_ok boolean;
begin
  if pg_get_functiondef('public.panels_validate_busbar_cap_progress()'::regprocedure) not like '%NEW.tipe = ''BUSBAR''%' then
    raise exception 'GAGAL V0: fungsi trigger belum versi baru';
  end if;
  raise notice 'LULUS V0: fungsi trigger versi baru terpasang';
  select id into v_bb from public.panels where tipe = 'BUSBAR' order by id limit 1;
  select id into v_lain from public.panels where tipe is distinct from 'BUSBAR' order by id limit 1;
  if v_bb is null or v_lain is null then raise exception 'GAGAL: butuh 1 panel jenis BUSBAR & 1 panel jenis lain'; end if;

  -- V1: jenis BUSBAR, 3 tahap tanpa HEATSHRINK, PASANG 50 setelah PLATING 100 -> diterima
  update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
    '{"FABRIKASI":{"progress":100},"PLATING":{"progress":100},"PASANG":{"progress":50}}'::jsonb)) where id = v_bb;
  raise notice 'LULUS V1: jenis BUSBAR - PASANG 50 tanpa HEATSHRINK diterima';

  -- V2: jenis BUSBAR, sisa isian HEATSHRINK 0 diabaikan -> PASANG 50 tetap diterima
  update public.panels set checklist = checklist || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
    '{"FABRIKASI":{"progress":100},"PLATING":{"progress":100},"HEATSHRINK":{"progress":0},"PASANG":{"progress":50}}'::jsonb)) where id = v_bb;
  raise notice 'LULUS V2: jenis BUSBAR - HEATSHRINK 0 lama diabaikan';

  -- V3: jenis BUSBAR, PASANG melebihi PLATING -> tetap ditolak
  v_ok := false;
  begin
    update public.panels set checklist = checklist || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
      '{"FABRIKASI":{"progress":100},"PLATING":{"progress":40},"PASANG":{"progress":60}}'::jsonb)) where id = v_bb;
  exception when others then v_ok := sqlerrm like '%PASANG (60%) tidak boleh melebihi PLATING (40%)%'; end;
  if not v_ok then raise exception 'GAGAL V3: PASANG > PLATING tidak ditolak dgn benar'; end if;
  raise notice 'LULUS V3: jenis BUSBAR - PASANG > PLATING ditolak';

  -- V4: jenis LAIN tidak berubah - H-BUS PASANG 50 dgn HEATSHRINK 0 -> ditolak
  v_ok := false;
  begin
    update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('UJI-HBUS', jsonb_build_object('busbarTahap',
      '{"FABRIKASI":{"progress":100},"PLATING":{"progress":100},"HEATSHRINK":{"progress":0},"PASANG":{"progress":50}}'::jsonb)) where id = v_lain;
  exception when others then v_ok := sqlerrm like '%PASANG (50%) tidak boleh melebihi HEATSHRINK (0%)%'; end;
  if not v_ok then raise exception 'GAGAL V4: jenis lain kehilangan tahap HEATSHRINK'; end if;
  raise notice 'LULUS V4: jenis lain tetap 4 tahap';

  -- V5: jenis lain, GROUND tetap 3 tahap
  update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || jsonb_build_object('GROUND', jsonb_build_object('busbarTahap',
    '{"FABRIKASI":{"progress":100},"PLATING":{"progress":100},"PASANG":{"progress":50}}'::jsonb)) where id = v_lain;
  raise notice 'LULUS V5: jenis lain - GROUND tetap 3 tahap';
  raise notice 'SEMUA LULUS';
end $$;
rollback;
