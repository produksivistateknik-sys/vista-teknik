from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    return rawData.flatMap(r=>(r.schedule?.[selDate]||[]).map(e=>({
      rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
      proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
      wp:e.wp,komponen:e.komponen,tanggal:selDate
    })));
  },[rawData,selDate]);"""

new = """  const dateTasks=useMemo(()=>{
    if(!selDate)return[];
    const tasks:any[]=[];
    rawData.forEach(r=>{
      // WP biasa dari schedule
      (r.schedule?.[selDate]||[]).forEach((e:any)=>{
        tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
          proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
          wp:e.wp,komponen:e.komponen,tanggal:selDate});
      });
      // Busbar dari busbar_schedule
      if(r.proses==="BUSBAR"){
        const busbarItems=r.busbar_schedule?.[selDate]||[];
        if(busbarItems.length>0){
          tasks.push({rawId:r.id,woId:r.wo_id||r.woId,panelId:r.panel_id||r.panelId,
            proyek:r.proyek,panel:r.panel,proses:r.proses,prioritas:r.prioritas,
            wp:"BUSBAR",komponen:busbarItems,tanggal:selDate,isBusbar:true});
        }
      }
    });
    return tasks;
  },[rawData,selDate]);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ dateTasks updated to include busbar!")
else:
    print("❌ Not found!")
