file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(file_path + ".bak_qrnpm2", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

# Tambah import qrcode setelah baris import react
for i, l in enumerate(lines):
    if "from 'react'" in l and "useState" in l:
        if "import QRCode" not in lines[i+1]:
            lines.insert(i+1, "import QRCode from 'qrcode';\n")
            print(f"[OK] Import QRCode ditambah setelah baris {i+1}")
        break

# Cari ulang baris printQR&&( setelah insert
start_idx = None
for i, l in enumerate(lines):
    if "printQR&&(" in l and i > 6400:
        start_idx = i
        break

if start_idx is None:
    print("[FAIL] printQR&&( tidak ditemukan")
    exit()

# Cari end_idx - baris '      )}'  setelah start
end_idx = None
for i in range(start_idx, start_idx + 80):
    if lines[i].strip() == ")}":
        end_idx = i
        break

print(f"[INFO] Modal QR: baris {start_idx+1} s/d {end_idx+1}")

NEW_MODAL = """      {printQR&&(
        <Modal title={"QR Code \u2014 "+printQR.nama} onClose={()=>setPrintQR(null)} width={380}>
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              Scan QR untuk melihat info & jadwal maintenance mesin ini
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              <canvas ref={(canvas:any)=>{
                if(canvas&&!(canvas as any).__qr_done){
                  (canvas as any).__qr_done=true;
                  const url=window.location.origin+"/mesin?id="+printQR.id;
                  QRCode.toCanvas(canvas,url,{width:180,margin:2,color:{dark:"#1e293b",light:"#ffffff"}},(err:any)=>{if(err)console.error(err);});
                }
              }}/>
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:4,fontFamily:"monospace",wordBreak:"break-all" as const,padding:"0 8px"}}>
              {window.location.origin+"/mesin?id="+printQR.id}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>
              {printQR.kode} \u00b7 {printQR.nama}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setPrintQR(null)}>Tutup</Btn>
              <Btn color="#1d4ed8" onClick={async()=>{
                const url=window.location.origin+"/mesin?id="+printQR.id;
                const dataUrl=await QRCode.toDataURL(url,{width:200,margin:2,color:{dark:"#1e293b",light:"#ffffff"}});
                const w=window.open("","_blank","width=420,height=520");
                if(!w)return;
                w.document.write('<!DOCTYPE html><html><head><title>QR '+printQR.kode+'</title>'
                  +'<style>body{font-family:Arial;text-align:center;padding:32px;background:#fff}</style>'
                  +'</head><body>'
                  +'<h2 style="margin:0 0 4px;font-size:18px">'+printQR.nama+'</h2>'
                  +'<p style="color:#64748b;margin:0 0 4px;font-size:13px">'+printQR.kode+(printQR.lokasi?' \u00b7 '+printQR.lokasi:'')+'</p>'
                  +'<p style="color:#94a3b8;margin:0 0 16px;font-size:11px">Scan untuk info maintenance</p>'
                  +'<div style="display:inline-block;padding:12px;border:1px solid #e2e8f0;border-radius:8px">'
                  +'<img src="'+dataUrl+'" width="200" height="200"/></div>'
                  +'<p style="font-size:10px;color:#94a3b8;margin-top:12px;word-break:break-all">'+url+'</p>'
                  +'<scri'+'pt>setTimeout(function(){window.print();},500);</scri'+'pt>'
                  +'</body></html>');
                w.document.close();
              }}>
                \U0001f5a8 Print QR
              </Btn>
            </div>
          </div>
        </Modal>
      )}
"""

lines[start_idx:end_idx+1] = [NEW_MODAL]

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] Modal QR berhasil diganti pakai npm qrcode")
print("[INFO] Jalankan: npm run build")
