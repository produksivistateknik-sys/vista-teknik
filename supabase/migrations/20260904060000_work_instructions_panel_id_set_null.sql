-- Fix (4 Sep 2026): work_instructions.panel_id punya ON DELETE CASCADE ke panels(id) - kalau
-- panel yang punya dokumen ter-upload diarsipkan (RPC arsip_panel hard-delete row panels
-- setelah disalin ke panels_archived), dokumen (work_instructions) + SEMUA riwayat revisinya
-- (wi_revisions, cascade dari work_instructions) ikut kehapus PERMANEN. Belum pernah kejadian
-- (WO Digital masih baru), tapi ini bom waktu - ganti jadi ON DELETE SET NULL: dokumen+revisi
-- TETAP ada (dicari balik lewat wo_id di halaman Arsip), cuma kehilangan scoping ke panel
-- spesifik yang sudah gak ada lagi.
--
-- Nama constraint dicari dinamis (bukan di-hardcode work_instructions_panel_id_fkey) - migration
-- asli (20260831030000) bikin FK inline tanpa nama eksplisit, jadi nama constraint hasil
-- auto-generate Postgres gak 100% pasti tanpa introspeksi live schema.
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_attribute att on att.attrelid=con.conrelid and att.attnum=any(con.conkey)
  where con.conrelid='public.work_instructions'::regclass
    and con.contype='f'
    and att.attname='panel_id';
  if fk_name is not null then
    execute format('alter table public.work_instructions drop constraint %I', fk_name);
  end if;
end $$;

alter table public.work_instructions
  add constraint work_instructions_panel_id_fkey
  foreign key (panel_id) references public.panels(id) on delete set null;
