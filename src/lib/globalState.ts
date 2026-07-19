// Mutable module-level state yang dipakai lintas komponen (bukan React state).
// Ditulis lewat setter di bawah supaya live-binding ES module ter-update ke semua importer.
export let GLOBAL_PROSES_RELEVAN_SET:Set<string>=new Set();
export let GLOBAL_PROSES_RELEVAN_HAS_MAPPING:Set<string>=new Set();
export let GLOBAL_LIVE_PANEL_TYPES:any={};
export let GLOBAL_DIRTY_PANEL_IDS:Set<string>=new Set();

export function setGlobalProsesRelevan(set:Set<string>, hasMapping:Set<string>){
  GLOBAL_PROSES_RELEVAN_SET=set;
  GLOBAL_PROSES_RELEVAN_HAS_MAPPING=hasMapping;
}
export function setGlobalLivePanelTypes(v:any){
  GLOBAL_LIVE_PANEL_TYPES=v;
}
export function setGlobalDirtyPanelIds(v:Set<string>){
  GLOBAL_DIRTY_PANEL_IDS=v;
}

let _id=8000;
export function uid(){ return ++_id; }
