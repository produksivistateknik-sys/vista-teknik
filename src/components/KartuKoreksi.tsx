// KARTU KOREKSI QTY (22 Okt 2026, keputusan user) - SATU tampilan kartu koreksi utk Riwayat Gudang (vista-pekerja)
// & Riwayat Admin (vista-teknik). SALINAN IDENTIK ada di repo lain (vista-pekerja/src/components/KartuKoreksi.tsx):
// KALAU DIUBAH DI SATU REPO, WAJIB DISALIN KE REPO LAIN. Gaya inline saja (tanpa komponen UI repo) supaya bisa identik.
// Isi: qty lama -> disetujui (+ usulan Gudang bila admin mengubah angka), alasan, pengaju, penyetuju, waktu,
// status ambil (opsional). Aturan angka: lib/koreksiPermintaan.ts.
// (26 Nov 2026) koreksi langsung oleh Admin (sumber admin_*) ditandai sendiri; catatan admin saat mengubah usulan Gudang tampil.
import { qtyDisetujui, qtyDiubahAdmin, koreksiOlehAdmin, LABEL_SUMBER_ADMIN, type KoreksiPermintaan } from '../lib/koreksiPermintaan'

const fmtWaktu = (d?: string | null) => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'

export function KartuKoreksi({ k, satuan, judul, subjudul, ambil }: {
  k: KoreksiPermintaan
  satuan?: string | null
  judul?: string // nama komponen (Riwayat Gudang); kosong = kartu di dalam baris item (Riwayat Admin)
  subjudul?: string
  ambil?: { relevan: boolean; sudah: boolean; oleh?: string | null; at?: string | null }
}) {
  const disetujui = k.status === 'disetujui'
  const olehAdmin = koreksiOlehAdmin(k)
  const ditolak = k.status === 'ditolak'
  // koreksi oleh Admin: amber gelap (bukan warna status) - kontras AA di latar putih (ui-reviewer 26 Nov)
  const warna = olehAdmin ? '#b45309' : disetujui ? '#16a34a' : ditolak ? '#dc2626' : '#d97706'
  const s = satuan ? ` ${satuan}` : ''
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderLeft: `3px solid ${warna}`, borderRadius: 10, padding: judul ? '11px 14px' : '8px 11px', marginTop: judul ? 0 : 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
        <div style={{ minWidth: 0 }}>
          {judul && <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{judul}</div>}
          {subjudul && <div style={{ fontSize: 10.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subjudul}</div>}
          {!judul && <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309' }}>✏️ {olehAdmin ? 'Koreksi qty oleh Admin' : 'Koreksi qty'}</div>}
        </div>
        <span style={{ flexShrink: 0, background: warna + '18', color: warna, borderRadius: 20, padding: '2px 9px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {olehAdmin ? '✏️ Dikoreksi Admin' : disetujui ? '✓ Disetujui' : ditolak ? '✕ Ditolak' : '⏳ Menunggu'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: '#334155', marginBottom: 4 }}>
        Qty {k.qty_lama}{s} → <strong>{disetujui ? qtyDisetujui(k) : k.qty_diusulkan}{s}</strong>
        {disetujui && qtyDiubahAdmin(k) && <span style={{ color: '#b45309' }}> (usulan Gudang {k.qty_diusulkan}{s}, diubah penyetuju)</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10.5, color: '#64748b' }}>
        {olehAdmin
          ? <span>✏️ Dikoreksi oleh {k.diajukan_oleh || '-'} ({LABEL_SUMBER_ADMIN[k.sumber || ''] || 'admin'}) — {fmtWaktu(k.diputuskan_at || k.diajukan_at)}</span>
          : <span>📝 Diajukan oleh {k.diajukan_oleh || '-'} — {fmtWaktu(k.diajukan_at)}</span>}
        {!olehAdmin && (disetujui || ditolak) && <span>{disetujui ? '✅ Disetujui' : '✕ Ditolak'} oleh {k.disetujui_oleh || '-'} — {fmtWaktu(k.diputuskan_at)}</span>}
        {ambil?.relevan && (ambil.sudah
          ? <span>📦 Diambil oleh {ambil.oleh || '-'} — {fmtWaktu(ambil.at)}</span>
          : <span style={{ color: '#94a3b8' }}>⏳ Menunggu diambil</span>)}
      </div>
      <div style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic', marginTop: 4, overflowWrap: 'anywhere' }}>{olehAdmin ? 'Catatan' : 'Alasan'}: {k.alasan || '-'}</div>
      {k.catatan_admin && <div style={{ fontSize: 10.5, color: '#b45309', fontStyle: 'italic', marginTop: 2, overflowWrap: 'anywhere' }}>Catatan penyetuju: {k.catatan_admin}</div>}
      {ditolak && k.catatan_reject && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠ {k.catatan_reject}</div>}
    </div>
  )
}
