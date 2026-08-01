import { supabase } from './supabase'

// Konversi VAPID public key (base64url) ke Uint8Array - format yang diminta
// PushManager.subscribe's applicationServerKey.
// .trim() JAGA-JAGA whitespace/newline tersembunyi yang kebawa pas value di-copy-paste ke
// environment variable (Vercel dkk) - karakter itu bukan base64url valid & gak kena replace di
// bawah, jadi atob() gagal decode dengan error kriptis ("not correctly encoded") kalau lolos.
const urlBase64ToUint8Array = (base64String: string) => {
  const cleaned = base64String.trim()
  const padding = '='.repeat((4 - (cleaned.length % 4)) % 4)
  const base64 = (cleaned + padding).replace(/-/g, '+').replace(/_/g, '/')
  let rawData: string
  try {
    rawData = window.atob(base64)
  } catch {
    throw new Error(`VAPID public key gak valid base64url (setelah dibersihkan: "${cleaned.slice(0, 10)}...", panjang ${cleaned.length}) - cek ulang nilai VITE_VAPID_PUBLIC_KEY, kemungkinan ada karakter tersembunyi ikut ter-copy.`)
  }
  // P-256 uncompressed public key (format Web Push) WAJIB persis 65 byte (0x04 + X 32-byte + Y 32-byte).
  if (rawData.length !== 65) {
    throw new Error(`VAPID public key panjangnya salah setelah decode (${rawData.length} byte, harusnya 65) - kemungkinan nilai VITE_VAPID_PUBLIC_KEY kepotong atau kecampur karakter lain.`)
  }
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const getPushPermissionState = (): NotificationPermission | 'unsupported' =>
  isPushSupported() ? Notification.permission : 'unsupported'

// Minta izin + subscribe + simpan endpoint/keys ke push_subscriptions (keyed by admin_username,
// endpoint UNIQUE - re-subscribe device yang sama otomatis upsert, gak numpuk baris duplikat).
export const subscribeToPush = async (adminUsername: string): Promise<{ success: boolean; error?: string }> => {
  if (!isPushSupported()) return { success: false, error: 'Browser ini tidak mendukung push notification.' }
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) return { success: false, error: 'VAPID public key belum dikonfigurasi.' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { success: false, error: 'Izin notifikasi ditolak.' }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
    }
    const json = subscription.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        admin_username: adminUsername,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent,
      },
      { onConflict: 'endpoint' }
    )
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) }
  }
}
