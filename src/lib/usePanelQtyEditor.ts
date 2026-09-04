import { useState } from 'react'
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { rawScheduleService } from '../services/rawScheduleService'
import { ALL_PROSES } from '../constants/panelTypes'

// ─────────────────────────────────────────────────────────────────────────────
// SHARED QTY-PER-KOMPONEN EDITOR (3 Sep 2026, di-extract dari ManajemenWO.tsx)
// Dulu logic ini inline di ManajemenWO.tsx doang - sekarang dipakai bareng WoDigitalTab.tsx
// (Engineering) juga, biar gak ada 2 salinan kode yang gampang divergen (kelas bug yang sudah
// beberapa kali kejadian di fitur qty ini - lihat komentar saveQtyEdit soal "qty balik ke 0
// terus"). SEMUA behavior/proteksi di bawah SAMA PERSIS logic aslinya, cuma diakses lewat
// callback (getPanel/getWoContext/applyChecklist/getEffectiveCfg) bukan langsung woData/setWoData
// - biar caller bebas nyimpen panelnya di struktur apapun (ManajemenWO: nested per-WO, WoDigitalTab:
// flat array).
// ─────────────────────────────────────────────────────────────────────────────

export type QtyPanel = { id: number | string; tipe: string; qty: number; nama: string; checklist: any }
export type QtyWoContext = { id: number; wo: string; proyek: string }

export function usePanelQtyEditor({
  getPanel, getWoContext, applyChecklist, getEffectiveCfg, getUname,
}: {
  getPanel: (panelId: string) => QtyPanel | undefined
  getWoContext: (panelId: string) => QtyWoContext | undefined
  applyChecklist: (panelId: string, newChecklist: any) => void
  getEffectiveCfg: (tipe: string) => any
  getUname: () => string
}) {
  const [selectedQtyCells, setSelectedQtyCells] = useState<{ panelId: string; kodes: string[] } | null>(null)
  const [qtyAnchor, setQtyAnchor] = useState<{ panelId: string; kode: string } | null>(null)
  const [dirtyQty, setDirtyQty] = useState<Record<string, Record<string, { newQty: number, oldQty: number }>>>({})
  const [origChecklist, setOrigChecklist] = useState<Record<string, any>>({})

  const handleQtyCellClick = (panelId: string, kode: string, flatKodes: string[], shiftKey: boolean) => {
    if (shiftKey && qtyAnchor && qtyAnchor.panelId === panelId) {
      const startIdx = flatKodes.indexOf(qtyAnchor.kode)
      const endIdx = flatKodes.indexOf(kode)
      if (startIdx === -1 || endIdx === -1) return
      const lo = Math.min(startIdx, endIdx)
      const hi = Math.max(startIdx, endIdx)
      setSelectedQtyCells({ panelId, kodes: flatKodes.slice(lo, hi + 1) })
    } else {
      setQtyAnchor({ panelId, kode })
      setSelectedQtyCells({ panelId, kodes: [kode] })
    }
  }

  const handleQtyCopy = (panelId: string, e: any) => {
    if (!selectedQtyCells || selectedQtyCells.panelId !== panelId || selectedQtyCells.kodes.length <= 1) return
    const panel = getPanel(panelId)
    if (!panel) return
    const values = selectedQtyCells.kodes.map(kode => panel.checklist?.[kode]?.qty ?? 0)
    e.clipboardData.setData('text/plain', values.join('\n'))
    e.preventDefault()
  }

  const handleQtyPasteMulti = (panelId: string, e: any) => {
    if (!selectedQtyCells || selectedQtyCells.panelId !== panelId || selectedQtyCells.kodes.length <= 1) return
    const text = e.clipboardData.getData('text')
    const values = text.split(/\r?\n|\t/).map((v: string) => v.trim()).filter((v: string) => v !== '')
    if (values.length === 0) return
    e.preventDefault()
    selectedQtyCells.kodes.forEach((kode, idx) => {
      const val = values.length === 1 ? values[0] : values[idx]
      if (val === undefined) return
      updateItemQty(panelId, kode, parseFloat(val) || 0)
    })
  }

  const updateItemQty = (panelId: string, kode: string, qty: number) => {
    const panel = getPanel(panelId)
    if (!panel) return
    setOrigChecklist(prev => {
      if (prev[panelId]) return prev
      return { ...prev, [panelId]: JSON.parse(JSON.stringify(panel.checklist || {})) }
    })
    setDirtyQty(prev => {
      const oldQty = panel.checklist?.[kode]?.qty ?? 0
      return { ...prev, [panelId]: { ...prev[panelId], [kode]: { newQty: Number(qty) || 0, oldQty } } }
    })
    const nq2 = Number(qty) || 0
    const oldQty2 = panel.checklist[kode]?.qty || 1
    const nc = { ...panel.checklist, [kode]: { ...panel.checklist[kode], qty: nq2 } }
    if (nq2 === 0) {
      // qty 0 -> reset semua progress
      nc[kode].progress = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: 0 }), {})
      nc[kode].progressByDate = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {})
      nc[kode].history = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: [] }), {})
    } else if (nq2 !== oldQty2 && oldQty2 > 0) {
      // qty berubah -> recalculate progress proporsional (termasuk progressByDate biar snapshot
      // histori tetap konsisten sama progress live, bukan "ketinggalan" di persentase lama)
      const ratio = oldQty2 / nq2
      const newProgress: any = {}
      const newHistory: any = { ...(nc[kode].history || {}) }
      const newProgressByDate: any = { ...(nc[kode].progressByDate || {}) }
      ALL_PROSES.forEach((pr: string) => {
        const oldPct = nc[kode].progress?.[pr] || 0
        const newPct = Math.min(100, Math.round(oldPct * ratio))
        newProgress[pr] = newPct
        if (newHistory[pr] && newHistory[pr].length > 0) {
          const lastIdx = newHistory[pr].length - 1
          newHistory[pr] = [...newHistory[pr]]
          newHistory[pr][lastIdx] = { ...newHistory[pr][lastIdx], pct: newPct, ts: new Date().toISOString() }
        }
        if (newProgressByDate[pr]) {
          const scaledByDate: any = {}
          Object.entries(newProgressByDate[pr]).forEach(([tgl, pctLama]: any) => {
            scaledByDate[tgl] = Math.min(100, Math.round((Number(pctLama) || 0) * ratio))
          })
          newProgressByDate[pr] = scaledByDate
        }
      })
      nc[kode].progress = newProgress
      nc[kode].history = newHistory
      nc[kode].progressByDate = newProgressByDate
    }
    applyChecklist(panelId, nc)
  }

  const cancelQtyEdit = (panelId: string) => {
    const orig = origChecklist[panelId]
    if (!orig) return
    applyChecklist(panelId, orig)
    setDirtyQty(prev => { const n = { ...prev }; delete n[panelId]; return n })
    setOrigChecklist(prev => { const n = { ...prev }; delete n[panelId]; return n })
  }

  const saveQtyEdit = async (panelId: string) => {
    const panel = getPanel(panelId)
    const woCtx = getWoContext(panelId)
    if (!panel || !woCtx) { alert('Panel tidak ditemukan!'); return }
    const dirty = dirtyQty[panelId] || {}
    const panelQtyMultiplier = Number(panel.qty) || 1
    // ambil checklist TERBARU dari DB (bukan state lokal) biar gak nimpa edit qty admin lain yang barusan masuk
    const { data: freshPanelRow } = await supabase.from('panels').select('checklist').eq('id', panel.id).single()
    const finalChecklist = { ...(freshPanelRow?.checklist || panel.checklist) }

    const konflikList: string[] = []
    Object.keys(dirty).forEach(kode => {
      const dirtyEntry = (dirty as any)[kode]
      if (dirtyEntry.newQty === dirtyEntry.oldQty) return
      const newQtyFinal = Math.round(Number(dirtyEntry.newQty) * panelQtyMultiplier)
      const existingCl = finalChecklist[kode]
      if (!existingCl) return
      const maxQtyProses = Math.max(0, ...Object.values(existingCl.qtyProses || {}).map((v: any) => Number(v) || 0))
      if (maxQtyProses > newQtyFinal) {
        const cfg = getEffectiveCfg(panel.tipe)
        const nama = cfg?.wps.flatMap((w: any) => w.items).find((it: any) => it.kode === kode)?.nama || kode
        konflikList.push(`${nama}: progress sudah dikerjakan ${maxQtyProses}, qty baru cuma ${newQtyFinal}`)
      }
    })
    if (konflikList.length > 0) {
      const lanjut = window.confirm(
        'PERINGATAN: qty baru lebih kecil dari progress yang sudah dikerjakan operator untuk:\n\n' +
        konflikList.join('\n') +
        '\n\nProgress yang sudah ada TIDAK akan diubah/dipotong otomatis - cuma qty target-nya yang berubah. ' +
        'Operator mungkin perlu koreksi manual di Vista Pekerja setelah ini. Lanjutkan simpan qty baru?'
      )
      if (!lanjut) return
    }

    Object.keys(dirty).forEach(kode => {
      const dirtyEntry = (dirty as any)[kode]
      if (dirtyEntry.newQty === dirtyEntry.oldQty) return
      const base = finalChecklist[kode] || {
        qty: 0, qtyProses: {},
        progress: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: 0 }), {}),
        progressByDate: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {}),
        stepDates: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {}),
      }
      finalChecklist[kode] = { ...base, qty: Math.round(Number(dirtyEntry.newQty) * panelQtyMultiplier) }
    })
    const { error } = await supabase.from('panels').update({ checklist: finalChecklist }).eq('id', panel.id)
    if (error) { alert('Gagal menyimpan: ' + error.message); return }
    // Verifikasi baca-balik - jangan percaya "sukses" cuma dari absennya error (lihat riwayat bug
    // "qty balik ke 0 terus" - beberapa kelas bug lolos tanpa error dari Supabase padahal checklist
    // gak beneran berubah).
    const { data: verifyRow, error: verifyError } = await supabase.from('panels').select('checklist').eq('id', panel.id).single()
    if (verifyError) {
      alert('Qty sudah terkirim (gak ada error pas simpan), tapi verifikasi baca-balik gagal karena koneksi - BELUM YAKIN datanya beneran sesuai. Refresh halaman buat mastiin, atau simpan ulang kalau ragu.')
      return
    }
    const gagalTersimpan = Object.keys(dirty).filter(kode => {
      const dirtyEntry = (dirty as any)[kode]
      if (dirtyEntry.newQty === dirtyEntry.oldQty) return false
      return (verifyRow?.checklist?.[kode]?.qty) !== (finalChecklist[kode]?.qty)
    })
    if (gagalTersimpan.length > 0) {
      alert('Qty GAGAL tersimpan buat: ' + gagalTersimpan.join(', ') + ' - coba tekan Simpan Progress lagi. (Verifikasi baca-balik database gak cocok sama yang dimaksud disimpan)')
      return
    }
    applyChecklist(panelId, finalChecklist)
    const uname = getUname()
    const qtyChangeLogRows: any[] = []
    const changes = Object.entries(dirty)
      .filter(([, v]) => (v as any).newQty !== (v as any).oldQty)
      .map(([kode, v]) => {
        const cfg = getEffectiveCfg(panel.tipe)
        const wpFound = cfg?.wps.find((w: any) => w.items.some((it: any) => it.kode === kode))
        const nama = cfg?.wps.flatMap((w: any) => w.items).find((it: any) => it.kode === kode)?.nama || kode
        const finalVal = panelQtyMultiplier > 1 ? Math.round(Number((v as any).newQty) * panelQtyMultiplier) : (v as any).newQty
        qtyChangeLogRows.push({
          wo_id: woCtx.id, panel_id: panel.id, proyek: woCtx.proyek || '', panel: panel.nama || '', tipe_panel: panel.tipe || '',
          wp: wpFound?.wp || '', kode_komponen: kode, nama_komponen: nama,
          qty_lama: (v as any).oldQty, qty_baru: finalVal, changed_by: uname,
        })
        return nama + ': ' + (v as any).oldQty + ' -> ' + finalVal
      })
    if (qtyChangeLogRows.length > 0) {
      await supabase.from('qty_change_log').insert(qtyChangeLogRows)
    }
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    await activityLogService.insert({
      user_name: uname, action: 'EDIT QTY',
      description: '[' + tgl + '] Edit Qty ' + panel.nama + ' (' + woCtx.proyek + '): ' + changes.join(', '),
      module: 'wo', halaman: 'Manajemen WO', proyek: woCtx.proyek || '', panel: panel.nama || '', wo_number: woCtx.wo || '',
    })
    setDirtyQty(prev => { const n = { ...prev }; delete n[panelId]; return n })
    setOrigChecklist(prev => { const n = { ...prev }; delete n[panelId]; return n })
    // Sync qty yang udah ke-cache di raw_schedule.schedule (qtyPerKomponen) - komponen yang belum
    // pernah dijadwalkan tetap dibiarkan (gak bikin entry baru), itu tetap lewat Generate Jadwal.
    const qtyChangesForRaw = Object.entries(dirty)
      .filter(([, v]) => (v as any).newQty !== (v as any).oldQty)
      .map(([kode, v]) => ({ kode, newQty: Math.round(Number((v as any).newQty) * panelQtyMultiplier) }))
    if (qtyChangesForRaw.length > 0) {
      await rawScheduleService.syncQtyAfterEdit(panel.id, qtyChangesForRaw)
    }
    alert('Qty berhasil disimpan!')
  }

  return {
    selectedQtyCells, qtyAnchor, dirtyQty,
    handleQtyCellClick, handleQtyCopy, handleQtyPasteMulti, updateItemQty, cancelQtyEdit, saveQtyEdit,
  }
}
