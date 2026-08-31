-- WO Digital - arsip PERSONAL per operator (31 Agu 2026), terpisah total dari
-- work_orders.is_archived (yang itu status GLOBAL, dikelola admin). Operator bisa
-- sembunyikan WO dari tampilan Aktif mereka sendiri tanpa memengaruhi operator lain
-- atau tampilan admin sama sekali. unique(pekerja_id,wo_id) dipakai sebagai kunci
-- toggle: insert = arsipkan, delete = batalkan arsip.
create table if not exists public.wo_digital_arsip_personal (
  id bigint generated always as identity primary key,
  pekerja_id bigint not null references public.pekerja(id) on delete cascade,
  wo_id bigint not null references public.work_orders(id) on delete cascade,
  archived_at timestamptz not null default now(),
  unique(pekerja_id, wo_id)
);

create index if not exists wo_digital_arsip_personal_pekerja_idx on public.wo_digital_arsip_personal(pekerja_id);
