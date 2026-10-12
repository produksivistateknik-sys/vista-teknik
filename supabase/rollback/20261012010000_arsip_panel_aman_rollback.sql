-- ROLLBACK arsip_panel_aman. Kolom panel_id_arsip TIDAK di-drop bila sudah terisi (berisi tautan permintaan ke panel arsip).
drop function if exists public.arsip_panel_aman(bigint, text, numeric);
drop function if exists public.unarsip_panel_aman(bigint);
do $$ begin
  if not exists (select 1 from public.permintaan where panel_id_arsip is not null) then
    alter table public.permintaan drop column if exists panel_id_arsip;
  else
    raise notice 'Kolom permintaan.panel_id_arsip DIBIARKAN: ada % baris terisi', (select count(*) from public.permintaan where panel_id_arsip is not null);
  end if;
end $$;
