// LAPORAN OUTSTANDING PEKERJAAN (Tahap A, 23 Okt 2026) - laporan harian planner ke grup WhatsApp "Perencanaan Vista".
// SATU struktur data (DrafLaporan: proyek > panel > pekerjaan/kendala, + catatan & prioritas minggu ini) menjadi sumber
// tunggal teks WhatsApp (formatTeksWhatsApp) dan nanti PDF berkop (Tahap B) - tidak ada jalur data kedua.
// Sumber tiap proyek/panel: 'otomatis' (WO aktif), 'arsip' (panel arsip pilihan admin), 'manual' (diketik admin).
// Penanda sumber HANYA utk layar penyusun - formatTeksWhatsApp tidak menuliskannya.
// Fitur ini TIDAK menulis apa pun ke WO/panel/progress/kendala: semua fungsi di sini hanya membaca (select) atau murni.
// Draf disimpan di localStorage perangkat (keputusan user: tanpa tabel baru) - lihat components/LaporanOutstanding.tsx.
//
// ATURAN PEKERJAAN (turunkanPekerjaanPanel - SATU fungsi utk panel aktif & panel arsip):
// - Dasar: jadwal Raw Schedule panel itu s.d. HARI INI (hari kerja WIB) - pekerjaan yang semestinya sudah dikerjakan.
//   Kode jejak (digeserKe) & token __wiring_ dilewati (aturan sama kodeJadwalAktif), qty 0 dilewati.
// - Status dari checklist (progress per proses), QC dari qc_checklist._global, PACKING dari packing_done,
//   BUSBAR dari checklist pseudo-komponen (getBusbarProgress), NAMEPLATE/YELLOWMARK dari kolom panel-nya.
// - Belum 100% -> pekerjaan outstanding ("(PROSES)" bila sudah mulai). 100% dan selesai TEPAT hari ini
//   (selesaiTepatTanggal / waktu penanda) -> baris ✅. 100% sebelum hari ini -> tidak ditulis (basi, CLAUDE.md B.3).
// - Proses per komponen: satu baris per WP "PROSES WP-n (NAMA, NAMA)" = komponen MAIN yang belum selesai (23 Okt 2026).
//   BUSBAR/WIRING/QC/PACKING/NAMEPLATE/YELLOWMARK: satu baris per proses seperti sebelumnya.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchAllPaged, UKURAN_POTONGAN_ID } from './fetchAllPaged'
import { selesaiTepatTanggal } from './kodeJadwalAktif'
import { buildPanelTypesFromBom, getBusbarProgress, getEffCfgGlobal, getRelevantProsesForKode, isProsesApplicableForPanel, prosesBerlakuUntukTipe, statusPenandaPanel } from './panelHelpers'
import { muatProsesRelevanGlobal } from './prosesRelevan'
import { GLOBAL_PROSES_RELEVAN_TERMUAT, GLOBAL_LIVE_PANEL_TYPES, setGlobalLivePanelTypes } from './globalState'
import { hariKerjaDari, hariKerjaWib } from './tanggalWib'
import { ALL_PROSES } from '../constants/panelTypes'
import { labelDivisi } from './kendalaProduksi'

export type Sumber = 'otomatis' | 'arsip' | 'manual'
export type Pekerjaan = { id: string; teks: string; selesai: boolean }
// pekerjaanSemua/pekerjaanRingkas: dua daftar otomatis (V1 vs varian terpilih) utk tombol per proyek "Tampilkan semua proses terjadwal"
export type PanelLap = { id: string; src: Sumber; nama: string; panelId: number | null; pekerjaan: Pekerjaan[]; kendala: KendalaLap[]; pekerjaanSemua?: Pekerjaan[]; pekerjaanRingkas?: Pekerjaan[] }
// ringkas = satu baris pendek pengganti daftar panel (mis. WO baru turun belum ada planning).
export type ProyekLap = { id: string; src: Sumber; nama: string; deadline: string; ringkas: string; kendalaUmum: KendalaLap[]; panels: PanelLap[]; semua?: boolean }
export type PrioritasLap = { id: string; nama: string; deadline: string; panels: string[] }
export type DrafLaporan = {
  versi: 1
  varian?: Varian // aturan pekerjaan yg dipakai saat dibuat (uji; bawaan V1)
  tanggal: string // YYYY-MM-DD (hari kerja WIB laporan)
  jam: string // "16.00"
  dibuatPada: string // ISO saat tombol Buat laporan diklik
  proyek: ProyekLap[]
  catatan: string[] // NOTE di luar proyek (urut)
  prioritas: PrioritasLap[]
  tampilTeratasi?: boolean // "Tampilkan kendala yang sudah teratasi" (bawaan true)
}

// ---------- kendala di laporan ----------
// Dari tabel kendala_produksi (tab Kendala admin). Kendala TERATASI tetap ditulis s.d. HARI_TAMPIL_TERATASI hari kerja
// sesudah tanggal teratasi, lalu hilang sendiri. Tanggal teratasi HANYA dari kolom kendala_produksi.teratasi_pada
// (timestamptz, diisi RPC tandai_kendala_teratasi), dihitung sbg HARI KERJA WIB (00.00-06.59 = hari sebelumnya).
// Hari kerja = Senin-Sabtu (Minggu dilewati). Kendala manual (diketik di penyusun) tanpa pencatat/tanggal.
export const HARI_TAMPIL_TERATASI = 1
export type KendalaLap = { id: string; teks: string; kendalaId?: number; divisi?: string; oleh?: string; tanggal?: string; teratasi?: string }
export type KendalaSumber = { id: number; proyek: string; panel_id: number | null; teks: string; pencatat?: string; divisi?: string | null; tanggal?: string; teratasi_pada?: string | null }
export function hariKerjaKeN(iso: string, n: number): string {
  let t = iso, sisa = n
  while (sisa > 0) { t = tambahHariIso(t, 1); if (new Date(`${t}T00:00:00Z`).getUTCDay() !== 0) sisa-- }
  return t
}
const tambahHariIso = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export function kendalaMasukLaporan(k: KendalaSumber, hariIni: string, hariTampil = HARI_TAMPIL_TERATASI): boolean {
  if (!k.teratasi_pada) return true
  const tgl = hariKerjaDari(k.teratasi_pada)
  return !!tgl && hariIni <= hariKerjaKeN(tgl, hariTampil)
}
export const kendalaDariSumber = (k: KendalaSumber): KendalaLap => ({
  id: idBaru(), kendalaId: k.id, teks: String(k.teks || '').trim().toUpperCase(), divisi: k.divisi ? labelDivisi(k.divisi) : undefined,
  oleh: k.pencatat || undefined, tanggal: k.tanggal || undefined, teratasi: k.teratasi_pada ? hariKerjaDari(k.teratasi_pada) : undefined,
})
const tglBln = (iso?: string) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${Number(d)} ${BLN3[Number(m) - 1]}` }
// "TEKS (DIVISI-NAMA, TGL BLN) ✅ TERATASI TGL BLN"
export function teksKendalaWa(k: KendalaLap): string {
  const meta = [k.divisi && k.oleh ? `${k.divisi.toUpperCase()}-${k.oleh.toUpperCase()}` : (k.oleh || k.divisi || '').toUpperCase(), tglBln(k.tanggal)].filter(Boolean).join(', ')
  return `${k.teks.trim()}${meta ? ` (${meta})` : ''}${k.teratasi ? ` ✅ TERATASI ${tglBln(k.teratasi)}` : ''}`
}
// draf lama (kendala = string) -> KendalaLap
const normKendala = (x: any): KendalaLap => (typeof x === 'string' ? { id: idBaru(), teks: x } : { ...x, id: x?.id || idBaru(), teks: String(x?.teks ?? '') })

let seq = 0
export const idBaru = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

// ---------- format tanggal ----------
const HARI = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const BLN3 = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']
const tglUtc = (iso: string) => new Date(`${iso}T00:00:00Z`)
// "2026-10-23" -> "23-OKT-2026" (format laporan manual)
export function fmtTglLaporan(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}-${BLN3[Number(m) - 1]}-${y}`
}
export function judulLaporan(tanggal: string, jam: string): string {
  const d = tglUtc(tanggal)
  const [y, m, dd] = tanggal.split('-')
  return `OUTSTANDING PEKERJAAN HARI ${HARI[d.getUTCDay()]} ${dd}/${m}/${y} ${jam}`.trim()
}
export const jamSekarangWib = (ms = Date.now()) => new Date(ms + 7 * 3600e3).toISOString().slice(11, 16).replace(':', '.')
const tambahHari = (iso: string, n: number) => { const d = tglUtc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
// Senin-Sabtu minggu berjalan; hari Minggu -> minggu berikutnya.
export function rentangMingguIni(hariIni: string): { dari: string; sampai: string } {
  const dow = tglUtc(hariIni).getUTCDay()
  const senin = dow === 0 ? tambahHari(hariIni, 1) : tambahHari(hariIni, 1 - dow)
  return { dari: senin, sampai: tambahHari(senin, 5) }
}

// ---------- pekerjaan per panel (satu fungsi utk aktif & arsip) ----------
const PROSES_LAP = [...ALL_PROSES, 'NAMEPLATE', 'YELLOWMARK']
const LABEL_PROSES: Record<string, string> = { 'QC TEST': 'QC' }
const labelWp = (wp: string) => String(wp || '').replace(/^WP\s*(\d+)$/i, 'WP-$1')
const urutWp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

type Unit = { label: string; status: 'outstanding' | 'mulai' | 'selesaiHariIni' | 'basi' }
function barisDariUnit(proses: string, units: Unit[], semuaLabel: string[]): Pekerjaan[] {
  const nama = LABEL_PROSES[proses] || proses
  const out: Pekerjaan[] = []
  const tulis = (dipilih: Unit[], selesai: boolean) => {
    if (!dipilih.length) return
    const labels = dipilih.map((u) => u.label).filter(Boolean)
    const semua = labels.length === 0 || labels.length >= semuaLabel.length
    const mulai = !selesai && dipilih.some((u) => u.status === 'mulai')
    out.push({ id: idBaru(), teks: `${nama}${semua ? '' : ' ' + labels.join(', ')}${mulai ? ' (PROSES)' : ''}`, selesai })
  }
  tulis(units.filter((u) => u.status === 'outstanding' || u.status === 'mulai'), false)
  tulis(units.filter((u) => u.status === 'selesaiHariIni'), true)
  return out
}
const jadwalSampai = (sch: Record<string, any> | null | undefined, hariIni: string) =>
  Object.entries(sch || {}).filter(([t]) => t <= hariIni)
const statusPct = (pct: number): Unit['status'] => (pct >= 100 ? 'basi' : pct > 0 ? 'mulai' : 'outstanding')
const hariIniDari = (waktu: any, hariIni: string) => !!waktu && hariKerjaDari(waktu) === hariIni

// VARIAN ATURAN (uji, 23 Okt 2026 - belum dikunci). Keputusan sementara user: V2 = bawaan laporan (buatLaporanOutstanding);
// V1/V3 tetap bisa dipilih. turunkanPekerjaanPanel tanpa opsi = V1 (dipakai pemilih arsip: sisa pekerjaan lengkap).
//  V1: semua proses terjadwal s.d. hari ini yang belum selesai.
//  V2: hanya proses AKTIF per komponen = ada progres / timer berjalan / proses sebelumnya (rantai relevan bom_proses_relevan,
//      urutan ALL_PROSES - logika estafet isEstafetOk FCS) sudah 100% atau proses pertama; sisanya satu baris
//      "(+N proses menunggu: ...)". Aktif tapi tanggal jadwal lewat & belum berjalan -> "(TERLAMBAT)".
//  V3: seperti V2, proses aktif dgn kumpulan komponen sama digabung: "POTONG & BENDING (8 KOMPONEN)".
export type Varian = 'V1' | 'V2' | 'V3'
// penandaMain: Map `${jenis_panel}|${kode}` -> is_main (tabel laporan_komponen_main); tidak ada = MAIN. Hanya proses per-WP
// (bukan WIRING/BUSBAR/QC/PACKING/NAMEPLATE/YELLOWMARK) yang menyaring printilan.
export type OpsiPekerjaan = { varian?: Varian; timerBerjalan?: Set<string>; penandaMain?: Map<string, boolean> } // timer: `${panelId}|${kode}|${proses}`
const PENANDA = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
// nama komponen dari BOM live (getEffCfgGlobal; fallback konstanta PANEL_TYPES) - huruf kapital; tak ketemu -> kode
export function namaKomponen(tipe: string, kode: string): string {
  const it = (getEffCfgGlobal(tipe)?.wps || []).flatMap((w: any) => w.items || []).find((x: any) => x.kode === kode)
  return String(it?.nama || kode).trim().toUpperCase()
}
const rantaiKode = (kode: string, tipe: string) => getRelevantProsesForKode(kode, tipe).filter((p) => ALL_PROSES.includes(p) && p !== 'BUSBAR' && !PENANDA.includes(p))

export function turunkanPekerjaanPanel(panel: any, rawRows: any[], hariIni: string, opsi: OpsiPekerjaan = {}): Pekerjaan[] {
  const varian = opsi.varian || 'V1'
  const rows = (rawRows || []).filter((r) => Number(r.panel_id ?? r.panelId) === Number(panel?.id))
  const cl = panel?.checklist || {}
  const pctK = (k: string, pr: string) => Number(cl[k]?.progress?.[pr]) || 0
  const timer = (k: string, pr: string) => !!opsi.timerBerjalan?.has(`${panel?.id}|${k}|${pr}`)
  const aktifK = (k: string, pr: string) => {
    if (pctK(k, pr) > 0 || timer(k, pr)) return true
    const ch = rantaiKode(k, panel?.tipe), i = ch.indexOf(pr)
    return i <= 0 || pctK(k, ch[i - 1]) >= 100
  }
  const hasil: Pekerjaan[] = []
  const menunggu: string[] = []
  const gabung: { proses: string; kodes: Set<string>; mulai: boolean; telat: boolean }[] = []
  // KOMPONEN MAIN (23 Okt 2026): proses per-WP hanya dari komponen main (penanda per jenis panel); WIRING tidak disaring.
  const isMainK = (k: string) => opsi.penandaMain?.get(`${panel?.tipe}|${k}`) ?? true
  const ikutLaporan = (k: string, pr: string) => pr === 'WIRING CONTROL' || pr === 'WIRING POWER' || isMainK(k)
  let adaKomponenBelum = false // utk gerbang QC di V2/V3: masih ada pekerjaan komponen (main) terjadwal yg belum 100%
  rows.forEach((r) => { if (!PENANDA.includes(r.proses) && r.proses !== 'BUSBAR') Object.values(r.schedule || {}).forEach((es: any) => (es || []).forEach((e: any) => (e?.komponen || []).forEach((k: string) => { if (k && !k.startsWith('__wiring_') && !e?.digeserKe?.[k] && (Number(cl[k]?.qty) || 0) > 0 && ikutLaporan(k, r.proses) && pctK(k, r.proses) < 100) adaKomponenBelum = true }))) })
  const catatMenunggu = (proses: string, telat: boolean) => menunggu.push(`${LABEL_PROSES[proses] || proses}${telat ? ' TERLAMBAT' : ''}`)
  for (const proses of PROSES_LAP) {
    if (!prosesBerlakuUntukTipe(panel?.tipe, proses)) continue
    const prow = rows.filter((r) => r.proses === proses)
    if (!prow.length) continue
    if (proses === 'BUSBAR') { // paralel - selalu aktif di semua varian
      // aturan SAMA dgn overall (panelHelpers isProsesApplicableForPanel): panel tuntas tanpa komponen busbar -> bukan pekerjaan
      if (!isProsesApplicableForPanel(panel, 'BUSBAR')) continue
      const semua = new Set<string>(), due = new Set<string>()
      prow.forEach((r) => Object.entries(r.busbar_schedule || {}).forEach(([t, ks]: [string, any]) => (ks || []).forEach((k: string) => { semua.add(k); if (t <= hariIni) due.add(k) })))
      const units: Unit[] = [...due].map((k) => {
        const pct = getBusbarProgress(panel, k)
        return { label: k, status: pct >= 100 ? (selesaiTepatTanggal(cl[k], 'BUSBAR', hariIni) ? 'selesaiHariIni' : 'basi') : statusPct(pct) }
      })
      hasil.push(...barisDariUnit(proses, units, [...semua]))
      continue
    }
    if (PENANDA.includes(proses)) {
      // penanda per panel (komponen ["MARKED"]) - cukup "terjadwal s.d. hari ini"
      const tglDue = prow.flatMap((r) => jadwalSampai(r.schedule, hariIni).filter(([, es]) => (es || []).length > 0).map(([t]) => t)).sort()
      if (!tglDue.length) continue
      let st: Unit['status']
      if (proses === 'QC TEST' || proses === 'PACKING') {
        const s = statusPenandaPanel(panel, proses)
        const waktu = proses === 'QC TEST' ? (panel?.qc_checklist?._global?.complete_at || panel?.qc_checklist?._global?.updated_at) : panel?.packing_done_at
        st = s === 'DONE' ? (hariIniDari(waktu, hariIni) ? 'selesaiHariIni' : 'basi') : s === 'IN PROGRESS' ? 'mulai' : 'outstanding'
        if (varian !== 'V1' && st === 'outstanding') {
          const aktif = proses === 'QC TEST' ? !adaKomponenBelum : s === 'TO DO' // PACKING terbuka setelah QC complete (statusPenandaPanel)
          if (!aktif) { catatMenunggu(proses, tglDue[0] < hariIni); continue }
        }
      } else {
        const pre = proses === 'NAMEPLATE' ? 'nameplate' : 'yellowmark'
        const pct = Number(panel?.[`${pre}_progress`]) || 0
        st = pct >= 100 ? (hariIniDari(panel?.[`${pre}_updated_at`], hariIni) ? 'selesaiHariIni' : 'basi') : statusPct(pct)
      }
      const b = barisDariUnit(proses, [{ label: '', status: st }], [''])
      if (varian !== 'V1' && st === 'outstanding' && tglDue[0] < hariIni) b.forEach((x) => { if (!x.selesai) x.teks += ' (TERLAMBAT)' })
      hasil.push(...b)
      continue
    }
    // proses komponen: per WP
    const semuaWp = new Set<string>(), perWp = new Map<string, Set<string>>(), tglAwal = new Map<string, string>()
    prow.forEach((r) => Object.entries(r.schedule || {}).forEach(([t, es]: [string, any]) => (es || []).forEach((e: any) => {
      const kodes = (e?.komponen || []).filter((k: string) => k && !k.startsWith('__wiring_') && !e?.digeserKe?.[k] && (Number(cl[k]?.qty) || 0) > 0 && ikutLaporan(k, proses))
      if (!kodes.length) return
      const wp = labelWp(e.wp)
      semuaWp.add(wp)
      if (t > hariIni) return
      if (!perWp.has(wp)) perWp.set(wp, new Set())
      kodes.forEach((k: string) => { perWp.get(wp)!.add(k); if (!tglAwal.has(k) || t < tglAwal.get(k)!) tglAwal.set(k, t) })
    })))
    // WIRING CONTROL/POWER (permintaan user 23 Okt): tulis NAMA KOMPONEN + persen, bukan WP -
    // "WIRING CONTROL PINTU 75%, BOX CONTROL 40%". Persen hanya bila sudah mulai; nama sama dirata-rata.
    if (proses === 'WIRING CONTROL' || proses === 'WIRING POWER') {
      const due = [...new Set([...perWp.values()].flatMap((s) => [...s]))]
      const telatW = (k: string) => (tglAwal.get(k) || hariIni) < hariIni && pctK(k, proses) === 0 && !timer(k, proses)
      const label = (ks: string[], persen: boolean) => {
        const g = new Map<string, number[]>()
        ks.forEach((k) => { const n = namaKomponen(panel?.tipe, k); g.set(n, [...(g.get(n) || []), pctK(k, proses)]) })
        return [...g.entries()].map(([n, ps]) => { const p = Math.round(ps.reduce((a, b) => a + b, 0) / ps.length); return persen && p > 0 ? `${n} ${p}%` : n }).join(', ')
      }
      const nama = LABEL_PROSES[proses] || proses
      const selesaiIni = due.filter((k) => pctK(k, proses) >= 100 && selesaiTepatTanggal(cl[k], proses, hariIni))
      if (selesaiIni.length) hasil.push({ id: idBaru(), teks: `${nama} ${label(selesaiIni, false)}`, selesai: true })
      let belum = due.filter((k) => pctK(k, proses) < 100)
      if (varian !== 'V1' && belum.length) {
        const akt = belum.filter((k) => aktifK(k, proses))
        if (!akt.length) { catatMenunggu(proses, belum.some(telatW)); continue }
        belum = akt
      }
      if (belum.length) hasil.push({ id: idBaru(), teks: `${nama} ${label(belum, true)}${varian !== 'V1' && belum.some(telatW) ? ' (TERLAMBAT)' : ''}`, selesai: false })
      continue
    }
    // NAMA KOMPONEN (23 Okt 2026, permintaan user): SATU baris per WP "PROSES WP-n (NAMA, NAMA)" - nama komponen MAIN yang
    // BELUM selesai (nama dari BOM live, huruf besar). WP yang semua komponen main-nya selesai: tidak ditulis, kecuali selesai
    // HARI INI -> "PROSES WP-n (NAMA yang selesai hari ini)" ✅. V2: hanya komponen yang aktif (estafet) yang ditulis.
    const namaProses = LABEL_PROSES[proses] || proses
    // penanda "(PROSES)" PER KOMPONEN (koreksi user 23 Okt): komponen yang sudah mulai (progres > 0 / timer berjalan) - hanya
    // pada baris belum selesai. Nama sama dari beberapa kode digabung (mulai bila salah satunya mulai).
    const daftarNama = (ks: Iterable<string>, tandaMulai: boolean) => {
      const m = new Map<string, boolean>()
      ;[...ks].forEach((k) => { const n = namaKomponen(panel?.tipe, k); m.set(n, !!m.get(n) || (tandaMulai && (pctK(k, proses) > 0 || timer(k, proses)))) })
      return [...m.entries()].map(([n, mulai]) => (mulai ? `${n} (PROSES)` : n)).join(", ")
    }
    const baris = (wp: string, ks: Iterable<string>, selesai: boolean, telat = false): Pekerjaan =>
      ({ id: idBaru(), teks: `${namaProses} ${wp} (${daftarNama(ks, !selesai)})${telat ? ' (TERLAMBAT)' : ''}`, selesai })
    const urut = [...perWp.entries()].sort(([a], [b]) => urutWp(a, b))
    const selesaiHariIni: Pekerjaan[] = []
    urut.forEach(([wp, ks]) => {
      const s = [...ks]
      if (!s.every((k) => pctK(k, proses) >= 100)) return
      const hi = s.filter((k) => selesaiTepatTanggal(cl[k], proses, hariIni))
      if (hi.length) selesaiHariIni.push(baris(wp, hi, true))
    })
    const belum = urut.map(([wp, ks]) => [wp, new Set([...ks].filter((k) => pctK(k, proses) < 100))] as [string, Set<string>]).filter(([, ks]) => ks.size)
    const telatK = (k: string) => (tglAwal.get(k) || hariIni) < hariIni && pctK(k, proses) === 0 && !timer(k, proses)
    if (varian === 'V1') { belum.forEach(([wp, ks]) => hasil.push(baris(wp, ks, false))); hasil.push(...selesaiHariIni); continue }
    // V2/V3: yang belum selesai dipisah aktif vs menunggu
    const aktif = belum.map(([wp, ks]) => [wp, new Set([...ks].filter((k) => aktifK(k, proses)))] as [string, Set<string>]).filter(([, ks]) => ks.size)
    if (belum.length && !aktif.length) catatMenunggu(proses, belum.some(([, ks]) => [...ks].some(telatK)))
    if (aktif.length && varian === 'V3') {
      const kodesAktif = new Set(aktif.flatMap(([, ks]) => [...ks]))
      gabung.push({ proses, kodes: kodesAktif, mulai: [...kodesAktif].some((k) => pctK(k, proses) > 0 || timer(k, proses)), telat: [...kodesAktif].some(telatK) })
    } else aktif.forEach(([wp, ks]) => hasil.push(baris(wp, ks, false, [...ks].some(telatK))))
    hasil.push(...selesaiHariIni)
  }
  if (varian === 'V3' && gabung.length) {
    const grup = new Map<string, typeof gabung>()
    gabung.forEach((g) => { const k = [...g.kodes].sort().join(','); grup.set(k, [...(grup.get(k) || []), g]) })
    const baris = [...grup.values()].map((gs) => ({ id: idBaru(), teks: `${gs.map((g) => LABEL_PROSES[g.proses] || g.proses).join(' & ')} (${gs[0].kodes.size} KOMPONEN)${gs.some((g) => g.mulai) ? ' (PROSES)' : ''}${gs.some((g) => g.telat) ? ' (TERLAMBAT)' : ''}`, selesai: false }))
    hasil.unshift(...baris)
  }
  if (varian !== 'V1' && menunggu.length) hasil.push({ id: idBaru(), teks: `(+${menunggu.length} PROSES MENUNGGU: ${menunggu.join(', ')})`, selesai: false })
  return hasil
}

// tanggal jadwal paling awal panel (semua proses) - '' bila belum ada jadwal sama sekali
function jadwalAwal(rows: any[]): string {
  let min = ''
  rows.forEach((r) => {
    Object.entries(r.schedule || {}).forEach(([t, es]: [string, any]) => { if ((es || []).length && (!min || t < min)) min = t })
    Object.entries(r.busbar_schedule || {}).forEach(([t, ks]: [string, any]) => { if ((ks || []).length && (!min || t < min)) min = t })
  })
  return min
}

const upper = (s: string) => String(s || '').trim().toUpperCase()
const kunciProyek = (nama: string, target: string) => `${upper(nama)}|${target || ''}`

// ---------- susun draf otomatis ----------
export type BahanLaporan = {
  woAktif: any[] // work_orders (+ panels) aktif
  raw: any[] // raw_schedule (WO aktif)
  // semua kendala tidak terhapus (muatKendala); yg masuk laporan disaring kendalaMasukLaporan (terbuka + teratasi baru)
  kendala: KendalaSumber[]
  hariIni?: string
  jam?: string
  timerBerjalan?: Set<string>
  penandaMain?: Map<string, boolean>
  varian?: Varian
}
export function buatLaporanOutstanding(b: BahanLaporan, lama?: DrafLaporan | null): DrafLaporan {
  const hariIni = b.hariIni || hariKerjaWib()
  const rawPer = new Map<number, any[]>()
  b.raw.forEach((r) => { const id = Number(r.panel_id ?? r.panelId); if (!rawPer.has(id)) rawPer.set(id, []); rawPer.get(id)!.push(r) })
  const kendalaPanel = new Map<number, KendalaLap[]>(), kendalaUmum = new Map<string, KendalaLap[]>()
  ;[...b.kendala].sort((a, c) => a.id - c.id).filter((k) => kendalaMasukLaporan(k, hariIni)).forEach((k) => {
    if (k.panel_id == null) { const n = upper(k.proyek); kendalaUmum.set(n, [...(kendalaUmum.get(n) || []), kendalaDariSumber(k)]) }
    else kendalaPanel.set(Number(k.panel_id), [...(kendalaPanel.get(Number(k.panel_id)) || []), kendalaDariSumber(k)])
  })
  // kelompok per (nama proyek, deadline) - WO bernomor sama / proyek sama dgn deadline sama digabung
  const grup = new Map<string, { nama: string; target: string; woDibuat: string; panels: any[] }>()
  b.woAktif.forEach((w) => {
    const k = kunciProyek(w.proyek, w.target)
    const g = grup.get(k) || { nama: upper(w.proyek), target: w.target || '', woDibuat: w.created_at || '', panels: [] }
    if (w.created_at && (!g.woDibuat || w.created_at < g.woDibuat)) g.woDibuat = w.created_at
    g.panels.push(...[...(w.panels || [])].sort((a: any, c: any) => (Number(a.no_pnl) || 0) - (Number(c.no_pnl) || 0)))
    grup.set(k, g)
  })
  const umumTerpakai = new Set<string>()
  const proyek: ProyekLap[] = []
  ;[...grup.values()].sort((a, c) => (a.target || '9999').localeCompare(c.target || '9999') || a.nama.localeCompare(c.nama)).forEach((g) => {
    const umum = umumTerpakai.has(g.nama) ? [] : (kendalaUmum.get(g.nama) || [])
    if (umum.length) umumTerpakai.add(g.nama)
    const panels: PanelLap[] = []
    let awal = ''
    g.panels.forEach((p) => {
      const rows = rawPer.get(Number(p.id)) || []
      const a = jadwalAwal(rows); if (a && (!awal || a < awal)) awal = a
      const varian = b.varian || 'V2'
      const pekerjaanSemua = turunkanPekerjaanPanel(p, rows, hariIni, { varian: 'V1', timerBerjalan: b.timerBerjalan, penandaMain: b.penandaMain })
      const pekerjaan = varian === 'V1' ? pekerjaanSemua : turunkanPekerjaanPanel(p, rows, hariIni, { varian, timerBerjalan: b.timerBerjalan, penandaMain: b.penandaMain })
      const kd = kendalaPanel.get(Number(p.id)) || []
      if (pekerjaanSemua.length || kd.length) panels.push({ id: idBaru(), src: 'otomatis', nama: String(p.nama || '').trim(), panelId: Number(p.id), pekerjaan, kendala: kd, pekerjaanSemua, pekerjaanRingkas: pekerjaan })
    })
    let ringkas = ''
    if (!panels.length) {
      if (!awal) ringkas = `WO TURUN TGL ${fmtTglLaporan(hariKerjaDari(g.woDibuat))}, BELUM START PENGERJAAN`
      else if (awal > hariIni) ringkas = `BELUM START, JADWAL MULAI TGL ${fmtTglLaporan(awal)}`
      else if (!umum.length) return // semua sudah selesai sebelum hari ini & tanpa kendala -> tidak ditulis
    }
    proyek.push({ id: idBaru(), src: 'otomatis', nama: g.nama, deadline: g.target, ringkas, kendalaUmum: umum, panels: ringkas ? [] : panels })
  })
  // pertahankan entri arsip & manual + catatan dari draf lama (Buat ulang hanya mengganti bagian otomatis)
  const tetap = (lama?.proyek || []).filter((p) => p.src !== 'otomatis')
  bawaDariDrafLama(proyek, lama?.proyek || [])
  return {
    versi: 1, varian: b.varian || 'V2', tanggal: hariIni, jam: b.jam || jamSekarangWib(), dibuatPada: new Date().toISOString(),
    proyek: [...proyek, ...tetap], catatan: lama?.catatan ? [...lama.catatan] : [], tampilTeratasi: lama?.tampilTeratasi ?? true,
    prioritas: buatPrioritasMingguIni(b.woAktif, b.raw, hariIni, b.penandaMain),
  }
}

// "Buat ulang laporan" mengganti isi OTOMATIS, tetapi yang ditambahkan admin ke proyek otomatis TIDAK dibuang (23 Okt):
// - baris KOSONG pekerjaan/kendala (garis tulis tangan di dokumen berkop) -> ditempel lagi ke panel yang sama (panelId)
//   / kendala umum proyek yang sama (nama + deadline), di akhir daftarnya;
// - panel Manual/Arsip yang disisipkan ke proyek otomatis -> dibawa utuh.
// Proyek/panel yang sudah tidak ada di susunan baru dimunculkan lagi hanya berisi bawaan itu. `baru` diubah di tempat.
function bawaDariDrafLama(baru: ProyekLap[], lama: ProyekLap[]): void {
  lama.filter((p) => p.src === 'otomatis').forEach((lp) => {
    const umumK = lp.kendalaUmum.filter(kosong)
    const kosongPanel = lp.panels.filter((n) => n.src === 'otomatis')
      .map((n) => ({ n, pk: n.pekerjaan.filter(kosong), kk: n.kendala.filter(kosong) })).filter((x) => x.pk.length || x.kk.length)
    const panelTambahan = lp.panels.filter((n) => n.src !== 'otomatis')
    if (!umumK.length && !kosongPanel.length && !panelTambahan.length) return
    let tp = baru.find((p) => p.nama === lp.nama && p.deadline === lp.deadline)
    if (!tp) { tp = { ...lp, ringkas: '', kendalaUmum: [], panels: [] }; baru.push(tp) }
    tp.kendalaUmum = [...tp.kendalaUmum, ...umumK]
    kosongPanel.forEach(({ n, pk, kk }) => {
      const i = tp!.panels.findIndex((x) => x.panelId != null && x.panelId === n.panelId)
      if (i >= 0) tp!.panels[i] = { ...tp!.panels[i], pekerjaan: [...tp!.panels[i].pekerjaan, ...pk], kendala: [...tp!.panels[i].kendala, ...kk] }
      else tp!.panels.push({ ...n, pekerjaan: pk, kendala: kk, pekerjaanSemua: undefined, pekerjaanRingkas: undefined })
    })
    tp.panels.push(...panelTambahan)
  })
}

// "Prioritas Pengerjaan Minggu Ini" - draf dari Raw Schedule Senin-Sabtu minggu berjalan: panel yang punya pekerjaan
// belum selesai terjadwal di rentang itu, per proyek, urut deadline terdekat. Bisa diedit di penyusun.
export function buatPrioritasMingguIni(woAktif: any[], raw: any[], hariIni: string, penandaMain?: Map<string, boolean>): PrioritasLap[] {
  const { dari, sampai } = rentangMingguIni(hariIni)
  const dalam = (t: string) => t >= dari && t <= sampai
  const panelById = new Map<number, any>()
  woAktif.forEach((w) => (w.panels || []).forEach((p: any) => panelById.set(Number(p.id), { ...p, _wo: w })))
  const aktif = new Set<number>()
  raw.forEach((r) => {
    const id = Number(r.panel_id ?? r.panelId), p = panelById.get(id)
    if (!p || aktif.has(id) || !prosesBerlakuUntukTipe(p.tipe, r.proses)) return
    const cl = p.checklist || {}
    if (r.proses === 'BUSBAR') {
      if (Object.entries(r.busbar_schedule || {}).some(([t, ks]: [string, any]) => dalam(t) && (ks || []).some((k: string) => getBusbarProgress(p, k) < 100))) aktif.add(id)
      return
    }
    const ada = Object.entries(r.schedule || {}).some(([t, es]: [string, any]) => dalam(t) && (es || []).some((e: any) => {
      if (r.proses === 'QC TEST' || r.proses === 'PACKING') return statusPenandaPanel(p, r.proses) !== 'DONE'
      if (r.proses === 'NAMEPLATE' || r.proses === 'YELLOWMARK') return (Number(p[`${r.proses.toLowerCase()}_progress`]) || 0) < 100
      return (e?.komponen || []).some((k: string) => k && !k.startsWith('__wiring_') && !e?.digeserKe?.[k] && (Number(cl[k]?.qty) || 0) > 0 && (r.proses === 'WIRING CONTROL' || r.proses === 'WIRING POWER' || (penandaMain?.get(`${p.tipe}|${k}`) ?? true)) && (Number(cl[k]?.progress?.[r.proses]) || 0) < 100)
    }))
    if (ada) aktif.add(id)
  })
  const grup = new Map<string, PrioritasLap & { _p: any[] }>()
  aktif.forEach((id) => {
    const p = panelById.get(id), w = p._wo, k = kunciProyek(w.proyek, w.target)
    const g = grup.get(k) || { id: idBaru(), nama: upper(w.proyek), deadline: w.target || '', panels: [], _p: [] }
    g._p.push(p); grup.set(k, g)
  })
  return [...grup.values()].sort((a, c) => (a.deadline || '9999').localeCompare(c.deadline || '9999') || a.nama.localeCompare(c.nama))
    .map(({ _p, ...g }) => ({ ...g, panels: _p.sort((a, c) => (Number(a.no_pnl) || 0) - (Number(c.no_pnl) || 0)).map((p) => String(p.nama || '').trim()) }))
}

// ---------- teks WhatsApp (satu-satunya pembentuk teks) ----------
// saringan kendala yang ikut laporan - SATU aturan utk teks WhatsApp & dokumen berkop
// Baris KOSONG (pekerjaan/kendala tanpa teks): dilewati di teks WhatsApp, jadi garis tulis tangan di dokumen berkop.
export const kosong = (x: { teks: string }) => !String(x.teks ?? '').trim()
export const kendalaTampil = (d: DrafLaporan) => (k: KendalaLap) => d.tampilTeratasi !== false || !k.teratasi
export function formatTeksWhatsApp(d: DrafLaporan): string {
  const tampilK = kendalaTampil(d)
  const L: string[] = [judulLaporan(d.tanggal, d.jam), '']
  d.proyek.forEach((p) => {
    L.push(`${p.nama.trim() || 'PROYEK'}${p.deadline ? ` (${fmtTglLaporan(p.deadline)})` : ''}`)
    if (p.ringkas.trim()) L.push(`* ${p.ringkas.trim()}`)
    p.kendalaUmum.filter((k) => tampilK(k) && !kosong(k)).forEach((k) => L.push(`- ${teksKendalaWa(k)}`))
    if (!p.ringkas.trim()) {
      let no = 0
      p.panels.forEach((pn) => {
        if (pn.nama.trim()) L.push(`${++no}. ${pn.nama.trim()}`)
        pn.pekerjaan.filter((j) => j.teks.trim()).forEach((j) => L.push(`* ${j.teks.trim()}${j.selesai ? ' ✅' : ''}`))
        pn.kendala.filter((k) => tampilK(k) && !kosong(k)).forEach((k) => L.push(`- ${teksKendalaWa(k)}`))
      })
    }
    L.push('')
  })
  const cat = d.catatan.map((c) => c.trim()).filter(Boolean)
  if (cat.length) { L.push('NOTE :'); cat.forEach((c, i) => L.push(`${i + 1}. ${c}`)); L.push('') }
  const prio = d.prioritas.filter((p) => p.nama.trim() || p.panels.some((x) => x.trim()))
  if (prio.length) {
    L.push('PRIORITAS PENGERJAAN MINGGU INI', '')
    prio.forEach((p) => {
      L.push(`${p.nama.trim()}${p.deadline ? ` (${fmtTglLaporan(p.deadline)})` : ''}`)
      p.panels.map((x) => x.trim()).filter(Boolean).forEach((x, i) => L.push(`${i + 1}. ${x}`))
      L.push('')
    })
  }
  return L.join('\n').replace(/\n+$/, '\n')
}

// ---------- dokumen berkop (Tahap B, 23 Okt 2026) - pembentuk HTML isi dokumen dari draf yang SAMA dgn teks WhatsApp ----------
// Murni (tanpa DOM): dipakai pratinjau tab "Tampilan berkop" & jendela cetak (lib/laporanOutstandingBerkop, kop resmi
// lib/kopSuratKonfig halamanCetakBerkop). Gaya mengikuti artifact pratinjau "Laporan Outstanding". Kendala = Opsi B:
// teks di kiri, "Divisi · Nama · tgl" di kanan, kendala teratasi + baris hijau "✓ Teratasi tgl bln".
const HARI_P = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BLN_P = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const BLN_K = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export const tglPanjangLaporan = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${HARI_P[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN_P[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const tglSedang = (iso: string) => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)} ${BLN_K[Number(m) - 1]} ${y}` }
const tglKecil = (iso?: string) => { if (!iso) return ''; const [, m, d] = iso.slice(0, 10).split('-'); return `${Number(d)} ${BLN_K[Number(m) - 1]}` }
const escH = (s: string) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const CSS_DOKUMEN_LAPORAN = `
.lod{--ink:#171b2e;--dim:#5b6272;--line:#d9dde6;--soft:#f4f6fa;--ok:#15803d;--warn:#9a5b00;--warn-bg:#fff4d6;--brand:#f37321;
  color:var(--ink);font-family:'KopCarlito','Carlito',Calibri,Arial,sans-serif;font-size:11pt;line-height:1.42;font-variant-numeric:tabular-nums}
.lod *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lod-title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:.6em;border-bottom:2px solid var(--ink)}
.lod-title h1{margin:0;font-size:17pt;font-weight:700;letter-spacing:.02em;line-height:1.1}
.lod-title .when{font-size:10.5pt;color:var(--dim)}
.lod-proj{margin-top:1.1em}
.lod-ph{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:.4em .7em;background:var(--soft);border-left:3px solid var(--brand);break-after:avoid}
.lod-ph .nm{font-weight:700;letter-spacing:.02em;text-transform:uppercase}
.lod-ph .dl{font-size:10pt;color:var(--dim);white-space:nowrap}
.lod-ph .dl b{color:var(--ink)}
.lod-pn{display:grid;grid-template-columns:2em 1fr;column-gap:.45em;padding:.45em .7em;border-bottom:1px solid var(--line);break-inside:avoid}
.lod-pn:last-child{border-bottom:0}
.lod-pn.nonum{grid-template-columns:1fr}
.lod-pn .no{font-weight:700;color:var(--dim);text-align:right}
.lod-pn .pnm{font-weight:700}
.lod ul{margin:.2em 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.12em}
.lod li{position:relative;padding-left:1.25em}
.lod li::before{content:"";position:absolute;left:.25em;top:.58em;width:.36em;height:.36em;border-radius:1px;background:var(--brand)}
.lod li.done{color:var(--dim)}
.lod li.done::before{content:"\\2713";background:none;color:var(--ok);font-weight:700;width:auto;height:auto;left:0;top:0}
.lod li.kd{padding-left:0;margin-top:.15em}
.lod li.kd::before{display:none}
.lod .kdr{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.lod .kdt{color:var(--warn);font-style:italic;min-width:0}
.lod .tag{font-style:normal;font-weight:700;font-size:8pt;letter-spacing:.04em;text-transform:uppercase;background:var(--warn-bg);color:var(--warn);border-radius:3px;padding:.05em .4em;margin-right:.4em}
.lod .kdm{font-size:9pt;color:var(--dim);white-space:nowrap;text-align:right}
.lod .kdm .tg{margin-left:.7em}
.lod li.kd.ok .kdt{color:var(--dim)}
.lod .kdok{color:var(--ok);font-weight:700;font-size:9.5pt;margin-top:.05em}
.lod-umum{padding:.35em .7em 0;break-inside:avoid}
.lod li.tulis{padding:0;height:2.9em;border-bottom:.6px solid #9aa1ad;break-inside:avoid}
.lod li.tulis::before{display:none}
.lod-proj{break-inside:auto}
.lod-ph+.lod-pn,.lod-ph+.lod-umum{break-before:avoid}
.lod-belum{padding:.45em .7em;color:var(--dim)}
.lod-sec{margin-top:1.4em;padding-top:.6em;border-top:2px solid var(--ink)}
.lod-sec h3{margin:0 0 .3em;font-size:10.5pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.lod ol{margin:.2em 0 0;padding:0;list-style:none}
.lod ol li{display:grid;grid-template-columns:1.8em 1fr;column-gap:.4em;padding:.06em 0 .06em 0}
.lod ol li::before{display:none}
.lod ol li .no{text-align:right;color:var(--dim);font-weight:700}
.lod ol.dua{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:1.4em;padding:.35em .7em 0}
.lod-pr{margin-top:.8em;break-inside:avoid}
.lod-foot{margin-top:1.6em;font-size:9pt;color:var(--dim);display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding-top:.5em}
`

// garis kosong utk ditulis tangan setelah dicetak (~2 baris teks, garis bawah tipis, tanpa poin)
const BARIS_TULIS = '<li class="tulis"></li>'
function htmlKendala(k: KendalaLap, umum: boolean): string {
  const siapa = [k.divisi, k.oleh].filter(Boolean).map((x) => escH(String(x))).join(' · ')
  const meta = siapa || k.tanggal ? `<span class="kdm">${siapa}${k.tanggal ? `<span class="tg">${escH(tglKecil(k.tanggal))}</span>` : ''}</span>` : ''
  return `<li class="kd${k.teratasi ? ' ok' : ''}"><div class="kdr"><span class="kdt"><span class="tag">${umum ? 'Kendala umum' : 'Kendala'}</span>${escH(k.teks.trim())}</span>${meta}</div>${k.teratasi ? `<div class="kdok">✓ Teratasi ${escH(tglKecil(k.teratasi))}</div>` : ''}</li>`
}

export function htmlDokumenLaporan(d: DrafLaporan, o: { dibuatJam?: string } = {}): string {
  const tampilK = kendalaTampil(d)
  let h = `<div class="lod"><div class="lod-title"><h1>OUTSTANDING PEKERJAAN</h1><div class="when">${escH(tglPanjangLaporan(d.tanggal))} · ${escH(d.jam)} WIB</div></div>`
  d.proyek.forEach((p) => {
    h += `<div class="lod-proj"><div class="lod-ph"><span class="nm">${escH(p.nama.trim() || 'PROYEK')}</span><span class="dl">${p.deadline ? `Deadline <b>${escH(tglSedang(p.deadline))}</b>` : ''}</span></div>`
    const umum = p.kendalaUmum.filter(tampilK)
    if (umum.length) h += `<ul class="lod-umum">${umum.map((k) => (kosong(k) ? BARIS_TULIS : htmlKendala(k, true))).join('')}</ul>`
    if (p.ringkas.trim()) h += `<div class="lod-belum">${escH(p.ringkas.trim())}</div>`
    else {
      let no = 0
      p.panels.forEach((pn) => {
        const jobs = pn.pekerjaan, kd = pn.kendala.filter(tampilK)
        const bernama = !!pn.nama.trim()
        if (!bernama && !jobs.length && !kd.length) return
        h += `<div class="lod-pn${bernama ? '' : ' nonum'}">${bernama ? `<div class="no">${++no}.</div>` : ''}<div>${bernama ? `<div class="pnm">${escH(pn.nama.trim())}</div>` : ''}<ul>`
        jobs.forEach((j) => { h += kosong(j) ? BARIS_TULIS : `<li${j.selesai ? ' class="done"' : ''}>${escH(j.teks.trim())}</li>` })
        kd.forEach((k) => { h += kosong(k) ? BARIS_TULIS : htmlKendala(k, false) })
        h += '</ul></div></div>'
      })
    }
    h += '</div>'
  })
  const cat = d.catatan.map((c) => c.trim()).filter(Boolean)
  if (cat.length) h += `<div class="lod-sec"><h3>Catatan</h3><ol>${cat.map((c, i) => `<li><span class="no">${i + 1}.</span><span>${escH(c)}</span></li>`).join('')}</ol></div>`
  const prio = d.prioritas.filter((p) => p.nama.trim() || p.panels.some((x) => x.trim()))
  if (prio.length) {
    h += '<div class="lod-sec"><h3>Prioritas Pengerjaan Minggu Ini</h3>'
    prio.forEach((p) => {
      const pn = p.panels.map((x) => x.trim()).filter(Boolean)
      h += `<div class="lod-pr"><div class="lod-ph"><span class="nm">${escH(p.nama.trim())}</span><span class="dl">${p.deadline ? `Deadline <b>${escH(tglSedang(p.deadline))}</b>` : ''}</span></div><ol class="dua">${pn.map((x, i) => `<li><span class="no">${i + 1}.</span><span>${escH(x)}</span></li>`).join('')}</ol></div>`
    })
    h += '</div>'
  }
  h += `<div class="lod-foot"><span>Dibuat dari data Vista Teknik ERP</span><span>${o.dibuatJam ? `Dicetak ${escH(o.dibuatJam)} WIB` : ''}</span></div></div>`
  return h
}

// ---------- muat data (baca saja; paginasi .range + urutan stabil, error dilempar) ----------

// Nama komponen (baris WIRING) dari BOM live - biasanya sudah dimuat App saat mulai (setGlobalLivePanelTypes); bila belum,
// dimuat di sini dgn cara yang sama (bom_master semua halaman + panel_type_meta + panel_wp_meta, error dilempar).
async function pastikanBomLive(db: any): Promise<void> {
  if (GLOBAL_LIVE_PANEL_TYPES && Object.keys(GLOBAL_LIVE_PANEL_TYPES).length) return
  const bom = await fetchAllPaged((a, z) => db.from('bom_master').select('*').order('id').range(a, z))
  const [tm, wm] = await Promise.all([db.from('panel_type_meta').select('*').order('id').range(0, 999), db.from('panel_wp_meta').select('*').order('id').range(0, 999)])
  if (tm.error) throw new Error('panel_type_meta: ' + tm.error.message)
  if (wm.error) throw new Error('panel_wp_meta: ' + wm.error.message)
  if (bom.length) setGlobalLivePanelTypes(buildPanelTypesFromBom(bom, tm.data, wm.data))
}
// Penanda komponen MAIN/printilan Laporan Outstanding (tabel laporan_komponen_main, kunci jenis_panel+kode). Dibaca sekali per
// pembuatan laporan (.range penuh, urutan stabil); error dilempar. Tidak ada di tabel = MAIN.
export async function muatPenandaMain(db: any): Promise<Map<string, boolean>> {
  const rows = await fetchAllPaged((a, z) => db.from('laporan_komponen_main').select('jenis_panel,kode_komponen,is_main').order('jenis_panel').order('kode_komponen').range(a, z))
  return new Map(rows.map((r: any) => [`${r.jenis_panel}|${r.kode_komponen}`, !!r.is_main]))
}
export async function muatBahanOtomatis(db: any): Promise<Pick<BahanLaporan, 'woAktif' | 'raw' | 'timerBerjalan' | 'penandaMain'>> {
  // relevansi komponen-proses (bom_proses_relevan) utk rantai estafet V2/V3 - biasanya sudah dimuat App saat mulai
  if (!GLOBAL_PROSES_RELEVAN_TERMUAT && !(await muatProsesRelevanGlobal(db))) throw new Error('gagal memuat bom_proses_relevan')
  await pastikanBomLive(db)
  const wo = await fetchAllPaged((a, z) => db.from('work_orders').select('id,wo,proyek,target,created_at').is('deleted_at', null).or('is_archived.is.null,is_archived.eq.false').order('id').range(a, z))
  const ids = wo.map((w: any) => w.id)
  const panels = await muatPerPotongan(ids, (pot, a, z) => db.from('panels').select('*').in('wo_id', pot).is('deleted_at', null).order('id').range(a, z))
  const raw = await muatPerPotongan(ids, (pot, a, z) => db.from('raw_schedule').select('id,wo_id,panel_id,proyek,panel,proses,schedule,busbar_schedule').in('wo_id', pot).is('deleted_at', null).order('id').range(a, z))
  const per = new Map<number, any[]>()
  panels.forEach((p: any) => { if (!per.has(p.wo_id)) per.set(p.wo_id, []); per.get(p.wo_id)!.push(p) })
  // timer berjalan (selesai kosong) - V2/V3 menganggap proses komponen itu aktif
  const tm = await fetchAllPaged((a, z) => db.from('fcs_timer_kerja').select('id,panel_id,kode_komponen,proses').is('selesai', null).order('id').range(a, z))
  const timerBerjalan = new Set<string>(tm.map((t: any) => `${t.panel_id}|${t.kode_komponen}|${t.proses}`))
  return { woAktif: wo.map((w: any) => ({ ...w, panels: per.get(w.id) || [] })), raw, timerBerjalan, penandaMain: await muatPenandaMain(db) }
}
async function muatPerPotongan(ids: any[], build: (pot: any[], a: number, z: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let i = 0; i < ids.length; i += UKURAN_POTONGAN_ID) {
    const pot = ids.slice(i, i + UKURAN_POTONGAN_ID)
    out.push(...await fetchAllPaged((a, z) => build(pot, a, z)))
  }
  return out
}

// ---------- arsip ----------
export type PanelArsip = { id: number; nama: string; tipe: string; woId: number; target: string; diarsipkanPada: string; snapshot: number; pekerjaan: Pekerjaan[]; belumTuntas: boolean }
export type GrupArsip = { kunci: string; wo: string; proyek: string; targets: string[]; panels: PanelArsip[] }
export async function muatPilihanArsip(db: any, o: { hari?: number; kecualiPanelIds?: Set<number> } = {}): Promise<GrupArsip[]> {
  await pastikanBomLive(db)
  const penandaMain = await muatPenandaMain(db)
  const batas = new Date(Date.now() - (o.hari ?? 60) * 864e5).toISOString()
  const pa = await fetchAllPaged((a, z) => db.from('panels_archived').select('*').gte('diarsipkan_pada', batas).order('id').range(a, z))
  const ids = pa.map((p: any) => p.id)
  const raw = await muatPerPotongan(ids, (pot, a, z) => db.from('raw_schedule_archived').select('id,wo_id,panel_id,proses,schedule,busbar_schedule').in('panel_id', pot).order('id').range(a, z))
  const woIds = [...new Set(pa.map((p: any) => p.wo_id))]
  const wo = await muatPerPotongan(woIds, (pot, a, z) => db.from('work_orders').select('id,wo,proyek,target').in('id', pot).order('id').range(a, z))
  const woMap = new Map<number, any>(wo.map((w: any) => [w.id, w]))
  const hariIni = hariKerjaWib()
  const grup = new Map<string, GrupArsip>()
  pa.forEach((p: any) => {
    if (o.kecualiPanelIds?.has(Number(p.id))) return // panel yg sudah ada sbg otomatis (mis. batal arsip) tidak dobel
    const w = woMap.get(p.wo_id) || {}
    const woNo = String(p.wo_number_snapshot ?? w.wo ?? '').trim(), nama = upper(p.proyek_snapshot || w.proyek || '')
    const k = `${woNo}|${nama}`
    const pekerjaan = turunkanPekerjaanPanel(p, raw, hariIni, { penandaMain }) // jenis = panels_archived.tipe
    const item: PanelArsip = {
      id: Number(p.id), nama: String(p.nama || '').trim(), tipe: p.tipe, woId: p.wo_id, target: w.target || '',
      diarsipkanPada: p.diarsipkan_pada, snapshot: Number(p.progress_snapshot) || 0, pekerjaan,
      belumTuntas: pekerjaan.some((j) => !j.selesai) || (Number(p.progress_snapshot) || 0) < 100,
    }
    const g = grup.get(k) || { kunci: k, wo: woNo, proyek: nama, targets: [], panels: [] }
    if (item.target && !g.targets.includes(item.target)) g.targets.push(item.target)
    g.panels.push(item); grup.set(k, g)
  })
  const terakhir = (g: GrupArsip) => g.panels.reduce((m, p) => (p.diarsipkanPada > m ? p.diarsipkanPada : m), '')
  return [...grup.values()].map((g) => ({ ...g, targets: g.targets.sort() })).sort((a, b) => terakhir(b).localeCompare(terakhir(a)))
}
// panel arsip terpilih -> entri proyek 'arsip' (per nomor WO / proyek); pekerjaan = sisa (yang belum selesai)
export function proyekDariArsip(g: GrupArsip, pilih: PanelArsip[], kendala: KendalaSumber[], hariIni = hariKerjaWib()): ProyekLap {
  const kd = (id: number) => kendala.filter((k) => Number(k.panel_id) === id && kendalaMasukLaporan(k, hariIni)).sort((a, c) => a.id - c.id).map(kendalaDariSumber)
  const targets = pilih.map((p) => p.target).filter(Boolean).sort()
  return {
    id: idBaru(), src: 'arsip', nama: g.proyek, deadline: targets[0] || '', ringkas: '', kendalaUmum: [],
    panels: pilih.map((p) => ({ id: idBaru(), src: 'arsip', nama: p.nama, panelId: p.id, pekerjaan: p.pekerjaan.filter((j) => !j.selesai).map((j) => ({ ...j, id: idBaru() })), kendala: kd(p.id) })),
  }
}
export const panelIdsDalamDraf = (d: DrafLaporan | null) => new Set<number>((d?.proyek || []).flatMap((p) => p.panels.map((x) => x.panelId)).filter((x): x is number => x != null))
export const proyekManualBaru = (): ProyekLap => ({ id: idBaru(), src: 'manual', nama: '', deadline: '', ringkas: '', kendalaUmum: [], panels: [panelManualBaru()] })
export const panelManualBaru = (): PanelLap => ({ id: idBaru(), src: 'manual', nama: '', panelId: null, pekerjaan: [{ id: idBaru(), teks: '', selesai: false }], kendala: [] })

// ---------- simpan draf di perangkat (localStorage; gagal -> tetap jalan tanpa simpan) ----------
export type SimpananLaporan = { draf: DrafLaporan; teksWa: string; teksSistem: string }
const kunciSimpan = (user: string) => `vt_laporan_outstanding_v1:${user || 'admin'}`
export function bacaSimpanan(user: string): SimpananLaporan | null {
  try {
    const s = localStorage.getItem(kunciSimpan(user)); if (!s) return null
    const j = JSON.parse(s)
    if (!(j?.draf?.versi === 1 && Array.isArray(j.draf.proyek))) return null
    // draf lama: kendala berupa teks -> KendalaLap
    j.draf.proyek = j.draf.proyek.map((p: any) => ({ ...p, kendalaUmum: (p.kendalaUmum || []).map(normKendala), panels: (p.panels || []).map((n: any) => ({ ...n, kendala: (n.kendala || []).map(normKendala) })) }))
    return j
  } catch { return null }
}
export function tulisSimpanan(user: string, s: SimpananLaporan): boolean {
  try { localStorage.setItem(kunciSimpan(user), JSON.stringify(s)); return true } catch { return false }
}
