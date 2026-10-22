import { useEffect, useMemo, useState } from 'react'
import { TODAY } from '../lib/dateHelpers'
import { cariPelanggaranUrutan, teksPelanggaran, type KonteksUrutan, type PelanggaranUrutan } from '../lib/urutanProses'
import { teksHasilTemplate, type HasilTemplatePanel } from '../lib/templateJadwalWp'
import { SUMBER_TEMPLATE_SANDBOX } from '../lib/sandbox/memoryRepo'
import type { IoJadwalRaw } from '../lib/ioJadwalRaw'

// SIMULASI FCS + TEMPLATE WP (22 Okt 2026, tahap 1 - HANYA sandbox Raw Schedule per WP, keputusan user).
// Menjalankan generator FCS yang SAMA (services/fcsService, opsi.template) terhadap SALINAN memori: tiap (proses, WP)
// ke Day ke-n template jenis panel; WIRING/BUSBAR = Day PASANG paling awal; QC TEST/PACKING = H-1 target WO.
// "Kosongkan dulu" = buang baris jadwal panel itu di SALINAN (simulasi FCS dari nol). Tanpa itu, sama dgn FCS ulang
// asli: hanya kode yang belum terjadwal yang diisi, jadwal yang sudah ada (termasuk yang diatur manual) tidak ditimpa.
// FCS asli di Manajemen WO tidak memakai ini.
type Props = {
  woData: any[]; rawData: any[]; io: IoJadwalRaw; log?: (action: string, description: string, module: string, extra?: any) => Promise<void>
  user?: any; konteksUrutan: KonteksUrutan; onTutup: () => void; onSelesai: (day1: string) => void
}
type Hasil = { ok: boolean; pesan?: string; count?: number; template?: HasilTemplatePanel[]; urutan?: PelanggaranUrutan[] }

const gayaBtn = (utama = false) => ({ height: 30, padding: '0 12px', borderRadius: 7, border: utama ? 'none' : '1px solid #d1d5db', background: utama ? '#0f766e' : '#fff', color: utama ? '#fff' : '#334155', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

export function ModalSimulasiTemplate({ woData, rawData, io, log, user, konteksUrutan, onTutup, onSelesai }: Props) {
  const woList = useMemo(() => (woData || []).filter((w: any) => (w.panels || []).length > 0), [woData])
  const [woId, setWoId] = useState<number | null>(woList[0]?.id ?? null)
  const wo = woList.find((w: any) => w.id === woId)
  const [pilih, setPilih] = useState<number[]>([])
  const [day1, setDay1] = useState(TODAY)
  const [pola, setPola] = useState<Record<number, string>>({})
  const [kosongkan, setKosongkan] = useState(true)
  const [jalan, setJalan] = useState(false)
  const [hasil, setHasil] = useState<Hasil | null>(null)
  const [tipeTemplate, setTipeTemplate] = useState<string[] | null>(null)
  useEffect(() => { // daftar jenis yang punya template (salinan tabel/file di memori)
    let batal = false
    ;(io.db as any).from('template_jadwal_wp').select('tipe_panel').order('tipe_panel').range(0, 9999).then(({ data, error }: any) => {
      if (batal) return
      if (error) { console.error('[simulasi template] baca template gagal:', error); setTipeTemplate([]); return }
      setTipeTemplate([...new Set<string>((data || []).map((r: any) => r.tipe_panel))].sort())
    })
    return () => { batal = true }
  }, [io])
  const punyaJadwal = useMemo(() => new Set(rawData.map((r: any) => Number(r.panel_id))), [rawData])
  const panels: any[] = wo?.panels || []

  const jalankan = async () => {
    if (!wo || pilih.length === 0) return
    setJalan(true); setHasil(null)
    try {
      if (kosongkan) {
        const { error } = await (io.db as any).from('raw_schedule').delete().in('panel_id', pilih)
        if (error) throw new Error('kosongkan salinan: ' + error.message)
      }
      const uname = user?.name || user?.nama || 'Admin'
      const tipePer: Record<number, string> = {}
      pilih.forEach(id => { if (pola[id]) tipePer[id] = pola[id] })
      let res = await io.fcs.generateAndSaveToRawSchedule(wo.id, day1, uname, pilih, undefined, { template: { tipeTemplatePerPanel: tipePer } })
      if (!res.success && res.error === '__ALREADY_EXISTS__')
        res = await io.fcs.generateAndSaveToRawSchedule(wo.id, day1, '__force__' + uname, pilih, undefined, { template: { tipeTemplatePerPanel: tipePer } })
      if (!res.success) { setHasil({ ok: false, pesan: res.error || 'gagal' }); return }
      const { data: rows, error: eRows } = await (io.db as any).from('raw_schedule').select('*').in('panel_id', pilih).order('id').range(0, 999)
      if (eRows) throw new Error('baca hasil: ' + eRows.message)
      let urutan: PelanggaranUrutan[] = []
      try { urutan = cariPelanggaranUrutan(rows || [], konteksUrutan, new Set(pilih)) } catch (e) { console.error('[simulasi template] cek urutan gagal:', e) }
      const ringkas = (res.template || []).map(teksHasilTemplate)
      await log?.('GENERATE JADWAL FCS (TEMPLATE)', `Simulasi FCS + template WO ${wo.wo} - ${wo.proyek}, Day 1 ${day1}${kosongkan ? ', jadwal dikosongkan dulu' : ''}, ${res.count} entri: ${ringkas.join(' | ')}${urutan.length ? ' | urutan terbalik: ' + urutan.map(teksPelanggaran).join('; ') : ''}`, 'raw', { proyek: wo.proyek, wo_number: wo.wo })
      setHasil({ ok: true, count: res.count, template: res.template, urutan })
      onSelesai(day1)
    } catch (e: any) {
      console.error('[simulasi template] gagal:', e)
      setHasil({ ok: false, pesan: String(e?.message || e) })
    } finally { setJalan(false) }
  }

  const sumber = SUMBER_TEMPLATE_SANDBOX
  return (
    <div role="dialog" aria-label="Simulasi FCS dengan template" onClick={onTutup} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: 'min(620px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 18, boxShadow: '0 20px 50px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>🧩 Simulasi FCS + template WP (salinan uji)</div>
        <div style={{ fontSize: 11.5, color: '#64748b', lineHeight: 1.5, marginBottom: 10 }}>
          Tiap proses & WP ditaruh di Day ke-n template jenis panel (Minggu & tanggal berkapasitas 0 dilewati; kapasitas boleh bentrok).
          WIRING & BUSBAR = hari PASANG KOMPONEN paling awal; QC TEST & PACKING = H-1 target WO. Hanya mengubah salinan di memori.
        </div>
        <div style={{ fontSize: 11, borderRadius: 7, padding: '6px 10px', marginBottom: 12, background: sumber.sumber === 'tabel' ? '#f0fdf4' : '#fffbeb', color: sumber.sumber === 'tabel' ? '#166534' : '#92400e', border: `1px solid ${sumber.sumber === 'tabel' ? '#bbf7d0' : '#fde68a'}` }}>
          Sumber template: {sumber.sumber === 'tabel' ? 'tabel template_jadwal_wp' : `salinan file TEMPLATE WP.xlsx (tabel template_jadwal_wp belum tersedia${sumber.galat ? ': ' + sumber.galat : ''})`}
        </div>

        {!hasil?.ok && <>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Work Order</label>
          <select value={woId ?? ''} onChange={e => { setWoId(Number(e.target.value)); setPilih([]); setPola({}) }} style={{ width: '100%', height: 32, borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, marginBottom: 10, fontFamily: 'inherit' }}>
            {woList.map((w: any) => <option key={w.id} value={w.id}>WO {w.wo} - {w.proyek} (target {w.target || '-'})</option>)}
          </select>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>Panel & template</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
            {panels.map((p: any) => {
              const on = pilih.includes(p.id)
              const auto = (tipeTemplate || []).includes(p.tipe) ? p.tipe : null
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, background: on ? '#f0fdfa' : 'transparent', flexWrap: 'wrap' }}>
                  <input type="checkbox" checked={on} onChange={() => setPilih(on ? pilih.filter(x => x !== p.id) : [...pilih, p.id])} aria-label={'Pilih ' + p.nama} />
                  <span style={{ fontSize: 12, color: '#1e293b', flex: '1 1 160px' }}>{p.nama} <span style={{ color: '#94a3b8', fontSize: 10.5 }}>({p.tipe}){punyaJadwal.has(p.id) ? ' · sudah berjadwal' : ''}</span></span>
                  <select value={pola[p.id] || ''} onChange={e => setPola({ ...pola, [p.id]: e.target.value })} style={{ height: 26, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 11, fontFamily: 'inherit' }}>
                    <option value="">{auto ? `Otomatis (${auto})` : 'Otomatis - tidak ada template (cara lama)'}</option>
                    {(tipeTemplate || []).map(t => <option key={t} value={t}>Template {t}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: '#334155' }}>Day 1&nbsp;
              <input type="date" value={day1} onChange={e => setDay1(e.target.value || TODAY)} style={{ height: 30, borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 12, fontFamily: 'inherit' }} />
            </label>
            <label style={{ fontSize: 12, color: '#334155', display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={kosongkan} onChange={e => setKosongkan(e.target.checked)} /> Kosongkan jadwal panel terpilih dulu (simulasi FCS dari nol)
            </label>
          </div>
          {!kosongkan && pilih.some(id => punyaJadwal.has(id)) && (
            <div style={{ fontSize: 11.5, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 7, padding: '6px 10px', marginBottom: 10 }}>
              Panel terpilih sudah punya jadwal: hanya kode/proses yang BELUM terjadwal yang diisi. Jadwal yang sudah ada (termasuk yang diatur manual) tidak digeser.
            </div>
          )}
        </>}

        {hasil && !hasil.ok && <div style={{ fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 7, padding: '8px 10px', marginBottom: 10 }}>Gagal: {hasil.pesan}</div>}
        {hasil?.ok && (
          <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 10 }}>
            <div style={{ fontWeight: 700, color: '#0f766e', marginBottom: 6 }}>✓ {hasil.count} entri jadwal dibuat di salinan (Day 1 {day1}).</div>
            {(hasil.template || []).map(h => (
              <div key={h.panelId} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', marginBottom: 6 }}>
                <div style={{ fontWeight: 700 }}>{h.panel} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({h.tipe}{h.tipeTemplate ? ', template ' + h.tipeTemplate : ''})</span></div>
                {h.tanpaTemplate && <div style={{ color: '#92400e' }}>Tidak ada template untuk jenis ini - dijadwalkan dengan cara lama mulai {h.day1}.</div>}
                {!h.tanpaTemplate && <div style={{ color: '#475569', fontSize: 11, lineHeight: 1.6 }}>Day 1 = {h.day1} · {Object.entries(h.tanggalProses).map(([p, t]) => `${p} ${t.map(x => x.slice(8) + '/' + x.slice(5, 7)).join(',')}`).join(' · ')}</div>}
                {h.diLuarTemplate.length > 0 && <div style={{ color: '#7c3aed', fontSize: 11.5, marginTop: 4 }}>Di luar template (hari proses sebelumnya pada WP yang sama): {h.diLuarTemplate.join('; ')}</div>}
                {h.peringatan.map(p => <div key={p} style={{ color: '#b91c1c', fontSize: 11.5, marginTop: 4 }}>⚠ {p}</div>)}
              </div>
            ))}
            {(hasil.urutan || []).length > 0
              ? <div style={{ color: '#b91c1c', fontSize: 11.5 }}>⚠ Urutan proses terbalik: {hasil.urutan!.map(teksPelanggaran).join('; ')}</div>
              : <div style={{ color: '#166534', fontSize: 11.5 }}>Urutan proses: tidak ada yang terbalik.</div>}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {hasil?.ok
            ? <><button onClick={() => setHasil(null)} style={gayaBtn()}>Simulasi lagi</button><button onClick={onTutup} style={gayaBtn(true)}>Selesai</button></>
            : <><button onClick={onTutup} style={gayaBtn()}>Batal</button>
              <button onClick={jalankan} disabled={jalan || pilih.length === 0} style={{ ...gayaBtn(true), opacity: jalan || pilih.length === 0 ? .5 : 1, cursor: jalan ? 'wait' : 'pointer' }}>{jalan ? 'Menjalankan…' : `Jalankan (${pilih.length} panel)`}</button></>}
        </div>
      </div>
    </div>
  )
}
