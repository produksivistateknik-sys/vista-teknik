import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
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
import { generateFCSSchedule, syncFCSToRawSchedule, checkKapasitasDanKomponenSwapV2, executeSwapKomponenV2, checkKuotaOrangDanKomponenSwap, executeSwapKomponenOrang } from './services/fcsService'


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
      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
  WM_POLY: {
    label:"WM Poly", color:"#ec4899",
    wps:[
      { wp:"WP1", range:"WM.1-2", color:"#f59e0b", bg:"#fffbeb", items:[{kode:"WM.1",nama:"Tulangan Groundplate"},{kode:"WM.2",nama:"Groundplate"}]},
      { wp:"WP2", range:"WM.3-4", color:"#22c55e", bg:"#f0fdf4", items:[{kode:"WM.3",nama:"Box (include ambang)"},{kode:"WM.4",nama:"Pintu"}]},
      { wp:"WP3", range:"WM.5-6,9-10", color:"#06b6d4", bg:"#ecfeff", items:[{kode:"WM.5",nama:"Tulangan Cover"},{kode:"WM.6",nama:"Cover Komponen"},{kode:"WM.9",nama:"Tulangan Pintu Dalam"},{kode:"WM.10",nama:"Pintu Dalam"}]},
      { wp:"WP4", range:"WM.7-8", color:"#f97316", bg:"#fff7ed", items:[{kode:"WM.7",nama:"Tutup Atas Bawah"},{kode:"WM.8",nama:"Topi"}]},
    ]
  },
};

const ALL_PROSES = ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
const WP_LIST    = ["WP1","WP2","WP3","WP4"];
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

// ─────────────────────────────────────────────────────────────────────────────
// MAPPING: KODE KOMPONEN → PROSES YANG RELEVAN
// ─────────────────────────────────────────────────────────────────────────────
const KOMPONEN_PROSES_MAP: Record<string, string[]> = {
  // FS & F3B - WP1
  "FS.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.2":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.3":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.4":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "FS.5":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.6":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.7":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "FS.8":  ["POTONG","STEL","PAINTING","RAKIT"],
  "FS.9":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.10": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER"],
  // FS & F3B - WP2
  "FS.11": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.12": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.13": ["POTONG","PAINTING","RAKIT"],
  "FS.14": ["POTONG","PAINTING","RAKIT"],
  "FS.15": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS & F3B - WP3
  "FS.16": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.17": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.18": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.19": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.20": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // FS & F3B - WP4
  "FS.22": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","PAINTING","RAKIT"],
  "FS.24": ["POTONG","BENDING","PAINTING","RAKIT"],
  // F3B tambahan - WP1
  "F3B.1":  ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.2":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.3":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "F3B.4":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.5":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.6":  ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.7":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.8":  ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.9":  ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "F3B.10": ["POTONG","STEL","PAINTING","RAKIT"],
  "F3B.11": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.12": ["POTONG","BENDING","PAINTING","RAKIT","WIRING POWER"],
  // F3B - WP2
  "F3B.13": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.14": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.15": ["POTONG","PAINTING","RAKIT"],
  "F3B.16": ["POTONG","PAINTING","RAKIT"],
  "F3B.17": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // F3B - WP3
  "F3B.18": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.19": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.20": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.21": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.22": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "F3B.23": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  // F3B - WP4
  "F3B.24": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.25": ["POTONG","BENDING","PAINTING","RAKIT"],
  "F3B.26": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM_MS & WM_POLY - WP1
  "WM.1": ["POTONG","BENDING","PAINTING","RAKIT","BUSBAR"],
  "WM.2": ["POTONG","BENDING","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  // WM_MS - WP2
  "WM.3": ["POTONG","BENDING","STEL","PAINTING","RAKIT"],
  "WM.4": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  // WM - WP3
  "WM.5": ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM - WP4
  "WM.7": ["POTONG","PAINTING","RAKIT"],
  "WM.8": ["POTONG","BENDING","PAINTING","RAKIT"],
  // WM_POLY - WP5 & WP6 (sama seperti WP4)
  "WM.9":  ["POTONG","BENDING","PAINTING","RAKIT"],
  "WM.10": ["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
};

// Helper: cek apakah komponen relevan dengan proses tertentu
// ─────────────────────────────────────────────────────────────────────────────
// BUSBAR KOMPONEN per tipe panel
// ─────────────────────────────────────────────────────────────────────────────
const BUSBAR_KOMPONEN:Record<string,string[]> = {
  FS:      ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  F3B:     ["H-BUS","INCOMING","OUTGOING","NETRAL","GROUND","COUPLER"],
  WM_MS:   ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
  WM_POLY: ["LINE","INCOMING","OUTGOING","NETRAL","GROUND"],
};

const getBusbarKomponen=(tipe:string):string[]=>{
  return BUSBAR_KOMPONEN[tipe]||BUSBAR_KOMPONEN["FS"];
};

const BUSBAR_COLORS:Record<string,string>={
  "H-BUS":"#f59e0b","LINE":"#f59e0b",
  "INCOMING":"#ef4444","OUTGOING":"#3b82f6",
  "NETRAL":"#8b5cf6","GROUND":"#16a34a",
  "COUPLER":"#f97316",
};

const isKomponenRelevant=(kode:string, proses:string):boolean=>{
  const relevanProses=KOMPONEN_PROSES_MAP[kode];
  if(!relevanProses) return true; // kalau tidak ada mapping, tampilkan semua
  return relevanProses.includes(proses);
};


export const DIVISI_CONFIG = {
  admin:      {label:"Admin",         icon:"⚙️", color:"#dc2626",bg:"#fef2f2",   proses:null},
  mekanik:    {label:"Mekanik",       icon:"🔧", color:"#d97706",bg:"#fffbeb", proses:["POTONG","BENDING","STEL"]},
  painting:   {label:"Painting",      icon:"🎨", color:"#7c3aed",bg:"#f5f3ff",proses:["PAINTING"]},
  assembling: {label:"Assembling",    icon:"⚙️", color:"#059669",bg:"#ecfdf5",proses:["RAKIT","PASANG KOMPONEN","BUSBAR"]},
  wiring_ctrl:{label:"Wiring Control",icon:"⚡", color:"#6366f1",bg:"#eef2ff",  proses:["WIRING CONTROL"]},
  wiring_pwr: {label:"Wiring Power",  icon:"🔌", color:"#be185d",bg:"#fdf2f8", proses:["WIRING POWER"]},
  qc:         {label:"QC",            icon:"🔍", color:"#16a34a",bg:"#f0fdf4",      proses:["QC TEST","PACKING"]},
  nameplate:  {label:"Nameplate",     icon:"🏷️", color:"#0891b2",bg:"#ecfeff",     proses:null},
};
export const OPERATOR_ROLES = ["mekanik","painting","assembling","wiring_ctrl","wiring_pwr","qc","nameplate"];

// USERS array removed - using Supabase operator_users table

// ─────────────────────────────────────────────────────────────────────────────
// PEKERJA SEED
// ─────────────────────────────────────────────────────────────────────────────
// PEKERJA_SEED removed

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

// Ambil progress dari history (sumber paling akurat dari Vista Pekerja)
function getProgressFromHistory(cl:any, proses:string):number{
  const hist=cl?.history?.[proses];
  if(hist&&hist.length>0){
    // ambil entry terbaru berdasarkan tanggal + ts
    const sorted=[...hist].sort((a:any,b:any)=>{
      const tA=a.ts||a.tanggal||"";
      const tB=b.ts||b.tanggal||"";
      return tB.localeCompare(tA);
    });
    return sorted[0].pct||0;
  }
  return -1; // -1 berarti tidak ada data history
}

// Ambil progress terbaik: history > progressByDate > progress
function getBestProgress(cl:any, proses:string):number{
  // Coba dari history dulu (paling akurat)
  const fromHist=getProgressFromHistory(cl,proses);
  if(fromHist>=0) return fromHist;
  // Fallback ke progressByDate
  const fromDate=getLatestProgress(cl,proses);
  if(fromDate>0) return fromDate;
  // Fallback terakhir ke progress
  return cl?.progress?.[proses]||0;
}

function calcPanelProgress(panel): Record<string, number> {
  const cfg=PANEL_TYPES[panel.tipe];
  if(!cfg||!panel.checklist) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const active=cfg.wps.flatMap(w=>w.items).filter(it=>(panel.checklist[it.kode]?.qty||0)>0);
  if(!active.length) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const prog: Record<string, number> = {};
  ALL_PROSES.forEach(pr=>{
    const vals=active.map(it=>getBestProgress(panel.checklist[it.kode],pr));
    // Tambahkan busbar_progress ke kalkulasi BUSBAR
    if(pr==="BUSBAR"&&panel.busbar_progress){
      const busbarVals=Object.values(panel.busbar_progress) as number[];
      if(busbarVals.length>0){
        const allVals=[...vals,...busbarVals];
        prog[pr]=Math.round(allVals.reduce((a:number,b:number)=>a+b,0)/allVals.length);
        return;
      }
    }
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

const TODAY=new Date().toISOString().slice(0,10);
const PROSES_ORANG_RAW_GLOBAL=["WIRING POWER","WIRING CONTROL"];
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
*{box-sizing:border-box;margin:0;padding:0}html,body,#root{width:100%;height:100%;overflow-x:hidden}

/* ── DARK MODE ── */
:root{
  --bg-primary:#fff;
  --bg-secondary:#f8fafc;
  --bg-tertiary:#f1f5f9;
  --text-primary:#0f172a;
  --text-secondary:#475569;
  --text-muted:#94a3b8;
  --border-color:#e2e8f0;
  --border-light:#f1f5f9;
  --card-bg:#fff;
  --input-bg:#f8fafc;
  --shadow:0 1px 4px #00000008;
}
[data-theme="dark"]{
  --bg-primary:#0f1117;
  --bg-secondary:#1a1d27;
  --bg-tertiary:#222536;
  --text-primary:#e2e8f0;
  --text-secondary:#94a3b8;
  --text-muted:#64748b;
  --border-color:#2d3148;
  --border-light:#1e2330;
  --card-bg:#1a1d27;
  --input-bg:#222536;
  --shadow:0 1px 4px #00000030;
}
[data-theme="dark"] body{background:var(--bg-primary);color:var(--text-primary)}
[data-theme="dark"] .erp-wrap{background:var(--bg-primary)}
[data-theme="dark"] .erp-body{background:var(--bg-primary)}
[data-theme="dark"] .erp-topbar{background:var(--bg-secondary);border-bottom:1px solid var(--border-color)}
[data-theme="dark"] .erp-main{background:var(--bg-primary)}
[data-theme="dark"] .erp-search{background:var(--bg-tertiary);border-color:var(--border-color);color:var(--text-primary)}
[data-theme="dark"] .erp-bell{background:var(--bg-tertiary);border-color:var(--border-color)}
[data-theme="dark"] .fi{background:var(--bg-primary)}

/* Cards & panels */
[data-theme="dark"] .Card,[data-theme="dark"] [class*="card"]{background:var(--card-bg)!important;border-color:var(--border-color)!important}
[data-theme="dark"] table thead tr{background:var(--bg-tertiary)!important}
[data-theme="dark"] table tbody tr:nth-child(even) td{background:var(--bg-secondary)!important}
[data-theme="dark"] table tbody tr:nth-child(odd) td{background:var(--card-bg)!important}
[data-theme="dark"] table th{background:#1e2330!important;color:#c8d0e8!important;border-color:var(--border-color)!important}
[data-theme="dark"] table td{border-color:var(--border-light)!important;color:var(--text-primary)!important}
[data-theme="dark"] input,[data-theme="dark"] select,[data-theme="dark"] textarea{
  background:var(--input-bg)!important;border-color:var(--border-color)!important;
  color:var(--text-primary)!important}
[data-theme="dark"] button:not([class*="Btn"]):not([style*="background:#"]):not([style*="background:linear"]){
  background:var(--bg-tertiary);color:var(--text-primary);border-color:var(--border-color)}

/* Modal */
[data-theme="dark"] .modal-overlay,[data-theme="dark"] [class*="modal"]{background:var(--card-bg)!important}

/* Landing & Login */
[data-theme="dark"] .landing-wrap{background:#0f1117!important}
[data-theme="dark"] .lg-card{background:var(--card-bg)!important;box-shadow:0 4px 24px #00000040!important}
[data-theme="dark"] .lg-inp{background:var(--input-bg)!important;border-color:var(--border-color)!important;color:var(--text-primary)!important}

/* Nav group text */
[data-theme="dark"] .erp-nav-grp{color:#4a5270!important}
[data-theme="dark"] .erp-topbar-right span{background:var(--bg-tertiary)!important;color:var(--text-secondary)!important}
[data-theme="dark"] .erp-card{background:#1a1d27!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* ── DARK MODE FORCE OVERRIDE ── */
[data-theme="dark"] .erp-topbar{background:#16181f!important;border-color:#2d3148!important}
[data-theme="dark"] .erp-search{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}

/* Force semua div putih ke dark */
[data-theme="dark"] .erp-main div:not([class*="badge"]):not([class*="status"]):not([class*="tag"]) {
  --local-bg: var(--card-bg);
}

/* Target spesifik elemen berdasarkan posisi */
[data-theme="dark"] .fi > div,
[data-theme="dark"] .fi > div > div:not([style*="background:#"]):not([style*="background:linear"]):not([style*="background:rgb"]) {
  background-color: var(--card-bg, #1a1d27) !important;
  color: var(--text-primary, #e2e8f0) !important;
  border-color: var(--border-color, #2d3148) !important;
}

/* Modal */
[data-theme="dark"] div[style*="position:fixed"][style*="inset:0"] > div {
  background:#1a1d27!important;
  border-color:#2d3148!important;
}

/* Override inline background:#fff */
[data-theme="dark"] div[style*="background:#fff"],
[data-theme="dark"] div[style*="background: #fff"],
[data-theme="dark"] div[style*="background:white"] {
  background:#1a1d27!important;
}
[data-theme="dark"] div[style*="background:#f8fafc"] {
  background:#1e2130!important;
}
[data-theme="dark"] div[style*="background:#f1f5f9"] {
  background:#222536!important;
}
[data-theme="dark"] div[style*="background:#f9fafb"],
[data-theme="dark"] div[style*="background:#fafafa"] {
  background:#1e2130!important;
}

/* Force text colors */
[data-theme="dark"] div[style*="color:#1e293b"],
[data-theme="dark"] span[style*="color:#1e293b"],
[data-theme="dark"] td[style*="color:#1e293b"],
[data-theme="dark"] p[style*="color:#1e293b"] {
  color:#e2e8f0!important;
}
[data-theme="dark"] div[style*="color:#475569"],
[data-theme="dark"] span[style*="color:#475569"],
[data-theme="dark"] td[style*="color:#475569"] {
  color:#94a3b8!important;
}
[data-theme="dark"] div[style*="color:#64748b"],
[data-theme="dark"] span[style*="color:#64748b"],
[data-theme="dark"] td[style*="color:#64748b"] {
  color:#64748b!important;
}

/* Table */
[data-theme="dark"] table {
  background:#1a1d27!important;
}
[data-theme="dark"] td {
  background:#1a1d27!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}
[data-theme="dark"] tr:nth-child(even) td {
  background:#1e2130!important;
}
[data-theme="dark"] th {
  background:#0f1117!important;
  color:#94a3b8!important;
  border-color:#2d3148!important;
}

/* Input & Select */
[data-theme="dark"] input[style],
[data-theme="dark"] select[style],
[data-theme="dark"] textarea[style] {
  background:#222536!important;
  border-color:#2d3148!important;
  color:#e2e8f0!important;
}
[data-theme="dark"] *{color:inherit}
[data-theme="dark"] .erp-main{background:#0f1117!important}

/* ── DARK MODE COMPREHENSIVE ── */
[data-theme="dark"] body{background:#0f1117!important;color:#e2e8f0!important}
[data-theme="dark"] *[style*="background:#fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background: #fff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#ffffff"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="background:#f8fafc"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f1f5f9"]{background:#222536!important}
[data-theme="dark"] *[style*="background:#f9fafb"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#fafafa"]{background:#1e2130!important}
[data-theme="dark"] *[style*="background:#f0f2f5"]{background:#16181f!important}
[data-theme="dark"] *[style*="background:white"]{background:#1a1d27!important}
[data-theme="dark"] *[style*="color:#1e293b"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#0f172a"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#334155"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#374151"]{color:#cbd5e1!important}
[data-theme="dark"] *[style*="color:#111827"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="color:#1a1d23"]{color:#e2e8f0!important}
[data-theme="dark"] *[style*="border:1px solid #e2e8f0"]{border-color:#2d3148!important}
[data-theme="dark"] *[style*="border-bottom:1px solid #e2e8f0"]{border-bottom-color:#2d3148!important}
[data-theme="dark"] *[style*="border-top:1px solid #e2e8f0"]{border-top-color:#2d3148!important}
[data-theme="dark"] *[style*="border:1px solid #f1f5f9"]{border-color:#1e2130!important}
[data-theme="dark"] *[style*="borderBottom:1px solid #f1f5f9"]{border-bottom-color:#1e2130!important}
[data-theme="dark"] input:not([type="range"]){background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] select{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] textarea{background:#222536!important;border-color:#2d3148!important;color:#e2e8f0!important}
[data-theme="dark"] *[style*="boxShadow"]{box-shadow:0 4px 24px rgba(0,0,0,0.4)!important}
[data-theme="dark"] ::-webkit-scrollbar-track{background:#1a1d27}
[data-theme="dark"] ::-webkit-scrollbar-thumb{background:#3d4468}

body{background:#f0f2f5;color:#1a1d23;font-family:Inter,sans-serif;font-size:12px;font-weight:400;text-align:left;overflow-x:hidden}
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
.erp-wrap{display:flex;height:100vh;overflow:hidden;background:#f0f2f5;position:fixed;top:0;left:0;right:0;bottom:0}
.erp-sb{width:220px;min-width:220px;height:100vh;background:#1e3a8a;display:flex;flex-direction:column;transition:width .2s ease,min-width .2s ease;overflow:hidden;flex-shrink:0}
.erp-sb.col{width:52px;min-width:52px}
.erp-sb-head{height:56px;display:flex;align-items:center;padding:0 16px;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278;border-bottom:1px solid #2d4ba0}
.erp-sb.col .erp-sb-head{padding:0;justify-content:center}
.erp-logo{width:30px;height:30px;min-width:30px;background:#1d4ed8;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0}
.erp-brand{overflow:hidden;white-space:nowrap;opacity:1;transition:opacity .15s;min-width:0}
.erp-sb.col .erp-brand{opacity:0;pointer-events:none;width:0}
.erp-brand-name{font-weight:800;font-size:14px;color:#fff;line-height:1.2;letter-spacing:1px;text-transform:uppercase}
.erp-brand-sub{font-size:9px;color:#93c5fd;display:none;margin-top:2px;line-height:1.3;letter-spacing:.3px;text-transform:uppercase}
.erp-nav{flex:1;overflow-y:auto;overflow-x:hidden;padding:8px 0}
.erp-nav::-webkit-scrollbar{width:2px}
.erp-nav::-webkit-scrollbar-thumb{background:#2d4ba0;border-radius:2px}
.erp-nav-grp{font-size:9px;font-weight:600;color:#93c5fd;text-transform:uppercase;letter-spacing:.9px;padding:12px 14px 4px;white-space:nowrap;overflow:hidden;opacity:1;transition:opacity .12s}
.erp-sb.col .erp-nav-grp{opacity:0;height:0;padding:0;min-height:0;overflow:hidden}
.erp-nav-item{display:flex;align-items:center;gap:9px;padding:7px 10px;margin:1px 6px;border-radius:6px;cursor:pointer;color:#bfdbfe;font-size:12px;font-weight:400;white-space:nowrap;overflow:hidden;transition:all .12s;border:none;background:transparent;width:calc(100% - 12px);text-align:left;font-family:inherit;line-height:1.4}
.erp-nav-item:hover{background:#2d4ba0;color:#fff}
.erp-nav-item.active{background:#1d4ed8;color:#fff;font-weight:500}
.erp-sb.col .erp-nav-item{padding:0;margin:0;height:38px;border-radius:0;justify-content:center;align-items:center;width:52px;gap:0;display:flex}
.erp-nav-item i{font-size:15px;flex-shrink:0;width:20px;text-align:center;color:inherit}
.erp-nav-label{overflow:hidden;flex:1;opacity:1;transition:opacity .12s;font-size:12px}
.erp-sb.col .erp-nav-label{opacity:0;width:0}
.erp-nav-badge{background:#e53e3e22;color:#fc8181;border-radius:4px;padding:1px 6px;font-size:9.5px;font-weight:600;flex-shrink:0;transition:opacity .12s;line-height:1.5}
.erp-sb.col .erp-nav-badge{opacity:0}
.erp-sb-foot{padding:10px 12px;border-top:1px solid #2d4ba0;display:flex;align-items:center;gap:10px;overflow:hidden;flex-shrink:0;background:#1a3278}
.erp-sb.col .erp-sb-foot{justify-content:center;padding:10px 0;gap:0}
.erp-foot-av{width:28px;height:28px;min-width:28px;border-radius:6px;background:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:600;color:#fff;flex-shrink:0;border:1px solid #3b82f6}
.erp-foot-info{flex:1;min-width:0;overflow:hidden;opacity:1;transition:opacity .15s}
.erp-sb.col .erp-foot-info{opacity:0;width:0;pointer-events:none}
.erp-foot-name{font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:.3px}
.erp-foot-role{font-size:9.5px;color:#93c5fd;margin-top:1px;letter-spacing:.2px}
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
.erp-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:10px;background:#f0f2f5}
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
  return <div className="erp-card" style={{background:"var(--card-bg,#fff)",borderRadius:12,border:"1px solid var(--border-color,#e2e8f0)",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;
}
function Lbl({children}){
  return <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:5}}>{children}</div>;
}
function Inp({style={},...p}){
  return <input style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",
    background:"var(--input-bg,#f8fafc)",color:"var(--text-primary,#1e293b)",fontSize:13,...style}} {...p}/>;
}
function Sel({style={},children,...p}){
  return <select style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid var(--border-color,#e2e8f0)",
    background:"var(--input-bg,#f8fafc)",color:"var(--text-primary,#1e293b)",fontSize:13,...style}} {...p}>{children}</select>;
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
function MasterPekerja({pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,log,user}){
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

  const thS={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  return(
    <div className="fi">
      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:8,marginBottom:14}}>
        {operatorDivisi.map(d=>{
          const cnt=pekerja.filter(p=>p.divisi===d.key).length;
          return(
            <div key={d.key} onClick={()=>setFilterDiv(filterDiv===d.key?"ALL":d.key)}
              style={{background:filterDiv===d.key?d.bg:"#fff",border:`1px solid ${filterDiv===d.key?d.color:"#e2e8f0"}`,
                borderLeft:`3px solid ${d.color}`,borderRadius:8,padding:"8px 12px",cursor:"pointer",transition:"all .15s"}}>
              <div style={{fontSize:18,fontWeight:800,color:d.color}}>{cnt}</div>
              <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,marginTop:2}}>{d.label}</div>
            </div>
          );
        })}
      </div>

      {/* Form */}
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Pekerja":"➕ Tambah Pekerja Baru"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{flex:1,minWidth:180}}>
            <Lbl>Nama Lengkap</Lbl>
            <Inp value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})}
              placeholder="Nama pekerja..." onKeyDown={e=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:160}}>
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

      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama pekerja..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:220}}/>
        <button onClick={()=>setFilterDiv("ALL")}
          style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
            border:filterDiv==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
            background:filterDiv==="ALL"?"#1d4ed8":"#fff",
            color:filterDiv==="ALL"?"#fff":"#64748b"}}>
          Semua ({pekerja.length})
        </button>
        {operatorDivisi.map(d=>{
          const cnt=pekerja.filter(p=>p.divisi===d.key).length;
          const isSel=filterDiv===d.key;
          return(
            <button key={d.key} onClick={()=>setFilterDiv(isSel?"ALL":d.key)}
              style={{padding:"4px 12px",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:700,
                border:isSel?`1.5px solid ${d.color}`:"1.5px solid #e2e8f0",
                background:isSel?d.color+"18":"#fff",color:isSel?d.color:"#64748b"}}>
              {d.label} ({cnt})
            </button>
          );
        })}
        <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{filtered.length} pekerja</span>
      </div>

      {/* Tabel */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={{...thS,width:40,textAlign:"center" as const}}>No</th>
              <th style={thS}>Nama</th>
              <th style={thS}>Divisi</th>
              <th style={{...thS,textAlign:"center" as const,width:100}}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={4} style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13}}>
                Tidak ada pekerja ditemukan
              </td></tr>
            ):filtered.map((p,i)=>{
              const dc=DIVISI_CONFIG[p.divisi];
              const rBg=i%2===0?"#fff":"#f8fafc";
              const isEdit=editId===p.id;
              const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
              return(
                <tr key={p.id}>
                  <td style={{...td,textAlign:"center",color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{p.nama}</td>
                  <td style={td}>
                    <span style={{background:dc?.bg,color:dc?.color,border:`1px solid ${dc?.color}30`,
                      borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>
                      {dc?.icon} {dc?.label}
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>startEdit(p)}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,
                          padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                      <button onClick={()=>setDelId(p.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,
                          padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
function TrackingPekerja({pekerja,renhar,setRenhar,removeRenhar,woData}){
  const [selPekerja,setSelPekerja]=useState<any>(null);
  const [filterDiv,setFilterDiv]=useState("ALL");
  const [search,setSearch]=useState("");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [delId,setDelId]=useState<any>(null);
  const [timerData,setTimerData]=useState<any[]>([]);

  useEffect(()=>{
    const fetchTimer=()=>{
      supabase.from("fcs_timer_kerja").select("*").not("selesai","is",null).then(({data})=>{
        setTimerData(data??[]);
      });
    };
    fetchTimer();
    const ch=supabase.channel("realtime-timer-kerja-tracking")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_timer_kerja"},fetchTimer)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getKpiPerPekerja=(pkrId:number)=>{
    const sesiPekerja=timerData.filter((t:any)=>{
      if(t.pekerja_id!==pkrId)return false;
      if(dateFrom&&t.tanggal<dateFrom)return false;
      if(dateTo&&t.tanggal>dateTo)return false;
      return true;
    });
    const totalMenit=sesiPekerja.reduce((s:number,t:any)=>s+Number(t.durasi_menit||0),0);
    const komponenUnik=new Set(sesiPekerja.map((t:any)=>`${t.panel_id}_${t.kode_komponen}_${t.proses}`));
    const jumlahKomponen=komponenUnik.size;
    const rataRataMenit=jumlahKomponen>0?totalMenit/jumlahKomponen:0;
    return{totalMenit,jumlahKomponen,rataRataMenit,jumlahSesi:sesiPekerja.length};
  };

  const operatorDivisi=Object.entries(DIVISI_CONFIG)
    .filter(([k])=>OPERATOR_ROLES.includes(k))
    .map(([k,v]:any)=>({key:k,...v}));

  // Ambil tugas pekerja dari renhar
  const getTugasPerPekerja=(pkrId:number)=>{
    return renhar.filter(r=>(r.pekerja||[]).includes(pkrId));
  };

  // Filter tugas berdasarkan tanggal
  const filterTugas=(tugas:any[])=>{
    return tugas.filter(t=>{
      if(dateFrom&&t.tanggal<dateFrom) return false;
      if(dateTo&&t.tanggal>dateTo) return false;
      return true;
    });
  };

  // Komponen individual per pekerja - gabung dari field lama (pekerja) dan baru (pekerja_per_komponen)
  // Khusus untuk task yang punya pekerja_per_komponen (WIRING CONTROL/POWER), pecah jadi komponen tersendiri
  // Untuk task lama (cuma pakai field pekerja), tetap 1 entry per komponen di task itu
  const getKomponenIndividualPerPekerja=(pkrId:number)=>{
    const hasil:any[]=[];
    renhar.forEach((t:any)=>{
      const ppk=t.pekerja_per_komponen||{};
      const punyaPpk=Object.keys(ppk).length>0;
      if(punyaPpk){
        (t.komponen||[]).forEach((kode:string)=>{
          const idsKomp=ppk[kode]||[];
          if(idsKomp.includes(pkrId)){
            hasil.push({...t,_komponenSpesifik:kode});
          }
        });
      } else if((t.pekerja||[]).includes(pkrId)){
        (t.komponen||[]).forEach((kode:string)=>{
          hasil.push({...t,_komponenSpesifik:kode});
        });
      }
    });
    return hasil;
  };

  // Progress khusus untuk 1 komponen spesifik (bukan rata-rata semua komponen di task)
  const getProgressKomponenSpesifik=(tugas:any)=>{
    const kode=tugas._komponenSpesifik;
    if(!kode)return getProgressTugas(tugas);
    const panel=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>
      String(p.id)===String(tugas.panel_id||tugas.panelId)
    );
    if(!panel||!panel.checklist)return 0;
    const cl=panel.checklist[kode];
    if(!cl)return 0;
    const proses=tugas.proses;
    const byDate=cl.progressByDate?.[proses];
    if(byDate&&byDate[tugas.tanggal]!==undefined)return byDate[tugas.tanggal];
    return cl.progress?.[proses]||0;
  };

  // Durasi kerja (menit) untuk 1 komponen spesifik dari fcs_timer_kerja
  const getDurasiKomponenSpesifik=(pkrId:number,tugas:any)=>{
    const kode=tugas._komponenSpesifik;
    if(!kode)return 0;
    const sesi=timerData.filter((tm:any)=>
      tm.pekerja_id===pkrId&&
      String(tm.panel_id)===String(tugas.panel_id||tugas.panelId)&&
      tm.kode_komponen===kode&&
      tm.proses===tugas.proses&&
      tm.tanggal===tugas.tanggal
    );
    return sesi.reduce((s:number,t:any)=>s+Number(t.durasi_menit||0),0);
  };

  // Hitung progress per tugas dari checklist panel
  const getProgressTugas=(tugas:any)=>{
    const panel=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>
      String(p.id)===String(tugas.panel_id||tugas.panelId)
    );
    if(!panel||!panel.checklist) return 0;
    const komps=tugas.komponen||[];
    if(!komps.length) return 0;
    const proses=tugas.proses;
    const vals=komps.map((kode:string)=>{
      const cl=panel.checklist[kode];
      if(!cl) return 0;
      // cek progressByDate untuk tanggal tugas
      const byDate=cl.progressByDate?.[proses];
      if(byDate&&byDate[tugas.tanggal]!==undefined) return byDate[tugas.tanggal];
      return cl.progress?.[proses]||0;
    });
    return Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length);
  };

  // Status berdasarkan progress
  const getStatus=(pct:number)=>{
    if(pct>=100) return{label:"Tercapai",color:"#16a34a",bg:"#f0fdf4"};
    if(pct>0) return{label:"On Progress",color:"#f59e0b",bg:"#fffbeb"};
    return{label:"Belum",color:"#94a3b8",bg:"#f8fafc"};
  };

  // Rekap per tanggal untuk pekerja tertentu - berbasis komponen individual
  const getRekapPerTanggal=(pkrId:number)=>{
    const tugas=filterTugas(getKomponenIndividualPerPekerja(pkrId));
    const byDate:{[d:string]:any[]}={};
    tugas.forEach(t=>{
      if(!byDate[t.tanggal]) byDate[t.tanggal]=[];
      byDate[t.tanggal].push(t);
    });
    return Object.entries(byDate).sort((a,b)=>b[0].localeCompare(a[0])).map(([tgl,tasks])=>{
      const progList=tasks.map(t=>getProgressKomponenSpesifik(t));
      const avgProg=progList.length?Math.round(progList.reduce((a,b)=>a+b,0)/progList.length):0;
      const selesai=progList.filter(p=>p>=100).length;
      return{tanggal:tgl,tasks,avgProg,selesai,total:tasks.length};
    });
  };

  // Stats per pekerja - berbasis komponen individual
  const getStatsPekerja=(pkrId:number)=>{
    const tugas=filterTugas(getKomponenIndividualPerPekerja(pkrId));
    const progList=tugas.map(t=>getProgressKomponenSpesifik(t));
    const selesai=progList.filter(p=>p>=100).length;
    const onProg=progList.filter(p=>p>0&&p<100).length;
    const belum=progList.filter(p=>p===0).length;
    const avg=progList.length?Math.round(progList.reduce((a,b)=>a+b,0)/progList.length):0;
    const hariKerja=new Set(tugas.map(t=>t.tanggal)).size;
    return{total:tugas.length,selesai,onProg,belum,avg,hariKerja};
  };

  // Download PDF per pekerja
  const downloadPDF=(pkrId:number)=>{
    const pkr=pekerja.find(p=>p.id===pkrId);
    if(!pkr) return;
    const dc:any=DIVISI_CONFIG[pkr.divisi]||{};
    const rekap=getRekapPerTanggal(pkrId);
    const stats=getStatsPekerja(pkrId);
    const periodeTxt=dateFrom&&dateTo?dateFrom+' s/d '+dateTo:dateFrom?'Dari '+dateFrom:dateTo?'Sampai '+dateTo:'Semua periode';

    let txt='';
    txt+='═══════════════════════════════════════════════════\n';
    txt+='           LAPORAN KINERJA PEKERJA\n';
    txt+='═══════════════════════════════════════════════════\n\n';
    txt+='Nama    : '+pkr.nama+'\n';
    txt+='Divisi  : '+(dc.label||pkr.divisi)+'\n';
    txt+='Periode : '+periodeTxt+'\n';
    txt+='Dicetak : '+new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})+'\n\n';

    txt+='─────────────────────────────────────────────────\n';
    txt+='RINGKASAN\n';
    txt+='─────────────────────────────────────────────────\n';
    txt+='Total Tugas   : '+stats.total+'\n';
    txt+='Tercapai      : '+stats.selesai+'\n';
    txt+='On Progress   : '+stats.onProg+'\n';
    txt+='Belum Mulai   : '+stats.belum+'\n';
    txt+='Avg Progress  : '+stats.avg+'%\n';
    txt+='Hari Kerja    : '+stats.hariKerja+' hari\n\n';

    txt+='─────────────────────────────────────────────────\n';
    txt+='REKAP PER TANGGAL\n';
    txt+='─────────────────────────────────────────────────\n';
    rekap.forEach(r=>{
      txt+='\n📅 '+fmtDate(r.tanggal)+'\n';
      txt+='   Tugas: '+r.total+' | Selesai: '+r.selesai+' | Avg: '+r.avgProg+'%\n';
      r.tasks.forEach((t:any,i:number)=>{
        const pct=getProgressTugas(t);
        const st=getStatus(pct);
        txt+='   '+(i+1)+'. '+t.proyek+' - '+t.panel+'\n';
        txt+='      Proses: '+t.proses+' | WP: '+t.wp+' | Progress: '+pct+'% ['+st.label+']\n';
        if(t.komponen?.length){
          const panel=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>String(p.id)===String(t.panel_id||t.panelId));
          const cfg=panel?PANEL_TYPES[panel.tipe]:null;
          const namaKomp=(t.komponen||[]).map((k:string)=>cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===k)?.nama||k).join(', ');
          txt+='      Komponen: '+namaKomp+'\n';
        }
      });
    });
    txt+='\n═══════════════════════════════════════════════════\n';

    const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='Laporan_'+pkr.nama.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredPekerja=pekerja.filter(p=>
    (filterDiv==="ALL"||p.divisi===filterDiv)&&
    p.nama.toLowerCase().includes(search.toLowerCase())
  );

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
    textTransform:"uppercase",letterSpacing:.4};

  return(
    <div className="fi">
      {/* Filter bar */}
      <div style={{background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px",marginBottom:12,display:"flex",gap:8,flexWrap:"wrap" as const,alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari nama pekerja..."
          style={{height:28,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",fontFamily:"inherit",width:200}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#64748b"}}>
          <span>Dari:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}/>
          <span>Sampai:</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:7,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}/>
          {(dateFrom||dateTo)&&(
            <button onClick={()=>{setDateFrom("");setDateTo("");}}
              style={{height:28,padding:"0 10px",border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",borderRadius:7,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              Reset
            </button>
          )}
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap" as const,marginLeft:"auto"}}>
          <button onClick={()=>setFilterDiv("ALL")}
            style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:10,fontWeight:700,
              border:filterDiv==="ALL"?"1.5px solid #1d4ed8":"1.5px solid #e2e8f0",
              background:filterDiv==="ALL"?"#1d4ed8":"#fff",color:filterDiv==="ALL"?"#fff":"#64748b"}}>
            Semua ({pekerja.length})
          </button>
          {operatorDivisi.map((d:any)=>{
            const cnt=pekerja.filter((p:any)=>p.divisi===d.key).length;
            const isSel=filterDiv===d.key;
            return(
              <button key={d.key} onClick={()=>setFilterDiv(isSel?"ALL":d.key)}
                style={{padding:"3px 10px",borderRadius:20,cursor:"pointer",fontSize:10,fontWeight:700,
                  border:isSel?`1.5px solid ${d.color}`:"1.5px solid #e2e8f0",
                  background:isSel?d.color+"18":"#fff",color:isSel?d.color:"#64748b"}}>
                {d.label} ({cnt})
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabel pekerja */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:12}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            <th style={{...thS,width:40,textAlign:"center" as const}}>No</th>
            <th style={thS}>Nama Pekerja</th>
            <th style={thS}>Divisi</th>
            <th style={{...thS,textAlign:"center" as const}}>Total Tugas</th>
            <th style={{...thS,textAlign:"center" as const}}>Tercapai</th>
            <th style={{...thS,textAlign:"center" as const}}>On Progress</th>
            <th style={{...thS,textAlign:"center" as const}}>Hari Kerja</th>
            <th style={{...thS,minWidth:100}}>Avg Progress</th>
            <th style={{...thS,textAlign:"center" as const}}>⏱ Total Jam</th>
            <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
          </tr></thead>
          <tbody>
            {filteredPekerja.length===0?(
              <tr><td colSpan={10} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Tidak ada pekerja ditemukan</td></tr>
            ):filteredPekerja.map((p:any,i:number)=>{
              const dc:any=DIVISI_CONFIG[p.divisi]||{};
              const stats=getStatsPekerja(p.id);
              const kpi=getKpiPerPekerja(p.id);
              const isSel=selPekerja?.id===p.id;
              const rBg=isSel?"#eff6ff":i%2===0?"#fff":"#f8fafc";
              const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
              return(
                <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>setSelPekerja(isSel?null:p)}>
                  <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={{...td,fontWeight:700,color:"#1e293b"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:26,height:26,borderRadius:7,background:dc.bg||"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:dc.color||"#64748b",flexShrink:0}}>
                        {p.nama?.slice(0,2).toUpperCase()}
                      </div>
                      {p.nama}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{background:dc.bg,color:dc.color,border:`1px solid ${dc.color}30`,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>
                      {dc.icon} {dc.label}
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#1e293b"}}>{stats.total}</td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{color:"#16a34a",fontWeight:700}}>{stats.selesai}</span>
                  </td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{color:"#f59e0b",fontWeight:700}}>{stats.onProg}</span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{stats.hariKerja}</td>
                  <td style={td}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{flex:1,height:5,background:"#e2e8f0",borderRadius:99,overflow:"hidden",minWidth:60}}>
                        <div style={{width:stats.avg+"%",height:"100%",background:stats.avg>=75?"#16a34a":stats.avg>=50?"#f59e0b":"#ef4444",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:stats.avg>=75?"#16a34a":stats.avg>=50?"#f59e0b":"#ef4444",minWidth:32}}>{stats.avg}%</span>
                    </div>
                  </td>
                  <td style={{...td,textAlign:"center" as const}}>
                    {kpi.totalMenit>0?(
                      <div>
                        <div style={{fontWeight:700,color:"#1e293b"}}>{Math.floor(kpi.totalMenit/60)}j {Math.round(kpi.totalMenit%60)}m</div>
                        <div style={{fontSize:9,color:"#94a3b8"}}>{kpi.jumlahKomponen} komp · avg {Math.round(kpi.rataRataMenit)}m</div>
                      </div>
                    ):(
                      <span style={{color:"#cbd5e1"}}>—</span>
                    )}
                  </td>
                  <td style={{...td,textAlign:"center" as const}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>downloadPDF(p.id)}
                      style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#1d4ed8",fontWeight:600}}>
                      📄 PDF
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail pekerja yang dipilih */}
      {selPekerja&&(()=>{
        const dc:any=DIVISI_CONFIG[selPekerja.divisi]||{};
        const stats=getStatsPekerja(selPekerja.id);
        const rekap=getRekapPerTanggal(selPekerja.id);
        return(
          <div style={{background:"#fff",borderRadius:12,border:"1.5px solid #bfdbfe",overflow:"hidden"}}>
            {/* Header pekerja */}
            <div style={{background:"linear-gradient(135deg,#1e3a8a,#2563eb)",padding:"14px 18px",display:"flex",alignItems:"center",gap:12,justifyContent:"space-between",flexWrap:"wrap" as const}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff"}}>
                  {selPekerja.nama?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#fff"}}>{selPekerja.nama}</div>
                  <span style={{background:"rgba(255,255,255,.2)",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:600}}>
                    {dc.icon} {dc.label}
                  </span>
                </div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap" as const}}>
                {[
                  {l:"Total Tugas",v:stats.total,c:"#fff"},
                  {l:"Tercapai",v:stats.selesai,c:"#86efac"},
                  {l:"On Progress",v:stats.onProg,c:"#fde68a"},
                  {l:"Hari Kerja",v:stats.hariKerja,c:"#bfdbfe"},
                  {l:"Avg %",v:stats.avg+"%",c:"#fff"},
                ].map((s,i)=>(
                  <div key={i} style={{textAlign:"center" as const}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.7)",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
                  </div>
                ))}
              </div>
              <button onClick={()=>setSelPekerja(null)}
                style={{background:"rgba(255,255,255,.2)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:"#fff",fontSize:12,fontWeight:600}}>
                ✕ Tutup
              </button>
            </div>

            {/* Rekap per tanggal */}
            <div style={{padding:"14px 18px"}}>
              {rekap.length===0?(
                <div style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13}}>
                  Belum ada data tugas{dateFrom||dateTo?" pada periode ini":""}
                </div>
              ):rekap.map((r:any)=>(
                <div key={r.tanggal} style={{marginBottom:16}}>
                  {/* Header tanggal */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,padding:"6px 12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                    <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>📅 {fmtDate(r.tanggal)}</span>
                    <span style={{fontSize:11,color:"#64748b"}}>{r.total} tugas</span>
                    <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✓ {r.selesai} selesai</span>
                    <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:80,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                        <div style={{width:r.avgProg+"%",height:"100%",background:r.avgProg>=75?"#16a34a":r.avgProg>=50?"#f59e0b":"#ef4444",borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:r.avgProg>=75?"#16a34a":r.avgProg>=50?"#f59e0b":"#ef4444"}}>{r.avgProg}%</span>
                    </div>
                  </div>

                  {/* Detail tugas per tanggal */}
                  <div style={{overflowX:"auto" as const,borderRadius:8,border:"1px solid #e2e8f0"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
                      <thead><tr>
                        {["No","Proyek","Panel","Proses","WP","Komponen","Durasi","Progress","Status","Hapus"].map(h=>(
                          <th key={h} style={{background:"#f1f5f9",color:"#64748b",padding:"6px 8px",fontWeight:600,fontSize:9.5,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #e2e8f0",textTransform:"uppercase" as const,letterSpacing:.3}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {r.tasks.map((t:any,ti:number)=>{
                          const pct=getProgressKomponenSpesifik(t);
                          const st=getStatus(pct);
                          const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>String(p.id)===String(t.panel_id||t.panelId));
                          const cfg=panelData?PANEL_TYPES[panelData.tipe]:null;
                          const pc=PROSES_COLOR[t.proses]||"#64748b";
                          const wc=WP_COLOR[t.wp]||"#64748b";
                          const rBg2=ti%2===0?"#fff":"#f8fafc";
                          const td2:any={padding:"6px 8px",borderBottom:"1px solid #f5f7fa",borderRight:"1px solid #f5f7fa",background:rBg2,verticalAlign:"middle"};
                          const kode=t._komponenSpesifik;
                          const namaKomp=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
                          const durasiMenit=getDurasiKomponenSpesifik(selPekerja.id,t);
                          const durasiLabel=durasiMenit>0?(Math.floor(durasiMenit/60)>0?`${Math.floor(durasiMenit/60)}j ${Math.round(durasiMenit%60)}m`:`${Math.round(durasiMenit)}m`):"—";
                          return(
                            <tr key={(t.id||ti)+"-"+kode}>
                              <td style={{...td2,color:"#94a3b8",fontWeight:600,textAlign:"center" as const}}>{ti+1}</td>
                              <td style={{...td2,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                              <td style={{...td2,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                              <td style={td2}><span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>{t.proses}</span></td>
                              <td style={td2}><span style={{background:wc,color:"#fff",borderRadius:5,padding:"1px 7px",fontSize:10,fontWeight:700}}>{t.wp}</span></td>
                              <td style={td2}>
                                <span style={{background:"#f1f5f9",borderRadius:4,padding:"1px 6px",fontSize:9.5,color:"#475569",fontWeight:600}}>{namaKomp}</span>
                              </td>
                              <td style={{...td2,textAlign:"center" as const,fontWeight:700,color:durasiMenit>0?"#1d4ed8":"#cbd5e1"}}>{durasiLabel}</td>
                              <td style={td2}>
                                <div style={{display:"flex",alignItems:"center",gap:5}}>
                                  <div style={{width:50,height:4,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:pct>=100?"#16a34a":pct>0?"#f59e0b":"#e2e8f0",borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:10,fontWeight:700,color:pct>=100?"#16a34a":pct>0?"#f59e0b":"#94a3b8"}}>{pct}%</span>
                                </div>
                              </td>
                              <td style={td2}>
                                <span style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,borderRadius:20,padding:"2px 8px",fontSize:9.5,fontWeight:700}}>
                                  {st.label}
                                </span>
                              </td>
                              <td style={{...td2,textAlign:"center" as const}}>
                                <button onClick={()=>setDelId(t)}
                                  style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#dc2626"}}>
                                  🗑
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Modal hapus */}
      {delId&&(
        <Modal title="Hapus Tugas?" onClose={()=>setDelId(null)} width={380}>
          <div style={{fontSize:13,color:"#475569",marginBottom:8}}>
            Tugas berikut akan dihapus dari rencana harian:
          </div>
          <div style={{background:"#f8fafc",borderRadius:8,padding:"10px 12px",marginBottom:20,fontSize:12}}>
            <div style={{fontWeight:700,color:"#1e293b",marginBottom:4}}>{delId.proyek} — {delId.panel}</div>
            <div style={{color:"#64748b"}}>{delId.proses} · {delId.wp} · {fmtDate(delId.tanggal)}</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={async()=>{
              if(removeRenhar) await removeRenhar(delId.id);
              if(setRenhar) setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==delId.id));
              setDelId(null);
            }}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// RENCANA HARIAN
// ─────────────────────────────────────────────────────────────────────────────
function RencanaHarian({rawData,woData,renhar,setRenhar,pekerja,createRenhar,updateRenhar,removeRenhar,logActivity,logAct,log,user}){
  const [selDate,setSelDate]=useState(TODAY);
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [selProses,setSelProses]=useState("ALL");
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit"),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  const onDragStart=(e,rawId,fromDate,entries)=>{
    e.dataTransfer.effectAllowed="move";
    setDragInfo({rawId,fromDate,entries});
  };

  const onDragOver=(e,rawId,date)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOverCell({rawId,date});
  };

  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    setDragOverCell(null);
    if(!dragInfo)return;
    if(dragInfo.rawId!==rawId){setDragInfo(null);return;}
    if(dragInfo.fromDate===toDate){setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});
    setDragInfo(null);
  };

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
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
      // Tambah busbar tasks dari busbar_schedule
      if(row.proses==="BUSBAR"){
        const busbarItems=row.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          // Cek apakah sudah ada dari renhar (hindari duplikat)
          const alreadyInSchedule=entries.some(e=>e.wp==="BUSBAR");
          if(!alreadyInSchedule){
            tasks.push({
              rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
              proyek:row.proyek,panel:row.panel,proses:row.proses,
              prioritas:row.prioritas||"Sedang",
              wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,
              isBusbar:true,
            });
          }
        }
      }
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

  const toggleReleaseKomponen=async(task:any,kode:string,sedangDirilis:boolean)=>{
    const divisi=Object.entries(DIVISI_PROSES).find(([,ps])=>(ps as string[]).includes(task.proses))?.[0]||"mekanik";
    const existing=getRenharEntry(task);
    if(existing){
      const releasedLama=existing.komponen_released||[];
      const releasedBaru=sedangDirilis?releasedLama.filter((k:string)=>k!==kode):[...releasedLama,kode];
      await updateRenhar(existing.id,{komponen_released:releasedBaru});
      setRenhar((prev:any)=>prev.map((r:any)=>r.id===existing.id?{...r,komponen_released:releasedBaru}:r));
    } else {
      const result=await createRenhar({
        raw_id:task.rawId,wo_id:task.woId,panel_id:task.panelId,
        proyek:task.proyek,panel:task.panel,proses:task.proses,
        prioritas:task.prioritas||"Sedang",wp:task.wp,komponen:task.komponen,
        tanggal:task.tanggal,divisi,pekerja:[],komponen_released:[kode],
      });
      if(result?.success&&result.data){setRenhar((prev:any)=>[...prev,result.data]);}
    }
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
    if(log) await log("DISTRIBUSI RENHAR","Distribusi operator proses "+task.proses+" - "+task.panel+" ("+task.tanggal+")","renhar",{module:"rencana",action_type:"distribute",proyek:task.proyek||"",panel:task.panel||"",wo_number:task.woId?.toString()||"",halaman:"Rencana Harian"});
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
        const thS={background:"#1e3a8a",color:"#fff",padding:"6px 8px",fontWeight:700,fontSize:10,whiteSpace:"nowrap",textAlign:"left",position:"sticky",top:0,borderRight:"1px solid #ffffff18"};
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
                  {tasks.flatMap((t,ti)=>{
                    const dist=isDist(t);const rh=getRenharEntry(t);
                    const panelData=woData.flatMap(w=>w.panels||[]).find(p=>p.id===t.panelId);
                    const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
                    const wc=WP_COLOR[t.wp]||"#64748b";const priColor=PRIORITAS_COLOR[t.prioritas]||"#64748b";
                    const isWiringTask=PROSES_ORANG_RAW_GLOBAL.includes(t.proses);

                    if(isWiringTask){
                      const ppk=rh?.pekerja_per_komponen||{};
                      const released=rh?.komponen_released||[];
                      return(t.komponen||[]).map((kode,ki)=>{
                        const item=cfg2?.wps.flatMap(w=>w.items).find(it=>it.kode===kode);
                        const idxGlobal=ti*100+ki;
                        const rBg=idxGlobal%2===0?"#fff":"#f8fafc";
                        const sudahRelease=released.includes(kode);
                        const workersKode=(ppk[kode]||[]).map((id:number)=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean);
                        const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:sudahRelease?"#f0fdf4":rBg,verticalAlign:"middle"};
                        return(
                          <tr key={ti+"-"+kode}>
                            <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}.{ki+1}</td>
                            <td style={{...td,fontWeight:600,color:"#475569"}}>{t.proyek}</td>
                            <td style={{...td,fontWeight:600,color:"#1e293b"}}>{t.panel}</td>
                            <td style={{...td,textAlign:"center"}}><span style={{background:wc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{t.wp}</span></td>
                            <td style={{...td,textAlign:"center"}}><span style={{background:priColor+"18",color:priColor,border:`1px solid ${priColor}33`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{t.prioritas}</span></td>
                            <td style={{...td}}>
                              <span style={{background:"#f1f5f9",borderRadius:4,padding:"2px 7px",fontSize:10,color:"#475569",fontWeight:600}}>{item?.nama||kode}</span>
                            </td>
                            <td style={{...td}}>
                              {!sudahRelease?(
                                <span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Belum dirilis</span>
                              ):workersKode.length>0?(
                                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{workersKode.map((n:string)=>(<span key={n} style={{background:"#eff6ff",border:"1px solid #bfdbfe",color:"#1d4ed8",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>👤 {n}</span>))}</div>
                              ):(<span style={{fontSize:11,color:"#cbd5e1",fontStyle:"italic"}}>Pilih sendiri di tablet</span>)}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              {sudahRelease?<span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>✅ Dirilis</span>
                                :<span style={{background:"#fef2f2",border:"1px solid #fecaca",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700}}>⏳ Belum</span>}
                            </td>
                            <td style={{...td,textAlign:"center"}}>
                              <Btn color={sudahRelease?"#dc2626":"#2563eb"} style={{fontSize:11,padding:"5px 14px"}} onClick={()=>toggleReleaseKomponen(t,kode,sudahRelease)}>{sudahRelease?"↩️ Tarik":"📤 Rilis"}</Btn>
                            </td>
                          </tr>
                        );
                      });
                    }

                    const workers=(rh?.pekerja||[]).map(id=>pekerja.find(p=>p.id===id)?.nama).filter(Boolean);
                    const rBg=ti%2===0?"#fff":"#f8fafc";
                    const td={padding:"5px 8px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:dist?"#f0fdf4":rBg,verticalAlign:"middle"};
                    return[(
                      <tr key={ti}>
                        <td style={{...td,textAlign:"center",fontWeight:700,color:"#94a3b8"}}>{ti+1}</td>
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
                    )];
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
  const thS={background:"var(--bg-secondary,#f8f9fb)",color:"var(--text-muted,#6b7280)",fontWeight:600,padding:"7px 12px",textAlign:"left",fontSize:9.5,textTransform:"uppercase",letterSpacing:.5,borderBottom:"0.5px solid #e5e8ed",whiteSpace:"nowrap"};
  return(
    <div className="fi">
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {stats.map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,padding:"10px 12px",borderLeft:"3px solid "+s.c}}>
            <div style={{fontSize:20,fontWeight:500,color:s.c,lineHeight:1}}>{s.v}</div>
            <div style={{fontSize:9.5,color:"#9ca3af",marginTop:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{background:"var(--card-bg,#fff)",border:"0.5px solid var(--border-color,#e5e8ed)",borderRadius:8,marginBottom:10,overflow:"hidden"}}>
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
                  <tr key={a.id||i} style={{borderBottom:i<filtered.length-1?"0.5px solid var(--border-light,#f0f2f5)":"none",cursor:"default"}}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-secondary,#f8f9fb)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{width:30,height:30,borderRadius:6,background:mc.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{mc.icon}</div>
                    </td>
                    <td style={{padding:"8px 12px",verticalAlign:"middle"}}>
                      <div style={{fontSize:12,fontWeight:500,color:"var(--text-primary,#1a1d23)",marginBottom:3}}>{desc}</div>
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

function KendalaInbox({kendalaLog,removeKendala,user}:any){
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
              <div key={k.id} style={{background:"var(--card-bg,#fff)",borderRadius:12,border:"1px solid var(--border-color,#e2e8f0)",
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
                  <button onClick={()=>removeKendala(k.id, user?.name||user?.nama||'Admin')}
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
    <div style={{minHeight:"100vh",width:"100%",background:"#f8fafc",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
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
    await activityLogService.insert({user_name:data.nama,action:"LOGIN",description:"Login ke sistem",module:"auth",halaman:"Login"});
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
    <div style={{minHeight:"100vh",width:"100%",display:"flex",background:"#f1f5f9"}}>
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
    fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",fontFamily:"inherit"};
  const selS={height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
    fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"};

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
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"12px 14px"}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c,lineHeight:1}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:4,fontWeight:500,textTransform:"uppercase",letterSpacing:.4}}>{s.l}</div>
            <div style={{height:3,background:"#e2e8f0",borderRadius:99,marginTop:10,overflow:"hidden"}}>
              <div style={{width:s.w+"%",height:"100%",background:s.c,borderRadius:99}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,overflow:"hidden"}}>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border-color,#eaecf0)",padding:"0 5px",background:"var(--card-bg,#fff)"}}>
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
                {["No WO","Proyek","Target","Panel","Progress","Status","Aksi"].map(h=><th key={h} style={thS}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredWO.length===0&&<tr><td colSpan={7} style={{...tdS,textAlign:"center",color:"#94a3b8",padding:"24px"}}>Tidak ada data</td></tr>}
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
                      <td style={{...tdS,textAlign:"center" as const}}>
                        {pct===100?(
                          <Btn color="#16a34a" style={{fontSize:11,padding:"4px 10px"}} onClick={()=>setArsipModal(wo)}>
                            📦 Arsipkan
                          </Btn>
                        ):(
                          <span style={{fontSize:10,color:"#cbd5e1"}}>—</span>
                        )}
                      </td>
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
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

  const PROSES_LIST=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

  const filtered=woData.filter(w=>{
    const pct=woOverall(w);
    const s=pct===100?"selesai":isDelayed(w.target)?"terlambat":isUrgent(w.target)?"mendesak":"ontrack";
    const matchS=statusFilter.length===0||statusFilter.includes(s);
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
  const allPanelsForNp=woData.flatMap((w:any)=>w.panels||[]);
  const belumNameplate=allPanelsForNp.filter((p:any)=>(p.nameplate_progress||0)<100).length;
  const belumYellowmark=allPanelsForNp.filter((p:any)=>(p.yellowmark_progress||0)<100).length;

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
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:8}}>
        {[
          {n:totalPanel,l:"Total Panel",c:"#2563eb",bc:"#2563eb"},
          {n:avgOverall+"%",l:"Avg Overall",c:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626",bc:avgOverall>=70?"#16a34a":avgOverall>=40?"#d97706":"#dc2626"},
          {n:selesai,l:"Selesai",c:"#16a34a",bc:"#16a34a"},
          {n:mendesak,l:"Mendesak H-7",c:"#d97706",bc:"#d97706"},
          {n:terlambat,l:"Terlambat",c:"#dc2626",bc:"#dc2626"},
          {n:belumNameplate,l:"Belum Nameplate",c:"#0891b2",bc:"#0891b2"},
          {n:belumYellowmark,l:"Belum Yellowmark",c:"#ca8a04",bc:"#ca8a04"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari WO / proyek / panel..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",
            fontFamily:"inherit",flex:1,minWidth:180}}/>
        <div style={{display:"flex",gap:4,flexWrap:"wrap" as const,alignItems:"center"}}>
          {[
            {v:"ontrack",l:"● On Track",c:"#2563eb",bg:"#eff6ff"},
            {v:"mendesak",l:"● Mendesak H-7",c:"#d97706",bg:"#fffbeb"},
            {v:"terlambat",l:"● Terlambat",c:"#dc2626",bg:"#fef2f2"},
            {v:"selesai",l:"✓ Selesai",c:"#16a34a",bg:"#f0fdf4"},
          ].map(f=>{
            const on=statusFilter.includes(f.v);
            return(
              <button key={f.v} onClick={()=>setStatusFilter((prev:string[])=>on?prev.filter(x=>x!==f.v):[...prev,f.v])}
                style={{border:`1.5px solid ${on?f.c:"#e2e8f0"}`,
                  background:on?f.bg:"#fff",color:on?f.c:"#64748b",
                  borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:on?700:400,
                  cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
                {on&&<span style={{width:5,height:5,borderRadius:"50%",background:f.c}}/>}
                {f.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",
                borderRadius:20,padding:"3px 10px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>
              ✕ Reset
            </button>
          )}
        </div>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.reduce((a,w)=>a+(w.panels||[]).length,0)} panel · {filtered.length} WO</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Table per WO */}
      {filtered.length===0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
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
          pr!=="QC TEST"&&pr!=="PACKING"&&panelProgressData.some((pd:any)=>pd[pr]!==undefined)
        );

        // Rata-rata per proses
        const rataProses=(pr:string)=>{
          const vals=panelProgressData.map((pd:any)=>pd[pr]).filter((v:any)=>v!==undefined) as number[];
          if(!vals.length) return undefined;
          return Math.round(vals.reduce((a:number,v:number)=>a+v,0)/vals.length);
        };

        return(
          <div key={wo.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* WO Header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid #eaecf0",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {wo.wo}</span>
              <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{wo.proyek}</span>
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
                      <th style={{...thS,minWidth:65,borderTop:"3px solid #0891b2"}}>NAMEPLATE</th>
                      <th style={{...thS,minWidth:65,borderTop:"3px solid #ca8a04"}}>YELLOWMARK</th>
                      <th style={{...thS,minWidth:55,borderTop:"3px solid #16a34a"}}>QC</th>
                      <th style={{...thS,minWidth:55,borderTop:"3px solid #2563eb"}}>PACKING</th>
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
                          {(()=>{
                            const qcCl=p.qc_checklist||{};
                            const qcStatuses=["fisik","spesifikasi","baut","test"].map((k:string)=>qcCl[k]?.status||"belum");
                            const qcStatus=qcStatuses.some((s:string)=>s==="gagal")?"gagal":qcStatuses.every((s:string)=>s==="lolos")?"lolos":"belum";
                            return(
                              <>
                                <td style={{...tdS,fontWeight:700,color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8"}}>{p.nameplate_progress||0}%</td>
                                <td style={{...tdS,fontWeight:700,color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8"}}>{p.yellowmark_progress||0}%</td>
                                <td style={{...tdS,fontWeight:700,color:qcStatus==="lolos"?"#16a34a":qcStatus==="gagal"?"#dc2626":"#94a3b8",fontSize:9}}>{qcStatus==="lolos"?"Lolos":qcStatus==="gagal"?"Gagal":"Belum"}</td>
                                <td style={{...tdS,fontWeight:700,color:p.packing_done?"#2563eb":"#94a3b8",fontSize:9}}>{p.packing_done?"Selesai":"Belum"}</td>
                              </>
                            );
                          })()}
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

function DetailProgress({woData,rawData}:{woData:any[],rawData:any[]}){
  const [search,setSearch]=useState("");
  const [woFilter,setWoFilter]=useState("semua");
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

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
    const matchS=statusFilter.length===0||statusFilter.includes(s);
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

  const ProsesPctCell=({pct,proses,cl,nama}:{pct:number|undefined,proses:string,cl?:any,nama?:string})=>{
    if(pct===undefined||pct===null) return <td style={{...tdS,color:"#e2e8f0",fontSize:9}}>—</td>;
    const color=(PROSES_COLOR as any)[proses]||"#94a3b8";
    const isDone=pct===100;
    const history=cl?.history?.[proses]||[];
    const pctFinal=pct!==undefined&&pct!==null?pct:getBestProgress(cl,proses);
    return(
      <td style={tdS} className="hist-cell">
        <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
          <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
            <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
          </div>
          <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
          {history.length>0&&(
            <div className="hist-tooltip" style={{
              opacity:0,visibility:"hidden" as const,
              position:"absolute" as const,bottom:"100%",left:"50%",
              transform:"translateX(-50%)",
              background:"#1e293b",color:"#f1f5f9",
              borderRadius:8,padding:"8px 12px",
              fontSize:10,whiteSpace:"nowrap" as const,
              zIndex:999,marginBottom:6,
              boxShadow:"0 4px 16px #00000030",
              transition:"opacity .15s",
              minWidth:180,
            }}>

              {[...history].sort((a:any,b:any)=>a.tanggal?.localeCompare(b.tanggal)).map((h:any,hi:number)=>(
                <div key={hi} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"2px 0",borderBottom:hi<history.length-1?"1px solid #334155":"none"}}>
                  <span style={{color:"#94a3b8"}}>📅 {new Date(h.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</span>
                  <span style={{color:"#fbbf24"}}>Shift {h.shift}</span>
                  <span style={{color:h.pct>=100?"#4ade80":h.pct>0?"#fb923c":"#94a3b8",fontWeight:700}}>{h.pct}%</span>
                </div>
              ))}
              <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
            </div>
          )}
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
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderTop:"3px solid "+s.bc,borderRadius:8,padding:"10px 13px",textAlign:"center" as const}}>
            <div style={{fontSize:20,fontWeight:700,color:s.c}}>{s.n}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:500,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"10px 13px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
        <input placeholder="🔍 Cari panel, proyek, WO..."
          value={search} onChange={e=>setSearch(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 10px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-primary,#1e293b)",
            fontFamily:"inherit",flex:1,minWidth:160}}/>
        <select value={woFilter} onChange={e=>setWoFilter(e.target.value)}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua WO</option>
          {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
        </select>
        <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap" as const}}>
          {[
            {v:"ontrack",l:"On Track",c:"#2563eb"},
            {v:"mendesak",l:"Mendesak H-7",c:"#d97706"},
            {v:"terlambat",l:"Terlambat",c:"#dc2626"},
            {v:"selesai",l:"Selesai",c:"#16a34a"},
          ].map(opt=>{
            const isSel=statusFilter.includes(opt.v);
            return(
              <button key={opt.v} onClick={()=>setStatusFilter(prev=>isSel?prev.filter(x=>x!==opt.v):[...prev,opt.v])}
                style={{height:28,padding:"0 10px",borderRadius:5,border:`1.5px solid ${isSel?opt.c:"#e2e8f0"}`,
                  background:isSel?opt.c+"18":"var(--input-bg,#f8fafc)",color:isSel?opt.c:"var(--text-secondary,#475569)",
                  fontSize:11,fontWeight:isSel?700:500,cursor:"pointer",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap" as const}}>
                {isSel&&<span style={{width:6,height:6,borderRadius:"50%",background:opt.c}}/>}
                {opt.l}
              </button>
            );
          })}
          {statusFilter.length>0&&(
            <button onClick={()=>setStatusFilter([])}
              style={{height:28,padding:"0 8px",borderRadius:5,border:"1px solid #fecaca",
                background:"#fef2f2",color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              ✕ Reset
            </button>
          )}
        </div>
        <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} panel</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Panel cards dengan komponen */}
      {filtered.length===0?(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
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
        // Tampilkan BUSBAR jika tipe panel punya komponen busbar (WM) atau ada progress
        const BUSBAR_TIPE=["WM_MS","WM_POLY","FS","F3B"];
        const hasBusbar=BUSBAR_TIPE.includes(p.tipe)||Object.keys(p.busbar_progress||{}).length>0;
        const prosesPanel=PROSES_LIST.filter(pr=>{
          if(pr==="QC TEST"||pr==="PACKING") return false;
          if(pr==="BUSBAR") return hasBusbar;
          return p.pd[pr]!==undefined&&p.pd[pr]>=0;
        });

        return(
          <div key={pi} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#eaecf0)",
            borderRadius:8,overflow:"hidden",borderLeft:"3px solid "+borderColor}}>

            {/* Panel header */}
            <div style={{padding:"9px 13px",borderBottom:"1px solid var(--border-color,#eaecf0)",
              display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" as const,background:"var(--bg-secondary,#fafbfc)"}}>
              <span style={{color:"#2563eb",fontWeight:800,fontFamily:"ui-monospace,monospace",fontSize:12}}>WO {p.wo}</span>
              <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.proyek}</span>
              <span style={{color:"#94a3b8",fontSize:11}}>|</span>
              <span style={{fontWeight:600,color:"var(--text-primary,#1e293b)",fontSize:12}}>{p.nama||"Panel "+(pi+1)}</span>
              {p.tipe&&<span style={{background:"#eff6ff",color:"#2563eb",borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:600}}>{p.tipe}</span>}
              <span style={{fontSize:11,color:"#94a3b8"}}>📅 {p.target}</span>
              {!done&&<span style={{fontSize:11,fontWeight:600,color:late?"#dc2626":urg?"#d97706":"#16a34a"}}>
                {late?"Terlambat "+Math.abs(d)+" hari":urg?"H-"+d+" Mendesak":"H-"+d}
              </span>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                {(p.nameplate_progress!==undefined||p.yellowmark_progress!==undefined)&&(
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:5,border:`1px solid ${(p.nameplate_progress||0)>=100?"#a5f3fc":"#e2e8f0"}`,background:(p.nameplate_progress||0)>=100?"#ecfeff":"#f8fafc",color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8",whiteSpace:"nowrap" as const}}>Nameplate: {p.nameplate_progress||0}%</span>
                    <span style={{fontSize:9,fontWeight:700,padding:"3px 8px",borderRadius:5,border:`1px solid ${(p.yellowmark_progress||0)>=100?"#fde68a":"#e2e8f0"}`,background:(p.yellowmark_progress||0)>=100?"#fefce8":"#f8fafc",color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8",whiteSpace:"nowrap" as const}}>Yellowmark: {p.yellowmark_progress||0}%</span>
                  </div>
                )}
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
                    <th style={{...thS,minWidth:70,borderTop:"3px solid #0891b2"}}>NAMEPLATE</th>
                    <th style={{...thS,minWidth:70,borderTop:"3px solid #ca8a04"}}>YELLOWMARK</th>
                    <th style={{...thS,minWidth:60,borderTop:"3px solid #16a34a"}}>QC</th>
                    <th style={{...thS,minWidth:60,borderTop:"3px solid #2563eb"}}>PACKING</th>
                  </tr>
                </thead>
                <tbody>
                  {(()=>{
                    const totalRowsPanel=wps.reduce((sum:number,wp:any)=>{
                      const ai=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                      return sum+ai.length;
                    },0);
                    const firstRenderedWp=wps.find((wp:any)=>{
                      const ai=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                      return ai.length>0;
                    });
                    const qcCl=p.qc_checklist||{};
                    const qcStatuses=["fisik","spesifikasi","baut","test"].map((k:string)=>qcCl[k]?.status||"belum");
                    const qcStatus=qcStatuses.some((s:string)=>s==="gagal")?"gagal":qcStatuses.every((s:string)=>s==="lolos")?"lolos":"belum";
                  return wps.map((wp:any)=>{
                    const wpColor=(WP_COLOR as any)[wp.wp]||"#94a3b8";
                    const activeItems=wp.items.filter((it:any)=>(p.checklist?.[it.kode]?.qty||0)>0||(p.checklist?.[it.kode]));
                    if(!activeItems.length) return null;
                    return activeItems.map((it:any,ii:number)=>{
                      const cl=p.checklist?.[it.kode];
                      const qty=cl?.qty||it.qty||1;
                      const rowBg=wp.wp==="WP1"?"var(--wp1-bg,#fffbeb)":wp.wp==="WP2"?"var(--wp2-bg,#f0fdf4)":wp.wp==="WP3"?"var(--wp3-bg,#eff6ff)":wp.wp==="WP4"?"#fff7ed":"#fafbfc";
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
                            return <ProsesPctCell key={pr} pct={pct} proses={pr} cl={cl} nama={it.nama||it.komponen||it.name}/>;
                          })}
                          {wp===firstRenderedWp&&ii===0&&(
                            <>
                              <td style={{...tdS,fontWeight:700,color:(p.nameplate_progress||0)>=100?"#0891b2":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.nameplate_progress||0}%</td>
                              <td style={{...tdS,fontWeight:700,color:(p.yellowmark_progress||0)>=100?"#ca8a04":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.yellowmark_progress||0}%</td>
                              <td style={{...tdS,fontWeight:700,color:qcStatus==="lolos"?"#16a34a":qcStatus==="gagal"?"#dc2626":"#94a3b8"}} rowSpan={totalRowsPanel}>{qcStatus==="lolos"?"Lolos":qcStatus==="gagal"?"Gagal":"Belum"}</td>
                              <td style={{...tdS,fontWeight:700,color:p.packing_done?"#2563eb":"#94a3b8"}} rowSpan={totalRowsPanel}>{p.packing_done?"Selesai":"Belum"}</td>
                            </>
                          )}
                        </tr>
                      );
                    });
                  });
                  })()}
                  {/* Busbar rows - dari busbar_schedule + busbar_progress */}
                  {(()=>{
                    // Kumpulkan komponen busbar dari raw_schedule busbar_schedule
                    const scheduled=(rawData||[])
                      .filter((r:any)=>r.proses==="BUSBAR"&&Number(r.panel_id||r.panelId)===Number(p.id))
                      .flatMap((r:any)=>Object.values(r.busbar_schedule||{}).flat() as string[]);
                    const fromProgress=Object.keys(p.busbar_progress||{});
                    const busbarKomps=[...new Set([...scheduled,...fromProgress])];
                    if(!busbarKomps.length) return null;
                    const busbarData=Object.fromEntries(busbarKomps.map((k:string)=>
                      [k,(p.busbar_progress||{})[k]||0]
                    ));
                    return(
                    <>
                      <tr>
                        <td colSpan={4+prosesPanel.length} style={{background:"#06b6d418",padding:"4px 10px",
                          borderBottom:"1px solid #e2e8f0",borderTop:"2px solid #06b6d4"}}>
                          <span style={{fontWeight:700,fontSize:10,color:"#06b6d4",
                            textTransform:"uppercase" as const,letterSpacing:.5}}>
                            🔌 Komponen Busbar
                          </span>
                        </td>
                      </tr>
                      {Object.entries(busbarData).map(([nama,pct]:any)=>(
                        <tr key={"busbar-"+nama}>
                          <td style={{...tdS,background:"#f0fdfe"}}></td>
                          <td style={{...tdSL,background:"#f0fdfe",color:"#0e7490",fontWeight:600}}>{nama}</td>
                          <td style={{...tdS,background:"#f0fdfe",color:"#94a3b8",fontSize:9}}>BUSBAR</td>
                          <td style={{...tdS,background:"#f0fdfe"}}>—</td>
                          {prosesPanel.map(pr=>{
                            if(pr!=="BUSBAR") return <td key={pr} style={{...tdS,background:"#f0fdfe",color:"#e2e8f0",fontSize:9}}>—</td>;
                            const isDone=pct>=100;
                            const color=PROSES_COLOR["BUSBAR"]||"#06b6d4";
                            return(
                              <td key={pr} style={{...tdS,background:"#f0fdfe"}} className="hist-cell">
                                <div style={{display:"flex",flexDirection:"column" as const,alignItems:"center",gap:2,position:"relative" as const}}>
                                  <div style={{width:44,height:3,background:"#e2e8f0",borderRadius:99,overflow:"hidden"}}>
                                    <div style={{width:pct+"%",height:"100%",background:isDone?"#16a34a":color,borderRadius:99}}/>
                                  </div>
                                  <span style={{fontSize:9,fontWeight:700,color:isDone?"#16a34a":pct>0?color:"#94a3b8"}}>{pct}%</span>
                                  {pct>0&&(
                                    <div className="hist-tooltip" style={{
                                      opacity:0,visibility:"hidden" as const,
                                      position:"absolute" as const,bottom:"100%",left:"50%",
                                      transform:"translateX(-50%)",
                                      background:"#1e293b",color:"#f1f5f9",
                                      borderRadius:8,padding:"8px 12px",
                                      fontSize:10,whiteSpace:"nowrap" as const,
                                      zIndex:999,marginBottom:6,
                                      boxShadow:"0 4px 16px #00000030",
                                      minWidth:140,
                                    }}>
                                      <div style={{fontWeight:700,color:color,marginBottom:4,borderBottom:"1px solid #334155",paddingBottom:3}}>
                                        {nama}
                                      </div>
                                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                                        <span style={{color:"#94a3b8"}}>Progress</span>
                                        <span style={{color:isDone?"#4ade80":"#fb923c",fontWeight:700}}>{pct}%</span>
                                      </div>
                                      <div style={{position:"absolute" as const,bottom:-5,left:"50%",transform:"translateX(-50%)",width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:"5px solid #1e293b"}}/>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,refetchRenhar,logActivity,logAct,log,user}){
  const [weekStart,setWeekStart]=useState(TODAY);
  const [selectedCells,setSelectedCells]=useState<{rawId:number,date:string}[]>([]);
  const [copiedCells,setCopiedCells]=useState<{rawId:number,date:string,entries:any[],busbar:string[]}[]>([]);
  const [lastSelected,setLastSelected]=useState<{rawId:number,date:string}|null>(null);
  const [ctxMenu,setCtxMenu]=useState<{x:number,y:number,rawId:number,date:string}|null>(null);
  const [cellModal,setCellModal]=useState(null);
  const [dragInfo,setDragInfo]=useState(null);
  const [dragOverCell,setDragOverCell]=useState(null);
  const [dragMode,setDragMode]=useState(null);
  const [addModal,setAddModal]=useState(false);
  const [selDate,setSelDate]=useState(null);
  const [addForm,setAddForm]=useState({woId:"",panelId:"",prioritas:"Sedang"});
  const [modalWp,setModalWp]=useState("");
  const [modalKomponen,setModalKomponen]=useState([]);
  const [modalOrangPerKomponen,setModalOrangPerKomponen]=useState<Record<string,number>>({});
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

  const getSemuaKomponenSebagaiSubBaris=(row:any):any[]|null=>{
    if(!PROSES_ORANG_RAW.includes(row.proses))return null;
    const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(row.panel_id||row.panelId));
    const semuaKomponen:any[]=[];
    for(const[tglKey,entries] of Object.entries(row.schedule||{}) as [string,any[]][]){
      for(const entry of entries){
        for(const kode of entry.komponen||[]){
          const sudahAda=semuaKomponen.some(k=>k.wp===entry.wp&&k.kode===kode);
          if(sudahAda)continue;
          const rentang=entry.rentangTanggal?.[kode];
          const jmlOrang=entry.orangPerKomponen?.[kode]||1;
          const progress=panelData?.checklist?.[kode]?.progress?.[row.proses]||0;
          const terlambat=rentang?.selesai&&TODAY>rentang.selesai&&progress<100;
          semuaKomponen.push({wp:entry.wp,kode,mulai:rentang?.mulai||tglKey,selesai:rentang?.selesai||tglKey,jumlahOrang:jmlOrang,progress,terlambat});
        }
      }
    }
    if(semuaKomponen.length===0)return null;
    semuaKomponen.sort((a,b)=>a.mulai.localeCompare(b.mulai)||a.wp.localeCompare(b.wp));
    return semuaKomponen;
  };

  const getRentangInfoUntukTanggal=(row:any,tanggal:string)=>{
    if(!PROSES_ORANG_RAW.includes(row.proses))return null;
    // Cari SEMUA komponen (lintas WP) yang rentangnya mencakup tanggal ini
    const semuaKomponenAktif:any[]=[];
    for(const entries of Object.values(row.schedule||{}) as any[]){
      for(const entry of entries){
        if(!entry.rentangTanggal)continue;
        for(const kode of entry.komponen||[]){
          const rentang=entry.rentangTanggal[kode];
          if(!rentang)continue;
          if(tanggal>=rentang.mulai&&tanggal<=rentang.selesai){
            semuaKomponenAktif.push({wp:entry.wp,kode,mulai:rentang.mulai,selesai:rentang.selesai});
          }
        }
      }
    }
    if(semuaKomponenAktif.length===0)return null;
    // Union: cari mulai paling awal dan selesai paling akhir dari SEMUA komponen yg overlap di tanggal ini
    const unionMulai=semuaKomponenAktif.reduce((min,k)=>k.mulai<min?k.mulai:min,semuaKomponenAktif[0].mulai);
    const unionSelesai=semuaKomponenAktif.reduce((max,k)=>k.selesai>max?k.selesai:max,semuaKomponenAktif[0].selesai);
    return{mulai:unionMulai,selesai:unionSelesai,isStart:tanggal===unionMulai,komponenList:semuaKomponenAktif};
  };
  const [filterProses,setFilterProses]=useState<string[]>([]);
  const toggleFilterProses=(pr:string)=>{
    setFilterProses(prev=>prev.includes(pr)?prev.filter(p=>p!==pr):[...prev,pr]);
  };
  const [filterProyek,setFilterProyek]=useState("ALL");
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);
  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<string[]>([]);
  const [swapLoading,setSwapLoading]=useState(false);
  const [swapOrangModal,setSwapOrangModal]=useState<any>(null);
  const [swapOrangSelected,setSwapOrangSelected]=useState<string[]>([]);
  const [swapOrangLoading,setSwapOrangLoading]=useState(false);
  const [lemburLoading,setLemburLoading]=useState(false);
  const [processTimeList,setProcessTimeList]=useState<any[]>([]);
  const [notifAvailable,setNotifAvailable]=useState<any[]>([]);

  const fetchNotifAvailable=async()=>{
    const{data}=await supabase.from("fcs_notifikasi").select("*").eq("dibaca",false).eq("tipe","available").order("created_at",{ascending:false});
    setNotifAvailable(data??[]);
  };

  const tandaiNotifDibaca=async(id:number)=>{
    await supabase.from("fcs_notifikasi").update({dibaca:true}).eq("id",id);
    setNotifAvailable(prev=>prev.filter((n:any)=>n.id!==id));
  };

  const [pilihKomponenModal,setPilihKomponenModal]=useState<any>(null);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k},{data:pt}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit"),
        supabase.from("fcs_process_time").select("tipe_panel,jenis_pekerjaan,kode_komponen,menit_per_pcs").eq("is_active",true),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
      setProcessTimeList(pt??[]);
    };
    fetchCap();
    fetchNotifAvailable();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fcs_notifikasi"},fetchNotifAvailable)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getNamaKomponenDariKode=(panelId:number,kode:string):string=>{
    const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
    const tipe=panelData?.tipe;
    if(!tipe)return kode;
    const item=(PANEL_TYPES as any)[tipe]?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
    return item?.nama||kode;
  };

  const getKomponenBelumDikerjakan=(proses:string):any[]=>{
    const hasil:any[]=[];
    rawData.filter((row:any)=>row.proses===proses).forEach((row:any)=>{
      const panelId=row.panel_id||row.panelId;
      const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
      if(!panelData)return;
      const sudahDitambah=new Set<string>();
      Object.values(row.schedule||{}).forEach((entries:any)=>{
        entries.forEach((entry:any)=>{
          (entry.komponen||[]).forEach((kode:string)=>{
            if(sudahDitambah.has(kode))return;
            const progress=panelData.checklist?.[kode]?.progress?.[proses]||0;
            if(progress>0)return;
            const cfg=(PANEL_TYPES as any)[panelData.tipe];
            const item=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode);
            if(!item)return;
            sudahDitambah.add(kode);
            hasil.push({rawId:row.id,panelId,panel:row.panel,proyek:row.proyek,kode,nama:item.nama,wp:entry.wp});
          });
        });
      });
    });
    return hasil;
  };

  const getMenitPerPcs=(tipePanel:string,proses:string,kode:string):number=>{
    const pt=processTimeList.find((p:any)=>p.tipe_panel===tipePanel&&p.jenis_pekerjaan===proses&&p.kode_komponen===kode);
    return pt?Number(pt.menit_per_pcs):0;
  };

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

  const onDragStart=(e,rawId,fromDate,entries)=>{
    e.dataTransfer.effectAllowed="move";
    setDragInfo({rawId,fromDate,entries});
  };

  const onDragOver=(e,rawId,date)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOverCell({rawId,date});
  };

  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    setDragOverCell(null);
    if(!dragInfo)return;
    if(dragInfo.rawId!==rawId){setDragInfo(null);return;}
    if(dragInfo.fromDate===toDate){setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});
    setDragInfo(null);
  };

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const [busbarSel,setBusbarSel]=useState<string[]>([]);

  // Keyboard handler Ctrl+C / Ctrl+V / Esc / Delete
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){
        if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,lastSelected,rawData,woData]);
  // ── COPY PASTE FUNCTIONS ──
  const handleCellClick=(rawId:number,date:string,e:React.MouseEvent)=>{
    setCtxMenu(null);
    if(e.shiftKey&&lastSelected){
      // Select range - hanya di row yang sama (seperti spreadsheet horizontal)
      const allDays=days;
      const startDayIdx=allDays.indexOf(lastSelected.date);
      const endDayIdx=allDays.indexOf(date);
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
          newSelected.push({rawId:rows[r].id,date:allDays[d]});
        }
      }
      setSelectedCells(newSelected);
    } else if(e.altKey){
      // Alt+klik = toggle individual cell (multi select tidak berurutan)
      setSelectedCells(prev=>{
        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});
    } else {
      // Klik biasa tanpa modifier
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
  };

  const pasteToCell=async(targetRawId:number,targetDate:string)=>{
    if(!copiedCells.length)return;
    const allDays=days;
    const targetDayIdx=allDays.indexOf(targetDate);
    if(targetDayIdx===-1)return;
    const targetRowIdx=rawData.findIndex(r=>r.id===targetRawId);
    const srcRowIds=[...new Set(copiedCells.map((c:any)=>c.rawId))];
    const minSrcDayIdx=Math.min(...copiedCells.map((c:any)=>allDays.indexOf(c.date)));
    const minSrcRowIdx=Math.min(...srcRowIds.map((id:any)=>rawData.findIndex(r=>r.id===id)));
    const batchUpdates:Record<number,any>={};
    for(const cell of copiedCells){
      const srcDayIdx=allDays.indexOf(cell.date);
      const srcRowIdx=rawData.findIndex(r=>r.id===cell.rawId);
      const dayOffset=srcDayIdx-minSrcDayIdx;
      const rowOffset=srcRowIdx-minSrcRowIdx;
      const destDayIdx=targetDayIdx+dayOffset;
      const destRowIdx=targetRowIdx+rowOffset;
      if(destDayIdx<0||destDayIdx>=allDays.length)continue;
      if(destRowIdx<0||destRowIdx>=rawData.length)continue;
      const destDate=allDays[destDayIdx];
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
      setRawData((prev:any[])=>prev.map(r=>r.id===id?{...r,...data}:r));
      await updateRaw(id,data);
    }
    setSelectedCells([]);
    setCopiedCells([]);
  };

  const openCellModal=(rawId,date)=>{
    setCellModal({rawId,date});
    setModalWp("");
    setModalKomponen([]);
    // Load existing busbar selections
    const row=rawData.find(r=>r.id===rawId);
    setBusbarSel(row?.busbar_schedule?.[date]||[]);
  };
  const rawRow=cellModal?rawData.find(r=>r.id===cellModal.rawId):null;
  const cellEntries=rawRow?.schedule?.[cellModal?.date]||[];
  const livePanelForCell=rawRow?woData.flatMap(w=>w.panels||[]).find(p=>Number(p.id)===Number(rawRow.panel_id||rawRow.panelId)):null;
  const panelCfg=livePanelForCell?PANEL_TYPES[livePanelForCell.tipe]:null;
  const wpItemsAll=panelCfg?.wps.find(w=>w.wp===modalWp)?.items||[];
  const komponenSudahAda=cellEntries.find(e=>e.wp===modalWp)?.komponen||[];
  const wpItems=wpItemsAll.filter(it=>isKomponenRelevant(it.kode,rawRow?.proses||"")&&!komponenSudahAda.includes(it.kode));

  const syncRenharKomp=async(rawId,date,wp,newKomp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await updateRenhar(existing.id,{komponen:newKomp});
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKomp}:r));
    }
  };
  const syncRenharDel=async(rawId,date,wp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await removeRenhar(existing.id);
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
    }
  };

  const addEntry=async()=>{
    if(!modalWp||!modalKomponen.length)return;

    const tipePanelCek=livePanelForCell?.tipe;
    const prosesCek=rawRow?.proses;

    // Validasi kuota ORANG (khusus WIRING POWER/CONTROL)
    if(prosesCek&&PROSES_ORANG_RAW.includes(prosesCek)){
      const orangDibutuhkan=modalKomponen.reduce((s,k)=>s+(modalOrangPerKomponen[k]||1),0);
      const cekOrang=await checkKuotaOrangDanKomponenSwap({
        tanggal:cellModal.date,
        jenisPekerjaan:prosesCek,
        orangDibutuhkan,
        excludeRawId:cellModal.rawId,
        excludeWp:modalWp,
      });
      if(!cekOrang.cukup){
        if(cekOrang.kuotaHari===0&&cekOrang.opsiSwap.length===0){
          alert("Kuota orang "+prosesCek+" tanggal ini belum diatur sama sekali.\n"+(cekOrang.error||"Silakan atur Override Tanggal dulu."));
          return;
        }
        setSwapOrangModal({tanggal:cellModal.date,proses:prosesCek,orangDibutuhkan,...cekOrang});
        setSwapOrangSelected([]);
        return;
      }
    }

    // Validasi kapasitas MENIT (proses lain selain wiring, hanya jika data FCS process time tersedia)
    if(tipePanelCek&&prosesCek&&prosesCek!=="BUSBAR"&&!PROSES_ORANG_RAW.includes(prosesCek)){
      let menitDibutuhkan=0;
      let adaDataProcessTime=false;
      for(const kode of modalKomponen){
        const qty=livePanelForCell?.checklist?.[kode]?.qty||0;
        const menitPcs=getMenitPerPcs(tipePanelCek,prosesCek,kode);
        if(menitPcs>0)adaDataProcessTime=true;
        menitDibutuhkan+=qty*menitPcs;
      }
      if(adaDataProcessTime&&menitDibutuhkan>0){
        const cek=await checkKapasitasDanKomponenSwapV2({
          tanggal:cellModal.date,
          jenisPekerjaan:prosesCek,
          menitDibutuhkan,
          excludeRawId:cellModal.rawId,
          excludeWp:modalWp,
        });
        if(!cek.cukup){
          if(cek.opsiSwap.length>0){
            setSwapModal({tanggal:cellModal.date,proses:prosesCek,menitDibutuhkan,...cek});
            setSwapSelected([]);
            return;
          } else {
            alert("Kapasitas "+prosesCek+" tanggal ini sudah penuh dan tidak ada komponen lain yang bisa dipindah.\n"+(cek.error||""));
            return;
          }
        }
      }
    }

    let finalKomp=modalKomponen;
    let updatedRow=null;
    let oldKomp:string[]=[];
    let isEdit=false;
    const isProsesOrangRow=prosesCek&&PROSES_ORANG_RAW.includes(prosesCek);
    setRawData(prev=>prev.map(r=>{
      if(r.id!==cellModal.rawId)return r;
      const newSch={...r.schedule};
      const existing=newSch[cellModal.date]||[];
      const wpEntry=existing.find(e=>e.wp===modalWp);
      let updated;
      if(wpEntry){
        oldKomp=wpEntry.komponen;isEdit=true;
        if(isProsesOrangRow){
          const komponenLamaBelumSelesai=(wpEntry.komponen||[]).filter((kode:string)=>{
            const progress=livePanelForCell?.checklist?.[kode]?.progress?.[prosesCek||""]||0;
            return progress<100;
          });
          finalKomp=[...new Set([...komponenLamaBelumSelesai,...modalKomponen])];
        } else {
          finalKomp=[...new Set([...wpEntry.komponen,...modalKomponen])];
        }
        const newOrangMap=isProsesOrangRow?{...(wpEntry.orangPerKomponen||{}),...modalOrangPerKomponen}:wpEntry.orangPerKomponen;
        updated=existing.map(e=>e.wp!==modalWp?e:{...e,komponen:finalKomp,...(isProsesOrangRow?{orangPerKomponen:newOrangMap}:{})});
      }
      else{
        updated=[...existing,{wp:modalWp,komponen:modalKomponen,...(isProsesOrangRow?{orangPerKomponen:modalOrangPerKomponen}:{})}];
      }
      newSch[cellModal.date]=updated;
      updatedRow={...r,schedule:newSch};
      return updatedRow;
    }));
    syncRenharKomp(cellModal.rawId,cellModal.date,modalWp,finalKomp);
    setModalWp('');setModalKomponen([]);setModalOrangPerKomponen({});
    const isBusbarRow=rawRow?.proses==="BUSBAR";
    if(updatedRow){
      const updatePayload:any={schedule:updatedRow.schedule,updated_by:user?.name||user?.nama||'Admin'};
      if(isBusbarRow&&busbarSel!==undefined){
        const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
        updatePayload.busbar_schedule=newBusbarSch;
        // Update local state dengan busbar_schedule
        setRawData(prev=>prev.map(r=>{
          if(r.id!==cellModal.rawId)return r;
          return{...r,schedule:updatedRow.schedule,busbar_schedule:newBusbarSch};
        }));
      }
      await updateRaw(cellModal.rawId,updatePayload);
    }
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');const uname=user?.name||user?.nama||sess?.nama||sess?.name||'Admin';
    const getName=(k:string)=>panelCfg?.wps.flatMap(w=>w.items).find(it=>it.kode===k)?.nama||k;
    if(isEdit){
      const added=modalKomponen.filter(k=>!oldKomp.includes(k)).map(getName);
      const removed=oldKomp.filter(k=>!modalKomponen.includes(k)).map(getName);
      const parts=[];
      if(added.length) parts.push('Tambah: '+added.join(', '));
      if(removed.length) parts.push('Hapus: '+removed.join(', '));
      const desc=parts.length?parts.join(' | '):'Tidak ada perubahan';
      await activityLogService.insert({user_name:uname,action:'EDIT WP RAW SCHEDULE',description:'Edit '+modalWp+' '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+'): '+desc,module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    } else {
      const kompNames=finalKomp.map(getName).join(', ');
      await activityLogService.insert({user_name:uname,action:'TAMBAH WP RAW SCHEDULE',description:'Tambah '+modalWp+' ('+kompNames+') ke jadwal '+rawRow?.panel+' - '+rawRow?.proyek+' ('+cellModal?.date+')',module:'raw',halaman:'Raw Schedule',proyek:rawRow?.proyek||'',panel:rawRow?.panel||''});
    }
  };
  const removeEntry=async(wp)=>{
    // Hitung new schedule dulu sebelum update state
    const currentRow=rawData.find(r=>r.id===cellModal.rawId);
    if(!currentRow)return;
    const newSch={...currentRow.schedule};
    const updated=(newSch[cellModal.date]||[]).filter((e:any)=>e.wp!==wp);
    if(!updated.length) delete newSch[cellModal.date]; else newSch[cellModal.date]=updated;
    const updatedRow={...currentRow,schedule:newSch};
    // Update state dan Supabase
    setRawData(prev=>prev.map(r=>r.id===cellModal.rawId?updatedRow:r));
    await updateRaw(cellModal.rawId,{schedule:newSch});
    syncRenharDel(cellModal.rawId,cellModal.date,wp);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS WP RAW SCHEDULE",description:"Hapus "+wp+" dari jadwal "+rawRow?.panel+" - "+rawRow?.proyek+" ("+cellModal?.date+")",module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""});
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
    // Activity log drag & drop
    const row=rawData.find(r=>r.id===rawId);
    const wpList=entries.map(e=>e.wp).join(", ");
    const kompList=entries.flatMap(e=>e.komponen||[]).join(", ");
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,
      action:mode==="move"?"PINDAH JADWAL":"COPY JADWAL",
      description:(mode==="move"?"Pindah":"Copy")+" jadwal "+row?.panel+" ("+row?.proyek+") proses "+row?.proses+" WP: "+wpList+" dari "+fromDate+" ke "+toDate,
      module:"raw",
      halaman:"Raw Schedule",
      proyek:row?.proyek||"",
      panel:row?.panel||"",
    });
  };

  const updatePrioritasPanel=async(panelId,val)=>{
    const toUpdate=rawData.filter(r=>(r.panel_id||r.panelId)===panelId);
    setRawData(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    setRenhar(prev=>prev.map(r=>(r.panel_id||r.panelId)!==panelId?r:{...r,prioritas:val}));
    for(const r of toUpdate){ await updateRaw(r.id,{prioritas:val}); }
  };

  const panelOpts=addForm.woId?(woData.find(w=>w.id===Number(addForm.woId))?.panels||[]).filter((p:any)=>{
    const sudahPunyaRaw=rawData.some((r:any)=>(r.panel_id||r.panelId)===p.id);
    const sudahSyncFCS=(p.synced_proses||[]).length>0;
    return sudahSyncFCS&&!sudahPunyaRaw;
  }):[]; 
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
    if(log) await log("TAMBAH RAW SCHEDULE","Tambah Panel "+p.nama+" ke Raw Schedule","raw_schedule",{module:"raw",action_type:"create",proyek:wo.proyek||"",panel:p.nama||"",wo_number:wo.wo||"",halaman:"Raw Schedule"});
    setAddModal(false);setAddForm({woId:"",panelId:"",prioritas:"Sedang"});
  };

  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    const tasks:any[]=[];
    rawData.forEach(r=>{
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
    if(log) await log("DISTRIBUSI RAW SCHEDULE","Distribusi "+task.proses+" - "+task.panel+" ("+task.tanggal+")","renhar",{module:"rencana",action_type:"distribute",proyek:task.proyek||"",panel:task.panel||"",wo_number:task.woId?.toString()||"",halaman:"Raw Schedule"});
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

  const thS={background:"#1e2330",color:"#c8d0e8",padding:"3px 6px",fontWeight:600,fontSize:9,whiteSpace:"nowrap",letterSpacing:.3,textAlign:"center" as "center",borderRight:"1px solid #2d3348",position:"sticky" as "sticky",top:0,zIndex:3,textTransform:"uppercase" as "uppercase"};

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
        <button onClick={()=>setFilterProses([])} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${filterProses.length===0?"#1d4ed8":"#e2e8f0"}`,background:filterProses.length===0?"#1d4ed8":"#fff",color:filterProses.length===0?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua</button>
        {ALL_PROSES.map(pr=>{const pc=PROSES_COLOR[pr]||"#64748b";const isSel=filterProses.includes(pr);return(<button key={pr} onClick={()=>toggleFilterProses(pr)} style={{padding:"3px 12px",borderRadius:20,border:`1.5px solid ${isSel?pc:"#e2e8f0"}`,background:isSel?pc+"18":"#fff",color:isSel?pc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{pr}</button>);})}
      </div>

      {pilihKomponenModal&&(
        <Modal title="Pilih Komponen Lain yang Bisa Diambil" onClose={()=>setPilihKomponenModal(null)} width={520}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:12}}>
            Daftar komponen {pilihKomponenModal.proses} yang belum pernah dijadwalkan. Klik salah satu untuk lompat ke baris itu dan tambahkan ke hari ini.
          </div>
          {(()=>{
            const daftarKomponen=getKomponenBelumDikerjakan(pilihKomponenModal.proses);
            if(daftarKomponen.length===0){
              return(<div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:12}}>Semua komponen sudah terjadwal</div>);
            }
            return(
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:340,overflowY:"auto" as const}}>
                {daftarKomponen.map((k:any,ki:number)=>(
                  <button key={ki} onClick={async()=>{
                      await tandaiNotifDibaca(pilihKomponenModal.notifId);
                      setPilihKomponenModal(null);
                      openCellModal(k.rawId,TODAY);
                      setModalWp(k.wp);
                      const rowTarget=rawData.find((r:any)=>r.id===k.rawId);
                      const existingEntry=(rowTarget?.schedule?.[TODAY]||[]).find((e:any)=>e.wp===k.wp);
                      const panelDataTarget=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(k.panelId));
                      const komponenLamaBelumSelesai=(existingEntry?.komponen||[]).filter((kd:string)=>{
                        const progress=panelDataTarget?.checklist?.[kd]?.progress?.[pilihKomponenModal.proses]||0;
                        return progress<100;
                      });
                      setModalKomponen([...new Set([...komponenLamaBelumSelesai,k.kode])]);
                      setModalOrangPerKomponen((prev:any)=>({...prev,[k.kode]:prev[k.kode]||1}));
                    }}
                    style={{textAlign:"left" as const,display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:"#fff"}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:"#1e293b"}}>{k.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({k.kode})</span></div>
                      <div style={{fontSize:10,color:"#64748b"}}>{k.panel} · {k.proyek}</div>
                    </div>
                    <i className="ti ti-arrow-right" style={{fontSize:14,color:"#1d4ed8"}}/>
                  </button>
                ))}
              </div>
            );
          })()}
        </Modal>
      )}

      {notifAvailable.length>0&&(
        <div style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            💡 Operator Selesai Lebih Cepat ({notifAvailable.length})
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
            {notifAvailable.map((n:any)=>(
              <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,background:"#fff",borderRadius:8,padding:"10px 12px",border:"1px solid #dbeafe"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:"#1e293b"}}>
                    <strong>{n.pekerja_nama}</strong> selesai <strong>{n.nama_komponen}</strong> ({n.panel_nama}) lebih cepat
                  </div>
                  <div style={{fontSize:10,color:"#64748b",marginTop:2}}>
                    Rencana selesai {fmtDate(n.tanggal_rencana_selesai)}, aktual {fmtDate(n.tanggal_aktual_selesai)}. Ada komponen lain yang bisa diambil.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column" as const,gap:4}}>
                  <button onClick={()=>setPilihKomponenModal({notifId:n.id,proses:n.proses})}
                    style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:10,color:"#fff",fontWeight:700,whiteSpace:"nowrap" as const}}>Pilih Komponen</button>
                  <button onClick={()=>tandaiNotifDibaca(n.id)}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:10,color:"#64748b",whiteSpace:"nowrap" as const}}>Tandai dibaca</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fcsKapasitas.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            ⚡ Capacity Utilization {filterProses.length>0?"— "+filterProses.join(", "):"(semua proses)"} <span style={{fontWeight:400,fontSize:9,color:"#94a3b8"}}>(dari Raw Schedule)</span>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {days.map(d=>{
              const prosesToShow=filterProses.length===0?ALL_PROSES:filterProses;
              let terpakaiTotal=0;let kapasitasTotal=0;let adaOverrideCount=0;
              prosesToShow.forEach((pr:string)=>{
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                if(ov){adaOverrideCount++;kapasitasTotal+=Number(ov.kapasitas_menit);}
                rawData.filter((r:any)=>r.proses===pr).forEach((r:any)=>{
                  const panelId=r.panel_id||r.panelId;
                  const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
                  if(!panelData)return;
                  const entries=r.schedule?.[d]||[];
                  entries.forEach((e:any)=>{
                    (e.komponen||[]).forEach((kode:string)=>{
                      const qty=panelData.checklist?.[kode]?.qty||0;
                      const menitPcs=getMenitPerPcs(panelData.tipe,pr,kode);
                      terpakaiTotal+=qty*menitPcs;
                    });
                  });
                });
              });
              const adaOverride=adaOverrideCount>0;
              const pct=kapasitasTotal>0?Math.min(Math.round((terpakaiTotal/kapasitasTotal)*100),100):0;
              const color=!adaOverride?"#94a3b8":pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=!adaOverride?"#f8fafc":pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={d} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  {!adaOverride?(
                    <div style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4}}>⚠ Belum diatur</div>
                  ):(
                    <>
                      <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>{Math.round(terpakaiTotal)}/{kapasitasTotal} mnt</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 120px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>
          <thead style={{position:"sticky",top:0,zIndex:10}}>
            <tr>
              <th style={{...thS,textAlign:"left",minWidth:80,position:"sticky",left:0,zIndex:5,background:"#1e2330"}}>PROYEK</th>
              <th style={{...thS,textAlign:"left",minWidth:150,position:"sticky",left:80,zIndex:5,background:"#1e2330"}}>PANEL</th>
              <th style={{...thS,minWidth:110,position:"sticky",left:230,zIndex:5,background:"#1e2330"}}>PROSES</th>
              <th style={{...thS,minWidth:90,position:"sticky",left:340,zIndex:5,background:"#1e2330"}}>PRIORITAS</th>
              {days.map(d=>(
                <th key={d} onClick={()=>setSelDate(d===selDate?null:d)}
                  style={{...thS,minWidth:120,cursor:"pointer",background:d===TODAY?"#1e40af":isSunday(d)?"#7f1d1d":selDate===d?"#1d4ed8":"#1e3a8a",borderBottom:d===TODAY?"2px solid #60a5fa":selDate===d?"2px solid #93c5fd":"none"}}>
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
                (filterProses.length===0||filterProses.includes(row.proses))&&
                (filterProyek==="ALL"||row.proyek===filterProyek)&&
                (filterPanel==="ALL"||row.panel===filterPanel)
              ).sort((a,b)=>{
                const pa=PRIO_ORDER[a.prioritas]??1;const pb=PRIO_ORDER[b.prioritas]??1;
                if(pa!==pb)return pa-pb;
                const aId=a.panel_id||a.panelId;const bId=b.panel_id||b.panelId;
                if(aId!==bId)return aId-bId;
                return 0;
              });
              const panelRowCount:Record<string,number>={};
              visibleRows.forEach(row=>{
                const pid=String(row.panel_id||row.panelId);
                panelRowCount[pid]=(panelRowCount[pid]||0)+1;
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
                const td={borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,padding:"2px 4px",verticalAlign:"middle",borderTop:panelTopBorder};
                const rowSpanCount=panelRowCount[String(curPanelId)]||1;
                const subBarisKomponen=getSemuaKomponenSebagaiSubBaris(row);

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
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap" as const}}>{row.proses}</span>
                            </td>
                          )}
                          {ki===0&&(
                            <td rowSpan={subBarisKomponen.length} style={{...td,position:"sticky",left:340,zIndex:2,textAlign:"center" as const,background:"#fff",verticalAlign:"top",paddingTop:8}}>
                              <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                                style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                              </select>
                            </td>
                          )}
                          {days.map(d=>renderKotakWiring(komp,d,row.id,row.panel_id||row.panelId))}
                          <td style={{...td,textAlign:"center" as const,position:"sticky",right:0,zIndex:2,background:"#fff"}}>
                            {ki===0&&(
                              <button onClick={async()=>{const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";await removeRaw(row.id);await activityLogService.insert({user_name:uname,action:"HAPUS RAW SCHEDULE",description:"Hapus proses "+row.proses+" - "+row.panel+" ("+row.proyek+")",module:"raw",halaman:"Raw Schedule",proyek:row.proyek||"",panel:row.panel||""});setRawData(prev=>prev.filter(r=>r.id!==row.id));}} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:14}}>🗑</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                }

                return(
                  <tr key={row.id}>
                    {isNewPanel&&(
                      <>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:9,color:"#475569",background:"#fff",minWidth:80,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textAlign:"center" as const,verticalAlign:"middle"}}>{row.proyek}</td>
                        <td rowSpan={rowSpanCount} style={{...td,position:"sticky",left:80,zIndex:2,fontWeight:600,fontSize:9,color:"#1e293b",background:"#fff",minWidth:150,maxWidth:150,wordBreak:"break-word",whiteSpace:"normal",lineHeight:1.3,textAlign:"center" as const,verticalAlign:"middle"}}>{row.panel}</td>
                      </>
                    )}
                    <td style={{...td,position:"sticky",left:230,zIndex:2,textAlign:"center",background:rBg}}>
                      <span style={{background:pc+"18",color:pc,border:`1px solid ${pc}33`,borderRadius:4,padding:"1px 5px",fontWeight:700,fontSize:9,whiteSpace:"nowrap"}}>{row.proses}</span>
                    </td>
                    <td style={{...td,position:"sticky",left:340,zIndex:2,textAlign:"center",background:rBg}}>
                      <select value={row.prioritas||"Sedang"} onChange={e=>updatePrioritasPanel(row.panel_id||row.panelId,e.target.value)}
                        style={{padding:"1px 4px",borderRadius:4,border:`1px solid ${priColor}`,background:priColor+"18",color:priColor,fontSize:9,fontWeight:700,cursor:"pointer"}}>
                        {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    {days.map(d=>{
                      const rentangInfo=getRentangInfoUntukTanggal(row,d);
                      if(rentangInfo&&!rentangInfo.isStart)return null;
                      let colSpanCount=1;
                      if(rentangInfo&&rentangInfo.isStart){
                        colSpanCount=days.filter(dd=>dd>=rentangInfo.mulai&&dd<=rentangInfo.selesai).length;
                      }
                      const entries=row.schedule?.[d]||[];
                      const busbarEntries:string[]=row.busbar_schedule?.[d]||[];
                      const isOver=dragOverCell?.rawId===row.id&&dragOverCell?.date===d;
                      const isSelDate=selDate===d;
                      const isDraggableEntry=!rentangInfo;
                      return(
                        <td key={d} colSpan={colSpanCount} onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}} style={{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rentangInfo?"#eff6ff":rBg,outline:isOver?"2px dashed #2563eb":copiedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px dashed #3b82f6":selectedCells.some((c:any)=>c.rawId===row.id&&c.date===d)?"2px solid #2563eb":"none",borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"}}
                          onDragOver={e=>onDragOver(e,row.id,d)}
                          onDrop={e=>onDrop(e,row.id,d)}
                          onDragLeave={()=>setDragOverCell(null)}>
                          {entries.length>0?(
                            PROSES_ORANG_RAW.includes(row.proses)?(
                              <div onClick={(e:any)=>{e.stopPropagation();handleCellClick(row.id,d,e);}}
                                onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                                draggable={true} onDragStart={e=>onDragStart(e,row.id,d,entries)}
                                style={{display:"flex",flexDirection:"column" as const,gap:3,padding:"4px 6px",borderRadius:6,cursor:"grab"}}>
                                {entries.map((entry:any)=>(entry.komponen||[]).map((kode:string)=>{
                                  const jmlOrang=entry.orangPerKomponen?.[kode]||1;
                                  const wc=WP_COLOR[entry.wp]||"#64748b";
                                  return(
                                    <div key={entry.wp+kode} style={{display:"inline-flex",alignItems:"center",gap:3,background:wc+"22",color:wc,border:`1px solid ${wc}44`,borderRadius:4,padding:"1px 5px",maxWidth:"100%"}}>
                                      <span style={{fontSize:8,fontWeight:700,whiteSpace:"nowrap" as const,overflow:"hidden",textOverflow:"ellipsis",maxWidth:55}}>{getNamaKomponenDariKode(row.panel_id||row.panelId,kode)}</span>
                                      <span style={{fontSize:7,display:"flex",alignItems:"center",gap:1}}><i className="ti ti-users" style={{fontSize:7}}/>{jmlOrang}</span>
                                    </div>
                                  );
                                }))}
                              </div>
                            ):(
                            <div draggable={isDraggableEntry} onDragStart={e=>{if(isDraggableEntry)onDragStart(e,row.id,d,entries);}}
                               onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                              style={{display:"flex",flexWrap:"wrap",gap:3,justifyContent:"center",cursor:isDraggableEntry?"grab":"pointer",padding:"3px",borderRadius:6,border:isSelDate?"1px solid #bfdbfe":"1px solid transparent"}}>
                              {entries.map(e=>{
                                const status=getTaskStatus(row,d,e.wp,e.komponen);
                                const statusStyle=status==="finish"?{background:"#16a34a",opacity:.9}:status==="on_progress"?{background:"#f59e0b"}:{background:PROSES_COLOR[row.proses]||"#64748b"};
                                const statusIcon=status==="finish"?"✓":status==="on_progress"?"●":"";
                                return(<div key={e.wp} style={{...statusStyle,color:"#fff",borderRadius:3,padding:"1px 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",gap:2}}>{statusIcon&&<span style={{fontSize:9}}>{statusIcon}</span>}{e.wp}<span style={{fontSize:9,opacity:.8,marginLeft:2}}>({e.komponen.length})</span></div>);
                              })}
                            </div>
                            )
                          ):(
                            <div onContextMenu={(e:any)=>handleContextMenu(row.id,d,e)}
                              style={{width:"100%",minHeight:32,borderRadius:6,cursor:"pointer",border:"1px dashed #e2e8f0",display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",color:"#e2e8f0",fontSize:16,transition:"all .15s",padding:"2px"}}
                              onMouseEnter={(e:any)=>{e.currentTarget.style.borderColor="#94a3b8";e.currentTarget.style.color="#94a3b8";}}
                              onMouseLeave={(e:any)=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.color="#e2e8f0";}}>
                              {row.proses==="BUSBAR"&&busbarEntries.length>0?(
                                <div style={{display:"flex",gap:2,flexWrap:"wrap" as const,justifyContent:"center"}}>
                                  {busbarEntries.map((b:string)=>(
                                    <span key={b} style={{background:(BUSBAR_COLORS[b]||"#64748b")+"22",
                                      color:BUSBAR_COLORS[b]||"#64748b",
                                      border:`1px solid ${BUSBAR_COLORS[b]||"#64748b"}44`,
                                      borderRadius:4,padding:"1px 4px",fontSize:8,fontWeight:700}}>
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              ):(
                                <span>+</span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td style={{...td,textAlign:"center",position:"sticky",right:0,zIndex:2}}>
                      <button onClick={async()=>{const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");const uname=user?.name||user?.nama||sess?.nama||"Admin";await removeRaw(row.id);await activityLogService.insert({user_name:uname,action:"HAPUS RAW SCHEDULE",description:"Hapus proses "+row.proses+" - "+row.panel+" ("+row.proyek+")",module:"raw",halaman:"Raw Schedule",proyek:row.proyek||"",panel:row.panel||""});setRawData(prev=>prev.filter(r=>r.id!==row.id));}} style={{background:"none",border:"none",cursor:"pointer",color:"#fca5a5",fontSize:14}}>🗑</button>
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
              const cfg2=panelData?PANEL_TYPES[panelData.tipe]:null;
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
                      <span style={{background:wc,color:'#fff',borderRadius:6,padding:'2px 10px',fontSize:12,fontWeight:700}}>{e.wp}</span>
                      <div style={{display:'flex',gap:6}}><button onClick={()=>{
                          setModalWp(e.wp);
                          const isWiringProses=PROSES_ORANG_RAW.includes(rawRow?.proses||"");
                          if(isWiringProses){
                            const belumSelesai=(e.komponen||[]).filter((kode:string)=>{
                              const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
                              return progress<100;
                            });
                            setModalKomponen(belumSelesai);
                          } else {
                            setModalKomponen([...e.komponen]);
                          }
                        }} style={{background:'#eff6ff',border:'1px solid #bfdbfe',cursor:'pointer',color:'#2563eb',fontSize:12,borderRadius:6,padding:'2px 10px',fontWeight:600}}>✏️ Edit</button><button onClick={()=>removeEntry(e.wp)} style={{background:'none',border:'none',cursor:'pointer',color:'#fca5a5',fontSize:13}}>✕ Hapus</button></div>
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
          {rawRow?.proses!=="BUSBAR"&&(<>
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
                {PROSES_ORANG_RAW.includes(rawRow?.proses||"")?(
                  <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);
                      const kl=livePanelForCell?.checklist?.[it.kode];
                      const progress=kl?.progress?.[rawRow?.proses||""]||0;
                      const sudahSelesai=progress>=100;
                      return(
                        <div key={it.kode} style={{border:`1px solid ${sudahSelesai?"#bbf7d0":sel?"#93c5fd":"#e2e8f0"}`,borderRadius:8,padding:"8px 12px",background:sudahSelesai?"#f0fdf4":sel?"#eff6ff":"#fff",opacity:sudahSelesai?0.7:1}}>
                          <label style={{display:"flex",alignItems:"center",gap:10,cursor:sudahSelesai?"not-allowed":"pointer"}}>
                            <input type="checkbox" checked={sel} disabled={sudahSelesai} onChange={()=>{
                              if(sudahSelesai)return;
                              if(sel){setModalKomponen(prev=>prev.filter(k=>k!==it.kode));}
                              else{
                                setModalKomponen(prev=>[...prev,it.kode]);
                                setModalOrangPerKomponen(prev=>({...prev,[it.kode]:prev[it.kode]||1}));
                              }
                            }}/>
                            <span style={{flex:1,fontSize:12,color:sudahSelesai?"#16a34a":"#1e293b"}}>{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></span>
                            <span style={{fontSize:10,color:sudahSelesai?"#16a34a":"#94a3b8",fontWeight:sudahSelesai?700:400}}>{sudahSelesai?"✓ Selesai":`progress ${progress}%`}</span>
                            {sel&&!sudahSelesai&&(
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <i className="ti ti-users" style={{fontSize:13,color:"#1d4ed8"}}/>
                                <input type="number" min="1" step="1" value={modalOrangPerKomponen[it.kode]||1}
                                  onChange={e=>setModalOrangPerKomponen(prev=>({...prev,[it.kode]:parseInt(e.target.value)||1}))}
                                  style={{width:48,textAlign:"center" as const,padding:"4px",borderRadius:6,border:"1px solid #93c5fd",fontSize:12}}/>
                              </div>
                            )}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                    {wpItems.map(it=>{
                      const sel=modalKomponen.includes(it.kode);const wc=WP_COLOR[modalWp]||"#64748b";
                      return(<button key={it.kode} onClick={()=>setModalKomponen(prev=>sel?prev.filter(k=>k!==it.kode):[...prev,it.kode])} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${sel?wc:"#e2e8f0"}`,background:sel?wc+"18":"#f8fafc",color:sel?wc:"#64748b",cursor:"pointer",fontSize:11,fontWeight:600}}>{sel?"✓ ":""}{it.nama}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({it.kode})</span></button>);
                    })}
                  </div>
                )}
                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>
                  {PROSES_ORANG_RAW.includes(rawRow?.proses||"")
                    ?"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen, "+modalKomponen.reduce((s,k)=>s+(modalOrangPerKomponen[k]||1),0)+" orang)"
                    :"+ Tambah "+modalWp+" ("+modalKomponen.length+" komponen)"}
                </Btn>
              </>
            )}
          </>)}
          </div>
          {/* Busbar Komponen Section */}
          {rawRow?.proses==="BUSBAR"&&(()=>{
            const busbarItems=getBusbarKomponen(livePanelForCell?.tipe||"FS");
            return(
              <div style={{marginTop:12,padding:"12px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>
                  🔌 Pilih Komponen Busbar:
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {busbarItems.map((b:string)=>{
                    const isSel=busbarSel.includes(b);
                    const bc=BUSBAR_COLORS[b]||"#64748b";
                    return(
                      <button key={b} onClick={()=>setBusbarSel((p:string[])=>isSel?p.filter((x:string)=>x!==b):[...p,b])}
                        style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700,
                          border:`1.5px solid ${isSel?bc:"#e2e8f0"}`,
                          background:isSel?bc+"18":"#fff",color:isSel?bc:"#64748b"}}>
                        {b}
                      </button>
                    );
                  })}
                </div>
                {busbarSel.length>0&&(
                  <div style={{marginTop:8,fontSize:11,color:"#64748b"}}>
                    Dipilih: <strong>{busbarSel.join(", ")}</strong>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}>
            <Btn color="#16a34a" onClick={async()=>{
              // Save busbar schedule saat klik Selesai
              if(rawRow?.proses==="BUSBAR"){
                const newBusbarSch={...(rawRow?.busbar_schedule||{}),[cellModal.date]:busbarSel};
                setRawData(prev=>prev.map(r=>{
                  if(r.id!==cellModal.rawId)return r;
                  return{...r,busbar_schedule:newBusbarSch};
                }));
                await updateRaw(cellModal.rawId,{busbar_schedule:newBusbarSch});
                const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
                const uname=user?.name||user?.nama||sess?.nama||'Admin';
                // Sync ke renhar
                if(busbarSel.length>0){
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  const renharPayload={
                    raw_id:cellModal.rawId,
                    wo_id:rawRow?.wo_id||rawRow?.woId,
                    panel_id:rawRow?.panel_id||rawRow?.panelId,
                    panel:rawRow?.panel,
                    proyek:rawRow?.proyek,
                    proses:rawRow?.proses,
                    wp:"BUSBAR",
                    komponen:busbarSel,
                    tanggal:cellModal.date,
                    divisi:"assembling",
                    prioritas:rawRow?.prioritas||"Sedang",
                  };
                  if(existRenhar){
                    await updateRenhar(existRenhar.id,{...renharPayload});
                    setRenhar((prev:any[])=>prev.map((r:any)=>r.id===existRenhar.id?{...r,...renharPayload}:r));
                  } else {
                    console.log('Creating renhar busbar:', renharPayload);
                    const res=await createRenhar(renharPayload);
                    console.log('Renhar result:', res);
                    if(res?.success&&res?.data) setRenhar((prev:any[])=>[...prev,res.data]);
                  }
                } else {
                  // Hapus renhar busbar jika kosong
                  const existRenhar=renhar.find((r:any)=>
                    (r.raw_id||r.rawId)===cellModal.rawId&&
                    r.tanggal===cellModal.date&&
                    r.wp==="BUSBAR"
                  );
                  if(existRenhar){
                    await removeRenhar(existRenhar.id);
                    setRenhar((prev:any[])=>prev.filter((r:any)=>r.id!==existRenhar.id));
                  }
                }
                await activityLogService.insert({
                  user_name:uname,
                  action:'JADWAL BUSBAR',
                  description:`Jadwal busbar ${rawRow?.panel} - ${rawRow?.proyek} (${cellModal?.date}): ${busbarSel.join(', ')||'kosong'}`,
                  module:'raw',halaman:'Raw Schedule',
                  proyek:rawRow?.proyek||'',panel:rawRow?.panel||''
                });
              }
              setCellModal(null);
            }}>Selesai</Btn>
          </div>
        </Modal>
      )}

      {swapModal&&(
        <Modal title={"Kapasitas Penuh — "+swapModal.tanggal} onClose={()=>{setSwapModal(null);setSwapSelected([]);}} width={540}>
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
            <span>⚠️</span>
            <span>Kapasitas {swapModal.proses} tanggal {fmtDate(swapModal.tanggal)} sudah penuh ({Math.round(swapModal.terpakaiSaatIni)}/{Math.round(swapModal.kapasitasHari)} menit). Komponen baru butuh {Math.round(swapModal.menitDibutuhkan)} menit. Pilih komponen di bawah untuk dipindah ke hari berikutnya.</span>
          </div>

          <Lbl>Komponen Terjadwal di {fmtDate(swapModal.tanggal)} (pilih untuk dipindah)</Lbl>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14,maxHeight:280,overflowY:"auto" as const}}>
            {swapModal.opsiSwap.map((o:any)=>{
              const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
              const checked=swapSelected.includes(swapKey);
              const hasProgress=o.progress>0;
              return(
                <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                  <input type="checkbox" checked={checked} style={{marginTop:2}}
                    onChange={()=>setSwapSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,color:"#1e293b"}}>{o.nama_komponen}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} · {o.panel_nama} · {o.qty} pcs · progress {o.progress}% · {Math.round(o.total_menit)} menit</div>
                  </div>
                  {hasProgress&&(
                    <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                  )}
                </label>
              );
            })}
          </div>

          {(()=>{
            const menitDipindah=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.total_menit),0);
            const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
            const cukupSetelahSwap=sisaSetelahSwap>=swapModal.menitDibutuhkan;
            return(
              <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>{cukupSetelahSwap?"Setelah pindah, kapasitas cukup":"Pilih komponen lagi, masih belum cukup"}</span>
                <span style={{fontWeight:700}}>{Math.round(swapModal.terpakaiSaatIni-menitDipindah+swapModal.menitDibutuhkan)}/{Math.round(swapModal.kapasitasHari)} menit</span>
              </div>
            );
          })()}

          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button onClick={()=>{setSwapModal(null);setSwapSelected([]);}}
              style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
            <button disabled={swapLoading||swapSelected.length===0} onClick={async()=>{
              const itemsToMove=swapModal.opsiSwap.filter((o:any)=>swapSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,total_menit:o.total_menit}));
              const menitDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.total_menit),0);
              const sisaSetelahSwap=swapModal.sisaKapasitas+menitDipindah;
              if(sisaSetelahSwap<swapModal.menitDibutuhkan){alert("Kapasitas masih belum cukup, pilih komponen tambahan");return;}
              setSwapLoading(true);
              const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
              const uname=user?.name||user?.nama||sess?.nama||"Admin";
              const res=await executeSwapKomponenV2({
                items:itemsToMove,
                jenisPekerjaan:swapModal.proses,
                tanggalAsal:swapModal.tanggal,
              });
              setSwapLoading(false);
              if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
              await activityLogService.insert({
                user_name:uname,action:"SWAP KOMPONEN KAPASITAS",
                description:"Pindahkan "+swapSelected.length+" komponen dari "+fmtDate(swapModal.tanggal)+" ("+swapModal.proses+") ke hari berikutnya untuk beri ruang komponen baru",
                module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
              });
              setSwapModal(null);setSwapSelected([]);
              await addEntry();
            }}
              style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapLoading||swapSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapLoading||swapSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {swapLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
            </button>
          </div>
        </Modal>
      )}

      {swapOrangModal&&(
        <Modal title={"Kuota Orang Penuh — "+swapOrangModal.tanggal} onClose={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}} width={540}>
          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#991b1b",display:"flex",gap:8,alignItems:"flex-start"}}>
            <span>⚠️</span>
            <span>Kuota {swapOrangModal.proses} tanggal {fmtDate(swapOrangModal.tanggal)}: {Math.round(swapOrangModal.terpakaiSaatIni)}/{Math.round(swapOrangModal.kuotaHari)} orang sudah terisi. Komponen baru butuh {Math.round(swapOrangModal.orangDibutuhkan)} orang lagi (total jadi {Math.round(swapOrangModal.terpakaiSaatIni+swapOrangModal.orangDibutuhkan)}). Pilih salah satu:</span>
          </div>

          <div>
              <Lbl>Komponen Terjadwal di {fmtDate(swapOrangModal.tanggal)} (pilih untuk dipindah)</Lbl>
              <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:14,maxHeight:240,overflowY:"auto" as const}}>
                {swapOrangModal.opsiSwap.map((o:any)=>{
                  const swapKey=o.raw_id+"|"+o.wp+"|"+o.kode_komponen;
                  const checked=swapOrangSelected.includes(swapKey);
                  const hasProgress=o.progress>0;
                  return(
                    <label key={swapKey} style={{display:"flex",alignItems:"flex-start",gap:10,border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",cursor:"pointer",background:checked?"#eff6ff":"#fff"}}>
                      <input type="checkbox" checked={checked} style={{marginTop:2}}
                        onChange={()=>setSwapOrangSelected(prev=>checked?prev.filter(k=>k!==swapKey):[...prev,swapKey])}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,color:"#1e293b"}}>{getNamaKomponenDariKode(o.panel_id,o.kode_komponen)}<span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>({o.kode_komponen})</span></div>
                        <div style={{fontSize:10,color:"#94a3b8"}}>WO {o.wo_number} · {o.panel_nama} · {o.jumlah_orang} orang · progress {o.progress}%</div>
                      </div>
                      {hasProgress&&(
                        <span style={{fontSize:9,background:"#fffbeb",color:"#92400e",padding:"2px 8px",borderRadius:6,fontWeight:600,whiteSpace:"nowrap" as const}}>Boleh, hati-hati</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {(()=>{
                const orangDipindah=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).reduce((s:number,o:any)=>s+Number(o.jumlah_orang),0);
                const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                const cukupSetelahSwap=sisaSetelahSwap>=swapOrangModal.orangDibutuhkan;
                return(
                  <div style={{background:cukupSetelahSwap?"#f0fdf4":"#fffbeb",border:`1px solid ${cukupSetelahSwap?"#bbf7d0":"#fde68a"}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:cukupSetelahSwap?"#16a34a":"#92400e"}}>
                    {cukupSetelahSwap?"✅ Setelah pindah, kuota cukup":"Pilih komponen lagi, masih belum cukup"}
                  </div>
                );
              })()}
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button onClick={()=>{setSwapOrangModal(null);setSwapOrangSelected([]);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={swapOrangLoading||swapOrangSelected.length===0} onClick={async()=>{
                  const itemsToMove=swapOrangModal.opsiSwap.filter((o:any)=>swapOrangSelected.includes(o.raw_id+"|"+o.wp+"|"+o.kode_komponen)).map((o:any)=>({raw_id:o.raw_id,wp:o.wp,kode_komponen:o.kode_komponen,jumlah_orang:o.jumlah_orang}));
                  const orangDipindah=itemsToMove.reduce((s:number,it:any)=>s+Number(it.jumlah_orang),0);
                  const sisaSetelahSwap=swapOrangModal.sisaKuota+orangDipindah;
                  if(sisaSetelahSwap<swapOrangModal.orangDibutuhkan){alert("Kuota masih belum cukup, pilih komponen tambahan");return;}
                  setSwapOrangLoading(true);
                  const res=await executeSwapKomponenOrang({items:itemsToMove,jenisPekerjaan:swapOrangModal.proses,tanggalAsal:swapOrangModal.tanggal});
                  setSwapOrangLoading(false);
                  if(!res.success){alert("Gagal memindahkan: "+(res.error||"Error tidak diketahui"));return;}
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  await activityLogService.insert({
                    user_name:uname,action:"SWAP ORANG KAPASITAS",
                    description:"Pindahkan "+swapOrangSelected.length+" komponen dari "+fmtDate(swapOrangModal.tanggal)+" ("+swapOrangModal.proses+") ke hari berikutnya untuk beri ruang kuota orang",
                    module:"raw",halaman:"Raw Schedule",proyek:rawRow?.proyek||"",panel:rawRow?.panel||""
                  });
                  setSwapOrangModal(null);setSwapOrangSelected([]);
                  await addEntry();
                }}
                  style={{padding:"8px 18px",borderRadius:8,border:"none",background:(swapOrangLoading||swapOrangSelected.length===0)?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:(swapOrangLoading||swapOrangSelected.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {swapOrangLoading?"⏳ Memindahkan...":"Pindahkan & Tambah Komponen"}
                </button>
              </div>
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
                {woData.filter((w:any)=>(w.panels||[]).some((p:any)=>{
                  const sudahPunyaRaw=rawData.some((r:any)=>(r.panel_id||r.panelId)===p.id);
                  const sudahSyncFCS=(p.synced_proses||[]).length>0;
                  return sudahSyncFCS&&!sudahPunyaRaw;
                })).map((w:any)=><option key={w.id} value={w.id}>WO {w.wo} — {w.proyek}</option>)}
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


function ManajemenWO({woData,setWoData,createWO,updateWO,removeWO,logActivity,logAct,log,user,refetchWO}:any){
  const blank={wo:"",proyek:"",target:""};
  const blankPanel={noPnl:"",nama:"",tipe:"FS",qty:1};
  const [fcsModal,setFcsModal]=useState<any>(null);
  const [fcsLoading,setFcsLoading]=useState(false);
  const [fcsResult,setFcsResult]=useState<any>(null);
  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});
  const [selectedPanelIds,setSelectedPanelIds]=useState<number[]>([]);
  const [form,setForm]=useState(blank);
  const [panels,setPanels]=useState([{...blankPanel}]);
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [open,setOpen]=useState(false);
  const [expandedWo,setExpandedWo]=useState({});
  const [expandedPanel,setExpandedPanel]=useState({});
  const [arsipModal,setArsipModal]=useState<any>(null);
  const [arsipLoading,setArsipLoading]=useState(false);

  const arsipkanWO=async(wo:any)=>{
    setArsipLoading(true);
    try{
      const panelIds=(wo.panels||[]).map((p:any)=>p.id);
      const totalPanel=panelIds.length;
      const totalKomponen=(wo.panels||[]).reduce((s:number,p:any)=>s+Object.keys(p.checklist||{}).length,0);

      // Ambil semua raw_schedule untuk WO ini
      const{data:rawRows}=await supabase.from("raw_schedule").select("*").eq("wo_id",wo.id);
      // Ambil semua renhar untuk WO ini
      const{data:renharRows}=await supabase.from("renhar").select("*").eq("wo_id",wo.id);
      // Ambil semua timer kerja untuk panel-panel di WO ini
      const{data:timerRows}=panelIds.length>0?await supabase.from("fcs_timer_kerja").select("*,pekerja(nama)").in("panel_id",panelIds):{data:[]};
      // Catatan: tabel kendala tidak punya relasi wo_id/panel_id, jadi tidak bisa difilter per WO
      const kendalaRows:any[]=[];

      const totalJamKerja=(timerRows||[]).reduce((s:number,t:any)=>s+Number(t.durasi_menit||0),0)/60;

      const ringkasanOperatorMap:Record<string,{nama:string,totalMenit:number,jumlahSesi:number}>={};
      (timerRows||[]).forEach((t:any)=>{
        const nama=t.pekerja?.nama||"Tidak diketahui";
        if(!ringkasanOperatorMap[nama])ringkasanOperatorMap[nama]={nama,totalMenit:0,jumlahSesi:0};
        ringkasanOperatorMap[nama].totalMenit+=Number(t.durasi_menit||0);
        ringkasanOperatorMap[nama].jumlahSesi++;
      });
      const ringkasanOperator=Object.values(ringkasanOperatorMap);

      const rincianPanel=(wo.panels||[]).map((p:any)=>({
        id:p.id,nama:p.nama,tipe:p.tipe,qty:p.qty,
        totalKomponen:Object.keys(p.checklist||{}).length,
      }));

      const tanggalSelesaiAktual=new Date().toISOString().slice(0,10);
      const selisihHari=Math.round((new Date(tanggalSelesaiAktual).getTime()-new Date(wo.target).getTime())/86400000);
      const statusKetepatan=selisihHari<=0?"tepat_waktu":"telat";

      const{error}=await supabase.from("fcs_arsip_wo").insert({
        wo_id:wo.id,wo_number:wo.wo,proyek:wo.proyek,
        target_selesai:wo.target,tanggal_selesai_aktual:tanggalSelesaiAktual,
        status_ketepatan:statusKetepatan,selisih_hari:Math.abs(selisihHari),
        total_panel:totalPanel,total_komponen:totalKomponen,total_jam_kerja:totalJamKerja,
        ringkasan_operator:ringkasanOperator,rincian_panel:rincianPanel,
        catatan_kendala:kendalaRows||[],
        snapshot_raw_schedule:rawRows||[],snapshot_renhar:renharRows||[],
        diarsipkan_oleh:user?.name||user?.nama||"Admin",
      });

      if(error){alert("Gagal arsipkan: "+error.message);setArsipLoading(false);return;}

      // Tandai WO sebagai sudah diarsipkan, supaya tidak muncul lagi di tampilan aktif
      await supabase.from("work_orders").update({is_archived:true}).eq("id",wo.id);

      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      await activityLogService.insert({
        user_name:uname,action:"ARSIPKAN WO",
        description:"Arsipkan WO "+wo.wo+" ("+wo.proyek+") - "+totalPanel+" panel, "+totalKomponen+" komponen",
        module:"wo",halaman:"Manajemen WO",proyek:wo.proyek||"",panel:""
      });

      setArsipModal(null);
      if(refetchWO)await refetchWO();
      alert("WO "+wo.wo+" berhasil diarsipkan dan disembunyikan dari tampilan aktif!");
    }catch(err:any){
      alert("Terjadi kesalahan: "+err.message);
    }
    setArsipLoading(false);
  };

  const save=async()=>{
    const np=panels.filter(p=>p.nama).map((p,i)=>({
      id:uid(),noPnl:Number(p.noPnl)||i+1,nama:p.nama,tipe:p.tipe,qty:Number(p.qty)||1,
      checklist:initChecklist(p.tipe,Number(p.qty)||1),catatan:"",
    }));
    if(editId){
      const result=await updateWO(editId,{wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(editId, np);
        const{data:freshPanelsEdit}=await supabase.from("panels").select("*").eq("wo_id",editId).order("no_pnl",{ascending:true});
        setWoData(prev=>prev.map(w=>w.id==editId?{...w,...form,panels:freshPanelsEdit??np}:w));
        if(log) await log("EDIT WO","Edit WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"update",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }
    } else {
      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        // Refetch panels dengan id yang benar dari database
        const{data:freshPanels}=await supabase.from("panels").select("*").eq("wo_id",result.data.id).order("no_pnl",{ascending:true});
        const newWo={...result.data,panels:freshPanels??np};
        setWoData(prev=>{
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });
        if(log) await log("TAMBAH WO","Tambah WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"create",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }
    }
    setOpen(false);
  };
  const [dirtyQty,setDirtyQty]=useState<Record<string,Record<string,{newQty:number,oldQty:number}>>>({});
  const [origChecklist,setOrigChecklist]=useState<Record<string,any>>({});

  const updateItemQty=(woId,panelId,kode,qty)=>{
    const nq=Number(qty)||0;
    setOrigChecklist(prev=>{
      if(prev[String(panelId)])return prev;
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      return{...prev,[String(panelId)]:JSON.parse(JSON.stringify(panel?.checklist||{}))};
    });
    setDirtyQty(prev=>{
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      const oldQty=panel?.checklist?.[kode]?.qty??0;
      return{...prev,[String(panelId)]:{...prev[String(panelId)],[kode]:{newQty:nq,oldQty}}};
    });
    setWoData(prev=>prev.map(wo=>wo.id!==woId?wo:{...wo,panels:wo.panels.map(p=>{
      if(p.id!==panelId)return p;
      const nq2=Number(qty)||0;
      const oldQty2=p.checklist[kode]?.qty||1;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq2}};
      if(nq2===0){
        // qty 0 → reset semua progress
        nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
        nc[kode].progressByDate=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:{}}),{});
        nc[kode].history=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:[]}),{});
      } else if(nq2!==oldQty2 && oldQty2>0){
        // qty berubah → recalculate progress proporsional
        const ratio=oldQty2/nq2;
        const newProgress:any={};
        const newHistory:any={...(nc[kode].history||{})};
        ALL_PROSES.forEach(pr=>{
          const oldPct=nc[kode].progress?.[pr]||0;
          const newPct=Math.min(100,Math.round(oldPct*ratio));
          newProgress[pr]=newPct;
          // Update entry terakhir di history jika ada
          if(newHistory[pr]&&newHistory[pr].length>0){
            const lastIdx=newHistory[pr].length-1;
            newHistory[pr]=[...newHistory[pr]];
            newHistory[pr][lastIdx]={
              ...newHistory[pr][lastIdx],
              pct:newPct,
              ts:new Date().toISOString()
            };
          }
        });
        nc[kode].progress=newProgress;
        nc[kode].history=newHistory;
      }
      return{...p,checklist:nc};
    })}));
  };

  const cancelQtyEdit=(panelId)=>{
    const orig=origChecklist[panelId];
    if(!orig)return;
    setWoData(prev=>prev.map(wo=>({...wo,panels:wo.panels.map(p=>p.id!==panelId?p:{...p,checklist:orig})})));
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
  };

  const saveQtyEdit=async(woArg,panelId)=>{
    // ambil data terbaru dari woData state
    const currentWo=woData.find(w=>w.panels?.some((p:any)=>String(p.id)===String(panelId)))||woArg;
    const panel=currentWo?.panels?.find((p:any)=>String(p.id)===String(panelId));
    if(!panel){alert('Panel tidak ditemukan!');return;}
    console.log('SAVE',panelId,panel.checklist);
    const{error}=await supabase.from('panels').update({checklist:panel.checklist}).eq('id',panel.id);
    if(error){alert('Gagal menyimpan: '+error.message);return;}
    const dirty=dirtyQty[String(panelId)]||{};
    const changes=Object.entries(dirty)
      .filter(([,v])=>(v as any).newQty!==(v as any).oldQty)
      .map(([kode,v])=>{
        const cfg=PANEL_TYPES[panel.tipe];
        const nama=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
        return nama+': '+(v as any).oldQty+' -> '+(v as any).newQty;
      });
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    const tgl=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    await activityLogService.insert({
      user_name:uname,
      action:'EDIT QTY',
      description:'['+tgl+'] Edit Qty '+panel.nama+' ('+currentWo.proyek+'): '+changes.join(', '),
      module:'wo',
      halaman:'Manajemen WO',
      proyek:currentWo.proyek||'',
      panel:panel.nama||'',
      wo_number:currentWo.wo||'',
    });
    setDirtyQty(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[String(panelId)];return n;});
    alert('Qty berhasil disimpan!');
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
                    <span style={{color:"var(--text-primary,#1e293b)",fontWeight:700}}>{wo.proyek}</span>
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
                <button onClick={()=>{setForm({wo:wo.wo,proyek:wo.proyek,target:wo.target});setPanels((wo.panels||[]).map(p=>({noPnl:p.noPnl,nama:p.nama,tipe:p.tipe,qty:p.qty})));setEditId(wo.id);setOpen(true);}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",cursor:"pointer",fontSize:12,fontWeight:600}}>✏️ Edit</button>
                <button onClick={()=>{setFcsModal(wo);setFcsResult(null);setFcsForm({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});setSelectedPanelIds((wo.panels||[]).map((p:any)=>p.id));}}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #bbf7d0",background:"#f0fdf4",color:"#16a34a",cursor:"pointer",fontSize:12,fontWeight:600}}>⏱ FCS</button>
                <button onClick={()=>setDelId(wo.id)}
                  style={{padding:"5px 14px",borderRadius:7,border:"1px solid #fecaca",background:"#fef2f2",color:"#dc2626",cursor:"pointer",fontSize:12,fontWeight:600}}>🗑</button>
              </div>
            </div>
            {isExp&&(wo.panels||[]).map(p=>{
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
                        <span style={{fontWeight:700,color:"var(--text-primary,#1e293b)",fontSize:13}}>{p.nama}</span>
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
                                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-primary,#374151)",flex:1}}>
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
                                        fontWeight:700,fontFamily:"'DM Mono',monospace",color:isLocked?"#fca5a5":"var(--text-primary,#1e293b)"}}/>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {dirtyQty[String(p.id)]&&Object.keys(dirtyQty[String(p.id)]).length>0&&(
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"12px 16px",borderTop:"1px dashed #e2e8f0",marginTop:4,background:"#f8faff"}}>
                      <button onClick={()=>cancelQtyEdit(String(p.id))}
                        style={{padding:"8px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
                        Batal
                      </button>
                      <button onClick={()=>saveQtyEdit(wo,String(p.id))}
                        style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #2563eb33"}}>
                        Simpan Perubahan
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}
      {arsipModal&&(
        <Modal title="Arsipkan Work Order?" onClose={()=>{if(!arsipLoading)setArsipModal(null);}} width={420}>
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e",display:"flex",gap:8,alignItems:"flex-start"}}>
            <i className="ti ti-alert-triangle" style={{fontSize:16,marginTop:1}}/>
            <span>WO <strong>{arsipModal.wo}</strong> ({arsipModal.proyek}) akan diarsipkan. Semua data (Raw Schedule, Rencana Harian, riwayat kerja) akan disimpan permanen sebagai histori.</span>
          </div>
          <div style={{fontSize:12,color:"#475569",marginBottom:16}}>
            <div>📦 {(arsipModal.panels||[]).length} panel akan diarsipkan</div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setArsipModal(null)} disabled={arsipLoading}>Batal</Btn>
            <Btn color="#16a34a" onClick={()=>arsipkanWO(arsipModal)} disabled={arsipLoading}>
              {arsipLoading?"⏳ Mengarsipkan...":"📦 Arsipkan Sekarang"}
            </Btn>
          </div>
        </Modal>
      )}
      {delId&&(
        <Modal title="Hapus WO?" onClose={()=>setDelId(null)} width={360}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Data tidak dapat dikembalikan.</div>
            <div style={{display:"flex",gap:10,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={async()=>{
  const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
  const uname=sess?.nama||sess?.name||'Admin';
  const woToDelete=woData.find(w=>w.id===delId);
  // 1. Ambil panel ids
  const panelIds=(woToDelete?.panels||[]).map((p:any)=>p.id);
  // 2. (kendala tidak terikat panel_id, skip)
  // 3. Hapus renhar terkait wo
  await supabase.from('renhar').delete().eq('wo_id',delId);
  // 4. Hapus raw_schedule terkait wo
  await supabase.from('raw_schedule').delete().eq('wo_id',delId);
  // 5. Hapus panels terkait wo
  await supabase.from('panels').delete().eq('wo_id',delId);
  // 6. Hapus work order
  await supabase.from('work_orders').delete().eq('id',delId);
  // 7. Activity log
  await activityLogService.insert({
    user_name:uname,
    action:'HAPUS WO',
    description:'Hapus WO '+woToDelete?.wo+' - '+woToDelete?.proyek+' beserta semua data terkait',
    module:'wo',
    halaman:'Manajemen WO',
    proyek:woToDelete?.proyek||'',
    wo_number:woToDelete?.wo||'',
  });
  // 8. Update local state
  setWoData(prev=>prev.filter(w=>w.id!==delId));
  setDelId(null);
}}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
      {open&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb",background:"#f8faff"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontWeight:800,fontSize:16,color:"var(--text-primary,#1e293b)"}}>{editId?"✏️ Edit WO":"📝 Tambah WO Baru"}</div>
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
      {fcsModal&&(
        <Modal title={"⏱ Generate FCS — WO "+fcsModal.wo} onClose={()=>{setFcsModal(null);setFcsResult(null);}} width={520}>
          <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
            <strong>{fcsModal.proyek}</strong> · {(fcsModal.panels||[]).length} panel · Target: {fcsModal.target}
          </div>
          {!fcsResult?(
            <div>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({selectedPanelIds.length}/{(fcsModal.panels||[]).length})</div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setSelectedPanelIds((fcsModal.panels||[]).map((p:any)=>p.id))}
                      style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                    <button onClick={()=>setSelectedPanelIds([])}
                      style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                  </div>
                </div>
                <div style={{maxHeight:140,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:8}}>
                  {(fcsModal.panels||[]).map((p:any)=>{
                    const checked=selectedPanelIds.includes(p.id);
                    return(
                      <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:6,background:checked?"#eff6ff":"transparent"}}>
                        <input type="checkbox" checked={checked}
                          onChange={()=>setSelectedPanelIds(prev=>checked?prev.filter(id=>id!==p.id):[...prev,p.id])}/>
                        <span style={{fontSize:12,color:"#1e293b"}}>{p.nama}</span>
                        <span style={{fontSize:10,color:"#94a3b8"}}>({p.tipe})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:6}}>Tanggal Mulai</div>
                  <input type="date" value={fcsForm.tanggalMulai}
                    onChange={e=>setFcsForm({...fcsForm,tanggalMulai:e.target.value})}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}/>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:6}}>Jenis Pekerjaan</div>
                  <select value={fcsForm.jenisPekerjaan} onChange={e=>setFcsForm({...fcsForm,jenisPekerjaan:e.target.value})}
                    style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}>
                    {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#92400e"}}>
                ⚠️ Schedule lama status Planning untuk WO ini akan digantikan jadwal baru.
              </div>
              <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                <button onClick={()=>setFcsModal(null)}
                  style={{padding:"8px 16px",borderRadius:8,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button disabled={fcsLoading||selectedPanelIds.length===0} onClick={async()=>{
                  setFcsLoading(true);
                  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
                  const uname=user?.name||user?.nama||sess?.nama||"Admin";
                  const panels=(fcsModal.panels||[]).filter((p:any)=>selectedPanelIds.includes(p.id));
                  let totalCount=0;const errors:string[]=[];
                  for(const panel of panels){
                    const res=await generateFCSSchedule({
                      woId:fcsModal.id,woNumber:fcsModal.wo,proyek:fcsModal.proyek,
                      panelId:panel.id,panelNama:panel.nama,tipePanel:panel.tipe,
                      checklist:panel.checklist||{},
                      jenisPekerjaan:fcsForm.jenisPekerjaan,
                      tanggalMulai:fcsForm.tanggalMulai,
                      generatedBy:uname,
                    });
                    if(res.success)totalCount+=res.count;
                    else errors.push(panel.nama+": "+(res.error||"Error"));
                  }
                  if(totalCount>0&&refetchWO)await refetchWO();
                  setFcsResult({totalCount,errors,panels:panels.length});
                  setFcsLoading(false);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:(fcsLoading||selectedPanelIds.length===0)?"#94a3b8":"#16a34a",color:"#fff",fontSize:12,fontWeight:700,cursor:(fcsLoading||selectedPanelIds.length===0)?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {fcsLoading?"Generating...":selectedPanelIds.length===0?"Pilih panel dulu":"⏱ Generate Schedule ("+selectedPanelIds.length+" panel)"}
                </button>
              </div>
            </div>
          ):(
            <div>
              {fcsResult.errors.length===0?(
                <div style={{textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#16a34a",marginBottom:8}}>Schedule Berhasil!</div>
                  <div style={{fontSize:13,color:"#64748b",marginBottom:4}}>{fcsResult.panels} panel · {fcsResult.totalCount} baris jadwal</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>Pekerjaan: <strong>{fcsForm.jenisPekerjaan}</strong> · Mulai: <strong>{fcsForm.tanggalMulai}</strong></div>
                </div>
              ):(
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:8}}>{fcsResult.totalCount} jadwal berhasil, {fcsResult.errors.length} error:</div>
                  {fcsResult.errors.map((e:string,i:number)=>(
                    <div key={i} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"8px 12px",marginBottom:6,fontSize:12,color:"#dc2626"}}>{e}</div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
                <button onClick={()=>{setFcsModal(null);setFcsResult(null);}}
                  style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Tutup</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );

}
// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR VIEW — tabel besar per proses
// ─────────────────────────────────────────────────────────────────────────────
﻿﻿﻿﻿

﻿



function MaintenancePageTab({user}:any){
  const [subTab,setSubTab]=useState("kerusakan");
  const [mesinList,setMesinList]=useState<any[]>([]);
  const [maintenanceList,setMaintenanceList]=useState<any[]>([]);
  const [rutinList,setRutinList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const [{data:ms},{data:ml},{data:rl}]=await Promise.all([
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode"),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
        supabase.from("maintenance_rutin").select("*,mesin(nama,kode)").eq("is_active",true).order("jatuh_tempo"),
      ]);
      setMesinList(ms??[]);setMaintenanceList(ml??[]);setRutinList(rl??[]);setLoading(false);
    };load();
  },[]);
  const today=new Date().toISOString().slice(0,10);
  const terlambat=rutinList.filter((r:any)=>r.jatuh_tempo&&r.jatuh_tempo<today);
  const mingguIni=rutinList.filter((r:any)=>{
    if(!r.jatuh_tempo||r.jatuh_tempo<today)return false;
    const diff=(new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000;
    return diff<=7;
  });
  return(
    <div className="fi">
      <div style={{display:"flex",gap:0,marginBottom:16,background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden",width:"fit-content"}}>
        {[{id:"kerusakan",label:"Kerusakan"},{id:"rutin",label:"Maintenance Rutin"}].map((t:any)=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:"9px 20px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:subTab===t.id?"#1d4ed8":"transparent",
              color:subTab===t.id?"#fff":"#64748b",
              borderRight:"1px solid #e2e8f0",transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat data...</div>:
        subTab==="kerusakan"?
        <KerusakanTab mesinList={mesinList} maintenanceList={maintenanceList} setMaintenanceList={setMaintenanceList} user={user}/>:
        <MaintenanceRutinTab mesinList={mesinList} rutinList={rutinList} setRutinList={setRutinList} user={user} today={today} terlambat={terlambat} mingguIni={mingguIni}/>
      }
    </div>
  );
}

function KerusakanTab({mesinList,maintenanceList,setMaintenanceList,user}:any){
  const [form,setForm]=useState({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [showForm,setShowForm]=useState(false);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [view,setView]=useState("kanban");
  const SC:any={open:{color:"#dc2626",bg:"#FCEBEB",border:"#F09595",label:"Open"},in_progress:{color:"#f59e0b",bg:"#FAEEDA",border:"#FAC775",label:"In Progress"},closed:{color:"#16a34a",bg:"#EAF3DE",border:"#C0DD97",label:"Closed"}};
  const getUname=()=>{const s=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");return user?.name||user?.nama||s?.nama||"Admin";};
  const save=async()=>{
    if(!form.mesin_id||!form.kendala.trim())return;
    const payload={mesin_id:Number(form.mesin_id),kendala:form.kendala,perbaikan:form.perbaikan,catatan:form.catatan,tgl_kendala:form.tgl_kendala||null,tgl_perbaikan:form.tgl_perbaikan||null,teknisi:form.teknisi,status:form.status};
    if(editId){
      const{data,error}=await supabase.from("maintenance_log").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===editId?data:m));setEditId(null);setShowForm(false);}
    } else {
      const{data,error}=await supabase.from("maintenance_log").insert(payload).select("*,mesin(nama,kode)").single();
      if(!error){
        setMaintenanceList((p:any[])=>[data,...p]);
        await activityLogService.insert({user_name:getUname(),action:"TAMBAH MAINTENANCE",description:"Tambah log maintenance "+data.mesin?.nama,module:"maintenance",halaman:"Maintenance"});
        setShowForm(false);
      }
    }
    setForm({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  };
  const del=async()=>{
  const item=maintenanceList.find((m:any)=>m.id===delId);
  await supabase.from("maintenance_log").delete().eq("id",delId);
  setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));
  setDelId(null);
  await activityLogService.insert({user_name:getUname(),action:"HAPUS LOG MAINTENANCE",description:"Hapus log: "+(item?.mesin?.nama||"-")+" - "+(item?.kendala||"-").slice(0,50),module:"maintenance",halaman:"Maintenance"});
};
  const updateStatus=async(id:any,status:string)=>{
  await supabase.from("maintenance_log").update({status}).eq("id",id);
  setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));
  const item=maintenanceList.find((m:any)=>m.id===id);
  await activityLogService.insert({user_name:getUname(),action:"UPDATE STATUS MAINTENANCE",description:"Update status: "+(item?.mesin?.nama||"-")+" -> "+status,module:"maintenance",halaman:"Maintenance"});
};
  const filtered=filterStatus==="ALL"?maintenanceList:maintenanceList.filter((m:any)=>m.status===filterStatus);
  const stats=[{l:"Open",v:maintenanceList.filter((m:any)=>m.status==="open").length,c:"#dc2626"},{l:"In Progress",v:maintenanceList.filter((m:any)=>m.status==="in_progress").length,c:"#f59e0b"},{l:"Closed",v:maintenanceList.filter((m:any)=>m.status==="closed").length,c:"#16a34a"},{l:"Total Mesin",v:mesinList.length,c:"#2563eb"}];
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {stats.map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","open","in_progress","closed"].map((s:string)=>(<button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"5px 12px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterStatus===s?"#1d4ed8":"#fff",color:filterStatus===s?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{s==="ALL"?"Semua":SC[s]?.label}</button>))}
        </div>
        <div style={{display:"flex",gap:4,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden",marginLeft:"auto"}}>
          <button onClick={()=>setView("kanban")} style={{padding:"5px 10px",border:"none",background:view==="kanban"?"#f1f5f9":"#fff",cursor:"pointer",fontSize:13}}>⊞</button>
          <button onClick={()=>setView("list")} style={{padding:"5px 10px",border:"none",background:view==="list"?"#f1f5f9":"#fff",cursor:"pointer",fontSize:13}}>☰</button>
        </div>
        <Btn color="#1d4ed8" onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",kendala:"",perbaikan:"",catatan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"})}}>{showForm?"✕ Tutup":"+ Tambah Log"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"var(--text-primary,#1e293b)",marginBottom:12}}>{editId?"✏️ Edit Log":"➕ Tambah Log Maintenance"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih Mesin --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Tgl Kendala</Lbl><Inp type="date" value={form.tgl_kendala} onChange={e=>setForm({...form,tgl_kendala:e.target.value})}/></div>
            <div><Lbl>Tgl Perbaikan</Lbl><Inp type="date" value={form.tgl_perbaikan} onChange={e=>setForm({...form,tgl_perbaikan:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Kendala</Lbl><textarea value={form.kendala} onChange={e=>setForm({...form,kendala:e.target.value})} placeholder="Deskripsi kendala..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
            <div><Lbl>Perbaikan</Lbl><textarea value={form.perbaikan} onChange={e=>setForm({...form,perbaikan:e.target.value})} placeholder="Tindakan perbaikan..." style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:72,fontFamily:"inherit"}}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Status</Lbl><Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></Sel></div>
            <div><Lbl>Catatan Harian</Lbl><textarea value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan perkembangan..." style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#1e293b",fontSize:12,resize:"vertical",minHeight:60,fontFamily:"inherit"}}/></div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}><Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn><Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn></div>
          </div>
        </Card>
      )}
      {view==="kanban"?(
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {["open","in_progress","closed"].map((col:string)=>{
            const sc=SC[col];const items=filtered.filter((m:any)=>m.status===col);
            return(<div key={col}>
              <div style={{padding:"8px 12px",marginBottom:8,background:sc.bg,borderLeft:`3px solid ${sc.color}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:12,fontWeight:700,color:sc.color}}>{sc.label}</span>
                <span style={{fontSize:11,background:sc.border,color:sc.color,borderRadius:20,padding:"1px 8px",fontWeight:700}}>{items.length}</span>
              </div>
              {items.map((m:any)=>(
                <div key={m.id} style={{background:"var(--card-bg,#fff)",border:`0.5px solid ${sc.border}`,borderRadius:10,padding:12,marginBottom:8,borderLeft:`3px solid ${sc.color}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div><div style={{fontWeight:700,fontSize:13,color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</div><div style={{fontSize:11,color:"#64748b",fontFamily:"monospace"}}>{m.mesin?.kode}</div></div>
                    <select value={m.status} onChange={e=>updateStatus(m.id,e.target.value)} style={{fontSize:10,padding:"2px 6px",borderRadius:6,border:`1px solid ${sc.color}`,background:sc.bg,color:sc.color,cursor:"pointer",fontWeight:700}}><option value="open">Open</option><option value="in_progress">In Progress</option><option value="closed">Closed</option></select>
                  </div>
                  <div style={{fontSize:12,color:"#475569",marginBottom:6,lineHeight:1.5}}>{m.kendala}</div>
                  {m.perbaikan&&<div style={{fontSize:11,color:"#16a34a",background:"var(--wp2-bg,#f0fdf4)",borderRadius:6,padding:"5px 8px",marginBottom:6,lineHeight:1.4}}>{m.perbaikan}</div>}
                  {m.catatan&&<div style={{fontSize:11,color:"#2563eb",background:"#eff6ff",borderRadius:6,padding:"5px 8px",marginBottom:8,lineHeight:1.4,borderLeft:"2px solid #93c5fd"}}>📝 {m.catatan}</div>}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div style={{fontSize:11,color:"#94a3b8"}}>{m.teknisi&&<span>👤 {m.teknisi}</span>}{m.tgl_kendala&&<span style={{marginLeft:6}}>📅 {m.tgl_kendala}</span>}</div>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",catatan:m.catatan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                      <button onClick={()=>setDelId(m.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                    </div>
                  </div>
                </div>
              ))}
              {items.length===0&&<div style={{textAlign:"center",padding:"24px",color:"#94a3b8",fontSize:12,border:"1px dashed #e2e8f0",borderRadius:8}}>Tidak ada</div>}
            </div>);
          })}
        </div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Mesin</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Kendala</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Perbaikan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Catatan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Teknisi</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Tgl Kendala</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",borderRight:"1px solid #ffffff10"}}>Tgl Perbaikan</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"center",borderRight:"1px solid #ffffff10"}}>Status</th>
              <th style={{background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"center"}}>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(<tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Tidak ada data</td></tr>):filtered.map((m:any,i:number)=>{const sc=SC[m.status]||SC.open;const bg=i%2===0?"#fff":"#f8fafc";const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"top",fontSize:12};return(
                <tr key={m.id}>
                  <td style={{...td,fontWeight:700}}><div style={{color:"var(--text-primary,#1e293b)"}}>{m.mesin?.nama||"—"}</div><div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{m.mesin?.kode}</div></td>
                  <td style={{...td,maxWidth:200,color:"#475569"}}>{m.kendala}</td>
                  <td style={{...td,maxWidth:200,color:"#16a34a"}}>{m.perbaikan||"—"}</td>
                  <td style={{...td,maxWidth:160,color:"#2563eb"}}>{m.catatan||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{m.teknisi||"—"}</td>
                  <td style={{...td,fontSize:11,color:"#94a3b8"}}>{m.tgl_kendala||"—"}</td>
                  <td style={{...td,fontSize:11,color:"#94a3b8"}}>{m.tgl_perbaikan||"—"}</td>
                  <td style={{...td,textAlign:"center"}}><span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{sc.label}</span></td>
                  <td style={{...td,textAlign:"center"}}><div style={{display:"flex",gap:4,justifyContent:"center"}}>
                    <button onClick={()=>{const t=["LAPORAN MAINTENANCE","Mesin: "+(m.mesin?.nama||"-"),"Kode: "+(m.mesin?.kode||"-"),"Tgl Kendala: "+(m.tgl_kendala||"-"),"Tgl Perbaikan: "+(m.tgl_perbaikan||"-"),"Teknisi: "+(m.teknisi||"-"),"Status: "+m.status,"","Kendala:",m.kendala||"-","","Perbaikan:",m.perbaikan||"-","","Catatan:",m.catatan||"-"].join("\n");const b=new Blob([t],{type:"text/plain"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download="maintenance-"+(m.mesin?.kode||m.id)+".txt";a.click();URL.revokeObjectURL(u);}} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#1d4ed8",fontWeight:700}}>↓ TXT</button>
                    <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",catatan:m.catatan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>setDelId(m.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                  </div></td>
                </tr>);})}
            </tbody>
          </table>
        </div>
      )}
      {delId&&(<Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log ini akan dihapus permanen.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Hapus</Btn></div></Modal>)}
    </div>
  );
}

function MaintenanceRutinTab({mesinList,rutinList,setRutinList,user,today,terlambat,mingguIni}:any){
  const [form,setForm]=useState({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const [doneId,setDoneId]=useState<any>(null);
  const [filterFrek,setFilterFrek]=useState("ALL");
  const FC:any={harian:{label:"Harian",bg:"#E6F1FB",color:"#0C447C",border:"#85B7EB"},mingguan:{label:"Mingguan",bg:"#EEEDFE",color:"#3C3489",border:"#AFA9EC"},bulanan:{label:"Bulanan",bg:"#E1F5EE",color:"#085041",border:"#5DCAA5"},"3bulan":{label:"3 Bulanan",bg:"#FAEEDA",color:"#633806",border:"#EF9F27"},tahunan:{label:"Tahunan",bg:"#FCEBEB",color:"#791F1F",border:"#F09595"}};
  const calcNext=(d:string,f:string)=>{if(!d)return"";const dt=new Date(d);if(f==="harian")dt.setDate(dt.getDate()+1);else if(f==="mingguan")dt.setDate(dt.getDate()+7);else if(f==="bulanan")dt.setMonth(dt.getMonth()+1);else if(f==="3bulan")dt.setMonth(dt.getMonth()+3);else if(f==="tahunan")dt.setFullYear(dt.getFullYear()+1);return dt.toISOString().slice(0,10);};
  const getStatus=(r:any)=>{if(!r.jatuh_tempo)return{label:"Belum dijadwalkan",color:"#64748b",bg:"#f1f5f9"};if(r.jatuh_tempo<today)return{label:"Terlambat",color:"#dc2626",bg:"#fef2f2"};const diff=Math.ceil((new Date(r.jatuh_tempo).getTime()-new Date(today).getTime())/86400000);if(diff===0)return{label:"Hari ini!",color:"#dc2626",bg:"#fef2f2"};if(diff<=3)return{label:diff+"hr lagi",color:"#f59e0b",bg:"#fffbeb"};if(diff<=7)return{label:diff+"hr lagi",color:"#2563eb",bg:"#eff6ff"};return{label:diff+"hr lagi",color:"#16a34a",bg:"#f0fdf4"};};
  const save=async()=>{
    if(!form.mesin_id||!form.jenis_maintenance.trim())return;
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    if(editId){
      const{data}=await supabase.from("maintenance_rutin").update({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
      }).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>p.map((r:any)=>r.id===editId?data:r));
        await activityLogService.insert({user_name:uname,action:"EDIT MAINTENANCE RUTIN",
          description:"Edit jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    } else {
      const{data}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        is_active:true,
      }).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>[...p,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH MAINTENANCE RUTIN",
          description:"Tambah jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    }
    setShowForm(false);setEditId(null);
    setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  };
  const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};

  const markDone=async(item:any)=>{
    const todayStr=new Date().toISOString().slice(0,10);
    const nextDate=calcNext(todayStr,item.frekuensi);
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    const{data}=await supabase.from("maintenance_rutin").update({
      terakhir_dilakukan:todayStr,
      jatuh_tempo:nextDate,
    }).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){
      setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));
      await activityLogService.insert({
        user_name:uname,
        action:"MAINTENANCE RUTIN DONE",
        description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+todayStr+"). Jadwal berikutnya: "+nextDate,
        module:"maintenance",halaman:"Maintenance"
      });
    }
    setDoneId(null);
  };
  const kepatuhan=rutinList.length>0?Math.round((rutinList.filter((r:any)=>r.terakhir_dilakukan&&r.jatuh_tempo>=today).length/rutinList.length)*100):0;
  const filtered=filterFrek==="ALL"?rutinList:rutinList.filter((r:any)=>r.frekuensi===filterFrek);
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
        {[{l:"Terlambat",v:terlambat.length,c:"#dc2626"},{l:"Jatuh tempo minggu ini",v:mingguIni.length,c:"#f59e0b"},{l:"Total jadwal",v:rutinList.length,c:"#2563eb"},{l:"Kepatuhan",v:kepatuhan+"%",c:"#16a34a"}].map((s:any,i:number)=>(<Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div></Card>))}
      </div>
      {([...terlambat,...mingguIni]).length>0&&(
        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>Perlu perhatian</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[...terlambat,...mingguIni].slice(0,4).map((r:any)=>{const st=getStatus(r);const fc=FC[r.frekuensi]||FC.bulanan;return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:st.bg,border:`1px solid ${st.color}30`,borderRadius:8,borderLeft:`3px solid ${st.color}`}}>
                <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{r.jenis_maintenance}</div><div style={{fontSize:11,color:"#64748b"}}>{r.mesin?.nama} · {r.teknisi||"Belum assign"}</div></div>
                <span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span>
                <span style={{fontSize:11,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>{st.label}</span>
                <button onClick={()=>setDoneId(r)} style={{background:"#1d4ed8",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#fff",fontWeight:700}}>Selesai</button>
              </div>
            );})}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e2e8f0",borderRadius:8,overflow:"hidden"}}>
          {["ALL","harian","mingguan","bulanan","3bulan","tahunan"].map((f:string)=>(<button key={f} onClick={()=>setFilterFrek(f)} style={{padding:"5px 10px",border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filterFrek===f?"#1d4ed8":"#fff",color:filterFrek===f?"#fff":"#64748b",borderRight:"1px solid #e2e8f0"}}>{f==="ALL"?"Semua":FC[f]?.label}</button>))}
        </div>
        <Btn color="#1d4ed8" style={{marginLeft:"auto"}} onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});}}>{showForm?"Tutup":"+ Tambah Jadwal"}</Btn>
      </div>
      {showForm&&(
        <Card style={{marginBottom:14,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:12}}>{editId?"Edit":"Tambah Jadwal Rutin"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl><Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}><option value="">-- Pilih --</option>{mesinList.map((m:any)=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}</Sel></div>
            <div><Lbl>Jenis Maintenance</Lbl><Inp value={form.jenis_maintenance} onChange={e=>setForm({...form,jenis_maintenance:e.target.value})} placeholder="Pelumasan, ganti oli..."/></div>
            <div><Lbl>Frekuensi</Lbl><Sel value={form.frekuensi} onChange={e=>setForm({...form,frekuensi:e.target.value})}>{Object.entries(FC).map(([k,v]:any)=><option key={k} value={k}>{v.label}</option>)}</Sel></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Terakhir Dilakukan</Lbl><Inp type="date" value={form.terakhir_dilakukan} onChange={e=>setForm({...form,terakhir_dilakukan:e.target.value,jatuh_tempo:calcNext(e.target.value,form.frekuensi)})}/></div>
            <div><Lbl>Jatuh Tempo</Lbl><Inp type="date" value={form.jatuh_tempo} onChange={e=>setForm({...form,jatuh_tempo:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Catatan</Lbl><Inp value={form.catatan} onChange={e=>setForm({...form,catatan:e.target.value})} placeholder="Catatan tambahan..."/></div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}><Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn><Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn></div>
          </div>
        </Card>
      )}
      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>{["Mesin","Jenis Maintenance","Frekuensi","Teknisi","Terakhir","Jatuh Tempo","Status","Aksi"].map((h:string)=><th key={h} style={thS}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.length===0?(<tr><td colSpan={8} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>Belum ada jadwal</td></tr>):
            filtered.map((r:any,i:number)=>{const fc=FC[r.frekuensi]||FC.bulanan;const st=getStatus(r);const bg=i%2===0?"#fff":"#f8fafc";const td:any={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"middle"};return(
              <tr key={r.id}>
                <td style={td}><div style={{fontWeight:700}}>{r.mesin?.nama||"—"}</div><div style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace"}}>{r.mesin?.kode}</div></td>
                <td style={{...td,fontWeight:600,color:"#475569"}}>{r.jenis_maintenance}</td>
                <td style={td}><span style={{background:fc.bg,color:fc.color,border:`1px solid ${fc.border}`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{fc.label}</span></td>
                <td style={{...td,color:"#64748b"}}>{r.teknisi||"—"}</td>
                <td style={{...td,fontSize:11,color:"#94a3b8"}}>{r.terakhir_dilakukan||"—"}</td>
                <td style={{...td,fontSize:11,fontWeight:600,color:st.color}}>{r.jatuh_tempo||"—"}</td>
                <td style={td}><span style={{background:st.bg,color:st.color,border:`1px solid ${st.color}30`,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700}}>{st.label}</span></td>
                <td style={{...td,textAlign:"center"}}>
                  <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                    <button onClick={()=>setDoneId(r)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700}}>Done</button>
                    <button onClick={()=>{setEditId(r.id);setForm({mesin_id:r.mesin_id?.toString()||"",jenis_maintenance:r.jenis_maintenance||"",frekuensi:r.frekuensi||"mingguan",teknisi:r.teknisi||"",terakhir_dilakukan:r.terakhir_dilakukan||"",jatuh_tempo:r.jatuh_tempo||"",catatan:r.catatan||""});setShowForm(true);}} style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                    <button onClick={()=>setDelId(r.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                  </div>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
      {doneId&&(<Modal title="Tandai Selesai?" onClose={()=>setDoneId(null)} width={400}><div style={{fontSize:13,color:"#475569",marginBottom:8}}><strong>{doneId.jenis_maintenance}</strong> — {doneId.mesin?.nama}</div><div style={{fontSize:12,color:"#064e3b",background:"#f0fdf4",borderRadius:8,padding:"10px 12px",marginBottom:20}}>Jadwal berikutnya otomatis dihitung dari hari ini.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDoneId(null)}>Batal</Btn><Btn color="#16a34a" onClick={()=>markDone(doneId)}>Selesai</Btn></div></Modal>)}
      {delId&&(<Modal title="Nonaktifkan?" onClose={()=>setDelId(null)} width={360}><div style={{fontSize:13,color:"#475569",marginBottom:20}}>Jadwal ini akan dinonaktifkan.</div><div style={{display:"flex",gap:10,justifyContent:"flex-end"}}><Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn><Btn color="#dc2626" onClick={del}>Nonaktifkan</Btn></div></Modal>)}
    </div>
  );
}

function RecycleBinTab({user}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filterCat,setFilterCat]=useState("ALL");
  const CATS:any={work_orders:{label:"Work Order"},mesin:{label:"Mesin"},pekerja:{label:"Pekerja"},raw_schedule:{label:"Raw Schedule"},renhar:{label:"Rencana Harian"},kendala:{label:"Kendala"}};
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const cats=["work_orders","mesin","pekerja","raw_schedule","renhar","kendala"];
      const results=await Promise.all(cats.map((t:string)=>supabase.from(t).select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false})));
      const all:any[]=[];
      results.forEach(({data}:any,i:number)=>{(data??[]).forEach((row:any)=>all.push({...row,_cat:cats[i]}));});
      all.sort((a:any,b:any)=>new Date(b.deleted_at).getTime()-new Date(a.deleted_at).getTime());
      setItems(all);setLoading(false);
    };load();
  },[]);
  const sisa=(d:string)=>Math.max(0,15-Math.floor((new Date().getTime()-new Date(d).getTime())/86400000));
  const fmt=(ts:string)=>ts?new Date(ts).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"--";
  const getTitle=(item:any):string=>{
    if(item._cat==="work_orders")return"WO-"+item.wo+" -- "+item.proyek;
    if(item._cat==="mesin")return(item.kode||"")+" -- "+(item.nama||"");
    if(item._cat==="pekerja")return item.nama||"--";
    if(item._cat==="raw_schedule")return(item.panel||"")+" ("+item.proses+")";
    if(item._cat==="renhar")return(item.panel||"")+" -- "+(item.proses||"");
    if(item._cat==="kendala")return(item.catatan||"").slice(0,60);
    return"--";
  };
  const restore=async(item:any)=>{
    await supabase.from(item._cat).update({deleted_at:null,deleted_by:null}).eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"RESTORE DATA",description:"Restore "+item._cat+": "+getTitle(item),module:"general",halaman:"Recycle Bin"});
  };
  const permDel=async(item:any)=>{
    await supabase.from(item._cat).delete().eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS PERMANEN",description:"Hapus permanen "+item._cat+": "+getTitle(item),module:"general",halaman:"Recycle Bin"});
  };
  const filtered=filterCat==="ALL"?items:items.filter((x:any)=>x._cat===filterCat);
  const counts:any={};items.forEach((x:any)=>{counts[x._cat]=(counts[x._cat]||0)+1;});
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[{l:"Total Item",v:items.length,c:"#2563eb"},{l:"Kritis 3 hari",v:items.filter((x:any)=>sisa(x.deleted_at)<=3).length,c:"#dc2626"},{l:"Auto-delete",v:"15 hari",c:"#16a34a"},{l:"Kategori",v:Object.keys(CATS).length,c:"#8b5cf6"}].map((s:any,i:number)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setFilterCat("ALL")} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${filterCat==="ALL"?"#1d4ed8":"#e2e8f0"}`,background:filterCat==="ALL"?"#1d4ed8":"#fff",color:filterCat==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({items.length})</button>
        {Object.entries(CATS).map(([k,v]:any)=>counts[k]>0&&(
          <button key={k} onClick={()=>setFilterCat(filterCat===k?"ALL":k)} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${filterCat===k?"#1d4ed8":"#e2e8f0"}`,background:filterCat===k?"#1d4ed8":"#fff",color:filterCat===k?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{v.label} ({counts[k]})</button>
        ))}
        <div style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>Item otomatis dihapus setelah 15 hari</div>
      </div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat...</div>:filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>🗑</div><div style={{fontSize:13,fontWeight:600}}>Recycle bin kosong</div><div style={{fontSize:12,marginTop:4}}>Semua data aktif</div></div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr><th style={thS}>Kategori</th><th style={thS}>Item</th><th style={thS}>Dihapus Oleh</th><th style={thS}>Dihapus Pada</th><th style={{...thS,textAlign:"center"}}>Sisa Hari</th><th style={{...thS,textAlign:"center"}}>Aksi</th></tr></thead>
            <tbody>
              {filtered.map((item:any,i:number)=>{
                const cat=CATS[item._cat];
                const s=sisa(item.deleted_at);
                const sc=s<=3?"#dc2626":s<=7?"#f59e0b":"#16a34a";
                const bg=i%2===0?"#fff":"#f8fafc";
                const td:any={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"middle"};
                return(
                  <tr key={item._cat+"-"+item.id}>
                    <td style={td}><span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#475569"}}>{cat?.label}</span></td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{getTitle(item)}</td>
                    <td style={{...td,color:"#64748b"}}>{item.deleted_by||"--"}</td>
                    <td style={{...td,fontSize:11,color:"#94a3b8"}}>{fmt(item.deleted_at)}</td>
                    <td style={{...td,textAlign:"center"}}><span style={{background:sc+"18",color:sc,border:"1px solid "+sc+"33",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{s} hari</span></td>
                    <td style={{...td,textAlign:"center"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        <button onClick={()=>restore(item)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700}}>Pulihkan</button>
                        <button onClick={()=>permDel(item)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InventarisWrapper({user,activityLog}:any){
  const [invTab,setInvTab]=useState("data");
  const btnS=(active:boolean):any=>({
    padding:"8px 18px",fontSize:12,fontWeight:active?700:500,
    color:active?"#1d4ed8":"#64748b",cursor:"pointer",
    background:active?"#eff6ff":"transparent",
    border:"none",borderBottom:active?"2px solid #1d4ed8":"2px solid transparent",
    fontFamily:"inherit",borderRadius:"6px 6px 0 0",
  });
  return(
    <div>
      <div style={{display:"flex",gap:2,marginBottom:14,borderBottom:"1px solid #e2e8f0"}}>
        <button style={btnS(invTab==="data")} onClick={()=>setInvTab("data")}>📋 Data Komponen</button>
        <button style={btnS(invTab==="riwayat")} onClick={()=>setInvTab("riwayat")}>🕒 Riwayat Transaksi</button>
      </div>
      <KomponenStokTab user={user} activityLog={activityLog} invTab={invTab}/>
    </div>
  );
}

function KomponenStokTab({user,activityLog,invTab="data"}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [masuklist,setMasukList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [form,setForm]=useState({nama:"",kode:"",stok:0});
  const [editId,setEditId]=useState<any>(null);
  const [search,setSearch]=useState("");
  const [filterKode,setFilterKode]=useState("ALL");
  const [filterTipe,setFilterTipe]=useState("FS");
  const [showKeluar,setShowKeluar]=useState<any>(null);
  const [showMasuk,setShowMasuk]=useState<any>(null);
  const [keluarForm,setKeluarForm]=useState({jumlah:1,proyek:"",panel:"",keterangan:""});
  const [masukForm,setMasukForm]=useState({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  const [delId,setDelId]=useState<any>(null);

  const getUname=()=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    return user?.name||user?.nama||sess?.nama||"Admin";
  };

  useEffect(()=>{
    fetchAll();
    // Realtime listener untuk komponen_stok
    const ch=supabase.channel("realtime-komponen-stok")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.map(s=>s.id===payload.new.id?{...s,...payload.new}:s));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.some(s=>s.id===payload.new.id)?prev:[...prev,payload.new]);})
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.filter(s=>s.id!==payload.old.id));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok_masuk"},
        (payload)=>{setMasukList(prev=>prev.some(m=>m.id===payload.new.id)?prev:[payload.new,...prev]);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const fetchAll=async()=>{
    setLoading(true);
    const[{data:s},{data:m}]=await Promise.all([
      supabase.from("komponen_stok").select("*").order("nama",{ascending:true}),
      supabase.from("komponen_stok_masuk").select("*").order("tanggal",{ascending:false})
    ]);
    setStokList(s??[]);
    setMasukList(m??[]);
    setLoading(false);
  };

  const save=async()=>{
    if(!form.nama.trim())return;
    const uname=getUname();
    if(editId){
      const{data}=await supabase.from("komponen_stok").update({
        nama:form.nama.trim(),kode:form.kode.trim(),stok:Number(form.stok)||0,
        updated_at:new Date().toISOString()
      }).eq("id",editId).select().single();
      if(data){
        setStokList(prev=>prev.map(s=>s.id===editId?data:s));
        await activityLogService.insert({user_name:uname,action:"EDIT KOMPONEN STOK",
          description:"Edit komponen: "+form.nama+" ("+form.kode+")",module:"stok",halaman:"System"});
      }
      setEditId(null);
    } else {
      const{data}=await supabase.from("komponen_stok").insert({
        nama:form.nama.trim(),kode:form.kode.trim(),stok:Number(form.stok)||0,created_by:uname
      }).select().single();
      if(data){
        setStokList(prev=>[...prev,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH KOMPONEN STOK",
          description:"Tambah komponen: "+form.nama+" ("+form.kode+") stok awal: "+form.stok,module:"stok",halaman:"System"});
      }
    }
    setForm({nama:"",kode:"",stok:0});
  };

  const startEdit=(s:any)=>{setEditId(s.id);setForm({nama:s.nama,kode:s.kode||"",stok:s.stok});};
  const cancelEdit=()=>{setEditId(null);setForm({nama:"",kode:"",stok:0});};

  const tambahMasuk=async()=>{
    if(!showMasuk)return;
    const jml=Number(masukForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    const uname=getUname();
    const newStok=showMasuk.stok+jml;
    // Update stok
    const{data:updated}=await supabase.from("komponen_stok").update({
      stok:newStok,updated_at:new Date().toISOString()
    }).eq("id",showMasuk.id).select().single();
    // Insert riwayat masuk
    const{data:masuk}=await supabase.from("komponen_stok_masuk").insert({
      komponen_id:showMasuk.id,nama:showMasuk.nama,
      jumlah:jml,tanggal:masukForm.tanggal,
      keterangan:masukForm.keterangan,created_by:uname
    }).select().single();
    if(updated) setStokList(prev=>prev.map(s=>s.id===showMasuk.id?updated:s));
    if(masuk) setMasukList(prev=>[masuk,...prev]);
    await activityLogService.insert({
      user_name:uname,action:"MASUK KOMPONEN",
      description:`Masuk: ${showMasuk.nama} (${showMasuk.kode||"-"}) +${jml} pcs — ${masukForm.keterangan||"-"}. Stok: ${newStok}`,
      module:"stok",halaman:"System"
    });
    setShowMasuk(null);
    setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""});
  };

  const keluarkan=async()=>{
    if(!showKeluar)return;
    const jml=Number(keluarForm.jumlah)||0;
    if(jml<=0){alert("Jumlah harus lebih dari 0!");return;}
    if(jml>showKeluar.stok){alert("Stok tidak cukup! Stok tersedia: "+showKeluar.stok);return;}
    if(!keluarForm.proyek.trim()){alert("Proyek harus diisi!");return;}
    const newStok=showKeluar.stok-jml;
    const uname=getUname();
    const{data}=await supabase.from("komponen_stok").update({
      stok:newStok,updated_at:new Date().toISOString()
    }).eq("id",showKeluar.id).select().single();
    if(data){
      setStokList(prev=>prev.map(s=>s.id===showKeluar.id?data:s));
      await activityLogService.insert({
        user_name:uname,action:"KELUAR KOMPONEN",
        description:`Keluar: ${showKeluar.nama} (${showKeluar.kode||"-"}) x${jml} pcs → Proyek: ${keluarForm.proyek}, Panel: ${keluarForm.panel||"-"}, Ket: ${keluarForm.keterangan||"-"}. Sisa: ${newStok}`,
        module:"stok",halaman:"System",proyek:keluarForm.proyek,panel:keluarForm.panel
      });
    }
    setShowKeluar(null);
    setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""});
  };

  const hapus=async()=>{
    const item=stokList.find(s=>s.id===delId);
    await supabase.from("komponen_stok_masuk").delete().eq("komponen_id",delId);
    await supabase.from("komponen_stok").delete().eq("id",delId);
    setStokList(prev=>prev.filter(s=>s.id!==delId));
    setMasukList(prev=>prev.filter(m=>m.komponen_id!==delId));
    setDelId(null);
    const uname=getUname();
    await activityLogService.insert({user_name:uname,action:"HAPUS KOMPONEN STOK",
      description:"Hapus komponen: "+(item?.nama||"-")+" ("+item?.kode+")",module:"stok",halaman:"System"});
  };

  // Hitung total masuk & keluar per komponen
  const getMasukTotal=(id:number)=>masuklist.filter(m=>m.komponen_id===id).reduce((a:number,m:any)=>a+m.jumlah,0);
  const getKeluarTotal=(id:number)=>{
    const log=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+stokList.find(s=>s.id===id)?.kode+")"));
    return log.reduce((a:number,l:any)=>{
      const m=l.description?.match(/x(\d+)\s*pcs/);
      return a+(m?Number(m[1]):0);
    },0);
  };
  const getMasukTerakhir=(id:number)=>{
    const m=masuklist.filter(x=>x.komponen_id===id)[0];
    return m?{tanggal:m.tanggal,jumlah:m.jumlah}:null;
  };
  const getKeluarTerakhir=(id:number)=>{
    const log=(activityLog||[]).find((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+stokList.find(s=>s.id===id)?.kode+")"));
    if(!log)return null;
    const m=log.description?.match(/x(\d+)\s*pcs/);
    return{tanggal:log.created_at?.slice(0,10),jumlah:m?Number(m[1]):0};
  };

  const kodeList=["ALL",...Array.from(new Set(stokList.map((s:any)=>s.kode).filter(Boolean)))];
  const filtered=stokList.filter(s=>
    (filterKode==="ALL"||s.kode===filterKode)&&
    s.nama.toLowerCase().includes(search.toLowerCase())
  );

  // Riwayat gabungan masuk + keluar dari activity log
  const riwayatMasuk=masuklist.map((m:any)=>({
    tanggal:m.tanggal,kode:stokList.find(s=>s.id===m.komponen_id)?.kode||"-",
    nama:m.nama,tipe:"masuk",jumlah:m.jumlah,
    keterangan:m.keterangan||"-",panel:"-",oleh:m.created_by||"-"
  }));
  const riwayatKeluar=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN").map((l:any)=>{
    const mJml=l.description?.match(/x(\d+)\s*pcs/);
    const mKode=l.description?.match(/\(([^)]+)\)/);
    return{
      tanggal:l.created_at?.slice(0,10),
      kode:mKode?mKode[1]:"-",
      nama:l.description?.split(" x")?.[0]?.replace("Keluar: ",""),
      tipe:"keluar",jumlah:mJml?Number(mJml[1]):0,
      keterangan:l.description,panel:l.panel||"-",oleh:l.user_name
    };
  });
  const riwayat=[...riwayatMasuk,...riwayatKeluar]
    .filter(r=>{
      const matchTipe=filterTipe==="ALL"||(filterTipe==="masuk"&&r.tipe==="masuk")||(filterTipe==="keluar"&&r.tipe==="keluar");
      const matchKode=filterKode==="ALL"||r.kode===filterKode;
      const matchSearch=!search||r.nama?.toLowerCase().includes(search.toLowerCase());
      return matchTipe&&matchKode&&matchSearch;
    })
    .sort((a,b)=>b.tanggal?.localeCompare(a.tanggal));

  const totalMasuk=masuklist.reduce((a:number,m:any)=>a+m.jumlah,0);
  const totalKeluar=stokList.reduce((a:number,s:any)=>a+getKeluarTotal(s.id),0);
  const totalStok=stokList.reduce((a:number,s:any)=>a+s.stok,0);

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
    textTransform:"uppercase",letterSpacing:.4};

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
        {[
          {l:"Total Komponen",v:stokList.length,c:"#2563eb"},
          {l:"Stok Tersedia",v:totalStok+" pcs",c:"#16a34a"},
          {l:"Total Masuk",v:"+"+totalMasuk,c:"#16a34a"},
          {l:"Total Keluar",v:"-"+totalKeluar,c:"#dc2626"},
        ].map((s,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",padding:"10px 14px"}}>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
            <div style={{fontSize:20,fontWeight:700,color:s.c,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Form tambah/edit */}
      <Card style={{marginBottom:14,display:invTab==="data"?"block":"none"}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>
          {editId?"✏️ Edit Komponen":"➕ Tambah Komponen"}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap" as const,alignItems:"flex-end"}}>
          <div style={{minWidth:120}}>
            <Lbl>Kode</Lbl>
            <Inp value={form.kode} onChange={(e:any)=>setForm({...form,kode:e.target.value})}
              placeholder="FR-001..." style={{width:120}}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <Lbl>Nama Komponen</Lbl>
            <Inp value={form.nama} onChange={(e:any)=>setForm({...form,nama:e.target.value})}
              placeholder="Nama komponen..." onKeyDown={(e:any)=>e.key==="Enter"&&save()}/>
          </div>
          <div style={{minWidth:100}}>
            <Lbl>Stok Awal (pcs)</Lbl>
            <Inp type="number" min="0" value={form.stok}
              onChange={(e:any)=>setForm({...form,stok:e.target.value})}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={cancelEdit}>Batal</Btn>}
          </div>
        </div>
      </Card>

      {/* Filter + Search */}
      <div style={{display:invTab==="data"?"flex":"none",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center"}}>
        <select value={filterKode} onChange={e=>setFilterKode(e.target.value)}
          style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:150}}>
          {kodeList.map(k=><option key={k} value={k}>{k==="ALL"?"Semua Kode":k}</option>)}
        </select>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",flex:1,minWidth:180}}/>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} komponen</span>
      </div>

      {/* Tabel Komponen */}
      <div style={{display:invTab==="data"?"block":"none"}}>
      {loading?(
        <div style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Memuat...</div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:16}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr>
              <th style={{...thS,width:36,textAlign:"center" as const}}>No</th>
              <th style={thS}>Kode</th>
              <th style={thS}>Nama Komponen</th>
              <th style={{...thS,textAlign:"center" as const}}>QTY Total</th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Masuk</th>
              <th style={{...thS,textAlign:"center" as const}}>Tgl Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Jml Keluar</th>
              <th style={{...thS,textAlign:"center" as const}}>Progress</th>
            </tr></thead>
            <tbody>
              {filtered.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"#94a3b8"}}>
                  Belum ada komponen
                </td></tr>
              ):filtered.map((s:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const isEdit=editId===s.id;
                const masukTerakhir=getMasukTerakhir(s.id);
                const keluarTerakhir=getKeluarTerakhir(s.id);
                const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
                const td:any={padding:"8px 10px",borderBottom:"1px solid #f1f5f9",
                  borderRight:"1px solid #f1f5f9",background:isEdit?"#eff6ff":rBg,verticalAlign:"middle"};
                return(
                  <tr key={s.id}>
                    <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                    <td style={td}>
                      {s.kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{s.kode}</span>
                        :<span style={{color:"#cbd5e1",fontSize:10}}>—</span>}
                    </td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:stokColor+"18",color:stokColor,border:`1px solid ${stokColor}33`,
                        borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800}}>
                        {s.stok} pcs
                      </span>
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {masukTerakhir?fmtDate(masukTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#16a34a",fontWeight:700}}>
                      {masukTerakhir?"+"+masukTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>
                      {keluarTerakhir?fmtDate(keluarTerakhir.tanggal):"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const,color:"#dc2626",fontWeight:700}}>
                      {keluarTerakhir?"-"+keluarTerakhir.jumlah:"—"}
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                        <button onClick={()=>{setShowMasuk(s);setMasukForm({jumlah:1,tanggal:new Date().toISOString().slice(0,10),keterangan:""}); }}
                          style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#16a34a",fontWeight:600}}>
                          +Masuk
                        </button>
                        <button onClick={()=>{setShowKeluar(s);setKeluarForm({jumlah:1,proyek:"",panel:"",keterangan:""}); }}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 7px",cursor:"pointer",fontSize:10,color:"#dc2626",fontWeight:600}}>
                          Keluar
                        </button>
                        <button onClick={()=>startEdit(s)}
                          style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#475569"}}>✏️</button>
                        <button onClick={()=>setDelId(s.id)}
                          style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:5,
                            padding:"3px 6px",cursor:"pointer",fontSize:10,color:"#dc2626"}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Riwayat Transaksi */}
      <div style={{background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden",display:invTab==="riwayat"?"block":"none"}}>
        <div style={{padding:"10px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>📋 Riwayat Transaksi</span>
          <select value={filterTipe} onChange={e=>setFilterTipe(e.target.value)}
            style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,
              fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
            <option value="ALL">Semua Tipe</option>
            <option value="masuk">Masuk</option>
            <option value="keluar">Keluar</option>
          </select>
        </div>
        <div style={{overflowX:"auto" as const}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              {["Tanggal","Kode","Komponen","Tipe","Jumlah","Proyek","Panel","Keterangan","Oleh"].map(h=>(
                <th key={h} style={{...thS,fontSize:9.5}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {riwayat.length===0?(
                <tr><td colSpan={9} style={{textAlign:"center",padding:"24px",color:"#94a3b8"}}>Belum ada riwayat</td></tr>
              ):riwayat.slice(0,50).map((r:any,i:number)=>{
                const rBg=i%2===0?"#fff":"#f8fafc";
                const td2:any={padding:"7px 10px",borderBottom:"1px solid #f5f7fa",
                  borderRight:"1px solid #f5f7fa",background:rBg,verticalAlign:"middle"};
                const isMasuk=r.tipe==="masuk";
                return(
                  <tr key={i}>
                    <td style={{...td2,color:"#94a3b8"}}>{fmtDate(r.tanggal)}</td>
                    <td style={td2}>
                      {r.kode&&r.kode!=="-"?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                        borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700}}>{r.kode}</span>
                        :<span style={{color:"#cbd5e1"}}>—</span>}
                    </td>
                    <td style={{...td2,fontWeight:600,color:"#1e293b"}}>{r.nama}</td>
                    <td style={td2}>
                      <span style={{background:isMasuk?"#f0fdf4":"#fef2f2",
                        color:isMasuk?"#16a34a":"#dc2626",
                        border:`1px solid ${isMasuk?"#bbf7d0":"#fecaca"}`,
                        borderRadius:20,padding:"1px 8px",fontSize:9,fontWeight:700}}>
                        {isMasuk?"Masuk":"Keluar"}
                      </span>
                    </td>
                    <td style={{...td2,textAlign:"center" as const,fontWeight:700,color:isMasuk?"#16a34a":"#dc2626"}}>
                      {isMasuk?"+":"-"}{r.jumlah}
                    </td>
                    <td style={{...td2,color:"#475569"}}>{r.proyek||"—"}</td>
                    <td style={{...td2,color:"#475569"}}>{r.panel||"—"}</td>
                    <td style={{...td2,color:"#94a3b8",maxWidth:160,overflow:"hidden" as const,textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{r.keterangan||"—"}</td>
                    <td style={{...td2,color:"#64748b"}}>{r.oleh}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Masuk */}
      {showMasuk&&(
        <Modal title={"+ Stok Masuk: "+showMasuk.nama} onClose={()=>setShowMasuk(null)} width={400}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok saat ini: <strong style={{color:"#1d4ed8"}}>{showMasuk.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Masuk (pcs)</Lbl>
              <Inp type="number" min="1" value={masukForm.jumlah}
                onChange={(e:any)=>setMasukForm({...masukForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Tanggal Masuk</Lbl>
              <Inp type="date" value={masukForm.tanggal}
                onChange={(e:any)=>setMasukForm({...masukForm,tanggal:e.target.value})}/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={masukForm.keterangan}
                onChange={(e:any)=>setMasukForm({...masukForm,keterangan:e.target.value})}
                placeholder="Contoh: Terima dari supplier..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowMasuk(null)}>Batal</Btn>
            <Btn color="#16a34a" onClick={tambahMasuk}>+ Simpan Masuk</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Keluar */}
      {showKeluar&&(
        <Modal title={"📤 Keluarkan: "+showKeluar.nama} onClose={()=>setShowKeluar(null)} width={420}>
          <div style={{marginBottom:8,padding:"8px 12px",background:"#f8fafc",borderRadius:8,fontSize:12}}>
            Stok tersedia: <strong style={{color:"#1d4ed8"}}>{showKeluar.stok} pcs</strong>
          </div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:12}}>
            <div>
              <Lbl>Jumlah Keluar (pcs)</Lbl>
              <Inp type="number" min="1" max={showKeluar.stok} value={keluarForm.jumlah}
                onChange={(e:any)=>setKeluarForm({...keluarForm,jumlah:e.target.value})}/>
            </div>
            <div>
              <Lbl>Proyek *</Lbl>
              <Inp value={keluarForm.proyek} onChange={(e:any)=>setKeluarForm({...keluarForm,proyek:e.target.value})}
                placeholder="Nama proyek..."/>
            </div>
            <div>
              <Lbl>Panel</Lbl>
              <Inp value={keluarForm.panel} onChange={(e:any)=>setKeluarForm({...keluarForm,panel:e.target.value})}
                placeholder="Nama panel (opsional)..."/>
            </div>
            <div>
              <Lbl>Keterangan</Lbl>
              <Inp value={keluarForm.keterangan} onChange={(e:any)=>setKeluarForm({...keluarForm,keterangan:e.target.value})}
                placeholder="Keterangan tambahan..."/>
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setShowKeluar(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={keluarkan}>📤 Keluarkan</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Hapus */}
      {delId&&(
        <Modal title="Hapus Komponen?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Komponen <strong>{stokList.find(s=>s.id===delId)?.nama}</strong> dan semua riwayat masuknya akan dihapus permanen.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={hapus}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}



function StokMonitoringTab({user,activityLog}:any){
  const [stokList,setStokList]=useState<any[]>([]);
  const [masukList,setMasukList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [filterKode,setFilterKode]=useState<string[]>([]);
  const [showKodeDD,setShowKodeDD]=useState(false);
  const [modalTipe,setModalTipe]=useState<"masuk"|"keluar"|null>(null);

  useEffect(()=>{
    fetchAll();
    const ch=supabase.channel("realtime-stok-monitor")
      .on("postgres_changes",{event:"*",schema:"public",table:"komponen_stok"},
        ()=>{fetchAll();})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok_masuk"},
        (payload)=>{setMasukList(prev=>prev.some(m=>m.id===payload.new.id)?prev:[payload.new,...prev]);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const fetchAll=async()=>{
    const[{data:s},{data:m}]=await Promise.all([
      supabase.from("komponen_stok").select("*").order("nama",{ascending:true}),
      supabase.from("komponen_stok_masuk").select("*").order("tanggal",{ascending:false})
    ]);
    setStokList(s??[]);
    setMasukList(m??[]);
    setLoading(false);
  };

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"-";

  // Hitung total masuk bulan ini
  const now=new Date();
  const bulanIni=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const masukBulanIni=masukList.filter(m=>m.tanggal?.startsWith(bulanIni));
  const totalMasukBulan=masukBulanIni.reduce((a:number,m:any)=>a+m.jumlah,0);

  // Hitung keluar dari activity log bulan ini
  const riwayatKeluar=(activityLog||[]).filter((l:any)=>l.action==="KELUAR KOMPONEN");
  const keluarBulanIni=riwayatKeluar.filter((l:any)=>l.created_at?.startsWith(bulanIni));
  const totalKeluarBulan=keluarBulanIni.reduce((a:number,l:any)=>{
    const m=l.description?.match(/x(\d+)\s*pcs/);
    return a+(m?Number(m[1]):0);
  },0);

  // Terakhir update per komponen
  const getMasukTerakhir=(id:number)=>{
    const m=masukList.filter(x=>x.komponen_id===id)[0];
    return m?{tanggal:m.tanggal,jumlah:m.jumlah}:null;
  };
  const getKeluarTerakhir=(id:number)=>{
    const kode=stokList.find(s=>s.id===id)?.kode;
    const log=(activityLog||[]).find((l:any)=>l.action==="KELUAR KOMPONEN"&&l.description?.includes("("+kode+")"));
    if(!log)return null;
    const m=log.description?.match(/x(\d+)\s*pcs/);
    return{tanggal:log.created_at?.slice(0,10),jumlah:m?Number(m[1]):0};
  };

  const kodeList=[...Array.from(new Set(stokList.map((s:any)=>s.kode).filter(Boolean))) as string[]];

  const filtered=stokList.filter(s=>{
    const matchKode=filterKode.length===0||filterKode.includes(s.kode);
    const matchSearch=!search||s.nama.toLowerCase().includes(search.toLowerCase())||s.kode?.toLowerCase().includes(search.toLowerCase());
    return matchKode&&matchSearch;
  });

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 12px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  // Modal transaksi masuk bulan ini
  const MasukModal=()=>(
    <Modal title={"📥 Transaksi Masuk — "+new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})} onClose={()=>setModalTipe(null)} width={640}>
      <div style={{overflowX:"auto" as const}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>
            {["Tanggal","Kode","Komponen","Jumlah","Keterangan","Oleh"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {masukBulanIni.length===0?(
              <tr><td colSpan={6} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada transaksi masuk bulan ini</td></tr>
            ):masukBulanIni.map((m:any,i:number)=>{
              const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",fontSize:11,verticalAlign:"middle" as const};
              const kode=stokList.find(s=>s.id===m.komponen_id)?.kode;
              return(
                <tr key={i}>
                  <td style={{...td,color:"#64748b"}}>{fmtDate(m.tanggal)}</td>
                  <td style={td}>{kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{kode}</span>:<span style={{color:"#cbd5e1"}}>—</span>}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{m.nama}</td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#16a34a"}}>+{m.jumlah} pcs</td>
                  <td style={{...td,color:"#94a3b8",maxWidth:160}}>{m.keterangan||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{m.created_by||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );

  const KeluarModal=()=>(
    <Modal title={"📤 Transaksi Keluar — "+new Date().toLocaleDateString("id-ID",{month:"long",year:"numeric"})} onClose={()=>setModalTipe(null)} width={680}>
      <div style={{overflowX:"auto" as const}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead><tr>
            {["Tanggal","Kode","Komponen","Jumlah","Proyek","Panel","Oleh"].map(h=>(
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {keluarBulanIni.length===0?(
              <tr><td colSpan={7} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada transaksi keluar bulan ini</td></tr>
            ):keluarBulanIni.map((l:any,i:number)=>{
              const mJml=l.description?.match(/x(\d+)\s*pcs/);
              const mKode=l.description?.match(/\(([^)]+)\)/);
              const jml=mJml?Number(mJml[1]):0;
              const kode=mKode?mKode[1]:"-";
              const nama=l.description?.split(" x")?.[0]?.replace("Keluar: ","");
              const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",fontSize:11,verticalAlign:"middle" as const};
              return(
                <tr key={i}>
                  <td style={{...td,color:"#64748b"}}>{fmtDate(l.created_at?.slice(0,10))}</td>
                  <td style={td}>{kode&&kode!=="-"?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{kode}</span>:<span style={{color:"#cbd5e1"}}>—</span>}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{nama}</td>
                  <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#dc2626"}}>-{jml} pcs</td>
                  <td style={{...td,color:"#475569"}}>{l.proyek||"—"}</td>
                  <td style={{...td,color:"#475569"}}>{l.panel||"—"}</td>
                  <td style={{...td,color:"#64748b"}}>{l.user_name||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data stok...</div>;

  return(
    <div className="fi">
      {/* Stat Cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:8,marginBottom:14}}>
        <div style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px"}}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>Total Komponen</div>
          <div style={{fontSize:22,fontWeight:700,color:"#2563eb",marginTop:4}}>{stokList.length}</div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>jenis komponen</div>
        </div>
        <div onClick={()=>setModalTipe("masuk")}
          style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px",cursor:"pointer",transition:"box-shadow .15s"}}
          onMouseEnter={(e:any)=>e.currentTarget.style.border="1px solid #bbf7d0"}
          onMouseLeave={(e:any)=>e.currentTarget.style.border="1px solid var(--border-color,#e2e8f0)"}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-arrow-down" style={{fontSize:11,color:"#16a34a"}}/>Masuk Bulan Ini
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#16a34a",marginTop:4}}>+{totalMasukBulan}</div>
          <div style={{fontSize:10,color:"#16a34a",marginTop:2}}>pcs · {masukBulanIni.length} transaksi · klik untuk detail</div>
        </div>
        <div onClick={()=>setModalTipe("keluar")}
          style={{background:"var(--card-bg,#fff)",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)",padding:"10px 14px",cursor:"pointer",transition:"box-shadow .15s"}}
          onMouseEnter={(e:any)=>e.currentTarget.style.border="1px solid #fecaca"}
          onMouseLeave={(e:any)=>e.currentTarget.style.border="1px solid var(--border-color,#e2e8f0)"}>
          <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3,display:"flex",alignItems:"center",gap:4}}>
            <i className="ti ti-arrow-up" style={{fontSize:11,color:"#dc2626"}}/>Keluar Bulan Ini
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#dc2626",marginTop:4}}>-{totalKeluarBulan}</div>
          <div style={{fontSize:10,color:"#dc2626",marginTop:2}}>pcs · {keluarBulanIni.length} transaksi · klik untuk detail</div>
        </div>
      </div>

      {/* Filter + Search */}
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap" as const,alignItems:"center",position:"relative" as const}}>
        {/* Multi-select dropdown kode */}
        <div style={{position:"relative" as const}}>
          <button onClick={()=>setShowKodeDD(p=>!p)}
            style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
              fontSize:11,background:"var(--input-bg,#fff)",color:"var(--text-secondary,#475569)",
              cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,minWidth:140}}>
            <i className="ti ti-filter" style={{fontSize:12}}/>
            {filterKode.length===0?"Semua Kode":filterKode.length+" kode dipilih"}
            <i className="ti ti-chevron-down" style={{fontSize:11,marginLeft:"auto"}}/>
          </button>
          {showKodeDD&&(
            <div style={{position:"absolute" as const,top:34,left:0,zIndex:100,
              background:"var(--card-bg,#fff)",border:"1px solid #e2e8f0",
              borderRadius:8,boxShadow:"0 4px 16px #00000015",minWidth:180,padding:6}}>
              <div style={{padding:"4px 8px",fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>Filter Kode</div>
              {filterKode.length>0&&(
                <button onClick={()=>setFilterKode([])}
                  style={{width:"100%",padding:"5px 8px",background:"#fef2f2",border:"none",
                    borderRadius:6,color:"#dc2626",fontSize:11,cursor:"pointer",fontFamily:"inherit",textAlign:"left" as const,marginBottom:4}}>
                  ✕ Reset filter
                </button>
              )}
              {kodeList.map((k:string)=>{
                const isSel=filterKode.includes(k);
                return(
                  <div key={k} onClick={()=>setFilterKode(prev=>isSel?prev.filter(x=>x!==k):[...prev,k])}
                    style={{padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:11,
                      display:"flex",alignItems:"center",gap:8,
                      background:isSel?"#eff6ff":"transparent",color:isSel?"#1d4ed8":"var(--text-primary,#1e293b)"}}>
                    <span style={{width:14,height:14,borderRadius:3,border:`1.5px solid ${isSel?"#1d4ed8":"#cbd5e1"}`,
                      background:isSel?"#1d4ed8":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {isSel&&<i className="ti ti-check" style={{fontSize:10,color:"#fff"}}/>}
                    </span>
                    {k}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {showKodeDD&&<div style={{position:"fixed" as const,inset:0,zIndex:99}} onClick={()=>setShowKodeDD(false)}/>}
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Cari nama / kode komponen..."
          style={{height:30,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,
            fontSize:12,background:"var(--input-bg,#fff)",outline:"none",
            color:"var(--text-primary,#1e293b)",fontFamily:"inherit",flex:1,minWidth:180}}/>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} komponen</span>
        <span style={{fontSize:10,color:"#94a3b8",padding:"2px 8px",background:"var(--bg-tertiary,#f1f5f9)",borderRadius:5}}>👁 Read-only</span>
      </div>

      {/* Tabel */}
      <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr>
            <th style={{...thS,width:36,textAlign:"center" as const}}>No</th>
            <th style={thS}>Kode</th>
            <th style={thS}>Nama Komponen</th>
            <th style={{...thS,textAlign:"center" as const}}>Stok</th>
            <th style={{...thS,textAlign:"center" as const}}>Tgl Masuk Terakhir</th>
            <th style={{...thS,textAlign:"center" as const}}>Jml Masuk</th>
            <th style={{...thS,textAlign:"center" as const}}>Tgl Keluar Terakhir</th>
            <th style={{...thS,textAlign:"center" as const}}>Jml Keluar</th>
          </tr></thead>
          <tbody>
            {filtered.length===0?(
              <tr><td colSpan={8} style={{textAlign:"center",padding:32,color:"#94a3b8"}}>Tidak ada data</td></tr>
            ):filtered.map((s:any,i:number)=>{
              const rBg=i%2===0?"var(--card-bg,#fff)":"var(--bg-secondary,#f8fafc)";
              const masukT=getMasukTerakhir(s.id);
              const keluarT=getKeluarTerakhir(s.id);
              const stokColor=s.stok===0?"#dc2626":s.stok<=5?"#f59e0b":"#16a34a";
              const td:any={padding:"8px 12px",borderBottom:"1px solid #f1f5f9",
                borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle" as const};
              return(
                <tr key={s.id}>
                  <td style={{...td,textAlign:"center" as const,color:"#94a3b8",fontWeight:600}}>{i+1}</td>
                  <td style={td}>
                    {s.kode?<span style={{background:"#eff6ff",color:"#1d4ed8",border:"1px solid #bfdbfe",
                      borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:700}}>{s.kode}</span>
                      :<span style={{color:"#cbd5e1",fontSize:10}}>—</span>}
                  </td>
                  <td style={{...td,fontWeight:600,color:"var(--text-primary,#1e293b)"}}>{s.nama}</td>
                  <td style={{...td,textAlign:"center" as const}}>
                    <span style={{background:stokColor+"18",color:stokColor,
                      border:`1px solid ${stokColor}33`,borderRadius:20,
                      padding:"2px 10px",fontSize:11,fontWeight:800}}>
                      {s.stok} pcs
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>{masukT?fmtDate(masukT.tanggal):"—"}</td>
                  <td style={{...td,textAlign:"center" as const,color:"#16a34a",fontWeight:700}}>{masukT?"+"+masukT.jumlah+" pcs":"—"}</td>
                  <td style={{...td,textAlign:"center" as const,fontSize:11,color:"#64748b"}}>{keluarT?fmtDate(keluarT.tanggal):"—"}</td>
                  <td style={{...td,textAlign:"center" as const,color:"#dc2626",fontWeight:700}}>{keluarT?"-"+keluarT.jumlah+" pcs":"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalTipe==="masuk"&&<MasukModal/>}
      {modalTipe==="keluar"&&<KeluarModal/>}
    </div>
  );
}

function KapasitasPekerjaanTab(){
  const [processList,setProcessList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [activeTab,setActiveTab]=useState("processtime");
  const [editProc,setEditProc]=useState<any>(null);
  const [showAddProc,setShowAddProc]=useState(false);
  const [procForm,setProcForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
  const [overrideList,setOverrideList]=useState<any[]>([]);
  const [editOverride,setEditOverride]=useState<any>(null);
  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});
  const PROSES_ORANG=["WIRING POWER","WIRING CONTROL"];
  const isProsesOrang=(p:string)=>PROSES_ORANG.includes(p);
  const [overrideMode,setOverrideMode]=useState<"single"|"rentang">("single");
  const [rentangForm,setRentangForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),tanggalAkhir:new Date().toISOString().slice(0,10),hariAktif:[1,2,3,4,5] as number[],jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});
  const [rentangSaving,setRentangSaving]=useState(false);
  const [rentangResult,setRentangResult]=useState<{sukses:number;skip:number}|null>(null);

  const HARI_LABEL_OV:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};
  const [filterProsesOverride,setFilterProsesOverride]=useState<string[]>([]);

  const overrideListFiltered=useMemo(()=>{
    if(filterProsesOverride.length===0)return overrideList;
    return overrideList.filter((o:any)=>filterProsesOverride.includes(o.jenis_pekerjaan));
  },[overrideList,filterProsesOverride]);

  const overrideJam=overrideListFiltered.filter((o:any)=>o.tipe_kapasitas!=="orang");
  const overrideOrang=overrideListFiltered.filter((o:any)=>o.tipe_kapasitas==="orang");

  const toggleHariRentang=(h:number)=>{
    setRentangForm(prev=>({...prev,hariAktif:prev.hariAktif.includes(h)?prev.hariAktif.filter(x=>x!==h):[...prev.hariAktif,h].sort()}));
  };

  const saveRentangOverride=async()=>{
    if(!rentangForm.tanggalMulai||!rentangForm.tanggalAkhir||rentangForm.hariAktif.length===0)return;
    if(rentangForm.tanggalAkhir<rentangForm.tanggalMulai){alert("Tanggal akhir harus setelah tanggal mulai");return;}
    setRentangSaving(true);
    setRentangResult(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const createdBy=sess?.nama||sess?.name||"Admin";
    const rows:any[]=[];
    let cur=new Date(rentangForm.tanggalMulai);
    const end=new Date(rentangForm.tanggalAkhir);
    let safety=0;
    while(cur<=end&&safety<366){
      const hari=cur.getDay()===0?7:cur.getDay();
      if(rentangForm.hariAktif.includes(hari)){
        rows.push({
          tanggal:cur.toISOString().slice(0,10),
          jenis_pekerjaan:rentangForm.jenis_pekerjaan,
          jam_kerja:Number(rentangForm.jam_kerja),
          efektivitas_pct:Number(rentangForm.efektivitas_pct),
          keterangan:rentangForm.keterangan,
          created_by:createdBy,
        });
      }
      cur.setDate(cur.getDate()+1);
      safety++;
    }
    if(rows.length===0){setRentangSaving(false);alert("Tidak ada tanggal yang match dengan hari terpilih");return;}
    const{data,error}=await supabase.from("fcs_kapasitas_override").upsert(rows,{onConflict:"tanggal,jenis_pekerjaan",ignoreDuplicates:false}).select();
    setRentangSaving(false);
    if(error){alert("Gagal: "+error.message);return;}
    setRentangResult({sukses:data?.length||0,skip:rows.length-(data?.length||0)});
    await fetchOverride();
  };
  const [filterTipe,setFilterTipe]=useState("FS");
  const [filterPekerjaan,setFilterPekerjaan]=useState("ALL");
  const [search,setSearch]=useState("");

  const HARI_LABEL:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};
  const ALL_PROSES=["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
  const ALL_TIPE=["FS","F3B","WM_MS","WM_POLY"];
  const ALL_WP=["WP1","WP2","WP3","WP4","WP5","WP6"];

  useEffect(()=>{
    fetchAll();
    fetchOverride();
  },[]);

  const fetchOverride=async()=>{
    const{data}=await supabase.from("fcs_kapasitas_override").select("*").order("tanggal",{ascending:false});
    setOverrideList(data??[]);
  };

  const saveOverride=async()=>{
    const isOrang=isProsesOrang(overrideForm.jenis_pekerjaan);
    if(!overrideForm.tanggal)return;
    if(isOrang&&!overrideForm.jumlah_orang)return;
    if(!isOrang&&!overrideForm.jam_kerja)return;
    if(!editOverride){
      const existing=overrideList.find((o:any)=>o.tanggal===overrideForm.tanggal&&o.jenis_pekerjaan===overrideForm.jenis_pekerjaan);
      if(existing){
        setEditOverride(existing);
        setOverrideForm({tanggal:existing.tanggal,jenis_pekerjaan:existing.jenis_pekerjaan,jam_kerja:overrideForm.jam_kerja,efektivitas_pct:overrideForm.efektivitas_pct,jumlah_orang:overrideForm.jumlah_orang,keterangan:overrideForm.keterangan});
        return;
      }
    }
    const payload:any=isOrang
      ?{tipe_kapasitas:"orang",jumlah_orang:Number(overrideForm.jumlah_orang),jam_kerja:null,efektivitas_pct:100,keterangan:overrideForm.keterangan}
      :{tipe_kapasitas:"jam",jam_kerja:Number(overrideForm.jam_kerja),efektivitas_pct:Number(overrideForm.efektivitas_pct),jumlah_orang:null,keterangan:overrideForm.keterangan};
    if(editOverride){
      const{error}=await supabase.from("fcs_kapasitas_override").update(payload).eq("id",editOverride.id);
      if(!error){await fetchOverride();setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});}
      else alert("Gagal simpan: "+error.message);
    } else {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const{error}=await supabase.from("fcs_kapasitas_override").insert({
        tanggal:overrideForm.tanggal,
        jenis_pekerjaan:overrideForm.jenis_pekerjaan,
        ...payload,
        created_by:sess?.nama||sess?.name||"Admin",
      });
      if(!error){await fetchOverride();setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});}
      else alert("Gagal simpan: "+(error.message.includes("duplicate")?"Tanggal + pekerjaan ini sudah ada overridenya":error.message));
    }
  };

  const deleteOverride=async(id:number)=>{
    await supabase.from("fcs_kapasitas_override").delete().eq("id",id);
    setOverrideList(prev=>prev.filter((o:any)=>o.id!==id));
  };

  const fetchAll=async()=>{
    setLoading(true);
    const{data:p}=await supabase.from("fcs_process_time").select("*").order("tipe_panel,wp,kode_komponen");
    setProcessList(p??[]);
    setLoading(false);
  };

  const saveProcess=async()=>{
    if(!procForm.kode_komponen.trim()||!procForm.nama_komponen.trim())return;
    if(editProc){
      const{error}=await supabase.from("fcs_process_time").update({
        nama_komponen:procForm.nama_komponen,
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).eq("id",editProc.id);
      if(!error){
        setProcessList(prev=>prev.map(p=>p.id===editProc.id?{...p,...procForm}:p));
        setEditProc(null);setShowAddProc(false);
      }
    } else {
      const{data,error}=await supabase.from("fcs_process_time").insert({
        kode_komponen:procForm.kode_komponen.trim(),
        nama_komponen:procForm.nama_komponen.trim(),
        tipe_panel:procForm.tipe_panel,
        wp:procForm.wp,
        jenis_pekerjaan:procForm.jenis_pekerjaan,
        menit_per_pcs:Number(procForm.menit_per_pcs),
      }).select().single();
      if(!error&&data){
        setProcessList(prev=>[...prev,data]);
        setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
        setShowAddProc(false);
      }
    }
  };

  const deleteProcess=async(id:number)=>{
    await supabase.from("fcs_process_time").delete().eq("id",id);
    setProcessList(prev=>prev.filter(p=>p.id!==id));
  };

  const toggleHari=(item:any,hari:number)=>{
    const curr=item.hari_kerja||[];
    const updated=curr.includes(hari)?curr.filter((h:number)=>h!==hari):[...curr,hari].sort();
    setEditKap({...item,hari_kerja:updated});
  };

  const filteredProcess=processList.filter(p=>{
    const matchTipe=filterTipe==="ALL"||p.tipe_panel===filterTipe;
    const matchPek=filterPekerjaan==="ALL"||p.jenis_pekerjaan===filterPekerjaan;
    const matchSearch=!search||p.nama_komponen.toLowerCase().includes(search.toLowerCase())||p.kode_komponen.toLowerCase().includes(search.toLowerCase());
    return matchTipe&&matchPek&&matchSearch;
  });

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 12px",fontWeight:600,fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Sub-tab switcher */}
      <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid #e2e8f0"}}>
        {[{id:"processtime",l:"⚡ Process Time"},{id:"override",l:"📅 Override Tanggal"}].map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{padding:"8px 18px",fontSize:12,fontWeight:activeTab===t.id?700:500,
              color:activeTab===t.id?"#1d4ed8":"#64748b",cursor:"pointer",
              background:activeTab===t.id?"#eff6ff":"transparent",
              border:"none",borderBottom:activeTab===t.id?"2px solid #1d4ed8":"2px solid transparent",
              fontFamily:"inherit",borderRadius:"6px 6px 0 0"}}>
            {t.l}
          </button>
        ))}
      </div>


      {/* TAB: Process Time */}
      {activeTab==="processtime"&&(
        <div>
          {/* Sub-tab tipe panel */}
          <div style={{display:"flex",gap:2,marginBottom:14,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
            {ALL_TIPE.map(t=>{
              const cnt=processList.filter((p:any)=>p.tipe_panel===t).length;
              return(
                <button key={t} onClick={()=>setFilterTipe(t)}
                  style={{padding:"7px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,
                    fontWeight:filterTipe===t?700:500,
                    background:filterTipe===t?"#fff":"transparent",
                    color:filterTipe===t?"#1d4ed8":"#64748b",
                    boxShadow:filterTipe===t?"0 1px 3px #00000015":"none",
                    fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  {t}
                  <span style={{background:filterTipe===t?"#eff6ff":"#e2e8f0",color:filterTipe===t?"#1d4ed8":"#94a3b8",
                    borderRadius:20,padding:"1px 7px",fontSize:10,fontWeight:700}}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="🔍 Cari komponen..."
              style={{height:30,padding:"0 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",color:"#1e293b",fontFamily:"inherit",width:200}}/>
            <select value={filterPekerjaan} onChange={e=>setFilterPekerjaan(e.target.value)}
              style={{height:30,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:11,background:"#fff",outline:"none",fontFamily:"inherit"}}>
              <option value="ALL">Semua Pekerjaan</option>
              {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
            <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filteredProcess.length} komponen</span>
            <button onClick={()=>{setShowAddProc(true);setEditProc(null);setProcForm({kode_komponen:"",nama_komponen:"",tipe_panel:filterTipe==="ALL"?"FS":filterTipe,wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});}}
              style={{height:30,padding:"0 14px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              + Tambah
            </button>
          </div>

          {/* Grouped by Jenis Pekerjaan */}
          {(filterPekerjaan==="ALL"?ALL_PROSES:[filterPekerjaan]).map((proses:string)=>{
            const groupItems=filteredProcess.filter((p:any)=>p.jenis_pekerjaan===proses);
            if(groupItems.length===0)return null;
            const procColors:any={
              POTONG:"#f59e0b",BENDING:"#8b5cf6",STEL:"#06b6d4",PAINTING:"#ec4899",
              RAKIT:"#10b981","PASANG KOMPONEN":"#3b82f6",BUSBAR:"#f43f5e",
              "WIRING CONTROL":"#6366f1","WIRING POWER":"#0ea5e9","QC TEST":"#84cc16",PACKING:"#64748b"
            };
            const pc=procColors[proses]||"#64748b";
            return(
              <div key={proses} style={{marginBottom:18}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <span style={{width:8,height:8,borderRadius:99,background:pc,display:"inline-block"}}/>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>{proses}</span>
                  <span style={{background:pc+"15",color:pc,borderRadius:20,padding:"1px 9px",fontSize:10,fontWeight:700}}>{groupItems.length} komponen</span>
                  <div style={{flex:1,height:1,background:"#f1f5f9"}}/>
                </div>

          {/* Form tambah/edit */}
          {showAddProc&&(
            <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:14}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editProc?"✏️ Edit Process Time":"➕ Tambah Process Time"}</div>
              <div style={{display:"grid",gridTemplateColumns:"120px 1fr 120px 100px 1fr 120px",gap:10,alignItems:"flex-end",flexWrap:"wrap" as const}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Kode</div>
                  <input value={procForm.kode_komponen} onChange={e=>setProcForm({...procForm,kode_komponen:e.target.value})}
                    placeholder="FS.1..." disabled={!!editProc}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editProc?"#f1f5f9":"#fff"}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Nama Komponen</div>
                  <input value={procForm.nama_komponen} onChange={e=>setProcForm({...procForm,nama_komponen:e.target.value})}
                    placeholder="Nama komponen..."
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tipe Panel</div>
                  <select value={procForm.tipe_panel} onChange={e=>setProcForm({...procForm,tipe_panel:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>WP</div>
                  <select value={procForm.wp} onChange={e=>setProcForm({...procForm,wp:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_WP.map(w=><option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                  <select value={procForm.jenis_pekerjaan} onChange={e=>setProcForm({...procForm,jenis_pekerjaan:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Menit/Pcs</div>
                  <input type="number" min="0" step="0.25" value={procForm.menit_per_pcs}
                    onChange={e=>setProcForm({...procForm,menit_per_pcs:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,justifyContent:"flex-end"}}>
                <button onClick={()=>{setShowAddProc(false);setEditProc(null);}}
                  style={{padding:"6px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                <button onClick={saveProcess}
                  style={{padding:"6px 16px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editProc?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          )}

                <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr>
                      <th style={thS}>Kode</th>
                      <th style={thS}>Nama Komponen</th>
                      <th style={{...thS,textAlign:"center" as const}}>Tipe Panel</th>
                      <th style={{...thS,textAlign:"center" as const}}>WP</th>
                      <th style={{...thS,textAlign:"center" as const}}>Menit/Pcs</th>
                      <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
                    </tr></thead>
                    <tbody>
                      {groupItems.map((p:any,i:number)=>{
                        const rBg=i%2===0?"#fff":"#f8fafc";
                        const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                        return(
                          <tr key={p.id}>
                            <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{p.kode_komponen}</td>
                            <td style={{...td,fontWeight:500,color:"#1e293b"}}>{p.nama_komponen}</td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.tipe_panel}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{p.wp}</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <span style={{fontWeight:800,fontSize:13,color:p.menit_per_pcs>0?"#1d4ed8":"#94a3b8"}}>{p.menit_per_pcs}</span>
                              <span style={{fontSize:10,color:"#94a3b8",marginLeft:3}}>mnt</span>
                            </td>
                            <td style={{...td,textAlign:"center" as const}}>
                              <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                                <button onClick={()=>{setEditProc(p);setShowAddProc(true);setProcForm({kode_komponen:p.kode_komponen,nama_komponen:p.nama_komponen,tipe_panel:p.tipe_panel,wp:p.wp,jenis_pekerjaan:p.jenis_pekerjaan,menit_per_pcs:p.menit_per_pcs});}}
                                  style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                                <button onClick={()=>deleteProcess(p.id)}
                                  style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                              </div>
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

          {filteredProcess.length===0&&(
            <div style={{textAlign:"center",padding:40,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <div style={{fontSize:28,marginBottom:8}}>📋</div>
              <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Belum ada data process time untuk {filterTipe}</div>
              <div style={{fontSize:11}}>Klik tombol + Tambah untuk input data manual</div>
            </div>
          )}
        </div>
      )}

      {/* TAB: Override Tanggal */}
      {activeTab==="override"&&(
        <div>
          <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>
            Atur jam kerja khusus per tanggal per jenis pekerjaan. Tanggal tanpa override dianggap tidak ada kapasitas (0 menit).
          </div>

          <div style={{display:"flex",gap:2,marginBottom:14,background:"#f1f5f9",borderRadius:8,padding:3,width:"fit-content"}}>
            {[{id:"single",l:"Satu Tanggal"},{id:"rentang",l:"📅 Rentang Tanggal"}].map(m=>(
              <button key={m.id} onClick={()=>{setOverrideMode(m.id as any);setEditOverride(null);setRentangResult(null);}}
                style={{padding:"6px 14px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,
                  fontWeight:overrideMode===m.id?700:500,
                  background:overrideMode===m.id?"#fff":"transparent",
                  color:overrideMode===m.id?"#1d4ed8":"#64748b",
                  boxShadow:overrideMode===m.id?"0 1px 3px #00000015":"none",fontFamily:"inherit"}}>
                {m.l}
              </button>
            ))}
          </div>

          {overrideMode==="rentang"&&(
            <div style={{background:"#fdf4ff",borderRadius:10,border:"1.5px solid #e9d5ff",padding:"14px 16px",marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>📅 Tambah Override untuk Rentang Tanggal</div>
              <div style={{display:"grid",gridTemplateColumns:"140px 140px 1fr",gap:10,marginBottom:10}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal Mulai</div>
                  <input type="date" value={rentangForm.tanggalMulai}
                    onChange={e=>setRentangForm({...rentangForm,tanggalMulai:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal Akhir</div>
                  <input type="date" value={rentangForm.tanggalAkhir}
                    onChange={e=>setRentangForm({...rentangForm,tanggalAkhir:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Hari Aktif</div>
                  <div style={{display:"flex",gap:4}}>
                    {[1,2,3,4,5,6,7].map(h=>{
                      const active=rentangForm.hariAktif.includes(h);
                      return(
                        <button key={h} onClick={()=>toggleHariRentang(h)}
                          style={{width:32,height:30,borderRadius:6,border:`1.5px solid ${active?"#9333ea":"#e2e8f0"}`,
                            background:active?"#9333ea":"#f8fafc",color:active?"#fff":"#94a3b8",
                            fontSize:10,fontWeight:700,cursor:"pointer"}}>
                          {HARI_LABEL_OV[h]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                  <select value={rentangForm.jenis_pekerjaan} onChange={e=>setRentangForm({...rentangForm,jenis_pekerjaan:e.target.value})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}>
                    {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jam Kerja</div>
                  <input type="number" min="0" step="0.5" value={rentangForm.jam_kerja}
                    onChange={e=>setRentangForm({...rentangForm,jam_kerja:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Efekt. %</div>
                  <input type="number" min="0" max="100" step="1" value={rentangForm.efektivitas_pct}
                    onChange={e=>setRentangForm({...rentangForm,efektivitas_pct:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Keterangan</div>
                  <input value={rentangForm.keterangan} onChange={e=>setRentangForm({...rentangForm,keterangan:e.target.value})}
                    placeholder="opsional..."
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                  {rentangForm.jam_kerja} jam × 60 × {rentangForm.efektivitas_pct}% = <strong>{Math.round(rentangForm.jam_kerja*60*rentangForm.efektivitas_pct/100)} menit</strong>/hari
                </div>
                <button disabled={rentangSaving} onClick={saveRentangOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:rentangSaving?"#94a3b8":"#9333ea",color:"#fff",fontSize:12,fontWeight:700,cursor:rentangSaving?"not-allowed":"pointer",fontFamily:"inherit"}}>
                  {rentangSaving?"⏳ Menyimpan...":"📅 Generate Rentang"}
                </button>
              </div>
              {rentangResult&&(
                <div style={{marginTop:10,background:rentangResult.skip>0?"#fffbeb":"#f0fdf4",border:`1px solid ${rentangResult.skip>0?"#fde68a":"#bbf7d0"}`,borderRadius:7,padding:"8px 12px",fontSize:12,color:rentangResult.skip>0?"#92400e":"#16a34a"}}>
                  ✅ {rentangResult.sukses} tanggal berhasil diatur{rentangResult.skip>0?`, ${rentangResult.skip} dilewati (sudah ada override sebelumnya)`:""}.
                </div>
              )}
            </div>
          )}

          {overrideMode==="single"&&(
          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?"✏️ Edit Override":"➕ Tambah Override"}</div>
            <div style={{display:"grid",gridTemplateColumns:"140px 160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal</div>
                <input type="date" value={overrideForm.tanggal} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,tanggal:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}/>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <select value={overrideForm.jenis_pekerjaan} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,jenis_pekerjaan:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}>
                  {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              {isProsesOrang(overrideForm.jenis_pekerjaan)?(
                <div style={{gridColumn:"span 2"}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>👥 Jumlah Orang</div>
                  <input type="number" min="0" step="1" value={overrideForm.jumlah_orang}
                    onChange={e=>setOverrideForm({...overrideForm,jumlah_orang:parseFloat(e.target.value)||0})}
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #93c5fd",fontSize:12,textAlign:"center" as const,background:"#eff6ff"}}/>
                </div>
              ):(
                <>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jam Kerja</div>
                    <input type="number" min="0" step="0.5" value={overrideForm.jam_kerja}
                      onChange={e=>setOverrideForm({...overrideForm,jam_kerja:parseFloat(e.target.value)||0})}
                      style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Efekt. %</div>
                    <input type="number" min="0" max="100" step="1" value={overrideForm.efektivitas_pct}
                      onChange={e=>setOverrideForm({...overrideForm,efektivitas_pct:parseFloat(e.target.value)||0})}
                      style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,textAlign:"center" as const}}/>
                  </div>
                </>
              )}
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Keterangan</div>
                <input value={overrideForm.keterangan} onChange={e=>setOverrideForm({...overrideForm,keterangan:e.target.value})}
                  placeholder="opsional..."
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                {isProsesOrang(overrideForm.jenis_pekerjaan)?(
                  <>{overrideForm.jumlah_orang} orang = <strong>{overrideForm.jumlah_orang} panel/hari</strong></>
                ):(
                  <>{overrideForm.jam_kerja} jam × 60 × {overrideForm.efektivitas_pct}% = <strong>{Math.round(overrideForm.jam_kerja*60*overrideForm.efektivitas_pct/100)} menit</strong></>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                {editOverride&&(
                  <button onClick={()=>{setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});}}
                    style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                )}
                <button onClick={saveOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editOverride?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          </div>
          )}

          <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,alignItems:"center",marginBottom:14}}>
            <span style={{fontSize:11,color:"#64748b",fontWeight:600}}>Filter Proses:</span>
            {filterProsesOverride.map((p:string)=>(
              <span key={p} style={{fontSize:11,background:"#eff6ff",color:"#1d4ed8",padding:"3px 10px",borderRadius:7,display:"flex",alignItems:"center",gap:4}}>
                {p}
                <button onClick={()=>setFilterProsesOverride(prev=>prev.filter(x=>x!==p))} style={{background:"none",border:"none",cursor:"pointer",color:"#1d4ed8",fontSize:11,padding:0}}>✕</button>
              </span>
            ))}
            <select value="" onChange={e=>{if(e.target.value)setFilterProsesOverride(prev=>[...prev,e.target.value]);}}
              style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
              <option value="">+ Tambah proses...</option>
              {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].filter((p:string)=>!filterProsesOverride.includes(p)).map((p:string)=>(
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            {filterProsesOverride.length>0&&(
              <button onClick={()=>setFilterProsesOverride([])} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Reset</button>
            )}
          </div>

          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>⏱ Berbasis Jam Kerja</div>
          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0",marginBottom:20}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={thS}>Tanggal</th>
                <th style={thS}>Jenis Pekerjaan</th>
                <th style={{...thS,textAlign:"center" as const}}>Jam</th>
                <th style={{...thS,textAlign:"center" as const}}>Efekt.</th>
                <th style={{...thS,textAlign:"right" as const}}>Kapasitas</th>
                <th style={thS}>Keterangan</th>
                <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
              </tr></thead>
              <tbody>
                {overrideJam.length===0?(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada override jam kerja.</td></tr>
                ):overrideJam.map((o:any,i:number)=>{
                  const rBg=i%2===0?"#fff":"#f8fafc";
                  const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                  return(
                    <tr key={o.id}>
                      <td style={{...td,fontWeight:700,color:"#1e293b"}}>{new Date(o.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={td}><span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#475569"}}>{o.jenis_pekerjaan}</span></td>
                      <td style={{...td,textAlign:"center" as const}}>{o.jam_kerja}</td>
                      <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{o.efektivitas_pct}%</td>
                      <td style={{...td,textAlign:"right" as const,fontWeight:800,color:"#1d4ed8"}}>{Math.round(o.kapasitas_menit)} mnt</td>
                      <td style={{...td,fontSize:11,color:"#64748b"}}>{o.keterangan||"—"}</td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={()=>{setEditOverride(o);setOverrideForm({tanggal:o.tanggal,jenis_pekerjaan:o.jenis_pekerjaan,jam_kerja:o.jam_kerja,efektivitas_pct:o.efektivitas_pct,jumlah_orang:overrideForm.jumlah_orang,keterangan:o.keterangan||""});}}
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                          <button onClick={()=>deleteOverride(o.id)}
                            style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>👥 Berbasis Jumlah Orang</div>
          <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>
                <th style={thS}>Tanggal</th>
                <th style={thS}>Jenis Pekerjaan</th>
                <th style={{...thS,textAlign:"right" as const}}>Jumlah Orang</th>
                <th style={thS}>Keterangan</th>
                <th style={{...thS,textAlign:"center" as const}}>Aksi</th>
              </tr></thead>
              <tbody>
                {overrideOrang.length===0?(
                  <tr><td colSpan={5} style={{textAlign:"center",padding:24,color:"#94a3b8"}}>Belum ada override jumlah orang.</td></tr>
                ):overrideOrang.map((o:any,i:number)=>{
                  const rBg=i%2===0?"#fff":"#f8fafc";
                  const td:any={padding:"7px 12px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                  return(
                    <tr key={o.id}>
                      <td style={{...td,fontWeight:700,color:"#1e293b"}}>{new Date(o.tanggal).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={td}><span style={{background:"#eff6ff",borderRadius:6,padding:"2px 10px",fontSize:11,fontWeight:700,color:"#1d4ed8"}}>{o.jenis_pekerjaan}</span></td>
                      <td style={{...td,textAlign:"right" as const,fontWeight:800,color:"#1d4ed8"}}>{o.jumlah_orang} orang</td>
                      <td style={{...td,fontSize:11,color:"#64748b"}}>{o.keterangan||"—"}</td>
                      <td style={{...td,textAlign:"center" as const}}>
                        <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                          <button onClick={()=>{setEditOverride(o);setOverrideForm({tanggal:o.tanggal,jenis_pekerjaan:o.jenis_pekerjaan,jam_kerja:overrideForm.jam_kerja,efektivitas_pct:overrideForm.efektivitas_pct,jumlah_orang:o.jumlah_orang,keterangan:o.keterangan||""});}}
                            style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                          <button onClick={()=>deleteOverride(o.id)}
                            style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity,woData}){
  const [subTab,setSubTab]=useState("masteruser");
  const [admins,setAdmins]=useState([]);
  const [mesinList,setMesinList]=useState([]);
  const [maintenanceList,setMaintenanceList]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const fetchAll=async()=>{
      setLoading(true);
      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([
        supabase.from("admins").select("*").order("created_at",{ascending:true}),
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
      ]);
      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);
      setLoading(false);
    };
    fetchAll();
    const ch=supabase.channel("realtime-maintenance-log")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.some(m=>m.id===data.id)?prev:[data,...prev]);
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.map(m=>m.id===data.id?data:m));
        })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"maintenance_log"},
        (payload)=>{setMaintenanceList(prev=>prev.filter(m=>m.id!==payload.old.id));})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const subTabs=[
    {id:"masteruser",label:"👤 Master User"},
    {id:"mesin",label:"⚙️ Master Mesin"},
    {id:"pekerja",label:"👥 Master Pekerja"},
    {id:"stok",label:"📦 Inventaris"},
    {id:"kapasitas",label:"⏱ Kapasitas Pekerjaan"},
    {id:"recycle",label:"🗑 Recycle Bin"},
  ];

  return(
    <div className="fi">
      {/* Backup Excel Button */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button onClick={async()=>{
          try{
            // Dynamic import SheetJS
            const XLSX=(window as any).XLSX;
            if(!XLSX){alert("SheetJS belum dimuat, coba refresh halaman.");return;}
            const wb=XLSX.utils.book_new();

            // Sheet 1: Work Orders
            const woRows:any[]=[];
            woRows.push(["NO WO","PROYEK","TARGET","TOTAL PANEL","AVG PROGRESS","STATUS"]);
            woData?.forEach((w:any)=>{
              const pct=woOverall(w);
              const status=pct===100?"Selesai":isDelayed(w.target)?"Terlambat":isUrgent(w.target)?"Mendesak":"On Track";
              woRows.push([w.wo,w.proyek,w.target,(w.panels||[]).length+' panel',pct+'%',status]);
            });
            const ws1=XLSX.utils.aoa_to_sheet(woRows);
            XLSX.utils.book_append_sheet(wb,ws1,"Work Orders");

            // Sheet 2: Detail Progress per Panel
            const panelRows:any[]=[];
            panelRows.push(["WO","PROYEK","PANEL","TIPE","QTY","OVERALL",...ALL_PROSES]);
            (window as any).__vt_woData?.forEach((w:any)=>{
              (w.panels||[]).forEach((p:any)=>{
                const pd=calcPanelProgress(p);
                const overall=panelOverall(p);
                panelRows.push([w.wo,w.proyek,p.nama||p.name,p.tipe,
                  Object.values(p.checklist||{}).reduce((a:any,c:any)=>a+(c.qty||0),0),
                  overall+'%',...ALL_PROSES.map(pr=>(pd[pr]||0)+'%')]);
              });
            });
            const ws2=XLSX.utils.aoa_to_sheet(panelRows);
            XLSX.utils.book_append_sheet(wb,ws2,"Progress Panel");

            // Sheet 3: Pekerja
            const pkrRows:any[]=[];
            pkrRows.push(["NAMA","DIVISI"]);
            pekerja?.forEach((p:any)=>{
              const dc=(DIVISI_CONFIG as any)[p.divisi];
              pkrRows.push([p.nama,dc?.label||p.divisi]);
            });
            const ws3=XLSX.utils.aoa_to_sheet(pkrRows);
            XLSX.utils.book_append_sheet(wb,ws3,"Master Pekerja");

            // Sheet 4: Activity Log
            const logRows:any[]=[];
            logRows.push(["WAKTU","USER","AKSI","DESKRIPSI","MODULE","HALAMAN"]);
            activityLog?.slice(0,200).forEach((l:any)=>{
              logRows.push([l.created_at,l.user_name,l.action,l.description,l.module,l.halaman]);
            });
            const ws4=XLSX.utils.aoa_to_sheet(logRows);
            XLSX.utils.book_append_sheet(wb,ws4,"Activity Log");

            // Download
            const tgl=new Date().toISOString().slice(0,10);
            XLSX.writeFile(wb,`Vista_Teknik_Backup_${tgl}.xlsx`);

            // Activity log
            const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
            await activityLogService.insert({
              user_name:user?.name||user?.nama||sess?.nama||"Admin",
              action:"BACKUP DATA",
              description:"Export backup data ke Excel",
              module:"system",halaman:"System"
            });
          }catch(e){
            alert("Gagal export: "+(e as any).message);
          }
        }}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
          background:"#16a34a",color:"#fff",border:"none",borderRadius:8,
          cursor:"pointer",fontSize:12,fontWeight:700}}>
          📥 Backup ke Excel
        </button>
      </div>

      <div style={{display:"flex",gap:0,marginBottom:20,background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)",overflow:"hidden"}}>
        {subTabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{flex:1,padding:"10px 16px",border:"none",cursor:"pointer",fontSize:12,fontWeight:700,
              background:subTab===t.id?"#1d4ed8":"transparent",
              color:subTab===t.id?"#fff":"#64748b",
              borderRight:"1px solid #e2e8f0",transition:"all .15s"}}>
            {t.label}
          </button>
        ))}
      </div>
      {loading?(
        <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat data...</div>
      ):(
        <>
          {subTab==="masteruser"&&<MasterUserTab admins={admins} setAdmins={setAdmins} user={user} pekerja={pekerja}/>}
          {subTab==="mesin"&&<MasterMesinTab mesinList={mesinList} setMesinList={setMesinList} user={user}/>}

          {subTab==="pekerja"&&<MasterPekerja pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja} logActivity={logActivity} log={null} user={user}/>}
          {subTab==="stok"&&<InventarisWrapper user={user} activityLog={activityLog}/>}
          {subTab==="kapasitas"&&<KapasitasPekerjaanTab/>}
          {subTab==="recycle"&&<RecycleBinTab user={user}/>}
        </>
      )}
    </div>
  );
}

function MasterUserTab({ admins, setAdmins, user, pekerja }){
  const [form, setForm] = useState({ nama: "", username: "", password: "", is_active: true });
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [showPwd, setShowPwd] = useState({});
  const [resetId, setResetId] = useState(null);
  const [newPwd, setNewPwd] = useState("");

  const save = async () => {
    if (!form.nama.trim() || !form.username.trim()) return;
    if (editId) {
      const { data, error } = await supabase
        .from("admins")
        .update({ nama: form.nama, username: form.username, is_active: form.is_active })
        .eq("id", editId).select().single();
      if (!error) {
        setAdmins(prev => prev.map(a => a.id === editId ? data : a));
        setEditId(null);
        setForm({ nama: "", username: "", password: "", is_active: true });
      }
    } else {
      if (!form.password.trim()) return;
      const { data, error } = await supabase
        .from("admins")
        .insert({ nama: form.nama, username: form.username, password: form.password, is_active: form.is_active })
        .select().single();
      if (!error) {
        setAdmins(prev => [...prev, data]);
        setForm({ nama: "", username: "", password: "", is_active: true });
      }
    }
  };

  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("admins").update({ password: newPwd }).eq("id", resetId);
    if (!error) {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      const target=admins.find((a:any)=>a.id===resetId);
      await activityLogService.insert({user_name:uname,action:"RESET PASSWORD ADMIN",description:"Reset password admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
      setResetId(null); setNewPwd("");
    }
  };

  const toggleActive = async (id, val) => {
    await supabase.from("admins").update({ is_active: val }).eq("id", id);
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const target=admins.find((a:any)=>a.id===id);
    await activityLogService.insert({user_name:uname,action:val?"AKTIFKAN ADMIN":"NONAKTIFKAN ADMIN",description:(val?"Aktifkan":"Nonaktifkan")+" admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
  };

  const del = async () => {
    const target=admins.find((a:any)=>a.id===delId);
    await supabase.from("admins").delete().eq("id", delId);
    setAdmins(prev => prev.filter(a => a.id !== delId));
    setDelId(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS ADMIN",description:"Hapus admin: "+(target?.nama||"-")+" ("+target?.username+")",module:"auth",halaman:"System"});
  };

  const fmtTime = (ts) => {
    if (!ts) return "\u2014";
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " " +
      new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const thS = {
    background: "#1e2330", color: "#c8d0e8", padding: "8px 10px",
    fontWeight: 600, fontSize: 10, textAlign: "left" as const,
    whiteSpace: "nowrap" as const, borderRight: "1px solid #ffffff10",
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{"⚙️"}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>Admin</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Akun login untuk dashboard admin Vista Teknik</div>
          </div>
          <span style={{ marginLeft: "auto", background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700 }}>{admins.length} admin</span>
        </div>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>{editId ? "Edit Admin" : "Tambah Admin Baru"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div><Lbl>Nama Lengkap</Lbl><Inp value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama admin..." /></div>
            <div><Lbl>Username</Lbl><Inp value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username_admin" /></div>
            {!editId && (<div><Lbl>Password</Lbl><Inp type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password awal..." /></div>)}
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Aktif
              </label>
              <Btn color="#1d4ed8" onClick={save}>{editId ? "Simpan" : "+ Tambah"}</Btn>
              {editId && (<Btn outline color="#64748b" onClick={() => { setEditId(null); setForm({ nama: "", username: "", password: "", is_active: true }); }}>Batal</Btn>)}
            </div>
          </div>
        </Card>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={thS}>NAMA</th>
              <th style={thS}>USERNAME</th>
              <th style={thS}>PASSWORD</th>
              <th style={{ ...thS, textAlign: "center" as const }}>STATUS</th>
              <th style={thS}>LAST LOGIN</th>
              <th style={thS}>DIBUAT</th>
              <th style={{ ...thS, textAlign: "center" as const }}>AKSI</th>
            </tr></thead>
            <tbody>
              {admins.map((a, i) => {
                const rBg = i % 2 === 0 ? "#fff" : "#f8fafc";
                const td: any = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", background: rBg, verticalAlign: "middle" };
                const isSelf = user?.id === a.id;
                return (
                  <tr key={a.id}>
                    <td style={{ ...td, fontWeight: 700, color: "#1e293b" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#1d4ed8", flexShrink: 0 }}>{a.nama?.slice(0, 2).toUpperCase()}</div>
                        {a.nama}
                        {isSelf && (<span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>Saya</span>)}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#475569" }}>{a.username}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>{showPwd[a.id] ? a.password : "••••••••"}</span>
                        <button onClick={() => setShowPwd(prev => ({ ...prev, [a.id]: !prev[a.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, padding: 0 }}>{showPwd[a.id] ? "hide" : "show"}</button>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <button onClick={() => !isSelf && toggleActive(a.id, !a.is_active)}
                        style={{ background: a.is_active ? "#f0fdf4" : "#fef2f2", border: "1px solid "+(a.is_active ? "#bbf7d0" : "#fecaca"), color: a.is_active ? "#16a34a" : "#dc2626", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, cursor: isSelf ? "not-allowed" : "pointer" }}>
                        {a.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(a.last_login)}</td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(a.created_at)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button onClick={() => { setEditId(a.id); setForm({ nama: a.nama, username: a.username, password: a.password, is_active: a.is_active }); }} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#475569" }}>Edit</button>
                        <button onClick={() => { setResetId(a.id); setNewPwd(""); }} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#92400e" }}>Reset Pwd</button>
                        {!isSelf && (<button onClick={() => setDelId(a.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#dc2626" }}>Hapus</button>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (<tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>Belum ada admin</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ borderTop: "2px dashed #e2e8f0", margin: "8px 0 28px" }} />
      <MasterPekerjaInline pekerja={pekerja} />
      {resetId && (
        <Modal title="Reset Password Admin" onClose={() => setResetId(null)} width={380}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>Reset password untuk <strong>{admins.find(a => a.id === resetId)?.nama}</strong></div>
          <Lbl>Password Baru</Lbl>
          <Inp type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Password baru..." style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setResetId(null)}>Batal</Btn>
            <Btn color="#f59e0b" onClick={resetPwd}>Reset Password</Btn>
          </div>
        </Modal>
      )}
      {delId && (
        <Modal title="Hapus Admin?" onClose={() => setDelId(null)} width={360}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>Admin <strong>{admins.find(a => a.id === delId)?.nama}</strong> akan dihapus permanen.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MasterPekerjaInline({pekerja}:any){
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
  const [editId, setEditId] = useState<any>(null);
  const [delId, setDelId] = useState<any>(null);
  const [showPwd, setShowPwd] = useState<any>({});
  const [resetId, setResetId] = useState<any>(null);
  const [newPwd, setNewPwd] = useState("");
  const [filterDiv, setFilterDiv] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("operator_users")
        .select("*")
        .order("divisi", { ascending: true })
        .order("nama", { ascending: true });
      if (!error) setOps(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const opDiv = Object.entries(DIVISI_CONFIG)
    .filter(([k]) => OPERATOR_ROLES.includes(k))
    .map(([k, v]: any) => ({ key: k, ...v }));

  const save = async () => {
    if (!form.nama.trim() || !form.username.trim()) return;
    if (editId) {
      const { data, error } = await supabase
        .from("operator_users")
        .update({ nama: form.nama, username: form.username, divisi: form.divisi, is_active: form.is_active })
        .eq("id", editId).select().single();
      if (!error) {
        setOps(p => p.map((o: any) => o.id === editId ? data : o));
        setEditId(null);
        setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
      }
    } else {
      if (!form.password.trim()) return;
      const { data, error } = await supabase
        .from("operator_users")
        .insert({ nama: form.nama, username: form.username, password: form.password, divisi: form.divisi, is_active: form.is_active })
        .select().single();
      if (!error) {
        setOps(p => [...p, data]);
        setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
      }
    }
  };

  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("operator_users").update({ password: newPwd }).eq("id", resetId);
    if (!error) {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      const target=ops.find((o:any)=>o.id===resetId);
      await activityLogService.insert({user_name:uname,action:"RESET PASSWORD PEKERJA",description:"Reset password pekerja: "+(target?.nama||"-"),module:"pekerja",halaman:"System"});
      setResetId(null); setNewPwd("");
    }
  };

  const toggleActive = async (id: any, val: boolean) => {
    await supabase.from("operator_users").update({ is_active: val }).eq("id", id);
    setOps(p => p.map((o: any) => o.id === id ? { ...o, is_active: val } : o));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const target=ops.find((o:any)=>o.id===id);
    await activityLogService.insert({user_name:uname,action:val?"AKTIFKAN PEKERJA":"NONAKTIFKAN PEKERJA",description:(val?"Aktifkan":"Nonaktifkan")+" user pekerja: "+(target?.nama||"-"),module:"pekerja",halaman:"System"});
  };

  const del = async () => {
    const target=ops.find((o:any)=>o.id===delId);
    await supabase.from("operator_users").delete().eq("id", delId);
    setOps(p => p.filter((o: any) => o.id !== delId));
    setDelId(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS USER PEKERJA",description:"Hapus user pekerja: "+(target?.nama||"-")+" ("+target?.username+")",module:"pekerja",halaman:"System"});
  };

  const fmtTime = (ts: string) => {
    if (!ts) return "\u2014";
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
      " " + new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const filtered = ops.filter((o: any) =>
    (filterDiv === "ALL" || o.divisi === filterDiv) &&
    (!search || o.nama.toLowerCase().includes(search.toLowerCase()) ||
      o.username.toLowerCase().includes(search.toLowerCase()))
  );

  const thS: any = {
    background: "#1e2330", color: "#c8d0e8", padding: "8px 10px",
    fontWeight: 600, fontSize: 10, textAlign: "left",
    whiteSpace: "nowrap", borderRight: "1px solid #ffffff10",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{"👷"}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>User Pekerja</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Akun login untuk Vista Pekerja (username + password)</div>
        </div>
        <span style={{ marginLeft: "auto", background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700 }}>{ops.length} pekerja</span>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>{editId ? "Edit User Pekerja" : "Tambah User Pekerja"}</div>
        <div style={{ display: "grid", gridTemplateColumns: editId ? "1fr 1fr 1fr auto" : "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
          <div><Lbl>Nama Lengkap</Lbl>
            <Sel value={form.nama} onChange={(e:any) => setForm({ ...form, nama: e.target.value })}>
              <option value="">-- Pilih dari Master Pekerja --</option>
              {(pekerja||[]).filter((p:any)=>p.divisi===form.divisi).map((p:any)=>(
                <option key={p.id} value={p.nama}>{p.nama}</option>
              ))}
            </Sel>
          </div>
          <div><Lbl>Username</Lbl><Inp value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username_pekerja" /></div>
          {!editId && (<div><Lbl>Password</Lbl><Inp type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Default: 1234" /></div>)}
          <div><Lbl>Divisi</Lbl>
            <Sel value={form.divisi} onChange={e => setForm({ ...form, divisi: e.target.value })}>
              {opDiv.map((d: any) => (<option key={d.key} value={d.key}>{d.icon} {d.label}</option>))}
            </Sel>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 2 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Aktif
            </label>
            <Btn color="#16a34a" onClick={save}>{editId ? "Simpan" : "+ Tambah"}</Btn>
            {editId && (<Btn outline color="#64748b" onClick={() => { setEditId(null); setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true }); }}>Batal</Btn>)}
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau username..."
          style={{ height: 30, padding: "0 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, background: "#f8fafc", outline: "none", color: "#1e293b", fontFamily: "inherit", width: 220 }} />
        <button onClick={() => setFilterDiv("ALL")}
          style={{ padding: "4px 14px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 700, border: filterDiv === "ALL" ? "1.5px solid #1d4ed8" : "1.5px solid #e2e8f0", background: filterDiv === "ALL" ? "#1d4ed8" : "#fff", color: filterDiv === "ALL" ? "#fff" : "#64748b" }}>
          Semua ({ops.length})
        </button>
        {opDiv.map((d: any) => {
          const cnt = ops.filter((o: any) => o.divisi === d.key).length;
          const isSel = filterDiv === d.key;
          return (
            <button key={d.key} onClick={() => setFilterDiv(isSel ? "ALL" : d.key)}
              style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 700, border: isSel ? "1.5px solid "+d.color : "1.5px solid #e2e8f0", background: isSel ? d.color+"18" : "#fff", color: isSel ? d.color : "#64748b" }}>
              {d.icon} {d.label} ({cnt})
            </button>
          );
        })}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>Memuat data...</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={thS}>NAMA</th>
              <th style={thS}>USERNAME</th>
              <th style={thS}>PASSWORD</th>
              <th style={thS}>DIVISI</th>
              <th style={{ ...thS, textAlign: "center" }}>STATUS</th>
              <th style={thS}>LAST LOGIN</th>
              <th style={thS}>DIBUAT</th>
              <th style={{ ...thS, textAlign: "center" }}>AKSI</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>{search || filterDiv !== "ALL" ? "Tidak ada pekerja ditemukan" : "Belum ada user pekerja"}</td></tr>
              ) : filtered.map((o: any, i: number) => {
                const dc: any = DIVISI_CONFIG[o.divisi] || {};
                const rBg = i % 2 === 0 ? "#fff" : "#f8fafc";
                const td: any = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", background: rBg, verticalAlign: "middle" };
                return (
                  <tr key={o.id}>
                    <td style={{ ...td, fontWeight: 700, color: "#1e293b" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: dc.bg || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: dc.color || "#64748b", flexShrink: 0 }}>{o.nama?.slice(0, 2).toUpperCase()}</div>
                        {o.nama}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#475569" }}>{o.username}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace", color: "#94a3b8", letterSpacing: 2, fontSize: 12 }}>{showPwd[o.id] ? o.password : "••••••••"}</span>
                        <button onClick={() => setShowPwd((p: any) => ({ ...p, [o.id]: !p[o.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, padding: 0 }}>{showPwd[o.id] ? "hide" : "show"}</button>
                      </div>
                    </td>
                    <td style={td}>{dc.label && (<span style={{ background: dc.bg, color: dc.color, border: "1px solid "+dc.color+"30", borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>{dc.icon} {dc.label}</span>)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <button onClick={() => toggleActive(o.id, !o.is_active)}
                        style={{ background: o.is_active ? "#f0fdf4" : "#fef2f2", border: "1px solid "+(o.is_active ? "#bbf7d0" : "#fecaca"), color: o.is_active ? "#16a34a" : "#dc2626", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {o.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(o.last_login)}</td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(o.created_at)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button onClick={() => { setEditId(o.id); setForm({ nama: o.nama, username: o.username, password: o.password, divisi: o.divisi, is_active: o.is_active }); }} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#475569" }}>Edit</button>
                        <button onClick={() => { setResetId(o.id); setNewPwd(""); }} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#92400e" }}>Reset Pwd</button>
                        <button onClick={() => setDelId(o.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#dc2626" }}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {resetId && (
        <Modal title="Reset Password Pekerja" onClose={() => setResetId(null)} width={380}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>Reset password untuk <strong>{ops.find((o: any) => o.id === resetId)?.nama}</strong></div>
          <Lbl>Password Baru</Lbl>
          <Inp type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && resetPwd()} placeholder="Password baru..." style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setResetId(null)}>Batal</Btn>
            <Btn color="#f59e0b" onClick={resetPwd}>Reset Password</Btn>
          </div>
        </Modal>
      )}
      {delId && (
        <Modal title="Hapus User Pekerja?" onClose={() => setDelId(null)} width={360}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>User <strong>{ops.find((o: any) => o.id === delId)?.nama}</strong> akan dihapus permanen.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}





function MasterMesinTab({mesinList,setMesinList,user}:any){
  const [printQR,setPrintQR]=useState<any>(null);
  const [form,setForm]=useState({kode:"",nama:"",lokasi:"",status:"aktif"});
  const [editId,setEditId]=useState<any>(null);
  const [delId,setDelId]=useState<any>(null);
  const save=async()=>{
    if(!form.kode.trim()||!form.nama.trim())return;
    if(editId){
      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){
        setMesinList((prev:any[])=>prev.map(m=>m.id===editId?data:m));
        setEditId(null);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"EDIT MESIN",description:"Edit mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    } else {
      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){
        setMesinList((prev:any[])=>[...prev,data]);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"TAMBAH MESIN",description:"Tambah mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    }
  };
  const STATUS_COLOR={aktif:"#16a34a",rusak:"#dc2626",maintenance:"#f59e0b",nonaktif:"#64748b"};


  const thS={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};

  return(
    <div>
      <Card style={{marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>
          {editId?"✏️ Edit Mesin":"➕ Tambah Mesin"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"120px 1fr 1fr 150px auto",gap:12,alignItems:"flex-end"}}>
          <div><Lbl>Kode</Lbl><Inp value={form.kode} onChange={e=>setForm({...form,kode:e.target.value})} placeholder="MSN-001"/></div>
          <div><Lbl>Nama Mesin</Lbl><Inp value={form.nama} onChange={e=>setForm({...form,nama:e.target.value})} placeholder="Nama mesin..."/></div>
          <div><Lbl>Lokasi</Lbl><Inp value={form.lokasi} onChange={e=>setForm({...form,lokasi:e.target.value})} placeholder="Lantai 1 / Area B..."/></div>
          <div><Lbl>Status</Lbl>
            <Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
              <option value="aktif">Aktif</option>
              <option value="maintenance">Maintenance</option>
              <option value="rusak">Rusak</option>
              <option value="nonaktif">Nonaktif</option>
            </Sel>
          </div>
          <div style={{display:"flex",gap:8,paddingBottom:2}}>
            <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"+ Tambah"}</Btn>
            {editId&&<Btn outline color="#64748b" onClick={()=>{setEditId(null);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}}>Batal</Btn>}
          </div>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:16}}>
        {Object.entries(STATUS_COLOR).map(([s,c])=>(
          <Card key={s} style={{padding:"12px 16px",borderLeft:`3px solid ${c}`}}>
            <div style={{fontSize:20,fontWeight:800,color:c}}>{mesinList.filter(m=>m.status===s).length}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s}</div>
          </Card>
        ))}
      </div>

      <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead>
            <tr>
              <th style={thS}>KODE</th>
              <th style={thS}>NAMA MESIN</th>
              <th style={thS}>LOKASI</th>
              <th style={{...thS,textAlign:"center"}}>STATUS</th>
              <th style={{...thS,textAlign:"center"}}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {mesinList.map((m,i)=>{
              const c=STATUS_COLOR[m.status]||"#64748b";
              const rBg=i%2===0?"#fff":"#f8fafc";
              const td={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
              return(
                <tr key={m.id}>
                  <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>{m.kode}</td>
                  <td style={{...td,fontWeight:600,color:"#1e293b"}}>{m.nama}</td>
                  <td style={{...td,color:"#64748b"}}>{m.lokasi||"—"}</td>
                  <td style={{...td,textAlign:"center"}}>
                    <span style={{background:c+"18",color:c,border:`1px solid ${c}33`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>{setEditId(m.id);setForm({kode:m.kode,nama:m.nama,lokasi:m.lokasi||"",status:m.status});}}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                      <button onClick={()=>setDelId(m.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                      <button onClick={()=>setPrintQR(m)}
                        style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:600}}>QR</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {delId&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Mesin <strong>{mesinList.find(m=>m.id===delId)?.nama}</strong> akan dihapus.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
      {printQR&&(
        <Modal title={"QR Code — "+printQR.nama} onClose={()=>setPrintQR(null)} width={380}>
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              Scan QR untuk melihat info & jadwal maintenance mesin ini
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <canvas ref={(canvas:any)=>{
                if(canvas&&!(canvas as any).__qr_done){
                  (canvas as any).__qr_done=true;
                  const url="https://vista-teknik-new.vercel.app/mesin?id="+printQR.id;
                  QRCode.toCanvas(canvas,url,{width:180,margin:2,color:{dark:"#1e293b",light:"#ffffff"}},(err:any)=>{if(err)console.error(err);});
                }
              }}/>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:4,fontFamily:"monospace",wordBreak:"break-all" as const,padding:"0 8px"}}>
              {"https://vista-teknik-new.vercel.app/mesin?id="+printQR.id}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>
              {printQR.kode} · {printQR.nama}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setPrintQR(null)}>Tutup</Btn>
              <Btn color="#1d4ed8" onClick={async()=>{
                const url="https://vista-teknik-new.vercel.app/mesin?id="+printQR.id;
                const dataUrl=await QRCode.toDataURL(url,{width:200,margin:2,color:{dark:"#1e293b",light:"#ffffff"}});
                const w=window.open("","_blank","width=420,height=520");
                if(!w)return;
                w.document.write('<!DOCTYPE html><html><head><title>QR '+printQR.kode+'</title>'
                  +'<style>body{font-family:Arial;text-align:center;padding:32px;background:#fff}</style>'
                  +'</head><body>'
                  +'<h2 style="margin:0 0 4px;font-size:18px">'+printQR.nama+'</h2>'
                  +'<p style="color:#64748b;margin:0 0 4px;font-size:13px">'+printQR.kode+(printQR.lokasi?' · '+printQR.lokasi:'')+'</p>'
                  +'<p style="color:#94a3b8;margin:0 0 16px;font-size:11px">Scan untuk info maintenance</p>'
                  +'<div style="display:inline-block;padding:12px;border:1px solid #e2e8f0;border-radius:8px">'
                  +'<img src="'+dataUrl+'" width="200" height="200"/></div>'
                  +'<p style="font-size:10px;color:#94a3b8;margin-top:12px;word-break:break-all">'+url+'</p>'
                  +'<scri'+'pt>setTimeout(function(){window.print();},500);</scri'+'pt>'
                  +'</body></html>');
                w.document.close();
              }}>
                🖨 Print QR
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MaintenanceTab({mesinList,maintenanceList,setMaintenanceList,user}){
  const [form,setForm]=useState({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  const [editId,setEditId]=useState(null);
  const [delId,setDelId]=useState(null);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [filterMesin,setFilterMesin]=useState("ALL");
  const [showForm,setShowForm]=useState(false);

  const save=async()=>{
    if(!form.mesin_id||!form.kendala.trim())return;
    const payload={mesin_id:Number(form.mesin_id),kendala:form.kendala,perbaikan:form.perbaikan,
      tgl_kendala:form.tgl_kendala||null,tgl_perbaikan:form.tgl_perbaikan||null,
      teknisi:form.teknisi,status:form.status};
    if(editId){
      const{data,error}=await supabase.from("maintenance_log").update(payload).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList(prev=>prev.map(m=>m.id===editId?data:m));setEditId(null);setShowForm(false);}
    } else {
      const{data,error}=await supabase.from("maintenance_log").insert(payload).select("*,mesin(nama,kode)").single();
      if(!error){setMaintenanceList(prev=>[data,...prev]);setShowForm(false);}
    }
    setForm({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});
  };

  const del=async()=>{
    await supabase.from("maintenance_log").delete().eq("id",delId);
    setMaintenanceList(prev=>prev.filter(m=>m.id!==delId));setDelId(null);
  };

  const STATUS_COLOR={open:"#dc2626",in_progress:"#f59e0b",closed:"#16a34a"};
  const STATUS_LABEL={open:"🔴 Open",in_progress:"🟡 In Progress",closed:"✅ Closed"};

  const filtered=maintenanceList.filter(m=>
    (filterStatus==="ALL"||m.status===filterStatus)&&
    (filterMesin==="ALL"||m.mesin_id===Number(filterMesin))
  );

  const stats=[
    {l:"Total",v:maintenanceList.length,c:"#2563eb"},
    {l:"Open",v:maintenanceList.filter(m=>m.status==="open").length,c:"#dc2626"},
    {l:"In Progress",v:maintenanceList.filter(m=>m.status==="in_progress").length,c:"#f59e0b"},
    {l:"Closed",v:maintenanceList.filter(m=>m.status==="closed").length,c:"#16a34a"},
  ];

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {stats.map((s,i)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <Sel value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{minWidth:140}}>
            <option value="ALL">Semua Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="closed">Closed</option>
          </Sel>
          <Sel value={filterMesin} onChange={e=>setFilterMesin(e.target.value)} style={{minWidth:160}}>
            <option value="ALL">Semua Mesin</option>
            {mesinList.map(m=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}
          </Sel>
        </div>
        <Btn color="#1d4ed8" onClick={()=>{setShowForm(!showForm);setEditId(null);setForm({mesin_id:"",kendala:"",perbaikan:"",tgl_kendala:"",tgl_perbaikan:"",teknisi:"",status:"open"});}}>
          {showForm?"✕ Tutup":"+ Tambah Log"}
        </Btn>
      </div>

      {showForm&&(
        <Card style={{marginBottom:16,border:"2px solid #2563eb"}}>
          <div style={{fontWeight:800,fontSize:14,color:"#1e293b",marginBottom:14}}>{editId?"✏️ Edit Log":"➕ Tambah Log Maintenance"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Mesin</Lbl>
              <Sel value={form.mesin_id} onChange={e=>setForm({...form,mesin_id:e.target.value})}>
                <option value="">-- Pilih Mesin --</option>
                {mesinList.map(m=><option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>)}
              </Sel>
            </div>
            <div><Lbl>Tanggal Kendala</Lbl><Inp type="date" value={form.tgl_kendala} onChange={e=>setForm({...form,tgl_kendala:e.target.value})}/></div>
            <div><Lbl>Tanggal Perbaikan</Lbl><Inp type="date" value={form.tgl_perbaikan} onChange={e=>setForm({...form,tgl_perbaikan:e.target.value})}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><Lbl>Kendala</Lbl>
              <textarea value={form.kendala} onChange={e=>setForm({...form,kendala:e.target.value})}
                placeholder="Deskripsi kendala..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",
                  color:"#1e293b",fontSize:12,resize:"vertical",minHeight:80,fontFamily:"inherit"}}/>
            </div>
            <div><Lbl>Perbaikan</Lbl>
              <textarea value={form.perbaikan} onChange={e=>setForm({...form,perbaikan:e.target.value})}
                placeholder="Tindakan perbaikan..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",
                  color:"#1e293b",fontSize:12,resize:"vertical",minHeight:80,fontFamily:"inherit"}}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:12,alignItems:"flex-end"}}>
            <div><Lbl>Teknisi</Lbl><Inp value={form.teknisi} onChange={e=>setForm({...form,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="closed">Closed</option>
              </Sel>
            </div>
            <div style={{display:"flex",gap:8,paddingBottom:2}}>
              <Btn color="#1d4ed8" onClick={save}>{editId?"Simpan":"Tambah"}</Btn>
              <Btn outline color="#64748b" onClick={()=>{setShowForm(false);setEditId(null);}}>Batal</Btn>
            </div>
          </div>
        </Card>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>
            <div style={{fontSize:32,marginBottom:8}}>🔧</div>
            <div style={{fontSize:13,fontWeight:600}}>Belum ada log maintenance</div>
          </div>
        ):filtered.map(m=>{
          const sc=STATUS_COLOR[m.status]||"#64748b";
          return(
            <div key={m.id} style={{background:"#fff",borderRadius:10,border:`1px solid ${sc}30`,
              padding:"14px 16px",borderLeft:`4px solid ${sc}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap",marginBottom:10}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:800,fontSize:13,color:"#1e293b"}}>{m.mesin?.nama||"—"}</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:4,padding:"1px 6px"}}>{m.mesin?.kode}</span>
                  <span style={{background:sc+"18",color:sc,border:`1px solid ${sc}33`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>{setEditId(m.id);setForm({mesin_id:m.mesin_id?.toString()||"",kendala:m.kendala||"",perbaikan:m.perbaikan||"",tgl_kendala:m.tgl_kendala||"",tgl_perbaikan:m.tgl_perbaikan||"",teknisi:m.teknisi||"",status:m.status});setShowForm(true);}}
                    style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>✏️</button>
                  <button onClick={()=>setDelId(m.id)}
                    style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>🗑</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:8}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Kendala</div>
                  <div style={{fontSize:12,color:"#374151",background:"#fef2f2",borderRadius:7,padding:"8px 10px",lineHeight:1.5}}>{m.kendala||"—"}</div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:.3,marginBottom:4}}>Perbaikan</div>
                  <div style={{fontSize:12,color:"#374151",background:"#f0fdf4",borderRadius:7,padding:"8px 10px",lineHeight:1.5}}>{m.perbaikan||"—"}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:11,color:"#64748b"}}>
                {m.tgl_kendala&&<span>📅 Kendala: <strong>{m.tgl_kendala}</strong></span>}
                {m.tgl_perbaikan&&<span>✅ Perbaikan: <strong>{m.tgl_perbaikan}</strong></span>}
                {m.teknisi&&<span>👤 Teknisi: <strong>{m.teknisi}</strong></span>}
              </div>
            </div>
          );
        })}
      </div>

      {delId&&(
        <Modal title="Hapus Log?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>Log maintenance ini akan dihapus permanen.</div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function GlobalSearch({show,onClose,query,setQuery,woData,pekerja,setTab}:any){
  const ref=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    if(show) setTimeout(()=>ref.current?.focus(),50);
    else setQuery("");
  },[show]);

  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.key==="Escape") onClose();
    };
    if(show) window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[show]);

  const q=query.toLowerCase().trim();

  const woResults=q?(woData||[]).filter((w:any)=>
    w.wo?.toLowerCase().includes(q)||w.proyek?.toLowerCase().includes(q)
  ).slice(0,5):[];

  const panelResults=q?(woData||[]).flatMap((w:any)=>
    (w.panels||[]).filter((p:any)=>
      p.nama?.toLowerCase().includes(q)||w.proyek?.toLowerCase().includes(q)
    ).map((p:any)=>({...p,wo:w.wo,proyek:w.proyek,woId:w.id}))
  ).slice(0,5):[];

  const pekerjaResults=q?(pekerja||[]).filter((p:any)=>
    p.nama?.toLowerCase().includes(q)
  ).slice(0,4):[];

  const hasResults=woResults.length>0||panelResults.length>0||pekerjaResults.length>0;

  if(!show) return null;

  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,display:"flex",alignItems:"flex-start",
      justifyContent:"center",paddingTop:80,background:"rgba(15,23,42,.6)",backdropFilter:"blur(4px)"}}
      onClick={onClose}>
      <div style={{width:"100%",maxWidth:580,background:"#fff",borderRadius:14,
        boxShadow:"0 24px 64px rgba(0,0,0,.25)",overflow:"hidden"}}
        onClick={e=>e.stopPropagation()}>
        {/* Search input */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",
          borderBottom:"1px solid #f1f5f9"}}>
          <i className="ti ti-search" style={{fontSize:18,color:"#94a3b8",flexShrink:0}}/>
          <input ref={ref} value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Cari work order, panel, proyek, pekerja..."
            style={{flex:1,border:"none",outline:"none",fontSize:15,color:"#0f172a",
              fontFamily:"inherit",background:"transparent"}}/>
          {query&&(
            <button onClick={()=>setQuery("")}
              style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:14}}>✕</button>
          )}
          <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:5,
            padding:"2px 7px",fontSize:11,color:"#64748b",flexShrink:0}}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{maxHeight:420,overflowY:"auto" as const}}>
          {!query?(
            <div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>
              <i className="ti ti-search" style={{fontSize:32,display:"block",marginBottom:8}}/>
              <div style={{fontSize:13}}>Ketik untuk mencari...</div>
              <div style={{fontSize:11,marginTop:6,color:"#cbd5e1"}}>WO, panel, proyek, pekerja</div>
            </div>
          ):!hasResults?(
            <div style={{padding:"32px",textAlign:"center",color:"#94a3b8"}}>
              <div style={{fontSize:24,marginBottom:8}}>🔍</div>
              <div style={{fontSize:13}}>Tidak ada hasil untuk "<strong>{query}</strong>"</div>
            </div>
          ):(
            <div style={{padding:"8px 0"}}>
              {/* WO Results */}
              {woResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Work Orders</div>
                  {woResults.map((w:any)=>{
                    const pct=woOverall(w);
                    const color=pct===100?"#16a34a":isDelayed(w.target)?"#dc2626":isUrgent(w.target)?"#f59e0b":"#2563eb";
                    return(
                      <div key={w.id} onClick={()=>{setTab("wo");onClose();}}
                        style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                          alignItems:"center",gap:12,transition:"background .1s"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <div style={{width:32,height:32,borderRadius:8,background:"#eff6ff",
                          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className="ti ti-file-description" style={{fontSize:16,color:"#2563eb"}}/>
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>
                            WO {w.wo} — {w.proyek}
                          </div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
                            {(w.panels||[]).length} panel · Target: {w.target}
                          </div>
                        </div>
                        <span style={{background:color+"18",color,borderRadius:20,
                          padding:"2px 8px",fontSize:10,fontWeight:700}}>{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Panel Results */}
              {panelResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Panels</div>
                  {panelResults.map((p:any,i:number)=>(
                    <div key={i} onClick={()=>{setTab("detail");onClose();}}
                      style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                        alignItems:"center",gap:12}}
                      onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <div style={{width:32,height:32,borderRadius:8,background:"#f0fdf4",
                        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <i className="ti ti-layout-board" style={{fontSize:16,color:"#16a34a"}}/>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{p.nama}</div>
                        <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>
                          WO {p.wo} · {p.proyek} · {p.tipe}
                        </div>
                      </div>
                      <i className="ti ti-arrow-right" style={{fontSize:14,color:"#cbd5e1"}}/>
                    </div>
                  ))}
                </div>
              )}

              {/* Pekerja Results */}
              {pekerjaResults.length>0&&(
                <div>
                  <div style={{padding:"6px 18px 4px",fontSize:10,fontWeight:700,color:"#94a3b8",
                    textTransform:"uppercase" as const,letterSpacing:.8}}>Pekerja</div>
                  {pekerjaResults.map((p:any)=>{
                    const dc=(DIVISI_CONFIG as any)[p.divisi]||{};
                    return(
                      <div key={p.id} onClick={()=>{setTab("pekerja");onClose();}}
                        style={{padding:"10px 18px",cursor:"pointer",display:"flex",
                          alignItems:"center",gap:12}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#f8fafc")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                        <div style={{width:32,height:32,borderRadius:8,background:dc.bg||"#f1f5f9",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:12,fontWeight:800,color:dc.color||"#64748b",flexShrink:0}}>
                          {p.nama?.slice(0,2).toUpperCase()}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>{p.nama}</div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{dc.icon} {dc.label}</div>
                        </div>
                        <i className="ti ti-arrow-right" style={{fontSize:14,color:"#cbd5e1"}}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"8px 18px",borderTop:"1px solid #f1f5f9",display:"flex",
          gap:16,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
            <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,
              padding:"1px 5px",fontSize:10}}>↵</kbd> Navigate
          </span>
          <span style={{fontSize:10,color:"#94a3b8",display:"flex",alignItems:"center",gap:4}}>
            <kbd style={{background:"#f1f5f9",border:"1px solid #e2e8f0",borderRadius:4,
              padding:"1px 5px",fontSize:10}}>Esc</kbd> Tutup
          </span>
          <span style={{fontSize:10,color:"#94a3b8",marginLeft:"auto"}}>
            Vista Teknik Search
          </span>
        </div>
      </div>
    </div>
  );
}


function ArsipTab({woData,pekerja,logActivity,user}:any){
  const [arsipList,setArsipList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState("");
  const [selArsip,setSelArsip]=useState<any>(null);

  useEffect(()=>{
    const fetchArsip=async()=>{
      setLoading(true);
      const{data}=await supabase.from("fcs_arsip_wo").select("*").order("diarsipkan_pada",{ascending:false});
      setArsipList(data??[]);
      setLoading(false);
    };
    fetchArsip();
  },[]);

  const filtered=arsipList.filter((a:any)=>
    !search||a.wo_number?.toLowerCase().includes(search.toLowerCase())||a.proyek?.toLowerCase().includes(search.toLowerCase())
  );

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:18,fontWeight:800,color:"#1e293b",margin:0}}>📦 Arsip Work Order</h2>
          <p style={{fontSize:12,color:"#64748b",margin:"4px 0 0"}}>Histori WO yang sudah selesai dan diarsipkan</p>
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Cari WO atau proyek..."
          style={{height:32,padding:"0 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,width:240,outline:"none",fontFamily:"inherit"}}/>
      </div>

      {loading?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8"}}>Memuat arsip...</div>
      ):filtered.length===0?(
        <div style={{textAlign:"center",padding:48,color:"#94a3b8",background:"#fff",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <i className="ti ti-archive-off" style={{fontSize:32,display:"block",marginBottom:8}}/>
          Belum ada WO yang diarsipkan
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:8}}>
          {filtered.map((a:any)=>(
            <div key={a.id} onClick={()=>setSelArsip(a)}
              style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:10,padding:"14px 16px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:"#1e293b"}}>WO {a.wo_number} — {a.proyek}</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>
                  {a.total_panel} panel · {a.total_komponen} komponen · {Math.round(a.total_jam_kerja)} jam kerja
                </div>
              </div>
              <span style={{background:a.status_ketepatan==="tepat_waktu"?"#f0fdf4":"#fef2f2",
                color:a.status_ketepatan==="tepat_waktu"?"#16a34a":"#dc2626",
                border:`1px solid ${a.status_ketepatan==="tepat_waktu"?"#bbf7d0":"#fecaca"}`,
                borderRadius:20,padding:"3px 10px",fontSize:10,fontWeight:700,whiteSpace:"nowrap" as const}}>
                {a.status_ketepatan==="tepat_waktu"?"✅ Tepat Waktu":`⏰ Telat ${a.selisih_hari}h`}
              </span>
            </div>
          ))}
        </div>
      )}

      {selArsip&&(
        <Modal title={"WO "+selArsip.wo_number+" — "+selArsip.proyek} onClose={()=>setSelArsip(null)} width={560}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
            {[
              {l:"Total Panel",v:selArsip.total_panel},
              {l:"Total Komponen",v:selArsip.total_komponen},
              {l:"Total Jam Kerja",v:Math.round(selArsip.total_jam_kerja)+" jam"},
            ].map((s,i)=>(
              <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"10px",textAlign:"center" as const}}>
                <div style={{fontSize:18,fontWeight:800,color:"#1e293b"}}>{s.v}</div>
                <div style={{fontSize:9,color:"#94a3b8",textTransform:"uppercase" as const,marginTop:2}}>{s.l}</div>
              </div>
            ))}
          </div>

          <div style={{fontSize:11,color:"#64748b",marginBottom:16}}>
            Target: {selArsip.target_selesai} → Selesai aktual: {selArsip.tanggal_selesai_aktual}
            {selArsip.status_ketepatan==="tepat_waktu"
              ?<span style={{color:"#16a34a",fontWeight:700,marginLeft:6}}>(Tepat waktu)</span>
              :<span style={{color:"#dc2626",fontWeight:700,marginLeft:6}}>(Telat {selArsip.selisih_hari} hari)</span>}
          </div>

          <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>👥 Ringkasan Operator</div>
          {(selArsip.ringkasan_operator||[]).length===0?(
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:16}}>Tidak ada data operator tercatat</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:6,marginBottom:16}}>
              {(selArsip.ringkasan_operator||[]).map((op:any,i:number)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,background:"#f8fafc",borderRadius:6,padding:"6px 10px"}}>
                  <span style={{fontWeight:600,color:"#1e293b"}}>{op.nama}</span>
                  <span style={{color:"#64748b"}}>{Math.round(op.totalMenit/60)} jam · {op.jumlahSesi} sesi</span>
                </div>
              ))}
            </div>
          )}

          <div style={{fontWeight:700,fontSize:12,color:"#1e293b",marginBottom:8}}>📋 Rincian Panel</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:6,maxHeight:200,overflowY:"auto" as const}}>
            {(selArsip.rincian_panel||[]).map((p:any,i:number)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,background:"#f8fafc",borderRadius:6,padding:"6px 10px"}}>
                <span style={{fontWeight:600,color:"#1e293b"}}>{p.nama}</span>
                <span style={{color:"#94a3b8"}}>{p.tipe} · {p.totalKomponen} komponen</span>
              </div>
            ))}
          </div>

          <div style={{fontSize:10,color:"#cbd5e1",marginTop:16,textAlign:"center" as const}}>
            Diarsipkan oleh {selArsip.diarsipkan_oleh} pada {new Date(selArsip.diarsipkan_pada).toLocaleDateString("id-ID")}
          </div>
        </Modal>
      )}
    </div>
  );
}

function FCSScheduleTab({woData,user}:any){
  const [scheduleList,setScheduleList]=useState<any[]>([]);
  const [kapasitasList,setKapasitasList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filterWO,setFilterWO]=useState("ALL");
  const [filterPanel,setFilterPanel]=useState("ALL");
  const [filterProyek,setFilterProyek]=useState("ALL");
  const [filterPekerjaan,setFilterPekerjaan]=useState("POTONG");
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [weekStart,setWeekStart]=useState(new Date().toISOString().slice(0,10));
  const [approveId,setApproveId]=useState<any>(null);
  const [syncing,setSyncing]=useState(false);
  const [deliverySim,setDeliverySim]=useState<any[]>([]);

  const ALL_STATUS=["planning","released","in_progress","completed","cancelled"];
  const STATUS_COLOR:any={
    planning:{bg:"#f1f5f9",color:"#64748b",label:"Planning"},
    released:{bg:"#eff6ff",color:"#1d4ed8",label:"Released"},
    in_progress:{bg:"#fffbeb",color:"#d97706",label:"In Progress"},
    completed:{bg:"#f0fdf4",color:"#16a34a",label:"Completed"},
    cancelled:{bg:"#fef2f2",color:"#dc2626",label:"Cancelled"},
  };

  useEffect(()=>{fetchAll();},[filterPekerjaan,woData]);

  const fetchAll=async()=>{
    setLoading(true);
    const [{data:s},{data:k}]=await Promise.all([
      supabase.from("fcs_schedule").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true})
        .order("wp",{ascending:true}),
      supabase.from("fcs_kapasitas_override").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true}),
    ]);
    const sd=s??[];
    setScheduleList(sd);
    setKapasitasList(k??[]);
    const wm:Record<string,string>={};
    sd.forEach((r:any)=>{if(!wm[r.wo_number]||r.tanggal>wm[r.wo_number])wm[r.wo_number]=r.tanggal;});
    const woNums=Object.keys(wm);
    if(woNums.length>0){
      const{data:woRows}=await supabase.from('work_orders').select('wo,proyek,target').in('wo',woNums);
      const woMap2:Record<string,any>={};
      (woRows||[]).forEach((w:any)=>{woMap2[w.wo]=w;});
      const sim=Object.entries(wm).map(([wn,sf])=>{
        const w=woMap2[wn];
        const tg=w?.target||null;
        let st='no_target';let sl=0;
        if(tg){sl=Math.ceil((new Date(sf).getTime()-new Date(tg).getTime())/86400000);if(sl<=-7)st='early';else if(sl<=0)st='ontime';else if(sl<=3)st='warning';else st='late';}
        return{woNum:wn,selesaiFCS:sf,target:tg,status:st,selisih:sl,proyek:w?.proyek||wn};
      });
      setDeliverySim(sim);
    } else {
      setDeliverySim([]);
    }
    setLoading(false);
  };

  const kapasitasOverrideMap=useMemo(()=>{
    const map:Record<string,number>={};
    kapasitasList.forEach((k:any)=>{map[k.tanggal]=Number(k.kapasitas_menit);});
    return map;
  },[kapasitasList]);

  // Hitung kapasitas per tanggal
  const kapPerTanggal=useMemo(()=>{
    const map:Record<string,number>={};
    scheduleList.filter(s=>s.status!=="cancelled").forEach(s=>{
      if(!map[s.tanggal])map[s.tanggal]=0;
      map[s.tanggal]+=Number(s.total_menit);
    });
    return map;
  },[scheduleList]);

  // Tanggal unik
  const tanggalList=useMemo(()=>{
    return [...new Set(scheduleList.map(s=>s.tanggal))].sort();
  },[scheduleList]);

  // Filter schedule
  const filtered=useMemo(()=>{
    return scheduleList.filter(s=>{
      const matchWO=filterWO==="ALL"||s.wo_number===filterWO;
      const matchStatus=filterStatus==="ALL"||s.status===filterStatus;
      const matchPanel=filterPanel==="ALL"||s.panel_nama===filterPanel;
      const matchProyek=filterProyek==="ALL"||s.proyek===filterProyek;
      return matchWO&&matchStatus&&matchPanel&&matchProyek;
    });
  },[scheduleList,filterWO,filterStatus,filterPanel,filterProyek]);

  const updateStatus=async(id:number,status:string)=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await supabase.from("fcs_schedule").update({
      status,
      ...(status==="released"?{approved_by:uname,approved_at:new Date().toISOString()}:{})
    }).eq("id",id);
    setScheduleList(prev=>prev.map(s=>s.id===id?{...s,status}:s));
    setApproveId(null);
  };

  const fmtDate=(d:string)=>new Date(d).toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short"});

  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"7px 10px",fontWeight:600,
    fontSize:10,textAlign:"left" as const,whiteSpace:"nowrap" as const,
    borderRight:"1px solid #ffffff10",textTransform:"uppercase" as const,letterSpacing:.4};

  if(loading)return <div style={{textAlign:"center",padding:40,color:"#94a3b8"}}>Memuat jadwal FCS...</div>;

  return(
    <div className="fi">
      {/* Header stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
        {[
          {l:"Total Jadwal",v:scheduleList.length,c:"#2563eb"},
          {l:"Planning",v:scheduleList.filter(s=>s.status==="planning").length,c:"#64748b"},
          {l:"Released",v:scheduleList.filter(s=>s.status==="released").length,c:"#1d4ed8"},
          {l:"Completed",v:scheduleList.filter(s=>s.status==="completed").length,c:"#16a34a"},
        ].map((s,i)=>(
          <div key={i} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"10px 14px",borderTop:`3px solid ${s.c}`}}>
            <div style={{fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
            <div style={{fontSize:9,color:"#94a3b8",marginTop:3,fontWeight:600,textTransform:"uppercase" as const,letterSpacing:.3}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Capacity utilization per tanggal */}
      {tanggalList.length>0&&(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>
            ⚡ Capacity Utilization — {filterPekerjaan} (dari Override Tanggal)
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap" as const}}>
            {tanggalList.slice(0,14).map(tgl=>{
              const terpakai=kapPerTanggal[tgl]||0;
              const kapHari=kapasitasOverrideMap[tgl]||0;
              const adaOverride=kapasitasOverrideMap[tgl]!==undefined;
              const pct=kapHari>0?Math.min(Math.round((terpakai/kapHari)*100),100):0;
              const color=!adaOverride?"#94a3b8":pct>=95?"#dc2626":pct>=80?"#f59e0b":"#16a34a";
              const bg=!adaOverride?"#f8fafc":pct>=95?"#fef2f2":pct>=80?"#fffbeb":"#f0fdf4";
              return(
                <div key={tgl} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:"8px 12px",minWidth:100,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{fmtDate(tgl)}</div>
                  {!adaOverride?(
                    <div style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4}}>⚠ Belum diatur</div>
                  ):(
                    <>
                      <div style={{width:"100%",height:6,background:"#e2e8f0",borderRadius:99,overflow:"hidden",marginBottom:4}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:99}}/>
                      </div>
                      <div style={{fontSize:11,fontWeight:700,color}}>{pct}%</div>
                      <div style={{fontSize:9,color:"#94a3b8"}}>{terpakai}/{kapHari} mnt</div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deliverySim.length>0&&(
        <div style={{background:'var(--card-bg,#fff)',border:'1px solid var(--border-color,#e2e8f0)',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase' as const,letterSpacing:.4,marginBottom:10}}>
            Simulasi Delivery
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap' as const}}>
            {deliverySim.map((d:any)=>{
              const cm:any={early:{bg:'#f0fdf4',br:'#bbf7d0',c:'#16a34a',ic:'OK',lb:'Lebih Awal'},ontime:{bg:'#eff6ff',br:'#bfdbfe',c:'#1d4ed8',ic:'ON',lb:'On Time'},warning:{bg:'#fffbeb',br:'#fde68a',c:'#d97706',ic:'!!',lb:'Hampir Terlambat'},late:{bg:'#fef2f2',br:'#fecaca',c:'#dc2626',ic:'!!',lb:'Terlambat'},no_target:{bg:'#f8fafc',br:'#e2e8f0',c:'#94a3b8',ic:'?',lb:'No Target'}};
              const cf=cm[d.status]||cm.no_target;
              return(
                <div key={d.woNum} style={{background:cf.bg,border:`1.5px solid ${cf.br}`,borderRadius:10,padding:'10px 14px',minWidth:180}}>
                  <div style={{fontSize:11,fontWeight:700,color:cf.c,marginBottom:4}}>{cf.lb}</div>
                  <div style={{fontSize:12,fontWeight:700,color:'#1e293b',marginBottom:2}}>WO {d.woNum}</div>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:6}}>{d.proyek}</div>
                  <div style={{fontSize:10,color:'#94a3b8'}}>Selesai FCS: <strong style={{color:'#475569'}}>{new Date(d.selesaiFCS).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</strong></div>
                  {d.target&&<div style={{fontSize:10,color:'#94a3b8',marginTop:2}}>Target: <strong style={{color:'#475569'}}>{new Date(d.target).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</strong></div>}
                  {d.target&&<div style={{marginTop:6,fontSize:11,fontWeight:700,color:cf.c}}>{d.selisih<0?`${Math.abs(d.selisih)} hari lebih awal`:d.selisih===0?'Tepat waktu':`${d.selisih} hari terlambat`}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Filter bar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const,alignItems:"center",background:"var(--card-bg,#fff)",borderRadius:8,padding:"10px 12px",border:"1px solid var(--border-color,#e2e8f0)"}}>
        <select value={filterPekerjaan} onChange={e=>{setFilterPekerjaan(e.target.value);}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit",fontWeight:700,color:"#1d4ed8"}}>
          {["POTONG","BENDING","STEL","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterWO} onChange={e=>{setFilterWO(e.target.value);setFilterProyek("ALL");setFilterPanel("ALL");}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua WO</option>
          {[...new Set(scheduleList.map(s=>s.wo_number))].map(wo=>(
            <option key={wo} value={wo}>WO {wo}</option>
          ))}
        </select>
        <select value={filterProyek} onChange={e=>{setFilterProyek(e.target.value);setFilterPanel("ALL");}}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Proyek</option>
          {[...new Set(scheduleList.filter(s=>filterWO==="ALL"||s.wo_number===filterWO).map(s=>s.proyek))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterPanel} onChange={e=>setFilterPanel(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Panel</option>
          {[...new Set(scheduleList.filter(s=>(filterWO==="ALL"||s.wo_number===filterWO)&&(filterProyek==="ALL"||s.proyek===filterProyek)).map(s=>s.panel_nama))].map(p=>(
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
          style={{height:28,padding:"0 8px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:11,background:"#f8fafc",outline:"none",fontFamily:"inherit"}}>
          <option value="ALL">Semua Status</option>
          {ALL_STATUS.map(s=><option key={s} value={s}>{STATUS_COLOR[s]?.label||s}</option>)}
        </select>
        <span style={{fontSize:11,color:"#94a3b8",marginLeft:"auto"}}>{filtered.length} jadwal</span>
        <button onClick={async()=>{
          const targetLabel=filterWO==="ALL"?"SEMUA WO":"WO "+filterWO;
          if(!window.confirm("Sync jadwal FCS ke Raw Schedule untuk "+targetLabel+"? Data schedule yang ada akan diupdate."))return;
          setSyncing(true);
          const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
          const uname=user?.name||user?.nama||sess?.nama||"Admin";
          const woNumbers=filterWO==="ALL"
            ?[...new Set(scheduleList.map((s:any)=>s.wo_number))]
            :[filterWO];
          let sukses=0;let gagal=0;
          for(const woNum of woNumbers){
            const res=await syncFCSToRawSchedule(woNum,filterPekerjaan,uname);
            if(res.success)sukses++;else gagal++;
          }
          setSyncing(false);
          alert("Sync selesai untuk "+targetLabel+"! "+sukses+" WO berhasil"+(gagal>0?", "+gagal+" gagal":""));
          fetchAll();
        }} disabled={syncing||scheduleList.length===0}
          style={{height:28,padding:"0 14px",borderRadius:6,border:"none",background:syncing?"#94a3b8":"#7c3aed",color:"#fff",fontSize:11,fontWeight:700,cursor:syncing||scheduleList.length===0?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {syncing?"⏳ Syncing...":filterWO==="ALL"?"⇄ Sync Semua WO":"⇄ Sync WO "+filterWO}
        </button>
        <button onClick={fetchAll}
          style={{height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
          ↻ Refresh
        </button>
      </div>

      {/* Tabel jadwal */}
      {filtered.length===0?(
        <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:8,padding:"40px",textAlign:"center" as const,color:"#94a3b8"}}>
          <div style={{fontSize:32,marginBottom:8}}>⏱</div>
          <div style={{fontSize:13,fontWeight:600}}>Belum ada jadwal FCS</div>
          <div style={{fontSize:12,marginTop:4}}>Generate schedule dari Manajemen WO terlebih dahulu</div>
        </div>
      ):(
        <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              <th style={thS}>Tanggal</th>
              <th style={thS}>WO</th>
              <th style={thS}>Proyek</th>
              <th style={thS}>Panel</th>
              <th style={{...thS,textAlign:"center" as const}}>WP</th>
              <th style={thS}>Komponen</th>
              <th style={{...thS,textAlign:"center" as const}}>Qty</th>
              <th style={{...thS,textAlign:"center" as const}}>Mnt/Pcs</th>
              <th style={{...thS,textAlign:"center" as const}}>Total Mnt</th>
              <th style={{...thS,textAlign:"center" as const}}>Status</th>
              <th style={{...thS,textAlign:"center" as const}}>Progress</th>
            </tr></thead>
            <tbody>
              {filtered.map((s:any,i:number)=>{
                const sc=STATUS_COLOR[s.status]||STATUS_COLOR.planning;
                const rBg=i%2===0?"var(--card-bg,#fff)":"var(--bg-secondary,#f8fafc)";
                const td:any={padding:"7px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                return(
                  <tr key={s.id}>
                    <td style={{...td,fontWeight:600,color:"#1e293b",whiteSpace:"nowrap" as const}}>{fmtDate(s.tanggal)}</td>
                    <td style={{...td,fontFamily:"monospace",fontWeight:700,color:"#1d4ed8"}}>WO {s.wo_number}</td>
                    <td style={{...td,color:"#475569"}}>{s.proyek}</td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{s.panel_nama}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:"#f1f5f9",color:"#475569",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>{s.wp}</span>
                    </td>
                    <td style={td}>{s.nama_komponen}<span style={{fontSize:9,color:"#94a3b8",marginLeft:4}}>({s.kode_komponen})</span></td>
                    <td style={{...td,textAlign:"center" as const,fontWeight:700,color:"#1e293b"}}>{s.qty_hari}</td>
                    <td style={{...td,textAlign:"center" as const,color:"#64748b"}}>{s.menit_per_pcs}</td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{fontWeight:700,color:"#1d4ed8"}}>{Number(s.total_menit).toFixed(1)}</span>
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,border:`1px solid ${sc.color}30`}}>{sc.label}</span>
                    </td>
                    <td style={{...td,textAlign:"center" as const}}>
                      {s.status==="planning"&&(
                        <span style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#1d4ed8",fontWeight:700,display:"inline-block"}}>
                          Release
                        </span>
                      )}
                      {s.status==="released"&&(
                        <span style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#d97706",fontWeight:700,display:"inline-block"}}>
                          Mulai
                        </span>
                      )}
                      {s.status==="in_progress"&&(
                        <span style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"3px 10px",fontSize:10,color:"#16a34a",fontWeight:700,display:"inline-block"}}>
                          Selesai
                        </span>
                      )}
                      {s.status==="completed"&&(
                        <span style={{fontSize:10,color:"#16a34a",fontWeight:700}}>
                          ✓ Completed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export default function App(){
  const [page,setPage]=useState("landing");
  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
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
  // Restore admin session
  useEffect(()=>{
    const saved=localStorage.getItem("vista_admin_session");
    if(saved){
      try{
        const parsed=JSON.parse(saved);
        setUser({...parsed,name:parsed.name||parsed.nama});
        setPage("app");
        setTab("dashboard");
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
      const { data } = await supabase.from('maintenance_rutin').select('id,jatuh_tempo').eq('is_active', true).lte('jatuh_tempo', h3.toISOString().slice(0,10))
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
const { data: pekerjaList, loading: pekerjaLoading, create: createPekerja, update: updatePekerja, remove: removePekerja, refetch: refetchPekerja } = usePekerja()

const { data: renharList, loading: renharLoading, create: createRenhar, update: updateRenhar, remove: removeRenhar, refetch: refetchRenhar } = useRenhar()
const { data: rawList, loading: rawLoading, create: createRaw, update: updateRaw, remove: removeRaw, refetch: refetchRaw } = useRawSchedule()
useEffect(() => {
  if (!woLoading) {
    setWoData(woList);
    }
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
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},
      {id:"stok",label:"Stok Komponen",icon:"ti ti-package"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
      ...(canWO?[{id:"fcs",label:"FCS Schedule",icon:"ti ti-timeline"}]:[]),
      ...(canWO?[{id:"arsip",label:"Arsip",icon:"ti ti-archive"}]:[]),
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
                <button onClick={refreshAll} disabled={isRefreshing}
                  title="Refresh semua data"
                  style={{width:26,height:26,border:"1px solid var(--border-color,#e5e8ed)",
                    borderRadius:5,background:"var(--bg-secondary,#f8f9fb)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:isRefreshing?"not-allowed":"pointer",color:"var(--text-secondary,#64748b)"}}>
                  <i className="ti ti-refresh" style={{fontSize:13,display:"inline-block",
                    animation:isRefreshing?"spin .6s linear infinite":"none"}}/>
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
              {tab==="dashboard"&&<Dashboard woData={woData}/>}
              {tab==="fcs"&&<FCSScheduleTab woData={woData} user={user}/>}
              {tab==="arsip"&&<ArsipTab woData={woData} pekerja={pekerja} logActivity={logActivity} user={user}/>}
              {tab==="stok"&&<StokMonitoringTab user={user} activityLog={activityLog}/>}
              {tab==="summary"&&<SummaryProgress woData={woData}/>}
              {tab==="detail"&&<DetailProgress woData={woData} rawData={rawData}/>}
              {tab==="raw"&&<RawSchedule woData={woData} rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} refetchRenhar={refetchRenhar} logActivity={logActivity} logAct={logAct} log={log} user={user}/>}
              {tab==="rencana"&&<RencanaHarian rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} logAct={logAct} log={log} user={user}/>}
              {tab==="wo"&&<ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} logAct={logAct} log={log} user={user} refetchWO={refetchWO}/>}
              {tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar} setRenhar={setRenhar} removeRenhar={removeRenhar} woData={woData}/>}
              {tab==="maintenance"&&<MaintenancePageTab user={user}/>}
              {tab==="kendala"&&<KendalaInbox kendalaLog={kendalaLog} removeKendala={removeKendala} user={user}/>}
              {tab==="activity"&&<ActivityLogView activityLog={activityLog} user={user}/>}
              {tab==="masteruser"&&<SystemTab user={user} woData={woData} logActivity={logActivity} activityLog={activityLog} pekerja={pekerja} setPekerja={setPekerja} createPekerja={createPekerja} updatePekerja={updatePekerja} removePekerja={removePekerja}/>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}