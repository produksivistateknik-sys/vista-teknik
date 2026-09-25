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

// Dirty-tracking buat renhar & raw_schedule - pola sama kayak GLOBAL_DIRTY_PANEL_IDS, tapi
// dipakai LANGSUNG (mutasi Set di tempat, bukan lewat React state+effect) karena tulisan ke
// renhar/raw_schedule sifatnya aksi sekali-tembak (klik tombol -> tulis -> selesai), beda
// dari edit qty panel yang bisa berlangsung lama sebelum di-"Simpan". ID ditandai dirty PAS
// mulai nulis, otomatis "bersih" lagi sendiri setelah `ms` (default 2 detik - lebih lama dari
// debounce sync renhar/rawData yang 1200ms, jadi window rawan overwrite selalu ketutup penuh).
export const GLOBAL_DIRTY_RENHAR_IDS:Set<string>=new Set();
export const GLOBAL_DIRTY_RAW_IDS:Set<string>=new Set();

export function markRenharDirty(id:number|string, ms=15000){
  const key=String(id);
  GLOBAL_DIRTY_RENHAR_IDS.add(key);
  setTimeout(()=>{ GLOBAL_DIRTY_RENHAR_IDS.delete(key); }, ms);
}
// FIX (25 Sep 2026, root cause "geser Raw Schedule balik lagi instan") - markRawDirty dulu CUMA
// timeout buta (default 2 detik), gak tahu dan gak peduli apakah tulisan ke server BENERAN udah
// selesai (sukses/gagal) - kalau updateRaw() gagal (koneksi lambat/putus) dan window 2 detik itu
// keburu abis SEBELUM caller sempat konfirmasi hasilnya, sync debounce di App.tsx (rawSyncTimerRef)
// nimpa balik rawData optimistic ke versi lama begitu ada event realtime raw_schedule APAPUN
// (auto-geser cron, admin lain, dll) - persis gejala "balik lagi instan" yang dilaporkan. Sekarang
// caller (confirmDrag) WAJIB panggil clearRawDirty() begitu updateRaw() beneran resolve (sukses
// ATAU gagal-permanen) - dirty period jadi ngikutin kenyataan, bukan tebakan waktu. ms di sini
// cuma JARING PENGAMAN (kalau clearRawDirty lupa dipanggil di jalur error yang belum tercover),
// diperpanjang ke 15 detik (samain skala sama markRenharDirty) - bukan lagi mekanisme utama.
export function markRawDirty(id:number|string, ms=15000){
  const key=String(id);
  GLOBAL_DIRTY_RAW_IDS.add(key);
  setTimeout(()=>{ GLOBAL_DIRTY_RAW_IDS.delete(key); }, ms);
}
export function clearRawDirty(id:number|string){
  GLOBAL_DIRTY_RAW_IDS.delete(String(id));
}

let _id=8000;
export function uid(){ return ++_id; }
