// SATU aturan (CLAUDE.md B.1) "kode ini masih pekerjaan aktif di entri jadwal Raw Schedule" - dipakai
// semua jalur yang menghitung beban / menawarkan / memindah kode jadwal (drag & multi-pindah lewat
// entriesTanpaSelesai, rebalance Atur Kapasitas, swap kapasitas/kuota). Tidak aktif kalau:
// - token __wiring_ (metadata bobot lama, bukan komponen asli),
// - jejak (entry.digeserKe[kode] - histori read-only, lokasi live-nya sudah di tanggal lain),
// - progress proses itu sudah 100%.
// INSIDEN 21 Okt 2026 (SISWOYO, panel 547 FS.13 STEL): rebalance cabang proses jam dulu TIDAK cek 100%
// -> komponen yang selesai 20 Okt dipindah ke 21/22 Okt -> terbit ulang di renhar & HP operator.
// Edge Function auto-geser-harian (Deno, tidak bisa import src/) memakai aturan yang SAMA - kalau
// aturan ini berubah, ubah juga di sana (filter progress>=100 / isJejakKode).
// "Komponen ini SUDAH selesai SEBELUM `tanggal`" (CLAUDE.md B.3: basi vs baru selesai hari ini) - dipakai
// filter tugas Rencana Harian & kartu HP operator supaya komponen yang selesai kemarin tidak terbit lagi
// sebagai pekerjaan (insiden 21 Okt 2026). TIDAK dianggap selesai-sebelumnya kalau:
// - progress terkini < 100 (dikoreksi turun / belum selesai),
// - progressByDate[tanggal] >= 100 (selesai, atau selesai lagi, TEPAT di tanggal itu -> tetap tampil "Done"),
// - tidak ada catatan tanggal 100% sama sekali (data lama) -> perilaku lama (tampil).
// Cermin di vista-pekerja: src/lib/panelHelpers.tsx selesaiSebelumTanggal - ubah keduanya bersamaan.
export function selesaiSebelumTanggal(cl: any, proses: string, tanggal: string): boolean {
  if ((Number(cl?.progress?.[proses]) || 0) < 100) return false
  const byDate: Record<string, any> = cl?.progressByDate?.[proses] || {}
  if (Number(byDate[tanggal]) >= 100) return false
  if (Object.entries(byDate).some(([t, p]) => t < tanggal && Number(p) >= 100)) return true
  const hist: any[] = cl?.history?.[proses] || [] // fallback data tanpa progressByDate
  if (hist.some((h) => h?.tanggal === tanggal && Number(h?.pct) >= 100)) return false
  return hist.some((h) => h?.tanggal && h.tanggal < tanggal && Number(h?.pct) >= 100)
}

export function kodeJadwalAktif(entry: any, kode: string, checklist: any, proses: string): boolean {
  if (!kode || kode.startsWith('__wiring_')) return false
  if (entry?.digeserKe?.[kode]) return false
  return (Number(checklist?.[kode]?.progress?.[proses]) || 0) < 100
}
