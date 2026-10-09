// PILIHAN ACCORDION -> DATA PINDAH (Tahap 2 migrasi accordion, 9 Okt 2026) - FUNGSI MURNI.
//
// Kunci pilihan = "<kunciBaris>|<tanggal>":
//   g:<panelId>:<grup>          header WP / BUSBAR  -> semua komponen grup itu pada tanggal tsb
//   k:<panelId>:<grup>:<kode>   baris komponen      -> kode itu di SEMUA proses pada tanggal tsb
//   p:<panelId>:<proses>        penanda QC/PACKING  -> penanda pada tanggal tsb
// Pilihan dijabarkan per sel jadwal asal (baris raw_schedule x tanggal) lalu DIGABUNG (header + komponennya
// / 2 komponen dari sel yang sama = 1 data pindah, tidak "dilepas" 2x). Yang tidak ikut: komponen selesai
// (progress proses itu 100%), jejak (digeserKe), hari lanjutan WIRING (bukan entry tersimpan) - sama dgn
// aturan drag/pindah tampilan lama (entriesTanpaSelesai, kodeBusbarBisaDipindah).
// Validasi sama dgn tampilan lama: di luar rentang, sel rentang WIRING, timer BUSBAR berjalan, Minggu
// berkapasitas (cekMingguKapasitas). Rumus jadwal/RPC/Undo tetap lib/jadwalPindah + hooks/usePindahMulti.
import { kodeBusbarBisaDipindah, ambilJadwal4, rencanakanSalinMultiV2, type SelPindahV2 } from './jadwalPindah'
import { cekMingguKapasitas, type KonteksMinggu } from './pindahMulti'
import { rentangInfoUntukTanggal } from './isiSelJadwal'
import type { BlokPanel } from './rawPivot'

export type KonteksPindahAcc = KonteksMinggu & {
  rawData: any[]
  blokById: Map<number, BlokPanel>
  checklistPanel: (row: any) => any
  entriesTanpaSelesai: (row: any, entries: any[]) => any[]
  tanggalKeIdx: (d: string) => number
  idxKeTanggal: (i: number) => string
  totalKolom: number
  timerBusbar: Set<string> // "panelId|kode" timer BUSBAR berjalan
}

export const pecahKunci = (kunci: string) => {
  const i = kunci.lastIndexOf('|')
  const baris = kunci.slice(0, i), tanggal = kunci.slice(i + 1)
  const [jenis, pid, a, ...sisa] = baris.split(':')
  return { baris, tanggal, jenis, panelId: Number(pid), grup: jenis === 'p' ? '' : a, kode: jenis === 'k' ? sisa.join(':') : '', proses: jenis === 'p' ? a : '' }
}

// Unit yang bisa dipindah dari 1 kunci pilihan (tanpa validasi tujuan): sel biasa [{rawId, wp, kode}],
// BUSBAR [{rawId, kodeBusbar}], penanda [{rawId}] (seluruh isi sel penanda).
type Unit = { rawId: number; dari: string; jenis: 'biasa' | 'busbar' | 'penanda'; wp?: string; kode?: string }
function unitDari(kunci: string, ctx: KonteksPindahAcc): Unit[] {
  const k = pecahKunci(kunci)
  const blok = ctx.blokById.get(k.panelId); if (!blok) return []
  const d = k.tanggal
  if (k.jenis === 'p') {
    const p = blok.penanda.find(x => x.proses === k.proses)
    return p && p.sel[d] ? [{ rawId: p.rawId, dari: d, jenis: 'penanda' }] : []
  }
  const g = blok.grup.find(x => x.key === k.grup); if (!g) return []
  const komponen = k.jenis === 'k' ? g.komponen.filter(x => x.kode === k.kode) : g.komponen
  const out: Unit[] = []
  for (const km of komponen) for (const c of km.sel[d] || []) {
    if (c.jejakKe || c.lanjutan) continue
    if (g.jenis === 'busbar') out.push({ rawId: c.rawId, dari: d, jenis: 'busbar', kode: km.kode })
    else out.push({ rawId: c.rawId, dari: d, jenis: 'biasa', wp: c.wp, kode: km.kode })
  }
  return out
}

export type HasilPindahAcc = {
  sel: SelPindahV2[]
  jadwal: Map<number, any>
  bentrok: { kunci: string; ke: string; alasan: string }[] // per kunci pilihan (asal)
  tujuan: Map<string, 'ok' | 'minggu' | 'bad'> // "<kunciBaris>|<tanggalTujuan>" -> status (bayangan drag)
  alasanTujuan: Map<string, string>
  jumlahKomponen: number // kode berbeda yang ikut (teks pesan)
  rowsSalin?: { raw_id: number; sebelum: any; sesudah: any }[] // mode salin: jadwal sebelum/sesudah per baris
}

// mode 'salin' (Tahap 3a): sel asal tidak diubah, tujuan DIGABUNG; tidak ada tolak "sel rentang"/"timer BUSBAR"
// (asal tidak disentuh); Minggu berkapasitas dihitung dgn sumber tetap ada. Hasil + rowsSalin (sebelum/sesudah).
export function rencanakanPindahAccordion(kunciPilihan: string[], offset: number, ctx: KonteksPindahAcc, mode: 'pindah' | 'salin' = 'pindah'): HasilPindahAcc {
  const rowById = new Map<number, any>(ctx.rawData.map((r: any) => [r.id, r]))
  // 1) jabarkan pilihan -> unit, catat kunci asal per (rawId|dari)
  const unitPer = new Map<string, Unit[]>() // rawId|dari -> unit
  const kunciPer = new Map<string, Set<string>>() // rawId|dari -> kunci pilihan asal
  const bentrok: HasilPindahAcc['bentrok'] = []
  const keDari = (d: string) => { const i = ctx.tanggalKeIdx(d) + offset; return i >= 0 && i < ctx.totalKolom ? ctx.idxKeTanggal(i) : '' }
  for (const kunci of kunciPilihan) {
    const { tanggal } = pecahKunci(kunci)
    const ke = keDari(tanggal)
    const units = unitDari(kunci, ctx)
    if (units.length === 0) continue // sel kosong / semuanya selesai/jejak -> diabaikan (seperti sel kosong)
    if (!ke) { bentrok.push({ kunci, ke, alasan: 'di luar rentang jadwal' }); continue }
    for (const u of units) {
      const kk = u.rawId + '|' + u.dari
      if (!unitPer.has(kk)) { unitPer.set(kk, []); kunciPer.set(kk, new Set()) }
      unitPer.get(kk)!.push(u); kunciPer.get(kk)!.add(kunci)
    }
  }
  // 2) gabung per sel asal -> SelPindahV2
  const sel: SelPindahV2[] = []; const jadwal = new Map<number, any>()
  const alasanSel = new Map<string, string>() // rawId|dari -> alasan tolak
  const kodeIkut = new Set<string>()
  for (const [kk, units] of unitPer) {
    const u0 = units[0]; const row = rowById.get(u0.rawId); if (!row) continue
    const dari = u0.dari, ke = keDari(dari)
    if (u0.jenis === 'busbar') {
      const pid = Number(row.panel_id || row.panelId)
      const boleh = new Set(kodeBusbarBisaDipindah(row, ctx.checklistPanel(row), dari))
      const dipilih = new Set(units.map(u => u.kode!))
      const kode = (row.busbar_schedule?.[dari] || []).filter((k: string) => dipilih.has(k) && boleh.has(k))
      if (kode.length === 0) continue
      if (mode === 'pindah' && kode.some((k: string) => ctx.timerBusbar.has(pid + '|' + k))) alasanSel.set(kk, 'timer BUSBAR berjalan')
      sel.push({ rawId: row.id, dari, ke, kodeBusbar: kode }); kode.forEach((k: string) => kodeIkut.add(pid + '|BB|' + k))
    } else if (u0.jenis === 'penanda') {
      const entries = ctx.entriesTanpaSelesai(row, row.schedule?.[dari] || [])
      if (entries.length === 0) continue
      sel.push({ rawId: row.id, dari, ke, entries, adaPengerjaan: new Set<string>() }); kodeIkut.add(row.id + '|PN')
    } else {
      const bisa = ctx.entriesTanpaSelesai(row, row.schedule?.[dari] || []) // tanpa selesai/jejak
      // Sel rentang WIRING tidak bisa dipindah - aturan SAMA dgn tampilan lama (tanggal tercakup rentang
      // komponen mana pun di baris itu, rentangInfoUntukTanggal).
      if (mode === 'pindah' && rentangInfoUntukTanggal(row, dari)) alasanSel.set(kk, 'Sel rentang tidak bisa dipindah.')
      const dipilih = new Set(units.map(u => u.wp + '\u0000' + u.kode))
      const entries: any[] = []
      for (const e of bisa) {
        const kodeAsli = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
        const pilih = kodeAsli.filter((k: string) => dipilih.has(e.wp + '\u0000' + k))
        if (pilih.length === 0) continue
        // Semua kode entry ikut = entry utuh (termasuk token __wiring_, sama dgn pindah sel utuh); sebagian = kode terpilih saja.
        entries.push(pilih.length === kodeAsli.length ? e : { ...e, komponen: pilih })
        pilih.forEach((k: string) => kodeIkut.add(row.panel_id + '|' + k))
      }
      if (entries.length === 0) continue
      sel.push({ rawId: row.id, dari, ke, entries, adaPengerjaan: new Set<string>() })
    }
    if (!jadwal.has(row.id)) jadwal.set(row.id, ambilJadwal4(row))
  }
  // 3) Minggu berkapasitas (aturan bersama)
  const mingguOk = new Set<string>()
  if (offset !== 0) {
    // Sama dgn tampilan lama: yang sudah ditolak (rentang/timer) TIDAK ikut dihitung di cek kapasitas Minggu.
    const selLolos = sel.filter(s => !alasanSel.has(s.rawId + '|' + s.dari))
    for (const g of cekMingguKapasitas(ctx.rawData, selLolos, ctx, mode)) g.kunci.forEach(k => { if (g.alasan) alasanSel.set(k, g.alasan); else mingguOk.add(k) })
  }
  // 4) status tujuan per baris tampilan (bayangan) & bentrok per kunci pilihan
  const tujuan = new Map<string, 'ok' | 'minggu' | 'bad'>(); const alasanTujuan = new Map<string, string>()
  const kunciBentrok = new Set<string>()
  for (const s of sel) {
    const kk = s.rawId + '|' + s.dari; const alasan = alasanSel.get(kk)
    for (const kunci of kunciPer.get(kk) || []) {
      const { baris } = pecahKunci(kunci); const t = baris + '|' + s.ke
      if (alasan) { tujuan.set(t, 'bad'); alasanTujuan.set(t, alasan); if (!kunciBentrok.has(kunci)) { kunciBentrok.add(kunci); bentrok.push({ kunci, ke: s.ke, alasan }) } }
      else if (tujuan.get(t) !== 'bad') tujuan.set(t, mingguOk.has(kk) ? 'minggu' : (tujuan.get(t) === 'minggu' ? 'minggu' : 'ok'))
    }
  }
  const rowsSalin = mode === 'salin' ? rencanakanSalinMultiV2(jadwal, sel, new Date().toISOString()) : undefined
  return { sel, jadwal, bentrok, tujuan, alasanTujuan, jumlahKomponen: kodeIkut.size, rowsSalin }
}
