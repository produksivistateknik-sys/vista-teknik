-- =====================================================================================================
-- PINDAH PERMINTAAN WO 223 -> WO 220/199 + HAPUS WO 223 (dobel "085 GALLON LINE & BIOMASS")
-- 28 Okt 2026. Dijalankan MANUAL di SQL Editor, BAGIAN DEMI BAGIAN (jangan sekaligus).
-- Identifikasi HANYA dengan id (tiga WO bernomor 085: 199, 220, 223).
--
--   BAGIAN 0  : pemeriksaan awal (baca saja)
--   BAGIAN 1  : pindah permintaan 1426-1429 (transaksi, cadangan permanen, idempotent)
--   BAGIAN 1R : ROLLBACK bagian 1 (dari tabel cadangan)
--   BAGIAN 2  : hapus gambar + event + WO 223 lewat hapus_wo_aman (transaksi, cadangan permanen)
--   BAGIAN 2R : ROLLBACK bagian 2 (HANYA bisa sebelum file R2 dihapus - langkah 3)
--   LANGKAH 3 : hapus 13 file PDF di R2 lewat Edge Function r2-storage (BUKAN SQL - dijalankan
--               Claude/aplikasi setelah bagian 2 terbukti benar), lalu verifikasi URL = 404.
--
-- Tabel cadangan TIDAK dihapus setelah selesai (jejak permanen). Akses anon/authenticated dicabut.
-- =====================================================================================================


-- =====================================================================================================
-- BAGIAN 0 - PEMERIKSAAN AWAL (baca saja)
-- =====================================================================================================
-- 0a. Kondisi permintaan sekarang (harus: wo_id 223, panel 564/566/570/574)
select p.id, p.wo_id, p.panel_id, p.wo_number, p.proyek, p.panel_nama, p.status, p.created_at,
       (select count(*) from public.permintaan_item i where i.permintaan_id = p.id) as n_item
  from public.permintaan p where p.id in (1426, 1427, 1428, 1429) order by p.id;

-- 0b. Panel target ada & milik WO yang benar (575/576 -> 220, 578/579 -> 199)
select pn.id, pn.wo_id, w.wo, w.proyek, pn.nama, pn.deleted_at
  from public.panels pn join public.work_orders w on w.id = pn.wo_id
 where pn.id in (564, 566, 570, 574, 575, 576, 578, 579) order by pn.id;

-- 0c. Trigger yang ada di tabel yang disentuh (cek tidak ada trigger tak terduga)
select event_object_table, trigger_name, action_timing, event_manipulation
  from information_schema.triggers
 where event_object_schema = 'public'
   and event_object_table in ('permintaan', 'permintaan_item', 'work_orders', 'panels', 'work_instructions',
                              'wi_revisions', 'wo_engineering_events', 'wo_engineering_events_dibaca', 'wo_dilihat_admin')
 order by 1, 2;

-- 0d. hapus_wo_aman versi LIVE masih menolak WO bergambar & berpermintaan (harus true, true)
select pg_get_functiondef('public.hapus_wo_aman(bigint,text,text)'::regprocedure) ilike '%work_instructions%' as cek_gambar,
       pg_get_functiondef('public.hapus_wo_aman(bigint,text,text)'::regprocedure) ilike '%panel_id_arsip%'    as cek_permintaan;

-- 0e. FK lain yang menunjuk ke work_orders / panels (pastikan tidak ada tabel tak terduga berisi data WO 223)
select c.conrelid::regclass as tabel, c.confrelid::regclass as ke, c.confdeltype as on_delete, pg_get_constraintdef(c.oid)
  from pg_constraint c
 where c.contype = 'f' and c.confrelid in ('public.work_orders'::regclass, 'public.panels'::regclass)
 order by 2, 1;


-- =====================================================================================================
-- BAGIAN 1 - PINDAH PERMINTAAN 1426-1429  (idempotent: jalankan ulang = tidak mengubah apa-apa)
--   Yang berubah HANYA header permintaan: wo_id, panel_id, proyek, panel_nama (wo_number tetap '085').
--   permintaan_item (status, qty, setuju DIMAS, diinput Mowhan, dst) TIDAK disentuh - dibuktikan dgn md5.
-- =====================================================================================================
begin;

create table if not exists public.cadangan_pindah_permintaan_20261028 (
  permintaan_id   bigint primary key,
  wo_id_lama      bigint, panel_id_lama bigint, wo_number_lama text, proyek_lama text, panel_nama_lama text,
  wo_id_baru      bigint, panel_id_baru bigint, proyek_baru text, panel_nama_baru text,
  item_md5_sebelum text,  n_item_sebelum int,
  dicadangkan_pada timestamptz not null default now(),
  catatan         text not null default 'Pindah permintaan dari WO 223 (dobel 085) ke WO 220/199, 28 Okt 2026'
);
create table if not exists public.cadangan_pindah_permintaan_item_20261028 (
  item_id bigint primary key, permintaan_id bigint not null, data jsonb not null,
  dicadangkan_pada timestamptz not null default now()
);
revoke all on public.cadangan_pindah_permintaan_20261028      from anon, authenticated;
revoke all on public.cadangan_pindah_permintaan_item_20261028 from anon, authenticated;

create temp table _peta (permintaan_id bigint primary key, panel_sumber bigint not null, panel_target bigint not null) on commit drop;
insert into _peta values (1426, 564, 575), (1427, 566, 576), (1428, 570, 578), (1429, 574, 579);

do $$
declare r record; v_md5 text; v_n int;
begin
  -- penjaga: tiap permintaan harus di panel sumber (belum dipindah) ATAU sudah di panel target (sudah dipindah)
  for r in select m.*, p.panel_id, p.wo_id from _peta m left join public.permintaan p on p.id = m.permintaan_id loop
    if r.panel_id is null and r.wo_id is null then
      raise exception 'Permintaan % tidak ditemukan / tanpa panel. Dibatalkan.', r.permintaan_id;
    end if;
    if not ((r.panel_id = r.panel_sumber and r.wo_id = 223) or r.panel_id = r.panel_target) then
      raise exception 'Permintaan % ada di panel % / WO % (bukan sumber % maupun target %). Dibatalkan.',
        r.permintaan_id, r.panel_id, r.wo_id, r.panel_sumber, r.panel_target;
    end if;
  end loop;
  -- penjaga: panel target harus milik WO 220 (575,576) / 199 (578,579) dan tidak terhapus
  if (select count(*) from public.panels where deleted_at is null and
        ((id in (575, 576) and wo_id = 220) or (id in (578, 579) and wo_id = 199))) <> 4 then
    raise exception 'Panel target 575/576 (WO 220) & 578/579 (WO 199) tidak sesuai. Dibatalkan.';
  end if;
end $$;

-- cadangan nilai lama (hanya utk yang BELUM dipindah; on conflict = cadangan pertama tetap utuh)
insert into public.cadangan_pindah_permintaan_item_20261028 (item_id, permintaan_id, data)
select i.id, i.permintaan_id, to_jsonb(i)
  from public.permintaan_item i join _peta m on m.permintaan_id = i.permintaan_id
  join public.permintaan p on p.id = m.permintaan_id and p.panel_id = m.panel_sumber
on conflict (item_id) do nothing;

insert into public.cadangan_pindah_permintaan_20261028
  (permintaan_id, wo_id_lama, panel_id_lama, wo_number_lama, proyek_lama, panel_nama_lama,
   wo_id_baru, panel_id_baru, proyek_baru, panel_nama_baru, item_md5_sebelum, n_item_sebelum)
select p.id, p.wo_id, p.panel_id, p.wo_number, p.proyek, p.panel_nama,
       t.wo_id, t.id, w.proyek, t.nama,
       (select md5(string_agg(to_jsonb(i)::text, '|' order by i.id)) from public.permintaan_item i where i.permintaan_id = p.id),
       (select count(*) from public.permintaan_item i where i.permintaan_id = p.id)
  from _peta m join public.permintaan p on p.id = m.permintaan_id and p.panel_id = m.panel_sumber
  join public.panels t on t.id = m.panel_target join public.work_orders w on w.id = t.wo_id
on conflict (permintaan_id) do nothing;

-- UPDATE berdasarkan id (hanya yang masih di panel sumber) + jejak activity_log per permintaan
with ubah as (
  update public.permintaan p
     set wo_id = t.wo_id, panel_id = t.id, proyek = w.proyek, panel_nama = t.nama
    from _peta m, public.panels t, public.work_orders w
   where p.id = m.permintaan_id and p.panel_id = m.panel_sumber and p.wo_id = 223
     and t.id = m.panel_target and w.id = t.wo_id
  returning p.id, p.wo_id, p.panel_id, p.wo_number, p.proyek, p.panel_nama, m.panel_sumber
)
insert into public.activity_log (user_name, action, description, module, halaman, proyek, wo_number)
select 'LUTVAN', 'PINDAH PERMINTAAN',
       'Permintaan #' || u.id || ' dipindah dari WO id 223 panel #' || u.panel_sumber || ' ke WO id ' || u.wo_id ||
       ' panel #' || u.panel_id || ' (' || trim(u.panel_nama) || ') - WO 223 dobel 085, status/item tidak berubah',
       'permintaan', 'SQL Editor', u.proyek, u.wo_number
  from ubah u;

-- verifikasi DALAM transaksi: semua di target, item persis sama dgn cadangan (md5), WO 223 tanpa permintaan
do $$
declare v_salah int;
begin
  select count(*) into v_salah from _peta m join public.permintaan p on p.id = m.permintaan_id
   where p.panel_id <> m.panel_target
      or p.wo_id <> (select wo_id from public.panels where id = m.panel_target);
  if v_salah > 0 then raise exception 'Verifikasi gagal: % permintaan belum di panel target. ROLLBACK.', v_salah; end if;

  select count(*) into v_salah from public.cadangan_pindah_permintaan_20261028 c
   where c.item_md5_sebelum is distinct from
         (select md5(string_agg(to_jsonb(i)::text, '|' order by i.id)) from public.permintaan_item i where i.permintaan_id = c.permintaan_id)
      or c.n_item_sebelum <> (select count(*) from public.permintaan_item i where i.permintaan_id = c.permintaan_id);
  if v_salah > 0 then raise exception 'Verifikasi gagal: item % permintaan berubah. ROLLBACK.', v_salah; end if;

  select count(*) into v_salah from public.permintaan
   where wo_id = 223 or panel_id in (select id from public.panels where wo_id = 223)
      or panel_id_arsip in (select id from public.panels where wo_id = 223);
  if v_salah > 0 then raise exception 'Verifikasi gagal: WO 223 masih punya % permintaan. ROLLBACK.', v_salah; end if;
  raise notice 'BAGIAN 1 OK: 4 permintaan di panel target, item tidak berubah, WO 223 tanpa permintaan.';
end $$;

commit;

-- 1-verifikasi (setelah commit): jumlah permintaan & item per panel. Harapan:
--   564/566/570/574 = 0 ; 575 = 1/1 ; 576 = 1/1 ; 578 = 1/2 ; 579 = 1/2 ; total item 6, status semua 'submit'
select pn.id as panel_id, pn.wo_id, trim(pn.nama) as panel,
       count(distinct p.id) as n_permintaan, count(i.id) as n_item,
       string_agg(distinct i.status, ',') as status_item, bool_and(i.sudah_diinput) as semua_diinput
  from public.panels pn
  left join public.permintaan p on p.panel_id = pn.id
  left join public.permintaan_item i on i.permintaan_id = p.id
 where pn.id in (564, 566, 570, 574, 575, 576, 578, 579)
 group by pn.id, pn.wo_id, pn.nama order by pn.id;
select * from public.cadangan_pindah_permintaan_20261028 order by permintaan_id;


-- =====================================================================================================
-- BAGIAN 1R - ROLLBACK BAGIAN 1 (kembalikan header dari cadangan; item memang tidak pernah diubah)
-- =====================================================================================================
-- begin;
-- with balik as (
--   update public.permintaan p
--      set wo_id = c.wo_id_lama, panel_id = c.panel_id_lama, wo_number = c.wo_number_lama,
--          proyek = c.proyek_lama, panel_nama = c.panel_nama_lama
--     from public.cadangan_pindah_permintaan_20261028 c
--    where p.id = c.permintaan_id and p.panel_id = c.panel_id_baru            -- hanya yang masih di target
--      and exists (select 1 from public.panels where id = c.panel_id_lama)    -- WO 223 belum dihapus
--   returning p.id, c.panel_id_baru, c.panel_id_lama
-- )
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- select 'LUTVAN', 'ROLLBACK PINDAH PERMINTAAN', 'Permintaan #' || id || ' dikembalikan dari panel #' || panel_id_baru || ' ke panel #' || panel_id_lama,
--        'permintaan', 'SQL Editor' from balik;
-- select id, wo_id, panel_id, proyek, panel_nama from public.permintaan where id in (1426, 1427, 1428, 1429) order by id;
-- commit;


-- =====================================================================================================
-- BAGIAN 2 - HAPUS GAMBAR + EVENT + WO 223  (setelah BAGIAN 1 terbukti; idempotent)
--   Urutan: cadangan -> event "tambah" WO 223 (dibaca ikut cascade) -> gambar (revisi ikut cascade)
--           -> hapus_wo_aman(223) (panel + wo_dilihat_admin ikut). Event/gambar WO 220/199 TIDAK disentuh
--           (semua DELETE memakai daftar id eksplisit + wo_id = 223).
--   File PDF di R2 TIDAK terhapus oleh SQL -> LANGKAH 3.
-- =====================================================================================================
begin;

create table if not exists public.cadangan_hapus_wo223_20261028 (
  tabel text not null, baris_id text not null, data jsonb not null,
  dicadangkan_pada timestamptz not null default now(),
  primary key (tabel, baris_id)
);
revoke all on public.cadangan_hapus_wo223_20261028 from anon, authenticated;

do $$
declare v_n int;
begin
  if not exists (select 1 from public.work_orders where id = 223) then
    raise notice 'WO 223 sudah tidak ada - BAGIAN 2 dilewati.';
    return;
  end if;
  -- penjaga 1: WO 223 memang "085 GALLON LINE & BIOMASS" dgn 13 panel 562-574
  if (select count(*) from public.panels where wo_id = 223) <> 13
     or exists (select 1 from public.panels where wo_id = 223 and id not between 562 and 574) then
    raise exception 'Panel WO 223 bukan 13 panel 562-574. Dibatalkan.';
  end if;
  -- penjaga 2: tanpa permintaan (BAGIAN 1 harus sudah jalan)
  select count(*) into v_n from public.permintaan
   where wo_id = 223 or panel_id between 562 and 574 or panel_id_arsip between 562 and 574;
  if v_n > 0 then raise exception 'WO 223 masih punya % permintaan - jalankan BAGIAN 1 dulu.', v_n; end if;
  -- penjaga 3: WO 223 tetap kosong (tanpa jadwal/renhar/timer/progres/kendala/qty log) spt saat investigasi
  if exists (select 1 from public.raw_schedule where wo_id = 223 or panel_id between 562 and 574)
     or exists (select 1 from public.renhar where wo_id = 223 or panel_id between 562 and 574)
     or exists (select 1 from public.fcs_timer_kerja where panel_id between 562 and 574)
     or exists (select 1 from public.component_process_progress where panel_id between 562 and 574)
     or exists (select 1 from public.progress_checkpoint_log where panel_id between 562 and 574)
     or exists (select 1 from public.kendala_produksi where wo_id = 223 or panel_id between 562 and 574)
     or exists (select 1 from public.qty_change_log where wo_id = 223 or panel_id between 562 and 574) then
    raise exception 'WO 223 ternyata sudah punya data produksi (jadwal/renhar/timer/progres/kendala/qty). Dibatalkan - laporkan.';
  end if;
  -- penjaga 4: gambar sumber = 13 slot (wi 133-145), 1 revisi masing2 (rev 160-172)
  if (select count(*) from public.work_instructions where wo_id = 223) <> 13
     or exists (select 1 from public.work_instructions where wo_id = 223 and id not between 133 and 145)
     or (select count(*) from public.wi_revisions where work_instruction_id between 133 and 145) <> 13 then
    raise exception 'Gambar WO 223 tidak lagi 13 slot/13 revisi (ada perubahan sejak investigasi). Dibatalkan.';
  end if;
  -- penjaga 5: setiap panel target punya revisi BERLAKU tak dibatalkan (gambar pengganti duplikat ada)
  if (select count(distinct w.panel_id) from public.work_instructions w join public.wi_revisions r on r.work_instruction_id = w.id
       where w.panel_id in (528, 529, 575, 530, 576, 532, 577, 525, 578, 526, 527, 531, 579)
         and r.is_current and coalesce(r.is_cancelled, false) = false) <> 13 then
    raise exception 'Ada panel target tanpa gambar berlaku - jangan buang gambar sumber. Dibatalkan.';
  end if;
  -- penjaga 6: event WO 223 = 14 "tambah" (id 162-175)
  if (select count(*) from public.wo_engineering_events where wo_id = 223) <> 14
     or exists (select 1 from public.wo_engineering_events where wo_id = 223 and (id not between 162 and 175 or jenis_perubahan <> 'tambah')) then
    raise exception 'Event WO 223 bukan 14 "tambah" id 162-175. Dibatalkan.';
  end if;

  -- CADANGAN PERMANEN (to_jsonb baris utuh)
  insert into public.cadangan_hapus_wo223_20261028 (tabel, baris_id, data)
  select 'work_orders', id::text, to_jsonb(w) from public.work_orders w where id = 223
  union all select 'panels', id::text, to_jsonb(p) from public.panels p where wo_id = 223
  union all select 'work_instructions', id::text, to_jsonb(x) from public.work_instructions x where wo_id = 223
  union all select 'wi_revisions', id::text, to_jsonb(r) from public.wi_revisions r where work_instruction_id between 133 and 145
  union all select 'wo_engineering_events', id::text, to_jsonb(e) from public.wo_engineering_events e where wo_id = 223
  union all select 'wo_engineering_events_dibaca', d.event_id::text || '|' || d.akun, to_jsonb(d)
         from public.wo_engineering_events_dibaca d where d.event_id between 162 and 175
  union all select 'wo_dilihat_admin', wo_id::text || '|' || admin_nama, to_jsonb(a) from public.wo_dilihat_admin a where wo_id = 223
  on conflict (tabel, baris_id) do nothing;

  -- 1) event "tambah" WO 223 (dibaca ikut cascade). Event WO 220/199 aman: filter id DAN wo_id = 223.
  delete from public.wo_engineering_events where wo_id = 223 and id between 162 and 175 and jenis_perubahan = 'tambah';
  get diagnostics v_n = row_count;
  if v_n <> 14 then raise exception 'Hapus event: % baris (harus 14). ROLLBACK.', v_n; end if;

  -- 2) gambar WO 223 (wi_revisions ikut cascade) - isi identik dgn gambar berlaku panel target (bukti di laporan)
  delete from public.work_instructions where wo_id = 223 and id between 133 and 145;
  get diagnostics v_n = row_count;
  if v_n <> 13 then raise exception 'Hapus gambar: % baris (harus 13). ROLLBACK.', v_n; end if;

  insert into public.activity_log (user_name, action, description, module, halaman, proyek, wo_number)
  values ('LUTVAN', 'HAPUS GAMBAR WO DOBEL',
          'Gambar WO Digital WO id 223 (13 slot wi 133-145, rev 160-172) dihapus: isi identik dgn gambar berlaku panel target di WO 220/199; 14 event tambah (162-175) dihapus. File R2 dihapus terpisah. Cadangan: cadangan_hapus_wo223_20261028',
          'wo_digital', 'SQL Editor', 'GALLON LINE & BIOMASS', '085');

  -- 3) WO 223 lewat jalur resmi (panel ikut, wo_dilihat_admin cascade, log HAPUS WO ditulis fungsi)
  perform public.hapus_wo_aman(223, 'LUTVAN', 'SQL Editor');

  -- verifikasi dalam transaksi
  if exists (select 1 from public.work_orders where id = 223) or exists (select 1 from public.panels where wo_id = 223)
     or exists (select 1 from public.wo_dilihat_admin where wo_id = 223) or exists (select 1 from public.wi_revisions where work_instruction_id between 133 and 145) then
    raise exception 'Verifikasi gagal: sisa data WO 223. ROLLBACK.';
  end if;
  raise notice 'BAGIAN 2 OK: WO 223 + 13 panel + 13 gambar + 14 event terhapus, cadangan tersimpan.';
end $$;

commit;

-- 2-verifikasi (setelah commit). Harapan: 0,0,0,0 ; event 220/199 tetap (176-194 = 19 baris) ; gambar target 13 berlaku
select (select count(*) from public.work_orders where id = 223) as wo,
       (select count(*) from public.panels where id between 562 and 574) as panel,
       (select count(*) from public.work_instructions where wo_id = 223) as gambar,
       (select count(*) from public.wo_engineering_events where id between 162 and 175) as event_223,
       (select count(*) from public.wo_engineering_events where wo_id in (199, 220) and id between 176 and 194) as event_saudara,
       (select count(*) from public.work_instructions w join public.wi_revisions r on r.work_instruction_id = w.id
         where w.panel_id in (528, 529, 575, 530, 576, 532, 577, 525, 578, 526, 527, 531, 579) and r.is_current) as gambar_target_berlaku;
select tabel, count(*) from public.cadangan_hapus_wo223_20261028 group by tabel order by tabel;
-- harapan: panels 13, wi_revisions 13, wo_dilihat_admin 3, wo_engineering_events 14, wo_engineering_events_dibaca 56, work_instructions 13, work_orders 1
-- (yang dihapus otomatis oleh hapus_wo_aman sendiri: lihat activity_log 'HAPUS WO' terbaru)


-- =====================================================================================================
-- BAGIAN 2R - ROLLBACK BAGIAN 2 (HANYA SEBELUM LANGKAH 3 - setelah file R2 dihapus, gambar tak bisa
--             dipulihkan dari sini). Urutan kebalikan: WO -> panel -> gambar -> revisi -> event -> dibaca -> dilihat.
-- =====================================================================================================
-- begin;
-- insert into public.work_orders overriding system value
--   select (jsonb_populate_record(null::public.work_orders, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'work_orders'
--   on conflict (id) do nothing;
-- insert into public.panels overriding system value
--   select (jsonb_populate_record(null::public.panels, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'panels'
--   on conflict (id) do nothing;
-- insert into public.work_instructions overriding system value
--   select (jsonb_populate_record(null::public.work_instructions, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'work_instructions'
--   on conflict (id) do nothing;
-- insert into public.wi_revisions overriding system value
--   select (jsonb_populate_record(null::public.wi_revisions, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'wi_revisions'
--   on conflict (id) do nothing;
-- insert into public.wo_engineering_events overriding system value
--   select (jsonb_populate_record(null::public.wo_engineering_events, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'wo_engineering_events'
--   on conflict (id) do nothing;
-- insert into public.wo_engineering_events_dibaca
--   select (jsonb_populate_record(null::public.wo_engineering_events_dibaca, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'wo_engineering_events_dibaca'
--   on conflict do nothing;
-- insert into public.wo_dilihat_admin
--   select (jsonb_populate_record(null::public.wo_dilihat_admin, data)).* from public.cadangan_hapus_wo223_20261028 where tabel = 'wo_dilihat_admin'
--   on conflict do nothing;
-- insert into public.activity_log (user_name, action, description, module, halaman)
-- values ('LUTVAN', 'ROLLBACK HAPUS WO', 'WO id 223 + panel/gambar/event dipulihkan dari cadangan_hapus_wo223_20261028', 'wo', 'SQL Editor');
-- select (select count(*) from public.panels where wo_id = 223) as panel, (select count(*) from public.work_instructions where wo_id = 223) as gambar;
-- commit;


-- =====================================================================================================
-- LANGKAH 3 - FILE R2 (BUKAN SQL). Setelah 2-verifikasi benar, 13 key ini dihapus lewat Edge Function
-- r2-storage {action:'delete', key} (cara aplikasi, lib/r2Client.deleteFromR2), lalu tiap URL publik
-- dicek 404. Gambar target TIDAK disentuh (key berawalan wo-digital/220/ & wo-digital/199/).
--   wo-digital/223/panel-562/1793168861450_e5ossj.pdf   wo-digital/223/panel-569/1793168935067_l4s9n1.pdf
--   wo-digital/223/panel-563/1793168872233_babar0.pdf   wo-digital/223/panel-570/1793168944785_sxdqgy.pdf
--   wo-digital/223/panel-564/1793168883916_ldsyhb.pdf   wo-digital/223/panel-571/1793168954694_ttb05y.pdf
--   wo-digital/223/panel-565/1793168893923_6znnn3.pdf   wo-digital/223/panel-572/1793168964263_s9o0yl.pdf
--   wo-digital/223/panel-566/1793168903711_s4mron.pdf   wo-digital/223/panel-573/1793168974785_cmiw66.pdf
--   wo-digital/223/panel-567/1793168914368_9y2juf.pdf   wo-digital/223/panel-574/1793168984912_goy8iz.pdf
--   wo-digital/223/panel-568/1793168925379_o75vu8.pdf
-- =====================================================================================================
