// Shim minimal global `Iterator` (30 Agu 2026) - BUKAN polyfill Iterator Helpers yang
// lengkap (kode kita gak pakai method itu sama sekali), cuma buat lolos bug di dalam
// pdfjs-dist@6.3.289 sendiri:
//
//   if (typeof Iterator.prototype.join !== "function") { Iterator.prototype.join = ... }
//
// Mozilla nulis baris itu asumsi `Iterator` global (proposal TC39 "Iterator Helpers", baru
// masuk Safari 18.4+) SUDAH ADA tapi method .join()-nya aja yang belum - gak dijaga kalau
// Iterator SAMA SEKALI gak ada (Safari lebih lama dari 18.4). Begitu `Iterator.prototype`
// dievaluasi di situ, crash "Can't find variable: Iterator" - kejadian nyata di iPhone user,
// muncul begitu tab MOM FAT dibuka (pdfjs-dist ke-load), SEBELUM upload dokumen apapun.
//
// WAJIB jadi import PALING ATAS di ocrHelpers.ts (sebelum `import ... from "pdfjs-dist"") -
// modul ES dievaluasi urut sesuai urutan import ditulis, jadi shim ini harus kelar duluan.
if(typeof (globalThis as any).Iterator==="undefined"){
  (globalThis as any).Iterator=function Iterator(){};
}
