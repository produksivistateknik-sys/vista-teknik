import { supabase as supabaseTyped } from '../lib/supabase'

// Tabel komponen_stok_transaksi & RPC catat_transaksi_stok belum ada di src/types/supabase-generated.ts
// (dibuat lewat migration 20261002010000, tim apply skema manual) - pakai client tanpa tipe di
// file ini. Setelah migration jalan & tipe di-generate ulang, cast ini boleh dihapus.
const supabase: any = supabaseTyped

// STOK KOMPONEN - SATU sumber baca/tulis (2 Okt 2026, fondasi sebelum fitur Produksi Stok).
// Dipakai KomponenStokTab (Inventaris, tempat ubah stok) & StokMonitoringTab (menu "Stok
// Komponen", read-only) - dulu masing2 query sendiri + hitung keluar dari regex teks
// activity_log (0 baris kebaca di data nyata). Sekarang:
// - SEMUA perubahan stok lewat RPC catat_transaksi_stok (atomik di DB: kunci baris, cek stok,
//   update stok, catat transaksi). Trigger DB nangkep perubahan di luar RPC sbg 'koreksi'.
// - Riwayat masuk/keluar dibaca dari komponen_stok_transaksi (bukan komponen_stok_masuk lama /
//   activity_log), lalu dipetakan ke bentuk yang SAMA PERSIS dgn yang dipakai tampilan lama.
// Lihat supabase/migrations/20261002010000_komponen_stok_transaksi.sql.

export type TipeTransaksiStok = 'masuk' | 'keluar' | 'koreksi'
export type SumberTransaksiStok = 'manual' | 'otomatis_produksi' | 'koreksi_manual'

async function ambilSemua(tabel: string, urut: { kolom: string; naik: boolean }[]) {
  let semua: any[] = []
  for (let from = 0; ; from += 1000) {
    let q: any = supabase.from(tabel).select('*')
    urut.forEach((u) => { q = q.order(u.kolom, { ascending: u.naik }) })
    const { data, error } = await q.range(from, from + 999)
    if (error) throw new Error(`baca ${tabel}: ${error.message}`)
    semua = semua.concat(data || [])
    if (!data || data.length < 1000) break
  }
  return semua
}

export const stokTransaksiService = {
  async ambilStok() {
    return ambilSemua('komponen_stok', [{ kolom: 'nama', naik: true }])
  },

  async ambilTransaksi() {
    return ambilSemua('komponen_stok_transaksi', [{ kolom: 'tanggal', naik: false }, { kolom: 'id', naik: false }])
  },

  // p_jumlah: masuk/keluar = jumlah (>0); koreksi = STOK TARGET (angka baru). Return baris
  // transaksi, atau null kalau koreksi tanpa perubahan (no-op di DB).
  async catat(p: {
    komponenId: number; tipe: TipeTransaksiStok; jumlah: number; sumber?: SumberTransaksiStok
    keterangan?: string | null; referensi?: string | null; panel?: string | null; createdBy: string; tanggal?: string
  }) {
    const { data, error } = await supabase.rpc('catat_transaksi_stok', {
      p_komponen_id: p.komponenId, p_tipe: p.tipe, p_jumlah: p.jumlah,
      p_sumber: p.sumber || (p.tipe === 'koreksi' ? 'koreksi_manual' : 'manual'),
      p_keterangan: p.keterangan ?? null, p_referensi: p.referensi ?? null, p_created_by: p.createdBy,
      p_tanggal: p.tanggal || null, p_panel: p.panel ?? null,
    })
    if (error) throw new Error(error.message)
    const row: any = Array.isArray(data) ? data[0] : data
    return row && row.id != null ? row : null
  },
}

// Pemetaan ke bentuk yang dipakai tampilan lama (biar UI gak berubah):
// - "masuk"  : {id, komponen_id, nama, jumlah, tanggal, keterangan, created_by} (= baris komponen_stok_masuk)
// - "keluar" : {id, komponen_id, nama, kode, jumlah, tanggal, proyek, panel, keterangan, created_by}
// Transaksi 'koreksi' (edit angka langsung, saldo awal migrasi) SENGAJA gak masuk keduanya -
// sama kayak dulu, edit angka stok gak pernah muncul di riwayat masuk/keluar.
export function transaksiMasuk(transaksi: any[], stokList: any[]) {
  return transaksi.filter((t) => t.tipe === 'masuk').map((t) => ({
    id: t.id, komponen_id: t.komponen_id, nama: stokList.find((s) => s.id === t.komponen_id)?.nama || '-',
    jumlah: t.jumlah, tanggal: t.tanggal, keterangan: t.keterangan, created_by: t.created_by,
  }))
}
export function transaksiKeluar(transaksi: any[], stokList: any[]) {
  return transaksi.filter((t) => t.tipe === 'keluar').map((t) => {
    const s = stokList.find((x) => x.id === t.komponen_id)
    return {
      id: t.id, komponen_id: t.komponen_id, nama: s?.nama || '-', kode: s?.kode || '-',
      jumlah: t.jumlah, tanggal: t.tanggal, proyek: t.referensi, panel: t.panel,
      keterangan: t.keterangan, created_by: t.created_by,
    }
  })
}
