// Kompres foto sebelum upload (canvas resize max-width 1600px + JPEG q0.8) - SALINAN pola
// compressImageNp di vista-pekerja/src/lib/fotoHelpers.ts (ubah keduanya kalau diubah). Foto asli
// kamera HP 3-10 MB; di jaringan lantai pabrik upload ukuran asli bisa menggantung lama
// (insiden 5 Okt 2026: maintenance rutin BAK DEGREASING via QR, foto tidak pernah tersimpan).
export const kompresFoto=(file:File):Promise<Blob>=>new Promise((resolve,reject)=>{
  const img=new Image();
  const url=URL.createObjectURL(file);
  img.onload=()=>{
    const maxW=1600;
    const scale=Math.min(1,maxW/img.width);
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(img.width*scale);
    canvas.height=Math.round(img.height*scale);
    const ctx=canvas.getContext("2d");
    if(!ctx){URL.revokeObjectURL(url);reject(new Error("Canvas tidak didukung"));return;}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      URL.revokeObjectURL(url);
      if(blob)resolve(blob);else reject(new Error("Gagal kompres foto"));
    },"image/jpeg",0.8);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Gagal membaca foto"));};
  img.src=url;
});
