// DEADLINE PANEL RAW SCHEDULE (Tahap 0 migrasi accordion, 9 Okt 2026) - dipindah APA ADANYA dari
// RawSchedule.tsx supaya SATU sumber utk tampilan lama & accordion baru. Fungsi murni, tanpa request.
//
// Deadline panel = target baris WO-nya (work_orders.target) - TIDAK berdiri sendiri: deadline per panel
// di Manajemen WO sudah diwujudkan dgn memecah panel ke baris WO sibling per tanggal (saveWOWithSplit),
// jadi target WO = deadline panel. Baca-saja (ubah lewat Manajemen WO).

export type DeadlinePanel = { target: string; wo: string }

// Panel id (Number, ambil yang PERTAMA - sama dgn panelById) -> deadline. Dari woData yang sudah dimuat.
export function buatPetaDeadlinePanel(woData: any[]): Map<number, DeadlinePanel> {
  const m = new Map<number, DeadlinePanel>()
  woData.forEach((w: any) => (w.panels || []).forEach((p: any) => { const k = Number(p.id); if (!m.has(k) && w.target) m.set(k, { target: String(w.target).slice(0, 10), wo: w.wo }) }))
  return m
}

// Filter baris yang tampil - SATU sumber utk grid & penanda deadline di header.
export type FilterBaris = { proses: string[]; proyek: string[]; panel: string[] }
export const lolosFilterBaris = (row: any, f: FilterBaris) =>
  (f.proses.length === 0 || f.proses.includes(row.proses)) &&
  (f.proyek.length === 0 || f.proyek.includes(row.proyek)) &&
  (f.panel.length === 0 || f.panel.includes(row.panel))

// 🚩 di header tanggal: panel (yang tampil) dgn deadline di tanggal itu -> ["PANEL (WO x)", ...].
export function petaDeadlinePerTanggal(rawData: any[], deadlinePanel: Map<number, DeadlinePanel>, lolos: (row: any) => boolean): Map<string, string[]> {
  const m = new Map<string, string[]>(); const sudah = new Set<number>()
  rawData.forEach((row: any) => {
    const pid = Number(row.panel_id || row.panelId); if (sudah.has(pid) || !lolos(row)) return
    sudah.add(pid); const dl = deadlinePanel.get(pid); if (!dl) return
    if (!m.has(dl.target)) m.set(dl.target, []); m.get(dl.target)!.push(`${row.panel} (WO ${dl.wo})`)
  })
  return m
}

// Label & warna teks deadline (8 Okt 2026 koreksi tampilan): teks polos, warna HANYA di teks. normal >7
// hari = abu gelap seperti teks PANEL; segera 4-7 = oranye tua; mepet 0-3 (termasuk hari ini) = merah
// tua; terlambat = merah tua tebal. >=100 hari terlambat: bentuk pendek supaya tidak terpotong di kolom
// 96px. `today` = TODAY (YYYY-MM-DD).
export function infoDeadline(target: string, today: string) {
  const sisa = Math.round((Date.UTC(+target.slice(0, 4), +target.slice(5, 7) - 1, +target.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 86400000)
  const label = sisa > 0 ? `${sisa} hari lagi` : sisa === 0 ? 'Hari ini' : -sisa >= 100 ? `Telat ${-sisa} hr` : `Terlambat ${-sisa} hari`
  const warna = sisa < 0 ? { tgl: '#b91c1c', ket: '#b91c1c', tebal: true } : sisa <= 3 ? { tgl: '#b91c1c', ket: '#b91c1c', tebal: false }
    : sisa <= 7 ? { tgl: '#c2410c', ket: '#c2410c', tebal: false } : { tgl: '#1e293b', ket: '#64748b', tebal: false }
  const tgl = new Date(target + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return { sisa, label, warna, tgl }
}
