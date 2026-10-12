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
