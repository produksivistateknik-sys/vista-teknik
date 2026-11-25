// KOREKSI PROGRES ADMIN (22 Okt 2026, keputusan user) - satu-satunya jalur yang boleh melewati kunci urutan progres
// (trigger panels_validate_urutan_progres). Lewat RPC koreksi_progres_admin: alasan wajib, checklist + CCP ikut,
// jejak AWET di tabel koreksi_progres_log (bukan hanya activity_log yang retensinya ~1 minggu).
// Hanya ditampilkan utk divisi 'admin' (Admin Produksi). CATATAN: ini KONTROL APLIKASI, bukan pengaman keras -
// tanpa Supabase Auth, RPC bisa dipanggil siapa pun yang memegang anon key; yang terjamin adalah jejaknya.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { hariKerjaWib } from '../lib/tanggalWib'
import { Modal, Btn, Lbl, Inp } from './ui/Primitives'

export const PROSES_BISA_DIKOREKSI = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING', 'RAKIT']
// (25 Nov 2026, Tahap 4.1) BUKA KEMBALI WIRING - proses mode PERSEN (tanpa qtyProses). RPC yang sama
// (koreksi_progres_admin, migration 20261125020000): p_qty dibaca sbg persen baru 0..99, alasan wajib diawali
// "Salah progres"/"Revisi pekerjaan". Riwayat lama & durasi timer tidak disentuh; jadwal TIDAK diubah otomatis.
export const PROSES_KOREKSI_PERSEN = ['WIRING CONTROL', 'WIRING POWER']
const JENIS_ALASAN_PERSEN = ['Salah progres', 'Revisi pekerjaan']

type Sasaran = { panelId: number; panelNama: string; kode: string; nama: string; proses: string; qtyKomponen: number; qtySekarang: number; pctSekarang: number }

export function useKoreksiProgres(user: any) {
  const bolehKoreksi = user?.divisi === 'admin'
  const [sasaran, setSasaran] = useState<Sasaran | null>(null)
  const [qty, setQty] = useState('')
  const [alasan, setAlasan] = useState('')
  const [jenisAlasan, setJenisAlasan] = useState('')
  const [riwayat, setRiwayat] = useState<any[] | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  const buka = async (s: Sasaran) => {
    if (!bolehKoreksi) return
    const persen = PROSES_KOREKSI_PERSEN.includes(s.proses)
    setSasaran(s); setQty(persen ? '' : String(s.qtySekarang)); setAlasan(''); setJenisAlasan(''); setRiwayat(null)
    const { data, error } = await (supabase as any).from('koreksi_progres_log').select('waktu,proses,qty_lama,qty_baru,pct_lama,pct_baru,alasan,oleh')
      .eq('panel_id', s.panelId).eq('kode_komponen', s.kode).order('waktu', { ascending: false }).order('id', { ascending: false }).range(0, 49)
    if (error) { console.error('[koreksi progres] gagal baca riwayat:', error); setRiwayat([]); return }
    setRiwayat(data || [])
  }

  const simpan = async () => {
    if (!sasaran) return
    const persen = PROSES_KOREKSI_PERSEN.includes(sasaran.proses)
    const n = Number(qty)
    let alasanKirim = alasan.trim()
    if (persen) {
      if (qty.trim() === '' || !Number.isInteger(n) || n < 0 || n > 99) { alert('Persen baru harus bilangan bulat 0 sampai 99.'); return }
      if (!JENIS_ALASAN_PERSEN.includes(jenisAlasan)) { alert('Pilih alasan: Salah progres atau Revisi pekerjaan.'); return }
      alasanKirim = alasanKirim ? `${jenisAlasan}: ${alasanKirim}` : jenisAlasan
      const kata = sasaran.pctSekarang >= 100 ? 'Buka kembali' : 'Koreksi'
      if (!confirm(`${kata} ${sasaran.proses} ${sasaran.nama} (${sasaran.kode}) - ${sasaran.panelNama}\n${sasaran.pctSekarang}% -> ${n}%\nAlasan: ${alasanKirim}\n\nRiwayat lama & durasi timer tidak dihapus. Dicatat permanen. Lanjutkan?`)) return
    } else {
      if (!Number.isInteger(n) || n < 0 || n > sasaran.qtyKomponen) { alert(`Qty harus bilangan bulat 0 sampai ${sasaran.qtyKomponen}.`); return }
      if (alasanKirim.length < 5) { alert('Alasan koreksi wajib diisi (minimal 5 huruf).'); return }
      if (!confirm(`Koreksi ${sasaran.proses} ${sasaran.nama} (${sasaran.kode}) - ${sasaran.panelNama}\n${sasaran.qtySekarang}/${sasaran.qtyKomponen} -> ${n}/${sasaran.qtyKomponen}\n\nKoreksi ini melewati kunci urutan proses dan dicatat permanen. Lanjutkan?`)) return
    }
    setMenyimpan(true)
    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    const { error } = await (supabase as any).rpc('koreksi_progres_admin', {
      p_panel_id: sasaran.panelId, p_kode: sasaran.kode, p_proses: sasaran.proses, p_qty: n,
      p_alasan: alasanKirim, p_oleh: user?.name || user?.nama || sess?.nama || 'Admin', p_divisi: user?.divisi || '',
      // WIRING: tanggal = HARI KERJA WIB (00.00-06.59 = kemarin), sama dgn tanggal kartu HP. Mekanik tetap default server.
      ...(persen ? { p_tanggal: hariKerjaWib() } : {}),
    })
    setMenyimpan(false)
    if (error) { console.error('[koreksi progres] gagal:', error); alert('Koreksi gagal disimpan: ' + error.message); return }
    if (persen) alert(`Tersimpan: ${sasaran.proses} ${sasaran.kode} = ${n}%.\n\nPENGINGAT: komponen WIRING yang sudah 100% dibersihkan dari jadwal. Agar muncul lagi di HP operator, jadwalkan ulang di Raw Schedule lalu rilis Rencana Harian.`)
    else alert(`Koreksi tersimpan: ${sasaran.proses} ${sasaran.kode} = ${n}/${sasaran.qtyKomponen}.`)
    setSasaran(null)
  }

  const modePersen = !!sasaran && PROSES_KOREKSI_PERSEN.includes(sasaran.proses)
  const elemen = sasaran ? (
    <Modal title={modePersen && sasaran.pctSekarang >= 100 ? 'Buka kembali (Admin Produksi)' : 'Koreksi progres (Admin Produksi)'} onClose={() => !menyimpan && setSasaran(null)} width={480}>
      <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
        <b>{sasaran.nama}</b> ({sasaran.kode}) · {sasaran.panelNama}<br />
        Proses <b>{sasaran.proses}</b>: sekarang {modePersen ? `${sasaran.pctSekarang}%` : `${sasaran.qtySekarang}/${sasaran.qtyKomponen} (${sasaran.pctSekarang}%)`}
      </div>
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e', marginBottom: 12 }}>
        Koreksi ini <b>melewati kunci urutan proses</b>. Pakai hanya untuk membetulkan data yang salah input. Setiap koreksi tercatat permanen beserta alasannya.
      </div>
      {modePersen ? (<>
        <Lbl>Persen baru (0–99)</Lbl>
        <Inp type="number" min={0} max={99} value={qty} onChange={(e: { target: { value: string } }) => setQty(e.target.value)} placeholder="mis. 75" />
        <div style={{ height: 8 }} />
        <Lbl>Alasan (wajib)</Lbl>
        <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
          {JENIS_ALASAN_PERSEN.map(j => (
            <label key={j} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <input type="radio" name="jenis-alasan-koreksi" checked={jenisAlasan === j} onChange={() => setJenisAlasan(j)} /> {j}
            </label>
          ))}
        </div>
        <Inp maxLength={400} value={alasan} onChange={(e: { target: { value: string } }) => setAlasan(e.target.value)} placeholder="keterangan (opsional), mis. pintu panel diganti, wiring ulang" />
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Setelah disimpan, jadwalkan ulang komponen ini di Raw Schedule agar muncul di HP operator.</div>
      </>) : (<>
        <Lbl>Qty selesai baru (0–{sasaran.qtyKomponen})</Lbl>
        <Inp type="number" min={0} max={sasaran.qtyKomponen} value={qty} onChange={(e: any) => setQty(e.target.value)} />
        <div style={{ height: 8 }} />
        <Lbl>Alasan (wajib)</Lbl>
        <Inp value={alasan} onChange={(e: any) => setAlasan(e.target.value)} placeholder="mis. box ke-3 sudah direndam 8 Okt, operator lupa input" />
      </>)}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '12px 0 4px' }}>Riwayat koreksi komponen ini</div>
      <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 11, color: '#64748b' }}>
        {riwayat === null ? 'Memuat…' : riwayat.length === 0 ? 'Belum pernah dikoreksi.' : riwayat.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid #f1f5f9', padding: '3px 0' }}>
            {new Date(r.waktu).toLocaleString('id-ID')} · {r.oleh} · {r.proses} {PROSES_KOREKSI_PERSEN.includes(r.proses) ? `${r.pct_lama ?? '–'}% → ${r.pct_baru}%` : `${r.qty_lama ?? '–'} → ${r.qty_baru} (${r.pct_baru}%)`} · {r.alasan}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
        <Btn color="#64748b" onClick={() => setSasaran(null)} disabled={menyimpan}>Batal</Btn>
        <Btn color="#b45309" onClick={simpan} disabled={menyimpan}>{menyimpan ? 'Menyimpan…' : 'Simpan koreksi'}</Btn>
      </div>
    </Modal>
  ) : null

  return { bolehKoreksi, buka, elemen }
}
