/*
Auto-geser komponen belum selesai ke hari kerja berikutnya - SERVER-SIDE (Edge Function), dipicu
pg_cron sekali sehari (lihat SQL cron.schedule terpisah). Sengaja BUKAN client-side (beda dari
implementasi lama yang di-revert) - biar cuma ada SATU eksekusi per hari, gak peduli berapa
tab/device/planner yang buka aplikasi, menghilangkan seluruh kelas race condition lintas-tab yang
jadi sumber bug berbulan-bulan sebelumnya.

LOGIC PER-KOMPONEN (evaluasi progress tiap kode di dalam satu WP secara individual, bukan borongan):
1. Progress = 0% (belum dikerjakan sama sekali)  -> GESER MURNI: kode dihapus total dari array
   komponen di tanggal asal (WP-nya ikut dihapus dari tanggal itu kalau jadi kosong), muncul
   sebagai entry baru di tanggal tujuan (carriedOverFrom). Tidak ada duplikasi.
2. Progress sebagian (0% < progress < 100%) -> DUPLIKASI SENGAJA: kode TETAP di tanggal asal apa
   adanya (histori/qty yang sudah dikerjakan tidak boleh hilang, baris tetap bisa di-Rilis normal),
   DAN juga ditambahkan sebagai entry baru di tanggal tujuan supaya sisa qty bisa dilanjutkan.
3. Progress >= 100% (selesai) -> tidak disentuh sama sekali, tidak digeser.
WIRING CONTROL/WIRING POWER memakai rule yang SAMA PERSIS seperti proses lain (token __wiring_*
di-skip dari evaluasi progress karena bukan kode BOM asli, tapi kode asli di dalamnya dievaluasi
1-3 seperti biasa - tidak ada lagi pengecualian khusus wiring).

PRINSIP ANTI-TABRAKAN (lihat diskusi sebelum implementasi ini):
1. TIDAK PERNAH menyentuh panels.checklist[kode].progressByDate/history - itu punya fitur "kunci
   progress per hari" (snapshot), ditulis EKSKLUSIF oleh Vista Pekerja. Fungsi ini cuma BACA
   progress[proses] (live) buat nentuin sudah selesai/sebagian/belum, gak pernah menulis balik.
2. TIDAK PERNAH menyentuh tabel renhar - status Rilis di hari baru SELALU mulai "Belum Dirilis",
   planner rilis manual (keputusan final dari histori sebelumnya).
3. Cek existing WP di tanggal tujuan SEBELUM menulis - gabung, jangan bikin entry baru terpisah.
4. Fresh-fetch PER ROW tepat sebelum menulis row itu - jaga-jaga kalau planner drag/edit manual
   row yang sama di rentang waktu antara select massal di awal dan baris itu diproses.
5. Paginasi PENUH pas fetch raw_schedule/panels - jangan ulangi bug limit 1000 baris default
   Supabase yang pernah jadi akar masalah besar di fitur lain.
6. Jadwal cron di jam 06:00 WIB (dini hari) - jauh dari jam kerja planner, minimalkan kemungkinan
   tabrakan waktu dengan aktivitas manual (drag, tambah jadwal, dst).

MODE DRY-RUN (buat testing sebelum production): panggil dengan query string ?dryRun=1 (atau body
JSON {"dryRun":true}) - gak nulis apapun ke DB (skip klaim auto_geser_runs & skip update raw_schedule),
cuma balikin JSON rincian lengkap per-row (kasus 1/2/3 tiap kode, isi schedule sebelum vs sesudah
simulasi). Saat dryRun, boleh override tanggal lewat ?hariSumber=YYYY-MM-DD&hariTarget=YYYY-MM-DD
buat nyoba kasus tertentu dari histori data asli (override tanggal SENGAJA cuma berlaku saat dryRun,
biar gak ada risiko salah pakai di jalur production).
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// NAMEPLATE/YELLOWMARK: proses penanda whole-panel (komponen:["MARKED"], bukan kode BOM asli) - kalau gak dikecualikan, tiap malam bakal dianggap "belum 100%" terus dan digeser tanpa henti.
const PROSES_DIKECUALIKAN = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']

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

    const url = new URL(req.url)
    let dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true'
    if (!dryRun) {
      try {
        const body = await req.json()
        dryRun = !!body?.dryRun
      } catch { /* gak ada body / bukan JSON - trigger cron normal, abaikan */ }
    }

    // Tanggal kalender WIB langsung - cron jalan jam 06:00 WIB, jadi "kemarin" di sini murni tanggal kalender minus 1.
    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const hariTargetDefault = wibNow.toISOString().slice(0, 10)
    const hariTarget = (dryRun && url.searchParams.get('hariTarget')) || hariTargetDefault
    const hariSumber = (dryRun && url.searchParams.get('hariSumber')) || addDaysStr(hariTarget, -1)

    // Klaim eksekusi - idempoten, aman kalau cron sempat retry/dobel-trigger. Dilewati saat dryRun
    // biar simulasi gak "memakai jatah" klaim harian yang sungguhan.
    if (!dryRun) {
      const { error: claimErr } = await supabase
        .from('auto_geser_runs')
        .insert({ hari_sumber: hariSumber, hari_target: hariTarget })
      if (claimErr) {
        return new Response(JSON.stringify({ skipped: true, reason: claimErr.message }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })
      }
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
      ? await fetchAll('panels', 'id,nama,tipe,checklist').then((all) => all.filter((p: any) => panelIds.includes(p.id)))
      : []
    const panelMap: Record<string, any> = {}
    panelRows.forEach((p: any) => { panelMap[String(p.id)] = p })

    let jumlahDipindahUtuh = 0
    let jumlahDisplit = 0
    let rowDiproses = 0
    const detailDryRun: any[] = []

    for (const row of rawRows) {
      if (PROSES_DIKECUALIKAN.includes(row.proses)) continue
      const entriesSumber = row.schedule?.[hariSumber] || []
      if (entriesSumber.length === 0) continue
      const panel = panelMap[String(row.panel_id)]
      if (!panel) continue
      const checklist = panel.checklist || {}

      // Klasifikasi tiap kode asli (token __wiring_* dilewati - bukan komponen) per WP, sesuai kasus 1/2/3.
      const kasus1PerWp: Record<string, string[]> = {} // progress 0% -> geser murni
      const kasus2PerWp: Record<string, string[]> = {} // progress sebagian -> duplikasi sengaja
      entriesSumber.forEach((e: any) => {
        ;(e.komponen || []).forEach((kode: string) => {
          if (kode.startsWith('__wiring_')) return
          const pct = checklist[kode]?.progress?.[row.proses] || 0
          if (pct >= 100) return
          if (pct === 0) {
            if (!kasus1PerWp[e.wp]) kasus1PerWp[e.wp] = []
            kasus1PerWp[e.wp].push(kode)
          } else {
            if (!kasus2PerWp[e.wp]) kasus2PerWp[e.wp] = []
            kasus2PerWp[e.wp].push(kode)
          }
        })
      })
      if (Object.keys(kasus1PerWp).length === 0 && Object.keys(kasus2PerWp).length === 0) continue

      // Fresh-fetch PER ROW tepat sebelum menulis row itu - lindungi dari perubahan manual (drag/edit cell) yang mungkin terjadi sejak select massal di atas.
      const { data: freshRowNow } = dryRun
        ? { data: null } as any
        : await supabase.from('raw_schedule').select('schedule').eq('id', row.id).single()
      const scheduleTerkini = freshRowNow?.schedule || row.schedule || {}
      const entriesTarget = scheduleTerkini[hariTarget] || []
      const kodeSudahAdaDiTarget = new Set<string>()
      entriesTarget.forEach((e: any) => {
        if (e.carriedOverFrom === hariSumber) (e.komponen || []).forEach((k: string) => kodeSudahAdaDiTarget.add(k))
      })

      // Gabungan kode yang perlu ditambahkan ke tanggal tujuan (kasus 1 + kasus 2), anti-duplikat kalau sudah ada dari run sebelumnya.
      const wpTerdampak = new Set([...Object.keys(kasus1PerWp), ...Object.keys(kasus2PerWp)])
      const entryBaru: any[] = []
      wpTerdampak.forEach((wp) => {
        const gabungan = [...new Set([...(kasus1PerWp[wp] || []), ...(kasus2PerWp[wp] || [])])]
        const sisa = gabungan.filter((k) => !kodeSudahAdaDiTarget.has(k))
        if (sisa.length > 0) entryBaru.push({ wp, komponen: sisa, carriedOverFrom: hariSumber })
      })
      if (entryBaru.length === 0) continue

      jumlahDipindahUtuh += Object.values(kasus1PerWp).reduce((s, a) => s + a.length, 0)
      jumlahDisplit += Object.values(kasus2PerWp).reduce((s, a) => s + a.length, 0)

      // Anti-duplikat: gabung ke entry WP yang SUDAH ADA di tanggal tujuan, jangan bikin entry baru terpisah (misal planner udah nambah jadwal manual duluan buat hari itu).
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

      // Tanggal asal: kode kasus 1 (progress 0%) dihapus total dari array komponen-nya (WP ikut
      // dihapus dari tanggal itu kalau jadi kosong). Kode kasus 2 (progress sebagian) dan kasus 3
      // (selesai) TIDAK disentuh - entry tetap persis seperti sebelumnya.
      const entriesSumberBaru = (scheduleTerkini[hariSumber] || [])
        .map((e: any) => {
          const dihapus = new Set(kasus1PerWp[e.wp] || [])
          if (dihapus.size === 0) return e
          return { ...e, komponen: (e.komponen || []).filter((k: string) => !dihapus.has(k)) }
        })
        .filter((e: any) => (e.komponen || []).length > 0)

      const scheduleBaru = { ...scheduleTerkini }
      scheduleBaru[hariTarget] = entriesTargetBaru
      scheduleBaru[hariSumber] = entriesSumberBaru

      if (dryRun) {
        detailDryRun.push({
          rowId: row.id, proses: row.proses, panel: panel.nama || panel.id, tipe: panel.tipe,
          kasus1_geserUtuh: kasus1PerWp, kasus2_splitDuplikasi: kasus2PerWp,
          sebelum: { [hariSumber]: entriesSumber, [hariTarget]: entriesTarget },
          sesudah: { [hariSumber]: entriesSumberBaru, [hariTarget]: entriesTargetBaru },
        })
      } else {
        await supabase.from('raw_schedule').update({ schedule: scheduleBaru }).eq('id', row.id)
      }
      rowDiproses++
      // Sengaja TIDAK menyentuh renhar sama sekali - status rilis di hariTarget harus selalu mulai "Belum Dirilis", planner wajib rilis manual lagi.
    }

    return new Response(JSON.stringify({
      success: true, dryRun, hariSumber, hariTarget, rowDiproses,
      jumlahDipindahUtuh, jumlahDisplit,
      ...(dryRun ? { detail: detailDryRun } : {}),
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
