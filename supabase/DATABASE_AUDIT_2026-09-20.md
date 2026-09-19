# Audit Struktur Database — Vista Teknik ERP

**Tanggal**: 20 Sep 2026 · **Sifat**: Read-only, murni riset untuk bahan rencana restrukturisasi. Tidak ada perubahan dieksekusi.

**Status**: Bagian C/D/E lengkap (diambil via anon key + code search). Bagian A/B **menunggu hasil query SQL Editor** — anon key tidak bisa introspeksi `information_schema`/`pg_catalog` (dicek langsung, gagal dgn "Could not find the table"). Lihat instruksi di bagian A/B.

---

## Bagian A — Skema Lengkap

### A.1 Daftar tabel + kolom (schema `public`, 65 tabel)

Format: `kolom: tipe` — `*` di akhir = NOT NULL. Kolom `id`/`created_at`/timestamp standar dipadatkan kalau polanya seragam.

**Inti produksi**
- **`panels`** — `id: bigint*, wo_id: bigint, no_pnl: integer*, nama: text*, tipe: text*, qty: integer*(1), checklist: jsonb({}), catatan: text(''), created_at/updated_at/updated_by/deleted_at/deleted_by, busbar_progress: jsonb({}), synced_proses: text[]({}), nameplate_progress: integer(0), nameplate_updated_by/at, yellowmark_progress: integer(0), yellowmark_updated_by/at, nameplate_history/yellowmark_history: jsonb([]), qc_checklist: jsonb({}), qc_foto: jsonb([]), packing_done: boolean(false), packing_done_by/at, komponen_status: jsonb({}), tingkat_kesulitan: text('EASY'), nameplate_photos/yellowmark_photos/pasang_komponen_photos: jsonb*([]), warehouse_progress: integer*(0), warehouse_photos: jsonb*([]), warehouse_updated_by/at, warehouse_history: jsonb*([]), qs_progress: integer*(0), qs_photos: jsonb*([]), qs_updated_by/at, qs_history: jsonb*([]), jumlah_cell: integer`
- **`panels_archived`** — identik `panels` + `diarsipkan_pada, diarsipkan_oleh, progress_snapshot: numeric, wo_number_snapshot: text, proyek_snapshot: text` (lihat C.10, sudah sinkron 100%)
- **`work_orders`** — `id*, wo: text*, proyek: text*, target: date*, created_at/updated_at/updated_by, deleted_at/deleted_by, is_archived: boolean(false)`
- **`raw_schedule`** — `id*, wo_id, panel_id, proyek: text*, panel: text*, proses: text*, prioritas: text('Sedang'), schedule: jsonb({}), created_at/updated_at/updated_by/deleted_at/deleted_by, busbar_schedule: jsonb({}), busbar_jejak: jsonb*({}), bobot_komponen: jsonb({})`
- **`raw_schedule_archived`** — sama + `diarsipkan_pada/oleh` (TANPA `bobot_komponen` nullable sama — cek konsisten)
- **`renhar`** — `id*, raw_id, wo_id, panel_id, proyek*, panel*, proses*, prioritas('Sedang'), wp: text*, komponen: jsonb([]), tanggal: date*, divisi: text*, pekerja: jsonb([]), carry_over: boolean(false), created_at/updated_at/updated_by, catatan: text, deleted_at/deleted_by, pekerja_per_komponen: jsonb({}), komponen_released: text[]({})`
- **`renhar_archived`** — sama + `diarsipkan_pada/oleh`
- **`fcs_timer_kerja`** — `id*, pekerja_id: bigint*, panel_id: bigint*, kode_komponen: text*, proses: text*, tanggal: date*, mulai: timestamptz*, selesai: timestamptz, durasi_menit: numeric(8,2) [generated: `selesai IS NOT NULL → EXTRACT(epoch FROM selesai-mulai)/60`], created_at, tahap: text, progress: numeric`
- **`fcs_timer_kerja_archived`** — sama + `diarsipkan_pada/oleh`
- **`panel_seksi_archived`** — `id*, panel_id: bigint*, wo_id, seksi: text*, kode: text*(''), komponen_nama, data: jsonb*, panel_nama, panel_tipe, proyek_snapshot, wo_number_snapshot, diarsipkan_pada: timestamptz*, diarsipkan_oleh`
- **`work_instructions`** — `id*, wo_id: bigint*, panel_id: bigint (nullable), judul: text*, created_at*`
- **`wi_revisions`** — `id*, work_instruction_id: bigint*, revision_number: integer*, rev_mark, file_url: text*, page_count, is_current: boolean*(true), uploaded_by, uploaded_at*, is_cancelled: boolean*(false), cancel_reason, cancelled_by, cancelled_at`
- **`wo_engineering_events`** / **`wo_engineering_events_dibaca`** — banner in-app, seperti dilaporkan sesi ini.

**BOM & referensi komponen**
- `bom_master` — `kode_komponen, nama_komponen, tipe_panel, wp, urutan` (unik `kode_komponen+tipe_panel`)
- `bom_proses_relevan` — `kode_komponen, tipe_panel, jenis_pekerjaan` (unik gabungan 3 kolom — RLS tanpa policy DELETE, lihat E.8)
- `panel_type_meta`, `panel_wp_meta` — label/warna/urutan tampilan tipe panel & WP
- `komponen_master`, `komponen_bbmb_master`, `komponen_stok`, `komponen_stok_masuk`, `komponen_tambahan` — gudang/material, TERPISAH total dari `bom_master` (BOM mekanik panel)

**Kapasitas & penjadwalan kapasitas (FCS)**
- `fcs_process_time` — menit/pcs per kode+proses+tipe (dasar hitung kapasitas)
- `fcs_kapasitas_pekerjaan` — kapasitas menit/hari + hari kerja per jenis pekerjaan
- `fcs_kapasitas_override` — override harian (jam ATAU orang, kolom `kapasitas_unit` generated dari `tipe_kapasitas`)
- `fcs_schedule` / `fcs_schedule_archived` — **BARU DITEMUKAN sesi ini** (belum pernah disinggung investigasi sebelumnya) — tabel scheduling detail per kode+proses+tanggal dengan `status` (`'planning'` default), `qty_hari`, `total_menit`, `approved_by/at` — TERPISAH dari `raw_schedule`. Ada trigger yang mensinkronkannya dari `panels`/`renhar` (lihat A.4).
- `auto_geser_runs` — jejak run auto-geser harian (PK `hari_sumber`)

**Operator, arsip WO, forum, dsb**
- `pekerja`, `admins`, `operator_users` (username unik, password ter-hash via trigger), `profiles` (FK ke `users` auth Supabase — TIDAK ter-dump di query ini karena `auth.users` beda schema)
- `fcs_arsip_wo` — snapshot WO selesai (ringkasan operator, rincian panel, kendala, dsb — 1 baris per WO diarsipkan)
- `fcs_tracking_komponen` / `_archived` + `fcs_tracking_komponen_foto` / `_archived` — tracking terpisah dari `checklist`, `sub_bagian` dibatasi CHECK ke 4 nilai (`Warehouse/Assembling/QS/QC`)
- `fcs_forum_post` / `fcs_forum_attachment` — forum internal
- `fcs_notifikasi` — notifikasi "komponen tersedia" ke operator, terhubung `timer_id`
- `progress_checkpoint_log` / `_archived` — histori checkpoint simpan-progress (dipakai `simpanProgress()`)
- `qty_change_log`, `qty_fixes` (tabel adhoc tanpa PK terlihat — kemungkinan sisa investigasi manual lampau)
- `kendala` / `_archived`, `kendala_log` (drift penamaan — 2 tabel kendala berbeda struktur, `kendala_log` py FK ke `profiles`, jarang dipakai?)

**Maintenance/mesin**
- `mesin`, `machines` — **DUA tabel mesin terpisah** (drift penamaan lama, `mesin` dipakai fitur QR/Maintenance Rutin sesi-sesi sebelumnya, `machines`+`maintenance_logs`+`service_schedule` kelihatan seperti sistem lama/paralel yang belum dikonsolidasi)
- `maintenance_rutin` + `maintenance_rutin_log` + `maintenance_reminder_log` — jadwal servis rutin + histori + log pengingat (dedup unik)
- `maintenance_log` — histori kendala/perbaikan per mesin (`update_harian`, `foto` sebagai jsonb array)

**Gudang & permintaan barang**
- `permintaan` + `permintaan_item` (+ `induk_item_id` self-FK utk hutang barang) + `permintaan_item_koreksi`
- `gudang_lock_status` (single-row, CHECK `id=1`), `gudang_read_state`

**Lain-lain**
- `mom_fat` + `mom_fat_poin` — dokumen MOM/FAT dgn OCR checklist poin
- `proyek_luar` — kerja proyek luar (non-WO)
- `activity_log` — log aktivitas global
- `push_subscriptions` — Web Push (unik per `endpoint`)
- `app_documentation` — dokumentasi in-app per tab
- `media_rotasi` — rotasi foto tersimpan (PK = `url`)

### A.2 Foreign Key (39 constraint)

Pola FK **jarang** dipakai untuk relasi inti — mayoritas tabel besar (`panels`, `raw_schedule`, `renhar`, `permintaan`, `fcs_tracking_komponen`) SEMUA `FK ON id → id`, standar. Yang perlu dicatat:
- **`panels_archived` TIDAK punya FK ke `work_orders`** (sengaja, per desain arsip — panel tetap ada walau WO dihapus) — beda dari `panels` yang punya `panels_wo_id_fkey`.
- **`panel_seksi_archived` TIDAK punya FK sama sekali** (`panel_id`/`wo_id` polos) — dikonfirmasi desain sengaja per `ARSIP-SCHEMA-SYNC.md`.
- **`fcs_schedule`/`fcs_schedule_archived` TIDAK punya FK** ke `panels`/`work_orders` meski punya kolom `wo_id`/`panel_id` — tabel yang baru ditemukan sesi ini, referential integrity-nya longgar.
- `wi_revisions → work_instructions → panels` (nullable) `/work_orders` — rantai FK Dokumen Gambar Teknik lengkap.
- `permintaan_item.induk_item_id → permintaan_item.id` — self-referencing FK (skema hutang barang).

### A.3 Index (110 index)

Yang relevan langsung ke struktur bug sesi-sesi ini:
- **`fcs_timer_kerja_satu_aktif`** — partial unique index yang baru dibuat sesi ini (`pekerja_id,panel_id,kode_komponen,proses,tanggal,COALESCE(tahap,'')` WHERE `selesai IS NULL`) — **dikonfirmasi AKTIF**.
- **`wi_revisions_one_current`** — partial unique `(work_instruction_id) WHERE is_current` — pola yang ditiru index di atas.
- **`renhar_raw_wp_tanggal_unique`** — unique `(raw_id,wp,tanggal)`, fix duplikat renhar historis.
- **`bom_proses_relevan_kode_komponen_tipe_panel_jenis_pekerjaan_key`** — unique gabungan 3 kolom (kenapa `.delete()` anon key silent-no-op TIDAK dijelaskan index ini — itu soal RLS policy, bukan index; lihat E.8).
- `idx_timer_kerja_belum_selesai` (partial `WHERE selesai IS NULL`) — index parsial mendukung pola "cari timer aktif" yang dipakai berkali-kali di kode.

### A.4 Trigger aktif (11 trigger)

| Trigger | Tabel | Fungsi | Catatan |
|---|---|---|---|
| `trg_panels_auto_archive_seksi` | `panels` AFTER UPDATE | `panels_auto_archive_seksi` | Warehouse/QS/QC (masih auto) — Pasang Komponen SUDAH dihapus sesi ini |
| `trg_panels_auto_archive_nameplate` | `panels` AFTER UPDATE | `panels_auto_archive_nameplate` | Terpisah, tidak disentuh |
| **`trg_panels_validate_busbar_cap`** | `panels` BEFORE UPDATE OF checklist (WHEN checklist berubah) | `panels_validate_busbar_cap_progress` | **Trigger validasi capping BUSBAR yang disinggung task** — belum pernah tereksplorasi sesi-sesi sebelumnya, source-nya di Bagian B |
| **`trg_sync_fcs_from_panel`** | `panels` AFTER UPDATE | `sync_fcs_from_panel_progress` | **BARU DITEMUKAN** — mensinkronkan progress `panels`→`fcs_schedule` (tabel yang juga baru ditemukan) |
| **`trg_sync_fcs_released`** | `renhar` AFTER INSERT | `sync_fcs_status_on_renhar_insert` | **BARU DITEMUKAN** — terhubung ke `fcs_schedule.status` |
| `trg_cleanup_fcs_on_wo_delete` | `work_orders` BEFORE DELETE | `cleanup_fcs_on_wo_delete` | Cascade cleanup manual (bukan FK ON DELETE CASCADE) |
| `trg_admins_hash_password` / `trg_operator_users_hash_password` | `admins`/`operator_users` BEFORE INSERT/UPDATE OF password | `*_hash_password_trigger` | bcrypt hashing |
| `trg_fcs_kapasitas_updated` / `trg_fcs_process_time_updated` / `trg_fcs_schedule_updated` / `trg_fcs_kap_override_updated` | masing2 BEFORE UPDATE | `update_updated_at` | Generic `updated_at=now()`, 1 fungsi dipakai 4 tabel — konsisten |

⚠️ **3 trigger BUSBAR-cap/`fcs_schedule`-sync (ditandai tebal) belum pernah muncul di investigasi/dokumentasi sesi-sesi sebelumnya** — perlu digali source-nya (Bagian B) untuk paham persis apa yang mereka lakukan terhadap `checklist`/`fcs_schedule`, karena berpotensi jadi JALUR TULIS TAMBAHAN ke `panels.checklist` yang belum ter-map di Bagian D.

### A.5 Check Constraint (15 constraint)

Kebanyakan pola `ANY(ARRAY[...])` (enum-via-CHECK) — termasuk yang baru dibuat sesi ini: `wo_engineering_events_jenis_perubahan_check` (`tambah/edit/batal`) dan `panel_seksi_archived_seksi_check` (7 nilai seksi). Tidak ada CHECK constraint apa pun terkait `qty`/`qtyProses`/`progress` (konsisten dengan temuan E — tidak ada validasi numerik di level DB untuk data progress).

---

## Bagian B — Semua Function/RPC + Source (PENDING — jalankan SQL ini)

Jalankan query berikut di Supabase SQL Editor, lalu paste hasilnya (1 kolom JSON) — saya akan susun jadi tabel di laporan final:

```sql
select json_build_object(
  'tables', (
    select json_agg(json_build_object(
      'table', c.relname,
      'columns', (
        select json_agg(json_build_object(
          'column', a.attname,
          'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
          'nullable', not a.attnotnull,
          'default', pg_get_expr(ad.adbin, ad.adrelid)
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      )
    ) order by c.relname)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  ),
  'foreign_keys', (
    select json_agg(json_build_object(
      'constraint', con.conname,
      'table', rel.relname,
      'columns', (select array_agg(att.attname) from unnest(con.conkey) as k(attnum) join pg_attribute att on att.attrelid=con.conrelid and att.attnum=k.attnum),
      'ref_table', frel.relname,
      'ref_columns', (select array_agg(att.attname) from unnest(con.confkey) as k(attnum) join pg_attribute att on att.attrelid=con.confrelid and att.attnum=k.attnum)
    ))
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_class frel on frel.oid=con.confrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where con.contype='f' and n.nspname='public'
  ),
  'indexes', (
    select json_agg(json_build_object('table', tablename, 'index', indexname, 'def', indexdef))
    from pg_indexes where schemaname='public'
  ),
  'triggers', (
    select json_agg(json_build_object(
      'trigger', t.tgname, 'table', c.relname, 'function', p.proname, 'def', pg_get_triggerdef(t.oid)
    ))
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_proc p on p.oid=t.tgfoid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal
  ),
  'check_constraints', (
    select json_agg(json_build_object('table', rel.relname, 'constraint', con.conname, 'def', pg_get_constraintdef(con.oid)))
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where con.contype='c' and n.nspname='public'
  )
) as audit_schema;
```

## Bagian B — Semua Function/RPC

56 function di schema `public`. 17 di antaranya (`gin_*`, `gtrgm_*`, `similarity*`, `word_similarity*`, `show_trgm`, `set_limit`, `show_limit`) adalah **fungsi bawaan ekstensi `pg_trgm`** (bahasa C, dipasang otomatis) — bukan kode custom, cuma dipakai internal `search_panel_fuzzy`/`search_proyek_fuzzy`. Tidak dibahas satu-satu.

### B.7 — Function yang MENULIS ke tabel progress panel/komponen (fokus task)

**`merge_panel_checklist(p_panel_id, p_partial)`** — *language sql*, satu-satunya jalur "resmi" tulis `panels.checklist`:
```sql
update public.panels set checklist = coalesce(checklist, '{}'::jsonb) || p_partial where id = p_panel_id;
```
⚠️ Ini **shallow merge di level TOP-KEY** (`||` jsonb) — kalau `p_partial = {"FS.1": {...}}`, seluruh objek `checklist["FS.1"]` DIGANTI TOTAL oleh isi partial (bukan digabung field-per-field). Aman dari nimpa kode LAIN, tapi caller (frontend) WAJIB kirim seluruh field kode itu (progress, history, qtyProses, dst) — kalau caller cuma kirim `{progress:{...}}` tanpa `history`/`qtyProses` lama, field itu HILANG. Ini konsisten dgn cara pemanggilannya di frontend (selalu `{...clLama, ...perubahan}`), tapi TIDAK ADA proteksi di level fungsi ini sendiri kalau ada caller baru yang lupa spread field lama.

**`panels_validate_busbar_cap_progress()`** *(trigger BEFORE UPDATE OF checklist)* — **satu-satunya trigger validasi bisnis nyata di seluruh database** (selain hash password & auto-archive). Isinya: loop semua kode di `checklist` yang punya `busbarTahap`, pastikan progress antar tahap TIDAK MENURUN urutannya (FABRIKASI≤PLATING≤HEATSHRINK≤PASANG, atau FABRIKASI≤PLATING≤PASANG utk COUPLER/GROUND) — kalau tahap belakangan progress-nya LEBIH BESAR dari tahap sebelumnya, `RAISE EXCEPTION` (transaksi GAGAL total, bukan cuma warning). Ini validasi struktural NYATA yang sudah ada — melawan kesan "tidak ada validasi apapun di DB" dari SETUP task, tapi cakupannya SEMPIT (cuma urutan tahap BUSBAR, tidak ada constraint serupa utk qty/qtyProses/progress 0-100/Pasang-Komponen-tahap).

**`sync_fcs_from_panel_progress()`** *(trigger AFTER UPDATE ON panels)* — **BARU DITEMUKAN, belum pernah ter-dokumentasi sesi manapun**. Tiap `checklist` berubah, loop SEMUA kode & SEMUA proses di `progress{}`, kalau progress≥100 set `fcs_schedule.status='completed'`, kalau 0<progress<100 set `'in_progress'` (match by `panel_id+kode_komponen+jenis_pekerjaan`, kecuali yang sudah `completed`/`cancelled`).

**`sync_fcs_status_on_renhar_insert()`** *(trigger AFTER INSERT ON renhar)* — tiap baris `renhar` baru masuk (operator "dirilis"), loop `komponen[]`, set `fcs_schedule.status='released'` (match `wo_id+panel_id+jenis_pekerjaan+tanggal+kode_komponen`, cuma kalau status sebelumnya `'planning'`).

**`cleanup_fcs_on_wo_delete()`** *(trigger BEFORE DELETE ON work_orders)* — hapus semua baris `fcs_schedule` milik WO yang dihapus (cascade manual, bukan FK).

⚠️ **Temuan besar, DIKONFIRMASI**: `fcs_schedule` adalah **sistem penjadwalan LAMA (v1)** — masih dipakai (`fcsService.ts`, `RawSchedule.tsx`, `RencanaHarian.tsx`, `workOrderService.ts` di vista-teknik; `OperatorView.tsx` di vista-pekerja), TAPI komentar di `fcsService.ts` sendiri eksplisit menyatakan alur generate jadwal sudah pindah ke Raw Schedule langsung: `"v2 FINAL - Swap functions berbasis Raw Schedule (bukan fcs_schedule)"` dan `"GENERATE LANGSUNG KE RAW SCHEDULE (skip fcs_schedule sebagai staging)"`. Artinya `fcs_schedule` adalah **tabel staging generasi-1 yang sudah dilewati alur utama v2**, tapi:
1. Masih ada baris DIBACA dari sana di beberapa tempat (kemungkinan fallback/tampilan lama yang belum dirapikan).
2. **3 trigger** (`sync_fcs_from_panel_progress`, `sync_fcs_status_on_renhar_insert`, `cleanup_fcs_on_wo_delete`) TETAP JALAN OTOMATIS setiap `checklist` berubah / `renhar` insert / WO dihapus — muter loop SEMUA kode+proses tiap kali, menyinkronkan status ke tabel yang arsitektur v2 sendiri bilang sudah "di-skip". Ini overhead nyata (bukan cuma "berpotensi") di jalur tulis PALING SERING dieksekusi di seluruh sistem (tiap kali operator simpan progress).
3. `arsip_panel()` tetap memindahkan `fcs_schedule` saat arsip — jadi bukan sepenuhnya diabaikan, tapi ini pola klasik "infrastruktur v1 yang gak pernah dibersihkan pas pindah ke v2", cocok jadi kandidat utama evaluasi/pembersihan di rencana restrukturisasi (perlu konfirmasi persis fitur mana yang MASIH baca `fcs_schedule` sebelum diputuskan dihapus/dipertahankan).

**`panels_auto_archive_seksi()`** / **`panels_auto_archive_nameplate()`** — sudah dibahas mendalam sesi-sesi sebelumnya (source persis seperti yang didokumentasikan di `ARSIP-SCHEMA-SYNC.md`, Pasang Komponen sudah dihapus dari yang pertama).

### B.8 — Function arsip/pindah-tabel generik

**`arsip_panel(p_panel_id, p_user, p_progress)`** — orkestrator utama "Arsipkan Panel" (dipanggil `ManajemenWO.tsx`): guard timer aktif dulu (`RAISE EXCEPTION` kalau ada `fcs_timer_kerja.selesai IS NULL`), lalu panggil `arsip_pindah_tabel()` utk 6 tabel (`raw_schedule, renhar, fcs_schedule, fcs_timer_kerja, progress_checkpoint_log, kendala`), pindah `fcs_tracking_komponen_foto` manual (insert+delete, bukan lewat helper generik — konsisten dgn catatan `ARSIP-SCHEMA-SYNC.md`), lalu `panels`→`panels_archived` (kolom di-generate dinamis dari `information_schema.columns`), `DELETE FROM panels`, dan set `work_orders.is_archived=true` kalau itu panel terakhir di WO itu.

**`unarsip_panel(p_panel_id)`** — kebalikannya persis, `arsip_kembalikan_tabel()` per tabel yang sama.

**`arsip_pindah_tabel`/`arsip_kembalikan_tabel`** — helper generik dinamis (kolom di-introspeksi dari `information_schema.columns` tiap panggilan) — inilah alasan `ARSIP-SCHEMA-SYNC.md` WAJIB disinkronkan manual tiap ada kolom baru (fungsi ini otomatis ikut kolom baru, tapi tabel `_archived`-nya harus manual ditambah kolomnya duluan atau `INSERT` gagal).

**`cek_sync_skema_arsip()`** — diagnostik drift skema arsip (dipakai CI), source SQL murni bandingkan `information_schema.columns` 2 tabel berpasangan.

**`find_renhar_anomalies()`** dan **`find_wo_sync_issues()`** — **2 fungsi diagnostik EXISTING yang relevan langsung dengan tujuan audit ini**, belum pernah disinggung sesi manapun:
- `find_renhar_anomalies()`: cari baris `renhar` di mana `komponen_released` (kode yang sudah dirilis operator) punya anggota yang TIDAK ADA lagi di `komponen` (array aktif) — indikasi kode "hilang" dari renhar padahal statusnya "sudah dirilis".
- `find_wo_sync_issues()`: 2 kasus — `raw_schedule` yang menunjuk WO yang sudah di-soft-delete, dan WO yang `target` sudah lewat tapi belum diarsipkan.

Kedua fungsi ini bisa langsung dijalankan (`select * from find_renhar_anomalies();` dll di SQL Editor) sebagai bagian riset restrukturisasi lanjutan — sudah ada infrastrukturnya, tinggal dipakai.

### B.9 — Lainnya (ringkas)

| Function | Fungsi |
|---|---|
| `verify_admin_login` / `verify_operator_login` | Login RPC, bcrypt via `pg_crypto` (`extensions.crypt`) |
| `admins_hash_password_trigger` / `operator_users_hash_password_trigger` | Hash password otomatis sebelum insert/update |
| `set_bom_proses_relevan` | Replace-all relasi kode+tipe→proses relevan (delete+insert, bukan upsert) |
| `set_current_admin` / `log_work_order_changes` | ⚠️ **Terlihat DIBANGUN tapi TIDAK DIPAKAI** — `log_work_order_changes` referensi kolom `activity_log` (`table_name,admin_nama,aktivitas,jenis,action_type,old_data,new_data`) yang **TIDAK ADA** di skema `activity_log` aktual (Bagian A.1 — cuma `user_name,action,description,module,halaman,proyek,panel,wo_number`). Function ini **TIDAK terpasang ke trigger manapun** (tidak ada di 11 trigger Bagian A.4) — kemungkinan pendekatan logging-via-trigger yang dicoba lalu ditinggalkan demi `activityLogService.insert()` client-side yang dipakai luas sekarang. Schema drift laten, aman (gak jalan), tapi function mati ini masih nangkring di DB. |
| `approve_permintaan_koreksi` / `reject_permintaan_koreksi` | Approve/reject koreksi qty Permintaan Barang, row-lock (`FOR UPDATE`) mencegah race approve dobel |
| `cleanup_recycle_bin` / `delete_old_activity_logs` | Purge terjadwal (soft-delete >15 hari, activity_log >30 hari) — kemungkinan dipicu pg_cron |
| `search_panel_fuzzy` / `search_proyek_fuzzy` | Pencarian fuzzy (`pg_trgm`), dipakai search box global |
| `latest_operator_per_komponen` | Operator terakhir per kode+proses per tanggal, dari `fcs_timer_kerja` |

---

## Bagian C — Contoh Data Nyata

### C.8 Struktur `panels.checklist` — 3 bentuk BERBEDA ditemukan dalam 1 kolom JSONB yang sama

**(1) Proses biasa** (POTONG/BENDING/STEL/RENDAM/PAINTING/FINISHING/RAKIT) — contoh `FS.1`, panel CAPACITOR BANK (id 403, CLS-FONTAINE, campuran Done/In-Progress):
```json
"FS.1": {
  "qty": 8,
  "history": { "STEL":[{"ts":"...","pct":100,"shift":"1","tanggal":"2026-09-13"}], "POTONG":[...], ... },
  "progress": { "STEL":100,"RAKIT":100,"BUSBAR":0,"POTONG":100,"RENDAM":100,"BENDING":100,
                "PACKING":0,"QC TEST":0,"PAINTING":100,"FINISHING":100,
                "WIRING POWER":0,"WIRING CONTROL":0,"PASANG KOMPONEN":0 },
  "qtyProses": { "STEL":8,"RAKIT":8,"POTONG":8,... },
  "stepDates": { "STEL":{},"RAKIT":{}, ... },
  "progressByDate": { "STEL":{"2026-09-13":100}, "RAKIT":{"2026-09-15":100}, ... },
  "qtyProsesByDate": { "STEL":{"2026-09-13":8}, ... }
}
```
Catatan: `progress` object SELALU berisi ke-13 proses (`ALL_PROSES`) meski gak semua relevan buat kode ini — nilai default 0 buat proses yang gak relevan, TIDAK ADA cara membedakan "0 krn belum dikerjakan" vs "0 krn proses ini emang gak relevan buat komponen ini" langsung dari angka doang (harus dicek silang ke `isKomponenRelevant()`/`bom_proses_relevan` di kode aplikasi).

**(2) Pasang Komponen non-tahap** (Assembling Luar biasa) — contoh `FS.4`, kode sama:
```json
"FS.4": {
  ...,
  "progress": { ..., "PASANG KOMPONEN": 100 },
  "fotoPemasangan": [{"url":"...","uploaded_at":"2026-09-15T04:44:40.865Z","uploaded_by":"GILANG"}],
  "pasangKomponenLastOperator": {"ts":"2026-09-15T04:44:15.787Z","nama":"GILANG"}
}
```

**(3) BUSBAR pseudo-komponen** (bukan kode BOM asli — `NETRAL`/`GROUND`/`COUPLER`/`INCOMING`/`OUTGOING`/`H-BUS`/`LINE`) — contoh dari panel LVMDP (id 377):
```json
"NETRAL": {
  "qty": 0,
  "history": { "BUSBAR": [{"ts":"...","pct":81.3,...},{"ts":"...","pct":100,...}] },
  "progress": { "BUSBAR": 100 },
  "qtyProses": {},
  "busbarTahap": {
    "FABRIKASI": {"progress":100,"sudahDisimpan100":true},
    "PLATING":   {"progress":100,"sudahDisimpan100":true},
    "HEATSHRINK":{"progress":100,"sudahDisimpan100":true},
    "PASANG":    {"progress":100,"sudahDisimpan100":true}
  },
  "progressByDate": { "BUSBAR": {"2026-09-02":81.3,"2026-09-03":100} }
}
```
`qty` SELALU 0 (pseudo-komponen, bukan barang fisik dengan qty), progress gabungan disimpan di `progress.BUSBAR` (rata-rata dari `busbarTahap`), bukan per-tahap langsung.

**Kesimpulan C.8**: 1 kolom JSONB (`checklist`) menampung MINIMAL 3 bentuk objek berbeda per-kode (proses biasa / Pasang Komponen tahap-ASSEMBLING-WIRING [lihat investigasi WM.4 sebelumnya, field `pasangKomponenTahap`] / BUSBAR-tahap), tanpa skema/tipe yang dipaksakan di level DB — validasi bentuk sepenuhnya tanggung jawab kode aplikasi, dan riwayat bug sesi-sesi sebelumnya (WM.4/Pintu, Tutup Samping) menunjukkan itu berkali-kali meleset.

### C.9 Contoh `fcs_timer_kerja` (10 baris: 5 BUSBAR + 5 proses biasa)

| id | pekerja_id | panel_id | kode | proses | tahap | progress | durasi (mnt) |
|---|---|---|---|---|---|---|---|
| 13037 | 36 | 398 | NETRAL | BUSBAR | PASANG | 100 | 0.04 |
| 13036 | 36 | 398 | GROUND | BUSBAR | PASANG | 100 | 0.04 |
| 13035 | 39 | 398 | NETRAL | BUSBAR | HEATSHRINK | 100 | 0.05 |
| 13034 | 40 | 398 | NETRAL | BUSBAR | PLATING | 100 | 0.05 |
| 13033 | 40 | 398 | GROUND | BUSBAR | PLATING | 100 | 0.05 |
| 13291 | 45 | 402 | F3B.17 | RAKIT | *null* | *null* | 0.01 |
| 13290 | 33 | 402 | F3B.17 | RAKIT | *null* | *null* | 0.01 |
| 13289 | 45 | 402 | F3B.17 | RAKIT | *null* | *null* | 0.31 |
| 13288 | 33 | 402 | F3B.17 | RAKIT | *null* | *null* | 0.31 |
| 13287 | 45 | 402 | F3B.30 | RAKIT | *null* | *null* | 44.45 |

Catatan: kolom `tahap`/`progress` cuma keisi buat BUSBAR & Pasang Komponen — proses biasa selalu `null`. Tabel yang sama dipakai 3 "mode" berbeda (satu-shot per proses biasa, per-tahap utk BUSBAR, per-tahap ASSEMBLING/WIRING utk Pasang Komponen) via kolom nullable yang sama.

### C.10 `panels` vs `panels_archived` — SUDAH SINKRON (tidak ada drift saat ini)

Dibandingkan langsung (satu baris live vs satu baris arsip): **0 kolom hilang di kedua arah**. `panels_archived` punya PERSIS semua kolom `panels` (termasuk `jumlah_cell` — kasus drift lama sudah beres) ditambah 5 kolom snapshot yang memang legitimate:
`diarsipkan_pada, diarsipkan_oleh, progress_snapshot, proyek_snapshot, wo_number_snapshot`.

Contoh baris arsip: `SDB-UTILITY` (diarsipkan LUTVAN NUHA, 29 Jul 2026, proyek CIMORY CITEUREUP WO 042) — struktur `checklist` di dalamnya identik dengan bentuk (1) di atas (proses biasa), field per-kode sama persis dgn yang di `panels` live.

Diagnostik otomatis `cek_sync_skema_arsip()` juga dites live saat ini: **0 baris drift** di semua pasangan tabel `X`/`X_archived` yang terdaftar.

---

## Bagian D — Peta Baca/Tulis Tabel Inti

### `panels` (kolom `checklist`, kolom progress per-seksi lain)

**Ditulis dari** (kedua repo):
- `vista-teknik`: `KapasitasPekerjaanTab.tsx` (SATU-satunya penulis langsung di vista-teknik — kemungkinan cuma edit qty, admin gak nulis progress).
- `vista-pekerja` (operator, penulis utama progress):
  - `OperatorView.tsx` — proses biasa + BUSBAR, via RPC `mergePanelChecklist()` (aman, server-side JSONB merge).
  - `KomponenPasangView.tsx` — Pasang Komponen (tahap & non-tahap), via `mergePanelChecklist()` juga.
  - `QCChecklistTab.tsx` — kolom `qc_checklist` (BUKAN `checklist`), pakai `.update()` LANGSUNG (read-modify-write manual di klien, BUKAN via RPC merge — beda pola dari 2 di atas).
  - `NameplateView.tsx` — kolom `nameplate_progress`/`nameplate_photos` (terpisah, sesuai CLAUDE.md B.2).
  - `TrackingKomponenView.tsx`, `KomponenProgressView.tsx` — kemungkinan tulis kolom Warehouse/QS (perlu konfirmasi via Bagian A soal kolom persis).

**Dibaca dari** (jauh lebih luas dari yang nulis — hampir semua fitur monitoring):
- `vista-teknik`: `ManajemenWO.tsx`, `RawSchedule.tsx`, `RencanaHarian.tsx`, `TaskMonitoring.tsx`, `TrackingPekerja.tsx`, `OutstandingView.tsx`, `WoDigitalTab.tsx`, `ArsipTab.tsx`, `fcsService.ts`, `workOrderService.ts`, `usePanelQtyEditor.ts`.
- `vista-pekerja`: hampir semua view operator (`AkunView`, `PermintaanView`, `ProsesAktifView`, `ReviewPaintingView`, `ReviewPotongView`, `RiwayatKerjaView`, dll) baca `checklist` buat nampilin progress/tugas masing-masing.

### `panels_archived`
- **Ditulis**: HANYA lewat RPC `arsip_panel()`/`unarsip_panel()` (dipicu `ManajemenWO.tsx`, admin) — bukan ditulis langsung dari kode frontend manapun.
- **Dibaca**: `ArsipTab.tsx` (vista-teknik), `ArsipSeksiView.tsx` (vista-pekerja, view-only riwayat).

### `fcs_timer_kerja`
- **Ditulis**: `OperatorView.tsx` (`startTimer`/`stopTimer`, proses biasa & BUSBAR), `KomponenPasangView.tsx` (`mulaiTimer`/`selesaiTimer`, Pasang Komponen), `ReviewPotongView.tsx`/`ReviewPaintingView.tsx` (kemungkinan tutup timer terkait review), `AkunView.tsx` (kemungkinan cleanup/logout-close).
- **Dibaca**: `RencanaHarian.tsx`, `RawSchedule.tsx`, `TrackingPekerja.tsx`, `ManajemenWO.tsx`, `ArsipTab.tsx`, `OutstandingView.tsx`, `panelHelpers.ts` (vista-teknik) + `OperatorView.tsx`, `KomponenPasangView.tsx`, `ProsesAktifView.tsx` (vista-pekerja, cek timer aktif sendiri).

### D.12 — Pola bug berulang: 1 tabel, banyak titik tulis, LOGIKA BEDA-BEDA

Terkonfirmasi persis seperti dugaan task ini:
1. **`panels.checklist`**: 3 bentuk objek berbeda (proses biasa / Pasang Komponen / BUSBAR) ditulis dari 2 komponen berbeda (`OperatorView.tsx`, `KomponenPasangView.tsx`) — SUDAH lewat 1 RPC merge yang sama (`mergePanelChecklist`), tapi bentuk PAYLOAD-nya beda total tergantung proses. Root cause bug sesi-sesi sebelumnya (WM.4/Pintu rata-rata ASSEMBLING+WIRING yang salah, Tutup Samping filter yang beda antar proses) ada persis di titik ini.
2. **`panels.qc_checklist`**: ditulis LANGSUNG (bukan lewat RPC merge) dari `QCChecklistTab.tsx` — pola berbeda dari `checklist`, potensi race read-modify-write kalau 2 sesi QC edit bersamaan (belum ada insiden nyata yang tercatat, tapi arsitekturnya rentan).
3. **`fcs_timer_kerja`**: pola insert "cek-dulu-baru-insert" DIULANG 2x independen di `OperatorView.tsx` dan `KomponenPasangView.tsx` — sempat exact race yang sama (timer duplikat) ditemukan & diperbaiki sesi ini, DI DUA TEMPAT sekaligus karena memang 2 implementasi terpisah, bukan 1 fungsi bersama.
4. **`panel_seksi_archived`**: sampai sebelum sesi ini, ditulis dari 2 JALUR INDEPENDEN sekaligus (trigger DB otomatis + upsert manual client) buat seksi yang sama (assembling_luar/wiring_control) — root cause "arsip basi"/"operator terkunci". Sudah diperbaiki (trigger dihapus utk 2 seksi itu), tapi Warehouse/QS/QC MASIH cuma auto-trigger, TANPA jalur manual — asimetri yang belum ditinjau.

---

## Bagian E — Rekap Masalah Struktural yang Sudah Diketahui

1. **`checklist` JSONB tanpa skema dipaksakan** — 3+ bentuk berbeda per-kode (proses biasa/Pasang-Komponen-tahap/BUSBAR-tahap) di 1 kolom yang sama, tanpa validasi struktur di level DB. Sumber utama kelas bug "logika beda-beda nulis ke tempat sama" (lihat D.12).
2. **Tidak ada pembeda N/A vs belum-dikerjakan** — `progress[proses]` default 0 dipakai baik utk "proses ini emang gak relevan buat komponen ini" maupun "belum dikerjakan" (CLAUDE.md B.2). `nameplate_progress`/`yellowmark_progress` sama, numeric 0-100 gak bisa nunjuk "panel ini gak butuh nameplate sama sekali".
3. **Data ganda `progress` vs `progressByDate`** — 2 sumber kebenaran buat 1 angka yang sama (nilai terkini vs snapshot per-tanggal), berkali-kali beda bikin bug (insiden carry-over RENDAM 14-16 Sep, dirujuk CLAUDE.md B.3).
4. **`qtyProses` bisa melebihi `qty`** — TIDAK ADA CHECK constraint. 35 kombinasi kode+proses ditemukan sesi ini (semua qty=0 tapi qtyProses>0, sisa dari edit qty yang gak konsisten sama histori). Belum diperbaiki (keputusan user: cek manual, bukan task-fix).
5. **Dual-write path (auto-trigger + manual)** — pola bug berulang: `panel_seksi_archived` (assembling_luar/wiring_control, sudah diperbaiki), kemungkinan pola sama di Warehouse/QS/QC (belum ditinjau, cuma auto-trigger, tanpa override manual operator kalau snapshot-nya basi).
6. **Timer race condition (check-then-insert tanpa constraint DB)** — pola berulang, ditemukan & diperbaiki di `fcs_timer_kerja` sesi ini (partial unique index), TAPI implementasinya terduplikasi di 2 file (`OperatorView.tsx` & `KomponenPasangView.tsx`) — bukan 1 fungsi bersama, jadi fix logic-nya juga harus di 2 tempat.
7. **Kode mati yang divergen dari fix terbaru** — `OperatorView.tsx` (`cardMode='qty'`, jalur PASANG KOMPONEN) confirmed unreachable (routing `sub_bagian` gak pernah cocok), tapi masih pakai formula rata-rata ASSEMBLING+WIRING versi LAMA yang sudah diperbaiki di `KomponenPasangView.tsx` — divergensi laten kalau suatu saat kode ini somehow jadi reachable lagi.
8. **RLS tanpa policy DELETE** — `bom_proses_relevan`: `.delete()` via anon key silent no-op (ditemukan sesi lalu, `KapasitasPekerjaanTab.saveProsesRelevan` berpotensi gagal-diam-diam saat hapus proses relevan).
9. **Tabel baru belum masuk type generator** — `work_instructions`/`wi_revisions` dipakai dengan `as any` cast (belum ada di `src/types/supabase-generated.ts`), kehilangan type-safety compiler utk tabel yang cukup penting (Dokumen Gambar Teknik).
10. **Tanpa FK di tabel snapshot/arsip** (`panel_seksi_archived`, `panels_archived`) — `panel_id`/`wo_id` sengaja TANPA foreign key, supaya baris arsip tetap ada walau sumbernya dihapus dari Manajemen WO. Desain sengaja, bukan bug, tapi berarti TIDAK ADA referential integrity yang dipaksakan DB di tabel-tabel ini — validasi konsistensi sepenuhnya tanggung jawab aplikasi.
11. **Konstanta `PROSES_TANPA_MAPPING_KOMPONEN` beda isi di 2 tempat** — `panelHelpers.ts` (4 item, termasuk NAMEPLATE/YELLOWMARK) vs `fcsService.ts` (2 item, tanpa NAMEPLATE/YELLOWMARK) — nama sama, isi beda, potensi jebakan kalau ada yang asumsi identik (CLAUDE.md B.2).
12. **`fcs_schedule` — infrastruktur v1 yang gak pernah dibersihkan pas pindah ke v2** (ditemukan Bagian B) — 3 trigger otomatis TETAP jalan di jalur tulis paling sering (tiap `checklist` berubah / `renhar` insert) buat sinkronkan tabel yang arsitektur v2 sistem sendiri (`fcsService.ts`) bilang sudah di-skip dari alur generate jadwal utama. Overhead nyata + sumber kebenaran status KE-3 (selain `checklist.progress` dan `renhar.komponen_released`) yang berpotensi diverge diam-diam.
13. **Validasi DB TIDAK sepenuhnya nihil, tapi sangat sempit** — koreksi atas kesan awal SETUP task: ADA 1 trigger validasi bisnis nyata (`panels_validate_busbar_cap_progress`, cegah progress tahap BUSBAR mundur/gak berurutan, `RAISE EXCEPTION` kalau dilanggar). Tapi cakupannya CUMA urutan tahap BUSBAR — tidak ada validasi serupa utk urutan tahap Pasang Komponen, rentang progress 0-100, atau `qtyProses<=qty` (poin E.4).
14. **Function logging-via-trigger yang ditinggalkan** — `log_work_order_changes()` (+`set_current_admin()` pendukungnya) referensi kolom `activity_log` yang TIDAK ADA di skema aktual, dan TIDAK terpasang ke trigger manapun saat ini — jejak percobaan pendekatan lama (audit log server-side via trigger) yang ditinggalkan demi `activityLogService.insert()` client-side. Aman (tidak jalan), tapi sampah skema yang belum dibersihkan.
15. **2 fungsi diagnostik siap pakai untuk restrukturisasi lanjutan** — `find_renhar_anomalies()` (kode "hilang" dari renhar padahal berstatus dirilis) dan `find_wo_sync_issues()` (raw_schedule yatim + WO overdue belum diarsipkan) sudah ada di database, belum pernah dipakai/disinggung sesi manapun — bisa langsung dijalankan sebagai starting point audit susulan.

---

## Kesimpulan Audit

Struktur data Vista Teknik ERP **bekerja dan sudah dilindungi cukup baik dari kelas bug yang sudah pernah kejadian** (unique constraint renhar/timer/wi_revisions, diagnostik drift arsip otomatis di CI, 1 trigger validasi urutan BUSBAR) — tapi perlindungan itu semua ditambal REAKTIF, kejadian dulu baru dipasang constraint-nya, bukan hasil desain skema yang mencegah kelas masalah ini dari awal. Akar masalah yang paling berulang menyebabkan bug (E.1, E.3, D.12): **`panels.checklist` sebagai 1 kolom JSONB tanpa skema dipaksakan, menampung 3+ bentuk data berbeda, ditulis dari beberapa titik kode dengan asumsi struktur yang mudah divergen.** Kalau restrukturisasi ke depan mau menyasar 1 hal dengan dampak terbesar, ini titiknya — bukan tabel lain manapun di skema ini.

*Laporan selesai — Bagian A, B, C, D, E lengkap.*
