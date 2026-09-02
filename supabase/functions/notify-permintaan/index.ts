/*
Notify Permintaan - dipicu LANGSUNG dari client Vista Pekerja tepat setelah aksi terkait
permintaan barang (BBMB/BBMU) sukses, BUKAN cron - pola sama persis notify-wo-baru (sekali-jalan
per event, gak butuh dedup log kayak maintenance-reminder-check yang polling berkala).

3 TRIGGER, target beda-beda:
- 'baru'   - operator kirim permintaan baru (PermintaanView.tsx submitPermintaan) -> ke GUDANG
             (push_subscriptions.divisi = 'gudang').
- 'status' - Gudang ubah status item (BBMB submit "Sudah Siap", ATAU BBMU tersedia/belum_lengkap/
             belum_datang) (PermintaanGudangTab.tsx setItemStatus) -> ke DIVISI PENGAJU
             (push_subscriptions.divisi = targetDivisi, BUKAN operator spesifik - device Vista
             Pekerja login shared per divisi, siapapun yang sedang login di situ yang harus dapat).
- 'reject' - Gudang tolak item BBMB (PermintaanGudangTab.tsx setItemStatus) -> ke DIVISI PENGAJU
             (sama kayak 'status'), isi notif sertakan catatanReject.

Target 'baru' ('gudang') dan target 'status'/'reject' (nama divisi kayak 'wiring_pwr') SAMA-SAMA
dicocokkan ke push_subscriptions.divisi - kolom itu memang generik (bisa isi 'gudang' ATAU nama
divisi operator manapun, keduanya sama-sama login Vista Pekerja, cuma beda value user.divisi).

Reuse VAPID secrets & pola kirim (webpush.sendNotification, cleanup subscription invalid 404/410)
SAMA PERSIS notify-wo-baru/maintenance-reminder-check - TIDAK ada tabel/kolom baru.
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
    const { trigger } = body

    let targetDivisi: string
    let title: string
    let notifBody: string

    if (trigger === 'baru') {
      const { jenis, operatorNama, divisi, proyek, panelNama, jumlahItem } = body
      if (!jenis || !operatorNama || !divisi) return jsonResponse({ error: 'jenis, operatorNama, dan divisi wajib diisi.' }, 400)
      targetDivisi = 'gudang'
      title = `Permintaan ${jenis} Baru`
      notifBody = `${operatorNama} (${divisi}) - ${proyek || '-'} · ${panelNama || '-'} · ${jumlahItem || 0} item`
    } else if (trigger === 'status') {
      const { targetDivisi: td, namaKomponen, qty, satuan, statusLabel } = body
      if (!td || !namaKomponen || !statusLabel) return jsonResponse({ error: 'targetDivisi, namaKomponen, dan statusLabel wajib diisi.' }, 400)
      targetDivisi = td
      title = `Permintaan ${statusLabel}`
      notifBody = `${namaKomponen} ×${qty || 1}${satuan ? ` ${satuan}` : ''} - ${statusLabel}`
    } else if (trigger === 'reject') {
      const { targetDivisi: td, namaKomponen, qty, satuan, catatanReject } = body
      if (!td || !namaKomponen) return jsonResponse({ error: 'targetDivisi dan namaKomponen wajib diisi.' }, 400)
      targetDivisi = td
      title = 'Permintaan Ditolak'
      notifBody = `${namaKomponen} ×${qty || 1}${satuan ? ` ${satuan}` : ''} ditolak${catatanReject ? ` - ${catatanReject}` : ''}`
    } else {
      return jsonResponse({ error: `trigger tidak dikenali: ${trigger} (harus 'baru'/'status'/'reject')` }, 400)
    }

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('divisi', targetDivisi)
    if (subsErr) throw subsErr
    if (!subs || subs.length === 0) {
      return jsonResponse({ dikirim: 0, catatan: `belum ada device divisi '${targetDivisi}' yang subscribe push notification` })
    }

    const payload = JSON.stringify({ title, body: notifBody, url: '/' })

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

    return jsonResponse({ targetDivisi, totalSubscription: subs.length, dikirim: terkirim, subscriptionDihapus: subsInvalid.length })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
