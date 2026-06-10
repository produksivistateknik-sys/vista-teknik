file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_qr", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state printQR
OLD_STATE = """function MasterMesinTab({mesinList,setMesinList,user}:any){"""
NEW_STATE = """function MasterMesinTab({mesinList,setMesinList,user}:any){
  const [printQR,setPrintQR]=useState<any>(null);"""

# Fix 2: Tambah tombol QR di baris aksi
OLD_AKSI = """                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>{setEditId(m.id);setForm({kode:m.kode,nama:m.nama,lokasi:m.lokasi||"",status:m.status});}}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>\u270f\ufe0f</button>
                      <button onClick={()=>setDelId(m.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>\U0001f5d1</button>
                    </div>
                  </td>"""

NEW_AKSI = """                  <td style={{...td,textAlign:"center"}}>
                    <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                      <button onClick={()=>{setEditId(m.id);setForm({kode:m.kode,nama:m.nama,lokasi:m.lokasi||"",status:m.status});}}
                        style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#475569"}}>\u270f\ufe0f</button>
                      <button onClick={()=>setDelId(m.id)}
                        style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>\U0001f5d1</button>
                      <button onClick={()=>setPrintQR(m)}
                        style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:600}}>QR</button>
                    </div>
                  </td>"""

# Fix 3: Tambah modal QR sebelum closing MasterMesinTab
OLD_CLOSE = """      {delId&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Mesin <strong>{mesinList.find(m=>m.id===delId)?.nama}</strong> akan dihapus.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}"""

NEW_CLOSE = """      {delId&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelId(null)} width={360}>
          <div style={{fontSize:13,color:"#475569",marginBottom:20}}>
            Mesin <strong>{mesinList.find(m=>m.id===delId)?.nama}</strong> akan dihapus.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
      {printQR&&(
        <Modal title={"QR Code \u2014 "+printQR.nama} onClose={()=>setPrintQR(null)} width={380}>
          <div style={{textAlign:"center",padding:"8px 0"}}>
            <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>
              Scan QR untuk melihat info & jadwal maintenance mesin ini
            </div>
            <div id={"qr-"+printQR.id} style={{display:"flex",justifyContent:"center",marginBottom:12}}>
              {(()=>{
                setTimeout(()=>{
                  const el=document.getElementById("qr-"+printQR.id);
                  if(el&&el.children.length===0&&(window as any).QRCode){
                    new (window as any).QRCode(el,{
                      text:window.location.origin+"/mesin?id="+printQR.id,
                      width:180,height:180,colorDark:"#1e293b",colorLight:"#ffffff"
                    });
                  }
                },300);
                return null;
              })()}
            </div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:4,fontFamily:"monospace",wordBreak:"break-all" as const,padding:"0 8px"}}>
              {window.location.origin+"/mesin?id="+printQR.id}
            </div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:20}}>
              {printQR.kode} \u00b7 {printQR.nama}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <Btn outline color="#64748b" onClick={()=>setPrintQR(null)}>Tutup</Btn>
              <Btn color="#1d4ed8" onClick={()=>{
                const url=window.location.origin+"/mesin?id="+printQR.id;
                const w=window.open("","_blank","width=400,height=500");
                if(!w)return;
                w.document.write(`<!DOCTYPE html><html><head><title>QR ${printQR.kode}</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><`+`/script>
                </head><body style="font-family:Arial;text-align:center;padding:32px;background:#fff">
                <h2 style="margin:0 0 4px;font-size:18px">${printQR.nama}</h2>
                <p style="color:#64748b;margin:0 0 4px;font-size:13px">${printQR.kode}${printQR.lokasi?" \u00b7 "+printQR.lokasi:""}</p>
                <p style="color:#94a3b8;margin:0 0 20px;font-size:11px">Scan untuk info maintenance</p>
                <div id="qrp" style="display:inline-block;padding:12px;border:1px solid #e2e8f0;border-radius:8px"></div>
                <p style="font-size:10px;color:#94a3b8;margin-top:12px;word-break:break-all">${url}</p>
                <script>
                  window.onload=function(){
                    new QRCode(document.getElementById("qrp"),{text:"${url}",width:200,height:200,colorDark:"#1e293b",colorLight:"#ffffff"});
                    setTimeout(function(){window.print();},800);
                  }
                <`+`/script></body></html>`);
                w.document.close();
              }}>
                \U0001f5a8 Print QR
              </Btn>
            </div>
          </div>
        </Modal>
      )}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"/>
    </div>
  );
}"""

checks=[("STATE",OLD_STATE),("AKSI",OLD_AKSI),("CLOSE",OLD_CLOSE)]
all_ok=True
for name,pat in checks:
    found=pat in content
    print(f"  {name}: {'FOUND' if found else 'MISSING'}")
    if not found: all_ok=False

if all_ok:
    content=content.replace(OLD_STATE,NEW_STATE)
    content=content.replace(OLD_AKSI,NEW_AKSI)
    content=content.replace(OLD_CLOSE,NEW_CLOSE)
    with open(file_path,"w",encoding="utf-8") as f:
        f.write(content)
    print("[OK] Berhasil — jalankan: npm run build")
else:
    for name,pat in checks:
        if pat not in content:
            lines=content.split("\n")
            # cari konteks
            kw=pat.strip().split("\n")[0].strip()
            for i,l in enumerate(lines):
                if kw[:40] in l:
                    print(f"\n{name} ketemu di baris {i+1}:")
                    for j in range(max(0,i-1),min(i+6,len(lines))):
                        print(repr(lines[j]))
                    break
