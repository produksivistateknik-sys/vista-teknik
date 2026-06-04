from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah fungsi backup Excel di SystemTab
old_systemtab = "function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity}){"

new_systemtab = """function SystemTab({user,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja,logActivity}){"""

# Tambah backup button di SystemTab render - setelah subTabs
old_subtab_header = """      <div style={{display:"flex",gap:0,marginBottom:20,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        {subTabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}"""

new_subtab_header = """      {/* Backup Excel Button */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <button onClick={async()=>{
          try{
            // Dynamic import SheetJS
            const XLSX=await import("https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs" as any);
            const wb=XLSX.utils.book_new();

            // Sheet 1: Work Orders
            const woRows:any[]=[];
            woRows.push(["NO WO","PROYEK","TARGET","TOTAL PANEL","AVG PROGRESS","STATUS"]);
            (window as any).__vt_woData?.forEach((w:any)=>{
              const pct=woOverall(w);
              const status=pct===100?"Selesai":isDelayed(w.target)?"Terlambat":isUrgent(w.target)?"Mendesak":"On Track";
              woRows.push([w.wo,w.proyek,w.target,(w.panels||[]).length+' panel',pct+'%',status]);
            });
            const ws1=XLSX.utils.aoa_to_sheet(woRows);
            XLSX.utils.book_append_sheet(wb,ws1,"Work Orders");

            // Sheet 2: Detail Progress per Panel
            const panelRows:any[]=[];
            panelRows.push(["WO","PROYEK","PANEL","TIPE","QTY","OVERALL",...ALL_PROSES]);
            (window as any).__vt_woData?.forEach((w:any)=>{
              (w.panels||[]).forEach((p:any)=>{
                const pd=calcPanelProgress(p);
                const overall=panelOverall(p);
                panelRows.push([w.wo,w.proyek,p.nama||p.name,p.tipe,
                  Object.values(p.checklist||{}).reduce((a:any,c:any)=>a+(c.qty||0),0),
                  overall+'%',...ALL_PROSES.map(pr=>(pd[pr]||0)+'%')]);
              });
            });
            const ws2=XLSX.utils.aoa_to_sheet(panelRows);
            XLSX.utils.book_append_sheet(wb,ws2,"Progress Panel");

            // Sheet 3: Pekerja
            const pkrRows:any[]=[];
            pkrRows.push(["NAMA","DIVISI"]);
            pekerja?.forEach((p:any)=>{
              const dc=(DIVISI_CONFIG as any)[p.divisi];
              pkrRows.push([p.nama,dc?.label||p.divisi]);
            });
            const ws3=XLSX.utils.aoa_to_sheet(pkrRows);
            XLSX.utils.book_append_sheet(wb,ws3,"Master Pekerja");

            // Sheet 4: Activity Log
            const logRows:any[]=[];
            logRows.push(["WAKTU","USER","AKSI","DESKRIPSI","MODULE","HALAMAN"]);
            activityLog?.slice(0,200).forEach((l:any)=>{
              logRows.push([l.created_at,l.user_name,l.action,l.description,l.module,l.halaman]);
            });
            const ws4=XLSX.utils.aoa_to_sheet(logRows);
            XLSX.utils.book_append_sheet(wb,ws4,"Activity Log");

            // Download
            const tgl=new Date().toISOString().slice(0,10);
            XLSX.writeFile(wb,`Vista_Teknik_Backup_${tgl}.xlsx`);

            // Activity log
            const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
            await activityLogService.insert({
              user_name:user?.name||user?.nama||sess?.nama||"Admin",
              action:"BACKUP DATA",
              description:"Export backup data ke Excel",
              module:"system",halaman:"System"
            });
          }catch(e){
            alert("Gagal export: "+(e as any).message);
          }
        }}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
          background:"#16a34a",color:"#fff",border:"none",borderRadius:8,
          cursor:"pointer",fontSize:12,fontWeight:700}}>
          📥 Backup ke Excel
        </button>
      </div>

      <div style={{display:"flex",gap:0,marginBottom:20,background:"#fff",borderRadius:10,border:"1px solid #e2e8f0",overflow:"hidden"}}>
        {subTabs.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}"""

if old_subtab_header in content:
    content = content.replace(old_subtab_header, new_subtab_header)
    print("✅ Backup Excel button added to SystemTab")
else:
    print("❌ SystemTab subTabs header not found")

# Expose woData ke window untuk backup (di App component)
old_wo_effect = """useEffect(() => {
  if (!woLoading) setWoData(woList)
}, [woList, woLoading])"""

new_wo_effect = """useEffect(() => {
  if (!woLoading) {
    setWoData(woList);
    (window as any).__vt_woData = woList;
  }
}, [woList, woLoading])"""

if old_wo_effect in content:
    content = content.replace(old_wo_effect, new_wo_effect)
    print("✅ woData exposed to window for backup")
else:
    print("⚠️  woData effect not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Task 4 (Backup Excel) Selesai!")
