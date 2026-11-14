// ANIMASI MASUK "MASKOT BERLARI" + LAYAR KONEKSI (14 Nov 2026, logo JRENG Tahap 4, keputusan user - menggantikan
// halaman "Masuk ke Aplikasi"/LandingPage). Lapisan di atas aplikasi: aplikasi/Login sudah dirender & memuat datanya
// sendiri di belakang (tidak diblokir); lapisan ini hanya menunggu cek koneksi ringan (lib/cekKoneksiAwal) lalu
// memudar. Murni CSS + JS kecil, tanpa pustaka. Nama kelas "jrm-*" (tanpa "card"/"modal": aturan gelap globalCss.ts).
// Tombol memakai kelas "jrmBtn" supaya aturan tombol tema gelap (globalCss.ts, :not([class*="Btn"])) tidak menimpa warna.
// Alur: masuk 1,2 s (kecil -> penuh) | siap -> zoom x7 + pudar 0,8 s | 8 s belum siap: "Masih menghubungkan..." |
// 20 s: maskot berhenti + pesan server + Coba lagi / Lanjut tetap | offline: langsung (~1,3 s) pesan jaringan, kembali
// online -> otomatis coba lagi. Ketuk layar = lewati ke tahap berikut (kecuali saat pesan gagal tampil).
// Ayunan kaki = angka yang diuji di scripts/brand/perbaiki_lapisan_jreng.py (depan +-10deg, angkat 8px; belakang +-12deg).
import { useCallback, useEffect, useRef, useState } from 'react'
import { cekKoneksiSupabase } from '../lib/cekKoneksiAwal'

const T_MASUK = 1200
const T_KELUAR = 900
const T_KELUAR_TENANG = 450
const T_LAMBAT = 8000
const T_GAGAL = 20000
const T_JEDA = 1000
const T_OFFLINE = 1300
const T_MAKS_GAMBAR = 1500

type Status = 'normal' | 'lambat' | 'server' | 'offline'
const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms))
const geraknyaDikurangi = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }

const CSS = `
.jrm-latar{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding-bottom:120px;background:linear-gradient(160deg,#0b2a6f,#12338a 60%,#1b4bb8);overflow:hidden;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;transition:opacity .5s ease .35s;cursor:default}
.jrm-latar.keluar{opacity:0;pointer-events:none}
.jrm-maskot{position:relative;width:min(200px,60vw);aspect-ratio:640/643;opacity:0;transform:translateY(-30px) scale(.08)}
.jrm-latar.mulai .jrm-maskot{animation:jrm-masuk 1.2s cubic-bezier(.3,.6,.4,1) forwards}
.jrm-latar.tiba .jrm-maskot{animation:none;opacity:1;transform:none}
.jrm-latar.keluar .jrm-maskot{animation:jrm-keluar .8s ease-in forwards}
.jrm-bob,.jrm-kaki{position:absolute;inset:0}
.jrm-kaki,.jrm-badan{width:100%;height:100%;display:block}
.jrm-badan{position:absolute;inset:0}
.jrm-latar.mulai .jrm-bob{animation:jrm-bob .36s ease-in-out infinite}
.jrm-latar.mulai .jrm-depan{transform-origin:53.1% 50.8%;animation:jrm-depan .72s ease-in-out infinite}
.jrm-latar.mulai .jrm-belakang{transform-origin:62.8% 51.6%;animation:jrm-belakang .72s ease-in-out infinite}
.jrm-bayangan{position:absolute;left:18%;right:18%;bottom:-3%;height:6%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.45),rgba(0,0,0,0))}
.jrm-latar.berhenti .jrm-bob,.jrm-latar.berhenti .jrm-kaki{animation-play-state:paused}
.jrm-latar.berhenti .jrm-maskot{filter:saturate(.45) brightness(.9)}
.jrm-pesan{position:absolute;left:0;right:0;bottom:calc(22px + env(safe-area-inset-bottom,0px));text-align:center;color:#fff;font-size:14px;line-height:1.45;padding:0 16px;min-height:60px}
.jrm-pesan b{display:block;font-size:15px;margin-bottom:4px}
.jrm-redup{color:rgba(255,255,255,.85)}
.jrm-tombol{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.jrm-latar .jrmBtn{min-height:44px;min-width:44px;padding:10px 18px;border:0;border-radius:8px;font:inherit;font-weight:700;cursor:pointer}
.jrm-latar .jrmBtn-utama{background:#f58a07;color:#1b1100}
.jrm-latar .jrmBtn-kedua{background:rgba(255,255,255,.16);color:#fff}
.jrm-latar .jrmBtn:focus-visible{outline:2px solid #fff;outline-offset:2px}
@keyframes jrm-masuk{to{opacity:1;transform:none}}
@keyframes jrm-keluar{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(7)}}
@keyframes jrm-bob{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-7px) rotate(1deg)}}
@keyframes jrm-depan{0%,100%{transform:translateY(-8px) rotate(-10deg)}50%{transform:translateY(0) rotate(10deg)}}
@keyframes jrm-belakang{0%,100%{transform:rotate(12deg)}50%{transform:rotate(-12deg)}}
@keyframes jrm-pudar{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){
  .jrm-latar{transition:opacity .4s ease}
  .jrm-maskot{transform:none}
  .jrm-latar.mulai .jrm-maskot{animation:jrm-pudar .4s ease forwards}
  .jrm-latar.keluar .jrm-maskot{animation:none;opacity:1}
  .jrm-latar.mulai .jrm-bob,.jrm-latar.mulai .jrm-kaki{animation:none}
}`

export default function AnimasiMasuk() {
  const [selesai, setSelesai] = useState(false)
  const [gambar, setGambar] = useState(0)
  const [paksaMulai, setPaksaMulai] = useState(false)
  const [tiba, setTiba] = useState(false)
  const [siap, setSiap] = useState(false)
  const [keluarManual, setKeluar] = useState(false)
  const [status, setStatus] = useState<Status>('normal')
  const [putaran, setPutaran] = useState(0)
  const [tenang] = useState(geraknyaDikurangi)
  const gagal = status === 'server' || status === 'offline'
  // Mulai bergerak setelah ketiga lapisan termuat (atau paling lama 1,5 s - jangan menahan).
  const mulai = gambar >= 3 || paksaMulai
  // Siap + maskot sudah sampai + tidak ada pesan gagal -> keluar otomatis (atau Lanjut tetap / ketuk).
  const keluar = keluarManual || (siap && tiba && !gagal)

  useEffect(() => { const t = setTimeout(() => setPaksaMulai(true), T_MAKS_GAMBAR); return () => clearTimeout(t) }, [])
  useEffect(() => {
    if (!mulai || tiba) return
    const t = setTimeout(() => setTiba(true), tenang ? 400 : T_MASUK)
    return () => clearTimeout(t)
  }, [mulai, tiba, tenang])

  // Cek koneksi: satu percobaan dibiarkan berjalan (server lambat tetap ditunggu) sampai batas 20 s; percobaan yang GAGAL
  // cepat (galat jaringan/HTTP bukan 2xx) diulang setelah jeda 1 s. 8 s -> "Masih menghubungkan"; 20 s -> gagal server.
  useEffect(() => {
    let batal = false
    const induk = new AbortController()
    const tLambat = setTimeout(() => { if (!batal) setStatus((s) => (s === 'normal' ? 'lambat' : s)) }, T_LAMBAT)
    const tGagal = setTimeout(() => { if (batal) return; batal = true; induk.abort(); setStatus((s) => (s === 'offline' ? s : 'server')) }, T_GAGAL)
    const tOffline = setTimeout(() => { if (!batal && !navigator.onLine) setStatus('offline') }, putaran === 0 ? T_OFFLINE : 300)
    ;(async () => {
      while (!batal) {
        if (!navigator.onLine) { await tunggu(500); continue }
        let ok: boolean
        try { ok = await cekKoneksiSupabase(induk.signal) } catch { ok = false }
        if (batal) return
        if (ok) {
          batal = true
          clearTimeout(tLambat); clearTimeout(tGagal); clearTimeout(tOffline)
          setStatus((s) => (s === 'offline' ? s : 'normal'))
          setSiap(true)
          return
        }
        await tunggu(T_JEDA)
      }
    })()
    return () => { batal = true; induk.abort(); clearTimeout(tLambat); clearTimeout(tGagal); clearTimeout(tOffline) }
  }, [putaran])

  const cobaLagi = useCallback(() => { setStatus('normal'); setSiap(false); setPutaran((p) => p + 1) }, [])
  const lanjut = useCallback(() => { setStatus('normal'); setKeluar(true) }, [])

  // Jaringan putus -> pesan langsung; tersambung lagi saat pesan jaringan tampil -> otomatis coba lagi.
  const statusRef = useRef<Status>(status)
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => {
    const putus = () => { if (!keluar) setStatus('offline') }
    const sambung = () => { if (statusRef.current === 'offline') cobaLagi() }
    window.addEventListener('offline', putus)
    window.addEventListener('online', sambung)
    return () => { window.removeEventListener('offline', putus); window.removeEventListener('online', sambung) }
  }, [keluar, cobaLagi])

  useEffect(() => {
    if (!keluar) return
    const t = setTimeout(() => setSelesai(true), tenang ? T_KELUAR_TENANG : T_KELUAR)
    return () => clearTimeout(t)
  }, [keluar, tenang])

  // Ketuk = lewati ke tahap berikut (bukan saat pesan gagal tampil - tombolnya yang berlaku).
  const ketuk = () => {
    if (gagal) return
    if (keluar) { setSelesai(true); return }
    if (!tiba) { setPaksaMulai(true); setTiba(true); return }
    if (siap) setKeluar(true)
  }

  if (selesai) return null
  const kelas = ['jrm-latar', mulai ? 'mulai' : '', tiba ? 'tiba' : '', keluar ? 'keluar' : '', gagal ? 'berhenti' : ''].filter(Boolean).join(' ')
  const muat = () => setGambar((n) => n + 1)
  return (
    <div className={kelas} onPointerDown={ketuk} role="dialog" aria-label="Membuka aplikasi Vista Teknik" aria-busy={!gagal && !keluar}>
      <style>{CSS}</style>
      <div className="jrm-maskot">
        <div className="jrm-bob">
          <img className="jrm-kaki jrm-belakang" src="/brand/anim/kaki-belakang.png" alt="" draggable={false} onLoad={muat} onError={muat} />
          <img className="jrm-badan" src="/brand/anim/base.png" alt="JRENG by PT. Vista Inti Teknik" draggable={false} onLoad={muat} onError={muat} />
          <img className="jrm-kaki jrm-depan" src="/brand/anim/kaki-depan.png" alt="" draggable={false} onLoad={muat} onError={muat} />
          <div className="jrm-bayangan" />
        </div>
      </div>
      <div className="jrm-pesan" role="status" aria-live="polite">
        {status === 'lambat' && !keluar && <span className="jrm-redup">Masih menghubungkan…</span>}
        {status === 'server' && <>
          <b>Tidak dapat terhubung ke server</b>Jaringan ada, tetapi server belum menjawab.
          <div className="jrm-tombol" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="jrmBtn jrmBtn-utama" onClick={cobaLagi}>Coba lagi</button>
            <button type="button" className="jrmBtn jrmBtn-kedua" onClick={lanjut}>Lanjut tetap</button>
          </div>
        </>}
        {status === 'offline' && <>
          <b>Tidak ada jaringan</b>Periksa Wi-Fi atau data seluler, lalu coba lagi.
          <div className="jrm-tombol" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" className="jrmBtn jrmBtn-utama" onClick={cobaLagi}>Coba lagi</button>
            <button type="button" className="jrmBtn jrmBtn-kedua" onClick={lanjut}>Lanjut tetap</button>
          </div>
        </>}
      </div>
    </div>
  )
}
