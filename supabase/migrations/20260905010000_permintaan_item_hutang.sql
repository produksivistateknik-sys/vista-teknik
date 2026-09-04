-- Fitur "Hutang" (5 Sep 2026) - pemenuhan sebagian permintaan Gudang. Saat gudang cuma bisa
-- penuhi sebagian qty (stok fisik gak cukup), row asli di-update qty jadi yang beneran
-- dikeluarkan, dan row BARU dibuat buat sisa yang belum terpenuhi (is_hutang=true), muncul di
-- subtab "HUTANG" terpisah dari BBMB/BBMU biasa. Row hutang bisa dicicil berkali-kali
-- (induk_item_id melacak rantai turunan), sampai qty sisa benar-benar 0/lunas.
alter table public.permintaan_item add column if not exists is_hutang boolean not null default false;
alter table public.permintaan_item add column if not exists induk_item_id bigint references public.permintaan_item(id) on delete set null;
alter table public.permintaan_item add column if not exists qty_diminta_awal numeric;

-- Partial index - query subtab Hutang & badge counter SELALU filter is_hutang=true AND
-- status='pending' (outstanding, belum diproses gudang lagi).
create index if not exists permintaan_item_hutang_pending_idx
  on public.permintaan_item(is_hutang)
  where is_hutang and status = 'pending';
