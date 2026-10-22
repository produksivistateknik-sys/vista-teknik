// KENDALA PRODUKSI (23 Okt 2026) - SATU sumber logika tab Kendala: vista-pekerja (operator mencatat) & vista-teknik
// (Admin Produksi: rekap, Teratasi, hapus). File ini IDENTIK di kedua repo (src/lib/kendalaProduksi.ts) - ubah keduanya
// bersamaan. Tidak mengimpor klien Supabase: pemanggil memberi `db` (klien supabase repo masing-masing).
// Tabel kendala_produksi hanya bisa DIBACA langsung; tulis lewat RPC (catat/ubah/hapus/teratasi/batal) yang mencatat
// jejak awet di kendala_produksi_log. Aturan (konvensi aplikasi, dicek ulang server):
//  - hari/tanggal/jam/pencatat otomatis; pencatat boleh ubah/hapus miliknya di hari yang sama (WIB), lalu terkunci;
//  - hanya Admin Produksi menandai SELESAI / membuka kembali / mengubah & menghapus kapan saja (kendala belum selesai);
//    istilah di layar "Selesai" (23 Okt 2026), kolom DB tetap teratasi_pada/teratasi_oleh;
//  - Project = NAMA proyek (gabungan WO); panel kosong = "Umum".
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Kendala = {
  id: number; proyek: string; wo_id: number | null; wo_number: string | null
  panel_id: number | null; panel_nama: string | null; teks: string
  pencatat: string; divisi: string | null; sumber: 'operator' | 'admin' | 'migrasi'
  dicatat_pada: string; tanggal: string; diubah_pada: string | null
  teratasi_pada: string | null; teratasi_oleh: string | null
  dihapus_pada: string | null; dihapus_oleh: string | null
  grup_id?: string | null // baris yang dicatat bersamaan di banyak panel (migration 20261023050000)
}
export type PanelProyek = { id: number; nama: string; no_pnl: number | null; wo: string; wo_id: number }
export type ProyekAktif = { proyek: string; wo: string[]; panels: PanelProyek[] }

const HALAMAN = 1000
async function bacaSemua(build: (dari: number, sampai: number) => any): Promise<any[]> {
  const semua: any[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await build(dari, dari + HALAMAN - 1)
    if (error) throw error
    semua.push(...(data || []))
    if (!data || data.length < HALAMAN) return semua
  }
}

// ---- tampilan waktu (WIB) ----
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bagianWib = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3) // WIB = UTC+7 (tanpa DST)
  return { th: d.getUTCFullYear(), bl: d.getUTCMonth(), tg: d.getUTCDate(), hr: d.getUTCDay(), jam: d.getUTCHours(), mnt: d.getUTCMinutes() }
}
export const tanggalHariIniWib = (): string => { const b = bagianWib(new Date().toISOString()); return `${b.th}-${String(b.bl + 1).padStart(2, '0')}-${String(b.tg).padStart(2, '0')}` }
// "Kamis, 23 Oktober 2026" dari tanggal "YYYY-MM-DD"
export function fmtTanggalPanjang(tgl: string): string {
  const [y, m, d] = tgl.split('-').map(Number)
  const hr = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${HARI[hr]}, ${d} ${BULAN[m - 1]} ${y}`
}
export const fmtTanggalDariWaktu = (iso: string) => { const b = bagianWib(iso); return `${HARI[b.hr]}, ${b.tg} ${BULAN[b.bl]} ${b.th}` }
export const jamWib = (iso: string) => { const b = bagianWib(iso); return `${String(b.jam).padStart(2, '0')}.${String(b.mnt).padStart(2, '0')}` }
const BULAN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
// "Kamis, 23 Okt" (tampilan ringkas, sama dgn artifact admin)
export function fmtTanggalPendek(tgl: string): string {
  const [y, m, d] = tgl.split('-').map(Number)
  return `${HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${BULAN3[m - 1]}`
}
export const fmtPendekDariWaktu = (iso: string) => { const b = bagianWib(iso); return `${HARI[b.hr]}, ${b.tg} ${BULAN3[b.bl]}` }
// "Selesai Kamis, 23 Okt, 15.10 oleh LUTVAN"
export const teksSelesai = (k: Kendala) => k.teratasi_pada ? `Selesai ${fmtPendekDariWaktu(k.teratasi_pada)}, ${jamWib(k.teratasi_pada)} oleh ${k.teratasi_oleh || '-'}` : ''
export const teksTeratasi = teksSelesai // nama lama (Arsip Gantt)
// Alasan otomatis saat admin mengklik lagi lingkaran centang (keputusan user 23 Okt 2026).
export const ALASAN_BUKA_KEMBALI = 'dibuka kembali (klik centang)'
export const LABEL_AKSI_LOG: Record<string, string> = {
  catat: 'Dicatat', ubah: 'Diubah', hapus: 'Dihapus', teratasi: 'Ditandai selesai', batal_teratasi: 'Dibuka kembali', migrasi: 'Dipindah dari catatan lama',
}

const LABEL_DIVISI: Record<string, string> = {
  mekanik: 'Mekanik', painting: 'Painting', assembling: 'Assembling', wiring_ctrl: 'Wiring Control', wiring_pwr: 'Wiring Power',
  qc: 'QC', nameplate: 'Nameplate', komponen: 'Komponen', admin: 'Admin Produksi',
}
export const labelDivisi = (d: string | null | undefined) => (d && LABEL_DIVISI[d]) || d || '-'

// ---- aturan ----
export const terbuka = (k: Kendala) => !k.teratasi_pada && !k.dihapus_pada
// Pencatat boleh ubah/hapus miliknya di hari yang sama (WIB) & belum teratasi (server memeriksa ulang).
export const bolehUbahSendiri = (k: Kendala, nama: string, hariIni = tanggalHariIniWib()) =>
  !k.dihapus_pada && !k.teratasi_pada && k.sumber !== 'migrasi' && k.pencatat === nama && k.tanggal === hariIni
export const kunciPanel = (proyek: string, panelId: number | null) => `${proyek}|${panelId ?? 'umum'}`

// Riwayat satu panel: dikelompokkan per tanggal, terbaru di atas.
export function kelompokPerTanggal(list: Kendala[]): { tanggal: string; entri: Kendala[] }[] {
  const urut = [...list].sort((a, b) => (b.dicatat_pada || '').localeCompare(a.dicatat_pada || '') || b.id - a.id)
  const out: { tanggal: string; entri: Kendala[] }[] = []
  for (const k of urut) {
    const g = out[out.length - 1]
    if (g && g.tanggal === k.tanggal) g.entri.push(k); else out.push({ tanggal: k.tanggal, entri: [k] })
  }
  return out
}
// Ringkasan per panel/Umum: total (tidak terhapus) & belum teratasi.
export function ringkasPerPanel(list: Kendala[]): Map<string, { total: number; terbuka: number }> {
  const m = new Map<string, { total: number; terbuka: number }>()
  for (const k of list) {
    if (k.dihapus_pada) continue
    const key = kunciPanel(k.proyek, k.panel_id)
    const r = m.get(key) || { total: 0, terbuka: 0 }
    r.total++; if (terbuka(k)) r.terbuka++
    m.set(key, r)
  }
  return m
}

// ---- baca ----
// Proyek aktif (WO belum dihapus & belum diarsip) beserta panel aktifnya, dikelompokkan per NAMA proyek.
export async function muatProyekAktif(db: any): Promise<ProyekAktif[]> {
  const wos = await bacaSemua((dari, sampai) => db.from('work_orders')
    .select('id,wo,proyek,is_archived,deleted_at,panels(id,nama,no_pnl,deleted_at)')
    .is('deleted_at', null).order('id').range(dari, sampai))
  const per = new Map<string, ProyekAktif>()
  for (const w of wos) {
    if (w.is_archived || !w.proyek) continue
    const p: ProyekAktif = per.get(w.proyek) || { proyek: w.proyek, wo: [], panels: [] }
    if (!p.wo.includes(w.wo)) p.wo.push(w.wo)
    for (const pn of w.panels || []) if (!pn.deleted_at) p.panels.push({ id: pn.id, nama: pn.nama, no_pnl: pn.no_pnl ?? null, wo: w.wo, wo_id: w.id })
    per.set(w.proyek, p)
  }
  const hasil = [...per.values()]
  hasil.forEach(p => p.panels.sort((a, b) => (a.no_pnl ?? 9999) - (b.no_pnl ?? 9999) || a.nama.localeCompare(b.nama)))
  return hasil.sort((a, b) => a.proyek.localeCompare(b.proyek))
}
// Kendala tidak terhapus. `proyek` diisi = hanya proyek itu; `panelId` (null = Umum) mempersempit ke satu panel.
export async function muatKendala(db: any, saring: { proyek?: string[]; panel?: { proyek: string; panelId: number | null }; hanyaTerbuka?: boolean } = {}): Promise<Kendala[]> {
  return bacaSemua((dari, sampai) => {
    let q = db.from('kendala_produksi').select('*').is('dihapus_pada', null)
    if (saring.proyek) q = q.in('proyek', saring.proyek.length ? saring.proyek : ['\u0000'])
    if (saring.panel) { q = q.eq('proyek', saring.panel.proyek); q = saring.panel.panelId == null ? q.is('panel_id', null) : q.eq('panel_id', saring.panel.panelId) }
    if (saring.hanyaTerbuka) q = q.is('teratasi_pada', null)
    return q.order('id', { ascending: false }).range(dari, sampai)
  })
}
// Untuk Laporan Outstanding (nanti): kendala BELUM teratasi, per proyek > panel (Umum = panel_id null).
export const ambilKendalaTerbuka = (db: any) => muatKendala(db, { hanyaTerbuka: true })
export async function muatLogKendala(db: any, kendalaId: number): Promise<any[]> {
  return bacaSemua((dari, sampai) => db.from('kendala_produksi_log').select('id,aksi,oleh,alasan,waktu').eq('kendala_id', kendalaId).order('id').range(dari, sampai))
}

// ---- tulis (RPC) - error dilempar dgn pesan server ----
async function rpc(db: any, nama: string, arg: Record<string, any>): Promise<Kendala> {
  const { data, error } = await db.rpc(nama, arg)
  if (error) throw new Error(error.message || String(error))
  return data as Kendala
}
// Tombol siap pakai "Kendalanya apa?" (operator) - OPSIONAL, ubah daftarnya di sini saja (keputusan user 23 Okt 2026).
export const JENIS_KENDALA = ['Komponen kurang', 'Menunggu gambar', 'Menunggu material', 'Alat rusak', 'Ada revisi', 'Menunggu proses lain', 'Lainnya']
// Teks tersimpan: "[Jenis]: [keterangan]" bila jenis dipilih (kecuali "Lainnya"), atau keterangan saja.
export const susunTeksKendala = (jenis: string | null | undefined, keterangan: string) => {
  const k = keterangan.trim()
  return jenis && jenis !== 'Lainnya' ? `${jenis}: ${k}` : k
}
// Catat ke BANYAK panel sekaligus (panelIds kosong = "Umum") - satu RPC = satu transaksi: semua tersimpan atau tidak.
export async function catatKendalaBanyak(db: any, a: { proyek: string; panelIds: number[]; teks: string; oleh: string; divisi: string; admin?: boolean }): Promise<Kendala[]> {
  const { data, error } = await db.rpc('catat_kendala_banyak', { p_proyek: a.proyek, p_panel_ids: a.panelIds, p_teks: a.teks, p_oleh: a.oleh, p_divisi: a.divisi, p_sumber: a.admin ? 'admin' : 'operator' })
  if (error) throw new Error(error.message || String(error))
  return (data || []) as Kendala[]
}
export const catatKendala = (db: any, a: { proyek: string; panelId: number | null; teks: string; oleh: string; divisi: string; admin?: boolean }) =>
  rpc(db, 'catat_kendala', { p_proyek: a.proyek, p_panel_id: a.panelId, p_teks: a.teks, p_oleh: a.oleh, p_divisi: a.divisi, p_sumber: a.admin ? 'admin' : 'operator' })
// Admin (p_admin) boleh mengubah kendala siapa pun yang belum selesai - butuh migration 20261023040000. Operator: 3 parameter.
export const ubahKendala = (db: any, id: number, teks: string, oleh: string, admin = false) =>
  rpc(db, 'ubah_kendala', admin ? { p_id: id, p_teks: teks, p_oleh: oleh, p_admin: true } : { p_id: id, p_teks: teks, p_oleh: oleh })
export const hapusKendala = (db: any, id: number, oleh: string, admin = false, alasan: string | null = null) =>
  rpc(db, 'hapus_kendala', { p_id: id, p_oleh: oleh, p_admin: admin, p_alasan: alasan })
export const tandaiTeratasi = (db: any, id: number, oleh: string) => rpc(db, 'tandai_kendala_teratasi', { p_id: id, p_oleh: oleh })
export const batalTeratasi = (db: any, id: number, oleh: string, alasan: string = ALASAN_BUKA_KEMBALI) => rpc(db, 'batal_kendala_teratasi', { p_id: id, p_oleh: oleh, p_alasan: alasan })
