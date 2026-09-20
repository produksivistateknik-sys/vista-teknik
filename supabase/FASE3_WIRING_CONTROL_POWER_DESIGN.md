# Fase 3 — Migrasi `component_process_progress`: WIRING CONTROL/POWER

**Sifat**: Riset + desain, sama seperti Fase 2. **TIDAK ADA migrasi/kode dieksekusi.** Menunggu
konfirmasi sebelum lanjut ke migrasi SQL/kode sebenarnya. Urutan ini sesuai sketsa
`FASE2_COMPONENT_PROCESS_PROGRESS_DESIGN.md` bagian 6: WIRING CONTROL/POWER dulu (paling
sederhana setelah Pasang Komponen, sekaligus menutup total bug "NOT YET selamanya" komponen
beli-jadi karena status jadi tersimpan eksplisit, bukan gate runtime lagi).

---

## 1. Beda besar dari Pasang Komponen — WAJIB dipahami sebelum desain

Pasang Komponen (Fase 2) ditulis dari 1 komponen kecil, single-operator, single-button
(`KomponenPasangView.tsx`). WIRING CONTROL/POWER **BUKAN** begitu — ditulis dari
`OperatorView.tsx`, komponen generik multi-proses yang JAUH lebih besar:

| Aspek | Pasang Komponen (Fase 2) | WIRING CONTROL/POWER (Fase 3) |
|---|---|---|
| File penulis | `KomponenPasangView.tsx` (kecil, 1 proses) | `OperatorView.tsx` (besar, semua proses) |
| Model operator | 1 operator per klik (`user.nama`) | **Banyak operator per kartu** (`renhar.pekerja_per_komponen[kode]` = array id pekerja, di-assign per hari/tugas) |
| cardMode | (tab sendiri, gak ada konsep ini) | `'timer'` — beda dari `'qty'` (POTONG dst) dan beda cara render |
| Commit progress | `updatePctLive()` (live) + `simpanProgress()` (commit+arsip) | `updatePctManual()` (live, generik SEMUA proses) + `lockSingleKomponen()` (commit "Kunci Progress", generik SEMUA proses qty+timer mode) |
| Checkpoint per klik >0% | Cuma di `simpanProgress` (commit) | **`updatePctManual` SUDAH insert `progress_checkpoint_log` tiap klik >0%** (7 Sep 2026 fix, beda dari Pasang Komponen yang checkpoint cuma pas commit) |
| "Sudah diarsip/disimpan" | Field eksplisit `sudahDisimpan100` di checklist objek | **Dihitung ulang tiap render**, BUKAN field tersimpan: `(cl.history?.[proses]||[]).some(h=>h.tanggal===viewDate&&h.pct===100)` (`OperatorView.tsx:1937`) |
| Nama operator di checkpoint | `user.nama` (1 orang, yg lagi login) | `workerObjs.map(w=>w.nama).join(', ')` — **join semua operator yang di-assign ke kartu itu**, fallback `user.nama` kalau belum ada assignment (`OperatorView.tsx:1075,1105`) |
| Arsip terpisah (`panel_seksi_archived`) | Ya (`simpanProgress` upsert eksplisit) | **TIDAK ADA** — WIRING CONTROL/POWER gak punya arsip seksi terpisah, "selesai" murni dari `progress[proses]>=100` + history hari itu |
| Timer | `fcs_timer_kerja`, single-operator, `tahap='ASSEMBLING'/'WIRING'` | `fcs_timer_kerja`, **multi-operator (banyak baris per kartu, 1 per pekerja)**, `tahap=NULL` |

**Kesimpulan poin 1**: dual-write utk Fase 3 HARUS masuk ke `updatePctManual()` DAN
`lockSingleKomponen()` di `OperatorView.tsx` — bukan file terpisah. Field `last_operator_nama`
di skema yang sudah ada **CUKUP** (tinggal isi string gabungan "RAFIK, BAGAS" persis kayak yang
sudah dipakai `progress_checkpoint_log.pekerja_nama`, TIDAK perlu kolom array/kolom baru).

---

## 2. Survei data live

Dicek langsung ke DB (20 Sep 2026):
- **`bom_proses_relevan`**: 18 kombinasi kode+tipe relevan WIRING CONTROL, 8 relevan WIRING POWER
  (skala serupa Pasang Komponen yang 23 — kecil, backfill trivial, jauh di bawah limit 1000 row).
- **Bentuk `checklist[kode]` utk WIRING CONTROL/POWER**: proses "biasa" murni, TIDAK ADA
  sub-tahap (sama kayak POTONG/BENDING dst) — `progress[proses]`, `progressByDate[proses]`,
  `history[proses]`, `qtyProses[proses]` (WIRING CONTROL/POWER **tetap qty-based di belakang
  layar** meski cardMode-nya `'timer'` — qty dari BOM, bukan operator input manual, lihat
  `PROSES_QTY_LOCK_SEBELUM_MULAI`/`PROSES_AUTO_ASSIGN_SAAT_QTY` yang TIDAK memasukkan WIRING
  CONTROL/POWER — beda dari Pasang Komponen yang qty-lock-nya aktif).
- **`fcs_timer_kerja`**: sample dicek, `tahap=NULL`, `progress=NULL` di semua baris WIRING
  CONTROL/POWER — proses-agnostik seperti yang sudah diprediksi, **TIDAK PERLU perubahan skema**,
  reuse persis pola Pasang Komponen (natural key `panel_id,kode_komponen,proses,tahap`, di sini
  `tahap` selalu NULL bukan 'WIRING' seperti Pasang Komponen).
- **`renhar.pekerja_per_komponen`**: JSONB map `{kode: [id_pekerja,...]}` per baris tugas harian
  (`wo_id,panel_id,proses,tanggal`) — sumber assignment operator, SUDAH ADA, tidak perlu
  disentuh. Ini yang dipakai `updatePctManual`/`lockSingleKomponen` buat resolve nama operator
  gabungan.

---

## 3. Rencana dual-write

### `updatePctManual(panelId, kode, proses, pct)` — OperatorView.tsx:1045
Tambah upsert `component_process_progress` setelah `mergePanelChecklist` sukses (pola identik
Fase 2, best-effort/`console.error`, TIDAK blok operator) — HANYA jalan kalau
`proses==="WIRING CONTROL"||proses==="WIRING POWER"` (guard eksplisit, proses lain di fungsi
generik ini TIDAK ikut ke tabel baru, sesuai scope Fase 3). `tahap:null`. `status` dari
`pctToStatus(pct)` (fungsi yang sama, sudah ada, TIDAK perlu diduplikasi/diubah).
`sudahDisimpan100` di sini SELALU `false` (sama alasan Fase 2 — ini live update, bukan commit).
`last_operator_nama`: resolve dari `task.pekerja_per_komponen[kode]` (kode yang SAMA PERSIS
sudah dipakai fungsi ini sendiri buat `progress_checkpoint_log`, tinggal reuse variabelnya).

### `lockSingleKomponen(panelId, kode, proses)` — OperatorView.tsx:1090
Tambah upsert setelah `mergePanelChecklist` (commit) sukses — guard proses yang sama.
`sudah_disimpan_100` di sini dihitung PERSIS rumus yang sudah dipakai render (`pct>=100` DAN
baris ini adalah commit hari ini) — konsisten satu sumber logika, bukan rumus baru.

### Yang TIDAK berubah
- `panel_seksi_archived` — WIRING CONTROL/POWER memang gak pernah pakai tabel ini, TIDAK ada
  yang perlu ditambah/disamakan (beda dari Pasang Komponen).
- Tombol arsip manual (`bool_and(status='done')`) — **TIDAK RELEVAN utk Fase 3**, WIRING
  CONTROL/POWER gak punya konsep "arsip per-kode" terpisah seperti Pasang Komponen. Kalau nanti
  dibutuhkan validasi serupa, bentuknya beda (mungkin ke level panel/WO, bukan per-kartu) — di
  luar scope riset ini, dicatat sebagai potensi follow-up, bukan bagian Fase 3.
- Timer (`fcs_timer_kerja`) — TIDAK ada perubahan skema, reuse 100% apa adanya.

---

## 4. Seeding backfill

Sama pola `fase2_seed_component_process_progress.mjs`, disesuaikan:
- Loop kode dgn qty>0 di semua panel aktif, utk **masing-masing** `proses` di
  `['WIRING CONTROL','WIRING POWER']` terpisah (2 baris per kode kalau kode itu relevan ke
  keduanya — jarang, tapi mungkin; kalau cuma relevan salah satu, insert 1 baris utk yang relevan
  + `not_applicable` utk yang tidak, PERSIS pola not_applicable Fase 2).
- `tahap=NULL` selalu (WIRING CONTROL/POWER gak punya sub-tahap sama sekali, beda dari Pasang
  Komponen yang py 1 tahap khusus 'WIRING' buat Box Control/Pintu — JANGAN disamakan, itu field
  berbeda: `pasangKomponenTahap.WIRING` vs `progress["WIRING CONTROL"]`, dua hal independen yang
  sudah dikonfirmasi TIDAK saling menyentuh sejak fix 5 Agu 2026).
- `sudah_disimpan_100`: hitung dari `history[proses]` — ADA entry dgn `pct===100` di TANGGAL
  APAPUN (bukan cuma hari ini, karena backfill ini snapshot SEKALI JALAN, beda dari live check
  `viewDate` yang scoped ke hari berjalan) — pola: `(history[proses]||[]).some(h=>h.pct===100)`.
- `last_operator_nama`/`last_operator_at`: dari entry `history[proses]` PALING BARU (bukan dari
  `renhar.pekerja_per_komponen` — itu assignment HARI INI/task aktif, bukan histori siapa yang
  pernah ngerjain; backfill perlu histori, bukan assignment sekarang).

---

## 5. Temuan sampingan (BUKAN bagian Fase 3, dicatat sesuai CLAUDE.md G.4 — tidak diperbaiki
kecuali diminta terpisah)

Ditemukan saat menelusuri `OperatorView.tsx`: sisa kode `proses==="PASANG KOMPONEN"` yang
tampaknya **sudah mati** sejak fitur Pasang Komponen dipindah total ke `KomponenPasangView.tsx`
(7 Agu 2026) — pola yang SAMA PERSIS dengan `fcs_schedule` (infrastruktur v1 yang gak
dibersihkan pas pindah ke v2):
- `lockSingleKomponen()` baris ~1175-1191: blok arsip `panel_seksi_archived` seksi
  `assembling_luar` khusus `user.sub_bagian==="Assembling Luar"` — tapi tombolnya sendiri
  (PCT_STEPS render) di-null-kan eksplisit di baris ~3116 (`(isBusbarProses||proses==="PASANG
  KOMPONEN")?null:...`) utk kartu mode `'pct'` yang dipaksa khusus Assembling Luar (baris 2033).
  Kalau benar gak ada UI yang bisa memicu `lockSingleKomponen` dgn `proses==="PASANG KOMPONEN"`
  lagi, blok ini dead code — **belum saya verifikasi tuntas** (belum exhaustive-grep semua call
  site kayak yang dilakukan utk `fcs_schedule`), cuma indikasi awal. Kandidat cleanup terpisah
  kalau dikonfirmasi, di luar scope riset Fase 3 ini.

---

## 6. Koreksi ditemukan SAAT implementasi (21 Sep 2026) — dicatat demi jejak audit

Riset awal (bagian 1-5 di atas) meleset di 1 hal penting, ketemu pas verifikasi live: ada
**3 fungsi** yang menulis progress WIRING CONTROL/POWER, bukan 2. `lockProgress()` (tombol besar
"🔒 Kunci Progress Hari Ini") adalah **reimplementasi bulk terpisah** dari `lockSingleKomponen()` —
BUKAN memanggilnya per-kartu, tapi loop sendiri lewat `panelsMap`/`todayTasks`/`myProses`. Dual-write
yang cuma dipasang di `updatePctManual`+`lockSingleKomponen` PUNYA CELAH: commit lewat tombol bulk
(kemungkinan besar cara operator paling sering commit di akhir shift) gak akan pernah ke-dual-write.
Sudah ditambal (dual-write ketiga di `lockProgress`, pola sama: kumpulkan kandidat ccp bareng
`checkpointLogEntries` yang sudah ada, flush sekaligus di akhir fungsi, best-effort).

Verifikasi live (panel MCC TR 5, kode F3B.15, WIRING CONTROL) mengonfirmasi urutan syarat yang
gak kebayang dari baca kode doang: `canLockKomponen()` mensyaratkan timer **SUDAH DISETOP**
(`timerSelesaiHariIni`), bukan cuma "pernah dimulai" — operator wajib klik ⏹ dulu sebelum
Kunci Progress (bulk maupun single) benar-benar menulis apa pun; kalau belum, fungsi silently
no-op (gak ada alert di versi bulk, beda dari `lockSingleKomponen` yang setidaknya kasih alert).

Setelah ditambal, 3 fungsi berhasil diverifikasi live end-to-end (klik sungguhan lewat UI,
bukan cuma trace kode): `updatePctManual` (checklist=25→component_process_progress pct=25,
operator, timestamp identik), `lockProgress` (checklist.history ke-commit pct=100 shift 1 →
component_process_progress status=done, sudah_disimpan_100=true, identik). Semua sisi produksi
yang tersentuh selama test sudah direvert byte-identik ke kondisi semula (checklist,
component_process_progress, progress_checkpoint_log — 6 baris tes dihapus, fcs_timer_kerja —
1 baris tes dihapus, renhar.pekerja_per_komponen dikembalikan ke `{}`), diverifikasi ulang
lewat cross-check penuh 1365 baris (0 mismatch, dengan pagination benar kali ini).

## Ringkasan

1. **Tabel**: TIDAK ADA perubahan skema `component_process_progress` — kolom yang ada sudah
   cukup (tahap=NULL, last_operator_nama sbg string gabungan).
2. **Lokasi dual-write**: `OperatorView.tsx` — `updatePctManual()` (live) + `lockSingleKomponen()`
   (commit), DIGUARD eksplisit `proses==="WIRING CONTROL"||proses==="WIRING POWER"` supaya 11
   proses lain yang lewat fungsi generik yang sama TIDAK ikut ke tabel baru di fase ini.
3. **Timer**: reuse penuh, 0 perubahan.
4. **Arsip manual**: tidak relevan utk domain ini (WIRING CONTROL/POWER gak punya konsep arsip
   per-kode terpisah).
5. **Beda kunci dari Fase 2**: multi-operator (join nama), checkpoint tiap klik >0% (bukan cuma
   commit), "sudah disimpan" dihitung dari histori bukan field tersimpan — semua tetap bisa
   dipetakan ke skema `component_process_progress` yang SAMA PERSIS, tanpa migrasi kolom baru.
