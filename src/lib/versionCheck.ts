import { useEffect, useState } from "react"
import { getLocalDateStr, TODAY } from "./dateHelpers"

// Deteksi versi baru sudah ter-deploy tapi tab ini masih jalanin JS lama di memori (SPA gak
// pernah hot-swap kode yang lagi jalan - insiden nyata: 14 Agu 2026, tab yang gak pernah
// di-reload ~40 jam diam-diam masih jalanin logic auto-geser versi SEBELUM fix 13 Agu,
// dump komponen FS.13/LVMDP-FINNS RESORT ke Oktober, padahal server sudah pakai kode terbaru).
// `__BUILD_ID__` di-inject sekali pas build (vite.config.ts), dibandingkan berkala ke
// /version.json (file statis, BUKAN lewat bundle JS, jadi selalu kebaca versi live server -
// service worker treat ini network-first sama seperti index.html).
declare const __BUILD_ID__: string

const CHECK_INTERVAL_MS = 10 * 60 * 1000 // 10 menit - cukup sering buat nemuin versi baru tanpa bebani server

export function useVersionCheck(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.buildId && data.buildId !== __BUILD_ID__) setHasUpdate(true)
      } catch {
        // Gagal cek (offline/network error) - diamkan, coba lagi interval berikutnya.
      }
    }
    check()
    const iv = setInterval(check, CHECK_INTERVAL_MS)
    // Cek juga begitu tab balik aktif (kemungkinan besar user habis idle lama - momen paling
    // relevan buat ketauan tab-nya basi, gak perlu nunggu interval berikutnya).
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { cancelled = true; clearInterval(iv); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  return hasUpdate
}

const DATE_CHECK_INTERVAL_MS = 60 * 1000 // 1 menit - murah (cuma Date lokal, gak ada network), aman dicek sering

// Deteksi tanggal sudah berganti (BUG FIX 5 Sep 2026) - TODAY (dateHelpers.ts) dihitung SEKALI
// pas modul JS dimuat, gak pernah di-refresh sendiri. Device kantor/dashboard yang dibiarkan
// terbuka lewat tengah malam (tab gak pernah di-reload) bisa "nyangkut" di tanggal kemarin -
// checkpoint riwayat progress kesimpan salah tanggal, badge deadline (TERLAMBAT/MENDESAK) gak
// update. SENGAJA cuma DETEKSI + banner (bukan auto-reload diam-diam kayak service worker biasa)
// - reload paksa bisa motong form/input yang lagi diketik user, jadi keputusan ada di tangan user
// sendiri, sama persis pola useVersionCheck di atas.
export function useDateRollover(): boolean {
  const [rolled, setRolled] = useState(false)

  useEffect(() => {
    const check = () => { if (getLocalDateStr() !== TODAY) setRolled(true) }
    check()
    const iv = setInterval(check, DATE_CHECK_INTERVAL_MS)
    const onVisible = () => { if (document.visibilityState === "visible") check() }
    document.addEventListener("visibilitychange", onVisible)
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVisible) }
  }, [])

  return rolled
}
