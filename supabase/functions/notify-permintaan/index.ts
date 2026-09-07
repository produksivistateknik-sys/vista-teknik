/*
Notify Permintaan - dipicu LANGSUNG dari client Vista Pekerja/Teknik tepat setelah aksi terkait
permintaan barang (BBMB/BBMU) sukses, BUKAN cron - pola sama persis notify-wo-baru (sekali-jalan
per event, gak butuh dedup log kayak maintenance-reminder-check yang polling berkala).

7 TRIGGER, target beda-beda (targetAdmin=broadcast ke SEMUA admin Vista Teknik yang subscribe,
push_subscriptions.admin_username IS NOT NULL - pola diambil PERSIS dari notify-wo-baru.
targetDivisi=push_subscriptions.divisi, BUKAN operator/gudang spesifik - device Vista Pekerja
login shared per divisi, siapapun yang sedang login di situ yang harus dapat):
- 'baru'   - operator kirim permintaan baru (PermintaanView.tsx submitPermintaan)
             -> ADMIN (REVISI 7 Sep 2026, fitur approval admin - dulu langsung ke GUDANG, sekarang
             Gudang belum boleh tau apa-apa sampai admin setuju, lihat 'admin_disetujui' di bawah).
- 'admin_disetujui' - admin setuju permintaan (dgn/tanpa edit qty) (PermintaanAdminTab.tsx,
             7 Sep 2026) -> GUDANG. INI yang gantikan notif "permintaan baru" lama ke Gudang -
             titik SEKARANG permintaan itu beneran nongol di alur Gudang (status jadi 'pending').
- 'admin_ditolak'   - admin tolak permintaan di tahap ini (7 Sep 2026) -> DIVISI PENGAJU, isi
             notif sertakan alasan. BEDA dari trigger 'reject' (itu Gudang yang nolak, tahap
             SETELAH admin setuju - dua peristiwa beda, jangan disamakan).
- 'status' - Gudang ubah status item (BBMB submit "Sudah Siap", ATAU BBMU tersedia/belum_lengkap/
             belum_datang) (PermintaanGudangTab.tsx setItemStatus) -> ke DIVISI PENGAJU.
- 'reject' - Gudang tolak item BBMB (PermintaanGudangTab.tsx setItemStatus) -> ke DIVISI PENGAJU
             (sama kayak 'status'), isi notif sertakan catatanReject.
- 'koreksi_baru'      - Gudang ajukan koreksi qty (RiwayatGudangTab.tsx, 7 Sep 2026) -> ke DIVISI
             PENGAJU (lihat permintaan_item_koreksi.sql soal kenapa per-divisi bukan per-orang).
- 'koreksi_keputusan' - divisi peminta setuju/tolak pengajuan koreksi (PermintaanView.tsx) -> ke
             GUDANG.

Reuse VAPID secrets & pola kirim (webpush.sendNotification, cleanup subscription invalid 404/410)
SAMA PERSIS notify-wo-baru/maintenance-reminder-check.
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

    let targetDivisi: string | null = null
    let targetAdmin = false
    let title: string
    let notifBody: string

    if (trigger === 'baru') {
      const { jenis, operatorNama, divisi, proyek, panelNama, jumlahItem } = body
      if (!jenis || !operatorNama || !divisi) return jsonResponse({ error: 'jenis, operatorNama, dan divisi wajib diisi.' }, 400)
      targetAdmin = true
      title = `Permintaan ${jenis} Baru - Menunggu Persetujuan`
      notifBody = `${operatorNama} (${divisi}) - ${proyek || '-'} · ${panelNama || '-'} · ${jumlahItem || 0} item`
    } else if (trigger === 'admin_disetujui') {
      const { jenis, operatorNama, divisi, proyek, panelNama, jumlahItem } = body
      if (!jenis || !divisi) return jsonResponse({ error: 'jenis dan divisi wajib diisi.' }, 400)
      targetDivisi = 'gudang'
      title = `Permintaan ${jenis} Disetujui Admin`
      notifBody = `${operatorNama || '-'} (${divisi}) - ${proyek || '-'} · ${panelNama || '-'} · ${jumlahItem || 0} item`
    } else if (trigger === 'admin_ditolak') {
      const { targetDivisi: td, namaKomponen, qty, satuan, alasan } = body
      if (!td || !namaKomponen) return jsonResponse({ error: 'targetDivisi dan namaKomponen wajib diisi.' }, 400)
      targetDivisi = td
      title = 'Permintaan Ditolak Admin'
      notifBody = `${namaKomponen} ×${qty || 1}${satuan ? ` ${satuan}` : ''} ditolak admin${alasan ? ` - ${alasan}` : ''}`
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
    } else if (trigger === 'koreksi_baru') {
      // Fitur Pengajuan Koreksi Qty (7 Sep 2026) - Gudang ajukan koreksi -> divisi peminta yang
      // approve/reject (lihat permintaan_item_koreksi.sql - target per DIVISI, bukan orang
      // spesifik, sama kayak trigger 'status'/'reject' di atas).
      const { targetDivisi: td, namaKomponen, qtyLama, qtyDiusulkan, satuan } = body
      if (!td || !namaKomponen) return jsonResponse({ error: 'targetDivisi dan namaKomponen wajib diisi.' }, 400)
      targetDivisi = td
      title = 'Pengajuan Koreksi Qty'
      notifBody = `${namaKomponen}: ${qtyLama}${satuan ? ` ${satuan}` : ''} -> ${qtyDiusulkan}${satuan ? ` ${satuan}` : ''} - menunggu persetujuan Anda`
    } else if (trigger === 'koreksi_keputusan') {
      // Hasil approve/reject dikirim BALIK ke Gudang.
      const { namaKomponen, disetujui, qtyDiusulkan, satuan } = body
      if (!namaKomponen) return jsonResponse({ error: 'namaKomponen wajib diisi.' }, 400)
      targetDivisi = 'gudang'
      title = disetujui ? 'Koreksi Qty Disetujui' : 'Koreksi Qty Ditolak'
      notifBody = disetujui ? `${namaKomponen} - qty diubah jadi ${qtyDiusulkan}${satuan ? ` ${satuan}` : ''}` : `${namaKomponen} - pengajuan koreksi ditolak`
    } else {
      return jsonResponse({ error: `trigger tidak dikenali: ${trigger} (harus 'baru'/'admin_disetujui'/'admin_ditolak'/'status'/'reject'/'koreksi_baru'/'koreksi_keputusan')` }, 400)
    }

    // 2 query terpisah (admin & divisi) diunion+dedup di JS - pola PERSIS notify-wo-baru, biar
    // 1 event bisa target admin+divisi sekaligus kalau suatu saat dibutuhkan (belum ada trigger
    // yang butuh keduanya sekarang, tapi strukturnya udah siap tanpa perlu ubah lagi nanti).
    let subs: any[] = []
    if (targetAdmin) {
      const { data, error } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').not('admin_username', 'is', null)
      if (error) throw error
      subs = subs.concat(data || [])
    }
    if (targetDivisi) {
      const { data, error } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('divisi', targetDivisi)
      if (error) throw error
      subs = subs.concat(data || [])
    }
    const subsMap = new Map(subs.map((s) => [s.id, s]))
    subs = [...subsMap.values()]
    if (subs.length === 0) {
      return jsonResponse({ dikirim: 0, catatan: `belum ada subscriber yang cocok (targetAdmin=${targetAdmin}, targetDivisi=${targetDivisi || '-'})` })
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

    return jsonResponse({ targetAdmin, targetDivisi, totalSubscription: subs.length, dikirim: terkirim, subscriptionDihapus: subsInvalid.length })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
