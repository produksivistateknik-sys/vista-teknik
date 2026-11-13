// LEGENDA PENANDA RAW SCHEDULE (13 Nov 2026, lapis 2 - keputusan user): satu baris penjelasan dua penanda chip yang
// bergaris merah. Dipakai Raw per WP & Raw lama (satu sumber teks). Hanya tampilan.
export function LegendaPenandaRaw() {
  const kotak = (garis: string) => ({ display: 'inline-block', width: 14, height: 10, borderRadius: 3, outline: `2px ${garis} #dc2626`, outlineOffset: 0, marginRight: 4, verticalAlign: '-1px' })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 11, color: 'var(--text-secondary,#475569)', margin: '0 0 8px' }}>
      <span><i style={kotak('solid')} />⚠ Urutan proses terbalik (bingkai merah penuh)</span>
      <span><i style={kotak('dotted')} />⧉ Jadwal dobel: total porsi terjadwal melebihi qty komponen (bingkai merah titik-titik)</span>
    </div>
  )
}
