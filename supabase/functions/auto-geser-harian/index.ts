// Auto-geser komponen belum selesai ke hari kerja berikutnya - SERVER-SIDE (Edge Function),
// dipicu pg_cron sekali sehari (lihat SQL cron.schedule terpisah). Sengaja BUKAN client-side
// (beda dari implementasi lama yang di-revert) - biar cuma ada SATU eksekusi per hari, gak
// peduli berapa tab/device/planner yang buka aplikasi, menghilangkan seluruh kelas race
// condition lintas-tab yang jadi sumber bug berbulan-bulan sebelumnya.
//
// PRINSIP ANTI-TABRAKAN (lihat diskusi sebelum implementasi ini):
// 1. TIDAK PERNAH menyentuh panels.checklist[kode].progressByDate/history - itu punya fitur
//    "kunci progress per hari" (snapshot), ditulis EKSKLUSIF oleh Vista Pekerja. Fungsi ini
//    cuma BACA progress[proses] (live) buat nentuin "udah selesai apa belum", gak pernah nulis
//    balik ke situ - dua fitur beda lapisan data total, gak mungkin nabrak.
// 2. TIDAK PERNAH menyentuh tabel renhar - status Rilis di hari baru SELALU mulai "Belum
//    Dirilis", planner rilis manual (keputusan final dari histori sebelumnya).
// 3. Cek existing WP di tanggal tujuan SEBELUM nulis - gabung, jangan bikin entry baru
//    terpisah (cegah duplikat kalau planner udah nambah jadwal manual duluan buat hari itu).
// 4. Fresh-fetch PER ROW tepat sebelum nulis row itu - jaga2 kalau planner drag/edit manual
//    row yang sama di rentang waktu antara select massal di awal dan baris itu diproses.
// 5. Paginasi PENUH pas fetch raw_schedule/panels - JANGAN ulangi bug limit 1000 baris
//    default Supabase yang baru ditemukan (akar masalah besar di fitur lain).
// 6. Jadwal cron di jam 03:00 WIB (dini hari) - JAUH dari jam kerja planner, minimalkan
//    kemungkinan tabrakan waktu dengan aktivitas manual (drag, tambah jadwal, dst).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROSES_DIKECUALIKAN = ['QC TEST', 'PACKING']
const PROSES_WIRING = ['WIRING CONTROL', 'WIRING POWER']

const addDaysStr = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Tanggal kalender WIB langsung (BUKAN getHariKerjaSekarang() yang dipakai live di app -
    // itu boundary jam 07:00 buat keperluan UI real-time; cron ini jalan jam 03:00 WIB, jadi
    // "kemarin" di sini murni tanggal kalender - 1).
    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const hariTarget = wibNow.toISOString().slice(0, 10)
    const hariSumber = addDaysStr(hariTarget, -1)

    // Klaim eksekusi - idempoten, aman kalau cron sempat retry/dobel-trigger dari Supabase.
    const { error: claimErr } = await supabase
      .from('auto_geser_runs')
      .insert({ hari_sumber: hariSumber, hari_target: hariTarget })
    if (claimErr) {
      return new Response(JSON.stringify({ skipped: true, reason: claimErr.message }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }

    const fetchAll = async (table: string, select: string) => {
      let all: any[] = []
      let from = 0
      while (true) {
        const { data, error } = await supabase.from(table).select(select).range(from, from + 999)
        if (error) throw error
        all = all.concat(data ?? [])
        if (!data || data.length < 1000) break
        from += 1000
      }
      return all
    }

    const rawRows = await fetchAll('raw_schedule', '*')
    const panelIds = [...new Set(rawRows.map((r: any) => r.panel_id).filter(Boolean))]
    const panelRows = panelIds.length > 0
      ? await fetchAll('panels', 'id,checklist').then((all) => all.filter((p: any) => panelIds.includes(p.id)))
      : []
    const panelMap: Record<string, any> = {}
    panelRows.forEach((p: any) => { panelMap[String(p.id)] = p })

    let jumlahDigeser = 0
    let rowDiproses = 0

    for (const row of rawRows) {
      if (PROSES_DIKECUALIKAN.includes(row.proses)) continue
      const entriesSumber = row.schedule?.[hariSumber] || []
      if (entriesSumber.length === 0) continue
      const panel = panelMap[String(row.panel_id)]
      if (!panel) continue
      const isWiring = PROSES_WIRING.includes(row.proses)
      const checklist = panel.checklist || {}

      const kodeEligiblePerWp: Record<string, string[]> = {}
      entriesSumber.forEach((e: any) => {
        ;(e.komponen || []).forEach((kode: string) => {
          if (kode.startsWith('__wiring_')) return
          const cl = checklist[kode]
          const pct = cl?.progress?.[row.proses] || 0
          if (pct >= 100) return
          if (isWiring && pct > 0) return
          if (!kodeEligiblePerWp[e.wp]) kodeEligiblePerWp[e.wp] = []
          kodeEligiblePerWp[e.wp].push(kode)
        })
      })
      if (Object.keys(kodeEligiblePerWp).length === 0) continue

      // Fresh-fetch PER ROW tepat sebelum nulis - lindungi dari perubahan manual (drag/edit
      // cell) yang mungkin terjadi di rentang waktu sejak select massal di atas.
      const { data: freshRowNow } = await supabase.from('raw_schedule').select('schedule').eq('id', row.id).single()
      const scheduleTerkini = freshRowNow?.schedule || row.schedule || {}
      const entriesTarget = scheduleTerkini[hariTarget] || []
      const kodeSudahDigeser = new Set<string>()
      entriesTarget.forEach((e: any) => {
        if (e.carriedOverFrom === hariSumber) (e.komponen || []).forEach((k: string) => kodeSudahDigeser.add(k))
      })

      const entryBaru: any[] = []
      Object.entries(kodeEligiblePerWp).forEach(([wp, kodes]) => {
        const sisa = kodes.filter((k) => !kodeSudahDigeser.has(k))
        if (sisa.length > 0) entryBaru.push({ wp, komponen: sisa, carriedOverFrom: hariSumber })
      })
      if (entryBaru.length === 0) continue
      jumlahDigeser += entryBaru.reduce((s, e) => s + e.komponen.length, 0)

      // Anti-duplikat: gabung ke entry WP yang SUDAH ADA di tanggal tujuan (misal planner
      // udah nambah jadwal manual buat hari itu duluan) - jangan bikin entry baru terpisah.
      const entriesTargetBaru = [...entriesTarget]
      entryBaru.forEach((eb) => {
        const idx = entriesTargetBaru.findIndex((e: any) => e.wp === eb.wp)
        if (idx !== -1) {
          const setKomp = new Set([...(entriesTargetBaru[idx].komponen || []), ...eb.komponen])
          entriesTargetBaru[idx] = { ...entriesTargetBaru[idx], komponen: Array.from(setKomp) }
        } else {
          entriesTargetBaru.push(eb)
        }
      })

      const scheduleBaru = { ...scheduleTerkini }
      scheduleBaru[hariTarget] = entriesTargetBaru
      // Entry ASLI di hariSumber TETAP DISIMPAN APA ADANYA (histori/status rilis di tanggal
      // itu jangan hilang), cuma ditandai digeserKe per-kode - UI nonaktifkan tombol Rilis di
      // tanggal asal buat kode itu, tapi datanya tetap utuh.
      scheduleBaru[hariSumber] = (scheduleTerkini[hariSumber] || []).map((e: any) => {
        const kodeDigeserWp = entryBaru.find((nb) => nb.wp === e.wp)?.komponen || []
        if (kodeDigeserWp.length === 0) return e
        const digeserKeBaru = { ...(e.digeserKe || {}) }
        kodeDigeserWp.forEach((k: string) => { digeserKeBaru[k] = hariTarget })
        return { ...e, digeserKe: digeserKeBaru }
      })

      await supabase.from('raw_schedule').update({ schedule: scheduleBaru }).eq('id', row.id)
      rowDiproses++
      // Sengaja TIDAK menyentuh renhar sama sekali - status rilis di hariTarget harus selalu
      // mulai "Belum Dirilis", planner wajib rilis manual lagi.
    }

    return new Response(JSON.stringify({ success: true, hariSumber, hariTarget, rowDiproses, jumlahDigeser }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
