import { PANEL_TYPES, ALL_PROSES, BUSBAR_KOMPONEN, KOMPONEN_PROSES_MAP, DIVISI_PROSES_MAP } from '../constants/panelTypes'
import { GLOBAL_PROSES_RELEVAN_SET, GLOBAL_PROSES_RELEVAN_HAS_MAPPING, GLOBAL_LIVE_PANEL_TYPES } from './globalState'

export const getBusbarKomponen=(tipe:string):string[]=>{
  return BUSBAR_KOMPONEN[tipe]||BUSBAR_KOMPONEN["FS"];
};

export const isKomponenRelevant=(kode:string, tipeOrProses:string, prosesMaybe?:string):boolean=>{
  if(prosesMaybe===undefined){
    const proses=tipeOrProses;
    const relevanProses=KOMPONEN_PROSES_MAP[kode];
    if(!relevanProses) return true;
    return relevanProses.includes(proses);
  }
  const tipe=tipeOrProses;
  const proses=prosesMaybe;
  const mapKey=kode+"|"+tipe;
  if(GLOBAL_PROSES_RELEVAN_HAS_MAPPING.has(mapKey)){
    return GLOBAL_PROSES_RELEVAN_SET.has(kode+"|"+tipe+"|"+proses);
  }
  const relevanProses=KOMPONEN_PROSES_MAP[kode];
  if(!relevanProses) return true;
  return relevanProses.includes(proses);
};

export function getRelevantProsesForKode(kode:string,tipe:string):string[]{
  const mapKey=kode+"|"+tipe;
  if(GLOBAL_PROSES_RELEVAN_HAS_MAPPING.has(mapKey)){
    return ALL_PROSES.filter((pr:string)=>GLOBAL_PROSES_RELEVAN_SET.has(kode+"|"+tipe+"|"+pr));
  }
  return KOMPONEN_PROSES_MAP[kode]||[];
}

export function getEffCfgGlobal(tipe:string){
  return (GLOBAL_LIVE_PANEL_TYPES?.[tipe]?.wps?.length>0)?GLOBAL_LIVE_PANEL_TYPES[tipe]:(PANEL_TYPES as any)[tipe];
}

export function initChecklist(tipe, qty=1, customPanelTypes){
  const cfg=(customPanelTypes&&customPanelTypes[tipe])?customPanelTypes[tipe]:PANEL_TYPES[tipe]; if(!cfg) return {};
  const c={};
  const qtyAwal=qty>1?0:qty;
  cfg.wps.forEach(w=>w.items.forEach(it=>{
    c[it.kode]={ qty:qtyAwal, qtyProses:{}, progress: ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{}),
      progressByDate: ALL_PROSES.reduce((a,p)=>({...a,[p]:{}}),{}),
      stepDates: ALL_PROSES.reduce((a,p)=>({...a,[p]:{}}),{}) };
  }));
  return c;
}

export function naturalKodeSortGlobal(a,b){
  const parse=(k)=>{
    const m=String(k).match(/^(.*?)(\d+)$/);
    return m?{prefix:m[1],num:parseInt(m[2],10)}:{prefix:k,num:0};
  };
  const pa=parse(a),pb=parse(b);
  if(pa.prefix!==pb.prefix)return pa.prefix.localeCompare(pb.prefix);
  return pa.num-pb.num;
}

export function buildPanelTypesFromBom(bomList,panelTypeMetaList,panelWpMetaList){
  const byTipe={};
  (bomList||[]).forEach(b=>{
    if(!byTipe[b.tipe_panel])byTipe[b.tipe_panel]={};
    if(!byTipe[b.tipe_panel][b.wp])byTipe[b.tipe_panel][b.wp]=[];
    byTipe[b.tipe_panel][b.wp].push({kode:b.kode_komponen,nama:b.nama_komponen});
  });
  const result={};
  Object.entries(byTipe).forEach(([tipe,wpMap])=>{
    const metaTipe=(panelTypeMetaList||[]).find((m:any)=>m.tipe_panel===tipe);
    const label=metaTipe?.label||tipe;
    const wpMetas=(panelWpMetaList||[]).filter((m:any)=>m.tipe_panel===tipe).slice().sort((a:any,b:any)=>String(a.wp).localeCompare(String(b.wp)));
    if(wpMetas.length===0)return;
    const wps=wpMetas.map((wpMeta:any)=>{
      const items=(wpMap[wpMeta.wp]||[]).slice().sort((a,b)=>naturalKodeSortGlobal(a.kode,b.kode)).map(it=>({kode:it.kode,nama:it.nama}));
      return{wp:wpMeta.wp,color:wpMeta.color,range:wpMeta.range_label,items};
    });
    result[tipe]={label,wps};
  });
  return result;
}

// Ambil progress per tanggal tertentu
export function getProgressOnDate(cl, proses, date){
  // cek progressByDate dulu (struktur baru)
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&byDate[date]!==undefined) return byDate[date];
  // fallback ke progress lama (struktur lama)
  return cl?.progress?.[proses]||0;
}

// Ambil progress terbaru (tanggal terbaru yang ada datanya)
export function getLatestProgress(cl, proses){
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&Object.keys(byDate).length>0){
    const dates=Object.keys(byDate).sort();
    return byDate[dates[dates.length-1]];
  }
  return cl?.progress?.[proses]||0;
}

// Ambil progress dari history (sumber paling akurat dari Vista Pekerja)
export function getProgressFromHistory(cl:any, proses:string):number{
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
export function getBestProgress(cl:any, proses:string):number{
  // Coba dari history dulu (paling akurat)
  const fromHist=getProgressFromHistory(cl,proses);
  if(fromHist>=0) return fromHist;
  // Fallback ke progressByDate
  const fromDate=getLatestProgress(cl,proses);
  if(fromDate>0) return fromDate;
  // Fallback terakhir ke progress
  return cl?.progress?.[proses]||0;
}

export function calcPanelProgress(panel): Record<string, number> {
  const cfg=getEffCfgGlobal(panel.tipe);
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
export function panelOverall(p){
  const v=Object.values(calcPanelProgress(p));
  if(!v.length) return 0;
  const sum=v.reduce((acc,n)=>acc+n,0);
  return Math.round(sum/v.length);
}
export function woOverall(wo){
  const vals=(wo.panels??[]).flatMap(p=>Object.values(calcPanelProgress(p)));
  if(!vals.length) return 0;
  const sum=vals.reduce((acc,n)=>acc+n,0);
  return Math.round(sum/vals.length);
}

// compute progress % for a WP (all komponen in WP across all proses for that divisi)
export const wpProgress=(panelData,wp,proses)=>{
  if(!panelData)return 0;
  const cfg=getEffCfgGlobal(panelData.tipe);
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
