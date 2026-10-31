// LAPORAN OUTSTANDING - PENYUSUN (Tahap A, 23 Okt 2026). Acuan UI: artifact pratinjau "Laporan Outstanding" (tab "Susun &
// edit" & "Teks WhatsApp"; "Tampilan berkop"/PDF = Tahap B, belum). Semua isi dari SATU draf (lib/laporanOutstanding
// DrafLaporan) - teks WhatsApp dibentuk HANYA oleh formatTeksWhatsApp(draf).
// - "Buat laporan": muat ulang WO aktif + Raw Schedule + kendala (terbuka + baru teratasi, lib kendalaMasukLaporan), susun ulang bagian OTOMATIS & prioritas;
//   entri Arsip, Manual, dan Catatan dipertahankan.
// - Teks WhatsApp mengikuti draf selama belum diedit. Setelah diedit tangan (badge "Diedit"), perubahan di penyusun TIDAK
//   menimpanya - hanya "Buat ulang teks" (dengan konfirmasi).
// - (31 Okt 2026, S1) LAPORAN BERSAMA: satu laporan per hari kerja utk semua admin, disimpan per bagian di database
//   (laporan_outstanding*, RPC lo_*) & realtime - lihat hooks/useLaporanBersama (terakhir menang per bagian, teks yang sedang
//   diketik tidak ditimpa, peringatan "X baru mengubah bagian ini", riwayat permanen). Dulu draf per admin di localStorage:
//   ditawarkan impor sekali. Data WO/panel/progres/kendala tetap hanya dibaca.
// - Tiap pembungkus kolom ber-atribut data-b = id bagian (dipakai perlindungan fokus). Penanda sumber hanya di layar ini.
// Tombol ber-class "loBtn": aturan global mode gelap `[data-theme=dark] button:not([class*="Btn"])` tidak menimpanya.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { muatKendala } from '../lib/kendalaProduksi'
import { laporError } from '../lib/laporError'
import { hariKerjaWib, tanggalWibDari } from '../lib/tanggalWib'
import { cetakLaporanBerkop, htmlHalamanBerkop } from '../lib/laporanOutstandingBerkop'
import { useLaporanBersama, ID_TEKS_WA, ID_HEADER, type StatusSimpan } from '../hooks/useLaporanBersama'
import { datarkan, susunDraf, ulangId, headerDariDraf, bagianImpor, loBuat, loGantiOtomatis, loImpor, muatDaftarTanggal, muatLaporanTanggal,
  barisKeDatar, sudahDiimpor, tandaiDiimpor, tanggalUji } from '../lib/laporanOutstandingBersama'
import { KomponenMainPengaturan } from './KomponenMainPengaturan'
import { RiwayatLaporan } from './LaporanOutstandingRiwayat'
import {
  buatLaporanOutstanding, formatTeksWhatsApp, muatBahanOtomatis, muatPilihanArsip, proyekDariArsip, panelIdsDalamDraf,
  proyekManualBaru, panelManualBaru, idBaru, bacaSimpanan, fmtTglLaporan, setKolomBagian, kerangkaDokumen, nilaiKolomBagian, judulLaporan, HARI_TAMPIL_TERATASI, kosong,
  type DrafLaporan, type ProyekLap, type PanelLap, type GrupArsip, type PanelArsip, type Sumber, type Varian, type KendalaLap, type KendalaSumber,
} from '../lib/laporanOutstanding'

const CSS = `
.lo{--lo-card:var(--card-bg,#fff);--lo-fg:var(--text-primary,#1b1f2a);--lo-mute:var(--text-muted,#7b8190);--lo-line:var(--border-color,#e6e8ed);
  --lo-soft:var(--bg-secondary,#f6f7f9);--lo-acc:#2563eb;--lo-acc-soft:#eef3ff;--lo-ok:#2f8f5b;--lo-warn:#b45f06;--lo-warn-bg:#fdf0d5;--lo-bad:#c0392b;
  --lo-arc:#5b3aa6;--lo-arc-bg:#efe7ff;--lo-ink:#1b1f2a;--lo-ink-fg:#fff;color:var(--lo-fg);text-align:left;width:100%;font-size:14px;line-height:1.45}
[data-theme="dark"] .lo{--lo-acc:#7aa2ff;--lo-acc-soft:#1b2540;--lo-ok:#4cc38a;--lo-warn:#f0a04b;--lo-warn-bg:#3a2d14;--lo-bad:#f07b6e;--lo-arc:#c3adff;--lo-arc-bg:#2a2147;--lo-ink:#e2e8f0;--lo-ink-fg:#0f1117}
.lo *{box-sizing:border-box}
.lo-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.lo h1{font-size:22px;font-weight:700;letter-spacing:-.02em;margin:0}
.lo-sub{color:var(--lo-mute);font-size:13px;margin-top:2px}
.lo-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.lo .loBtn{height:36px;padding:0 14px;border:1px solid var(--lo-line);border-radius:8px;background:var(--lo-card);color:var(--lo-fg);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.lo .loBtn.pri{background:var(--lo-ink);color:var(--lo-ink-fg);border-color:var(--lo-ink)}
.lo .loBtn:disabled{opacity:.4;cursor:default}
.lo .loBtn.ib{height:30px;width:30px;padding:0;font-size:15px;color:var(--lo-mute);flex:none}
.lo .loBtn.ib.del:hover{color:var(--lo-bad)}
.lo .loBtn.lnk{height:auto;border:0;background:none;padding:4px 2px;color:var(--lo-acc);font-size:12.5px}
.lo .loBtn.lnk:hover{text-decoration:underline}
.lo-warn{font-size:12.5px;color:var(--lo-mute);background:var(--lo-soft);border:1px solid var(--lo-line);border-radius:8px;padding:7px 10px;margin-bottom:10px}
.lo-warn.bad{color:var(--lo-bad)}
.lo-lama{background:#fff4d6;color:#8a5a00;border:1px solid #f3c969;border-radius:8px;padding:8px 12px;font-weight:700;margin-bottom:8px}
[data-theme="dark"] .lo-lama{background:#3a2d14;color:#f0c46b;border-color:#6b5320}
.lo-st{font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;background:var(--lo-soft);color:var(--lo-mute);border:1px solid var(--lo-line)}
.lo-st.gagal{color:var(--lo-bad);border-color:var(--lo-bad)}
.lo-st.menyimpan,.lo-st.menunggu{color:var(--lo-acc)}
.lo-bentrok{outline:2px solid #f59e0b !important;outline-offset:2px;border-radius:8px}
.lo-per{position:sticky;top:6px;z-index:5;display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.lo-per>div{display:flex;gap:10px;align-items:flex-start;background:#fff7e6;color:#7a4b00;border:1px solid #f5c26b;border-radius:8px;padding:7px 10px;font-size:12.5px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
[data-theme="dark"] .lo-per>div{background:#3a2d14;color:#f0c46b;border-color:#6b5320}
.lo-per>div span{flex:1}
.lo-imp{background:var(--lo-acc-soft);border:1px solid var(--lo-line);border-radius:8px;padding:9px 12px;font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.lo-err{color:var(--lo-bad);font-size:13px;margin:8px 0}
.lo-tabs{display:flex;gap:4px;border-bottom:1px solid var(--lo-line);margin-bottom:12px;flex-wrap:wrap}
.lo .lo-tabs .loBtn{border:0;border-bottom:2px solid transparent;border-radius:0;background:none;height:38px;color:var(--lo-mute)}
.lo .lo-tabs .loBtn[aria-selected="true"]{color:var(--lo-fg);border-bottom-color:var(--lo-fg)}
.lo-badge{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;padding:1px 7px;border-radius:99px;background:var(--lo-warn-bg);color:var(--lo-warn)}
.lo-hint{font-size:12.5px;color:var(--lo-mute);flex:1 1 280px;min-width:0}
.lo-card{background:var(--lo-card);border:1px solid var(--lo-line);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px}
.lo-row{display:flex;gap:6px;align-items:center;min-width:0}
.lo-row.wrap{flex-wrap:wrap}
.lo input,.lo textarea{font:inherit;font-size:13.5px;color:var(--lo-fg);background:var(--lo-card);border:1px solid var(--lo-line);border-radius:7px}
.lo input:focus,.lo textarea:focus{outline:2px solid var(--lo-acc);outline-offset:-1px}
.lo .inp{flex:1 1 auto;min-width:0;height:32px;padding:0 9px}
.lo .inp.nm{font-weight:700}
.lo .inp.dt{flex:0 0 auto;width:150px}
.lo .inp.jam{flex:0 0 auto;width:70px;text-align:center}
.lo .chk{flex:none;width:18px;height:18px;accent-color:var(--lo-ok)}
.lo-lbl{font-size:12px;color:var(--lo-mute);white-space:nowrap}
.lo-src{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;border-radius:99px;padding:2px 8px;border:1px solid var(--lo-line);color:var(--lo-mute);background:var(--lo-soft)}
.lo-src.arsip{background:var(--lo-arc-bg);color:var(--lo-arc);border-color:transparent}
.lo-src.manual{background:var(--lo-warn-bg);color:var(--lo-warn);border-color:transparent}
.lo-kt{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:var(--lo-warn-bg);color:var(--lo-warn);border-radius:4px;padding:2px 6px}
.lo-pbox{border:1px solid var(--lo-line);border-radius:9px;padding:9px;display:flex;flex-direction:column;gap:6px;background:var(--lo-soft)}
.lo-links{display:flex;gap:12px;flex-wrap:wrap}
.lo-sec{font-weight:700;font-size:15px;margin:16px 0 6px}
.lo-picker{background:var(--lo-acc-soft);border:1px solid var(--lo-line);border-radius:10px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:10px}
.lo-arc{background:var(--lo-card);border:1px solid var(--lo-line);border-radius:9px;padding:10px;display:flex;flex-direction:column;gap:6px}
.lo-arc label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;cursor:pointer}
.lo-arc label.off{opacity:.5;cursor:default}
.lo-meta{font-size:12px;color:var(--lo-mute)}
.lo-wa textarea{width:100%;min-height:160px;max-height:calc(100vh - 220px);resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;line-height:1.6;padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;overflow-x:hidden;overflow-y:auto}
.lo-wa .hit{margin-top:4px;font-size:12px;color:var(--lo-mute);text-align:right}
.lo-empty{padding:40px 16px;color:var(--lo-mute);text-align:center;border:1px dashed var(--lo-line);border-radius:10px}
.lo-kd{display:flex;flex-direction:column;gap:2px}
.lo-kd-m{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--lo-mute);padding-left:4px}
.lo-kd-m .siapa{margin-left:auto;text-align:right}
.lo-kd-m .tg{margin-left:10px;font-variant-numeric:tabular-nums}
.lo-kd-m .ter{color:var(--lo-ok);font-weight:600}
.lo-kd.off{opacity:.5}
@media (max-width:640px){.lo .inp.dt{width:132px}.lo-row{gap:4px}.lo .loBtn.ib{width:26px;height:28px}.lo .loBtn.ib.mv{display:none}.lo-pbox{padding:7px}.lo-card{padding:9px}}
`

type Tab = 'susun' | 'berkop' | 'wa' | 'riwayat'
const LABEL_STATUS: Record<StatusSimpan, string> = { tersimpan: 'Tersimpan ✓', menunggu: 'Belum tersimpan…', menyimpan: 'Menyimpan…', gagal: 'Gagal tersimpan' }
const LABEL_SRC: Record<Sumber, string> = { otomatis: 'Otomatis', arsip: 'Arsip', manual: 'Manual' }
const Src = ({ s }: { s: Sumber }) => <span className={`lo-src ${s}`}>{LABEL_SRC[s]}</span>
const geser = <T,>(arr: T[], i: number, d: number): T[] => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a }
const tglPendek = (iso: string) => { const t = fmtTglLaporan(iso); if (!t) return '-'; const [d, m, y] = t.split('-'); return `${Number(d)} ${m.charAt(0)}${m.slice(1).toLowerCase()} ${y}` }
const BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const tglPanjang = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
const waktuWib = (iso: string) => { const d = new Date(new Date(iso).getTime() + 7 * 3600e3); return `${tglPendek(d.toISOString().slice(0, 10))}, ${d.toISOString().slice(11, 16).replace(':', '.')} WIB` }

export function LaporanOutstanding({ db, user }: { db: any; user: any }) {
  const nama = String(user?.nama || user?.name || 'admin').trim()
  const hariIni = hariKerjaWib()
  // kait uji (HANYA mode pengembangan, tidak ada di build produksi): sessionStorage vt_lo_uji_tanggal membuka laporan uji tgl < 2020
  const [tanggal, setTanggal] = useState(() => { try { const t = import.meta.env.DEV ? sessionStorage.getItem('vt_lo_uji_tanggal') : null; return t && tanggalUji(t) ? t : hariIni } catch { return hariIni } })
  const lb = useLaporanBersama(db, user, tanggal)
  const { draf, header, ubah } = lb
  const lama = tanggal !== hariIni
  const teksWa = lb.teksWa ?? (draf ? formatTeksWhatsApp(draf) : '')
  const diedit = lb.teksWa != null
  const [tab, setTab] = useState<Tab>('susun')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  // semua kendala tidak terhapus (terbuka + teratasi) - penyaringan teratasi di lib (kendalaMasukLaporan)
  const [kendala, setKendala] = useState<KendalaSumber[] | null>(null)
  const [picker, setPicker] = useState<{ memuat: boolean; galat?: string; grup: GrupArsip[]; pilih: Set<number>; hanyaBelum: boolean } | null>(null)
  const [aturMain, setAturMain] = useState(false) // pengaturan komponen main/printilan (KomponenMainPengaturan)
  const [salin, setSalin] = useState('')
  const [daftarTgl, setDaftarTgl] = useState<{ tanggal: string; diperbarui_oleh: string | null }[]>([])
  useEffect(() => { muatDaftarTanggal(db).then(setDaftarTgl).catch((e) => console.error('[Laporan Outstanding] daftar tanggal gagal:', e)) }, [db, header?.id])
  const varian: Varian = (header?.varian as Varian) || 'V2'

  // "Buat laporan" (belum ada utk hari ini): disusun dari data terbaru + entri manual/arsip/catatan laporan terakhir
  // (perilaku lama: draf kemarin terbawa), id bagian dibuat ulang. "Buat ulang": hanya bagian otomatis yang diganti (RPC).
  const buat = async (v: Varian = varian) => {
    if (lama) return
    if (header && !window.confirm('Susun ulang bagian Otomatis dan Prioritas dari data terbaru utk SEMUA admin?\nEdit pada entri Otomatis & Prioritas akan diganti. Entri Arsip, Manual, dan Catatan tetap.' + (diedit ? '\n\nTeks WhatsApp yang sudah diedit TIDAK diubah (pakai "Buat ulang teks").' : ''))) return
    setSibuk(true); setGalat(null)
    try {
      if (header) await lb.simpan()
      const [bahan, kd] = await Promise.all([muatBahanOtomatis(db), muatKendala(db)])
      const k = kd as KendalaSumber[]
      setKendala(k)
      if (header && lb.drafRef.current) {
        const d0 = lb.drafRef.current
        const baru = buatLaporanOutstanding({ ...bahan, kendala: k, varian: v, jam: d0.jam }, d0)
        await loGantiOtomatis(db, user, header.id, { varian: v, jam: baru.jam, disusun_pada: baru.dibuatPada }, datarkan(baru))
      } else {
        const sebelum = (await muatDaftarTanggal(db, 5)).find((x) => x.tanggal < hariIni)
        let dasarLama: DrafLaporan | null = null
        if (sebelum) { const r = await muatLaporanTanggal(db, sebelum.tanggal); if (r.header) dasarLama = susunDraf(r.header, barisKeDatar(r.bagian)) }
        const baru = ulangId(buatLaporanOutstanding({ ...bahan, kendala: k, varian: v }, dasarLama))
        const r = await loBuat(db, user, hariIni, headerDariDraf(baru), datarkan(baru))
        if (!r.dibuat) lb.beritahu(`Laporan hari ini sudah lebih dulu dibuat oleh ${r.laporan.dibuat_oleh} - itu yang ditampilkan.`)
      }
      await lb.muat()
    } catch (e: any) {
      console.error('[Laporan Outstanding] gagal menyusun:', e); laporError('supabase_error', e, { aksi: 'buat laporan outstanding' })
      setGalat('Gagal menyusun laporan: ' + (e?.message || e))
    } finally { setSibuk(false) }
  }
  const buatUlangTeks = () => {
    if (!draf) return
    if (diedit && !window.confirm('Teks WhatsApp sudah diedit. Buat ulang dari penyusun? Edit teks diganti utk semua admin (versi lama tetap di riwayat).')) return
    lb.setTeksWa(null)
  }
  // draf lama di browser ini (sebelum laporan bersama) - ditawarkan impor SEKALI
  const lokal = useMemo(() => (sudahDiimpor(nama) ? null : bacaSimpanan(nama)), [nama])
  const [lokalTutup, setLokalTutup] = useState(false)
  // penjaga klik ganda: state `sibuk` baru berlaku sesudah render, klik kedua yang sangat cepat diabaikan lewat ref (server juga anti-dobel)
  const imporBerjalan = useRef(false)
  const impor = async () => {
    if (!lokal || imporBerjalan.current) return
    imporBerjalan.current = true
    setSibuk(true); setGalat(null)
    try {
      const ada = (await muatLaporanTanggal(db, lokal.draf.tanggal)).header
      const r = await loImpor(db, user, lokal.draf.tanggal, headerDariDraf(lokal.draf, lokal.teksWa !== lokal.teksSistem ? lokal.teksWa : null), bagianImpor(lokal.draf, !!ada))
      tandaiDiimpor(nama, new Date().toISOString()); setLokalTutup(true)
      lb.beritahu(r.mode === 'baru' ? `Draf lama diimpor sebagai laporan ${tglPanjang(lokal.draf.tanggal)}.` : `Draf lama digabung ke laporan ${tglPanjang(lokal.draf.tanggal)}: ${r.bagian} bagian manual/arsip/catatan ditambahkan${r.dilewati ? `, ${r.dilewati} sudah ada` : ''}.`)
      if (lokal.draf.tanggal === tanggal) await lb.muat(); else setTanggal(lokal.draf.tanggal)
    } catch (e: any) {
      console.error('[Laporan Outstanding] impor gagal:', e); setGalat('Impor draf lama gagal: ' + (e?.message || e) + ' - draf lama tetap di browser ini.')
    } finally { setSibuk(false); imporBerjalan.current = false }
  }
  const salinTeks = async () => {
    const ok = () => { setSalin('Tersalin ✓'); setTimeout(() => setSalin(''), 1600) }
    try { await navigator.clipboard.writeText(teksWa); ok() } catch {
      const ta = document.getElementById('lo-wa-ta') as HTMLTextAreaElement | null
      try { ta?.focus(); ta?.select(); if (document.execCommand('copy')) ok(); else setSalin('Tekan Ctrl+C') } catch { setSalin('Tekan Ctrl+C') }
    }
  }

  // ----- arsip -----
  const bukaArsip = async () => {
    if (picker) { setPicker(null); return }
    setPicker({ memuat: true, grup: [], pilih: new Set(), hanyaBelum: true })
    try {
      let kd = kendala
      if (!kd) { kd = (await muatKendala(db)) as KendalaSumber[]; setKendala(kd) }
      const otomatis = new Set<number>((draf?.proyek || []).filter((p) => p.src === 'otomatis').flatMap((p) => p.panels.map((x) => x.panelId)).filter((x): x is number => x != null))
      const grup = await muatPilihanArsip(db, { hari: 60, kecualiPanelIds: otomatis })
      setPicker((p) => p && { ...p, memuat: false, grup })
    } catch (e: any) {
      console.error('[Laporan Outstanding] gagal memuat arsip:', e); laporError('supabase_error', e, { aksi: 'muat pilihan arsip laporan outstanding' })
      setPicker((p) => p && { ...p, memuat: false, galat: 'Gagal memuat arsip: ' + (e?.message || e) })
    }
  }
  const sudahAda = panelIdsDalamDraf(draf)
  const masukkanArsip = () => {
    if (!picker || !draf) return
    const tambah: ProyekLap[] = []
    picker.grup.forEach((g) => {
      const dipilih = g.panels.filter((p) => picker.pilih.has(p.id) && !sudahAda.has(p.id))
      if (dipilih.length) tambah.push(proyekDariArsip(g, dipilih, kendala || []))
    })
    if (tambah.length) {
      ubah((d) => {
        const proyek = [...d.proyek]
        tambah.forEach((t) => {
          const i = proyek.findIndex((p) => p.src === 'arsip' && p.nama === t.nama && p.deadline === t.deadline)
          if (i >= 0) proyek[i] = { ...proyek[i], panels: [...proyek[i].panels, ...t.panels] }; else proyek.push(t)
        })
        return { ...d, proyek }
      })
    }
    setPicker(null)
  }

  // bagian yang bentrok (admin lain mengubahnya) diberi garis kuning
  const akar = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = akar.current; if (!el) return
    el.querySelectorAll('.lo-bentrok').forEach((x) => x.classList.remove('lo-bentrok'))
    Object.keys(lb.peringatan).forEach((id) => el.querySelectorAll(`[data-b="${id.replace(/"/g, "")}"]`).forEach((x) => x.classList.add('lo-bentrok')))
  })
  // ----- edit helper -----
  const setP = (pi: number, f: (p: ProyekLap) => ProyekLap) => ubah((d) => ({ ...d, proyek: d.proyek.map((p, i) => (i === pi ? f(p) : p)) }))
  const setN = (pi: number, ni: number, f: (n: PanelLap) => PanelLap) => setP(pi, (p) => ({ ...p, panels: p.panels.map((n, i) => (i === ni ? f(n) : n)) }))
  const jumlahNonOtomatis = (draf?.proyek || []).filter((p) => p.src !== 'otomatis').length

  return (
    <div className="lo" ref={akar} onFocusCapture={lb.onFokus} onBlurCapture={lb.onLepas}>
      <style>{CSS}</style>
      <div className="lo-top">
        <div>
          <h1>Laporan Outstanding</h1>
          <div className="lo-sub">{header && draf ? <>Laporan bersama {tglPanjang(draf.tanggal)} · disusun {waktuWib(draf.dibuatPada)} · dibuat {header.dibuat_oleh}{header.diperbarui_oleh ? ` · terakhir diubah ${header.diperbarui_oleh}${header.diperbarui_pada ? ', ' + waktuWib(header.diperbarui_pada) : ''}` : ''}</> : lb.memuat ? 'Memuat laporan…' : lama ? `Tidak ada laporan untuk ${tglPanjang(tanggal)}.` : 'Belum ada laporan hari ini. Klik “Buat laporan” untuk menyusun dari data terbaru.'}</div>
        </div>
        <div className="lo-act" data-b={ID_HEADER}>
          <span className="lo-lbl">Tanggal</span>
          <select className="inp" style={{ width: 'auto', height: 32 }} value={tanggal} aria-label="Tanggal laporan" onChange={(e) => { if (lb.adaTertunda()) lb.simpan(); setTanggal(e.target.value) }}>
            {[...new Set([hariIni, ...daftarTgl.map((x) => x.tanggal), ...(tanggalUji(tanggal) ? [tanggal] : [])])].sort().reverse().map((t) => <option key={t} value={t}>{t === hariIni ? 'Hari ini · ' : ''}{tglPendek(t)}</option>)}
          </select>
          {draf && <><span className="lo-lbl">Jam laporan</span><input className="inp jam" value={draf.jam} onChange={(e) => ubah((d) => ({ ...d, jam: e.target.value }))} aria-label="Jam laporan" /></>}
          <span className="lo-lbl">Aturan (uji)</span>
          <select className="inp jam" style={{ width: 'auto', height: 32 }} value={varian} disabled={sibuk || lama || !header} aria-label="Varian aturan pekerjaan (uji)" title="V1: semua proses terjadwal s.d. hari ini · V2: hanya proses aktif + (+N proses menunggu) · V3: seperti V2, digabung per proses"
            onChange={(e) => buat(e.target.value as Varian)}>
            <option value="V1">V1 semua terjadwal</option><option value="V2">V2 proses aktif (bawaan)</option><option value="V3">V3 aktif digabung</option>
          </select>
          {!lama && <button className="loBtn pri" type="button" onClick={() => buat()} disabled={sibuk || lb.memuat}>{sibuk ? 'Memuat…' : header ? 'Buat ulang laporan' : 'Buat laporan'}</button>}
        </div>
      </div>
      {lama && <div className="lo-lama">⚠ Laporan tanggal lama · {tglPanjang(tanggal)} - perubahan tetap tersimpan & tercatat di riwayat. <button className="loBtn lnk" type="button" onClick={() => setTanggal(hariIni)}>Buka laporan hari ini</button></div>}
      <div className={'lo-warn' + (lb.status === 'gagal' ? ' bad' : '')} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={'lo-st ' + lb.status}>{LABEL_STATUS[lb.status]}</span>
        <span style={{ flex: 1 }}>{lb.status === 'gagal' ? lb.galatSimpan : 'Laporan bersama: tersimpan otomatis di server dan langsung terlihat oleh semua admin. Tidak mengubah data WO, panel, progres, atau kendala.'}</span>
      </div>
      {lokal && !lokalTutup && <div className="lo-imp">
        <span style={{ flex: 1 }}>Ada draf lama di browser ini ({tglPanjang(lokal.draf.tanggal)}, {lokal.draf.proyek.filter((x) => x.src !== 'otomatis').length} proyek manual/arsip, {lokal.draf.catatan.filter((c) => c.teks.trim()).length} catatan). Impor sekali ke laporan bersama agar tidak hilang.</span>
        <button className="loBtn pri" type="button" disabled={sibuk} onClick={impor}>Impor draf lama</button>
        <button className="loBtn" type="button" onClick={() => { tandaiDiimpor(nama, 'diabaikan ' + new Date().toISOString()); setLokalTutup(true) }}>Abaikan</button>
      </div>}
      {(Object.keys(lb.peringatan).length > 0 || lb.pemberitahuan.length > 0) && <div className="lo-per" role="status">
        {Object.entries(lb.peringatan).map(([id, x]) => <div key={id}><span>⚠ <b>{x.oleh || 'Admin lain'}</b> baru mengubah {id === ID_TEKS_WA ? 'teks WhatsApp' : id === ID_HEADER ? 'pengaturan laporan' : 'bagian yang ' + (x.sudahTersimpan ? 'Anda ubah' : 'sedang Anda edit')}{x.waktu ? ` (${waktuWib(x.waktu)})` : ''}. {x.sudahTersimpan ? 'Versi Anda yang tersimpan; versinya ada di riwayat.' : 'Teks Anda tidak ditimpa - saat selesai mengedit, versi Anda yang disimpan.'}</span>
          <button className="loBtn ib" type="button" title="Tutup" onClick={() => lb.tutupPeringatan(id)}>×</button></div>)}
        {lb.pemberitahuan.map((t, i) => <div key={'p' + i}><span>{t}</span><button className="loBtn ib" type="button" title="Tutup" onClick={() => lb.tutupPemberitahuan(i)}>×</button></div>)}
      </div>}
      {(galat || lb.galatMuat) && <div className="lo-err">{galat || lb.galatMuat} <button className="loBtn lnk" type="button" onClick={() => (galat ? buat() : lb.muat())}>Coba lagi</button></div>}

      {!draf ? <div className="lo-empty">{lb.memuat ? 'Memuat…' : lama ? 'Tidak ada laporan untuk tanggal ini.' : 'Belum ada laporan hari ini.'}</div> : <>
        <div className="lo-tabs" role="tablist">
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'susun'} onClick={() => setTab('susun')}>Susun &amp; edit{jumlahNonOtomatis > 0 && <span className="lo-badge">{jumlahNonOtomatis} manual/arsip</span>}</button>
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'berkop'} onClick={() => setTab('berkop')}>Tampilan berkop</button>
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'wa'} onClick={() => setTab('wa')}>Teks WhatsApp{diedit && <span className="lo-badge">Diedit</span>}</button>
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'riwayat'} onClick={() => setTab('riwayat')}>Riwayat</button>
        </div>

        {tab === 'susun' && <section>
          <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
            <div className="lo-hint">Edit teks, hapus, atau urutkan ulang. Centang = selesai hari ini (✅). Baris pekerjaan/kendala yang dibiarkan kosong menjadi garis tulis tangan di tampilan berkop/PDF (tidak ditulis di teks WhatsApp). Entri <b>Manual</b> dan <b>Arsip</b> hanya ada di laporan ini dan tidak mengubah data WO atau panel. Catatan di luar proyek dan Prioritas ada di bawah.
              <label className="lo-row" data-b={ID_HEADER} style={{ marginTop: 6, cursor: 'pointer', color: 'var(--lo-fg)' }}>
                <input className="chk" type="checkbox" checked={draf.tampilTeratasi !== false} onChange={(e) => ubah((d) => ({ ...d, tampilTeratasi: e.target.checked }))} />
                Tampilkan kendala yang sudah teratasi <span className="lo-meta">(sampai {HARI_TAMPIL_TERATASI} hari kerja sesudah tanggal teratasi)</span>
              </label></div>
            <div className="lo-act">
              <button className="loBtn" type="button" onClick={() => setAturMain((x) => !x)}>Komponen main</button>
              <button className="loBtn" type="button" onClick={bukaArsip}>{picker ? 'Tutup arsip' : 'Ambil dari arsip'}</button>
              <button className="loBtn pri" type="button" onClick={() => ubah((d) => ({ ...d, proyek: [...d.proyek, proyekManualBaru()] }))}>+ Tambah proyek</button>
            </div>
          </div>

          {picker && <PemilihArsip picker={picker} setPicker={setPicker} sudahAda={sudahAda} onMasuk={masukkanArsip} />}
          {aturMain && <KomponenMainPengaturan db={db} user={user} onTutup={() => setAturMain(false)} />}

          {draf.proyek.length === 0 && <div className="lo-empty">Belum ada proyek. Klik “+ Tambah proyek” atau “Ambil dari arsip”.</div>}
          {draf.proyek.map((p, pi) => (
            <div className="lo-card" key={p.id} data-b={p.id}>
              <div className="lo-row">
                <Src s={p.src} />
                <input className="inp nm" placeholder="NAMA PROYEK / WO" value={p.nama} onChange={(e) => setP(pi, (x) => ({ ...x, nama: e.target.value.toUpperCase() }))} />
                <button className="loBtn ib" type="button" title="Naik" onClick={() => ubah((d) => ({ ...d, proyek: geser(d.proyek, pi, -1) }))}>↑</button>
                <button className="loBtn ib" type="button" title="Turun" onClick={() => ubah((d) => ({ ...d, proyek: geser(d.proyek, pi, 1) }))}>↓</button>
                <button className="loBtn ib del" type="button" title="Hapus proyek" onClick={() => { if (window.confirm(`Hapus proyek ${p.nama || '(tanpa nama)'} dari laporan?`)) ubah((d) => ({ ...d, proyek: d.proyek.filter((_, i) => i !== pi) })) }}>×</button>
              </div>
              <div className="lo-row wrap">
                <span className="lo-lbl">Deadline</span>
                <input className="inp dt" type="date" value={p.deadline} onChange={(e) => setP(pi, (x) => ({ ...x, deadline: e.target.value }))} />
              </div>
              {p.ringkas !== '' && <div className="lo-row">
                <span className="lo-lbl">Satu baris</span>
                <input className="inp" value={p.ringkas} onChange={(e) => setP(pi, (x) => ({ ...x, ringkas: e.target.value.toUpperCase() }))} placeholder="mis. WO TURUN TGL ..., BELUM START PENGERJAAN" />
                <button className="loBtn ib del" type="button" title="Hapus baris pendek (tampilkan daftar panel)" onClick={() => setP(pi, (x) => ({ ...x, ringkas: '' }))}>×</button>
              </div>}
              {p.ringkas !== '' && <div className="lo-meta">Baris pendek menggantikan daftar panel di laporan.</div>}
              {p.kendalaUmum.map((k, ki) => (
                <BarisKendala key={k.id} k={k} label="Kendala umum" placeholder="Kendala proyek" tampilTeratasi={draf.tampilTeratasi !== false}
                  onTeks={(t) => setP(pi, (x) => ({ ...x, kendalaUmum: x.kendalaUmum.map((v, i) => (i === ki ? { ...v, teks: t } : v)) }))}
                  onHapus={() => setP(pi, (x) => ({ ...x, kendalaUmum: x.kendalaUmum.filter((_, i) => i !== ki) }))} />
              ))}
              {p.ringkas === '' && p.panels.map((n, ni) => (
                <div className="lo-pbox" key={n.id} data-b={n.id}>
                  <div className="lo-row">
                    {n.src !== p.src && <Src s={n.src} />}
                    <input className="inp" style={{ fontWeight: 600 }} placeholder="Nama panel (kosongkan jika tidak ada)" value={n.nama} onChange={(e) => setN(pi, ni, (x) => ({ ...x, nama: e.target.value }))} />
                    <button className="loBtn ib" type="button" title="Naik" onClick={() => setP(pi, (x) => ({ ...x, panels: geser(x.panels, ni, -1) }))}>↑</button>
                    <button className="loBtn ib" type="button" title="Turun" onClick={() => setP(pi, (x) => ({ ...x, panels: geser(x.panels, ni, 1) }))}>↓</button>
                    <button className="loBtn ib del" type="button" title="Hapus panel" onClick={() => setP(pi, (x) => ({ ...x, panels: x.panels.filter((_, i) => i !== ni) }))}>×</button>
                  </div>
                  {n.pekerjaan.map((j, ji) => (
                    <div className="lo-row" key={j.id} data-b={j.id}>
                      <input className="chk" type="checkbox" title="Selesai hari ini (✅)" checked={j.selesai} onChange={(e) => setN(pi, ni, (x) => ({ ...x, pekerjaan: x.pekerjaan.map((v, i) => (i === ji ? { ...v, selesai: e.target.checked } : v)) }))} />
                      <input className="inp" value={j.teks} placeholder="Pekerjaan outstanding" onChange={(e) => setN(pi, ni, (x) => ({ ...x, pekerjaan: x.pekerjaan.map((v, i) => (i === ji ? { ...v, teks: e.target.value.toUpperCase() } : v)) }))} />
                      <button className="loBtn ib mv" type="button" title="Naik" onClick={() => setN(pi, ni, (x) => ({ ...x, pekerjaan: geser(x.pekerjaan, ji, -1) }))}>↑</button>
                      <button className="loBtn ib mv" type="button" title="Turun" onClick={() => setN(pi, ni, (x) => ({ ...x, pekerjaan: geser(x.pekerjaan, ji, 1) }))}>↓</button>
                      <button className="loBtn ib del" type="button" title="Hapus" onClick={() => setN(pi, ni, (x) => ({ ...x, pekerjaan: x.pekerjaan.filter((_, i) => i !== ji) }))}>×</button>
                    </div>
                  ))}
                  {n.kendala.map((k, ki) => (
                    <BarisKendala key={k.id} k={k} label="Kendala" placeholder="Catatan kendala" tampilTeratasi={draf.tampilTeratasi !== false}
                      onTeks={(t) => setN(pi, ni, (x) => ({ ...x, kendala: x.kendala.map((v, i) => (i === ki ? { ...v, teks: t } : v)) }))}
                      onHapus={() => setN(pi, ni, (x) => ({ ...x, kendala: x.kendala.filter((_, i) => i !== ki) }))} />
                  ))}
                  <div className="lo-links">
                    <button className="loBtn lnk" type="button" onClick={() => setN(pi, ni, (x) => ({ ...x, pekerjaan: [...x.pekerjaan, { id: idBaru(), teks: '', selesai: false }] }))}>+ Pekerjaan</button>
                    <button className="loBtn lnk" type="button" onClick={() => setN(pi, ni, (x) => ({ ...x, kendala: [...x.kendala, { id: idBaru(), teks: '' }] }))}>+ Kendala</button>
                  </div>
                </div>
              ))}
              <div className="lo-links">
                {p.ringkas === '' && <button className="loBtn lnk" type="button" onClick={() => setP(pi, (x) => ({ ...x, panels: [...x.panels, panelManualBaru()] }))}>+ Tambah panel</button>}
                <button className="loBtn lnk" type="button" onClick={() => setP(pi, (x) => ({ ...x, kendalaUmum: [...x.kendalaUmum, { id: idBaru(), teks: '' }] }))}>+ Kendala umum</button>
                {p.src === 'otomatis' && p.ringkas === '' && (draf.varian || 'V2') !== 'V1' && p.panels.some((n) => n.pekerjaanSemua) && <button className="loBtn lnk" type="button"
                  onClick={() => { if (!window.confirm('Ganti daftar pekerjaan proyek ini? Edit pekerjaan pada panel otomatis proyek ini akan diganti.')) return
                    setP(pi, (x) => ({ ...x, semua: !x.semua, panels: x.panels.map((n) => (n.pekerjaanSemua ? { ...n, pekerjaan: [...(!x.semua ? n.pekerjaanSemua : n.pekerjaanRingkas || []).map((j) => ({ ...j, id: idBaru() })), ...n.pekerjaan.filter(kosong)] } : n)) })) }}>
                  {p.semua ? `Ringkas lagi (aturan ${draf.varian})` : 'Tampilkan semua proses terjadwal'}</button>}
                {p.ringkas === '' && <button className="loBtn lnk" type="button" onClick={() => setP(pi, (x) => ({ ...x, ringkas: `WO TURUN TGL ${fmtTglLaporan(draf.tanggal)}, BELUM START PENGERJAAN` }))}>Ganti jadi satu baris</button>}
              </div>
            </div>
          ))}

          <div className="lo-sec">Catatan (di luar proyek)</div>
          <div className="lo-card">
            <div className="lo-meta">Kebutuhan umum di luar WO (beli material, sewa alat, pengiriman). Tampil di bagian “NOTE :” teks WhatsApp.</div>
            {draf.catatan.map((c, ci) => (
              <div className="lo-row" key={c.id} data-b={c.id}>
                <span className="lo-lbl" style={{ width: 20, textAlign: 'right' }}>{ci + 1}.</span>
                <input className="inp" value={c.teks} placeholder="Tulis catatan" onChange={(e) => ubah((d) => ({ ...d, catatan: d.catatan.map((v, i) => (i === ci ? { ...v, teks: e.target.value.toUpperCase() } : v)) }))} />
                <button className="loBtn ib" type="button" title="Naik" onClick={() => ubah((d) => ({ ...d, catatan: geser(d.catatan, ci, -1) }))}>↑</button>
                <button className="loBtn ib" type="button" title="Turun" onClick={() => ubah((d) => ({ ...d, catatan: geser(d.catatan, ci, 1) }))}>↓</button>
                <button className="loBtn ib del" type="button" title="Hapus" onClick={() => ubah((d) => ({ ...d, catatan: d.catatan.filter((_, i) => i !== ci) }))}>×</button>
              </div>
            ))}
            <div className="lo-links"><button className="loBtn lnk" type="button" onClick={() => ubah((d) => ({ ...d, catatan: [...d.catatan, { id: idBaru(), teks: '' }] }))}>+ Tambah catatan</button></div>
          </div>

          <div className="lo-sec">Prioritas Pengerjaan Minggu Ini</div>
          <div className="lo-meta" style={{ marginBottom: 6 }}>Draf otomatis dari Raw Schedule Senin–Sabtu minggu ini (panel yang punya pekerjaan belum selesai), urut deadline terdekat. Bisa diedit.</div>
          {draf.prioritas.map((r, ri) => (
            <div className="lo-card" key={r.id} data-b={r.id}>
              <div className="lo-row">
                <input className="inp nm" value={r.nama} placeholder="NAMA PROYEK" onChange={(e) => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, nama: e.target.value.toUpperCase() } : v)) }))} />
                <button className="loBtn ib" type="button" title="Naik" onClick={() => ubah((d) => ({ ...d, prioritas: geser(d.prioritas, ri, -1) }))}>↑</button>
                <button className="loBtn ib" type="button" title="Turun" onClick={() => ubah((d) => ({ ...d, prioritas: geser(d.prioritas, ri, 1) }))}>↓</button>
                <button className="loBtn ib del" type="button" title="Hapus" onClick={() => ubah((d) => ({ ...d, prioritas: d.prioritas.filter((_, i) => i !== ri) }))}>×</button>
              </div>
              <div className="lo-row wrap"><span className="lo-lbl">Deadline</span><input className="inp dt" type="date" value={r.deadline} onChange={(e) => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, deadline: e.target.value } : v)) }))} /></div>
              {r.panels.map((x, xi) => (
                <div className="lo-row" key={xi}>
                  <span className="lo-lbl" style={{ width: 20, textAlign: 'right' }}>{xi + 1}.</span>
                  <input className="inp" value={x} placeholder="Nama panel" onChange={(e) => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, panels: v.panels.map((y, k) => (k === xi ? e.target.value : y)) } : v)) }))} />
                  <button className="loBtn ib" type="button" title="Naik" onClick={() => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, panels: geser(v.panels, xi, -1) } : v)) }))}>↑</button>
                  <button className="loBtn ib" type="button" title="Turun" onClick={() => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, panels: geser(v.panels, xi, 1) } : v)) }))}>↓</button>
                  <button className="loBtn ib del" type="button" title="Hapus" onClick={() => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, panels: v.panels.filter((_, k) => k !== xi) } : v)) }))}>×</button>
                </div>
              ))}
              <div className="lo-links"><button className="loBtn lnk" type="button" onClick={() => ubah((d) => ({ ...d, prioritas: d.prioritas.map((v, i) => (i === ri ? { ...v, panels: [...v.panels, ''] } : v)) }))}>+ Panel</button></div>
            </div>
          ))}
          <div className="lo-links"><button className="loBtn lnk" type="button" onClick={() => ubah((d) => ({ ...d, prioritas: [...d.prioritas, { id: idBaru(), nama: '', deadline: '', panels: [''] }] }))}>+ Tambah proyek prioritas</button></div>
        </section>}

        {tab === 'berkop' && <PratinjauBerkop draf={draf} bentrok={Object.keys(lb.peringatan)} fokusBagian={lb.fokusBagian} lepasBagian={lb.lepasBagian}
          onUbah={(id, f, v) => ubah((d) => setKolomBagian(d, id, f, v))} />}
        {tab === 'riwayat' && header && <RiwayatLaporan db={db} user={user} laporanId={header.id} onBerubah={lb.muat} />}

        {tab === 'wa' && <section className="lo-wa">
          <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
            <div className="lo-hint">Bisa diedit langsung sebelum disalin - satu teks bersama utk semua admin (terakhir menang, versi sebelumnya di riwayat). Selama belum diedit, teks ini mengikuti penyusun. Setelah diedit, perubahan di penyusun tidak menimpa teks ini; pakai “Buat ulang teks”. Tempel ke grup <b>Perencanaan Vista</b>.</div>
            <div className="lo-act">
              <button className="loBtn" type="button" onClick={buatUlangTeks} disabled={!diedit && teksWa === formatTeksWhatsApp(draf)}>Buat ulang teks</button>
              <button className="loBtn pri" type="button" onClick={salinTeks}>{salin || 'Salin teks'}</button>
            </div>
          </div>
          <div data-b={ID_TEKS_WA}><KotakTeksWa label={`Teks ${judulLaporan(draf.tanggal, draf.jam)}`} value={teksWa} onChange={(t) => lb.setTeksWa(t)} /></div>
        </section>}
      </>}
    </div>
  )
}

function PemilihArsip({ picker, setPicker, sudahAda, onMasuk }: {
  picker: { memuat: boolean; galat?: string; grup: GrupArsip[]; pilih: Set<number>; hanyaBelum: boolean }
  setPicker: (f: any) => void; sudahAda: Set<number>; onMasuk: () => void
}) {
  const tampil = (p: PanelArsip) => !picker.hanyaBelum || p.belumTuntas
  const grup = picker.grup.map((g) => ({ ...g, panels: g.panels.filter(tampil) })).filter((g) => g.panels.length)
  const toggle = (id: number) => setPicker((s: any) => { const pilih = new Set(s.pilih); if (pilih.has(id)) pilih.delete(id); else pilih.add(id); return { ...s, pilih } })
  return (
    <div className="lo-picker">
      <div className="lo-row wrap" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 14 }}>Ambil dari arsip (60 hari terakhir)</b>
        <label className="lo-row" style={{ fontSize: 13, cursor: 'pointer' }}>
          <input className="chk" type="checkbox" checked={picker.hanyaBelum} onChange={(e) => setPicker((s: any) => ({ ...s, hanyaBelum: e.target.checked }))} /> Hanya panel belum tuntas
        </label>
      </div>
      <div className="lo-meta">Dikelompokkan per nomor WO / proyek. Kondisi panel saat diarsipkan dipakai sebagai draf (sisa pekerjaan), lalu bisa diedit. Panel yang sudah ada di laporan tidak bisa dipilih lagi.</div>
      {picker.memuat && <div className="lo-meta">Memuat arsip…</div>}
      {picker.galat && <div className="lo-err">{picker.galat}</div>}
      {!picker.memuat && !picker.galat && grup.length === 0 && <div className="lo-meta">Tidak ada panel arsip{picker.hanyaBelum ? ' yang belum tuntas' : ''} dalam 60 hari terakhir.</div>}
      {grup.map((g) => (
        <div className="lo-arc" key={g.kunci}>
          <div><b>{g.proyek || '(tanpa nama)'}</b> <span className="lo-meta">· WO {g.wo || '-'} · deadline {g.targets.length ? g.targets.map(tglPendek).join(' / ') : '-'}</span></div>
          {g.panels.map((p) => {
            const ada = sudahAda.has(p.id)
            const sisa = p.pekerjaan.filter((j) => !j.selesai).map((j) => j.teks)
            return (
              <label key={p.id} className={ada ? 'off' : ''}>
                <input className="chk" type="checkbox" disabled={ada} checked={ada || picker.pilih.has(p.id)} onChange={() => toggle(p.id)} />
                <span>{p.nama} <span className="lo-meta">· diarsipkan {tglPendek(tanggalWibDari(p.diarsipkanPada))} · snapshot {p.snapshot}%{ada ? ' · sudah di laporan' : ''}</span>
                  <br /><span className="lo-meta">{sisa.length ? 'Sisa: ' + sisa.join(', ') : 'Tidak ada sisa pekerjaan terjadwal'}</span></span>
              </label>
            )
          })}
        </div>
      ))}
      <div className="lo-row">
        <button className="loBtn pri" type="button" onClick={onMasuk} disabled={!picker.pilih.size}>Masukkan ke laporan{picker.pilih.size ? ` (${picker.pilih.size})` : ''}</button>
        <button className="loBtn" type="button" onClick={() => setPicker(null)}>Batal</button>
      </div>
    </div>
  )
}

// Baris kendala (Opsi B, keputusan user): teks di kiri; kolom kanan "Divisi · Nama" + tanggal dicatat; kendala teratasi
// mendapat baris hijau "✓ Teratasi tgl bln" (tanggal = hari kerja WIB dari kendala_produksi.teratasi_pada).
const BLN3K = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const tglK = (iso?: string) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${Number(d)} ${BLN3K[Number(m) - 1]}` }
function BarisKendala({ k, label, placeholder, tampilTeratasi, onTeks, onHapus }: {
  k: KendalaLap; label: string; placeholder: string; tampilTeratasi: boolean; onTeks: (t: string) => void; onHapus: () => void
}) {
  const siapa = [k.divisi, k.oleh].filter(Boolean).join(' · ')
  return (
    <div className={'lo-kd' + (k.teratasi ? ' ok' : '') + (k.teratasi && !tampilTeratasi ? ' off' : '')} data-b={k.id}>
      <div className="lo-row">
        <span className="lo-kt">{label}</span>
        <input className="inp" value={k.teks} placeholder={placeholder} onChange={(e) => onTeks(e.target.value.toUpperCase())} />
        <button className="loBtn ib del" type="button" title="Hapus dari laporan" onClick={onHapus}>×</button>
      </div>
      {(siapa || k.tanggal || k.teratasi) && <div className="lo-kd-m">
        <span className="ter">{k.teratasi ? <>✓ Teratasi {tglK(k.teratasi)}{!tampilTeratasi && ' · tidak ikut laporan'}</> : ''}</span>
        <span className="siapa">{siapa}{k.tanggal ? <span className="tg">{tglK(k.tanggal)}</span> : null}</span>
      </div>}
    </div>
  )
}

// Tab "Tampilan berkop" (Tahap B): pratinjau = HTML yang SAMA PERSIS dgn jendela cetak (lib/laporanOutstandingBerkop),
// ditampilkan di iframe selebar A4 lalu diperkecil agar muat lebar layar (tanpa scroll ke samping).
const LEBAR_A4_PX = 794 // 210 mm @96dpi
// (S2, 31 Okt 2026) EDIT LANGSUNG di tampilan berkop: teks bertanda data-b/data-f (lib htmlDokumenLaporan edit) bisa diketik.
// - iframe TIDAK dimuat ulang saat teks berubah (milik sendiri / admin lain): teks ditambal per elemen, elemen yang sedang
//   difokus tidak disentuh (kursor tidak loncat). Dimuat ulang hanya bila KERANGKA berubah (bagian ditambah/dihapus/diurut,
//   selesai/teratasi, kosong<->terisi), dan itu ditunda sampai tidak ada yang sedang diedit.
// - fokus/lepas diteruskan ke perlindungan useLaporanBersama (fokus di iframe tidak merambat ke halaman).
// - Enter = selesai mengedit; tempel = teks polos. Huruf besar diterapkan seperti di Susun & edit (kecuali nama panel).
function PratinjauBerkop({ draf, bentrok, onUbah, fokusBagian, lepasBagian }: {
  draf: DrafLaporan; bentrok: string[]; onUbah: (id: string, f: string, v: string) => void
  fokusBagian: (id: string | null) => void; lepasBagian: (keId: string | null) => void
}) {
  const ifr = useRef<HTMLIFrameElement | null>(null)
  const [html, setHtml] = useState(() => htmlHalamanBerkop(draf, { pratinjau: true, edit: true }))
  const kerangka = useRef(kerangkaDokumen(draf))
  const drafTerakhir = useRef(draf), tunda = useRef(false)
  const cb = useRef({ onUbah, fokusBagian, lepasBagian })
  useEffect(() => { cb.current = { onUbah, fokusBagian, lepasBagian } })
  const wadah = useRef<HTMLDivElement | null>(null)
  const [lebar, setLebar] = useState(LEBAR_A4_PX)
  const [tinggi, setTinggi] = useState(1123)
  useEffect(() => {
    const el = wadah.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setLebar(el.clientWidth)); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const skala = Math.min(1, lebar / (LEBAR_A4_PX + 40))
  const dok = () => { try { return ifr.current?.contentDocument || null } catch { return null } }
  const ukur = () => { const d = dok(); if (d?.body) setTinggi(Math.max(d.documentElement.scrollHeight, d.body.scrollHeight) + 24) }
  // tambal teks semua elemen kecuali yang sedang difokus + tanda bentrok
  const tambal = (dr: DrafLaporan) => {
    const d = dok(); if (!d) return
    const nilai = nilaiKolomBagian(dr), aktif = d.activeElement
    d.querySelectorAll<HTMLElement>('[data-b][data-f]').forEach((el) => {
      if (el === aktif) return
      const v = nilai.get(el.dataset.b + '|' + el.dataset.f) ?? ''
      if (el.textContent !== v) el.textContent = v
    })
    d.querySelectorAll('.lo-bentrok').forEach((x) => x.classList.remove('lo-bentrok'))
    bentrok.forEach((id) => d.querySelectorAll(`[data-b="${id.replace(/"/g, '')}"]`).forEach((x) => x.classList.add('lo-bentrok')))
  }
  const muatUlangBilaPerlu = (dr: DrafLaporan) => {
    const k = kerangkaDokumen(dr)
    if (k === kerangka.current) { tambal(dr); return }
    const d = dok()
    if (d?.activeElement?.hasAttribute?.('data-b')) { tunda.current = true; tambal(dr); return }
    kerangka.current = k; tunda.current = false; setHtml(htmlHalamanBerkop(dr, { pratinjau: true, edit: true }))
  }
  // tiap render (draf / bentrok berubah): tambal teks, atau muat ulang iframe bila kerangka berubah (sinkronisasi ke DOM iframe)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { drafTerakhir.current = draf; muatUlangBilaPerlu(draf) })
  const pasang = () => {
    const d = dok(); if (!d) return
    ukur(); tambal(drafTerakhir.current)
    const idDari = (t: EventTarget | null) => ((t as HTMLElement | null)?.closest?.('[data-b]') as HTMLElement | null)
    d.addEventListener('input', (e) => {
      const el = idDari(e.target); if (!el?.dataset.b || !el.dataset.f) return
      // saat mengetik teks dikirim APA ADANYA (hanya NBSP contenteditable -> spasi biasa, baris baru -> spasi); TIDAK dipangkas
      // agar spasi di tengah/akhir yang sedang diketik tetap (keputusan user 31 Okt). Pemangkasan awal/akhir = saat fokus lepas.
      const teks = (el.textContent || '').replace(/00a0/g, ' ').replace(/[\r\n]+/g, ' ')
      cb.current.onUbah(el.dataset.b, el.dataset.f, el.classList.contains('pnm') ? teks : teks.toUpperCase())
    })
    d.addEventListener('focusin', (e) => cb.current.fokusBagian(idDari(e.target)?.dataset.b || null))
    d.addEventListener('focusout', (e) => {
      // pangkas spasi awal/akhir SEBELUM lepasBagian memicu simpan (kolom sudah tidak diketik)
      const el = idDari(e.target)
      if (el?.dataset.b && el.dataset.f) {
        const v = (el.textContent || '').replace(/00a0/g, ' ').replace(/[\r\n]+/g, ' ')
        if (v.trim() !== v) cb.current.onUbah(el.dataset.b, el.dataset.f, el.classList.contains('pnm') ? v.trim() : v.trim().toUpperCase())
      }
      cb.current.lepasBagian(idDari((e as FocusEvent).relatedTarget)?.dataset.b || null)
      setTimeout(() => { if (tunda.current) muatUlangBilaPerlu(drafTerakhir.current); else tambal(drafTerakhir.current); ukur() }, 0)
    })
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur() } })
    d.addEventListener('paste', (e) => { e.preventDefault(); const t = e.clipboardData?.getData('text/plain') || ''; d.execCommand('insertText', false, t.replace(/\s+/g, ' ')) })
  }
  return (
    <section>
      <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <div className="lo-hint">Pratinjau dokumen berkop - <b>klik teks untuk mengedit langsung</b> (nama proyek/panel, pekerjaan, kendala, catatan; Enter = selesai). Tersimpan otomatis ke laporan bersama. Kop penuh di halaman 1, kop ringkas di halaman berikutnya. Untuk PDF: klik “Cetak / Simpan PDF”, lalu pilih <b>Simpan sebagai PDF</b>.</div>
        <div className="lo-act"><button className="loBtn pri" type="button" onClick={() => cetakLaporanBerkop(draf)}>Cetak / Simpan PDF</button></div>
      </div>
      <div ref={wadah} style={{ width: '100%', overflow: 'hidden', height: tinggi * skala }}>
        <iframe ref={ifr} title="Pratinjau laporan berkop" srcDoc={html} onLoad={pasang} scrolling="no"
          style={{ width: LEBAR_A4_PX + 40, height: tinggi, border: 0, transform: `scale(${skala})`, transformOrigin: '0 0', display: 'block' }} />
      </div>
    </section>
  )
}

// Kotak teks WhatsApp (perbaikan 23 Okt 2026 - dulu tinggi tetap, baris terakhir terpotong & harus digulir di dalam kotak):
// tinggi mengikuti isi (diukur ulang saat isi berubah, saat tab dibuka/komponen dipasang, dan saat jendela diubah ukurannya),
// dibatasi max-height CSS calc(100vh - 220px) - gulir di dalam kotak hanya bila melewati batas itu. Baris panjang dilipat
// (pre-wrap). Tetap bisa diedit & resize vertikal; id "lo-wa-ta" dipakai cadangan "Salin teks".
function KotakTeksWa({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const ukur = () => {
    const el = ref.current; if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px` // dibatasi max-height CSS
  }
  useLayoutEffect(ukur, [value])
  useEffect(() => {
    window.addEventListener('resize', ukur)
    return () => window.removeEventListener('resize', ukur)
  }, [])
  const baris = value ? value.split('\n').length : 0
  return (
    <>
      <textarea ref={ref} id="lo-wa-ta" spellCheck={false} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
      <div className="hit">{baris} baris · {value.length} karakter</div>
    </>
  )
}
