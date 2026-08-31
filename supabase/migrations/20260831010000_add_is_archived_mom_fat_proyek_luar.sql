-- Arsip per record MOM FAT & Proyek Luar (31 Agu 2026) - reuse konsep is_archived
-- boolean sederhana dari work_orders.is_archived (BUKAN sistem snapshot panels_archived
-- yang jauh lebih berat, gak perlu buat skala record ini). Record diarsip hilang dari
-- list utama tapi tetap muncul kalau dicari lewat search box.
alter table public.mom_fat add column if not exists is_archived boolean not null default false;
alter table public.proyek_luar add column if not exists is_archived boolean not null default false;
