// SALINAN dari vista-pekerja/src/lib/ocrHelpers.ts (3 Okt 2026) - repo terpisah, gak bisa share modul.
// Dipakai MomFatUploadPanel (upload MOM FAT dipindah ke Admin/Engineering). Kalau diubah, samakan.
import "./iteratorPolyfill";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite ?url import, ambil URL file worker pdf.js buat di-bundle terpisah
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// ─────────────────────────────────────────────────────────────────────────────
// OCR MOM FAT (30 Agu 2026) - baca dokumen PDF/foto scan, ekstrak jadi baris-baris teks
// buat draft checklist. Semua jalan CLIENT-SIDE (browser QC) - gak ada backend server di
// app ini selain Edge Function r2-storage, dan Tesseract.js jauh lebih gampang jalan di
// browser drpd Deno Edge Function.
//
// Tesseract.js AKURAT buat teks ketik/print, TAPI LEMAH buat tulisan tangan (keterbatasan
// OCR non-AI secara umum, bukan cuma Tesseract) - baris dengan confidence rendah ditandai
// lewat field `confidence` biar UI bisa kasih badge "cek manual" ke operator QC.
//
// Bahasa "ind+eng" (bukan "ind" doang) - dokumen FAT sering campur istilah teknis Inggris
// (MCCB, ACB, brand asing) di antara kalimat Indonesia.
// ─────────────────────────────────────────────────────────────────────────────
export type OcrLine={teks:string,confidence:number};

async function renderPdfToCanvases(file:File):Promise<HTMLCanvasElement[]>{
  const buf=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:buf}).promise;
  const canvases:HTMLCanvasElement[]=[];
  for(let pageNum=1;pageNum<=pdf.numPages;pageNum++){
    const page=await pdf.getPage(pageNum);
    // scale 2x - resolusi lebih tinggi = OCR lebih akurat drpd render ukuran asli
    const viewport=page.getViewport({scale:2});
    const canvas=document.createElement("canvas");
    canvas.width=viewport.width;
    canvas.height=viewport.height;
    const ctx=canvas.getContext("2d")!;
    await page.render({canvasContext:ctx,canvas,viewport}).promise;
    canvases.push(canvas);
  }
  return canvases;
}

// BUG FIX (30 Agu 2026): "Gagal proses OCR: Failed to fetch" - Tesseract.js TANPA
// workerPath/corePath/langPath eksplisit diam-diam fetch ~8MB dari CDN pihak ketiga
// (cdn.jsdelivr.net) SETIAP KALI OCR jalan - worker script, core WASM, + traineddata
// ind/eng. Kalau koneksi WiFi/HP putus-nyambung di tengah salah satu dari 4 request
// besar itu, fetch() lempar persis "Failed to fetch". Sekarang semua di-self-host di
// public/tesseract & public/tessdata (origin sendiri, sama kayak semua aset lain di app
// ini) - gak ada lagi dependency ke CDN eksternal manapun.
const TESS_OPTIONS={workerPath:"/tesseract/worker.min.js",corePath:"/tesseract",langPath:"/tessdata"};

// Baca dokumen (PDF multi-halaman atau 1 foto), balikin daftar baris teks + confidence
// per baris. Baris kosong/terlalu pendek (<3 karakter, biasanya noise) otomatis dibuang.
export async function ocrDocument(file:File,onProgress?:(pct:number)=>void):Promise<OcrLine[]>{
  const worker=await createWorker("ind+eng",undefined,TESS_OPTIONS);
  try{
    const images:(HTMLCanvasElement|File)[]=file.type==="application/pdf"
      ?await renderPdfToCanvases(file)
      :[file];
    const allLines:OcrLine[]=[];
    for(let i=0;i<images.length;i++){
      const{data}:any=await worker.recognize(images[i],{},{blocks:true} as any);
      onProgress?.(Math.round(((i+1)/images.length)*100));
      (data.blocks||[]).forEach((b:any)=>{
        (b.paragraphs||[]).forEach((p:any)=>{
          (p.lines||[]).forEach((l:any)=>{
            const teks=(l.text||"").trim();
            if(teks.length>=3)allLines.push({teks,confidence:l.confidence});
          });
        });
      });
    }
    return extractHasilFat(allLines);
  }finally{
    await worker.terminate();
  }
}

// Ekstrak cuma bagian "Hasil FAT" (bullet list temuan) dari seluruh teks hasil OCR (30 Agu
// 2026, feedback: "aku mau baca hasil fat saja, bukan semua checklist box") - dulu SEMUA
// baris kepakai jadi poin checklist, termasuk header dokumen (Customer/Proyek/Peserta dll)
// dan blok tanda tangan approval di bawah, bukan cuma poin temuan yang sungguhan relevan.
//
// Strategi: cari heading "Hasil FAT", potong sampai sebelum baris "Yang Menyetujui/
// Mengetahui/Menyerahkan" (blok approval). Di rentang itu, cuma baris yang mulai dengan
// simbol bullet (Tesseract baca ➤ sebagai »/> tergantung dokumen) yang jadi poin baru -
// baris LAIN di rentang itu (tanpa bullet) berarti sambungan baris yang kepotong (line-wrap
// PDF, misal "...SDP MENTAH SOSIS" + "& BAKSO." harusnya 1 poin) digabung ke poin sebelumnya.
// Kalau heading/bullet gak ketemu sama sekali (OCR gagal baca simbolnya), fallback balikin
// apa adanya biar checklist gak kosong total - operator masih bisa bersihkan manual.
function extractHasilFat(lines:OcrLine[]):OcrLine[]{
  const lower=(s:string)=>s.toLowerCase();
  const headingIdx=lines.findIndex(l=>lower(l.teks).includes("hasil")&&lower(l.teks).includes("fat"));
  const endMarkerIdx=lines.findIndex((l,i)=>(headingIdx<0||i>headingIdx)&&
    (lower(l.teks).includes("menyetujui")||lower(l.teks).includes("mengetahui")||lower(l.teks).includes("menyerahkan")));
  const startIdx=headingIdx>=0?headingIdx+1:0;
  const endIdx=endMarkerIdx>=0?endMarkerIdx:lines.length;
  const slice=lines.slice(startIdx,endIdx);

  const BULLET_RE=/^[»>•●◆♦]/;
  const merged:OcrLine[]=[];
  slice.forEach(l=>{
    const teks=l.teks.trim();
    if(BULLET_RE.test(teks)){
      merged.push({teks:teks.replace(BULLET_RE,"").trim(),confidence:l.confidence});
    } else if(merged.length>0){
      const last=merged[merged.length-1];
      last.teks=(last.teks+" "+teks).trim();
      last.confidence=Math.min(last.confidence,l.confidence);
    }
    // baris tanpa bullet SEBELUM poin pertama ketemu = noise header, dibuang.
  });
  return merged.length>0?merged:slice;
}

export const detectFileType=(file:File):"pdf"|"image"|null=>{
  if(file.type==="application/pdf")return"pdf";
  if(file.type.startsWith("image/"))return"image";
  return null;
};

// Threshold "kurang yakin" - di bawah ini dianggap perlu dicek manual operator.
export const OCR_CONFIDENCE_THRESHOLD=70;
