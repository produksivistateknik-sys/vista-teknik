// INPUT QTY PER KOMPONEN BERSAMA (16 Okt 2026) - dipakai Manajemen WO (Admin) & WO Digital (Engineering).
// Dulu tiap tampilan menulis <input> sendiri: fitur "Enter pindah ke Qty berikutnya" (e18a332, 16 Jul 2026) cuma ada
// di Admin, tampilan Engineering (fe64c47, Sep 2026) dibuat tanpa onKeyDown & tanpa tempel-ke-bawah -> laporan tim
// Engineering "Enter tidak pindah ke baris bawah". Komponen ini HANYA perilaku keyboard/tempel + tampilan; nilai tetap
// dikirim ke usePanelQtyEditor lewat callback (logika simpan/hitungan/validasi TIDAK di sini).
//   Enter        -> fokus + blok isi Qty baris berikutnya (urutan semua WP), baris terakhir tetap di tempat
//   Shift+Enter  -> baris sebelumnya
//   Tidak ada baris yang dilewati (qty 0 tetap bisa diisi). Enter TIDAK menyimpan (simpan = tombol "Simpan Perubahan").
//   enterKeyHint "next" / "done" (baris terakhir) -> label tombol Enter keyboard Android. Keyboard angka iOS tidak punya Enter.
import type React from 'react'

export function qtyInputId(idPrefix: string, panelId: string | number, kode: string) {
  return `${idPrefix}_${panelId}_${kode}`
}

export function QtyKomponenInput({
  idPrefix, panelId, kode, qty, flatKodes, isLocked, isSelected, pakaiPasteMulti,
  onQtyChange, onCellClick, onCopy, onPasteMulti, latar = '#fff', garis = '#e2e8f0',
}: {
  idPrefix: string                       // pembeda id antar tampilan (tab Admin & Engineering bisa sama-sama ter-mount)
  panelId: string
  kode: string
  qty: number
  flatKodes: string[]                    // urutan kode semua WP panel ini
  isLocked: boolean                      // qty 0 -> tampil merah (tetap bisa diisi)
  isSelected: boolean                    // termasuk sel terpilih (Shift+klik)
  pakaiPasteMulti: boolean               // >1 sel terpilih & sel ini termasuk -> tempel ke sel terpilih
  onQtyChange: (kode: string, nilai: number | string) => void
  onCellClick: (kode: string, shiftKey: boolean) => void
  onCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onPasteMulti: (e: React.ClipboardEvent<HTMLInputElement>) => void
  latar?: string                         // warna latar normal (Engineering pakai variabel tema)
  garis?: string                         // warna garis normal
}) {
  const idx = flatKodes.indexOf(kode)
  const terakhir = idx === flatKodes.length - 1

  const fokusKe = (kodeTujuan: string | undefined) => {
    if (!kodeTujuan) return
    const el = document.getElementById(qtyInputId(idPrefix, panelId, kodeTujuan)) as HTMLInputElement | null
    if (el) { el.focus(); el.select() }
  }

  return (
    <input type="number" min="0" id={qtyInputId(idPrefix, panelId, kode)} value={qty === 0 ? '' : qty}
      enterKeyHint={terakhir ? 'done' : 'next'}
      onChange={e => onQtyChange(kode, e.target.value)}
      onKeyDown={e => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        fokusKe(e.shiftKey ? flatKodes[idx - 1] : flatKodes[idx + 1])
      }}
      onClick={e => { e.stopPropagation(); onCellClick(kode, e.shiftKey) }}
      onCopy={onCopy}
      onPaste={e => {
        if (pakaiPasteMulti) { onPasteMulti(e); return }
        // tempel beberapa nilai (kolom dari Excel) -> diisi ke bawah mulai sel ini
        const values = e.clipboardData.getData('text').split(/\r?\n|\t/).map(v => v.trim()).filter(v => v !== '')
        if (values.length <= 1) return
        e.preventDefault()
        if (idx === -1) return
        values.forEach((val, i) => {
          const target = flatKodes[idx + i]
          if (!target) return
          onQtyChange(target, parseFloat(val) || 0)
        })
      }}
      style={{ width: 56, padding: '4px 6px', borderRadius: 6,
        border: isSelected ? '1.5px solid #2563eb' : `1.5px solid ${isLocked ? '#fecaca' : garis}`,
        background: isSelected ? '#eff6ff' : isLocked ? '#fef2f2' : latar, fontSize: 12, textAlign: 'center',
        fontWeight: 700, fontFamily: "'DM Mono',monospace", color: isLocked ? '#fca5a5' : 'var(--text-primary,#1e293b)' }} />
  )
}
