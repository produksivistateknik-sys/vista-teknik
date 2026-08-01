/*
Maintenance Reminder Check - dipicu pg_cron HARIAN jam 00:00 UTC (07:00 WIB, lihat migrasi
cron.schedule terkait, sama pola dengan timer-reminder-check yang sudah ada).

Cek SEMUA jadwal maintenance_rutin AKTIF (is_active=true), kirim Web Push notification kalau:
- H-1 (jatuh_tempo = besok) - SEKALI, pengingat awal.
- jatuh_tempo <= hari ini (jatuh tempo hari ini ATAU sudah terlambat) - SETIAP HARI cron jalan,
  selama jadwal itu MASIH belum ditandai selesai (belum diketahui hari ini SEMUA baris yang
  masih match kondisi ini dianggap "masih belum selesai" - begitu ditandai selesai baik dari
  Vista Teknik maupun QR publik, `jatuh_tempo` DIMAJUKAN ke siklus berikutnya (lihat
  MaintenanceRutinTab.markDone / MesinPublic.tsx tandaiSelesai) - jadi baris itu OTOMATIS
  berhenti match kondisi "jatuh_tempo <= hari ini" tanpa perlu logic "stop reminder" terpisah.

ANTI-SPAM: dedup di tabel maintenance_reminder_log, UNIQUE (rutin_id, jatuh_tempo_saat_kirim,
tanggal_kirim) - satu baris jadwal cuma dapat SATU reminder per hari kalender, walau cron
kebetulan retry/jalan dobel. `jatuh_tempo_saat_kirim` (snapshot jatuh_tempo pas reminder dikirim,
BUKAN jatuh_tempo yang mungkin sudah berubah pas dibaca ulang) dipakai sebagai bagian key supaya
kalau jadwal ini SELESAI lalu jatuh tempo lagi di siklus berikutnya, itung sebagai "reminder
baru" (bukan ke-dedup sama reminder siklus lama).

TARGET PENERIMA: v1 broadcast ke SEMUA baris push_subscriptions (semua admin Vista Teknik yang
sudah aktifkan notifikasi) - field maintenance_rutin.teknisi adalah TEKS BEBAS (bukan FK ke akun
manapun, dicek langsung ke data: nilai kayak "AFIF"/"WILDAN"/"Tim Painting"/"TIM PAINTING" -
gak konsisten & gak reliable buat dicocokkan ke akun tertentu), jadi TIDAK dipakai buat targeting
di v1 ini - kalau nanti field itu dirapikan jadi link ke akun, baru layak ditargetkan per-orang.

Subscription yang sudah invalid (browser unsubscribe/uninstall, endpoint gak berlaku lagi -
web-push balikin HTTP 404/410) dihapus otomatis dari push_subscriptions di sini.
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

const fetchAll = async (supabase: any, table: string, select: string, filterFn?: (q: any) => any) => {
  let all: any[] = []
  let from = 0
  while (true) {
    let q = supabase.from(table).select(select)
    if (filterFn) q = filterFn(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw error
    all = all.concat(data ?? [])
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

const getWibDateStr = () => {
  const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return wibNow.toISOString().slice(0, 10)
}
const diffHari = (a: string, b: string) => Math.round((new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / 86400000)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:produksi.vistateknik@gmail.com'
    if (!vapidPublic || !vapidPrivate) return jsonResponse({ error: 'VAPID keys belum di-set di secrets.' }, 500)
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

    const hariIni = getWibDateStr()
    const besok = new Date(new Date(hariIni + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10)

    const rutinAktif = await fetchAll(supabase, 'maintenance_rutin', 'id,mesin_id,jenis_maintenance,jatuh_tempo', (q) => q.eq('is_active', true))
    // Kandidat: H-1 (jatuh_tempo === besok) ATAU jatuh_tempo <= hari ini (jatuh tempo/terlambat).
    const kandidat = rutinAktif.filter((r: any) => r.jatuh_tempo === besok || r.jatuh_tempo <= hariIni)
    if (kandidat.length === 0) return jsonResponse({ checked: rutinAktif.length, kandidat: 0, dikirim: 0 })

    // Dedup: skip yang UDAH dapat reminder hari ini untuk siklus jatuh_tempo yang SAMA.
    const existingLog = await fetchAll(supabase, 'maintenance_reminder_log', 'rutin_id,jatuh_tempo_saat_kirim,tanggal_kirim', (q) => q.eq('tanggal_kirim', hariIni))
    const sudahDikirimSet = new Set(existingLog.map((l: any) => `${l.rutin_id}|${l.jatuh_tempo_saat_kirim}`))
    const perluDikirim = kandidat.filter((r: any) => !sudahDikirimSet.has(`${r.id}|${r.jatuh_tempo}`))
    if (perluDikirim.length === 0) return jsonResponse({ checked: rutinAktif.length, kandidat: kandidat.length, dikirim: 0, catatan: 'semua sudah dapat reminder hari ini' })

    const mesinIds = [...new Set(perluDikirim.map((r: any) => r.mesin_id))]
    const mesinRows = mesinIds.length ? await fetchAll(supabase, 'mesin', 'id,nama,kode', (q) => q.in('id', mesinIds)) : []
    const mesinMap: Record<string, any> = {}
    mesinRows.forEach((m: any) => (mesinMap[String(m.id)] = m))

    const subs = await fetchAll(supabase, 'push_subscriptions', 'id,endpoint,p256dh,auth')
    if (subs.length === 0) {
      // Gak ada satupun admin yang subscribe - gak ada yang bisa dikirimin, tapi TETAP catat log
      // dedup (jumlah_penerima:0) biar gak nyoba lagi berkali-kali hari yang sama begitu ada yang subscribe di tengah hari.
      const logRows = perluDikirim.map((r: any) => ({ rutin_id: r.id, jatuh_tempo_saat_kirim: r.jatuh_tempo, tanggal_kirim: hariIni, jumlah_penerima: 0 }))
      await supabase.from('maintenance_reminder_log').insert(logRows)
      return jsonResponse({ checked: rutinAktif.length, kandidat: kandidat.length, dikirim: 0, catatan: 'belum ada admin yang subscribe push notification' })
    }

    const subsInvalid = new Set<number>()
    let totalTerkirim = 0
    const logRows: any[] = []

    for (const r of perluDikirim) {
      const mesin = mesinMap[String(r.mesin_id)]
      const namaMesin = mesin ? `${mesin.nama} (${mesin.kode})` : 'Mesin'
      const selisih = diffHari(r.jatuh_tempo, hariIni)
      let title: string, statusText: string
      if (selisih === 1) {
        title = 'Maintenance Jatuh Tempo Besok'
        statusText = `jatuh tempo besok (${r.jatuh_tempo})`
      } else if (selisih === 0) {
        title = 'Maintenance Jatuh Tempo'
        statusText = 'jatuh tempo hari ini'
      } else {
        title = 'Maintenance Terlambat'
        statusText = `sudah terlambat ${-selisih} hari`
      }
      const payload = JSON.stringify({
        title,
        body: `${namaMesin} - ${r.jenis_maintenance} ${statusText}`,
        url: '/?tab=maintenance',
      })

      let terkirimUntukIni = 0
      for (const s of subs) {
        if (subsInvalid.has(s.id)) continue
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
          terkirimUntukIni++
        } catch (err: any) {
          const status = err?.statusCode
          if (status === 404 || status === 410) subsInvalid.add(s.id) // subscription kadaluarsa, gak dicoba lagi & dihapus di bawah
          // Error lain (network/timeout dsb) - diabaikan per subscription, gak gagalin seluruh batch.
        }
      }
      totalTerkirim += terkirimUntukIni
      logRows.push({ rutin_id: r.id, jatuh_tempo_saat_kirim: r.jatuh_tempo, tanggal_kirim: hariIni, jumlah_penerima: terkirimUntukIni })
    }

    if (logRows.length > 0) {
      const { error: logErr } = await supabase.from('maintenance_reminder_log').insert(logRows)
      if (logErr) throw logErr
    }
    if (subsInvalid.size > 0) {
      await supabase.from('push_subscriptions').delete().in('id', [...subsInvalid])
    }

    return jsonResponse({
      checked: rutinAktif.length,
      kandidat: kandidat.length,
      dikirim: perluDikirim.length,
      totalNotifikasiTerkirim: totalTerkirim,
      subscriptionDihapus: subsInvalid.size,
    })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
