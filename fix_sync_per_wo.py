file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_sync_per_wo", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD = """        <button onClick={async()=>{
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
        </button>"""

NEW = """        <button onClick={async()=>{
          const targetLabel=filterWO==="ALL"?"SEMUA WO":"WO "+filterWO;
          if(!window.confirm("Sync jadwal FCS ke Raw Schedule untuk "+targetLabel+"? Data schedule yang ada akan diupdate."))return;
          setSyncing(true);
          const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
          const uname=user?.name||user?.nama||sess?.nama||"Admin";
          const woNumbers=filterWO==="ALL"
            ?[...new Set(scheduleList.map((s:any)=>s.wo_number))]
            :[filterWO];
          let sukses=0;let gagal=0;
          for(const woNum of woNumbers){
            const res=await syncFCSToRawSchedule(woNum,filterPekerjaan,uname);
            if(res.success)sukses++;else gagal++;
          }
          setSyncing(false);
          alert("Sync selesai untuk "+targetLabel+"! "+sukses+" WO berhasil"+(gagal>0?", "+gagal+" gagal":""));
          fetchAll();
        }} disabled={syncing||scheduleList.length===0}
          style={{height:28,padding:"0 14px",borderRadius:6,border:"none",background:syncing?"#94a3b8":"#7c3aed",color:"#fff",fontSize:11,fontWeight:700,cursor:syncing||scheduleList.length===0?"not-allowed":"pointer",fontFamily:"inherit"}}>
          {syncing?"\u23f3 Syncing...":filterWO==="ALL"?"\u21c4 Sync Semua WO":"\u21c4 Sync WO "+filterWO}
        </button>"""

ok = OLD in content
print(f"  PATTERN: {'FOUND' if ok else 'MISSING'}")

if ok:
    content = content.replace(OLD, NEW)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Sync per WO sesuai filter berhasil diterapkan")
    print("[INFO] Jalankan: npm run build")
