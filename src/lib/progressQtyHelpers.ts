import { getBestProgress } from './panelHelpers'

// ─────────────────────────────────────────────────────────────────────────────
// SESUAIKAN PROGRESS SAAT QTY KOMPONEN BERUBAH - SATU sumber (2 Okt 2026, insiden MCC PANEL PT.
// MITRA ALAM SEGAR: qty Frame 12 -> 16 tapi progress tetap 100%). Dipakai SEMUA jalur pengubah qty:
// grid Edit Qty (usePanelQtyEditor: preview & simpan) dan Edit WO qty panel (ManajemenWO.buildNp).
//
// Dulu (sebelum 3 Agu 2026) skala proporsional dihitung di state lokal lalu ikut tersimpan; sejak
// fix race condition a069862 saveQtyEdit membaca checklist segar dari DB dan cuma mengganti qty,
// jadi persen hasil skala terbuang -> persen tersimpan nyangkut di angka lama.
//
// Aturan (keputusan user 2 Okt 2026):
// - Unit yang sudah dikerjakan (qtyProses) TIDAK pernah diubah - cuma PERSEN yang dihitung ulang.
// - Persen baru = unit selesai / qty baru, unit selesai = max(qtyProses, persen tampil x qty lama).
//   Data konsisten -> sama dgn rumus Vista Pekerja saat operator simpan (OperatorView:
//   Math.round(qtyProses/qtyKomp*100)); proses yang cuma punya persen (WIRING, PASANG KOMPONEN,
//   BUSBAR, RAKIT tanpa hitungan unit) -> otomatis proporsional qty lama / qty baru.
// - QC TEST / PACKING TIDAK disentuh (proses whole-panel, bukan per komponen - CLAUDE.md B.2).
// - Persen yang DITAMPILKAN = getBestProgress = max(history terbaru, progressByDate terbaru,
//   progress) - jadi ketiganya disesuaikan bersamaan (progress, pct entri history terbaru, semua
//   tanggal progressByDate diskalakan & tanggal terakhir = persen baru), sama seperti perilaku
//   sebelum Agustus. Kalau cuma progress yang diubah, max() tetap menampilkan angka lama.
// - qty lama/baru <= 0 atau sama -> entri dikembalikan apa adanya (qty jadi 0 ditangani jalur
//   jadwal tersendiri; progress & riwayatnya sengaja dipertahankan).
// ─────────────────────────────────────────────────────────────────────────────

export const PROSES_TIDAK_DISKALA = ['QC TEST', 'PACKING']

// Rumus SATU-SATUNYA persen baru setelah qty berubah - dipakai checklist (di bawah) DAN tabel
// component_process_progress (lib/componentProcessProgress.ts sinkronCcpSetelahUbahQty), supaya
// dua sumber yang dibaca halaman admin tidak bisa beda hasil (CLAUDE.md B.1).
// Unit selesai = TERBESAR dari hitungan unit (qtyDone) dan persen lama x qty lama. Data konsisten
// (Frame 12/12 = 100%) -> sama persis dgn qtyDone/qtyBaru (12/16 = 75%); hitungan unit yang
// tertinggal dari persen (Groundplate 5 unit tapi tampil 100% dari 9) -> progress yang sudah tampil
// tidak pernah dipotong; proses tanpa hitungan unit (WIRING dst) -> proporsional qty lama/qty baru.
export function hitungPctSetelahUbahQty(pctLama: number, qtyDone: number, qtyLama: number, qtyBaru: number): number {
  const selesai = Math.max(Number(qtyDone) || 0, ((Number(pctLama) || 0) / 100) * qtyLama)
  return Math.min(100, Math.round((selesai / qtyBaru) * 100))
}

export function sesuaikanProgressKeQtyBaru(cl: any, qtyLama: number, qtyBaru: number): any {
  if (!cl || !(qtyLama > 0) || !(qtyBaru > 0) || qtyLama === qtyBaru) return cl
  const ratio = qtyLama / qtyBaru
  const progress: any = { ...(cl.progress || {}) }
  const history: any = { ...(cl.history || {}) }
  const progressByDate: any = { ...(cl.progressByDate || {}) }
  const semuaProses = new Set([...Object.keys(progress), ...Object.keys(history), ...Object.keys(progressByDate), ...Object.keys(cl.qtyProses || {})])
  semuaProses.forEach((pr) => {
    if (PROSES_TIDAK_DISKALA.includes(pr)) return
    const qtyDone = Number(cl.qtyProses?.[pr]) || 0
    const pctLama = getBestProgress(cl, pr)
    if (!(qtyDone > 0) && !(pctLama > 0)) return
    const pctBaru = hitungPctSetelahUbahQty(pctLama, qtyDone, qtyLama, qtyBaru)
    progress[pr] = pctBaru
    const hist = history[pr]
    if (Array.isArray(hist) && hist.length > 0) {
      // entri TERBARU (ts/tanggal) - sama dgn yang dibaca getProgressFromHistory
      let iTerbaru = 0
      hist.forEach((h: any, i: number) => {
        const a = h?.ts || h?.tanggal || '', b = hist[iTerbaru]?.ts || hist[iTerbaru]?.tanggal || ''
        if (a.localeCompare(b) > 0) iTerbaru = i
      })
      const baru = [...hist]
      baru[iTerbaru] = { ...baru[iTerbaru], pct: pctBaru }
      history[pr] = baru
    }
    const byDate = progressByDate[pr]
    if (byDate && typeof byDate === 'object' && Object.keys(byDate).length > 0) {
      const tanggal = Object.keys(byDate).sort()
      const skala: any = {}
      tanggal.forEach((t) => { skala[t] = Math.min(100, Math.round((Number(byDate[t]) || 0) * ratio)) })
      skala[tanggal[tanggal.length - 1]] = pctBaru
      progressByDate[pr] = skala
    }
  })
  return { ...cl, qty: qtyBaru, progress, history, progressByDate }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSBAR (2 Okt 2026) - komponen busbar (H-BUS/INCOMING/.../LINE) TIDAK punya qty (selalu 0), progress
// murni persen per tahap (checklist[kode].busbarTahap[FABRIKASI|PLATING|HEATSHRINK|PASANG].progress).
// Saat busbar bertambah, Admin mengisi jumlah sebelum -> sesudah di popup Penyesuaian Busbar
// (Manajemen WO); tiap tahap diskalakan dgn rumus yang SAMA dgn komponen biasa.
// ─────────────────────────────────────────────────────────────────────────────

// Cermin PERSIS vista-pekerja lib/panelHelpers.tsx hitungProgressBusbarGabungan (repo terpisah,
// gak bisa share modul) - persen BUSBAR gabungan = rata-rata tahap yang ADA di komponen itu
// (sebagian komponen tanpa HEATSHRINK), dibulatkan 1 desimal. Kalau rumus operator berubah, ubah ini juga.
export function hitungProgressBusbarGabungan(busbarTahap: any, urutan: string[]): number {
  if (!busbarTahap || urutan.length === 0) return 0
  const total = urutan.reduce((s, t) => s + (busbarTahap[t]?.progress || 0), 0)
  return Math.round((total / urutan.length) * 10) / 10
}

export function sesuaikanBusbarKeJumlahBaru(cl: any, jumlahLama: number, jumlahBaru: number): any {
  if (!cl?.busbarTahap || !(jumlahLama > 0) || !(jumlahBaru > 0) || jumlahLama === jumlahBaru) return cl
  const urutan = Object.keys(cl.busbarTahap)
  const busbarTahap: any = {}
  urutan.forEach((t) => {
    const lama = Number(cl.busbarTahap[t]?.progress) || 0
    const baru = hitungPctSetelahUbahQty(lama, 0, jumlahLama, jumlahBaru)
    busbarTahap[t] = { ...cl.busbarTahap[t], progress: baru, sudahDisimpan100: baru >= 100 ? !!cl.busbarTahap[t]?.sudahDisimpan100 : false }
  })
  const gabungan = hitungProgressBusbarGabungan(busbarTahap, urutan)
  const progress = { ...(cl.progress || {}), BUSBAR: gabungan }
  const history: any = { ...(cl.history || {}) }
  const hist = history.BUSBAR
  if (Array.isArray(hist) && hist.length > 0) {
    let iTerbaru = 0
    hist.forEach((h: any, i: number) => { if ((h?.ts || h?.tanggal || '').localeCompare(hist[iTerbaru]?.ts || hist[iTerbaru]?.tanggal || '') > 0) iTerbaru = i })
    const baru = [...hist]; baru[iTerbaru] = { ...baru[iTerbaru], pct: gabungan }; history.BUSBAR = baru
  }
  const progressByDate: any = { ...(cl.progressByDate || {}) }
  const byDate = progressByDate.BUSBAR
  if (byDate && Object.keys(byDate).length > 0) {
    const tgl = Object.keys(byDate).sort()
    const skala: any = {}
    tgl.forEach((t) => { skala[t] = hitungPctSetelahUbahQty(Number(byDate[t]) || 0, 0, jumlahLama, jumlahBaru) })
    skala[tgl[tgl.length - 1]] = gabungan
    progressByDate.BUSBAR = skala
  }
  return { ...cl, busbarTahap, progress, history, progressByDate }
}

// Komponen busbar yang bisa disesuaikan = punya busbarTahap dgn minimal 1 tahap > 0%.
export const komponenBusbarPunyaProgress = (cl: any) => !!cl?.busbarTahap && Object.values(cl.busbarTahap).some((v: any) => (Number(v?.progress) || 0) > 0)
