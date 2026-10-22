// PEMULIH REALTIME (23 Okt 2026) - SATU pola langganan data yang tahan koneksi realtime putus diam-diam (tab dibiarkan lama
// terbuka, laptop sleep/wake, wifi putus-nyambung). Asal: bug A Rencana Harian (kolom Operator beku krn hanya realtime).
// Isi: (1) event postgres_changes tabel -> muat ulang (event beruntun digabung `jedaMs`), (2) kanal tersambung ULANG setelah
// putus -> muat ulang (event selama putus terlewat), (3) tab kembali aktif / perangkat online lagi -> muat ulang,
// (4) polling cadangan tiap `pollingMs` saat tab terlihat - independen dari sehat-tidaknya realtime.
// Dipakai hooks/useTimerHariRencana, hooks/useKendalaTerbuka, components/KendalaAdmin. Loader lain yang masih hanya-realtime
// dicatat sbg pekerjaan lanjutan (urutan risiko: Raw Schedule timer & kapasitas, TrackingPekerja, PermintaanAdminTab, ...).
// `db` = klien Supabase (disuntikkan - bisa diuji dgn klien tiruan). Mengembalikan fungsi pembersih (panggil di cleanup effect).
export function pasangPemulihRealtime(db: any, o: {
  nama: string                 // nama kanal (unik per langganan)
  tabel: string | string[]     // tabel public yang didengar
  muat: () => void             // fungsi muat ulang data (wajib aman dipanggil berulang)
  jedaMs?: number              // gabungkan event beruntun (bawaan 1500 ms)
  pollingMs?: number           // polling cadangan (bawaan 30000 ms); 0 = tanpa polling
  label?: string               // utk console.warn status realtime
}): () => void {
  const jeda = o.jedaMs ?? 1500, polling = o.pollingMs ?? 30000
  let tunda: ReturnType<typeof setTimeout> | null = null
  const panggil = () => { if (tunda) clearTimeout(tunda); tunda = setTimeout(() => { tunda = null; o.muat() }, jeda) }
  let pernahTersambung = false
  let ch = db.channel(o.nama)
  for (const t of Array.isArray(o.tabel) ? o.tabel : [o.tabel]) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, panggil)
  ch = ch.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') { if (pernahTersambung) o.muat(); pernahTersambung = true }
    else if (status !== 'CLOSED') console.warn(`[realtime ${o.label || o.nama}]`, status)
  })
  const segarkan = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') o.muat() }
  const iv = polling > 0 ? setInterval(segarkan, polling) : null
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', segarkan)
  if (typeof window !== 'undefined') window.addEventListener('online', segarkan)
  return () => {
    if (tunda) clearTimeout(tunda)
    if (iv) clearInterval(iv)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', segarkan)
    if (typeof window !== 'undefined') window.removeEventListener('online', segarkan)
    db.removeChannel(ch)
  }
}
