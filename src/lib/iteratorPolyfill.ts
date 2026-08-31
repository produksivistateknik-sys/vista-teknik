// Shim minimal global `Iterator` (31 Agu 2026) - BUKAN polyfill Iterator Helpers yang
// lengkap (kode kita gak pakai method itu sama sekali), cuma buat lolos bug di dalam
// pdfjs-dist@6.3.289 sendiri:
//
//   if (typeof Iterator.prototype.join !== "function") { Iterator.prototype.join = ... }
//
// Mozilla nulis baris itu asumsi `Iterator` global (proposal TC39 "Iterator Helpers", baru
// masuk Safari 18.4+) SUDAH ADA tapi method .join()-nya aja yang belum - gak dijaga kalau
// Iterator SAMA SEKALI gak ada (Safari lebih lama dari 18.4). Begitu `Iterator.prototype`
// dievaluasi di situ, crash "Can't find variable: Iterator". Sama persis kayak fix di
// vista-pekerja/src/lib/iteratorPolyfill.ts (dipakai buat OCR MOM FAT) - dipakai lagi di sini
// buat PdfViewer.tsx.
//
// WAJIB jadi import PALING ATAS di file yang import "pdfjs-dist" (sebelum importnya) - modul
// ES dievaluasi urut sesuai urutan import ditulis, jadi shim ini harus kelar duluan.
if(typeof (globalThis as any).Iterator==="undefined"){
  (globalThis as any).Iterator=function Iterator(){};
}
