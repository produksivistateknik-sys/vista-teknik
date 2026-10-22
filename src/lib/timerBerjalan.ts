// PERINGATAN TIMER BERJALAN SAAT MEMINDAH / MENGHAPUS JADWAL (22 Okt 2026, aturan operator harian)
// Insiden 544 FS.4 WIRING POWER: planner memindah jadwal 22->24 Okt saat timer RIFKI+FAHRI berjalan -> tugas renhar hari
// itu ikut pindah, kartu hilang dari HP operator, timer tidak bisa dihentikan dari kartunya (FAHRI 2 timer berjalan).
// SATU pemeriksa utk drag 1 sel, Pindahin, pindah banyak sel (Raw Schedule asli) & Hapus WP (ModalJadwalSel).
// Bukan larangan - planner diberi tahu siapa yang sedang bekerja lalu memilih lanjut atau tidak.
import { supabase } from './supabase'

export type ItemCekTimer = { panelId: number; proses: string; tanggal: string; kode: string[]; label?: string }
export type TemuanTimer = { label: string; kode: string; proses: string; tanggal: string; pekerja: string[] }

export async function cekTimerBerjalan(items: ItemCekTimer[], namaById: (id: any) => string | undefined): Promise<{ temuan: TemuanTimer[]; error: any }> {
  const temuan: TemuanTimer[] = []
  for (const it of items) {
    const kode = [...new Set((it.kode || []).filter(k => k && !k.startsWith('__')))]
    if (!it.panelId || !kode.length) continue
    const { data, error } = await (supabase as any).from('fcs_timer_kerja').select('pekerja_id,kode_komponen')
      .eq('panel_id', it.panelId).eq('proses', it.proses).eq('tanggal', it.tanggal).in('kode_komponen', kode).is('selesai', null)
      .order('id').limit(500)
    if (error) return { temuan, error }
    const per = new Map<string, Set<string>>()
    for (const t of data || []) { if (!per.has(t.kode_komponen)) per.set(t.kode_komponen, new Set()); per.get(t.kode_komponen)!.add(namaById(t.pekerja_id) || `#${t.pekerja_id}`) }
    for (const [k, n] of per) temuan.push({ label: it.label || '', kode: k, proses: it.proses, tanggal: it.tanggal, pekerja: [...n] })
  }
  return { temuan, error: null }
}

// true = boleh lanjut. Gagal memeriksa -> tanya (tidak diam-diam lanjut, tidak memblokir kerja).
export async function konfirmasiTimerBerjalan(items: ItemCekTimer[], namaById: (id: any) => string | undefined, aksi: string): Promise<boolean> {
  const { temuan, error } = await cekTimerBerjalan(items, namaById)
  if (error) {
    console.error('[cekTimerBerjalan] gagal:', error)
    return window.confirm(`Tidak bisa memeriksa timer yang sedang berjalan (${error?.message || error}).\n\nTetap ${aksi}?`)
  }
  if (!temuan.length) return true
  const daftar = temuan.slice(0, 12).map(t => `- ${t.label ? t.label + ' ' : ''}${t.kode} ${t.proses} (${t.tanggal}): ${t.pekerja.join(', ')}`).join('\n')
  return window.confirm(`⚠ Timer sedang BERJALAN:\n${daftar}${temuan.length > 12 ? `\n... dan ${temuan.length - 12} lainnya` : ''}\n\n` +
    `Kalau di-${aksi}, kartu tanggal itu bisa hilang dari HP operator dan timernya tidak bisa dihentikan dari kartu. ` +
    `Sebaiknya minta operator menekan Selesai dulu.\n\nTetap ${aksi}?`)
}
