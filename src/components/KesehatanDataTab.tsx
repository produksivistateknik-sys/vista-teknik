// KESEHATAN DATA (15 Okt 2026, MVP tahap 1) - status cek otomatis (fungsi SQL jalankan_cek_kesehatan, dijadwalkan
// pg_cron) + sampel temuan + tren 14 hari + log error aplikasi terpusat (log_error_app). Halaman ini HANYA membaca
// tabel hasil; satu-satunya aksi = "Jalankan cek sekarang" (RPC, dibatasi 1x per menit di server).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllPaged } from '../lib/fetchAllPaged'
import { Card, Btn } from './ui/Primitives'

type Cek = { kode: string; nama: string; kategori: string; penjelasan: string | null; frekuensi: string; urutan: number; aktif: boolean }
type Hasil = { id: number; kode: string; waktu: string; jumlah: number | null; status: string; durasi_ms: number | null }
type Detail = { sampel: any[]; pesan_error: string | null }

const WARNA: Record<string, { bg: string; fg: string; label: string }> = {
  ok: { bg: '#dcfce7', fg: '#166534', label: 'OK' },
  info: { bg: '#e0f2fe', fg: '#075985', label: 'Info' },
  peringatan: { bg: '#fef3c7', fg: '#92400e', label: 'Peringatan' },
  kritis: { bg: '#fee2e2', fg: '#991b1b', label: 'Kritis' },
  error: { bg: '#f3e8ff', fg: '#6b21a8', label: 'Cek gagal' },
  belum: { bg: '#f1f5f9', fg: '#475569', label: 'Belum jalan' },
}
const PERINGKAT: Record<string, number> = { kritis: 0, error: 1, peringatan: 2, info: 3, ok: 4, belum: 5 }
const fmtWaktu = (s?: string | null) => s ? new Date(s).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
const tglWib = (s: string) => new Date(Date.parse(s) + 7 * 3600000).toISOString().slice(0, 10)
const tabelBelumAda = (e: any) => /does not exist|PGRST205|42P01|schema cache/i.test(String(e?.message || e?.code || ''))

function Chip({ status }: { status: string }) {
  const w = WARNA[status] || WARNA.belum
  return <span style={{ background: w.bg, color: w.fg, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{w.label}</span>
}

function TabelSampel({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div style={{ fontSize: 12, color: '#64748b', padding: 8 }}>Tidak ada temuan.</div>
  const kolom = [...new Set(rows.flatMap(r => Object.keys(r || {})))].slice(0, 10)
  const tampil = (v: any) => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead><tr>{kolom.map(k => <th key={k} style={{ textAlign: 'left', padding: '6px 8px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', whiteSpace: 'nowrap' }}>{k}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{kolom.map(k => <td key={k} style={{ padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#1e293b', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={tampil(r?.[k])}>{tampil(r?.[k])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

export function KesehatanDataTab() {
  const [memuat, setMemuat] = useState(true)
  const [belumDipasang, setBelumDipasang] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [cek, setCek] = useState<Cek[]>([])
  const [hasil, setHasil] = useState<Hasil[]>([])
  const [detail, setDetail] = useState<Record<string, Detail>>({})
  const [buka, setBuka] = useState<string | null>(null)
  const [errors, setErrors] = useState<any[]>([])
  const [menjalankan, setMenjalankan] = useState(false)

  const muat = async () => {
    setMemuat(true); setGalat(null)
    try {
      const { data: c, error: cErr } = await supabase.from('kesehatan_cek' as any).select('*').order('urutan')
      if (cErr) { if (tabelBelumAda(cErr)) { setBelumDipasang(true); return } throw cErr }
      setBelumDipasang(false)
      const sejak = new Date(Date.now() - 14 * 86400000).toISOString()
      const h = await fetchAllPaged((a, b) => supabase.from('kesehatan_hasil' as any).select('id,kode,waktu,jumlah,status,durasi_ms').gte('waktu', sejak).order('waktu', { ascending: false }).order('id', { ascending: false }).range(a, b))
      // detail (sampel) hanya utk hasil TERBARU tiap cek
      const terbaru = new Map<string, Hasil>()
      for (const x of h as Hasil[]) if (!terbaru.has(x.kode)) terbaru.set(x.kode, x)
      const ids = [...terbaru.values()].map(x => x.id)
      const det: Record<string, Detail> = {}
      if (ids.length) {
        const { data: d, error: dErr } = await supabase.from('kesehatan_hasil' as any).select('id,kode,sampel,pesan_error').in('id', ids)
        if (dErr) throw dErr
        for (const x of (d as any[]) || []) det[x.kode] = { sampel: x.sampel || [], pesan_error: x.pesan_error }
      }
      const { data: e, error: eErr } = await supabase.from('log_error_app' as any).select('*').gte('waktu_terakhir', new Date(Date.now() - 7 * 86400000).toISOString()).order('waktu_terakhir', { ascending: false }).limit(200)
      if (eErr) throw eErr
      setCek((c as any[]) || []); setHasil(h as Hasil[]); setDetail(det); setErrors((e as any[]) || [])
    } catch (err: any) {
      console.error('[Kesehatan Data] gagal memuat:', err)
      setGalat(err?.message || String(err))
    } finally { setMemuat(false) }
  }
  useEffect(() => { muat() }, [])

  const jalankan = async () => {
    setMenjalankan(true)
    const { error } = await supabase.rpc('jalankan_cek_kesehatan' as any, { p_frekuensi: 'manual' } as any)
    setMenjalankan(false)
    if (error) { console.error('[Kesehatan Data] jalankan cek gagal:', error); alert('Gagal menjalankan cek: ' + error.message); return }
    await muat()
  }

  const baris = useMemo(() => {
    const perKode = new Map<string, Hasil[]>()
    for (const x of hasil) { const a = perKode.get(x.kode) || []; a.push(x); perKode.set(x.kode, a) }
    const hari = Array.from({ length: 14 }, (_, i) => tglWib(new Date(Date.now() - (13 - i) * 86400000).toISOString()))
    return cek.filter(c => c.aktif).map(c => {
      const daftar = perKode.get(c.kode) || []
      const akhir = daftar[0]
      const tren = hari.map(d => { const di = daftar.filter(x => tglWib(x.waktu) === d); return di.length ? Math.max(...di.map(x => x.jumlah ?? 0)) : null })
      return { cek: c, akhir, status: akhir?.status || 'belum', tren, hari }
    }).sort((a, b) => (PERINGKAT[a.status] ?? 9) - (PERINGKAT[b.status] ?? 9) || a.cek.urutan - b.cek.urutan)
  }, [cek, hasil])

  if (belumDipasang) return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🩺 Kesehatan Data belum dipasang</div>
      <div style={{ fontSize: 13, color: '#475569' }}>Jalankan migration <code>supabase/migrations/20261015010000_kesehatan_data.sql</code> di SQL Editor, lalu file verifikasinya.</div>
    </Card>
  )

  const ringkas = baris.reduce((m: Record<string, number>, b) => { m[b.status] = (m[b.status] || 0) + 1; return m }, {})
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>🩺 Kesehatan Data</div>
        {Object.entries(ringkas).sort((a, b) => (PERINGKAT[a[0]] ?? 9) - (PERINGKAT[b[0]] ?? 9)).map(([s, n]) => <span key={s} style={{ fontSize: 12 }}><Chip status={s} /> {n}</span>)}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#64748b' }}>Otomatis: per jam (K1, K8) & tiap hari 05:30 WIB</span>
        <Btn outline onClick={muat} disabled={memuat}>↻ Muat ulang</Btn>
        <Btn onClick={jalankan} disabled={menjalankan}>{menjalankan ? 'Menjalankan...' : '▶ Jalankan cek sekarang'}</Btn>
      </div>
      {galat && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 10 }}>Gagal memuat: {galat}</div>}
      {memuat && !baris.length ? <div style={{ fontSize: 13, color: '#64748b' }}>Memuat...</div> : (
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
          {baris.map(({ cek: c, akhir, status, tren, hari }) => {
            const maks = Math.max(1, ...tren.map(t => t ?? 0))
            const d = detail[c.kode]
            return (
              <div key={c.kode} data-cek={c.kode} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div onClick={() => setBuka(buka === c.kode ? null : c.kode)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, width: 34 }}>{c.kode}</span>
                  <Chip status={status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{c.nama}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.kategori} · {c.frekuensi === 'per_jam' ? 'per jam' : 'harian'} · terakhir {fmtWaktu(akhir?.waktu)}{akhir?.durasi_ms != null ? ` · ${akhir.durasi_ms} ms` : ''}</div>
                  </div>
                  <div title={'Tren 14 hari (jumlah temuan maks per hari): ' + tren.map((t, i) => hari[i].slice(5) + '=' + (t ?? '-')).join(', ')} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                    {tren.map((t, i) => <div key={i} style={{ width: 5, height: t == null ? 2 : Math.max(3, Math.round((t / maks) * 24)), background: t == null ? '#e2e8f0' : t > 0 ? '#f59e0b' : '#22c55e', borderRadius: 1 }} />)}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, minWidth: 40, textAlign: 'right', color: (akhir?.jumlah ?? 0) > 0 ? '#b45309' : '#16a34a' }}>{akhir?.jumlah ?? '-'}</span>
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{buka === c.kode ? '▲' : '▼'}</span>
                </div>
                {buka === c.kode && (
                  <div style={{ padding: '0 14px 12px 60px' }}>
                    {c.penjelasan && <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{c.penjelasan}</div>}
                    {d?.pesan_error && <div style={{ fontSize: 12, color: '#6b21a8', marginBottom: 8 }}>Cek gagal: {d.pesan_error}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Sampel temuan terakhir (maks 50 baris){akhir?.jumlah != null && akhir.jumlah > 50 ? ` dari ${akhir.jumlah}` : ''}:</div>
                    <TabelSampel rows={d?.sampel || []} />
                  </div>
                )}
              </div>
            )
          })}
          {!baris.length && <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>Belum ada cek aktif.</div>}
        </Card>
      )}
      <div style={{ fontWeight: 800, fontSize: 14, margin: '6px 0 8px' }}>🧯 Error aplikasi (7 hari terakhir)</div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {errors.length === 0 ? <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>Tidak ada error tercatat.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>{['Terakhir', 'Jenis', 'Jumlah', 'Pesan', 'Halaman', 'Pengguna', 'Versi'].map(k => <th key={k} style={{ textAlign: 'left', padding: '7px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>{k}</th>)}</tr></thead>
              <tbody>{errors.map(e => (
                <tr key={e.id}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{fmtWaktu(e.waktu_terakhir)}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{e.jenis}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700 }}>{e.jumlah}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.pesan + (e.konteks?.lokasi ? '\n' + e.konteks.lokasi : '')}>{e.pesan}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{e.halaman}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{e.pengguna}</td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', color: '#94a3b8' }}>{e.versi}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
