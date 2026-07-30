/*
Timer Reminder Check - dipicu pg_cron tiap 30 menit (lihat migrasi cron.schedule terkait).

Cek semua timer AKTIF (fcs_timer_kerja.selesai IS NULL) yang udah jalan > AMBANG_MENIT TANPA
ada update progress (progress_checkpoint_log) sejak timer mulai. Kalau ketemu dan belum ada
reminder yang masih "cooldown" (< AMBANG_MENIT dari reminder TERAKHIR) buat timer itu, kirim
notifikasi baru ke fcs_notifikasi (tipe='timer_reminder', timer_id=<id fcs_timer_kerja>).

PRINSIP INTI (jangan dilanggar): function ini TIDAK PERNAH menghentikan timer secara otomatis -
cuma ngasih tau, operator yang mutusin lewat 2 tombol di Vista Pekerja ("Ya, masih dikerjakan" /
"Selesai, saya lupa matikan").

AMBANG_MENIT = 8.4 jam, diturunkan dari fcs_kapasitas_override.jam_kerja (16.8 jam = total
kapasitas 2 shift/hari) / 2 - BUKAN angka hardcode sembarangan, basisnya config kapasitas yang
udah ada di sistem (gak ada tabel "durasi shift" eksplisit).

Routing ke device/tablet yang tepat dilakukan di SISI FRONTEND Vista Pekerja (filter `proses`
notifikasi -> divisi lewat DIVISI_CONFIG yang udah ada di sana) - function ini cuma nyimpen
`proses` di tiap notifikasi, gak perlu tau device mana yang bakal nampilinnya.

Efek "reset counter" pas operator dismiss ("Ya, masih dikerjakan"): TIDAK ADA logic eksplisit
buat itu di sini - cukup dari cara "cooldown" dihitung (dari reminder TERAKHIR yang tercatat,
bukan dari mulai timer aslinya) - begitu ada reminder baru tercatat (kapanpun, termasuk yang
baru aja di-dismiss), otomatis gak akan direminder lagi sampai AMBANG_MENIT berikutnya lewat.
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const AMBANG_MENIT = 8.4 * 60 // 504 menit

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const now = Date.now()
    const ambangMs = AMBANG_MENIT * 60 * 1000

    const activeTimers = await fetchAll(supabase, 'fcs_timer_kerja', 'id,pekerja_id,panel_id,kode_komponen,proses,tanggal,mulai', (q) => q.is('selesai', null))
    const overdue = activeTimers.filter((t: any) => now - new Date(t.mulai).getTime() > ambangMs)

    if (overdue.length === 0) return jsonResponse({ checked: activeTimers.length, overdue: 0, reminded: 0 })

    const panelIds = [...new Set(overdue.map((t: any) => t.panel_id))]
    const checkpoints = panelIds.length
      ? await fetchAll(supabase, 'progress_checkpoint_log', 'panel_id,kode_komponen,proses,ts', (q) => q.in('panel_id', panelIds))
      : []

    const timerIds = overdue.map((t: any) => t.id)
    const existingReminders = timerIds.length
      ? await fetchAll(supabase, 'fcs_notifikasi', 'timer_id,created_at', (q) => q.eq('tipe', 'timer_reminder').in('timer_id', timerIds))
      : []
    const lastReminderMap: Record<number, number> = {}
    existingReminders.forEach((r: any) => {
      const t = new Date(r.created_at).getTime()
      if (!lastReminderMap[r.timer_id] || t > lastReminderMap[r.timer_id]) lastReminderMap[r.timer_id] = t
    })

    const pekerjaIds = [...new Set(overdue.map((t: any) => t.pekerja_id))]
    const pekerjaRows = pekerjaIds.length ? await fetchAll(supabase, 'pekerja', 'id,nama', (q) => q.in('id', pekerjaIds)) : []
    const pekerjaMap: Record<string, string> = {}
    pekerjaRows.forEach((p: any) => (pekerjaMap[String(p.id)] = p.nama))

    const panelRows = panelIds.length ? await fetchAll(supabase, 'panels', 'id,nama,tipe', (q) => q.in('id', panelIds)) : []
    const panelMap: Record<string, any> = {}
    panelRows.forEach((p: any) => (panelMap[String(p.id)] = p))

    const tipePanelSet = [...new Set(panelRows.map((p: any) => p.tipe))]
    const bomRows = tipePanelSet.length ? await fetchAll(supabase, 'bom_master', 'kode_komponen,tipe_panel,nama_komponen', (q) => q.in('tipe_panel', tipePanelSet)) : []
    const bomMap: Record<string, string> = {}
    bomRows.forEach((b: any) => (bomMap[`${b.kode_komponen}|${b.tipe_panel}`] = b.nama_komponen))

    const toInsert: any[] = []
    for (const t of overdue) {
      const mulaiMs = new Date(t.mulai).getTime()
      const adaUpdateSetelahMulai = checkpoints.some(
        (c: any) => c.panel_id === t.panel_id && c.kode_komponen === t.kode_komponen && c.proses === t.proses && new Date(c.ts).getTime() > mulaiMs
      )
      if (adaUpdateSetelahMulai) continue // masih aktif diupdate, bukan lupa dimatikan

      const lastReminder = lastReminderMap[t.id]
      if (lastReminder && now - lastReminder < ambangMs) continue // masih cooldown dari reminder/dismiss terakhir

      const panel = panelMap[String(t.panel_id)]
      const namaKomponen = bomMap[`${t.kode_komponen}|${panel?.tipe}`] || t.kode_komponen
      const namaPekerja = pekerjaMap[String(t.pekerja_id)] || 'Operator'
      const jamMulai = new Date(t.mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

      toInsert.push({
        tipe: 'timer_reminder',
        timer_id: t.id,
        pekerja_id: t.pekerja_id,
        pekerja_nama: namaPekerja,
        panel_id: t.panel_id,
        panel_nama: panel?.nama || '',
        kode_komponen: t.kode_komponen,
        nama_komponen: namaKomponen,
        proses: t.proses,
        catatan: `Timer ${namaKomponen} masih berjalan sejak ${jamMulai}. Masih dikerjakan?`,
      })
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('fcs_notifikasi').insert(toInsert)
      if (error) throw error
    }

    return jsonResponse({ checked: activeTimers.length, overdue: overdue.length, reminded: toInsert.length })
  } catch (e: any) {
    console.error(e)
    return jsonResponse({ error: String(e?.message || e) }, 500)
  }
})
