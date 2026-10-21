// KOREKSI PROGRES ADMIN (22 Okt 2026, keputusan user) - satu-satunya jalur yang boleh melewati kunci urutan progres
// (trigger panels_validate_urutan_progres). Lewat RPC koreksi_progres_admin: alasan wajib, checklist + CCP ikut,
// jejak AWET di tabel koreksi_progres_log (bukan hanya activity_log yang retensinya ~1 minggu).
// Hanya ditampilkan utk divisi 'admin' (Admin Produksi). CATATAN: ini KONTROL APLIKASI, bukan pengaman keras -
// tanpa Supabase Auth, RPC bisa dipanggil siapa pun yang memegang anon key; yang terjamin adalah jejaknya.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal, Btn, Lbl, Inp } from './ui/Primitives'

export const PROSES_BISA_DIKOREKSI = ['POTONG', 'BENDING', 'STEL', 'FINISHING', 'RENDAM', 'PAINTING', 'RAKIT']

type Sasaran = { panelId: number; panelNama: string; kode: string; nama: string; proses: string; qtyKomponen: number; qtySekarang: number; pctSekarang: number }

export function useKoreksiProgres(user: any) {
  const bolehKoreksi = user?.divisi === 'admin'
  const [sasaran, setSasaran] = useState<Sasaran | null>(null)
  const [qty, setQty] = useState('')
  const [alasan, setAlasan] = useState('')
  const [riwayat, setRiwayat] = useState<any[] | null>(null)
  const [menyimpan, setMenyimpan] = useState(false)

  const buka = async (s: Sasaran) => {
    if (!bolehKoreksi) return
    setSasaran(s); setQty(String(s.qtySekarang)); setAlasan(''); setRiwayat(null)
    const { data, error } = await (supabase as any).from('koreksi_progres_log').select('waktu,proses,qty_lama,qty_baru,pct_baru,alasan,oleh')
      .eq('panel_id', s.panelId).eq('kode_komponen', s.kode).order('waktu', { ascending: false }).order('id', { ascending: false }).range(0, 49)
    if (error) { console.error('[koreksi progres] gagal baca riwayat:', error); setRiwayat([]); return }
    setRiwayat(data || [])
  }

  const simpan = async () => {
    if (!sasaran) return
    const n = Number(qty)
    if (!Number.isInteger(n) || n < 0 || n > sasaran.qtyKomponen) { alert(`Qty harus bilangan bulat 0 sampai ${sasaran.qtyKomponen}.`); return }
    if (alasan.trim().length < 5) { alert('Alasan koreksi wajib diisi (minimal 5 huruf).'); return }
    if (!confirm(`Koreksi ${sasaran.proses} ${sasaran.nama} (${sasaran.kode}) - ${sasaran.panelNama}\n${sasaran.qtySekarang}/${sasaran.qtyKomponen} -> ${n}/${sasaran.qtyKomponen}\n\nKoreksi ini melewati kunci urutan proses dan dicatat permanen. Lanjutkan?`)) return
    setMenyimpan(true)
    const sess = JSON.parse(localStorage.getItem('vista_admin_session') || '{}')
    const { error } = await (supabase as any).rpc('koreksi_progres_admin', {
      p_panel_id: sasaran.panelId, p_kode: sasaran.kode, p_proses: sasaran.proses, p_qty: n,
      p_alasan: alasan.trim(), p_oleh: user?.name || user?.nama || sess?.nama || 'Admin', p_divisi: user?.divisi || '',
    })
    setMenyimpan(false)
    if (error) { console.error('[koreksi progres] gagal:', error); alert('Koreksi gagal disimpan: ' + error.message); return }
    alert(`Koreksi tersimpan: ${sasaran.proses} ${sasaran.kode} = ${n}/${sasaran.qtyKomponen}.`)
    setSasaran(null)
  }

  const elemen = sasaran ? (
    <Modal title="Koreksi progres (Admin Produksi)" onClose={() => !menyimpan && setSasaran(null)} width={480}>
      <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
        <b>{sasaran.nama}</b> ({sasaran.kode}) · {sasaran.panelNama}<br />
        Proses <b>{sasaran.proses}</b>: sekarang {sasaran.qtySekarang}/{sasaran.qtyKomponen} ({sasaran.pctSekarang}%)
      </div>
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e', marginBottom: 12 }}>
        Koreksi ini <b>melewati kunci urutan proses</b>. Pakai hanya untuk membetulkan data yang salah input. Setiap koreksi tercatat permanen beserta alasannya.
      </div>
      <Lbl>Qty selesai baru (0–{sasaran.qtyKomponen})</Lbl>
      <Inp type="number" min={0} max={sasaran.qtyKomponen} value={qty} onChange={(e: any) => setQty(e.target.value)} />
      <div style={{ height: 8 }} />
      <Lbl>Alasan (wajib)</Lbl>
      <Inp value={alasan} onChange={(e: any) => setAlasan(e.target.value)} placeholder="mis. box ke-3 sudah direndam 8 Okt, operator lupa input" />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', margin: '12px 0 4px' }}>Riwayat koreksi komponen ini</div>
      <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 11, color: '#64748b' }}>
        {riwayat === null ? 'Memuat…' : riwayat.length === 0 ? 'Belum pernah dikoreksi.' : riwayat.map((r, i) => (
          <div key={i} style={{ borderBottom: '1px solid #f1f5f9', padding: '3px 0' }}>
            {new Date(r.waktu).toLocaleString('id-ID')} · {r.oleh} · {r.proses} {r.qty_lama ?? '–'} → {r.qty_baru} ({r.pct_baru}%) · {r.alasan}
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
