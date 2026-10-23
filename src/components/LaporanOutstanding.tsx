// LAPORAN OUTSTANDING - PENYUSUN (Tahap A, 23 Okt 2026). Acuan UI: artifact pratinjau "Laporan Outstanding" (tab "Susun &
// edit" & "Teks WhatsApp"; "Tampilan berkop"/PDF = Tahap B, belum). Semua isi dari SATU draf (lib/laporanOutstanding
// DrafLaporan) - teks WhatsApp dibentuk HANYA oleh formatTeksWhatsApp(draf).
// - "Buat laporan": muat ulang WO aktif + Raw Schedule + kendala (terbuka + baru teratasi, lib kendalaMasukLaporan), susun ulang bagian OTOMATIS & prioritas;
//   entri Arsip, Manual, dan Catatan dipertahankan.
// - Teks WhatsApp mengikuti draf selama belum diedit. Setelah diedit tangan (badge "Diedit"), perubahan di penyusun TIDAK
//   menimpanya - hanya "Buat ulang teks" (dengan konfirmasi).
// - Draf disimpan di localStorage perangkat ini (keputusan user, tanpa tabel); gagal simpan -> tetap jalan + peringatan.
// - TIDAK menulis apa pun ke database (hanya select). Penanda sumber (Otomatis/Arsip/Manual) hanya di layar ini.
// Tombol ber-class "loBtn": aturan global mode gelap `[data-theme=dark] button:not([class*="Btn"])` tidak menimpanya.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react'
import { muatKendala } from '../lib/kendalaProduksi'
import { laporError } from '../lib/laporError'
import { hariKerjaWib, tanggalWibDari } from '../lib/tanggalWib'
import { cetakLaporanBerkop, htmlHalamanBerkop } from '../lib/laporanOutstandingBerkop'
import {
  buatLaporanOutstanding, formatTeksWhatsApp, muatBahanOtomatis, muatPilihanArsip, proyekDariArsip, panelIdsDalamDraf,
  proyekManualBaru, panelManualBaru, idBaru, bacaSimpanan, tulisSimpanan, fmtTglLaporan, judulLaporan, HARI_TAMPIL_TERATASI,
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
.lo-wa textarea{width:100%;min-height:460px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px;line-height:1.6;padding:12px;white-space:pre;overflow:auto}
.lo-empty{padding:40px 16px;color:var(--lo-mute);text-align:center;border:1px dashed var(--lo-line);border-radius:10px}
.lo-kd{display:flex;flex-direction:column;gap:2px}
.lo-kd-m{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--lo-mute);padding-left:4px}
.lo-kd-m .siapa{margin-left:auto;text-align:right}
.lo-kd-m .tg{margin-left:10px;font-variant-numeric:tabular-nums}
.lo-kd-m .ter{color:var(--lo-ok);font-weight:600}
.lo-kd.off{opacity:.5}
@media (max-width:640px){.lo .inp.dt{width:132px}.lo-row{gap:4px}.lo .loBtn.ib{width:26px;height:28px}.lo .loBtn.ib.mv{display:none}.lo-pbox{padding:7px}.lo-card{padding:9px}}
`

type Tab = 'susun' | 'berkop' | 'wa'
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
  const awal = useMemo(() => bacaSimpanan(nama), [nama])
  const [draf, setDraf] = useState<DrafLaporan | null>(awal?.draf || null)
  const [teksWa, setTeksWa] = useState(awal?.teksWa || '')
  const [teksSistem, setTeksSistem] = useState(awal?.teksSistem || '')
  const [tab, setTab] = useState<Tab>('susun')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [simpanGagal, setSimpanGagal] = useState(false)
  // semua kendala tidak terhapus (terbuka + teratasi) - penyaringan teratasi di lib (kendalaMasukLaporan)
  const [kendala, setKendala] = useState<KendalaSumber[] | null>(null)
  const [picker, setPicker] = useState<{ memuat: boolean; galat?: string; grup: GrupArsip[]; pilih: Set<number>; hanyaBelum: boolean } | null>(null)
  const [salin, setSalin] = useState('')
  const diedit = teksWa !== teksSistem

  // draf berubah -> teks WA ikut HANYA bila belum diedit tangan
  const ubah = (f: (d: DrafLaporan) => DrafLaporan) => setDraf((d) => (d ? f(d) : d))
  const terakhirDraf = useRef<DrafLaporan | null>(draf)
  useEffect(() => {
    if (!draf || terakhirDraf.current === draf) return
    terakhirDraf.current = draf
    const sys = formatTeksWhatsApp(draf)
    if (!diedit) { setTeksWa(sys); setTeksSistem(sys) }
  }, [draf, diedit])
  useEffect(() => {
    if (!draf) return
    setSimpanGagal(!tulisSimpanan(nama, { draf, teksWa, teksSistem }))
  }, [draf, teksWa, teksSistem, nama])

  // Varian aturan pekerjaan (UJI, belum dikunci - lib/laporanOutstanding Varian). Bawaan V2 (keputusan sementara user 23 Okt).
  const [varian, setVarian] = useState<Varian>(awal?.draf?.varian || 'V2')
  const buat = async (v: Varian = varian) => {
    if (draf && !window.confirm('Susun ulang bagian Otomatis dan Prioritas dari data terbaru?\nEdit pada entri Otomatis & Prioritas akan diganti. Entri Arsip, Manual, dan Catatan tetap.' + (diedit ? '\n\nTeks WhatsApp yang sudah Anda edit TIDAK diubah (pakai "Buat ulang teks").' : ''))) return
    setSibuk(true); setGalat(null)
    try {
      const [bahan, kd] = await Promise.all([muatBahanOtomatis(db), muatKendala(db)])
      const k = kd as KendalaSumber[]
      setKendala(k)
      const baru = buatLaporanOutstanding({ ...bahan, kendala: k, varian: v, jam: draf && draf.tanggal === hariKerjaWib() ? draf.jam : undefined }, draf)
      setVarian(v)
      if (!draf) { const sys = formatTeksWhatsApp(baru); setTeksWa(sys); setTeksSistem(sys); terakhirDraf.current = baru }
      setDraf(baru)
    } catch (e: any) {
      console.error('[Laporan Outstanding] gagal memuat data:', e); laporError('supabase_error', e, { aksi: 'buat laporan outstanding' })
      setGalat('Gagal memuat data laporan: ' + (e?.message || e))
    } finally { setSibuk(false) }
  }
  const buatUlangTeks = () => {
    if (!draf) return
    if (diedit && !window.confirm('Teks WhatsApp sudah Anda edit. Buat ulang dari penyusun? Edit teks akan hilang.')) return
    const sys = formatTeksWhatsApp(draf); setTeksWa(sys); setTeksSistem(sys)
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

  // ----- edit helper -----
  const setP = (pi: number, f: (p: ProyekLap) => ProyekLap) => ubah((d) => ({ ...d, proyek: d.proyek.map((p, i) => (i === pi ? f(p) : p)) }))
  const setN = (pi: number, ni: number, f: (n: PanelLap) => PanelLap) => setP(pi, (p) => ({ ...p, panels: p.panels.map((n, i) => (i === ni ? f(n) : n)) }))
  const jumlahNonOtomatis = (draf?.proyek || []).filter((p) => p.src !== 'otomatis').length

  return (
    <div className="lo">
      <style>{CSS}</style>
      <div className="lo-top">
        <div>
          <h1>Laporan Outstanding</h1>
          <div className="lo-sub">{draf ? <>Laporan {tglPanjang(draf.tanggal)} · dibuat {waktuWib(draf.dibuatPada)}</> : 'Belum ada laporan. Klik “Buat laporan” untuk menyusun dari data terbaru.'}</div>
        </div>
        <div className="lo-act">
          {draf && <><span className="lo-lbl">Jam laporan</span><input className="inp jam" value={draf.jam} onChange={(e) => ubah((d) => ({ ...d, jam: e.target.value }))} aria-label="Jam laporan" /></>}
          <span className="lo-lbl">Aturan (uji)</span>
          <select className="inp jam" style={{ width: 'auto', height: 32 }} value={varian} disabled={sibuk} aria-label="Varian aturan pekerjaan (uji)" title="V1: semua proses terjadwal s.d. hari ini · V2: hanya proses aktif + (+N proses menunggu) · V3: seperti V2, digabung per proses"
            onChange={(e) => { const v = e.target.value as Varian; if (draf) buat(v); else setVarian(v) }}>
            <option value="V1">V1 semua terjadwal</option><option value="V2">V2 proses aktif (bawaan)</option><option value="V3">V3 aktif digabung</option>
          </select>
          <button className="loBtn pri" type="button" onClick={() => buat()} disabled={sibuk}>{sibuk ? 'Memuat…' : draf ? 'Buat ulang laporan' : 'Buat laporan'}</button>
        </div>
      </div>
      <div className={'lo-warn' + (simpanGagal ? ' bad' : '')}>
        {simpanGagal ? 'Penyimpanan perangkat tidak tersedia: draf hilang bila halaman ditutup. Salin teks sebelum keluar.' : 'Draf laporan (termasuk entri manual, arsip, dan catatan) tersimpan di perangkat/browser ini saja, tidak di server. Fitur ini tidak mengubah data WO, panel, progres, atau kendala.'}
      </div>
      {draf && draf.tanggal !== hariKerjaWib() && <div className="lo-warn bad">Draf ini untuk {tglPanjang(draf.tanggal)}. Klik “Buat ulang laporan” untuk data hari ini (entri Arsip, Manual, dan Catatan tetap).</div>}
      {galat && <div className="lo-err">{galat} <button className="loBtn lnk" type="button" onClick={() => buat()}>Coba lagi</button></div>}

      {!draf ? <div className="lo-empty">Belum ada draf di perangkat ini.</div> : <>
        <div className="lo-tabs" role="tablist">
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'susun'} onClick={() => setTab('susun')}>Susun &amp; edit{jumlahNonOtomatis > 0 && <span className="lo-badge">{jumlahNonOtomatis} manual/arsip</span>}</button>
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'berkop'} onClick={() => setTab('berkop')}>Tampilan berkop</button>
          <button className="loBtn" role="tab" type="button" aria-selected={tab === 'wa'} onClick={() => setTab('wa')}>Teks WhatsApp{diedit && <span className="lo-badge">Diedit</span>}</button>
        </div>

        {tab === 'susun' && <section>
          <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
            <div className="lo-hint">Edit teks, hapus, atau urutkan ulang. Centang = selesai hari ini (✅). Entri <b>Manual</b> dan <b>Arsip</b> hanya ada di draf ini dan tidak mengubah data WO atau panel. Catatan di luar proyek dan Prioritas ada di bawah.
              <label className="lo-row" style={{ marginTop: 6, cursor: 'pointer', color: 'var(--lo-fg)' }}>
                <input className="chk" type="checkbox" checked={draf.tampilTeratasi !== false} onChange={(e) => ubah((d) => ({ ...d, tampilTeratasi: e.target.checked }))} />
                Tampilkan kendala yang sudah teratasi <span className="lo-meta">(sampai {HARI_TAMPIL_TERATASI} hari kerja sesudah tanggal teratasi)</span>
              </label></div>
            <div className="lo-act">
              <button className="loBtn" type="button" onClick={bukaArsip}>{picker ? 'Tutup arsip' : 'Ambil dari arsip'}</button>
              <button className="loBtn pri" type="button" onClick={() => ubah((d) => ({ ...d, proyek: [...d.proyek, proyekManualBaru()] }))}>+ Tambah proyek</button>
            </div>
          </div>

          {picker && <PemilihArsip picker={picker} setPicker={setPicker} sudahAda={sudahAda} onMasuk={masukkanArsip} />}

          {draf.proyek.length === 0 && <div className="lo-empty">Belum ada proyek. Klik “+ Tambah proyek” atau “Ambil dari arsip”.</div>}
          {draf.proyek.map((p, pi) => (
            <div className="lo-card" key={p.id}>
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
                <div className="lo-pbox" key={n.id}>
                  <div className="lo-row">
                    {n.src !== p.src && <Src s={n.src} />}
                    <input className="inp" style={{ fontWeight: 600 }} placeholder="Nama panel (kosongkan jika tidak ada)" value={n.nama} onChange={(e) => setN(pi, ni, (x) => ({ ...x, nama: e.target.value }))} />
                    <button className="loBtn ib" type="button" title="Naik" onClick={() => setP(pi, (x) => ({ ...x, panels: geser(x.panels, ni, -1) }))}>↑</button>
                    <button className="loBtn ib" type="button" title="Turun" onClick={() => setP(pi, (x) => ({ ...x, panels: geser(x.panels, ni, 1) }))}>↓</button>
                    <button className="loBtn ib del" type="button" title="Hapus panel" onClick={() => setP(pi, (x) => ({ ...x, panels: x.panels.filter((_, i) => i !== ni) }))}>×</button>
                  </div>
                  {n.pekerjaan.map((j, ji) => (
                    <div className="lo-row" key={j.id}>
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
                    setP(pi, (x) => ({ ...x, semua: !x.semua, panels: x.panels.map((n) => (n.pekerjaanSemua ? { ...n, pekerjaan: (!x.semua ? n.pekerjaanSemua : n.pekerjaanRingkas || []).map((j) => ({ ...j, id: idBaru() })) } : n)) })) }}>
                  {p.semua ? `Ringkas lagi (aturan ${draf.varian})` : 'Tampilkan semua proses terjadwal'}</button>}
                {p.ringkas === '' && <button className="loBtn lnk" type="button" onClick={() => setP(pi, (x) => ({ ...x, ringkas: `WO TURUN TGL ${fmtTglLaporan(draf.tanggal)}, BELUM START PENGERJAAN` }))}>Ganti jadi satu baris</button>}
              </div>
            </div>
          ))}

          <div className="lo-sec">Catatan (di luar proyek)</div>
          <div className="lo-card">
            <div className="lo-meta">Kebutuhan umum di luar WO (beli material, sewa alat, pengiriman). Tampil di bagian “NOTE :” teks WhatsApp.</div>
            {draf.catatan.map((c, ci) => (
              <div className="lo-row" key={ci}>
                <span className="lo-lbl" style={{ width: 20, textAlign: 'right' }}>{ci + 1}.</span>
                <input className="inp" value={c} placeholder="Tulis catatan" onChange={(e) => ubah((d) => ({ ...d, catatan: d.catatan.map((v, i) => (i === ci ? e.target.value.toUpperCase() : v)) }))} />
                <button className="loBtn ib" type="button" title="Naik" onClick={() => ubah((d) => ({ ...d, catatan: geser(d.catatan, ci, -1) }))}>↑</button>
                <button className="loBtn ib" type="button" title="Turun" onClick={() => ubah((d) => ({ ...d, catatan: geser(d.catatan, ci, 1) }))}>↓</button>
                <button className="loBtn ib del" type="button" title="Hapus" onClick={() => ubah((d) => ({ ...d, catatan: d.catatan.filter((_, i) => i !== ci) }))}>×</button>
              </div>
            ))}
            <div className="lo-links"><button className="loBtn lnk" type="button" onClick={() => ubah((d) => ({ ...d, catatan: [...d.catatan, ''] }))}>+ Tambah catatan</button></div>
          </div>

          <div className="lo-sec">Prioritas Pengerjaan Minggu Ini</div>
          <div className="lo-meta" style={{ marginBottom: 6 }}>Draf otomatis dari Raw Schedule Senin–Sabtu minggu ini (panel yang punya pekerjaan belum selesai), urut deadline terdekat. Bisa diedit.</div>
          {draf.prioritas.map((r, ri) => (
            <div className="lo-card" key={r.id}>
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

        {tab === 'berkop' && <PratinjauBerkop draf={draf} />}

        {tab === 'wa' && <section className="lo-wa">
          <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
            <div className="lo-hint">Bisa diedit langsung sebelum disalin. Selama belum diedit, teks ini mengikuti penyusun. Setelah diedit, perubahan di penyusun tidak menimpa teks ini; pakai “Buat ulang teks”. Tempel ke grup <b>Perencanaan Vista</b>.</div>
            <div className="lo-act">
              <button className="loBtn" type="button" onClick={buatUlangTeks} disabled={!diedit && teksWa === formatTeksWhatsApp(draf)}>Buat ulang teks</button>
              <button className="loBtn pri" type="button" onClick={salinTeks}>{salin || 'Salin teks'}</button>
            </div>
          </div>
          <textarea id="lo-wa-ta" spellCheck={false} aria-label={`Teks ${judulLaporan(draf.tanggal, draf.jam)}`} value={teksWa} onChange={(e) => setTeksWa(e.target.value)} />
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
    <div className={'lo-kd' + (k.teratasi ? ' ok' : '') + (k.teratasi && !tampilTeratasi ? ' off' : '')}>
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
function PratinjauBerkop({ draf }: { draf: DrafLaporan }) {
  const html = useMemo(() => htmlHalamanBerkop(draf, { pratinjau: true }), [draf])
  const wadah = useRef<HTMLDivElement | null>(null)
  const [lebar, setLebar] = useState(LEBAR_A4_PX)
  const [tinggi, setTinggi] = useState(1123)
  useEffect(() => {
    const el = wadah.current; if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setLebar(el.clientWidth)); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const skala = Math.min(1, lebar / (LEBAR_A4_PX + 40))
  const ukur = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try { const d = e.currentTarget.contentDocument; if (d) setTinggi(Math.max(d.documentElement.scrollHeight, d.body.scrollHeight) + 24) } catch { /* biarkan tinggi bawaan */ }
  }
  return (
    <section>
      <div className="lo-row wrap" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <div className="lo-hint">Pratinjau dokumen berkop dari draf yang sama dengan teks WhatsApp. Kop penuh di halaman 1, kop ringkas di halaman berikutnya. Untuk PDF: klik “Cetak / Simpan PDF”, lalu pilih <b>Simpan sebagai PDF</b> di jendela cetak.</div>
        <div className="lo-act"><button className="loBtn pri" type="button" onClick={() => cetakLaporanBerkop(draf)}>Cetak / Simpan PDF</button></div>
      </div>
      <div ref={wadah} style={{ width: '100%', overflow: 'hidden', height: tinggi * skala }}>
        <iframe title="Pratinjau laporan berkop" srcDoc={html} onLoad={ukur} scrolling="no"
          style={{ width: LEBAR_A4_PX + 40, height: tinggi, border: 0, transform: `scale(${skala})`, transformOrigin: '0 0', display: 'block' }} />
      </div>
    </section>
  )
}
