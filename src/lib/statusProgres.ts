// STATUS PROGRES KOMPONEN - SATU SUMBER (30 Okt 2026, permintaan user: tanda ● berprogres di Raw Schedule per WP sepadan ✓).
// ✓ selesai = progres >= 100, ● berprogres = 0 < progres < 100 (sudah dimulai belum selesai), kosong = belum mulai. Dipakai
// Raw Schedule tampilan lama (KartuHari statusKomponen/statusTugas) & per WP (rawPivot + RawScheduleAccordion). Di per WP,
// timer operator yang sedang berjalan juga dihitung berprogres (keputusan user) - lihat RawScheduleAccordion.
export type StatusProgres = 'finish' | 'on_progress' | 'belum_mulai'
export const statusDariPersen = (pct: number | null | undefined): StatusProgres =>
  (pct || 0) >= 100 ? 'finish' : (pct || 0) > 0 ? 'on_progress' : 'belum_mulai'
