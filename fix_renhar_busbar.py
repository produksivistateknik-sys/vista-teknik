from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """  const allTasks=useMemo(()=>{
    const tasks=[];
    rawData.forEach(row=>{
      const entries=row.schedule?.[selDate]||[];
      entries.forEach(e=>{
        tasks.push({
          rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
          proyek:row.proyek,panel:row.panel,proses:row.proses,
          prioritas:row.prioritas||"Sedang",
          wp:e.wp,komponen:e.komponen,tanggal:selDate,
        });
      });
    });
    return tasks;
  },[rawData,selDate]);"""

new = """  const allTasks=useMemo(()=>{
    const tasks=[];
    rawData.forEach(row=>{
      const entries=row.schedule?.[selDate]||[];
      entries.forEach(e=>{
        tasks.push({
          rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
          proyek:row.proyek,panel:row.panel,proses:row.proses,
          prioritas:row.prioritas||"Sedang",
          wp:e.wp,komponen:e.komponen,tanggal:selDate,
        });
      });
      // Tambah busbar tasks dari busbar_schedule
      if(row.proses==="BUSBAR"){
        const busbarItems=row.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          // Cek apakah sudah ada dari renhar (hindari duplikat)
          const alreadyInSchedule=entries.some(e=>e.wp==="BUSBAR");
          if(!alreadyInSchedule){
            tasks.push({
              rawId:row.id,woId:row.wo_id||row.woId,panelId:row.panel_id||row.panelId,
              proyek:row.proyek,panel:row.panel,proses:row.proses,
              prioritas:row.prioritas||"Sedang",
              wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,
              isBusbar:true,
            });
          }
        }
      }
    });
    return tasks;
  },[rawData,selDate]);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ allTasks updated to include busbar_schedule!")
else:
    print("❌ Not found!")
