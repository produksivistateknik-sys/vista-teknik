// Navigasi tombol "Lihat" di toast Sesi Produksi Stok (2 Okt 2026): App pindah ke tab Database
// (SystemTab), lalu SystemTab -> sub-tab Stok, InventarisWrapper -> tab Produksi Stok, dan panel
// sesi aktif di-scroll ke layar. Komponen-komponen itu bisa belum ter-mount (lazy) saat tombol
// ditekan, jadi permintaan disimpan sebagai flag modul (dibaca saat mount) + event (kalau sudah
// mount). Flag dihapus oleh panel setelah berhasil di-scroll.
export const EVENT_BUKA_SESI_PRODUKSI_STOK = 'vista:buka-sesi-produksi-stok'
let diminta = false
export function mintaBukaSesiProduksiStok() {
  diminta = true
  window.dispatchEvent(new Event(EVENT_BUKA_SESI_PRODUKSI_STOK))
}
export const adaPermintaanBukaSesi = () => diminta
export function selesaiBukaSesi() { diminta = false }
