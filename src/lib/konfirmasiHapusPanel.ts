// KONFIRMASI HAPUS PANEL sebelum simpan Edit WO (10 Okt 2026, insiden WO 076 panel 521).
// Panel existing yang TIDAK ada di form akan dihapus permanen saat simpan (savePanels/saveWOWithSplit). Dipanggil
// form Manajemen WO & WO Digital SEBELUM apa pun disimpan:
//  - panel masih punya permintaan barang -> simpan DIBATALKAN (keputusan user), tidak ada yang disimpan.
//  - selain itu -> tampilkan jadwal / rencana harian / progres yang ikut terhapus, minta konfirmasi.
// true = boleh lanjut simpan.
import { workOrderService } from '../services/workOrderService'

export async function konfirmasiHapusPanel(woId: number, idPanelDiForm: number[]): Promise<boolean> {
  let dampak: Awaited<ReturnType<typeof workOrderService.cekDampakHapusPanel>>
  try {
    const ids = await workOrderService.panelAkanDihapus(woId, idPanelDiForm)
    if (ids.length === 0) return true
    dampak = await workOrderService.cekDampakHapusPanel(ids)
  } catch (err: any) {
    console.error('[Edit WO] gagal cek panel yang akan dihapus:', err)
    alert('Simpan DIBATALKAN - gagal memeriksa panel yang akan terhapus (koneksi?).\n\n' + (err?.message || err) + '\n\nTidak ada yang disimpan. Coba lagi.')
    return false
  }
  const baris = (d: (typeof dampak)[number]) =>
    `• ${d.nama} — jadwal ${d.jadwal} baris (${d.tanggalTerisi} tanggal terisi), rencana harian ${d.renhar}, komponen berprogres ${d.komponenBerprogres}` +
    (d.permintaan ? `, PERMINTAAN BARANG ${d.permintaan}` : '')
  const tolak = dampak.filter(d => d.permintaan > 0)
  if (tolak.length > 0) {
    alert('Simpan DIBATALKAN - panel berikut tidak ada di form (akan terhapus), tapi masih punya PERMINTAAN BARANG sehingga TIDAK BOLEH dihapus:\n\n' +
      tolak.map(baris).join('\n') +
      '\n\nKembalikan panel tersebut di form (jangan hapus barisnya / jangan kosongkan namanya), lalu simpan lagi. Tidak ada yang disimpan.')
    return false
  }
  return window.confirm('PERHATIAN: panel berikut TIDAK ADA di form dan akan DIHAPUS PERMANEN beserta jadwal, rencana harian, riwayat timer & checkpoint-nya:\n\n' +
    dampak.map(baris).join('\n') +
    '\n\nBatal = tidak ada yang disimpan. Lanjutkan simpan & hapus panel di atas?')
}
