-- Batalkan fitur arsip personal WO Digital (31 Agu 2026) - cukup 1 arsip resmi/bersama saja
-- (work_orders.is_archived), sama pola arsip di divisi lain, gak perlu terpisah per operator.
drop table if exists public.wo_digital_arsip_personal;
