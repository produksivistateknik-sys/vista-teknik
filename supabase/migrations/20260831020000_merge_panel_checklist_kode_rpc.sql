-- RPC merge_panel_checklist (31 Agu 2026) - root cause "qty komponen hilang lagi"
-- (Kompartemen/Hanger MCC TR 4/5): semua penulisan panels.checklist di Vista Pekerja
-- (OperatorView/KomponenPasangView, ~13 titik) selama ini spread SELURUH checklist dari
-- state lokal browser lalu tulis ulang seluruh kolom - kalau tab operator sudah lama
-- kebuka (checklist versi lama nempel di memori) dan ada perbaikan/edit dari sisi lain
-- (admin/operator lain) di komponen BERBEDA, edit qty apapun oleh operator itu diam-diam
-- menimpa balik SEMUA komponen lain ke versi lama. Fungsi ini merge cuma kode komponen
-- yang benar-benar berubah (bisa 1 atau beberapa sekaligus) ke checklist di server pakai
-- operator jsonb `||` (shallow merge top-level key) - kode lain yang gak disertakan di
-- p_partial gak pernah disentuh sama sekali, kebal terhadap staleness client seberapa pun
-- lamanya.
create or replace function public.merge_panel_checklist(p_panel_id bigint, p_partial jsonb)
returns void
language sql
as $$
  update public.panels
  set checklist = coalesce(checklist, '{}'::jsonb) || p_partial
  where id = p_panel_id;
$$;
