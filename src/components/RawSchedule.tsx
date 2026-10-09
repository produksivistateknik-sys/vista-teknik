import { useState, useMemo, useEffect, useRef, Fragment, useSyncExternalStore, memo, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2, checkKuotaOrangDanKomponenSwap, executeSwapKomponenOrang, setOverrideAndRebalance, fetchWiringHariKerjaMap, hariKeNFromMap, hitungProyeksiWiring } from '../services/fcsService'
import {
  PANEL_TYPES, ALL_PROSES, WP_LIST, PRIORITAS, PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR,
  DIVISI_PROSES, BUSBAR_COLORS, DIVISI_CONFIG, PROSES_ORANG_RAW_GLOBAL,
} from '../constants/panelTypes'
import { isKomponenRelevant, getBusbarKomponen, getRelevantProsesForKode, getProgressAsOfDate, getQtyProsesAsOfDate, WIRING_BOBOT_LIST, WIRING_BOBOT_LABEL, WIRING_BOBOT_COLOR, WIRING_BOBOT_TABLE, kebutuhanOrangWiring } from '../lib/panelHelpers'
import { markRenharDirty, markRawDirty, clearRawDirty } from '../lib/globalState'
import { withRetry } from '../lib/withRetry'
import { pindahKomponenRenhar, tanganiGagalSinkronRenhar } from '../lib/renharSinkron'
import { lepasDariAsal, taruhDiTujuan, isMinggu, lepasBusbar, taruhBusbar, togglePenanda, kodeBusbarBisaDipindah, rencanakanPindahMultiV2, ambilJadwal4, type SelPindahV2 } from '../lib/jadwalPindah'
import { renharService } from '../services/renharService'
import { buatSelV2 as buatSelV2Lib, cekPindahMulti as cekPindahMultiLib } from '../lib/pindahMulti'
import { usePindahMulti } from '../hooks/usePindahMulti'
import { entriesTanpaSelesai, semuaKomponenSebagaiSubBaris, rentangInfoUntukTanggal, jadwalLanjutanWiring, alasanTakBisaMultiPilih as alasanTakBisaMultiPilihLib } from '../lib/isiSelJadwal'
import { buatPetaDeadlinePanel, lolosFilterBaris as lolosFilterBarisLib, petaDeadlinePerTanggal, infoDeadline as infoDeadlineLib } from '../lib/deadlineRaw'
import { menitPerPcs, kapasitasPada as kapasitasPadaLib, hitungTerpakaiHari as hitungTerpakaiHariLib, muatDataKapasitas } from '../lib/kapasitasHari'
import { TODAY, addDays, fmtDate, getDayLabel, fmtDateFull, getRenharWindowRange } from '../lib/dateHelpers'
import { Modal, Card, Badge, Lbl, Btn, Inp, Sel } from './ui/Primitives'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable } from '@dnd-kit/core'
import { useModalJadwalSel, namaKomponenDariKode, wpSelesai } from './ModalJadwalSel'
import { useUrutanPanel } from '../hooks/useUrutanPanel'
import { useAturKapasitas } from './ModalAturKapasitas'
import { useTambahPanelRaw } from './ModalTambahPanelRaw'
import { useRiwayatQty } from './RiwayatQty'
import { useNotifAvailable } from './NotifAvailable'
import { useRawPanelOrder, fetchPanelOrderMap, zonaDari, cmpPanelDalamZona, bandingkanBarisRaw, hitungTargetDrop, tetanggaSekarang, hitungKeyPindah, simpanPindahPanel, ZONA_URUTAN, type Zona, type TargetDrop, type TargetPindah } from '../lib/rawPanelOrder'

// Handle geser urutan panel (⠿) di sel PANEL - @dnd-kit (pointer events), SENGAJA bukan HTML5
// drag: grid tanggal sudah pakai HTML5 draggable/onDragOver/onDrop buat geser jadwal antar
// tanggal, dua mekanisme itu gak saling tangkap event. Drag cuma bisa dimulai dari handle ini.
// PERFORMA (4 Okt 2026, paket 4) - 1 baris proses Raw Schedule (+-44 sel tanggal) di-memo: render
// ulang HANYA kalau salah satu `deps` berubah (lihat depsBaris di RawSchedule). Isi baris tetap
// dari renderBaris yang sama (closure terbaru dipakai tiap kali deps berubah). Handler di dalam
// baris lewat aksiRef (selalu fungsi terbaru) - baris yang render-nya dilewati tidak memanggil
// fungsi dari render lama (state basi).
const BarisRawMemo=memo(({render}:{render:()=>ReactNode;deps:any[]})=><>{render()}</>,
  (a,b)=>a.deps.length===b.deps.length&&a.deps.every((x,i)=>Object.is(x,b.deps[i])));

function PanelDragHandle({panelId,disabled}:{panelId:number;disabled:boolean}){
  const{attributes,listeners,setNodeRef}=useDraggable({id:`panel-${panelId}`,data:{panelId},disabled});
  return(
    <span ref={setNodeRef} {...listeners} {...attributes} title={disabled?"Sedang menyimpan urutan...":"Seret untuk ubah urutan panel"}
      style={{cursor:disabled?"not-allowed":"grab",touchAction:"none",color:"#94a3b8",fontSize:13,lineHeight:1,padding:"2px 1px",userSelect:"none",flexShrink:0}}>⠿</span>
  );
}

// Posisi jatuh saat drag disimpan di store kecil ini, BUKAN useState RawSchedule (27 Sep 2026).
// Terukur: tiap setState di RawSchedule = re-render ±27rb sel tabel ±230ms -> auto-scroll cuma
// ±3,5 fps. Sekarang yang re-render cuma pelanggan kecil (garis drop, 3 pembatas zona, info di
// kartu melayang), dan hanya kalau target/posisi garis benar-benar berubah.
type DropTampil=(TargetDrop&{top:number;left:number;width:number;lintas:boolean})|null;
type StoreDrop={get:()=>DropTampil;set:(v:DropTampil)=>void;subscribe:(f:()=>void)=>()=>void};
function buatStoreDrop():StoreDrop{
  let v:DropTampil=null;
  const subs=new Set<()=>void>();
  const sama=(a:DropTampil,b:DropTampil)=>a===b||(!!a&&!!b&&a.zona===b.zona&&a.prevId===b.prevId&&a.nextId===b.nextId
    &&a.top===b.top&&a.left===b.left&&a.width===b.width&&a.lintas===b.lintas);
  return{get:()=>v,set:n=>{if(sama(v,n))return;v=n;subs.forEach(f=>f());},subscribe:f=>{subs.add(f);return()=>{subs.delete(f);};}};
}
const useDropTampil=(store:StoreDrop)=>useSyncExternalStore(store.subscribe,store.get);
function GarisDrop({store}:{store:StoreDrop}){
  const dropTarget=useDropTampil(store);
  if(!dropTarget)return null;
  // Spesifikasi prototipe: garis ~2.5px warna aksen + titik bulat di ujung kiri. Lintas zona
  // (drop akan mengubah prioritas): warna amber + badge kecil "→ jadi Tinggi", biar user
  // sadar SEBELUM melepas.
  const warnaGaris=dropTarget.lintas?"#f59e0b":"#2563eb";
  return(
    <div style={{position:"absolute",top:dropTarget.top-1.25,left:dropTarget.left,width:dropTarget.width,height:2.5,background:warnaGaris,zIndex:30,pointerEvents:"none",borderRadius:2}}>
      <span style={{position:"absolute",left:2,top:"50%",width:9,height:9,borderRadius:"50%",background:warnaGaris,transform:"translateY(-50%)",boxShadow:"0 0 0 2px #fff"}}/>
      {dropTarget.lintas&&(
        <span style={{position:"absolute",left:18,top:"50%",transform:"translateY(-50%)",background:"#f59e0b",color:"#fff",fontSize:10,fontWeight:800,borderRadius:99,padding:"2px 9px",whiteSpace:"nowrap",boxShadow:"0 1px 4px #0003"}}>
          → jadi {dropTarget.zona}
        </span>
      )}
    </div>
  );
}
function SelPembatasZona({store,zona,dragAktif,colSpan,children}:{store:StoreDrop;zona:Zona;dragAktif:boolean;colSpan:number;children:any}){
  const dropTarget=useDropTampil(store);
  const jadiTujuanLintas=dragAktif&&!!dropTarget?.lintas&&dropTarget?.zona===zona;
  return(
    <td colSpan={colSpan} style={{padding:0,borderTop:"2px solid #cbd5e1",borderBottom:"1px solid #e2e8f0",
      background:jadiTujuanLintas?"#fef3c7":"#f8fafc",outline:jadiTujuanLintas?"2px solid #f59e0b":"none",outlineOffset:-2}}>
      {children}
    </td>
  );
}
function InfoLintasZona({store,zonaAsal}:{store:StoreDrop;zonaAsal:Zona}){
  const dropTarget=useDropTampil(store);
  if(!dropTarget?.lintas)return null;
  return <div style={{marginTop:4,fontWeight:800,color:"#b45309"}}>{zonaAsal} ➜ {dropTarget.zona}</div>;
}

// hitungProyeksiWiring DIPINDAH (5 Sep 2026) ke fcsService.ts biar bisa dipakai bareng
// RencanaHarian.tsx (satu sumber kebenaran, biar daftar proyeksi di dua tempat itu gak pernah
// "kesplit"/beda) - lihat komentar lengkap di sana.

export function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,refetchRenhar,withRenharQueue,logActivity,logAct,log,user,livePanelTypes}:any){
  const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  // Buffer POTONG (Ctrl+X, 8 Okt 2026) - terpisah dari buffer salin (copiedCells) tapi saling menimpa
  // (cuma satu yang aktif). Ctrl+V: ada potongan -> PINDAH (lewat RPC multi-pindah); tidak ada ->
  // tempel salinan seperti dulu. tujuanTempel = hari tujuan yang diklik setelah memotong.
  const [cutCells,setCutCells]=useState<{rawId:number,date:string}[]>([]);
  const [tujuanTempel,setTujuanTempel]=useState<string|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [moveKomponenState,setMoveKomponenState]=useState<any>(null);
  const [selectedForMove,setSelectedForMove]=useState<{wp:string;kode:string}[]>([]);
  const toggleSelectForMove=(wp:string,kode:string)=>{
    setSelectedForMove(prev=>{
      const exists=prev.some(x=>x.wp===wp&&x.kode===kode);
      return exists?prev.filter(x=>!(x.wp===wp&&x.kode===kode)):[...prev,{wp,kode}];
    });
  };
  const executeMoveKomponen=async(rawId:number,fromDate:string,toDate:string,items:{wp:string;kode:string}[])=>{
    const row=rawData.find((r:any)=>r.id===rawId);
    if(!row)return;
    const schedule={...(row.schedule||{})};
    // REVISI (10 Agu 2026): jejak (digeserKe) di tanggal asal cuma ditinggalkan kalau BENERAN
    // ADA pengerjaan (fcs_timer_kerja) di fromDate - kalau enggak (komponen berprogres tapi gak
    // disentuh hari itu), pindah senyap tanpa jejak (reuse field digeserKe yang sama dgn
    // auto-geser-harian, skema jejak-vs-remove yang sama juga).
    const kodeUnik=[...new Set(items.map(it=>it.kode))];
    const{data:timerRows}=kodeUnik.length>0?await supabase.from("fcs_timer_kerja").select("kode_komponen")
      .eq("panel_id",row.panel_id||row.panelId).eq("proses",row.proses).eq("tanggal",fromDate).in("kode_komponen",kodeUnik):{data:[]};
    const adaPengerjaanSet=new Set((timerRows||[]).map((t:any)=>t.kode_komponen));
    let fromEntries=(schedule[fromDate]||[]).map((e:any)=>({...e,komponen:[...(e.komponen||[])],digeserKe:{...(e.digeserKe||{})}}));
    for(const{wp,kode}of items){
      fromEntries=fromEntries.map((e:any)=>{
        if(e.wp!==wp)return e;
        if(adaPengerjaanSet.has(kode)){
          return{...e,digeserKe:{...e.digeserKe,[kode]:toDate}};
        }
        return{...e,komponen:e.komponen.filter((k:string)=>k!==kode)};
      });
    }
    fromEntries=fromEntries.filter((e:any)=>e.komponen.length>0)
      .map((e:any)=>Object.keys(e.digeserKe).length===0?(({digeserKe,...rest}:any)=>rest)(e):e);
    schedule[fromDate]=fromEntries;
    let toEntries=schedule[toDate]||[];
    for(const{wp,kode}of items){
      const existingEntry=toEntries.find((e:any)=>e.wp===wp);
      if(existingEntry){
        if(!existingEntry.komponen.includes(kode))existingEntry.komponen=[...existingEntry.komponen,kode];
        toEntries=toEntries.map((e:any)=>e.wp===wp?existingEntry:e);
      } else {
        toEntries=[...toEntries,{wp,komponen:[kode]}];
      }
    }
    schedule[toDate]=toEntries;
    markRawDirty(rawId);
    setRawData((prev:any[])=>prev.map(r=>r.id===rawId?{...r,schedule}:r));
    await supabase.from("raw_schedule").update({schedule}).eq("id",rawId);
    setMoveKomponenState(null);
    setSelectedForMove([]);
  };
  const [dragInfo,setDragInfo]=useState(null);
  const [dragOverCell,setDragOverCell]=useState(null);
  const [dragMode,setDragMode]=useState(null);
  const [selDate,setSelDate]=useState(null);
  const PROSES_ORANG_RAW=["WIRING POWER","WIRING CONTROL"];

  const renderKotakWiring=(komp:any,tanggal:string,rowId:number,panelId:number)=>{
    const aktif=tanggal>=komp.mulai&&tanggal<=komp.selesai;
    const isTerlambat=komp.terlambat&&tanggal===komp.selesai;
    const wc=isTerlambat?"#dc2626":WP_COLOR[komp.wp]||"#64748b";
    const namaKomp=getNamaKomponenDariKode(panelId,komp.kode);
    return(
      <td key={tanggal} onClick={(e:any)=>{e.stopPropagation();handleCellClick(rowId,tanggal,e);}}
        style={{borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",padding:"1px",textAlign:"center" as const,cursor:"pointer",background:tanggal===TODAY?"#eff6ff":isSunday(tanggal)?"#fff1f2":"#fff",height:22}}>
        {aktif?(
          <div style={{display:"inline-flex",alignItems:"center",gap:3,background:wc+"22",color:wc,border:`1px solid ${wc}44`,borderRadius:4,padding:"1px 5px",maxWidth:"100%"}}>
            {isTerlambat&&<i className="ti ti-clock-exclamation" style={{fontSize:8}}/>}
            <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{namaKomp}</span>
            <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{komp.jumlahOrang}</span>
          </div>
        ):(
          <span style={{color:"#e2e8f0",fontSize:14}}>+</span>
        )}
      </td>
    );
  };

  // Sub-baris WIRING, rentang, isi sel tanpa selesai & aturan pilih: lib/isiSelJadwal.ts (Tahap 0).
  const getSemuaKomponenSebagaiSubBaris=(row:any):any[]|null=>!PROSES_ORANG_RAW.includes(row.proses)?null:
    semuaKomponenSebagaiSubBaris(row,woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(row.panel_id||row.panelId)),TODAY);

  const getRentangInfoUntukTanggal=(row:any,tanggal:string)=>rentangInfoUntukTanggal(row,tanggal);
  const [filterProses,setFilterProses]=useState<string[]>([]);
  const toggleFilterProses=(pr:string)=>{
    setFilterProses(prev=>prev.includes(pr)?prev.filter(p=>p!==pr):[...prev,pr]);
  };
  const [filterProyek,setFilterProyek]=useState<string[]>([]);
  const [proyekDropdownOpen,setProyekDropdownOpen]=useState(false);
  const toggleFilterProyek=(p:string)=>{
    setFilterProyek(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);
    setFilterPanel([]);
  };
  const [filterPanel,setFilterPanel]=useState<string[]>([]);
  // Riwayat Perubahan Qty: components/RiwayatQty.tsx (Tahap 3c - dipakai juga tampilan "Raw Schedule per WP").
  const riwayatQty=useRiwayatQty({setFilterProyek,setFilterPanel});
  const{openRiwayat,qtyChangeUnread}=riwayatQty;
  const [panelDropdownOpen,setPanelDropdownOpen]=useState(false);
  const toggleFilterPanel=(p:string)=>{
    setFilterPanel(prev=>prev.includes(p)?prev.filter(x=>x!==p):[...prev,p]);
  };
  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);
  const [capacityCollapsed,setCapacityCollapsed]=useState(false);
  // Modal "Atur Kapasitas": components/ModalAturKapasitas.tsx (Tahap 3c - dipakai juga oleh tampilan "Raw Schedule per WP").
  const aturKapasitas=useAturKapasitas({user,refetchRaw});
  const{setOverrideModal,setOverrideValue,setOverrideResult}=aturKapasitas;
  const [lemburLoading,setLemburLoading]=useState(false);
  const [processTimeList,setProcessTimeList]=useState<any[]>([]);
  // REVISI TOTAL (12 Agu 2026) kapasitas WIRING: "hari kerja ke-N" per komponen dari histori
  // fcs_timer_kerja (bukan hari kalender) - dipakai bareng kebutuhanOrangWiring() buat hitung
  // kebutuhan orang dinamis. Lihat panelHelpers.ts WIRING_BOBOT_TABLE buat penjelasan lengkap.
  const [wiringHariKerjaMap,setWiringHariKerjaMap]=useState<Record<string,string[]>>({});
  const wiringPanelIds=useMemo(()=>[...new Set(rawData.filter((r:any)=>PROSES_ORANG_RAW.includes(r.proses)).map((r:any)=>Number(r.panel_id||r.panelId)))],[rawData]);
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      // try/catch (8 Okt 2026) - fetchWiringHariKerjaMap melempar error saat koneksi putus; dulu
      // jadi error tak tertangani. Gagal = pakai peta lama, coba lagi di event berikutnya.
      try{
        const map=await fetchWiringHariKerjaMap(wiringPanelIds as number[]);
        if(!cancelled)setWiringHariKerjaMap(map);
      }catch(err){
        console.error("[Raw Schedule] gagal muat hari kerja wiring (pakai data lama):",err);
      }
    };
    load();
    const ch=supabase.channel("realtime-fcs-timer-kerja-rawschedule")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},load)
      .subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[JSON.stringify(wiringPanelIds)]);




  useEffect(()=>{
    // FIX (20 Sep 2026, retirement fcs_schedule Fase 1) - dulu Promise.all ini JUGA baca
    // fcs_schedule ke state fcsCapData, tapi fcsCapData gak pernah dibaca lagi di file ini -
    // "Capacity Utilization" yang tampil (di bawah) dihitung LANGSUNG dari raw_schedule, bukan
    // dari fcs_schedule. Dicek live (audit database 20 Sep 2026): fcs_schedule 0 baris, satu-
    // satunya jalur isi tabelnya (modal "Generate FCS" fcsModal di ManajemenWO.tsx) gak pernah
    // ke-reach dari UI manapun. Dihapus - fcs_kapasitas_override & fcs_process_time TETAP
    // dibaca (dipakai nyata, lihat fcsKapasitas/processTimeList di bawah).
    // BUG FIX (21 Sep 2026, dilaporkan user - badge "Belum diatur" nyangkut terus utk WIRING
    // CONTROL 22 Sep padahal sudah berkali-kali di-"Atur") - fcs_kapasitas_override TANPA
    // .range() eksplisit kena batas default Supabase/PostgREST 1000 baris (tabel ini sudah
    // 1071 baris per 21 Sep, TERUS bertambah tiap proses×tanggal baru diisi). Dicek live: query
    // PERSIS yang sama (anon key sama) balikin cuma 1000/1071 baris, TANPA error - dan baris
    // WIRING CONTROL/2026-09-22 (yang SUDAH tersimpan benar di DB, updated_at berkali-kali)
    // kebetulan masuk 71 baris yang kepotong. Bukan gagal simpan - data-nya selalu benar,
    // cuma gak pernah ke-load semua ke fcsKapasitas jadi badge status salah baca "belum diatur".
    // Kelas bug SAMA PERSIS dengan saga "renhar 1000-row" (lihat memory sesi) - paginasi penuh.
    // Muat kapasitas + process time: lib/kapasitasHari.ts muatDataKapasitas (paginasi penuh - BUG FIX 21 Sep 2026).
    const fetchCap=async()=>{
      const{kapasitas,processTime}=await muatDataKapasitas();
      setFcsKapasitas(kapasitas);
      setProcessTimeList(processTime);
    };
    fetchCap();
    fetchNotifAvailable();
    const ch=supabase.channel("realtime-fcs-cap-raw-rawschedule")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_process_time"},fetchCap)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fcs_notifikasi"},fetchNotifAvailable)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getNamaKomponenDariKode=(panelId:number,kode:string):string=>namaKomponenDariKode(woData,getEffCfg,panelId,kode);


  // Rumus kapasitas di lib/kapasitasHari.ts (Tahap 0 migrasi accordion - satu sumber utk tampilan lama & baru).
  const getMenitPerPcs=(tipePanel:string,proses:string,kode:string):number=>menitPerPcs(processTimeList,tipePanel,proses,kode);

  const getKomponenStatus=(panelId,proses,kode)=>{
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const cl=panelData.checklist?.[kode];
    if(!cl)return"belum_mulai";
    const v=cl.progress?.[proses]||0;
    if(v>=100)return"finish";
    if(v>0)return"on_progress";
    return"belum_mulai";
  };

  const getTaskStatus=(row,date,wp,komponen)=>{
    const panelId=row.panel_id||row.panelId;
    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
    if(!panelData)return"belum_mulai";
    const proses=row.proses;
    const allDone=komponen.every(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
    if(allDone&&komponen.length>0)return"finish";
    const anyStarted=komponen.some(kode=>{
      const cl=panelData.checklist?.[kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>0;
    });
    if(anyStarted)return"on_progress";
    return"belum_mulai";
  };

  const isWpDone=(panelData,wp,proses)=>wpSelesai(getEffCfg,panelData,wp,proses);

  // ── DRAG BANYAK SEL (8 Okt 2026, tahap 3) ────────────────────────────────────────────────────
  // Drag sebuah sel yang TERMASUK pilihan berisi >=2 sel -> seluruh pilihan ikut (offset hari sama,
  // baris tetap). Selama drag TIDAK ada setState per gerakan mouse: sel tujuan ditandai lewat class
  // CSS di DOM (hijau = bisa mendarat, merah = bentrok) + badge "N sel · +X hari" yang mengikuti
  // kursor. Drag sel di luar pilihan = drag 1 sel lama (pilihan dibatalkan). Drag 1 sel lama tidak
  // berubah sama sekali.
  const dragMultiRef=useRef<{cells:{rawId:number;date:string}[];anchorDate:string;offset:number|null;ditandai:HTMLElement[];badge:HTMLDivElement|null}|null>(null);
  useEffect(()=>{
    if(!document.getElementById("rs-deadline-css")){
      const sd=document.createElement("style");sd.id="rs-deadline-css";
      sd.textContent=".rs-dl:hover .rs-dl-tgl{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:2px}.rs-dl-kosong{opacity:.45}.rs-dl-kosong:hover{opacity:1;text-decoration:underline}";
      document.head.appendChild(sd);
    }
    if(document.getElementById("rs-multi-css"))return;
    const st=document.createElement("style");st.id="rs-multi-css";
    st.textContent=".rs-tujuan-ok{box-shadow:inset 0 0 0 2px #16a34a!important;background:#f0fdf4!important}.rs-tujuan-bad{box-shadow:inset 0 0 0 2px #dc2626!important;background:#fef2f2!important}"
      +".rs-tujuan-ok[data-lbl],.rs-tujuan-bad[data-lbl]{position:relative}"
      +".rs-tujuan-ok[data-lbl]::after,.rs-tujuan-bad[data-lbl]::after{content:attr(data-lbl);position:absolute;left:2px;right:2px;bottom:1px;font:700 8px system-ui,sans-serif;text-align:center;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      +".rs-tujuan-ok[data-lbl]::after{color:#15803d}.rs-tujuan-bad[data-lbl]::after{color:#b91c1c}";
    document.head.appendChild(st);
  },[]);
  // Sel yang ikut dipindah & sel yang bentrok utk offset tertentu (dipakai bayangan drag, validasi
  // sebelum modal, dan Ctrl+X/V). Sel KOSONG di pilihan (mis. dari Shift+klik) diabaikan.
  // REVISI 9 Okt 2026: Minggu BUKAN bentrok otomatis - boleh bila kapasitas Minggu itu (tanggal+proses)
  // diatur > 0 DAN pemakaian SETELAH semua pindahan <= kapasitas (hitungTerpakaiHari = rumus kartu
  // Capacity Utilization, dihitung dari snapshot jadwal setelah dipindah: beban yang mendarat dijumlah,
  // sumber berkurang dari hari asal). Hari biasa tidak dicek kapasitas (sama dgn drag lama). BUSBAR:
  // timer berjalan = bentrok (status timer dimuat 1x saat drag/potong dimulai - muatTimerBusbar).
  // Orkestrasi pindah banyak sel + Undo + status timer BUSBAR = hooks/usePindahMulti.ts (Tahap 0 - satu
  // jalur utk tampilan lama & baru). Data/fungsi diambil SAAT AKSI (getter), bukan saat render.
  const pindahMulti=usePindahMulti(()=>({rawData,user,setRawData,refetchRaw,refetchRenhar,tampilToastAksi,cekPindahMulti,buatSelV2,
    onSesudahPindah:(pindahan:Map<string,string>)=>{
      setSelectedCells((prev:any[])=>prev.map((c:any)=>{const ke=pindahan.get(c.rawId+"|"+c.date);return ke?{...c,date:ke}:c;}));
      setLastSelected(null);
    },
    onSesudahBatal:()=>{setSelectedCells([]);setLastSelected(null);}}));
  const timerBusbarRef=pindahMulti.timerBusbarRef;
  const muatTimerBusbar=pindahMulti.muatTimerBusbar;
  const kapasitasPada=(d:string,pr:string)=>kapasitasPadaLib(fcsKapasitas,d,pr);
  // Sel -> data pindah (BUSBAR: kode busbar yang boleh pindah; lainnya termasuk QC/PACKING: entries
  // tanpa yang selesai/jejak). Jejak (adaPengerjaan) diisi belakangan oleh jalankanPindahMulti.
  // Validasi pindah (buatSelV2/cekPindahMulti) = lib/pindahMulti.ts (Tahap 0) - satu sumber utk tampilan lama & baru.
  const konteksSel=()=>({checklistPanel:(r:any)=>panelById.get(Number(r.panel_id||r.panelId))?.checklist,entriesTanpaSelesai:getEntriesTanpaSelesai});
  const buatSelV2=(ikut:{rawId:number;date:string;ke:string}[])=>buatSelV2Lib(rawData,ikut,konteksSel());
  const cekPindahMulti=(cells:{rawId:number;date:string}[],offset:number)=>cekPindahMultiLib(rawData,cells,offset,{
    ...konteksSel(),tanggalKeIdx,idxKeTanggal,totalKolom:TOTAL_KOLOM,
    alasanTakBisaPilih:(row:any,date:string)=>alasanTakBisaMultiPilih(row,date,false),
    timerBusbar:timerBusbarRef.current,kapasitasPada,hitungTerpakaiHari});
  const bersihkanDragMulti=()=>{
    const m=dragMultiRef.current;if(!m)return;
    m.ditandai.forEach(el=>{el.classList.remove("rs-tujuan-ok","rs-tujuan-bad");delete el.dataset.lbl;});
    m.badge?.remove();
    dragMultiRef.current=null;
  };

  const onDragStart=(e,rawId,fromDate,entries)=>{
    // entries di sini udah difilter (lewat getEntriesTanpaSelesai) buang komponen yang udah
    // 100% - kalau abis difilter kosong berarti SEMUA komponen di cell ini udah selesai,
    // gak ada yang perlu/boleh digeser. Batalkan drag-nya sama sekali.
    if(entries.length===0){e.preventDefault();return;}
    e.dataTransfer.effectAllowed="move";
    const termasukPilihan=selectedCells.some((c:any)=>c.rawId===rawId&&c.date===fromDate);
    if(termasukPilihan&&selectedCells.length>=2){
      const badge=document.createElement("div");
      badge.style.cssText="position:fixed;z-index:10001;pointer-events:none;padding:5px 11px;border-radius:99px;background:#2563eb;color:#fff;font:700 12px system-ui,sans-serif;white-space:nowrap;left:-1000px;top:-1000px";
      badge.textContent=selectedCells.length+" sel";
      document.body.appendChild(badge);
      try{e.dataTransfer.setDragImage(badge,12,12);}catch{/* browser lama - pakai gambar bawaan */}
      dragMultiRef.current={cells:[...selectedCells],anchorDate:fromDate,offset:null,ditandai:[],badge};
      // Status timer BUSBAR dimuat 1x; begitu tiba, bayangan dihitung ulang di dragover berikutnya.
      muatTimerBusbar(selectedCells).then(()=>{const mm=dragMultiRef.current;if(mm)mm.offset=null;});
    } else {
      bersihkanDragMulti();
      if(selectedCells.length>0){setSelectedCells([]);setLastSelected(null);}
    }
    setDragInfo({rawId,fromDate,entries});
  };

  const onDragOver=(e,rawId,date)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    const m=dragMultiRef.current;
    if(m){
      const offset=tanggalKeIdx(date)-tanggalKeIdx(m.anchorDate);
      if(m.badge){m.badge.style.left=(e.clientX+16)+"px";m.badge.style.top=(e.clientY+16)+"px";}
      if(offset===m.offset)return;
      m.offset=offset;
      m.ditandai.forEach(el=>{el.classList.remove("rs-tujuan-ok","rs-tujuan-bad");delete el.dataset.lbl;});m.ditandai=[];
      const{ikut,bentrok,mingguOk}=cekPindahMulti(m.cells,offset);
      const cont=tableScrollRef.current;
      const tandai=(c:any,cls:string,lbl?:string)=>{if(!c.ke||!cont)return;const td=cont.querySelector(`tr[data-rawid="${c.rawId}"] td[data-tgl="${c.ke}"]`) as HTMLElement|null;if(td){td.classList.add(cls);if(lbl)td.dataset.lbl=lbl;m.ditandai.push(td);}};
      if(offset!==0){
        ikut.forEach(c=>tandai(c,"rs-tujuan-ok",mingguOk.has(c.rawId+"|"+c.ke)?"Minggu · kapasitas tersedia":undefined));
        bentrok.forEach(c=>tandai(c,"rs-tujuan-bad",c.alasan));
      }
      if(m.badge){
        m.badge.textContent=`${ikut.length+bentrok.length} sel · ${offset>0?"+":""}${offset} hari${bentrok.length?` · ${bentrok.length} bentrok`:""}`;
        m.badge.style.background=bentrok.length?"#dc2626":"#2563eb";
      }
      return;
    }
    setDragOverCell({rawId,date});
  };

  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    const m=dragMultiRef.current;
    if(m){
      const offset=tanggalKeIdx(toDate)-tanggalKeIdx(m.anchorDate);
      const cells=m.cells;
      bersihkanDragMulti();setDragInfo(null);
      if(offset===0)return;
      const{ikut,bentrok}=cekPindahMulti(cells,offset);
      if(bentrok.length>0){
        tampilToastAksi(`Dibatalkan: ${bentrok.length} sel tidak bisa mendarat (${[...new Set(bentrok.map(b=>b.alasan))].join(", ")}). Tidak ada yang dipindah.`,"err");
        return;
      }
      if(ikut.length===0)return;
      setDragMode({multi:true,cells:ikut.map(c=>({rawId:c.rawId,date:c.date})),offset,fromDate:m.anchorDate,toDate});
      return;
    }
    setDragOverCell(null);
    if(!dragInfo)return;
    if(dragInfo.rawId!==rawId){setDragInfo(null);return;}
    if(dragInfo.fromDate===toDate){setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});
    setDragInfo(null);
  };

  // dragInfo cuma di-clear di onDrop - kalau drag DIBATALKAN (dilepas di luar cell manapun,
  // atau kesela interaksi lain kayak buka context menu klik-kanan di tengah proses drag),
  // onDrop gak pernah kepanggil dan dragInfo jadi nyangkut/basi. Drag/drop native BERIKUTNYA
  // (bahkan yang gak disengaja) bisa kepicu pakai dragInfo LAMA yang salah - efeknya keliatan
  // kayak komponen "numpuk"/pindah ke tempat yang gak diminta. onDragEnd jamin dragInfo selalu
  // ke-reset begitu gesture drag berakhir, sukses ataupun dibatalkan.
  const onDragEnd=()=>{
    bersihkanDragMulti();
    setDragInfo(null);
    setDragOverCell(null);
  };

  // Komponen yang progress-nya udah 100% harus "terkunci di tempatnya" - gak boleh ikut
  // kebawa drag walau komponen LAIN di WP/cell yang sama lagi digeser. Buang kode yang udah
  // selesai dari tiap entry (token __wiring_ dibiarin, itu metadata bobot bukan komponen
  // asli); entry yang abis difilter kosong (semua komponennya udah selesai) dibuang total.
  const getEntriesTanpaSelesai=(row:any,entries:any[])=>{
    const panelId=row.panel_id||row.panelId;
    return entriesTanpaSelesai(row.proses,entries,woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>p.id===panelId));
  };

  // ── KOLOM TANGGAL: SCROLL BEBAS + VIRTUALISASI KOLOM (4 Okt 2026) ──────────────────────────
  // Dulu: state weekStart (=TODAY) + jendela tetap 44 hari (weekStart-14 s/d +29), "Minggu Lalu/
  // Depan" mengganti weekStart. Sekarang grid adalah 1 kanvas tanggal kontinu ACUAN_TANGGAL +-
  // RENTANG_VIRTUAL_HARI (praktis tanpa batas), posisi tanggal = aritmetika murni (lebar kolom
  // tetap). Yang DIRENDER cuma kolom terlihat + BUFFER_KOLOM di kiri-kanan; sisanya 1 sel spacer
  // kiri & 1 kanan per baris. Kartu Capacity Utilization TIDAK ikut state ini (mingguKapasitas, navigasi sendiri).
  const LEBAR_TETAP_KOLOM_TANGGAL=160; // tetap (table-layout:fixed) - wajib utk virtualisasi baris & kolom
  // Kolom kiri sticky (8 Okt 2026: + DEADLINE). Offset `left` tiap kolom dihitung dari sini - jangan
  // tulis angka lagi di header/sel. LEBAR_STICKY_KIRI dipakai virtualisasi kolom, lasso, lebar tabel.
  const LEBAR_KOL={proyek:80,panel:150,deadline:96,proses:110,prioritas:90};
  const KIRI_KOL={proyek:0,panel:80,deadline:230,proses:326,prioritas:436};
  const LEBAR_STICKY_KIRI=LEBAR_KOL.proyek+LEBAR_KOL.panel+LEBAR_KOL.deadline+LEBAR_KOL.proses+LEBAR_KOL.prioritas;
  const LEBAR_STICKY_KANAN=40;
  const RENTANG_VIRTUAL_HARI=3650; // +-10 tahun dari ACUAN_TANGGAL
  const BUFFER_KOLOM=14;
  const KOLOM_SEBELUM_HARI_INI=3; // lompat ke tanggal X: X tampil di kolom ke-4 (3 hari sebelumnya terlihat)
  const ACUAN_TANGGAL=TODAY;
  const TOTAL_KOLOM=RENTANG_VIRTUAL_HARI*2+1;
  const msHari=(d:string)=>{const[y,m,dd]=d.split("-").map(Number);return Date.UTC(y,m-1,dd);};
  const ACUAN_MS=msHari(ACUAN_TANGGAL);
  const tanggalKeIdx=(d:string)=>Math.round((msHari(d)-ACUAN_MS)/86400000)+RENTANG_VIRTUAL_HARI;
  const idxKeTanggal=(i:number)=>addDays(ACUAN_TANGGAL,i-RENTANG_VIRTUAL_HARI);
  const tableScrollRef=useRef<HTMLDivElement>(null);
  const labelRentangRef=useRef<HTMLSpanElement>(null);
  const kolomTerlihat=(sl:number,cw:number)=>{
    const lebarTgl=Math.max(LEBAR_TETAP_KOLOM_TANGGAL,cw-LEBAR_STICKY_KIRI-LEBAR_STICKY_KANAN);
    const pertama=Math.max(0,Math.floor(sl/LEBAR_TETAP_KOLOM_TANGGAL));
    const terakhir=Math.min(TOTAL_KOLOM-1,pertama+Math.ceil(lebarTgl/LEBAR_TETAP_KOLOM_TANGGAL)-1);
    return{pertama,terakhir};
  };
  const idxHariIni=tanggalKeIdx(TODAY);
  const [jendelaKolom,setJendelaKolom]=useState<{awal:number;akhir:number}>(()=>({
    awal:Math.max(0,idxHariIni-KOLOM_SEBELUM_HARI_INI-BUFFER_KOLOM),
    akhir:Math.min(TOTAL_KOLOM-1,idxHariIni-KOLOM_SEBELUM_HARI_INI+12+BUFFER_KOLOM),
  }));
  const jendelaKolomRef=useRef(jendelaKolom);jendelaKolomRef.current=jendelaKolom;
  // Kolom asal drag WP (HTML5) ikut dirender sampai drag selesai (jendela diperlebar kontinu) -
  // kalau ter-unmount di tengah drag, onDragEnd gak terpanggil & dragInfo basi.
  const idxAsalDrag=(dragInfo as any)?.fromDate?tanggalKeIdx((dragInfo as any).fromDate):null;
  const awalRender=idxAsalDrag!=null?Math.min(jendelaKolom.awal,idxAsalDrag):jendelaKolom.awal;
  const akhirRender=idxAsalDrag!=null?Math.max(jendelaKolom.akhir,idxAsalDrag):jendelaKolom.akhir;
  const days=useMemo(()=>{const a:string[]=[];for(let i=awalRender;i<=akhirRender;i++)a.push(idxKeTanggal(i));return a;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[awalRender,akhirRender]);
  const lebarSpasiKiri=awalRender*LEBAR_TETAP_KOLOM_TANGGAL;
  const lebarSpasiKanan=(TOTAL_KOLOM-1-akhirRender)*LEBAR_TETAP_KOLOM_TANGGAL;
  const lompatKeTanggal=(d:string)=>{
    const c=tableScrollRef.current;if(!c)return;
    c.scrollLeft=Math.max(0,(tanggalKeIdx(d)-KOLOM_SEBELUM_HARI_INI)*LEBAR_TETAP_KOLOM_TANGGAL);
  };
  // Posisi awal: hari ini (sekali saat mount).
  useEffect(()=>{lompatKeTanggal(TODAY);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Jendela kolom dihitung ulang saat scroll/resize; state cuma diganti kalau area terlihat sudah
  // mendekati tepi buffer. Label rentang terlihat ditulis langsung ke DOM (tanpa render ulang).
  useEffect(()=>{
    const c=tableScrollRef.current;if(!c)return;
    let raf=0;
    const hitung=()=>{
      raf=0;
      const cw=c.clientWidth;if(cw<=0)return; // tersembunyi
      const{pertama,terakhir}=kolomTerlihat(c.scrollLeft,cw);
      if(labelRentangRef.current)labelRentangRef.current.textContent=getDayLabel(idxKeTanggal(pertama))+" – "+getDayLabel(idxKeTanggal(terakhir));
      const j=jendelaKolomRef.current;
      if(pertama-BUFFER_KOLOM/2>=j.awal&&terakhir+BUFFER_KOLOM/2<=j.akhir)return;
      setJendelaKolom({awal:Math.max(0,pertama-BUFFER_KOLOM),akhir:Math.min(TOTAL_KOLOM-1,terakhir+BUFFER_KOLOM)});
    };
    const jadwal=()=>{if(!raf)raf=requestAnimationFrame(hitung);};
    c.addEventListener("scroll",jadwal,{passive:true});
    window.addEventListener("resize",jadwal);
    const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(jadwal):null;
    ro?.observe(c);
    jadwal();
    return()=>{c.removeEventListener("scroll",jadwal);window.removeEventListener("resize",jadwal);ro?.disconnect();if(raf)cancelAnimationFrame(raf);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Kartu Capacity Utilization: punya navigasi minggu SENDIRI (tombol Minggu Lalu/Ini/Depan di
  // header kartu), default minggu kalender berjalan (Senin-Minggu dari TODAY). Independen dari
  // posisi scroll grid (dulu days.slice(0,7) = 2 minggu lalu sejak 23 Jul).
  const SENIN_MINGGU_INI=useMemo(()=>{
    const[y,m,d]=TODAY.split("-").map(Number);
    const dow=new Date(y,m-1,d).getDay(); // 0=Minggu
    return addDays(TODAY,-((dow+6)%7));
  },[]);
  const [seninKapasitas,setSeninKapasitas]=useState<string>(SENIN_MINGGU_INI);
  const mingguKapasitas=useMemo(()=>Array.from({length:7},(_,i)=>addDays(seninKapasitas,i)),[seninKapasitas]);

  // renhar TAMBAHAN (audit egress 6 Sep 2026) - prop `renhar` cuma window default 90 hari
  // lalu/30 hari depan (dibagi bareng RencanaHarian/OutstandingView/TrackingPekerja, lihat
  // useRenhar.ts). Klik "‹ Minggu Lalu" TANPA BATAS bisa nge-scroll window 44-hari (`days`)
  // di atas KELUAR dari window itu - kalau iya, fetch tambahan KHUSUS rentang `days` yang
  // lagi ditampilkan, digabung ke effectiveRenhar (dipakai gantiin SEMUA baca `renhar.filter/
  // find` di bawah - bukan buat setRenhar/createRenhar/dst, itu tetap ke state global).
  const renharWindow=useMemo(()=>getRenharWindowRange(),[]);
  const [renharExtra,setRenharExtra]=useState<any[]>([]);
  useEffect(()=>{
    // (4 Okt 2026) rentang = kolom yang SEDANG dirender (terlihat + buffer, ikut scroll bebas);
    // jeda 300 ms supaya scroll cepat tidak memicu fetch beruntun.
    const rangeFrom=days[0],rangeTo=days[days.length-1];
    const needsExtra=rangeFrom<renharWindow.from||rangeTo>renharWindow.to;
    if(!needsExtra){setRenharExtra([]);return;}
    let cancelled=false;
    const t=setTimeout(()=>{
      renharService.getAll({from:rangeFrom,to:rangeTo}).then(rows=>{if(!cancelled)setRenharExtra(rows);})
        .catch(err=>console.error("gagal ambil renhar tambahan "+rangeFrom+" s/d "+rangeTo+":",err));
    },300);
    return()=>{cancelled=true;clearTimeout(t);};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[days[0],days[days.length-1],renharWindow]);
  const effectiveRenhar=useMemo(()=>{
    if(renharExtra.length===0)return renhar;
    const idsInExtra=new Set(renharExtra.map((r:any)=>r.id));
    return[...renharExtra,...renhar.filter((r:any)=>!idsInExtra.has(r.id))];
  },[renhar,renharExtra]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;

  // Keyboard handler Ctrl+C / Ctrl+V / Esc / Delete
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      // (8 Okt 2026) Jangan tangkap shortcut saat mengetik di input/textarea/select.
      const tgt=e.target as HTMLElement|null;
      if(tgt&&(tgt.tagName==="INPUT"||tgt.tagName==="TEXTAREA"||tgt.tagName==="SELECT"||tgt.isContentEditable))return;
      const mod=e.ctrlKey||e.metaKey;const k=(e.key||"").toLowerCase();
      if(mod&&k==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();setCutCells([]);setTujuanTempel(null);}
      }
      if(mod&&k==="x"){
        if(selectedCells.length>0){e.preventDefault();aksiMultiRef.current.potong();}
      }
      if(mod&&k==="v"){
        if(cutCells.length>0){
          e.preventDefault();
          aksiMultiRef.current.tempelPotongan();
        } else if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(mod&&k==="z"&&!e.shiftKey){
        if(pindahMulti.undoMultiRef.current.length>0){e.preventDefault();aksiMultiRef.current.batalkanPindahTerakhir();}
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);setCutCells([]);setTujuanTempel(null);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,cutCells,tujuanTempel,lastSelected,rawData,woData]);
  // ── COPY PASTE FUNCTIONS ──
  const toggleMarkerCell=async(rawId:number,date:string)=>{
    const rowM=rawData.find((r:any)=>r.id===rawId);
    if(!rowM)return;
    const newSchedule=togglePenanda(rowM.schedule,date,rowM.proses); // lib/jadwalPindah.ts (satu sumber dgn tampilan per WP)
    await updateRaw(rowM.id,{schedule:newSchedule});
    markRawDirty(rawId);
    setRawData((prev:any)=>prev.map((r:any)=>r.id===rawId?{...r,schedule:newSchedule}:r));
  };
  // PROSES yang cuma penanda tanggal (bukan per-komponen) - klik cell langsung toggle, gak ada modal, gak masuk renhar.
  // NAMEPLATE/YELLOWMARK (16 Sep 2026) - DIHAPUS dari Raw Schedule sesuai permintaan user (baris
  // "Tambah Panel" gak akan nawarin lagi, baris lama sudah dibersihkan dari raw_schedule) -
  // progress aktualnya tetap di panels.nameplate_progress (Vista Pekerja NameplateView), sudah
  // dan tetap dilihat lewat Detail Progres/Task Monitoring, cuma gak lagi lewat jalur ini.
  const PROSES_MARKER_ONLY=["QC TEST","PACKING"];

  // MULTI-PILIH SEL (8 Okt 2026, tahap 1 fitur pindah banyak sel) - Ctrl/Cmd+klik & lasso BARU
  // memakai state selectedCells yang SAMA dgn Shift+klik/Alt+klik lama (bukan sistem seleksi kedua).
  // Aturan "boleh ikut dipilih" = aturan drag yang SUDAH ada: sel yang semua isinya selesai/jejak
  // (getEntriesTanpaSelesai kosong) tidak bisa; BUSBAR belum ikut multi-pindah (keputusan B, drag
  // 1 sel BUSBAR lama tetap); sel rentang (tidak bisa di-drag sejak dulu) tidak bisa.
  // Return null = boleh; string = alasan (ditampilkan sebagai toast). `kosongBoleh` = sel tanpa isi
  // dianggap boleh (Ctrl+klik setara Alt+klik lama, dipakai juga utk copy/paste); lasso -> false.
  const alasanTakBisaMultiPilih=(row:any,date:string,kosongBoleh:boolean):string|null=>
    alasanTakBisaMultiPilihLib(row,date,kosongBoleh,{checklistPanel:(r:any)=>panelById.get(Number(r.panel_id||r.panelId))?.checklist,entriesTanpaSelesai:getEntriesTanpaSelesai});

  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    const rowClicked=rawData.find((r:any)=>r.id===rawId);
    // Mode POTONG (8 Okt 2026, review): klik biasa di baris MANA PUN = pilih hari tujuan - dicek
    // SEBELUM cabang marker QC TEST/PACKING supaya klik tujuan tidak ikut men-toggle marker (menulis
    // raw_schedule tanpa sengaja). Logika marker sendiri tidak diubah.
    if(cutCells.length>0&&!(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)){
      e.stopPropagation();
      setTujuanTempel(date);
      return;
    }
    // Klik BIASA di baris QC TEST/PACKING = toggle penanda (tidak berubah). Klik dgn Ctrl/Cmd/Alt/Shift
    // (9 Okt 2026, keputusan user) = memilih sel utk pindah banyak sel, tidak men-toggle penanda.
    if(rowClicked&&PROSES_MARKER_ONLY.includes(rowClicked.proses)&&!(e.ctrlKey||e.metaKey||e.altKey||e.shiftKey)){
      e.stopPropagation();
      toggleMarkerCell(rawId,date);
      return;
    }
    // Shift+klik di baris QC/PACKING TANPA titik awal pilihan (9 Okt 2026, review) dulu jatuh ke cabang
    // klik biasa -> membuka modal Edit (TAMBAH WP) di baris penanda. Sekarang = pilih 1 sel itu (aturan
    // sama dgn Ctrl+klik); baris penanda tidak pernah membuka modal Edit.
    if(rowClicked&&PROSES_MARKER_ONLY.includes(rowClicked.proses)&&e.shiftKey&&!lastSelected&&!(e.ctrlKey||e.metaKey||e.altKey)){
      e.stopPropagation();
      const sudah=selectedCells.some((c:any)=>c.rawId===rawId&&c.date===date);
      if(!sudah){
        const alasan=alasanTakBisaMultiPilih(rowClicked,date,true);
        if(alasan){tampilToastUrutan(alasan);return;}
        setSelectedCells(prev=>[...prev,{rawId,date}]);
      }
      setLastSelected({rawId,date});
      return;
    }
    if(moveKomponenState){
      if(moveKomponenState.rawId!==rawId){
        alert("Cuma bisa pindahin ke tanggal lain di BARIS (proses) yang sama.");
        return;
      }
      if(moveKomponenState.date===date){
        setMoveKomponenState(null);
        return;
      }
      executeMoveKomponen(rawId,moveKomponenState.date,date,moveKomponenState.items);
      return;
    }
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){
      // Select range - hanya di row yang sama (seperti spreadsheet horizontal)
      // Indeks tanggal lewat aritmetika (4 Okt 2026) - kolom divirtualisasi, tanggal di luar
      // kolom yang dirender tetap valid.
      const startDayIdx=tanggalKeIdx(lastSelected.date);
      const endDayIdx=tanggalKeIdx(date);
      const minDay=Math.min(startDayIdx,endDayIdx);
      const maxDay=Math.max(startDayIdx,endDayIdx);
      // Jika row berbeda, select semua row di antara keduanya
      const rows=rawData;
      const startRowIdx=rows.findIndex(r=>r.id===lastSelected.rawId);
      const endRowIdx=rows.findIndex(r=>r.id===rawId);
      const minRow=Math.min(startRowIdx,endRowIdx);
      const maxRow=Math.max(startRowIdx,endRowIdx);
      const newSelected:any[]=[];
      for(let r=minRow;r<=maxRow;r++){
        for(let d=minDay;d<=maxDay;d++){
          newSelected.push({rawId:rows[r].id,date:idxKeTanggal(d)});
        }
      }
      setSelectedCells(newSelected);
    } else if(e.ctrlKey||e.metaKey){
      // Ctrl/Cmd+klik (BARU, 8 Okt 2026) = setara Alt+klik lama (tambah/kurangi 1 sel), plus aturan
      // multi-pilih (sel selesai/BUSBAR/rentang ditolak dgn toast). Melepas pilihan selalu boleh.
      const sudahDipilih=selectedCells.some((c:any)=>c.rawId===rawId&&c.date===date);
      if(!sudahDipilih){
        const alasan=alasanTakBisaMultiPilih(rowClicked,date,true);
        if(alasan){tampilToastUrutan(alasan);return;}
      }
      setSelectedCells(prev=>{
        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});
    } else if(e.altKey){
      // Alt+klik = toggle individual cell (multi select tidak berurutan)
      setSelectedCells(prev=>{
        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});
    } else {
      // Klik biasa tanpa modifier
      if(cutCells.length>0){
        // Mode POTONG (8 Okt 2026): klik = tandai hari tujuan (kolom), tidak membuka Edit.
        setTujuanTempel(date);
        return;
      }
      if(selectedCells.length>0||copiedCells.length>0){
        // Ada selection/copied → clear dan mulai fresh atau buka modal
        if(copiedCells.length>0){
          // Dalam mode paste → set anchor
          setSelectedCells([{rawId,date}]);
          setLastSelected({rawId,date});
        } else {
          // Clear selection, buka modal
          setSelectedCells([]);
          setLastSelected(null);
          openCellModal(rawId,date);
        }
      } else {
        // Tidak ada selection → buka modal
        openCellModal(rawId,date);
      }
    }
  };

  // LASSO (8 Okt 2026, tahap 1 multi-pilih) - tarik kotak mulai dari SEL KOSONG (bukan sel berisi
  // pekerjaan -> itu wilayah drag native, bukan scrollbar) dgn mouse. Kotak digambar langsung ke DOM
  // (tanpa state React, maks 1x/frame); pilihan dihitung SEKALI saat mouse dilepas: baris dari <tr
  // data-rawid> yang memotong kotak (kotak selalu di dalam layar -> barisnya pasti dirender), tanggal
  // dari ARITMETIKA kolom (kolom divirtualisasi, bukan dari elemen DOM sel). Ctrl/Cmd saat mulai =
  // tambah ke pilihan. Klik tanpa geser (<6px) tetap jadi klik biasa (buka Edit seperti dulu).
  // Hanya mouse (pointerType "mouse") - di HP/tablet fitur ini tidak aktif.
  const lassoCtxRef=useRef<any>({});
  lassoCtxRef.current={rawData,selectedCells,alasan:alasanTakBisaMultiPilih};
  useEffect(()=>{
    const cont=tableScrollRef.current;if(!cont)return;
    let mulai:{x:number;y:number;tambah:boolean}|null=null,aktif=false,raf=0;
    let akhir={x:0,y:0};
    let kotak:HTMLDivElement|null=null;
    const ambilKotak=()=>{
      if(!kotak){
        kotak=document.createElement("div");
        kotak.style.cssText="position:fixed;z-index:9000;pointer-events:none;border:1.5px solid #2563eb;background:rgba(37,99,235,.12);border-radius:3px;display:none";
        document.body.appendChild(kotak);
      }
      return kotak;
    };
    const gambar=()=>{
      raf=0;if(!mulai)return;
      const el=ambilKotak();
      el.style.display="block";
      el.style.left=Math.min(mulai.x,akhir.x)+"px";el.style.top=Math.min(mulai.y,akhir.y)+"px";
      el.style.width=Math.abs(akhir.x-mulai.x)+"px";el.style.height=Math.abs(akhir.y-mulai.y)+"px";
    };
    const onDown=(e:PointerEvent)=>{
      if(e.pointerType!=="mouse"||e.button!==0||e.shiftKey||e.altKey)return;
      const t=e.target as HTMLElement;
      if(t.closest('[draggable="true"]'))return;
      const td=t.closest("td[data-tgl]") as HTMLElement|null;
      if(!td||td.dataset.isi==="1")return;
      mulai={x:e.clientX,y:e.clientY,tambah:e.ctrlKey||e.metaKey};aktif=false;akhir={x:e.clientX,y:e.clientY};
    };
    const onMove=(e:PointerEvent)=>{
      if(!mulai)return;
      akhir={x:e.clientX,y:e.clientY};
      if(!aktif){
        if(Math.hypot(akhir.x-mulai.x,akhir.y-mulai.y)<6)return;
        aktif=true;document.body.style.userSelect="none";window.getSelection()?.removeAllRanges();
      }
      if(!raf)raf=requestAnimationFrame(gambar);
    };
    const onUp=()=>{
      if(!mulai)return;
      const m=mulai;mulai=null;
      if(!aktif)return;
      aktif=false;document.body.style.userSelect="";
      if(raf){cancelAnimationFrame(raf);raf=0;}
      if(kotak)kotak.style.display="none";
      // Klik yang menyusul mouseup ini (kalau dilepas di atas sel) JANGAN membuka modal Edit.
      const telan=(ev:MouseEvent)=>{ev.stopPropagation();ev.preventDefault();};
      cont.addEventListener("click",telan,{capture:true,once:true});
      setTimeout(()=>cont.removeEventListener("click",telan,{capture:true}),0);
      const cr=cont.getBoundingClientRect();
      const x1=Math.max(Math.min(m.x,akhir.x),cr.left+LEBAR_STICKY_KIRI),x2=Math.max(m.x,akhir.x);
      const y1=Math.min(m.y,akhir.y),y2=Math.max(m.y,akhir.y);
      if(x2<x1)return;
      const keIdx=(cx:number)=>Math.floor((cx-cr.left-cont.clientLeft+cont.scrollLeft-LEBAR_STICKY_KIRI)/LEBAR_TETAP_KOLOM_TANGGAL);
      const i1=Math.max(0,keIdx(x1)),i2=Math.min(TOTAL_KOLOM-1,keIdx(x2));
      const rowIds=[...cont.querySelectorAll("tr[data-rawid]")].filter(tr=>{
        const r=tr.getBoundingClientRect();return r.bottom>y1&&r.top<y2;
      }).map(tr=>Number((tr as HTMLElement).dataset.rawid));
      const{rawData:rd,selectedCells:sel,alasan}=lassoCtxRef.current;
      const hasil:{rawId:number;date:string}[]=m.tambah?[...sel]:[];
      const ada=new Set(hasil.map(c=>c.rawId+"|"+c.date));
      let pertama:{rawId:number;date:string}|null=null;
      for(const id of rowIds){
        const row=rd.find((r:any)=>r.id===id);if(!row)continue;
        for(let i=i1;i<=i2;i++){
          const d=idxKeTanggal(i);
          if(alasan(row,d,false))continue;
          const k=id+"|"+d;if(ada.has(k))continue;
          ada.add(k);hasil.push({rawId:id,date:d});pertama=pertama||{rawId:id,date:d};
        }
      }
      setCtxMenu(null);
      setSelectedCells(hasil);
      if(pertama)setLastSelected(pertama);
    };
    cont.addEventListener("pointerdown",onDown);
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    return()=>{
      cont.removeEventListener("pointerdown",onDown);
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerup",onUp);
      if(raf)cancelAnimationFrame(raf);
      if(kotak)kotak.remove();
      document.body.style.userSelect="";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleContextMenu=(rawId:number,date:string,e:React.MouseEvent)=>{
    e.preventDefault();
    setCtxMenu({x:e.clientX,y:e.clientY,rawId,date});
    // Jika cell belum ter-select, select dulu
    if(!selectedCells.some(c=>c.rawId===rawId&&c.date===date)){
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});
    }
  };

  const deleteSelected=async()=>{
    if(!selectedCells.length)return;
    const batchUpdates:Record<number,any>={};
    for(const cell of selectedCells){
      const row=rawData.find(r=>r.id===cell.rawId);
      if(!row)continue;
      if(!batchUpdates[row.id]){
        batchUpdates[row.id]={schedule:{...row.schedule},busbar_schedule:{...(row.busbar_schedule||{})}};
      }
      delete batchUpdates[row.id].schedule[cell.date];
      delete batchUpdates[row.id].busbar_schedule[cell.date];
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      markRawDirty(id);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
  };

  const copySelected=()=>{
    if(!selectedCells.length)return;
    const copied=selectedCells.map(c=>{
      const row=rawData.find(r=>r.id===c.rawId);
      return{
        rawId:c.rawId,date:c.date,
        entries:row?.schedule?.[c.date]||[],
        busbar:row?.busbar_schedule?.[c.date]||[],
      };
    });
    setCopiedCells(copied);
    // Buffer salin & potong saling menimpa (8 Okt 2026) - termasuk Copy lewat menu klik kanan.
    setCutCells([]);setTujuanTempel(null);
  };

  // `sumber` (8 Okt 2026): opsional - dipakai "Copy" di modal drag banyak sel; default = buffer salin
  // (Ctrl+C) seperti dulu. Logika tempel tidak berubah.
  const pasteToCell=async(targetRawId:number,targetDate:string,sumber?:any[])=>{
    const copiedCells_=sumber||copiedCells;
    if(!copiedCells_.length)return;
    // Indeks tanggal lewat aritmetika (4 Okt 2026) - dulu days.indexOf: tujuan di luar jendela
    // 44 hari diam-diam dilewati (paste terpotong). Sekarang berlaku untuk tanggal mana pun.
    const targetDayIdx=tanggalKeIdx(targetDate);
    const targetRowIdx=rawData.findIndex(r=>r.id===targetRawId);
    const srcRowIds=[...new Set(copiedCells_.map((c:any)=>c.rawId))];
    const minSrcDayIdx=Math.min(...copiedCells_.map((c:any)=>tanggalKeIdx(c.date)));
    const minSrcRowIdx=Math.min(...srcRowIds.map((id:any)=>rawData.findIndex(r=>r.id===id)));
    const batchUpdates:Record<number,any>={};
    for(const cell of copiedCells_){
      const srcDayIdx=tanggalKeIdx(cell.date);
      const srcRowIdx=rawData.findIndex(r=>r.id===cell.rawId);
      const dayOffset=srcDayIdx-minSrcDayIdx;
      const rowOffset=srcRowIdx-minSrcRowIdx;
      const destDayIdx=targetDayIdx+dayOffset;
      const destRowIdx=targetRowIdx+rowOffset;
      if(destDayIdx<0||destDayIdx>=TOTAL_KOLOM)continue;
      if(destRowIdx<0||destRowIdx>=rawData.length)continue;
      const destDate=idxKeTanggal(destDayIdx);
      const destRow=rawData[destRowIdx];
      if(!destRow)continue;
      if(!batchUpdates[destRow.id]){
        batchUpdates[destRow.id]={schedule:{...destRow.schedule},busbar_schedule:{...(destRow.busbar_schedule||{})}};
      }
      if(cell.entries.length>0) batchUpdates[destRow.id].schedule[destDate]=cell.entries;
      if(cell.busbar.length>0) batchUpdates[destRow.id].busbar_schedule[destDate]=cell.busbar;
    }
    for(const[rowId,data] of Object.entries(batchUpdates)){
      const id=Number(rowId);
      markRawDirty(id);
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
    if(!sumber)setCopiedCells([]);
  };

  // Modal edit sel (tambah/edit/hapus WP & komponen, BUSBAR, bobot WIRING) + modal Kapasitas/Kuota Penuh:
  // components/ModalJadwalSel.tsx (Tahap 3b - dipakai juga oleh tampilan "Raw Schedule per WP").
  const modalJadwal=useModalJadwalSel({woData,rawData,setRawData,updateRaw,user,getEffCfg,getMenitPerPcs,wiringHariKerjaMap,
    withRenharQueue,createRenhar,updateRenhar,removeRenhar,setRenhar,selectedForMove,setSelectedForMove,toggleSelectForMove,setMoveKomponenState});
  const cellModal=modalJadwal.cellModal;
  const openCellModal=modalJadwal.buka;
  const{setModalWp,setModalKomponen,setModalBobotPerKomponen}=modalJadwal; // dipakai "Pilih Komponen Lain" (notifikasi available)
  // Notifikasi komponen available + "Pilih Komponen Lain": components/NotifAvailable.tsx (Tahap 3c).
  const notifAvailable=useNotifAvailable({rawData,woData,getEffCfg,openCellModal,setModalWp,setModalKomponen,setModalBobotPerKomponen});
  const{fetchNotifAvailable}=notifAvailable;

  // Drag & drop BUSBAR - proses ini gak pakai `schedule[tanggal][].komponen` sama sekali
  // (raw_schedule.busbar_schedule[tanggal]=string[] flat, gak ada breakdown per-tahap kayak
  // di checklist Vista Pekerja). Jejak-nya juga TERPISAH (busbar_jejak, bukan numpang di
  // `schedule` pakai wp:"BUSBAR" palsu) - soalnya banyak tempat lain (dateTasks, WP & Komponen
  // Terjadwal, dll) baca `row.schedule` apa adanya sebagai tugas beneran, entry BUSBAR palsu di
  // situ bakal kebaca ganda/salah di banyak tempat sekaligus. Sengaja TANPA cek kapasitas/
  // cascading (BUSBAR gak punya data fcs_process_time buat hitung demand-nya sama sekali, sama
  // seperti auto-geser-harian yang juga ngecualiin BUSBAR dari cascading).
  const confirmDragBusbar=async(mode:"move"|"copy",row:any,fromDate:string,toDate:string,kodeDrag:string[])=>{
    if(mode==="move"){
      const{data:timerAktifRows}=await supabase.from("fcs_timer_kerja").select("kode_komponen")
        .eq("panel_id",row.panel_id||row.panelId).eq("proses","BUSBAR").in("kode_komponen",kodeDrag).is("selesai",null);
      if(timerAktifRows&&timerAktifRows.length>0){
        alert("Gak bisa dipindah - ada timer yang lagi jalan buat komponen: "+[...new Set(timerAktifRows.map((t:any)=>t.kode_komponen))].join(", "));
        setDragMode(null);setDragInfo(null);
        return;
      }
    }
    markRawDirty(row.id);
    // Logika jadwal BUSBAR dipindah ke lib/jadwalPindah.ts (9 Okt 2026, SATU sumber dgn pindah banyak
    // sel) - isi sama persis: move = kode TETAP di busbar_schedule[fromDate] + ditandai busbar_jejak;
    // move MAUPUN copy = gabung ke tujuan + stamp busbar_manual_pin (BUG FIX 23 Sep 2026, auto-geser
    // FASE 2-BUSBAR skip kode ini permanen sampai progress 100%).
    let jBusbar={busbar_schedule:row.busbar_schedule||{},busbar_jejak:row.busbar_jejak||{},busbar_manual_pin:row.busbar_manual_pin||{}};
    if(mode==="move")jBusbar=lepasBusbar(jBusbar,fromDate,toDate,kodeDrag);
    jBusbar=taruhBusbar(jBusbar,toDate,kodeDrag,new Date().toISOString());
    const newBusbarSchedule=jBusbar.busbar_schedule,newBusbarJejak=jBusbar.busbar_jejak,newBusbarManualPin=jBusbar.busbar_manual_pin;
    setRawData((prev:any[])=>prev.map((r:any)=>r.id!==row.id?r:{...r,busbar_schedule:newBusbarSchedule,busbar_jejak:newBusbarJejak,busbar_manual_pin:newBusbarManualPin}));
    // FIX (25 Sep 2026) - sama persis root cause & fix di confirmDrag (proses biasa) di atas:
    // updateRaw() gagal gak pernah dicek di sini, dirty timeout buta bisa abis sebelum hasilnya
    // pasti, rawData optimistic ke-timpa balik diam2 belakangan. Retry + cek hasil + revert +
    // clearRawDirty begitu hasilnya pasti.
    try{
      await withRetry(async()=>{
        const result=await updateRaw(row.id,{busbar_schedule:newBusbarSchedule,busbar_jejak:newBusbarJejak,busbar_manual_pin:newBusbarManualPin});
        if(!result?.success)throw new Error(result?.error||"Gagal menyimpan jadwal BUSBAR ke server");
        return result;
      });
    }catch(err:any){
      clearRawDirty(row.id);
      setRawData((prev:any[])=>prev.map((r:any)=>r.id===row.id?{...r,busbar_schedule:row.busbar_schedule,busbar_jejak:row.busbar_jejak,busbar_manual_pin:row.busbar_manual_pin}:r));
      alert("Gagal menyimpan geser jadwal BUSBAR: "+(err?.message||"koneksi bermasalah")+"\n\nTampilan sudah dikembalikan ke posisi semula - coba geser lagi.");
      return;
    }
    clearRawDirty(row.id);
    let sinkronRenharGagal=false;
    if(mode==="move"){
      // Sync renhar wp="BUSBAR" - helper bersama lib/renharSinkron.ts (8 Okt 2026), logika SAMA
      // dgn proses lain (lihat confirmDrag): baca segar, tambah ke tujuan dulu baru kurangi asal,
      // hasil dicek, gagal -> admin diberi tahu & bisa ulang.
      const sinkron=()=>pindahKomponenRenhar({withRenharQueue,updateRenhar,createRenhar,setRenhar},{rawId:row.id,wp:"BUSBAR",fromDate,toDate,kode:kodeDrag});
      try{await sinkron();}catch(err:any){
        sinkronRenharGagal=!(await tanganiGagalSinkronRenhar(err,`${row.panel} BUSBAR ${kodeDrag.join(", ")} (${fromDate} → ${toDate})`,async()=>{await sinkron();}));
      }
    }
    setDragMode(null);setDragInfo(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,
      action:mode==="move"?"PINDAH JADWAL":"COPY JADWAL",
      description:(mode==="move"?"Pindah":"Copy")+" jadwal "+row.panel+" ("+row.proyek+") proses BUSBAR: "+kodeDrag.join(", ")+" dari "+fromDate+" ke "+toDate+(sinkronRenharGagal?" (SINKRON RENCANA HARIAN GAGAL)":""),
      module:"raw",halaman:"Raw Schedule",proyek:row.proyek||"",panel:row.panel||"",
    });
  };

  // ── PINDAH BANYAK SEL LEWAT RPC (8 Okt 2026) ────────────────────────────────────────────────
  // 1 panggilan pindah_multi_sel (migration 20261008020000): jadwal baru dihitung di sini dgn helper
  // yang SAMA dgn drag 1 sel (lib/jadwalPindah.ts), renhar dipindah di server, semua 1 transaksi.
  // Server menolak kalau jadwal di DB sudah berubah sejak layar dimuat. Gagal -> tampilan dikembalikan
  // + toast merah dgn tombol Ulangi. Sukses -> snapshot disimpan utk Undo (tahap 4).
  // Pindah (validasi -> RPC v2 -> kembalikan bila gagal -> snapshot Undo) & pengaman aksi ganda: hooks/usePindahMulti.ts.
  const jalankanPindahMulti=pindahMulti.jalankanPindahMulti;
  // ── POTONG / TEMPEL / BATALKAN (8 Okt 2026, tahap 4) ────────────────────────────────────────
  const potong=()=>{
    const cells=selectedCells.filter((c:any)=>{const row=rawData.find((r:any)=>r.id===c.rawId);return(row?.schedule?.[c.date]||[]).length>0||(row?.busbar_schedule?.[c.date]||[]).length>0;});
    if(cells.length===0){tampilToastAksi("Sel terpilih kosong - tidak ada yang dipotong.","err");return;}
    const tolak=cells.filter((c:any)=>alasanTakBisaMultiPilih(rawData.find((r:any)=>r.id===c.rawId),c.date,false));
    if(tolak.length>0){
      tampilToastAksi(`${tolak.length} sel tidak bisa dipotong (sudah selesai / jejak / rentang). Tidak ada yang dipotong.`,"err");
      return;
    }
    setCutCells(cells);setCopiedCells([]);setTujuanTempel(null);
    muatTimerBusbar(cells);
    tampilToastAksi(`${cells.length} sel dipotong. Klik hari tujuan di jadwal, lalu Ctrl+V (atau tombol Tempel).`,"ok");
  };
  const tempelPotongan=async()=>{
    if(cutCells.length===0)return;
    if(!tujuanTempel){tampilToastAksi("Klik hari tujuan di jadwal dulu, lalu Ctrl+V.","err");return;}
    // Sel PALING AWAL mendarat di hari tujuan, sisanya ikut offset relatif yang sama.
    const offset=tanggalKeIdx(tujuanTempel)-Math.min(...cutCells.map((c:any)=>tanggalKeIdx(c.date)));
    if(offset===0){tampilToastAksi("Hari tujuan sama dengan posisi sekarang - tidak ada yang dipindah.","err");return;}
    const ok=await jalankanPindahMulti(cutCells,offset);
    if(ok){setCutCells([]);setTujuanTempel(null);}
  };
  // Undo = MEMULIHKAN keadaan persis sebelum pindah (pulihkan_multi_sel_v2) - hooks/usePindahMulti.ts.
  const batalkanPindahTerakhir=pindahMulti.batalkanPindahTerakhir;
  // Copy banyak sel (pilihan "Copy" di modal drag) = salin/duplikat LAMA (pasteToCell) dgn offset hari
  // yang sama, baris tetap - perilaku copy tidak diubah.
  const salinMulti=async(cells:{rawId:number;date:string}[],offset:number)=>{
    const sumber=cells.map(c=>{const row=rawData.find((r:any)=>r.id===c.rawId);return{rawId:c.rawId,date:c.date,entries:row?.schedule?.[c.date]||[],busbar:row?.busbar_schedule?.[c.date]||[]};});
    const minRowIdx=Math.min(...sumber.map(c=>rawData.findIndex((r:any)=>r.id===c.rawId)));
    const minDayIdx=Math.min(...sumber.map(c=>tanggalKeIdx(c.date)));
    await pasteToCell(rawData[minRowIdx].id,idxKeTanggal(minDayIdx+offset),sumber);
  };
  const aksiMultiRef=useRef<any>({});
  aksiMultiRef.current={jalankanPindahMulti,potong,tempelPotongan,batalkanPindahTerakhir};

  const confirmDrag=async(mode)=>{
    if(!dragMode)return;
    if(dragMode.multi){
      const{cells,offset}=dragMode;
      setDragMode(null);setDragInfo(null);
      if(mode==="move")await jalankanPindahMulti(cells,offset);else await salinMulti(cells,offset);
      return;
    }
    const{rawId,fromDate,entries,toDate}=dragMode;
    const rowForDrag=rawData.find((r:any)=>r.id===rawId);
    if(rowForDrag?.proses==="BUSBAR"){
      await confirmDragBusbar(mode,rowForDrag,fromDate,toDate,entries[0]?.komponen||[]);
      return;
    }
    let updatedRow=null;
    markRawDirty(rawId);
    // REVISI (10 Agu 2026): jejak (digeserKe) di tanggal asal cuma ditinggalkan kalau BENERAN
    // ADA pengerjaan (fcs_timer_kerja) di fromDate - kalau enggak, pindah senyap tanpa jejak.
    // Sama skema dgn executeMoveKomponen/auto-geser-harian. Di-fetch di luar setRawData karena
    // updater setState harus sinkron.
    let adaPengerjaanSetDrag=new Set<string>();
    if(mode==="move"){
      const kodeSemua:string[]=[...new Set(entries.flatMap((e:any)=>(e.komponen||[]).filter((k:string)=>!k.startsWith("__wiring_"))))] as string[];
      if(kodeSemua.length>0){
        const{data:timerRowsDrag}=await supabase.from("fcs_timer_kerja").select("kode_komponen")
          .eq("panel_id",rowForDrag?.panel_id||rowForDrag?.panelId).eq("proses",rowForDrag?.proses).eq("tanggal",fromDate).in("kode_komponen",kodeSemua);
        adaPengerjaanSetDrag=new Set((timerRowsDrag||[]).map((t:any)=>t.kode_komponen));
      }
    }
    // Logika jadwal dipindah ke lib/jadwalPindah.ts (8 Okt 2026) - SATU sumber dgn pindah banyak
    // sel sekaligus; isinya sama persis (lihat komentar di sana): move = lepas kode dari asal
    // (jejak digeserKe bila ada pengerjaan di fromDate), lalu move MAUPUN copy = gabung ke tujuan
    // + stamp manualPin (BUG FIX 23 Sep 2026 "pengaturan manual ketimpa auto-geser").
    const nowIsoPin=new Date().toISOString();
    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      let newSch=r.schedule||{};
      if(mode==="move")newSch=lepasDariAsal(newSch,fromDate,toDate,entries,adaPengerjaanSetDrag);
      newSch=taruhDiTujuan(newSch,toDate,entries,nowIsoPin);
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    setDragMode(null);setDragInfo(null);
    // FIX (25 Sep 2026, root cause "geser Raw Schedule balik lagi instan") - updateRaw() gagal
    // (koneksi lambat/putus) TIDAK PERNAH dicek di sini dulu - rawData optimistic di atas cuma
    // keproteksi sesaat (dirty timeout), begitu itu abis & ada event realtime raw_schedule
    // apapun, sync debounce App.tsx nimpa balik ke posisi lama TANPA pesan apapun ke user.
    // Sekarang: retry singkat dulu (withRetry, sama pola vista-pekerja) buat koneksi
    // lambat/putus sesaat, cek hasilnya - kalau ujung2nya tetap gagal, alert ke user + revert
    // rawData ke posisi semula SEKARANG JUGA (bukan nunggu ke-timpa diam2 belakangan), dan
    // clearRawDirty dipanggil begitu hasilnya PASTI (sukses/gagal) - dirty period ngikutin
    // kenyataan, bukan tebakan waktu.
    if(updatedRow){
      try{
        await withRetry(async()=>{
          const result=await updateRaw(rawId,{schedule:updatedRow.schedule});
          if(!result?.success)throw new Error(result?.error||"Gagal menyimpan jadwal ke server");
          return result;
        });
      }catch(err:any){
        clearRawDirty(rawId);
        setRawData(prev=>prev.map(r=>r.id===rawId?{...r,schedule:rowForDrag?.schedule||r.schedule}:r));
        alert("Gagal menyimpan geser jadwal: "+(err?.message||"koneksi bermasalah")+"\n\nTampilan sudah dikembalikan ke posisi semula - coba geser lagi.");
        return;
      }
      clearRawDirty(rawId);
    }
    // Renhar yang udah pernah didistribusi/dirilis buat kombinasi ini perlu IKUT PINDAH
    // tanggalnya di database, bukan cuma di state lokal - kalau enggak, Vista Pekerja
    // (yang baca renhar.tanggal langsung dari DB) masih nampilin di tanggal LAMA walau
    // raw_schedule-nya udah pindah, sementara Rencana Harian (baca raw_schedule) udah gak
    // nampilin di tanggal lama itu lagi - dua sisi jadi gak sinkron.
    // (8 Okt 2026) Lewat helper bersama lib/renharSinkron.ts & SETELAH raw tersimpan (dulu
    // sebelum - renhar gagal = simpan raw ikut batal; raw gagal = renhar sudah terlanjur pindah).
    // Helper: baca segar, tambah ke tujuan dulu baru kurangi asal, hasil dicek, tujuan yang sudah
    // punya baris digabung (dulu update tanggal -> ditolak constraint unik diam-diam).
    let sinkronRenharGagal=false;
    if(mode==="move"&&updatedRow){
      const wpGagal:any[]=[];
      const jalankan=async(daftar:any[])=>{
        wpGagal.length=0;
        let errPertama:any=null;
        for(const e of daftar){
          try{
            await pindahKomponenRenhar({withRenharQueue,updateRenhar,createRenhar,setRenhar},{rawId,wp:e.wp,fromDate,toDate,kode:e.komponen||[]});
          }catch(err){wpGagal.push(e);errPertama=errPertama||err;}
        }
        if(errPertama)throw errPertama;
      };
      try{await jalankan(entries);}catch(err:any){
        sinkronRenharGagal=!(await tanganiGagalSinkronRenhar(err,`${rowForDrag?.panel||""} ${rowForDrag?.proses||""} ${wpGagal.map((e:any)=>e.wp).join(", ")} (${fromDate} → ${toDate})`,()=>jalankan([...wpGagal])));
      }
    }
    // Activity log drag & drop
    const row=rawData.find(r=>r.id===rawId);
    const wpList=entries.map(e=>e.wp).join(", ");
    const kompList=entries.flatMap(e=>e.komponen||[]).join(", ");
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,
      action:mode==="move"?"PINDAH JADWAL":"COPY JADWAL",
      description:(mode==="move"?"Pindah":"Copy")+" jadwal "+row?.panel+" ("+row?.proyek+") proses "+row?.proses+" WP: "+wpList+" dari "+fromDate+" ke "+toDate+(sinkronRenharGagal?" (SINKRON RENCANA HARIAN GAGAL)":""),
      module:"raw",
      halaman:"Raw Schedule",
      proyek:row?.proyek||"",
      panel:row?.panel||"",
    });
  };

  // ══ Prioritas & urutan panel (27 Sep 2026) - lihat lib/rawPanelOrder.ts ══════════════════
  // Semua perubahan prioritas (dropdown PRIORITAS maupun geser lintas zona) & urutan lewat SATU
  // RPC atomik pindah_urutan_panel_raw: prioritas raw_schedule + renhar panel + key urutan dalam 1
  // transaksi. Dulu dropdown loop updateRaw() per baris proses (±13 request) tanpa cek hasil
  // (updateRaw gak throw, balikin {success,error}) - gagal di tengah = prioritas campur di satu
  // panel -> blok panel kepecah di tampilan, dan renhar DB gak pernah ikut berubah.
  const { orderMap, setOrderMap, error: orderMapError } = useRawPanelOrder();
  const [dragPanelId,setDragPanelId]=useState<number|null>(null);
  const dropStore=useRef<StoreDrop|null>(null);
  if(!dropStore.current)dropStore.current=buatStoreDrop();
  const setDropTarget=dropStore.current.set;
  const [menuUrutanPanel,setMenuUrutanPanel]=useState<number|null>(null);
  const [toastUrutan,setToastUrutan]=useState<string|null>(null);
  const toastUrutanTimer=useRef<any>(null);
  // Toast pindah banyak sel (8 Okt 2026): hijau/merah + tombol aksi (Ulangi / Batalkan).
  const [toastAksi,setToastAksi]=useState<{pesan:string;jenis:"ok"|"err";aksi?:{label:string;fn:()=>void}[]}|null>(null);
  const toastAksiTimer=useRef<any>(null);
  const tampilToastAksi=(pesan:string,jenis:"ok"|"err",aksi?:{label:string;fn:()=>void}[])=>{
    setToastAksi({pesan,jenis,aksi});
    if(toastAksiTimer.current)clearTimeout(toastAksiTimer.current);
    toastAksiTimer.current=setTimeout(()=>setToastAksi(null),aksi?.length?9000:5000);
  };
  const tampilToastUrutan=(msg:string)=>{
    setToastUrutan(msg);
    if(toastUrutanTimer.current)clearTimeout(toastUrutanTimer.current);
    toastUrutanTimer.current=setTimeout(()=>setToastUrutan(null),4500);
  };
  const blokRefs=useRef<Record<number,HTMLElement|null>>({});
  const pembatasRefs=useRef<Record<string,HTMLElement|null>>({});
  const blokUrutRef=useRef<{panelId:number;zona:Zona}[]>([]); // panel TERLIHAT urut tampilan, diisi saat render
  const dragPanelIdRef=useRef<number|null>(null);
  const dropTargetRef=useRef<TargetDrop|null>(null);
  const pointerYRef=useRef(0);
  // Prioritas & urutan panel: hooks/useUrutanPanel.ts (Tahap 3c - dipakai juga oleh tampilan "Raw Schedule per WP").
  const urutanPanel=useUrutanPanel({rawData,setRawData,effectiveRenhar,setRenhar,orderMap,setOrderMap,user,blokUrutRef,tampilToastUrutan,setMenuUrutanPanel});
  const{savingUrutan,rowsPanelOf,updatePrioritasPanel,pindahPanel,pindahViaMenu}=urutanPanel;

  // ── Drag: posisi jatuh dihitung dari posisi pointer (Y) vs kotak <tbody> tiap panel TERLIHAT &
  // 3 baris pembatas zona (lihat hitungTargetDrop). Dihitung ulang tiap pointer gerak & tiap
  // container ke-scroll (auto-scroll mindahin kotak-kotaknya walau pointer diam).
  const sensorsUrutan=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:5}}));
  const hitungDropSekarang=()=>{
    const draggedId=dragPanelIdRef.current;
    const cont=tableScrollRef.current;
    if(draggedId==null||!cont)return;
    // Virtualisasi (paket 5): panel yang tidak dirender (di luar layar) TETAP diikutkan pakai posisi
    // model (posisiRef, koordinat konten container) - hitungTargetDrop menentukan tetangga dari
    // urutan daftar ini, jadi daftar wajib lengkap supaya prevId/nextId tidak salah.
    const crKonten=cont.getBoundingClientRect();
    const asalKonten=crKonten.top+cont.clientTop-cont.scrollTop;
    const blok=blokUrutRef.current.map(b=>{
      const el=blokRefs.current[b.panelId];
      if(el){const r=el.getBoundingClientRect();return{panelId:b.panelId,zona:b.zona,top:r.top,bottom:r.bottom};}
      const p=posisiRef.current.get("panel-"+b.panelId);if(!p)return null;
      return{panelId:b.panelId,zona:b.zona,top:asalKonten+p.top,bottom:asalKonten+p.bottom};
    }).filter(Boolean) as any[];
    const pembatas=ZONA_URUTAN.map(z=>{const el=pembatasRefs.current[z];if(!el)return null;const r=el.getBoundingClientRect();return{zona:z,top:r.top,bottom:r.bottom};}).filter(Boolean) as any[];
    const t=hitungTargetDrop(blok,pembatas,pointerYRef.current,draggedId);
    dropTargetRef.current=t;
    if(!t){setDropTarget(null);return;}
    const cr=cont.getBoundingClientRect();
    const zonaAsal=zonaDari(rowsPanelOf(draggedId)[0]?.prioritas);
    setDropTarget({...t,top:t.indicatorY-cr.top+cont.scrollTop,left:cont.scrollLeft,width:cont.clientWidth,lintas:t.zona!==zonaAsal});
  };
  useEffect(()=>{
    if(dragPanelId==null)return;
    // Pointer gerak / scroll cuma menandai "perlu hitung ulang"; hitungnya di loop rAF tunggal di
    // bawah (baca geometri dulu, baru auto-scroll menulis scrollTop) - maksimal 1x hitung per frame.
    let perluHitung=true;
    const jadwal=()=>{perluHitung=true;};
    const onMove=(e:PointerEvent)=>{pointerYRef.current=e.clientY;jadwal();};
    const cont=tableScrollRef.current;
    window.addEventListener("pointermove",onMove);
    // Scroll di level MANA PUN (container tabel, .erp-body halaman, ancestor lain) menggeser kotak
    // baris relatif ke pointer -> hitung ulang. Event scroll gak bubble, tapi fase capture di
    // window tetap lewat, jadi 1 listener ini menangkap semuanya.
    window.addEventListener("scroll",jadwal,{capture:true,passive:true});
    // Selama drag kursor ada di atas kartu melayang (DragOverlay, position:fixed, DI LUAR
    // container tabel) -> wheel/trackpad nyasar ke kartu itu & gak menggeser tabel. Kartu dibikin
    // pointer-events:none (lihat <DragOverlay>), kursor "grabbing" dipindah ke body.
    const cursorLama=document.body.style.cursor;
    document.body.style.cursor="grabbing";
    // AUTO-SCROLL SENDIRI (spesifikasi prototipe, 27 Sep 2026) - bukan autoScroll bawaan dnd-kit
    // (setInterval 5ms, ambang % tinggi container). Tiap frame (requestAnimationFrame): kalau
    // pointer ≤72px dari tepi atas/bawah area tabel yang TERLIHAT di viewport, scroll container
    // dgn kecepatan proporsional (makin dekat/lewat tepi makin cepat). Scroll-nya sendiri memicu
    // event "scroll" di atas -> posisi jatuh ikut dihitung ulang. Kalau container sudah mentok di
    // arah itu, induk scroll-nya (.erp-body) yang digeser - biar bagian tabel di luar viewport tetap terjangkau.
    // "Halaman" di sini BUKAN window: yang scroll itu .erp-body (overflow-y:auto, globalCss.ts) -
    // window gak pernah scroll. Cari induk scrollable terdekat, fallback ke dokumen.
    const cariIndukScroll=(el:HTMLElement|null):HTMLElement=>{
      for(let e=el?.parentElement;e;e=e.parentElement){
        const oy=getComputedStyle(e).overflowY;
        if((oy==="auto"||oy==="scroll")&&e.scrollHeight>e.clientHeight)return e;
      }
      return (document.scrollingElement||document.documentElement) as HTMLElement;
    };
    const induk=cariIndukScroll(cont);
    const AMBANG_PX=72,MAKS_PX_PER_FRAME=24;
    let rafScroll=0;
    const tick=()=>{
      if(perluHitung){perluHitung=false;hitungDropSekarang();}
      if(cont){
        const r=cont.getBoundingClientRect();
        const ri=induk===document.scrollingElement?{top:0,bottom:window.innerHeight}:induk.getBoundingClientRect();
        const atas=Math.max(r.top,ri.top,0),bawah=Math.min(r.bottom,ri.bottom,window.innerHeight);
        const y=pointerYRef.current;
        let v=0;
        if(y<atas+AMBANG_PX)v=-MAKS_PX_PER_FRAME*Math.min(1,(atas+AMBANG_PX-y)/AMBANG_PX);
        else if(y>bawah-AMBANG_PX)v=MAKS_PX_PER_FRAME*Math.min(1,(y-(bawah-AMBANG_PX))/AMBANG_PX);
        if(v!==0){
          const contMentok=v<0?cont.scrollTop<=0:cont.scrollTop+cont.clientHeight>=cont.scrollHeight-1;
          if(!contMentok)cont.scrollTop+=v;
          else induk.scrollTop+=v;
        }
      }
      rafScroll=requestAnimationFrame(tick);
    };
    rafScroll=requestAnimationFrame(tick);
    return()=>{
      cancelAnimationFrame(rafScroll);
      window.removeEventListener("pointermove",onMove);
      window.removeEventListener("scroll",jadwal,{capture:true});
      document.body.style.cursor=cursorLama;
    };
  },[dragPanelId]);
  // Tutup menu ⋮ kalau klik di luar.
  useEffect(()=>{
    if(menuUrutanPanel==null)return;
    const tutup=(e:MouseEvent)=>{if(!(e.target as HTMLElement)?.closest?.("[data-menu-urutan]"))setMenuUrutanPanel(null);};
    window.addEventListener("mousedown",tutup);
    return()=>window.removeEventListener("mousedown",tutup);
  },[menuUrutanPanel]);
  const onDragStartPanel=(e:any)=>{
    const id=Number(e.active?.data?.current?.panelId);
    if(!id)return;
    pointerYRef.current=(e.activatorEvent as PointerEvent)?.clientY??0;
    dragPanelIdRef.current=id;dropTargetRef.current=null;
    setMenuUrutanPanel(null);setDropTarget(null);setDragPanelId(id);
  };
  const selesaiDrag=()=>{dragPanelIdRef.current=null;dropTargetRef.current=null;setDragPanelId(null);setDropTarget(null);};
  const onDragEndPanel=()=>{
    const id=dragPanelIdRef.current,t=dropTargetRef.current;
    selesaiDrag();
    if(id!=null&&t)pindahPanel(id,{zona:t.zona,prevId:t.prevId,nextId:t.nextId});
  };

  // Modal "Tambah Panel ke Raw Schedule": components/ModalTambahPanelRaw.tsx (Tahap 3c - dipakai juga tampilan "Raw Schedule per WP").
  const tambahPanelRaw=useTambahPanelRaw({woData,rawData,createRaw,refetchRaw,log});
  const{setAddModal}=tambahPanelRaw;

  // ── VIRTUALISASI GRID (4 Okt 2026, paket 5) ─────────────────────────────────────────────────
  // Grid dulu merender SEMUA panel (+-900 baris x 44 hari = 128 rb node DOM). Sekarang per BLOK
  // PANEL (semua baris 1 panel utuh, rowSpan aman): blok di luar layar container tabel (+- OVERSCAN)
  // diganti 1 <tbody> spacer setinggi blok itu. SELALU dirender: 3 pembatas zona, panel yang
  // sedang di-drag & panel yang menu urutannya terbuka. Tinggi blok diukur (ResizeObserver) &
  // di-cache; yang belum pernah tampil pakai rata-rata tinggi baris. posisiRef = model posisi
  // semua item (dipakai hitungDropSekarang utk panel di luar layar - urutan tetangga tetap lengkap).
  const OVERSCAN_PX=1500;
  const [jendela,setJendela]=useState<{atas:number;bawah:number}>({atas:0,bawah:4000});
  const jendelaRef=useRef(jendela);jendelaRef.current=jendela;
  const tinggiRef=useRef<Map<string,number>>(new Map());
  const posisiRef=useRef<Map<string,{top:number;bottom:number}>>(new Map());
  const [versiUkur,setVersiUkur]=useState(0);
  const roUkurRef=useRef<ResizeObserver|null>(null);
  const elKeKunci=useRef(new WeakMap<Element,string>());
  const kunciKeEl=useRef(new Map<string,Element>());
  const rafUkurRef=useRef(0);
  if(!roUkurRef.current&&typeof ResizeObserver!=="undefined"){
    roUkurRef.current=new ResizeObserver(entries=>{
      let berubah=false;
      for(const e of entries){
        const k=elKeKunci.current.get(e.target);if(!k)continue;
        const h=(e.target as HTMLElement).getBoundingClientRect().height;
        if(h<=0)continue; // tab tersembunyi (display:none) - jangan timpa ukuran asli
        const lama=tinggiRef.current.get(k);
        if(lama===undefined||Math.abs(lama-h)>0.5){tinggiRef.current.set(k,h);berubah=true;}
      }
      if(berubah&&!rafUkurRef.current)rafUkurRef.current=requestAnimationFrame(()=>{rafUkurRef.current=0;setVersiUkur(v=>v+1);});
    });
  }
  const daftarUkur=(k:string,el:Element|null)=>{
    const ro=roUkurRef.current;if(!ro)return;
    const lama=kunciKeEl.current.get(k);
    if(lama===el)return;
    if(lama){ro.unobserve(lama);kunciKeEl.current.delete(k);}
    if(el){elKeKunci.current.set(el,k);kunciKeEl.current.set(k,el);ro.observe(el);}
  };
  useEffect(()=>()=>{roUkurRef.current?.disconnect();if(rafUkurRef.current)cancelAnimationFrame(rafUkurRef.current);},[]);
  // Jendela render = area terlihat container tabel +- OVERSCAN_PX; dihitung ulang saat scroll/resize,
  // state cuma diganti kalau area terlihat sudah mendekati tepi jendela (bukan tiap frame scroll).
  useEffect(()=>{
    const c=tableScrollRef.current;if(!c)return;
    let raf=0;
    const hitung=()=>{
      raf=0;
      const st=c.scrollTop,ch=c.clientHeight;
      if(ch<=0)return; // tersembunyi
      const j=jendelaRef.current;
      if(st-OVERSCAN_PX/2>=j.atas&&st+ch+OVERSCAN_PX/2<=j.bawah)return;
      setJendela({atas:Math.max(0,st-OVERSCAN_PX),bawah:st+ch+OVERSCAN_PX});
    };
    const jadwal=()=>{if(!raf)raf=requestAnimationFrame(hitung);};
    c.addEventListener("scroll",jadwal,{passive:true});
    window.addEventListener("resize",jadwal);
    const ro=typeof ResizeObserver!=="undefined"?new ResizeObserver(jadwal):null;
    ro?.observe(c);
    jadwal();
    return()=>{c.removeEventListener("scroll",jadwal);window.removeEventListener("resize",jadwal);ro?.disconnect();if(raf)cancelAnimationFrame(raf);};
  },[]);

  // PERFORMA (4 Okt 2026, paket 4) - lihat BarisRawMemo. Diisi ulang tiap render = selalu terbaru.
  const aksiRef=useRef<any>({});
  aksiRef.current={handleCellClick,onDragOver,onDrop,onDragStart,onDragEnd,handleContextMenu,updatePrioritasPanel,pindahViaMenu,getEntriesTanpaSelesai};
  // Panel per id (cocok Number(id), ambil yang PERTAMA - sama persis woData.flatMap(...).find(...)
  // yang dipakai di baris), dulu dicari ulang per sel/per entry di setiap render grid.
  const panelById=useMemo(()=>{
    const m=new Map<number,any>();
    woData.forEach((w:any)=>(w.panels||[]).forEach((p:any)=>{const k=Number(p.id);if(!m.has(k))m.set(k,p);}));
    return m;
  },[woData]);

  // DEADLINE panel (8 Okt 2026) = target baris WO-nya (work_orders.target) - TIDAK berdiri sendiri:
  // deadline per panel di Manajemen WO sudah diwujudkan dgn memecah panel ke baris WO sibling per
  // tanggal (saveWOWithSplit), jadi target WO = deadline panel. Baca-saja di sini (ubah lewat Manajemen
  // WO). Dari woData yang sudah dimuat - tanpa request tambahan.
  const deadlinePanel=useMemo(()=>buatPetaDeadlinePanel(woData),[woData]);
  // Filter baris yang tampil - SATU sumber utk grid & penanda deadline di header (lib/deadlineRaw.ts).
  const lolosFilterBaris=(row:any)=>lolosFilterBarisLib(row,{proses:filterProses,proyek:filterProyek,panel:filterPanel});
  // 🚩 di header tanggal: panel (yang tampil) dgn deadline di tanggal itu.
  const deadlinePerTanggal=useMemo(()=>petaDeadlinePerTanggal(rawData,deadlinePanel,lolosFilterBaris),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rawData,deadlinePanel,filterProses,filterProyek,filterPanel]);
  // PEMAKAIAN KAPASITAS 1 hari x 1 proses (9 Okt 2026) - rumus kartu Capacity Utilization APA ADANYA,
  // dipindah ke sini supaya SATU sumber dgn validasi pindah banyak sel ke hari Minggu. `rows` = baris
  // raw_schedule (bisa versi "setelah dipindah"). Proses jam = qty x menit/pcs, WIRING = kebutuhan orang
  // (+ proyeksi), jejak digeserKe tidak dihitung. Tanpa request (data sudah dimuat).
  const hitungTerpakaiHari=(rows:any[],d:string,pr:string)=>hitungTerpakaiHariLib(rows,d,pr,{panelById,menitPerPcs:getMenitPerPcs,wiringHariKerjaMap});
  const infoDeadline=(target:string)=>infoDeadlineLib(target,TODAY);

  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    const tasks:any[]=[];
    rawData.forEach(r=>{
      if(PROSES_MARKER_ONLY.includes(r.proses))return; // penanda gak lewat renhar/Rilis-Tarik; NAMEPLATE/YELLOWMARK tetap tampil di Rencana Harian lewat baca raw_schedule langsung (lihat RencanaHarian.tsx)
      // WP biasa dari schedule
      (r.schedule?.[selDate]||[]).forEach((e:any)=>{
        tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
          proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
          wp:e.wp,komponen:e.komponen,tanggal:selDate});
      });
      // Busbar dari busbar_schedule
      if(r.proses==="BUSBAR"){
        const busbarItems=r.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
            proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
            wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,isBusbar:true});
        }
      }
    });
    return tasks;
  },[rawData,selDate]);

  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=effectiveRenhar.find((r:any)=>String(r.raw_id||r.rawId)===String(task.rawId)&&r.wp===task.wp&&r.tanggal===task.tanggal);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi}=assignModal;
    // Cek fresh lewat withRenharQueue - JANGAN percaya assignModal.existing (di-capture stale
    // pas modal dibuka, bisa udah beda kondisinya kalau ada tulisan lain nyelip di antaranya).
    // (8 Okt 2026) Gagal -> pesan jujur, modal tetap terbuka, log cuma kalau tersimpan.
    try{
    await withRenharQueue(task,async(existing)=>{
      if(existing){
        markRenharDirty(existing.id);
        const upd=await updateRenhar(existing.id,{pekerja:selPekerja});
        if(!upd?.success)throw Object.assign(new Error(upd?.error||"Gagal menyimpan rencana harian"),{code:(upd as any)?.code});
        setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r));
      } else {
        const result=await createRenhar({
          raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
          proyek:task.proyek,panel:task.panel,proses:task.proses,
          prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:Array.from(new Set(task.komponen||[])),
          tanggal:task.tanggal,divisi,pekerja:selPekerja,
        });
        if(!(result?.success&&result.data))throw Object.assign(new Error(result?.error||"Gagal membuat renhar"),{code:(result as any)?.code});
        markRenharDirty(result.data.id);setRenhar(prev=>[...prev,result.data]);
      }
    });
    }catch(err:any){
      console.error(`[Distribusi Raw Schedule raw ${task.rawId} ${task.wp} ${task.tanggal}] gagal:`,err);
      const kode=typeof err?.code==="string"?err.code.trim():"";
      alert(kode?`Gagal distribusi - server menolak (kode ${kode}): ${err?.message||err}`:`Gagal distribusi - koneksi lambat/putus. Coba lagi.\n(${err?.message||err})`);
      return;
    }
    if(log) await log("DISTRIBUSI RAW SCHEDULE","Distribusi "+task.proses+" - "+task.panel+" ("+task.tanggal+")","renhar",{module:"rencana",action_type:"distribute",proyek:task.proyek||"",panel:task.panel||"",wo_number:task.woId?.toString()||"",halaman:"Raw Schedule"});
    setAssignModal(null);setSelPekerja([]);
  };

  // (8 Okt 2026) Dulu 1 task gagal = loop berhenti diam-diam. Sekarang per task + ringkasan.
  const distributeAll=async()=>{
    const gagal:string[]=[];
    for(const task of dateTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      try{
      await withRenharQueue(task,async(existing)=>{
        if(existing)return;
        const result=await createRenhar({
          raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
          proyek:task.proyek,panel:task.panel,proses:task.proses,
          prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:Array.from(new Set(task.komponen||[])),
          tanggal:task.tanggal,divisi,pekerja:[],
        });
        if(!(result?.success&&result.data))throw Object.assign(new Error(result?.error||"Gagal membuat renhar"),{code:(result as any)?.code});
        markRenharDirty(result.data.id);setRenhar(prev=>[...prev,result.data]);
      });
      }catch(err:any){
        console.error(`[Distribusi semua Raw Schedule raw ${task.rawId} ${task.wp} ${task.tanggal}] gagal:`,err);
        gagal.push(`${task.proses} - ${task.panel} ${task.wp} (${String(err?.message||err).slice(0,80)})`);
      }
    }
    if(gagal.length>0)alert(`Distribusi semua: ${gagal.length} GAGAL (koneksi/server) - klik lagi untuk mencoba ulang:\n\n${gagal.slice(0,15).join("\n")}${gagal.length>15?`\n... dan ${gagal.length-15} lainnya`:""}`);
  };

  const thS={background:"#1e3a8a",color:"#fff",padding:"3px 6px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center" as "center",borderRight:"1px solid #ffffff18",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>lompatKeTanggal(TODAY)} title="Geser grid kembali ke hari ini (grid bisa di-scroll bebas ke tanggal mana pun)" style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #3b5bdb",background:"#eff3ff",color:"#3b5bdb",cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"inherit"}}>Hari Ini</button>
          <span ref={labelRentangRef} style={{fontSize:11,fontWeight:600,color:"#475569",marginLeft:4}}/>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setAddModal(true)} style={{height:28,padding:"0 14px",borderRadius:5,border:"none",background:"#3b5bdb",color:"#fff",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Panel</button>
            <button onClick={openRiwayat} style={{height:28,padding:"0 12px",borderRadius:5,border:"1px solid #bfdbfe",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
              🔔 Riwayat Perubahan
              {qtyChangeUnread>0&&(
                <span style={{background:"#dc2626",color:"#fff",borderRadius:"50%",minWidth:16,height:16,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{qtyChangeUnread}</span>
              )}
            </button>
          </div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
        <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
        <div style={{position:"relative" as const}}>
          <button onClick={()=>setProyekDropdownOpen(!proyekDropdownOpen)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
            {filterProyek.length===0?"Semua Proyek":`${filterProyek.length} Proyek dipilih`}
            <span style={{fontSize:9}}>▾</span>
          </button>
          {proyekDropdownOpen&&(
            <>
              <div onClick={()=>setProyekDropdownOpen(false)} style={{position:"fixed" as const,inset:0,zIndex:998}}/>
              <div style={{position:"absolute" as const,top:"110%",left:0,zIndex:999,background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",padding:8,minWidth:200,maxHeight:280,overflowY:"auto" as const}}>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,borderBottom:"1px solid #f1f5f9",marginBottom:4}}>
                  <input type="checkbox" checked={filterProyek.length===0} onChange={()=>{setFilterProyek([]);setFilterPanel([]);}}/>
                  Semua Proyek
                </label>
                {([...new Set(rawData.map((r:any)=>r.proyek))] as string[]).map(p=>(
                  <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12}}>
                    <input type="checkbox" checked={filterProyek.includes(p)} onChange={()=>toggleFilterProyek(p)}/>
                    {p}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{position:"relative" as const}}>
          <button onClick={()=>setPanelDropdownOpen(!panelDropdownOpen)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,maxWidth:260}}>
            {filterPanel.length===0?"Semua Panel":`${filterPanel.length} Panel dipilih`}
            <span style={{fontSize:9}}>▾</span>
          </button>
          {panelDropdownOpen&&(
            <>
              <div onClick={()=>setPanelDropdownOpen(false)} style={{position:"fixed" as const,inset:0,zIndex:998}}/>
              <div style={{position:"absolute" as const,top:"110%",left:0,zIndex:999,background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",padding:8,minWidth:220,maxHeight:280,overflowY:"auto" as const}}>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,borderBottom:"1px solid #f1f5f9",marginBottom:4}}>
                  <input type="checkbox" checked={filterPanel.length===0} onChange={()=>setFilterPanel([])}/>
                  Semua Panel
                </label>
                {([...new Set(rawData.filter((r:any)=>filterProyek.length===0||filterProyek.includes(r.proyek)).map((r:any)=>r.panel))] as string[]).map(p=>(
                  <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:12}}>
                    <input type="checkbox" checked={filterPanel.includes(p)} onChange={()=>toggleFilterPanel(p)}/>
                    {p}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        {(filterProyek.length>0||filterPanel.length>0)&&(
          <button onClick={()=>{setFilterProyek([]);setFilterPanel([]);}} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>✕ Reset</button>
        )}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>Filter Proses:</span>
        <button onClick={()=>setFilterProses([])} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${filterProses.length===0?"#1d4ed8":"#e2e8f0"}`,background:filterProses.length===0?"#1d4ed8":"#fff",color:filterProses.length===0?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
        {ALL_PROSES.map(pr=>{const pc=PROSES_COLOR[pr]||"#64748b";const isSel=filterProses.includes(pr);return(<button key={pr} onClick={()=>toggleFilterProses(pr)} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr}</button>);})}
      </div>

      {notifAvailable.elemenModal}

      {notifAvailable.elemenBanner}

      {fcsKapasitas.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div onClick={()=>setCapacityCollapsed(!capacityCollapsed)}
            style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:capacityCollapsed?0:10,cursor:"pointer",display:"flex",alignItems:"center",gap:6,userSelect:"none" as const}}>
            <span style={{fontSize:10,transition:"transform .15s",transform:capacityCollapsed?"rotate(-90deg)":"rotate(0deg)",display:"inline-block"}}>▾</span>
            ⚡ Capacity Utilization {filterProses.length>0?"— "+filterProses.join(", "):"(semua proses)"} <span style={{fontWeight:400,fontSize:9,color:"#94a3b8"}}>(dari Raw Schedule)</span>
            <div onClick={e=>e.stopPropagation()} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,textTransform:"none" as const,letterSpacing:0,cursor:"default"}}>
              <span style={{fontSize:11,fontWeight:600,color:"#475569",marginRight:2}}>{getDayLabel(mingguKapasitas[0])} – {getDayLabel(mingguKapasitas[6])}</span>
              <button onClick={()=>setSeninKapasitas(addDays(seninKapasitas,-7))} style={{height:24,padding:"0 10px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>‹ Minggu Lalu</button>
              <button onClick={()=>setSeninKapasitas(SENIN_MINGGU_INI)} style={{height:24,padding:"0 10px",borderRadius:5,border:"0.5px solid #3b5bdb",background:seninKapasitas===SENIN_MINGGU_INI?"#eff3ff":"#fff",color:"#3b5bdb",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Minggu Ini</button>
              <button onClick={()=>setSeninKapasitas(addDays(seninKapasitas,7))} style={{height:24,padding:"0 10px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Minggu Depan ›</button>
            </div>
          </div>
          {!capacityCollapsed&&(
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {mingguKapasitas.map(d=>{
              const prosesToShow=filterProses.length===0?["POTONG","BENDING","STEL","FINISHING","PAINTING","WIRING CONTROL","WIRING POWER"]:filterProses;
              const perProses:{nama:string;terpakai:number;kapasitas:number;adaOverride:boolean;satuan:string}[]=prosesToShow.map((pr:string)=>{
                const isOrangPr=PROSES_ORANG_RAW_GLOBAL.includes(pr);
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                const kapasitasPr=ov?(isOrangPr?Number(ov.jumlah_orang||0):Number(ov.kapasitas_menit||0)):0;
                const terpakaiPr=hitungTerpakaiHari(rawData,d,pr);
                return {nama:pr,terpakai:terpakaiPr,kapasitas:kapasitasPr,adaOverride:!!ov,satuan:isOrangPr?"orang":"mnt"};
              });
              const adaOverride=perProses.some(pp=>pp.adaOverride);
              return(
                <div key={d} style={{background:"var(--card-bg,#fff)",border:"1px solid #e2e8f030",borderRadius:8,padding:"8px 12px",minWidth:130,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  {!adaOverride?(
                    <button onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:filterProses.length>0?filterProses:["POTONG"]});setOverrideValue("");setOverrideResult(null);}}
                      style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,fontFamily:"inherit"}}>⚠ Belum diatur · Atur</button>
                  ):(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:5,textAlign:"left" as const}}>
                      {perProses.map(pp=>{
                        if(!pp.adaOverride){
                          return(
                            <div key={pp.nama} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9}}>
                              <span style={{color:"#64748b"}}>{pp.nama}</span>
                              <button onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:[pp.nama]});setOverrideValue("");setOverrideResult(null);}}
                                style={{color:"#dc2626",fontWeight:700,background:"none",border:"none",cursor:"pointer",textDecoration:"underline",padding:0,fontSize:9,fontFamily:"inherit"}}>Belum diatur · Atur</button>
                            </div>
                          );
                        }
                        const pctPr=pp.kapasitas>0?Math.min(Math.round((pp.terpakai/pp.kapasitas)*100),100):0;
                        const colorPr=pctPr>=95?"#dc2626":pctPr>=80?"#f59e0b":"#16a34a";
                        return(
                          <div key={pp.nama} onClick={()=>{setOverrideModal({tanggalMulai:d,tanggalAkhir:d,proses:[pp.nama]});setOverrideValue("");setOverrideResult(null);}}
                            style={{cursor:"pointer"}} title="Klik buat edit kapasitas">
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9,marginBottom:2}}>
                              <span style={{color:"#64748b"}}>{pp.nama} ✎</span>
                              <span style={{fontWeight:700,color:"#1e293b"}}>{pp.satuan==="orang"?Number(pp.terpakai.toFixed(1)):Math.round(pp.terpakai)}/{pp.kapasitas} {pp.satuan}</span>
                            </div>
                            <div style={{width:"100%",height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                              <div style={{width:pctPr+"%",height:"100%",background:colorPr,borderRadius:99}}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {orderMapError&&(
        <div style={{fontSize:11,color:"#b91c1c",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"6px 10px",marginBottom:8}}>
          ⚠ Urutan panel gagal dimuat ({orderMapError}) - tampilan sementara pakai urutan default (prioritas → panel). Coba muat ulang halaman.
        </div>
      )}
      <DndContext sensors={sensorsUrutan} onDragStart={onDragStartPanel} onDragEnd={onDragEndPanel} onDragCancel={selesaiDrag}
        autoScroll={false}>
      <div ref={tableScrollRef} style={{position:"relative",overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 120px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:LEBAR_STICKY_KIRI+TOTAL_KOLOM*LEBAR_TETAP_KOLOM_TANGGAL+LEBAR_STICKY_KANAN,borderCollapse:"collapse",fontSize:9,tableLayout:"fixed"}}>
          <thead ref={el=>daftarUkur("thead",el)} style={{position:"sticky",top:0,zIndex:10}}>
            <tr>
              <th style={{...thS,textAlign:"left",width:LEBAR_KOL.proyek,minWidth:LEBAR_KOL.proyek,position:"sticky",left:KIRI_KOL.proyek,zIndex:5,background:"#1e3a8a"}}>PROYEK</th>
              <th style={{...thS,textAlign:"left",width:LEBAR_KOL.panel,minWidth:LEBAR_KOL.panel,position:"sticky",left:KIRI_KOL.panel,zIndex:5,background:"#1e3a8a"}}>PANEL</th>
              <th title="Deadline = target WO (ubah lewat Manajemen WO)" style={{...thS,width:LEBAR_KOL.deadline,minWidth:LEBAR_KOL.deadline,position:"sticky",left:KIRI_KOL.deadline,zIndex:5,background:"#1e3a8a"}}>DEADLINE</th>
              <th style={{...thS,width:LEBAR_KOL.proses,minWidth:LEBAR_KOL.proses,position:"sticky",left:KIRI_KOL.proses,zIndex:5,background:"#1e3a8a"}}>PROSES</th>
              <th style={{...thS,width:LEBAR_KOL.prioritas,minWidth:LEBAR_KOL.prioritas,position:"sticky",left:KIRI_KOL.prioritas,zIndex:5,background:"#1e3a8a"}}>PRIORITAS</th>
              <th aria-hidden="true" style={{width:lebarSpasiKiri,padding:0,border:"none",background:"#1e3a8a"}}/>
              {days.map(d=>(
                <th key={d} onClick={()=>{
                  // Mode potong: klik header tanggal = pilih hari tujuan tempel (8 Okt 2026).
                  if(cutCells.length>0){setTujuanTempel(d);return;}
                  setSelDate(d===selDate?null:d);
                }}
                  style={{...thS,width:LEBAR_TETAP_KOLOM_TANGGAL,minWidth:LEBAR_TETAP_KOLOM_TANGGAL,cursor:"pointer",background:tujuanTempel===d&&cutCells.length>0?"#15803d":d===TODAY?"#1e40af":isSunday(d)?"#7f1d1d":selDate===d?"#1d4ed8":"#1e3a8a",borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"}}>
                  <div>{getDayLabel(d)}</div>
                  {d===TODAY&&<div style={{fontSize:9,opacity:.7}}>Hari Ini</div>}
                  {deadlinePerTanggal.has(d)&&(
                    <div title={"Deadline:\n"+deadlinePerTanggal.get(d)!.join("\n")} style={{fontSize:9,fontWeight:800,color:"#fecaca"}}>🚩 {deadlinePerTanggal.get(d)!.length} deadline</div>
                  )}
                  {tujuanTempel===d&&cutCells.length>0&&<div style={{fontSize:9,fontWeight:800}}>▼ Tujuan tempel</div>}
                  {selDate===d&&<div style={{fontSize:9,color:"#93c5fd"}}>▼ Review</div>}
                </th>
              ))}
              <th aria-hidden="true" style={{width:lebarSpasiKanan,padding:0,border:"none",background:"#1e3a8a"}}/>
              <th style={{...thS,width:40,minWidth:40,position:"sticky",right:0,zIndex:5}}>✕</th>
            </tr>
          </thead>
            {(()=>{
              // Urutan baris (zona prioritas -> urutan panel -> proses): lib/rawPanelOrder.ts bandingkanBarisRaw.
              const visibleRows=rawData.filter(lolosFilterBaris).sort((a,b)=>bandingkanBarisRaw(a,b,orderMap,ALL_PROSES));
              const panelRowCount:Record<string,number>={};
              visibleRows.forEach(row=>{
                const pid=String(row.panel_id||row.panelId);
                panelRowCount[pid]=(panelRowCount[pid]||0)+1;
              });
              // Render 1 baris proses - isi TIDAK diubah (dulu callback visibleRows.map langsung);
              // sekarang dipanggil per blok panel di bawah supaya tiap panel punya <tbody> sendiri
              // (target geser urutan panel).
              const renderBaris=(row:any,ri:number)=>{
                const pc=PROSES_COLOR[row.proses]||"#64748b";
                const priColor=PRIORITAS_COLOR[row.prioritas]||"#64748b";
                const rBg=ri%2===0?"#fff":"#f8fafc";
                const prevRow=visibleRows[ri-1];
                const prevPanelId=prevRow?(prevRow.panel_id||prevRow.panelId):null;
                const curPanelId=row.panel_id||row.panelId;
                const isNewPanel=!prevRow||prevPanelId!==curPanelId;
                const panelTopBorder=isNewPanel&&ri>0?"3px solid #1e293b":"1px solid #f1f5f9";
                const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"2px 4px",verticalAlign:"middle",borderTop:panelTopBorder};
                const rowSpanCount=panelRowCount[String(curPanelId)]||1;
                const subBarisKomponen=getSemuaKomponenSebagaiSubBaris(row);

                // TAMBAHAN (12 Agu 2026) - proyeksi tampilan MURNI (gak nyentuh raw_schedule sama
                // sekali): komponen wiring yang lagi LIVE (belum jejak, belum 100%) di suatu
                // tanggal diproyeksikan tampil juga di tanggal-tanggal SETELAHNYA sepanjang sisa
                // durasi standar bobotnya (H{n+1}, H{n+2}, dst), biar planner langsung lihat
                // komitmen kapasitas ke depan tanpa nunggu komponennya beneran digeser hari demi
                // hari. Dihitung dari POSISI LIVE + hariKeN AKTUAL (reuse hariKeNFromMap yang sama
                // dipakai kalkulasi kapasitas asli) tiap render - jadi kalau posisi live-nya
                // berubah (kena geser/skip/selesai lebih cepat), proyeksi otomatis ikut geser,
                // BUKAN snapshot beku dari saat assign.
                const wiringForwardMap=jadwalLanjutanWiring(row,panelById.get(Number(row.panel_id||row.panelId)),wiringHariKerjaMap); // lib/isiSelJadwal.ts

                if(false&&subBarisKomponen&&subBarisKomponen.length>0){
                  return(
                    <Fragment key={row.id}>
                      {subBarisKomponen.map((komp:any,ki:number)=>(
                        <tr key={row.id+"-"+komp.wp+"-"+komp.kode}>
                          {isNewPanel&&ki===0&&(
                            <>
                              <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:"#fff",minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center" as const,verticalAlign:"middle"}}>{row.proyek}</td>
                              <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:9,color:"#1e293b",background:"#fff",minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3,textAlign:"center" as const,verticalAlign:"middle"}}>{row.panel}</td>
                            </>
                          )}
                          {ki===0&&(
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:KIRI_KOL.proses,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap" as const}}>{row.proses}</span>
                            </td>
                          )}
                          {ki===0&&(
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:KIRI_KOL.prioritas,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <select value={row.prioritas||"Sedang"} onChange={e=>aksiRef.current.updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                                style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                              </select>
                            </td>
                          )}
                          {days.map(d=>renderKotakWiring(komp,d,row.id,row.panel_id||row.panelId))}
                          <td style={{...td,textAlign:"center" as const,position:"sticky",right:0,zIndex:2,background:"#fff"}}>
                            
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }

                return(
                  <tr key={row.id} data-rawid={row.id}>
                    {isNewPanel&&(
                      <>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:"#fff",minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center" as const,verticalAlign:"middle"}}>{row.proyek}</td>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:80,zIndex:menuUrutanPanel===Number(curPanelId)?6:2,fontWeight:600,fontSize:9,color:"#1e293b",background:"#fff",minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3,textAlign:"center" as const,verticalAlign:"middle"}}>
                          {/* Geser urutan panel: handle ⠿ (drag) + menu ⋮ (pindah cepat dalam zona). */}
                          <div data-menu-urutan style={{display:"flex",alignItems:"center",gap:3,position:"relative"}}>
                            <PanelDragHandle panelId={Number(curPanelId)} disabled={savingUrutan}/>
                            <span style={{flex:1}}>{row.panel}</span>
                            <button onClick={()=>setMenuUrutanPanel(m=>m===Number(curPanelId)?null:Number(curPanelId))} title="Pindah urutan panel"
                              style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:12,fontWeight:800,padding:"0 2px",lineHeight:1,flexShrink:0}}>⋮</button>
                            {menuUrutanPanel===Number(curPanelId)&&(()=>{
                              const me=blokUrutRef.current.find(b=>b.panelId===Number(curPanelId));
                              const bz=me?blokUrutRef.current.filter(b=>b.zona===me.zona):[];
                              const i=bz.findIndex(b=>b.panelId===Number(curPanelId));
                              const opsi:{k:"atas"|"naik"|"turun"|"bawah";l:string;ok:boolean}[]=[
                                {k:"atas",l:"⤒ Pindah ke paling atas kelompok",ok:i>0},{k:"naik",l:"↑ Naik 1",ok:i>0},
                                {k:"turun",l:"↓ Turun 1",ok:i>=0&&i<bz.length-1},{k:"bawah",l:"⤓ Pindah ke paling bawah kelompok",ok:i>=0&&i<bz.length-1},
                              ];
                              return(
                                <div style={{position:"absolute",top:"100%",right:0,zIndex:40,background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 6px 20px #0f172a26",padding:4,minWidth:210,textAlign:"left" as const}}>
                                  <div style={{fontSize:9,color:"#94a3b8",padding:"3px 8px",fontWeight:700}}>Dalam kelompok prioritas {me?.zona}</div>
                                  {opsi.map(o=>(
                                    <button key={o.k} disabled={!o.ok||savingUrutan} onClick={()=>aksiRef.current.pindahViaMenu(Number(curPanelId),o.k)}
                                      style={{display:"block",width:"100%",textAlign:"left" as const,background:"none",border:"none",padding:"5px 8px",fontSize:11,fontWeight:600,borderRadius:5,
                                        color:o.ok?"#1e293b":"#cbd5e1",cursor:o.ok?"pointer":"not-allowed"}}>{o.l}</button>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:KIRI_KOL.deadline,zIndex:2,textAlign:"center",background:"#fff",minWidth:LEBAR_KOL.deadline,maxWidth:LEBAR_KOL.deadline,verticalAlign:"middle"}}>
                          {(()=>{
                            // DEADLINE = target WO (baca-saja, 8 Okt 2026) - lihat deadlinePanel.
                            const dl=deadlinePanel.get(Number(curPanelId));
                            if(!dl)return <span className="rs-dl rs-dl-kosong" title="WO ini belum punya target - atur di Manajemen WO" style={{fontSize:10,color:"#94a3b8"}}>+ Deadline</span>;
                            const inf=infoDeadline(dl.target);
                            return(
                              <div className="rs-dl" title={`Deadline = target WO ${dl.wo}${inf.sisa<0?" (sudah lewat)":""} - ubah lewat Manajemen WO`}
                                style={{display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",gap:1,lineHeight:1.2}}>
                                <span className="rs-dl-tgl" style={{fontSize:11,fontWeight:inf.warna.tebal?800:600,color:inf.warna.tgl,whiteSpace:"nowrap" as const}}>{inf.tgl}</span>
                                <span style={{fontSize:9.5,fontWeight:inf.warna.tebal?700:400,color:inf.warna.ket,whiteSpace:"nowrap" as const}}>{inf.label}</span>
                              </div>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td style={{...td,position:"sticky",left:KIRI_KOL.proses,zIndex:2,textAlign:"center",background:rBg}}>
                      <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{row.proses}</span>
                    </td>
                    <td style={{...td,position:"sticky",left:KIRI_KOL.prioritas,zIndex:2,textAlign:"center",background:rBg}}>
                      <select value={row.prioritas||"Sedang"} onChange={e=>aksiRef.current.updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                        style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                        {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td aria-hidden="true" style={{padding:0,border:"none"}}/>
                    {days.map(d=>{
                      const rentangInfo=getRentangInfoUntukTanggal(row,d);
                      // Kolom divirtualisasi: rentang yang mulainya di kiri kolom pertama yang
                      // dirender, dimulai dari kolom pertama itu (supaya sel baris tidak bergeser).
                      const awalRentang=!!rentangInfo&&(rentangInfo.isStart||d===days[0]);
                      if(rentangInfo&&!awalRentang)return null;
                      let colSpanCount=1;
                      if(rentangInfo&&awalRentang){
                        colSpanCount=days.filter(dd=>dd>=rentangInfo.mulai&&dd<=rentangInfo.selesai).length;
                      }
                      const entries=row.schedule?.[d]||[];
                      const projectedHariIni=wiringForwardMap[d]||[];
                      const busbarEntries:string[]=row.busbar_schedule?.[d]||[];
                      // Kode yang dari TANGGAL INI (d) udah digeser otomatis ke besok (belum
                      // sempat dikerjakan) - dipakai buat nampilin indikator "→ digeser" di sisi
                      // sumbernya juga, biar keliatan dari kedua sisi (bukan cuma di tujuan).
                      const kodeDigeserKeBesok=new Set<string>(
                        (row.schedule?.[addDays(d,1)]||[])
                          .filter((e:any)=>e.carriedOverFrom===d)
                          .flatMap((e:any)=>e.komponen||[])
                      );
                      const isOver=dragOverCell?.rawId===row.id&&dragOverCell?.date===d;
                      const isSelDate=selDate===d;
                      const isDraggableEntry=!rentangInfo;
                      const isPast=d<TODAY;
                      return(
                        <td key={d} data-tgl={d} data-isi={(entries.length>0||busbarEntries.length>0)?"1":"0"} colSpan={colSpanCount} onClick={(e:any)=>{e.stopPropagation();aksiRef.current.handleCellClick(row.id,d,e);}} style={{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rentangInfo?"#eff6ff":rBg,opacity:cutCells.some((c:any)=>c.rawId===row.id&&c.date===d)?0.45:1,outline:isOver?"2px dashed #2563eb":cutCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px dashed #64748b":copiedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px dashed #3b82f6":selectedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px solid #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}
                          onDragOver={e=>aksiRef.current.onDragOver(e,row.id,d)}
                          onDrop={e=>aksiRef.current.onDrop(e,row.id,d)}
                          onDragLeave={()=>setDragOverCell(null)}>
                          {row.proses==="BUSBAR"?(()=>{
                            // BUSBAR gak lewat `entries`/`row.schedule` sama sekali - branch sendiri,
                            // baca busbar_schedule (list aktif) + busbar_jejak (marker histori read-only).
                            if(busbarEntries.length===0){
                              return(
                                <div onContextMenu={(e:any)=>aksiRef.current.handleContextMenu(row.id,d,e)}
                                  style={{width:"100%",minHeight:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s",padding:"2px"}}
                                  onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                                  onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#e2e8f0";}}>
                                  <span>+</span>
                                </div>
                              );
                            }
                            const panelDataForBusbar=panelById.get(Number(row.panel_id||row.panelId));
                            const checklistForBusbar=panelDataForBusbar?.checklist||{};
                            const busbarJejakHariIni:Record<string,string>=row.busbar_jejak?.[d]||{};
                            // Cuma kode progress<100% & belum jejak yang ikut ke-drag - 100% (selesai)
                            // TETAP di tanggal ini, gak ikut pindah (sama rule kayak proses lain).
                            const kodeDraggable=kodeBusbarBisaDipindah(row,checklistForBusbar,d);
                            const isDraggableBusbar=kodeDraggable.length>0;
                            return(
                              <div draggable={isDraggableBusbar}
                                onDragStart={e=>{if(isDraggableBusbar)aksiRef.current.onDragStart(e,row.id,d,[{wp:"BUSBAR",komponen:kodeDraggable}]);}}
                                onDragEnd={()=>aksiRef.current.onDragEnd()}
                                onContextMenu={(e:any)=>aksiRef.current.handleContextMenu(row.id,d,e)}
                                style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center",cursor:isDraggableBusbar?"grab":"pointer",padding:"3px",borderRadius:6}}>
                                {busbarEntries.map((b:string)=>{
                                  const jejakTujuan=busbarJejakHariIni[b];
                                  // Date-aware (7 Sep 2026, konsisten sama fix Rencana Harian & chip
                                  // komponen non-BUSBAR di modal bawah) - dulu baca progress.BUSBAR mentah
                                  // (bukan snapshot per-tanggal `d`), kelas bug sama yang udah diperbaiki
                                  // di getProgressAsOfDate kemarin.
                                  const pctB=getProgressAsOfDate(checklistForBusbar[b],"BUSBAR",d);
                                  const isDoneB=pctB>=100;
                                  const statusIconB=isDoneB?"✓":pctB>0?"●":"";
                                  return(
                                    <span key={b} title={jejakTujuan?"Belum selesai - sudah digeser ke "+jejakTujuan+" (data di sini histori, gak bisa diaksi lagi)":pctB>0&&!isDoneB?`Berprogres ${pctB}%`:""}
                                      style={{display:"inline-flex",alignItems:"center",gap:2,
                                        background:isPast?"#f1f5f9":(BUSBAR_COLORS[b]||"#64748b")+"22",
                                        color:isPast?"#94a3b8":(BUSBAR_COLORS[b]||"#64748b"),
                                        border:`1px solid ${isPast?"#e2e8f0":(BUSBAR_COLORS[b]||"#64748b")+"44"}`,
                                        borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700,
                                        opacity:(isDoneB||jejakTujuan)?0.5:1}}>
                                      {statusIconB&&<span style={{fontSize:8,fontWeight:900}}>{statusIconB}</span>}
                                      {jejakTujuan&&<span style={{fontSize:8}}>➡️</span>}
                                      {b}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })():(entries.length>0||projectedHariIni.length>0)?(
                            PROSES_ORANG_RAW.includes(row.proses)?(
                              <div onClick={(e:any)=>{e.stopPropagation();aksiRef.current.handleCellClick(row.id,d,e);}}
                                onContextMenu={(e:any)=>aksiRef.current.handleContextMenu(row.id,d,e)}
                                draggable={entries.length>0} onDragStart={e=>{if(entries.length>0)aksiRef.current.onDragStart(e,row.id,d,aksiRef.current.getEntriesTanpaSelesai(row,entries));}} onDragEnd={()=>aksiRef.current.onDragEnd()}
                                style={{display:"flex",flexDirection:"column" as const,gap:3,padding:"4px 6px",borderRadius:6,cursor:entries.length>0?"grab":"default"}}>
                                {entries.map((entry:any)=>(entry.komponen||[]).map((kode:string)=>{
                                    if(kode.startsWith("__wiring_"))return null;
                                  const panelIdKomp=row.panel_id||row.panelId;
                                  // REVISI TOTAL (12 Agu 2026): kebutuhan orang dinamis per komponen -
                                  // lihat panelHelpers.ts WIRING_BOBOT_TABLE.
                                  const bobotKode=row.bobot_komponen?.[kode];
                                  const hariKeNKode=hariKeNFromMap(wiringHariKerjaMap,panelIdKomp,kode,row.proses,d);
                                  const jmlOrang=kebutuhanOrangWiring(bobotKode,hariKeNKode);
                                  const wc=WP_COLOR[entry.wp]||"#64748b";
                                  const panelDataForTelat=panelById.get(Number(panelIdKomp));
                                  const progressUntukTelat=panelDataForTelat?.checklist?.[kode]?.progress?.[row.proses]||0;
                                  const sudahSelesaiKomp=progressUntukTelat>=100;
                                  const isTelat=d<TODAY&&progressUntukTelat<100;
                                  // digeserKe: field dipakai BERSAMA oleh auto-geser server-side (selalu
                                  // maju, kapasitas penuh) DAN Pindah Jadwal manual di sini (bisa ke
                                  // tanggal manapun termasuk mundur - planner koreksi jadwal) - field ini
                                  // TIDAK menyimpan siapa/apa penyebabnya, cuma "kode ini udah dipindah
                                  // aksinya ke tanggal tsb". Jangan asumsikan selalu otomatis/maju.
                                  // Fallback ke heuristik lama (peek jadwal besok) buat entry lama yang
                                  // dibuat sebelum marker ini ada.
                                  const digeserKeTgl=entry.digeserKe?.[kode]||(kodeDigeserKeBesok.has(kode)?addDays(d,1):null);
                                  const titleInfo=(entry.carriedOverFrom?"Lanjutan dari "+entry.carriedOverFrom+" (belum sempat dikerjakan)":digeserKeTgl?"Belum selesai - sudah digeser ke "+digeserKeTgl+" (data di sini histori, gak bisa diaksi lagi)":isTelat?"Belum selesai, tanggal udah lewat":"")
                                    +` · Bobot ${WIRING_BOBOT_LABEL[bobotKode||"MEDIUM"]}, hari kerja ke-${hariKeNKode}, butuh ${jmlOrang} orang`;
                                  return(
                                    <div key={entry.wp+kode} title={titleInfo} style={{display:"inline-flex",alignItems:"center",gap:3,background:isPast?"#f1f5f9":isTelat?"#fef2f2":wc+"22",color:isPast?"#94a3b8":isTelat?"#dc2626":wc,border:`1px solid ${isPast?"#e2e8f0":isTelat?"#fca5a5":wc+"44"}`,borderRadius:4,padding:"1px 5px",maxWidth:"100%",opacity:(sudahSelesaiKomp||digeserKeTgl)?0.5:1}}>
                                      {sudahSelesaiKomp&&<span style={{fontSize:9,fontWeight:900}}>✓</span>}
                                      {entry.carriedOverFrom&&<span style={{fontSize:9}}>🔁</span>}
                                      {digeserKeTgl&&<span style={{fontSize:9}}>➡️</span>}
                                      {isTelat&&<span style={{fontSize:9,fontWeight:900}}>⚠️</span>}
                                      <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{getNamaKomponenDariKode(panelIdKomp,kode)}{entry.qtyPerKomponen?.[kode]!==undefined?` (${entry.qtyPerKomponen[kode]})`:""}</span>
                                      <span style={{fontSize:7,fontWeight:700,color:"#94a3b8"}}>H{hariKeNKode}</span>
                                      <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{jmlOrang}</span>
                                </div>
                                  );
                                }))}
                                {projectedHariIni.map((p)=>(
                                  <div key={"proj-"+p.wp+p.kode} title={`Proyeksi (belum posisi live sebenarnya) - hari kerja ke-${p.hariKeN}, bobot ${WIRING_BOBOT_LABEL[row.bobot_komponen?.[p.kode]||"MEDIUM"]}, butuh ${p.orang} orang. Posisi aktual masih di tanggal sebelumnya sampai beneran dikerjakan/digeser ke sini.`}
                                    style={{display:"inline-flex",alignItems:"center",gap:3,background:isPast?"#f1f5f9":"#fff",color:isPast?"#94a3b8":(WP_COLOR[p.wp]||"#64748b"),border:`1px dashed ${isPast?"#e2e8f0":(WP_COLOR[p.wp]||"#64748b")+"66"}`,borderRadius:4,padding:"1px 5px",maxWidth:"100%",opacity:0.6}}>
                                    <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{getNamaKomponenDariKode(row.panel_id||row.panelId,p.kode)}</span>
                                    <span style={{fontSize:7,fontWeight:700,color:"#94a3b8"}}>H{p.hariKeN}</span>
                                    <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{p.orang}</span>
                                  </div>
                                ))}
                              </div>
                            ):(
                            <div draggable={isDraggableEntry} onDragStart={e=>{if(isDraggableEntry)aksiRef.current.onDragStart(e,row.id,d,aksiRef.current.getEntriesTanpaSelesai(row,entries));}} onDragEnd={()=>aksiRef.current.onDragEnd()}
                               onContextMenu={(e:any)=>aksiRef.current.handleContextMenu(row.id,d,e)}
                              style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",cursor:isDraggableEntry?"grab":"pointer",padding:"3px",borderRadius:6,border:isSelDate?"1px solid #bfdbfe":"1px solid transparent"}}>
                              {entries.map(e=>{
                                const status=getTaskStatus(row,d,e.wp,e.komponen);
                                // Warna badge SELALU ikut warna proses (gak berubah karena status) - status
                                // ditandai ikon terpisah aja (✓ selesai, ● berprogres, kosong kalau belum).
                                const statusIcon=status==="finish"?"✓":status==="on_progress"?"●":"";
                                return(<div key={e.wp} style={{background:isPast?"#94a3b8":(PROSES_COLOR[row.proses]||"#64748b"),color:"#fff",borderRadius:3,padding:"1px 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:2}}>{statusIcon&&<span style={{fontSize:9}}>{statusIcon}</span>}{e.wp}<span style={{fontSize:9,opacity:.8,marginLeft:2}}>({e.komponen.length})</span></div>);
                              })}
                            </div>
                            )
                          ):(
                            <div onContextMenu={(e:any)=>aksiRef.current.handleContextMenu(row.id,d,e)}
                              style={{width:"100%",minHeight:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s",padding:"2px"}}
                              onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                              onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#e2e8f0";}}>
                              <span>+</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td aria-hidden="true" style={{padding:0,border:"none"}}/>
                    <td style={{...td,textAlign:"center",position:"sticky",right:0,zIndex:2}}>
                      
                    </td>
                  </tr>
                );
              };

              // Semua yang dibaca renderBaris & bisa berubah (dicek 4 Okt 2026): row, posisinya (warna
              // selang-seling, awal blok panel, rowSpan), panel milik baris ini (checklist/tipe), days,
              // selDate, livePanelTypes (nama komponen), wiringHariKerjaMap, savingUrutan, menu urutan,
              // sel yang di-drag-over/dipilih/disalin DI BARIS INI. Fungsi lain di baris murni dari ini.
              const kunciSel=(cells:any[],rawId:any)=>cells.filter((c:any)=>c.rawId===rawId).map((c:any)=>c.date).join(",");
              const depsBaris=(row:any,ri:number)=>{
                const pid=row.panel_id||row.panelId;
                const prevRow=visibleRows[ri-1];
                const isNewPanel=!prevRow||(prevRow.panel_id||prevRow.panelId)!==pid;
                const menuTerbuka=menuUrutanPanel===Number(pid);
                return[row,ri%2,isNewPanel,isNewPanel&&ri>0,panelRowCount[String(pid)]||1,panelById.get(Number(pid)),deadlinePanel.get(Number(pid))?.target||"",
                  days,selDate,livePanelTypes,wiringHariKerjaMap,savingUrutan,
                  menuTerbuka?{}:false, // menu terbuka membaca blokUrutRef -> selalu render ulang
                  dragOverCell?.rawId===row.id?dragOverCell.date:null,
                  kunciSel(selectedCells,row.id),kunciSel(copiedCells,row.id),kunciSel(cutCells,row.id)];
              };

              // Kelompokkan jadi blok panel (baris 1 panel selalu berurutan krn sort di atas), lalu
              // render per zona: 1 baris pembatas zona (SELALU ada, termasuk zona kosong/tersembunyi
              // filter - tetap bisa jadi target drop) + 1 <tbody> per panel.
              const blokList:{panelId:number;zona:Zona;items:{row:any;ri:number}[]}[]=[];
              visibleRows.forEach((row,ri)=>{
                const pid=Number(row.panel_id||row.panelId);
                const last=blokList[blokList.length-1];
                if(last&&last.panelId===pid)last.items.push({row,ri});
                else blokList.push({panelId:pid,zona:zonaDari(row.prioritas),items:[{row,ri}]});
              });
              blokUrutRef.current=blokList.map(b=>({panelId:b.panelId,zona:b.zona}));
              const colSpanPenuh=8+days.length; // 5 sticky kiri (+DEADLINE) + spacer kiri + tanggal + spacer kanan + ✕
              const ZONA_LABEL:Record<Zona,string>={Tinggi:"▲ TINGGI",Sedang:"● SEDANG",Rendah:"▼ RENDAH"};
              // Model posisi (paket 5, lihat VIRTUALISASI GRID): koordinat konten container, urut tampilan.
              void versiUkur; // dihitung ulang tiap ukuran blok berubah
              let totalUkur=0,barisUkur=0;
              // Kunci cache tinggi = baris yang tampil di blok itu: tinggi blok berubah kalau filter
              // proses/proyek mengubah isi blok - jangan pakai ulang tinggi dari kondisi filter lain
              // (dulu: lepas filter -> tinggi total grid jadi separuh). SENGAJA tanpa tanggal kolom
              // (scroll bebas, 4 Okt 2026): kalau ikut tanggal, tiap geser horizontal semua blok di
              // luar layar balik ke tinggi rata-rata -> tinggi grid melompat & posisi vertikal loncat
              // ke panel lain. Tinggi terukur terakhir blok itu = perkiraan terbaik, dikoreksi begitu
              // blok dirender lagi.
              const kunciUkur=(b:{panelId:number;items:{row:any}[]})=>"panel|"+b.items.map(it=>it.row.id).join(",");
              blokList.forEach(b=>{const h=tinggiRef.current.get(kunciUkur(b));if(h!==undefined){totalUkur+=h;barisUkur+=b.items.length;}});
              const tinggiPerBaris=barisUkur>0?totalUkur/barisUkur:40;
              const posisi=new Map<string,{top:number;bottom:number}>();
              let yModel=tinggiRef.current.get("thead")??0;
              ZONA_URUTAN.forEach(z=>{
                const kp="zona-"+z;const hp=tinggiRef.current.get(kp)??28;
                posisi.set(kp,{top:yModel,bottom:yModel+hp});yModel+=hp;
                blokList.forEach(b=>{
                  if(b.zona!==z)return;
                  const k="panel-"+b.panelId;const h=tinggiRef.current.get(kunciUkur(b))??b.items.length*tinggiPerBaris;
                  posisi.set(k,{top:yModel,bottom:yModel+h});yModel+=h;
                });
              });
              posisiRef.current=posisi;
              const dirender=(b:{panelId:number;items:{row:any}[]})=>{
                if(b.panelId===dragPanelId||b.panelId===menuUrutanPanel)return true;
                // Panel asal drag WP (HTML5) wajib tetap ada di DOM sampai drag selesai - kalau ter-unmount
                // di tengah drag, onDragEnd tidak pernah terpanggil & dragInfo basi (lihat komentar onDragEnd).
                const di:any=dragInfo;
                if(di&&b.items.some(it=>it.row.id===di.rawId))return true;
                const p=posisi.get("panel-"+b.panelId);
                return !p||(p.bottom>=jendela.atas&&p.top<=jendela.bawah);
              };
              return ZONA_URUTAN.map(z=>{
                const bz=blokList.filter(b=>b.zona===z);
                const warna=(PRIORITAS_COLOR as any)[z]||"#64748b";
                return(
                  <Fragment key={"zona-"+z}>
                    <tbody ref={el=>{pembatasRefs.current[z]=el;daftarUkur("zona-"+z,el);}}>
                      <tr>
                        <SelPembatasZona store={dropStore.current!} zona={z} dragAktif={dragPanelId!=null} colSpan={colSpanPenuh}>
                          <div style={{position:"sticky",left:0,display:"inline-flex",alignItems:"center",gap:8,padding:"5px 12px",fontSize:10,fontWeight:800,letterSpacing:.4,color:warna}}>
                            <span>{ZONA_LABEL[z]}</span>
                            <span style={{color:"#94a3b8",fontWeight:600}}>· {bz.length} panel{bz.length===0&&dragPanelId!=null?" (seret panel ke sini)":""}</span>
                          </div>
                        </SelPembatasZona>
                      </tr>
                    </tbody>
                    {(()=>{
                      // Blok berurutan yang tidak dirender digabung jadi 1 spacer setinggi total model-nya.
                      const potongan:ReactNode[]=[];
                      let spasi=0,kunciSpasi="";
                      const tutupSpasi=()=>{
                        if(spasi<=0)return;
                        potongan.push(<tbody key={"spasi-"+kunciSpasi} aria-hidden="true" data-spasi-virtual=""><tr><td colSpan={colSpanPenuh} style={{height:spasi,padding:0,border:"none"}}/></tr></tbody>);
                        spasi=0;
                      };
                      bz.forEach(b=>{
                        if(dirender(b)){
                          tutupSpasi();
                          potongan.push(
                            <tbody key={"panel-"+b.panelId} ref={el=>{blokRefs.current[b.panelId]=el;daftarUkur(kunciUkur(b),el);}}
                              style={{opacity:dragPanelId===b.panelId?0.35:1}}>
                              {b.items.map(({row,ri})=><BarisRawMemo key={row.id} render={()=>renderBaris(row,ri)} deps={depsBaris(row,ri)}/>)}
                            </tbody>
                          );
                        }else{
                          const p=posisi.get("panel-"+b.panelId)!;
                          if(spasi===0)kunciSpasi=String(b.panelId);
                          spasi+=p.bottom-p.top;
                        }
                      });
                      tutupSpasi();
                      return potongan;
                    })()}
                  </Fragment>
                );
              });
            })()}
        </table>
        {dragPanelId!=null&&<GarisDrop store={dropStore.current!}/>}
      </div>
      <DragOverlay dropAnimation={null} style={{pointerEvents:"none"}}>
        {dragPanelId!=null&&(()=>{
          const r0=rowsPanelOf(dragPanelId)[0];
          const zonaAsal=zonaDari(r0?.prioritas);
          return(
            <div style={{background:"#fff",border:"1.5px solid #2563eb",borderRadius:10,boxShadow:"0 8px 24px #0f172a33",padding:"8px 12px",fontSize:11,minWidth:220,cursor:"grabbing"}}>
              <div style={{fontWeight:800,color:"#1e293b"}}>⠿ <span style={{fontWeight:600,color:"#64748b"}}>{r0?.proyek} ·</span> {r0?.panel} <span style={{fontWeight:600,color:"#64748b"}}>· {rowsPanelOf(dragPanelId).length} proses</span></div>
              <InfoLintasZona store={dropStore.current!} zonaAsal={zonaAsal}/>
            </div>
          );
        })()}
      </DragOverlay>
      </DndContext>
      {(cutCells.length>0||(selectedCells.length>=2&&copiedCells.length===0))&&!cellModal&&(
        // Penanda multi-pilih / potong (8 Okt 2026). Sel terpilih tetap ditandai outline biru (lama),
        // sel terpotong redup + garis putus abu-abu.
        <div style={{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",zIndex:9500,background:cutCells.length>0?"#334155":"#2563eb",color:"#fff",
          borderRadius:99,padding:"6px 8px 6px 14px",fontSize:12,fontWeight:700,boxShadow:"0 6px 20px #0003",display:"flex",gap:8,alignItems:"center"}}>
          {cutCells.length>0
            ?<>{cutCells.length} sel dipotong · {tujuanTempel?<>tujuan <b>{getDayLabel(tujuanTempel)}</b></>:"klik hari tujuan"}
              <button onClick={()=>aksiMultiRef.current.tempelPotongan()} disabled={!tujuanTempel}
                style={{background:tujuanTempel?"#16a34a":"rgba(255,255,255,.15)",color:"#fff",border:"none",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:800,cursor:tujuanTempel?"pointer":"default"}}>Tempel (Ctrl+V)</button></>
            :<>{selectedCells.length} sel dipilih
              <button onClick={()=>aksiMultiRef.current.potong()}
                style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Potong (Ctrl+X)</button></>}
          <button onClick={()=>{setSelectedCells([]);setLastSelected(null);setCutCells([]);setTujuanTempel(null);}}
            style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:99,padding:"3px 10px",fontSize:11,fontWeight:700,cursor:"pointer"}}>Batal (Esc)</button>
        </div>
      )}
      {toastAksi&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:10000,background:toastAksi.jenis==="err"?"#dc2626":"#14532d",color:"#fff",
          borderRadius:10,padding:"10px 16px",fontSize:12.5,fontWeight:700,boxShadow:"0 6px 20px #0004",display:"flex",gap:14,alignItems:"center",maxWidth:"min(92vw,620px)"}}>
          <span>{toastAksi.pesan}</span>
          {(toastAksi.aksi||[]).map(a=>(
            <button key={a.label} onClick={()=>{setToastAksi(null);a.fn();}}
              style={{background:"rgba(255,255,255,.18)",color:"#fff",border:"1px solid rgba(255,255,255,.4)",borderRadius:7,padding:"4px 10px",fontSize:12,fontWeight:800,cursor:"pointer",flexShrink:0}}>{a.label}</button>
          ))}
          <button onClick={()=>setToastAksi(null)} aria-label="Tutup" style={{background:"none",border:"none",color:"#fff",opacity:.7,cursor:"pointer",fontSize:14,flexShrink:0}}>✕</button>
        </div>
      )}
      {toastUrutan&&(
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:10000,background:"#fffbeb",border:"1.5px solid #f59e0b",color:"#92400e",
          borderRadius:10,padding:"10px 16px",fontSize:12,fontWeight:700,boxShadow:"0 6px 20px #0003"}}>
          ⚠ {toastUrutan}
        </div>
      )}

      {selDate&&(
        <Card style={{marginTop:16,border:"1.5px solid #bfdbfe",background:"#f0f8ff"}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1d4ed8"}}>📋 {fmtDateFull(selDate)}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{dateTasks.length} pekerjaan · Distribusi dilakukan di tab Rencana Harian</div>
            </div>
            <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>✕</button>
          </div>
          {(()=>{
            const panelGroupMap:Record<string,any[]>={};
            dateTasks.forEach(t=>{
              const gk=`${t.proyek}__${t.panel}__${t.panelId}`;
              if(!panelGroupMap[gk])panelGroupMap[gk]=[];
              panelGroupMap[gk].push(t);
            });
            return Object.entries(panelGroupMap).map(([gk,tasks],gi)=>{
              const t0=tasks[0];
              const cardKey=`panelcard__${gk}__${selDate}`;
              const isExpanded=expandedTasks[cardKey];
              const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t0.panelId);
              const cfg2=panelData?getEffCfg(panelData.tipe):null;
              const allSt=tasks.map(t=>getTaskStatus(t,t.tanggal,t.wp,t.komponen));
              const overallSt=allSt.every(s=>s==="finish")?"finish":allSt.some(s=>s==="on_progress"||s==="finish")?"on_progress":"belum_mulai";
              const stColor=overallSt==="finish"?"#16a34a":overallSt==="on_progress"?"#f59e0b":"#64748b";
              const stLabel=overallSt==="finish"?"✓ Finish":overallSt==="on_progress"?"● On Progress":"○ Belum Mulai";
              return(
                <div key={gi} onClick={()=>setExpandedTasks(prev=>({...prev,[cardKey]:!prev[cardKey]}))} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1.5px solid ${stColor}40`,cursor:"pointer",userSelect:"none" as "none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:160}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t0.proyek}</div>
                      <div style={{fontSize:11,color:"#64748b"}}>{t0.panel}</div>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tDot=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#94a3b8";
                        return(
                          <span key={ti} style={{display:"inline-flex",gap:3,alignItems:"center",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"2px 7px"}}>
                            <span style={{width:6,height:6,borderRadius:"50%",background:tDot,flexShrink:0}}/>
                            <Badge label={t.proses} color={pc}/>
                            <span style={{background:wc,color:"#fff",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700}}>{t.wp}</span>
                          </span>
                        );
                      })}
                      <Badge label={t0.prioritas||"Sedang"} color={PRIORITAS_COLOR[t0.prioritas]||"#64748b"}/>
                      <span style={{fontSize:11,fontWeight:700,color:stColor,whiteSpace:"nowrap"}}>{stLabel}</span>
                    </div>
                    <span style={{color:"#94a3b8",fontSize:14,flexShrink:0,marginLeft:4}}>{isExpanded?"▲":"▼"}</span>
                  </div>
                  {isExpanded&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                      {tasks.map((t,ti)=>{
                        const pc=PROSES_COLOR[t.proses]||"#475569";
                        const wc=WP_COLOR[t.wp]||"#64748b";
                        const tSt=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
                        const tColor=tSt==="finish"?"#16a34a":tSt==="on_progress"?"#f59e0b":"#64748b";
                        const tLabel=tSt==="finish"?"✓ Finish":tSt==="on_progress"?"● On Progress":"○ Belum Mulai";
                        const grp:{finish:any[],on_progress:any[],belum_mulai:any[]}={finish:[],on_progress:[],belum_mulai:[]};
                        t.komponen.forEach(k=>{
                          const s=getKomponenStatus(t.panelId,t.proses,k);
                          const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
                          grp[s as keyof typeof grp].push({kode:k,nama:item?.nama||k});
                        });
                        const stGroups=[
                          {key:"finish",label:"✓ Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
                          {key:"on_progress",label:"● On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
                          {key:"belum_mulai",label:"○ Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
                        ];
                        return(
                          <div key={ti} style={{background:"#f8fafc",borderRadius:8,padding:"8px 12px",border:`1px solid ${tColor}30`}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                              <Badge label={t.proses} color={pc}/>
                              <span style={{background:wc,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                              <span style={{fontSize:11,fontWeight:700,color:tColor}}>{tLabel}</span>
                            </div>
                            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}}>
                              {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#e2e8f0",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:4}}>
                              {stGroups.filter(g=>grp[g.key as keyof typeof grp].length>0).map(g=>(
                                <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:6,padding:"6px 10px"}}>
                                  <div style={{fontWeight:800,fontSize:10,color:g.color,marginBottom:4,letterSpacing:.3}}>{g.label} ({grp[g.key as keyof typeof grp].length})</div>
                                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                    {grp[g.key as keyof typeof grp].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:5,padding:"2px 8px",fontSize:10,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </Card>
      )}

      {moveKomponenState&&(
        <div style={{position:"fixed" as const,top:16,left:"50%",transform:"translateX(-50%)",zIndex:10000,background:"#1e293b",color:"#fff",borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:"0 8px 24px rgba(0,0,0,0.25)"}}>
          <span style={{fontSize:12}}>🔀 Klik tanggal TUJUAN buat pindahin komponen ini (di baris yang sama)</span>
          <button onClick={()=>setMoveKomponenState(null)} style={{background:"#334155",border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
        </div>
      )}
      {riwayatQty.elemen}
      {modalJadwal.elemen}

      {aturKapasitas.elemen}

      {assignModal&&(()=>{
        const{task,divisi,existing}=assignModal;const dc=DIVISI_CONFIG[divisi];
        const pekerjaDivisi=pekerja.filter(p=>p.divisi===divisi);
        return(
          <Modal title={`${assignModal.isExisting?"Edit":"Distribusi"} Pekerja — ${task.proses}`} onClose={()=>{setAssignModal(null);setSelPekerja([]);}} width={460}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{task.proyek} · {task.panel}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              <Badge label={task.proses} color={PROSES_COLOR[task.proses]||"#64748b"}/>
              <Badge label={`${task.wp}`} color={WP_COLOR[task.wp]||"#64748b"}/>
              <Badge label={dc.label} color={dc.color}/>
            </div>
            <Lbl>Pilih Pekerja ({dc.label})</Lbl>
            {pekerjaDivisi.length===0?(
              <div style={{padding:"16px",background:"#f8fafc",borderRadius:8,fontSize:12,color:"#94a3b8",textAlign:"center"}}>Belum ada pekerja di divisi {dc.label}.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaDivisi.map(p=>{
                  const isSel=selPekerja.includes(p.id);
                  return(
                    <div key={p.id} onClick={()=>setSelPekerja(prev=>isSel?prev.filter(id=>id!==p.id):[...prev,p.id])}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${isSel?dc.color:"#e2e8f0"}`,background:isSel?dc.bg:"#f8fafc",transition:"all .15s"}}>
                      <div style={{width:28,height:28,borderRadius:8,background:isSel?dc.color:dc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{isSel?"✓":dc.icon}</div>
                      <span style={{fontWeight:isSel?700:500,fontSize:13,color:isSel?dc.color:"#475569"}}>{p.nama}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {selPekerja.length>0&&(
              <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
                ✓ {selPekerja.length} pekerja dipilih: {selPekerja.map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>{setAssignModal(null);setSelPekerja([]);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmDistribute}>{assignModal.isExisting?"Simpan Perubahan":"Distribusi"}</Btn>
            </div>
          </Modal>
        );
      })()}

      {dragMode&&(
        <Modal title={dragMode.multi?`Pindah ${dragMode.cells.length} sel atau Copy?`:"Pindah atau Copy?"} onClose={()=>setDragMode(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:16}}>{dragMode.multi
            ?<>Semua sel terpilih digeser <strong>{dragMode.offset>0?"+":""}{dragMode.offset} hari</strong> (jarak antar-sel tetap, baris tidak berubah).</>
            :<>Dari <strong>{getDayLabel(dragMode.fromDate)}</strong> ke <strong>{getDayLabel(dragMode.toDate)}</strong></>}</div>
          <div style={{display:"flex",gap:10}}>
            <Btn color="#dc2626" style={{flex:1}} onClick={()=>confirmDrag("move")}>📦 Pindah</Btn>
            <Btn color="#2563eb" style={{flex:1}} onClick={()=>confirmDrag("copy")}>📋 Copy</Btn>
          </div>
        </Modal>
      )}

      {tambahPanelRaw.elemen}
    {/* Context Menu */}
    {ctxMenu&&(
      <>
        <div style={{position:"fixed",inset:0,zIndex:9998}} onClick={()=>setCtxMenu(null)}/>
        <div style={{position:"fixed",left:ctxMenu.x,top:ctxMenu.y,zIndex:9999,
          background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,
          boxShadow:"0 4px 16px #00000020",padding:"4px 0",minWidth:180}}>
          {selectedCells.length>0&&copiedCells.length===0&&(
            <button onClick={()=>{copySelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📋 Copy ({selectedCells.length} cell dipilih)
            </button>
          )}
          {copiedCells.length>0&&(
            <button onClick={()=>{pasteToCell(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#1d4ed8",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#eff6ff"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              📌 Paste di sini ({copiedCells.length} cell)
            </button>
          )}
          {selectedCells.length===0&&copiedCells.length===0&&(
            <button onClick={()=>{openCellModal(ctxMenu.rawId,ctxMenu.date);setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"var(--text-primary,#1e293b)",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              ✏️ Edit Jadwal
            </button>
          )}
          {selectedCells.length>0&&(
            <button onClick={()=>{deleteSelected();setCtxMenu(null);}}
              style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
                border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#dc2626",textAlign:"left" as const}}
              onMouseEnter={(e:any)=>e.currentTarget.style.background="#fef2f2"}
              onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
              🗑 Hapus ({selectedCells.length} cell)
            </button>
          )}
          <div style={{borderTop:"1px solid var(--border-light,#f1f5f9)",margin:"4px 0"}}/>
          <button onClick={()=>{setSelectedCells([]);setCopiedCells([]);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 14px",
              border:"none",background:"none",cursor:"pointer",fontSize:12,color:"#94a3b8",textAlign:"left" as const}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="var(--bg-secondary,#f8fafc)"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            ✕ Tutup
          </button>
        </div>
      </>
    )}
    </div>
  );
}


