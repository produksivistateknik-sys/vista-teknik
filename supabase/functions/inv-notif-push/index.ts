/*
Inventaris Notif Push (31 Okt 2026, T3) - dipicu pg_cron TIAP MENIT (migrasi 20261031020000_inventaris_notif_push_cron.sql),
BUKAN dari browser (CLAUDE.md D). Mengirim push ke SEMUA admin (push_subscriptions.admin_username IS NOT NULL - pola
notify-permintaan/notify-wo-baru) utk tindakan operator yang tercatat di inv_notifikasi.

Penggabungan (anti banjir): RPC inv_notif_ambil_push() (service_role saja) mengklaim ATOMIK notifikasi push_status='menunggu'
per kelompok (operator, jenis) yang sudah tenang >= 30 dtk (atau tertua >= 3 mnt); notifikasi > 60 mnt = 'dilewati' (tidak
mengirim push basi). 1 push per kelompok: 1 tindakan -> tautan langsung ke barisnya (?tab=inventaris&inv=barang:12 ...);
>1 tindakan -> buka laci "Perlu ditinjau" (?inv=notif). tag per kelompok -> di HP push baru menggantikan yang lama.
Panel admin tetap 1 notifikasi per tindakan. Tindakan admin tidak pernah membuat notifikasi -> tidak ada push utk admin sendiri.

Klaim sekali jalan: notifikasi yang sudah diklaim tidak dikirim ulang walau pengiriman gagal (push = pemberitahuan cadangan;
sumber kebenaran = panel). Deploy dgn --no-verify-jwt: pemanggil (cron) tanpa kunci; memanggil fungsi ini hanya mengirim
push yang memang sudah antre (tidak membaca/menulis data lain).
*/
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const LABEL: Record<string, [string, string]> = {   // [satu tindakan, banyak tindakan]
  kondisi: ['mengubah kondisi', 'mengubah kondisi %n barang'],
  kondisi_detail: ['mengubah detail kondisi', 'mengubah detail kondisi %n barang'],
  barang_baru: ['menambah barang', 'menambah %n barang'],
  laporan_baru: ['melapor kerusakan', 'melapor %n kerusakan'],
  laporan_status: ['mengubah status laporan', 'mengubah %n status laporan'],
  laporan_update: ['menambah update laporan', 'menambah %n update laporan'],
  maintenance_selesai: ['menyelesaikan maintenance', 'menyelesaikan %n maintenance'],
}
const tautan = (n: any) => n.jenis.startsWith('laporan_') ? `laporan:${n.ref_id}` : n.jenis === 'maintenance_selesai' ? `jadwal:${n.ref_id}` : `barang:${n.barang_id}`

Deno.serve(async () => {
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY'), vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!vapidPublic || !vapidPrivate) return json({ error: 'VAPID keys belum di-set di secrets.' }, 500)
    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:produksi.vistateknik@gmail.com', vapidPublic, vapidPrivate)

    const { data: klaim, error: eKlaim } = await supabase.rpc('inv_notif_ambil_push')
    if (eKlaim) throw eKlaim
    if (!klaim?.length) return json({ diklaim: 0 })

    const kelompok = new Map<string, any[]>()
    for (const n of klaim) { const k = `${n.pekerja_id ?? n.oleh}|${n.jenis}`; kelompok.set(k, [...(kelompok.get(k) || []), n]) }

    const { data: subs, error: eSubs } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth').not('admin_username', 'is', null)
    if (eSubs) throw eSubs
    if (!subs?.length) return json({ diklaim: klaim.length, kelompok: kelompok.size, dikirim: 0, catatan: 'belum ada admin yang berlangganan push' })

    const invalid = new Set<number>()
    let terkirim = 0
    for (const [k, ns] of kelompok) {
      const n0 = ns[0], [satu, banyak] = LABEL[n0.jenis] || ['melakukan tindakan', 'melakukan %n tindakan']
      const payload = JSON.stringify({
        title: `Inventaris: ${n0.oleh} ${ns.length > 1 ? banyak.replace('%n', String(ns.length)) : satu}`,
        body: ns.length > 1 ? ns.slice(0, 3).map(n => '• ' + n.teks).join('\n') + (ns.length > 3 ? `\n… dan ${ns.length - 3} lagi` : '') : n0.teks,
        url: `/?tab=inventaris&inv=${encodeURIComponent(ns.length > 1 ? 'notif' : tautan(n0))}`,
        tag: `inv-${k}`,
      })
      for (const s of subs) {
        if (invalid.has(s.id)) continue
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload); terkirim++ }
        catch (err: any) { if (err?.statusCode === 404 || err?.statusCode === 410) invalid.add(s.id) }   // langganan kedaluwarsa
      }
    }
    if (invalid.size) {
      const { error } = await supabase.from('push_subscriptions').delete().in('id', [...invalid])
      if (error) console.error('[inv-notif-push] hapus langganan kedaluwarsa gagal:', error)
    }
    return json({ diklaim: klaim.length, kelompok: kelompok.size, admin: subs.length, dikirim: terkirim, langgananDihapus: invalid.size })
  } catch (e: any) {
    console.error('[inv-notif-push]', e)
    return json({ error: String(e?.message || e) }, 500)
  }
})
