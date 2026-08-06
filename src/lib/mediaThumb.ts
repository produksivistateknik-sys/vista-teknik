// ─────────────────────────────────────────────────────────────────────────────
// Klasifikasi tipe media dari objek foto {url,mime?,name?} - dipakai bareng di
// tempat yang render thumbnail foto QC (ArsipTab, LaporanQCView, FotoZoomViewer).
// SENGAJA treat "tanpa field mime" sebagai gambar (bukan video/file) - semua
// foto lama yang udah kesimpan SEBELUM fitur video/file ini (dari Vista Pekerja)
// gak punya field mime sama sekali, jadi harus tetap ke-render persis kayak
// sebelumnya (<img>), gak boleh ada regresi ke data lama. Cermin dari
// vista-pekerja/src/lib/mediaThumb.ts - dua project terpisah, gak bisa share
// modul langsung, jadi disalin persis biar konsisten.
// ─────────────────────────────────────────────────────────────────────────────
export type MediaFoto={url:string,mime?:string,name?:string,uploaded_by?:string,uploaded_at?:string}

export const isVideoFoto=(f:MediaFoto):boolean=>!!f.mime&&f.mime.startsWith("video/")
export const isImageFoto=(f:MediaFoto):boolean=>!f.mime||f.mime.startsWith("image/")
export const isGenericFoto=(f:MediaFoto):boolean=>!!f.mime&&!f.mime.startsWith("image/")&&!f.mime.startsWith("video/")
