// CEK KONEKSI AWAL (14 Nov 2026, logo JRENG Tahap 4) - pengecekan PALING MURAH bahwa server Supabase menjawab, dipakai
// layar animasi masuk (AnimasiMasuk) sebelum menampilkan aplikasi. GET /auth/v1/health: balasan ~100 byte, tanpa
// membaca/menulis tabel apa pun, tanpa sesi. Hanya header `apikey` (anon) - tanpa Authorization (CLAUDE.md A.3).
// Data besar (Raw Schedule dll.) TIDAK ditunggu: tetap dimuat aplikasi sendiri secara paralel seperti sebelumnya.
import { supabaseUrl, supabaseAnonKey } from './supabase'

export async function cekKoneksiSupabase(signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`${supabaseUrl}/auth/v1/health`, { headers: { apikey: supabaseAnonKey }, cache: 'no-store', signal })
  return res.ok
}
