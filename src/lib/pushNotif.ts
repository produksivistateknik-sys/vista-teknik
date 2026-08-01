import { supabase } from './supabase'

// Konversi VAPID public key (base64url) ke Uint8Array - format yang diminta
// PushManager.subscribe's applicationServerKey.
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
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
