// ISI SEL JADWAL RAW SCHEDULE (Tahap 0 migrasi accordion, 9 Okt 2026) - dipindah APA ADANYA dari
// RawSchedule.tsx supaya SATU sumber utk tampilan lama & accordion baru: isi sel tanpa komponen yang
// sudah selesai/jejak, rentang & sub-baris WIRING, dan aturan "boleh ikut dipilih" (multi-pilih/pindah).
// Fungsi murni - data panel dicari oleh pemanggil (lookup-nya beda-beda & dipertahankan apa adanya).
import { kodeBusbarBisaDipindah } from './jadwalPindah'
import { hitungProyeksiWiring } from '../services/fcsService'

export const PROSES_ORANG_RAW = ['WIRING POWER', 'WIRING CONTROL']

// Komponen yang progress-nya udah 100% harus "terkunci di tempatnya" - gak boleh ikut kebawa drag walau
// komponen LAIN di WP/cell yang sama lagi digeser. Buang kode yang udah selesai / sudah digeser (jejak)
// dari tiap entry (token __wiring_ dibiarin, itu metadata bobot bukan komponen asli); entry yang abis
// difilter kosong dibuang total. panelData tidak ditemukan -> entries dikembalikan apa adanya.
export function entriesTanpaSelesai(proses: string, entries: any[], panelData: any): any[] {
  if (!panelData) return entries
  return entries.map((e: any) => {
    const kodeAsli = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
    const kodeBelumSelesai = kodeAsli.filter((kode: string) => {
      const cl = panelData.checklist?.[kode]
      const sudahDigeser = e.digeserKe?.[kode]
      return (cl?.progress?.[proses] || 0) < 100 && !sudahDigeser
    })
    if (kodeBelumSelesai.length === 0) return null
    const markerTokens = (e.komponen || []).filter((k: string) => k.startsWith('__wiring_'))
    return { ...e, komponen: [...markerTokens, ...kodeBelumSelesai] }
  }).filter(Boolean)
}

// WIRING: semua komponen baris sebagai sub-baris (kotak rentang + jumlah orang). null = bukan WIRING /
// tidak ada komponen. `today` = TODAY (YYYY-MM-DD) utk penanda terlambat.
export function semuaKomponenSebagaiSubBaris(row: any, panelData: any, today: string): any[] | null {
  if (!PROSES_ORANG_RAW.includes(row.proses)) return null
  const semuaKomponen: any[] = []
  for (const [tglKey, entries] of Object.entries(row.schedule || {}) as [string, any[]][]) {
    for (const entry of entries) {
      for (const kode of entry.komponen || []) {
        const sudahAda = semuaKomponen.some(k => k.wp === entry.wp && k.kode === kode)
        if (sudahAda) continue
        const rentang = entry.rentangTanggal?.[kode]
        const jmlOrang = entry.orangPerKomponen?.[kode] || 1
        const progress = panelData?.checklist?.[kode]?.progress?.[row.proses] || 0
        const terlambat = rentang?.selesai && today > rentang.selesai && progress < 100
        semuaKomponen.push({ wp: entry.wp, kode, mulai: rentang?.mulai || tglKey, selesai: rentang?.selesai || tglKey, jumlahOrang: jmlOrang, progress, terlambat })
      }
    }
  }
  if (semuaKomponen.length === 0) return null
  semuaKomponen.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.wp.localeCompare(b.wp))
  return semuaKomponen
}

// WIRING: rentang (gabungan) semua komponen yang rentangnya mencakup tanggal ini. null = tidak ada.
export function rentangInfoUntukTanggal(row: any, tanggal: string) {
  if (!PROSES_ORANG_RAW.includes(row.proses)) return null
  const semuaKomponenAktif: any[] = []
  for (const entries of Object.values(row.schedule || {}) as any[]) {
    for (const entry of entries) {
      if (!entry.rentangTanggal) continue
      for (const kode of entry.komponen || []) {
        const rentang = entry.rentangTanggal[kode]
        if (!rentang) continue
        if (tanggal >= rentang.mulai && tanggal <= rentang.selesai) {
          semuaKomponenAktif.push({ wp: entry.wp, kode, mulai: rentang.mulai, selesai: rentang.selesai })
        }
      }
    }
  }
  if (semuaKomponenAktif.length === 0) return null
  // Union: mulai paling awal & selesai paling akhir dari SEMUA komponen yg overlap di tanggal ini
  const unionMulai = semuaKomponenAktif.reduce((min, k) => k.mulai < min ? k.mulai : min, semuaKomponenAktif[0].mulai)
  const unionSelesai = semuaKomponenAktif.reduce((max, k) => k.selesai > max ? k.selesai : max, semuaKomponenAktif[0].selesai)
  return { mulai: unionMulai, selesai: unionSelesai, isStart: tanggal === unionMulai, komponenList: semuaKomponenAktif }
}

export type KonteksPilih = {
  checklistPanel: (row: any) => any // checklist panel baris (BUSBAR)
  entriesTanpaSelesai: (row: any, entries: any[]) => any[]
}

// MULTI-PILIH SEL - aturan "boleh ikut dipilih" = aturan drag yang sudah ada: sel yang semua isinya
// selesai/jejak tidak bisa; sel rentang WIRING tidak bisa. BUSBAR & QC/PACKING ikut (revisi 9 Okt 2026):
// BUSBAR = kode yang belum jejak & progress < 100; QC/PACKING ("MARKED") lewat jalur biasa.
// null = boleh; string = alasan (toast). `kosongBoleh` = sel tanpa isi dianggap boleh (Ctrl+klik, copy/
// paste); lasso -> false.
export function alasanTakBisaMultiPilih(row: any, date: string, kosongBoleh: boolean, ctx: KonteksPilih): string | null {
  if (!row) return 'Baris tidak ditemukan.'
  if (rentangInfoUntukTanggal(row, date)) return 'Sel rentang tidak bisa dipindah.'
  if (row.proses === 'BUSBAR') {
    if ((row.busbar_schedule?.[date] || []).length === 0) return kosongBoleh ? null : 'Sel kosong.'
    if (kodeBusbarBisaDipindah(row, ctx.checklistPanel(row), date).length === 0) return 'Semua kode BUSBAR di sel ini sudah selesai / sudah digeser (jejak) - tidak bisa dipilih.'
    return null
  }
  const entries = row.schedule?.[date] || []
  if (entries.length === 0) return kosongBoleh ? null : 'Sel kosong.'
  if (ctx.entriesTanpaSelesai(row, entries).length === 0) return 'Semua pekerjaan di sel ini sudah selesai / sudah digeser (jejak) - tidak bisa dipilih.'
  return null
}

// WIRING: JADWAL LANJUTAN (12 Agu 2026; dipindah APA ADANYA dari RawSchedule.tsx di Tahap 1) - tampilan
// MURNI (tidak menulis raw_schedule): komponen wiring yang LIVE (belum jejak, belum 100%) di suatu tanggal
// tampil juga di tanggal-tanggal SETELAHNYA sepanjang sisa durasi standar bobotnya, dihitung dari POSISI
// LIVE + hari kerja aktual (hitungProyeksiWiring, sumber yang sama dgn kapasitas). Bukan WIRING -> {}.
// Hasil: tanggal -> [{kode, wp, hariKeN, orang}].
export function jadwalLanjutanWiring(row: any, panelData: any, wiringHariKerjaMap: any): Record<string, { kode: string; wp: string; hariKeN: number; orang: number }[]> {
  if (!PROSES_ORANG_RAW.includes(row.proses)) return {}
  const map: Record<string, { kode: string; wp: string; hariKeN: number; orang: number }[]> = {}
  const panelIdRow = row.panel_id || row.panelId
  Object.entries(row.schedule || {}).forEach(([liveDate, liveEntries]: [string, any]) => {
    (liveEntries || []).forEach((e: any) => {
      (e.komponen || []).forEach((kode: string) => {
        if (kode.startsWith('__wiring_')) return
        if (e.digeserKe?.[kode]) return // jejak - bukan posisi live
        const progress = panelData?.checklist?.[kode]?.progress?.[row.proses] || 0
        if (progress >= 100) return
        const bobot = row.bobot_komponen?.[kode]
        hitungProyeksiWiring(panelIdRow, kode, row.proses, e.wp, liveDate, bobot, wiringHariKerjaMap).forEach(({ tanggal, ...proj }: any) => {
          if (!map[tanggal]) map[tanggal] = []
          map[tanggal].push(proj)
        })
      })
    })
  })
  return map
}
