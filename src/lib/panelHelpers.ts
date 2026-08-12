import { PANEL_TYPES, ALL_PROSES, BUSBAR_KOMPONEN, KOMPONEN_PROSES_MAP, DIVISI_PROSES_MAP } from '../constants/panelTypes'
import { GLOBAL_PROSES_RELEVAN_SET, GLOBAL_PROSES_RELEVAN_HAS_MAPPING, GLOBAL_LIVE_PANEL_TYPES } from './globalState'

export const getBusbarKomponen=(tipe:string):string[]=>{
  return BUSBAR_KOMPONEN[tipe]||BUSBAR_KOMPONEN["FS"];
};

// ================= WIRING CONTROL/POWER: kapasitas orang-per-hari-kerja berbasis bobot =================
// REVISI TOTAL (12 Agu 2026) - ganti model lama (token __wiring_{orang}org_{bobot}, satu angka
// TETAP per tim/WP dipilih manual planner) yang terbukti beberapa kali salah baca kapasitas
// (lihat bug double-count di fcsService.ts sebelum revisi ini - token itu sendiri ikut kehitung
// sebagai "kode" terpisah di beberapa fungsi). Model baru: PER KOMPONEN (bukan per tim), bobot
// disimpan di kolom raw_schedule.bobot_komponen (Record<kode,bobot>, level ROW - satu kali isi,
// otomatis berlaku di semua tanggal komponen itu dijadwalkan, gak perlu "dibawa" manual tiap
// pindah tanggal). Kebutuhan orang per hari TURUN seiring hari kerja AKTUAL (bukan hari kalender)
// - lihat kebutuhanOrangWiring() & hariKeNFromMap() (fcsService.ts) buat detail penuh.
// Array = kebutuhan orang tiap hari kerja aktual ke-1,2,3,... Elemen TERAKHIR dipakai berulang
// buat hari kelebihan (semua tier kebetulan berakhir di 0.5, jadi "kelebihan durasi standar =
// 0.5 orang terus sampai selesai" otomatis kepenuhi lewat clamping index, gak perlu logic terpisah).
export const WIRING_BOBOT_TABLE: Record<string, number[]> = {
  EASY: [0.5],
  MEDIUM: [1, 0.5],
  HARD: [1, 1, 0.5],
  VERY_HARD: [1, 1, 1, 0.5],
};
export const WIRING_BOBOT_LIST = ["EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
export const WIRING_BOBOT_LABEL: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard", VERY_HARD: "Very Hard" };
export const WIRING_BOBOT_COLOR: Record<string, string> = { EASY: "#16a34a", MEDIUM: "#d97706", HARD: "#dc2626", VERY_HARD: "#7c3aed" };
// Kode yang belum sempat diisi bobotnya (raw_schedule.bobot_komponen belum ada entrinya) default
// MEDIUM - biar gak ada komponen yang "hilang" dari perhitungan kapasitas cuma karena belum
// sempat diisi planner (fallback aman, bisa dikoreksi belakangan tanpa memblokir jadwal).
export function kebutuhanOrangWiring(bobot: string | null | undefined, hariKeN: number): number {
  const table = WIRING_BOBOT_TABLE[bobot || "MEDIUM"] || WIRING_BOBOT_TABLE.MEDIUM;
  const idx = Math.min(Math.max(hariKeN, 1) - 1, table.length - 1);
  return table[Math.max(0, idx)];
}

// QC TEST/PACKING itu proses whole-panel (penanda), bukan proses per-komponen - jangan
// digantungkan ke mapping bom_proses_relevan/KOMPONEN_PROSES_MAP per kode komponen. Kalau
// digantungkan ke situ, komponen/tipe_panel baru yang belum di-setup lewat wizard proses-relevan
// bakal diam-diam gak pernah dapet baris QC TEST/PACKING (ini persis bug yang kejadian di
// proyek Magonia Lombok - gak nongol sama sekali, baik baris kosong maupun terjadwal).
// NAMEPLATE/YELLOWMARK gabung ke daftar ini juga - sama-sama penanda whole-panel, BUKAN
// per-komponen. Progress aktualnya tetap di panels.nameplate_progress/yellowmark_progress
// (lihat NameplateView di Vista Pekerja) - baris raw_schedule ini murni buat jadwal/visibility
// di Rencana Harian, jangan digantungkan ke panels.checklist sama sekali.
export const PROSES_TANPA_MAPPING_KOMPONEN=["QC TEST","PACKING","NAMEPLATE","YELLOWMARK"];

export const isKomponenRelevant=(kode:string, tipeOrProses:string, prosesMaybe?:string):boolean=>{
  if(prosesMaybe===undefined){
    const proses=tipeOrProses;
    if(PROSES_TANPA_MAPPING_KOMPONEN.includes(proses)) return true;
    const relevanProses=KOMPONEN_PROSES_MAP[kode];
    if(!relevanProses) return true;
    return relevanProses.includes(proses);
  }
  const tipe=tipeOrProses;
  const proses=prosesMaybe;
  if(PROSES_TANPA_MAPPING_KOMPONEN.includes(proses)) return true;
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
  const base=GLOBAL_PROSES_RELEVAN_HAS_MAPPING.has(mapKey)
    ? ALL_PROSES.filter((pr:string)=>GLOBAL_PROSES_RELEVAN_SET.has(kode+"|"+tipe+"|"+pr))
    : (KOMPONEN_PROSES_MAP[kode]||[]);
  return [...new Set([...base,...PROSES_TANPA_MAPPING_KOMPONEN])];
}

export function getEffCfgGlobal(tipe:string){
  return (GLOBAL_LIVE_PANEL_TYPES?.[tipe]?.wps?.length>0)?GLOBAL_LIVE_PANEL_TYPES[tipe]:(PANEL_TYPES as any)[tipe];
}

export type ProsesStatus="NOT YET"|"TO DO"|"IN PROGRESS"|"DONE";
// Ambang progress proses SEBELUMNYA (dalam rantai ALL_PROSES) supaya komponen ini dianggap
// "siap dikerjakan" (TO DO) - di bawah ini masih NOT YET. 6 Agu 2026: single source of truth
// status kesiapan komponen, dipakai TaskMonitoring.tsx DAN Rencana Harian - jangan duplikasi
// logic gating di tempat lain, panggil fungsi ini.
export const PROSES_STATUS_GATE_PCT=25;
// POTONG (index pertama di ALL_PROSES) dan BUSBAR (proses paralel/independen, gak masuk rantai
// estafet WP) sengaja gak digating proses sebelumnya - selalu TO DO begitu progress masih 0.
// BUG FIX (6 Agu 2026): "proses sebelumnya" TIDAK BOLEH diambil lewat ALL_PROSES[idx-1] mentah -
// BUSBAR duduk di antara PASANG KOMPONEN dan WIRING CONTROL di array, jadi index-1 buat WIRING
// CONTROL nunjuk ke BUSBAR (yang progress-nya SELALU 0 buat kode non-busbar, terverifikasi di
// data live - WM.4/FS.4 dst dengan WIRING CONTROL 50-100% semua punya BUSBAR=0). Akibatnya WIRING
// CONTROL/WIRING POWER permanen kebaca NOT YET walau progress asli udah jalan. Fix: lompatin
// BUSBAR pas nyari proses sebelumnya - WIRING CONTROL gating ke PASANG KOMPONEN, WIRING POWER
// gating ke WIRING CONTROL, persis sesuai definisi yang diminta.
// BUG FIX #2 (6 Agu 2026): gate NOT YET dulu dicek SEBELUM cek progress komponen ini sendiri -
// akibatnya komponen yang progress-nya SUDAH JALAN (mis. PAINTING 57%) tetap kebaca NOT YET
// cuma gara-gara proses sebelumnya (RENDAM) di data 0% (kejadian nyata: FS.20 panel 287, urutan
// riil di lapangan gak selalu ngikutin rantai linear ALL_PROSES persis). Kartu jadi ke-lock total
// (pointerEvents:none) walau kerjaannya beneran udah berjalan - operator gak bisa lanjut sama
// sekali. Fix: kalau progress proses INI SENDIRI udah >0, itu bukti nyata kerjaan udah mulai -
// gak mungkin lagi NOT YET apapun kondisi proses sebelumnya. Gate NOT YET cuma relevan pas
// progress proses ini masih benar-benar 0 (belum pernah disentuh sama sekali).
// BUG FIX (7 Agu 2026): "proses sebelumnya" dulu diambil mentah dari ALL_PROSES[idx-1] (cuma
// BUSBAR yang di-skip khusus) - gak peduli proses itu RELEVAN atau enggak buat kode ini. Kalau
// ada proses gak-relevan yang duduk tepat sebelum proses yang dicek (mis. FINISHING buat
// Groundplate/CAPACITOR BANK-2 - gak pernah kesentuh, progress permanen 0), proses sesudahnya
// (RENDAM) ke-gate ke situ padahal proses relevan terakhir sebelumnya (BENDING) udah DONE.
// Fix: terima daftar proses RELEVAN buat kode ini (dari getRelevantProsesForKode, sumber sama
// yang udah dipakai buat nampilin "-" di kolom gak-relevan) - gating chain-nya difilter ke situ
// dulu (urutan tetap ngikutin ALL_PROSES), BUSBAR-skip tetap jalan di atasnya sebagai jaga-jaga.
// relevantProses opsional - kalau gak dikasih, fallback ke ALL_PROSES penuh (perilaku lama).
// UNBLOCK QC TEST (7 Agu 2026): QC TEST sengaja dikeluarin dari gating juga - selalu TO DO
// begitu progress masih 0, gak nunggu WIRING POWER/CONTROL nyampe 25% dulu kayak proses lain.
// PACKING TETAP kena gating normal (gak diubah) - masih ngecek progress QC TEST via chain di
// bawah, jadi PACKING baru TO DO kalau QC TEST komponen itu udah >=25%.
export function computeProsesStatus(progressMap:Record<string,number>|undefined|null,proses:string,relevantProses?:string[]):ProsesStatus{
  const progress=progressMap?.[proses]||0;
  if(progress>=100)return "DONE";
  if(progress>0)return "IN PROGRESS";
  if(proses==="BUSBAR"||proses==="QC TEST")return "TO DO";
  // WIRING CONTROL/WIRING POWER (7 Agu 2026): sengaja gak nunggu PASANG KOMPONEN kayak chain
  // normal - gate langsung ke progress RAKIT (skip PASANG KOMPONEN sepenuhnya), dan threshold-nya
  // "udah IN PROGRESS" (progress>0), BUKAN ambang 25% standar - biar wiring bisa mulai TO DO
  // begitu RAKIT mulai dikerjakan, gak perlu nunggu Pasang Komponen selesai/jalan dulu.
  if(proses==="WIRING CONTROL"||proses==="WIRING POWER"){
    return(progressMap?.["RAKIT"]||0)>0?"TO DO":"NOT YET";
  }
  const chain=(relevantProses&&relevantProses.length>0)?ALL_PROSES.filter(p=>relevantProses.includes(p)):ALL_PROSES;
  const prosesIdx=chain.indexOf(proses);
  if(prosesIdx<=0)return "TO DO";
  let prevIdx=prosesIdx-1;
  while(prevIdx>=0&&chain[prevIdx]==="BUSBAR")prevIdx--;
  if(prevIdx<0)return "TO DO";
  const prosesSebelumnya=chain[prevIdx];
  const progressSebelumnya=progressMap?.[prosesSebelumnya]||0;
  if(progressSebelumnya<PROSES_STATUS_GATE_PCT)return "NOT YET";
  return "TO DO";
}

export function initChecklist(tipe, qty=1, customPanelTypes?){
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
    byTipe[b.tipe_panel][b.wp].push({kode:b.kode_komponen,nama:b.nama_komponen,urutan:b.urutan});
  });
  const result={};
  Object.entries(byTipe).forEach(([tipe,wpMap])=>{
    const metaTipe=(panelTypeMetaList||[]).find((m:any)=>m.tipe_panel===tipe);
    const label=metaTipe?.label||tipe;
    const wpMetas=(panelWpMetaList||[]).filter((m:any)=>m.tipe_panel===tipe).slice().sort((a:any,b:any)=>String(a.wp).localeCompare(String(b.wp)));
    if(wpMetas.length===0)return;
    const wps=wpMetas.map((wpMeta:any)=>{
      const items=(wpMap[wpMeta.wp]||[]).slice().sort((a,b)=>{
        const ua=Number(a.urutan)||0,ub=Number(b.urutan)||0;
        if(ua!==ub)return ua-ub;
        return naturalKodeSortGlobal(a.kode,b.kode);
      }).map(it=>({kode:it.kode,nama:it.nama}));
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

// Progress KOMPONEN ini PERSIS di tanggal `tanggal` - snapshot PERMANEN per hari, beda dari
// getProgressOnDate/getLatestProgress/getBestProgress di atas yang semuanya condong ke nilai
// TERBARU/keseluruhan. Prioritas: 1) entry persis di progressByDate[proses][tanggal] kalau ada,
// 2) kalau gak ada - checkpoint history TERAKHIR yang tanggalnya <= tanggal yang diminta (carry-
// forward nilai terakhir yang diketahui, bukan langsung 0), 3) kalau belum pernah disentuh
// sampai tanggal itu - 0.
// Qty yang SUDAH DIKERJAKAN persis di tanggal `tanggal` - pasangan qty dari getProgressAsOfDate
// (progress% dan qty jalan bareng, sumbernya sama-sama snapshot per-hari). Gak ada "history" qty
// terpisah kayak progress punya, jadi fallback-nya carry-forward dari tanggal qtyProsesByDate
// TERAKHIR yang <= tanggal yang diminta (bukan langsung 0) - biar kartu di tanggal jejak (lama)
// beku selamanya di angka waktu itu, sementara kartu di tanggal live ikut update begitu ada
// checkpoint baru.
export function getQtyProsesAsOfDate(cl:any, proses:string, tanggal:string):number{
  const byDate=cl?.qtyProsesByDate?.[proses];
  if(byDate&&byDate[tanggal]!==undefined) return byDate[tanggal];
  const datesSebelum=Object.keys(byDate||{}).filter((d:string)=>d<=tanggal).sort();
  if(datesSebelum.length>0)return byDate[datesSebelum[datesSebelum.length-1]];
  return 0;
}

export function getProgressAsOfDate(cl:any, proses:string, tanggal:string):number{
  const byDate=cl?.progressByDate?.[proses];
  if(byDate&&byDate[tanggal]!==undefined) return byDate[tanggal];
  const hist=(cl?.history?.[proses]||[]).filter((h:any)=>h.tanggal<=tanggal);
  if(hist.length>0){
    const terakhir=hist.reduce((a:any,b:any)=>a.tanggal>b.tanggal?a:b);
    return terakhir.pct;
  }
  return 0;
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

// BUG FIX (7 Agu 2026): "Status" (kolom lama, getProgressAsOfDate) vs "Status Pipeline"
// (computeProsesStatus, dulu baca cl.progress mentah) bisa nunjukin hasil KONTRADIKTIF buat
// komponen yang sama - kejadian nyata: AFIF/FS.4 Groundplate/POTONG/CAPACITOR BANK-2 nunjukin
// "Selesai" (progressByDate+history sama-sama 100%) tapi "In Progress" (cl.progress.POTONG
// masih 13%, dari updateQtyProses yang nge-debounce write-nya - race sama updatePctManual/lock
// yang nulis progressByDate+history duluan bisa bikin field progress[proses] SENDIRIAN nyangkut
// nilai lama, gak ikut update). BUKAN ghost timer (fcs_timer_kerja komponen ini semua udah
// selesai==NOT NULL, terverifikasi). Fix: computeProsesStatus jangan baca cl.progress mentah -
// bangun progressMap dari getBestProgress (history>progressByDate>progress, SUMBER SAMA yang
// dipercaya kolom "Status" & calcPanelProgress) buat SEMUA proses (bukan cuma yang dicek -
// gating chain-nya juga butuh baca progress proses SEBELUMNYA dengan sumber yang sama).
export function getBestProgressMap(cl:any):Record<string,number>{
  const map:Record<string,number>={};
  ALL_PROSES.forEach(pr=>{map[pr]=getBestProgress(cl,pr);});
  return map;
}

export function calcPanelProgress(panel): Record<string, number> {
  const cfg=getEffCfgGlobal(panel.tipe);
  if(!cfg||!panel.checklist) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const active=cfg.wps.flatMap(w=>w.items).filter(it=>(panel.checklist[it.kode]?.qty||0)>0);
  if(!active.length) return ALL_PROSES.reduce((a,p)=>({...a,[p]:0}),{} as Record<string, number>);
  const prog: Record<string, number> = {};
  ALL_PROSES.forEach(pr=>{
    // Cuma komponen yang beneran relevan ke proses ini yang ikut dirata-rata - komponen yang
    // gak relevan (mis. gak pernah lewat RENDAM) sebelumnya ikut kehitung "0%" palsu di rata-rata,
    // bikin persentase gak pernah bisa nyampe 100% walau semua proses yang beneran relevan udah
    // selesai. Fallback ke `active` penuh kalau ternyata gak ada satupun komponen aktif yang
    // relevan ke proses ini (kasus langka) - biar gak divide-by-zero/NaN.
    const relevantActive=active.filter(it=>isKomponenRelevant(it.kode,panel.tipe,pr));
    const itemsForCalc=relevantActive.length>0?relevantActive:active;
    const vals=itemsForCalc.map(it=>getBestProgress(panel.checklist[it.kode],pr));
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
