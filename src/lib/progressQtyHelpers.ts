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

const PROSES_TIDAK_DISKALA = ['QC TEST', 'PACKING']

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
    // Unit selesai = TERBESAR dari hitungan unit operator (qtyProses) dan persen yang tampil x qty
    // lama. Data konsisten (Frame 12/12 = 100%) -> sama persis dgn qtyProses/qtyBaru (12/16 = 75%).
    // qtyProses yang tertinggal dari persen (mis. Groundplate 5 unit tapi tampil 100% dari 9) ->
    // progress yang sudah tampil tidak pernah dipotong. Proses tanpa qtyProses (WIRING dst) ->
    // proporsional persen x qty lama / qty baru.
    const selesai = Math.max(qtyDone, (pctLama / 100) * qtyLama)
    const pctBaru = Math.min(100, Math.round((selesai / qtyBaru) * 100))
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
