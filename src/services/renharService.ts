import { supabase } from '../lib/supabase'
import { activityLogService } from './activityLogService'

// Satu-satunya cara yang seharusnya dipakai buat merilis/menarik komponen ke/dari baris
// renhar yang SUDAH ADA - menjamin `komponen` (satu-satunya field yang dibaca Vista Pekerja,
// dikonfirmasi lewat OperatorView.tsx) TIDAK PERNAH jadi subset dari `komponen_released`
// (field tracking rilis sisi admin). Root cause insiden "Pintu Hitam gak muncul" (6 Agu 2026,
// CAPACITOR BANK-1): toggleReleaseKomponen/distributeAll dulu cuma nulis komponen_released,
// gak pernah nyentuh komponen buat baris yang udah ada.
// SENGAJA cuma nambah (union) pas "rilis" - "tarik" cuma lepas dari komponen_released, TIDAK
// menghapus dari komponen (itu tanggung jawab alur lain - edit sel Raw Schedule/drag-move -
// bukan toggle rilis ini, biar scope perubahan tetap sempit sesuai yang diminta).
export function releaseKomponenToRenhar(
  existing: { komponen?: string[]; komponen_released?: string[] } | null | undefined,
  kodeList: string[],
  aksi: 'rilis' | 'tarik',
): { komponen: string[]; komponen_released: string[] } {
  const komponenLama = existing?.komponen || []
  const releasedLama = existing?.komponen_released || []
  const releasedBaru = aksi === 'rilis'
    ? [...new Set([...releasedLama, ...kodeList])]
    : releasedLama.filter((k: string) => !kodeList.includes(k))
  const komponenBaru = aksi === 'rilis'
    ? [...new Set([...komponenLama, ...kodeList])]
    : komponenLama
  return { komponen: komponenBaru, komponen_released: releasedBaru }
}

export const renharService = {
  async getAll() {
    // Supabase/PostgREST default-nya CUMA balikin maks 1000 baris per request tanpa .range()
    // eksplisit - renhar sekarang udah >1000 baris, jadi tanpa paginasi ini row2 di luar 1000
    // pertama (terpotong pas di-sort by tanggal ascending) GAK PERNAH masuk ke renharList sama
    // sekali. Akibatnya: row itu gak pernah bisa "ditambahkan balik" lewat update/realtime-echo
    // (keduanya cuma bisa update row yg UDAH ADA di array), jadi begitu proteksi dirty-nya abis,
    // row itu hilang total dari state lokal - persis akar bug "Rilis balik" yang dikonfirmasi
    // lewat log (renharListRef.current.length selalu mentok di 1000).
    let all: any[] = []
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase.from('renhar').select('*').order('tanggal', { ascending: true }).range(from, from + pageSize - 1)
      if (error) throw new Error(error.message)
      all = all.concat(data ?? [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    return all
  },

  async create(payload: any) {
    const { updated_by, ...safe } = payload
    const uname = updated_by || 'Admin'
    const { data, error } = await supabase.from('renhar').insert(safe).select().single()
    // Kode error Postgres (mis. 23505 unique-violation) dipertahankan di object error yang
    // dilempar - dipakai withRenharQueue buat deteksi "row ini udah keburu dibuat sesi/tab
    // lain barusan" dan retry fetch+update, bukan sekadar gagal diam-diam.
    if (error) throw Object.assign(new Error(error.message), { code: (error as any).code })
    await activityLogService.insert({
      user_name: uname,
      action: 'DISTRIBUSI RENHAR',
      description: `Distribusi proses ${safe.proses} - ${safe.panel} (${safe.tanggal})`,
      module: 'rencana',
      halaman: 'Rencana Harian',
      proyek: safe.proyek || '',
      panel: safe.panel || '',
      wo_number: safe.wo_id?.toString() || '',
    })
    return data
  },

  async update(id: number, payload: any) {
    const { updated_by, ...safe } = payload
    const uname = updated_by || 'Admin'
    const { data, error } = await supabase.from('renhar').update({ ...safe, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    await activityLogService.insert({
      user_name: uname,
      action: 'UPDATE RENHAR',
      description: `Update distribusi proses ${data.proses} - ${data.panel}`,
      module: 'rencana',
      halaman: 'Rencana Harian',
      proyek: data.proyek || '',
      panel: data.panel || '',
      wo_number: data.wo_id?.toString() || '',
    })
    return data
  },

  async remove(id: number): Promise<void> {
    const { data: old } = await supabase.from('renhar').select('*').eq('id', id).single()
    const { error } = await supabase.from('renhar').delete().eq('id', id)
    if (error) throw new Error(error.message)
    await activityLogService.insert({
      user_name: 'Admin',
      action: 'HAPUS RENHAR',
      description: `Hapus distribusi proses ${old?.proses} - ${old?.panel}`,
      module: 'rencana',
      halaman: 'Rencana Harian',
    })
  },
}
