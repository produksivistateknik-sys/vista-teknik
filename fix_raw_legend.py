from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Hapus legend WP + Prioritas + Status
old_legend = """      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {WP_LIST.map(wp=>(<span key={wp} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,fontWeight:700,color:WP_COLOR[wp],background:WP_COLOR[wp]+"18",border:`1px solid ${WP_COLOR[wp]}33`,borderRadius:20,padding:"2px 10px"}}><span style={{width:7,height:7,borderRadius:"50%",background:WP_COLOR[wp],display:"inline-block"}}/>{wp}</span>))}
        {PRIORITAS.map(p=><Badge key={p} label={p} color={PRIORITAS_COLOR[p]}/>)}
        <span style={{fontSize:11,color:"#16a34a",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>✓ Finish</span>
        <span style={{fontSize:11,color:"#f59e0b",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:20,padding:"2px 10px",fontWeight:700}}>● On Progress</span>
        <span style={{fontSize:11,color:"#64748b",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:20,padding:"2px 10px",fontWeight:700}}>○ Belum Mulai</span>
      </div>"""

if old_legend in content:
    content = content.replace(old_legend, "")
    print("✅ Fix 1: Legend dihapus")
else:
    print("❌ Fix 1: Legend not found")

# Fix 2: Naikkan maxHeight
old_height = 'maxHeight:"calc(100vh - 160px)"'
new_height = 'maxHeight:"calc(100vh - 120px)"'

if old_height in content:
    content = content.replace(old_height, new_height)
    print("✅ Fix 2: Height dinaikkan")
else:
    print("❌ Fix 2: Height not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
