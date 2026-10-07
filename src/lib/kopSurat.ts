// KOP SURAT RESMI PT. VISTA INTI TEKNIK (7 Okt 2026) - SATU tempat konfigurasi teks & warna kop, dipakai
// semua dokumen cetak (PDF arsip Tracking Durasi sekarang; Print Qty dll nanti). Ubah teks/warna kop DI SINI.
// Desain yang disetujui user: kop penuh menempel tepi atas & kiri-kanan kertas di halaman 1 (rasio 1653:389,
// ±49 mm di A4 - sama dgn kop di file Word user), kop ringkas di halaman lanjutan. Posisi/ukuran dikonversi
// dari HTML/CSS desain (satuan "cqw" = 1% lebar kop).
// Aset (logo transparan 660x310 + font Carlito subset) dimuat LAZY lewat siapkanKop() hanya saat export.
import type jsPDF from 'jspdf'

export const KOP_SURAT={
  namaPt:"PT. VISTA INTI TEKNIK",
  alamat:["Jln. Muncul, Komplek Pergudangan Ritz Gate blok BF-15,","Gedangan – Sidoarjo"],
  telepon:"031 – 85589496",
  website:"www.vistateknik.co.id",
  email:"vista.intiteknik@gmail.com",
  bidangUsaha:[
    ["ELECTRICAL SWITCHBOARD","MANUFACTURING"],
    ["ELECTRICAL POWER","SYSTEM DESIGN"],
    ["MECHANICAL, ELECTRICAL","& INSTRUMENTATION SUPPLIER"],
    ["AUTOMATION SYSTEM","CONTROL ENGINEERING"],
  ],
  warna:{latar:"#050505",emas:"#f3d887",teks:"#ddd09f",oranye:"#f37321",oranye2:"#f39a2e",poin:"#ee8a3c",titik:"#c9c3b0"},
};
// Baris alamat ke-2 & baris web/email persis susunan kop asli.
export const barisAlamatKop=()=>[KOP_SURAT.alamat[0],`${KOP_SURAT.alamat[1]}, Telp. : ${KOP_SURAT.telepon}`];
export const barisWebKop=()=>`${KOP_SURAT.website},  Email : ${KOP_SURAT.email}`;

export const RASIO_KOP_PENUH=389/1653;
const MM_KE_PT=72/25.4;
const rgb=(hex:string):[number,number,number]=>{const h=hex.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};

export type AsetKop={logoDataUri:string;font:string};

// Muat aset (sekali per dokumen): daftarkan Carlito ke jsPDF. Gagal muat font -> pakai Helvetica (kop tetap tercetak).
export async function siapkanKop(doc:jsPDF):Promise<AsetKop>{
  const a=await import('./kopSuratAset');
  let font='helvetica';
  try{
    doc.addFileToVFS('Carlito-Regular.ttf',a.CARLITO_REGULAR_TTF_BASE64);
    doc.addFont('Carlito-Regular.ttf','Carlito','normal');
    doc.addFileToVFS('Carlito-Bold.ttf',a.CARLITO_BOLD_TTF_BASE64);
    doc.addFont('Carlito-Bold.ttf','Carlito','bold');
    font='Carlito';
  }catch(e){console.warn('Font Carlito gagal dimuat, kop memakai Helvetica:',e);}
  return{logoDataUri:'data:image/png;base64,'+a.LOGO_KOP_PNG_BASE64,font};
}

// KOP PENUH - mulai (0,0), selebar kertas. Kembalikan tingginya (mm).
export function gambarKopPenuh(doc:jsPDF,aset:AsetKop):number{
  const W=doc.internal.pageSize.getWidth();
  const H=W*RASIO_KOP_PENUH;
  const cq=W/100; // 1cqw
  const w=KOP_SURAT.warna;
  doc.saveGraphicsState();
  // latar hitam
  doc.setFillColor(...rgb(w.latar));doc.rect(0,0,W,H,'F');
  // pola titik samar di kiri (34% lebar, memudar ke kanan mulai 40%)
  const lebarTitik=W*.34,jarak=2.1*cq;
  doc.setFillColor(...rgb(w.titik));
  for(let x=jarak/2;x<lebarTitik;x+=jarak){
    const t=x/lebarTitik;
    const op=.22*(t<=.4?1:Math.max(0,1-(t-.4)/.6));
    if(op<=.01)continue;
    doc.setGState(new (doc as any).GState({opacity:op}));
    for(let y=jarak/2;y<H;y+=jarak)doc.circle(x,y,.28,'F');
  }
  doc.setGState(new (doc as any).GState({opacity:1}));
  // poin bidang usaha (kiri)
  const fsPoin=1.15*cq,lhPoin=fsPoin*1.55;
  let yBaris=H*.26;
  doc.setFont(aset.font,'bold');doc.setFontSize(fsPoin*MM_KE_PT);doc.setTextColor(...rgb(w.poin));doc.setFillColor(...rgb(w.poin));
  const xPoin=W*.019;
  KOP_SURAT.bidangUsaha.forEach(baris=>{
    const d=.95*cq;
    doc.circle(xPoin+d/2,yBaris+.34*fsPoin+d/2,d/2,'F');
    baris.forEach(teks=>{doc.text(teks,xPoin+1.7*cq,yBaris+lhPoin/2+fsPoin*.35);yBaris+=lhPoin;});
  });
  // tengah: nama PT, alamat, web/email
  const xTengah=W*.5;
  let y=H*.19;
  const fsNama=4.7*cq,lhNama=fsNama*1.1;
  doc.setFont(aset.font,'normal');doc.setFontSize(fsNama*MM_KE_PT);doc.setTextColor(...rgb(w.emas));
  doc.text(KOP_SURAT.namaPt,xTengah,y+lhNama/2+fsNama*.35,{align:'center'});
  y+=lhNama+2.2*cq;
  const fsAlamat=2.3*cq,lhAlamat=fsAlamat*1.34;
  doc.setFontSize(fsAlamat*MM_KE_PT);doc.setTextColor(...rgb(w.teks));
  barisAlamatKop().forEach(b=>{doc.text(b,xTengah,y+lhAlamat/2+fsAlamat*.35,{align:'center'});y+=lhAlamat;});
  y+=1.5*cq;
  const fsWeb=2.1*cq,lhWeb=fsWeb*1.2;
  doc.setFontSize(fsWeb*MM_KE_PT);
  doc.text(barisWebKop(),xTengah,y+lhWeb/2+fsWeb*.35,{align:'center'});
  // logo (kanan) - PNG transparan, rasio asli 660x310
  const lebarLogo=W*.205;
  doc.addImage(aset.logoDataUri,'PNG',W*.768,H*.32,lebarLogo,lebarLogo*310/660,'logo-kop','NONE');
  // garis oranye bawah + tab
  doc.setFillColor(...rgb(w.oranye));doc.rect(0,H-H*.024,W,H*.024,'F');
  const lebarTab=W*.192,tinggiTab=H*.098,r=1.4*cq;
  // tab: sudut ATAS membulat, sudut bawah rata (rounded rect + kotak penutup separuh bawah), tidak keluar kop
  const xTab=W-W*.006-lebarTab,rr=Math.min(r,tinggiTab/2);
  doc.setFillColor(...rgb(w.oranye2));
  doc.roundedRect(xTab,H-tinggiTab,lebarTab,tinggiTab,rr,rr,'F');
  doc.rect(xTab,H-tinggiTab/2,lebarTab,tinggiTab/2,'F');
  doc.restoreGraphicsState();
  doc.setFont('helvetica','normal');doc.setTextColor(0,0,0);
  return H;
}

// KOP RINGKAS (halaman lanjutan) - pita hitam: nama PT + judul dokumen/WO di kiri, logo kecil di kanan.
export const TINGGI_KOP_RINGKAS=20;
export function gambarKopRingkas(doc:jsPDF,aset:AsetKop,sub:string):number{
  const W=doc.internal.pageSize.getWidth();
  const H=TINGGI_KOP_RINGKAS,cq=W/100,w=KOP_SURAT.warna;
  doc.saveGraphicsState();
  doc.setFillColor(...rgb(w.latar));doc.rect(0,0,W,H,'F');
  const lebarLogo=15*cq,tinggiLogo=lebarLogo*310/660;
  doc.addImage(aset.logoDataUri,'PNG',W-3.5*cq-lebarLogo,(H-tinggiLogo)/2,lebarLogo,tinggiLogo,'logo-kop','NONE');
  const fsT=2.6*cq,fsS=1.7*cq;
  doc.setFont(aset.font,'normal');doc.setFontSize(fsT*MM_KE_PT);doc.setTextColor(...rgb(w.emas));
  doc.text(KOP_SURAT.namaPt,3.5*cq,H/2-.4);
  doc.setFontSize(fsS*MM_KE_PT);doc.setTextColor(...rgb(w.teks));
  // Pengaman: teks terlalu panjang (nama panel >±105 karakter) dipotong dgn "…" supaya tidak menabrak logo.
  const batasTeks=W-3.5*cq-lebarLogo-3.5*cq-3;
  let teksSub=sub;
  while(teksSub.length>4&&doc.getTextWidth(teksSub)>batasTeks)teksSub=teksSub.slice(0,-2).trimEnd()+"…";
  doc.text(teksSub,3.5*cq,H/2+fsS*.2+fsS*.9);
  doc.setFillColor(...rgb(w.oranye));doc.rect(0,H-.9,W,.9,'F');
  doc.restoreGraphicsState();
  doc.setFont('helvetica','normal');doc.setTextColor(0,0,0);
  return H;
}
