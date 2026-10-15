// PROSES RELEVAN GLOBAL (bom_proses_relevan) - SATU helper muat (CLAUDE.md A.1/A.2/B.1), 15 Okt 2026.
// Insiden WO 069 DP-ROOF (OU_FS): App.tsx membaca tabel ini dgn select("*") TANPA .range() -> PostgREST memotong
// di 1000 baris (tabel 1005 baris) -> OU_FS.1 cuma terbaca BENDING (1 dari 6 baris) -> isKomponenRelevant
// menyembunyikan POTONG/STEL/FINISHING/RENDAM/PAINTING di semua tampilan progres. Baris mana yang terpotong
// acak (tanpa ORDER BY), makin banyak seiring BOM bertambah.
// Aturan: baca SEMUA baris per halaman 1000 dgn urutan tetap; gagal di halaman mana pun = TIDAK mengganti
// himpunan global yang sudah ada (jangan pernah memasang data setengah), lapor ke console + kembalikan false.
import { supabase as supabaseAsli } from './supabase'
import { setGlobalProsesRelevan } from './globalState'

export type BarisProsesRelevan = { kode_komponen: string; tipe_panel: string; jenis_pekerjaan: string }
const HALAMAN = 1000

export async function bacaSemuaProsesRelevan(db: any = supabaseAsli): Promise<BarisProsesRelevan[]> {
  const semua: BarisProsesRelevan[] = []
  for (let dari = 0; ; dari += HALAMAN) {
    const { data, error } = await db.from('bom_proses_relevan')
      .select('kode_komponen,tipe_panel,jenis_pekerjaan')
      .order('kode_komponen').order('tipe_panel').order('jenis_pekerjaan')
      .range(dari, dari + HALAMAN - 1)
    if (error) throw new Error('bom_proses_relevan (baris ' + dari + '+): ' + (error.message || error))
    semua.push(...(data || []))
    if (!data || data.length < HALAMAN) return semua
  }
}

export function bangunSetProsesRelevan(rows: BarisProsesRelevan[]): { relevanSet: Set<string>; hasMappingSet: Set<string> } {
  const relevanSet = new Set<string>()
  const hasMappingSet = new Set<string>()
  rows.forEach((r) => {
    relevanSet.add(r.kode_komponen + '|' + r.tipe_panel + '|' + r.jenis_pekerjaan)
    hasMappingSet.add(r.kode_komponen + '|' + r.tipe_panel)
  })
  return { relevanSet, hasMappingSet }
}

// Muat & pasang ke global (isKomponenRelevant/getRelevantProsesForKode). true = berhasil.
export async function muatProsesRelevanGlobal(db: any = supabaseAsli): Promise<boolean> {
  try {
    const rows = await bacaSemuaProsesRelevan(db)
    const { relevanSet, hasMappingSet } = bangunSetProsesRelevan(rows)
    setGlobalProsesRelevan(relevanSet, hasMappingSet)
    return true
  } catch (err) {
    console.error('[Proses relevan] gagal memuat - mapping lama tetap dipakai:', err)
    return false
  }
}
