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

const ALL_PROSES = ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
const WP_LIST    = ["WP1","WP2","WP3","WP4"];
const PCT_STEPS  = [25,50,75,90,100];
const PCT_MANUAL = [10,20,30,40,50,60,70,80,90,100];
const PRIORITAS  = ["Tinggi","Sedang","Rendah"];

const PROSES_COLOR = {
  "POTONG":"#f59e0b","BENDING":"#10b981","STEL":"#3b82f6","RENDAM":"#0ea5e9","PAINTING":"#8b5cf6",
  "RAKIT":"#ec4899","PASANG KOMPONEN":"#f97316","BUSBAR":"#06b6d4",
  "WIRING CONTROL":"#6366f1","WIRING POWER":"#ef4444","QC TEST":"#14b8a6","PACKING":"#84cc16",
};
const WP_COLOR = {"WP1":"#f59e0b","WP2":"#22c55e","WP3":"#06b6d4","WP4":"#f97316","WP5":"#a78bfa","WP6":"#f472b6"};
const PRIORITAS_COLOR = {"Tinggi":"#dc2626","Sedang":"#f59e0b","Rendah":"#22c55e"};

const DIVISI_PROSES = {
  mekanik:    ["POTONG","BENDING","STEL"],
  painting:   ["RENDAM","PAINTING"],
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
  "FS.1":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.2":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.3":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.4":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "FS.5":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.6":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.7":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "FS.8":  ["POTONG","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.9":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "FS.10": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  // FS & F3B - WP2
  "FS.11": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "FS.12": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.13": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "FS.14": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "FS.15": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  // FS & F3B - WP3
  "FS.16": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.17": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.18": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.19": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.20": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "FS.21": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  // FS & F3B - WP4
  "FS.22": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.23": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "FS.24": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // F3B tambahan - WP1
  "F3B.1":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.2":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.3":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "F3B.4":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.5":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.6":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  "F3B.7":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.8":  ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.9":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "F3B.10": ["POTONG","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.11": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  "F3B.12": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","WIRING POWER"],
  // F3B - WP2
  "F3B.13": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL"],
  "F3B.14": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.15": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "F3B.16": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "F3B.17": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  // F3B - WP3
  "F3B.18": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.19": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.20": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.21": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.22": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "F3B.23": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  // F3B - WP4
  "F3B.24": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.25": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "F3B.26": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // WM_MS & WM_POLY - WP1
  "WM.1": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","BUSBAR"],
  "WM.2": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER","BUSBAR"],
  // WM_MS - WP2
  "WM.3": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT"],
  "WM.4": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
  // WM - WP3
  "WM.5": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.6": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // WM - WP4
  "WM.7": ["POTONG","RENDAM","PAINTING","RAKIT"],
  "WM.8": ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  // WM_POLY - WP5 & WP6 (sama seperti WP4)
  "WM.9":  ["POTONG","BENDING","RENDAM","PAINTING","RAKIT"],
  "WM.10": ["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","WIRING CONTROL","WIRING POWER"],
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
export const OPERATOR_ROLES = ["mekanik","painting","assembling","wiring_ctrl","wiring_pwr","qc","nameplate","komponen"];

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
function Card({children,style={},...rest}:any){
  return <div className="erp-card" style={{background:"var(--card-bg,#fff)",borderRadius:12,border:"1px solid var(--border-color,#e2e8f0)",
    padding:16,boxShadow:"0 1px 3px #00000008",...style}} {...rest}>{children}</div>;
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
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit,jumlah_orang,tipe_kapasitas"),
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
  const [exiting,setExiting]=useState(false);

  const handleEnter=()=>{
    setExiting(true);
    setTimeout(()=>{onEnter();},400);
  };

  return(
    <div style={{minHeight:"100vh",width:"100%",background:"#ffffff",fontFamily:"'Plus Jakarta Sans',sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24,padding:24,
      opacity:exiting?0:1,transform:exiting?"scale(1.04)":"scale(1)",transition:"opacity .4s cubic-bezier(.4,0,.2,1),transform .4s cubic-bezier(.4,0,.2,1)"}}>
      <style>{GCss}</style>
      <style>{`
        @keyframes landFadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .land-logo{animation:landFadeIn .6s cubic-bezier(.22,1,.36,1) forwards}
        .land-tagline{animation:landFadeIn .6s .15s cubic-bezier(.22,1,.36,1) both}
        .land-cta{animation:landFadeIn .6s .3s cubic-bezier(.22,1,.36,1) both}
        .land-cta-btn:hover{background:#e06a10!important;transform:translateY(-1px)}
        .land-cta-btn{transition:all .18s!important}
      `}</style>
      <img src="data:image/png;base64,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" alt="Vista Teknik" className="land-logo" style={{width:260,height:"auto"}}/>
      <p className="land-tagline" style={{fontSize:15,color:"#64748b",margin:0,textAlign:"center",letterSpacing:.3}}>Your electrical safety is our priority</p>
      <button onClick={handleEnter} className="land-cta land-cta-btn"
        style={{marginTop:16,padding:"13px 36px",borderRadius:10,border:"none",background:"#f47920",color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
        Masuk ke Aplikasi
      </button>
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

function TaskMonitoring({woData}:{woData:any[]}){
  const [selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const [selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const PROSES_LABEL:Record<string,string>={
    POTONG:"Potong",BENDING:"Bending",STEL:"Stel",RENDAM:"Rendam",PAINTING:"Painting",
    RAKIT:"Rakit","PASANG KOMPONEN":"Pasang Komponen",
    BUSBAR:"Busbar","WIRING CONTROL":"Wiring Control","WIRING POWER":"Wiring Power",
    "QC TEST":"QC Test",PACKING:"Packing",
  };

  const selectedWo=woData.find((w:any)=>w.id===selectedWoId);
  const panelList=selectedWo?.panels||[];
  const selectedPanel=panelList.find((p:any)=>p.id===selectedPanelId);
  const cfg=selectedPanel?(PANEL_TYPES as any)[selectedPanel.tipe]:null;

  const getStatus=(kode:string,prosesIdx:number):{status:string;pct:number}|null=>{
    if(!selectedPanel)return null;
    const qty=selectedPanel.checklist?.[kode]?.qty||0;
    if(qty<=0)return null;
    const proses=ALL_PROSES[prosesIdx];
    if(!isKomponenRelevant(kode,proses))return null;
    const progress=selectedPanel.checklist?.[kode]?.progress?.[proses]||0;
    if(progress>=100)return{status:"DONE",pct:100};
    if(prosesIdx===0){
      return progress>0?{status:"IN PROGRESS",pct:progress}:{status:"TO DO",pct:0};
    }
    const prosesSebelumnya=ALL_PROSES[prosesIdx-1];
    const progressSebelumnya=selectedPanel.checklist?.[kode]?.progress?.[prosesSebelumnya]||0;
    if(progressSebelumnya<100)return{status:"NOT YET",pct:0};
    return progress>0?{status:"IN PROGRESS",pct:progress}:{status:"TO DO",pct:0};
  };

  const statusStyle:Record<string,{bg:string;color:string;border:string}>={
    "DONE":{bg:"#f0fdf4",color:"#16a34a",border:"#bbf7d0"},
    "IN PROGRESS":{bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe"},
    "TO DO":{bg:"#fffbeb",color:"#d97706",border:"#fde68a"},
    "NOT YET":{bg:"#fef2f2",color:"#dc2626",border:"#fecaca"},
  };

  const progresTotal=(()=>{
    if(!selectedPanel||!cfg)return 0;
    const allItems=cfg.wps.flatMap((w:any)=>w.items);
    let sum=0,count=0;
    allItems.forEach((it:any)=>{
      const qty=selectedPanel.checklist?.[it.kode]?.qty||0;
      if(qty<=0)return;
      ALL_PROSES.forEach((proses:string)=>{
        const progress=selectedPanel.checklist?.[it.kode]?.progress?.[proses]||0;
        sum+=progress;count++;
      });
    });
    return count>0?(sum/count):0;
  })();

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:20,color:"#0f172a",marginBottom:4}}>Task Monitoring</div>
      <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:16}}>Monitoring status estafet per komponen per panel</div>

      <Card style={{marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div>
            <Lbl>Pilih Work Order</Lbl>
            <Sel value={selectedWoId??""} onChange={(e:any)=>{setSelectedWoId(e.target.value?Number(e.target.value):null);setSelectedPanelId(null);}}>
              <option value="">-- Pilih Work Order --</option>
              {woData.map((w:any)=>(
                <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
              ))}
            </Sel>
          </div>
          <div>
            <Lbl>Pilih Panel</Lbl>
            <Sel value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)} disabled={!selectedWoId}>
              <option value="">-- Pilih Panel --</option>
              {panelList.map((p:any)=>(
                <option key={p.id} value={p.id}>#{p.noPnl||p.no_pnl} {p.nama}</option>
              ))}
            </Sel>
          </div>
        </div>
      </Card>

      {selectedPanel&&cfg&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Proyek</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedWo.proyek}</div>
            </Card>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Nama Panel</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedPanel.nama}</div>
            </Card>
            <Card>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const}}>Target</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:2}}>{selectedWo.target||"-"}</div>
            </Card>
            <Card style={{background:"#eff6ff",border:"1px solid #bfdbfe"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#2563eb",textTransform:"uppercase" as const}}>Progres Total</div>
              <div style={{fontSize:16,fontWeight:800,color:"#1d4ed8",marginTop:2}}>{progresTotal.toFixed(1)}%</div>
            </Card>
          </div>

          <div style={{overflowX:"auto" as const,border:"1px solid #e2e8f0",borderRadius:10}}>
            <table style={{borderCollapse:"collapse" as const,fontSize:11,minWidth:900,width:"100%"}}>
              <thead>
                <tr style={{background:"#1e3a5f"}}>
                  <th style={{padding:"7px 10px",color:"#fff",textAlign:"left" as const,position:"sticky" as const,left:0,background:"#1e3a5f",minWidth:160,zIndex:1,fontSize:9,textTransform:"uppercase" as const,letterSpacing:.3,fontWeight:600,borderRight:"1px solid rgba(255,255,255,.1)"}}>Komponen</th>
                  {ALL_PROSES.map((proses:string)=>(
                    <th key={proses} style={{padding:"7px 10px",color:"#fff",minWidth:90,fontWeight:600,fontSize:9,textTransform:"uppercase" as const,letterSpacing:.3,borderRight:"1px solid rgba(255,255,255,.1)"}}>{PROSES_LABEL[proses]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cfg.wps.flatMap((wp:any)=>wp.items).map((item:any,ii:number)=>{
                  const qty=selectedPanel.checklist?.[item.kode]?.qty||0;
                  if(qty<=0)return null;
                  return(
                    <tr key={item.kode}>
                      <td style={{padding:"6px 10px",fontWeight:600,color:"#1e293b",background:ii%2===0?"#fff":"#f8fafc",position:"sticky" as const,left:0}}>{item.nama}</td>
                      {ALL_PROSES.map((proses:string,prosesIdx:number)=>{
                        const st=getStatus(item.kode,prosesIdx);
                        return(
                          <td key={proses} style={{padding:4,textAlign:"center" as const,background:ii%2===0?"#fff":"#f8fafc"}}>
                            {st&&(
                              <span style={{background:statusStyle[st.status].bg,color:statusStyle[st.status].color,border:`1px solid ${statusStyle[st.status].border}`,padding:"3px 9px",borderRadius:5,fontWeight:700,fontSize:10,whiteSpace:"nowrap" as const}}>
                                {st.status==="IN PROGRESS"?`IN PROGRESS ${st.pct}%`:st.status}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex",gap:16,marginTop:10,fontSize:11,color:"#64748b",flexWrap:"wrap" as const}}>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#166534",display:"inline-block"}}/>Done</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#16a34a",display:"inline-block"}}/>In progress</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fbbf24",display:"inline-block"}}/>To do</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#ef4444",display:"inline-block"}}/>Not yet</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#fff",border:"1px solid #e2e8f0",display:"inline-block"}}/>Qty 0 (tidak ditampilkan)</div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryProgress({woData}:{woData:any[]}){
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

  const PROSES_LIST=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

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
  const [panelFilter,setPanelFilter]=useState("semua");
  const [statusFilter,setStatusFilter]=useState<string[]>([]);

  const PROSES_LIST=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];

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
    const matchPanel=panelFilter==="semua"||String(p.id)===panelFilter;
    const matchQ=!search||
      (p.nama||"").toLowerCase().includes(search.toLowerCase())||
      (p.proyek||"").toLowerCase().includes(search.toLowerCase())||
      (p.wo||"").toLowerCase().includes(search.toLowerCase());
    return matchS&&matchWO&&matchPanel&&matchQ;
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
        <select value={woFilter} onChange={e=>{setWoFilter(e.target.value);setPanelFilter("semua");}}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua WO</option>
          {woData.map(w=><option key={w.id} value={w.wo}>WO {w.wo} — {w.proyek}</option>)}
        </select>
        <select value={panelFilter} onChange={e=>setPanelFilter(e.target.value)} disabled={woFilter==="semua"}
          style={{height:28,border:"1px solid #e2e8f0",borderRadius:5,padding:"0 7px",
            fontSize:11,background:woFilter==="semua"?"#f1f5f9":"var(--input-bg,#f8fafc)",outline:"none",color:"var(--text-secondary,#475569)",cursor:woFilter==="semua"?"not-allowed":"pointer",fontFamily:"inherit"}}>
          <option value="semua">Semua Panel</option>
          {allPanels.filter((p:any)=>woFilter==="semua"||p.wo===woFilter).map((p:any)=>(
            <option key={p.id} value={p.id}>{p.nama}</option>
          ))}
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
  const [addForm,setAddForm]=useState<{woId:string;panelIds:number[];prioritas:string}>({woId:"",panelIds:[],prioritas:"Sedang"});
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
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit,jumlah_orang,tipe_kapasitas"),
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
  const komponenSudahDipakaiTanggalLain=(()=>{
    const result=new Set<string>();
    const schedule=rawRow?.schedule||{};
    Object.entries(schedule).forEach(([tgl,entries]:[string,any])=>{
      if(tgl===cellModal?.date)return;
      (entries||[]).forEach((e:any)=>{
        (e.komponen||[]).forEach((kode:string)=>{
          const progress=livePanelForCell?.checklist?.[kode]?.progress?.[rawRow?.proses||""]||0;
          if(progress<100)return;
          result.add(kode);
        });
      });
    });
    return result;
  })();
  const wpItems=wpItemsAll.filter(it=>{
    const qty=livePanelForCell?.checklist?.[it.kode]?.qty||0;
    if(qty<=0)return false;
    return isKomponenRelevant(it.kode,rawRow?.proses||"")&&!komponenSudahAda.includes(it.kode)&&!komponenSudahDipakaiTanggalLain.has(it.kode);
  });

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
  const [addLoading,setAddLoading]=useState(false);
  const submitAdd=async()=>{
    if(addLoading)return;
    if(!addForm.woId||addForm.panelIds.length===0)return;
    const wo=woData.find(w=>w.id===Number(addForm.woId));
    if(!wo)return;
    setAddLoading(true);
    let totalPanelDitambah=0;
    for(const panelId of addForm.panelIds){
      const p=wo.panels.find(x=>x.id===panelId);
      if(!p)continue;
      const existing=rawData.filter(r=>(r.panel_id||r.panelId)===p.id).map(r=>r.proses);
      const toAdd=ALL_PROSES.filter(pr=>!existing.includes(pr));
      if(!toAdd.length)continue;
      for(const proses of toAdd){
        await createRaw({
          wo_id:wo.id,panel_id:p.id,proyek:wo.proyek,panel:p.nama,
          proses,prioritas:addForm.prioritas,schedule:{}
        });
      }
      totalPanelDitambah++;
      if(log) await log("TAMBAH RAW SCHEDULE","Tambah Panel "+p.nama+" ke Raw Schedule","raw_schedule",{module:"raw",action_type:"create",proyek:wo.proyek||"",panel:p.nama||"",wo_number:wo.wo||"",halaman:"Raw Schedule"});
    }
    await refetchRaw();
    setAddLoading(false);
    if(totalPanelDitambah===0){alert("Semua proses panel yang dipilih sudah ada!");}
    setAddModal(false);setAddForm({woId:"",panelIds:[],prioritas:"Sedang"});
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
              const prosesToShow=filterProses.length===0?["POTONG","BENDING","STEL","PAINTING","WIRING CONTROL","WIRING POWER"]:filterProses;
              const perProses:{nama:string;terpakai:number;kapasitas:number;adaOverride:boolean;satuan:string}[]=prosesToShow.map((pr:string)=>{
                const isOrangPr=PROSES_ORANG_RAW_GLOBAL.includes(pr);
                const ov=fcsKapasitas.find((k:any)=>k.jenis_pekerjaan===pr&&k.tanggal===d);
                const kapasitasPr=ov?(isOrangPr?Number(ov.jumlah_orang||0):Number(ov.kapasitas_menit||0)):0;
                let terpakaiPr=0;
                rawData.filter((r:any)=>r.proses===pr).forEach((r:any)=>{
                  const panelId=r.panel_id||r.panelId;
                  const panelData=woData.flatMap((w:any)=>w.panels||[]).find((p:any)=>Number(p.id)===Number(panelId));
                  if(!panelData)return;
                  const entries=r.schedule?.[d]||[];
                  entries.forEach((e:any)=>{
                    if(isOrangPr){
                      const orangMap:Record<string,number>=e.orangPerKomponen||{};
                      (e.komponen||[]).forEach((kode:string)=>{
                        terpakaiPr+=(orangMap[kode]!==undefined?orangMap[kode]:1);
                      });
                    } else {
                      (e.komponen||[]).forEach((kode:string)=>{
                        const qty=panelData.checklist?.[kode]?.qty||0;
                        const menitPcs=getMenitPerPcs(panelData.tipe,pr,kode);
                        terpakaiPr+=qty*menitPcs;
                      });
                    }
                  });
                });
                return {nama:pr,terpakai:terpakaiPr,kapasitas:kapasitasPr,adaOverride:!!ov,satuan:isOrangPr?"orang":"mnt"};
              });
              const adaOverride=perProses.some(pp=>pp.adaOverride);
              return(
                <div key={d} style={{background:"var(--card-bg,#fff)",border:"1px solid #e2e8f030",borderRadius:8,padding:"8px 12px",minWidth:130,textAlign:"center" as const}}>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{getDayLabel(d)}</div>
                  {!adaOverride?(
                    <div style={{fontSize:9,color:"#dc2626",fontWeight:700,marginBottom:4}}>⚠ Belum diatur</div>
                  ):(
                    <div style={{display:"flex",flexDirection:"column" as const,gap:5,textAlign:"left" as const}}>
                      {perProses.map(pp=>{
                        if(!pp.adaOverride){
                          return(
                            <div key={pp.nama} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9}}>
                              <span style={{color:"#64748b"}}>{pp.nama}</span>
                              <span style={{color:"#dc2626",fontWeight:700}}>Belum diatur</span>
                            </div>
                          );
                        }
                        const pctPr=pp.kapasitas>0?Math.min(Math.round((pp.terpakai/pp.kapasitas)*100),100):0;
                        const colorPr=pctPr>=95?"#dc2626":pctPr>=80?"#f59e0b":"#16a34a";
                        return(
                          <div key={pp.nama}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:9,marginBottom:2}}>
                              <span style={{color:"#64748b"}}>{pp.nama}</span>
                              <span style={{fontWeight:700,color:"#1e293b"}}>{Math.round(pp.terpakai)}/{pp.kapasitas} {pp.satuan}</span>
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
                const ai=ALL_PROSES.indexOf(a.proses);const bi=ALL_PROSES.indexOf(b.proses);
                return ai-bi;
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
            <div><Lbl>Panel ({addForm.panelIds.length} dipilih)</Lbl>
              <div style={{display:"flex",gap:8,marginBottom:6}}>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:panelOpts.map((p:any)=>p.id)})}
                  style={{fontSize:11,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",padding:0}}>Pilih Semua</button>
                <button type="button" onClick={()=>setAddForm({...addForm,panelIds:[]})}
                  style={{fontSize:11,color:"#64748b",background:"none",border:"none",cursor:"pointer",padding:0}}>Hapus Semua</button>
              </div>
              <div style={{maxHeight:220,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:6}}>
                {panelOpts.length===0&&(
                  <div style={{fontSize:12,color:"#94a3b8",padding:8,textAlign:"center" as const}}>Tidak ada panel tersedia</div>
                )}
                {panelOpts.map((p:any)=>{
                  const checked=addForm.panelIds.includes(p.id);
                  return(
                    <label key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,cursor:"pointer",background:checked?"#eff6ff":"transparent"}}>
                      <input type="checkbox" checked={checked} onChange={()=>{
                        setAddForm(prev=>({...prev,panelIds:checked?prev.panelIds.filter(id=>id!==p.id):[...prev.panelIds,p.id]}));
                      }}/>
                      <span style={{fontSize:13,color:"#1e293b"}}>#{p.no_pnl||p.noPnl} — {p.nama}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div><Lbl>Prioritas</Lbl>
              <Sel value={addForm.prioritas} onChange={e=>setAddForm({...addForm,prioritas:e.target.value})}>
                {PRIORITAS.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setAddModal(false)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={submitAdd} disabled={addLoading}>{addLoading?"Menambahkan...":"Tambah Panel"}</Btn>
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
  const [selectedQtyCells,setSelectedQtyCells]=useState<{panelId:number;kodes:string[]}|null>(null);
  const [qtyAnchor,setQtyAnchor]=useState<{panelId:number;kode:string}|null>(null);
  const blank={wo:"",proyek:"",target:""};
  const blankPanel={noPnl:"1",nama:"",tipe:"FS",qty:1};
  const [fcsModal,setFcsModal]=useState<any>(null);
  const [fcsLoading,setFcsLoading]=useState(false);
  const [fcsResult,setFcsResult]=useState<any>(null);
  const [fcsForm,setFcsForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),jenisPekerjaan:"POTONG"});
  const [selectedPanelIds,setSelectedPanelIds]=useState<number[]>([]);
  const [selectedKomponen,setSelectedKomponen]=useState<string[]>([]);
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

  const handleQtyCellClick=(panelId:number,kode:string,flatKodes:string[],shiftKey:boolean)=>{
    if(shiftKey&&qtyAnchor&&qtyAnchor.panelId===panelId){
      const startIdx=flatKodes.indexOf(qtyAnchor.kode);
      const endIdx=flatKodes.indexOf(kode);
      if(startIdx===-1||endIdx===-1)return;
      const lo=Math.min(startIdx,endIdx);
      const hi=Math.max(startIdx,endIdx);
      setSelectedQtyCells({panelId,kodes:flatKodes.slice(lo,hi+1)});
    } else {
      setQtyAnchor({panelId,kode});
      setSelectedQtyCells({panelId,kodes:[kode]});
    }
  };

  const handleQtyCopy=(woId:number,panelId:number,e:any)=>{
    if(!selectedQtyCells||selectedQtyCells.panelId!==panelId||selectedQtyCells.kodes.length<=1)return;
    const wo=woData.find((w:any)=>w.id===woId);
    const panel=wo?.panels?.find((p:any)=>p.id===panelId);
    if(!panel)return;
    const values=selectedQtyCells.kodes.map(kode=>panel.checklist?.[kode]?.qty??0);
    e.clipboardData.setData("text/plain",values.join("\n"));
    e.preventDefault();
  };

  const handleQtyPasteMulti=(woId:number,panelId:number,e:any)=>{
    if(!selectedQtyCells||selectedQtyCells.panelId!==panelId||selectedQtyCells.kodes.length<=1)return;
    const text=e.clipboardData.getData("text");
    const values=text.split(/\r?\n|\t/).map((v:string)=>v.trim()).filter((v:string)=>v!=="");
    if(values.length===0)return;
    e.preventDefault();
    selectedQtyCells.kodes.forEach((kode,idx)=>{
      const val=values.length===1?values[0]:values[idx];
      if(val===undefined)return;
      updateItemQty(woId,panelId,kode,parseFloat(val)||0);
    });
  };

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
                                      onClick={e=>{
                                        e.stopPropagation();
                                        const flatKodes=cfg.wps.flatMap((w:any)=>w.items).map((it:any)=>it.kode);
                                        handleQtyCellClick(p.id,item.kode,flatKodes,e.shiftKey);
                                      }}
                                      onCopy={e=>handleQtyCopy(wo.id,p.id,e)}
                                      onPaste={e=>{
                                        if(selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.length>1&&selectedQtyCells.kodes.includes(item.kode)){
                                          handleQtyPasteMulti(wo.id,p.id,e);
                                          return;
                                        }
                                        const text=e.clipboardData.getData("text");
                                        const values=text.split(/\r?\n|\t/).map(v=>v.trim()).filter(v=>v!=="");
                                        if(values.length<=1)return;
                                        e.preventDefault();
                                        const flatItems=cfg.wps.flatMap((w:any)=>w.items);
                                        const startIdx2=flatItems.findIndex((it:any)=>it.kode===item.kode);
                                        if(startIdx2===-1)return;
                                        values.forEach((val,idx)=>{
                                          const target=flatItems[startIdx2+idx];
                                          if(!target)return;
                                          const numVal=parseFloat(val)||0;
                                          updateItemQty(wo.id,p.id,target.kode,numVal);
                                        });
                                      }}
                                      style={{width:56,padding:"4px 6px",borderRadius:6,
                                        border:selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.includes(item.kode)?"1.5px solid #2563eb":`1.5px solid ${isLocked?"#fecaca":"#e2e8f0"}`,
                                        background:selectedQtyCells&&selectedQtyCells.panelId===p.id&&selectedQtyCells.kodes.includes(item.kode)?"#eff6ff":isLocked?"#fef2f2":"#fff",fontSize:12,textAlign:"center",
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
          <button onClick={()=>{
            const maxNo=panels.reduce((max,p)=>{const n=parseInt(p.noPnl)||0;return n>max?n:max;},0);
            setPanels([...panels,{...blankPanel,noPnl:String(maxNo+1)}]);
          }}
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
        <Modal title={"⏱ Generate FCS — WO "+fcsModal.wo} onClose={()=>{setFcsModal(null);setFcsResult(null);setSelectedKomponen([]);}} width={520}>
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
                    {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(()=>{
                // Komponen yang relevan untuk proses+tipe panel yang dipilih
                const selectedPanels=(fcsModal.panels||[]).filter((p:any)=>selectedPanelIds.includes(p.id));
                const tipeSet=new Set(selectedPanels.map((p:any)=>p.tipe));
                // Kumpulkan semua kode komponen yang relevan: punya proses ini di KOMPONEN_PROSES_MAP
                // dan tipenya match dengan panel yang dipilih
                const komponenRelevant:Array<{kode:string,nama:string}>=[];
                const seen=new Set<string>();
                selectedPanels.forEach((p:any)=>{
                  const cl=p.checklist||{};
                  Object.entries(cl).forEach(([kode,clVal]:any)=>{
                    if(seen.has(kode))return;
                    const prosesKomp=KOMPONEN_PROSES_MAP[kode]||[];
                    if(!prosesKomp.includes(fcsForm.jenisPekerjaan))return;
                    if((clVal?.qty||0)<=0)return;
                    seen.add(kode);
                    komponenRelevant.push({kode,nama:clVal?.nama||kode});
                  });
                });
                if(komponenRelevant.length===0)return null;
                return(
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>
                        Pilih Komponen ({selectedKomponen.length===0?"Semua":selectedKomponen.length+"/"+komponenRelevant.length})
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setSelectedKomponen([])}
                          style={{fontSize:10,color:"#16a34a",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Semua</button>
                        <button onClick={()=>setSelectedKomponen(komponenRelevant.map(k=>k.kode))}
                          style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                        <button onClick={()=>setSelectedKomponen([])}
                          style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      </div>
                    </div>
                    <div style={{maxHeight:160,overflowY:"auto" as const,border:"1px solid #e2e8f0",borderRadius:8,padding:8}}>
                      {komponenRelevant.map(k=>{
                        const checked=selectedKomponen.length===0||selectedKomponen.includes(k.kode);
                        return(
                          <label key={k.kode} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 6px",cursor:"pointer",borderRadius:6,
                            background:selectedKomponen.length>0&&selectedKomponen.includes(k.kode)?"#eff6ff":"transparent"}}>
                            <input type="checkbox" checked={selectedKomponen.length===0||selectedKomponen.includes(k.kode)}
                              onChange={()=>{
                                if(selectedKomponen.length===0){
                                  // Dari mode "semua", switch ke mode pilihan: exclude kode ini
                                  setSelectedKomponen(komponenRelevant.map(x=>x.kode).filter(x=>x!==k.kode));
                                } else if(selectedKomponen.includes(k.kode)){
                                  const next=selectedKomponen.filter(x=>x!==k.kode);
                                  // Kalau semua dipilih lagi, reset ke mode "semua"
                                  setSelectedKomponen(next.length===komponenRelevant.length?[]:next);
                                } else {
                                  const next=[...selectedKomponen,k.kode];
                                  setSelectedKomponen(next.length===komponenRelevant.length?[]:next);
                                }
                              }}/>
                            <span style={{fontSize:12,color:"#1e293b",fontWeight:600}}>{k.kode}</span>
                            <span style={{fontSize:11,color:"#64748b"}}>{k.nama}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>
                      {selectedKomponen.length===0?"Semua komponen akan dijadwalkan":"Hanya "+selectedKomponen.length+" komponen terpilih yang akan dijadwalkan"}
                    </div>
                  </div>
                );
              })()}
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
                      selectedKomponen:selectedKomponen.length>0?selectedKomponen:null,
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
  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"] as string[],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});
  const [overrideJenisDropdownOpen,setOverrideJenisDropdownOpen]=useState(false);
  const PROSES_ORANG=["WIRING POWER","WIRING CONTROL"];
  const isProsesOrang=(p:string)=>PROSES_ORANG.includes(p);
  const [overrideMode,setOverrideMode]=useState<"single"|"rentang">("single");
  const [rentangForm,setRentangForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),tanggalAkhir:new Date().toISOString().slice(0,10),hariAktif:[1,2,3,4,5] as number[],jenis_pekerjaan:["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"] as string[],jam_kerja:8,efektivitas_pct:80,keterangan:""});
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
    const prosesList=Array.isArray(rentangForm.jenis_pekerjaan)?rentangForm.jenis_pekerjaan:[rentangForm.jenis_pekerjaan];
    const rows:any[]=[];
    let cur=new Date(rentangForm.tanggalMulai);
    const end=new Date(rentangForm.tanggalAkhir);
    let safety=0;
    while(cur<=end&&safety<366){
      const hari=cur.getDay()===0?7:cur.getDay();
      if(rentangForm.hariAktif.includes(hari)){
        const tgl=cur.toISOString().slice(0,10);
        for(const proses of prosesList){
          const isOrangRentang=isProsesOrang(proses);
          rows.push({
            tanggal:tgl,
            jenis_pekerjaan:proses,
            ...(isOrangRentang
              ?{tipe_kapasitas:"orang",jumlah_orang:Number(rentangForm.jumlah_orang),jam_kerja:null,efektivitas_pct:100}
              :{tipe_kapasitas:"jam",jam_kerja:Number(rentangForm.jam_kerja),efektivitas_pct:Number(rentangForm.efektivitas_pct),jumlah_orang:null}),
            keterangan:rentangForm.keterangan,
            created_by:createdBy,
          });
        }
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
  const ALL_PROSES=["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"];
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
    if(overrideForm.jenis_pekerjaan.length===0){alert("Pilih minimal 1 jenis pekerjaan");return;}
    const isOrang=isProsesOrang(overrideForm.jenis_pekerjaan[0]);
    if(!overrideForm.tanggal)return;
    if(isOrang&&!overrideForm.jumlah_orang)return;
    if(!isOrang&&!overrideForm.jam_kerja)return;
    const payload:any=isOrang
      ?{tipe_kapasitas:"orang",jumlah_orang:Number(overrideForm.jumlah_orang),jam_kerja:null,efektivitas_pct:100,keterangan:overrideForm.keterangan}
      :{tipe_kapasitas:"jam",jam_kerja:Number(overrideForm.jam_kerja),efektivitas_pct:Number(overrideForm.efektivitas_pct),jumlah_orang:null,keterangan:overrideForm.keterangan};
    if(editOverride){
      const{error}=await supabase.from("fcs_kapasitas_override").update(payload).eq("id",editOverride.id);
      if(!error){await fetchOverride();setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});}
      else alert("Gagal simpan: "+error.message);
    } else {
      const sudahAda=overrideForm.jenis_pekerjaan.filter(jp=>overrideList.some((o:any)=>o.tanggal===overrideForm.tanggal&&o.jenis_pekerjaan===jp));
      const belumAda=overrideForm.jenis_pekerjaan.filter(jp=>!sudahAda.includes(jp));
      if(belumAda.length===0){
        alert("Semua jenis pekerjaan yang dipilih sudah ada override untuk tanggal ini. Gunakan tombol Edit di tabel untuk mengubahnya.");
        return;
      }
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const rows=belumAda.map(jp=>({
        tanggal:overrideForm.tanggal,
        jenis_pekerjaan:jp,
        ...payload,
        created_by:sess?.nama||sess?.name||"Admin",
      }));
      const{error}=await supabase.from("fcs_kapasitas_override").insert(rows);
      if(!error){
        await fetchOverride();
        setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,jumlah_orang:6,keterangan:""});
        if(sudahAda.length>0){
          alert("Berhasil ditambahkan untuk: "+belumAda.join(", ")+".\nDilewati karena sudah ada override: "+sudahAda.join(", ")+" (gunakan tombol Edit untuk mengubahnya).");
        }
      }
      else alert("Gagal simpan: "+error.message);
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
      } else if(error){
        alert("Gagal simpan: "+error.message);
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
            if(groupItems.length===0&&!(showAddProc&&proses===procForm.jenis_pekerjaan))return null;
            const procColors:any={
              POTONG:"#f59e0b",BENDING:"#8b5cf6",STEL:"#06b6d4",RENDAM:"#0ea5e9",PAINTING:"#ec4899",
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

      {showAddProc&&(
        <div onClick={()=>{setShowAddProc(false);setEditProc(null);}}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:560,padding:20,maxHeight:"85vh",overflowY:"auto" as const}}>
            <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:14}}>{editProc?"✏️ Edit Process Time":"➕ Tambah Process Time"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tipe Panel</div>
                <select value={procForm.tipe_panel} onChange={e=>setProcForm({...procForm,tipe_panel:e.target.value,kode_komponen:"",nama_komponen:""})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_TIPE.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>WP</div>
                <select value={procForm.wp} onChange={e=>setProcForm({...procForm,wp:e.target.value,kode_komponen:"",nama_komponen:""})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_WP.map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Komponen (dari Manajemen WO)</div>
              <select value={procForm.kode_komponen} disabled={!!editProc}
                onChange={e=>{
                  const kode=e.target.value;
                  const cfg=(PANEL_TYPES as any)[procForm.tipe_panel];
                  const item=cfg?.wps.find((w:any)=>w.wp===procForm.wp)?.items.find((it:any)=>it.kode===kode);
                  setProcForm({...procForm,kode_komponen:kode,nama_komponen:item?.nama||""});
                }}
                style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,background:editProc?"#f1f5f9":"#fff"}}>
                <option value="">-- Pilih komponen --</option>
                {((PANEL_TYPES as any)[procForm.tipe_panel]?.wps.find((w:any)=>w.wp===procForm.wp)?.items||[]).map((it:any)=>(
                  <option key={it.kode} value={it.kode}>{it.kode} — {it.nama}</option>
                ))}
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <select value={procForm.jenis_pekerjaan} onChange={e=>setProcForm({...procForm,jenis_pekerjaan:e.target.value})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13}}>
                  {ALL_PROSES.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Menit/Pcs</div>
                <input type="number" min="0" step="0.25" value={procForm.menit_per_pcs}
                  onChange={e=>setProcForm({...procForm,menit_per_pcs:parseFloat(e.target.value)||0})}
                  style={{width:"100%",padding:"9px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,textAlign:"center" as const}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>{setShowAddProc(false);setEditProc(null);}}
                style={{padding:"8px 16px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
              <button onClick={saveProcess}
                style={{padding:"8px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editProc?"Simpan":"+ Tambah"}</button>
            </div>
          </div>
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
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10,alignItems:"flex-end"}}>
                <div style={{gridColumn:"span 3"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Jenis Pekerjaan ({Array.isArray(rentangForm.jenis_pekerjaan)?rentangForm.jenis_pekerjaan.length:1} dipilih)</div>
                    <div style={{display:"flex",gap:6}}>
                      <button type="button" onClick={()=>setRentangForm(f=>({...f,jenis_pekerjaan:["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"]}))}
                        style={{fontSize:10,color:"#16a34a",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Pilih Semua</button>
                      <button type="button" onClick={()=>setRentangForm(f=>({...f,jenis_pekerjaan:[]}))}
                        style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap" as const,gap:4}}>
                    {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>{
                      const arr=Array.isArray(rentangForm.jenis_pekerjaan)?rentangForm.jenis_pekerjaan:[rentangForm.jenis_pekerjaan];
                      const checked=arr.includes(p);
                      return(
                        <button key={p} type="button" onClick={()=>{
                          const cur=Array.isArray(rentangForm.jenis_pekerjaan)?rentangForm.jenis_pekerjaan:[rentangForm.jenis_pekerjaan];
                          setRentangForm(f=>({...f,jenis_pekerjaan:checked?cur.filter(x=>x!==p):[...cur,p]}));
                        }}
                          style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${checked?"#9333ea":"#e2e8f0"}`,
                            background:checked?"#f5f3ff":"#f8fafc",color:checked?"#7c3aed":"#64748b",
                            fontSize:11,fontWeight:checked?700:400,cursor:"pointer"}}>
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isProsesOrang(rentangForm.jenis_pekerjaan)?(
                  <div style={{gridColumn:"span 2"}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#1d4ed8",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>👥 Jumlah Orang</div>
                    <input type="number" min="0" step="1" value={rentangForm.jumlah_orang}
                      onChange={e=>setRentangForm({...rentangForm,jumlah_orang:parseFloat(e.target.value)||0})}
                      style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #93c5fd",fontSize:12,textAlign:"center" as const,background:"#eff6ff"}}/>
                  </div>
                ):(
                <>
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
                </>
                )}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Keterangan</div>
                  <input value={rentangForm.keterangan} onChange={e=>setRentangForm({...rentangForm,keterangan:e.target.value})}
                    placeholder="opsional..."
                    style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12}}/>
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
                <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#16a34a",fontWeight:600}}>
                  {isProsesOrang(rentangForm.jenis_pekerjaan)?(
                    <>{rentangForm.jumlah_orang} orang/hari</>
                  ):(
                    <>{rentangForm.jam_kerja} jam × 60 × {rentangForm.efektivitas_pct}% = <strong>{Math.round(rentangForm.jam_kerja*60*rentangForm.efektivitas_pct/100)} menit</strong>/hari</>
                  )}
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
        <>
        {!editOverride&&(
          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?"✏️ Edit Override":"➕ Tambah Override"}</div>
            <div style={{display:"grid",gridTemplateColumns:"140px 160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal</div>
                <input type="date" value={overrideForm.tanggal} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,tanggal:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}/>
              </div>
              <div style={{position:"relative" as const}}>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <button type="button" disabled={!!editOverride}
                  onClick={()=>setOverrideJenisDropdownOpen(o=>!o)}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff",textAlign:"left" as const,cursor:editOverride?"default":"pointer",fontFamily:"inherit",color:"#1e293b"}}>
                  {overrideForm.jenis_pekerjaan.length===0?"Pilih...":overrideForm.jenis_pekerjaan.join(", ")}
                </button>
                {overrideJenisDropdownOpen&&!editOverride&&(
                  <div style={{position:"absolute" as const,top:"100%",left:0,marginTop:4,background:"#fff",border:"1px solid #e2e8f0",borderRadius:7,boxShadow:"0 4px 12px #00000018",zIndex:20,maxHeight:220,overflowY:"auto" as const,minWidth:200}}>
                    {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>{
                      const selected=overrideForm.jenis_pekerjaan;
                      const isChecked=selected.includes(p);
                      const lockedKategoriOrang=selected.length>0&&isProsesOrang(selected[0]);
                      const pIsOrang=isProsesOrang(p);
                      const disabledOpt=selected.length>0&&!isChecked&&(lockedKategoriOrang!==pIsOrang);
                      return(
                        <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",fontSize:12,cursor:disabledOpt?"not-allowed":"pointer",opacity:disabledOpt?0.4:1,color:"#1e293b"}}>
                          <input type="checkbox" checked={isChecked} disabled={disabledOpt}
                            onChange={()=>{
                              setOverrideForm(f=>({...f,jenis_pekerjaan:isChecked?f.jenis_pekerjaan.filter(x=>x!==p):[...f.jenis_pekerjaan,p]}));
                            }}/>
                          {p}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {isProsesOrang(overrideForm.jenis_pekerjaan[0]||"POTONG")?(
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
                {isProsesOrang(overrideForm.jenis_pekerjaan[0]||"POTONG")?(
                  <>{overrideForm.jumlah_orang} orang = <strong>{overrideForm.jumlah_orang} panel/hari</strong></>
                ):(
                  <>{overrideForm.jam_kerja} jam × 60 × {overrideForm.efektivitas_pct}% = <strong>{Math.round(overrideForm.jam_kerja*60*overrideForm.efektivitas_pct/100)} menit</strong></>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                {editOverride&&(
                  <button onClick={()=>{setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,keterangan:""} as any);}}
                    style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                )}
                <button onClick={saveOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editOverride?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          </div>
          
        )}
        {editOverride&&(
          <div onClick={()=>{setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,keterangan:""} as any);}}
            style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
            <div onClick={(e:any)=>e.stopPropagation()} style={{width:"100%",maxWidth:760,maxHeight:"85vh",overflowY:"auto" as const}}>
          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>
            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?"✏️ Edit Override":"➕ Tambah Override"}</div>
            <div style={{display:"grid",gridTemplateColumns:"140px 160px 100px 100px 1fr",gap:10,alignItems:"flex-end"}}>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Tanggal</div>
                <input type="date" value={overrideForm.tanggal} disabled={!!editOverride}
                  onChange={e=>setOverrideForm({...overrideForm,tanggal:e.target.value})}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff"}}/>
              </div>
              <div style={{position:"relative" as const}}>
                <div style={{fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:4}}>Jenis Pekerjaan</div>
                <button type="button" disabled={!!editOverride}
                  onClick={()=>setOverrideJenisDropdownOpen(o=>!o)}
                  style={{width:"100%",padding:"7px 10px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:12,background:editOverride?"#f1f5f9":"#fff",textAlign:"left" as const,cursor:editOverride?"default":"pointer",fontFamily:"inherit",color:"#1e293b"}}>
                  {overrideForm.jenis_pekerjaan.length===0?"Pilih...":overrideForm.jenis_pekerjaan.join(", ")}
                </button>
                {overrideJenisDropdownOpen&&!editOverride&&(
                  <div style={{position:"absolute" as const,top:"100%",left:0,marginTop:4,background:"#fff",border:"1px solid #e2e8f0",borderRadius:7,boxShadow:"0 4px 12px #00000018",zIndex:20,maxHeight:220,overflowY:"auto" as const,minWidth:200}}>
                    {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>{
                      const selected=overrideForm.jenis_pekerjaan;
                      const isChecked=selected.includes(p);
                      const lockedKategoriOrang=selected.length>0&&isProsesOrang(selected[0]);
                      const pIsOrang=isProsesOrang(p);
                      const disabledOpt=selected.length>0&&!isChecked&&(lockedKategoriOrang!==pIsOrang);
                      return(
                        <label key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",fontSize:12,cursor:disabledOpt?"not-allowed":"pointer",opacity:disabledOpt?0.4:1,color:"#1e293b"}}>
                          <input type="checkbox" checked={isChecked} disabled={disabledOpt}
                            onChange={()=>{
                              setOverrideForm(f=>({...f,jenis_pekerjaan:isChecked?f.jenis_pekerjaan.filter(x=>x!==p):[...f.jenis_pekerjaan,p]}));
                            }}/>
                          {p}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              {isProsesOrang(overrideForm.jenis_pekerjaan[0]||"POTONG")?(
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
                {isProsesOrang(overrideForm.jenis_pekerjaan[0]||"POTONG")?(
                  <>{overrideForm.jumlah_orang} orang = <strong>{overrideForm.jumlah_orang} panel/hari</strong></>
                ):(
                  <>{overrideForm.jam_kerja} jam × 60 × {overrideForm.efektivitas_pct}% = <strong>{Math.round(overrideForm.jam_kerja*60*overrideForm.efektivitas_pct/100)} menit</strong></>
                )}
              </div>
              <div style={{display:"flex",gap:8}}>
                {editOverride&&(
                  <button onClick={()=>{setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:["POTONG"],jam_kerja:8,efektivitas_pct:80,keterangan:""} as any);}}
                    style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Batal</button>
                )}
                <button onClick={saveOverride}
                  style={{padding:"7px 18px",borderRadius:7,border:"none",background:"#1d4ed8",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{editOverride?"Simpan":"+ Tambah"}</button>
              </div>
            </div>
          </div>
          
            </div>
          </div>
        )}
        </>
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
              {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].filter((p:string)=>!filterProsesOverride.includes(p)).map((p:string)=>(
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
                          <button onClick={()=>{setEditOverride(o);setOverrideForm({tanggal:o.tanggal,jenis_pekerjaan:[o.jenis_pekerjaan],jam_kerja:o.jam_kerja,efektivitas_pct:o.efektivitas_pct,jumlah_orang:overrideForm.jumlah_orang,keterangan:o.keterangan||""});}}
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
                          <button onClick={()=>{setEditOverride(o);setOverrideForm({tanggal:o.tanggal,jenis_pekerjaan:[o.jenis_pekerjaan],jam_kerja:overrideForm.jam_kerja,efektivitas_pct:overrideForm.efektivitas_pct,jumlah_orang:o.jumlah_orang,keterangan:o.keterangan||""});}}
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

// FCSScheduleTab — UI baru: card per WO, filter proses, pilih panel, atur tanggal per WP
function FCSScheduleTab({woData,user}:any){
  const [filterPekerjaan,setFilterPekerjaan]=useState("POTONG");
  const [scheduleList,setScheduleList]=useState<any[]>([]);
  const [kapasitasList,setKapasitasList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [expandedWO,setExpandedWO]=useState<string|null>(null);
  const [selectedPanels,setSelectedPanels]=useState<Record<string,number[]>>({});
  const [wpTanggal,setWpTanggal]=useState<Record<string,Record<string,string>>>({});
  const [wpPreview,setWpPreview]=useState<Record<string,Record<string,any[]>>>({});
  const [syncing,setSyncing]=useState<string|null>(null);
  const [calculating,setCalculating]=useState<string|null>(null);

  const WP_COLORS:any={
    WP1:{color:"#2563eb",bg:"#eff6ff"},
    WP2:{color:"#059669",bg:"#ecfdf5"},
    WP3:{color:"#d97706",bg:"#fffbeb"},
    WP4:{color:"#7c3aed",bg:"#f5f3ff"},
    WP5:{color:"#dc2626",bg:"#fef2f2"},
    WP6:{color:"#0891b2",bg:"#ecfeff"},
  };

  useEffect(()=>{fetchAll();},[filterPekerjaan,woData]);

  const fetchAll=async()=>{
    setLoading(true);
    const [{data:s},{data:k}]=await Promise.all([
      supabase.from("fcs_schedule").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .neq("status","cancelled")
        .order("tanggal",{ascending:true})
        .order("wp",{ascending:true}),
      supabase.from("fcs_kapasitas_override").select("*")
        .eq("jenis_pekerjaan",filterPekerjaan)
        .order("tanggal",{ascending:true}),
    ]);
    setScheduleList(s??[]);
    setKapasitasList(k??[]);
    setLoading(false);
  };

  const kapasitasMap=useMemo(()=>{
    const map:Record<string,number>={};
    kapasitasList.forEach((k:any)=>{map[k.tanggal]=Number(k.kapasitas_menit);});
    return map;
  },[kapasitasList]);

  // kapTerpakaiMap per WO - exclude WO yang sedang dihitung supaya tidak double-count
  const getKapTerpakaiExcludeWO=(woNum:string)=>{
    const map:Record<string,number>={};
    scheduleList.filter((s:any)=>s.wo_number!==woNum).forEach((s:any)=>{
      map[s.tanggal]=(map[s.tanggal]||0)+Number(s.total_menit);
    });
    return map;
  };
  const kapTerpakaiMap=useMemo(()=>{
    const map:Record<string,number>={};
    scheduleList.forEach((s:any)=>{
      map[s.tanggal]=(map[s.tanggal]||0)+Number(s.total_menit);
    });
    return map;
  },[scheduleList]);

  const woGroups=useMemo(()=>{
    const groups:Record<string,{wo:string,proyek:string,panels:Record<string,{nama:string,wps:Record<string,any[]>}>}>={};
    scheduleList.forEach((s:any)=>{
      if(!groups[s.wo_number])groups[s.wo_number]={wo:s.wo_number,proyek:s.proyek,panels:{}};
      if(!groups[s.wo_number].panels[s.panel_id])groups[s.wo_number].panels[s.panel_id]={nama:s.panel_nama,wps:{}};
      if(!groups[s.wo_number].panels[s.panel_id].wps[s.wp])groups[s.wo_number].panels[s.panel_id].wps[s.wp]=[];
      groups[s.wo_number].panels[s.panel_id].wps[s.wp].push(s);
    });
    return groups;
  },[scheduleList]);

  const addDaysStr=(date:string,n:number)=>{
    const d=new Date(date);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);
  };

  const hitungDistribusiWP=(rows:any[],tanggalMulai:string,existingTerpakai:Record<string,number>)=>{
    const tracker={...existingTerpakai};
    const result:any[]=[];
    let cur=tanggalMulai;
    let attempts=0;
    while(attempts<90&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);attempts++;}
    if(attempts>=90)return[];
    for(const row of rows){
      let sisaQty=row.qty_total;
      let dayAttempts=0;
      while(sisaQty>0&&dayAttempts<90){
        const kap=kapasitasMap[cur]||0;
        const terpakai=tracker[cur]||0;
        const sisa=kap-terpakai;
        if(sisa<row.menit_per_pcs){
          cur=addDaysStr(cur,1);
          let skip=0;
          while(skip<30&&(!kapasitasMap[cur]||kapasitasMap[cur]<=0)){cur=addDaysStr(cur,1);skip++;}
          dayAttempts++;continue;
        }
        const maxQty=Math.floor(sisa/row.menit_per_pcs);
        const qtyHari=Math.min(sisaQty,maxQty);
        const mntHari=qtyHari*row.menit_per_pcs;
        result.push({...row,tanggal:cur,qty_hari:qtyHari,total_menit_hari:mntHari});
        tracker[cur]=(tracker[cur]||0)+mntHari;
        sisaQty-=qtyHari;
        dayAttempts++;
      }
      if(sisaQty>0){
        result.push({...row,tanggal:cur,qty_hari:sisaQty,total_menit_hari:sisaQty*row.menit_per_pcs,overflow:true});
      }
    }
    return result;
  };

  const handleHitung=async(woNum:string,wp:string,panelIds:number[])=>{
    const key=`${woNum}_${wp}`;
    const tanggalMulai=wpTanggal[woNum]?.[wp];
    if(!tanggalMulai){alert("Pilih tanggal mulai dulu!");return;}
    setCalculating(key);
    const rows:any[]=[];
    panelIds.forEach(pid=>{
      const panel=woGroups[woNum]?.panels[pid];
      if(!panel)return;
      (panel.wps[wp]||[]).forEach((r:any)=>rows.push(r));
    });
    // Exclude kapasitas WO yang sedang dihitung supaya tidak double-count dirinya sendiri
    const kapExclude=getKapTerpakaiExcludeWO(woNum);
    // Tambahkan kapasitas yang sudah dipakai preview WP lain supaya WP2 tidak masuk di tanggal penuh WP1
    const kapIncludePreview:{[tgl:string]:number}={...kapExclude};
    const previewWO=wpPreview[woNum]||{};
    Object.entries(previewWO).forEach(([wpLain,previewRows]:any)=>{
      if(wpLain===wp)return;
      previewRows.forEach((r:any)=>{
        kapIncludePreview[r.tanggal]=(kapIncludePreview[r.tanggal]||0)+r.total_menit_hari;
      });
    });
    const preview=hitungDistribusiWP(rows,tanggalMulai,kapIncludePreview);
    // Sort preview berdasarkan tanggal supaya tampil urut
    const previewSorted=[...preview].sort((a,b)=>a.tanggal.localeCompare(b.tanggal));
    setWpPreview(prev=>({...prev,[woNum]:{...(prev[woNum]||{}),[wp]:previewSorted}}));
    setCalculating(null);
  };

  const handleSync=async(woNum:string)=>{
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const panelIds=selectedPanels[woNum]||[];
    if(panelIds.length===0){alert("Pilih minimal 1 panel!");return;}
    const wps=new Set<string>();
    panelIds.forEach(pid=>{
      const panel=woGroups[woNum]?.panels[pid];
      if(panel)Object.keys(panel.wps).forEach(wp=>wps.add(wp));
    });
    const belumHitung=[...wps].filter(wp=>!wpPreview[woNum]?.[wp]);
    if(belumHitung.length>0){alert(`Hitung dulu jadwal untuk: ${belumHitung.join(", ")}`);return;}
    setSyncing(woNum);
    try{
      for(const wp of wps){
        const preview=wpPreview[woNum]?.[wp]||[];
        for(const item of preview){
          await supabase.from("fcs_schedule")
            .update({tanggal:item.tanggal,qty_hari:item.qty_hari,total_menit:item.total_menit_hari})
            .eq("id",item.id);
        }
      }
      let sukses=0;let gagal=0;
      for(const pid of panelIds){
        const panel=woGroups[woNum]?.panels[pid];
        if(!panel)continue;
        const res=await syncFCSToRawSchedule(woNum,filterPekerjaan,uname,panel.nama,null);
        if(res.success)sukses++;else gagal++;
      }
      alert(`Sync selesai! ${sukses} panel berhasil${gagal>0?`, ${gagal} gagal`:""}`);
      fetchAll();
      setWpPreview(prev=>{const n={...prev};delete n[woNum];return n;});
    }catch(e:any){alert("Error: "+e.message);}
    setSyncing(null);
  };

  if(loading)return(
    <div style={{padding:40,textAlign:"center" as const,color:"#64748b"}}>
      <div style={{fontSize:24,marginBottom:8}}>⏳</div>
      <div>Memuat FCS Schedule...</div>
    </div>
  );

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:18,color:"var(--text-primary,#1e293b)",marginBottom:4}}>⏱ FCS Schedule</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Atur jadwal produksi per WP per panel, lalu sync ke Raw Schedule</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap" as const,marginBottom:16,background:"var(--card-bg,#fff)",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border-color,#e2e8f0)"}}>
        <span style={{fontSize:11,fontWeight:700,color:"#64748b",alignSelf:"center"}}>PROSES:</span>
        {["POTONG","BENDING","STEL","RENDAM","PAINTING","RAKIT","PASANG KOMPONEN","BUSBAR","WIRING CONTROL","WIRING POWER","QC TEST","PACKING"].map(p=>(
          <button key={p} onClick={()=>{setFilterPekerjaan(p);setWpPreview({});setSelectedPanels({});}}
            style={{padding:"4px 10px",borderRadius:6,border:`1.5px solid ${filterPekerjaan===p?"#1d4ed8":"#e2e8f0"}`,
              background:filterPekerjaan===p?"#1d4ed8":"#f8fafc",
              color:filterPekerjaan===p?"#fff":"#64748b",
              fontSize:11,fontWeight:filterPekerjaan===p?700:400,cursor:"pointer"}}>
            {p}
          </button>
        ))}
        <button onClick={fetchAll} style={{marginLeft:"auto",height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer"}}>↻ Refresh</button>
      </div>
      {Object.keys(woGroups).length===0?(
        <div style={{padding:40,textAlign:"center" as const,color:"#94a3b8",background:"var(--card-bg,#fff)",borderRadius:10,border:"1px solid var(--border-color,#e2e8f0)"}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div style={{fontSize:14,fontWeight:600}}>Tidak ada FCS Schedule untuk proses {filterPekerjaan}</div>
          <div style={{fontSize:12,marginTop:4}}>Generate FCS dari Manajemen WO terlebih dahulu</div>
        </div>
      ):(
        Object.values(woGroups).map((wo:any)=>{
          const isExpanded=expandedWO===wo.wo;
          const allPanelIds=Object.keys(wo.panels).map(Number);
          const selPanels=selectedPanels[wo.wo]||[];
          const allWPs=[...new Set(Object.values(wo.panels).flatMap((p:any)=>Object.keys(p.wps)))].sort();
          const totalRows=Object.values(wo.panels).reduce((a:number,p:any)=>a+Object.values(p.wps).reduce((b:number,rows:any)=>b+(rows as any[]).length,0),0);
          return(
            <div key={wo.wo} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,marginBottom:10,overflow:"hidden"}}>
              <div onClick={()=>setExpandedWO(isExpanded?null:wo.wo)}
                style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",cursor:"pointer",
                  background:isExpanded?"#f8faff":"var(--card-bg,#fff)",
                  borderBottom:isExpanded?"1px solid #e2e8f0":"none"}}>
                <span style={{fontSize:14}}>{isExpanded?"▼":"▶"}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:"var(--text-primary,#1e293b)"}}>WO {wo.wo} — {wo.proyek}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{allPanelIds.length} panel · {totalRows} jadwal · {allWPs.join(", ")}</div>
                </div>
                {selPanels.length>0&&<span style={{background:"#eff6ff",color:"#1d4ed8",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{selPanels.length} panel dipilih</span>}
              </div>
              {isExpanded&&(
                <div style={{padding:"14px 16px"}}>
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4}}>Pilih Panel ({selPanels.length}/{allPanelIds.length})</div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setSelectedPanels(p=>({...p,[wo.wo]:allPanelIds}))} style={{fontSize:10,color:"#1d4ed8",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Semua</button>
                        <button onClick={()=>setSelectedPanels(p=>({...p,[wo.wo]:[]}))} style={{fontSize:10,color:"#dc2626",background:"none",border:"none",cursor:"pointer",fontWeight:600}}>Kosongkan</button>
                      </div>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:6}}>
                      {Object.entries(wo.panels).map(([pid,panel]:any)=>{
                        const checked=selPanels.includes(Number(pid));
                        // Panel disabled kalau sudah punya data di fcs_schedule untuk proses ini
                        const sudahTerjadwal=scheduleList.some((s:any)=>s.panel_id===Number(pid)&&s.wo_number===wo.wo);
                        return(
                          <label key={pid} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:7,
                            border:`1.5px solid ${sudahTerjadwal?"#94a3b8":checked?"#1d4ed8":"#e2e8f0"}`,
                            background:sudahTerjadwal?"#f1f5f9":checked?"#eff6ff":"#f8fafc",cursor:sudahTerjadwal?"not-allowed":"pointer",
                            opacity:sudahTerjadwal?0.6:1}}>
                            <input type="checkbox" checked={checked} disabled={sudahTerjadwal} onChange={()=>{
                              setSelectedPanels(prev=>{
                                const cur=prev[wo.wo]||[];
                                return{...prev,[wo.wo]:checked?cur.filter(x=>x!==Number(pid)):[...cur,Number(pid)]};
                              });
                            }}/>
                            <span style={{fontSize:12,color:checked?"#1d4ed8":"#1e293b",fontWeight:checked?700:400}}>{panel.nama}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {selPanels.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:8}}>Atur Jadwal per WP</div>
                      {allWPs.map(wp=>{
                        const wpColor=WP_COLORS[wp]||{color:"#64748b",bg:"#f1f5f9"};
                        const key=`${wo.wo}_${wp}`;
                        const preview=wpPreview[wo.wo]?.[wp];
                        const isCalc=calculating===key;
                        const komponenList:string[]=[];
                        selPanels.forEach(pid=>{
                          const panel=wo.panels[pid];
                          if(panel?.wps[wp]){panel.wps[wp].forEach((r:any)=>{if(!komponenList.includes(r.nama_komponen))komponenList.push(r.nama_komponen);});}
                        });
                        return(
                          <div key={wp} style={{border:`1.5px solid ${wpColor.color}30`,borderRadius:8,padding:"10px 12px",marginBottom:8,background:wpColor.bg+"40"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                              <span style={{background:wpColor.color,color:"#fff",borderRadius:5,padding:"2px 8px",fontSize:11,fontWeight:700}}>{wp}</span>
                              <span style={{fontSize:11,color:"#64748b",flex:1}}>{komponenList.slice(0,3).join(", ")}{komponenList.length>3?` +${komponenList.length-3} lainnya`:""}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" as const}}>
                              <div style={{fontSize:10,fontWeight:600,color:"#64748b"}}>Tanggal mulai:</div>
                              <input type="date"
                                value={wpTanggal[wo.wo]?.[wp]||new Date().toISOString().slice(0,10)}
                                onChange={e=>setWpTanggal(prev=>({...prev,[wo.wo]:{...(prev[wo.wo]||{}),[wp]:e.target.value}}))}
                                style={{padding:"4px 8px",borderRadius:6,border:"1.5px solid #e2e8f0",fontSize:11,fontFamily:"inherit"}}/>
                              <button onClick={()=>handleHitung(wo.wo,wp,selPanels)} disabled={isCalc}
                                style={{padding:"4px 12px",borderRadius:6,border:"none",background:isCalc?"#94a3b8":wpColor.color,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                {isCalc?"⏳...":"Hitung →"}
                              </button>
                              {preview&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>✓ {[...new Set(preview.map((p:any)=>p.tanggal))].length} hari · {preview.length} baris</span>}
                            </div>
                            {preview&&(
                              <div style={{marginTop:8,display:"flex",flexWrap:"wrap" as const,gap:4}}>
                                {([...new Set(preview.map((p:any)=>p.tanggal))] as string[]).map((tgl:string)=>{
                                  const dayRows=preview.filter((p:any)=>p.tanggal===tgl);
                                  const mnt=dayRows.reduce((a:number,b:any)=>a+b.total_menit_hari,0);
                                  const kap=kapasitasMap[tgl]||0;
                                  const pct=kap>0?Math.round(mnt/kap*100):0;
                                  const color=pct>=90?"#dc2626":pct>=70?"#d97706":"#16a34a";
                                  return(
                                    <div key={tgl} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${color}30`,background:`${color}10`,fontSize:10}}>
                                      <div style={{fontWeight:600,color:"#1e293b"}}>{new Date(tgl).toLocaleDateString("id-ID",{day:"numeric",month:"short"})}</div>
                                      <div style={{color}}>{mnt} mnt ({pct}%)</div>
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
                  {selPanels.length>0&&(
                    <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                      <button onClick={fetchAll} style={{padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#64748b",fontSize:12,cursor:"pointer"}}>↻ Refresh</button>
                      <button onClick={()=>handleSync(wo.wo)} disabled={syncing===wo.wo}
                        style={{padding:"7px 18px",borderRadius:7,border:"none",background:syncing===wo.wo?"#94a3b8":"#7c3aed",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        {syncing===wo.wo?"⏳ Syncing...":"⇄ Sync Panel Terpilih"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}


function ForumWO({user}:any){
  const [posts,setPosts]=useState<any[]>([]);
  const [attachMap,setAttachMap]=useState<Record<number,any[]>>({});
  const [caption,setCaption]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [uploading,setUploading]=useState(false);
  const [loading,setLoading]=useState(true);
  const [searchQuery,setSearchQuery]=useState("");
  const [filterAuthor,setFilterAuthor]=useState("ALL");

  const fetchPosts=async()=>{
    setLoading(true);
    const{data:p}=await supabase.from("fcs_forum_post").select("*").order("created_at",{ascending:false});
    setPosts(p??[]);
    if(p&&p.length>0){
      const ids=p.map((x:any)=>x.id);
      const{data:a}=await supabase.from("fcs_forum_attachment").select("*").in("post_id",ids).order("uploaded_at",{ascending:true});
      const map:Record<number,any[]>={};
      (a??[]).forEach((att:any)=>{
        if(!map[att.post_id])map[att.post_id]=[];
        map[att.post_id].push(att);
      });
      setAttachMap(map);
    } else {
      setAttachMap({});
    }
    setLoading(false);
  };

  useEffect(()=>{
    fetchPosts();
    const ch=supabase.channel("realtime-forum-wo")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_forum_post"},fetchPosts)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_forum_attachment"},fetchPosts)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };

  const submitPost=async()=>{
    if(!caption.trim()&&files.length===0){alert("Tulis caption atau lampirkan minimal 1 file");return;}
    setUploading(true);
    const authorName=user?.name||user?.nama||"Admin";
    const{data:post,error:postErr}=await supabase.from("fcs_forum_post").insert({
      author_name:authorName,
      caption:caption.trim()||null,
    }).select().single();
    if(postErr||!post){
      alert("Gagal membuat post: "+(postErr?.message||"unknown error"));
      setUploading(false);
      return;
    }
    for(const file of files){
      const ext=file.name.split(".").pop();
      const safeName=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path=`${post.id}/${safeName}`;
      const{error:upErr}=await supabase.storage.from("Forum-attachments").upload(path,file);
      if(upErr){
        alert("Gagal upload file "+file.name+": "+upErr.message);
        continue;
      }
      const{data:urlData}=supabase.storage.from("Forum-attachments").getPublicUrl(path);
      await supabase.from("fcs_forum_attachment").insert({
        post_id:post.id,
        file_name:file.name,
        file_url:urlData.publicUrl,
        file_type:file.type,
        file_size:file.size,
      });
    }
    setCaption("");
    setFiles([]);
    setUploading(false);
    await fetchPosts();
  };

  const deletePost=async(postId:number)=>{
    if(!confirm("Hapus post ini beserta semua lampirannya?"))return;
    const atts=attachMap[postId]||[];
    for(const att of atts){
      const path=att.file_url.split("/Forum-attachments/")[1];
      if(path){await supabase.storage.from("Forum-attachments").remove([path]);}
    }
    await supabase.from("fcs_forum_post").delete().eq("id",postId);
    await fetchPosts();
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";

  const fmtRelativeTime=(d:string)=>{
    if(!d)return "-";
    const diffMs=Date.now()-new Date(d).getTime();
    const diffMin=Math.floor(diffMs/60000);
    if(diffMin<1)return "Baru saja";
    if(diffMin<60)return `${diffMin} menit lalu`;
    const diffJam=Math.floor(diffMin/60);
    if(diffJam<24)return `${diffJam} jam lalu`;
    const diffHari=Math.floor(diffJam/24);
    if(diffHari<7)return `${diffHari} hari lalu`;
    return fmtDateTime(d);
  };

  const fmtFileSize=(bytes:number)=>{
    if(!bytes)return "";
    if(bytes<1024)return bytes+" B";
    if(bytes<1024*1024)return Math.round(bytes/1024)+" KB";
    return (bytes/(1024*1024)).toFixed(1)+" MB";
  };

  const fileIconInfo=(type:string)=>{
    if(type?.includes("pdf"))return{icon:"ti ti-file-type-pdf",bg:"#fee2e2",color:"#dc2626",label:"PDF"};
    if(type?.includes("image"))return{icon:"ti ti-photo",bg:"#dbeafe",color:"#1d4ed8",label:"Gambar"};
    if(type?.includes("sheet")||type?.includes("excel"))return{icon:"ti ti-file-spreadsheet",bg:"#dcfce7",color:"#16a34a",label:"Spreadsheet"};
    if(type?.includes("word")||type?.includes("document"))return{icon:"ti ti-file-text",bg:"#dbeafe",color:"#1d4ed8",label:"Dokumen"};
    return{icon:"ti ti-file",bg:"#f1f5f9",color:"#64748b",label:"File"};
  };

  const filteredPosts=posts.filter((p:any)=>{
    if(filterAuthor!=="ALL"&&p.author_name!==filterAuthor)return false;
    if(!searchQuery.trim())return true;
    const q=searchQuery.toLowerCase();
    const captionMatch=(p.caption||"").toLowerCase().includes(q);
    const fileMatch=(attachMap[p.id]||[]).some((att:any)=>(att.file_name||"").toLowerCase().includes(q));
    return captionMatch||fileMatch;
  });

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:20,color:"#1e293b",marginBottom:4}}>📢 Forum WO</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Bagikan update, revisi, atau dokumen Work Order ke seluruh tim</div>

      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,padding:16,marginBottom:20}}>
        <textarea value={caption} onChange={(e:any)=>setCaption(e.target.value)}
          placeholder="Tulis update, revisi, atau catatan disini..."
          style={{width:"100%",minHeight:70,padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",resize:"vertical" as const}}/>
        {files.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginTop:10}}>
            {files.map((f,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",borderRadius:6,padding:"5px 10px",fontSize:12}}>
                <span>{fileIconInfo(f.type).label==="PDF"?"📕":fileIconInfo(f.type).label==="Gambar"?"🖼️":fileIconInfo(f.type).label==="Spreadsheet"?"📊":fileIconInfo(f.type).label==="Dokumen"?"📄":"📎"}</span>
                <span style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{f.name}</span>
                <button onClick={()=>removeSelectedFile(idx)} style={{border:"none",background:"none",cursor:"pointer",color:"#dc2626",fontWeight:700,fontSize:13}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
          <label style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:12,fontWeight:600,color:"#475569"}}>
            📎 Lampirkan File
            <input type="file" multiple onChange={handleFileSelect} style={{display:"none"}}/>
          </label>
          <button onClick={submitPost} disabled={uploading}
            style={{padding:"8px 20px",borderRadius:7,border:"none",background:uploading?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:uploading?"default":"pointer",fontFamily:"inherit"}}>
            {uploading?"Mengunggah...":"Post"}
          </button>
        </div>
      </div>

      {posts.length>0&&(
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <div style={{flex:1,position:"relative" as const}}>
            <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8"}}/>
            <input value={searchQuery} onChange={(e:any)=>setSearchQuery(e.target.value)}
              placeholder="Cari caption atau nama file..."
              style={{width:"100%",padding:"8px 12px 8px 34px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <select value={filterAuthor} onChange={(e:any)=>setFilterAuthor(e.target.value)}
            style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",background:"#fff",minWidth:160}}>
            <option value="ALL">Semua Penulis</option>
            {Array.from(new Set(posts.map((p:any)=>p.author_name))).map((name:any)=>(
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}
      {loading?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8"}}>Memuat...</div>
      ):posts.length===0?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8",fontSize:13}}>Belum ada post. Jadilah yang pertama membagikan update!</div>
      ):filteredPosts.length===0?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8",fontSize:13}}>Tidak ada post yang cocok dengan pencarian.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
          {filteredPosts.map((p:any)=>(
            <div key={p.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderLeft:"3px solid #1d4ed8",borderRadius:10,padding:"16px 20px",textAlign:"left" as const}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"#eff6ff",color:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0}}>
                    {(p.author_name||"A").slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b",textAlign:"left" as const}}>{p.author_name}</div>
                    <div style={{fontSize:11,color:"#94a3b8",textAlign:"left" as const,marginTop:1}}>{fmtRelativeTime(p.created_at)}</div>
                  </div>
                </div>
                <button onClick={()=>deletePost(p.id)}
                  style={{border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:15,padding:4}}
                  title="Hapus post"><i className="ti ti-trash"/></button>
              </div>
              {p.caption&&(
                <div style={{marginTop:14,fontSize:14,color:"#1e293b",whiteSpace:"pre-wrap" as const,lineHeight:1.6,textAlign:"left" as const}}>{p.caption}</div>
              )}
              {(attachMap[p.id]||[]).length>0&&(
                <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginTop:14}}>
                  {(attachMap[p.id]||[]).map((att:any)=>{
                    const fi=fileIconInfo(att.file_type);
                    return(
                      <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"1px solid #e2e8f0",borderRadius:8,textDecoration:"none",transition:"border-color .15s"}}
                        onMouseEnter={(e:any)=>e.currentTarget.style.borderColor="#cbd5e1"}
                        onMouseLeave={(e:any)=>e.currentTarget.style.borderColor="#e2e8f0"}>
                        <div style={{width:32,height:32,borderRadius:6,background:fi.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={fi.icon} style={{fontSize:16,color:fi.color}}/>
                        </div>
                        <div style={{flex:1,minWidth:0,textAlign:"left" as const}}>
                          <div style={{fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{att.file_name}</div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{fi.label}{att.file_size?" · "+fmtFileSize(att.file_size):""}</div>
                        </div>
                        <i className="ti ti-external-link" style={{fontSize:14,color:"#94a3b8",flexShrink:0}}/>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrackingKomponenAdmin(){
  const[pwList,setPwList]=useState<any[]>([]);
  const[pwEdit,setPwEdit]=useState<Record<string,string>>({});
  const[pwSaving,setPwSaving]=useState<string|null>(null);
  const[showPwPanel,setShowPwPanel]=useState(false);

  const[woList,setWoList]=useState<any[]>([]);
  const[selectedWoId,setSelectedWoId]=useState<number|null>(null);
  const[riwayat,setRiwayat]=useState<any[]>([]);
  const[fotoMap,setFotoMap]=useState<Record<number,any[]>>({});
  const[loadingRiwayat,setLoadingRiwayat]=useState(false);

  const fetchPwList=async()=>{
    const{data}=await supabase.from("fcs_sub_bagian_password").select("*").order("sub_bagian");
    setPwList(data??[]);
  };

  const[panelList,setPanelList]=useState<any[]>([]);
  const[selectedPanelId,setSelectedPanelId]=useState<number|null>(null);

  const fetchWoList=async()=>{
    const{data}=await supabase.from("work_orders").select("id,wo,proyek").eq("is_archived",false).order("created_at",{ascending:false});
    setWoList(data??[]);
  };

  const fetchPanelList=async(woId:number)=>{
    const{data}=await supabase.from("panels").select("id,no_pnl,nama,tipe").eq("wo_id",woId).is("deleted_at",null).order("no_pnl",{ascending:true});
    setPanelList(data??[]);
  };

  const fetchRiwayat=async(panelId:number)=>{
    setLoadingRiwayat(true);
    const{data:tr}=await supabase.from("fcs_tracking_komponen").select("*").eq("panel_id",panelId).order("created_at",{ascending:false});
    setRiwayat(tr??[]);
    if(tr&&tr.length>0){
      const ids=tr.map((t:any)=>t.id);
      const{data:fotos}=await supabase.from("fcs_tracking_komponen_foto").select("*").in("tracking_id",ids);
      const map:Record<number,any[]>={};
      (fotos??[]).forEach((f:any)=>{
        if(!map[f.tracking_id])map[f.tracking_id]=[];
        map[f.tracking_id].push(f);
      });
      setFotoMap(map);
    } else {
      setFotoMap({});
    }
    setLoadingRiwayat(false);
  };

  useEffect(()=>{fetchPwList();fetchWoList();},[]);
  useEffect(()=>{
    setSelectedPanelId(null);
    setRiwayat([]);
    if(selectedWoId)fetchPanelList(selectedWoId);
  },[selectedWoId]);
  useEffect(()=>{
    if(selectedPanelId)fetchRiwayat(selectedPanelId);
    else setRiwayat([]);
  },[selectedPanelId]);

  const savePassword=async(subBagian:string)=>{
    const newPwd=pwEdit[subBagian];
    if(!newPwd||!newPwd.trim()){alert("Password tidak boleh kosong");return;}
    setPwSaving(subBagian);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const{error}=await supabase.from("fcs_sub_bagian_password").update({
      password:newPwd.trim(),
      updated_at:new Date().toISOString(),
      updated_by:sess?.nama||sess?.name||"Admin",
    }).eq("sub_bagian",subBagian);
    if(error){alert("Gagal simpan: "+error.message);}
    else{await fetchPwList();setPwEdit(prev=>({...prev,[subBagian]:""}));}
    setPwSaving(null);
  };

  const deleteTracking=async(trackingId:number)=>{
    if(!confirm("Hapus riwayat ini beserta fotonya?"))return;
    const fotos=fotoMap[trackingId]||[];
    for(const foto of fotos){
      const path=foto.file_url.split("/tracking-komponen/")[1];
      if(path)await supabase.storage.from("tracking-komponen").remove([path]);
    }
    await supabase.from("fcs_tracking_komponen").delete().eq("id",trackingId);
    if(selectedPanelId)fetchRiwayat(selectedPanelId);
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";

  const subBagianIcon:Record<string,string>={Warehouse:"📦",Assembling:"🔧",QS:"📋",QC:"🔍"};

  const countPerSubBagian=["Warehouse","Assembling","QS","QC"].map(sb=>({
    sb,
    count:riwayat.filter((r:any)=>r.sub_bagian===sb).length,
  }));

  const[modalSubBagian,setModalSubBagian]=useState<string|null>(null);
  const riwayatModalSubBagian=modalSubBagian?riwayat.filter((r:any)=>r.sub_bagian===modalSubBagian):[];

  return(
    <div className="fi">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div>
          <div style={{fontWeight:800,fontSize:20,color:"#1e293b"}}>📦 Tracking Komponen</div>
          <div style={{fontSize:12,color:"#64748b",marginTop:2}}>Monitoring serah terima komponen antar bagian</div>
        </div>
        <Btn outline color="#64748b" onClick={()=>setShowPwPanel(p=>!p)}>
          {showPwPanel?"Tutup Pengaturan":"⚙️ Atur Password"}
        </Btn>
      </div>

      {showPwPanel&&(
        <Card style={{marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>Password Sub-bagian</div>
          <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
            {pwList.map((p:any)=>(
              <div key={p.sub_bagian} style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" as const}}>
                <div style={{minWidth:120}}>
                  <Lbl>{subBagianIcon[p.sub_bagian]} {p.sub_bagian}</Lbl>
                  <div style={{fontSize:12,fontWeight:600,color:"#64748b"}}>Saat ini: {p.password}</div>
                </div>
                <div style={{flex:1,minWidth:160}}>
                  <Inp value={pwEdit[p.sub_bagian]||""} onChange={(e:any)=>setPwEdit(prev=>({...prev,[p.sub_bagian]:e.target.value}))}
                    placeholder="Password baru..."/>
                </div>
                <Btn color="#1d4ed8" onClick={()=>savePassword(p.sub_bagian)} style={{padding:"9px 16px"}}>
                  {pwSaving===p.sub_bagian?"...":"Simpan"}
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card style={{marginBottom:16}}>
        <Lbl>Pilih Work Order</Lbl>
        <Sel value={selectedWoId??""} onChange={(e:any)=>setSelectedWoId(e.target.value?Number(e.target.value):null)}>
          <option value="">-- Pilih Work Order --</option>
          {woList.map((w:any)=>(
            <option key={w.id} value={w.id}>{w.wo} — {w.proyek}</option>
          ))}
        </Sel>
      </Card>

      {selectedWoId&&(
        <Card style={{marginBottom:16}}>
          <Lbl>Pilih Panel</Lbl>
          <Sel value={selectedPanelId??""} onChange={(e:any)=>setSelectedPanelId(e.target.value?Number(e.target.value):null)}>
            <option value="">-- Pilih Panel --</option>
            {panelList.map((p:any)=>(
              <option key={p.id} value={p.id}>#{p.no_pnl} {p.nama} ({p.tipe})</option>
            ))}
          </Sel>
          {panelList.length===0&&(
            <div style={{fontSize:12,fontWeight:600,color:"#94a3b8",marginTop:6}}>Belum ada panel untuk WO ini</div>
          )}
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16}}>
        {countPerSubBagian.map(({sb,count})=>{
          const isActive=!!(selectedWoId&&selectedPanelId);
          return(
            <Card key={sb} onClick={()=>{if(isActive)setModalSubBagian(sb);}}
              style={{textAlign:"center" as const,cursor:isActive?"pointer":"not-allowed",opacity:isActive?1:0.5,transition:"all .15s"}}
              onMouseEnter={(e:any)=>{if(isActive){e.currentTarget.style.boxShadow="0 4px 12px #00000018";e.currentTarget.style.transform="translateY(-2px)";}}}
              onMouseLeave={(e:any)=>{e.currentTarget.style.boxShadow="0 1px 3px #00000008";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{fontSize:24}}>{subBagianIcon[sb]}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#0f172a",marginTop:4}}>{sb}</div>
              <div style={{fontSize:12,fontWeight:700,color:count>0?"#16a34a":"#94a3b8",marginTop:2}}>{isActive?(count>0?`${count} entri`:"Belum ada"):"Pilih WO & panel"}</div>
            </Card>
          );
        })}
      </div>

      {selectedWoId&&selectedPanelId&&(
        <>
          <div style={{fontSize:12,fontWeight:800,color:"#0f172a",textTransform:"uppercase" as const,letterSpacing:.4,marginBottom:10}}>Riwayat Lengkap</div>
          {loadingRiwayat?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8"}}>Memuat...</div>
          ):riwayat.length===0?(
            <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13}}>Belum ada riwayat untuk WO ini</div>
          ):(
            <div style={{display:"flex",flexDirection:"column" as const,gap:10}}>
              {riwayat.map((r:any)=>(
                <Card key={r.id} style={{borderLeft:"3px solid #0d9488"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15,color:"#0f172a"}}>{subBagianIcon[r.sub_bagian]} {r.sub_bagian}</div>
                      <div style={{fontSize:13,fontWeight:600,color:"#475569",marginTop:2}}>oleh {r.operator_name} · {fmtDateTime(r.created_at)}</div>
                    </div>
                    <button onClick={()=>deleteTracking(r.id)}
                      style={{border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:15}}
                      title="Hapus riwayat">🗑️</button>
                  </div>
                  {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginTop:8,lineHeight:1.6}}>{r.catatan}</div>}
                  {(fotoMap[r.id]||[]).length>0&&(
                    <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginTop:10}}>
                      {(fotoMap[r.id]||[]).map((foto:any)=>(
                        <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.file_url} style={{width:72,height:72,objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0"}}/>
                        </a>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {modalSubBagian&&(
        <div onClick={()=>setModalSubBagian(null)}
          style={{position:"fixed" as const,inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16}}>
          <div onClick={(e:any)=>e.stopPropagation()}
            style={{background:"#fff",borderRadius:12,width:"100%",maxWidth:480,maxHeight:"80vh",overflowY:"auto" as const,padding:20}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:10,background:"#f0fdfa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                  {subBagianIcon[modalSubBagian]}
                </div>
                <div style={{fontWeight:800,fontSize:17,color:"#0f172a"}}>{modalSubBagian}</div>
              </div>
              <button onClick={()=>setModalSubBagian(null)}
                style={{border:"none",background:"#f1f5f9",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:16,color:"#64748b"}}>✕</button>
            </div>
            {riwayatModalSubBagian.length===0?(
              <div style={{textAlign:"center" as const,padding:30,color:"#94a3b8",fontSize:13,fontWeight:600}}>Belum ada riwayat untuk {modalSubBagian}</div>
            ):(
              <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
                {riwayatModalSubBagian.map((r:any)=>(
                  <div key={r.id} style={{background:"#f8fafc",borderRadius:10,padding:14}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:6}}>oleh {r.operator_name} · {fmtDateTime(r.created_at)}</div>
                    {r.catatan&&<div style={{fontSize:14,fontWeight:500,color:"#1e293b",marginBottom:10,lineHeight:1.6}}>{r.catatan}</div>}
                    {(fotoMap[r.id]||[]).length>0&&(
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                        {(fotoMap[r.id]||[]).map((foto:any)=>(
                          <a key={foto.id} href={foto.file_url} target="_blank" rel="noopener noreferrer">
                            <img src={foto.file_url} style={{width:"100%",aspectRatio:"1",objectFit:"cover" as const,borderRadius:8,border:"1px solid #e2e8f0"}}/>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
  const [forumUnreadCount,setForumUnreadCount]=useState(0);
  useEffect(()=>{
    const fetchForumUnread=async()=>{
      const lastSeen=localStorage.getItem("vista_forum_last_seen")||"1970-01-01";
      const{count}=await supabase.from("fcs_forum_post").select("*",{count:"exact",head:true}).gt("created_at",lastSeen);
      setForumUnreadCount(count??0);
    };
    fetchForumUnread();
    const ch=supabase.channel("realtime-forum-unread")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fcs_forum_post"},fetchForumUnread)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);
  useEffect(()=>{
    if(tab==="forum"){
      localStorage.setItem("vista_forum_last_seen",new Date().toISOString());
      setForumUnreadCount(0);
    }
  },[tab]);
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
      {id:"taskmonitoring",label:"Task Monitoring",icon:"ti ti-list-check"},
      {id:"detail",label:"Detail Progress",icon:"ti ti-zoom-in"},
      {id:"stok",label:"Stok Komponen",icon:"ti ti-package"},
    ]},
    {group:"PRODUKSI",items:[
      ...(canRaw?[{id:"raw",label:"Raw Schedule",icon:"ti ti-calendar-event"}]:[]),
      ...(canRencana?[{id:"rencana",label:"Rencana Harian",icon:"ti ti-clipboard-list"}]:[]),
      ...(canWO?[{id:"wo",label:"Manajemen WO",icon:"ti ti-file-description"}]:[]),
      ...(canWO?[{id:"fcs",label:"FCS Schedule",icon:"ti ti-timeline"}]:[]),
      ...(canWO?[{id:"arsip",label:"Arsip",icon:"ti ti-archive"}]:[]),
      {id:"forum",label:"Forum WO",icon:"ti ti-message-circle",badge:forumUnreadCount>0?forumUnreadCount:null},
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
              {tab==="taskmonitoring"&&<TaskMonitoring woData={woData}/>}
              {tab==="detail"&&<DetailProgress woData={woData} rawData={rawData}/>}
              {tab==="raw"&&<RawSchedule woData={woData} rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} setRawData={setRawData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} refetchRenhar={refetchRenhar} logActivity={logActivity} logAct={logAct} log={log} user={user}/>}
              {tab==="rencana"&&<RencanaHarian rawData={rawData.filter((r:any)=>woData.some((w:any)=>w.id===r.wo_id))} woData={woData} renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} logActivity={logActivity} logAct={logAct} log={log} user={user}/>}
              {tab==="wo"&&<ManajemenWO woData={woData} setWoData={setWoData} createWO={createWO} updateWO={updateWO} removeWO={removeWO} logActivity={logActivity} logAct={logAct} log={log} user={user} refetchWO={refetchWO}/>}
              {tab==="tracking"&&<TrackingPekerja pekerja={pekerja} renhar={renhar} setRenhar={setRenhar} removeRenhar={removeRenhar} woData={woData}/>}
              {tab==="forum"&&<ForumWO user={user}/>}
              {tab==="trackingkomponen"&&<TrackingKomponenAdmin/>}
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