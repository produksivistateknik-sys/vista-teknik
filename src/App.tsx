import { useState, useMemo, useEffect, useRef, Fragment, lazy, Suspense } from 'react';
import QRCode from 'qrcode';
import { usePekerja } from './hooks/usePekerja'
import { useRenhar } from './hooks/useRenhar'
import { useKendala } from './hooks/useKendala'
import { supabase } from './lib/supabase'
import { useWorkOrders } from './hooks/useWorkOrders'
import { workOrderService } from './services/workOrderService'
import { useRawSchedule } from './hooks/useRawSchedule'
import { useActivityLog } from './hooks/useActivityLog'
import { activityLogService } from './services/activityLogService'

import {
  PANEL_TYPES, ALL_PROSES, WP_LIST, PCT_STEPS, PCT_MANUAL, PRIORITAS,
  PROSES_COLOR, WP_COLOR, PRIORITAS_COLOR,
  DIVISI_PROSES, DIVISI_PROSES_MAP, QTY_DIVISI,
  KOMPONEN_PROSES_MAP, BUSBAR_KOMPONEN, BUSBAR_COLORS,
  DIVISI_CONFIG, OPERATOR_ROLES, PROSES_ORANG_RAW_GLOBAL,
  WO_SEED, RAW_SEED, RENHAR_SEED,
} from './constants/panelTypes'
import {
  getBusbarKomponen, isKomponenRelevant, getRelevantProsesForKode, getEffCfgGlobal,
  initChecklist, naturalKodeSortGlobal, buildPanelTypesFromBom,
  getProgressOnDate, getLatestProgress, getProgressFromHistory, getBestProgress, getProgressAsOfDate,
  calcPanelProgress, panelOverall, woOverall, wpProgress,
} from './lib/panelHelpers'
import {
  getLocalDateStr, TODAY, daysUntil, isDelayed, isUrgent, getStatus,
  pColor, pBg, addDays, fmtDate, fmtShort, getDayLabel, fmtDateFull, getHariKerjaSekarang,
} from './lib/dateHelpers'
import {
  GLOBAL_DIRTY_PANEL_IDS, GLOBAL_DIRTY_RENHAR_IDS, GLOBAL_DIRTY_RAW_IDS,
  setGlobalProsesRelevan, setGlobalLivePanelTypes, setGlobalDirtyPanelIds, uid,
  markRenharDirty, markRawDirty,
} from './lib/globalState'
import { GCss } from './styles/globalCss'
import { Badge, PBar, Card, Lbl, Inp, Sel, Btn, STitle, Modal } from './components/ui/Primitives'
import { LandingPage } from './components/LandingPage'
import { Login } from './components/Login'
import { GlobalSearch } from './components/GlobalSearch'

const LaporanQCView = lazy(() => import('./components/LaporanQCView').then(m => ({ default: m.LaporanQCView })))
const TrackingPekerja = lazy(() => import('./components/TrackingPekerja').then(m => ({ default: m.TrackingPekerja })))
const RencanaHarian = lazy(() => import('./components/RencanaHarian').then(m => ({ default: m.RencanaHarian })))
const ActivityLogView = lazy(() => import('./components/ActivityLogView').then(m => ({ default: m.ActivityLogView })))
const KendalaInbox = lazy(() => import('./components/KendalaInbox').then(m => ({ default: m.KendalaInbox })))
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })))
const TaskMonitoring = lazy(() => import('./components/TaskMonitoring').then(m => ({ default: m.TaskMonitoring })))
const SummaryProgress = lazy(() => import('./components/SummaryProgress').then(m => ({ default: m.SummaryProgress })))
const DetailProgress = lazy(() => import('./components/DetailProgress').then(m => ({ default: m.DetailProgress })))
const RawSchedule = lazy(() => import('./components/RawSchedule').then(m => ({ default: m.RawSchedule })))
const ManajemenWO = lazy(() => import('./components/ManajemenWO').then(m => ({ default: m.ManajemenWO })))
const MaintenancePageTab = lazy(() => import('./components/MaintenancePageTab').then(m => ({ default: m.MaintenancePageTab })))
const StokMonitoringTab = lazy(() => import('./components/StokMonitoringTab').then(m => ({ default: m.StokMonitoringTab })))
const ArsipTab = lazy(() => import('./components/ArsipTab').then(m => ({ default: m.ArsipTab })))
const TrackingKomponenAdmin = lazy(() => import('./components/TrackingKomponenAdmin').then(m => ({ default: m.TrackingKomponenAdmin })))
const SystemTab = lazy(() => import('./components/SystemTab').then(m => ({ default: m.SystemTab })))

const TabFallback = <div style={{textAlign:"center" as const,padding:60,color:"#94a3b8",fontSize:13}}>Memuat...</div>;

export default function App(){
  const [page,setPage]=useState("landing");
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState(()=>localStorage.getItem("vista_teknik_active_tab")||"dashboard");
  const MAX_MOUNTED_TABS=4;
  const [visitedTabs,setVisitedTabs]=useState<string[]>(()=>[localStorage.getItem("vista_teknik_active_tab")||"dashboard"]);
  useEffect(()=>{
    localStorage.setItem("vista_teknik_active_tab",tab);
    setVisitedTabs(prev=>{
      const without=prev.filter(t=>t!==tab);
      const next=[...without,tab];
      return next.length>MAX_MOUNTED_TABS?next.slice(next.length-MAX_MOUNTED_TABS):next;
    });
  },[tab]);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [showNotif,setShowNotif]=useState(false);
  const [notifQcGagal,setNotifQcGagal]=useState<any[]>([]);

  useEffect(()=>{
    const fetchQcGagal=()=>{
      supabase.from("fcs_notifikasi").select("*").eq("tipe","qc_gagal").eq("dibaca",false)
        .order("created_at",{ascending:false}).then(({data})=>{setNotifQcGagal(data??[]);});
    };
    fetchQcGagal();
    const ch=supabase.channel("realtime-qc-gagal-global")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_notifikasi"},fetchQcGagal)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const tandaiQcGagalDibaca=async(id:number)=>{
    await supabase.from("fcs_notifikasi").update({dibaca:true}).eq("id",id);
    setNotifQcGagal(prev=>prev.filter((n:any)=>n.id!==id));
  };
  const [showSearch,setShowSearch]=useState(false);
  const [searchQuery,setSearchQuery]=useState("");
  const [darkMode,setDarkMode]=useState(()=>{
    return localStorage.getItem("vista_dark_mode")==="true";
  });
  const [ctxMenu,setCtxMenu]=useState<{x:number;y:number}|null>(null);
  const [showShortcutModal,setShowShortcutModal]=useState(false);
  const [showAboutModal,setShowAboutModal]=useState(false);
  useEffect(()=>{
    const handleContextMenu=(e:MouseEvent)=>{
      e.preventDefault();
      setCtxMenu({x:e.clientX,y:e.clientY});
    };
    const handleClick=()=>setCtxMenu(null);
    document.addEventListener("contextmenu",handleContextMenu);
    document.addEventListener("click",handleClick);
    return()=>{
      document.removeEventListener("contextmenu",handleContextMenu);
      document.removeEventListener("click",handleClick);
    };
  },[]);
  // Restore admin session
  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");
    if(saved){
      try{
        const parsed=JSON.parse(saved);
        setUser({...parsed,name:parsed.name||parsed.nama});
        setPage("app");
      }catch(e){ console.error('Session restore error:',e); }
    }
  },[]);
const [woData, setWoData] = useState<any[]>([]);
const [rawData, setRawData] = useState<any[]>([]);
const [renhar, setRenhar] = useState<any[]>([]);
const [pekerja, setPekerja] = useState<any[]>([]);
  const { data: kendalaLog, create: createKendala, remove: removeKendala, refetch: refetchKendala } = useKendala()
  const [maintenanceOverdueCount, setMaintenanceOverdueCount] = useState(0)
  useEffect(() => {
    const fetchMaintAlert = async () => {
      const h3 = new Date(); h3.setDate(h3.getDate() + 3)
      const { data } = await supabase.from('maintenance_rutin').select('id,jatuh_tempo').eq('is_active', true).lte('jatuh_tempo', getLocalDateStr(h3))
      setMaintenanceOverdueCount(data?.length || 0)
    }
    fetchMaintAlert()
    const ch = supabase.channel('realtime-maint-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_rutin' }, fetchMaintAlert)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  const { data: activityLog, refetch: refetchActivityLog } = useActivityLog()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refetchWO?.(),
        refetchRaw?.(),
        refetchRenhar?.(),
        refetchKendala?.(),
        refetchPekerja?.(),
        refetchActivityLog?.(),
      ])
    } finally {
      setTimeout(() => setIsRefreshing(false), 400)
    }
  }
  const logActivity = null
  const logAct = null
  const log = async (action:string, description:string, module:string, extra?:any) => {

    const sess = JSON.parse(localStorage.getItem('vista_admin_session')||'{}')
    const uname = user?.name||user?.nama||sess?.nama||sess?.name||'Unknown User'
    await activityLogService.insert({user_name:uname,action,description,module,
      halaman:extra?.halaman||'',proyek:extra?.proyek||'',
      panel:extra?.panel||'',wo_number:extra?.wo_number||''})
  }








const { data: woList, loading: woLoading, create: createWO, update: updateWO, remove: removeWO, refetch: refetchWO } = useWorkOrders()
const [livePanelTypes,setLivePanelTypes]=useState<any>({});
useEffect(()=>{
  Promise.all([
    supabase.from("bom_master").select("*"),
    supabase.from("panel_type_meta").select("*"),
    supabase.from("panel_wp_meta").select("*"),
  ]).then(([bomRes,typeMetaRes,wpMetaRes]:any)=>{
    if(bomRes.data&&bomRes.data.length>0){
      setLivePanelTypes(buildPanelTypesFromBom(bomRes.data,typeMetaRes.data,wpMetaRes.data));
    }
  });
},[]);
useEffect(()=>{setGlobalLivePanelTypes(livePanelTypes);},[livePanelTypes]);
useEffect(()=>{
  supabase.from("bom_proses_relevan").select("*").then(({data}:any)=>{
    const relevanSet=new Set<string>();
    const hasMappingSet=new Set<string>();
    (data||[]).forEach((r:any)=>{
      relevanSet.add(r.kode_komponen+"|"+r.tipe_panel+"|"+r.jenis_pekerjaan);
      hasMappingSet.add(r.kode_komponen+"|"+r.tipe_panel);
    });
    setGlobalProsesRelevan(relevanSet,hasMappingSet);
  });
},[]);
const getEffCfg=(tipe:string)=>(livePanelTypes?.[tipe]?.wps?.length>0)?livePanelTypes[tipe]:(PANEL_TYPES as any)[tipe];
const { data: pekerjaList, loading: pekerjaLoading, create: createPekerja, update: updatePekerja, remove: removePekerja, refetch: refetchPekerja } = usePekerja()

const { data: renharList, loading: renharLoading, create: createRenhar, update: updateRenhar, remove: removeRenhar, refetch: refetchRenhar } = useRenhar()
const { data: rawList, loading: rawLoading, create: createRaw, update: updateRaw, remove: removeRaw, refetch: refetchRaw } = useRawSchedule()

// withRenharQueue - serialisasi SEMUA tulisan renhar per (raw_id+wp+tanggal), DIBAGI antara
// Rencana Harian & Raw Schedule (bukan masing2 punya queue sendiri) - keduanya bisa mounted
// BARENGAN (fitur "4 tab tetap mounted"), jadi kalau queue-nya terpisah per-komponen, klik
// Rilis di satu tab tetap bisa race sama Distribusi/Drag di tab lain, dua2nya insert row renhar
// baru buat kombinasi yang sama -> duplikat lagi. Fetch FRESH dari DB tepat sebelum tiap
// operasi (bukan baca dari state renhar yang bisa stale) + ORDER BY updated_at DESC supaya
// kalaupun (jarang) masih ada row dobel yang lolos, yang kepilih konsisten row PALING BARU.
const renharOpQueueRef = useRef<Record<string,Promise<any>>>({});
const withRenharQueue = async (task:any, fn:(existingFresh:any)=>Promise<void>) => {
  const key = `${task.rawId}_${task.wp}_${task.tanggal}`;
  const prev = renharOpQueueRef.current[key] || Promise.resolve();
  const thisOp = prev.then(async () => {
    const { data } = await supabase.from("renhar").select("*")
      .eq("raw_id", task.rawId).eq("wp", task.wp).eq("tanggal", task.tanggal)
      .order("updated_at", { ascending: false, nullsFirst: false }).limit(1);
    await fn(data?.[0] || null);
  });
  renharOpQueueRef.current[key] = thisOp;
  await thisOp;
};

const woSyncTimerRef = useRef<any>(null);
useEffect(() => {
  if (!woLoading) {
    if (woSyncTimerRef.current) clearTimeout(woSyncTimerRef.current);
    woSyncTimerRef.current = setTimeout(() => {
      if(GLOBAL_DIRTY_PANEL_IDS.size===0){
        setWoData(woList);
        return;
      }
      setWoData(prev=>{
        const prevPanelMap:Record<string,any>={};
        prev.forEach((wo:any)=>(wo.panels||[]).forEach((p:any)=>{prevPanelMap[String(p.id)]=p;}));
        return woList.map((wo:any)=>({
          ...wo,
          panels:(wo.panels||[]).map((p:any)=>{
            if(GLOBAL_DIRTY_PANEL_IDS.has(String(p.id))&&prevPanelMap[String(p.id)]){
              return{...p,checklist:prevPanelMap[String(p.id)].checklist};
            }
            return p;
          }),
        }));
      });
    }, 1200);
  }
  return () => { if (woSyncTimerRef.current) clearTimeout(woSyncTimerRef.current); };
}, [woList, woLoading])

useEffect(() => {
  if (!pekerjaLoading) setPekerja(pekerjaList)
}, [pekerjaList, pekerjaLoading])

// renharListRef/rawListRef di-update SETIAP render (bukan cuma di dalam effect) - biar pas
// timer debounce di bawah akhirnya nembak, dia selalu baca renharList/rawList PALING BARU,
// bukan snapshot lama yang ke-capture closure dari effect run yang menjadwalkan timer itu.
// Ini nutup race: aksi lokal (misal drag WP di Raw Schedule) yang optimistically update
// rawData bisa ke-timpa balik ke versi lama kalau timer debounce nembak pakai closure basi.
const renharListRef = useRef(renharList);
renharListRef.current = renharList;
const rawListRef = useRef(rawList);
rawListRef.current = rawList;

const renharSyncTimerRef = useRef<any>(null);
useEffect(() => {
  if (!renharLoading) {
    if (renharSyncTimerRef.current) clearTimeout(renharSyncTimerRef.current);
    renharSyncTimerRef.current = setTimeout(() => {
      if(GLOBAL_DIRTY_RENHAR_IDS.size===0){
        setRenhar(renharListRef.current);
        return;
      }
      // Row yang lagi dirty (baru aja ditulis lokal, misal abis klik Rilis) dipertahankan versi
      // lokalnya - JANGAN ketimpa snapshot renharList yang mungkin belum nyusul perubahannya.
      setRenhar((prev:any[])=>{
        const prevMap:Record<string,any>={};
        prev.forEach((r:any)=>{prevMap[String(r.id)]=r;});
        return renharListRef.current.map((r:any)=>
          GLOBAL_DIRTY_RENHAR_IDS.has(String(r.id))&&prevMap[String(r.id)]?prevMap[String(r.id)]:r);
      });
    }, 1200);
  }
  return () => { if (renharSyncTimerRef.current) clearTimeout(renharSyncTimerRef.current); };
}, [renharList, renharLoading])

const rawSyncTimerRef = useRef<any>(null);
useEffect(() => {
  if (!rawLoading) {
    if (rawSyncTimerRef.current) clearTimeout(rawSyncTimerRef.current);
    rawSyncTimerRef.current = setTimeout(() => {
      if(GLOBAL_DIRTY_RAW_IDS.size===0){
        setRawData(rawListRef.current);
        return;
      }
      setRawData((prev:any[])=>{
        const prevMap:Record<string,any>={};
        prev.forEach((r:any)=>{prevMap[String(r.id)]=r;});
        return rawListRef.current.map((r:any)=>
          GLOBAL_DIRTY_RAW_IDS.has(String(r.id))&&prevMap[String(r.id)]?prevMap[String(r.id)]:r);
      });
    }, 1200);
  }
  return () => { if (rawSyncTimerRef.current) clearTimeout(rawSyncTimerRef.current); };
}, [rawList, rawLoading])

// ── Auto-geser komponen yang belum selesai ke hari berikutnya ────────────────────────────
// Kalau komponen TIDAK dikerjakan sama sekali ATAU belum 100% di hariSumber, otomatis
// disalin (BUKAN memindahkan) ke raw_schedule[hariTarget], ditandai carriedOverFrom -
// planner gak perlu jadwalin ulang manual. Entry di hariSumber TETAP utuh apa adanya
// (snapshot permanen buat fitur "kunci progress per hari" - lihat getProgressAsOfDate).
// WIRING CONTROL/WIRING POWER dikecualikan KALAU progress-nya udah >0% (lagi dikerjakan) -
// itu udah dijadwal multi-hari lewat sistem kuota-orang (fcsService), biarin planner manual.
// QC TEST/PACKING dikecualikan total - proses whole-panel/marker, bukan per-komponen harian.
// Idempotent lewat cek data (carriedOverFrom yang udah ada di hariTarget) - aman dipanggil
// berkali-kali/dari beberapa tab, gak akan nyipta entry dobel. Dipisah jadi function sendiri
// (bukan langsung inline di useEffect) biar bisa dipanggil manual buat testing lewat tombol
// "Cek & Geser Sekarang" di Rencana Harian, gak cuma nunggu transisi hari kerja beneran.
const PROSES_DIKECUALIKAN_AUTO_GESER=["QC TEST","PACKING"];
const PROSES_WIRING_AUTO_GESER=["WIRING CONTROL","WIRING POWER"];
const geserSatuTanggal=async(hariSumber:string,hariTarget:string):Promise<number>=>{
  // Klaim eksekusi di level DATABASE - localStorage per-browser TIDAK cukup kalau 2 planner
  // (atau 1 planner 2 tab/device) sama-sama buka dashboard pas transisi hari kerja: masing2
  // browser py localStorage sendiri2, jadi keduanya lolos cek "belum jalan hari ini" dan
  // geserSatuTanggal jalan DUA KALI konkuren pakai snapshot rawList/woList yang saling belum
  // sinkron -> dedup carriedOverFrom gagal mendeteksi entry yg br ditulis proses lain -> entry
  // dobel utk WP yg sama ("Lanjutan [tgl]" muncul 2x). Insert ke auto_geser_runs bakal kena
  // unique-violation kalau tab/device lain udah lebih dulu klaim hariSumber ini - itu sinyal
  // buat langsung skip, cuma SATU eksekusi yg beneran jalan sistem-wide.
  // Kalau tabelnya belum ada (migrasi belum dijalankan), JANGAN gagal total - tetap lanjut
  // jalan tanpa proteksi lintas-tab drpd fitur auto-geser mati sama sekali.
  const{error:claimErr}=await supabase.from("auto_geser_runs").insert({hari_sumber:hariSumber,hari_target:hariTarget});
  if(claimErr&&(claimErr as any).code==="23505")return 0;

  let jumlahDigeser=0;
  // Fetch FRESH langsung dari DB - BUKAN pakai rawList/woList (closure React state) yang bisa
  // stale, terutama progress checklist yg br aja nyentuh 100% tapi snapshot lokal belum nangkep
  // itu -> sebelumnya bikin komponen yg SUDAH SELESAI ikut kegeser krn dianggap masih eligible.
  const[{data:freshRaw},{data:freshPanels}]=await Promise.all([
    supabase.from("raw_schedule").select("*"),
    supabase.from("panels").select("id,checklist"),
  ]);
  const panelMap:Record<string,any>={};
  (freshPanels||[]).forEach((p:any)=>{panelMap[String(p.id)]=p;});

  for(const row of (freshRaw||[])){
    if(PROSES_DIKECUALIKAN_AUTO_GESER.includes(row.proses))continue;
    const entriesSumber=row.schedule?.[hariSumber]||[];
    if(entriesSumber.length===0)continue;
    const panel=panelMap[String(row.panel_id||row.panelId)];
    if(!panel)continue;
    const isWiring=PROSES_WIRING_AUTO_GESER.includes(row.proses);

    const kodeEligiblePerWp:Record<string,string[]>={};
    entriesSumber.forEach((e:any)=>{
      (e.komponen||[]).forEach((kode:string)=>{
        if(kode.startsWith("__wiring_"))return;
        const cl=panel.checklist?.[kode];
        const pct=getProgressAsOfDate(cl,row.proses,hariSumber);
        if(pct>=100)return;
        if(isWiring&&pct>0)return;
        if(!kodeEligiblePerWp[e.wp])kodeEligiblePerWp[e.wp]=[];
        kodeEligiblePerWp[e.wp].push(kode);
      });
    });
    if(Object.keys(kodeEligiblePerWp).length===0)continue;

    // Fetch fresh SEKALI LAGI khusus row ini pas mau nulis - jaga2 kalau schedule row ini
    // sempat berubah (misal planner drag-drop manual) di rentang waktu antara select massal di
    // atas dan baris ini diproses (loop-nya sequential, bisa makan waktu kalau row banyak).
    const{data:freshRowNow}=await supabase.from("raw_schedule").select("schedule").eq("id",row.id).single();
    const scheduleTerkini=freshRowNow?.schedule||row.schedule||{};
    const entriesTarget=scheduleTerkini[hariTarget]||[];
    const kodeSudahDigeser=new Set<string>();
    entriesTarget.forEach((e:any)=>{
      if(e.carriedOverFrom===hariSumber)(e.komponen||[]).forEach((k:string)=>kodeSudahDigeser.add(k));
    });

    const entryBaru:any[]=[];
    Object.entries(kodeEligiblePerWp).forEach(([wp,kodes])=>{
      const sisa=kodes.filter(k=>!kodeSudahDigeser.has(k));
      if(sisa.length>0)entryBaru.push({wp,komponen:sisa,carriedOverFrom:hariSumber});
    });
    if(entryBaru.length===0)continue;
    jumlahDigeser+=entryBaru.reduce((s,e)=>s+e.komponen.length,0);

    const scheduleBaru={...scheduleTerkini};
    scheduleBaru[hariTarget]=[...entriesTarget,...entryBaru];
    // Entry ASLI di hariSumber TETAP DISIMPAN APA ADANYA (data/histori/status rilis yg udah
    // ada di tanggal itu jangan hilang - dipakai fitur "kunci progress per hari"), tapi
    // komponen yg baru aja digeser ditandai `digeserKe` per-kode. UI (Rencana Harian & Raw
    // Schedule) pakai marker ini buat NONAKTIFKAN tombol Rilis/drag utk kode itu di tanggal
    // asal - biar gak ada 2 entry yg SAMA2 keliatan "aktif" (yg bikin toggle Rilis di satu
    // tempat kayak "kena" ke tempat lain, padahal itu 2 row/entry historis vs aktif yg beda).
    scheduleBaru[hariSumber]=(scheduleTerkini[hariSumber]||[]).map((e:any)=>{
      const kodeDigeserWp=entryBaru.find(nb=>nb.wp===e.wp)?.komponen||[];
      if(kodeDigeserWp.length===0)return e;
      const digeserKeBaru={...(e.digeserKe||{})};
      kodeDigeserWp.forEach((k:string)=>{digeserKeBaru[k]=hariTarget;});
      return{...e,digeserKe:digeserKeBaru};
    });
    await updateRaw(row.id,{schedule:scheduleBaru});
    markRawDirty(row.id);
    setRawData((prev:any)=>prev.map((r:any)=>r.id===row.id?{...r,schedule:scheduleBaru}:r));
    // Sengaja TIDAK menyentuh renhar sama sekali di sini - status rilis di hariTarget harus
    // selalu mulai dari "Belum Dirilis", walau kode ini sudah pernah dirilis di hariSumber.
    // Planner WAJIB klik Rilis manual lagi di hari yang baru sebelum operator bisa kerjakan.
  }
  return jumlahDigeser;
};

const autoGeserRanRef=useRef(false);
useEffect(()=>{
  if(autoGeserRanRef.current)return;
  if(rawLoading||woLoading||renharLoading)return;
  autoGeserRanRef.current=true;
  (async()=>{
    const hariKerjaSekarang=getHariKerjaSekarang();
    const hariSebelumnya=addDays(hariKerjaSekarang,-1);
    const lsKey="vista_teknik_auto_geser_last_tgl";
    try{ if(localStorage.getItem(lsKey)===hariSebelumnya)return; }catch{}
    await geserSatuTanggal(hariSebelumnya,hariKerjaSekarang);
    try{localStorage.setItem(lsKey,hariSebelumnya);}catch{}
  })();
},[rawLoading,woLoading,renharLoading]);

if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user)return <Login onLogin={u=>{
    setUser(u);
    setPage("app");
    setTab("redirect");
  }}/>;

  const isOp=OPERATOR_ROLES.includes(user?.divisi);

  // Apply dark mode langsung tanpa useEffect
  localStorage.setItem("vista_dark_mode", String(darkMode));
  document.documentElement.setAttribute("data-theme", darkMode?"dark":"light");
  // Redirect operator ke vista-pekerja
  if(isOp) return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#f1f5f9",padding:20}}>
      <style>{GCss}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"40px 48px",textAlign:"center",boxShadow:"0 4px 24px #00000012",maxWidth:420,width:"100%"}}>
        <div style={{fontSize:48,marginBottom:16}}>⚡</div>
        <div style={{fontWeight:900,fontSize:22,color:"#1e293b",marginBottom:8}}>Halo, {user.name||user.nama}!</div>
        <div style={{fontSize:14,color:"#64748b",marginBottom:24,lineHeight:1.6}}>
          Sebagai <strong>{DIVISI_CONFIG[user.divisi]?.label}</strong>, gunakan aplikasi <strong>Vista Pekerja</strong> untuk mengakses jadwal dan update progress kerja kamu.
        </div>
        <a href="https://vista-pekerja.vercel.app" target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:10,background:"#1d4ed8",color:"#fff",
            fontWeight:800,fontSize:15,padding:"14px 32px",borderRadius:12,textDecoration:"none",
            boxShadow:"0 4px 14px #2563eb33",marginBottom:16}}>
          Buka Vista Pekerja →
        </a>
        <div style={{marginTop:16}}>
          <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}}
            style={{background:"none",border:"1px solid #e2e8f0",color:"#94a3b8",borderRadius:8,
              padding:"8px 20px",cursor:"pointer",fontSize:13,fontWeight:600}}>
            Keluar
          </button>
        </div>
      </div>
    </div>
  );
  const cfg=DIVISI_CONFIG[user.divisi];
  const canWO=["admin"].includes(user.divisi);
  const canRaw=["admin"].includes(user.divisi);

  const canPekerja=["admin"].includes(user.divisi);

  const canKendala=["admin"].includes(user.divisi);

  const canRencana=["admin"].includes(user.divisi);


  
  const SIDEBAR_MENUS=[
    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"ti ti-layout-dashboard"},
      {id:"summary",label:"Summary Progress",icon:"ti ti-chart-bar"},
      {id:"taskmonitoring",label:"Task Monitoring",icon:"ti ti-list-check"},
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},
      {id:"stok",label:"Stok Komponen",icon:"ti ti-package"},
      {id:"laporan_qc",label:"Laporan QC",icon:"ti ti-clipboard-check"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
      ...(canWO?[{id:"arsip",label:"Arsip",icon:"ti ti-archive"}]:[]),
      {id:"trackingkomponen",label:"Tracking Komponen",icon:"ti ti-package"},
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"tracking",label:"Tracking Pekerja",icon:"ti ti-chart-line"},
        {id:"activity",label:"Activity Log",icon:"ti ti-list-details"},
        {id:"kendala",label:"Kendala",icon:"ti ti-alert-triangle",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"ti ti-tool",badge:maintenanceOverdueCount>0?maintenanceOverdueCount:null},
        {id:"masteruser",label:"System",icon:"ti ti-settings"},
      ]:[]),
    ]},
  ];

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;
  // Data notifikasi lengkap
  const notifItems=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)))
    .map(w=>({
      id:w.id,
      wo:w.wo,
      proyek:w.proyek,
      target:w.target,
      pct:woOverall(w),
      isDelayed:isDelayed(w.target),
      isUrgent:isUrgent(w.target),
      daysLeft:daysUntil(w.target),
    }))
    .sort((a,b)=>a.daysLeft-b.daysLeft);

  // Kendala belum selesai
  const kendalaNotif=kendalaLog.filter((k:any)=>k.status!=="selesai").slice(0,5);
  const activeLabel=SIDEBAR_MENUS.flatMap(g=>g.items).find(i=>i.id===tab)?.label||"Dashboard";

  const showTooltip=(e:any,label:string)=>{
    if(!sidebarCollapsed)return;
    let tip=document.getElementById("erp-tip") as HTMLElement;
    if(!tip){tip=document.createElement("div");tip.id="erp-tip";tip.className="erp-tooltip-el";document.body.appendChild(tip);}
    const r=e.currentTarget.getBoundingClientRect();
    tip.textContent=label;tip.style.display="block";
    tip.style.top=(r.top+r.height/2)+"px";tip.style.left="58px";
  };
  const hideTooltip=()=>{const tip=document.getElementById("erp-tip");if(tip)(tip as HTMLElement).style.display="none";};

  return(
    <>
      <style>{GCss}</style>
      {ctxMenu&&(
        <div
          onClick={(e:any)=>e.stopPropagation()}
          style={{
            position:"fixed",top:ctxMenu.y,left:ctxMenu.x,background:"#fff",
            border:"1px solid #e2e8f0",borderRadius:8,boxShadow:"0 8px 24px #00000022",
            zIndex:9999,minWidth:220,padding:6,fontSize:13,fontFamily:"inherit"
          }}>
          <div style={{padding:"6px 10px",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:.4}}>Navigasi & Tampilan</div>
          <button onClick={()=>{window.location.reload();setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>🔄</span><span>Refresh Data</span>
          </button>
          <button onClick={()=>{window.location.reload();setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>↻</span><span>Reload Halaman</span>
          </button>
          <div style={{height:1,background:"#f1f5f9",margin:"4px 0"}}/>
          <div style={{padding:"6px 10px",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:.4}}>Tab & Window</div>
          <button onClick={()=>{window.open(window.location.href,"_blank");setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>⧉</span><span>Buka di Tab Baru</span>
          </button>
          <button onClick={()=>{navigator.clipboard.writeText(window.location.href);alert("Tautan disalin ke clipboard");setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>📋</span><span>Salin Tautan Halaman</span>
          </button>
          <div style={{height:1,background:"#f1f5f9",margin:"4px 0"}}/>
          <div style={{padding:"6px 10px",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:.4}}>Bantuan</div>
          <button onClick={()=>{setShowShortcutModal(true);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>⌨️</span><span>Pintasan Keyboard</span>
          </button>
          <button onClick={()=>{setShowAboutModal(true);setCtxMenu(null);}}
            style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left" as const,padding:"8px 10px",border:"none",background:"none",cursor:"pointer",borderRadius:6,color:"#1e293b",fontFamily:"inherit",fontSize:13}}
            onMouseEnter={(e:any)=>e.currentTarget.style.background="#f1f5f9"}
            onMouseLeave={(e:any)=>e.currentTarget.style.background="none"}>
            <span>ℹ️</span><span>Tentang Vista Teknik</span>
          </button>
        </div>
      )}
      {showShortcutModal&&(
        <div onClick={()=>setShowShortcutModal(false)}
          style={{position:"fixed",inset:0,background:"#00000050",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,padding:24,width:360,boxShadow:"0 12px 32px #00000033"}}>
            <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:16}}>⌨️ Pintasan Keyboard</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
              <span style={{fontSize:13,color:"#64748b"}}>Cari work order, panel...</span>
              <span style={{background:"#f1f5f9",borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:700,color:"#475569",fontFamily:"monospace"}}>Ctrl+K</span>
            </div>
            <button onClick={()=>setShowShortcutModal(false)}
              style={{marginTop:16,width:"100%",padding:"8px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Tutup
            </button>
          </div>
        </div>
      )}
      {showAboutModal&&(
        <div onClick={()=>setShowAboutModal(false)}
          style={{position:"fixed",inset:0,background:"#00000050",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,padding:24,width:360,textAlign:"center" as const,boxShadow:"0 12px 32px #00000033"}}>
            <div className="erp-logo" style={{margin:"0 auto 12px",width:48,height:48,fontSize:22}}>V</div>
            <div style={{fontWeight:700,fontSize:16,color:"#1e293b"}}>Vista Teknik</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Electrical Switchboard Manufacturing</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:12}}>Versi 1.0 — 25 Juni 2026</div>
            <button onClick={()=>setShowAboutModal(false)}
              style={{marginTop:16,width:"100%",padding:"8px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              Tutup
            </button>
          </div>
        </div>
      )}
      {isOp?(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",background:"#f8fafc"}}>
          <div style={{background:"#fff",borderBottom:"1px solid #eaecf0",padding:"0 16px",height:46,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div className="erp-logo">V</div>
              <span style={{fontWeight:700,fontSize:13,color:"#0f172a"}}>Vista Teknik</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{background:cfg.bg,color:cfg.color,borderRadius:5,padding:"2px 10px",fontSize:10,fontWeight:600}}>{cfg.label}</span>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>Keluar</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <OperatorView woData={woData} setWoData={setWoData} user={user} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createKendala={createKendala}/>
          </div>
        </div>
      ):(
        <div className="erp-wrap">
          <div className={"erp-sb"+(sidebarCollapsed?" col":"")}>
            <div className="erp-sb-head">
              <div className="erp-logo">V</div>
              <div className="erp-brand">
                <div className="erp-brand-name">Vista Teknik</div>
                <div className="erp-brand-sub">Electrical Switchboard Manufacturing</div>
              </div>
            </div>
            <div className="erp-nav">
              {SIDEBAR_MENUS.map(group=>(
                <div key={group.group}>
                  <div className="erp-nav-grp">{group.group}</div>
                  {group.items.map((item:any)=>(
                    <button key={item.id}
                      className={"erp-nav-item"+(tab===item.id?" active":"")}
                      onClick={()=>setTab(item.id)}
                      onMouseEnter={(e:any)=>showTooltip(e,item.label)}
                      onMouseLeave={hideTooltip}>
                      <i className={item.icon} style={{fontSize:18,flexShrink:0,width:20,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}/>
                      <span className="erp-nav-label">{item.label}</span>
                      {item.badge&&<span className="erp-nav-badge">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="erp-sb-foot">
              <div className="erp-foot-av">{(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}</div>
              <div className="erp-foot-info">
                <div className="erp-foot-name">{user?.name||user?.nama}</div>
                <div className="erp-foot-role">{cfg?.label||"Admin"}</div>
              </div>
              {!sidebarCollapsed&&<button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",flexShrink:0,padding:2,display:"flex",alignItems:"center",justifyContent:"center"}} title="Keluar"><i className="ti ti-logout" style={{fontSize:16}}/></button>}
            </div>
          </div>
          <div className="erp-main">
            <GlobalSearch show={showSearch} onClose={()=>setShowSearch(false)}
            query={searchQuery} setQuery={setSearchQuery}
            woData={woData} pekerja={pekerja} setTab={setTab}/>
          <div className="erp-topbar">
              <button className="erp-toggle" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)}>
                {sidebarCollapsed?"▶":"◀"}
              </button>
              <input className="erp-search" placeholder="Cari work order, panel..." readOnly onClick={()=>setShowSearch(true)} style={{cursor:"pointer"}} onFocus={()=>setShowSearch(true)}/>
              <div className="erp-topbar-right">
                {/* Refresh global */}
                <button onClick={()=>window.location.reload()}
                  title="Hard refresh (muat ulang halaman)"
                  style={{width:26,height:26,border:"1px solid var(--border-color,#e5e8ed)",
                    borderRadius:5,background:"var(--bg-secondary,#f8f9fb)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:"pointer",color:"var(--text-secondary,#64748b)"}}>
                  <i className="ti ti-refresh" style={{fontSize:13,display:"inline-block"}}/>
                </button>

                {/* Dark mode toggle */}
                <button onClick={()=>setDarkMode(p=>!p)}
                  title={darkMode?"Light Mode":"Dark Mode"}
                  style={{width:26,height:26,border:"1px solid var(--border-color,#e5e8ed)",
                    borderRadius:5,background:"var(--bg-secondary,#f8f9fb)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:"pointer",color:"var(--text-secondary,#64748b)"}}>
                  <i className={darkMode?"ti ti-sun":"ti ti-moon"} style={{fontSize:13}}/>
                </button>

                <div style={{position:"relative"}}>
                  <div className="erp-bell" onClick={()=>setShowNotif(p=>!p)}
                    style={{cursor:"pointer",position:"relative"}}>
                    <i className="ti ti-bell" style={{fontSize:14}}/>
                    {(alerts>0||kendalaNotif.length>0||notifQcGagal.length>0)&&(
                      <div className="erp-bell-dot" style={{top:2,right:2}}/>
                    )}
                  </div>
                  {showNotif&&(
                    <div style={{position:"absolute",top:34,right:0,width:320,background:"#fff",
                      borderRadius:12,boxShadow:"0 8px 32px #00000018",border:"1px solid #e2e8f0",
                      zIndex:999,overflow:"hidden"}}>
                      {/* Header */}
                      <div style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",
                        justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>Notifikasi</span>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          {(alerts+kendalaNotif.length)>0&&(
                            <span style={{background:"#dc2626",color:"#fff",borderRadius:20,
                              padding:"1px 8px",fontSize:10,fontWeight:700}}>
                              {alerts+kendalaNotif.length}
                            </span>
                          )}
                          <button onClick={()=>setShowNotif(false)}
                            style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>✕</button>
                        </div>
                      </div>
                      {/* Notif list */}
                      <div style={{maxHeight:360,overflowY:"auto" as const}}>
                        {notifItems.length===0&&kendalaNotif.length===0&&notifQcGagal.length===0?(
                          <div style={{padding:"32px",textAlign:"center",color:"#94a3b8",fontSize:12}}>
                            <div style={{fontSize:24,marginBottom:8}}>✅</div>
                            Semua WO on track!
                          </div>
                        ):(
                          <>
                            {notifQcGagal.map((n:any)=>(
                              <div key={n.id} style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",background:"#fef2f2"}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                  <div style={{flex:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                                      <span style={{background:"#dc2626",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>QC GAGAL</span>
                                      <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{n.panel_nama}</span>
                                    </div>
                                    <div style={{fontSize:11,color:"#475569"}}>{n.nama_komponen} — oleh {n.pekerja_nama}</div>
                                    {n.catatan&&<div style={{fontSize:10,color:"#7f1d1d",marginTop:3,fontStyle:"italic" as const}}>"{n.catatan}"</div>}
                                  </div>
                                  <button onClick={()=>tandaiQcGagalDibaca(n.id)}
                                    style={{background:"#fff",border:"1px solid #fecaca",borderRadius:6,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#dc2626",cursor:"pointer",whiteSpace:"nowrap" as const}}>
                                    OK
                                  </button>
                                </div>
                              </div>
                            ))}
                            {notifItems.map((n:any)=>(
                              <div key={n.id} onClick={()=>{setTab("wo");setShowNotif(false);}}
                                style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer",
                                  background:"#fff",transition:"background .1s"}}
                                onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                                  <div style={{flex:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                                      <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>WO {n.wo}</span>
                                      <span style={{background:n.isDelayed?"#fef2f2":"#fffbeb",
                                        color:n.isDelayed?"#dc2626":"#d97706",
                                        borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700}}>
                                        {n.isDelayed?"TERLAMBAT":"MENDESAK"}
                                      </span>
                                    </div>
                                    <div style={{fontSize:11,color:"#475569"}}>{n.proyek}</div>
                                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
                                      <div style={{flex:1,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                        <div style={{width:n.pct+"%",height:"100%",
                                          background:n.pct>=75?"#16a34a":n.pct>=50?"#f59e0b":"#ef4444",
                                          borderRadius:99}}/>
                                      </div>
                                      <span style={{fontSize:10,fontWeight:700,color:"#64748b"}}>{n.pct}%</span>
                                    </div>
                                  </div>
                                  <div style={{textAlign:"right" as const,flexShrink:0}}>
                                    <div style={{fontSize:11,fontWeight:700,
                                      color:n.isDelayed?"#dc2626":n.daysLeft<=3?"#ef4444":"#d97706"}}>
                                      {n.isDelayed?`H+${Math.abs(n.daysLeft)}`:`H-${n.daysLeft}`}
                                    </div>
                                    <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>{n.target}</div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {kendalaNotif.map((k:any)=>(
                              <div key={k.id} onClick={()=>{setTab("kendala");setShowNotif(false);}}
                                style={{padding:"10px 16px",borderBottom:"1px solid #f8fafc",cursor:"pointer",
                                  background:"#fff"}}
                                onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <span style={{background:"#fef2f2",color:"#dc2626",borderRadius:20,
                                    padding:"1px 7px",fontSize:9,fontWeight:700}}>KENDALA</span>
                                  <span style={{fontSize:11,color:"#475569",flex:1}}>{k.deskripsi||k.kendala||"Kendala baru"}</span>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                      {/* Footer */}
                      {(notifItems.length>0||kendalaNotif.length>0||notifQcGagal.length>0)&&(
                        <div style={{padding:"8px 16px",borderTop:"1px solid #f1f5f9",textAlign:"center" as const}}>
                          <button onClick={()=>{setTab("wo");setShowNotif(false);}}
                            style={{background:"none",border:"none",cursor:"pointer",
                              fontSize:11,color:"#2563eb",fontWeight:600}}>
                            Lihat semua WO →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span style={{background:"#f1f5f9",color:"#475569",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{cfg?.label||"Admin"}</span>
                <div className="erp-foot-av">{(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}</div>
              </div>
            </div>
            <div className="erp-body">
              {notifQcGagal.length>0&&(
                <div style={{position:"sticky" as const,top:0,zIndex:50,background:"#fef2f2",borderBottom:"1px solid #fecaca",padding:"10px 16px",marginBottom:12}}>
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:160,overflowY:"auto" as const}}>
                    {notifQcGagal.map((n:any)=>(
                      <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,background:"#fff",borderRadius:6,padding:"6px 10px",border:"1px solid #fecaca"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                          <span style={{background:"#dc2626",color:"#fff",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:700,whiteSpace:"nowrap" as const}}>QC GAGAL</span>
                          <span style={{fontSize:11.5,color:"#1e293b",fontWeight:600,whiteSpace:"nowrap" as const}}>{n.panel_nama}</span>
                          <span style={{fontSize:11,color:"#7f1d1d",whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis"}}>{n.nama_komponen} oleh {n.pekerja_nama}{n.catatan?` — "${n.catatan}"`:""}</span>
                        </div>
                        <button onClick={()=>tandaiQcGagalDibaca(n.id)}
                          style={{background:"#fff",border:"1px solid #fecaca",borderRadius:5,padding:"3px 10px",fontSize:10,fontWeight:700,color:"#dc2626",cursor:"pointer",whiteSpace:"nowrap" as const,flexShrink:0}}>
                          OK
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {visitedTabs.includes("dashboard")&&<div style={{display:tab==="dashboard"?"block":"none"}}><Suspense fallback={TabFallback}><Dashboard woData={woData}/></Suspense></div>}
              {visitedTabs.includes("arsip")&&<div style={{display:tab==="arsip"?"block":"none"}}><Suspense fallback={TabFallback}><ArsipTab woData={woData} pekerja={pekerja} logActivity={logActivity} user={user}/></Suspense></div>}
              {visitedTabs.includes("stok")&&<div style={{display:tab==="stok"?"block":"none"}}><Suspense fallback={TabFallback}><StokMonitoringTab user={user} activityLog={activityLog}/></Suspense></div>}
              {visitedTabs.includes("summary")&&<div style={{display:tab==="summary"?"block":"none"}}><Suspense fallback={TabFallback}><SummaryProgress woData={woData}/></Suspense></div>}
              {visitedTabs.includes("taskmonitoring")&&<div style={{display:tab==="taskmonitoring"?"block":"none"}}><Suspense fallback={TabFallback}><TaskMonitoring woData={woData} livePanelTypes={livePanelTypes}/></Suspense></div>}
              {visitedTabs.includes("detail")&&<div style={{display:tab==="detail"?"block":"none"}}><Suspense fallback={TabFallback}><DetailProgress woData={woData} rawData={rawData} livePanelTypes={livePanelTypes}/></Suspense></div>}
              {visitedTabs.includes("raw")&&<div style={{display:tab==="raw"?"block":"none"}}><Suspense fallback={TabFallback}><RawSchedule woData={woData} rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} refetchRenhar={refetchRenhar} withRenharQueue={withRenharQueue} logActivity={logActivity} logAct={logAct} log={log} user={user} livePanelTypes={livePanelTypes}/></Suspense></div>}
              {visitedTabs.includes("rencana")&&<div style={{display:tab==="rencana"?"block":"none"}}><Suspense fallback={TabFallback}><RencanaHarian rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} withRenharQueue={withRenharQueue} logActivity={logActivity} logAct={logAct} log={log} user={user} livePanelTypes={livePanelTypes}/></Suspense></div>}
              {visitedTabs.includes("wo")&&<div style={{display:tab==="wo"?"block":"none"}}><Suspense fallback={TabFallback}><ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} logAct={logAct} log={log} user={user} refetchWO={refetchWO}/></Suspense></div>}
              {visitedTabs.includes("tracking")&&<div style={{display:tab==="tracking"?"block":"none"}}><Suspense fallback={TabFallback}><TrackingPekerja pekerja={pekerja} renhar={renhar} setRenhar={setRenhar} removeRenhar={removeRenhar} woData={woData} livePanelTypes={livePanelTypes}/></Suspense></div>}
              {visitedTabs.includes("laporan_qc")&&<div style={{display:tab==="laporan_qc"?"block":"none"}}><Suspense fallback={TabFallback}><LaporanQCView woData={woData}/></Suspense></div>}
              {visitedTabs.includes("trackingkomponen")&&<div style={{display:tab==="trackingkomponen"?"block":"none"}}><Suspense fallback={TabFallback}><TrackingKomponenAdmin/></Suspense></div>}
              {visitedTabs.includes("maintenance")&&<div style={{display:tab==="maintenance"?"block":"none"}}><Suspense fallback={TabFallback}><MaintenancePageTab user={user}/></Suspense></div>}
              {visitedTabs.includes("kendala")&&<div style={{display:tab==="kendala"?"block":"none"}}><Suspense fallback={TabFallback}><KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala} user={user}/></Suspense></div>}
              {visitedTabs.includes("activity")&&<div style={{display:tab==="activity"?"block":"none"}}><Suspense fallback={TabFallback}><ActivityLogView activityLog={activityLog} user={user}/></Suspense></div>}
              {visitedTabs.includes("masteruser")&&<div style={{display:tab==="masteruser"?"block":"none"}}><Suspense fallback={TabFallback}><SystemTab user={user} woData={woData} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/></Suspense></div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}