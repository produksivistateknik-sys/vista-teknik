// PENCATAT ERROR TERPUSAT (15 Okt 2026, MVP Kesehatan Data) - error aplikasi yang dulu cuma muncul di console browser
// (tidak terlihat siapa pun) dikirim ke tabel log_error_app lewat RPC catat_error_app.
// Supaya ringan & tidak membanjiri: error dengan SIDIK sama (jenis + pesan dinormalkan + lokasi) digabung di memori,
// dikirim berkelompok tiap 15 detik (atau segera saat tab disembunyikan / sebelum reload), maks 30 kejadian per menit
// per perangkat; server menggabungkan lagi per sidik per jam. Fungsi ini TIDAK PERNAH melempar error.
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase'

declare const __BUILD_ID__: string

export type JenisError = 'crash' | 'chunk' | 'unhandled' | 'window_error' | 'supabase_error' | 'gagal_simpan' | 'console_error'
type Item = { aplikasi: string; versi: string; jenis: string; sidik: string; pesan: string; halaman: string; pengguna: string; konteks: any; jumlah: number }

const APLIKASI = 'vista-teknik'
const JEDA_KIRIM_MS = 15000
const MAKS_PER_MENIT = 30
const antrian = new Map<string, Item>()
let timer: ReturnType<typeof setTimeout> | null = null
let menitMulai = Date.now(), terkirimMenitIni = 0
let sedangMencatat = false

const versi = () => { try { return typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : 'dev' } catch { return 'dev' } }
const pengguna = () => { try { const s = JSON.parse(localStorage.getItem('vista_admin_session') || '{}'); return String(s?.nama || s?.name || '') } catch { return '' } }
const halaman = () => { try { return (localStorage.getItem('vista_teknik_active_tab') || '') + ' ' + window.location.pathname } catch { return '' } }

// djb2 -> hex: cukup utk mengelompokkan, bukan keamanan
function hash(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16) }
// angka/id/uuid diganti '#' supaya error yang sama dgn id berbeda tergabung
const normal = (s: string) => s.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '#').replace(/\d+/g, '#').slice(0, 300)
// baris stack pertama yang menunjuk file aplikasi (assets/*.js atau src/*)
function lokasi(err: any): string {
  const st = String(err?.stack || '').split('\n').map(l => l.trim()).find(l => /assets\/|src\//.test(l)) || ''
  return st.replace(/^at\s+/, '').replace(/\?[^:)]*/, '').slice(0, 200)
}

export function laporError(jenis: JenisError, err: unknown, konteks: Record<string, any> = {}): void {
  if (sedangMencatat) return
  sedangMencatat = true
  try {
    const e: any = err
    const pesan = String(e?.message || e?.msg || (typeof e === 'string' ? e : JSON.stringify(e ?? null))).slice(0, 1000) || '(tanpa pesan)'
    const lok = lokasi(e)
    const sidik = hash(jenis + '|' + normal(pesan) + '|' + lok)
    const ada = antrian.get(sidik)
    if (ada) ada.jumlah++
    else antrian.set(sidik, { aplikasi: APLIKASI, versi: versi(), jenis, sidik, pesan, halaman: halaman().slice(0, 200), pengguna: pengguna(), jumlah: 1,
      konteks: { ...konteks, lokasi: lok || undefined, kode: e?.code || undefined, ua: navigator.userAgent.slice(0, 120) } })
    if (jenis === 'chunk' || jenis === 'crash') kirimSekarang(true) // halaman mungkin langsung reload
    else if (!timer) timer = setTimeout(() => kirimSekarang(false), JEDA_KIRIM_MS)
  } catch { /* pencatat tidak boleh menambah error */ } finally { sedangMencatat = false }
}

function kirimSekarang(keepalive: boolean): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (!antrian.size) return
  if (Date.now() - menitMulai > 60000) { menitMulai = Date.now(); terkirimMenitIni = 0 }
  const sisaKuota = MAKS_PER_MENIT - terkirimMenitIni
  if (sisaKuota <= 0) { timer = setTimeout(() => kirimSekarang(false), JEDA_KIRIM_MS); return }
  const batch = [...antrian.values()].slice(0, Math.min(50, sisaKuota))
  batch.forEach(b => antrian.delete(b.sidik))
  terkirimMenitIni += batch.length
  try {
    if (keepalive) {
      // fetch keepalive tetap terkirim walau halaman ditutup/reload
      fetch(`${supabaseUrl}/rest/v1/rpc/catat_error_app`, { method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey }, // HANYA apikey (CLAUDE.md A.3)
        body: JSON.stringify({ p_batch: batch }) }).catch(() => {})
    } else {
      supabase.rpc('catat_error_app' as any, { p_batch: batch } as any).then(({ error }: any) => {
        if (error) console.warn('[laporError] gagal kirim log error (diabaikan):', error.message)
      }, () => {})
    }
  } catch { /* abaikan */ }
  if (antrian.size && !timer) timer = setTimeout(() => kirimSekarang(false), JEDA_KIRIM_MS)
}

// pasang sekali di main.tsx: error global + kirim saat tab disembunyikan
let terpasang = false
export function pasangPencatatErrorGlobal(): void {
  if (terpasang || typeof window === 'undefined') return
  terpasang = true
  window.addEventListener('error', (ev) => {
    if (!ev?.error && !ev?.message) return
    laporError('window_error', ev.error || ev.message, { sumber: ev.filename ? String(ev.filename).split('/').pop() + ':' + ev.lineno : undefined })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const msg = String((ev as any)?.reason?.message || (ev as any)?.reason || '')
    laporError(/Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed/.test(msg) ? 'chunk' : 'unhandled', (ev as any)?.reason)
  })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') kirimSekarang(true) })
}
