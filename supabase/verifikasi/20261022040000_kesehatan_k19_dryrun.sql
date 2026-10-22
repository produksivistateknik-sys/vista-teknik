-- DRY-RUN K19 (BACA SAJA) - jalankan SESUDAH 20261022030000_koreksi_qty_final.sql & SEBELUM migration K19.
-- Harapan 22 Okt 2026: 1 baris (item 1968 VINIL 8 BROWN @100PCS, qty 3, koreksi terakhir 0, qty_final tidak tercatat).
with akhir as (
     select distinct on (k.permintaan_item_id) k.*
     from public.permintaan_item_koreksi k
     where k.status = 'disetujui'
     order by k.permintaan_item_id, k.diputuskan_at desc nulls last, k.id desc
   )
   select a.permintaan_item_id::text as ref, i.nama_komponen, i.qty as qty_item,
          coalesce(a.qty_final, a.qty_diusulkan) as qty_koreksi_terakhir, (a.qty_final is null) as qty_final_tidak_tercatat,
          a.qty_lama, a.qty_diusulkan, i.satuan, i.status as status_item, i.is_hutang,
          m.id as permintaan, m.wo_number, m.proyek, m.panel_nama, a.diajukan_oleh, a.disetujui_oleh, a.diputuskan_at,
          'peringatan' as tingkat
   from akhir a
   join public.permintaan_item i on i.id = a.permintaan_item_id
   join public.permintaan m on m.id = i.permintaan_id
   where i.qty is distinct from coalesce(a.qty_final, a.qty_diusulkan)
   order by a.diputuskan_at desc;
