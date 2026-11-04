// Pemuat data OPERATOR per panel utk tooltip detail progres (12 Okt 2026) - Detail Progres & Task Monitoring.
// Dimuat SAAT DIBUTUHKAN (hover sel / panel dibuka), 1x per panel, di-cache (segar ulang bila > 2 menit) -
// tidak menambah beban saat halaman dibuka & tidak ada query per tooltip. Master pekerja dimuat sekali.
// Sengaja file terpisah dari lib/operatorProgres.ts: yang ini memakai klien Supabase, operatorProgres
// dipakai juga oleh Raw Schedule per WP (sandbox) yang dilarang mengimpor klien tulis.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { indeksTimer, kunciTimer } from './operatorProgres'

export type DataOperatorPanel = {
  status: 'muat' | 'siap' | 'gagal'
  timer: Map<string, any[]>                       // panel|kode|proses -> timer
  checkpoint: Map<string, any[]>                  // panel|kode|proses -> checkpoint log (pekerja_nama teks)
  nama: (id: any) => string | undefined
}

const SEGAR_MS = 2 * 60000
const cache = new Map<number, { data: DataOperatorPanel; waktu: number }>()
const pendengar = new Set<() => void>()
let petaPekerja: Promise<Map<string, string>> | null = null

const kabari = () => pendengar.forEach(f => f())

async function semuaBaris(tabel: string, kolom: string, panelId: number): Promise<any[]> {
  let semua: any[] = [], dari = 0
  for (;;) {
    const { data, error } = await (supabase as any).from(tabel).select(kolom).eq('panel_id', panelId).order('id').range(dari, dari + 999)
    if (error) throw new Error(tabel + ': ' + error.message)
    semua = semua.concat(data || [])
    if (!data || data.length < 1000) return semua
    dari += 1000
  }
}

function muatPekerja(): Promise<Map<string, string>> {
  if (!petaPekerja) {
    petaPekerja = (async () => {
      const { data, error } = await supabase.from('pekerja').select('id,nama').range(0, 4999)
      if (error) { petaPekerja = null; throw new Error('pekerja: ' + error.message) }
      return new Map((data || []).map((p: any) => [String(p.id), p.nama]))
    })()
  }
  return petaPekerja
}

export function mintaMuatOperator(panelId: number | null | undefined) {
  if (panelId == null) return
  const ada = cache.get(panelId)
  if (ada && (ada.data.status === 'muat' || Date.now() - ada.waktu < SEGAR_MS)) return
  const kosong: DataOperatorPanel = { status: 'muat', timer: new Map(), checkpoint: new Map(), nama: () => undefined }
  cache.set(panelId, { data: ada?.data.status === 'siap' ? { ...ada.data } : kosong, waktu: Date.now() })
  if (!ada || ada.data.status !== 'siap') kabari()
  ;(async () => {
    try {
      const [timer, cp, peta] = await Promise.all([
        semuaBaris('fcs_timer_kerja', 'id,panel_id,kode_komponen,proses,tahap,pekerja_id,mulai,selesai,durasi_menit', panelId),
        semuaBaris('progress_checkpoint_log', 'id,panel_id,kode_komponen,proses,checkpoint,pekerja_nama,tanggal,ts', panelId),
        muatPekerja(),
      ])
      cache.set(panelId, { data: { status: 'siap', timer: indeksTimer(timer), checkpoint: indeksTimer(cp), nama: (id: any) => peta.get(String(id)) }, waktu: Date.now() })
    } catch (e) {
      console.error('[Operator tooltip] gagal memuat data operator panel ' + panelId + ':', e)
      cache.set(panelId, { data: { ...kosong, status: 'gagal' }, waktu: 0 }) // waktu 0 -> hover berikutnya coba lagi
    }
    kabari()
  })()
}

// Data operator panel dari cache (tidak memicu muat - pemanggil memanggil mintaMuatOperator saat hover/buka).
export function useOperatorPanel(panelId: number | null | undefined): DataOperatorPanel | null {
  const [, setV] = useState(0)
  useEffect(() => { const f = () => setV(v => v + 1); pendengar.add(f); return () => { pendengar.delete(f) } }, [])
  return panelId == null ? null : cache.get(panelId)?.data || null
}

export const timerOperator = (d: DataOperatorPanel | null, panelId: any, kode: string, proses: string) => d?.timer.get(kunciTimer(panelId, kode, proses)) || []

// RIWAYAT RINGKAS (4 Nov 2026, keputusan user; TAMPILAN saja - penulisan data tidak diubah). Tooltip riwayat hanya
// menampilkan entri yang nilainya BERUBAH dari entri sebelumnya (naik/turun, termasuk koreksi); entri pertama selalu tampil.
// Entri dgn nilai sama = "disimpan ulang" (dihitung, tidak jadi baris). Urutan = ts entri (cadangan: tanggal).
export type EntriRiwayat = { pct?: number | string; ts?: string; tanggal?: string; shift?: string; koreksi?: boolean; updatedBy?: string; alasan?: string }
export function ringkasRiwayat(history: EntriRiwayat[]): { baris: EntriRiwayat[]; ulang: number } {
  const urut = [...(history || [])].sort((a, b) => String(a?.ts || a?.tanggal || '').localeCompare(String(b?.ts || b?.tanggal || '')))
  const baris: EntriRiwayat[] = []; let ulang = 0, prev: number | null = null
  for (const e of urut) {
    const v = Number(e?.pct) || 0
    if (prev !== null && v === prev) ulang++; else baris.push(e)
    prev = v
  }
  return { baris, ulang }
}
export const SELISIH_CHECKPOINT_MS = 2 * 60000
// Nama untuk SATU entri riwayat: koreksi admin -> nama admin (updatedBy); selain itu checkpoint (kode+proses) yang waktunya
// paling dekat dgn ts entri, maksimal 2 menit. Tidak ada -> "tanpa catatan operator".
export function namaOperatorEntri(d: DataOperatorPanel | null, panelId: number | string, kode: string, proses: string, e: EntriRiwayat): string {
  if (!d || d.status === 'muat') return '…'
  if (d.status === 'gagal') return '(gagal memuat)'
  if (e?.koreksi) return `${e.updatedBy || 'admin'} (koreksi${e.alasan ? ': ' + e.alasan : ''})`
  const t = Date.parse(e?.ts || '')
  if (!Number.isFinite(t)) return 'tanpa catatan operator'
  let terbaik: { pekerja_nama?: string } | null = null, selisih = Infinity
  for (const c of d.checkpoint.get(kunciTimer(panelId, kode, proses)) || []) {
    const s = Math.abs(Date.parse(c.ts) - t)
    if (s <= SELISIH_CHECKPOINT_MS && s < selisih) { terbaik = c; selisih = s }
  }
  const nama = String(terbaik?.pekerja_nama || '').split(',').map((x) => x.trim()).filter(Boolean)
  return nama.length ? [...new Set(nama)].join(', ') : 'tanpa catatan operator'
}

// Nama operator di 1 baris riwayat (tanggal + %) dari progress_checkpoint_log: checkpoint dgn tanggal & persen
// yang sama; bila tak ada yang persis, semua checkpoint di tanggal itu; "—" bila tidak ada sama sekali.
export function namaOperatorRiwayat(d: DataOperatorPanel | null, panelId: any, kode: string, proses: string, tanggal: string, pct: number): string {
  if (!d || d.status === 'muat') return '…'
  if (d.status === 'gagal') return '(gagal memuat)'
  const cp = (d.checkpoint.get(kunciTimer(panelId, kode, proses)) || []).filter(c => c.tanggal === String(tanggal || '').slice(0, 10))
  const pas = cp.filter(c => Number(c.checkpoint) === Number(pct))
  const nama: string[] = []
  for (const c of (pas.length ? pas : cp)) for (const n of String(c.pekerja_nama || '').split(',').map(x => x.trim()).filter(Boolean)) if (!nama.includes(n)) nama.push(n)
  return nama.length ? nama.join(', ') : '—'
}
