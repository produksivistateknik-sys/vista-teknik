import { useState } from 'react'
import { supabase } from './supabase'
import { activityLogService } from '../services/activityLogService'
import { rawScheduleService } from '../services/rawScheduleService'
import { ALL_PROSES } from '../constants/panelTypes'
import { checklistEntryPunyaKerja } from './panelHelpers'
import { sesuaikanProgressKeQtyBaru } from './progressQtyHelpers'

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

export type QtyPanel = { id: number; tipe: string; qty: number; nama: string; checklist: any }
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

  const updateItemQty = (panelId: string, kode: string, qty: number | string) => {
    const panel = getPanel(panelId)
    if (!panel) return
    setOrigChecklist(prev => {
      if (prev[panelId]) return prev
      return { ...prev, [panelId]: JSON.parse(JSON.stringify(panel.checklist || {})) }
    })
    // FIX (2 Okt 2026): fungsi ini jalan di SETIAP ketikan - dulu oldQty diambil dari state yang
    // sudah berubah oleh ketikan sebelumnya (ketik "16" atas qty 12 -> tercatat "1 -> 16" di
    // qty_change_log/activity_log, dan rasio skala dihitung dari 1). Sekarang oldQty = qty ASLI
    // sebelum edit dimulai (entri dirty pertama), preview dihitung dari entri checklist asli.
    setDirtyQty(prev => {
      const oldQty = prev[panelId]?.[kode]?.oldQty ?? (panel.checklist?.[kode]?.qty ?? 0)
      return { ...prev, [panelId]: { ...prev[panelId], [kode]: { newQty: Number(qty) || 0, oldQty } } }
    })
    const nq2 = Number(qty) || 0
    const asli = origChecklist[panelId]?.[kode] ?? panel.checklist?.[kode]
    const qtyAsli = Number(asli?.qty) || 0
    const nc = { ...panel.checklist, [kode]: { ...panel.checklist[kode], qty: nq2 } }
    if (nq2 > 0 && qtyAsli > 0) {
      // preview = hasil yang SAMA PERSIS dgn yang disimpan saveQtyEdit (helper bersama)
      nc[kode] = sesuaikanProgressKeQtyBaru({ ...asli, qty: qtyAsli }, qtyAsli, nq2) || nc[kode]
      applyChecklist(panelId, nc)
      return
    }
    if (nq2 === 0) {
      // qty 0 -> reset semua progress
      nc[kode].progress = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: 0 }), {})
      nc[kode].progressByDate = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {})
      nc[kode].history = ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: [] }), {})
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
    // QTY JADI 0 (1 Okt 2026) - kode bakal dihapus dari jadwal hari ini & ke depan
    // (rawScheduleService.sinkronJadwalSetelahUbahQty). Kalau komponen itu udah pernah dikerjakan
    // atau timernya lagi jalan, admin WAJIB konfirmasi dulu (bukan diblok - tetap bisa lanjut).
    const kodeJadiNol = Object.keys(dirty).filter(kode => {
      const d = (dirty as any)[kode]
      return d.newQty !== d.oldQty && Math.round(Number(d.newQty) * panelQtyMultiplier) <= 0 && (finalChecklist[kode]?.qty || 0) > 0
    })
    if (kodeJadiNol.length > 0) {
      const { data: timerJalan, error: tErr } = await supabase.from('fcs_timer_kerja').select('kode_komponen,proses').eq('panel_id', panel.id).in('kode_komponen', kodeJadiNol).is('selesai', null)
      if (tErr) { alert('Gagal cek timer aktif: ' + tErr.message); return }
      const cfgNol = getEffectiveCfg(panel.tipe)
      const peringatanNol = kodeJadiNol.map(kode => {
        const nama = cfgNol?.wps.flatMap((w: any) => w.items).find((it: any) => it.kode === kode)?.nama || kode
        const timer = (timerJalan || []).filter((t: any) => t.kode_komponen === kode).map((t: any) => t.proses)
        if (timer.length) return `${nama}: timer ${timer.join('/')} SEDANG JALAN`
        if (checklistEntryPunyaKerja(finalChecklist[kode])) return `${nama}: sudah pernah dikerjakan`
        return null
      }).filter(Boolean)
      if (peringatanNol.length > 0 && !window.confirm(
        'Qty komponen berikut jadi 0 dan akan DIHAPUS dari jadwal hari ini & ke depan (Raw Schedule + Rencana Harian):\n\n' +
        peringatanNol.join('\n') +
        '\n\nRiwayat progress & jadwal lampau TETAP disimpan. Lanjutkan?'
      )) return
    }
    if (konflikList.length > 0) {
      const lanjut = window.confirm(
        'PERINGATAN: qty baru lebih kecil dari progress yang sudah dikerjakan operator untuk:\n\n' +
        konflikList.join('\n') +
        '\n\nUnit yang sudah dikerjakan TIDAK diubah/dipotong - persen dihitung ulang terhadap qty baru (maks 100%). ' +
        'Operator mungkin perlu koreksi manual di Vista Pekerja setelah ini. Lanjutkan simpan qty baru?'
      )
      if (!lanjut) return
    }

    const qtyLamaAsli: Record<string, number> = {} // qty checklist SEBELUM disimpan (sudah dikali qty panel)
    Object.keys(dirty).forEach(kode => {
      const dirtyEntry = (dirty as any)[kode]
      if (dirtyEntry.newQty === dirtyEntry.oldQty) return
      qtyLamaAsli[kode] = Number(finalChecklist[kode]?.qty) || 0
      const base = finalChecklist[kode] || {
        qty: 0, qtyProses: {},
        progress: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: 0 }), {}),
        progressByDate: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {}),
        stepDates: ALL_PROSES.reduce((a: any, pr: string) => ({ ...a, [pr]: {} }), {}),
      }
      const qtyBaruFinal = Math.round(Number(dirtyEntry.newQty) * panelQtyMultiplier)
      // Persen dihitung ulang dari qty LAMA ASLI di DB (bukan state lokal) lewat helper bersama -
      // dulu cuma qty yang ditimpa, persen nyangkut di angka lama (insiden MCC PANEL 2 Okt 2026).
      finalChecklist[kode] = sesuaikanProgressKeQtyBaru({ ...base, qty: qtyLamaAsli[kode] }, qtyLamaAsli[kode], qtyBaruFinal) || { ...base, qty: qtyBaruFinal }
      finalChecklist[kode] = { ...finalChecklist[kode], qty: qtyBaruFinal }
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
          qty_lama: qtyLamaAsli[kode] ?? (v as any).oldQty, qty_baru: finalVal, changed_by: uname,
        })
        return nama + ': ' + (qtyLamaAsli[kode] ?? (v as any).oldQty) + ' -> ' + finalVal
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
    // Sinkron jadwal (1 Okt 2026) - qty jadi 0 dihapus dari jadwal ke depan, qty dari 0 dijadwalkan
    // ke proses relevan, qty lain disesuaikan angkanya. Satu pintu: sinkronJadwalSetelahUbahQty.
    const qtyChangesForRaw = Object.entries(dirty)
      .filter(([, v]) => (v as any).newQty !== (v as any).oldQty)
      .map(([kode, v]) => ({ kode, oldQty: qtyLamaAsli[kode] || 0, newQty: Math.round(Number((v as any).newQty) * panelQtyMultiplier) }))
    if (qtyChangesForRaw.length > 0) {
      try {
        await rawScheduleService.sinkronJadwalSetelahUbahQty(panel.id, qtyChangesForRaw, uname)
      } catch (err: any) {
        console.error('[saveQtyEdit] qty tersimpan, sinkron jadwal gagal:', err)
        alert('Qty BERHASIL disimpan, tapi sinkron ke jadwal GAGAL: ' + (err?.message || err) + '\n\nCek Raw Schedule untuk komponen ini, atau simpan ulang qty-nya.')
        return
      }
    }
    alert('Qty berhasil disimpan!')
  }

  return {
    selectedQtyCells, qtyAnchor, dirtyQty,
    handleQtyCellClick, handleQtyCopy, handleQtyPasteMulti, updateItemQty, cancelQtyEdit, saveQtyEdit,
  }
}
