// Foto dokumentasi Pasang Komponen sebuah panel (12 Okt 2026, laporan user: foto "Tambah Foto" per komponen
// di Vista Pekerja tidak muncul di Quality Center, contoh WO 053 PP-ATAP).
// Operator bisa menyimpan foto di DUA tempat: galeri panel (panels.pasang_komponen_photos) dan galeri per
// komponen (checklist[kode].fotoPemasangan). Gabungan keduanya, dedupe by url (galeri panel dulu, lalu per
// komponen sesuai urutan checklist). Foto per komponen diberi _kode supaya jelas milik komponen mana.
export function fotoPasangKomponen(panel: any): any[] {
  const seen = new Set<string>()
  const out: any[] = []
  for (const f of (panel?.pasang_komponen_photos || [])) {
    if (f?.url && !seen.has(f.url)) { seen.add(f.url); out.push(f) }
  }
  for (const [kode, cl] of Object.entries(panel?.checklist || {})) {
    for (const f of ((cl as any)?.fotoPemasangan || [])) {
      if (f?.url && !seen.has(f.url)) { seen.add(f.url); out.push({ ...f, _kode: kode }) }
    }
  }
  return out
}
