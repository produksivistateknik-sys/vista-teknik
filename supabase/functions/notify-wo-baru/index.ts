/*
Notify WO Baru - dipicu LANGSUNG dari client (ManajemenWO.tsx save(), cabang create) tepat
setelah insert work_orders sukses, BUKAN cron. Beda dari maintenance-reminder-check yang polling
berkala dan butuh dedup log (event yang sama bisa ke-detect ulang tiap cron jalan) - "WO baru
dibuat" itu SEKALI-JALAN per WO, jadi gak butuh tabel dedup terpisah.

Kirim ke SEMUA admin Vista Teknik yang subscribe (push_subscriptions.admin_username IS NOT NULL) -
termasuk admin yang bikin WO itu sendiri (sengaja gak di-exclude, sebagai konfirmasi berhasil).

Pola kirim (webpush.sendNotification per subscriber, cleanup subscription invalid 404/410) SAMA
PERSIS ditiru dari maintenance-reminder-check/index.ts.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const fmtTanggalId = (iso?: string) => {
  if (!iso) return '-'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${BULAN_ID[m - 1]} ${y}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:produksi.vistateknik@gmail.com'
    if (!vapidPublic || !vapidPrivate) return jsonResponse({ error: 'VAPID keys belum di-set di secrets.' }, 500)
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const { wo_id, wo_number, proyek, target, admin_nama } = await req.json()
    if (!wo_id || !wo_number || !proyek) return jsonResponse({ error: 'wo_id, wo_number, dan proyek wajib diisi.' }, 400)

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .not('admin_username', 'is', null)
    if (subsErr) throw subsErr
    if (!subs || subs.length === 0) {
      return jsonResponse({ dikirim: 0, catatan: 'belum ada admin yang subscribe push notification' })
    }

    const payload = JSON.stringify({
      title: 'WO Baru Ditambahkan',
      body: `${admin_nama || 'Admin'} menambahkan WO ${wo_number} - ${proyek}, deadline ${fmtTanggalId(target)}`,
      url: `/?tab=wo&wo_id=${wo_id}`,
    })

    const subsInvalid: number[] = []
    let terkirim = 0
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        terkirim++
      } catch (err: any) {
        const status = err?.statusCode
        if (status === 404 || status === 410) subsInvalid.push(s.id) // subscription kadaluarsa
        // Error lain (network/timeout dsb) - diabaikan per subscription, gak gagalin seluruh batch.
      }
    }
    if (subsInvalid.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', subsInvalid)
    }

    return jsonResponse({ totalSubscription: subs.length, dikirim: terkirim, subscriptionDihapus: subsInvalid.length })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
