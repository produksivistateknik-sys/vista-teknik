import { supabase as supabaseTyped } from '../lib/supabase'
import { getLocalDateStr } from '../lib/dateHelpers'
import { sesuaikanBusbarKeJumlahBaru, hitungPctSetelahUbahQty } from '../lib/progressQtyHelpers'
import { activityLogService } from './activityLogService'

// ─────────────────────────────────────────────────────────────────────────────
// PENYESUAIAN BUSBAR (2 Okt 2026, keputusan user) - komponen busbar tidak punya qty, jadi saat
// pekerjaan busbar bertambah Admin mengisi "jumlah sebelum -> sesudah" per komponen busbar di popup
// Manajemen WO (muncul otomatis setelah simpan qty, atau tombol "Sesuaikan Busbar"). Satu pintu:
// 1. checklist[kode].busbarTahap + progress/history/progressByDate BUSBAR (sesuaikanBusbarKeJumlahBaru)
// 2. component_process_progress BUSBAR per tahap (persen, status, sudah_disimpan_100)
// 3. jadwal LANGSUNG: kode masuk busbar_schedule[hari ini]; tanggal lampau yang memuat kode itu
//    ditandai busbar_jejak[tgl][kode] = hari ini (pola sama drag BUSBAR di RawSchedule / auto-geser)
//    supaya Tarik tidak menarik ulang = tidak dobel. Rilis ke Rencana Harian tetap lewat Distribusi.
// Tabel/kolom busbar belum semua ada di tipe generated -> client tanpa tipe di file ini.
// ─────────────────────────────────────────────────────────────────────────────
const supabase: any = supabaseTyped
const pctKeStatusCcp = (pct: number) => pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'not_started'

export type ItemPenyesuaianBusbar = { kode: string; jumlahLama: number; jumlahBaru: number }

export async function simpanPenyesuaianBusbar(panelId: number, items: ItemPenyesuaianBusbar[], uname: string, konteks: { panelNama: string; proyek: string; woNumber: string }) {
  const berlaku = items.filter(i => i.jumlahLama > 0 && i.jumlahBaru > 0 && i.jumlahLama !== i.jumlahBaru)
  if (!berlaku.length) return { checklist: null as any, jadwal: [] as string[] }

  // 1. checklist - baca SEGAR dari DB (jangan timpa progress operator yang barusan masuk)
  const { data: fresh, error: rErr } = await supabase.from('panels').select('checklist').eq('id', panelId).single()
  if (rErr) throw new Error('baca panel: ' + rErr.message)
  const checklist = { ...(fresh?.checklist || {}) }
  const ringkas: string[] = []
  for (const it of berlaku) {
    const cl = checklist[it.kode]
    if (!cl?.busbarTahap) throw new Error(`komponen busbar ${it.kode} belum punya data tahap`)
    const baru = sesuaikanBusbarKeJumlahBaru(cl, it.jumlahLama, it.jumlahBaru)
    checklist[it.kode] = baru
    ringkas.push(`${it.kode} ${it.jumlahLama}->${it.jumlahBaru} (${cl.progress?.BUSBAR ?? 0}% -> ${baru.progress.BUSBAR}%)`)
  }
  const { error: uErr } = await supabase.from('panels').update({ checklist }).eq('id', panelId)
  if (uErr) throw new Error('simpan checklist: ' + uErr.message)
  const { data: cek, error: cErr } = await supabase.from('panels').select('checklist').eq('id', panelId).single()
  if (cErr) throw new Error('verifikasi baca-balik gagal (koneksi) - cek ulang panel ini: ' + cErr.message)
  const gagal = berlaku.filter(it => JSON.stringify(cek?.checklist?.[it.kode]?.busbarTahap) !== JSON.stringify(checklist[it.kode].busbarTahap))
  if (gagal.length) throw new Error('verifikasi baca-balik tidak cocok: ' + gagal.map(g => g.kode).join(', '))

  // 2. component_process_progress BUSBAR per tahap (cuma baris yang sudah ada)
  const { data: ccp, error: ccpErr } = await supabase.from('component_process_progress')
    .select('id,kode_komponen,tahap,progress_pct,status').eq('panel_id', panelId).eq('proses', 'BUSBAR')
    .in('kode_komponen', berlaku.map(i => i.kode)).range(0, 999)
  if (ccpErr) throw new Error('baca component_process_progress BUSBAR: ' + ccpErr.message)
  for (const r of ccp || []) {
    if (!r.tahap || r.status === 'not_applicable') continue
    const it = berlaku.find(i => i.kode === r.kode_komponen)!
    const pct = hitungPctSetelahUbahQty(Number(r.progress_pct) || 0, 0, it.jumlahLama, it.jumlahBaru)
    const status = pctKeStatusCcp(pct)
    const patch: any = { progress_pct: status === 'not_started' ? 0 : pct, status, updated_at: new Date().toISOString(), updated_by: uname }
    if (pct < 100) patch.sudah_disimpan_100 = false
    const { error } = await supabase.from('component_process_progress').update(patch).eq('id', r.id)
    if (error) throw new Error(`update component_process_progress ${r.kode_komponen}/${r.tahap}: ${error.message}`)
  }

  // 3. jadwal langsung hari ini + jejak tanggal lampau (cuma kode yang hasilnya < 100%)
  const hariIni = getLocalDateStr()
  const perluJadwal = berlaku.filter(it => (Number(checklist[it.kode].progress?.BUSBAR) || 0) < 100).map(it => it.kode)
  const jadwal: string[] = []
  if (perluJadwal.length) {
    const { data: rows, error: rawErr } = await supabase.from('raw_schedule').select('id,busbar_schedule,busbar_jejak')
      .eq('panel_id', panelId).eq('proses', 'BUSBAR').is('deleted_at', null)
    if (rawErr) throw new Error('baca raw_schedule BUSBAR: ' + rawErr.message)
    const row = (rows || [])[0]
    if (!row) throw new Error('baris jadwal BUSBAR panel ini belum ada di Raw Schedule - jalankan FCS panel ini dulu, lalu tambahkan busbar manual')
    const bs: any = { ...(row.busbar_schedule || {}) }
    const bj: any = { ...(row.busbar_jejak || {}) }
    for (const kode of perluJadwal) {
      for (const t of Object.keys(bs)) {
        if (t >= hariIni || !(bs[t] || []).includes(kode) || bj[t]?.[kode]) continue
        bj[t] = { ...(bj[t] || {}), [kode]: hariIni }
        jadwal.push(`${kode} ${t}->${hariIni}`)
      }
      bs[hariIni] = [...new Set([...(bs[hariIni] || []), kode])]
    }
    const { error: wErr } = await supabase.from('raw_schedule').update({ busbar_schedule: bs, busbar_jejak: bj }).eq('id', row.id)
    if (wErr) throw new Error('simpan jadwal BUSBAR: ' + wErr.message)
  }

  await activityLogService.insert({
    user_name: uname, action: 'PENYESUAIAN BUSBAR', module: 'wo', halaman: 'Manajemen WO',
    proyek: konteks.proyek, panel: konteks.panelNama, wo_number: konteks.woNumber,
    description: `Penyesuaian busbar ${konteks.panelNama} (${konteks.proyek}): ${ringkas.join(', ')}` +
      (perluJadwal.length ? ` | dijadwalkan ${hariIni}: ${perluJadwal.join(', ')}${jadwal.length ? ' (jejak: ' + jadwal.join('; ') + ')' : ''}` : ''),
  })
  return { checklist, jadwal: perluJadwal }
}
