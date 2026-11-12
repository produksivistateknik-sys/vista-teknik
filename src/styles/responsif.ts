// ATURAN RESPONSIF SATU SUMBER (12 Nov 2026, T0 tampilan mobile admin - keputusan user butir 1).
// Satu teks CSS -> DUA padanan yang setara:
//   1. @media (max-width:Npx){...}  - persis teks lama (HP sungguhan / jendela sempit; desktop tidak berubah);
//   2. html[data-mobile="1"] <selektor>{...}  - mode mobile manual/otomatis, termasuk pratinjau kolom 430px di desktop
//      (lebar layar desktop tidak memicu @media).
// Dilarang menyalin aturan @media secara manual ke versi data-mobile (CLAUDE.md B.1) - pakai aturanHp.
// Batasan: hanya aturan datar "selektor{deklarasi}" (tanpa @media/@supports bersarang) - dicek & dilempar galat.

export const ATRIBUT_MOBILE = 'html[data-mobile="1"]'

type Aturan = { selektor: string[]; isi: string }

// Uraikan CSS datar menjadi daftar aturan (komentar /* */ diabaikan). ketat=true (bawaan, utk MASUKAN aturanHp): selektor
// dgn ()/[]/kutip ditolak krn koma di dalamnya tak bisa dipecah aman. ketat=false hanya utk membaca keluaran (uji).
export function uraikanCssDatar(css: string, ketat = true): Aturan[] {
  const bersih = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const hasil: Aturan[] = []
  let i = 0
  while (i < bersih.length) {
    const buka = bersih.indexOf('{', i)
    if (buka === -1) { if (bersih.slice(i).trim()) throw new Error(`aturanHp: sisa CSS tanpa blok: "${bersih.slice(i).trim().slice(0, 40)}"`); break }
    const tutup = bersih.indexOf('}', buka)
    if (tutup === -1) throw new Error('aturanHp: kurung kurawal tidak tertutup')
    const selektorTeks = bersih.slice(i, buka).trim()
    const isi = bersih.slice(buka + 1, tutup)
    if (selektorTeks.startsWith('@') || isi.includes('{')) throw new Error(`aturanHp: aturan bersarang tidak didukung: "${selektorTeks.slice(0, 40)}"`)
    if (ketat && /[()[\]"']/.test(selektorTeks)) throw new Error(`aturanHp: selektor dgn ()/[]/kutip tidak didukung (koma di dalamnya tak bisa dipecah aman): "${selektorTeks.slice(0, 40)}"`)
    if ((isi.match(/"/g) || []).length % 2 || (isi.match(/'/g) || []).length % 2) throw new Error(`aturanHp: kutip tidak berpasangan (string berisi { } tidak didukung): "${selektorTeks.slice(0, 40)}"`)
    hasil.push({ selektor: selektorTeks.split(',').map((s) => s.trim()).filter(Boolean), isi: isi.trim() })
    i = tutup + 1
  }
  return hasil
}

// Awali setiap selektor dgn atribut mode mobile.
export function awaliMobile(css: string): string {
  return uraikanCssDatar(css).map((a) => `${a.selektor.map((s) => `${ATRIBUT_MOBILE} ${s}`).join(',')}{${a.isi}}`).join('\n')
}

// Satu sumber -> @media (teks asli) + padanan data-mobile.
// Tidak pernah melempar: bila padanan mobile tidak bisa dibuat, @media asli tetap keluar (desktop & HP tidak rusak) dan
// galatnya dicatat di konsol utk pengembang.
export function aturanHp(maxPx: number, css: string): string {
  const media = `@media (max-width:${maxPx}px){${css}}`
  try { return `${media}\n${awaliMobile(css)}` } catch (e) { console.error('[aturanHp] padanan data-mobile dilewati:', e); return media }
}
