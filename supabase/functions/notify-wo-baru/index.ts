/*
Notify WO/Panel/Gambar Teknik - dipicu LANGSUNG dari client tepat setelah aksi terkait sukses,
BUKAN cron (sama pola notify-permintaan - sekali-jalan per event, gak butuh tabel dedup terpisah).

REVISI (5 Sep 2026) - dulu cuma 1 event (WO baru, cuma ke admin). Sekarang 4 TRIGGER, target
admin dan/atau SEMUA divisi operator (broadcast, bukan divisi spesifik - keputusan user,
panel biasanya belum ada jadwal spesifik pas WO baru dibuat/diedit):
- 'baru'          - WO baru dibuat (ManajemenWO.tsx/WoDigitalTab.tsx save(), cabang create).
                     -> admin + operator. DEFAULT kalau field `trigger` gak dikirim (backward
                     compat - caller lama cuma kirim {wo_id,wo_number,proyek,target,admin_nama}
                     tanpa trigger).
- 'revisi_wo'     - WO existing diedit (No WO/Proyek/Target berubah, BUKAN cuma qty/checklist
                     panel). -> operator SAJA (sesuai spek user).
- 'tambah_panel'  - panel baru ditambahkan ke WO yang SUDAH ADA (bukan pas Tambah WO Baru).
                     -> admin + operator.
- 'gambar_direvisi' - upload REVISI gambar teknik (bukan upload pertama kali - lihat guard
                     isFirstDoc di useWoDigitalDocs.ts). -> admin + operator.

Kirim ke SEMUA admin yang subscribe (push_subscriptions.admin_username IS NOT NULL) dan/atau
SEMUA operator yang subscribe (push_subscriptions.divisi IS NOT NULL) - termasuk yang bikin
event itu sendiri (sengaja gak di-exclude, sebagai konfirmasi berhasil, sama pola versi lama).

Pola kirim (webpush.sendNotification per subscriber, cleanup subscription invalid 404/410) SAMA
PERSIS ditiru dari maintenance-reminder-check/index.ts & notify-permintaan/index.ts.
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

    const body = await req.json()
    const trigger = body.trigger || 'baru'

    let title: string
    let notifBody: string
    let url: string
    let targetAdmin = false
    let targetOperator = false

    if (trigger === 'baru') {
      const { wo_id, wo_number, proyek, target, admin_nama } = body
      if (!wo_id || !wo_number || !proyek) return jsonResponse({ error: 'wo_id, wo_number, dan proyek wajib diisi.' }, 400)
      title = 'WO Baru Ditambahkan'
      notifBody = `${admin_nama || 'Admin'} menambahkan WO ${wo_number} - ${proyek}, deadline ${fmtTanggalId(target)}`
      url = `/?tab=wo&wo_id=${wo_id}`
      targetAdmin = true
      targetOperator = true
    } else if (trigger === 'revisi_wo') {
      const { wo_id, wo_number, proyek, target, admin_nama } = body
      if (!wo_id || !wo_number || !proyek) return jsonResponse({ error: 'wo_id, wo_number, dan proyek wajib diisi.' }, 400)
      title = 'WO Direvisi'
      notifBody = `${admin_nama || 'Admin'} mengubah WO ${wo_number} - ${proyek}, deadline ${fmtTanggalId(target)}`
      url = `/?tab=wo&wo_id=${wo_id}`
      targetOperator = true
    } else if (trigger === 'tambah_panel') {
      const { wo_id, wo_number, proyek, admin_nama, panel_names } = body
      if (!wo_id || !wo_number || !proyek) return jsonResponse({ error: 'wo_id, wo_number, dan proyek wajib diisi.' }, 400)
      const panelText = Array.isArray(panel_names) && panel_names.length > 0 ? panel_names.join(', ') : 'panel baru'
      title = 'Panel Baru Ditambahkan'
      notifBody = `${admin_nama || 'Admin'} menambahkan ${panelText} ke WO ${wo_number} - ${proyek}`
      url = `/?tab=wo&wo_id=${wo_id}`
      targetAdmin = true
      targetOperator = true
    } else if (trigger === 'gambar_direvisi') {
      const { wo_id, wo_number, proyek, panel_nama, uploader_nama } = body
      if (!wo_id || !wo_number || !panel_nama) return jsonResponse({ error: 'wo_id, wo_number, dan panel_nama wajib diisi.' }, 400)
      title = 'Gambar Teknik Direvisi'
      notifBody = `${uploader_nama || 'Engineering'} merevisi gambar teknik ${panel_nama} - WO ${wo_number}${proyek ? ` (${proyek})` : ''}`
      url = `/?tab=wodigital&wo_id=${wo_id}`
      targetAdmin = true
      targetOperator = true
    } else {
      return jsonResponse({ error: `trigger tidak dikenali: ${trigger}` }, 400)
    }

    // 2 query terpisah (admin & operator) lebih simpel/aman drpd .or() gabungan - hasilnya
    // di-union + dedup by id di JS (jaga-jaga kalau 1 row kebetulan match dua-duanya).
    let subs: any[] = []
    if (targetAdmin) {
      const { data, error } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').not('admin_username', 'is', null)
      if (error) throw error
      subs = subs.concat(data || [])
    }
    if (targetOperator) {
      const { data, error } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').not('divisi', 'is', null)
      if (error) throw error
      subs = subs.concat(data || [])
    }
    const subsMap = new Map(subs.map((s) => [s.id, s]))
    subs = [...subsMap.values()]

    if (subs.length === 0) {
      return jsonResponse({ dikirim: 0, catatan: 'belum ada subscriber yang cocok buat trigger ini' })
    }

    const payload = JSON.stringify({ title, body: notifBody, url })

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

    return jsonResponse({ trigger, totalSubscription: subs.length, dikirim: terkirim, subscriptionDihapus: subsInvalid.length })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
