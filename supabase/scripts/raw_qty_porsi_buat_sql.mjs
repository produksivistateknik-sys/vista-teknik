// PEMBERSIHAN "PROSES DOBEL" Raw Schedule (30 Okt 2026) - PEMBUAT SQL, BACA SAJA (anon key .env.local, kredensial tidak
// dicetak). Mencari pasangan (komponen, proses) yang total qty terjadwalnya (entri NYATA, bukan jejak digeserKe) MELEBIHI
// qty panel karena auto-geser/pindah dulu membuang qtyPerKomponen (porsi pecahan template) -> entri pindahan dianggap qty penuh.
// Perbaikan per entri pindahan (carriedOverFrom, tanpa porsi):
//   1. porsi = qtyPerKomponen entri JEJAK asalnya (wp sama, digeserKe[kode] = tanggal entri ini), bila ada;
//   2. selain itu porsi = qty - jumlah porsi entri nyata lain (entri lain tanpa porsi = penuh -> tidak bisa, dilewati);
//   hanya bila hasil 1 <= porsi < qty. Sisanya dilaporkan (perlu keputusan planner), TIDAK diubah.
// Tidak ada entri yang dihapus. SQL keluaran: cadangan baris -> UPDATE ber-penjaga (hanya bila entri masih persis sama) ->
// ringkasan. Jalankan: node supabase/scripts/raw_qty_porsi_buat_sql.mjs  (menulis supabase/scripts/20261030_raw_qty_porsi.sql)
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
const req = createRequire(path.resolve('package.json'))
const { createClient } = req('@supabase/supabase-js')
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const all = async (t, c, f = q => q) => { let r = []; for (let i = 0; ; i += 1000) { const { data, error } = await f(db.from(t).select(c)).order('id').range(i, i + 999); if (error) throw new Error(t + ': ' + error.message); r = r.concat(data); if (data.length < 1000) break } return r }
const KHUSUS = ['BUSBAR', 'QC TEST', 'PACKING', 'NAMEPLATE', 'YELLOWMARK']
const raw = await all('raw_schedule', 'id,wo_id,panel_id,panel,proses,schedule', q => q.is('deleted_at', null))
const wo = new Map((await all('work_orders', 'id,wo')).map(w => [w.id, w.wo]))
const ids = [...new Set(raw.map(r => r.panel_id))]; let pn = []
for (let i = 0; i < ids.length; i += 150) { const { data, error } = await db.from('panels').select('id,checklist').in('id', ids.slice(i, i + 150)); if (error) throw error; pn = pn.concat(data) }
const cl = new Map(pn.map(p => [p.id, p.checklist || {}]))

const ubah = [], lewati = []; let kasus = 0
for (const r of raw) {
  if (KHUSUS.includes(r.proses) || r.proses.startsWith('WIRING')) continue
  const nyata = new Map(), jejak = []
  for (const [d, es] of Object.entries(r.schedule || {})) (es || []).forEach((e, i) => {
    for (const k of e.komponen || []) {
      if (k.startsWith('__wiring_')) continue
      const x = { d, i, wp: e.wp, q: e.qtyPerKomponen?.[k], dari: e.carriedOverFrom || null }
      if (e.digeserKe?.[k]) jejak.push({ ...x, k, ke: e.digeserKe[k] })
      else nyata.set(k, [...(nyata.get(k) || []), x])
    }
  })
  for (const [k, es] of nyata) {
    if (new Set(es.map(x => x.d)).size < 2) continue
    const qty = Number(cl.get(r.panel_id)?.[k]?.qty) || 0
    const total = es.reduce((a, x) => a + (x.q ?? qty), 0)
    if (!qty || total <= qty) continue
    kasus++
    const label = `${wo.get(r.wo_id) || r.wo_id} ${r.panel_id} ${r.panel.trim()} ${r.proses} ${k} (qty ${qty}, terjadwal ${total})`
    let diperbaiki = false
    for (const x of es) {
      if (x.q != null || !x.dari) continue
      const asal = jejak.find(j => j.k === k && j.wp === x.wp && j.ke === x.d && j.q != null)
      let porsi = asal?.q, cara = 'porsi entri jejak asal ' + asal?.d
      if (porsi == null) {
        const lain = es.filter(y => y !== x)
        if (lain.some(y => y.q == null)) continue
        porsi = qty - lain.reduce((a, y) => a + y.q, 0); cara = 'qty - porsi entri lain'
      }
      if (!(porsi >= 1 && porsi < qty)) continue
      ubah.push({ raw: r.id, d: x.d, i: x.i, wp: x.wp, k, porsi, label, cara })
      diperbaiki = true
    }
    if (!diperbaiki) lewati.push(`${label}: ${es.map(x => x.d.slice(5) + (x.q != null ? ' q=' + x.q : ' penuh') + (x.dari ? ' (geser dari ' + x.dari.slice(5) + ')' : '')).join(', ')}`)
  }
}

const esc = s => String(s).replace(/'/g, "''")
const lit = (v) => `'${esc(v)}'`
const rawIds = [...new Set(ubah.map(u => u.raw))]
const sql = `-- PEMBERSIHAN PORSI QTY RAW SCHEDULE (30 Okt 2026) - DIBUAT OTOMATIS ${new Date().toISOString()} oleh
-- supabase/scripts/raw_qty_porsi_buat_sql.mjs dari data live. SIAP JALAN: Run sekali. Satu transaksi.
-- ${kasus} pasangan (komponen, proses) total terjadwal > qty; ${ubah.length} entri pindahan diisi kembali porsinya
-- (${rawIds.length} baris raw_schedule); ${lewati.length} pasangan TIDAK diubah (lihat daftar di bawah, perlu keputusan planner).
-- Setiap UPDATE dijaga: hanya berlaku bila entri di tanggal/indeks itu masih wp sama, masih memuat kode itu & masih TANPA porsi.
-- Entri yang sudah berubah sejak skrip dibuat dilewati otomatis (tidak menimpa editan planner). Tidak ada entri yang dihapus.
-- Cadangan: tabel cadangan_raw_qty_porsi_20261030 (schedule sebelum). Rollback: lihat bagian paling bawah.
begin;
create table if not exists public.cadangan_raw_qty_porsi_20261030 (raw_id bigint primary key, schedule jsonb not null, dicadangkan_pada timestamptz not null default now());
alter table public.cadangan_raw_qty_porsi_20261030 enable row level security;
revoke all on public.cadangan_raw_qty_porsi_20261030 from anon, authenticated;
insert into public.cadangan_raw_qty_porsi_20261030 (raw_id, schedule)
  select id, schedule from public.raw_schedule where id in (${rawIds.join(',') || 'null'}) on conflict (raw_id) do nothing;

create temp table _hasil (raw_id bigint, tanggal text, kode text, porsi int, berlaku boolean) on commit drop;
${ubah.map(u => `with x as (update public.raw_schedule set schedule = jsonb_set(schedule, array[${lit(u.d)}, '${u.i}', 'qtyPerKomponen'],
    coalesce(schedule #> array[${lit(u.d)}, '${u.i}', 'qtyPerKomponen'], '{}'::jsonb) || jsonb_build_object(${lit(u.k)}, ${u.porsi})), updated_at = now()
  where id = ${u.raw} and schedule #>> array[${lit(u.d)}, '${u.i}', 'wp'] = ${lit(u.wp)}
    and (schedule #> array[${lit(u.d)}, '${u.i}', 'komponen']) ? ${lit(u.k)}
    and not coalesce(schedule #> array[${lit(u.d)}, '${u.i}', 'qtyPerKomponen'], '{}'::jsonb) ? ${lit(u.k)}
    and not coalesce(schedule #> array[${lit(u.d)}, '${u.i}', 'digeserKe'], '{}'::jsonb) ? ${lit(u.k)}
  returning id) insert into _hasil select ${u.raw}, ${lit(u.d)}, ${lit(u.k)}, ${u.porsi}, exists (select 1 from x); -- ${esc(u.label)} | ${u.cara}`).join('\n')}

select count(*) filter (where berlaku) as entri_diperbaiki, count(*) filter (where not berlaku) as dilewati_karena_sudah_berubah,
       (select count(*) from public.cadangan_raw_qty_porsi_20261030) as baris_dicadangkan
from _hasil;
commit;

-- TIDAK DIUBAH (${lewati.length}) - entri ganda tanpa petunjuk porsi (mis. dua entri penuh utk qty 1), perlu dicek planner:
${lewati.map(l => '--   ' + l).join('\n')}

-- ROLLBACK (bila perlu, kembalikan schedule baris yang diubah dari cadangan):
-- update public.raw_schedule r set schedule = c.schedule, updated_at = now() from public.cadangan_raw_qty_porsi_20261030 c where r.id = c.raw_id;
`
const out = 'supabase/scripts/20261030_raw_qty_porsi.sql'
fs.writeFileSync(out, sql)
console.log(`kasus total>qty: ${kasus} | entri diperbaiki: ${ubah.length} (baris raw ${rawIds.length}) | pasangan tidak diubah: ${lewati.length}`)
console.log('cara:', JSON.stringify(ubah.reduce((a, u) => (a[u.cara.split(' 20')[0]] = (a[u.cara.split(' 20')[0]] || 0) + 1, a), {})))
console.log('contoh tidak diubah:'); lewati.slice(0, 6).forEach(l => console.log('  ', l))
console.log('SQL ditulis:', out)
