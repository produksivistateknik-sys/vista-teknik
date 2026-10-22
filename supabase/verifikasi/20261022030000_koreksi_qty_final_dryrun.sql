-- DRY-RUN qty_final (BACA SAJA). Harapan 22 Okt 2026: kolom qty_final belum ada; 17 koreksi, semua 'disetujui',
-- 0 'menunggu' (aman mengganti RPC); 1 item yang qty-nya beda dari qty_diusulkan koreksi terakhir (1968).
select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permintaan_item_koreksi' and column_name = 'qty_final') as kolom_sudah_ada;
select status, count(*) from public.permintaan_item_koreksi group by status;
with akhir as (select distinct on (permintaan_item_id) * from public.permintaan_item_koreksi where status = 'disetujui'
               order by permintaan_item_id, diputuskan_at desc nulls last, id desc)
select a.permintaan_item_id, i.nama_komponen, i.qty as qty_item, a.qty_diusulkan, a.disetujui_oleh, a.diputuskan_at
from akhir a join public.permintaan_item i on i.id = a.permintaan_item_id where i.qty is distinct from a.qty_diusulkan;
