-- ============================================================================================
-- KOREKSI QTY PERMINTAAN - TAHAP 3: Admin mengoreksi qty item yang SUDAH DISETUJUI tetapi BELUM DISIAPKAN Gudang
-- (26 Nov 2026, usulan admin produksi, keputusan user: hanya divisi admin; catatan wajib; qty 0 tidak boleh - pakai Tolak;
--  item hutang tidak bisa; SEMENTARA hanya boleh MENURUNKAN - menaikkan dibuka Tahap 3b setelah HP Gudang versi
--  "qty dilihat" (Tahap 2) live & versi 3 argumen dicabut; K19 versi ketat).
-- (1) RPC koreksi_qty_sebelum_disiapkan(item, qty_lama, qty_baru, catatan, admin):
--     baris dikunci (FOR UPDATE, sama dgn proses_pemenuhan_permintaan -> bergiliran dgn Konfirmasi Gudang);
--     sah HANYA bila status 'pending', bukan hutang, disetujui_admin_at terisi; qty sekarang = qty_lama (penguncian
--     optimis: admin lain / layar basi ditolak); catatan 3-500 huruf; 0 < qty_baru < qty sekarang.
--     Menulis permintaan_item.qty + 1 baris permintaan_item_koreksi (status 'disetujui', sumber 'admin_sebelum_siap',
--     qty_lama/qty_diusulkan/qty_final, alasan = catatan). SENGAJA tidak menyentuh updated_at/updated_by item (Riwayat Gudang
--     memakainya sbg tanggal Gudang menyiapkan) dan disetujui_admin_at (titik "belum dibaca" Gudang).
-- (2) Kesehatan Data K19 versi KETAT (lapisan baru, K1-K27 lain tidak berubah): koreksi terakhir bersumber admin
--     dibandingkan dgn qty item + SEMUA hutang turunannya (induk_item_id berantai) - pemenuhan sebagian sah membuat qty item
--     < qty koreksi. Koreksi bersumber gudang: aturan lama (qty item = qty koreksi terakhir).
-- Butuh Tahap 1 (kolom sumber) & Tahap 2 (rantai induk utuh) sudah dijalankan.
-- Verifikasi: supabase/verifikasi/20261126030000_koreksi_qty_sebelum_disiapkan_verifikasi.sql ('SEMUA LULUS')
-- Rollback  : supabase/rollback/20261126030000_koreksi_qty_sebelum_disiapkan_rollback.sql
-- ============================================================================================
begin;

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi' and column_name = 'sumber') then
    raise exception 'Jalankan dulu Tahap 1 (20261126010000_koreksi_qty_catatan_admin.sql) - batal';
  end if;
  if to_regprocedure('public.proses_pemenuhan_permintaan(bigint,numeric,text,numeric)') is null then
    raise exception 'Jalankan dulu Tahap 2 (20261126020000_pemenuhan_qty_dilihat.sql) - batal';
  end if;
  if exists (select 1 from pg_proc where proname = 'koreksi_qty_sebelum_disiapkan') then
    raise exception 'koreksi_qty_sebelum_disiapkan sudah ada (Tahap 3 sudah dijalankan?) - batal';
  end if;
  if to_regprocedure('public._sql_cek_kesehatan(text)') is null or to_regprocedure('public._sql_cek_kesehatan_k1_k25(text)') is null
     or to_regprocedure('public._sql_cek_kesehatan_k1_k27(text)') is not null then
    raise exception 'Lapisan cek Kesehatan Data tidak sesuai harapan (_sql_cek_kesehatan_k1_k27 sudah ada?) - batal';
  end if;
end $$;

create function public.koreksi_qty_sebelum_disiapkan(
  p_item_id bigint, p_qty_lama numeric, p_qty_baru numeric, p_catatan text, p_admin text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.permintaan_item%rowtype; v_k bigint; v_catatan text := btrim(coalesce(p_catatan, '')); v_admin text := btrim(coalesce(p_admin, ''));
begin
  if length(v_catatan) < 3 then raise exception 'Catatan koreksi wajib diisi (min. 3 huruf).' using errcode = '22023'; end if;
  if length(v_catatan) > 500 then raise exception 'Catatan terlalu panjang (maks. 500 huruf).' using errcode = '22023'; end if;
  if length(v_admin) < 1 or length(v_admin) > 100 then raise exception 'Nama admin tidak sah.' using errcode = '22023'; end if;
  if p_qty_lama is null or p_qty_baru is null then raise exception 'Qty wajib diisi.' using errcode = '22023'; end if;
  if p_qty_baru <= 0 then raise exception 'Qty baru harus lebih dari 0. Untuk membatalkan item, gunakan Tolak.' using errcode = '22023'; end if;

  select * into v from public.permintaan_item where id = p_item_id for update;
  if not found then raise exception 'Item permintaan % tidak ada (mungkin sudah diproses Gudang) - muat ulang.', p_item_id using errcode = 'P0001'; end if;
  if v.is_hutang then raise exception 'Item "%" adalah baris hutang Gudang - tidak bisa dikoreksi di sini.', v.nama_komponen using errcode = 'P0001'; end if;
  if v.status is distinct from 'pending' or v.disetujui_admin_at is null then
    raise exception 'Item "%" sudah diproses Gudang (status %) - koreksi hanya bisa lewat pengajuan Koreksi Qty dari Gudang.', v.nama_komponen, v.status
      using errcode = 'P0001';
  end if;
  if v.qty is distinct from p_qty_lama then
    raise exception 'Qty "%" sudah berubah (% -> %) - mungkin dikoreksi admin lain. Muat ulang lalu ulangi.', v.nama_komponen, p_qty_lama, v.qty
      using errcode = 'P0001';
  end if;
  if p_qty_baru = v.qty then raise exception 'Qty baru sama dengan qty sekarang.' using errcode = '22023'; end if;
  if p_qty_baru > v.qty then
    raise exception 'Sementara qty hanya boleh DITURUNKAN (menaikkan dibuka setelah HP Gudang diperbarui).' using errcode = '22023';
  end if;

  update public.permintaan_item set qty = p_qty_baru where id = v.id;
  insert into public.permintaan_item_koreksi (permintaan_item_id, qty_lama, qty_diusulkan, qty_final, alasan, status,
    diajukan_oleh, diajukan_at, target_divisi, disetujui_oleh, diputuskan_at, sumber)
  values (v.id, v.qty, p_qty_baru, p_qty_baru, v_catatan, 'disetujui', v_admin, now(), 'admin', v_admin, now(), 'admin_sebelum_siap')
  returning id into v_k;
  return jsonb_build_object('item_id', v.id, 'qty_lama', v.qty, 'qty_baru', p_qty_baru, 'koreksi_id', v_k);
end $$;
revoke all on function public.koreksi_qty_sebelum_disiapkan(bigint, numeric, numeric, text, text) from public;
grant execute on function public.koreksi_qty_sebelum_disiapkan(bigint, numeric, numeric, text, text) to anon, authenticated;

-- K19 ketat (lapisan baru; kode lain diteruskan ke lapisan lama tanpa perubahan)
alter function public._sql_cek_kesehatan(text) rename to _sql_cek_kesehatan_k1_k27;
create or replace function public._sql_cek_kesehatan(p_kode text) returns text
language sql immutable as $f$
select case p_kode
 when 'K19' then $q$
   with recursive akhir as (
     select distinct on (k.permintaan_item_id) k.*
     from public.permintaan_item_koreksi k
     where k.status = 'disetujui'
     order by k.permintaan_item_id, k.diputuskan_at desc nulls last, k.id desc
   ), pohon as (
     select a.permintaan_item_id as akar, i.id, i.qty, 0 as dalam
     from akhir a join public.permintaan_item i on i.id = a.permintaan_item_id
     where a.sumber <> 'gudang'
     union all
     select p.akar, c.id, c.qty, p.dalam + 1
     from pohon p join public.permintaan_item c on c.induk_item_id = p.id and c.is_hutang
     where p.dalam < 50
   ), total as (
     select akar, sum(coalesce(qty, 0)) as qty_total, count(*) - 1 as jumlah_hutang from pohon group by akar
   )
   select a.permintaan_item_id::text as ref, i.nama_komponen, i.qty as qty_item,
          case when a.sumber = 'gudang' then i.qty else t.qty_total end as qty_dibandingkan,
          coalesce(a.qty_final, a.qty_diusulkan) as qty_koreksi_terakhir, (a.qty_final is null) as qty_final_tidak_tercatat,
          a.sumber, t.jumlah_hutang, a.qty_lama, a.qty_diusulkan, i.satuan, i.status as status_item, i.is_hutang,
          m.id as permintaan, m.wo_number, m.proyek, m.panel_nama, a.diajukan_oleh, a.disetujui_oleh, a.diputuskan_at,
          'peringatan' as tingkat
   from akhir a
   join public.permintaan_item i on i.id = a.permintaan_item_id
   join public.permintaan m on m.id = i.permintaan_id
   left join total t on t.akar = a.permintaan_item_id
   where (case when a.sumber = 'gudang' then i.qty else t.qty_total end) is distinct from coalesce(a.qty_final, a.qty_diusulkan)
   order by a.diputuskan_at desc $q$
 else public._sql_cek_kesehatan_k1_k27(p_kode)
end
$f$;

update public.kesehatan_cek
set penjelasan = 'Item permintaan yang qty-nya tidak sama dengan qty disetujui pada koreksi terakhir (qty_final; koreksi lama: qty_diusulkan). '
  || 'Koreksi oleh Admin (sebelum disiapkan / saat menyetujui) dibandingkan dengan qty item + semua hutang turunannya (pemenuhan sebagian sah).'
where kode = 'K19';

notify pgrst, 'reload schema';
commit;
