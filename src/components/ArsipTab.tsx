import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { calcPanelProgress, getEffCfgGlobal, BUSBAR_TAHAP_LABEL, BUSBAR_TAHAP_URUTAN } from '../lib/panelHelpers'
import { DIVISI_CONFIG } from '../constants/panelTypes'
import { Modal } from './ui/Primitives'
import { FotoZoomViewer } from './FotoZoomViewer'
import { isVideoFoto, isGenericFoto } from '../lib/mediaThumb'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const QC_STATUS_LABEL:Record<string,{label:string,color:string,bg:string}>={
  to_do:{label:"To Do",color:"#64748b",bg:"#f1f5f9"},
  in_progress:{label:"In Progress",color:"#ea580c",bg:"#fff7ed"},
  complete:{label:"Complete",color:"#16a34a",bg:"#f0fdf4"},
};

const QC_ITEMS_ARSIP=[
  {key:"fisik",label:"Pemeriksaan Fisik"},
  {key:"spesifikasi",label:"Verifikasi Spesifikasi Komponen"},
  {key:"baut",label:"Pengecekan Kekencangan Baut"},
  {key:"test",label:"QC Test"},
];

// Section "progress+foto flat" - Nameplate/Yellowmark/Assembling/Warehouse/QS semuanya punya
// bentuk sama persis (1 angka progress + 1 array foto langsung di kolom panels), beda dari QC
// (checklist per-item) dan Wiring Control (per-komponen). Sama persis kolom yang dipakai
// LaporanNameplateView/LaporanKomponenProgressView/LaporanPasangKomponenView.
const QC_CENTER_SECTIONS_FLAT=[
  {key:"nameplate",label:"Nameplate",icon:"🏷️",progressField:"nameplate_progress",fotoField:"nameplate_photos"},
  {key:"yellowmark",label:"Yellowmark",icon:"🟡",progressField:"yellowmark_progress",fotoField:"yellowmark_photos"},
  {key:"warehouse",label:"Warehouse",icon:"📦",progressField:"warehouse_progress",fotoField:"warehouse_photos"},
  {key:"qs",label:"QS",icon:"📋",progressField:"qs_progress",fotoField:"qs_photos"},
];

// Baris tabel Gantt "Tracking Durasi Proses Produksi" (15 Sep 2026, spesifikasi final - gantiin
// modal "Durasi Pengerjaan" versi sebelumnya). SENGAJA cuma 9 baris (bukan 13 ALL_PROSES) - ini
// permintaan eksplisit user, BENDING/STEL/FINISHING/RENDAM sengaja tidak dijadikan baris terpisah
// di dashboard ringkas ini. `dataProses` = key proses yang dipakai buat query fcs_timer_kerja
// (POTONG/PAINTING/RAKIT/BUSBAR/WIRING CONTROL/WIRING POWER), null buat 3 baris yang START-nya
// dari sumber lain (PASANG KOMPONEN dari progress_checkpoint_log, QC dari qc_checklist.todo_at,
// PACKING dari packing_done_at - lihat openGanttDetail).
const GANTT_ROWS=[
  {key:"POTONG",label:"Potong",icon:"ti ti-scissors",dataProses:"POTONG",color:"#2563eb",bg:"#eff6ff",border:"#bfdbfe"},
  {key:"PAINTING",label:"Painting",icon:"ti ti-spray",dataProses:"PAINTING",color:"#ea580c",bg:"#fff7ed",border:"#fed7aa"},
  {key:"RAKIT",label:"Asb Rakit",icon:"ti ti-puzzle",dataProses:"RAKIT",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
  {key:"PASANG KOMPONEN",label:"Pasang Komponen",icon:"ti ti-plug",dataProses:null,color:"#0891b2",bg:"#ecfeff",border:"#a5f3fc"},
  {key:"BUSBAR",label:"Busbar",icon:"ti ti-bolt",dataProses:"BUSBAR",color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe"},
  {key:"WIRING CONTROL",label:"Wiring Control",icon:"ti ti-plug-connected",dataProses:"WIRING CONTROL",color:"#4f46e5",bg:"#eef2ff",border:"#c7d2fe"},
  {key:"WIRING POWER",label:"Wiring Power",icon:"ti ti-plug-connected-x",dataProses:"WIRING POWER",color:"#9333ea",bg:"#faf5ff",border:"#e9d5ff"},
  {key:"QC",label:"QC",icon:"ti ti-clipboard-check",dataProses:null,color:"#e11d48",bg:"#fff1f2",border:"#fecdd3"},
  {key:"PACKING",label:"Packing",icon:"ti ti-package",dataProses:null,color:"#0d9488",bg:"#f0fdfa",border:"#99f6e4"},
];
// Warna per tahap Busbar (beda dari warna baris Busbar sendiri - biar 4 sub-badge di 1 baris
// tetap saling kebeda). Key SAMA persis BUSBAR_TAHAP_URUTAN (panelHelpers.ts).
const GANTT_BUSBAR_TAHAP_COLOR:Record<string,{color:string,bg:string,border:string}>={
  FABRIKASI:{color:"#7c3aed",bg:"#f5f3ff",border:"#ddd6fe"},
  PLATING:{color:"#0d9488",bg:"#f0fdfa",border:"#99f6e4"},
  HEATSHRINK:{color:"#d97706",bg:"#fffbeb",border:"#fde68a"},
  PASANG:{color:"#db2777",bg:"#fdf2f8",border:"#fbcfe8"},
};

const WIRING_KOMPONEN_NAMA=["Box Control","Pintu"];

// Daftar kode Box Control/Pintu yang relevan buat 1 panel (nama, bukan kode - kode beda-beda
// per tipe panel) - persis sama logic komponenWiringPanel di LaporanWiringKomponenView. REVISI
// (5 Agu 2026): pct sekarang kontribusi tahap WIRING ke progress PASANG KOMPONEN gabungan
// (checklist[kode].pasangKomponenTahap.WIRING), bukan lagi progress["WIRING CONTROL"] yang
// sekarang independen sepenuhnya dari pasang-komponen.
const komponenWiringPanel=(panel:any)=>{
  const cfg=getEffCfgGlobal(panel.tipe);
  if(!cfg)return[];
  const items=cfg.wps.flatMap((w:any)=>w.items);
  return items
    .filter((it:any)=>WIRING_KOMPONEN_NAMA.includes(it.nama)&&(panel.checklist?.[it.kode]?.qty||0)>0)
    .map((it:any)=>{
      const cl=panel.checklist?.[it.kode];
      return{kode:it.kode,nama:it.nama,pct:cl?.pasangKomponenTahap?.WIRING?.progress||0,foto:cl?.fotoPemasangan||[]};
    });
};

const totalFotoQualityCenter=(p:any):number=>{
  const cl=p.qc_checklist||{};
  let total=QC_ITEMS_ARSIP.reduce((s,item)=>s+((cl[item.key]?.foto||[]).length),0);
  QC_CENTER_SECTIONS_FLAT.forEach(s=>{total+=(p[s.fotoField]||[]).length;});
  total+=(p.pasang_komponen_photos||[]).length;
  const checklist=p.checklist||{};
  Object.entries(checklist).forEach(([,val]:any)=>{
    if(val?.fotoPemasangan?.length)total+=val.fotoPemasangan.length;
  });
  return total;
};

export function ArsipTab({user,refetchWO}:any){
  // Engineering baca-saja (REVISI 4 Sep 2026 - "WO Digital > Arsip" reuse komponen ini apa
  // adanya) - Unarchive (kembalikan panel ke produksi aktif) tetap admin-only.
  const canUnarsip=["admin"].includes(user?.divisi);
  const[panelList,setPanelList]=useState<any[]>([]);
  const[loading,setLoading]=useState(true);
  const[search,setSearch]=useState("");
  const[unarsipLoadingId,setUnarsipLoadingId]=useState<number|null>(null);
  const[expandedWo,setExpandedWo]=useState<Record<number,boolean>>({});
  const[woArchivedMap,setWoArchivedMap]=useState<Record<number,boolean>>({});
  const[qcDetailPanel,setQcDetailPanel]=useState<any>(null);
  const[lightbox,setLightbox]=useState<{fotos:any[],index:number,label:string}|null>(null);

  // TRACKING DURASI PROSES PRODUKSI (15 Sep 2026, spesifikasi final - gantiin modal "Durasi
  // Pengerjaan" tabel simpel sebelumnya) - tampilan Gantt per-minggu, badge START-only (TANPA
  // bar, sesuai revisi user - "cuma butuh start aja"). Sumber start per baris (lihat laporan
  // investigasi, poin A):
  //  - POTONG/PAINTING/RAKIT/BUSBAR/WIRING CONTROL/WIRING POWER: fcs_timer_kerja_archived,
  //    MIN(mulai) per proses (BUSBAR tambahan MIN per tahap FABRIKASI/PLATING/HEATSHRINK/PASANG).
  //  - PASANG KOMPONEN: progress_checkpoint_log_archived (proses="PASANG KOMPONEN") - BUKAN
  //    checklist[kode].history, itu sering kosong walau checkpoint-nya ada (kebukti nyata:
  //    kode FS.4 panel 397 punya 2 baris checkpoint tapi history-nya kosong).
  //  - QC: qc_checklist._global.todo_at - TIDAK fallback ke complete_at (cuma 2.5% panel arsip
  //    yang punya todo_at, mayoritas baris QC akan kosong dan itu MEMANG benar, bukan bug).
  //  - PACKING: packing_done_at (satu-satunya timestamp packing yang pernah ada - gak ada
  //    "packing mulai" di manapun, user sudah setuju pakai tanggal packing_done_at ini).
  const[ganttDetailPanel,setGanttDetailPanel]=useState<any>(null);
  const[ganttLoading,setGanttLoading]=useState(false);
  const[ganttStarts,setGanttStarts]=useState<Record<string,string|null>>({});
  const[ganttBusbarTahap,setGanttBusbarTahap]=useState<Record<string,string|null>>({});
  const[ganttKendala,setGanttKendala]=useState<any[]>([]);

  const openGanttDetail=async(p:any)=>{
    setGanttDetailPanel(p);
    setGanttLoading(true);
    setGanttStarts({});
    setGanttBusbarTahap({});
    setGanttKendala([]);
    const pageSize=1000;
    // 1. fcs_timer_kerja_archived - paginasi eksplisit (satu panel biasanya jauh di bawah 1000
    //    baris timer, tapi jangan asumsikan gak akan pernah lewat).
    let allTimer:any[]=[];
    let from=0;
    for(;;){
      const{data,error}=await supabase.from("fcs_timer_kerja_archived").select("proses,tahap,mulai").eq("panel_id",p.id).range(from,from+pageSize-1);
      if(error){alert("Gagal memuat data timer: "+error.message);setGanttLoading(false);return;}
      allTimer=allTimer.concat(data??[]);
      if(!data||data.length<pageSize)break;
      from+=pageSize;
    }
    const starts:Record<string,string|null>={};
    const busbarTahap:Record<string,string|null>={};
    allTimer.forEach((r:any)=>{
      if(!r.mulai)return;
      if(r.proses==="BUSBAR"&&r.tahap){
        if(!busbarTahap[r.tahap]||r.mulai<busbarTahap[r.tahap]!)busbarTahap[r.tahap]=r.mulai;
      }
      if(!starts[r.proses]||r.mulai<starts[r.proses]!)starts[r.proses]=r.mulai;
    });
    // 2. progress_checkpoint_log_archived - PASANG KOMPONEN (gap fcs_timer_kerja, lihat komentar atas)
    let allCp:any[]=[];
    from=0;
    for(;;){
      const{data,error}=await supabase.from("progress_checkpoint_log_archived").select("ts,tanggal").eq("panel_id",p.id).eq("proses","PASANG KOMPONEN").range(from,from+pageSize-1);
      if(error){alert("Gagal memuat data pasang komponen: "+error.message);setGanttLoading(false);return;}
      allCp=allCp.concat(data??[]);
      if(!data||data.length<pageSize)break;
      from+=pageSize;
    }
    allCp.forEach((r:any)=>{
      const t=r.ts||r.tanggal;
      if(t&&(!starts["PASANG KOMPONEN"]||t<starts["PASANG KOMPONEN"]!))starts["PASANG KOMPONEN"]=t;
    });
    // 3. QC & Packing - langsung dari kolom panel yang sudah dimuat (panelList), gak perlu fetch
    if(p.qc_checklist?._global?.todo_at)starts["QC"]=p.qc_checklist._global.todo_at;
    if(p.packing_done_at)starts["PACKING"]=p.packing_done_at;
    // 4. Kendala - cek live + archived (panel yang baru diarsipkan, catatan kendalanya mungkin
    //    belum sempat termigrasi ke kendala_archived tergantung timing proses arsip)
    const[{data:kLive,error:kLiveErr},{data:kArch,error:kArchErr}]=await Promise.all([
      supabase.from("kendala").select("tanggal,divisi,divisi_label,proses,catatan,operator").eq("panel_id",p.id),
      supabase.from("kendala_archived").select("tanggal,divisi,divisi_label,proses,catatan,operator").eq("panel_id",p.id),
    ]);
    if(kLiveErr||kArchErr){alert("Gagal memuat catatan kendala: "+(kLiveErr?.message||kArchErr?.message));setGanttLoading(false);return;}
    const kendalaAll=[...(kLive||[]),...(kArch||[])].sort((a,b)=>(a.tanggal||"").localeCompare(b.tanggal||""));
    setGanttStarts(starts);
    setGanttBusbarTahap(busbarTahap);
    setGanttKendala(kendalaAll);
    setGanttLoading(false);
  };

  // Kelompokkan tanggal jadi kolom minggu-per-bulan ("Wk 1".."Wk 5" restart tiap bulan baru -
  // day 1-7=Wk1, 8-14=Wk2, dst) dari rangeStart s/d rangeEnd (inklusif bulan keduanya).
  const buildWeekColumns=(rangeStart:string,rangeEnd:string)=>{
    const start=new Date(rangeStart),end=new Date(rangeEnd);
    const cols:{year:number,month:number,weekIdx:number}[]=[];
    let cy=start.getFullYear(),cm=start.getMonth();
    const ey=end.getFullYear(),em=end.getMonth();
    while(cy<ey||(cy===ey&&cm<=em)){
      const daysInMonth=new Date(cy,cm+1,0).getDate();
      const isFirst=cy===start.getFullYear()&&cm===start.getMonth();
      const isLast=cy===ey&&cm===em;
      const firstDay=isFirst?start.getDate():1;
      const lastDay=isLast?end.getDate():daysInMonth;
      const firstWeek=Math.floor((firstDay-1)/7);
      const lastWeek=Math.floor((lastDay-1)/7);
      for(let w=firstWeek;w<=lastWeek;w++)cols.push({year:cy,month:cm,weekIdx:w});
      cm++;if(cm>11){cm=0;cy++;}
    }
    return cols;
  };
  const colIndexForDate=(cols:{year:number,month:number,weekIdx:number}[],iso:string)=>{
    const d=new Date(iso);
    const y=d.getFullYear(),m=d.getMonth(),w=Math.floor((d.getDate()-1)/7);
    return cols.findIndex(c=>c.year===y&&c.month===m&&c.weekIdx===w);
  };
  const fmtTglFull=(iso:string|null|undefined)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"}):"-";
  const BULAN_LABEL=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  // Baris export PDF/Excel: sama persis data yang dipakai buat render Gantt, cuma dirapikan jadi
  // baris datar (Busbar dipecah per tahap yang punya data, sama seperti sub-badge di layar).
  const buildGanttExportRows=(starts:Record<string,string|null>,busbarTahap:Record<string,string|null>)=>{
    const rows:{proses:string,tanggalMulai:string}[]=[];
    GANTT_ROWS.forEach(r=>{
      if(r.key==="BUSBAR"){
        const adaTahap=BUSBAR_TAHAP_URUTAN.some(t=>busbarTahap[t]);
        if(!adaTahap){rows.push({proses:"Busbar",tanggalMulai:"Belum ada data"});return;}
        BUSBAR_TAHAP_URUTAN.forEach(t=>{
          if(busbarTahap[t])rows.push({proses:`Busbar - ${BUSBAR_TAHAP_LABEL[t]}`,tanggalMulai:fmtTglFull(busbarTahap[t])});
        });
        return;
      }
      rows.push({proses:r.label,tanggalMulai:starts[r.key]?fmtTglFull(starts[r.key]):"Belum ada data"});
    });
    return rows;
  };

  const exportGanttPdf=(panel:any,starts:Record<string,string|null>,busbarTahap:Record<string,string|null>,kendala:any[])=>{
    const doc=new jsPDF();
    doc.setFontSize(14);
    doc.text("Tracking Durasi Proses Produksi",14,16);
    doc.setFontSize(10);
    doc.text(`${panel.nama} - WO ${panel.wo_number_snapshot} - ${panel.proyek_snapshot}`,14,23);
    const rows=buildGanttExportRows(starts,busbarTahap);
    autoTable(doc,{startY:30,head:[["Proses","Tanggal Mulai"]],body:rows.map(r=>[r.proses,r.tanggalMulai]),
      styles:{fontSize:9},headStyles:{fillColor:[29,78,216]}});
    const afterY=(doc as any).lastAutoTable.finalY+10;
    doc.setFontSize(12);
    doc.text("Catatan Kendala per Divisi",14,afterY);
    if(kendala.length===0){
      doc.setFontSize(10);
      doc.text("Belum ada catatan kendala untuk panel ini.",14,afterY+7);
    }else{
      autoTable(doc,{startY:afterY+4,head:[["Tanggal","Divisi","Operator","Catatan"]],
        body:kendala.map(k=>[k.tanggal||"-",k.divisi_label||k.divisi||"-",k.operator||"-",k.catatan||"-"]),
        styles:{fontSize:8.5},headStyles:{fillColor:[29,78,216]}});
    }
    doc.save(`Durasi_${(panel.nama||"panel").replace(/[\/\\?%*:|"<>]/g,"_")}.pdf`);
  };

  const exportGanttExcel=(panel:any,starts:Record<string,string|null>,busbarTahap:Record<string,string|null>,kendala:any[])=>{
    const XLSX=(window as any).XLSX;
    if(!XLSX){alert("SheetJS belum dimuat, coba refresh halaman.");return;}
    const wb=XLSX.utils.book_new();
    const rows=buildGanttExportRows(starts,busbarTahap);
    const ws1=XLSX.utils.aoa_to_sheet([["Proses","Tanggal Mulai"],...rows.map(r=>[r.proses,r.tanggalMulai])]);
    XLSX.utils.book_append_sheet(wb,ws1,"Durasi Proses");
    const ws2=XLSX.utils.aoa_to_sheet([["Tanggal","Divisi","Operator","Catatan"],...kendala.map(k=>[k.tanggal||"-",k.divisi_label||k.divisi||"-",k.operator||"-",k.catatan||"-"])]);
    XLSX.utils.book_append_sheet(wb,ws2,"Catatan Kendala");
    XLSX.writeFile(wb,`Durasi_${(panel.nama||"panel").replace(/[\/\\?%*:|"<>]/g,"_")}.xlsx`);
  };
  const[wiList,setWiList]=useState<any[]>([]);
  const[revList,setRevList]=useState<any[]>([]);

  // Dokumen Gambar Teknik (REVISI 4 Sep 2026) - work_instructions.panel_id di-set NULL kalau
  // panelnya diarsipkan (lihat migration 20260904060000, fix cascade-delete), jadi dicari
  // balik lewat wo_id (bukan panel_id) - SEMUA revisi ditampilkan (bukan cuma current), ini
  // riwayat historis. Fetch independen dari panelList/panels_archived, tabel kecil, gak perlu
  // paginasi .range() sekelas itu.
  const fetchDokumen=async()=>{
    const[{data:wi},{data:rev}]=await Promise.all([
      supabase.from("work_instructions" as any).select("*"),
      supabase.from("wi_revisions" as any).select("*").order("revision_number",{ascending:false}),
    ]);
    setWiList(wi||[]);
    setRevList(rev||[]);
  };
  useEffect(()=>{fetchDokumen();},[]);

  const fetchPanelArsip=async()=>{
    setLoading(true);
    // Paginasi eksplisit by .range() (audit egress Agu 2026) - tanpa ini query diam-diam capped
    // 1000 baris (bug class yang sama kayak saga renhar dulu), padahal arsip cuma nambah terus.
    let all:any[]=[];
    let from=0;
    const pageSize=1000;
    for(;;){
      const{data,error}=await supabase.from("panels_archived").select("*").order("diarsipkan_pada",{ascending:false}).range(from,from+pageSize-1);
      if(error||!data)break;
      all=all.concat(data);
      if(data.length<pageSize)break;
      from+=pageSize;
    }
    setPanelList(all);
    setLoading(false);
  };
  useEffect(()=>{fetchPanelArsip();},[]);

  useEffect(()=>{
    const woIds=[...new Set(panelList.map((p:any)=>p.wo_id).filter(Boolean))];
    if(woIds.length===0){setWoArchivedMap({});return;}
    supabase.from("work_orders").select("id,is_archived").in("id",woIds).then(({data}:any)=>{
      const m:Record<number,boolean>={};
      (data??[]).forEach((w:any)=>{m[w.id]=!!w.is_archived;});
      setWoArchivedMap(m);
    });
  },[panelList]);

  const unarsipkan=async(p:any)=>{
    if(!confirm(`Kembalikan panel "${p.nama}" ke tampilan aktif? Semua data (checklist, progress, riwayat timer, QC) dikembalikan utuh.`))return;
    setUnarsipLoadingId(p.id);
    const{error}=await supabase.rpc("unarsip_panel",{p_panel_id:p.id});
    setUnarsipLoadingId(null);
    if(error){alert("Gagal unarchive: "+error.message);return;}
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,action:"UNARCHIVE PANEL",
      description:"Kembalikan panel "+p.nama+" dari arsip ke WO "+(p.wo_number_snapshot||"")+" - "+(p.proyek_snapshot||""),
      module:"wo",halaman:"Manajemen WO",proyek:p.proyek_snapshot||"",panel:p.nama,wo_number:p.wo_number_snapshot||"",
    });
    setPanelList(prev=>prev.filter((x:any)=>x.id!==p.id));
    if(refetchWO)await refetchWO();
    alert("Panel "+p.nama+" berhasil dikembalikan ke tampilan aktif.");
  };

  const grouped=useMemo(()=>{
    const map:Record<number,{wo_id:number,wo_number:string,proyek:string,panels:any[]}>={};
    panelList.forEach((p:any)=>{
      if(!map[p.wo_id])map[p.wo_id]={wo_id:p.wo_id,wo_number:p.wo_number_snapshot,proyek:p.proyek_snapshot,panels:[]};
      map[p.wo_id].panels.push(p);
    });
    return Object.values(map).sort((a,b)=>{
      const latestA=Math.max(...a.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      const latestB=Math.max(...b.panels.map(p=>new Date(p.diarsipkan_pada).getTime()));
      return latestB-latestA;
    });
  },[panelList]);

  const filtered=grouped.filter(g=>
    !search||g.wo_number?.toLowerCase().includes(search.toLowerCase())||g.proyek?.toLowerCase().includes(search.toLowerCase())||
    g.panels.some((p:any)=>p.nama?.toLowerCase().includes(search.toLowerCase()))
  );

  // Redesign "enterprise" (15 Sep 2026) - garis pembatas/tipografi/badge disamakan ke pola yang
  // sudah dipakai di LaporanQCView (banner header, header tabel kapital+letter-spacing, border
  // row lebih tegas). thS/td dipakai bareng modal QC/Durasi juga (spread {...thS}/{...td}) - efek
  // ikutannya cuma visual (padding/border/fontSize), fungsi modal-modal itu tidak disentuh.
  const thS:any={padding:"10px 12px",textAlign:"left",fontSize:10.5,color:"#475569",fontWeight:800,background:"#f8fafc",textTransform:"uppercase" as const,letterSpacing:.4};
  const td:any={padding:"10px 12px",borderTop:"1px solid #e2e8f0",fontSize:12.5,verticalAlign:"middle"};

  return(
    <div className="fi">
      <div style={{position:"relative" as const,overflow:"hidden",background:"linear-gradient(135deg,#eff6ff,#dbeafe)",border:"1px solid #bfdbfe",borderRadius:14,padding:"20px 24px",marginBottom:18,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap" as const}}>
        <div style={{width:56,height:56,borderRadius:14,background:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 12px #1d4ed84d",zIndex:1}}>
          <i className="ti ti-archive" style={{fontSize:28,color:"#fff"}}/>
        </div>
        <div style={{flex:"1 1 220px",minWidth:200,zIndex:1}}>
          <div style={{fontSize:19,fontWeight:800,color:"#1e293b"}}>Arsip</div>
          <div style={{fontSize:12.5,fontWeight:500,color:"#334155",marginTop:2}}>WO yang punya panel diarsipkan - klik untuk lihat rincian panelnya</div>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO/proyek/panel..."
          style={{height:36,padding:"0 14px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:500,width:240,outline:"none",fontFamily:"inherit",background:"#fff",color:"#1e293b",zIndex:1}}/>
        <div style={{position:"absolute" as const,right:-24,top:-30,width:150,height:150,borderRadius:"50%",background:"#1d4ed81a"}}/>
        <div style={{position:"absolute" as const,right:60,bottom:-40,width:100,height:100,borderRadius:"50%",background:"#1d4ed812"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada panel yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {filtered.map(g=>{
            const isExp=!!expandedWo[g.wo_id];
            const woPenuh=!!woArchivedMap[g.wo_id];
            return(
              <div key={g.wo_id} style={{background:"#fff",border:"1.5px solid #cbd5e1",borderRadius:10,overflow:"hidden"}}>
                <div onClick={()=>setExpandedWo(prev=>({...prev,[g.wo_id]:!prev[g.wo_id]}))}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",background:isExp?"#f8faff":"#fff"}}>
                  <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                  <div style={{flex:1,minWidth:0,textAlign:"left"}}>
                    <div style={{fontWeight:800,fontSize:13.5,color:"#1e293b"}}>WO {g.wo_number} — {g.proyek}</div>
                    <div style={{fontSize:11,fontWeight:600,color:"#64748b",marginTop:2}}>{g.panels.length} panel diarsipkan</div>
                  </div>
                  <span style={{background:woPenuh?"#fef2f2":"#fffbeb",color:woPenuh?"#dc2626":"#d97706",
                    border:`1.5px solid ${woPenuh?"#fecaca":"#fde68a"}`,borderRadius:20,padding:"4px 12px",fontSize:10.5,fontWeight:800,whiteSpace:"nowrap" as const}}>
                    {woPenuh?"📦 Diarsipkan Penuh":"⚠ Sebagian Diarsip - WO masih aktif"}
                  </span>
                </div>
                {isExp&&(
                  <div style={{overflowX:"auto",borderTop:"1.5px solid #cbd5e1"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead><tr style={{borderBottom:"1.5px solid #cbd5e1"}}>
                        <th style={thS}>Nama Panel</th>
                        <th style={{...thS,textAlign:"center"}}>Progress</th>
                        <th style={{...thS,textAlign:"center"}}>Quality Center</th>
                        <th style={{...thS,textAlign:"center"}}>Durasi</th>
                        <th style={thS}>Diarsipkan</th>
                        {canUnarsip&&<th style={{...thS,textAlign:"center"}}>Aksi</th>}
                      </tr></thead>
                      <tbody>
                        {g.panels.map((p:any,i:number)=>{
                          const qc=p.qc_checklist?._global?.status||"to_do";
                          const qcInfo=QC_STATUS_LABEL[qc]||QC_STATUS_LABEL.to_do;
                          const fotoCount=totalFotoQualityCenter(p);
                          return(
                            <tr key={p.id} style={{background:i%2===0?"#fff":"#f8fafc"}}>
                              <td style={{...td,fontWeight:800,color:"#1e293b"}}>{p.nama}</td>
                              <td style={{...td,textAlign:"center",fontWeight:800,fontSize:13.5,color:"#1d4ed8"}}>{p.progress_snapshot??0}%</td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>setQcDetailPanel(p)}
                                  style={{background:"none",border:"none",cursor:"pointer",display:"inline-flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                                  <span style={{background:qcInfo.bg,color:qcInfo.color,borderRadius:20,padding:"3px 10px",fontSize:10.5,fontWeight:800}}>{qcInfo.label}</span>
                                  <span style={{fontSize:9,color:"#94a3b8",textDecoration:"underline"}}>📷 {fotoCount} foto</span>
                                </button>
                              </td>
                              <td style={{...td,textAlign:"center"}}>
                                <button onClick={()=>openGanttDetail(p)}
                                  style={{display:"inline-flex",alignItems:"center",gap:4,height:28,padding:"0 12px",borderRadius:7,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const}}>
                                  <i className="ti ti-clock-hour-4" style={{fontSize:13}}/> Lihat Durasi
                                </button>
                              </td>
                              <td style={{...td,color:"#64748b",fontSize:11,fontWeight:600}}>{p.diarsipkan_oleh} · {p.diarsipkan_pada?new Date(p.diarsipkan_pada).toLocaleDateString("id-ID"):"—"}</td>
                              {canUnarsip&&(
                                <td style={{...td,textAlign:"center"}}>
                                  <button onClick={()=>unarsipkan(p)} disabled={unarsipLoadingId===p.id}
                                    style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4,height:28,padding:"0 12px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:11,fontWeight:700,whiteSpace:"nowrap" as const}}>
                                    {unarsipLoadingId===p.id?"⏳...":"↩ Unarchive"}
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {(()=>{
                      const docs=wiList.filter((w:any)=>w.wo_id===g.wo_id);
                      if(docs.length===0)return null;
                      return(
                        <div style={{padding:"12px 16px",borderTop:"2px solid #cbd5e1",background:"#fafbff"}}>
                          <div style={{fontWeight:800,fontSize:12,color:"#1e293b",marginBottom:8}}>📄 Dokumen Gambar Teknik</div>
                          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                            {docs.map((wi:any)=>{
                              const revs=revList.filter((r:any)=>r.work_instruction_id===wi.id).sort((a:any,b:any)=>b.revision_number-a.revision_number);
                              return(
                                <div key={wi.id} style={{border:"1.5px solid #e2e8f0",borderRadius:8,padding:10,background:"#fff"}}>
                                  <div style={{fontWeight:800,fontSize:11.5,color:"#1e293b",marginBottom:6}}>{wi.judul}</div>
                                  <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                                    {revs.map((r:any)=>(
                                      <div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,padding:"5px 8px",background:r.is_current?"#f0fdf4":"#f8fafc",borderRadius:6,border:"1.5px solid "+(r.is_current?"#bbf7d0":"#e2e8f0")}}>
                                        <div style={{minWidth:0}}>
                                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                                            <span style={{fontSize:10,fontWeight:800,color:r.is_current?"#16a34a":"#64748b",background:r.is_current?"#dcfce7":"#f1f5f9",borderRadius:20,padding:"2px 9px"}}>{r.is_current?"Berlaku":"Tidak Berlaku"}</span>
                                            {r.rev_mark&&<span style={{fontSize:10,color:"#94a3b8"}}>{r.rev_mark}</span>}
                                          </div>
                                          <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>oleh {r.uploaded_by} · {r.uploaded_at?new Date(r.uploaded_at).toLocaleDateString("id-ID"):"—"}</div>
                                        </div>
                                        <button onClick={()=>window.open(r.file_url,"_blank")}
                                          style={{background:"none",border:"none",fontSize:11,fontWeight:600,color:"#94a3b8",cursor:"pointer",whiteSpace:"nowrap" as const,padding:0}}>Lihat →</button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {qcDetailPanel&&(()=>{
        const cl=qcDetailPanel.qc_checklist||{};
        const globalData=cl._global||{};
        const status=globalData.status||"to_do";
        const sb=QC_STATUS_LABEL[status]||QC_STATUS_LABEL.to_do;
        const fmtTgl=(iso:string)=>iso?new Date(iso).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" "+new Date(iso).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"";
        const wiringItems=komponenWiringPanel(qcDetailPanel);
        // BUG FIX (14 Agu 2026): section ini sebelumnya cuma nampilin pasang_komponen_photos
        // (galeri panel-wide) - foto per-komponen (checklist[kode].fotoPemasangan) gak pernah
        // ikut nongol di sini, padahal itu sumber foto utama sejak 8 Agu 2026. Digabung, pola
        // sama kayak totalFotoQualityCenter di atas yang sudah benar gabungin keduanya -
        // dedupe by url biar foto yang kebetulan ada di dua tempat gak dobel ditampilkan.
        const pasangKomponenFoto=(()=>{
          const seen=new Set<string>();
          const out:any[]=[];
          [...(qcDetailPanel.pasang_komponen_photos||[]),...Object.values(qcDetailPanel.checklist||{}).flatMap((c:any)=>c?.fotoPemasangan||[])].forEach((f:any)=>{
            if(f?.url&&!seen.has(f.url)){seen.add(f.url);out.push(f);}
          });
          return out;
        })();
        const pasangKomponenPct=(()=>{try{return calcPanelProgress(qcDetailPanel)["PASANG KOMPONEN"]||0;}catch{return 0;}})();

        const sectionCard=(label:string,icon:string,pct:number|null,fotoList:any[])=>(
          <div key={label} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{icon} {label}</span>
              {pct!==null&&<span style={{fontWeight:800,fontSize:12,color:"#1d4ed8"}}>{pct}%</span>}
            </div>
            {fotoList.length>0?(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                {fotoList.map((f:any,fi:number)=>{
                  const fVideo=isVideoFoto(f)
                  const fGeneric=isGenericFoto(f)
                  return(
                    <div key={fi} onClick={()=>{if(fGeneric)window.open(f.url,"_blank");else setLightbox({fotos:fotoList,index:fi,label})}}
                      style={{position:"relative" as const,width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer",overflow:"hidden",background:"#f1f5f9",display:fGeneric?"flex":undefined,alignItems:fGeneric?"center" as const:undefined,justifyContent:fGeneric?"center" as const:undefined}}>
                      {fVideo?(
                        <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                        <i className="ti ti-player-play-filled" style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/></>
                      ):fGeneric?(
                        <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b"}}/>
                      ):(
                        <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                      )}
                    </div>
                  )
                })}
              </div>
            ):(
              <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
            )}
          </div>
        );

        return(
          <Modal title={"Detail Quality Center — "+qcDetailPanel.nama} onClose={()=>setQcDetailPanel(null)} width={620}>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>
              WO {qcDetailPanel.wo_number_snapshot} — {qcDetailPanel.proyek_snapshot}
            </div>
            <div style={{maxHeight:460,overflowY:"auto" as const,display:"flex",flexDirection:"column" as const,gap:14}}>

              {/* QC */}
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>🔍 QC</span>
                  <span style={{background:sb.bg,color:sb.color,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700}}>{sb.label}</span>
                </div>
                {(globalData.todo_at||globalData.complete_at||globalData.updated_by)&&(
                  <div style={{display:"flex",gap:14,fontSize:10,color:"#64748b",marginBottom:8,flexWrap:"wrap" as const}}>
                    {globalData.todo_at&&<span>To Do: {fmtTgl(globalData.todo_at)}</span>}
                    {globalData.complete_at&&<span>Selesai: {fmtTgl(globalData.complete_at)}</span>}
                    {globalData.updated_by&&<span>oleh {globalData.updated_by}</span>}
                  </div>
                )}
                <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                  {QC_ITEMS_ARSIP.map(item=>{
                    const data=cl[item.key]||{};
                    const fotoList=data.foto||[];
                    return(
                      <div key={item.key} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:10}}>
                        <div style={{fontWeight:700,fontSize:11,color:"#1e293b",marginBottom:6}}>{item.label}</div>
                        {data.catatan&&(
                          <div style={{fontSize:11,color:"#475569",background:"#f8fafc",borderRadius:6,padding:"6px 9px",marginBottom:8}}>{data.catatan}</div>
                        )}
                        {fotoList.length>0?(
                          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:6}}>
                            {fotoList.map((f:any,fi:number)=>{
                              const fVideo=isVideoFoto(f)
                              const fGeneric=isGenericFoto(f)
                              return(
                                <div key={fi} onClick={()=>{if(fGeneric)window.open(f.url,"_blank");else setLightbox({fotos:fotoList,index:fi,label:item.label})}}
                                  style={{position:"relative" as const,width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:6,border:"1px solid #e2e8f0",cursor:"pointer",overflow:"hidden",background:"#f1f5f9",display:fGeneric?"flex":undefined,alignItems:fGeneric?"center" as const:undefined,justifyContent:fGeneric?"center" as const:undefined}}>
                                  {fVideo?(
                                    <><video src={f.url} muted style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                    <i className="ti ti-player-play-filled" style={{position:"absolute" as const,top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:20,color:"#fff",filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.5))"}}/></>
                                  ):fGeneric?(
                                    <i className="ti ti-file-text" style={{fontSize:22,color:"#64748b"}}/>
                                  ):(
                                    <img src={f.url} style={{width:"100%",height:"100%",objectFit:"cover" as const}}/>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ):(
                          <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Belum ada foto</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Nameplate / Yellowmark / Warehouse / QS - bentuk sama (progress + foto flat) */}
              {QC_CENTER_SECTIONS_FLAT.map(s=>
                sectionCard(s.label,s.icon,qcDetailPanel[s.progressField]??0,qcDetailPanel[s.fotoField]||[])
              )}

              {/* Assembling (Pasang Komponen) */}
              {sectionCard("Assembling (Pasang Komponen)","🔧",pasangKomponenPct,pasangKomponenFoto)}

              {/* Wiring Control - per komponen (Box Control/Pintu) */}
              <div>
                <div style={{fontWeight:800,fontSize:13,color:"#1e293b",marginBottom:8}}>🔌 Wiring Control</div>
                {wiringItems.length===0?(
                  <div style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic" as const}}>Tidak ada komponen Box Control/Pintu di panel ini</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
                    {wiringItems.map((it:any)=>sectionCard(it.nama+" ("+it.kode+")","",it.pct,it.foto))}
                  </div>
                )}
              </div>

            </div>
          </Modal>
        );
      })()}

      {ganttDetailPanel&&(()=>{
        const allDates:string[]=[
          ...GANTT_ROWS.filter(r=>r.key!=="BUSBAR").map(r=>ganttStarts[r.key]).filter(Boolean) as string[],
          ...BUSBAR_TAHAP_URUTAN.map(t=>ganttBusbarTahap[t]).filter(Boolean) as string[],
        ];
        const hasAnyData=allDates.length>0;
        const rangeStart=hasAnyData?allDates.reduce((a,b)=>a<b?a:b):null;
        const rangeEnd=ganttDetailPanel.packing_done_at||(hasAnyData?allDates.reduce((a,b)=>a>b?a:b):null);
        const cols=hasAnyData&&rangeStart&&rangeEnd?buildWeekColumns(rangeStart,rangeEnd):[];
        const monthGroups:{year:number,month:number,count:number}[]=[];
        cols.forEach(c=>{
          const last=monthGroups[monthGroups.length-1];
          if(last&&last.year===c.year&&last.month===c.month)last.count++;
          else monthGroups.push({year:c.year,month:c.month,count:1});
        });
        const kendalaByTanggal:Record<string,any[]>={};
        ganttKendala.forEach(k=>{
          const key=k.tanggal||"-";
          (kendalaByTanggal[key]??=[]).push(k);
        });
        const tanggalKendalaList=Object.keys(kendalaByTanggal).sort();
        const ganttTh:any={padding:"7px 9px",border:"1px solid #cbd5e1",background:"#f8fafc",fontSize:9.5,fontWeight:800,color:"#475569",textTransform:"uppercase" as const,letterSpacing:.3};
        const ganttTd:any={padding:"6px 9px",border:"1px solid #e2e8f0",fontSize:10.5,verticalAlign:"middle" as const};
        const exportBtnS:any={display:"inline-flex",alignItems:"center",gap:6,height:34,padding:"0 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer"};

        return(
          <Modal width={1040} onClose={()=>setGanttDetailPanel(null)}
            title={
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <i className="ti ti-chart-gantt" style={{fontSize:17,color:"#fff"}}/>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>Tracking Durasi Proses Produksi</div>
                  <div style={{fontSize:10.5,fontWeight:500,color:"#64748b",marginTop:1}}>{ganttDetailPanel.nama} · WO {ganttDetailPanel.wo_number_snapshot} — {ganttDetailPanel.proyek_snapshot}</div>
                </div>
              </div>
            }>
            <div style={{maxHeight:600,overflowY:"auto" as const}}>
              {ganttLoading?(
                <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>Memuat data tracking...</div>
              ):!hasAnyData?(
                <div style={{textAlign:"center",padding:40,color:"#94a3b8",fontSize:12}}>
                  <i className="ti ti-chart-gantt" style={{fontSize:28,display:"block",marginBottom:8}}/>
                  Belum ada data tanggal mulai proses untuk panel ini.
                </div>
              ):(
                <>
                  <div style={{overflowX:"auto" as const,border:"1.5px solid #cbd5e1",borderRadius:8}}>
                    <table style={{borderCollapse:"collapse",fontSize:11,minWidth:cols.length*54+160}}>
                      <thead>
                        <tr>
                          <th rowSpan={2} style={{...ganttTh,minWidth:150,textAlign:"left" as const}}>Proses</th>
                          {monthGroups.map((mg,i)=>(
                            <th key={i} colSpan={mg.count} style={{...ganttTh,textAlign:"center" as const}}>{BULAN_LABEL[mg.month]} {mg.year}</th>
                          ))}
                        </tr>
                        <tr>
                          {cols.map((c,i)=>(
                            <th key={i} style={{...ganttTh,fontSize:9,textAlign:"center" as const,minWidth:54}}>{`Wk ${c.weekIdx+1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {GANTT_ROWS.map(row=>{
                          if(row.key==="BUSBAR"){
                            const tahapAda=BUSBAR_TAHAP_URUTAN.filter(t=>ganttBusbarTahap[t]);
                            return(
                              <tr key={row.key}>
                                <td style={{...ganttTd,fontWeight:700,color:"#1e293b"}}>
                                  <i className={row.icon} style={{fontSize:13,color:row.color,marginRight:6}}/>{row.label}
                                  {tahapAda.length===0&&<div style={{fontSize:8.5,color:"#cbd5e1",fontWeight:500,marginTop:2}}>Belum ada data</div>}
                                </td>
                                {cols.map((c,ci)=>{
                                  const tahapDiSini=tahapAda.filter(t=>colIndexForDate(cols,ganttBusbarTahap[t]!)===ci);
                                  return(
                                    <td key={ci} style={ganttTd}>
                                      {tahapDiSini.length>0&&(
                                        <div style={{display:"flex",flexDirection:"column" as const,gap:2}}>
                                          {tahapDiSini.map(t=>{
                                            const bc=GANTT_BUSBAR_TAHAP_COLOR[t];
                                            const singkatan:Record<string,string>={FABRIKASI:"FAB",PLATING:"PLT",HEATSHRINK:"HS",PASANG:"PSG"};
                                            return(
                                              <span key={t} title={`${BUSBAR_TAHAP_LABEL[t]} mulai ${fmtTglFull(ganttBusbarTahap[t])}`}
                                                style={{display:"inline-block",background:bc.color,color:"#fff",borderRadius:4,padding:"2px 5px",fontSize:8,fontWeight:800,cursor:"default"}}>
                                                {singkatan[t]}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          }
                          const startIso=ganttStarts[row.key];
                          const colIdx=startIso?colIndexForDate(cols,startIso):-1;
                          return(
                            <tr key={row.key}>
                              <td style={{...ganttTd,fontWeight:700,color:"#1e293b"}}>
                                <i className={row.icon} style={{fontSize:13,color:row.color,marginRight:6}}/>{row.label}
                                {!startIso&&<div style={{fontSize:8.5,color:"#cbd5e1",fontWeight:500,marginTop:2}}>Belum ada data</div>}
                              </td>
                              {cols.map((c,ci)=>(
                                <td key={ci} style={ganttTd}>
                                  {ci===colIdx&&(
                                    <span title={`Mulai ${fmtTglFull(startIso)}`}
                                      style={{display:"inline-block",background:row.color,color:"#fff",borderRadius:4,padding:"2px 7px",fontSize:8.5,fontWeight:800,letterSpacing:.3,cursor:"default"}}>
                                      START
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer Catatan Kendala per Divisi (15 Sep 2026) - kendala/kendala_archived
                      by panel_id, 100% coverage terisi (dicek langsung ke DB), dikelompokkan
                      per tanggal lalu per baris kendala (divisi+catatan+operator). */}
                  <div style={{marginTop:16,border:"1.5px solid #cbd5e1",borderRadius:8,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0",display:"flex",alignItems:"center",gap:8}}>
                      <i className="ti ti-message-report" style={{fontSize:15,color:"#475569"}}/>
                      <span style={{fontWeight:800,fontSize:12.5,color:"#1e293b"}}>Catatan Kendala per Divisi</span>
                    </div>
                    <div style={{padding:"10px 14px"}}>
                      {tanggalKendalaList.length===0?(
                        <div style={{fontSize:11,color:"#94a3b8",fontStyle:"italic" as const,padding:"8px 0"}}>Belum ada catatan kendala untuk panel ini.</div>
                      ):(
                        <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
                          {tanggalKendalaList.map(tgl=>(
                            <div key={tgl}>
                              <div style={{fontSize:11,fontWeight:800,color:"#1e293b",marginBottom:5}}>{fmtTglFull(tgl)}</div>
                              <div style={{display:"flex",flexDirection:"column" as const,gap:5}}>
                                {kendalaByTanggal[tgl].map((k:any,ki:number)=>{
                                  const dCfg=(DIVISI_CONFIG as any)[k.divisi];
                                  return(
                                    <div key={ki} style={{display:"flex",gap:8,fontSize:11,padding:"6px 9px",background:"#f8fafc",borderRadius:6,border:"1px solid #f1f5f9",flexWrap:"wrap" as const}}>
                                      <span style={{fontWeight:700,color:dCfg?.color||"#475569",background:dCfg?.bg||"#f1f5f9",borderRadius:5,padding:"1px 8px",flexShrink:0}}>{dCfg?.label||k.divisi_label||k.divisi}</span>
                                      <span style={{color:"#334155",flex:1,minWidth:140}}>{k.catatan}</span>
                                      <span style={{color:"#94a3b8",fontSize:10,flexShrink:0}}>oleh {k.operator||"-"}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{display:"flex",gap:8,marginTop:16}}>
                    <button onClick={()=>exportGanttPdf(ganttDetailPanel,ganttStarts,ganttBusbarTahap,ganttKendala)}
                      style={{...exportBtnS,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626"}}>
                      <i className="ti ti-file-type-pdf" style={{fontSize:15}}/> Export PDF
                    </button>
                    <button onClick={()=>exportGanttExcel(ganttDetailPanel,ganttStarts,ganttBusbarTahap,ganttKendala)}
                      style={{...exportBtnS,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a"}}>
                      <i className="ti ti-file-type-xls" style={{fontSize:15}}/> Export Excel
                    </button>
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}

      {lightbox&&<FotoZoomViewer fotos={lightbox.fotos} startIndex={lightbox.index} label={lightbox.label} onClose={()=>setLightbox(null)}/>}
    </div>
  );
}
