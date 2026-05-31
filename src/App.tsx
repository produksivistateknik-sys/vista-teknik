
import { useState, useMemo, useEffect } from "react";
import { usePekerja } from './hooks/usePekerja'
import { useRenhar } from './hooks/useRenhar'
import { useKendala } from './hooks/useKendala'
import { supabase } from './lib/supabase'
import { useWorkOrders } from './hooks/useWorkOrders'
import { workOrderService } from './services/workOrderService'
import { useRawSchedule } from "./hooks/useRawSchedule";
import { useActivityLog } from './hooks/useActivityLog';
import { useLog } from './hooks/useLog';
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
const GCss=`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f0f2f5;color:#1a1d23;font-family:Inter,sans-serif;font-size:12.5px;font-weight:400;text-align:left}
h1,h2,h3,h4,h5,h6{font-weight:500;text-align:left}
th,td{text-align:left;font-weight:400}
button{font-weight:500}
b,strong{font-weight:500}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
input,select,textarea,button{font-family:inherit;outline:none}
input::placeholder,textarea::placeholder{color:#9ca3af}
.fi{animation:fadeIn .2s ease forwards}
.su{animation:slideUp .18s ease forwards}
.hist-cell:hover .hist-tooltip{opacity:1!important;visibility:visible!important}
.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5}
.erp-sb{width:220px;min-width:220px;height:100vh;background:#1e2330;display:flex;flex-direction:column;transition:width .2s ease,min-width .2s ease;overflow:hidden;flex-shrink:0}
.erp-sb.col{width:52px;min-width:52px}
.erp-sb-head{height:56px;display:flex;align-items:center;padding:0 16px;gap:10px;overflow:hidden;flex-shrink:0;background:#171b27;border-bottom:1px solid #2d3348}
.erp-sb.col .erp-sb-head{padding:0;justify-content:center}
.erp-logo{width:30px;height:30px;min-width:30px;background:#3b5bdb;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
.erp-brand{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .15s;min-width:0}
.erp-sb.col .erp-brand{opacity:0;pointer-events:none;width:0}
.erp-brand-name{font-weight:600;font-size:12px;color:#f1f3f9;line-height:1.2;letter-spacing:.2px}
.erp-brand-sub{font-size:9px;color:#6b7694;margin-top:2px;line-height:1.3;letter-spacing:.3px;text-transform:uppercase}
.erp-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 0}
.erp-nav::-webkit-scrollbar{width:2px}
.erp-nav::-webkit-scrollbar-thumb{background:#2d3348;border-radius:2px}
.erp-nav-grp{font-size:9px;font-weight:600;color:#4a5270;text-transform:uppercase;letter-spacing:.9px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .12s}
.erp-sb.col .erp-nav-grp{opacity:0;height:0;padding:0;min-height:0;overflow:hidden}
.erp-nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#8892b0;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .12s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit;line-height:1.4}
.erp-nav-item:hover{background:#252b3d;color:#c8d0e8}
.erp-nav-item.active{background:#2d3a6b;color:#7b9cff;font-weight:500}
.erp-sb.col .erp-nav-item{padding:9px 0;margin:1px 0;border-radius:0;justify-content:center;width:100%;gap:0}
.erp-nav-item i{font-size:15px;flex-shrink:0;width:17px;text-align:center;color:inherit}
.erp-nav-label{overflow:hidden;flex:1;opacity:1;transition:opacity .12s;font-size:12px}
.erp-sb.col .erp-nav-label{opacity:0;width:0}
.erp-nav-badge{background:#e53e3e22;color:#fc8181;border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:600;flex-shrink:0;transition:opacity .12s;line-height:1.5}
.erp-sb.col .erp-nav-badge{opacity:0}
.erp-sb-foot{padding:10px 12px;border-top:1px solid #2d3348;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0;background:#171b27}
.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0;gap:0}
.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:6px;background:#2d3a6b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#7b9cff;flex-shrink:0;border:1px solid #3d4f8a}
.erp-foot-info{flex:1;min-width:0;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-foot-info{opacity:0;width:0;pointer-events:none}
.erp-foot-name{font-size:11.5px;font-weight:600;color:#c8d0e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.3px}
.erp-foot-role{font-size:9.5px;color:#4a5270;margin-top:1px;letter-spacing:.2px}
.erp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}
.erp-topbar{height:40px;background:#fff;border-bottom:1px solid #e5e8ed;display:flex;align-items:center;padding:0 14px;gap:8px;flex-shrink:0}
.erp-toggle{width:26px;height:26px;border-radius:5px;border:1px solid #e5e8ed;background:#f8f9fb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;flex-shrink:0;transition:all .12s}
.erp-toggle:hover{background:#eff3ff;color:#3b5bdb;border-color:#c5d0ff}
.erp-toggle i{font-size:14px}
.erp-search{flex:1;max-width:240px;height:26px;border:1px solid #e5e8ed;border-radius:5px;padding:0 9px 0 28px;font-size:11.5px;color:#1a1d23;background:#f8f9fb;outline:none;font-family:inherit}
.erp-search:focus{border-color:#3b5bdb;background:#fff}
.erp-topbar-right{display:flex;align-items:center;gap:5px;margin-left:auto}
.erp-bell{width:26px;height:26px;border:1px solid #e5e8ed;border-radius:5px;background:#f8f9fb;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#6b7280;position:relative;flex-shrink:0}
.erp-bell i{font-size:13px}
.erp-bell-dot{position:absolute;top:5px;right:5px;width:5px;height:5px;border-radius:50%;background:#e53e3e;border:1.5px solid #fff}
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:14px 16px;background:#f0f2f5}
.erp-body::-webkit-scrollbar{width:4px}
.erp-body::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:2px}
.erp-tooltip-el{position:fixed;background:#1a1d23;color:#f1f3f9;font-size:11px;font-weight:500;padding:5px 10px;border-radius:5px;white-space:nowrap;pointer-events:none;z-index:9999;display:none}`;

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
            <Btn color="#dc2626" onClick={()=>{setPekerja(prev=>prev.filter(p=>p.id!==delId));setDelId(null);}}>Hapus</Btn>
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
function RencanaHarian({rawData,woData,renhar,setRenhar,pekerja,createRenhar,updateRenhar,removeRenhar,logActivity,logAct,user}){
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
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
    if(logAct) await logAct({admin_nama:user?.name||user?.nama||"Admin",module:"rencana",action_type:"distribute",description:"Distribusi "+task.proses+" - "+task.panel+" ("+task.tanggal+")",proyek:task.proyek||"",panel:task.panel||"",halaman:"Rencana Harian"});
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
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
  };
  const isDist=(task)=>!!getRenharEntry(task);
  const distCount=filteredTasks.filter(isDist).length;
  const allDist=filteredTasks.length>0&&distCount===filteredTasks.length;
  return(
    <div className="fi">
      <Card style={{marginBottom:10,padding:"10px 14px"}}>
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
            <div style={{background:pc,borderRadius:"7px 7px 0 0",padding:"7px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
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


﻿﻿﻿function ActivityLogView({activityLog}){
  const [filterAdmin,setFilterAdmin]=useState("ALL");
  const [filterModule,setFilterModule]=useState("ALL");
  const [filterAction,setFilterAction]=useState("ALL");
  const [filterTgl,setFilterTgl]=useState("");
  const [search,setSearch]=useState("");

  const MODULE_CONFIG={
    auth:    {label:"Auth",        color:"#5F5E5A",bg:"#f1f5f9",icon:"🔐"},
    wo:      {label:"Work Order",  color:"#0c447c",bg:"#e6f1fb",icon:"📋"},
    raw:     {label:"Raw Schedule",color:"#633806",bg:"#FAEEDA",icon:"📅"},
    rencana: {label:"Rencana",     color:"#27500A",bg:"#eaf3de",icon:"📊"},
    progress:{label:"Progress",    color:"#3C3489",bg:"#EEEDFE",icon:"📈"},
    kendala: {label:"Kendala",     color:"#791F1F",bg:"#FCEBEB",icon:"⚠️"},
    pekerja: {label:"Pekerja",     color:"#085041",bg:"#E1F5EE",icon:"👥"},
    general: {label:"General",     color:"#5F5E5A",bg:"#f1f5f9",icon:"⚙️"},
    maintenance:{label:"Maintenance",color:"#27500A",bg:"#eaf3de",icon:"🔧"},
  };
  const ACTION_CONFIG={
    create:    {label:"Buat",      color:"#27500A",bg:"#eaf3de"},
    update:    {label:"Edit",      color:"#0c447c",bg:"#e6f1fb"},
    delete:    {label:"Hapus",     color:"#791F1F",bg:"#FCEBEB"},
    login:     {label:"Login",     color:"#3C3489",bg:"#EEEDFE"},
    logout:    {label:"Logout",    color:"#5F5E5A",bg:"#f1f5f9"},
    distribute:{label:"Distribusi",color:"#085041",bg:"#E1F5EE"},
  };
  const todayStr=new Date().toISOString().slice(0,10);
  const adminList=[...new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean))];
  const moduleList=[...new Set(activityLog.map(a=>a.module||a.jenis).filter(Boolean))];
  const actionList=[...new Set(activityLog.map(a=>a.action_type).filter(Boolean))];
  const filtered=activityLog.filter(a=>{
    const adminName=a.admin_nama||a.user_name||"";
    const modKey=a.module||a.jenis||"";
    const actionType=a.action_type||"";
    const desc=a.description||a.aktivitas||a.action||"";
    const woNo=a.wo_number||a.wo_no||"";
    if(filterAdmin!=="ALL"&&adminName!==filterAdmin)return false;
    if(filterModule!=="ALL"&&modKey!==filterModule)return false;
    if(filterAction!=="ALL"&&actionType!==filterAction)return false;
    if(filterTgl&&!a.created_at?.startsWith(filterTgl))return false;
    if(search){const q=search.toLowerCase();if(!desc.toLowerCase().includes(q)&&!adminName.toLowerCase().includes(q)&&!woNo.toLowerCase().includes(q))return false;}
    return true;
  });
  const fmtDateTime=(ts)=>{
    if(!ts)return"—";
    const d=new Date(ts);
    return d.toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})+" · "+d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})+" WIB";
  };
  const stats=[
    {l:"Total Log",v:activityLog.length,c:"#185FA5"},
    {l:"Hari Ini",v:activityLog.filter(a=>a.created_at?.startsWith(todayStr)).length,c:"#3B6D11"},
    {l:"Admin Aktif",v:new Set(activityLog.map(a=>a.admin_nama||a.user_name).filter(Boolean)).size,c:"#BA7517"},
    {l:"WO Terlibat",v:new Set(activityLog.map(a=>a.wo_number||a.wo_no).filter(Boolean)).size,c:"#534AB7"},
  ];
  const isReset=filterAdmin!=="ALL"||filterModule!=="ALL"||filterAction!=="ALL"||filterTgl||search;
  const selSt={height:26,padding:"0 8px",border:"0.5px solid #d1d5db",borderRadius:5,fontSize:11,background:"#fff",color:"#374151",outline:"none",cursor:"pointer",fontFamily:"inherit"};
  const thS={background:"#f8f9fb",color:"#6b7280",fontWeight:600,padding:"7px 12px",textAlign:"left",fontSize:9.5,textTransform:"uppercase",letterSpacing:.5,borderBottom:"0.5px solid #e5e8ed",whiteSpace:"nowrap"};
  return(
    <div className="fi">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {stats.map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"0.5px solid #e5e8ed",borderRadius:8,padding:"10px 12px",borderLeft:"3px solid "+s.c}}>
            <div style={{fontSize:20,fontWeight:500,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9.5,color:"#9ca3af",marginTop:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"#fff",border:"0.5px solid #e5e8ed",borderRadius:8,marginBottom:10,overflow:"hidden"}}>
        <div style={{padding:"8px 12px",borderBottom:"0.5px solid #e5e8ed",display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",background:"#f8f9fb"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari aktivitas, admin, WO..."
            style={{height:26,padding:"0 10px 0 26px",border:"0.5px solid #d1d5db",borderRadius:5,fontSize:11,background:"#fff",color:"#1a1d23",outline:"none",width:200,fontFamily:"inherit",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23a0aec0' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}/>
          <select value={filterAdmin} onChange={e=>setFilterAdmin(e.target.value)} style={selSt}>
            <option value="ALL">Semua Admin</option>
            {adminList.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterModule} onChange={e=>setFilterModule(e.target.value)} style={selSt}>
            <option value="ALL">Semua Module</option>
            {moduleList.map(m=><option key={m} value={m}>{MODULE_CONFIG[m]?.label||m}</option>)}
          </select>
          <select value={filterAction} onChange={e=>setFilterAction(e.target.value)} style={selSt}>
            <option value="ALL">Semua Action</option>
            {actionList.map(a=><option key={a} value={a}>{ACTION_CONFIG[a]?.label||a}</option>)}
          </select>
          <input type="date" value={filterTgl} onChange={e=>setFilterTgl(e.target.value)} style={selSt}/>
          {isReset&&(
            <button onClick={()=>{setFilterAdmin("ALL");setFilterModule("ALL");setFilterAction("ALL");setFilterTgl("");setSearch("");}}
              style={{height:26,padding:"0 10px",border:"0.5px solid #fecaca",background:"#fef2f2",color:"#dc2626",borderRadius:5,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
          )}
          <span style={{fontSize:11,color:"#9ca3af",marginLeft:"auto"}}>{filtered.length} aktivitas</span>
        </div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>
              <th style={{...thS,width:36}}></th>
              <th style={thS}>Deskripsi</th>
              <th style={{...thS,width:100}}>Module</th>
              <th style={{...thS,width:80}}>Action</th>
              <th style={{...thS,width:140,textAlign:"right"}}>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={5} style={{textAlign:"center",padding:"32px",color:"#9ca3af"}}>
                <div style={{fontSize:13,fontWeight:500}}>Tidak ada aktivitas</div>
              </td></tr>
            ):(
              filtered.map((a,i)=>{
                const modKey=a.module||a.jenis||"general";
                const actionType=a.action_type||"update";
                const mc=MODULE_CONFIG[modKey]||MODULE_CONFIG.general;
                const ac=ACTION_CONFIG[actionType]||{label:actionType,color:"#5F5E5A",bg:"#f1f5f9"};
                const adminName=a.admin_nama||a.user_name||"—";
                const desc=a.description||a.aktivitas||a.action||"—";
                const woNo=a.wo_number||a.wo_no||"";
                const panelNo=a.panel||"";
                const proyekNo=a.proyek||"";
                return(
                  <tr key={a.id||i} style={{borderBottom:i<filtered.length-1?"0.5px solid #f0f2f5":"none",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8f9fb"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{width:30,height:30,borderRadius:6,background:mc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{mc.icon}</div>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#1a1d23",marginBottom:3}}>{desc}</div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <span style={{fontSize:10.5,color:"#6b7280"}}>{adminName}</span>
                        {woNo&&<span style={{fontSize:10,color:"#0c447c",fontWeight:500,background:"#e6f1fb",borderRadius:3,padding:"1px 5px",fontFamily:"monospace"}}>WO-{woNo}</span>}
                        {proyekNo&&<span style={{fontSize:10,color:"#6b7280",background:"#f1f5f9",borderRadius:3,padding:"1px 5px"}}>{proyekNo}</span>}
                        {panelNo&&<span style={{fontSize:10,color:"#6b7280",background:"#f1f5f9",borderRadius:3,padding:"1px 5px"}}>{panelNo}</span>}
                        <span style={{fontSize:10,color:"#9ca3af"}}>{a.halaman||mc.label}</span>
                      </div>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <span style={{background:mc.bg,color:mc.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:500}}>{mc.label}</span>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <span style={{background:ac.bg,color:ac.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:500}}>{ac.label}</span>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle",fontSize:10.5,color:"#9ca3af",textAlign:"right",whiteSpace:"nowrap"}}>{fmtDateTime(a.created_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
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
  const [mode,setMode]=useState("admin");
  const [div,setDiv]=useState("mekanik");
  const [namaList,setNamaList]=useState([]);
  const [selNama,setSelNama]=useState("");
  const [username,setUsername]=useState("");
  const [pwd,setPwd]=useState("");
  const [err,setErr]=useState("");
  const [show,setShow]=useState(false);
  const [loading,setLoading]=useState(false);
  const [success,setSuccess]=useState(false);

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
    const{data,error}=await supabase.from("admins").select("*").eq("username",username.trim()).eq("password",pwd).eq("is_active",true).single();
    if(error||!data){setErr("Username atau password salah!");setLoading(false);return;}
    await supabase.from("admins").update({last_login:new Date().toISOString()}).eq("id",data.id);
    await supabase.from("activity_log").insert({user_name:data.nama,admin_nama:data.nama,action:"Login ke sistem",aktivitas:"Login ke sistem",jenis:"auth",module:"auth",action_type:"login",description:"Login ke sistem",halaman:"Login",table_name:"auth"});
    localStorage.setItem("vista_admin_session",JSON.stringify({...data,divisi:"admin"}));
    setSuccess(true);
    setTimeout(()=>onLogin({...data,divisi:"admin",name:data.nama}),800);
    setLoading(false);
  };

  const goDivisi=async()=>{
    if(!selNama){setErr("Pilih nama!");return;}
    if(pwd!==DIVISI_CONFIG[div].password){setErr("Password salah!");return;}
    setLoading(true);
    const found=namaList.find(p=>p.nama===selNama);
    if(!found){setErr("Nama tidak ditemukan!");setLoading(false);return;}
    setSuccess(true);
    setTimeout(()=>onLogin({...found,divisi:div,name:found.nama}),800);
    setLoading(false);
  };

  const go=mode==="admin"?goAdmin:goDivisi;

  const css=`
    @keyframes lgFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes lgSpin{to{transform:rotate(360deg)}}
    @keyframes lgSuccess{0%{transform:scale(.8);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
    @keyframes lgPulse{0%,100%{opacity:1}50%{opacity:.5}}
    .lg-card{animation:lgFadeIn .5s cubic-bezier(.22,1,.36,1) forwards}
    .lg-inp{width:100%;height:52px;padding:0 16px 0 46px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s,background .2s}
    .lg-inp:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-inp.err{border-color:#f87171;background:#fff8f8}
    .lg-inp::placeholder{color:#94a3b8}
    .lg-sel{width:100%;height:52px;padding:0 16px;border-radius:10px;border:1.5px solid #e2e8f0;background:#f8fafc;color:#0f172a;font-size:14px;font-family:inherit;outline:none;transition:border .2s,box-shadow .2s;appearance:none;cursor:pointer}
    .lg-sel:focus{border-color:#2563eb;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .lg-btn{width:100%;height:52px;border-radius:10px;border:none;background:linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%);color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.2px;box-shadow:0 4px 14px rgba(37,99,235,.3)}
    .lg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.4)}
    .lg-btn:active:not(:disabled){transform:translateY(0)}
    .lg-btn:disabled{opacity:.75;cursor:not-allowed;transform:none}
    .lg-btn.success{background:linear-gradient(135deg,#16a34a,#15803d);box-shadow:0 4px 14px rgba(22,163,74,.3)}
    .lg-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:lgSpin .65s linear infinite}
    .lg-seg{display:flex;background:#f1f5f9;border-radius:12px;padding:4px;gap:3px}
    .lg-seg-btn{flex:1;height:44px;border:none;border-radius:9px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:6px;color:#64748b;background:transparent}
    .lg-seg-btn.on{background:#fff;color:#2563eb;box-shadow:0 1px 6px rgba(0,0,0,.1)}
    .lg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626;border-radius:10px;padding:11px 14px;font-size:13px;display:flex;align-items:center;gap:8px}
    .lg-label{font-size:12px;font-weight:600;color:#475569;margin-bottom:7px;letter-spacing:.2px;text-transform:uppercase}
    .lg-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:15px;color:#94a3b8;pointer-events:none}
    .lg-eye{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;padding:4px;display:flex;align-items:center}
    .lg-success-overlay{position:fixed;inset:0;background:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px)}
    .lg-success-icon{font-size:64px;animation:lgSuccess .5s cubic-bezier(.22,1,.36,1) forwards}
    @media(max-width:700px){.lg-left{display:none!important}.lg-right{width:100%!important;padding:24px!important}}
  `;

  return(
    <div style={{minHeight:"100vh",display:"flex",background:"#f1f5f9"}}>
      <style>{GCss}</style>
      <style>{css}</style>

      {success&&(
        <div className="lg-success-overlay">
          <div style={{textAlign:"center"}}>
            <div className="lg-success-icon">✅</div>
            <div style={{marginTop:12,fontSize:16,fontWeight:700,color:"#16a34a"}}>Login berhasil!</div>
          </div>
        </div>
      )}

      {/* LEFT */}
      <div className="lg-left" style={{width:"45%",background:"linear-gradient(145deg,#0f172a 0%,#1e3a8a 45%,#1d4ed8 100%)",display:"flex",flexDirection:"column",padding:"44px 48px",color:"#fff",position:"relative",overflow:"hidden",flexShrink:0}}>
        {/* BG circles */}
        <div style={{position:"absolute",top:-80,right:-80,width:320,height:320,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>
        <div style={{position:"absolute",bottom:-60,left:-60,width:240,height:240,borderRadius:"50%",background:"rgba(255,255,255,.03)"}}/>
        <div style={{position:"absolute",top:"40%",left:"60%",width:160,height:160,borderRadius:"50%",background:"rgba(37,99,235,.15)"}}/>

        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:56,position:"relative",zIndex:1}}>
          <div style={{width:42,height:42,background:"rgba(255,255,255,.15)",borderRadius:11,border:"1px solid rgba(255,255,255,.25)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:19,letterSpacing:-1}}>V</span>
          </div>
          <div>
            <div style={{fontWeight:800,fontSize:15,letterSpacing:.3,lineHeight:1.2}}>Vista Teknik</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.55)",fontWeight:500,marginTop:2}}>Electrical Switchboard Manufacturing</div>
          </div>
        </div>

        {/* SVG Panel Illustration */}
        <div style={{position:"relative",zIndex:1,marginBottom:28}}>
          <svg width="100%" height="130" viewBox="0 0 340 130" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Panel 1 */}
            <rect x="8" y="15" width="88" height="108" rx="5" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"/>
            <rect x="16" y="23" width="72" height="92" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="20" y="27" width="32" height="9" rx="2" fill="rgba(255,255,255,.25)"/>
            <rect x="56" y="27" width="28" height="9" rx="2" fill="rgba(255,255,255,.2)"/>
            <rect x="20" y="40" width="64" height="16" rx="2" fill="rgba(29,78,216,.6)"/>
            <rect x="25" y="45" width="5" height="6" rx="1" fill="#f59e0b"/>
            <rect x="34" y="45" width="5" height="6" rx="1" fill="#f59e0b"/>
            <rect x="43" y="45" width="5" height="6" rx="1" fill="#ef4444"/>
            <rect x="52" y="45" width="5" height="6" rx="1" fill="#22c55e"/>
            <circle cx="74" cy="48" r="5" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.3)" strokeWidth="1"/>
            <rect x="20" y="60" width="64" height="48" rx="2" fill="rgba(255,255,255,.04)"/>
            <rect x="24" y="64" width="36" height="4" rx="1" fill="rgba(255,255,255,.2)"/>
            <rect x="24" y="72" width="24" height="3" rx="1" fill="rgba(255,255,255,.13)"/>
            <circle cx="66" cy="68" r="6" fill="rgba(220,38,38,.5)"/>
            <circle cx="78" cy="68" r="6" fill="rgba(245,158,11,.5)"/>
            <circle cx="66" cy="82" r="6" fill="rgba(34,197,94,.5)"/>
            <circle cx="78" cy="82" r="6" fill="rgba(59,130,246,.5)"/>
            {/* Panel 2 - center, bigger */}
            <rect x="114" y="5" width="112" height="122" rx="5" fill="rgba(255,255,255,.09)" stroke="rgba(255,255,255,.28)" strokeWidth="2"/>
            <rect x="122" y="13" width="96" height="106" rx="3" fill="rgba(255,255,255,.05)"/>
            <rect x="126" y="17" width="44" height="10" rx="2" fill="rgba(255,255,255,.3)"/>
            <rect x="174" y="17" width="40" height="10" rx="2" fill="rgba(255,255,255,.22)"/>
            <rect x="126" y="31" width="88" height="20" rx="3" fill="rgba(29,78,216,.65)"/>
            <rect x="131" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="141" y="37" width="6" height="8" rx="1" fill="#f59e0b"/>
            <rect x="151" y="37" width="6" height="8" rx="1" fill="#ef4444"/>
            <rect x="161" y="37" width="6" height="8" rx="1" fill="#22c55e"/>
            <circle cx="195" cy="41" r="6" fill="rgba(255,255,255,.22)" stroke="rgba(255,255,255,.35)" strokeWidth="1"/>
            <rect x="126" y="55" width="88" height="58" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="130" y="60" width="50" height="5" rx="1" fill="rgba(255,255,255,.22)"/>
            <rect x="130" y="70" width="36" height="4" rx="1" fill="rgba(255,255,255,.15)"/>
            <rect x="130" y="78" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="83" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="88" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <rect x="130" y="93" width="80" height="1.5" rx=".75" fill="rgba(255,255,255,.1)"/>
            <polygon points="170,100 178,114 162,114" fill="rgba(245,158,11,.75)"/>
            <text x="170" y="112" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">!</text>
            {/* Panel 3 */}
            <rect x="244" y="22" width="88" height="100" rx="5" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.18)" strokeWidth="1.5"/>
            <rect x="252" y="30" width="72" height="84" rx="3" fill="rgba(255,255,255,.04)"/>
            <rect x="256" y="34" width="30" height="8" rx="2" fill="rgba(255,255,255,.22)"/>
            <rect x="290" y="34" width="28" height="8" rx="2" fill="rgba(255,255,255,.18)"/>
            <rect x="256" y="46" width="60" height="15" rx="2" fill="rgba(29,78,216,.55)"/>
            <rect x="261" y="51" width="5" height="5" rx="1" fill="#f59e0b"/>
            <rect x="270" y="51" width="5" height="5" rx="1" fill="#ef4444"/>
            <rect x="279" y="51" width="5" height="5" rx="1" fill="#22c55e"/>
            <rect x="256" y="65" width="60" height="44" rx="2" fill="rgba(255,255,255,.04)"/>
            <rect x="260" y="69" width="32" height="4" rx="1" fill="rgba(255,255,255,.18)"/>
            <rect x="260" y="77" width="22" height="3" rx="1" fill="rgba(255,255,255,.12)"/>
          </svg>
        </div>

        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:26,fontWeight:800,lineHeight:1.3,marginBottom:12}}>
            Monitoring produksi<br/>panel listrik
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.8,marginBottom:28,maxWidth:300}}>
            Platform terintegrasi untuk kelola jadwal, distribusi, dan progress produksi secara real-time.
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {i:"📋",t:"Multi admin dengan activity log"},
              {i:"📅",t:"Raw Schedule & Rencana Harian"},
              {i:"⚡",t:"Status H-7 mendesak otomatis"},
              {i:"🔧",t:"Jadwal service & maintenance"},
            ].map(f=>(
              <div key={f.t} style={{display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <div style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>{f.i}</div>
                <span style={{color:"rgba(255,255,255,.82)",fontWeight:500}}>{f.t}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:11,color:"rgba(255,255,255,.38)",marginTop:"auto",paddingTop:32,position:"relative",zIndex:1}}>
          © 2026 Vista Teknik. All rights reserved.
        </div>
      </div>

      {/* RIGHT */}
      <div className="lg-right" style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 64px"}}>
        <div className="lg-card" style={{width:"100%",maxWidth:440,background:"#fff",borderRadius:20,padding:"36px 40px",boxShadow:"0 4px 6px rgba(0,0,0,.04),0 24px 60px rgba(0,0,0,.08)"}}>

          <div style={{marginBottom:6}}>
            <div style={{fontSize:24,fontWeight:700,color:"#0f172a",marginBottom:5}}>Selamat datang</div>
            <div style={{fontSize:13,color:"#64748b"}}>Masuk ke akun Anda untuk melanjutkan</div>
          </div>

          <div style={{height:1,background:"#f1f5f9",margin:"20px 0"}}/>

          {/* Segment */}
          <div className="lg-seg" style={{marginBottom:24}}>
            <button className={"lg-seg-btn"+(mode==="admin"?" on":"")} onClick={()=>{setMode("admin");setErr("");}}>
              ⚙️ Admin
            </button>
            <button className={"lg-seg-btn"+(mode==="divisi"?" on":"")} onClick={()=>{setMode("divisi");setErr("");}}>
              👷 Operator
            </button>
          </div>

          {mode==="admin"?(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="lg-label">Username</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">👤</span>
                  <input className={"lg-inp"+(err?" err":"")} value={username}
                    onChange={e=>{setUsername(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan username..."/>
                </div>
              </div>
              <div>
                <div className="lg-label">Password</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">🔒</span>
                  <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password..." style={{paddingRight:44}}/>
                  <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div>
                <div className="lg-label">Divisi</div>
                <div style={{position:"relative"}}>
                  <select className="lg-sel" value={div} onChange={e=>{setDiv(e.target.value);setErr("");}}>
                    {Object.entries(DIVISI_CONFIG).filter(([k])=>k!=="admin").map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </div>
              </div>
              <div>
                <div className="lg-label">Nama</div>
                <div style={{position:"relative"}}>
                  <select className="lg-sel" value={selNama} onChange={e=>setSelNama(e.target.value)}>
                    <option value="">-- Pilih Nama --</option>
                    {namaList.map(p=><option key={p.id} value={p.nama}>{p.nama}</option>)}
                  </select>
                  <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#94a3b8",pointerEvents:"none"}}>▼</span>
                </div>
              </div>
              <div>
                <div className="lg-label">Password Divisi</div>
                <div style={{position:"relative"}}>
                  <span className="lg-icon">🔒</span>
                  <input className={"lg-inp"+(err?" err":"")} type={show?"text":"password"} value={pwd}
                    onChange={e=>{setPwd(e.target.value);setErr("");}}
                    onKeyDown={e=>e.key==="Enter"&&go()}
                    placeholder="Masukkan password divisi..." style={{paddingRight:44}}/>
                  <button className="lg-eye" onClick={()=>setShow(!show)}>{show?"🙈":"👁"}</button>
                </div>
              </div>
            </div>
          )}

          {err&&(
            <div className="lg-err" style={{marginTop:16}}>
              <span>⚠️</span><span>{err}</span>
            </div>
          )}

          <button className={"lg-btn"+(success?" success":"")} onClick={go} disabled={loading||success} style={{marginTop:20}}>
            {loading?<><span className="lg-spinner"/><span>Memuat...</span></>
             :success?<><span>✓</span><span>Berhasil!</span></>
             :<><span>Masuk</span><span style={{fontSize:16}}>→</span></>}
          </button>

          <div style={{marginTop:16,textAlign:"center",fontSize:12,color:"#94a3b8"}}>
            {mode==="admin"
              ?<>Operator? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("divisi")}>Gunakan tab Operator</span></>
              :<>Admin? <span style={{color:"#2563eb",fontWeight:600,cursor:"pointer"}} onClick={()=>setMode("admin")}>Gunakan tab Admin</span></>
            }
          </div>

          <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid #f1f5f9",textAlign:"center",fontSize:11,color:"#cbd5e1"}}>
            © 2026 Vista Teknik · Electrical Switchboard Manufacturing
          </div>
        </div>
      </div>
    </div>
  );
}

function Dashboard({woData}){
  const [activeTab,setActiveTab]=useState("wo");
  const [woSearch,setWoSearch]=useState("");
  const [woStatus,setWoStatus]=useState("semua");
  const [panelSearch,setPanelSearch]=useState("");
  const [panelWO,setPanelWO]=useState("semua");
  const [panelProgress,setPanelProgress]=useState("semua");
  const [alertType,setAlertType]=useState("semua");

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada Work Order</div>
      <div style={{fontSize:12,marginTop:4}}>Tambahkan WO di Manajemen WO terlebih dahulu</div>
    </div>
  );

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)));
  const avgOverall=woData.length?Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length):0;
  const totalPanel=woData.reduce((a,w)=>a+(w.panels||[]).length,0);

  const filteredWO=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=woStatus==="semua"||(woStatus==="ontrack"&&s==="ontrack")||(woStatus==="mendesak"&&s==="mendesak")||(woStatus==="terlambat"&&s==="terlambat")||(woStatus==="selesai"&&s==="selesai");
    const matchQ=!woSearch||(w.wo||"").toLowerCase().includes(woSearch.toLowerCase())||(w.proyek||"").toLowerCase().includes(woSearch.toLowerCase());
    return matchS&&matchQ;
  });

  const allPanels=woData.flatMap(w=>(w.panels||[]).map(p=>({...p,wo:w.wo,proyek:w.proyek,woId:w.id,target:w.target})));
  const filteredPanels=allPanels.filter(p=>{
    const pct=panelOverall?.(p)??0;
    const matchWO=panelWO==="semua"||(p.wo||"")===panelWO;
    const matchQ=!panelSearch||(p.nama||"").toLowerCase().includes(panelSearch.toLowerCase())||(p.proyek||"").toLowerCase().includes(panelSearch.toLowerCase());
    const matchP=panelProgress==="semua"||(panelProgress==="0-25"&&pct<=25)||(panelProgress==="26-50"&&pct>25&&pct<=50)||(panelProgress==="51-75"&&pct>50&&pct<=75)||(panelProgress==="76-100"&&pct>75);
    return matchWO&&matchQ&&matchP;
  });

  const filteredAlerts=alerts.filter(w=>{
    if(alertType==="semua") return true;
    if(alertType==="terlambat") return isDelayed(w.target);
    if(alertType==="mendesak") return isUrgent(w.target)&&!isDelayed(w.target);
    return true;
  });

  const thS={background:"#f8fafc",color:"#64748b",fontWeight:600,padding:"7px 11px",
    textAlign:"left" as const,fontSize:9.5,textTransform:"uppercase" as const,
    letterSpacing:.4,borderBottom:"1px solid #eaecf0",whiteSpace:"nowrap" as const};
  const tdS={padding:"8px 11px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11.5};

  const StatusBadge=({w}:{w:any})=>{
    const pct=woOverall(w);
    const s=pct===100?"Selesai":isDelayed(w.target)?"Terlambat":isUrgent(w.target)?"Mendesak":"On Track";
    const c=pct===100?"#16a34a":isDelayed(w.target)?"#dc2626":isUrgent(w.target)?"#d97706":"#16a34a";
    const bg=pct===100?"#f0fdf4":isDelayed(w.target)?"#fef2f2":isUrgent(w.target)?"#fffbeb":"#f0fdf4";
    return <span style={{background:bg,color:c,borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{s}</span>;
  };

  const PBar=({pct,w=60}:{pct:number,w?:number})=>{
    const c=pct===100?"#16a34a":pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626";
    return(
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:w,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden",flexShrink:0}}>
          <div style={{width:pct+"%",height:"100%",background:c,borderRadius:99}}/>
        </div>
        <span style={{fontSize:11,fontWeight:600,minWidth:28,color:c}}>{pct}%</span>
      </div>
    );
  };

  const inpS={height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 8px",
    fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",fontFamily:"inherit"};
  const selS={height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
    fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit"};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Alerts */}
      {alerts.map(w=>{
        const d=daysUntil(w.target);
        const late=isDelayed(w.target);
        return(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,
            background:late?"#fef2f2":"#fffbeb",border:"1px solid "+(late?"#fecaca":"#fde68a"),
            borderRadius:7,padding:"8px 13px",fontSize:11.5}}>
            <span style={{color:late?"#dc2626":"#d97706",fontSize:14,flexShrink:0}}>●</span>
            <span style={{fontWeight:600,color:late?"#dc2626":"#d97706"}}>WO {w.wo} — {w.proyek}</span>
            <span style={{color:late?"#7f1d1d":"#78350f",fontSize:11}}>
              {late?"Terlambat "+Math.abs(d)+" hari":"H-"+d+" Mendesak"} · Target: {w.target}
            </span>
            <span style={{marginLeft:"auto",background:late?"#fef2f2":"#fffbeb",
              color:late?"#dc2626":"#d97706",border:"1px solid "+(late?"#fecaca":"#fde68a"),
              borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600,flexShrink:0}}>
              {late?"Terlambat":"Mendesak"}
            </span>
          </div>
        );
      })}

      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:woData.length,l:"Total Work Order",c:"#2563eb",w:Math.min(woData.length*20,100)},
          {n:totalPanel,l:"Total Panel",c:"#10b981",w:60},
          {n:avgOverall+"%",l:"Avg Progress",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",w:avgOverall},
          {n:alerts.length,l:"Perlu Perhatian",c:"#dc2626",w:Math.min(alerts.length*25,100)},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:500,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
            <div style={{height:3,background:"#e2e8f0",borderRadius:99,marginTop:10,overflow:"hidden"}}>
              <div style={{width:s.w+"%",height:"100%",background:s.c,borderRadius:99}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,overflow:"hidden"}}>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #eaecf0",padding:"0 5px"}}>
          {[
            {id:"wo",label:"Work Order"},
            {id:"panel",label:"Panel List"},
            {id:"alert",label:"Peringatan"+(alerts.length>0?" ("+alerts.length+")":"")},
          ].map(t=>(
            <div key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{padding:"9px 14px",fontSize:12,fontWeight:activeTab===t.id?600:500,
                color:activeTab===t.id?"#2563eb":"#64748b",cursor:"pointer",
                borderBottom:activeTab===t.id?"2px solid #2563eb":"2px solid transparent",
                marginBottom:-1,transition:"all .13s"}}>
              {t.label}
            </div>
          ))}
        </div>

        {/* ── TAB: WORK ORDER ── */}
        {activeTab==="wo"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Work Order</span>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
              <input style={{...inpS,width:180,paddingLeft:26,backgroundImage:"url('%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22/%3E%3Cpath d=%22m21 21-4.35-4.35%22/%3E%3C/svg%3E')",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}
                placeholder="Cari WO atau proyek..." value={woSearch} onChange={e=>setWoSearch(e.target.value)}/>
              <select style={selS} value={woStatus} onChange={e=>setWoStatus(e.target.value)}>
                <option value="semua">Semua Status</option>
                <option value="ontrack">On Track</option>
                <option value="mendesak">Mendesak</option>
                <option value="terlambat">Terlambat</option>
                <option value="selesai">Selesai</option>
              </select>
            </div>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Target","Panel","Progress","Status"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredWO.length===0&&<tr><td colSpan={6} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada data</td></tr>}
                {filteredWO.map(wo=>{
                  const pct=woOverall(wo);
                  const d=daysUntil(wo.target);
                  const late=isDelayed(wo.target);
                  const urg=isUrgent(wo.target);
                  return(
                    <tr key={wo.id}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {wo.wo}</span></td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{wo.proyek}</td>
                      <td style={tdS}>
                        <span style={{color:"#64748b"}}>{wo.target}</span>
                        {pct<100&&<span style={{marginLeft:6,fontSize:10.5,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                          {late?"−"+Math.abs(d)+"hr":"H-"+d}
                        </span>}
                      </td>
                      <td style={{...tdS,color:"#64748b"}}>{(wo.panels||[]).length} panel</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={tdS}><StatusBadge w={wo}/></td>
                    </tr>
                  );
                })}
              </tbody>
              {filteredWO.length>0&&<tfoot>
                <tr style={{background:"#f8fafc"}}>
                  <td colSpan={4} style={{padding:"7px 11px",fontSize:10.5,color:"#94a3b8"}}>{filteredWO.length} work order · rata-rata</td>
                  <td style={{padding:"7px 11px"}}>
                    <PBar pct={filteredWO.length?Math.round(filteredWO.reduce((a,w)=>a+woOverall(w),0)/filteredWO.length):0}/>
                  </td>
                  <td/>
                </tr>
              </tfoot>}
            </table>
          </div>
        </>}

        {/* ── TAB: PANEL LIST ── */}
        {activeTab==="panel"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap" as const}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Panel</span>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" as const}}>
              <input style={{...inpS,width:160,paddingLeft:26,backgroundImage:"url('%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22%3E%3Ccircle cx=%2211%22 cy=%2211%22 r=%228%22/%3E%3Cpath d=%22m21 21-4.35-4.35%22/%3E%3C/svg%3E')",backgroundRepeat:"no-repeat",backgroundPosition:"7px center"}}
                placeholder="Cari panel..." value={panelSearch} onChange={e=>setPanelSearch(e.target.value)}/>
              <select style={selS} value={panelWO} onChange={e=>setPanelWO(e.target.value)}>
                <option value="semua">Semua WO</option>
                {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo}</option>)}
              </select>
              <select style={selS} value={panelProgress} onChange={e=>setPanelProgress(e.target.value)}>
                <option value="semua">Semua Progress</option>
                <option value="0-25">0 - 25%</option>
                <option value="26-50">26 - 50%</option>
                <option value="51-75">51 - 75%</option>
                <option value="76-100">76 - 100%</option>
              </select>
            </div>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Nama Panel","Progress","Status"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredPanels.length===0&&<tr><td colSpan={5} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada data</td></tr>}
                {filteredPanels.map((p,i)=>{
                  const pct=panelOverall?.(p)??0;
                  const late=isDelayed(p.target);
                  const urg=isUrgent(p.target);
                  const s=pct===100?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
                  const c=pct===100?"#16a34a":late?"#dc2626":urg?"#d97706":"#16a34a";
                  const bg=pct===100?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#f0fdf4";
                  return(
                    <tr key={i}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {p.wo}</span></td>
                      <td style={{...tdS,color:"#475569"}}>{p.proyek}</td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{p.nama}</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={tdS}><span style={{background:bg,color:c,borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>{s}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* ── TAB: PERINGATAN ── */}
        {activeTab==="alert"&&<>
          <div style={{padding:"9px 13px",borderBottom:"1px solid #f0f2f5",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <span style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Daftar Peringatan</span>
            <select style={selS} value={alertType} onChange={e=>setAlertType(e.target.value)}>
              <option value="semua">Semua Tipe</option>
              <option value="terlambat">Terlambat</option>
              <option value="mendesak">Mendesak</option>
            </select>
          </div>
          <div style={{overflowX:"auto" as const}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["No WO","Proyek","Target","Progress","Keterangan","Status"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredAlerts.length===0&&<tr><td colSpan={6} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada peringatan</td></tr>}
                {filteredAlerts.map(w=>{
                  const pct=woOverall(w);
                  const d=daysUntil(w.target);
                  const late=isDelayed(w.target);
                  return(
                    <tr key={w.id}>
                      <td style={tdS}><span style={{color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:11}}>WO {w.wo}</span></td>
                      <td style={{...tdS,fontWeight:500,color:"#1e293b"}}>{w.proyek}</td>
                      <td style={{...tdS,color:"#64748b"}}>{w.target}</td>
                      <td style={tdS}><PBar pct={pct}/></td>
                      <td style={{...tdS,fontSize:11,color:late?"#7f1d1d":"#78350f"}}>
                        {late?"Terlambat "+Math.abs(d)+" hari dari target":"H-"+d+" mendekati deadline"}
                      </td>
                      <td style={tdS}>
                        <span style={{background:late?"#fef2f2":"#fffbeb",color:late?"#dc2626":"#d97706",
                          borderRadius:4,padding:"2px 7px",fontSize:9.5,fontWeight:600}}>
                          {late?"Terlambat":"Mendesak"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}

function SummaryProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("semua");

  const PROSES_LIST=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  const filtered=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchQ=!search||(w.wo||"").toLowerCase().includes(search.toLowerCase())||(w.proyek||"").toLowerCase().includes(search.toLowerCase())||(w.panels||[]).some((p:any)=>(p.nama||"").toLowerCase().includes(search.toLowerCase()));
    return matchS&&matchQ;
  });

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,borderBottom:"1px solid #1e3a5f",whiteSpace:"nowrap" as const,
    borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11,
    borderRight:"1px solid #f5f7fa",textAlign:"center" as const};
  const tdSL={...tdS,textAlign:"left" as const};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>📊</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  const totalPanel=woData.reduce((a,w)=>a+(w.panels||[]).length,0);
  const avgOverall=woData.length?Math.round(woData.reduce((a,w)=>a+woOverall(w),0)/woData.length):0;
  const selesai=woData.filter(w=>woOverall(w)===100).length;
  const mendesak=woData.filter(w=>woOverall(w)<100&&isUrgent(w.target)&&!isDelayed(w.target)).length;
  const terlambat=woData.filter(w=>isDelayed(w.target)&&woOverall(w)<100).length;

  const ProsesPctCell=({pct,proses}:{pct:number|undefined,proses:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    return(
      <td style={tdS}>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:pct===100?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
        </div>
      </td>
    );
  };

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:mendesak,l:"Mendesak H-7",c:"#d97706",bc:"#d97706"},
          {n:terlambat,l:"Terlambat",c:"#dc2626",bc:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari WO / proyek / panel..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",
            fontFamily:"inherit",flex:1,minWidth:180}}/>
        <div style={{display:"flex",gap:5,flexWrap:"wrap" as const}}>
          {[
            {v:"semua",l:"Semua"},{v:"selesai",l:"✓ Selesai"},
            {v:"ontrack",l:"● On Track"},{v:"mendesak",l:"● Mendesak H-7"},{v:"terlambat",l:"● Terlambat"},
          ].map(f=>{
            const colors:any={semua:"#2563eb",selesai:"#16a34a",ontrack:"#2563eb",mendesak:"#d97706",terlambat:"#dc2626"};
            const bgs:any={semua:"#eff6ff",selesai:"#f0fdf4",ontrack:"#eff6ff",mendesak:"#fffbeb",terlambat:"#fef2f2"};
            const on=statusFilter===f.v;
            return(
              <button key={f.v} onClick={()=>setStatusFilter(f.v)}
                style={{border:"1px solid "+(on?colors[f.v]:"#e2e8f0"),
                  background:on?bgs[f.v]:"#fff",color:on?colors[f.v]:"#64748b",
                  borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:on?600:400,
                  cursor:"pointer",fontFamily:"inherit"}}>
                {f.l}
              </button>
            );
          })}
        </div>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.reduce((a,w)=>a+(w.panels||[]).length,0)} panel · {filtered.length} WO</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"#f1f5f9",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Table per WO */}
      {filtered.length===0&&(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      )}

      {filtered.map(wo=>{
        const pct=woOverall(wo);
        const d=daysUntil(wo.target);
        const late=isDelayed(wo.target);
        const urg=isUrgent(wo.target);
        const done=pct===100;
        const statusLabel=done?"Selesai":late?"Terlambat":urg?"Mendesak H-7":"On Track";
        const statusColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#2563eb";
        const statusBg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#eff6ff";
        const pbColor=done?"#16a34a":pct>=70?"#16a34a":pct>=40?"#d97706":"#dc2626";
        const borderColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#e2e8f0";
        const panels=wo.panels||[];

        // Gunakan calcPanelProgress untuk dapat data proses
        const panelProgressData=panels.map((p:any)=>calcPanelProgress(p));

        // Proses yang ada data (pct > 0 atau ada di salah satu panel)
        const prosesAda=PROSES_LIST.filter(pr=>
          panelProgressData.some((pd:any)=>pd[pr]!==undefined)
        );

        // Rata-rata per proses
        const rataProses=(pr:string)=>{
          const vals=panelProgressData.map((pd:any)=>pd[pr]).filter((v:any)=>v!==undefined) as number[];
          if(!vals.length) return undefined;
          return Math.round(vals.reduce((a:number,v:number)=>a+v,0)/vals.length);
        };

        return(
          <div key={wo.id} style={{background:"#fff",border:"1px solid #eaecf0",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* WO Header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid #eaecf0",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"#fafbfc"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {wo.wo}</span>
              <span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{wo.proyek}</span>
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {wo.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:100,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:800,color:pbColor}}>{pct}%</span>
                </div>
                <span style={{background:statusBg,color:statusColor,borderRadius:4,
                  padding:"2px 8px",fontSize:10,fontWeight:600}}>{statusLabel}</span>
              </div>
            </div>

            {/* Panel table */}
            {panels.length>0&&(
              <div style={{overflowX:"auto" as const}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{...thSL,minWidth:55}}>WO</th>
                      <th style={{...thSL,minWidth:80}}>Proyek</th>
                      <th style={{...thS,minWidth:35}}>H-</th>
                      <th style={{...thSL,minWidth:130}}>Nama Panel</th>
                      <th style={{...thS,minWidth:45}}>Tipe</th>
                      <th style={{...thS,minWidth:35}}>Qty</th>
                      <th style={{...thS,minWidth:60}}>Overall</th>
                      <th style={{...thS,minWidth:65}}>Status</th>
                      {prosesAda.map(pr=>(
                        <th key={pr} style={{...thS,minWidth:65,borderTop:"3px solid "+((PROSES_COLOR as any)[pr]||"#94a3b8")}}>
                          {pr}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {panels.map((p:any,pi:number)=>{
                      const pd=panelProgressData[pi];
                      const ppct=panelOverall(p);
                      const pc=ppct===100?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
                      const ps=ppct===100?"Selesai":ppct>=70?"On Track":ppct>=40?"On Track":"On Track";
                      const pbg=ppct===100?"#f0fdf4":"#eff6ff";
                      const psc=ppct===100?"#16a34a":"#2563eb";
                      return(
                        <tr key={pi}>
                          <td style={{...tdSL,color:"#2563eb",fontWeight:700,fontFamily:"ui-monospace,monospace",fontSize:10}}>{wo.wo}</td>
                          <td style={{...tdSL,color:"#475569",fontSize:10}}>{wo.proyek}</td>
                          <td style={{...tdS,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a",fontSize:10}}>
                            {late?"−"+Math.abs(d):d}
                          </td>
                          <td style={{...tdSL,fontWeight:500,color:"#1e293b"}}># {p.nama||p.name||"Panel "+(pi+1)}</td>
                          <td style={tdS}>
                            {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 7px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
                          </td>
                          <td style={tdS}>{p.qty||1}</td>
                          <td style={tdS}>
                            <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                              <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                              </div>
                              <span style={{fontSize:9,fontWeight:700,color:pc}}>{ppct}%</span>
                            </div>
                          </td>
                          <td style={tdS}>
                            <span style={{background:pbg,color:psc,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:600}}>{ps}</span>
                          </td>
                          {prosesAda.map(pr=><ProsesPctCell key={pr} pct={pd[pr]} proses={pr}/>)}
                        </tr>
                      );
                    })}
                    {/* Rata-rata row */}
                    <tr style={{background:"#f8fafc"}}>
                      <td colSpan={6} style={{...tdSL,color:"#94a3b8",fontSize:10,fontStyle:"italic" as const}}>Rata-rata ({panels.length} panel)</td>
                      <td style={tdS}>
                        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                          <div style={{width:44,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                            <div style={{width:pct+"%",height:"100%",background:pbColor,borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:9,fontWeight:700,color:pbColor}}>{pct}%</span>
                        </div>
                      </td>
                      <td style={tdS}/>
                      {prosesAda.map(pr=>{
                        const r=rataProses(pr);
                        const color=(PROSES_COLOR as any)[pr]||"#94a3b8";
                        return <ProsesPctCell key={pr} pct={r} proses={pr}/>;
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DetailProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [woFilter,setWoFilter]=useState("semua");
  const [statusFilter,setStatusFilter]=useState("semua");

  const PROSES_LIST=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  const allPanels=woData.flatMap(wo=>(wo.panels||[]).map((p:any)=>({
    ...p,
    wo:wo.wo,
    woId:wo.id,
    proyek:wo.proyek,
    target:wo.target,
    pd:calcPanelProgress(p),
  })));

  const filtered=allPanels.filter(p=>{
    const pct=panelOverall(p);
    const s=pct===100?"selesai":isDelayed(p.target)?"terlambat":isUrgent(p.target)?"mendesak":"ontrack";
    const matchS=statusFilter==="semua"||statusFilter===s;
    const matchWO=woFilter==="semua"||p.wo===woFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchQ;
  });

  const thS={background:"#1e3a5f",color:"#fff",fontWeight:600,padding:"7px 10px",
    textAlign:"center" as const,fontSize:9,textTransform:"uppercase" as const,
    letterSpacing:.3,borderBottom:"1px solid #1e3a5f",whiteSpace:"nowrap" as const,
    borderRight:"1px solid rgba(255,255,255,.1)"};
  const thSL={...thS,textAlign:"left" as const};
  const tdS={padding:"6px 10px",borderBottom:"1px solid #f5f7fa",
    color:"#374151",verticalAlign:"middle" as const,fontSize:11,
    borderRight:"1px solid #f5f7fa",textAlign:"center" as const};
  const tdSL={...tdS,textAlign:"left" as const};

  if(!woData.length) return(
    <div style={{textAlign:"center",padding:"60px 20px",color:"#94a3b8"}}>
      <div style={{fontSize:40,marginBottom:12}}>🔍</div>
      <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Belum ada data</div>
    </div>
  );

  const totalPanel=allPanels.length;
  const avgOverall=totalPanel?Math.round(allPanels.reduce((a,p)=>a+panelOverall(p),0)/totalPanel):0;
  const selesai=allPanels.filter(p=>panelOverall(p)===100).length;
  const terlambat=allPanels.filter(p=>isDelayed(p.target)&&panelOverall(p)<100).length;

  const ProsesPctCell=({pct,proses}:{pct:number|undefined,proses:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    return(
      <td style={tdS}>
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
          <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
        </div>
      </td>
    );
  };

  const prosesAda=PROSES_LIST.filter(pr=>allPanels.some(p=>p.pd[pr]!==undefined&&p.pd[pr]>=0));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>

      {/* Stat row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Panel Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:terlambat,l:"Panel Terlambat",c:"#dc2626",bc:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",border:"1px solid #eaecf0",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari panel, proyek, WO..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#1e293b",
            fontFamily:"inherit",flex:1,minWidth:160}}/>
        <select value={woFilter} onChange={e=>setWoFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua WO</option>
          {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"#f8fafc",outline:"none",color:"#475569",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua Status</option>
          <option value="ontrack">On Track</option>
          <option value="mendesak">Mendesak</option>
          <option value="terlambat">Terlambat</option>
          <option value="selesai">Selesai</option>
        </select>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} panel</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"#f1f5f9",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Panel cards dengan komponen */}
      {filtered.length===0?(
        <div style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          Tidak ada data yang sesuai filter
        </div>
      ):filtered.map((p:any,pi:number)=>{
        const ppct=panelOverall(p);
        const d=daysUntil(p.target);
        const late=isDelayed(p.target);
        const urg=isUrgent(p.target);
        const done=ppct===100;
        const pc=done?"#16a34a":ppct>=70?"#16a34a":ppct>=40?"#d97706":"#dc2626";
        const statusLabel=done?"Selesai":late?"Terlambat":urg?"Mendesak":"On Track";
        const statusColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#2563eb";
        const statusBg=done?"#f0fdf4":late?"#fef2f2":urg?"#fffbeb":"#eff6ff";
        const borderColor=done?"#16a34a":late?"#dc2626":urg?"#d97706":"#e2e8f0";
        const cfg=(PANEL_TYPES as any)[p.tipe];
        const wps=cfg?.wps||[];
        const prosesPanel=PROSES_LIST.filter(pr=>p.pd[pr]!==undefined&&p.pd[pr]>=0);

        return(
          <div key={pi} style={{background:"#fff",border:"1px solid #eaecf0",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* Panel header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid #eaecf0",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"#fafbfc"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {p.wo}</span>
              <span style={{fontWeight:700,color:"#1e293b",fontSize:13}}>{p.proyek}</span>
              <span style={{color:"#94a3b8",fontSize:11}}>|</span>
              <span style={{fontWeight:600,color:"#1e293b",fontSize:12}}>{p.nama||"Panel "+(pi+1)}</span>
              {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {p.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:100,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                    <div style={{width:ppct+"%",height:"100%",background:pc,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:13,fontWeight:800,color:pc}}>{ppct}%</span>
                </div>
                <span style={{background:statusBg,color:statusColor,borderRadius:4,padding:"2px 8px",fontSize:10,fontWeight:600}}>{statusLabel}</span>
              </div>
            </div>

            {/* Komponen table */}
            <div style={{overflowX:"auto" as const}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    <th style={{...thS,minWidth:50}}>WP</th>
                    <th style={{...thSL,minWidth:180}}>Komponen</th>
                    <th style={{...thS,minWidth:60}}>Kode</th>
                    <th style={{...thS,minWidth:50}}>QTY 🔒</th>
                    {prosesPanel.map(pr=>(
                      <th key={pr} style={{...thS,minWidth:70,borderTop:"3px solid "+((PROSES_COLOR as any)[pr]||"#94a3b8")}}>
                        {pr}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wps.map((wp:any)=>{
                    const wpColor=(WP_COLOR as any)[wp.wp]||"#94a3b8";
                    const activeItems=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                    if(!activeItems.length) return null;
                    return activeItems.map((it:any,ii:number)=>{
                      const cl=p.checklist?.[it.kode];
                      const qty=cl?.qty||it.qty||1;
                      const rowBg=wp.wp==="WP1"?"#fffbeb":wp.wp==="WP2"?"#f0fdf4":wp.wp==="WP3"?"#eff6ff":wp.wp==="WP4"?"#fff7ed":"#fafbfc";
                      return(
                        <tr key={it.kode}>
                          {ii===0&&(
                            <td style={{...tdS,background:rowBg,fontWeight:700,fontSize:10}} rowSpan={activeItems.length}>
                              <span style={{background:wpColor,color:"#fff",borderRadius:4,padding:"2px 7px",fontSize:9,fontWeight:700}}>
                                {wp.wp}
                              </span>
                            </td>
                          )}
                          <td style={{...tdSL,background:rowBg,color:"#1e293b",fontWeight:500}}>{it.nama||it.komponen||it.name}</td>
                          <td style={{...tdS,background:rowBg,color:"#94a3b8",fontFamily:"ui-monospace,monospace",fontSize:9}}>{it.kode}</td>
                          <td style={{...tdS,background:rowBg,color:"#475569",fontWeight:600}}>{qty}</td>
                          {prosesPanel.map(pr=>{
                            const pct=cl?.progress?.[pr]??cl?.qtyProses?.[pr]??0;
                            const color=(PROSES_COLOR as any)[pr]||"#94a3b8";
                            const isDone=pct===100;
                            return(
                              <td key={pr} style={{...tdS,background:rowBg}}>
                                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2}}>
                                  <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    await supabase.from('activity_log').insert({action:'Tambah Panel '+p.nama+' ke Raw Schedule',admin_nama:user?.name||user?.nama||'Admin',user_name:user?.name||user?.nama||'Admin',module:'raw',action_type:'create',description:'Tambah Panel '+p.nama+' ke Raw Schedule',aktivitas:'Tambah Panel '+p.nama+' ke Raw Schedule',jenis:'raw',wo_number:wo.wo,proyek:wo.proyek||'',panel:p.nama||'',halaman:'Raw Schedule'});
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
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
    if(logAct) await logAct({admin_nama:user?.name||user?.nama||"Admin",module:"rencana",action_type:"distribute",description:"Distribusi "+task.proses+" - "+task.panel+" ("+task.tanggal+")",proyek:task.proyek||"",panel:task.panel||"",halaman:"Rencana Harian"});
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
      if(result?.success&&result.data){setRenhar(prev=>[...prev,result.data]);}
    }
  };

  const thS={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:9.5,whiteSpace:"nowrap",letterSpacing:.4,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setWeekStart(addDays(weekStart,-7))} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>‹ Minggu Lalu</button>
          <button onClick={()=>setWeekStart(TODAY)} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #3b5bdb",background:weekStart===TODAY?"#eff3ff":"#fff",color:"#3b5bdb",cursor:"pointer",fontSize:11,fontWeight:500,fontFamily:"inherit"}}>Hari Ini</button>
          <button onClick={()=>setWeekStart(addDays(weekStart,7))} style={{height:28,padding:"0 12px",borderRadius:5,border:"0.5px solid #d1d5db",background:"#fff",color:"#374151",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Minggu Depan ›</button>
        </div>
        <button onClick={()=>setAddModal(true)} style={{height:28,padding:"0 14px",borderRadius:5,border:"none",background:"#3b5bdb",color:"#fff",fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>+ Tambah Panel</button>
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
                      <button onClick={async()=>{await removeRaw(row.id);setRawData(prev=>prev.filter(r=>r.id!==row.id));}} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:14}}>🗑</button>
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
        setWoData(prev=>prev.map(w=>w.id==editId?{...w,...form,panels:np}:w));
      }
    } else {
      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        setWoData(prev=>[...prev,{...result.data,panels:np}]);
      }
    }
    setOpen(false);
  };
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
                                    <input type="number" min="0" value={cl.qty}
                                      onChange={e=>updateItemQty(wo.id,p.id,item.kode,e.target.value)}
                                      onClick={e=>e.stopPropagation()}
                                      style={{width:56,padding:"4px 6px",borderRadius:6,
                                        border:`1.5px solid ${isLocked?"#fecaca":"#e2e8f0"}`,
                                        background:isLocked?"#fef2f2":"#fff",fontSize:12,textAlign:"center",
                                        fontWeight:700,fontFamily:"'DM Mono',monospace",color:isLocked?"#fca5a5":"#1e293b"}}/>
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
              <Btn color="#dc2626" onClick={()=>{setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn><Btn color="#dc2626" onClick={async()=>{await supabase.from('work_orders').delete().eq('id',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>
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
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
const [woData, setWoData] = useState<any[]>([]);
const [rawData, setRawData] = useState<any[]>([]);
const [renhar, setRenhar] = useState<any[]>([]);
const [pekerja, setPekerja] = useState<any[]>([]);
  const { data: kendalaLog, create: createKendala, remove: removeKendala } = useKendala()
  const { data: activityLog, log: logActivity } = useActivityLog()
  const { log: logAct } = useLog()
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


  
  const SIDEBAR_MENUS=[
    {group:"MONITORING",items:[
      {id:"dashboard",label:"Dashboard",icon:"📊"},
      {id:"summary",label:"Summary Progress",icon:"📋"},
      {id:"detail",label:"Detail Progress",icon:"🔍"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"📅"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"📋"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"📝"}]:[]),
    ]},
    {group:"SYSTEM",items:[
      ...(["admin"].includes(user?.divisi)?[
        {id:"pekerja",label:"Master Pekerja",icon:"👥"},
        {id:"tracking",label:"Tracking Pekerja",icon:"📈"},
        {id:"activity",label:"Activity Log",icon:"📊"},
        {id:"kendala",label:"Kendala",icon:"📝",badge:kendalaLog.length>0?kendalaLog.length:null},
        {id:"maintenance",label:"Maintenance",icon:"🔧"},
        {id:"masteruser",label:"System",icon:"⚙️"},
      ]:[]),
    ]},
  ];

  const alerts=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target))).length;
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
                      <span style={{fontSize:14,flexShrink:0,width:18,textAlign:"center" as const}}>{item.icon}</span>
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
              {!sidebarCollapsed&&<button onClick={()=>{setUser(null);setPage("landing");localStorage.removeItem("vista_admin_session");}} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:16,flexShrink:0,padding:2}} title="Keluar">✕</button>}
            </div>
          </div>
          <div className="erp-main">
            <div className="erp-topbar">
              <button className="erp-toggle" onClick={()=>setSidebarCollapsed((p:boolean)=>!p)}>
                {sidebarCollapsed?"▶":"◀"}
              </button>
              <input className="erp-search" placeholder="Cari work order, panel..."/>
              <div className="erp-topbar-right">
                <div className="erp-bell">
                  🔔
                  {alerts>0&&<div className="erp-bell-dot"/>}
                </div>
                {alerts>0&&<span style={{background:"#fffbeb",color:"#d97706",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{alerts} mendesak</span>}
                <span style={{background:"#f1f5f9",color:"#475569",borderRadius:5,padding:"2px 9px",fontSize:10,fontWeight:600}}>{cfg?.label||"Admin"}</span>
                <div className="erp-foot-av">{(user?.name||user?.nama||"A").slice(0,2).toUpperCase()}</div>
              </div>
            </div>
            <div className="erp-body">
              {tab==="dashboard"&&<Dashboard woData={woData}/>}
              {tab==="summary"&&<SummaryProgress woData={woData}/>}
              {tab==="detail"&&<DetailProgress woData={woData}/>}
              {tab==="raw"&&<RawSchedule woData={woData} rawData={rawData} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} user={user}/>}
              {tab==="rencana"&&<RencanaHarian rawData={rawData} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} logAct={logAct} user={user}/>}
              {tab==="wo"&&<ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} user={user}/>}
              {tab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} user={user}/>}
              {tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar}/>}
              {tab==="maintenance"&&<MaintenanceTab user={user} logActivity={logActivity}/>}
              {tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala}/>}
              {tab==="activity"&&<ActivityLogView activityLog={activityLog} user={user}/>}
              {tab==="masteruser"&&<SystemTab user={user} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}