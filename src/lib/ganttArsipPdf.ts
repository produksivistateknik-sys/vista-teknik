// TIMELINE "Tracking Durasi Proses Produksi" untuk PDF arsip (5 Okt 2026) - visualisasi yang sama
// dgn Gantt di web (ArsipTab.tsx): baris per proses, badge "START" berwarna di kolom tanggal mulai.
// PDF dibuat jsPDF (bukan print HTML), jadi timeline digambar lewat jspdf-autotable + didDrawCell.
// Rentang = tanggal mulai paling awal s/d paling akhir; dipecah per blok maks HARI_PER_BLOK hari
// (ditumpuk ke bawah, tiap blok punya sumbu tanggal sendiri) supaya badge START selalu terbaca.
import type jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Kolom HARIAN Gantt (dipindah dari ArsipTab.tsx 5 Okt 2026 tanpa perubahan - dipakai bareng web &
// PDF). weekIdx dihitung per kolom (day 1-7=Wk1, 8-14=Wk2, dst - restart tiap bulan baru).
export const buildDayColumns=(rangeStart:string,rangeEnd:string)=>{
  const start=new Date(rangeStart);start.setHours(0,0,0,0);
  const end=new Date(rangeEnd);end.setHours(0,0,0,0);
  const cols:{year:number,month:number,day:number,weekIdx:number}[]=[];
  const cur=new Date(start);
  while(cur<=end){
    cols.push({year:cur.getFullYear(),month:cur.getMonth(),day:cur.getDate(),weekIdx:Math.floor((cur.getDate()-1)/7)});
    cur.setDate(cur.getDate()+1);
  }
  return cols;
};
export const colIndexForDate=(cols:{year:number,month:number,day:number}[],iso:string)=>{
  const d=new Date(iso);
  const y=d.getFullYear(),m=d.getMonth(),day=d.getDate();
  return cols.findIndex(c=>c.year===y&&c.month===m&&c.day===day);
};

// Baris timeline = baris tabel "Proses | Tanggal Mulai" di atasnya (buildGanttExportRows) - SATU
// sumber, iso null = "Belum ada data" (baris tetap tampil tanpa badge).
export type BarisGanttPdf={proses:string,tanggalMulai:string,iso:string|null,color:string}

export const HARI_PER_BLOK=16;
const BULAN_PENDEK=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const HARI_PENDEK=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const LEBAR_LABEL=44,ABU:[number,number,number]=[148,163,184];
const hexKeRgb=(hex:string):[number,number,number]=>{
  const h=hex.replace('#','');
  return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
};
const labelTgl=(c:{year:number,month:number,day:number})=>`${c.day} ${BULAN_PENDEK[c.month]} ${c.year}`;

// Gambar bagian "Visualisasi Timeline" mulai startY; kembalikan Y setelahnya.
export function gambarTimelineGanttPdf(doc:jsPDF,rows:BarisGanttPdf[],startY:number):number{
  const tinggiHal=doc.internal.pageSize.getHeight();
  const lebarHal=doc.internal.pageSize.getWidth();
  const kiri=14,lebarIsi=lebarHal-kiri*2;
  let y=startY;
  const pastikanRuang=(perlu:number)=>{if(y+perlu>tinggiHal-14){doc.addPage();y=20;}};
  const isoAda=rows.map(r=>r.iso).filter(Boolean) as string[];
  pastikanRuang(24);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(23,27,46);
  doc.text("Visualisasi Timeline",kiri,y);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(107,114,128);
  if(isoAda.length===0){
    doc.text("Belum ada data tanggal mulai proses untuk panel ini.",kiri,y+6);
    doc.setTextColor(0,0,0);
    return y+14;
  }
  const rangeStart=isoAda.reduce((a,b)=>a<b?a:b),rangeEnd=isoAda.reduce((a,b)=>a>b?a:b);
  const cols=buildDayColumns(rangeStart,rangeEnd);
  const blok:typeof cols[]=[];
  for(let i=0;i<cols.length;i+=HARI_PER_BLOK)blok.push(cols.slice(i,i+HARI_PER_BLOK));
  doc.text(`Badge START menandai tanggal mulai tiap proses · ${labelTgl(cols[0])} – ${labelTgl(cols[cols.length-1])}`
    +(blok.length>1?` · ${blok.length} blok (maks ${HARI_PER_BLOK} hari per blok)`:""),kiri,y+5);
  y+=9;
  const lebarHari=(lebarIsi-LEBAR_LABEL)/HARI_PER_BLOK;
  // Perkiraan tinggi 1 blok (header + baris) - blok yang tidak muat di sisa halaman pindah UTUH ke
  // halaman berikutnya (tidak terpotong di tengah), selama 1 blok memang muat dalam 1 halaman.
  const tinggiBlok=12+rows.length*7.6+(blok.length>1?5:0);
  blok.forEach((kolom,bi)=>{
    pastikanRuang(tinggiBlok<tinggiHal-40?tinggiBlok:30);
    if(blok.length>1){
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(71,85,105);
      doc.text(`Blok ${bi+1}/${blok.length} · ${labelTgl(kolom[0])} – ${labelTgl(kolom[kolom.length-1])}`,kiri,y+3);
      y+=5;
    }
    const idxPerBaris=rows.map(r=>r.iso?colIndexForDate(kolom,r.iso):-1);
    const columnStyles:Record<number,any>={0:{cellWidth:LEBAR_LABEL}};
    kolom.forEach((_,i)=>{columnStyles[i+1]={cellWidth:lebarHari,halign:'center'};});
    autoTable(doc,{
      startY:y,
      margin:{left:kiri,right:lebarHal-kiri-(LEBAR_LABEL+lebarHari*kolom.length)},
      tableWidth:LEBAR_LABEL+lebarHari*kolom.length,
      theme:'grid',
      head:[["",...kolom.map(c=>{const dow=new Date(c.year,c.month,c.day).getDay();return`${c.day} ${BULAN_PENDEK[c.month]}\n${HARI_PENDEK[dow]}`;})]],
      body:rows.map(r=>r.iso
        ?[r.proses,...kolom.map(()=>"")]
        :[r.proses,{content:"Belum ada data",colSpan:kolom.length,styles:{fontStyle:'italic',textColor:ABU,halign:'left'}}]),
      styles:{fontSize:7,cellPadding:{top:2.2,bottom:2.2,left:1,right:1},lineColor:[226,228,234],lineWidth:.2,minCellHeight:7.5,valign:'middle'},
      headStyles:{fillColor:[248,249,251],textColor:[107,114,128],fontSize:6,fontStyle:'bold',halign:'center'},
      alternateRowStyles:{fillColor:[248,249,251]},
      columnStyles:{...columnStyles,0:{cellWidth:LEBAR_LABEL,fontStyle:'bold',textColor:[23,27,46],cellPadding:{top:2.2,bottom:2.2,left:5,right:1}}},
      didDrawCell:(d:any)=>{
        if(d.section!=='body')return;
        const r=rows[d.row.index];if(!r)return;
        if(d.column.index===0){
          doc.setFillColor(...(r.iso?hexKeRgb(r.color):ABU));
          doc.circle(d.cell.x+2.4,d.cell.y+d.cell.height/2,.9,'F');
          return;
        }
        if(!r.iso||idxPerBaris[d.row.index]!==d.column.index-1)return;
        const w=Math.min(d.cell.width-1,8.4),h=3.8;
        const x=d.cell.x+(d.cell.width-w)/2,yy=d.cell.y+(d.cell.height-h)/2;
        doc.setFillColor(...hexKeRgb(r.color));
        doc.roundedRect(x,yy,w,h,.8,.8,'F');
        doc.setFont('helvetica','bold');doc.setFontSize(5.2);doc.setTextColor(255,255,255);
        doc.text("START",x+w/2,yy+h/2+.7,{align:'center'});
      },
    });
    y=(doc as any).lastAutoTable.finalY+5;
  });
  doc.setFont('helvetica','normal');doc.setTextColor(0,0,0);
  return y+3;
}
