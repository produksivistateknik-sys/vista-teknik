// HOOK PINDAH BANYAK SEL + UNDO (Tahap 0 migrasi accordion, 9 Okt 2026) - orkestrasi dipindah APA ADANYA
// dari RawSchedule.tsx supaya tampilan lama & accordion baru memakai SATU jalur: validasi (cekPindahMulti)
// -> data pindah (buatSelV2) -> jejak pengerjaan -> tampilan optimistis -> RPC v2 -> kembalikan bila
// gagal -> snapshot Undo. Juga pengaman aksi ganda & status timer BUSBAR (bayangan drag/potong).
//
// Data & fungsi tampilan diambil lewat `ambil()` SAAT AKSI dijalankan (bukan saat render) - jadi selalu
// nilai terbaru, dan boleh merujuk fungsi yang didefinisikan belakangan di komponen pemanggil.
import { useRef } from 'react'
import { markRawDirty, clearRawDirty } from '../lib/globalState'
import { rencanakanPindahMultiV2, type SelPindahV2 } from '../lib/jadwalPindah'
import { muatTimerBusbarAktif, isiPengerjaanAsal, rpcPindahMultiV2, rpcPulihkanMultiV2, type SelAsal, type SelTujuan, type SelBentrok } from '../lib/pindahMulti'

type AksiToast = { label: string; fn: () => void }
export type DepsPindahMulti = {
  rawData: any[]
  user: any
  setRawData: (f: (prev: any[]) => any[]) => void
  refetchRaw?: () => void
  refetchRenhar?: () => void
  tampilToastAksi: (pesan: string, jenis: 'ok' | 'err', aksi?: AksiToast[]) => void
  // Wajib utk jalankanPindahMulti (tampilan lama: pilihan = sel baris proses). Accordion memakai
  // jalankanPindahSel dgn data pindah dari lib/pindahAccordion sehingga tidak perlu keduanya.
  cekPindahMulti?: (cells: SelAsal[], offset: number) => { ikut: SelTujuan[]; bentrok: SelBentrok[]; mingguOk: Set<string> }
  buatSelV2?: (ikut: SelTujuan[]) => { sel: SelPindahV2[]; jadwal: Map<number, any> }
  // Sukses pindah: peta "rawId|tanggalAsal" -> tanggal tujuan (pemanggil menggeser pilihan sel).
  onSesudahPindah?: (pindahan: Map<string, string>) => void
  // Sukses batalkan (pemanggil membersihkan pilihan sel).
  onSesudahBatal?: () => void
}

export function usePindahMulti(ambil: () => DepsPindahMulti) {
  // Snapshot hasil RPC per pemindahan (memori saja - hilang saat reload).
  const undoMultiRef = useRef<any[]>([])
  // Pengaman aksi ganda (8 Okt 2026, review): Ctrl+V / tombol Pindah / Ctrl+Z ditekan 2x cepat dulu
  // menjalankan 2 RPC - yang kedua ditolak server lalu tampilan dikembalikan ke posisi lama (padahal DB
  // sudah pindah), atau undo kedua ikut membuang entri undo sebelumnya. Ref (bukan state) supaya langsung
  // berlaku tanpa menunggu render.
  const sedangPindahRef = useRef(false)
  const sedangBatalkanRef = useRef(false)
  const timerBusbarRef = useRef<Set<string>>(new Set()) // "panelId|kode" yang timer BUSBAR-nya berjalan
  const apiRef = useRef<any>(null)

  // Status timer BUSBAR dimuat 1x saat drag/potong dimulai. Dikosongkan dulu (9 Okt 2026, review): selama
  // muat / bila gagal, jangan pakai daftar aksi sebelumnya (bisa menolak palsu "timer berjalan").
  // Pengecekan pasti tetap di server (RPC v2).
  const muatTimerBusbar = async (cells: SelAsal[]) => {
    const { rawData } = ambil()
    const pids = [...new Set(cells.map(c => rawData.find((r: any) => r.id === c.rawId)).filter((r: any) => r?.proses === 'BUSBAR').map((r: any) => Number(r.panel_id || r.panelId)))]
    timerBusbarRef.current = new Set()
    if (pids.length === 0) return
    const hasil = await muatTimerBusbarAktif(pids)
    if (hasil) timerBusbarRef.current = hasil
  }

  // ── PINDAH BANYAK SEL LEWAT RPC (8 Okt 2026) - 1 panggilan pindah_multi_sel_v2: jadwal baru dihitung
  // dgn helper yang SAMA dgn drag 1 sel (lib/jadwalPindah.ts), renhar dipindah di server, semua 1
  // transaksi. Server menolak kalau jadwal di DB sudah berubah sejak layar dimuat. Gagal -> tampilan
  // dikembalikan + toast merah dgn tombol Ulangi. Sukses -> snapshot disimpan utk Undo.
  const jalankanPindahMulti = async (cells: SelAsal[], offset: number) => {
    if (sedangPindahRef.current || sedangBatalkanRef.current) { ambil().tampilToastAksi('Masih memproses pemindahan sebelumnya - tunggu sebentar.', 'err'); return false }
    sedangPindahRef.current = true
    try { return await jalankanPindahMultiInti(cells, offset) } finally { sedangPindahRef.current = false }
  }
  const jalankanPindahMultiInti = async (cells: SelAsal[], offset: number) => {
    const d = ambil()
    if (!d.cekPindahMulti || !d.buatSelV2) throw new Error('usePindahMulti: cekPindahMulti/buatSelV2 wajib utk jalankanPindahMulti')
    const { ikut, bentrok } = d.cekPindahMulti(cells, offset)
    if (bentrok.length > 0) {
      d.tampilToastAksi(`Dibatalkan: ${bentrok.length} sel tidak bisa mendarat (${[...new Set(bentrok.map(b => b.alasan))].join(', ')}). Tidak ada yang dipindah.`, 'err')
      return false
    }
    const { sel, jadwal } = d.buatSelV2(ikut)
    if (sel.length === 0) { d.tampilToastAksi('Tidak ada pekerjaan yang bisa dipindah di sel terpilih.', 'err'); return false }
    return intiPindah(sel, jadwal, {
      jumlah: `${sel.length} sel`, offset,
      ulangi: () => apiRef.current.jalankanPindahMulti(cells, offset),
      onSukses: () => d.onSesudahPindah?.(new Map(sel.map(s => [s.rawId + '|' + s.dari, s.ke]))),
    })
  }

  // INTI pindah (dipakai tampilan lama via jalankanPindahMulti & accordion via jalankanPindahSel): jejak
  // pengerjaan -> tampilan optimistis -> RPC v2 -> kembalikan bila gagal -> snapshot Undo. `jumlah` = teks
  // satuan di pesan ("3 sel" / "4 komponen"), `ulangi` = aksi tombol Ulangi.
  type OpsiInti = { jumlah: string; offset: number; ulangi: () => void; onSukses?: () => void }
  const intiPindah = async (sel: SelPindahV2[], jadwal: Map<number, any>, o: OpsiInti) => {
    const d = ambil()
    const offset = o.offset
    // Jejak digeserKe = kode yg ADA pengerjaan (timer) di tanggal asal - 1 query utk semua sel.
    const { error: errPengerjaan } = await isiPengerjaanAsal(d.rawData, sel)
    if (errPengerjaan) {
      d.tampilToastAksi('Gagal memeriksa data pengerjaan (koneksi?). Tidak ada yang dipindah.', 'err', [{ label: 'Ulangi', fn: o.ulangi }])
      return false
    }
    const rencana = rencanakanPindahMultiV2(jadwal, sel, new Date().toISOString())
    const sesudahById = new Map(rencana.rows.map(r => [r.raw_id, r]))
    rencana.rows.forEach(r => markRawDirty(r.raw_id))
    // 4 kolom (schedule + busbar_schedule/jejak/manual_pin) - RPC v2 (migration 20261009010000).
    d.setRawData((prev: any[]) => prev.map((r: any) => sesudahById.has(r.id) ? { ...r, ...sesudahById.get(r.id)!.sesudah } : r))
    const uname = d.user?.name || d.user?.nama || 'Admin'
    const { data, error } = await rpcPindahMultiV2(rencana, uname)
    rencana.rows.forEach(r => clearRawDirty(r.raw_id))
    if (error) {
      console.error('[Pindah banyak sel] gagal:', error)
      d.setRawData((prev: any[]) => prev.map((r: any) => sesudahById.has(r.id) ? { ...r, ...sesudahById.get(r.id)!.sebelum } : r))
      const kode = typeof error.code === 'string' && error.code.trim() ? error.code : ''
      // Gagal koneksi bisa berarti server SUDAH menyimpan tapi responsnya putus -> muat ulang dari server
      // supaya layar menunjukkan keadaan DB yang sebenarnya (bukan tebakan "pasti gagal").
      if (kode !== 'P0001') { d.refetchRaw?.(); d.refetchRenhar?.() }
      d.tampilToastAksi((kode === 'P0001' ? error.message : `Gagal menyimpan pindah ${o.jumlah} (${kode ? 'server: ' + error.message : 'koneksi lambat/putus'}). Jadwal dimuat ulang dari server - cek posisinya sebelum mengulang.`), 'err',
        kode === 'P0001' ? undefined : [{ label: 'Ulangi', fn: o.ulangi }])
      return false
    }
    d.refetchRenhar?.()
    undoMultiRef.current.push({ snap: data, label: `${o.jumlah} ${offset > 0 ? '+' : ''}${offset} hari` })
    o.onSukses?.()
    d.tampilToastAksi(`${o.jumlah} dipindah ${offset > 0 ? '+' : ''}${offset} hari.`, 'ok', [{ label: 'Batalkan', fn: () => apiRef.current.batalkanPindahTerakhir() }])
    return true
  }

  // Pindah dgn data pindah yang sudah disusun & divalidasi pemanggil (accordion: satuan komponen/WP).
  // Pengaman aksi ganda sama dgn jalankanPindahMulti.
  const jalankanPindahSel = async (sel: SelPindahV2[], jadwal: Map<number, any>, o: OpsiInti) => {
    if (sedangPindahRef.current || sedangBatalkanRef.current) { ambil().tampilToastAksi('Masih memproses pemindahan sebelumnya - tunggu sebentar.', 'err'); return false }
    if (sel.length === 0) { ambil().tampilToastAksi('Tidak ada pekerjaan yang bisa dipindah di pilihan ini.', 'err'); return false }
    sedangPindahRef.current = true
    try { return await intiPindah(sel, jadwal, o) } finally { sedangPindahRef.current = false }
  }

  // Undo = MEMULIHKAN keadaan persis sebelum pindah lewat pulihkan_multi_sel_v2 (bukan pindah balik, yang
  // akan menambah jejak baru). Server menolak kalau data sudah berubah lagi sejak dipindah.
  const batalkanPindahTerakhir = async () => {
    const st = undoMultiRef.current
    if (st.length === 0 || sedangBatalkanRef.current || sedangPindahRef.current) return
    const entri = st[st.length - 1]
    const d = ambil()
    sedangBatalkanRef.current = true
    let error: any = null
    try { ({ error } = await rpcPulihkanMultiV2(entri.snap, d.user?.name || d.user?.nama || 'Admin')) }
    finally { sedangBatalkanRef.current = false }
    if (error) {
      console.error('[Batalkan pindah banyak sel] gagal:', error)
      const ditolak = typeof error.code === 'string' && error.code === 'P0001'
      if (ditolak) st.pop() // data sudah berubah lagi - tidak bisa dibatalkan, jangan ditawarkan lagi
      else { d.refetchRaw?.(); d.refetchRenhar?.() } // respons putus: tampilkan keadaan server yang sebenarnya
      d.tampilToastAksi(ditolak ? error.message : `Gagal membatalkan (koneksi lambat/putus). Pemindahan BELUM dibatalkan.`, 'err',
        ditolak ? undefined : [{ label: 'Ulangi', fn: () => apiRef.current.batalkanPindahTerakhir() }])
      return
    }
    st.pop()
    const sebelum = new Map<number, any>((entri.snap?.raw || []).map((r: any) => [Number(r.raw_id), r.sebelum]))
    d.setRawData((prev: any[]) => prev.map((r: any) => sebelum.has(r.id) ? { ...r, ...sebelum.get(r.id) } : r)) // 4 kolom (v2)
    d.refetchRenhar?.()
    d.onSesudahBatal?.()
    d.tampilToastAksi(`Pemindahan ${entri.label} dibatalkan - jadwal & rencana harian kembali seperti semula.`, 'ok')
  }

  const api = { jalankanPindahMulti, jalankanPindahSel, batalkanPindahTerakhir, muatTimerBusbar, timerBusbarRef, undoMultiRef, sedangPindahRef, sedangBatalkanRef }
  apiRef.current = api
  return api
}
