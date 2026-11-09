// CHIP DEADLINE (9 Nov 2026) - SATU komponen utk kartu Aktivitas Panel, Kendala, Catatan: "▦ 4 Des 2026 · H-25".
// Rumus & ambang SAMA dgn Manajemen WO (lib/dateHelpers daysUntil/isDelayed/isUrgent): lewat = merah ("lewat N hr"),
// 0-7 hari = oranye (MENDESAK), selebihnya netral. WO 100% -> tanggal saja tanpa H- (Manajemen WO menyembunyikan H-).
// Warna dari token styles/tokenKartuStatus (--ks-*, terang & gelap) - pemakai sudah menyisipkan token itu di <style>-nya.
import { daysUntil, isDelayed, isUrgent } from '../../lib/dateHelpers'
import type { ReactNode } from 'react'
import { fmtTgl } from '../../lib/woRevisiTag'
import { woKartuPanel, woUmumProyek, teksNomorWo, type PetaWo } from '../../lib/petaWo'

export function ChipDeadline({ target, selesai = false, awalan }: { target: string | null | undefined; selesai?: boolean; awalan?: string }) {
  if (!target) return null
  const d = daysUntil(target)
  if (!Number.isFinite(d)) return null
  const lewat = isDelayed(target), dekat = isUrgent(target)
  const nada = selesai ? 'netral' : lewat ? 'lewat' : dekat ? 'dekat' : 'netral'
  const warna = nada === 'lewat' ? { background: 'var(--ks-bahaya-soft)', color: 'var(--ks-bahaya)', borderColor: 'var(--ks-bahaya)' }
    : nada === 'dekat' ? { background: 'var(--ks-prog-soft)', color: 'var(--ks-prog)', borderColor: 'var(--ks-prog)' }
      : { background: 'var(--bg-secondary,#f8fafc)', color: 'var(--text-secondary,#475569)', borderColor: 'var(--border-color,#e2e8f0)' }
  const sisa = selesai ? '' : lewat ? ` · lewat ${Math.abs(d)} hr` : ` · H-${d}`
  return (
    <span title={`Deadline ${awalan ? awalan + ' ' : ''}${fmtTgl(target)}${selesai ? ' (WO selesai)' : ''}`}
      style={{ ...warna, display: 'inline-flex', alignItems: 'center', gap: 3, border: '1px solid', borderRadius: 999, padding: '1px 8px',
        fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', lineHeight: 1.5, letterSpacing: 0, textTransform: 'none' }}>
      ▦ {awalan ? awalan + ' ' : ''}{fmtTgl(target)}{sisa}
    </span>
  )
}

// Baris "WO 084 · NAMA PROYEK ▦ chip" kartu Kendala & Catatan (9 Nov 2026). Panel -> record WO terkini (lib/petaWo);
// panel tidak aktif -> nomor snapshot "(arsip)" tanpa chip; kartu umum proyek (panelId null) -> semua nomor WO aktif proyek
// + chip deadline TERDEKAT (keputusan user 9 Nov).
export function BarisWoProyek({ peta, proyek, panelId, snapshot, children }: {
  peta: PetaWo; proyek: string; panelId: number | null; snapshot?: { woId?: number | null; nomor?: string | null }; children?: ReactNode
}) {
  if (panelId == null) {
    const u = woUmumProyek(peta, proyek)
    return <>{u.nomor.length ? `${u.nomor.map(teksNomorWo).join(', ')} · ` : ''}{proyek}{children}{u.terdekat && <> <ChipDeadline target={u.terdekat.target} selesai={u.terdekat.selesai} awalan={u.nomor.length > 1 ? 'terdekat' : undefined} /></>}</>
  }
  const w = woKartuPanel(peta, panelId, snapshot)
  return <>{w.nomor ? `${teksNomorWo(w.nomor)}${w.arsip ? ' (arsip)' : ''} · ` : ''}{proyek}{children}{w.info && <> <ChipDeadline target={w.info.target} selesai={w.info.selesai} /></>}</>
}
