/*
Auto-geser komponen belum selesai ke hari kerja berikutnya - SERVER-SIDE (Edge Function).

REVISI TRIGGER (ganti cron otomatis -> tombol manual): dulu dipicu pg_cron sekali sehari jam 06:00
WIB. SEKARANG cron itu DINONAKTIFKAN (cron.job id=8 di-`active:=false`, bukan dihapus - command-nya
tetap ada kalau suatu saat mau balik ke otomatis) dan diganti trigger manual lewat tombol "Tarik ke
Hari Ini" di Rencana Harian (Vista Teknik). LOGIC INTI (FASE 1/2/3 di bawah) TIDAK BERUBAH SAMA
SEKALI - cuma PEMICUNYA yang beda. Alasan tetap server-side (bukan balik ke client-side lama): masih
cuma ada SATU eksekusi per klik, gak peduli berapa tab/device yang buka - kelas race condition yang
sama tetap dihindari, cuma "sekali sehari otomatis" jadi "sekali per klik manual".

MODE CATCH-UP (BARU): karena trigger-nya sekarang manual (bisa aja gak ada yang klik beberapa hari),
function ini WAJIB bisa proses LEBIH DARI SATU hari sekaligus dalam satu invocation - jalan dari hari
sumber PALING LAMA yang belum "ditarik" (dibaca dari MAX(hari_target) di auto_geser_runs) berurutan
sampai hari ini, satu hari demi satu hari, PERSIS seperti kalau cron jalan tiap hari gak pernah putus.
Tiap hari dapet baris klaim sendiri di auto_geser_runs (PK di kolom hari_sumber jadi pengaman alami
biar satu hari sumber gak pernah keproses dua kali, termasuk kalau ada 2 klik nyaris bersamaan dari
tab berbeda). Dibatasi MAX_CATCHUP_HARI biar gak timeout kalau gap-nya kebetulan sangat panjang.

FASE 1 - LOGIC PER-KOMPONEN (progress, evaluasi tiap kode individual dalam satu WP):
1. Progress = 0% -> JEJAK/digeserKe juga (REVISI KE-2 - lihat bawah): kode TETAP di tanggal asal,
   ditandai `entry.digeserKe[kode] = tanggalTujuan`, cuma dilabelin beda di frontend ("Digeser -
   Tidak Dikerjakan") dari kasus partial. Dulu di sini kode dihapus total tanpa jejak sama sekali -
   sekarang SEMUA kode yang digeser (0% maupun partial) ninggalin jejak, biar user bisa lihat
   histori "apa yang dijadwalkan tapi gak sempat dikerjakan sama sekali".
2. Progress sebagian (0-100%) -> JEJAK/digeserKe: kode TETAP di tanggal asal tapi ditandai
   `entry.digeserKe[kode] = tanggalTujuan` (read-only, histori permanen) - bukan lagi "duplikasi
   tak berlabel" seperti sebelumnya. Entry AKTIF (live) mendarat di tanggal tujuan.
3. Progress >= 100% -> tidak disentuh.
Kasus 1 & 2 sekarang diperlakukan IDENTIK di backend (sama-sama jejakOp, gak pernah removeOp) -
satu-satunya beda tinggal label yang ditampilkan frontend, dibaca dari progress asli di tanggal itu
(0% vs >0%), bukan dari field terpisah manapun di data.
WIRING CONTROL/WIRING POWER pakai rule sama persis (token __wiring_* di-skip dari evaluasi progress
karena bukan kode BOM asli, kode asli di dalamnya dievaluasi 1-2 seperti biasa).

REVISI JEJAK/digeserKe (ganti pendekatan "split qty jadi 2 entry" lama):
- `entry.digeserKe` (Record<kode,tanggalTujuan>) SUDAH ADA di skema data (dipakai RawSchedule.tsx &
  RencanaHarian.tsx buat dimming/tooltip "histori, gak bisa diaksi lagi" + ganti tombol Rilis jadi
  label read-only) - sebelumnya TIDAK PERNAH ADA yang menulis field ini. Revisi ini melengkapi sisi
  penulisannya, REUSE field yang sudah ada (bukan bikin field baru) supaya tampilan yang sudah
  dibangun otomatis jalan.
- Kode yang SUDAH punya `digeserKe[kode]` di tanggal sumber TIDAK PERNAH dievaluasi ulang buat geser
  berikutnya (jejak gak boleh ikut proses geser/cascading lagi).
- CASCADING MULTI-HOP: kalau kode kena geser berantai karena kapasitas penuh berturut-turut
  (mis. 22->23->24 karena 23 penuh), maka BUKAN CUMA tanggal asal (22) yang dapat jejak - tanggal
  23 (yang cuma "kelewat" pas cascading, gak pernah jadi tujuan akhir) JUGA dapat entry jejak
  (digeserKe[kode]=24). Cuma tanggal AKHIR (24) yang jadi entry live. Berlaku sama persis buat
  kandidat baru dari fase 1 (kasus1 maupun 2) maupun buat kode yang SUDAH ADA di tanggal tujuan
  tapi kalah kompetisi kapasitas hari ini dan ke-geser lagi - REVISI KE-2: progress kode itu gak
  lagi nentuin jejak-vs-remove (dulu 0% = geser polos tanpa jejak), sekarang selalu jejakOp.
- Field `komponen` (array kode) TIDAK berubah bentuk - kode yang jadi jejak TETAP ada di situ, cuma
  ditandai lewat digeserKe. Semua fungsi lain yang baca `entry.komponen` sebagai daftar kode gak
  perlu berubah, dan perhitungan kapasitas otomatis tetap menghitung kode berstatus jejak (sesuai
  requirement) tanpa perlu disentuh sama sekali.

FASE 2 - CASCADING CAPACITY: kandidat dari fase 1 gak langsung ditulis ke tanggal tujuan kalau
kapasitas proses itu di tanggal tujuan udah gak cukup. Kapasitas per (tanggal,proses) dibaca dari
fcs_kapasitas_override (kolom kapasitas_unit - udah unify jam/orang), demand dihitung dari qty sisa
x fcs_process_time.menit_per_pcs (proses jam-based) atau headcount token __wiring_Norg_ (WIRING,
orang-based - satu tim/WP gerak bareng, gak dipecah per kode). SEMUA kode yang bersaing slot di
tanggal itu (yang UDAH ADA dari jadwal manual + kandidat baru dari geseran) diurutkan: target WO
lebih dekat menang, seri -> kode lebih kecil (natural sort) menang. Yang kalah geser ke hari
berikutnya, evaluasi ulang di sana, dst (maks 90 hari, kalau masih penuh tetap ditempatkan + log
warning overbook, biar gak ada kerjaan yang hilang gak kejadwal sama sekali).
BUSBAR dikecualikan dari cascading (gak punya data fcs_process_time buat hitung demand-nya) - tetap
geser langsung ke tanggal tujuan tanpa cek kapasitas. Drag manual BUSBAR (fitur terpisah di
RawSchedule.tsx) punya jejak sendiri (busbar_jejak) - auto-geser ini TETAP gak menyentuhnya sama
sekali (busbar_schedule bukan bagian dari `schedule` yang diproses fungsi ini).

PRINSIP ANTI-TABRAKAN (lihat diskusi sebelum implementasi ini):
1. TIDAK PERNAH menyentuh panels.checklist[kode].progressByDate/history - itu punya fitur "kunci
   progress per hari" (snapshot), ditulis EKSKLUSIF oleh Vista Pekerja. Fungsi ini cuma BACA
   progress[proses]/qty/qtyProses (live) buat nentuin sudah selesai/sebagian/belum & demand kapasitas.
2. TIDAK PERNAH menyentuh tabel renhar - status Rilis SELALU mulai "Belum Dirilis" di tanggal baru,
   planner rilis manual.
3. Fresh-fetch raw_schedule PENUH di awal TIAP hari yang diproses (bukan cuma sekali di awal
   invocation) - kalau catch-up jalan >1 hari, hari ke-2 harus lihat hasil tulisan hari ke-1.
4. Paginasi PENUH pas fetch semua tabel - jangan ulangi bug limit 1000 baris default Supabase.

MODE DEBUG/BACKFILL SATU HARI SPESIFIK: query string ?dryRun=1&hariSumber=YYYY-MM-DD&hariTarget=
YYYY-MM-DD (SENGAJA cuma berlaku saat dryRun=1 - gak pernah bisa dipakai buat nulis beneran, biar
gak ada resiko salah pencet tanggal di produksi) - proses SATU pasangan tanggal spesifik aja, gak
ikut logic catch-up multi-hari, balikin detail sebelum/sesudah lengkap per-baris.

MODE NORMAL (dipanggil cron dulu, sekarang tombol manual): tanpa hariSumber/hariTarget di query
string - otomatis proses SEMUA hari yang ketinggalan (lihat "MODE CATCH-UP" di atas). ?dryRun=1
tanpa override tanggal = preview catch-up (dipakai banner buat cek "ada berapa yang perlu ditarik"
tanpa nulis apapun).
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// NAMEPLATE/YELLOWMARK: proses penanda whole-panel (komponen:["MARKED"], bukan kode BOM asli) - kalau gak dikecualikan, tiap malam bakal dianggap "belum 100%" terus dan digeser tanpa henti.
const PROSES_DIKECUALIKAN = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const PROSES_ORANG = ['WIRING CONTROL', 'WIRING POWER']
// BUSBAR: progress per-tahap (busbar_progress), gak match model qty x menit_per_pcs - dikecualikan dari cascading kapasitas DAN dari skema jejak/digeserKe (di luar scope revisi ini), tetap geser langsung.
const PROSES_TANPA_CASCADE = ['BUSBAR']
const MAX_CASCADE_HARI = 90
// FIX INSIDEN WIRING CONTROL/POWER (1 Agu 2026): kapasitas fcs_kapasitas_override cuma
// dikonfigurasi sampai tanggal tertentu di masa depan - begitu cascading nyampe tanggal yang
// BELUM ADA row-nya sama sekali (getCap()===null), dulu diperlakukan SAMA PERSIS kayak "hari itu
// penuh" (kapasitas dikonfigurasi tapi habis) - jalan diam-diam sampai MAX_CASCADE_HARI (90 hari)
// tanpa sinyal apa pun. Sekarang dibedakan: hari yang MEMANG dikonfigurasi (walau hasilnya 0/penuh)
// tetap geser 1 hari demi 1 hari seperti biasa (perilaku ini SENGAJA gak diubah - kapasitas penuh
// beberapa hari berturut itu wajar, terutama WIRING yang kuotanya kecil per hari) - yang di-stop
// cuma kalau ketemu MAX_HARI_TANPA_KONFIG hari BERTURUT-TURUT tanpa row konfigurasi sama sekali.
const MAX_HARI_TANPA_KONFIG = 3
// Batas berapa hari catch-up boleh diproses dalam SATU invocation - jaga-jaga kalau gap-nya
// kebetulan sangat panjang (misal cron mati berminggu-minggu), biar gak timeout. Kalau kepotong di
// sini, tombol tinggal diklik lagi buat lanjut dari titik terakhir (auto_geser_runs jadi checkpoint).
const MAX_CATCHUP_HARI = 30

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const addDaysStr = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Sama persis naturalKodeSortGlobal di src/lib/panelHelpers.ts - Deno gak bisa import lintas src/, jadi direplikasi di sini.
const naturalKodeSort = (a: string, b: string) => {
  const parse = (k: string) => {
    const m = String(k).match(/^(.*?)(\d+)$/)
    return m ? { prefix: m[1], num: parseInt(m[2], 10) } : { prefix: k, num: 0 }
  }
  const pa = parse(a), pb = parse(b)
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  return pa.num - pb.num
}

type Unit = {
  id: string; rowId: number; wp: string; kode?: string; kodeList?: string[]
  kodeKasus2?: string[] // subset kodeList yang progress>0 (WIRING) - butuh jejak kalau digeser lagi
  tokenValue?: string | null; demand: number; woTarget: string; sortKode: string
  isExisting: boolean; kasus?: number
}

type Ctx = {
  panelMap: Record<string, any>
  woTargetOfPanel: (panel: any) => string
  getCap: (tanggal: string, proses: string) => { tipe: string; unit: number } | null
  getMenitPcs: (tipe: string, kode: string, proses: string) => number
}

const fetchAll = async (supabase: any, table: string, select: string) => {
  let all: any[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

// Data yang dipakai bareng di SEMUA hari yang diproses dalam satu invocation - panel/target
// WO/kapasitas/waktu-proses gak berubah sebagai AKIBAT dari geseran itu sendiri, jadi cukup
// dihitung sekali di awal, dipakai ulang tiap hari (beda dari raw_schedule yang WAJIB fresh-fetch
// tiap hari karena isinya berubah-ubah sepanjang loop).
const buildCtx = async (supabase: any): Promise<Ctx> => {
  const rawRowsAwal = await fetchAll(supabase, 'raw_schedule', 'panel_id')
  const panelIds = [...new Set(rawRowsAwal.map((r: any) => r.panel_id).filter(Boolean))]
  const panelRows = panelIds.length > 0
    ? await fetchAll(supabase, 'panels', 'id,nama,tipe,wo_id,checklist').then((all) => all.filter((p: any) => panelIds.includes(p.id)))
    : []
  const panelMap: Record<string, any> = {}
  panelRows.forEach((p: any) => { panelMap[String(p.id)] = p })

  const woIds = [...new Set(panelRows.map((p: any) => p.wo_id).filter(Boolean))]
  const woRows = woIds.length > 0
    ? await fetchAll(supabase, 'work_orders', 'id,target').then((all) => all.filter((w: any) => woIds.includes(w.id)))
    : []
  const woTargetMap: Record<string, string> = {}
  woRows.forEach((w: any) => { woTargetMap[String(w.id)] = w.target || '9999-99-99' })
  const woTargetOfPanel = (panel: any) => (panel?.wo_id != null && woTargetMap[String(panel.wo_id)]) || '9999-99-99'

  const capRows = await fetchAll(supabase, 'fcs_kapasitas_override', 'tanggal,jenis_pekerjaan,tipe_kapasitas,kapasitas_unit')
  const capMap: Record<string, { tipe: string; unit: number }> = {}
  capRows.forEach((c: any) => { capMap[`${c.tanggal}|${c.jenis_pekerjaan}`] = { tipe: c.tipe_kapasitas, unit: Number(c.kapasitas_unit) || 0 } })
  const getCap = (tanggal: string, proses: string) => capMap[`${tanggal}|${proses}`] || null

  const ptRows = await fetchAll(supabase, 'fcs_process_time', 'tipe_panel,kode_komponen,jenis_pekerjaan,menit_per_pcs,is_active').then((all) => all.filter((r: any) => r.is_active))
  const ptMap: Record<string, number> = {}
  ptRows.forEach((r: any) => { ptMap[`${r.tipe_panel}|${r.kode_komponen}|${r.jenis_pekerjaan}`] = Number(r.menit_per_pcs) || 0 })
  const getMenitPcs = (tipe: string, kode: string, proses: string) => ptMap[`${tipe}|${kode}|${proses}`] || 0

  return { panelMap, woTargetOfPanel, getCap, getMenitPcs }
}

// ================= LOGIC INTI SATU HARI (FASE 1/2/3) - TIDAK BERUBAH DARI VERSI CRON =================
// Dipanggil sekali per pasangan (hariSumber,hariTarget) - baik dari loop catch-up multi-hari
// maupun dari mode debug/backfill satu-hari-spesifik.
const prosesSatuHari = async (supabase: any, hariSumber: string, hariTarget: string, dryRun: boolean, ctx: Ctx) => {
  const { panelMap, woTargetOfPanel, getCap, getMenitPcs } = ctx
  const rawRows = await fetchAll(supabase, 'raw_schedule', '*')

  // rowOps: rowId -> tanggal -> {add:[{wp,kode,asalTanggal}], remove:[{wp,kode}], jejak:[{wp,kode,tujuan}]}
  const rowOps: Record<number, Record<string, { add: { wp: string; kode: string; asalTanggal: string }[]; remove: { wp: string; kode: string }[]; jejak: { wp: string; kode: string; tujuan: string }[] }>> = {}
  const ensureBucket = (rowId: number, tanggal: string) => {
    if (!rowOps[rowId]) rowOps[rowId] = {}
    if (!rowOps[rowId][tanggal]) rowOps[rowId][tanggal] = { add: [], remove: [], jejak: [] }
    return rowOps[rowId][tanggal]
  }
  const addOp = (rowId: number, tanggal: string, wp: string, kode: string, asalTanggal: string) => {
    ensureBucket(rowId, tanggal).add.push({ wp, kode, asalTanggal })
  }
  // removeOp (hapus kode tanpa jejak) sengaja udah gak dipakai lagi sejak revisi kasus1 (0%)
  // ikut ninggalin jejak juga - bucket `remove` di rowOps dibiarin ada (Fase 3 masih baca-nya,
  // selalu kosong sekarang, harmless no-op) biar gampang dipulihin kalau suatu saat perlu lagi.
  // Tandai kode SEBAGAI JEJAK di tanggal itu - kode TETAP ada di komponen (gak di-remove), cuma
  // ditandai read-only lewat digeserKe[kode]=tujuan (dipakai UI RawSchedule/RencanaHarian yang
  // sudah ada). Dipakai baik buat tanggal asal (kasus2) maupun tanggal "numpang lewat" pas
  // cascading multi-hop.
  const jejakOp = (rowId: number, tanggal: string, wp: string, kode: string, tujuan: string) => {
    ensureBucket(rowId, tanggal).jejak.push({ wp, kode, tujuan })
  }
  // tokenCarry: `${rowId}|${tanggal}|${wp}` -> token wiring yang perlu ditempel di entry itu
  const tokenCarry: Record<string, string> = {}

  // Kode yang UDAH berstatus jejak (punya digeserKe) di suatu entry - gak boleh dievaluasi ulang
  // buat geser berikutnya sama sekali (jejak "selesai perannya", gak ikut proses geser lagi).
  const isJejakKode = (entry: any, kode: string) => !!(entry?.digeserKe && entry.digeserKe[kode])

  // ================= FASE 1: klasifikasi progress per kode =================
  const kandidatJam: Record<string, { rowId: number; wp: string; kode: string; tipePanel: string; woTarget: string; menit: number; kasus: number }[]> = {}
  const kandidatOrang: Record<string, { rowId: number; wp: string; kodeList: string[]; kodeKasus2: string[]; tokenValue: string | null; woTarget: string }[]> = {}

  for (const row of rawRows) {
    if (PROSES_DIKECUALIKAN.includes(row.proses)) continue
    const entriesSumber = row.schedule?.[hariSumber] || []
    if (entriesSumber.length === 0) continue
    const panel = panelMap[String(row.panel_id)]
    if (!panel) continue
    const checklist = panel.checklist || {}
    const woTarget = woTargetOfPanel(panel)
    const isOrang = PROSES_ORANG.includes(row.proses)
    const tanpaCascade = PROSES_TANPA_CASCADE.includes(row.proses)

    entriesSumber.forEach((e: any) => {
      const realKode = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
      const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_')) || null
      const kodeIkutGeser: string[] = []
      const kodeKasus2: string[] = []
      realKode.forEach((kode: string) => {
        if (isJejakKode(e, kode)) return // jejak permanen - gak pernah dievaluasi ulang
        const cl = checklist[kode]
        const pct = cl?.progress?.[row.proses] || 0
        if (pct >= 100) return
        const kasus = pct === 0 ? 1 : 2
        // kasus1 (progress 0%) SEKARANG juga ninggalin jejak, sama kayak kasus2 - gak lagi
        // di-remove langsung di sini. Kedua kasus TIDAK di-remove, jejakOp-nya ditentukan di
        // Fase 2 sekalian sama hop-hop cascading-nya (satu titik keputusan, biar konsisten &
        // tau tujuan akhirnya kemana). Beda kasus1/2 cuma soal LABEL di frontend (dibaca dari
        // progress asli di tanggal itu), bukan soal ninggalin jejak atau enggak.
        kodeIkutGeser.push(kode)
        kodeKasus2.push(kode)
        if (tanpaCascade) {
          addOp(row.id, hariTarget, e.wp, kode, hariSumber)
          return
        }
        if (!isOrang) {
          const qtyTotal = Number(cl?.qty) || 0
          const qtyProsesSkrg = Number(cl?.qtyProses?.[row.proses]) || 0
          const qtySisa = Math.max(0, qtyTotal - qtyProsesSkrg)
          const menit = qtySisa * getMenitPcs(panel.tipe, kode, row.proses)
          if (!kandidatJam[row.proses]) kandidatJam[row.proses] = []
          kandidatJam[row.proses].push({ rowId: row.id, wp: e.wp, kode, tipePanel: panel.tipe, woTarget, menit, kasus })
        }
      })
      if (isOrang && !tanpaCascade && kodeIkutGeser.length > 0) {
        if (!kandidatOrang[row.proses]) kandidatOrang[row.proses] = []
        kandidatOrang[row.proses].push({ rowId: row.id, wp: e.wp, kodeList: kodeIkutGeser, kodeKasus2, tokenValue: token, woTarget })
      }
    })
  }

  // ================= FASE 2: cascading capacity =================
  const priorityCompare = (a: Unit, b: Unit) => {
    if (a.woTarget !== b.woTarget) return a.woTarget < b.woTarget ? -1 : 1
    return naturalKodeSort(a.sortKode, b.sortKode)
  }

  const overbookWarnings: string[] = []
  // Buat ringkasan hasil ke user (bukan cuma jumlah baris raw_schedule yang kesentuh) - berapa
  // KODE KOMPONEN yang beneran mendarat persis di hariTarget (tujuan langsung) vs yang kedorong
  // ke tanggal lain gara-gara kapasitas hariTarget udah penuh (cascading, bukan overbook).
  let komponenLangsung = 0
  let komponenDidorong = 0

  // Balikin finalDate PER unit, plus `hops`: tanggal-tanggal (selain finalDate) yang unit itu
  // "numpang lewat" pas cascading (dicoba tapi kapasitasnya udah penuh) - dipakai buat nulis
  // jejak multi-hop.
  const cascadePlace = (proses: string, mulaiTanggal: string, unitsAwal: Unit[]) => {
    const hasil = new Map<string, { finalDate: string }>()
    const hops = new Map<string, string[]>()
    unitsAwal.forEach((u) => hops.set(u.id, []))
    let pool = unitsAwal.slice()
    let tanggal = mulaiTanggal
    let hari = 0
    let hariTanpaKonfigBerturut = 0
    while (pool.length > 0 && hari < MAX_CASCADE_HARI) {
      const cap = getCap(tanggal, proses)
      if (!cap) {
        hariTanpaKonfigBerturut++
        if (hariTanpaKonfigBerturut >= MAX_HARI_TANPA_KONFIG) {
          // Kapasitas belum dikonfigurasi MAX_HARI_TANPA_KONFIG hari berturut-turut - STOP di sini
          // (jangan lanjut nebak-nebak sampai 90 hari), tempatkan paksa + catat warning jelas biar
          // ketauan ini beda kasus dari "kapasitas emang lagi penuh".
          const tanggalMulaiTanpaKonfig = addDaysStr(tanggal, -(hariTanpaKonfigBerturut - 1))
          overbookWarnings.push(`Kapasitas ${proses} BELUM DIKONFIGURASI ${hariTanpaKonfigBerturut} hari berturut-turut (${tanggalMulaiTanpaKonfig} s/d ${tanggal}) - ${pool.length} unit ditempatkan sementara di ${tanggal}. PERLU REVIEW MANUAL: isi kapasitas kerja ${proses} untuk tanggal ke depan. Unit: ${pool.map((u) => u.sortKode).join(',')}`)
          pool.forEach((u) => hasil.set(u.id, { finalDate: tanggal }))
          pool = []
          break
        }
        tanggal = addDaysStr(tanggal, 1); hari++; continue
      }
      hariTanpaKonfigBerturut = 0 // hari ini ADA konfigurasi (walau mungkin penuh) - reset counter
      const kapasitasUnit = cap.unit || 0
      if (kapasitasUnit <= 0) {
        tanggal = addDaysStr(tanggal, 1); hari++; continue
      }
      const sorted = pool.slice().sort(priorityCompare)
      let cum = 0
      const diterima: Unit[] = []
      const overflow: Unit[] = []
      sorted.forEach((u) => {
        if (diterima.length === 0 || cum + u.demand <= kapasitasUnit) { diterima.push(u); cum += u.demand }
        else overflow.push(u)
      })
      diterima.forEach((u) => hasil.set(u.id, { finalDate: tanggal }))
      overflow.forEach((u) => hops.get(u.id)!.push(tanggal))
      pool = overflow
      tanggal = addDaysStr(tanggal, 1); hari++
    }
    if (pool.length > 0) {
      overbookWarnings.push(`Kapasitas ${proses} penuh terus sampai ${MAX_CASCADE_HARI} hari sejak ${mulaiTanggal} - ${pool.length} unit tetap ditempatkan (overbook) di ${tanggal}: ${pool.map((u) => u.sortKode).join(',')}`)
      pool.forEach((u) => hasil.set(u.id, { finalDate: tanggal }))
    }
    return { hasil, hops }
  }

  // -- proses jam-based (semua kecuali WIRING & BUSBAR) --
  for (const [proses, kandidatList] of Object.entries(kandidatJam)) {
    const existingUnits: Unit[] = []
    rawRows.forEach((row: any) => {
      if (row.proses !== proses) return
      const panel = panelMap[String(row.panel_id)]
      if (!panel) return
      const checklist = panel.checklist || {}
      const entries = row.schedule?.[hariTarget] || []
      entries.forEach((e: any) => {
        ;(e.komponen || []).forEach((kode: string) => {
          if (kode.startsWith('__wiring_')) return
          if (isJejakKode(e, kode)) return // jejak - gak ikut kompetisi kapasitas lagi
          const cl = checklist[kode]
          // FIX INSIDEN 30 Jul 2026: kode yang progress-nya UDAH 100% gak boleh ikut jadi unit
          // yang "bersaing kapasitas" - satu entry WP bisa nyampur kode selesai+belum-selesai,
          // dan tanpa cek ini kode yang 100% ikut kebawa ke-geser/jejak kalau kapasitas hari itu
          // penuh, padahal harusnya gak pernah disentuh (persis kayak guard di Fase 1).
          if ((cl?.progress?.[proses] || 0) >= 100) return
          const qtyTotal = Number(cl?.qty) || 0
          const menit = qtyTotal * getMenitPcs(panel.tipe, kode, proses)
          const id = `ex_${row.id}_${e.wp}_${kode}`
          existingUnits.push({ id, rowId: row.id, wp: e.wp, kode, demand: menit, woTarget: woTargetOfPanel(panel), sortKode: kode, isExisting: true })
        })
      })
    })
    const existingKeySet = new Set(existingUnits.map((u) => `${u.rowId}|${u.wp}|${u.kode}`))
    // Kalau planner udah manual jadwalin kode yang sama di tanggal asal & tujuan sekaligus, jangan
    // dihitung dobel (existing + kandidat) buat kapasitas - TAPI kandidat yang di-dedupe ini tetap
    // harus dapat jejak di hariSumber (dicatat di dedupedKasus2, ditandai SETELAH placement
    // existing unit yang sama diketahui - unit existing itu sendiri bisa aja ikut kegeser lagi
    // hari ini, jadi gak boleh asumsi tujuannya selalu hariTarget).
    const dedupedKasus2: { rowId: number; wp: string; kode: string; existingId: string }[] = []
    const candUnits: Unit[] = []
    kandidatList.forEach((k) => {
      const key = `${k.rowId}|${k.wp}|${k.kode}`
      if (existingKeySet.has(key)) {
        dedupedKasus2.push({ rowId: k.rowId, wp: k.wp, kode: k.kode, existingId: `ex_${k.rowId}_${k.wp}_${k.kode}` })
        return
      }
      candUnits.push({ id: `cd_${k.rowId}_${k.wp}_${k.kode}`, rowId: k.rowId, wp: k.wp, kode: k.kode, demand: k.menit, woTarget: k.woTarget, sortKode: k.kode, isExisting: false, kasus: k.kasus })
    })

    const semuaUnit = [...existingUnits, ...candUnits]
    const adaDataMenit = semuaUnit.some((u) => u.demand > 0)
    let placement: Map<string, { finalDate: string }>
    let hopsMap: Map<string, string[]>
    if (!adaDataMenit) {
      // Gak ada data fcs_process_time buat kode2 ini - gak bisa dihitung demand-nya, skip cascading (langsung ke hariTarget, sama seperti sebelum fitur ini ada).
      placement = new Map()
      hopsMap = new Map()
      semuaUnit.forEach((u) => placement.set(u.id, { finalDate: hariTarget }))
    } else {
      const r = cascadePlace(proses, hariTarget, semuaUnit)
      placement = r.hasil
      hopsMap = r.hops
    }

    semuaUnit.forEach((u) => {
      const p = placement.get(u.id)
      if (!p) return
      const hops = hopsMap.get(u.id) || []
      if (p.finalDate === hariTarget) komponenLangsung++; else komponenDidorong++
      if (u.isExisting) {
        if (p.finalDate !== hariTarget) {
          // Selalu jejakOp, gak pernah removeOp di sini - konsisten sama kasus1 (0%) yang di
          // Fase 1 juga udah gak di-remove upfront.
          jejakOp(u.rowId, hariTarget, u.wp, u.kode!, p.finalDate)
          hops.forEach((h) => jejakOp(u.rowId, h, u.wp, u.kode!, p.finalDate))
          addOp(u.rowId, p.finalDate, u.wp, u.kode!, hariTarget)
        }
      } else {
        jejakOp(u.rowId, hariSumber, u.wp, u.kode!, p.finalDate)
        hops.forEach((h) => jejakOp(u.rowId, h, u.wp, u.kode!, p.finalDate))
        addOp(u.rowId, p.finalDate, u.wp, u.kode!, hariSumber)
      }
    })

    // Selesaikan jejak buat kandidat kasus2 yang di-dedupe tadi - tujuannya ngikut kemanapun
    // existing unit yang sama akhirnya ditempatkan (bisa aja existing unit itu sendiri ikut
    // ke-cascade lagi hari ini), fallback hariTarget kalau entah kenapa gak ketemu placement-nya.
    dedupedKasus2.forEach(({ rowId, wp, kode, existingId }) => {
      const finalDate = placement.get(existingId)?.finalDate || hariTarget
      jejakOp(rowId, hariSumber, wp, kode, finalDate)
    })
  }

  // -- WIRING (orang-based, satu tim/WP gerak bareng) --
  for (const [proses, kandidatList] of Object.entries(kandidatOrang)) {
    const existingUnits: Unit[] = []
    rawRows.forEach((row: any) => {
      if (row.proses !== proses) return
      const panel = panelMap[String(row.panel_id)]
      const checklist = panel?.checklist || {}
      const entries = row.schedule?.[hariTarget] || []
      entries.forEach((e: any) => {
        const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_')) || null
        // FIX INSIDEN 30 Jul 2026: sama kayak jam-based - kode yang progress-nya udah 100% gak
        // boleh ikut jadi bagian unit yang bersaing kapasitas (dan gak boleh dapet jejak lewat
        // sini kalau tim-nya ke-bump). Kalau SEMUA kode di entry ini udah 100%, realKode kosong,
        // unit-nya otomatis gak kebentuk (baris di bawah).
        const realKode = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_') && !isJejakKode(e, k) && (checklist[k]?.progress?.[proses] || 0) < 100)
        if (realKode.length === 0) return
        const m = token?.match(/^__wiring_(\d+)org_/)
        const orang = m ? parseInt(m[1], 10) : 1
        const sortKode = realKode.slice().sort(naturalKodeSort)[0]
        existingUnits.push({ id: `ex_${row.id}_${e.wp}`, rowId: row.id, wp: e.wp, kodeList: realKode, kodeKasus2: realKode, tokenValue: token, demand: orang, woTarget: woTargetOfPanel(panel), sortKode, isExisting: true })
      })
    })
    const existingWpKeySet = new Set(existingUnits.map((u) => `${u.rowId}|${u.wp}`))
    // Sama seperti jam-based: kandidat yang di-dedupe (WP itu udah ada tim lain di hariTarget)
    // TETAP butuh jejak buat kode di dalamnya - tujuannya ngikut existing unit yang sama.
    const dedupedKasus2Orang: { rowId: number; wp: string; kode: string; existingId: string }[] = []
    const candUnits: Unit[] = []
    kandidatList.forEach((k) => {
      const key = `${k.rowId}|${k.wp}`
      if (existingWpKeySet.has(key)) {
        k.kodeKasus2.forEach((kode) => dedupedKasus2Orang.push({ rowId: k.rowId, wp: k.wp, kode, existingId: `ex_${k.rowId}_${k.wp}` }))
        return
      }
      const m = k.tokenValue?.match(/^__wiring_(\d+)org_/)
      const orang = m ? parseInt(m[1], 10) : 1
      const sortKode = k.kodeList.slice().sort(naturalKodeSort)[0]
      candUnits.push({ id: `cd_${k.rowId}_${k.wp}`, rowId: k.rowId, wp: k.wp, kodeList: k.kodeList, kodeKasus2: k.kodeKasus2, tokenValue: k.tokenValue, demand: orang, woTarget: k.woTarget, sortKode, isExisting: false })
    })

    const semuaUnit = [...existingUnits, ...candUnits]
    const { hasil: placement, hops: hopsMap } = cascadePlace(proses, hariTarget, semuaUnit)

    semuaUnit.forEach((u) => {
      const p = placement.get(u.id)
      if (!p) return
      const hops = hopsMap.get(u.id) || []
      const jumlahKode = (u.kodeList || []).length
      if (p.finalDate === hariTarget) komponenLangsung += jumlahKode; else komponenDidorong += jumlahKode
      if (u.isExisting) {
        if (p.finalDate !== hariTarget) {
          u.kodeList!.forEach((kode) => {
            jejakOp(u.rowId, hariTarget, u.wp, kode, p.finalDate)
            hops.forEach((h) => jejakOp(u.rowId, h, u.wp, kode, p.finalDate))
          })
          u.kodeList!.forEach((kode) => addOp(u.rowId, p.finalDate, u.wp, kode, hariTarget))
          if (u.tokenValue) tokenCarry[`${u.rowId}|${p.finalDate}|${u.wp}`] = u.tokenValue
        }
      } else {
        u.kodeList!.forEach((kode) => {
          jejakOp(u.rowId, hariSumber, u.wp, kode, p.finalDate)
          hops.forEach((h) => jejakOp(u.rowId, h, u.wp, kode, p.finalDate))
          addOp(u.rowId, p.finalDate, u.wp, kode, hariSumber)
        })
        if (u.tokenValue) tokenCarry[`${u.rowId}|${p.finalDate}|${u.wp}`] = u.tokenValue
      }
    })

    // Sama seperti jam-based: selesaikan jejak buat kode yang WP-nya di-dedupe tadi.
    dedupedKasus2Orang.forEach(({ rowId, wp, kode, existingId }) => {
      const finalDate = placement.get(existingId)?.finalDate || hariTarget
      jejakOp(rowId, hariSumber, wp, kode, finalDate)
    })
  }

  // ================= FASE 3: terapkan (atau simulasikan) =================
  let jumlahRowDiproses = 0
  const detailDryRun: any[] = []

  for (const [rowIdStr, dateOps] of Object.entries(rowOps)) {
    const rowId = Number(rowIdStr)
    const rowAsli = rawRows.find((r: any) => r.id === rowId)
    if (!rowAsli) continue

    const { data: freshRowNow } = dryRun ? { data: null } as any : await supabase.from('raw_schedule').select('schedule').eq('id', rowId).single()
    const scheduleTerkini = freshRowNow?.schedule || rowAsli.schedule || {}
    const scheduleBaru = { ...scheduleTerkini }
    const sebelumSnapshot: Record<string, any> = {}
    const sesudahSnapshot: Record<string, any> = {}

    Object.entries(dateOps).forEach(([tanggal, ops]) => {
      sebelumSnapshot[tanggal] = scheduleTerkini[tanggal] || []
      let entries = (scheduleTerkini[tanggal] || []).map((e: any) => ({ ...e, komponen: [...(e.komponen || [])], digeserKe: { ...(e.digeserKe || {}) } }))
      ops.remove.forEach(({ wp, kode }) => {
        const idx = entries.findIndex((e: any) => e.wp === wp)
        if (idx === -1) return
        const { [kode]: _drop, ...restDigeserKe } = entries[idx].digeserKe
        entries[idx] = { ...entries[idx], komponen: entries[idx].komponen.filter((k: string) => k !== kode), digeserKe: restDigeserKe }
      })
      ops.add.forEach(({ wp, kode, asalTanggal }) => {
        const idx = entries.findIndex((e: any) => e.wp === wp)
        if (idx === -1) {
          entries.push({ wp, komponen: [kode], digeserKe: {}, carriedOverFrom: asalTanggal })
        } else if (!entries[idx].komponen.includes(kode)) {
          entries[idx] = { ...entries[idx], komponen: [...entries[idx].komponen, kode] }
        }
      })
      ops.jejak.forEach(({ wp, kode, tujuan }) => {
        const idx = entries.findIndex((e: any) => e.wp === wp)
        if (idx === -1) {
          // Tanggal ini belum punya entry WP itu sama sekali (kasus hop-cascading: kode "numpang
          // lewat" di tanggal yang gak pernah jadi tujuan literal) - bikin entry jejak baru.
          entries.push({ wp, komponen: [kode], digeserKe: { [kode]: tujuan } })
        } else {
          const komponen = entries[idx].komponen.includes(kode) ? entries[idx].komponen : [...entries[idx].komponen, kode]
          entries[idx] = { ...entries[idx], komponen, digeserKe: { ...entries[idx].digeserKe, [kode]: tujuan } }
        }
      })
      // Token wiring: tempelin balik ke entry yang punya kode asli tapi belum ada token-nya.
      entries = entries.map((e: any) => {
        const key = `${rowId}|${tanggal}|${e.wp}`
        const tokenSeharusnya = tokenCarry[key]
        const punyaRealKode = e.komponen.some((k: string) => !k.startsWith('__wiring_'))
        const punyaToken = e.komponen.some((k: string) => k.startsWith('__wiring_'))
        if (tokenSeharusnya && punyaRealKode && !punyaToken) return { ...e, komponen: [tokenSeharusnya, ...e.komponen] }
        return e
      })
      // Buang entry yang gak punya kode asli sama sekali lagi (termasuk sisa token doang).
      entries = entries.filter((e: any) => e.komponen.some((k: string) => !k.startsWith('__wiring_')))
      // Bersihin digeserKe kosong biar gak nyampah di JSON (opsional, cuma estetika data).
      entries = entries.map((e: any) => e.digeserKe && Object.keys(e.digeserKe).length === 0 ? (({ digeserKe, ...rest }) => rest)(e) : e)
      scheduleBaru[tanggal] = entries
      sesudahSnapshot[tanggal] = entries
    })

    if (dryRun) {
      detailDryRun.push({ rowId, proses: rowAsli.proses, panel: panelMap[String(rowAsli.panel_id)]?.nama, tipe: panelMap[String(rowAsli.panel_id)]?.tipe, tanggalTersentuh: Object.keys(dateOps), sebelum: sebelumSnapshot, sesudah: sesudahSnapshot })
    } else {
      await supabase.from('raw_schedule').update({ schedule: scheduleBaru }).eq('id', rowId)
    }
    jumlahRowDiproses++
    // Sengaja TIDAK menyentuh renhar sama sekali - status rilis di tanggal baru harus selalu mulai "Belum Dirilis", planner wajib rilis manual lagi.
  }

  if (overbookWarnings.length > 0) console.warn(overbookWarnings.join('\n'))

  return { jumlahRowDiproses, komponenLangsung, komponenDidorong, overbookWarnings, detail: detailDryRun }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    let dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true'
    let triggeredBy: string | null = null
    try {
      const body = await req.json()
      if (!dryRun) dryRun = !!body?.dryRun
      triggeredBy = typeof body?.triggeredBy === 'string' && body.triggeredBy.trim() ? body.triggeredBy.trim() : null
    } catch { /* gak ada body / bukan JSON - trigger cron/tombol default tanpa body, abaikan */ }

    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const hariIniWib = wibNow.toISOString().slice(0, 10)

    // MODE DEBUG/BACKFILL SATU HARI SPESIFIK - dryRun WAJIB, gak pernah bisa dipakai buat nulis.
    const overrideSumber = dryRun ? url.searchParams.get('hariSumber') : null
    const overrideTarget = dryRun ? url.searchParams.get('hariTarget') : null
    if (overrideSumber && overrideTarget) {
      const ctx = await buildCtx(supabase)
      const hasil = await prosesSatuHari(supabase, overrideSumber, overrideTarget, true, ctx)
      return jsonResponse({ success: true, dryRun: true, mode: 'debug-satu-hari', hariSumber: overrideSumber, hariTarget: overrideTarget, ...hasil })
    }

    // MODE CATCH-UP - proses semua hari yang ketinggalan dari checkpoint terakhir sampai hari ini.
    const { data: lastRun } = await supabase.from('auto_geser_runs').select('hari_target').order('hari_target', { ascending: false }).limit(1).maybeSingle()
    let cursor: string = lastRun?.hari_target || addDaysStr(hariIniWib, -1)
    const hariMulai: string | null = cursor < hariIniWib ? cursor : null

    const ctx = await buildCtx(supabase)
    let jumlahHariDiproses = 0
    let jumlahRowDiprosesTotal = 0
    let komponenLangsungTotal = 0
    let komponenDidorongTotal = 0
    const perHari: { hariSumber: string; hariTarget: string; jumlahRowDiproses: number }[] = []
    const overbookWarningsTotal: string[] = []

    while (cursor < hariIniWib && jumlahHariDiproses < MAX_CATCHUP_HARI) {
      const hSumber = cursor
      const hTarget = addDaysStr(cursor, 1)
      if (!dryRun) {
        const { error: claimErr } = await supabase.from('auto_geser_runs').insert({ hari_sumber: hSumber, hari_target: hTarget })
        if (claimErr) break // hari ini udah keklaim proses lain (race dgn invocation lain) - stop di sini, aman
      }
      const hasil = await prosesSatuHari(supabase, hSumber, hTarget, dryRun, ctx)
      perHari.push({ hariSumber: hSumber, hariTarget: hTarget, jumlahRowDiproses: hasil.jumlahRowDiproses })
      jumlahRowDiprosesTotal += hasil.jumlahRowDiproses
      komponenLangsungTotal += hasil.komponenLangsung
      komponenDidorongTotal += hasil.komponenDidorong
      overbookWarningsTotal.push(...hasil.overbookWarnings)
      jumlahHariDiproses++
      cursor = hTarget
    }
    const jumlahKomponenTotal = komponenLangsungTotal + komponenDidorongTotal

    if (!dryRun && triggeredBy && jumlahHariDiproses > 0) {
      await supabase.from('activity_log').insert({
        user_name: triggeredBy,
        action: 'TARIK MANUAL AUTO-GESER',
        description: `Tarik manual ${jumlahHariDiproses} hari (${hariMulai} s/d ${hariIniWib}), total ${jumlahKomponenTotal} komponen (${komponenLangsungTotal} langsung, ${komponenDidorongTotal} didorong kapasitas)`,
        module: 'rencana', halaman: 'Rencana Harian',
      })
    }
    // Warning cascading (kapasitas belum dikonfigurasi berturut-turut, lihat MAX_HARI_TANPA_KONFIG,
    // atau overbook mentok MAX_CASCADE_HARI) SEBELUMNYA cuma console.warn() + ikut di response JSON
    // yang gak pernah dibaca frontend (RencanaHarian.tsx tarikKeHariIni cuma baca success/jumlah*) -
    // jadi dulu gak pernah kelihatan sampai digali manual. Sekarang ditulis ke activity_log biar
    // langsung nongol di halaman yang udah dicek admin, gak nunggu 90 hari buat ketauan.
    if (!dryRun && overbookWarningsTotal.length > 0) {
      await supabase.from('activity_log').insert({
        user_name: triggeredBy || 'System',
        action: 'AUTO-GESER: PERLU REVIEW MANUAL',
        description: overbookWarningsTotal.join(' | '),
        module: 'rencana', halaman: 'Rencana Harian',
      })
    }

    return jsonResponse({
      success: true, dryRun, mode: 'catchup',
      hariMulai, hariTargetAkhir: hariIniWib,
      jumlahHariDiproses, jumlahRowDiprosesTotal,
      jumlahKomponenTotal, komponenLangsungTotal, komponenDidorongTotal,
      perHari, overbookWarnings: overbookWarningsTotal,
    })
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || String(err) }, 500)
  }
})
