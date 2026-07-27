/*
Auto-geser komponen belum selesai ke hari kerja berikutnya - SERVER-SIDE (Edge Function), dipicu
pg_cron sekali sehari (lihat SQL cron.schedule terpisah). Sengaja BUKAN client-side (beda dari
implementasi lama yang di-revert) - biar cuma ada SATU eksekusi per hari, gak peduli berapa
tab/device/planner yang buka aplikasi, menghilangkan seluruh kelas race condition lintas-tab yang
jadi sumber bug berbulan-bulan sebelumnya.

FASE 1 - LOGIC PER-KOMPONEN (progress, evaluasi tiap kode individual dalam satu WP):
1. Progress = 0% -> GESER MURNI: kode dihapus total dari tanggal asal, jadi kandidat mendarat di
   tanggal tujuan.
2. Progress sebagian (0-100%) -> DUPLIKASI SENGAJA: kode TETAP di tanggal asal apa adanya (histori
   gak boleh hilang), sisa qty-nya JUGA jadi kandidat mendarat di tanggal tujuan.
3. Progress >= 100% -> tidak disentuh.
WIRING CONTROL/WIRING POWER pakai rule sama persis (token __wiring_* di-skip dari evaluasi progress
karena bukan kode BOM asli, kode asli di dalamnya dievaluasi 1-3 seperti biasa).

FASE 2 - CASCADING CAPACITY (BARU): kandidat dari fase 1 gak langsung ditulis ke tanggal tujuan
kalau kapasitas proses itu di tanggal tujuan udah gak cukup. Kapasitas per (tanggal,proses) dibaca
dari fcs_kapasitas_override (kolom kapasitas_unit - udah unify jam/orang), demand dihitung dari
qty sisa x fcs_process_time.menit_per_pcs (proses jam-based) atau headcount token __wiring_Norg_
(WIRING, orang-based - satu tim/WP gerak bareng, gak dipecah per kode). SEMUA kode yang bersaing
slot di tanggal itu (yang UDAH ADA dari jadwal manual + kandidat baru dari geseran) diurutkan:
target WO lebih dekat menang, seri -> kode lebih kecil (natural sort) menang. Yang kalah geser ke
hari berikutnya, evaluasi ulang di sana, dst (maks 90 hari, kalau masih penuh tetap ditempatkan +
log warning overbook, biar gak ada kerjaan yang hilang gak kejadwal sama sekali).
BUSBAR dikecualikan dari cascading (model progress per-tahapnya beda, gak match qty x menit) - tetap
geser langsung ke tanggal tujuan tanpa cek kapasitas, sama seperti sebelumnya.

PRINSIP ANTI-TABRAKAN (lihat diskusi sebelum implementasi ini):
1. TIDAK PERNAH menyentuh panels.checklist[kode].progressByDate/history - itu punya fitur "kunci
   progress per hari" (snapshot), ditulis EKSKLUSIF oleh Vista Pekerja. Fungsi ini cuma BACA
   progress[proses]/qty/qtyProses (live) buat nentuin sudah selesai/sebagian/belum & demand kapasitas.
2. TIDAK PERNAH menyentuh tabel renhar - status Rilis SELALU mulai "Belum Dirilis" di tanggal baru,
   planner rilis manual.
3. Fresh-fetch PER ROW tepat sebelum menulis row itu - jaga-jaga kalau planner drag/edit manual di
   rentang waktu antara select massal di awal dan baris itu diproses.
4. Paginasi PENUH pas fetch semua tabel - jangan ulangi bug limit 1000 baris default Supabase.
5. Jadwal cron di jam 06:00 WIB (dini hari) - jauh dari jam kerja planner.

MODE DRY-RUN: query string ?dryRun=1 (atau body JSON {"dryRun":true}) - gak nulis apapun ke DB
(skip klaim auto_geser_runs & skip update raw_schedule), balikin JSON rincian per-row yang tersentuh
(tanggal mana aja yang berubah, isi sebelum/sesudah). Saat dryRun boleh override tanggal lewat
?hariSumber=YYYY-MM-DD&hariTarget=YYYY-MM-DD (SENGAJA cuma berlaku saat dryRun).
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// NAMEPLATE/YELLOWMARK: proses penanda whole-panel (komponen:["MARKED"], bukan kode BOM asli) - kalau gak dikecualikan, tiap malam bakal dianggap "belum 100%" terus dan digeser tanpa henti.
const PROSES_DIKECUALIKAN = ['QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const PROSES_ORANG = ['WIRING CONTROL', 'WIRING POWER']
// BUSBAR: progress per-tahap (busbar_progress), gak match model qty x menit_per_pcs - dikecualikan dari cascading kapasitas, tetap geser langsung.
const PROSES_TANPA_CASCADE = ['BUSBAR']
const MAX_CASCADE_HARI = 90

const addDaysStr = (date: string, n: number) => {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Sama persis naturalKodeSortGlobal di src/lib/panelHelpers.ts - Deno gak bisa import lintas src/, jadi direplikasi di sini.
const naturalKodeSort = (a: string, b: string) => {
  const parse = (k: string) => {
    const m = String(k).match(/^(.*?)(\d+)$/)
    return m ? { prefix: m[1], num: parseInt(m[2], 10) } : { prefix: k, num: 0 }
  }
  const pa = parse(a), pb = parse(b)
  if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix)
  return pa.num - pb.num
}

type Unit = {
  id: string; rowId: number; wp: string; kode?: string; kodeList?: string[]
  tokenValue?: string | null; demand: number; woTarget: string; sortKode: string
  isExisting: boolean; kasus?: number
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

    const wibNow = new Date(Date.now() + 7 * 60 * 60 * 1000)
    const hariTargetDefault = wibNow.toISOString().slice(0, 10)
    const hariTarget = (dryRun && url.searchParams.get('hariTarget')) || hariTargetDefault
    const hariSumber = (dryRun && url.searchParams.get('hariSumber')) || addDaysStr(hariTarget, -1)

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
      ? await fetchAll('panels', 'id,nama,tipe,wo_id,checklist').then((all) => all.filter((p: any) => panelIds.includes(p.id)))
      : []
    const panelMap: Record<string, any> = {}
    panelRows.forEach((p: any) => { panelMap[String(p.id)] = p })

    const woIds = [...new Set(panelRows.map((p: any) => p.wo_id).filter(Boolean))]
    const woRows = woIds.length > 0
      ? await fetchAll('work_orders', 'id,target').then((all) => all.filter((w: any) => woIds.includes(w.id)))
      : []
    const woTargetMap: Record<string, string> = {}
    woRows.forEach((w: any) => { woTargetMap[String(w.id)] = w.target || '9999-99-99' })
    const woTargetOfPanel = (panel: any) => (panel?.wo_id != null && woTargetMap[String(panel.wo_id)]) || '9999-99-99'

    const capRows = await fetchAll('fcs_kapasitas_override', 'tanggal,jenis_pekerjaan,tipe_kapasitas,kapasitas_unit')
    const capMap: Record<string, { tipe: string; unit: number }> = {}
    capRows.forEach((c: any) => { capMap[`${c.tanggal}|${c.jenis_pekerjaan}`] = { tipe: c.tipe_kapasitas, unit: Number(c.kapasitas_unit) || 0 } })
    const getCap = (tanggal: string, proses: string) => capMap[`${tanggal}|${proses}`] || null

    const ptRows = await fetchAll('fcs_process_time', 'tipe_panel,kode_komponen,jenis_pekerjaan,menit_per_pcs,is_active').then((all) => all.filter((r: any) => r.is_active))
    const ptMap: Record<string, number> = {}
    ptRows.forEach((r: any) => { ptMap[`${r.tipe_panel}|${r.kode_komponen}|${r.jenis_pekerjaan}`] = Number(r.menit_per_pcs) || 0 })
    const getMenitPcs = (tipe: string, kode: string, proses: string) => ptMap[`${tipe}|${kode}|${proses}`] || 0

    // rowOps: rowId -> tanggal -> {add:[{wp,kode,asalTanggal}], remove:[{wp,kode}]}
    const rowOps: Record<number, Record<string, { add: { wp: string; kode: string; asalTanggal: string }[]; remove: { wp: string; kode: string }[] }>> = {}
    const addOp = (rowId: number, tanggal: string, wp: string, kode: string, asalTanggal: string) => {
      if (!rowOps[rowId]) rowOps[rowId] = {}
      if (!rowOps[rowId][tanggal]) rowOps[rowId][tanggal] = { add: [], remove: [] }
      rowOps[rowId][tanggal].add.push({ wp, kode, asalTanggal })
    }
    const removeOp = (rowId: number, tanggal: string, wp: string, kode: string) => {
      if (!rowOps[rowId]) rowOps[rowId] = {}
      if (!rowOps[rowId][tanggal]) rowOps[rowId][tanggal] = { add: [], remove: [] }
      rowOps[rowId][tanggal].remove.push({ wp, kode })
    }
    // tokenCarry: `${rowId}|${tanggal}|${wp}` -> token wiring yang perlu ditempel di entry itu
    const tokenCarry: Record<string, string> = {}

    // ================= FASE 1: klasifikasi progress per kode =================
    const kandidatJam: Record<string, { rowId: number; wp: string; kode: string; tipePanel: string; woTarget: string; menit: number; kasus: number }[]> = {}
    const kandidatOrang: Record<string, { rowId: number; wp: string; kodeList: string[]; tokenValue: string | null; woTarget: string }[]> = {}

    for (const row of rawRows) {
      if (PROSES_DIKECUALIKAN.includes(row.proses)) continue
      const entriesSumber = row.schedule?.[hariSumber] || []
      if (entriesSumber.length === 0) continue
      const panel = panelMap[String(row.panel_id)]
      if (!panel) continue
      const checklist = panel.checklist || {}
      const woTarget = woTargetOfPanel(panel)
      const isOrang = PROSES_ORANG.includes(row.proses)
      const tanpaCascade = PROSES_TANPA_CASCADE.includes(row.proses)

      entriesSumber.forEach((e: any) => {
        const realKode = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
        const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_')) || null
        const kodeIkutGeser: string[] = []
        realKode.forEach((kode: string) => {
          const cl = checklist[kode]
          const pct = cl?.progress?.[row.proses] || 0
          if (pct >= 100) return
          const kasus = pct === 0 ? 1 : 2
          if (kasus === 1) removeOp(row.id, hariSumber, e.wp, kode)
          kodeIkutGeser.push(kode)
          if (tanpaCascade) {
            addOp(row.id, hariTarget, e.wp, kode, hariSumber)
            return
          }
          if (!isOrang) {
            const qtyTotal = Number(cl?.qty) || 0
            const qtyProsesSkrg = Number(cl?.qtyProses?.[row.proses]) || 0
            const qtySisa = Math.max(0, qtyTotal - qtyProsesSkrg)
            const menit = qtySisa * getMenitPcs(panel.tipe, kode, row.proses)
            if (!kandidatJam[row.proses]) kandidatJam[row.proses] = []
            kandidatJam[row.proses].push({ rowId: row.id, wp: e.wp, kode, tipePanel: panel.tipe, woTarget, menit, kasus })
          }
        })
        if (isOrang && !tanpaCascade && kodeIkutGeser.length > 0) {
          if (!kandidatOrang[row.proses]) kandidatOrang[row.proses] = []
          kandidatOrang[row.proses].push({ rowId: row.id, wp: e.wp, kodeList: kodeIkutGeser, tokenValue: token, woTarget })
        }
      })
    }

    // ================= FASE 2: cascading capacity =================
    const priorityCompare = (a: Unit, b: Unit) => {
      if (a.woTarget !== b.woTarget) return a.woTarget < b.woTarget ? -1 : 1
      return naturalKodeSort(a.sortKode, b.sortKode)
    }

    const overbookWarnings: string[] = []

    const cascadePlace = (proses: string, mulaiTanggal: string, unitsAwal: Unit[]) => {
      const hasil = new Map<string, { finalDate: string }>()
      let pool = unitsAwal.slice()
      let tanggal = mulaiTanggal
      let hari = 0
      while (pool.length > 0 && hari < MAX_CASCADE_HARI) {
        const cap = getCap(tanggal, proses)
        const kapasitasUnit = cap?.unit || 0
        if (!cap || kapasitasUnit <= 0) {
          tanggal = addDaysStr(tanggal, 1); hari++; continue
        }
        const sorted = pool.slice().sort(priorityCompare)
        let cum = 0
        const diterima: Unit[] = []
        const overflow: Unit[] = []
        sorted.forEach((u) => {
          if (diterima.length === 0 || cum + u.demand <= kapasitasUnit) { diterima.push(u); cum += u.demand }
          else overflow.push(u)
        })
        diterima.forEach((u) => hasil.set(u.id, { finalDate: tanggal }))
        pool = overflow
        tanggal = addDaysStr(tanggal, 1); hari++
      }
      if (pool.length > 0) {
        overbookWarnings.push(`Kapasitas ${proses} penuh terus sampai ${MAX_CASCADE_HARI} hari sejak ${mulaiTanggal} - ${pool.length} unit tetap ditempatkan (overbook) di ${tanggal}: ${pool.map((u) => u.sortKode).join(',')}`)
        pool.forEach((u) => hasil.set(u.id, { finalDate: tanggal }))
      }
      return hasil
    }

    // -- proses jam-based (semua kecuali WIRING & BUSBAR) --
    for (const [proses, kandidatList] of Object.entries(kandidatJam)) {
      const existingUnits: Unit[] = []
      rawRows.forEach((row: any) => {
        if (row.proses !== proses) return
        const panel = panelMap[String(row.panel_id)]
        if (!panel) return
        const checklist = panel.checklist || {}
        const entries = row.schedule?.[hariTarget] || []
        entries.forEach((e: any) => {
          ;(e.komponen || []).forEach((kode: string) => {
            if (kode.startsWith('__wiring_')) return
            const cl = checklist[kode]
            const qtyTotal = Number(cl?.qty) || 0
            const menit = qtyTotal * getMenitPcs(panel.tipe, kode, proses)
            existingUnits.push({ id: `ex_${row.id}_${e.wp}_${kode}`, rowId: row.id, wp: e.wp, kode, demand: menit, woTarget: woTargetOfPanel(panel), sortKode: kode, isExisting: true })
          })
        })
      })
      const existingKeySet = new Set(existingUnits.map((u) => `${u.rowId}|${u.wp}|${u.kode}`))
      // Kalau planner udah manual jadwalin kode yang sama di tanggal asal & tujuan sekaligus, jangan dihitung dobel (existing + kandidat).
      const candUnits: Unit[] = kandidatList
        .filter((k) => !existingKeySet.has(`${k.rowId}|${k.wp}|${k.kode}`))
        .map((k) => ({ id: `cd_${k.rowId}_${k.wp}_${k.kode}`, rowId: k.rowId, wp: k.wp, kode: k.kode, demand: k.menit, woTarget: k.woTarget, sortKode: k.kode, isExisting: false, kasus: k.kasus }))

      const semuaUnit = [...existingUnits, ...candUnits]
      const adaDataMenit = semuaUnit.some((u) => u.demand > 0)
      let placement: Map<string, { finalDate: string }>
      if (!adaDataMenit) {
        // Gak ada data fcs_process_time buat kode2 ini - gak bisa dihitung demand-nya, skip cascading (langsung ke hariTarget, sama seperti sebelum fitur ini ada).
        placement = new Map()
        semuaUnit.forEach((u) => placement.set(u.id, { finalDate: hariTarget }))
      } else {
        placement = cascadePlace(proses, hariTarget, semuaUnit)
      }

      semuaUnit.forEach((u) => {
        const p = placement.get(u.id)
        if (!p) return
        if (u.isExisting) {
          if (p.finalDate !== hariTarget) {
            removeOp(u.rowId, hariTarget, u.wp, u.kode!)
            addOp(u.rowId, p.finalDate, u.wp, u.kode!, hariTarget)
          }
        } else {
          addOp(u.rowId, p.finalDate, u.wp, u.kode!, hariSumber)
        }
      })
    }

    // -- WIRING (orang-based, satu tim/WP gerak bareng) --
    for (const [proses, kandidatList] of Object.entries(kandidatOrang)) {
      const existingUnits: Unit[] = []
      rawRows.forEach((row: any) => {
        if (row.proses !== proses) return
        const panel = panelMap[String(row.panel_id)]
        const entries = row.schedule?.[hariTarget] || []
        entries.forEach((e: any) => {
          const token = (e.komponen || []).find((k: string) => k.startsWith('__wiring_')) || null
          const realKode = (e.komponen || []).filter((k: string) => !k.startsWith('__wiring_'))
          if (realKode.length === 0) return
          const m = token?.match(/^__wiring_(\d+)org_/)
          const orang = m ? parseInt(m[1], 10) : 1
          const sortKode = realKode.slice().sort(naturalKodeSort)[0]
          existingUnits.push({ id: `ex_${row.id}_${e.wp}`, rowId: row.id, wp: e.wp, kodeList: realKode, tokenValue: token, demand: orang, woTarget: woTargetOfPanel(panel), sortKode, isExisting: true })
        })
      })
      const existingWpKeySet = new Set(existingUnits.map((u) => `${u.rowId}|${u.wp}`))
      const candUnits: Unit[] = kandidatList
        .filter((k) => !existingWpKeySet.has(`${k.rowId}|${k.wp}`))
        .map((k) => {
          const m = k.tokenValue?.match(/^__wiring_(\d+)org_/)
          const orang = m ? parseInt(m[1], 10) : 1
          const sortKode = k.kodeList.slice().sort(naturalKodeSort)[0]
          return { id: `cd_${k.rowId}_${k.wp}`, rowId: k.rowId, wp: k.wp, kodeList: k.kodeList, tokenValue: k.tokenValue, demand: orang, woTarget: k.woTarget, sortKode, isExisting: false }
        })

      const semuaUnit = [...existingUnits, ...candUnits]
      const placement = cascadePlace(proses, hariTarget, semuaUnit)

      semuaUnit.forEach((u) => {
        const p = placement.get(u.id)
        if (!p) return
        if (u.isExisting) {
          if (p.finalDate !== hariTarget) {
            u.kodeList!.forEach((kode) => removeOp(u.rowId, hariTarget, u.wp, kode))
            u.kodeList!.forEach((kode) => addOp(u.rowId, p.finalDate, u.wp, kode, hariTarget))
            if (u.tokenValue) tokenCarry[`${u.rowId}|${p.finalDate}|${u.wp}`] = u.tokenValue
          }
        } else {
          u.kodeList!.forEach((kode) => addOp(u.rowId, p.finalDate, u.wp, kode, hariSumber))
          if (u.tokenValue) tokenCarry[`${u.rowId}|${p.finalDate}|${u.wp}`] = u.tokenValue
        }
      })
    }

    // ================= FASE 3: terapkan (atau simulasikan) =================
    let jumlahRowDiproses = 0
    const detailDryRun: any[] = []

    for (const [rowIdStr, dateOps] of Object.entries(rowOps)) {
      const rowId = Number(rowIdStr)
      const rowAsli = rawRows.find((r: any) => r.id === rowId)
      if (!rowAsli) continue

      const { data: freshRowNow } = dryRun ? { data: null } as any : await supabase.from('raw_schedule').select('schedule').eq('id', rowId).single()
      const scheduleTerkini = freshRowNow?.schedule || rowAsli.schedule || {}
      const scheduleBaru = { ...scheduleTerkini }
      const sebelumSnapshot: Record<string, any> = {}
      const sesudahSnapshot: Record<string, any> = {}

      Object.entries(dateOps).forEach(([tanggal, ops]) => {
        sebelumSnapshot[tanggal] = scheduleTerkini[tanggal] || []
        let entries = (scheduleTerkini[tanggal] || []).map((e: any) => ({ ...e, komponen: [...(e.komponen || [])] }))
        ops.remove.forEach(({ wp, kode }) => {
          const idx = entries.findIndex((e: any) => e.wp === wp)
          if (idx === -1) return
          entries[idx] = { ...entries[idx], komponen: entries[idx].komponen.filter((k: string) => k !== kode) }
        })
        ops.add.forEach(({ wp, kode, asalTanggal }) => {
          const idx = entries.findIndex((e: any) => e.wp === wp)
          if (idx === -1) {
            entries.push({ wp, komponen: [kode], carriedOverFrom: asalTanggal })
          } else if (!entries[idx].komponen.includes(kode)) {
            entries[idx] = { ...entries[idx], komponen: [...entries[idx].komponen, kode] }
          }
        })
        // Token wiring: tempelin balik ke entry yang punya kode asli tapi belum ada token-nya.
        entries = entries.map((e: any) => {
          const key = `${rowId}|${tanggal}|${e.wp}`
          const tokenSeharusnya = tokenCarry[key]
          const punyaRealKode = e.komponen.some((k: string) => !k.startsWith('__wiring_'))
          const punyaToken = e.komponen.some((k: string) => k.startsWith('__wiring_'))
          if (tokenSeharusnya && punyaRealKode && !punyaToken) return { ...e, komponen: [tokenSeharusnya, ...e.komponen] }
          return e
        })
        // Buang entry yang gak punya kode asli sama sekali lagi (termasuk sisa token doang).
        entries = entries.filter((e: any) => e.komponen.some((k: string) => !k.startsWith('__wiring_')))
        scheduleBaru[tanggal] = entries
        sesudahSnapshot[tanggal] = entries
      })

      if (dryRun) {
        detailDryRun.push({ rowId, proses: rowAsli.proses, panel: panelMap[String(rowAsli.panel_id)]?.nama, tipe: panelMap[String(rowAsli.panel_id)]?.tipe, tanggalTersentuh: Object.keys(dateOps), sebelum: sebelumSnapshot, sesudah: sesudahSnapshot })
      } else {
        await supabase.from('raw_schedule').update({ schedule: scheduleBaru }).eq('id', rowId)
      }
      jumlahRowDiproses++
      // Sengaja TIDAK menyentuh renhar sama sekali - status rilis di tanggal baru harus selalu mulai "Belum Dirilis", planner wajib rilis manual lagi.
    }

    if (overbookWarnings.length > 0) console.warn(overbookWarnings.join('\n'))

    return new Response(JSON.stringify({
      success: true, dryRun, hariSumber, hariTarget, jumlahRowDiproses,
      overbookWarnings,
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
