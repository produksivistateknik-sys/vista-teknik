
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import React, { useState, useMemo, useEffect } from "react";
import { usePekerja } from './hooks/usePekerja'
import { useRenhar } from './hooks/useRenhar'
import { useKendala } from './hooks/useKendala'
import { supabase } from './lib/supabase'
import { useWorkOrders } from './hooks/useWorkOrders'
import { workOrderService } from './services/workOrderService'
import { useRawSchedule } from "./hooks/useRawSchedule";
import { useActivityLog } from './hooks/useActivityLog';
import { createLog, fixSystemLog, setAdminSession } from './lib/activityLog';
// ─────────────────────────────────────────────────────────────────────────────
// PANEL TYPES
// ─────────────────────────────────────────────────────────────────────────────
const PANEL_TYPES = {
  FS: {
    label:"FS", color:"#f59e0b",
    wps:[
      { wp:"WP1", range:"FS.1-10", color:"#f59e0b", bg:"#fffbeb", items:[
        {kode:"FS.1",nama:"Frame (include ambang)"},{kode:"FS.2",nama:"Tulangan Kedalaman"},
        {kode:"FS.3",nama:"Tulangan Tegak"},{kode:"FS.4",nama:"Groundplate"},
        {kode:"FS.5",nama:"Box Control"},{kode:"FS.6",nama:"Dudukan ACB"},
        {kode:"FS.7",nama:"Tulangan Support Busbar"},{kode:"FS.8",nama:"UNP"},
        {kode:"FS.9",nama:"Dudukan Capacitor/Detuned"},{kode:"FS.10",nama:"Tulangan Dudukan Capacitor"},
      ]},
      { wp:"WP2", range:"FS.11-15", color:"#22c55e", bg:"#f0fdf4", items:[
        {kode:"FS.11",nama:"Pintu"},{kode:"FS.12",nama:"Sekatan Pintu"},
        {kode:"FS.13",nama:"Hanger"},{kode:"FS.14",nama:"Tutup Atas"},{kode:"FS.15",nama:"Topi"},
      ]},
      { wp:"WP3", range:"FS.16-21", color:"#06b6d4", bg:"#ecfeff", items:[
        {kode:"FS.16",nama:"Sekatan Samping"},{kode:"FS.17",nama:"Sekatan Belakang"},
        {kode:"FS.18",nama:"Bingkai Lantai"},{kode:"FS.19",nama:"Lantai Dasar"},
        {kode:"FS.20",nama:"Tutup Samping"},{kode:"FS.21",nama:"Tutup Belakang"},
      ]},
      { wp:"WP4", range:"FS.22-24", color:"#f97316", bg:"#fff7ed", items:[
        {kode:"FS.22",nama:"Cover Komponen"},{kode:"FS.23",nama:"Tulangan Cover"},{kode:"FS.24",nama:"Sekatan Capacitor"},
      ]},
    ]
  },
  F3B: {
    label:"Form 3B", color:"#0ea5e9",
    wps:[
      { wp:"WP1", range:"F3B.1-12", color:"#f59e0b", bg:"#fffbeb", items:[
        {kode:"F3B.1",nama:"Frame (include ambang)"},
        {kode:"F3B.2",nama:"Kompartemen"},
        {kode:"F3B.3",nama:"Sekatan Kompartemen"},
        {kode:"F3B.4",nama:"Tulangan Kedalaman"},
        {kode:"F3B.5",nama:"Tulangan Tegak"},{kode:"F3B.6",nama:"Groundplate"},
        {kode:"F3B.7",nama:"Box Control"},{kode:"F3B.8",nama:"Dudukan ACB"},
        {kode:"F3B.9",nama:"Tulangan Support Busbar"},{kode:"F3B.10",nama:"UNP"},
        {kode:"F3B.11",nama:"Dudukan Capacitor/Detuned"},{kode:"F3B.12",nama:"Tulangan Dudukan Capacitor"},
      ]},
      { wp:"WP2", range:"F3B.13-17", color:"#22c55e", bg:"#f0fdf4", items:[
        {kode:"F3B.13",nama:"Pintu"},{kode:"F3B.14",nama:"Sekatan Pintu"},
        {kode:"F3B.15",nama:"Hanger"},{kode:"F3B.16",nama:"Tutup Atas"},{kode:"F3B.17",nama:"Topi"},
      ]},
      { wp:"WP3", range:"F3B.18-23", color:"#06b6d4", bg:"#ecfeff", items:[
        {kode:"F3B.18",nama:"Sekatan Samping"},{kode:"F3B.19",nama:"Sekatan Belakang"},
        {kode:"F3B.20",nama:"Bingkai Lantai"},{kode:"F3B.21",nama:"Lantai Dasar"},
        {kode:"F3B.22",nama:"Tutup Samping"},{kode:"F3B.23",nama:"Tutup Belakang"},
      ]},
      { wp:"WP4", range:"F3B.24-26", color:"#f97316", bg:"#fff7ed", items:[
        {kode:"F3B.24",nama:"Cover Komponen"},{kode:"F3B.25",nama:"Tulangan Cover"},{kode:"F3B.26",nama:"Sekatan Capacitor"},
      ]},
    ]
  },
  WM_MS: {
    label:"WM Mild Steel", color:"#8b5cf6",
    wps:[
      { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
      { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
      { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
      { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
      { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
    ]
  },
  WM_POLY: {
    label:"WM Poly", color:"#ec4899",
    wps:[
      { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
      { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
      { wp:"WP3", range:"WM.5-6", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
      { wp:"WP5", range:"WM.9",   color:"#a78bfa", bg:"#f5f3ff", items:[{kode:"WM.9",nama:"Tulangan Pintu Dalam"}]},
      { wp:"WP6", range:"WM.10",  color:"#f472b6", bg:"#fdf2f8", items:[{kode:"WM.10",nama:"Pintu Dalam"}]},
    ]
  },
};

const ALL_PROSES = ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
const WP_LIST    = ["WP1","WP2","WP3","WP4","WP5","WP6"];
const PCT_STEPS  = [25,50,75,90,100];
const PCT_MANUAL = [10,20,30,40,50,60,70,80,90,100];
const PRIORITAS  = ["Tinggi","Sedang","Rendah"];

const PROSES_COLOR = {
  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","PAINTING":"#8b5cf6",
  "RAKIT":"#ec4899","PASANG KOMPONEN":"#f97316","BUSBAR":"#06b6d4",
  "WIRING CONTROL":"#6366f1","WIRING POWER":"#ef4444","QC TEST":"#14b8a6","PACKING":"#84cc16",
};
const WP_COLOR = {"WP1":"#f59e0b","WP2":"#22c55e","WP3":"#06b6d4","WP4":"#f97316","WP5":"#a78bfa","WP6":"#f472b6"};
// WP color mengikuti warna proses
const getWpColor = (wp: string, proses?: string): string => {
  if(proses && PROSES_COLOR[proses]) return PROSES_COLOR[proses];
  return WP_COLOR[wp] || "#64748b";
};
const PRIORITAS_COLOR = {"Tinggi":"#dc2626","Sedang":"#f59e0b","Rendah":"#22c55e"};

const DIVISI_PROSES = {
  mekanik:    ["POTONG","BENDING","STEL"],
  painting:   ["PAINTING"],
  assembling: ["RAKIT","PASANG KOMPONEN","BUSBAR"],
  wiring_ctrl:["WIRING CONTROL"],
  wiring_pwr: ["WIRING POWER"],
  qc:         ["QC TEST","PACKING"],
};
// reverse map: proses → array of proses in same divisi
const DIVISI_PROSES_MAP=Object.fromEntries(
  Object.entries(DIVISI_PROSES).flatMap(([,ps])=>ps.map(p=>[p,ps]))
);
const QTY_DIVISI = ["mekanik","painting"];

const DIVISI_CONFIG = {
  admin:      {label:"Admin",         icon:"⚙️", color:"#dc2626",bg:"#fef2f2",password:"Admin123",   proses:null},
  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb",password:"mekanik123", proses:["POTONG","BENDING","STEL"]},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",password:"painting123",proses:["PAINTING"]},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",password:"assembling123",proses:["RAKIT","PASANG KOMPONEN","BUSBAR"]},
  wiring_ctrl:{label:"Wiring Control",icon:"⚡", color:"#6366f1",bg:"#eef2ff",password:"wiring123",  proses:["WIRING CONTROL"]},
  wiring_pwr: {label:"Wiring Power",  icon:"🔌", color:"#be185d",bg:"#fdf2f8",password:"wiringp123", proses:["WIRING POWER"]},
  qc:         {label:"QC",            icon:"🔍", color:"#16a34a",bg:"#f0fdf4",password:"qc123",      proses:["QC TEST","PACKING"]},
};
const OPERATOR_ROLES = ["mekanik","painting","assembling","wiring_ctrl","wiring_pwr","qc"];

const USERS = [
  {id:1, name:"Budi Admin",      divisi:"admin"},
  {id:5, name:"Agus Mekanik",    divisi:"mekanik"},
  {id:6, name:"Dedi Mekanik",    divisi:"mekanik"},
  {id:7, name:"Sari Painting",   divisi:"painting"},
  {id:8, name:"Joko Assembling", divisi:"assembling"},
  {id:9, name:"Tono WCtrl",      divisi:"wiring_ctrl"},
  {id:10,name:"Rudi WPwr",       divisi:"wiring_pwr"},
  {id:11,name:"Dewi QC",         divisi:"qc"},
];

// ─────────────────────────────────────────────────────────────────────────────
// PEKERJA SEED
// ─────────────────────────────────────────────────────────────────────────────
const PEKERJA_SEED=[];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function initChecklist(tipe, qty=1){
  const cfg=PANEL_TYPES[tipe]; if(!cfg) return {};
  const c={};
  cfg.wps.forEach(w=>w.items.forEach(it=>{
    c[it.kode]={ qty, qtyProses:{}, progress: ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{}),
      progressByDate: ALL_PROSES.reduce((a,p)=>({...a,[p]:{}}),{}),
      stepDates: ALL_PROSES.reduce((a,p)=>({...a,[p]:{}}),{}) };
  }));
  return c;
}

// Ambil progress per tanggal tertentu
function getProgressOnDate(cl, proses, date){
  // cek progressByDate dulu (struktur baru)
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&byDate[date]!==undefined) return byDate[date];
  // fallback ke progress lama (struktur lama)
  return cl?.progress?.[proses]||0;
}

// Ambil progress terbaru (tanggal terbaru yang ada datanya)
function getLatestProgress(cl, proses){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}

function calcPanelProgress(panel): Record<string, number> {
  const cfg=PANEL_TYPES[panel.tipe];
  if(!cfg||!panel.checklist) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const active=cfg.wps.flatMap(w=>w.items).filter(it=>(panel.checklist[it.kode]?.qty||0)>0);
  if(!active.length) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const prog: Record<string, number> = {};
  ALL_PROSES.forEach(pr=>{
    const vals=active.map(it=>getLatestProgress(panel.checklist[it.kode],pr));
    prog[pr]=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);
  });
  return prog;
}
function panelOverall(p){
  const v=Object.values(calcPanelProgress(p));
  if(!v.length) return 0;
  const sum=v.reduce((acc,n)=>acc+n,0);
  return Math.round(sum/v.length);
}
function woOverall(wo){
  const vals=(wo.panels??[]).flatMap(p=>Object.values(calcPanelProgress(p)));
  if(!vals.length) return 0;
  const sum=vals.reduce((acc,n)=>acc+n,0);
  return Math.round(sum/vals.length);
}

const TODAY="2026-05-18";
function daysUntil(t){ return Math.ceil((new Date(t)-new Date(TODAY))/86400000); }
function isDelayed(t){ return daysUntil(t)<0; }
function isUrgent(t){ const d=daysUntil(t); return d>=0&&d<=7; }  // H-7
function getStatus(t,pct){
  if(pct===100) return {label:"SELESAI",   color:"#16a34a", bg:"#dcfce7"};
  if(isDelayed(t)) return {label:"TERLAMBAT",color:"#dc2626", bg:"#fee2e2"};
  if(isUrgent(t))  return {label:"MENDESAK", color:"#ea580c", bg:"#ffedd5"};
  return {label:"ON TRACK",color:"#2563eb", bg:"#dbeafe"};
}
function pColor(v){
  if(v===100)return"#16a34a"; if(v>=75)return"#ca8a04";
  if(v>=50)return"#ea580c";  if(v>=25)return"#dc2626";
  if(v>0)return"#7c3aed";    return"#94a3b8";
}
function pBg(v){
  if(v===100)return"#dcfce7"; if(v>=75)return"#fef9c3";
  if(v>=50)return"#ffedd5";  if(v>=25)return"#fee2e2";
  if(v>0)return"#f3f0ff";    return"#f1f5f9";
}
function addDays(s,n){ const d=new Date(s); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function fmtDate(s){ return new Date(s).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"}); }
function fmtShort(s){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
function getDayLabel(s){ return new Date(s).toLocaleDateString("id-ID",{day:"numeric",month:"short"}); }
function fmtDateFull(s){ return new Date(s).toLocaleDateString("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric"}); }
let _id=8000; function uid(){ return ++_id; }

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────
const WO_SEED=[];

const RAW_SEED=[];

const RENHAR_SEED=[];

// ─────────────────────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────────────────────
const GCss=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f1f5f9;color:#1e293b;font-family:'Plus Jakarta Sans',sans-serif}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:#f1f5f9}
::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
input,select,textarea,button{font-family:inherit;outline:none}
input::placeholder,textarea::placeholder{color:#94a3b8}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.fi{animation:fadeIn .25s ease forwards}
.su{animation:slideUp .2s ease forwards}
.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}
`;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function Badge({label,color,bg}){
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,
    fontSize:10,fontWeight:700,color,background:bg||color+"18",border:`1px solid ${color}30`,whiteSpace:"nowrap"}}>{label}</span>;
}
function PBar({pct,h=6}){
  return <div style={{background:"#e2e8f0",borderRadius:99,height:h,overflow:"hidden",minWidth:60}}>
    <div style={{width:`${pct}%`,height:"100%",background:pColor(pct),borderRadius:99,transition:"width .4s"}}/>
  </div>;
}
function Card({children,style={}}){
  return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;
}
function Lbl({children}){
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:5}}>{children}</div>;
}
function Inp({style={},...p}){
  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}/>;
}
function Sel({style={},children,...p}){
  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",
    background:"#f8fafc",color:"#1e293b",fontSize:13,...style}} {...p}>{children}</select>;
}
function Btn({children,color="#2563eb",outline=false,style={},...p}){
  return <button style={{padding:"8px 18px",borderRadius:8,
    border:outline?`1.5px solid ${color}`:"none",cursor:"pointer",
    background:outline?"transparent":color,color:outline?color:"#fff",
    fontWeight:700,fontSize:13,...style}} {...p}>{children}</button>;
}
function STitle({children,style={}}){
  return <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",
    letterSpacing:.5,marginBottom:12,...style}}>{children}</div>;
}
function Modal({children,onClose,title,width=480}){
  return(
    <div style={{position:"fixed",inset:0,background:"#00000060",
      zIndex:1000,overflowY:"auto"}}>
      <div style={{background:"#fff",borderRadius:16,width:`min(${width}px,96%)`,
        boxShadow:"0 20px 60px #00000030",margin:"80px auto 40px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"16px 20px",borderBottom:"1px solid #f1f5f9",borderRadius:"16px 16px 0 0",background:"#fff",zIndex:1}}>
          <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
        </div>
        <div style={{padding:20}}>{children}</div>
      </div>
    </div>
  );
}

// compute progress % for a WP (all komponen in WP across all proses for that divisi)
const wpProgress=(panelData,wp,proses)=>{
  if(!panelData)return 0;
  const cfg=PANEL_TYPES[panelData.tipe];
  const wpDef=cfg?.wps.find(w=>w.wp===wp);
  if(!wpDef)return 0;
  const items=wpDef.items;
  if(!items.length)return 0;
  const total=items.length;
  const done=items.filter(it=>{
    const cl=panelData.checklist[it.kode];
    if(!cl||cl.qty===0)return false;
    const divisiProses=DIVISI_PROSES_MAP[proses]||[proses];
    return divisiProses.every(pr=>getLatestProgress(cl,pr)>=100);
  }).length;
  return Math.round((done/total)*100);
};

// ─────────────────────────────────────────────────────────────────────────────
// MASTER PEKERJA
// ─────────────────────────────────────────────────────────────────────────────
function MasterPekerja({pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,user}){
  const [form,setForm]=useState({nama:"",divisi:"mekanik"});
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [filterDiv,setFilterDiv]=useState("ALL");
  const [search,setSearch]=useState("");

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>OPERATOR_ROLES.includes(k))
    .map(([k,v])=>({key:k,...v}));

  const filtered=pekerja.filter(p=>
    (filterDiv==="ALL"||p.divisi===filterDiv)&&
    p.nama.toLowerCase().includes(search.toLowerCase())
  );

  const save=async()=>{
    if(!form.nama.trim())return;
    if(editId){
      await updatePekerja(editId,{nama:form.nama.trim(),divisi:form.divisi});
      setEditId(null);
    } else {
      await createPekerja({nama:form.nama.trim(),divisi:form.divisi});
    }
    setForm({nama:"",divisi:"mekanik"});
  };

  const startEdit=(p)=>{setEditId(p.id);setForm({nama:p.nama,divisi:p.divisi});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",divisi:"mekanik"});};

  const byDiv=operatorDivisi.map(d=>({
    ...d, count:pekerja.filter(p=>p.divisi===d.key).length
  }));

  return(
    <div className="fi">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:20}}>
        {byDiv.map(d=>(
          <Card key={d.key} style={{padding:"12px 14px",borderLeft:`3px solid ${d.color}`,cursor:"pointer",
            background:filterDiv===d.key?d.bg:"#fff"}}
            onClick={()=>setFilterDiv(filterDiv===d.key?"ALL":d.key)}>
            <div style={{fontSize:18,marginBottom:4}}>{d.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:d.color}}>{d.count}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3}}>{d.label}</div>
          </Card>
        ))}
      </div>

      <Card style={{marginBottom:18}}>
        <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>
          {editId?"✏️ Edit Pekerja":"➕ Tambah Pekerja Baru"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:200}}>
            <Lbl>Nama Lengkap</Lbl>
            <Inp value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})}
              placeholder="Nama pekerja..." onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:180}}>
            <Lbl>Divisi</Lbl>
            <Sel value={form.divisi} onChange={e=>setForm({...form,divisi:e.target.value})}>
              {operatorDivisi.map(d=><option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
            </Sel>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save} style={{padding:"9px 20px"}}>
              {editId?"Simpan":"+ Tambah"}
            </Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit} style={{padding:"9px 16px"}}>Batal</Btn>}
          </div>
        </div>
      </Card>

      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama pekerja..."
          style={{padding:"8px 14px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"#fff",
            fontSize:13,width:260,color:"#1e293b"}}/>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button onClick={()=>setFilterDiv("ALL")}
            style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${filterDiv==="ALL"?"#1d4ed8":"#e2e8f0"}`,
              background:filterDiv==="ALL"?"#1d4ed8":"#fff",color:filterDiv==="ALL"?"#fff":"#64748b",
              cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({pekerja.length})</button>
          {operatorDivisi.map(d=>(
            <button key={d.key} onClick={()=>setFilterDiv(filterDiv===d.key?"ALL":d.key)}
              style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${filterDiv===d.key?d.color:"#e2e8f0"}`,
                background:filterDiv===d.key?d.color+"18":"#fff",color:filterDiv===d.key?d.color:"#64748b",
                cursor:"pointer",fontSize:11,fontWeight:700}}>{d.label} ({pekerja.filter(p=>p.divisi===d.key).length})</button>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
        {filtered.map(p=>{
          const dc=DIVISI_CONFIG[p.divisi];
          return(
            <div key={p.id} style={{background:"#fff",borderRadius:12,border:`1px solid ${editId===p.id?dc.color+"60":"#e2e8f0"}`,
              padding:"12px 14px",display:"flex",alignItems:"center",gap:12,
              boxShadow:editId===p.id?`0 0 0 2px ${dc.color}30`:"none",transition:"all .15s"}}>
              <div style={{width:40,height:40,borderRadius:10,background:dc.bg,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{dc.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:3}}>{p.nama}</div>
                <span style={{background:dc.bg,color:dc.color,border:`1px solid ${dc.color}30`,
                  borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{dc.label}</span>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>startEdit(p)}
                  style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:7,
                    padding:"5px 9px",cursor:"pointer",fontSize:12,color:"#475569"}}>✏️</button>
                <button onClick={()=>setDelId(p.id)}
                  style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,
                    padding:"5px 9px",cursor:"pointer",fontSize:12,color:"#dc2626"}}>🗑</button>
              </div>
            </div>
          );
        })}
        {filtered.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:"40px",color:"#94a3b8",fontSize:13}}>
            Tidak ada pekerja ditemukan
          </div>
        )}
      </div>

      {delId&&(
        <Modal title="Hapus Pekerja?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Pekerja <strong>{pekerja.find(p=>p.id===delId)?.nama}</strong> akan dihapus dari database.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={async()=>{
              const pkr=pekerja.find(p=>p.id===delId);
              await removePekerja(delId);
              setPekerja(prev=>prev.filter(p=>p.id!==delId));
              await createLog(user?.name||user?.nama||"Admin","pekerja","delete","Hapus pekerja "+(pkr?.nama||""),"","Master Pekerja");
              setDelId(null);
            }}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING PEKERJA
// ─────────────────────────────────────────────────────────────────────────────
function TrackingPekerja({pekerja,renhar}){
  const [selPekerja,setSelPekerja]=useState(null);
  const [filterDiv,setFilterDiv]=useState("ALL");

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>OPERATOR_ROLES.includes(k))
    .map(([k,v])=>({key:k,...v}));

  const filtered=pekerja.filter(p=>filterDiv==="ALL"||p.divisi===filterDiv);

  const tugasPerPekerja=(pkrId)=>{
    const pkr=pekerja.find(p=>p.id===pkrId);
    if(!pkr)return[];
    return renhar.filter(r=>r.divisi===pkr.divisi&&(r.pekerja||[]).includes(pkrId));
  };

  const totalTugas=(pkrId)=>tugasPerPekerja(pkrId).length;

  const allTugas=selPekerja?tugasPerPekerja(selPekerja):[];
  const selPkr=pekerja.find(p=>p.id===selPekerja);
  const dc=selPkr?DIVISI_CONFIG[selPkr.divisi]:null;

  return(
    <div className="fi" style={{display:"grid",gridTemplateColumns:selPekerja?"1fr 1fr":"1fr",gap:16}}>
      <div>
        <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
          <button onClick={()=>setFilterDiv("ALL")}
            style={{padding:"5px 14px",borderRadius:20,border:`1.5px solid ${filterDiv==="ALL"?"#1d4ed8":"#e2e8f0"}`,
              background:filterDiv==="ALL"?"#1d4ed8":"#fff",color:filterDiv==="ALL"?"#fff":"#64748b",
              cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
          {operatorDivisi.map(d=>(
            <button key={d.key} onClick={()=>setFilterDiv(d.key)}
              style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${filterDiv===d.key?d.color:"#e2e8f0"}`,
                background:filterDiv===d.key?d.color+"18":"#fff",color:filterDiv===d.key?d.color:"#64748b",
                cursor:"pointer",fontSize:11,fontWeight:700}}>{d.label}</button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(p=>{
            const dc=DIVISI_CONFIG[p.divisi];
            const jml=totalTugas(p.id);
            const isSel=selPekerja===p.id;
            return(
              <div key={p.id} onClick={()=>setSelPekerja(isSel?null:p.id)}
                style={{background:isSel?dc.bg:"#fff",borderRadius:12,border:`1.5px solid ${isSel?dc.color:"#e2e8f0"}`,
                  padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",
                  transition:"all .15s"}}>
                <div style={{width:40,height:40,borderRadius:10,background:isSel?"#fff":dc.bg,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{dc.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{p.nama}</div>
                  <div style={{fontSize:11,color:dc.color,fontWeight:600,marginTop:2}}>{dc.label}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:22,fontWeight:800,color:jml>0?dc.color:"#cbd5e1",fontFamily:"'DM Mono',monospace"}}>{jml}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>tugas</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selPekerja&&selPkr&&(
        <div>
          <Card style={{marginBottom:12,borderLeft:`3px solid ${dc.color}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
              <div style={{width:44,height:44,borderRadius:12,background:dc.bg,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{dc.icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{selPkr.nama}</div>
                <Badge label={dc.label} color={dc.color}/>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
              <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:dc.color}}>{allTugas.length}</div>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>TOTAL TUGAS</div>
              </div>
              <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontSize:24,fontWeight:800,color:"#16a34a"}}>{[...new Set(allTugas.map(t=>t.tanggal))].length}</div>
                <div style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>HARI KERJA</div>
              </div>
            </div>
          </Card>
          <div style={{fontWeight:700,fontSize:12,color:"#64748b",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>
            Riwayat Tugas
          </div>
          {allTugas.length===0?(
            <div style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13,background:"#f8fafc",borderRadius:12}}>
              Belum ada tugas yang didistribusi ke pekerja ini
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {allTugas.sort((a,b)=>b.tanggal.localeCompare(a.tanggal)).map((t,i)=>{
                const pc=PROSES_COLOR[t.proses]||"#64748b";
                const wc=WP_COLOR[t.wp]||"#64748b";
                return(
                  <div key={i} style={{background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>{fmtDate(t.tanggal)}</div>
                      <div style={{display:"flex",gap:5}}>
                        <Badge label={t.proses} color={pc}/>
                        <span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:700}}>{t.wp}</span>
                      </div>
                    </div>
                    <div style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{t.proyek}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{t.panel}</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                      {(t.komponen||[]).map(k=>(
                        <span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{k}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RENCANA HARIAN
// ─────────────────────────────────────────────────────────────────────────────
function RencanaHarian({rawData,woData,renhar,setRenhar,pekerja,createRenhar,updateRenhar,removeRenhar,logActivity,user}){
  const [selDate,setSelDate]=useState(TODAY);
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selProses,setSelProses]=useState("ALL");
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const allTasks=useMemo(()=>{
    const tasks=[];
    rawData.forEach(row=>{
      const entries=row.schedule?.[selDate]||[];
      entries.forEach(e=>{
        tasks.push({
          rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
          proyek:row.proyek,panel:row.panel,proses:row.proses,
          prioritas:row.prioritas||"Sedang",
          wp:e.wp,komponen:e.komponen,tanggal:selDate,
        });
      });
    });
    return tasks;
  },[rawData,selDate]);
  const filteredTasks=selProses==="ALL"?allTasks:allTasks.filter(t=>t.proses===selProses);
  const byProses=useMemo(()=>{
    const map={};
    filteredTasks.forEach(t=>{if(!map[t.proses])map[t.proses]=[];map[t.proses].push(t);});
    return map;
  },[filteredTasks]);
  const taskCountByDay=useMemo(()=>{
    const map={};
    days.forEach(d=>{let count=0;rawData.forEach(row=>{const e=row.schedule?.[d]||[];count+=e.length;});map[d]=count;});
    return map;
  },[days,rawData]);
  const getRenharEntry=(task)=>renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal);
  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=getRenharEntry(task);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };
  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi,existing}=assignModal;
    if(existing){
      await updateRenhar(existing.id,{pekerja:selPekerja});
      setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r));
    } else {
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:selPekerja,
      });
      if(result?.success&&result.data){
        setRenhar(prev=>[...prev,result.data]);
        await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
      }
    }
    await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
    setAssignModal(null);setSelPekerja([]);
  };
  const distributeAll=async()=>{
    for(const task of filteredTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      if(getRenharEntry(task))continue;
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:[],
      });
      if(result?.success&&result.data){
        setRenhar(prev=>[...prev,result.data]);
        await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
      }
    }
  };
  const isDist=(task)=>!!getRenharEntry(task);
  const distCount=filteredTasks.filter(isDist).length;
  const allDist=filteredTasks.length>0&&distCount===filteredTasks.length;
  return(
    <div className="fi">
      <Card style={{marginBottom:14,padding:"12px 16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,-7))}>{"◀"}</Btn>
          <button onClick={()=>{setWeekStart(TODAY);setSelDate(TODAY);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:700,color:"#64748b",cursor:"pointer"}}>Hari Ini</button>
          <Btn outline color="#2563eb" style={{padding:"5px 12px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,7))}>{"▶"}</Btn>
          <span style={{fontSize:13,fontWeight:700,color:"#1e293b",marginLeft:4}}>{fmtShort(weekStart)} — {fmtShort(addDays(weekStart,6))}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
          {days.map(d=>{
            const isSel=d===selDate;const isToday=d===TODAY;const cnt=taskCountByDay[d]||0;
            return(
              <button key={d} onClick={()=>setSelDate(d)}
                style={{padding:"8px 4px",borderRadius:10,border:`2px solid ${isSel?"#2563eb":isToday?"#93c5fd":"#e2e8f0"}`,
                  background:isSel?"#2563eb":isToday?"#eff6ff":"#fff",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:10,fontWeight:600,color:isSel?"#fff":isToday?"#2563eb":"#94a3b8",marginBottom:2}}>{getDayLabel(d).split(" ")[0]}</div>
                <div style={{fontSize:14,fontWeight:800,color:isSel?"#fff":isToday?"#1d4ed8":"#1e293b"}}>{getDayLabel(d).split(" ")[1]||d.slice(8)}</div>
                {cnt>0&&<div style={{marginTop:4,background:isSel?"#ffffff33":"#2563eb",borderRadius:20,padding:"1px 6px",fontSize:9,fontWeight:700,color:"#fff",display:"inline-block"}}>{cnt}</div>}
              </button>
            );
          })}
        </div>
      </Card>
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{fontWeight:800,fontSize:15,color:"#1e293b"}}>📅 {fmtDateFull(selDate)}</div>
        <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {filteredTasks.length>0&&<span style={{fontSize:12,color:"#64748b"}}>{distCount}/{filteredTasks.length} terdistribusi</span>}
          {!allDist&&filteredTasks.length>0&&<Btn color="#16a34a" style={{fontSize:12,padding:"6px 16px"}} onClick={distributeAll}>✓ Distribusi Semua</Btn>}
          {allDist&&filteredTasks.length>0&&<span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"4px 14px",fontSize:12,fontWeight:700}}>✅ Semua Terdistribusi</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={()=>setSelProses("ALL")} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${selProses==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:selProses==="ALL"?"#1d4ed8":"#fff",color:selProses==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({allTasks.length})</button>
        {ALL_PROSES.filter(pr=>allTasks.some(t=>t.proses===pr)).map(pr=>{
          const pc=PROSES_COLOR[pr]||"#64748b";const cnt=allTasks.filter(t=>t.proses===pr).length;const isSel=selProses===pr;
          return(<button key={pr} onClick={()=>setSelProses(isSel?"ALL":pr)} style={{padding:"4px 14px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr} ({cnt})</button>);
        })}
      </div>
      {filteredTasks.length===0&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📭</div>
          <div style={{fontSize:14,fontWeight:600}}>Tidak ada pekerjaan pada tanggal ini</div>
          <div style={{fontSize:12,marginTop:4}}>Tambahkan jadwal di Raw Schedule terlebih dahulu</div>
        </div>
      )}
      {Object.keys(byProses).map(proses=>{
        const tasks=byProses[proses]||[];
        const pc=PROSES_COLOR[proses]||"#64748b";
        const divisiKey=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(proses))?.[0];
        const dc=divisiKey?DIVISI_CONFIG[divisiKey]:null;
        const distTasks=tasks.filter(isDist).length;
        const thS={background:"#1e3a8a",color:"#fff",padding:"9px 10px",fontWeight:700,fontSize:11,whiteSpace:"nowrap",textAlign:"left",position:"sticky",top:0,borderRight:"1px solid #ffffff18"};
        return(
          <div key={proses} style={{marginBottom:20}}>
            <div style={{background:pc,borderRadius:"10px 10px 0 0",padding:"10px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontWeight:900,fontSize:15,color:"#fff"}}>{proses}</span>
                {dc&&<span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{dc.icon} {dc.label}</span>}
                <span style={{background:"#ffffff25",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{tasks.length} tugas</span>
              </div>
              <span style={{fontSize:11,color:"#ffffff99",fontWeight:600}}>{distTasks}/{tasks.length} terdistribusi</span>
            </div>
            <div style={{overflowX:"auto",border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 10px 10px"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr>
                    <th style={{...thS,minWidth:40,textAlign:"center"}}>No</th>
                    <th style={{...thS,minWidth:130}}>Proyek</th>
                    <th style={{...thS,minWidth:200}}>Nama Panel</th>
                    <th style={{...thS,minWidth:60,textAlign:"center"}}>WP</th>
                    <th style={{...thS,minWidth:80,textAlign:"center"}}>Prioritas</th>
                    <th style={{...thS,minWidth:250}}>Komponen</th>
                    <th style={{...thS,minWidth:160}}>Operator</th>
                    <th style={{...thS,minWidth:110,textAlign:"center"}}>Status</th>
                    <th style={{...thS,minWidth:120,textAlign:"center"}}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t,i)=>{
                    const dist=isDist(t);const rh=getRenharEntry(t);
                    const workers=(rh?.pekerja||[]).map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean);
                    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
                    const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
                    const wc=WP_COLOR[t.wp]||"#64748b";const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
                    const rBg=i%2===0?"#fff":"#f8fafc";
                    const td={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:dist?"#f0fdf4":rBg,verticalAlign:"middle"};
                    return(
                      <tr key={i}>
                        <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{i+1}</td>
                        <td style={{...td,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                        <td style={{...td,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                        <td style={{...td,textAlign:"center"}}><span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span></td>
                        <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                        <td style={{...td}}>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return(<span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>);})}
                          </div>
                        </td>
                        <td style={{...td}}>
                          {workers.length>0?(
                            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{workers.map(n=>(<span key={n} style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {n}</span>))}</div>
                          ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum diassign</span>)}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          {dist?<span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✅ Terdistribusi</span>
                            :<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>⏳ Belum</span>}
                        </td>
                        <td style={{...td,textAlign:"center"}}>
                          <Btn color={dist?"#0891b2":"#2563eb"} style={{fontSize:11,padding:"5px 14px"}} onClick={()=>openAssign(t)}>{dist?"👥 Edit":"👤 Distribusi"}</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {assignModal&&(()=>{
        const{task,divisi,existing}=assignModal;const dc=DIVISI_CONFIG[divisi];
        const pekerjaDivisi=pekerja.filter(p=>p.divisi===divisi);
        return(
          <Modal title={(assignModal.isExisting?"Edit":"Distribusi")+" — "+task.proses} onClose={()=>{setAssignModal(null);setSelPekerja([]);}} width={460}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:4}}>{task.proyek} · {task.panel}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
              <Badge label={task.proses} color={PROSES_COLOR[task.proses]||"#64748b"}/>
              <Badge label={task.wp} color={WP_COLOR[task.wp]||"#64748b"}/>
              {dc&&<Badge label={dc.label} color={dc.color}/>}
              <Badge label={task.prioritas} color={PRIORITAS_COLOR[task.prioritas]||"#64748b"}/>
            </div>
            <Lbl>{"Pilih Operator ("+(dc?.label||divisi)+")"}</Lbl>
            {pekerjaDivisi.length===0?(
              <div style={{padding:"16px",background:"#f8fafc",borderRadius:8,fontSize:12,color:"#94a3b8",textAlign:"center"}}>Belum ada pekerja di divisi ini.</div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
                {pekerjaDivisi.map(p=>{
                  const isSel=selPekerja.includes(p.id);
                  return(
                    <div key={p.id} onClick={()=>setSelPekerja(prev=>isSel?prev.filter(id=>id!==p.id):[...prev,p.id])}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,cursor:"pointer",border:`1.5px solid ${isSel?(dc?.color||"#2563eb"):"#e2e8f0"}`,background:isSel?(dc?.bg||"#eff6ff"):"#f8fafc",transition:"all .15s"}}>
                      <div style={{width:28,height:28,borderRadius:8,background:isSel?(dc?.color||"#2563eb"):(dc?.bg||"#eff6ff"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0,color:isSel?"#fff":(dc?.color||"#2563eb")}}>{isSel?"✓":(dc?.icon||"👤")}</div>
                      <span style={{fontWeight:isSel?700:500,fontSize:13,color:isSel?(dc?.color||"#2563eb"):"#475569"}}>{p.nama}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {selPekerja.length>0&&(
              <div style={{padding:"8px 12px",background:"#f0fdf4",borderRadius:8,marginBottom:14,fontSize:12,color:"#16a34a",fontWeight:600}}>
                ✓ {selPekerja.length} operator dipilih: {selPekerja.map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean).join(", ")}
              </div>
            )}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <Btn outline color="#64748b" onClick={()=>{setAssignModal(null);setSelPekerja([]);}}>Batal</Btn>
              <Btn color="#1d4ed8" onClick={confirmDistribute}>{assignModal.isExisting?"Simpan":"Distribusi"}</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}


function MasterUser({logActivity,user}:any){
  const [admins,setAdmins]=useState<any[]>([]);
  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'admin'|'pekerja'>('admin');
  const [modal,setModal]=useState<any>(null);
  const [form,setForm]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [delId,setDelId]=useState<any>(null);
  const [delType,setDelType]=useState<'admin'|'pekerja'>('admin');

  const loadData=async()=>{
    setLoading(true);
    const [{data:a},{data:p}]=await Promise.all([
      supabase.from('admins').select('*').order('nama'),
      supabase.from('pekerja').select('*').order('divisi'),
    ]);
    setAdmins(a??[]);
    setPekerjaList(p??[]);
    setLoading(false);
  };

  useEffect(()=>{loadData();},[]);

  const openAdd=(type:'admin'|'pekerja')=>{
    setModal({type,mode:'add'});
    setForm(type==='admin'?{nama:'',username:'',password:'',is_active:true}:{nama:'',divisi:'mekanik',username:'',password:''});
  };

  const openEdit=(type:'admin'|'pekerja',item:any)=>{
    setModal({type,mode:'edit',id:item.id});
    setForm(type==='admin'
      ?{nama:item.nama,username:item.username,password:item.password,is_active:item.is_active}
      :{nama:item.nama,divisi:item.divisi,username:item.username||'',password:item.password||''}
    );
  };

  const save=async()=>{
    if(!modal)return;
    setSaving(true);
    const{type,mode,id}=modal;
    if(type==='admin'){
      if(mode==='add'){
        const{error}=await supabase.from('admins').insert({nama:form.nama,username:form.username,password:form.password,is_active:form.is_active??true,avatar:'👨‍💼'});
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','create','Tambah admin '+form.nama,'','Master User');
      } else {
        const{error}=await supabase.from('admins').update({nama:form.nama,username:form.username,password:form.password,is_active:form.is_active}).eq('id',id);
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','update','Edit admin '+form.nama,'','Master User');
      }
    } else {
      if(mode==='add'){
        const{error}=await supabase.from('pekerja').insert({nama:form.nama,divisi:form.divisi,username:form.username||null,password:form.password||null});
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','create','Tambah pekerja '+form.nama,'','Master User');
      } else {
        const{error}=await supabase.from('pekerja').update({nama:form.nama,divisi:form.divisi,username:form.username||null,password:form.password||null}).eq('id',id);
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','update','Edit pekerja '+form.nama,'','Master User');
      }
    }
    await loadData();
    setModal(null);
    setSaving(false);
  };

  const confirmDelete=async()=>{
    if(!delId)return;
    if(delType==='admin'){
      await supabase.from('admins').delete().eq('id',delId);
      await createLog(user?.name||user?.nama||'Admin','pekerja','delete','Hapus admin','','Master User');
    } else {
      await supabase.from('pekerja').delete().eq('id',delId);
      await createLog(user?.name||user?.nama||'Admin','pekerja','delete','Hapus pekerja','','Master User');
    }
    await loadData();
    setDelId(null);
  };

  const DIVISI_OPTS=Object.entries(DIVISI_CONFIG).filter(([k])=>k!=='admin').map(([k,v]:any)=>({key:k,label:v.label,icon:v.icon}));

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Tab */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['admin','pekerja'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'8px 24px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,
              background:tab===t?'#1d4ed8':'#f1f5f9',color:tab===t?'#fff':'#64748b',transition:'all .15s'}}>
            {t==='admin'?'⚙️ Admin':'👷 Pekerja'}
          </button>
        ))}
        <button onClick={()=>openAdd(tab)}
          style={{marginLeft:'auto',padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,background:'#16a34a',color:'#fff'}}>
          + Tambah {tab==='admin'?'Admin':'Pekerja'}
        </button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #2563eb'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#2563eb'}}>{admins.length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Total Admin</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #16a34a'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#16a34a'}}>{admins.filter(a=>a.is_active).length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Admin Aktif</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #f59e0b'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#f59e0b'}}>{pekerjaList.length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Total Pekerja</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #8b5cf6'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#8b5cf6'}}>{pekerjaList.filter(p=>p.password).length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Sudah Password</div>
        </Card>
      </div>

      {/* Admin Table */}
      {tab==='admin'&&(
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{background:'#1e3a8a',padding:'10px 16px'}}>
            <span style={{fontWeight:800,fontSize:14,color:'#fff'}}>⚙️ Daftar Admin</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
            <thead>
              <tr>
                {['No','Nama','Username','Password','Status','Terakhir Login','Aksi'].map(h=>(
                  <th key={h} style={{background:'#f8fafc',padding:'8px 12px',fontWeight:700,color:'#64748b',
                    fontSize:11,textAlign:'left' as const,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a,i)=>(
                <tr key={a.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={{padding:'10px 12px',color:'#94a3b8'}}>{i+1}</td>
                  <td style={{padding:'10px 12px',fontWeight:700,color:'#1e293b'}}>{a.avatar||'👨‍💼'} {a.nama}</td>
                  <td style={{padding:'10px 12px',fontFamily:"'DM Mono',monospace",color:'#475569'}}>{a.username}</td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{background:'#f1f5f9',borderRadius:6,padding:'2px 10px',fontFamily:"'DM Mono',monospace",fontSize:11,color:'#475569'}}>
                      {'•'.repeat(Math.min(a.password?.length||0,8))}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{background:a.is_active?'#f0fdf4':'#fef2f2',color:a.is_active?'#16a34a':'#dc2626',
                      borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>
                      {a.is_active?'Aktif':'Nonaktif'}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px',color:'#94a3b8',fontSize:11}}>
                    {a.last_login?new Date(a.last_login).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'Belum pernah'}
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>openEdit('admin',a)}
                        style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:11,color:'#475569'}}>✏️</button>
                      <button onClick={()=>{setDelId(a.id);setDelType('admin');}}
                        style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Pekerja Table */}
      {tab==='pekerja'&&(
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{background:'#1e3a8a',padding:'10px 16px'}}>
            <span style={{fontWeight:800,fontSize:14,color:'#fff'}}>👷 Daftar Pekerja</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
            <thead>
              <tr>
                {['No','Nama','Divisi','Username','Password','Aksi'].map(h=>(
                  <th key={h} style={{background:'#f8fafc',padding:'8px 12px',fontWeight:700,color:'#64748b',
                    fontSize:11,textAlign:'left' as const,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pekerjaList.map((p,i)=>{
                const dc=DIVISI_CONFIG[p.divisi];
                return(
                  <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{padding:'10px 12px',color:'#94a3b8'}}>{i+1}</td>
                    <td style={{padding:'10px 12px',fontWeight:700,color:'#1e293b'}}>{p.nama}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{background:dc?.bg||'#f1f5f9',color:dc?.color||'#64748b',borderRadius:20,
                        padding:'2px 10px',fontSize:11,fontWeight:700}}>{dc?.icon} {dc?.label||p.divisi}</span>
                    </td>
                    <td style={{padding:'10px 12px',fontFamily:"'DM Mono',monospace",color:'#475569'}}>
                      {p.username||<span style={{color:'#cbd5e1',fontStyle:'italic'}}>—</span>}
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      {p.password
                        ?<span style={{background:'#f0fdf4',color:'#16a34a',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>✓ Sudah diset</span>
                        :<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>⚠ Belum diset</span>
                      }
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>openEdit('pekerja',p)}
                          style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:11,color:'#475569'}}>✏️</button>
                        <button onClick={()=>{setDelId(p.id);setDelType('pekerja');}}
                          style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Add/Edit */}
      {modal&&(
        <Modal title={(modal.mode==='add'?'Tambah':'Edit')+(modal.type==='admin'?' Admin':' Pekerja')} onClose={()=>setModal(null)} width={440}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Nama Lengkap</Lbl>
              <Inp value={form.nama||''} onChange={(e:any)=>setForm({...form,nama:e.target.value})} placeholder="Nama..."/>
            </div>
            {modal.type==='pekerja'&&(
              <div><Lbl>Divisi</Lbl>
                <Sel value={form.divisi||'mekanik'} onChange={(e:any)=>setForm({...form,divisi:e.target.value})}>
                  {DIVISI_OPTS.map(d=><option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
                </Sel>
              </div>
            )}
            <div><Lbl>Username</Lbl>
              <Inp value={form.username||''} onChange={(e:any)=>setForm({...form,username:e.target.value})} placeholder="username..."/>
            </div>
            <div><Lbl>Password</Lbl>
              <Inp type="text" value={form.password||''} onChange={(e:any)=>setForm({...form,password:e.target.value})} placeholder="password..."/>
            </div>
            {modal.type==='admin'&&(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="checkbox" checked={form.is_active??true} onChange={(e:any)=>setForm({...form,is_active:e.target.checked})} id="isActive"/>
                <label htmlFor="isActive" style={{fontSize:13,color:'#475569',fontWeight:600}}>Akun Aktif</label>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={save}>{saving?'Menyimpan...':modal.mode==='add'?'Tambah':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Delete */}
      {delId&&(
        <Modal title="Hapus User?" onClose={()=>setDelId(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Data tidak dapat dikembalikan.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={confirmDelete}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Toast Notification System
const ToastContext = React.createContext(null);

function ToastProvider({children, currentUser}:any){
  const [toasts,setToasts]=useState<any[]>([]);

  useEffect(()=>{
    if(!currentUser) return;
    const channel = supabase
      .channel('toast-activity')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_log'},
        (payload:any)=>{
          const log = payload.new;
          // Hanya tampilkan notif dari admin LAIN
          const logAdmin = log.admin_nama||log.user_name||'';
          const myName = currentUser?.name||currentUser?.nama||'';
          if(!logAdmin||logAdmin===myName||logAdmin==='System') return;
          
          const MODULE_ICON:any={wo:'📋',raw:'📅',rencana:'📊',pekerja:'👥',auth:'🔐',kendala:'⚠️',raw_schedule:'📅',general:'⚙️'};
          const icon = MODULE_ICON[log.module||log.jenis]||'⚙️';
          
          const toast = {
            id: Date.now(),
            icon,
            admin: logAdmin,
            message: log.description||log.aktivitas||log.action||'Melakukan perubahan',
            module: log.module||log.jenis||'',
            time: new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),
          };
          setToasts(prev=>{
            const next = [toast,...prev].slice(0,3);
            return next;
          });
          // Auto remove setelah 5 detik
          setTimeout(()=>{
            setToasts(prev=>prev.filter(t=>t.id!==toast.id));
          },5000);
        }
      )
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[currentUser]);

  const removeToast=(id:number)=>setToasts(prev=>prev.filter(t=>t.id!==id));

  return(
    <ToastContext.Provider value={{toasts,removeToast}}>
      {children}
      {/* Toast Container */}
      <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:10,maxWidth:360}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:'#fff',borderRadius:14,padding:'12px 16px',
            boxShadow:'0 8px 32px #00000020',border:'1px solid #e2e8f0',
            borderLeft:`4px solid #2563eb`,
            display:'flex',gap:12,alignItems:'flex-start',
            animation:'slideInRight .3s ease'}}>
            <div style={{fontSize:20,flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:12,color:'#1e293b',marginBottom:2}}>
                👤 {t.admin}
              </div>
              <div style={{fontSize:12,color:'#475569',lineHeight:1.4}}>{t.message}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{t.time} WIB</div>
            </div>
            <button onClick={()=>removeToast(t.id)}
              style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:16,padding:0,flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastContext.Provider>
  );
}

function RecycleBin({user}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState('ALL');

  const load=async()=>{
    setLoading(true);
    const [wo,raw,pkr,rnh]=await Promise.all([
      supabase.from('work_orders').select('*').not('deleted_at','is',null),
      supabase.from('raw_schedule').select('*').not('deleted_at','is',null),
      supabase.from('pekerja').select('*').not('deleted_at','is',null),
      supabase.from('renhar').select('*').not('deleted_at','is',null),
    ]);
    const all=[
      ...(wo.data||[]).map(i=>({...i,_type:'wo',_label:'Work Order',_name:i.wo+' - '+i.proyek})),
      ...(raw.data||[]).map(i=>({...i,_type:'raw',_label:'Raw Schedule',_name:i.proses+' - '+i.panel})),
      ...(pkr.data||[]).map(i=>({...i,_type:'pekerja',_label:'Pekerja',_name:i.nama})),
      ...(rnh.data||[]).map(i=>({...i,_type:'renhar',_label:'Rencana Harian',_name:i.proses+' - '+i.panel})),
    ].sort((a,b)=>new Date(b.deleted_at).getTime()-new Date(a.deleted_at).getTime());
    setItems(all);
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const restore=async(item:any)=>{
    await supabase.from(
      item._type==='wo'?'work_orders':
      item._type==='raw'?'raw_schedule':
      item._type==='pekerja'?'pekerja':'renhar'
    ).update({deleted_at:null,deleted_by:null}).eq('id',item.id);
    await load();
  };

  const deletePermanent=async(item:any)=>{
    await supabase.from(
      item._type==='wo'?'work_orders':
      item._type==='raw'?'raw_schedule':
      item._type==='pekerja'?'pekerja':'renhar'
    ).delete().eq('id',item.id);
    await load();
  };

  const TYPE_COLOR:any={wo:'#2563eb',raw:'#f59e0b',pekerja:'#0891b2',renhar:'#10b981'};
  const filtered=filter==='ALL'?items:items.filter(i=>i._type===filter);

  const fmtDate=(d:string)=>new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const daysLeft=(d:string)=>Math.max(0,15-Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24)));

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat...</div>;

  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap' as const,alignItems:'center'}}>
        {['ALL','wo','raw','pekerja','renhar'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${filter===f?(TYPE_COLOR[f]||'#1d4ed8'):'#e2e8f0'}`,
              background:filter===f?(TYPE_COLOR[f]||'#1d4ed8')+'18':'#fff',
              color:filter===f?(TYPE_COLOR[f]||'#1d4ed8'):'#64748b',
              cursor:'pointer',fontSize:12,fontWeight:700}}>
            {f==='ALL'?'Semua':f==='wo'?'Work Order':f==='raw'?'Raw Schedule':f==='pekerja'?'Pekerja':'Rencana Harian'}
            {' '}({f==='ALL'?items.length:items.filter(i=>i._type===f).length})
          </button>
        ))}
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
          <div style={{fontSize:40,marginBottom:12}}>🗑</div>
          <div style={{fontSize:14,fontWeight:600}}>Recycle Bin Kosong</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
          {filtered.map((item:any)=>{
            const c=TYPE_COLOR[item._type]||'#64748b';
            const days=daysLeft(item.deleted_at);
            return(
              <div key={item._type+item.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',
                padding:'12px 16px',borderLeft:`4px solid ${c}`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{item._name}</div>
                  <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap' as const}}>
                    <span style={{background:c+'18',color:c,borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:700}}>{item._label}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>Dihapus: {fmtDate(item.deleted_at)}</span>
                    {item.deleted_by&&<span style={{fontSize:11,color:'#94a3b8'}}>oleh {item.deleted_by}</span>}
                    <span style={{fontSize:11,color:days<=3?'#dc2626':'#f59e0b',fontWeight:700}}>⏱ {days} hari tersisa</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <Btn color="#16a34a" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>restore(item)}>↩ Pulihkan</Btn>
                  <Btn color="#dc2626" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>deletePermanent(item)}>🗑 Hapus</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SystemTab({user,logActivity,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja}:any){
  const [subTab,setSubTab]=useState('masteruser');
  const SUB_TABS=[
    {id:'masteruser',label:'👤 Master User'},
    {id:'pekerja',label:'👥 Master Pekerja'},
    {id:'tracking',label:'📈 Tracking Pekerja'},
    {id:'maintenance',label:'🔧 Maintenance'},
    {id:'activity',label:'📊 Activity Log'},
    {id:'recycle',label:'🗑 Recycle Bin'},
  ];
  return(
    <div className="fi">
      <div style={{display:'flex',gap:8,marginBottom:16,borderBottom:'2px solid #e2e8f0',paddingBottom:8}}>
        {SUB_TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:'8px 20px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',
              fontWeight:700,fontSize:13,
              background:subTab===t.id?'#1d4ed8':'transparent',
              color:subTab===t.id?'#fff':'#64748b',
              borderBottom:subTab===t.id?'2px solid #1d4ed8':'none',
              transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab==='masteruser'&&<MasterUser logActivity={logActivity} user={user}/>}
      {subTab==='pekerja'&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} user={user}/>}
      {subTab==='tracking'&&<TrackingPekerja pekerja={pekerja} renhar={[]}/>}
      {subTab==='maintenance'&&<MaintenanceTab user={user} logActivity={logActivity}/>}
      {subTab==='activity'&&<ActivityLogView activityLog={activityLog} user={user}/>}
      {subTab==='recycle'&&<RecycleBin user={user}/>}
    </div>
  );
}

function ServiceSchedule({machines,user}:any){
  const [schedules,setSchedules]=useState<any[]>([]);
  const [modal,setModal]=useState<any>(null);
  const [form,setForm]=useState<any>({machine_id:'',tanggal_service:'',keterangan:'',status:'Pending',interval_service:'3 bulan'});
  const [saving,setSaving]=useState(false);

  const INTERVAL_LIST=['1 bulan','3 bulan','6 bulan','1 tahun'];
  const INTERVAL_DAYS:any={'1 bulan':30,'3 bulan':90,'6 bulan':180,'1 tahun':365};

  const load=async()=>{
    const{data}=await supabase.from('service_schedule').select('*').order('tanggal_service',{ascending:true});
    setSchedules(data??[]);
  };

  useEffect(()=>{load();},[]);

  const calcNextDate=(lastDate:string,interval:string):string=>{
    const days=INTERVAL_DAYS[interval]||90;
    const d=new Date(lastDate||new Date());
    d.setDate(d.getDate()+days);
    return d.toISOString().slice(0,10);
  };

  const onMachineChange=(machineId:string)=>{
    const machine=machines.find((m:any)=>m.id===Number(machineId));
    const interval=machine?.interval_service||'3 bulan';
    const lastService=machine?.last_service_date||new Date().toISOString().slice(0,10);
    const nextDate=calcNextDate(lastService,interval);
    setForm((prev:any)=>({...prev,machine_id:machineId,interval_service:interval,tanggal_service:nextDate}));
  };

  const save=async()=>{
    if(!form.tanggal_service||!form.machine_id)return;
    setSaving(true);
    const machine=machines.find((m:any)=>m.id===Number(form.machine_id));
    // Update interval di mesin
    await supabase.from('machines').update({interval_service:form.interval_service}).eq('id',Number(form.machine_id));
    const payload={
      machine_id:Number(form.machine_id),
      nama_mesin:machine?.nama_mesin||'',
      tanggal_service:form.tanggal_service,
      keterangan:form.keterangan,
      status:'Pending',
      interval_service:form.interval_service,
      created_by:user?.name||user?.nama||'Admin'
    };
    if(modal.mode==='add'){
      await supabase.from('service_schedule').insert(payload);
    } else {
      await supabase.from('service_schedule').update(payload).eq('id',modal.id);
    }
    await load();
    setModal(null);
    setSaving(false);
  };

  const hapus=async(id:number)=>{
    await supabase.from('service_schedule').delete().eq('id',id);
    await load();
  };

  const markDone=async(s:any)=>{
    // Update status done dan set last_service_date
    await supabase.from('service_schedule').update({status:'Done'}).eq('id',s.id);
    await supabase.from('machines').update({last_service_date:s.tanggal_service}).eq('id',s.machine_id);
    await load();
  };

  const getDiff=(d:string)=>Math.ceil((new Date(d).getTime()-new Date().getTime())/(1000*60*60*24));
  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';

  const upcoming=schedules.filter(s=>{const diff=getDiff(s.tanggal_service);return diff>=0&&diff<=3&&s.status==='Pending';});
  const overdue=schedules.filter(s=>getDiff(s.tanggal_service)<0&&s.status==='Pending');

  return(
    <div style={{marginTop:24}}>
      {/* Alert */}
      {(upcoming.length>0||overdue.length>0)&&(
        <div style={{display:'flex',flexDirection:'column' as const,gap:8,marginBottom:16}}>
          {overdue.length>0&&(
            <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:10,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:18}}>❌</span>
              <div>
                <div style={{fontWeight:700,fontSize:12,color:'#dc2626',marginBottom:2}}>Service Terlambat!</div>
                {overdue.map(s=>(
                  <div key={s.id} style={{fontSize:11,color:'#991b1b'}}>🔧 {s.nama_mesin} — {fmtDate(s.tanggal_service)} <strong>({Math.abs(getDiff(s.tanggal_service))} hari terlambat)</strong></div>
                ))}
              </div>
            </div>
          )}
          {upcoming.length>0&&(
            <div style={{background:'#fffbeb',border:'1.5px solid #fde68a',borderRadius:10,padding:'10px 14px',display:'flex',gap:10,alignItems:'flex-start'}}>
              <span style={{fontSize:18}}>⚠️</span>
              <div>
                <div style={{fontWeight:700,fontSize:12,color:'#f59e0b',marginBottom:2}}>Service Mendekati!</div>
                {upcoming.map(s=>(
                  <div key={s.id} style={{fontSize:11,color:'#92400e'}}>🔧 {s.nama_mesin} — {fmtDate(s.tanggal_service)} <strong>({getDiff(s.tanggal_service)===0?'Hari ini!':getDiff(s.tanggal_service)+' hari lagi'})</strong></div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <div style={{fontWeight:800,fontSize:14,color:'#1e293b'}}>📅 Jadwal Service Rutin</div>
        <Btn color="#1d4ed8" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setModal({mode:'add'});setForm({machine_id:'',tanggal_service:'',keterangan:'',status:'Pending',interval_service:'3 bulan'});}}>+ Tambah Jadwal</Btn>
      </div>

      {schedules.length===0?(
        <div style={{textAlign:'center',padding:'20px',color:'#94a3b8',fontSize:12}}>Belum ada jadwal service</div>
      ):(
        <div style={{background:'#fff',borderRadius:8,border:'1px solid #e2e8f0',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:11}}>
            <thead>
              <tr style={{background:'#1e3a8a'}}>
                {['Mesin','Tanggal Service','Interval','Keterangan','Status',''].map(h=>(
                  <th key={h} style={{padding:'6px 10px',color:'#fff',fontWeight:700,fontSize:10,textAlign:'left' as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s:any,i:number)=>{
                const diff=getDiff(s.tanggal_service);
                const isOverdue=diff<0&&s.status==='Pending';
                const isUrgent=diff>=0&&diff<=3&&s.status==='Pending';
                return(
                  <tr key={s.id} style={{borderBottom:'1px solid #f1f5f9',background:isOverdue?'#fef2f2':isUrgent?'#fffbeb':i%2===0?'#fff':'#f8fafc'}}>
                    <td style={{padding:'6px 10px',fontWeight:600,color:'#1e293b'}}>{s.nama_mesin||'—'}</td>
                    <td style={{padding:'6px 10px',color:'#475569',whiteSpace:'nowrap' as const}}>{fmtDate(s.tanggal_service)}
                      {isOverdue&&<span style={{color:'#dc2626',fontWeight:700,marginLeft:6,fontSize:10}}>({Math.abs(diff)}h terlambat)</span>}
                      {isUrgent&&<span style={{color:'#f59e0b',fontWeight:700,marginLeft:6,fontSize:10}}>({diff===0?'Hari ini':diff+'h lagi'})</span>}
                    </td>
                    <td style={{padding:'6px 10px'}}><span style={{background:'#eff6ff',color:'#2563eb',borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:600}}>{s.interval_service||'—'}</span></td>
                    <td style={{padding:'6px 10px',color:'#64748b',maxWidth:200,overflow:'hidden' as const,textOverflow:'ellipsis' as const,whiteSpace:'nowrap' as const}}>{s.keterangan||'—'}</td>
                    <td style={{padding:'6px 10px'}}>
                      <span style={{background:s.status==='Done'?'#f0fdf4':isOverdue?'#fef2f2':isUrgent?'#fffbeb':'#f1f5f9',color:s.status==='Done'?'#16a34a':isOverdue?'#dc2626':isUrgent?'#f59e0b':'#64748b',borderRadius:4,padding:'1px 6px',fontSize:10,fontWeight:700}}>
                        {s.status==='Done'?'Done':isOverdue?'Overdue':isUrgent?'Segera':s.status}
                      </span>
                    </td>
                    <td style={{padding:'6px 10px'}}>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>{setModal({mode:'edit',id:s.id});setForm({machine_id:s.machine_id||'',tanggal_service:s.tanggal_service||'',keterangan:s.keterangan||'',status:s.status||'Pending',interval_service:s.interval_service||'3 bulan'});}}
                          style={{background:'none',border:'1px solid #e2e8f0',borderRadius:5,padding:'2px 7px',cursor:'pointer',fontSize:10,color:'#64748b'}}>✏️</button>
                        {s.status!=='Done'&&<button onClick={()=>markDone(s)} style={{background:'none',border:'1px solid #bbf7d0',borderRadius:5,padding:'2px 7px',cursor:'pointer',fontSize:10,color:'#16a34a'}}>✅</button>}
                        <button onClick={()=>hapus(s.id)} style={{background:'none',border:'1px solid #fecaca',borderRadius:5,padding:'2px 7px',cursor:'pointer',fontSize:10,color:'#dc2626'}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal&&(
        <Modal title={(modal.mode==='add'?'Tambah':'Edit')+' Jadwal Service'} onClose={()=>setModal(null)} width={460}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Mesin</Lbl>
              <Sel value={form.machine_id} onChange={(e:any)=>onMachineChange(e.target.value)}>
                <option value="">-- Pilih Mesin --</option>
                {machines.map((m:any)=><option key={m.id} value={m.id}>{m.nama_mesin}</option>)}
              </Sel>
            </div>
            <div><Lbl>Interval Service</Lbl>
              <Sel value={form.interval_service} onChange={(e:any)=>{
                setForm((prev:any)=>({...prev,interval_service:e.target.value,tanggal_service:calcNextDate(new Date().toISOString().slice(0,10),e.target.value)}));
              }}>
                {INTERVAL_LIST.map(i=><option key={i} value={i}>{i}</option>)}
              </Sel>
            </div>
            <div><Lbl>Tanggal Service (bisa diedit)</Lbl>
              <Inp type="date" value={form.tanggal_service} onChange={(e:any)=>setForm((prev:any)=>({...prev,tanggal_service:e.target.value}))}/>
            </div>
            <div><Lbl>Keterangan</Lbl>
              <Inp value={form.keterangan} onChange={(e:any)=>setForm((prev:any)=>({...prev,keterangan:e.target.value}))} placeholder="Keterangan service..."/>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={save}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MaintenanceTab({user,logActivity}:any){
  const [machines,setMachines]=useState<any[]>([]);
  const [logs,setLogs]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [selMachine,setSelMachine]=useState<any>(null);
  const [machineModal,setMachineModal]=useState<any>(null);
  const [logModal,setLogModal]=useState<any>(null);
  const [machineForm,setMachineForm]=useState<any>({nama_mesin:'',divisi:'',tipe_mesin:'',status_terakhir:'Normal'});
  const [logForm,setLogForm]=useState<any>({issue_title:'',issue_type:'Mechanical',problem_description:'',repair_action:'',technician:'',status:'Open',priority:'Medium',downtime_hours:0,start_date:'',finish_date:''});
  const [saving,setSaving]=useState(false);
  const [filterStatus,setFilterStatus]=useState('ALL');
  const [filterType,setFilterType]=useState('ALL');
  const [delMachine,setDelMachine]=useState<any>(null);
  const [delLog,setDelLog]=useState<any>(null);

  const STATUS_LIST=['Open','Checking','On Repair','Waiting Sparepart','Trial','Resolved','Closed'];
  const TYPE_LIST=['Mechanical','Electrical','Sensor','Hydraulic','Pneumatic','Software'];
  const PRIORITY_LIST=['Low','Medium','High','Critical'];

  const STATUS_COLOR:any={
    'Open':{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    'Checking':{bg:'#fffbeb',color:'#f59e0b',border:'#fde68a'},
    'On Repair':{bg:'#eff6ff',color:'#2563eb',border:'#bfdbfe'},
    'Waiting Sparepart':{bg:'#f5f3ff',color:'#7c3aed',border:'#ddd6fe'},
    'Trial':{bg:'#ecfeff',color:'#0891b2',border:'#a5f3fc'},
    'Resolved':{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
    'Closed':{bg:'#f8fafc',color:'#64748b',border:'#e2e8f0'},
  };
  const PRIORITY_COLOR:any={
    'Low':'#16a34a','Medium':'#f59e0b','High':'#f97316','Critical':'#dc2626'
  };
  const TYPE_COLOR:any={
    'Mechanical':'#2563eb','Electrical':'#f59e0b','Sensor':'#8b5cf6',
    'Hydraulic':'#0891b2','Pneumatic':'#10b981','Software':'#f97316'
  };
  const MACHINE_STATUS_COLOR:any={
    'Normal':{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
    'Rusak':{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    'Maintenance':{bg:'#fffbeb',color:'#f59e0b',border:'#fde68a'},
  };

  const load=async()=>{
    setLoading(true);
    const [{data:m},{data:l}]=await Promise.all([
      supabase.from('machines').select('*').is('deleted_at',null).order('nama_mesin'),
      supabase.from('maintenance_logs').select('*').order('created_at',{ascending:false}),
    ]);
    setMachines(m??[]);
    setLogs(l??[]);
    setLoading(false);
  };

  useEffect(()=>{
    load();
    const ch=supabase.channel('realtime-maintenance')
      .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_logs'},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'machines'},()=>load())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const saveMachine=async()=>{
    if(!machineForm.nama_mesin.trim())return;
    setSaving(true);
    if(machineModal.mode==='add'){
      await supabase.from('machines').insert({...machineForm});
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah mesin '+machineForm.nama_mesin,'','Maintenance');
    } else {
      await supabase.from('machines').update({...machineForm}).eq('id',machineModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Edit mesin '+machineForm.nama_mesin,'','Maintenance');
    }
    await load();
    setMachineModal(null);
    setSaving(false);
  };

  const saveLog=async()=>{
    if(!logForm.issue_title.trim())return;
    setSaving(true);
    const machineId=selMachine?.id||logModal?.machine_id;
    if(logModal.mode==='add'){
      await supabase.from('maintenance_logs').insert({...logForm,machine_id:machineId,created_by:user?.name||user?.nama||'Admin'});
      // Update status mesin
      const newStatus=logForm.status==='Resolved'||logForm.status==='Closed'?'Normal':'Maintenance';
      await supabase.from('machines').update({status_terakhir:newStatus}).eq('id',machineId);
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah maintenance log: '+logForm.issue_title+' pada '+selMachine?.nama_mesin,'','Maintenance');
    } else {
      await supabase.from('maintenance_logs').update({...logForm}).eq('id',logModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Update maintenance log: '+logForm.issue_title,'','Maintenance');
    }
    await load();
    setLogModal(null);
    setSaving(false);
  };

  const hapusMachine=async()=>{
    await supabase.from('machines').update({deleted_at:new Date().toISOString(),deleted_by:user?.name||user?.nama||'Admin'}).eq('id',delMachine.id);
    await createLog(user?.name||user?.nama||'Admin','general','delete','Hapus mesin '+delMachine.nama_mesin,'','Maintenance');
    if(selMachine?.id===delMachine.id) setSelMachine(null);
    await load();
    setDelMachine(null);
  };

  const hapusLog=async()=>{
    await supabase.from('maintenance_logs').delete().eq('id',delLog.id);
    await load();
    setDelLog(null);
  };

  const machineLogs=selMachine?logs.filter(l=>l.machine_id===selMachine.id):logs;
  const filteredLogs=machineLogs.filter(l=>
    (filterStatus==='ALL'||l.status===filterStatus)&&
    (filterType==='ALL'||l.issue_type===filterType)
  );

  const totalDowntime=logs.reduce((a,l)=>a+(Number(l.downtime_hours)||0),0);
  const thisMonth=logs.filter(l=>l.created_at?.startsWith(new Date().toISOString().slice(0,7))).length;
  const mostBroken=machines.map(m=>({...m,count:logs.filter(l=>l.machine_id===m.id).length})).sort((a,b)=>b.count-a.count)[0];

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';

  const downloadPDF=(log:any)=>{
    const doc = new (jsPDF as any)();
    const machine = machines.find(m=>m.id===log.machine_id);
    doc.setFontSize(16);
    doc.setFont('helvetica','bold');
    doc.text('BERITA ACARA MAINTENANCE', 105, 20, {align:'center'});
    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text('VISTA TEKNIK', 105, 28, {align:'center'});
    doc.line(20, 32, 190, 32);
    
    doc.setFontSize(11);
    doc.setFont('helvetica','bold');
    doc.text('INFORMASI MESIN', 20, 42);
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const info = [
      ['Nama Mesin', machine?.nama_mesin||'—'],
      ['Tipe Mesin', machine?.tipe_mesin||'—'],
      ['Divisi/Lokasi', machine?.divisi||'—'],
      ['Tanggal Mulai', fmtDate(log.start_date)],
      ['Tanggal Selesai', fmtDate(log.finish_date)],
      ['Teknisi', log.technician||'—'],
      ['Status', log.status||'—'],
      ['Priority', log.priority||'—'],
      ['Downtime', (log.downtime_hours||0)+' jam'],
    ];
    let y = 50;
    info.forEach(([k,v])=>{
      doc.setFont('helvetica','bold');
      doc.text(k+' :', 20, y);
      doc.setFont('helvetica','normal');
      doc.text(v, 80, y);
      y += 7;
    });

    y += 5;
    doc.line(20, y, 190, y);
    y += 8;
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('JUDUL MASALAH', 20, y);
    y += 7;
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(log.issue_title||'—', 20, y);

    y += 10;
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('JENIS KERUSAKAN', 20, y);
    y += 7;
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(log.issue_type||'—', 20, y);

    y += 10;
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('DESKRIPSI MASALAH', 20, y);
    y += 7;
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const desc = doc.splitTextToSize(log.problem_description||'—', 170);
    doc.text(desc, 20, y);
    y += desc.length * 6 + 4;

    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text('TINDAKAN PERBAIKAN', 20, y);
    y += 7;
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    const repair = doc.splitTextToSize(log.repair_action||'—', 170);
    doc.text(repair, 20, y);
    y += repair.length * 6 + 10;

    doc.line(20, y, 190, y);
    y += 10;
    doc.setFont('helvetica','bold');
    doc.text('Dibuat oleh:', 20, y);
    doc.text('Disetujui oleh:', 110, y);
    y += 20;
    doc.text(log.created_by||'—', 20, y);
    doc.text('_______________', 110, y);
    y += 7;
    doc.setFont('helvetica','normal');
    doc.text(new Date(log.created_at).toLocaleDateString('id-ID'), 20, y);

    doc.save('Berita_Acara_'+( machine?.nama_mesin||'Maintenance')+'_'+new Date().toISOString().slice(0,10)+'.pdf');
  };

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Total Mesin',v:machines.length,c:'#2563eb',i:'🔧'},
          {l:'Normal',v:machines.filter(m=>m.status_terakhir==='Normal').length,c:'#16a34a',i:'✅'},
          {l:'Dalam Perbaikan',v:machines.filter(m=>m.status_terakhir==='Maintenance').length,c:'#f59e0b',i:'⚠️'},
          {l:'Rusak',v:machines.filter(m=>m.status_terakhir==='Rusak').length,c:'#dc2626',i:'❌'},
          {l:'Total Breakdown',v:logs.length,c:'#8b5cf6',i:'📋'},
          {l:'Bulan Ini',v:thisMonth,c:'#0891b2',i:'📅'},
          {l:'Total Downtime',v:totalDowntime+'h',c:'#f97316',i:'⏱'},
          {l:'Sering Rusak',v:mostBroken?.nama_mesin||'—',c:'#dc2626',i:'🔴'},
        ].map((s,i)=>(
          <Card key={i} style={{padding:'12px 14px',borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:16,marginBottom:4}}>{s.i}</div>
            <div style={{fontSize:i===7?11:20,fontWeight:800,color:s.c,lineHeight:1.2}}>{s.v}</div>
            <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:16}}>
        {/* Daftar Mesin */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e293b'}}>🔧 Daftar Mesin</div>
            <Btn color="#1d4ed8" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setMachineModal({mode:'add'});setMachineForm({nama_mesin:'',divisi:'',tipe_mesin:'',status_terakhir:'Normal'});}}>+ Tambah</Btn>
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:8,maxHeight:600,overflowY:'auto' as const}}>
            {machines.length===0&&<div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>Belum ada mesin</div>}
            {machines.map(m=>{
              const sc=MACHINE_STATUS_COLOR[m.status_terakhir]||MACHINE_STATUS_COLOR['Normal'];
              const isSel=selMachine?.id===m.id;
              const mLogs=logs.filter(l=>l.machine_id===m.id);
              const lastLog=mLogs[0];
              return(
                <div key={m.id} onClick={()=>setSelMachine(isSel?null:m)}
                  style={{background:isSel?'#eff6ff':'#fff',borderRadius:12,
                    border:`1.5px solid ${isSel?'#2563eb':'#e2e8f0'}`,
                    padding:'12px 14px',cursor:'pointer',transition:'all .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{m.nama_mesin}</div>
                    <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,
                      borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700,flexShrink:0}}>{m.status_terakhir}</span>
                  </div>
                  {m.tipe_mesin&&<div style={{fontSize:11,color:'#64748b',marginBottom:4}}>🏷 {m.tipe_mesin}</div>}
                  {m.divisi&&<div style={{fontSize:11,color:'#64748b',marginBottom:4}}>📍 {m.divisi}</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                    <span style={{fontSize:10,color:'#94a3b8'}}>{mLogs.length} breakdown</span>
                    {lastLog&&<span style={{fontSize:10,color:'#94a3b8'}}>Terakhir: {fmtDate(lastLog.created_at)}</span>}
                  </div>
                  <div style={{display:'flex',gap:4,marginTop:8,justifyContent:'flex-end'}}>
                    <button onClick={e=>{e.stopPropagation();setMachineModal({mode:'edit',id:m.id});setMachineForm({nama_mesin:m.nama_mesin,divisi:m.divisi||'',tipe_mesin:m.tipe_mesin||'',status_terakhir:m.status_terakhir});}}
                      style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();setDelMachine(m);}}
                      style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Maintenance */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap' as const,gap:8}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e293b'}}>
              📋 {selMachine?`History — ${selMachine.nama_mesin}`:'Semua Log Maintenance'}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const}}>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:11,fontWeight:600,color:'#475569',background:'#f8fafc'}}>
                <option value="ALL">Semua Status</option>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:11,fontWeight:600,color:'#475569',background:'#f8fafc'}}>
                <option value="ALL">Semua Tipe</option>
                {TYPE_LIST.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              {selMachine&&(
                <Btn color="#16a34a" style={{fontSize:11,padding:'5px 14px'}} onClick={()=>{setLogModal({mode:'add',machine_id:selMachine.id});setLogForm({issue_title:'',issue_type:'Mechanical',problem_description:'',repair_action:'',technician:'',status:'Open',priority:'Medium',downtime_hours:0,start_date:'',finish_date:''});}}>
                  + Tambah Log
                </Btn>
              )}
            </div>
          </div>

          {filteredLogs.length===0?(
            <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:14,fontWeight:600}}>{selMachine?'Belum ada log maintenance':'Pilih mesin untuk lihat history'}</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column' as const,gap:10,maxHeight:600,overflowY:'auto' as const}}>
              {filteredLogs.map((l:any)=>{
                const sc=STATUS_COLOR[l.status]||STATUS_COLOR['Open'];
                const tc=TYPE_COLOR[l.issue_type]||'#64748b';
                const pc=PRIORITY_COLOR[l.priority]||'#f59e0b';
                const machineName=machines.find(m=>m.id===l.machine_id)?.nama_mesin||'—';
                return(
                  <Card key={l.id} style={{padding:'14px 16px',borderLeft:`4px solid ${sc.color}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:8}}>
                      <div style={{flex:1}}>
                        {!selMachine&&<div style={{fontSize:11,fontWeight:700,color:'#2563eb',marginBottom:4}}>🔧 {machineName}</div>}
                        <div style={{fontWeight:800,fontSize:14,color:'#1e293b',marginBottom:4}}>{l.issue_title}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:6}}>
                          <span style={{background:tc+'18',color:tc,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{l.issue_type}</span>
                          <span style={{background:pc+'18',color:pc,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>⚡ {l.priority}</span>
                          {l.downtime_hours>0&&<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>⏱ {l.downtime_hours}h downtime</span>}
                        </div>
                        {l.problem_description&&<div style={{fontSize:12,color:'#475569',marginBottom:4}}>❌ <strong>Masalah:</strong> {l.problem_description}</div>}
                        {l.repair_action&&<div style={{fontSize:12,color:'#16a34a',marginBottom:4}}>🔨 <strong>Perbaikan:</strong> {l.repair_action}</div>}
                        <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,fontSize:11,color:'#64748b',marginTop:6}}>
                          {l.start_date&&<span>📅 Mulai: <strong>{fmtDate(l.start_date)}</strong></span>}
                          {l.finish_date&&<span>✅ Selesai: <strong>{fmtDate(l.finish_date)}</strong></span>}
                          {l.technician&&<span>👤 Teknisi: <strong>{l.technician}</strong></span>}
                          {l.created_by&&<span>✍️ Dicatat: <strong>{l.created_by}</strong></span>}
                          <span style={{color:'#94a3b8'}}>{new Date(l.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column' as const,alignItems:'flex-end',gap:6,flexShrink:0}}>
                        <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700}}>{l.status}</span>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>{setLogModal({mode:'edit',id:l.id,machine_id:l.machine_id});setLogForm({issue_title:l.issue_title,issue_type:l.issue_type,problem_description:l.problem_description||'',repair_action:l.repair_action||'',technician:l.technician||'',status:l.status,priority:l.priority,downtime_hours:l.downtime_hours||0,start_date:l.start_date||'',finish_date:l.finish_date||'',});}}
                            style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                          <button onClick={()=>setDelLog(l)}
                            style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Mesin */}
      {machineModal&&(
        <Modal title={(machineModal.mode==='add'?'Tambah':'Edit')+' Mesin'} onClose={()=>setMachineModal(null)} width={440}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Nama Mesin</Lbl><Inp value={machineForm.nama_mesin} onChange={(e:any)=>setMachineForm({...machineForm,nama_mesin:e.target.value})} placeholder="Nama mesin..."/></div>
            <div><Lbl>Tipe Mesin</Lbl><Inp value={machineForm.tipe_mesin} onChange={(e:any)=>setMachineForm({...machineForm,tipe_mesin:e.target.value})} placeholder="CNC, Laser, Press, dll..."/></div>
            <div><Lbl>Divisi / Lokasi</Lbl><Inp value={machineForm.divisi} onChange={(e:any)=>setMachineForm({...machineForm,divisi:e.target.value})} placeholder="Mekanik, Painting, dll..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={machineForm.status_terakhir} onChange={(e:any)=>setMachineForm({...machineForm,status_terakhir:e.target.value})}>
                <option value="Normal">✅ Normal</option>
                <option value="Maintenance">⚠️ Maintenance</option>
                <option value="Rusak">❌ Rusak</option>
              </Sel>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setMachineModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveMachine}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Log */}
      {logModal&&(
        <Modal title={(logModal.mode==='add'?'Tambah':'Edit')+' Maintenance Log'} onClose={()=>setLogModal(null)} width={520}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}><Lbl>Judul Masalah</Lbl><Inp value={logForm.issue_title} onChange={(e:any)=>setLogForm({...logForm,issue_title:e.target.value})} placeholder="Contoh: Motor Overheating..."/></div>
            <div><Lbl>Jenis Kerusakan</Lbl>
              <Sel value={logForm.issue_type} onChange={(e:any)=>setLogForm({...logForm,issue_type:e.target.value})}>
                {TYPE_LIST.map(t=><option key={t} value={t}>{t}</option>)}
              </Sel>
            </div>
            <div><Lbl>Priority</Lbl>
              <Sel value={logForm.priority} onChange={(e:any)=>setLogForm({...logForm,priority:e.target.value})}>
                {PRIORITY_LIST.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Deskripsi Masalah</Lbl>
              <textarea value={logForm.problem_description} onChange={(e:any)=>setLogForm({...logForm,problem_description:e.target.value})}
                placeholder="Detail masalah yang terjadi..."
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,minHeight:60,resize:'vertical' as const,fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Tindakan Perbaikan</Lbl>
              <textarea value={logForm.repair_action} onChange={(e:any)=>setLogForm({...logForm,repair_action:e.target.value})}
                placeholder="Apa yang dilakukan untuk perbaikan..."
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,minHeight:60,resize:'vertical' as const,fontFamily:'inherit'}}/>
            </div>
            <div><Lbl>Teknisi</Lbl><Inp value={logForm.technician} onChange={(e:any)=>setLogForm({...logForm,technician:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Downtime (jam)</Lbl><Inp type="number" min="0" value={logForm.downtime_hours} onChange={(e:any)=>setLogForm({...logForm,downtime_hours:Number(e.target.value)})}/></div>
            <div><Lbl>Tanggal Mulai</Lbl><Inp type="date" value={logForm.start_date} onChange={(e:any)=>setLogForm({...logForm,start_date:e.target.value})}/></div>
            <div><Lbl>Tanggal Selesai</Lbl><Inp type="date" value={logForm.finish_date} onChange={(e:any)=>setLogForm({...logForm,finish_date:e.target.value})}/></div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Status</Lbl>
              <Sel value={logForm.status} onChange={(e:any)=>setLogForm({...logForm,status:e.target.value})}>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setLogModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveLog}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Hapus Mesin */}
      {delMachine&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelMachine(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Mesin <strong>{delMachine.nama_mesin}</strong> akan dipindah ke Recycle Bin.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelMachine(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={hapusMachine}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Hapus Log */}
      {delLog&&(
        <Modal title="Hapus Log?" onClose={()=>setDelLog(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Log maintenance ini akan dihapus permanen.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelLog(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={hapusLog}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Service Schedule Section */}
      <ServiceSchedule machines={machines} user={user}/>
    </div>
  );
}
function ActivityLogView({activityLog}:any){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterAction,setFilterAction]=useState("ALL");
  const [filterProyek,setFilterProyek]=useState("ALL");
  const [filterProject,setFilterProject]=useState("ALL");
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const PER_PAGE=50;

  const ACTION_CONFIG:any={
    create:{label:"Buat",color:"#16a34a",bg:"#f0fdf4"},
    update:{label:"Edit",color:"#2563eb",bg:"#eff6ff"},
    delete:{label:"Hapus",color:"#dc2626",bg:"#fef2f2"},
    login:{label:"Login",color:"#7c3aed",bg:"#f5f3ff"},
    logout:{label:"Logout",color:"#64748b",bg:"#f8fafc"},
    distribute:{label:"Distribusi",color:"#0891b2",bg:"#ecfeff"},
  };
  const MODULE_COLOR:any={
    wo:"#2563eb",raw:"#f59e0b",rencana:"#10b981",
    kendala:"#ef4444",pekerja:"#0891b2",auth:"#64748b",general:"#94a3b8"
  };

  const adminList=[...new Set(activityLog.map((a:any)=>a.admin_nama||a.user_name).filter(Boolean))];
  const actionList=[...new Set(activityLog.map((a:any)=>a.action_type).filter(Boolean))];
  const projectList=[...new Set(activityLog.map((a:any)=>a.project||a.wo_number||a.wo_no).filter(Boolean))];
  const panelList=[...new Set(activityLog.map((a:any)=>a.panel||a.halaman).filter(Boolean))];

  const filtered=activityLog.filter((a:any)=>{
    const adminName=a.admin_nama||a.user_name||"";
    const actionType=a.action_type||"";
    const desc=a.description||a.aktivitas||a.action||"";
    const proj=a.project||a.wo_number||a.wo_no||"";
    const pnl=a.panel||a.halaman||"";
    if(filterAdmin!=="ALL"&&adminName!==filterAdmin)return false;
    if(filterAction!=="ALL"&&actionType!==filterAction)return false;
    if(filterProyek!=="ALL"&&a.proyek!==filterProyek)return false;
    if(filterProject!=="ALL"&&proj!==filterProject)return false;
    if(filterPanel!=="ALL"&&pnl!==filterPanel)return false;
    if(filterTgl&&!a.created_at?.startsWith(filterTgl))return false;
    if(search){const q=search.toLowerCase();if(!desc.toLowerCase().includes(q)&&!adminName.toLowerCase().includes(q)&&!proj.toLowerCase().includes(q))return false;}
    return true;
  });

  const totalPages=Math.ceil(filtered.length/PER_PAGE);
  const paginated=filtered.slice((page-1)*PER_PAGE,page*PER_PAGE);

  const fmtTime=(ts:string)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"2-digit"})+" "+
      d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"});
  };

  const resetFilters=()=>{setFilterAdmin("ALL");setFilterAction("ALL");setFilterProject("ALL");setFilterPanel("ALL");setFilterTgl("");setSearch("");setPage(1);};
  const hasFilter=filterAdmin!=="ALL"||filterAction!=="ALL"||filterProject!=="ALL"||filterPanel!=="ALL"||filterTgl||search;

  return(
    <div className="fi">
      {/* Filter Bar */}
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap" as const,alignItems:"center",background:"#fff",borderRadius:8,padding:"8px 10px",border:"1px solid #e2e8f0"}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="🔍 Cari..."
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,width:150,outline:"none"}}/>
        <input type="date" value={filterTgl} onChange={e=>{setFilterTgl(e.target.value);setPage(1);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11}}/>
        <select value={filterAdmin} onChange={e=>{setFilterAdmin(e.target.value);setPage(1);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,color:"#475569"}}>
          <option value="ALL">Semua Admin</option>
          {adminList.map((a:any)=><option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterAction} onChange={e=>{setFilterAction(e.target.value);setPage(1);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,color:"#475569"}}>
          <option value="ALL">Semua Action</option>
          {actionList.map((a:any)=><option key={a} value={a}>{ACTION_CONFIG[a]?.label||a}</option>)}
        </select>
        <select value={filterProject} onChange={e=>{setFilterProject(e.target.value);setPage(1);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,color:"#475569"}}>
          <option value="ALL">Semua Project</option>
          {projectList.map((p:any)=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPanel} onChange={e=>{setFilterPanel(e.target.value);setPage(1);}}
          style={{padding:"4px 8px",borderRadius:6,border:"1px solid #e2e8f0",fontSize:11,color:"#475569"}}>
          <option value="ALL">Semua Panel</option>
          {panelList.map((p:any)=><option key={p} value={p}>{p}</option>)}
        </select>
        {hasFilter&&<button onClick={resetFilters} style={{padding:"4px 8px",borderRadius:6,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:700,cursor:"pointer"}}>Reset</button>}
        <span style={{marginLeft:"auto",fontSize:11,color:"#64748b"}}>{filtered.length} log</span>
      </div>

      {/* Table */}
      <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse" as const,fontSize:11}}>
          <thead>
            <tr style={{background:"#1e3a8a",position:"sticky" as const,top:0,zIndex:2}}>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,width:120}}>TANGGAL</th>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,width:120}}>ADMIN</th>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,width:80}}>ACTION</th>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const}}>AKTIVITAS</th>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,width:120}}>PROJECT</th>
              <th style={{padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,width:100}}>PANEL</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length===0?(
              <tr><td colSpan={6} style={{textAlign:"center",padding:"30px",color:"#94a3b8",fontSize:12}}>Tidak ada aktivitas</td></tr>
            ):(
              paginated.map((a:any,i:number)=>{
                const actionType=a.action_type||"";
                const ac=ACTION_CONFIG[actionType]||{label:actionType,color:"#64748b",bg:"#f8fafc"};
                const module=a.module||a.jenis||"general";
                const mc=MODULE_COLOR[module]||"#94a3b8";
                const adminName=a.admin_nama||a.user_name||"—";
                const desc=a.description||a.aktivitas||a.action||"—";
                const proj=a.project||a.wo_number||a.wo_no||"";
                const pnl=a.panel||a.halaman||"";
                return(
                  <tr key={a.id||i} style={{borderBottom:"1px solid #f1f5f9",background:i%2===0?"#fff":"#f8fafc"}}>
                    <td style={{padding:"4px 10px",color:"#94a3b8",whiteSpace:"nowrap" as const,fontSize:10}}>{fmtTime(a.created_at)}</td>
                    <td style={{padding:"4px 10px",fontWeight:600,color:"#1e293b",whiteSpace:"nowrap" as const,fontSize:11}}>{adminName}</td>
                    <td style={{padding:"4px 10px"}}>
                      <span style={{background:ac.bg,color:ac.color,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>{ac.label||actionType}</span>
                    </td>
                    <td style={{padding:"4px 10px",color:"#475569",maxWidth:300,overflow:"hidden" as const,textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const,fontSize:11}}>{desc}</td>
                    <td style={{padding:"4px 10px",whiteSpace:"nowrap" as const}}>
                      {proj&&<span style={{background:mc+"18",color:mc,borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{proj}</span>}
                    </td>
                    <td style={{padding:"4px 10px",whiteSpace:"nowrap" as const}}>
                      {pnl&&<span style={{background:"#f1f5f9",color:"#475569",borderRadius:4,padding:"1px 6px",fontSize:10,fontWeight:600}}>{pnl}</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages>1&&(
        <div style={{display:"flex",gap:6,justifyContent:"center",alignItems:"center",marginTop:10}}>
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
            style={{padding:"4px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:page===1?"#f8fafc":"#fff",cursor:page===1?"not-allowed":"pointer",fontSize:11,color:page===1?"#cbd5e1":"#475569"}}>◀</button>
          {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
            const p=page<=3?i+1:page>=totalPages-2?totalPages-4+i:page-2+i;
            if(p<1||p>totalPages)return null;
            return(
              <button key={p} onClick={()=>setPage(p)}
                style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${page===p?"#2563eb":"#e2e8f0"}`,background:page===p?"#2563eb":"#fff",cursor:"pointer",fontSize:11,color:page===p?"#fff":"#475569",fontWeight:page===p?700:400}}>{p}</button>
            );
          })}
          <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages}
            style={{padding:"4px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:page===totalPages?"#f8fafc":"#fff",cursor:page===totalPages?"not-allowed":"pointer",fontSize:11,color:page===totalPages?"#cbd5e1":"#475569"}}>▶</button>
          <span style={{fontSize:11,color:"#64748b"}}>Hal {page}/{totalPages}</span>
        </div>
      )}
    </div>
  );
}

function KendalaInbox({kendalaLog,removeKendala}){
  const [filterDiv,setFilterDiv]=useState("ALL");
  const [filterProses,setFilterProses]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");

  const divisiList=[...new Set(kendalaLog.map(k=>k.divisi))];
  const prosesList=[...new Set(kendalaLog.map(k=>k.proses))];

  const filtered=kendalaLog.filter(k=>
    (filterDiv==="ALL"||k.divisi===filterDiv)&&
    (filterProses==="ALL"||k.proses===filterProses)&&
    (!filterTgl||k.tanggal===filterTgl)
  );

  return(
    <div className="fi">
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <Lbl>Filter Divisi</Lbl>
          <Sel value={filterDiv} onChange={e=>setFilterDiv(e.target.value)} style={{minWidth:160}}>
            <option value="ALL">Semua Divisi</option>
            {divisiList.map(d=><option key={d} value={d}>{DIVISI_CONFIG[d]?.label||d}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Filter Proses</Lbl>
          <Sel value={filterProses} onChange={e=>setFilterProses(e.target.value)} style={{minWidth:160}}>
            <option value="ALL">Semua Proses</option>
            {prosesList.map(p=><option key={p} value={p}>{p}</option>)}
          </Sel>
        </div>
        <div>
          <Lbl>Filter Tanggal</Lbl>
          <Inp type="date" value={filterTgl} onChange={e=>setFilterTgl(e.target.value)} style={{minWidth:160}}/>
        </div>
        {(filterDiv!=="ALL"||filterProses!=="ALL"||filterTgl)&&(
          <Btn outline color="#64748b" style={{padding:"7px 14px",fontSize:12}}
            onClick={()=>{setFilterDiv("ALL");setFilterProses("ALL");setFilterTgl("");}}>
            Reset Filter
          </Btn>
        )}
        <div style={{marginLeft:"auto",fontSize:12,color:"#64748b",alignSelf:"flex-end",paddingBottom:4}}>
          {filtered.length} catatan
        </div>
      </div>

      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📭</div>
          <div style={{fontSize:14,fontWeight:600}}>Belum ada catatan kendala</div>
          <div style={{fontSize:12,marginTop:4}}>Catatan dari operator akan muncul di sini</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(k=>{
            const dc=DIVISI_CONFIG[k.divisi];
            const pc=PROSES_COLOR[k.proses]||"#64748b";
            return(
              <div key={k.id} style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",
                padding:"14px 16px",borderLeft:`4px solid ${dc?.color||"#64748b"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{background:dc?.bg,color:dc?.color,border:`1px solid ${dc?.color}30`,
                      borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                      {dc?.icon} {dc?.label}
                    </span>
                    <Badge label={k.proses} color={pc}/>
                    <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>📅 {fmtDate(k.tanggal)}</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>👤 {k.operator}</span>
                  </div>
                  <button onClick={()=>removeKendala(k.id)}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:13,flexShrink:0}}>
                    🗑
                  </button>
                </div>
                <div style={{marginTop:10,fontSize:13,color:"#374151",lineHeight:1.6,
                  background:"#f8fafc",borderRadius:8,padding:"10px 12px"}}>
                  {k.catatan}
                </div>
                <div style={{fontSize:10,color:"#cbd5e1",marginTop:6,textAlign:"right"}}>
                  {new Date(k.ts).toLocaleString("id-ID")}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({onEnter}){
  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{GCss}</style>
      <style>{`
        @keyframes float1{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-12px) rotate(-2deg)}}
        @keyframes float2{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes float3{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes landIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        .land-in{animation:landIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-in-2{animation:landIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-in-3{animation:landIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-in-4{animation:landIn .6s .45s cubic-bezier(.22,1,.36,1) both}
        .cta-btn:hover{background:#1d4ed8!important;transform:translateY(-1px);box-shadow:0 8px 28px #2563eb44!important}
        .cta-btn{transition:all .18s!important}
        .feat-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px #00000012!important}
        .feat-card{transition:all .2s}
        .nav-link{color:#475569;font-size:13px;font-weight:600;cursor:pointer;padding:6px 4px;border-bottom:2px solid transparent;transition:all .15s}
        .nav-link:hover{color:#1d4ed8;border-bottom-color:#1d4ed8}
      `}</style>

      {/* NAVBAR */}
      <nav style={{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"0 48px",height:64,
        display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,
        boxShadow:"0 1px 8px #00000008"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#f97316,#ea580c)",borderRadius:8,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:15,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:900,fontSize:15,color:"#1e293b",letterSpacing:.5,lineHeight:1}}>
              <span style={{color:"#ea580c"}}>VISTA</span> TEKNIK
            </div>
            <div style={{fontSize:8,color:"#94a3b8",fontWeight:600,letterSpacing:.8,textTransform:"uppercase"}}>Solusi Produksi Panel Listrik</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:28}}>
          {["Beranda","Produksi","Material","QC / Testing","Laporan"].map(l=>(
            <span key={l} className="nav-link">{l}</span>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:"50%",background:"#eff6ff",display:"flex",
            alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#1d4ed8"}}>AD</div>
        </div>
      </nav>

      {/* HERO */}
      <div style={{maxWidth:1280,margin:"0 auto",padding:"72px 48px 80px",display:"grid",
        gridTemplateColumns:"1fr 1fr",gap:60,alignItems:"center"}}>
        {/* LEFT */}
        <div>
          <div className="land-in" style={{display:"inline-flex",alignItems:"center",gap:8,
            background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:20,padding:"5px 14px",
            fontSize:12,fontWeight:700,color:"#1d4ed8",marginBottom:24}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/>
            Sistem Terintegrasi
          </div>
          <h1 className="land-in-2" style={{fontSize:52,fontWeight:900,lineHeight:1.1,color:"#0f172a",marginBottom:16}}>
            Your Electrical<br/><span style={{color:"#1d4ed8"}}>Safety Is Our Priority</span>
          </h1>
          <p className="land-in-3" style={{fontSize:15,color:"#64748b",lineHeight:1.8,marginBottom:36,maxWidth:400}}>
            Solusi lengkap untuk produksi panel listrik yang lebih cepat, akurat, dan terorganisir.
          </p>
          <div className="land-in-4" style={{display:"flex",gap:14,alignItems:"center"}}>
            <button className="cta-btn" onClick={onEnter}
              style={{background:"#2563eb",color:"#fff",fontWeight:800,fontSize:15,padding:"14px 32px",
                borderRadius:12,border:"none",cursor:"pointer",boxShadow:"0 4px 18px #2563eb33",
                display:"flex",alignItems:"center",gap:8}}>
              Masuk ke Aplikasi <span style={{fontSize:18}}>›</span>
            </button>
          </div>
        </div>

        {/* RIGHT — floating stats + panel illustration */}
        <div style={{position:"relative",height:420,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {/* big blob bg */}
          <div style={{position:"absolute",width:380,height:380,borderRadius:"50%",
            background:"linear-gradient(135deg,#eff6ff 0%,#e0f2fe 100%)",zIndex:0}}/>

          {/* panel listrik SVG illustration */}
          <div style={{position:"relative",zIndex:1,animation:"float1 4s ease-in-out infinite"}}>
            <svg width="220" height="300" viewBox="0 0 220 300" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="20" y="10" width="180" height="280" rx="6" fill="#d1d5db" stroke="#9ca3af" strokeWidth="1.5"/>
              <rect x="26" y="16" width="168" height="268" rx="4" fill="#e5e7eb"/>
              <rect x="34" y="24" width="152" height="80" rx="3" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="40" y="30" width="60" height="16" rx="2" fill="#9ca3af"/>
              <rect x="108" y="30" width="70" height="16" rx="2" fill="#9ca3af"/>
              <rect x="40" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="86" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="132" y="52" width="40" height="10" rx="2" fill="#6b7280"/>
              <rect x="40" y="68" width="140" height="28" rx="2" fill="#374151" stroke="#1f2937" strokeWidth="1"/>
              <rect x="46" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="58" y="74" width="8" height="16" rx="1" fill="#f59e0b"/>
              <rect x="70" y="74" width="8" height="16" rx="1" fill="#ef4444"/>
              <rect x="82" y="74" width="8" height="16" rx="1" fill="#22c55e"/>
              <circle cx="148" cy="82" r="8" fill="#1f2937" stroke="#374151" strokeWidth="1"/>
              <circle cx="148" cy="82" r="4" fill="#4b5563"/>
              <rect x="34" y="112" width="152" height="120" rx="3" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="42" y="120" width="60" height="8" rx="1" fill="#d1d5db"/>
              <rect x="42" y="134" width="40" height="6" rx="1" fill="#e5e7eb"/>
              <circle cx="152" cy="128" r="10" fill="#dc2626" stroke="#b91c1c" strokeWidth="1"/>
              <circle cx="172" cy="128" r="10" fill="#f59e0b" stroke="#d97706" strokeWidth="1"/>
              <circle cx="152" cy="152" r="10" fill="#22c55e" stroke="#16a34a" strokeWidth="1"/>
              <circle cx="172" cy="152" r="10" fill="#3b82f6" stroke="#2563eb" strokeWidth="1"/>
              <rect x="42" y="158" width="90" height="6" rx="1" fill="#e5e7eb"/>
              <rect x="42" y="170" width="70" height="6" rx="1" fill="#e5e7eb"/>
              <rect x="34" y="240" width="152" height="30" rx="3" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
              <rect x="40" y="248" width="50" height="14" rx="2" fill="#374151"/>
              <rect x="96" y="248" width="50" height="14" rx="2" fill="#374151"/>
              <rect x="152" y="248" width="26" height="14" rx="2" fill="#374151"/>
              {/* warning sticker */}
              <polygon points="110,205 120,222 100,222" fill="#f59e0b"/>
              <text x="110" y="219" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="bold">!</text>
            </svg>
          </div>

          {/* floating card: Progress Produksi */}
          <div style={{position:"absolute",top:30,left:-10,animation:"float2 3.5s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",
            minWidth:170,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>Progress Produksi</div>
            <div style={{fontSize:28,fontWeight:900,color:"#2563eb",lineHeight:1}}>75%</div>
            <div style={{margin:"8px 0 6px",height:5,background:"#e2e8f0",borderRadius:99}}>
              <div style={{width:"75%",height:"100%",background:"#2563eb",borderRadius:99}}/>
            </div>
            <div style={{fontSize:10,color:"#22c55e",fontWeight:700}}>● On Progress</div>
          </div>

          {/* floating card: Order Aktif */}
          <div style={{position:"absolute",top:60,right:-20,animation:"float3 4.2s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",
            minWidth:140,zIndex:2}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
              <div style={{width:28,height:28,background:"#eff6ff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📋</div>
              <div style={{fontSize:11,color:"#64748b",fontWeight:600}}>Order Aktif</div>
            </div>
            <div style={{fontSize:32,fontWeight:900,color:"#1d4ed8",lineHeight:1}}>12</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>Pesanan berjalan</div>
          </div>

          {/* floating card: QC Pass Rate */}
          <div style={{position:"absolute",bottom:40,left:-10,animation:"float2 3.8s 1s ease-in-out infinite",
            background:"#fff",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 32px #00000018",
            minWidth:160,zIndex:2}}>
            <div style={{fontSize:11,color:"#64748b",fontWeight:600,marginBottom:4}}>QC Pass Rate</div>
            <div style={{display:"flex",alignItems:"baseline",gap:8}}>
              <div style={{fontSize:28,fontWeight:900,color:"#1d4ed8",lineHeight:1}}>98%</div>
              <div style={{fontSize:11,color:"#22c55e",fontWeight:700}}>↑ 4%</div>
            </div>
            <svg width="100" height="28" viewBox="0 0 100 28" fill="none" style={{marginTop:6}}>
              <polyline points="0,22 20,18 40,20 60,12 80,8 100,4" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="100" cy="4" r="3" fill="#2563eb"/>
            </svg>
          </div>
        </div>
      </div>

      {/* FEATURE STRIP */}
      <div style={{background:"#fff",borderTop:"1px solid #f1f5f9",borderBottom:"1px solid #f1f5f9",padding:"32px 48px"}}>
        <div style={{maxWidth:1280,margin:"0 auto",display:"grid",
          gridTemplateColumns:"repeat(4,1fr)",gap:32}}>
          {[
            {icon:"🔧",title:"Produksi",sub:"Kelola proses produksi"},
            {icon:"📦",title:"Material",sub:"Stok & BOM"},
            {icon:"🔍",title:"QC / Testing",sub:"Kontrol kualitas"},
            {icon:"📊",title:"Laporan",sub:"Data & laporan"},
          ].map(f=>(
            <div key={f.title} className="feat-card" style={{display:"flex",alignItems:"center",gap:14,
              padding:"16px 20px",borderRadius:12,border:"1px solid #f1f5f9",cursor:"pointer"}}>
              <div style={{width:44,height:44,background:"#eff6ff",borderRadius:12,display:"flex",
                alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>{f.title}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{textAlign:"center",padding:"24px",fontSize:12,color:"#94a3b8"}}>
        © 2025 <span style={{color:"#ea580c",fontWeight:700}}>Vista Teknik</span>. All rights reserved.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const [mode,setMode]=useState("divisi"); // "divisi" | "admin"
  const [div,setDiv]=useState("mekanik");
  const [namaList,setNamaList]=useState([]);
  const [selNama,setSelNama]=useState("");
  const [username,setUsername]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(mode==="divisi"&&div){
      supabase.from("pekerja").select("id,nama").eq("divisi",div).then(({data})=>{
        setNamaList(data??[]);setSelNama("");
      });
    }
  },[div,mode]);

  const goAdmin=async()=>{
    if(!username.trim()){setErr("Masukkan username!");return;}
    if(!pwd){setErr("Masukkan password!");return;}
    setLoading(true);
    const{data,error}=await supabase.from("admins")
      .select("*").eq("username",username.trim()).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    await supabase.from("admins").update({last_login:new Date().toISOString()}).eq("id",data.id);
    await supabase.from("activity_log").insert({
      user_name:data.nama,admin_nama:data.nama,
      action:"Login ke sistem",aktivitas:"Login ke sistem",
      jenis:"auth",halaman:"Login",table_name:"auth",
    });
    localStorage.setItem("vista_admin_session",JSON.stringify({...data,divisi:"admin"}));
    await supabase.rpc('set_current_admin', { admin_name: data.nama });
    onLogin({...data,divisi:"admin",name:data.nama});
    setLoading(false);
  };

  const goDivisi=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    onLogin({...found,divisi:div,name:found.nama});
    setLoading(false);
  };

  const go=mode==="admin"?goAdmin:goDivisi;

  return(
    <div style={{minHeight:"100vh",display:"flex"}}>
      <style>{GCss}</style>
      <div style={{flex:1,background:"linear-gradient(145deg,#1e3a8a,#1d4ed8 60%,#3b82f6)",
        display:"flex",flexDirection:"column",justifyContent:"center",padding:"60px 72px",color:"#fff"}}>
        <div style={{fontSize:44,marginBottom:10}}>⚡</div>
        <div style={{fontSize:32,fontWeight:800,lineHeight:1.2,marginBottom:14}}>Monitoring<br/>Proses Produksi</div>
        <div style={{fontSize:14,opacity:.75,lineHeight:1.8,maxWidth:320}}>Platform terpadu monitoring progress produksi panel listrik secara real-time.</div>
        <div style={{marginTop:36,display:"flex",flexDirection:"column",gap:10}}>
          {["Multi Admin dengan activity tracking","Tabel produksi harian lengkap","Shift & PIC per komponen","Status H-7 Mendesak"].map(f=>(
            <div key={f} style={{display:"flex",alignItems:"center",gap:10,fontSize:13,opacity:.85}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:"#ffffff25",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</span>{f}
            </div>
          ))}
        </div>
      </div>
      <div style={{width:440,display:"flex",alignItems:"center",justifyContent:"center",padding:40,background:"#fff"}}>
        <div style={{width:"100%",maxWidth:340}} className="fi">
          <div style={{fontWeight:800,fontSize:22,color:"#1e293b",marginBottom:4}}>Selamat Datang 👋</div>
          <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Masuk ke akun Anda</div>
          <div style={{display:"flex",gap:8,marginBottom:20,background:"#f1f5f9",borderRadius:10,padding:4}}>
            <button onClick={()=>{setMode("admin");setErr("");}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode==="admin"?"#fff":"transparent",
                color:mode==="admin"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:13,
                boxShadow:mode==="admin"?"0 1px 4px #00000015":"none",transition:"all .15s"}}>
              ⚙️ Admin
            </button>
            <button onClick={()=>{setMode("divisi");setErr("");}}
              style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",
                background:mode==="divisi"?"#fff":"transparent",
                color:mode==="divisi"?"#1d4ed8":"#64748b",fontWeight:700,fontSize:13,
                boxShadow:mode==="divisi"?"0 1px 4px #00000015":"none",transition:"all .15s"}}>
              👷 Operator
            </button>
          </div>
          {mode==="admin"?(
            <>
              <div style={{marginBottom:12}}><Lbl>Username</Lbl>
                <Inp value={username} onChange={e=>{setUsername(e.target.value);setErr("");}}
                  placeholder="contoh: rizky_admin" onKeyDown={e=>e.key==="Enter"&&go()}/>
              </div>
              <div style={{marginBottom:20}}><Lbl>Password</Lbl>
                <div style={{position:"relative"}}>
                  <Inp type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password..."
                    style={{border:`1.5px solid ${err?"#fca5a5":"#e2e8f0"}`,paddingRight:40}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",
                    transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}>
                    {show?"🙈":"👁"}
                  </button>
                </div>
              </div>
            </>
          ):(
            <>
              <div style={{marginBottom:12}}><Lbl>Divisi</Lbl>
                <Sel value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                  {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:12}}><Lbl>Nama</Lbl>
                <Sel value={selNama} onChange={e=>setSelNama(e.target.value)}>
                  <option value="">-- Pilih Nama --</option>
                  {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                </Sel>
              </div>
              <div style={{marginBottom:20}}><Lbl>Password Divisi</Lbl>
                <div style={{position:"relative"}}>
                  <Inp type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password divisi..."
                    style={{border:`1.5px solid ${err?"#fca5a5":"#e2e8f0"}`,paddingRight:40}}/>
                  <button onClick={()=>setShow(!show)} style={{position:"absolute",right:10,top:"50%",
                    transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}>
                    {show?"🙈":"👁"}
                  </button>
                </div>
              </div>
            </>
          )}
          {err&&<div style={{fontSize:11,color:"#dc2626",marginBottom:12,padding:"8px 12px",background:"#fef2f2",borderRadius:8}}>{err}</div>}
          <Btn color="#1d4ed8" style={{width:"100%",padding:13,fontSize:15,boxShadow:"0 4px 14px #2563eb33"}} onClick={go}>
            {loading?"Memuat...":"Masuk →"}
          </Btn>
        </div>
      </div>
    </div>
  );
}


function Dashboard({woData}){
  if(!woData.length) return(
    <div className="fi" style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di tab Manajemen WO terlebih dahulu</div>
    </div>
  );
  const stats=[
    {v:woData.length,l:"Total WO",i:"📋"},
    {v:woData.reduce((a,w)=>a+w.panels.length,0),l:"Total Panel",i:"⚡"},
    {v:(Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length||0))+"%",l:"Avg Progress",i:"📊"},
    {v:woData.filter(w=>!isDelayed(w.target)&&!isUrgent(w.target)&&woOverall(w)<100).length,l:"On Track",i:"🟢"},
    {v:woData.filter(w=>isUrgent(w.target)&&woOverall(w)<100).length,l:"Mendesak (H-7)",i:"🟠"},
    {v:woData.filter(w=>isDelayed(w.target)&&woOverall(w)<100).length,l:"Terlambat",i:"🔴"},
    {v:woData.filter(w=>woOverall(w)===100).length,l:"Selesai",i:"✅"},
  ];
  return(
    <div className="fi">
      {woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).map(w=>{
        const st=getStatus(w.target,woOverall(w));
        const d=daysUntil(w.target);
        return(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,
            background:st.bg,border:`1px solid ${st.color}30`,borderRadius:10,
            padding:"9px 14px",marginBottom:8,fontSize:13}}>
            <span>{isDelayed(w.target)?"🔴":isUrgent(w.target)?"🟠":"🟢"}</span>
            <span style={{fontWeight:700,color:st.color,flex:1}}>WO {w.wo} — {w.proyek}</span>
            <span style={{fontSize:11,color:"#64748b"}}>
              {isDelayed(w.target)?`Terlambat ${Math.abs(d)} hari`:`H-${d}`} · Target: {w.target}
            </span>
            <Badge label={st.label} color={st.color} bg={st.bg}/>
          </div>
        );
      })}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:22}}>
        {stats.map((s,i)=>(
          <Card key={i} style={{padding:"14px 16px"}}>
            <div style={{fontSize:20,marginBottom:5}}>{s.i}</div>
            <div style={{fontSize:24,fontWeight:800,color:"#1e293b"}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,textTransform:"uppercase",letterSpacing:.4,fontWeight:600}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <STitle>Work Order</STitle>
      {woData.map(wo=>{
        const pct=woOverall(wo);const st=getStatus(wo.target,pct);const d=daysUntil(wo.target);
        return(
          <Card key={wo.id} style={{marginBottom:10,borderLeft:`3px solid ${st.color}`}}>
            <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8}}>
              <div>
                <span style={{fontWeight:800,color:"#1e293b",fontSize:15,fontFamily:"'DM Mono',monospace"}}>WO {wo.wo}</span>
                <span style={{color:"#475569",fontWeight:600,marginLeft:10}}>{wo.proyek}</span>
                <span style={{color:"#94a3b8",fontSize:12,marginLeft:8}}>📅 {wo.target}</span>
                {pct<100&&<span style={{fontSize:11,color:st.color,marginLeft:8,fontWeight:600}}>
                  {isDelayed(wo.target)?`⚠️ Terlambat ${Math.abs(d)} hari`:`H-${d}`}
                </span>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Badge label={st.label} color={st.color} bg={st.bg}/>
                <span style={{fontWeight:800,color:pColor(pct),fontSize:18,fontFamily:"'DM Mono',monospace"}}>{pct}%</span>
              </div>
            </div>
            <PBar pct={pct} h={8}/>
            <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
              {wo.panels.map(p=>{const pp=panelOverall(p);return(
                <div key={p.id} style={{background:"#f8fafc",borderRadius:6,padding:"3px 9px",border:`1px solid ${pColor(pp)}25`,fontSize:11}}>
                  <span style={{color:"#64748b"}}>#{p.noPnl} {p.nama}</span>
                  <span style={{color:pColor(pp),fontWeight:700,marginLeft:5,fontFamily:"'DM Mono',monospace"}}>{pp}%</span>
                </div>
              );})}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
function SummaryProgress({woData}){
  if(!woData.length) return(
    <div className="fi" style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di tab Manajemen WO terlebih dahulu</div>
    </div>
  );
  const [search,setSearch]=useState("");
  const rows=useMemo(()=>
    woData.flatMap(wo=>wo.panels.map(p=>({
      wo:wo.wo,proyek:wo.proyek,target:wo.target,
      noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty,
      overall:panelOverall(p),prog:calcPanelProgress(p),
      status:getStatus(wo.target,panelOverall(p)),
      hariSisa:daysUntil(wo.target),
    })))
    .filter(r=>r.proyek.toLowerCase().includes(search.toLowerCase())||
               r.wo.includes(search)||r.nama.toLowerCase().includes(search.toLowerCase()))
  ,[woData,search]);

  const avgOverall=rows.length?Math.round(rows.reduce((a,r)=>a+r.overall,0)/rows.length):0;
  const thS={background:"#1e3a8a",color:"#fff",padding:"8px 9px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center",borderRight:"1px solid #ffffff15",
    position:"sticky",top:0,zIndex:3};

  return(
    <div className="fi">
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:18}}>
        {[
          {l:"Total Panel",v:rows.length,c:"#2563eb"},
          {l:"Avg Overall",v:`${avgOverall}%`,c:pColor(avgOverall)},
          {l:"Selesai",v:rows.filter(r=>r.overall===100).length,c:"#16a34a"},
          {l:"Mendesak H-7",v:rows.filter(r=>isUrgent(r.target)&&r.overall<100).length,c:"#ea580c"},
          {l:"Terlambat",v:rows.filter(r=>isDelayed(r.target)&&r.overall<100).length,c:"#dc2626"},
        ].map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,fontWeight:600,textTransform:"uppercase",letterSpacing:.3}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari WO / proyek / panel..."
          style={{padding:"8px 14px",borderRadius:9,border:"1.5px solid #e2e8f0",background:"#fff",color:"#1e293b",fontSize:13,width:280}}/>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <Badge label="✅ SELESAI" color="#16a34a"/><Badge label="🟢 ON TRACK" color="#2563eb"/>
          <Badge label="🟠 MENDESAK H-7" color="#ea580c"/><Badge label="🔴 TERLAMBAT" color="#dc2626"/>
          <span style={{fontSize:11,color:"#94a3b8"}}>👁 Read-only</span>
        </div>
      </div>
      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr>
              <th style={{...thS,textAlign:"left",minWidth:60,position:"sticky",left:0,zIndex:4}}>WO</th>
              <th style={{...thS,textAlign:"left",minWidth:120,position:"sticky",left:60,zIndex:4}}>PROYEK</th>
              <th style={{...thS,minWidth:70}}>TARGET</th>
              <th style={{...thS,minWidth:55}}>H-</th>
              <th style={{...thS,textAlign:"left",minWidth:180,position:"sticky",left:180,zIndex:4}}>NAMA PANEL</th>
              <th style={{...thS,minWidth:50}}>TIPE</th>
              <th style={{...thS,minWidth:44}}>QTY</th>
              <th style={{...thS,minWidth:70,background:"#1e40af"}}>OVERALL</th>
              <th style={{...thS,minWidth:90}}>STATUS</th>
              {ALL_PROSES.map(pr=>(
                <th key={pr} style={{...thS,minWidth:80,borderBottom:`2px solid ${PROSES_COLOR[pr]}`}}>
                  {pr}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,ri)=>{
              const rBg=ri%2===0?"#fff":"#f8fafc";
              const td={padding:"7px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
              return(
                <tr key={`${r.wo}-${r.noPnl}`} style={{background:r.status.color==="#dc2626"?"#fff8f8":r.status.color==="#ea580c"?"#fff9f5":rBg}}>
                  <td style={{...td,position:"sticky",left:0,zIndex:1,fontWeight:800,color:"#1d4ed8",fontFamily:"'DM Mono',monospace",background:rBg}}>{r.wo}</td>
                  <td style={{...td,position:"sticky",left:60,zIndex:1,fontWeight:600,whiteSpace:"nowrap",background:rBg}}>{r.proyek}</td>
                  <td style={{...td,textAlign:"center",fontSize:10,color:"#64748b",whiteSpace:"nowrap"}}>{r.target}</td>
                  <td style={{...td,textAlign:"center",fontWeight:700,fontSize:11,
                    color:isDelayed(r.target)?"#dc2626":isUrgent(r.target)?"#ea580c":"#16a34a"}}>
                    {isDelayed(r.target)?`-${Math.abs(r.hariSisa)}`:`H-${r.hariSisa}`}
                  </td>
                  <td style={{...td,position:"sticky",left:180,zIndex:1,fontWeight:600,whiteSpace:"nowrap",background:rBg}}>
                    <span style={{fontSize:10,color:"#94a3b8",marginRight:4}}>#{r.noPnl}</span>{r.nama}
                  </td>
                  <td style={{...td,textAlign:"center"}}><Badge label={PANEL_TYPES[r.tipe]?.label||r.tipe} color={PANEL_TYPES[r.tipe]?.color||"#64748b"}/></td>
                  <td style={{...td,textAlign:"center",fontFamily:"'DM Mono',monospace",fontWeight:700}}>{r.qty}</td>
                  <td style={{...td,textAlign:"center",background:pBg(r.overall)+"cc"}}>
                    <span style={{fontWeight:800,color:pColor(r.overall),fontFamily:"'DM Mono',monospace",fontSize:12}}>{r.overall}%</span>
                  </td>
                  <td style={{...td,textAlign:"center"}}>
                    <Badge label={r.status.label} color={r.status.color} bg={r.status.bg}/>
                  </td>
                  {ALL_PROSES.map(pr=>{
                    const v=r.prog[pr]||0;
                    return(
                      <td key={pr} style={{...td,textAlign:"center",background:pBg(v)+"cc"}}>
                        <span style={{fontWeight:700,fontSize:11,color:pColor(v),fontFamily:"'DM Mono',monospace"}}>{v}%</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{background:"#f0f4ff"}}>
              <td colSpan={8} style={{padding:"7px 10px",fontWeight:700,color:"#475569",fontSize:11,
                borderTop:"2px solid #e2e8f0",position:"sticky",left:0,background:"#f0f4ff"}}>
                Rata-rata ({rows.length} panel)
              </td>
              <td style={{padding:"6px 8px",borderTop:"2px solid #e2e8f0",textAlign:"center"}}>
                <Badge label={`${avgOverall}%`} color={pColor(avgOverall)}/>
              </td>
              {ALL_PROSES.map(pr=>{
                const avg=rows.length?Math.round(rows.reduce((a,r)=>a+(r.prog[pr]||0),0)/rows.length):0;
                return(
                  <td key={pr} style={{padding:"6px 5px",textAlign:"center",borderTop:"2px solid #e2e8f0",background:pBg(avg)+"88"}}>
                    <span style={{fontWeight:800,fontSize:11,color:pColor(avg),fontFamily:"'DM Mono',monospace"}}>{avg}%</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL PROGRESS
// ─────────────────────────────────────────────────────────────────────────────
function DetailProgress({woData}){
  const [selWoId,setSelWoId]=useState(woData[0]?.id);
  const wo=woData.find(w=>w.id===selWoId);
  const [selPanelId,setSelPanelId]=useState(wo?.panels[0]?.id);
  const panel=wo?.panels.find(p=>p.id===selPanelId);
  const [wpFilter,setWpFilter]=useState("ALL");
  const cfg=panel?PANEL_TYPES[panel.tipe]:null;
  const calcProg=panel?calcPanelProgress(panel):{};
  const visibleWps=cfg?(wpFilter==="ALL"?cfg.wps:cfg.wps.filter(w=>w.wp===wpFilter)):[];

  const thS={background:"#1e3a8a",color:"#fff",padding:"8px 10px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,borderRight:"1px solid #ffffff15",textAlign:"center",
    position:"sticky",top:0,zIndex:3};

  if(!woData.length) return(
    <div className="fi" style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di tab Manajemen WO terlebih dahulu</div>
    </div>
  );

  return(
    <div className="fi">
      <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:"0 0 220px"}}><Lbl>Work Order</Lbl>
          <Sel value={selWoId} onChange={e=>{
            const w=woData.find(x=>x.id===Number(e.target.value));
            setSelWoId(Number(e.target.value));setSelPanelId(w?.panels[0]?.id);setWpFilter("ALL");
          }}>
            {woData.map(w=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
          </Sel>
        </div>
        <div style={{flex:1,minWidth:200}}><Lbl>Panel</Lbl>
          <Sel value={selPanelId} onChange={e=>setSelPanelId(Number(e.target.value))}>
            {wo?.panels.map(p=><option key={p.id} value={p.id}>#{p.noPnl} — {p.nama}</option>)}
          </Sel>
        </div>
        <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,
          padding:"6px 14px",fontSize:11,color:"#92400e",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
          🔒 Hanya baca · arahkan kursor ke sel ber-🕐 untuk lihat riwayat progress
        </div>
      </div>
      {panel&&cfg&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14,alignItems:"center"}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:4}}>{panel.nama}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <Badge label={cfg.label} color={cfg.color}/>
                <Badge label={`Qty: ${panel.qty}`} color="#0891b2"/>
                <Badge label={`Overall: ${panelOverall(panel)}%`} color={pColor(panelOverall(panel))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {["ALL",...cfg.wps.map(w=>w.wp)].map(w=>(
                <button key={w} onClick={()=>setWpFilter(w)}
                  style={{padding:"4px 12px",borderRadius:20,border:`1.5px solid ${wpFilter===w?"#1d4ed8":"#e2e8f0"}`,
                    background:wpFilter===w?"#1d4ed8":"#fff",color:wpFilter===w?"#fff":"#64748b",
                    cursor:"pointer",fontSize:11,fontWeight:700}}>
                  {w==="ALL"?"Semua WP":w}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap"}}>
            {ALL_PROSES.map(pr=>(
              <div key={pr} style={{display:"flex",alignItems:"center",gap:4,background:"#f8fafc",
                borderRadius:7,padding:"3px 8px",border:"1px solid #e2e8f0",fontSize:10}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:PROSES_COLOR[pr],display:"inline-block"}}/>
                <span style={{color:"#475569",fontWeight:600}}>{pr.slice(0,6)}</span>
                <span style={{fontWeight:800,color:pColor(calcProg[pr]),fontFamily:"'DM Mono',monospace"}}>{calcProg[pr]}%</span>
              </div>
            ))}
          </div>
          <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr>
                  <th style={{...thS,textAlign:"left",minWidth:52,position:"sticky",left:0,zIndex:4}}>WP</th>
                  <th style={{...thS,textAlign:"left",minWidth:200,position:"sticky",left:52,zIndex:4}}>Komponen</th>
                  <th style={{...thS,minWidth:60}}>Kode</th>
                  <th style={{...thS,minWidth:56}}>QTY 🔒</th>
                  {ALL_PROSES.map(pr=>(
                    <th key={pr} style={{...thS,minWidth:110,borderBottom:`2px solid ${PROSES_COLOR[pr]}`}}>
                      {pr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleWps.map(wpDef=>wpDef.items.map((item,ii)=>{
                  const cl=panel.checklist[item.kode]||{qty:0,progress:{}};
                  const isLocked=cl.qty===0;
                  const rBg=isLocked?"#fafafa":ii%2===0?wpDef.bg:"#fff";
                  const td={padding:"0 6px",height:36,borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg};
                  return(
                    <tr key={item.kode} style={{opacity:isLocked?.45:1}}>
                      <td style={{...td,position:"sticky",left:0,zIndex:1,fontWeight:800,fontSize:10,color:wpDef.color,verticalAlign:"middle",borderLeft:`3px solid ${isLocked?"#e2e8f0":wpDef.color}`}}>
                        {ii===0&&<span style={{background:wpDef.color+"18",border:`1px solid ${wpDef.color}33`,borderRadius:4,padding:"2px 6px",whiteSpace:"nowrap"}}>{wpDef.wp}</span>}
                      </td>
                      <td style={{...td,position:"sticky",left:52,zIndex:1,fontWeight:600,color:isLocked?"#cbd5e1":"#374151",verticalAlign:"middle",whiteSpace:"nowrap"}}>
                        {item.nama}{isLocked&&<span style={{marginLeft:6,fontSize:10,color:"#cbd5e1"}}>🔒</span>}
                      </td>
                      <td style={{...td,textAlign:"center",verticalAlign:"middle",fontFamily:"'DM Mono',monospace",color:"#94a3b8",fontSize:10}}>{item.kode}</td>
                      {/* QTY — read only */}
                      <td style={{...td,textAlign:"center",verticalAlign:"middle"}}>
                        <span style={{fontWeight:800,fontFamily:"'DM Mono',monospace",fontSize:12,
                          color:isLocked?"#fca5a5":"#1e293b",
                          background:isLocked?"#fef2f2":"#f1f5f9",
                          borderRadius:6,padding:"3px 10px",display:"inline-block"}}>
                          {cl.qty} 🔒
                        </span>
                      </td>
                      {/* PROGRESS — read only, dengan tooltip riwayat */}
                      {ALL_PROSES.map(pr=>{
                        const v=getLatestProgress(cl,pr);const isDone=v===100;
                        const hist=cl.history?.[pr]||[];
                        return(
                          <td key={pr} style={{...td,textAlign:"center",verticalAlign:"middle",padding:"4px 5px"}}>
                            {isLocked
                              ?<div style={{height:28,borderRadius:6,background:"#f1f5f9",border:"1px solid #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#e2e8f0",fontSize:12}}>—</span></div>
                              :<div className={hist.length>0?"hist-cell":""} style={{height:28,borderRadius:6,
                                  cursor:hist.length>0?"help":"default",position:"relative",
                                  background:v===0?"transparent":pBg(v),
                                  border:v===0?"1px dashed #e2e8f0":`1px solid ${pColor(v)}30`,
                                  display:"flex",alignItems:"center",justifyContent:"center",minWidth:66,gap:3}}>
                                {v===0?<span style={{color:"#cbd5e1",fontSize:12}}>—</span>
                                  :<>
                                    <span style={{fontWeight:700,fontSize:11,color:pColor(v),fontFamily:"'DM Mono',monospace"}}>{isDone?"Done":`${v}%`}</span>
                                    {hist.length>0&&<span style={{fontSize:9,color:pColor(v),opacity:.6}}>🕐</span>}
                                  </>}
                                {hist.length>0&&(
                                  <div className="hist-tooltip" style={{position:"absolute",top:"calc(100% + 6px)",left:"50%",
                                    transform:"translateX(-50%)",background:"#1e293b",borderRadius:8,padding:"8px 10px",
                                    minWidth:150,zIndex:50,boxShadow:"0 6px 20px #00000035",
                                    opacity:0,visibility:"hidden",transition:"opacity .15s",pointerEvents:"none"}}>
                                    <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:6,
                                      textTransform:"uppercase",letterSpacing:.5}}>Riwayat {pr}</div>
                                    {hist.map((h,hi)=>(
                                      <div key={hi} style={{display:"flex",justifyContent:"space-between",
                                        alignItems:"center",gap:10,padding:"3px 0",
                                        borderTop:hi>0?"1px solid #ffffff15":"none"}}>
                                        <span style={{fontSize:11,color:"#e2e8f0",whiteSpace:"nowrap"}}>
                                          {fmtShort(h.tanggal)} · Shift {h.shift}
                                        </span>
                                        <span style={{fontSize:11,fontWeight:800,color:pColor(h.pct),
                                          fontFamily:"'DM Mono',monospace"}}>{h.pct}%</span>
                                      </div>
                                    ))}
                                    <div style={{position:"absolute",bottom:"100%",left:"50%",transform:"translateX(-50%)",
                                      borderLeft:"5px solid transparent",borderRight:"5px solid transparent",
                                      borderBottom:"5px solid #1e293b"}}/>
                                  </div>
                                )}
                              </div>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                }))}
              </tbody>
              <tfoot>
                <tr style={{background:"#f0f4ff"}}>
                  <td colSpan={4} style={{padding:"7px 10px",fontWeight:700,color:"#475569",fontSize:11,borderTop:"2px solid #e2e8f0",position:"sticky",left:0,background:"#f0f4ff"}}>Rata-rata</td>
                  {ALL_PROSES.map(pr=>(
                    <td key={pr} style={{padding:"6px 5px",textAlign:"center",borderTop:"2px solid #e2e8f0"}}>
                      <span style={{fontWeight:800,fontSize:11,color:pColor(calcProg[pr]),fontFamily:"'DM Mono',monospace",background:pBg(calcProg[pr]),borderRadius:5,padding:"2px 7px",display:"inline-block"}}>{calcProg[pr]}%</span>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{marginTop:7,fontSize:11,color:"#94a3b8"}}>💡 Klik cell proses untuk update · 🔒 Qty=0 terkunci</div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RAW SCHEDULE
// ─────────────────────────────────────────────────────────────────────────────
function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,logActivity,user}){
  const [weekStart,setWeekStart]=useState(TODAY);
  const [cellModal,setCellModal]=useState(null);
  const [dragInfo,setDragInfo]=useState(null);
  const [dragOverCell,setDragOverCell]=useState(null);
  const [dragMode,setDragMode]=useState(null);
  const [addModal,setAddModal]=useState(false);
  const [selDate,setSelDate]=useState(null);
  const [addForm,setAddForm]=useState({woId:"",panelId:"",prioritas:"Sedang"});
  const [modalWp,setModalWp]=useState("");
  const [modalKomponen,setModalKomponen]=useState([]);
  const [filterProses,setFilterProses]=useState("ALL");
  const [filterProyek,setFilterProyek]=useState("ALL");
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);

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

  const isWpDone=(panelData,wp,proses)=>{
    if(!panelData)return false;
    const cfg=PANEL_TYPES[panelData.tipe];
    const wpDef=cfg?.wps.find(w=>w.wp===wp);
    if(!wpDef||!wpDef.items.length)return false;
    return wpDef.items.every(it=>{
      const cl=panelData.checklist?.[it.kode];
      if(!cl)return false;
      return(cl.progress?.[proses]||0)>=100;
    });
  };

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const openCellModal=(rawId,date)=>{setCellModal({rawId,date});setModalWp("");setModalKomponen([]);};
  const rawRow=cellModal?rawData.find(r=>r.id===cellModal.rawId):null;
  const cellEntries=rawRow?.schedule?.[cellModal?.date]||[];
  const livePanelForCell=rawRow?woData.flatMap(w=>w.panels||[]).find(p=>p.id===(rawRow.panel_id||rawRow.panelId)):null;
  const panelCfg=livePanelForCell?PANEL_TYPES[livePanelForCell.tipe]:null;
  const wpItems=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];

  const syncRenharKomp=(rawId,date,wp,newKomp)=>{
    setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKomp}:r));
  };
  const syncRenharDel=(rawId,date,wp)=>{
    setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
  };

  const addEntry=async()=>{
    if(!modalWp||!modalKomponen.length)return;
    let finalKomp=modalKomponen;
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const existing=newSch[cellModal.date]||[];
      const wpEntry=existing.find(e=>e.wp===modalWp);
      let updated;
      if(wpEntry){
        finalKomp=[...new Set([...wpEntry.komponen,...modalKomponen])];
        updated=existing.map(e=>e.wp!==modalWp?e:{...e,komponen:finalKomp});
      } else {
        updated=[...existing,{wp:modalWp,komponen:modalKomponen}];
      }
      newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharKomp(cellModal.rawId,cellModal.date,modalWp,finalKomp);
    setModalWp("");setModalKomponen([]);
    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});
    await createLog(user?.name||user?.nama||'Admin','raw','update','Tambah WP '+modalWp+' ke jadwal '+(rawRow?.panel||''),rawRow?.wo_id||'','Raw Schedule',null,null,rawRow?.proyek||'',rawRow?.panel||'');
  };

  const removeEntry=async(wp)=>{
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const updated=(newSch[cellModal.date]||[]).filter(e=>e.wp!==wp);
      if(!updated.length)delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharDel(cellModal.rawId,cellModal.date,wp);
    if(updatedRow) await updateRaw(cellModal.rawId,{schedule:updatedRow.schedule});
    await createLog(user?.name||user?.nama||'Admin','raw','update','Tambah WP '+modalWp+' ke jadwal '+(rawRow?.panel||''),rawRow?.wo_id||'','Raw Schedule',null,null,rawRow?.proyek||'',rawRow?.panel||'');
  };

  const onDragStart=(e,rawId,date,entries)=>{setDragInfo({rawId,fromDate:date,entries});e.dataTransfer.effectAllowed="copyMove";};
  const onDragOver=(e,rawId,date)=>{e.preventDefault();setDragOverCell({rawId,date});};
  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    if(!dragInfo||dragInfo.fromDate===toDate){setDragOverCell(null);setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});setDragOverCell(null);
  };

  const confirmDrag=async(mode)=>{
    if(!dragMode)return;
    const{rawId,fromDate,entries,toDate}=dragMode;
    let updatedRow=null;
    setRawData(prev=>prev.map(r=>{
      if(r.id!==rawId)return r;
      const newSch={...r.schedule};
      if(mode==="move")delete newSch[fromDate];
      const existing=newSch[toDate]||[];
      const merged=[...existing];
      entries.forEach(e=>{
        const found=merged.find(m=>m.wp===e.wp);
        if(found)found.komponen=[...new Set([...found.komponen,...e.komponen])];
        else merged.push({...e});
      });
      newSch[toDate]=merged;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    if(mode==="move"){
      setRenhar(prev=>prev.map(r=>{
        if((r.raw_id||r.rawId)!==rawId||r.tanggal!==fromDate)return r;
        const entry=entries.find(e=>e.wp===r.wp);
        if(!entry)return r;
        return{...r,tanggal:toDate,komponen:entry.komponen};
      }));
    }
    setDragMode(null);setDragInfo(null);
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});
    await createLog(user?.name||user?.nama||'Admin','raw','update','Pindah/Copy jadwal Raw Schedule','','Raw Schedule');
  };

  const updatePrioritasPanel=async(panelId,val)=>{
    const toUpdate=rawData.filter(r=>(r.panel_id||r.panelId)===panelId);
    setRawData(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    setRenhar(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    for(const r of toUpdate){ await updateRaw(r.id,{prioritas:val}); }
  };

  const panelOpts=addForm.woId?woData.find(w=>w.id===Number(addForm.woId))?.panels||[]:[]; 
  const submitAdd=async()=>{
    if(!addForm.woId||!addForm.panelId)return;
    const wo=woData.find(w=>w.id===Number(addForm.woId));
    const p=wo?.panels.find(x=>x.id===Number(addForm.panelId));
    if(!wo||!p)return;
    const existing=rawData.filter(r=>(r.panel_id||r.panelId)===p.id).map(r=>r.proses);
    const toAdd=ALL_PROSES.filter(pr=>!existing.includes(pr));
    if(!toAdd.length){alert("Semua proses panel ini sudah ada!");return;}
    for(const proses of toAdd){
      await createRaw({
        wo_id:wo.id,panel_id:p.id,proyek:wo.proyek,panel:p.nama,
        proses,prioritas:addForm.prioritas,schedule:{}
      });
    }
    await refetchRaw();
    await createLog(user?.name||user?.nama||'Admin','raw','create','Tambah Panel '+p.nama+' ke Raw Schedule',wo.wo,'Raw Schedule');
    setAddModal(false);setAddForm({woId:"",panelId:"",prioritas:"Sedang"});
  };

  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    return rawData.flatMap(r=>(r.schedule?.[selDate]||[]).map(e=>({
      rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
      proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
      wp:e.wp,komponen:e.komponen,tanggal:selDate
    })));
  },[rawData,selDate]);

  const openAssign=(task)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal);
    setSelPekerja(existing?.pekerja||[]);
    setAssignModal({task,divisi,existing:existing||null,isExisting:!!existing});
  };

  const confirmDistribute=async()=>{
    if(!assignModal)return;
    const{task,divisi,existing}=assignModal;
    if(existing){
      await updateRenhar(existing.id,{pekerja:selPekerja});
      setRenhar(prev=>prev.map(r=>r.id===existing.id?{...r,pekerja:selPekerja}:r));
    } else {
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:selPekerja,
      });
      if(result?.success&&result.data){
        setRenhar(prev=>[...prev,result.data]);
        await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
      }
    }
    await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
    setAssignModal(null);setSelPekerja([]);
  };

  const distributeAll=async()=>{
    for(const task of dateTasks){
      const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>ps.includes(task.proses))?.[0]||"mekanik";
      if(renhar.find(r=>(r.raw_id||r.rawId)===task.rawId&&r.wp===task.wp&&r.tanggal===task.tanggal))continue;
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:[],
      });
      if(result?.success&&result.data){
        setRenhar(prev=>[...prev,result.data]);
        await createLog(user?.name||user?.nama||'Admin','rencana','distribute','Distribusi '+task.proses+' - '+task.panel+' ('+task.tanggal+')',task.woId||'','Rencana Harian',null,null,task.proyek,task.panel);
      }
    }
  };

  const thS={background:"#1e3a8a",color:"#fff",padding:"8px 10px",fontWeight:700,fontSize:10,
    whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center",borderRight:"1px solid #ffffff15",
    position:"sticky",top:0,zIndex:3};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <Btn outline color="#2563eb" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,-7))}>‹ Minggu Lalu</Btn>
          <button onClick={()=>setWeekStart(TODAY)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #e2e8f0",background:weekStart===TODAY?"#eff6ff":"#fff",color:"#2563eb",cursor:"pointer",fontSize:12,fontWeight:700}}>Hari Ini</button>
          <Btn outline color="#2563eb" style={{padding:"6px 14px",fontSize:12}} onClick={()=>setWeekStart(addDays(weekStart,7))}>Minggu Depan ›</Btn>
        </div>
        <Btn color="#1d4ed8" onClick={()=>setAddModal(true)}>+ Tambah Panel</Btn>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center",background:"#fff",borderRadius:10,padding:"8px 12px",border:"1px solid #e2e8f0"}}>
        <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Filter:</span>
        <select value={filterProyek} onChange={e=>{setFilterProyek(e.target.value);setFilterPanel("ALL");}} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer"}}>
          <option value="ALL">Semua Proyek</option>
          {[...new Set(rawData.map(r=>r.proyek))].map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)} style={{padding:"4px 10px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",fontSize:11,fontWeight:600,color:"#475569",cursor:"pointer",maxWidth:260}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(rawData.filter(r=>filterProyek==="ALL"||r.proyek===filterProyek).map(r=>r.panel))].map(p=>(<option key={p} value={p}>{p}</option>))}
        </select>
        {(filterProyek!=="ALL"||filterPanel!=="ALL")&&(
          <button onClick={()=>{setFilterProyek("ALL");setFilterPanel("ALL");}} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",fontSize:11,fontWeight:600,cursor:"pointer"}}>✕ Reset</button>
        )}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>Filter Proses:</span>
        <button onClick={()=>setFilterProses("ALL")} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${filterProses==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:filterProses==="ALL"?"#1d4ed8":"#fff",color:filterProses==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
        {ALL_PROSES.map(pr=>{const pc=PROSES_COLOR[pr]||"#64748b";const isSel=filterProses===pr;return(<button key={pr} onClick={()=>setFilterProses(isSel?"ALL":pr)} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr}</button>);})}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {WP_LIST.map(wp=>(<span key={wp} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:WP_COLOR[wp],background:WP_COLOR[wp]+"18",border:`1px solid ${WP_COLOR[wp]}33`,borderRadius:20,padding:"2px 10px"}}><span style={{width:7,height:7,borderRadius:"50%",background:WP_COLOR[wp],display:"inline-block"}}/>{wp}</span>))}
        {PRIORITAS.map(p=><Badge key={p} label={p} color={PRIORITAS_COLOR[p]}/>)}
        <span style={{fontSize:11,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>✓ Finish</span>
        <span style={{fontSize:11,color:"#f59e0b",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:20,padding:"2px 10px",fontWeight:700}}>● On Progress</span>
        <span style={{fontSize:11,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>○ Belum Mulai</span>
      </div>
      <div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr>
              <th style={{...thS,textAlign:"left",minWidth:120,position:"sticky",left:0,zIndex:5}}>PROYEK</th>
              <th style={{...thS,textAlign:"left",minWidth:260,position:"sticky",left:120,zIndex:5}}>PANEL</th>
              <th style={{...thS,minWidth:110,position:"sticky",left:380,zIndex:5}}>PROSES</th>
              <th style={{...thS,minWidth:90,position:"sticky",left:490,zIndex:5}}>PRIORITAS</th>
              {days.map(d=>(
                <th key={d} onClick={()=>setSelDate(d===selDate?null:d)}
                  style={{...thS,minWidth:120,cursor:"pointer",background:d===TODAY?"#1e40af":selDate===d?"#1d4ed8":"#1e3a8a",borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"}}>
                  <div>{getDayLabel(d)}</div>
                  {d===TODAY&&<div style={{fontSize:9,opacity:.7}}>Hari Ini</div>}
                  {selDate===d&&<div style={{fontSize:9,color:"#93c5fd"}}>▼ Review</div>}
                </th>
              ))}
              <th style={{...thS,minWidth:40,position:"sticky",right:0,zIndex:5}}>✕</th>
            </tr>
          </thead>
          <tbody>
            {(()=>{
              const PRIO_ORDER={"Tinggi":0,"Sedang":1,"Rendah":2};
              const visibleRows=rawData.filter(row=>
                (filterProses==="ALL"||row.proses===filterProses)&&
                (filterProyek==="ALL"||row.proyek===filterProyek)&&
                (filterPanel==="ALL"||row.panel===filterPanel)
              ).sort((a,b)=>{
                const pa=PRIO_ORDER[a.prioritas]??1;const pb=PRIO_ORDER[b.prioritas]??1;
                if(pa!==pb)return pa-pb;
                const aId=a.panel_id||a.panelId;const bId=b.panel_id||b.panelId;
                if(aId!==bId)return aId-bId;
                return 0;
              });
              return visibleRows.map((row,ri)=>{
                const pc=PROSES_COLOR[row.proses]||"#64748b";
                const priColor=PRIORITAS_COLOR[row.prioritas]||"#64748b";
                const rBg=ri%2===0?"#fff":"#f8fafc";
                const prevRow=visibleRows[ri-1];
                const prevPanelId=prevRow?(prevRow.panel_id||prevRow.panelId):null;
                const curPanelId=row.panel_id||row.panelId;
                const isNewPanel=!prevRow||prevPanelId!==curPanelId;
                const panelTopBorder=isNewPanel&&ri>0?"3px solid #1e293b":"1px solid #f1f5f9";
                const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"6px 8px",verticalAlign:"middle",borderTop:panelTopBorder};
                return(
                  <tr key={row.id}>
                    <td style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}>{row.proyek}</td>
                    <td style={{...td,position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}>{row.panel}</td>
                    <td style={{...td,position:"sticky",left:380,zIndex:2,textAlign:"center"}}>
                      <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:6,padding:"2px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>{row.proses}</span>
                    </td>
                    <td style={{...td,position:"sticky",left:490,zIndex:2,textAlign:"center"}}>
                      <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                        style={{padding:"2px 6px",borderRadius:6,border:`1.5px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:10,fontWeight:700,cursor:"pointer"}}>
                        {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    {days.map(d=>{
                      const entries=row.schedule?.[d]||[];
                      const isOver=dragOverCell?.rawId===row.id&&dragOverCell?.date===d;
                      const isSelDate=selDate===d;
                      return(
                        <td key={d} style={{...td,textAlign:"center",padding:"4px",background:isOver?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg,outline:isOver?"2px dashed #2563eb":"none"}}
                          onDragOver={e=>onDragOver(e,row.id,d)}
                          onDrop={e=>onDrop(e,row.id,d)}
                          onDragLeave={()=>setDragOverCell(null)}>
                          {entries.length>0?(
                            <div draggable onDragStart={e=>onDragStart(e,row.id,d,entries)}
                              onClick={()=>openCellModal(row.id,d)}
                              style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",cursor:"grab",padding:"3px",borderRadius:6,border:isSelDate?"1px solid #bfdbfe":"1px solid transparent"}}>
                              {entries.map(e=>{
                                const status=getTaskStatus(row,d,e.wp,e.komponen);
                                const statusStyle=status==="finish"?{background:"#16a34a",opacity:.9}:status==="on_progress"?{background:"#f59e0b"}:{background:WP_COLOR[e.wp]||"#64748b"};
                                const statusIcon=status==="finish"?"✓":status==="on_progress"?"●":"";
                                return(<div key={e.wp} style={{...statusStyle,color:"#fff",borderRadius:4,padding:"2px 6px",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",gap:3}}>{statusIcon&&<span style={{fontSize:9}}>{statusIcon}</span>}{e.wp}<span style={{fontSize:9,opacity:.8,marginLeft:2}}>({e.komponen.length})</span></div>);
                              })}
                            </div>
                          ):(
                            <div onClick={()=>openCellModal(row.id,d)}
                              style={{width:"100%",height:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s"}}
                              onMouseEnter={e=>{e.target.style.borderColor="#94a3b8";e.target.style.color="#94a3b8";}}
                              onMouseLeave={e=>{e.target.style.borderColor="#e2e8f0";e.target.style.color="#e2e8f0";}}>+</div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{...td,textAlign:"center",position:"sticky",right:0,zIndex:2}}>
                      <button onClick={async()=>{await createLog(user?.name||user?.nama||'Admin','raw','delete','Hapus Raw Schedule '+row.proses+' - '+row.panel,row.wo_id||'','Raw Schedule',null,null,row.proyek,row.panel);await supabase.from('raw_schedule').update({deleted_at:new Date().toISOString(),deleted_by:user?.name||user?.nama||'Admin'}).eq('id',row.id);setRawData(prev=>prev.filter(r=>r.id!==row.id));}} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:14}}>🗑</button>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {selDate&&(
        <Card style={{marginTop:16,border:"1.5px solid #bfdbfe",background:"#f0f8ff"}} className="su">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{fontWeight:800,fontSize:15,color:"#1d4ed8"}}>📋 {fmtDateFull(selDate)}</div>
              <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{dateTasks.length} pekerjaan · Distribusi dilakukan di tab Rencana Harian</div>
            </div>
            <button onClick={()=>setSelDate(null)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:20}}>✕</button>
          </div>
          {dateTasks.map((t,i)=>{
            const pc=PROSES_COLOR[t.proses]||"#475569";
            const wc=WP_COLOR[t.wp]||"#64748b";
            const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
            const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
            const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
            const status=getTaskStatus(t,t.tanggal,t.wp,t.komponen);
            const statusColor=status==="finish"?"#16a34a":status==="on_progress"?"#f59e0b":"#64748b";
            const statusLabel=status==="finish"?"✓ Finish":status==="on_progress"?"● On Progress":"○ Belum Mulai";
            const taskKey=`${t.rawId}-${t.wp}-${t.tanggal}`;
            const isExpanded=expandedTasks[taskKey];
            const grouped={finish:[],on_progress:[],belum_mulai:[]};
            t.komponen.forEach(k=>{
              const s=getKomponenStatus(t.panelId,t.proses,k);
              const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);
              grouped[s].push({kode:k,nama:item?.nama||k});
            });
            const statusGroups=[
              {key:"finish",label:"✓ Finish",color:"#16a34a",bg:"#f0fdf4",border:"#bbf7d0"},
              {key:"on_progress",label:"● On Progress",color:"#f59e0b",bg:"#fffbeb",border:"#fde68a"},
              {key:"belum_mulai",label:"○ Belum Mulai",color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"},
            ];
            return(
              <div key={i} style={{padding:"10px 14px",borderRadius:10,marginBottom:8,background:"#fff",border:`1px solid ${statusColor}30`}}>
                <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:6}}>
                  <div style={{flex:1,minWidth:160}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>{t.proyek}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{t.panel}</div>
                  </div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                    <Badge label={t.proses} color={pc}/>
                    <span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 9px",fontSize:11,fontWeight:700}}>{t.wp}</span>
                    <Badge label={t.prioritas||"Sedang"} color={priColor}/>
                    <span style={{fontSize:11,fontWeight:700,color:statusColor}}>{statusLabel}</span>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",flex:1}}>
                    {t.komponen.map(k=>{const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:"#f1f5f9",borderRadius:4,padding:"2px 8px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||k}</span>;})}
                  </div>
                  <button onClick={()=>setExpandedTasks(prev=>({...prev,[taskKey]:!prev[taskKey]}))}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#475569",borderRadius:7,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
                    {isExpanded?"▲ Tutup":"▼ Detail Status"}
                  </button>
                </div>
                {isExpanded&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:"1px dashed #e2e8f0",display:"flex",flexDirection:"column",gap:8}}>
                    {statusGroups.filter(g=>grouped[g.key].length>0).map(g=>(
                      <div key={g.key} style={{background:g.bg,border:`1px solid ${g.border}`,borderRadius:8,padding:"8px 12px"}}>
                        <div style={{fontWeight:800,fontSize:11,color:g.color,marginBottom:6,letterSpacing:.3}}>{g.label} ({grouped[g.key].length})</div>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          {grouped[g.key].map(it=>(<span key={it.kode} style={{background:"#fff",border:`1px solid ${g.border}`,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600,color:"#475569"}}>{it.nama}</span>))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {cellModal&&rawRow&&(
        <Modal title={`Jadwal ${getDayLabel(cellModal.date)} — ${rawRow.proses}`} onClose={()=>setCellModal(null)} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>{rawRow.proyek} · {rawRow.panel}</div>
          {cellEntries.length>0&&(
            <div style={{marginBottom:16}}>
              <Lbl>WP & Komponen Terjadwal</Lbl>
              {cellEntries.map(e=>{
                const wc=WP_COLOR[e.wp]||"#64748b";
                return(
                  <div key={e.wp} style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid #e2e8f0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 10px",fontSize:12,fontWeight:700}}>{e.wp}</span>
                      <button onClick={()=>removeEntry(e.wp)} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:13}}>✕ Hapus</button>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {e.komponen.map(k=>{const item=panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k);return <span key={k} style={{background:wc+"18",color:wc,border:`1px solid ${wc}33`,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>{item?.nama||k}</span>;})}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{
                const added=cellEntries.some(e=>e.wp===wp);
                const wpDone=isWpDone(livePanelForCell,wp,rawRow?.proses||"");
                const disabled=added||wpDone;const sel=modalWp===wp;const wc=WP_COLOR[wp];
                return(
                  <button key={wp} onClick={()=>{if(!disabled){setModalWp(sel?"":wp);setModalKomponen([]);}}} disabled={disabled}
                    style={{padding:"8px",borderRadius:8,border:`2px solid ${wpDone?"#16a34a":sel?wc:disabled?"#e2e8f0":"#e2e8f0"}`,background:wpDone?"#f0fdf4":sel?wc+"18":disabled?"#f8fafc":"#f8fafc",cursor:disabled?"not-allowed":"pointer",color:wpDone?"#16a34a":sel?wc:disabled?"#cbd5e1":"#64748b",fontWeight:700,fontSize:12,opacity:1,display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}>
                    {wpDone?(<><span>✅</span>{wp}<span style={{fontSize:10,color:"#16a34a"}}>Selesai</span></>):(<><span style={{width:8,height:8,borderRadius:"50%",background:added?"#e2e8f0":wc}}/>{wp} {added?"(terjadwal)":sel?"✓":""}</>)}
                  </button>
                );
              })}
            </div>
            {modalWp&&wpItems.length>0&&(
              <>
                <Lbl>Pilih Komponen {modalWp}</Lbl>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                  {wpItems.map(it=>{
                    const sel=modalKomponen.includes(it.kode);const wc=WP_COLOR[modalWp]||"#64748b";
                    return(<button key={it.kode} onClick={()=>setModalKomponen(prev=>sel?prev.filter(k=>k!==it.kode):[...prev,it.kode])} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${sel?wc:"#e2e8f0"}`,background:sel?wc+"18":"#f8fafc",color:sel?wc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>{sel?"✓ ":""}{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></button>);
                  })}
                </div>
                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>+ Tambah {modalWp} ({modalKomponen.length} komponen)</Btn>
              </>
            )}
          </div>
          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={()=>setCellModal(null)}>Selesai</Btn>
          </div>
        </Modal>
      )}

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
        <Modal title="Pindah atau Copy?" onClose={()=>setDragMode(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:16}}>Dari <strong>{getDayLabel(dragMode.fromDate)}</strong> ke <strong>{getDayLabel(dragMode.toDate)}</strong></div>
          <div style={{display:"flex",gap:10}}>
            <Btn color="#dc2626" style={{flex:1}} onClick={()=>confirmDrag("move")}>📦 Pindah</Btn>
            <Btn color="#2563eb" style={{flex:1}} onClick={()=>confirmDrag("copy")}>📋 Copy</Btn>
          </div>
        </Modal>
      )}

      {addModal&&(
        <Modal title="Tambah Panel ke Raw Schedule" onClose={()=>setAddModal(false)} width={480}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><Lbl>Work Order</Lbl>
              <Sel value={addForm.woId} onChange={e=>setAddForm({...addForm,woId:e.target.value,panelId:""})}>
                <option value="">-- Pilih WO --</option>
                {woData.map(w=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
              </Sel>
            </div>
            <div><Lbl>Panel</Lbl>
              <Sel value={addForm.panelId} onChange={e=>setAddForm({...addForm,panelId:e.target.value})}>
                <option value="">-- Pilih Panel --</option>
                {panelOpts.map(p=><option key={p.id} value={p.id}>#{p.no_pnl||p.noPnl} — {p.nama}</option>)}
              </Sel>
            </div>
            <div><Lbl>Prioritas</Lbl>
              <Sel value={addForm.prioritas} onChange={e=>setAddForm({...addForm,prioritas:e.target.value})}>
                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setAddModal(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAdd}>Tambah Panel</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


function ManajemenWO({woData,setWoData,createWO,updateWO,removeWO,logActivity,user}){
  const blank={wo:"",proyek:"",target:""};
  const blankPanel={noPnl:"",nama:"",tipe:"FS",qty:1};
  const [form,setForm]=useState(blank);
  const [panels,setPanels]=useState([{...blankPanel}]);
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [open,setOpen]=useState(false);
  const [expandedWo,setExpandedWo]=useState({});
  const [expandedPanel,setExpandedPanel]=useState({});

  const save=async()=>{
    const np=panels.filter(p=>p.nama).map((p,i)=>({
      id:uid(),noPnl:Number(p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,
      checklist:initChecklist(p.tipe,Number(p.qty)||1),catatan:"",
    }));
    if(editId){
      const result=await updateWO(editId,{wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(editId, np);
        await createLog(user?.name||user?.nama||'Admin','wo','update','Edit WO '+form.wo+' - '+form.proyek,form.wo,'Manajemen WO',null,null,form.proyek,'');
        setWoData(prev=>prev.map(w=>w.id==editId?{...w,...form,panels:np}:w));
      }
    } else {
      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        await createLog(user?.name||user?.nama||'Admin','wo','create','Tambah WO '+form.wo+' - '+form.proyek,form.wo,'Manajemen WO',null,null,form.proyek,'');
        setWoData(prev=>[...prev,{...result.data,panels:np}]);
      }
    }
    setOpen(false);
  };
  const [editingQty,setEditingQty]=useState<any>(null);
  const [tempQty,setTempQty]=useState<any>({});

  const updateItemQty=(woId,panelId,kode,qty)=>{
    setWoData(prev=>prev.map(wo=>wo.id!==woId?wo:{...wo,panels:wo.panels.map(p=>{
      if(p.id!==panelId)return p;
      const nq=Number(qty)||0;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq}};
      if(nq===0)nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
      return{...p,checklist:nc};
    })}));
  };

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <STitle style={{marginBottom:0}}>Manajemen Work Order</STitle>
        <Btn color="#1d4ed8" onClick={()=>{setForm(blank);setPanels([{...blankPanel}]);setEditId(null);setOpen(true);}}>+ Tambah WO</Btn>
      </div>
      {woData.length===0&&!open&&(
        <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
          <div style={{fontSize:40,marginBottom:12}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Belum ada Work Order</div>
          <div style={{fontSize:12,marginTop:4}}>Klik tombol "+ Tambah WO" untuk membuat WO pertama</div>
        </div>
      )}
      {woData.map(wo=>{
        const pct=woOverall(wo);const st=getStatus(wo.target,pct);const isExp=expandedWo[wo.id];const d=daysUntil(wo.target);
        return(
          <Card key={wo.id} style={{marginBottom:12,borderLeft:`3px solid ${st.color}`,padding:0,overflow:"hidden"}}>
            <div style={{padding:"14px 16px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,alignItems:"center",
              cursor:"pointer",background:isExp?"#f8faff":"#fff",borderBottom:isExp?"1px solid #e2e8f0":"none"}}
              onClick={()=>setExpandedWo(p=>({...p,[wo.id]:!p[wo.id]}))}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <span style={{fontSize:12,color:"#94a3b8"}}>{isExp?"▼":"▶"}</span>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontWeight:800,fontSize:15,fontFamily:"'DM Mono',monospace",color:"#1d4ed8"}}>WO {wo.wo}</span>
                    <span style={{color:"#1e293b",fontWeight:700}}>{wo.proyek}</span>
                    <span style={{color:"#94a3b8",fontSize:12}}>📅 {wo.target}</span>
                    {pct<100&&<span style={{fontSize:11,color:st.color,fontWeight:600}}>
                      {isDelayed(wo.target)?`⚠️ -${Math.abs(d)}hr`:`H-${d}`}
                    </span>}
                  </div>
                  <div style={{marginTop:4,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    <Badge label={st.label} color={st.color} bg={st.bg}/>
                    <span style={{fontWeight:800,color:pColor(pct),fontFamily:"'DM Mono',monospace"}}>{pct}%</span>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{(wo.panels??[]).length} panel</span>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:7}} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels(wo.panels.map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                <button onClick={()=>setDelId(wo.id)}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>🗑</button>
              </div>
            </div>
            {isExp&&wo.panels.map(p=>{
              const pp=panelOverall(p);const isPExp=expandedPanel[p.id];const cfg=PANEL_TYPES[p.tipe];
              return(
                <div key={p.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                  <div style={{padding:"10px 16px 10px 28px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",
                    cursor:"pointer",background:isPExp?"#f8fafc":"#fff",borderBottom:isPExp?"1px solid #f1f5f9":"none"}}
                    onClick={()=>setExpandedPanel(prev=>({...prev,[p.id]:!prev[p.id]}))}>
                    <span style={{fontSize:11,color:"#94a3b8"}}>{isPExp?"▼":"▶"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontWeight:700,color:"#475569",fontSize:12}}>#{p.noPnl}</span>
                        <span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{p.nama}</span>
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                        <Badge label={cfg?.label||p.tipe} color={cfg?.color||"#64748b"}/>
                        <Badge label={`Qty: ${p.qty}`} color="#0891b2"/>
                        <Badge label={`${pp}%`} color={pColor(pp)}/>
                      </div>
                    </div>
                    <div style={{minWidth:120}}><PBar pct={pp} h={6}/></div>
                  </div>
                  {isPExp&&cfg&&(
                    <div style={{padding:"12px 16px 12px 28px",background:"#fafbff"}}>
                      {cfg.wps.map(wpDef=>(
                        <div key={wpDef.wp} style={{marginBottom:12}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                            <span style={{fontWeight:800,fontSize:12,color:wpDef.color,background:wpDef.color+"18",border:`1px solid ${wpDef.color}33`,borderRadius:6,padding:"2px 10px"}}>{wpDef.wp}</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{wpDef.range}</span>
                          </div>
                          <div style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",overflow:"hidden"}}>
                            {wpDef.items.map((item,ii)=>{
                              const cl=p.checklist[item.kode]||{qty:0};const isLocked=cl.qty===0;
                              return(
                                <div key={item.kode} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",
                                  borderBottom:ii<wpDef.items.length-1?"1px solid #f1f5f9":"none",
                                  background:isLocked?"#fffbfb":ii%2===0?wpDef.bg+"66":"#fff",opacity:isLocked?.6:1}}>
                                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#94a3b8",minWidth:44}}>{item.kode}</span>
                                  <span style={{fontSize:12,fontWeight:600,color:"#374151",flex:1}}>
                                    {item.nama}{isLocked&&<span style={{marginLeft:6,fontSize:10,color:"#fca5a5"}}>🔒</span>}
                                  </span>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    <span style={{fontSize:11,color:"#94a3b8"}}>Qty:</span>
                                    {editingQty?.woId===wo.id&&editingQty?.panelId===p.id&&editingQty?.kode===item.kode?(
                                      <>
                                        <input type="number" min="0" value={tempQty[wo.id+"-"+p.id+"-"+item.kode]??cl.qty}
                                          onChange={e=>{const k=wo.id+"-"+p.id+"-"+item.kode;setTempQty(prev=>({...prev,[k]:e.target.value}));}}
                                          onClick={e=>e.stopPropagation()}
                                          style={{width:56,padding:"4px 6px",borderRadius:6,border:"1.5px solid #2563eb",background:"#eff6ff",fontSize:12,textAlign:"center",fontWeight:700,color:"#1d4ed8"}} autoFocus/>
                                        <button onClick={async(e)=>{e.stopPropagation();const k=wo.id+"-"+p.id+"-"+item.kode;const newQty=tempQty[k]??cl.qty;updateItemQty(wo.id,p.id,item.kode,newQty);await createLog(user?.name||user?.nama||"Admin","wo","update","Edit Qty "+item.kode+" WO "+wo.wo+" menjadi "+newQty,wo.wo,"Manajemen WO");setEditingQty(null);}} style={{padding:"3px 7px",borderRadius:6,border:"none",background:"#16a34a",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>Save</button>
                                        <button onClick={e=>{e.stopPropagation();setEditingQty(null);}} style={{padding:"3px 7px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Cancel</button>
                                      </>
                                    ):(
                                      <span onClick={e=>{e.stopPropagation();setEditingQty({woId:wo.id,panelId:p.id,kode:item.kode});setTempQty(prev=>({...prev,[wo.id+"-"+p.id+"-"+item.kode]:cl.qty}));}} style={{width:56,padding:"4px 6px",borderRadius:6,border:"1.5px solid "+( isLocked?"#fecaca":"#e2e8f0"),background:isLocked?"#fef2f2":"#fff",fontSize:12,textAlign:"center",fontWeight:700,color:isLocked?"#fca5a5":"#1e293b",cursor:"pointer",display:"inline-block"}}>{cl.qty}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
      {delId&&(
        <Modal title="Hapus WO?" onClose={()=>setDelId(null)} width={360}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Data tidak dapat dikembalikan.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={async()=>{const wo=woData.find(w=>w.id===delId);await removeWO(delId,user?.name||user?.nama||"Admin");setWoData(prev=>prev.filter(w=>w.id!==delId));await createLog(user?.name||user?.nama||"Admin","wo","delete","Hapus WO "+(wo?.wo||"")+" - "+(wo?.proyek||""),wo?.wo||"","Manajemen WO");setDelId(null);}}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
      {open&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb",background:"#f8faff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,color:"#1e293b"}}>{editId?"✏️ Edit WO":"📝 Tambah WO Baru"}</div>
            <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#94a3b8"}}>✕</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
            <div><Lbl>No WO</Lbl><Inp placeholder="016" value={form.wo} onChange={e=>setForm({...form,wo:e.target.value})}/></div>
            <div><Lbl>Nama Proyek</Lbl><Inp placeholder="Bali Tennis Court" value={form.proyek} onChange={e=>setForm({...form,proyek:e.target.value})}/></div>
            <div><Lbl>Target Tanggal</Lbl><Inp type="date" value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/></div>
          </div>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12,borderTop:"1px solid #e2e8f0",paddingTop:16}}>Panel</div>
          {panels.map((p,i)=>(
            <div key={i} style={{background:"#fff",borderRadius:10,padding:14,marginBottom:10,border:"1px solid #e2e8f0"}}>
              <div style={{display:"grid",gridTemplateColumns:"56px 1fr 180px 70px 32px",gap:8,alignItems:"end"}}>
                <div><Lbl>No</Lbl><Inp value={p.noPnl} onChange={e=>{const n=[...panels];n[i]={...n[i],noPnl:e.target.value};setPanels(n);}} placeholder="1"/></div>
                <div><Lbl>Nama Panel</Lbl><Inp value={p.nama} onChange={e=>{const n=[...panels];n[i]={...n[i],nama:e.target.value};setPanels(n);}} placeholder="Nama panel..."/></div>
                <div><Lbl>Tipe</Lbl>
                  <Sel value={p.tipe} onChange={e=>{const n=[...panels];n[i]={...n[i],tipe:e.target.value};setPanels(n);}}>
                    {Object.entries(PANEL_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </Sel>
                </div>
                <div><Lbl>Qty</Lbl><Inp type="number" min="1" value={p.qty} onChange={e=>{const n=[...panels];n[i]={...n[i],qty:e.target.value};setPanels(n);}}/></div>
                <div style={{paddingBottom:2}}>
                  <button onClick={()=>setPanels(panels.filter((_,j)=>j!==i))}
                    style={{width:32,height:36,borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:14}}>✕</button>
                </div>
              </div>
            </div>
          ))}
          <button onClick={()=>setPanels([...panels,{...blankPanel}])}
            style={{width:"100%",padding:"9px",borderRadius:8,border:"1.5px dashed #cbd5e1",
              background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600,marginBottom:16}}>
            + Tambah Panel
          </button>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setOpen(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah WO"}</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW — tabel besar per proses
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("landing");
  // Restore admin session
  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");
    if(saved){
      try{
        const parsed=JSON.parse(saved);
        setUser(parsed);
        setPage("app");
        setTab("dashboard");
      }catch{}
    }
  },[]);
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
const [woData, setWoData] = useState<any[]>([]);
const [rawData, setRawData] = useState<any[]>([]);
const [renhar, setRenhar] = useState<any[]>([]);
const [pekerja, setPekerja] = useState<any[]>([]);
  const { data: kendalaLog, create: createKendala, remove: removeKendala } = useKendala()
  const { data: activityLog, log: logActivity } = useActivityLog()
const { data: woList, loading: woLoading, error: woError, create: createWO, update: updateWO, remove: removeWO } = useWorkOrders()
const { data: pekerjaList, loading: pekerjaLoading, create: createPekerja, update: updatePekerja, remove: removePekerja } = usePekerja()
const { data: renharList, loading: renharLoading, create: createRenhar, update: updateRenhar, remove: removeRenhar } = useRenhar()
const { data: rawList, loading: rawLoading, create: createRaw, update: updateRaw, remove: removeRaw, refetch: refetchRaw } = useRawSchedule()
useEffect(() => {
  if (!woLoading) setWoData(woList)
}, [woList, woLoading])

useEffect(() => {
  if (!pekerjaLoading) setPekerja(pekerjaList)
}, [pekerjaList, pekerjaLoading])

useEffect(() => {
  if (!renharLoading) setRenhar(renharList)
}, [renharList, renharLoading])

useEffect(() => {
  if (!rawLoading) setRawData(rawList)
}, [rawList, rawLoading])
if(page==="landing") return <LandingPage onEnter={()=>setPage("login")}/>;
  if(!user)return <Login onLogin={u=>{
    setUser(u);
    setPage("app");
    setTab("redirect");
  }}/>;

  const isOp=OPERATOR_ROLES.includes(user.divisi);
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


  const monitorTabs=[
    {id:"dashboard",label:"📊 Dashboard"},
    {id:"summary",  label:"📋 Summary"},
    {id:"detail",   label:"🔍 Detail Progress"},
    ...(canRaw?[{id:"raw",label:"📅 Raw Schedule"}]:[]),
    ...(canRencana?[{id:"rencana",label:"📋 Rencana Harian"}]:[]),
    ...(canWO?[{id:"wo",label:"📝 Manajemen WO"}]:[]),
    ...(canKendala?[{id:"kendala",label:"📝 Kendala"+(kendalaLog.length>0?" ("+kendalaLog.length+")":"")}]:[]),
    ...(["admin"].includes(user.divisi)?[{id:"masteruser",label:"⚙️ System"}]:[]),
  ];

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      {isOp?(
        <div style={{display:"flex",flexDirection:"column",minHeight:"100vh"}}>
          <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"0 16px",
            height:52,display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px #00000008"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>⚡</span>
              <span style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>PROSES PRODUKSI</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,
                borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}}
                style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
                  borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:600}}>Keluar</button>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <OperatorView woData={woData} setWoData={setWoData} user={user} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createKendala={createKendala}/>
          </div>
          <div style={{position:"sticky",bottom:0,background:"#fff",borderTop:"1.5px solid #e2e8f0",
            display:"flex",height:52,zIndex:100,boxShadow:"0 -2px 10px #00000010"}}>
            <button style={{flex:1,border:"none",background:"none",cursor:"pointer",
              display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:2,color:cfg.color}}>
              <span style={{fontSize:18}}>📋</span>
              <span style={{fontSize:9,fontWeight:700,letterSpacing:.3}}>Tugas Saya</span>
            </button>
          </div>
        </div>
      ):(
        <div>
          <div style={{background:"#fff",borderBottom:"1.5px solid #e2e8f0",padding:"0 20px",
            height:54,display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px #00000008"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>⚡</span>
              <span style={{fontWeight:800,fontSize:15,color:"#1e293b",letterSpacing:.2}}>PROSES PRODUKSI</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {alerts>0&&(
                <span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",
                  borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>🔔 {alerts} peringatan</span>
              )}
              <span style={{fontSize:12,color:"#475569",fontWeight:500}}>{user.name}</span>
              <span style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.color}30`,
                borderRadius:20,padding:"2px 11px",fontSize:11,fontWeight:700}}>{cfg.icon} {cfg.label}</span>
              <button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}}
                style={{background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",
                  borderRadius:8,padding:"5px 13px",cursor:"pointer",fontSize:12,fontWeight:600}}>Keluar</button>
            </div>
          </div>
          <div style={{background:"#fff",borderBottom:"1px solid #f1f5f9",padding:"0 20px",
            display:"flex",gap:0,overflowX:"auto",boxShadow:"0 1px 0 #e2e8f0",
            position:"sticky",top:54,zIndex:99}}>
            {monitorTabs.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{padding:"11px 18px",border:"none",background:"none",cursor:"pointer",
                  fontSize:12,fontWeight:700,whiteSpace:"nowrap",letterSpacing:.2,
                  color:tab===t.id?cfg.color:"#94a3b8",
                  borderBottom:`2.5px solid ${tab===t.id?cfg.color:"transparent"}`,
                  transition:"all .15s"}}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{padding:"20px",maxWidth:1440,margin:"0 auto"}}>
            {tab==="dashboard"&&<Dashboard woData={woData}/>}
            {tab==="summary"&&<SummaryProgress woData={woData}/>}
            {tab==="detail"&&<DetailProgress woData={woData}/>}
            {tab==="raw"&&<RawSchedule woData={woData} rawData={rawData} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} user={user}/>}
            {tab==="rencana"&&<RencanaHarian rawData={rawData} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} user={user}/>}
            {tab==="wo"&&<ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} user={user}/>}
            {tab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} user={user}/>}
            {tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar}/>}
            {tab==="maintenance"&&<MaintenanceTab user={user} logActivity={logActivity}/>}
            {tab==="masteruser"&&<SystemTab user={user} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/>}
            {tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala}/>}
          </div>
        </div>
      )}
    </div>
  );
}




































































































