file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_fcs_sync", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah fungsi syncFCSToRawSchedule di fcsService import
OLD_IMPORT = """import { generateFCSSchedule } from './services/fcsService'"""
NEW_IMPORT = """import { generateFCSSchedule, syncFCSToRawSchedule } from './services/fcsService'"""

# Fix 2: Tambah tombol Sync di FCSScheduleTab - di filter bar sebelum Refresh
OLD_REFRESH = """        <button onClick={fetchAll}
          style={{height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
          \u21bb Refresh
        </button>"""

NEW_REFRESH = """        <button onClick={async()=>{
          if(!window.confirm("Sync jadwal FCS ke Raw Schedule? Data schedule yang ada akan diupdate."))return;
          setSyncing(true);
          const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
          const uname=user?.name||user?.nama||sess?.nama||"Admin";
          const woNumbers=[...new Set(scheduleList.map((s:any)=>s.wo_number))];
          let sukses=0;let gagal=0;
          for(const woNum of woNumbers){
            const res=await syncFCSToRawSchedule(woNum,filterPekerjaan,uname);
            if(res.success)sukses++;else gagal++;
          }
          setSyncing(false);
          alert("Sync selesai! "+sukses+" WO berhasil"+(gagal>0?", "+gagal+" gagal":""));
          fetchAll();
        }} disabled={syncing||scheduleList.length===0}
          style={{height:28,padding:"0 14px",borderRadius:6,border:"none",background:syncing?"#94a3b8":"#7c3aed",color:"#fff",fontSize:11,fontWeight:700,cursor:syncing||scheduleList.length===0?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {syncing?"\u23f3 Syncing...":"\u21c4 Sync ke Raw Schedule"}
        </button>
        <button onClick={fetchAll}
          style={{height:28,padding:"0 12px",borderRadius:6,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#475569",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
          \u21bb Refresh
        </button>"""

# Fix 3: Tambah state syncing di FCSScheduleTab
OLD_STATE_FCS = """  const [approveId,setApproveId]=useState<any>(null);"""
NEW_STATE_FCS = """  const [approveId,setApproveId]=useState<any>(null);
  const [syncing,setSyncing]=useState(false);"""

ok1 = OLD_IMPORT in content
ok2 = OLD_REFRESH in content
ok3 = OLD_STATE_FCS in content

print(f"  IMPORT:  {'FOUND' if ok1 else 'MISSING'}")
print(f"  REFRESH: {'FOUND' if ok2 else 'MISSING'}")
print(f"  STATE:   {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_IMPORT, NEW_IMPORT)
    content = content.replace(OLD_REFRESH, NEW_REFRESH)
    content = content.replace(OLD_STATE_FCS, NEW_STATE_FCS)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Tombol Sync ke Raw Schedule berhasil ditambah")
else:
    lines = content.split("\n")
    if not ok2:
        for i,l in enumerate(lines):
            if 'Refresh' in l and 'fetchAll' in l:
                print(f"\nREFRESH baris {i+1}:")
                for j in range(max(0,i-2),min(i+4,len(lines))):
                    print(repr(lines[j]))
                break
