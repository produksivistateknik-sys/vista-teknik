// TIMELINE "Tracking Durasi Proses Produksi" untuk PDF arsip (5 Okt 2026; 7 Okt 2026: badge START
// diganti BAR mulai -> selesai, sama dgn Gantt di web ArsipTab.tsx). Data bar dari lib/ganttArsip.ts
// (satu sumber dgn modal). Bar belum selesai = pola garis miring, garis oranye = hari ini.
// PDF dibuat jsPDF (bukan print HTML), jadi timeline digambar lewat jspdf-autotable + gambar manual.
// Rentang = tanggal mulai paling awal s/d ujung bar paling akhir; dipecah per blok maks HARI_PER_BLOK
// hari (ditumpuk ke bawah, tiap blok punya sumbu tanggal sendiri); bar yang melewati batas blok
// dipotong & dilanjutkan di blok berikutnya.
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

// Baris timeline = baris tabel "Proses | Mulai | Selesai | Durasi" di atasnya (buildGanttExportRows) -
// SATU sumber. mulai null = "Belum ada data" (baris tetap tampil tanpa bar).
export type BarisGanttPdf={proses:string,color:string,mulai:string|null,akhir:string|null,berjalan:boolean,label:string}

export const HARI_PER_BLOK=16;
const BULAN_PENDEK=["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const HARI_PENDEK=["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const LEBAR_LABEL=44;
const ABU:[number,number,number]=[148,163,184];
const ORANYE:[number,number,number]=[255,106,26];
const hexKeRgb=(hex:string):[number,number,number]=>{
  const h=hex.replace('#','');
  return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
};
const labelTgl=(c:{year:number,month:number,day:number})=>`${c.day} ${BULAN_PENDEK[c.month]} ${c.year}`;

// Bar (rounded) + pola garis miring utk bar yang belum selesai (garis dipotong ke kotak bar via clip).
function gambarBar(doc:jsPDF,x:number,y:number,w:number,h:number,warna:[number,number,number],berjalan:boolean,label:string){
  doc.setFillColor(...warna);
  doc.roundedRect(x,y,w,h,1,1,'F');
  if(berjalan){
    doc.saveGraphicsState();
    doc.rect(x,y,w,h,null as any);
    doc.clip();
    (doc as any).discardPath?.();
    doc.setGState(new (doc as any).GState({opacity:0.4}));
    doc.setDrawColor(255,255,255);
    doc.setLineWidth(.6);
    for(let k=-h;k<w+h;k+=2.2)doc.line(x+k,y+h,x+k+h,y);
    doc.restoreGraphicsState();
  }
  if(label){
    doc.setFont('helvetica','bold');doc.setFontSize(5.4);doc.setTextColor(255,255,255);
    if(doc.getTextWidth(label)+1.5<=w)doc.text(label,x+w/2,y+h/2+.75,{align:'center'});
  }
}

// Gambar bagian "Visualisasi Timeline" mulai startY; kembalikan Y setelahnya.
export function gambarTimelineGanttPdf(doc:jsPDF,rows:BarisGanttPdf[],startY:number,hariIniIso:string=new Date().toISOString()):number{
  const tinggiHal=doc.internal.pageSize.getHeight();
  const lebarHal=doc.internal.pageSize.getWidth();
  const kiri=14,lebarIsi=lebarHal-kiri*2;
  let y=startY;
  const pastikanRuang=(perlu:number)=>{if(y+perlu>tinggiHal-14){doc.addPage();y=20;}};
  const adaBar=rows.filter(r=>r.mulai&&r.akhir);
  pastikanRuang(30);
  doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(23,27,46);
  doc.text("Visualisasi Timeline",kiri,y);
  doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.setTextColor(107,114,128);
  if(adaBar.length===0){
    doc.text("Belum ada data tanggal proses untuk panel ini.",kiri,y+6);
    doc.setTextColor(0,0,0);
    return y+14;
  }
  const rangeStart=adaBar.map(r=>r.mulai!).reduce((a,b)=>a<b?a:b);
  const rangeEnd=adaBar.map(r=>r.akhir!).reduce((a,b)=>a>b?a:b);
  const cols=buildDayColumns(rangeStart,rangeEnd);
  const blok:typeof cols[]=[];
  for(let i=0;i<cols.length;i+=HARI_PER_BLOK)blok.push(cols.slice(i,i+HARI_PER_BLOK));
  doc.text(`Bar = mulai s/d selesai tiap proses · ${labelTgl(cols[0])} – ${labelTgl(cols[cols.length-1])}`
    +(blok.length>1?` · ${blok.length} blok (maks ${HARI_PER_BLOK} hari per blok)`:""),kiri,y+5);
  // Legenda
  const ly=y+8.5;
  gambarBar(doc,kiri,ly,9,3.2,[37,99,235],false,"");
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(107,114,128);
  doc.text("Selesai (100%)",kiri+10.5,ly+2.5);
  gambarBar(doc,kiri+34,ly,9,3.2,[37,99,235],true,"");
  doc.setFont('helvetica','normal');doc.setFontSize(7);doc.setTextColor(107,114,128);
  doc.text("Belum selesai (s/d tanggal diarsipkan)",kiri+44.5,ly+2.5);
  doc.setDrawColor(...ORANYE);doc.setLineWidth(.6);doc.line(kiri+98,ly-.3,kiri+98,ly+3.5);
  doc.text("Hari ini",kiri+99.5,ly+2.5);
  y+=15;
  const lebarHari=(lebarIsi-LEBAR_LABEL)/HARI_PER_BLOK;
  const idxHariIni=colIndexForDate(cols,hariIniIso);
  const tinggiBlok=12+rows.length*7.6+(blok.length>1?5:0);
  blok.forEach((kolom,bi)=>{
    pastikanRuang(tinggiBlok<tinggiHal-40?tinggiBlok:30);
    if(blok.length>1){
      doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(71,85,105);
      doc.text(`Blok ${bi+1}/${blok.length} · ${labelTgl(kolom[0])} – ${labelTgl(kolom[kolom.length-1])}`,kiri,y+3);
      y+=5;
    }
    const awalBlok=bi*HARI_PER_BLOK;
    const iHari=idxHariIni-awalBlok;
    const columnStyles:Record<number,any>={0:{cellWidth:LEBAR_LABEL}};
    kolom.forEach((_,i)=>{columnStyles[i+1]={cellWidth:lebarHari,halign:'center'};});
    // Posisi baris dicatat saat sel digambar; bar & garis hari ini digambar SETELAH tabel selesai
    // (di atas semua sel - kalau digambar per sel, sel berikutnya menimpa bar yang melebar).
    const posBaris:Record<number,{y:number,h:number,hal:number}>={};
    let xKol0=kiri+LEBAR_LABEL;
    autoTable(doc,{
      startY:y,
      margin:{left:kiri,right:lebarHal-kiri-(LEBAR_LABEL+lebarHari*kolom.length)},
      tableWidth:LEBAR_LABEL+lebarHari*kolom.length,
      theme:'grid',
      head:[["",...kolom.map(c=>{const dow=new Date(c.year,c.month,c.day).getDay();return`${c.day} ${BULAN_PENDEK[c.month]}\n${HARI_PENDEK[dow]}`;})]],
      body:rows.map(r=>r.mulai
        ?[r.proses,...kolom.map(()=>"")]
        :[r.proses,{content:"Belum ada data",colSpan:kolom.length,styles:{fontStyle:'italic',textColor:ABU,halign:'left'}}]),
      styles:{fontSize:7,cellPadding:{top:2.2,bottom:2.2,left:1,right:1},lineColor:[226,228,234],lineWidth:.2,minCellHeight:7.5,valign:'middle'},
      headStyles:{fillColor:[248,249,251],textColor:[107,114,128],fontSize:6,fontStyle:'bold',halign:'center'},
      alternateRowStyles:{fillColor:[248,249,251]},
      columnStyles:{...columnStyles,0:{cellWidth:LEBAR_LABEL,fontStyle:'bold',textColor:[23,27,46],cellPadding:{top:2.2,bottom:2.2,left:5,right:1}}},
      didParseCell:(d:any)=>{if(d.section==='head'&&d.column.index-1===iHari)d.cell.styles.textColor=ORANYE;},
      didDrawCell:(d:any)=>{
        if(d.section!=='body'||d.column.index!==0)return;
        const r=rows[d.row.index];if(!r)return;
        doc.setFillColor(...(r.mulai?hexKeRgb(r.color):ABU));
        doc.circle(d.cell.x+2.4,d.cell.y+d.cell.height/2,.9,'F');
        xKol0=d.cell.x+d.cell.width;
        posBaris[d.row.index]={y:d.cell.y,h:d.cell.height,hal:(doc as any).internal.getCurrentPageInfo().pageNumber};
      },
    });
    const halAkhir=(doc as any).internal.getCurrentPageInfo().pageNumber;
    // garis hari ini (cuma kalau masuk blok ini)
    const barisPos=Object.values(posBaris);
    if(iHari>=0&&iHari<kolom.length&&barisPos.length){
      const hal=barisPos[0].hal;
      const diHal=barisPos.filter(p=>p.hal===hal);
      doc.setPage(hal);
      const xs=xKol0+lebarHari*(iHari+.5);
      doc.setDrawColor(...ORANYE);doc.setLineWidth(.5);
      doc.line(xs,Math.min(...diHal.map(p=>p.y)),xs,Math.max(...diHal.map(p=>p.y+p.h)));
    }
    // bar (bagian yang jatuh di blok ini)
    rows.forEach((r,ri)=>{
      const pos=posBaris[ri];if(!pos||!r.mulai||!r.akhir)return;
      const iA=colIndexForDate(cols,r.mulai)-awalBlok,iZ=colIndexForDate(cols,r.akhir)-awalBlok;
      if(iZ<0||iA>=kolom.length)return;
      const a=Math.max(0,iA),z=Math.min(kolom.length-1,iZ);
      doc.setPage(pos.hal);
      const h=4.2,x=xKol0+lebarHari*a+.5,w=lebarHari*(z-a+1)-1,yy=pos.y+(pos.h-h)/2;
      gambarBar(doc,x,yy,w,h,hexKeRgb(r.color),r.berjalan,r.label);
    });
    doc.setPage(halAkhir);
    y=(doc as any).lastAutoTable.finalY+5;
  });
  doc.setFont('helvetica','normal');doc.setTextColor(0,0,0);
  return y+3;
}
