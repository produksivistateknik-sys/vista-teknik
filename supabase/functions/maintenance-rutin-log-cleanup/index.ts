/*
Maintenance Rutin Log Cleanup - dipicu pg_cron HARIAN (lihat migrasi cron.schedule terkait).

Hapus baris maintenance_rutin_log yang `dilakukan_pada` lebih dari 30 hari yang lalu - SENGAJA
di server (pg_cron), BUKAN logic di browser/React, sesuai CLAUDE.md D (auto-geser/hapus terjadwal
wajib server-side, hindari race condition kalau banyak user buka halaman bersamaan).

KENAPA 30 HARI (18 Sep 2026, fitur baru diminta user) - tabel ini dipakai 2 konsumen:
1. Log "Maintenance Rutin" di halaman scan QR publik (MesinPublic.tsx) - SENGAJA dibatasi rolling
   30 hari biar halaman gak numpuk histori tak terbatas.
2. Accordion "Riwayat Dokumentasi" di MaintenanceRutinTab.tsx (admin) - SEBELUMNYA permanen tanpa
   batas, SEKARANG ikut kepotong 30 hari sebagai efek dari hapus fisik ini - KEPUTUSAN SADAR user
   (dikonfirmasi eksplisit, 2 opsi disodorkan: hapus fisik ke keduanya vs filter tampilan doang
   yang gak sentuh admin - user pilih hapus fisik ke keduanya).

AMAN dihapus dari sisi KALKULASI - dicek langsung (18 Sep 2026): jatuh_tempo/terakhir_dilakukan/
kepatuhan% SEMUA baca langsung dari kolom maintenance_rutin (schedule row itu sendiri, diupdate
saat "Tandai Selesai" lewat calcNext() yang murni hitung tanggal), TIDAK PERNAH baca ulang dari
maintenance_rutin_log. Edge function maintenance-reminder-check juga cuma baca maintenance_rutin,
gak sentuh log ini. Jadi hapus baris log lama TIDAK merusak kalkulasi jadwal/reminder/kepatuhan
sama sekali - cuma mengurangi histori tampilan (log/dokumentasi foto lama).
*/

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const jsonResponse = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })

const RETENSI_HARI = 30

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const batas = new Date()
    batas.setDate(batas.getDate() - RETENSI_HARI)
    const batasStr = batas.toISOString().slice(0, 10)

    // .select('id') di delete() - biar tau PERSIS berapa & baris mana yang kehapus (buat log/
    // response), bukan cuma percaya delete "berhasil" tanpa bukti.
    const { data, error } = await supabase
      .from('maintenance_rutin_log')
      .delete()
      .lt('dilakukan_pada', batasStr)
      .select('id')

    if (error) throw error

    return jsonResponse({ success: true, batas: batasStr, dihapus: data?.length ?? 0 })
  } catch (err: any) {
    console.error('maintenance-rutin-log-cleanup error:', err)
    return jsonResponse({ success: false, error: err?.message ?? 'unknown error' }, 500)
  }
})
