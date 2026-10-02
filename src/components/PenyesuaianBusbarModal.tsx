import { useState } from 'react'
import { Modal } from './ui/Primitives'
import { getBusbarKomponen } from '../lib/panelHelpers'
import { sesuaikanBusbarKeJumlahBaru, komponenBusbarPunyaProgress } from '../lib/progressQtyHelpers'
import { simpanPenyesuaianBusbar } from '../services/busbarPenyesuaianService'

// Popup "Penyesuaian Busbar" (2 Okt 2026, keputusan user) - KHUSUS Admin (Manajemen WO). Muncul
// otomatis setelah Simpan qty (Edit Qty / Edit WO) untuk panel yang busbarnya sudah ada progress,
// dan lewat tombol "Sesuaikan Busbar". Komponen busbar tidak punya qty -> Admin mencentang komponen
// yang bertambah + jumlah sebelum -> sesudah (satuan bebas: cell/batang/set, yang dipakai cuma
// perbandingannya). Logika simpan: services/busbarPenyesuaianService.ts.
type Props = {
  panel: { id: number; nama: string; tipe: string; checklist: any; jumlah_cell?: number | null }
  konteks: { proyek: string; woNumber: string }
  pemicu?: string | null
  uname: string
  onClose: () => void
  onSaved: (checklistBaru: any) => void
}

export function PenyesuaianBusbarModal({ panel, konteks, pemicu, uname, onClose, onSaved }: Props) {
  const daftar = getBusbarKomponen(panel.tipe).filter((k: string) => komponenBusbarPunyaProgress(panel.checklist?.[k]))
  const awal = Number(panel.jumlah_cell) > 0 ? Number(panel.jumlah_cell) : 1
  const [pilih, setPilih] = useState<Record<string, { on: boolean; lama: string; baru: string }>>(
    () => Object.fromEntries(daftar.map((k: string) => [k, { on: false, lama: String(awal), baru: String(awal) }])))
  const [saving, setSaving] = useState(false)

  const dipilih = daftar.filter((k: string) => pilih[k]?.on)
  const valid = (k: string) => { const l = Number(pilih[k].lama), b = Number(pilih[k].baru); return Number.isInteger(l) && Number.isInteger(b) && l > 0 && b > 0 }
  const adaBerubah = dipilih.some((k: string) => valid(k) && Number(pilih[k].lama) !== Number(pilih[k].baru))
  const set = (k: string, patch: any) => setPilih(p => ({ ...p, [k]: { ...p[k], ...patch } }))

  const simpan = async () => {
    const tidakValid = dipilih.filter((k: string) => !valid(k))
    if (tidakValid.length) { alert('Jumlah sebelum & sesudah harus bilangan bulat lebih dari 0: ' + tidakValid.join(', ')); return }
    setSaving(true)
    try {
      const hasil = await simpanPenyesuaianBusbar(panel.id,
        dipilih.map((k: string) => ({ kode: k, jumlahLama: Number(pilih[k].lama), jumlahBaru: Number(pilih[k].baru) })),
        uname, { panelNama: panel.nama, proyek: konteks.proyek, woNumber: konteks.woNumber })
      if (hasil.checklist) onSaved(hasil.checklist)
      alert(`Penyesuaian busbar tersimpan.${hasil.jadwal.length ? `\n\nDijadwalkan hari ini di Raw Schedule: ${hasil.jadwal.join(', ')}.\nJangan lupa Distribusi ke Rencana Harian.` : ''}`)
      onClose()
    } catch (err: any) {
      console.error('[PenyesuaianBusbar] gagal:', err)
      alert('Gagal menyimpan penyesuaian busbar: ' + (err?.message || err))
    } finally {
      setSaving(false)
    }
  }

  const th = { fontSize: 10.5, fontWeight: 700, color: '#64748b', textAlign: 'left' as const, padding: '6px 8px', borderBottom: '1px solid #e2e8f0' }
  const td = { fontSize: 12.5, padding: '7px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' as const }
  const inp = { width: 54, padding: '5px 6px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12.5, textAlign: 'center' as const, fontFamily: 'inherit' }

  return (
    <Modal title={`Penyesuaian Busbar — ${panel.nama}`} onClose={() => { if (!saving) onClose() }} width={600}>
      <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 12, lineHeight: 1.5 }}>
        {pemicu ? <>Qty komponen panel ini baru berubah ({pemicu}).<br /></> : null}
        Apakah ada komponen busbar yang <b>ikut bertambah</b>? Centang yang bertambah lalu isi jumlah sebelum → sesudah
        (satuan bebas, mis. cell atau batang — yang dipakai hanya perbandingannya).
      </div>
      {daftar.length === 0 ? (
        <div style={{ fontSize: 12.5, color: '#94a3b8', padding: 16, textAlign: 'center' }}>Belum ada komponen busbar yang punya progress di panel ini.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
          <thead><tr><th style={th}>Komponen</th><th style={th}>Progress</th><th style={th}>Bertambah?</th><th style={th}>Sebelum → Sesudah</th><th style={th}>Hasil</th></tr></thead>
          <tbody>
            {daftar.map((k: string) => {
              const cl = panel.checklist[k]
              const now = Number(cl?.progress?.BUSBAR) || 0
              const s = pilih[k]
              const prev = s.on && valid(k) ? sesuaikanBusbarKeJumlahBaru(cl, Number(s.lama), Number(s.baru)) : null
              return (
                <tr key={k} style={{ background: s.on ? '#f8fafc' : '#fff' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{k}</td>
                  <td style={td}>{now}%</td>
                  <td style={td}><input type="checkbox" checked={s.on} onChange={e => set(k, { on: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} /></td>
                  <td style={td}>
                    {s.on ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="1" value={s.lama} onChange={e => set(k, { lama: e.target.value })} style={inp} />→
                      <input type="number" min="1" value={s.baru} onChange={e => set(k, { baru: e.target.value })} style={inp} />
                    </span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                  </td>
                  <td style={{ ...td, fontSize: 11.5 }}>
                    {prev && prev !== cl ? <span><b style={{ color: '#b45309' }}>{prev.progress.BUSBAR}%</b>
                      <span style={{ color: '#94a3b8' }}> ({Object.entries(prev.busbarTahap).map(([t, v]: any) => `${t.slice(0, 4)} ${v.progress}`).join(' · ')})</span></span>
                      : <span style={{ color: '#cbd5e1' }}>tidak berubah</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>
        Progress yang sudah dikerjakan tidak hilang — persen tiap tahap turun sebanding (mis. 100% dari 3 → 75% dari 4).
        Komponen yang persennya jadi di bawah 100% langsung dijadwalkan hari ini di Raw Schedule.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={saving}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
          Tidak ada yang bertambah
        </button>
        <button onClick={simpan} disabled={saving || !adaBerubah}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: adaBerubah ? '#1d4ed8' : '#cbd5e1', color: '#fff', cursor: adaBerubah ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
          {saving ? 'Menyimpan...' : 'Simpan Penyesuaian'}
        </button>
      </div>
    </Modal>
  )
}
