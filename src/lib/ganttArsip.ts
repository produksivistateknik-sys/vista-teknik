// TRACKING DURASI PROSES PRODUKSI (Arsip) - bar MULAI -> SELESAI (7 Okt 2026, gantiin badge START).
// SATU sumber hitungan utk modal Gantt (ArsipTab.tsx), PDF & Excel - tampilan web dan cetak tidak
// mungkin beda data. Semua data dibaca dari tabel ARSIP (panels_archived, fcs_timer_kerja_archived,
// progress_checkpoint_log_archived) - tidak ada kolom/tabel baru.
//
// Aturan (disetujui user 7 Okt 2026):
// - MULAI: sama seperti badge START sebelumnya - timer paling awal proses itu (fcs_timer_kerja_archived,
//   lintas semua komponen/WP; Pasang Komponen dari checkpoint paling awal). Busbar per tahap.
// - SELESAI proses per komponen (Potong/Painting/Asb Rakit/Pasang Komponen/Wiring Control/Power):
//   proses dianggap selesai kalau progress panel utk proses itu 100% (calcPanelProgress - angka yang
//   SAMA dgn tampilan Arsip), tanggal selesai = komponen TERAKHIR yang mencapai 100% (= "WP terakhir
//   yang selesai", bukan urutan nomor WP). Waktu 100% per komponen dari progress_checkpoint_log:
//   100% pertama SETELAH koreksi terakhir (<100) - 71 dari 4.748 rangkaian sempat 100 lalu dikoreksi.
//   Cadangan kalau checkpoint tidak ada: history/progressByDate (tanggal saja), lalu timer terakhir.
// - Busbar per tahap: selesai kalau semua pseudo-komponen busbarTahap[tahap].progress >= 100; waktu =
//   timer 100% terakhir tahap itu (cadangan: timer terakhir tahap itu - timer lama tanpa nilai progress).
// - QC: mulai = qc_checklist._global.todo_at (tanpa todo_at = "Belum ada data", sesuai desain),
//   selesai = complete_at. PACKING: hanya packing_done_at -> bar 1 hari.
// - Belum selesai: bar bergaris miring sampai tanggal panel DIARSIPKAN (bukan hari ini - 109/138 panel
//   arsip < 100%, bar tidak boleh memanjang berbulan-bulan setelah pekerjaannya berhenti).
import { calcPanelProgress, BUSBAR_TAHAP_URUTAN, BUSBAR_TAHAP_LABEL } from './panelHelpers'

export const GANTT_ROWS=[
  {key:"POTONG",label:"Potong",icon:"ti ti-scissors",dataProses:"POTONG",color:"#2563eb"},
  {key:"PAINTING",label:"Painting",icon:"ti ti-spray",dataProses:"PAINTING",color:"#ea580c"},
  {key:"RAKIT",label:"Asb Rakit",icon:"ti ti-puzzle",dataProses:"RAKIT",color:"#16a34a"},
  {key:"PASANG KOMPONEN",label:"Pasang Komponen",icon:"ti ti-plug",dataProses:null,color:"#0891b2"},
  {key:"BUSBAR",label:"Busbar",icon:"ti ti-bolt",dataProses:"BUSBAR",color:"#7c3aed"},
  {key:"WIRING CONTROL",label:"Wiring Control",icon:"ti ti-plug-connected",dataProses:"WIRING CONTROL",color:"#4f46e5"},
  {key:"WIRING POWER",label:"Wiring Power",icon:"ti ti-plug-connected-x",dataProses:"WIRING POWER",color:"#9333ea"},
  {key:"QC",label:"QC",icon:"ti ti-clipboard-check",dataProses:null,color:"#e11d48"},
  {key:"PACKING",label:"Packing",icon:"ti ti-package",dataProses:null,color:"#0d9488"},
];
// Warna per tahap Busbar - key SAMA persis BUSBAR_TAHAP_URUTAN (panelHelpers.ts).
export const GANTT_BUSBAR_TAHAP_COLOR:Record<string,string>={FABRIKASI:"#7c3aed",PLATING:"#0d9488",HEATSHRINK:"#d97706",PASANG:"#db2777"};
export const BUSBAR_SINGKATAN:Record<string,string>={FABRIKASI:"FAB",PLATING:"PLT",HEATSHRINK:"HS",PASANG:"PSG"};
const PROSES_PER_KOMPONEN=["POTONG","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"];

export type BarGantt={
  singkatan?:string;      // FAB/PLT/HS/PSG (Busbar)
  labelTahap?:string;     // "Fabrikasi" dst (Busbar)
  color:string;
  mulai:string;           // ISO
  selesai:string|null;    // ISO; null = belum selesai
  akhir:string;           // ISO ujung bar yang digambar (= selesai, atau tanggal diarsipkan kalau belum)
  hari:number;            // panjang bar dalam hari kalender (inklusif, min 1)
};
export type BarisGantt={key:string;label:string;icon:string;color:string;bars:BarGantt[]};

export type DataGanttArsip={
  timer:{proses:string;tahap:string|null;kode_komponen:string|null;mulai:string|null;selesai:string|null;progress:number|null}[];
  checkpoint:{proses:string;kode_komponen:string|null;checkpoint:number|string|null;ts:string|null;tanggal:string|null}[];
};

// Tanggal lokal (YYYY-MM-DD) - kolom Gantt per hari kalender lokal (sama dgn buildDayColumns).
export const tanggalLokal=(iso:string)=>{const d=new Date(iso);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
export const selisihHari=(a:string,b:string)=>{
  const x=new Date(tanggalLokal(a)+"T00:00:00"),y=new Date(tanggalLokal(b)+"T00:00:00");
  return Math.round((y.getTime()-x.getTime())/86400000);
};
const maks=(a:string[])=>a.length?a.reduce((x,y)=>x>y?x:y):null;
const mins=(a:string[])=>a.length?a.reduce((x,y)=>x<y?x:y):null;

// Waktu komponen mencapai 100% utk satu proses (null kalau tidak bisa ditentukan).
function waktu100Komponen(cl:any,proses:string,cps:DataGanttArsip["checkpoint"],timers:DataGanttArsip["timer"]):string|null{
  const urut=cps.filter(c=>c.ts||c.tanggal).map(c=>({t:(c.ts||c.tanggal) as string,v:Number(c.checkpoint)||0})).sort((a,b)=>a.t.localeCompare(b.t));
  if(urut.length){
    let akhirKurang=-1;urut.forEach((c,i)=>{if(c.v<100)akhirKurang=i;});
    const s=urut.slice(akhirKurang+1).find(c=>c.v>=100);
    if(s)return s.t;
  }
  // cadangan 1: history (tanggal saja)
  const h=(cl?.history?.[proses]||[]).filter((e:any)=>e?.tanggal).map((e:any)=>({t:e.tanggal as string,v:Number(e.pct)||0})).sort((a:any,b:any)=>a.t.localeCompare(b.t));
  // cadangan 2: progressByDate (tanggal saja)
  const pbd=Object.entries(cl?.progressByDate?.[proses]||{}).map(([t,v])=>({t,v:Number(v)||0})).sort((a,b)=>a.t.localeCompare(b.t));
  for(const seri of [h,pbd]){
    if(!seri.length)continue;
    let akhirKurang=-1;seri.forEach((c:any,i:number)=>{if(c.v<100)akhirKurang=i;});
    const s=seri.slice(akhirKurang+1).find((c:any)=>c.v>=100);
    if(s)return s.t;
  }
  // cadangan 3: timer terakhir komponen ini
  return maks(timers.map(t=>t.selesai||t.mulai).filter(Boolean) as string[]);
}

function bar(mulai:string,selesai:string|null,akhirBelum:string,color:string,extra?:Partial<BarGantt>):BarGantt{
  let akhir=selesai||akhirBelum;
  if(akhir<mulai)akhir=mulai;
  const sel=selesai&&selesai<mulai?mulai:selesai;
  return{color,mulai,selesai:sel,akhir,hari:Math.max(1,selisihHari(mulai,akhir)+1),...extra};
}

export function hitungGanttArsip(panel:any,data:DataGanttArsip,hariIni:string=new Date().toISOString()):BarisGantt[]{
  const akhirBelum=panel?.diarsipkan_pada||hariIni;
  const checklist=panel?.checklist||{};
  let pd:Record<string,number>={};
  try{pd=calcPanelProgress(panel)||{};}catch{pd={};}
  return GANTT_ROWS.map(r=>{
    const base={key:r.key,label:r.label,icon:r.icon,color:r.color};
    if(r.key==="QC"){
      const g=panel?.qc_checklist?._global||{};
      if(!g.todo_at)return{...base,bars:[]};
      const selesai=g.status==="complete"&&g.complete_at?g.complete_at:null;
      return{...base,bars:[bar(g.todo_at,selesai,akhirBelum,r.color)]};
    }
    if(r.key==="PACKING"){
      const t=panel?.packing_done_at;
      return{...base,bars:t?[bar(t,t,akhirBelum,r.color)]:[]};
    }
    if(r.key==="BUSBAR"){
      const tm=data.timer.filter(t=>t.proses==="BUSBAR");
      const pseudo=Object.entries(checklist).filter(([,c]:any)=>c?.busbarTahap);
      const bars:BarGantt[]=[];
      BUSBAR_TAHAP_URUTAN.forEach((tahap:string)=>{
        const rows=tm.filter(t=>t.tahap===tahap);
        const mulai=mins(rows.map(t=>t.mulai).filter(Boolean) as string[]);
        if(!mulai)return;
        // Hanya pseudo-komponen yang MEMANG punya tahap ini (punya entri busbarTahap[tahap] atau timer
        // tahap ini) - mis. GROUND tidak punya tahap HEATSHRINK, jangan ditunggu (bar jadi "belum selesai" palsu).
        const kodeTahap=new Set(rows.map(t=>t.kode_komponen).filter(Boolean) as string[]);
        const pseudoTahap=pseudo.filter(([k,c]:any)=>c.busbarTahap?.[tahap]||kodeTahap.has(k));
        const selesaiSemua=pseudoTahap.length>0
          ?pseudoTahap.every(([,c]:any)=>(Number(c.busbarTahap?.[tahap]?.progress)||0)>=100)
          :rows.some(t=>(t.progress||0)>=100);
        const selesai=selesaiSemua?(maks(rows.filter(t=>(t.progress||0)>=100).map(t=>t.selesai).filter(Boolean) as string[])||maks(rows.map(t=>t.selesai||t.mulai).filter(Boolean) as string[])):null;
        const c=GANTT_BUSBAR_TAHAP_COLOR[tahap]||r.color;
        bars.push(bar(mulai,selesai,akhirBelum,c,{singkatan:BUSBAR_SINGKATAN[tahap],labelTahap:BUSBAR_TAHAP_LABEL[tahap]}));
      });
      return{...base,bars};
    }
    // Proses per komponen
    const proses=r.key;
    const tm=data.timer.filter(t=>t.proses===proses);
    const cp=data.checkpoint.filter(c=>c.proses===proses);
    const mulaiTimer=mins(tm.map(t=>t.mulai).filter(Boolean) as string[]);
    const mulaiCp=mins(cp.map(c=>c.ts||c.tanggal).filter(Boolean) as string[]);
    // Pasang Komponen: paling awal dari timer & checkpoint (persis START versi lama - timer dulu, lalu
    // checkpoint menimpa kalau lebih awal). Proses lain: timer; checkpoint hanya cadangan kalau tidak
    // ada timer sama sekali (dulu "Belum ada data").
    const mulai=proses==="PASANG KOMPONEN"?mins([mulaiTimer,mulaiCp].filter(Boolean) as string[]):(mulaiTimer||mulaiCp);
    if(!mulai)return{...base,bars:[]};
    let selesai:string|null=null;
    if(PROSES_PER_KOMPONEN.includes(proses)&&(pd[proses]||0)>=100){
      // Komponen yang benar-benar dikerjakan utk proses ini (punya timer/checkpoint atau progress>0).
      const kodes=new Set<string>([
        ...tm.map(t=>t.kode_komponen).filter(Boolean) as string[],
        ...cp.map(c=>c.kode_komponen).filter(Boolean) as string[],
        ...Object.entries(checklist).filter(([,c]:any)=>(c?.qty||0)>0&&(Number(c?.progress?.[proses])||0)>0).map(([k])=>k),
      ]);
      const waktu=[...kodes].map(k=>waktu100Komponen(checklist[k],proses,cp.filter(c=>c.kode_komponen===k),tm.filter(t=>t.kode_komponen===k))).filter(Boolean) as string[];
      selesai=maks(waktu)||mulai;
    }
    return{...base,bars:[bar(mulai,selesai,akhirBelum,r.color)]};
  });
}

// Rentang tanggal seluruh bar (null kalau tidak ada bar sama sekali).
export function rentangGantt(baris:BarisGantt[]):{mulai:string,akhir:string}|null{
  const bars=baris.flatMap(b=>b.bars);
  if(!bars.length)return null;
  return{mulai:mins(bars.map(b=>b.mulai)) as string,akhir:maks(bars.map(b=>b.akhir)) as string};
}
