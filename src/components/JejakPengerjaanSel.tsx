// Jejak pengerjaan di bawah kolom Operator Rencana Harian (23 Okt 2026) - teks kecil abu-abu: "Mulai: tgl · NAMA (qty)" +
// maks 2 hari terakhir + "+N lagi" yang membuka daftar lengkap per hari. Data & format: lib/jejakPengerjaan.
import { useState } from 'react'
import { ringkasJejak, teksHariJejak, type HariJejak } from '../lib/jejakPengerjaan'

export function JejakPengerjaanSel({ hari }: { hari: HariJejak[] }) {
  const [buka, setBuka] = useState(false)
  if (!hari.length) return null
  const { baris, lagi } = ringkasJejak(hari)
  const daftar = buka ? hari.map((h, i) => teksHariJejak(h, i === 0)) : baris
  return (
    <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.45, color: '#94a3b8', textAlign: 'left' }}>
      {daftar.map((b, i) => <div key={i} style={{ whiteSpace: 'normal' }}>{b}</div>)}
      {(lagi > 0 || buka) && (
        <button className="jejakBtn" type="button" onClick={() => setBuka((x) => !x)}
          style={{ background: 'none', border: 0, padding: 0, marginTop: 1, color: '#64748b', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
          {buka ? 'Ringkas' : `+${lagi} lagi`}
        </button>
      )}
    </div>
  )
}
