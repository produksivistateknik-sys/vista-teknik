// HITUNG KAPASITAS HARIAN RAW SCHEDULE (Tahap 0 migrasi accordion, 9 Okt 2026) - dipindah APA ADANYA
// dari RawSchedule.tsx supaya SATU sumber utk Raw Schedule lama & tampilan accordion baru (kartu
// Capacity Utilization + validasi pindah ke hari Minggu). Fungsi murni: semua data lewat parameter,
// tanpa request & tanpa state React.
import { PROSES_ORANG_RAW_GLOBAL } from '../constants/panelTypes'
import { kebutuhanOrangWiring } from './panelHelpers'
import { hariKeNFromMap, hitungProyeksiWiring } from '../services/fcsService'

// Menit per pcs dari Master Data Process Time (fcs_process_time aktif) utk tipe+proses+kode. 0 bila
// tidak ada (komponen tanpa timer tidak menambah beban).
export function menitPerPcs(processTimeList: any[], tipePanel: string, proses: string, kode: string): number {
  const pt = processTimeList.find((p: any) => p.tipe_panel === tipePanel && p.jenis_pekerjaan === proses && p.kode_komponen === kode)
  return pt ? Number(pt.menit_per_pcs) : 0
}

// Kapasitas 1 hari x 1 proses dari fcs_kapasitas_override: proses orang (WIRING) = jumlah_orang, proses
// jam = kapasitas_menit. Tidak ada baris = 0 ("belum diatur").
export function kapasitasPada(fcsKapasitas: any[], d: string, pr: string): number {
  const ov = fcsKapasitas.find((k: any) => k.jenis_pekerjaan === pr && k.tanggal === d)
  if (!ov) return 0
  return PROSES_ORANG_RAW_GLOBAL.includes(pr) ? Number(ov.jumlah_orang || 0) : Number(ov.kapasitas_menit || 0)
}

export type KonteksTerpakai = {
  panelById: Map<number, any>
  menitPerPcs: (tipePanel: string, proses: string, kode: string) => number
  wiringHariKerjaMap: any
}

// PEMAKAIAN KAPASITAS 1 hari x 1 proses - rumus kartu Capacity Utilization. `rows` = baris raw_schedule
// (bisa versi "setelah dipindah"). Proses jam = qty x menit/pcs, WIRING = kebutuhan orang (+ kartu
// jadwal lanjutan wiringForwardMap), jejak digeserKe tidak dihitung.
export function hitungTerpakaiHari(rows: any[], d: string, pr: string, ctx: KonteksTerpakai): number {
  const isOrangPr = PROSES_ORANG_RAW_GLOBAL.includes(pr)
  let terpakaiPr = 0
  rows.filter((r: any) => r.proses === pr).forEach((r: any) => {
    const panelId = r.panel_id || r.panelId
    const panelData = ctx.panelById.get(Number(panelId))
    if (!panelData) return
    const entries = r.schedule?.[d] || []
    // Kode wiring yang UDAH punya entry REAL di tanggal d - dipakai buat dedup kartu lanjutan di bawah
    // (real selalu menang, gak boleh dobel-hitung).
    const kodeRealHariIni = new Set<string>(isOrangPr ? entries.flatMap((e: any) => (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))) : [])
    entries.forEach((e: any) => {
      if (isOrangPr) {
        // REVISI TOTAL (12 Agu 2026): kebutuhan orang PER KOMPONEN, dari bobot_komponen (row-level) +
        // hari kerja aktual (fcs_timer_kerja) - lihat panelHelpers.ts WIRING_BOBOT_TABLE. Jejak
        // (digeserKe) tetap dikecualikan seperti proses lain.
        (e.komponen || []).forEach((kode: string) => {
          if (kode.startsWith('__wiring_')) return
          if (e.digeserKe?.[kode]) return
          const bobot = r.bobot_komponen?.[kode]
          const hariKeN = hariKeNFromMap(ctx.wiringHariKerjaMap, panelId, kode, pr, d)
          terpakaiPr += kebutuhanOrangWiring(bobot, hariKeN)
        })
      } else {
        (e.komponen || []).forEach((kode: string) => {
          // Jejak (digeserKe) itu histori read-only - JANGAN dihitung kapasitas (sama rule dgn
          // checkKapasitasDanKomponenSwapV2/auto-geser-harian).
          if (e.digeserKe?.[kode]) return
          const qty = panelData.checklist?.[kode]?.qty || 0
          const menitPcs = ctx.menitPerPcs(panelData.tipe, pr, kode)
          terpakaiPr += qty * menitPcs
        })
      }
    })
    // TAMBAHAN (12 Agu 2026): kartu lanjutan wiring (wiringForwardMap di grid) ikut kehitung - reuse
    // hitungProyeksiWiring yang SAMA dipakai kartu, biar planner lain gak overbook di hari yang
    // "keliatan" udah terisi (mis. komponen VERY_HARD 4 hari yang cuma punya 1 entry real). Kode yang
    // UDAH ada entry real di tanggal d (kodeRealHariIni) di-skip - real selalu menang.
    if (isOrangPr) {
      Object.entries(r.schedule || {}).forEach(([liveDate, liveEntries]: [string, any]) => {
        if (liveDate === d) return
        ;(liveEntries || []).forEach((e: any) => {
          (e.komponen || []).forEach((kode: string) => {
            if (kode.startsWith('__wiring_')) return
            if (e.digeserKe?.[kode]) return
            if (kodeRealHariIni.has(kode)) return
            const progress = panelData?.checklist?.[kode]?.progress?.[pr] || 0
            if (progress >= 100) return
            const bobot = r.bobot_komponen?.[kode]
            hitungProyeksiWiring(panelId, kode, pr, e.wp, liveDate, bobot, ctx.wiringHariKerjaMap).forEach((p: any) => {
              if (p.tanggal === d) terpakaiPr += p.orang
            })
          })
        })
      })
    }
  })
  return terpakaiPr
}
