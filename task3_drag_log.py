from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """    setDragMode(null);setDragInfo(null);
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});
  };"""

new = """    setDragMode(null);setDragInfo(null);
    if(updatedRow) await updateRaw(rawId,{schedule:updatedRow.schedule});
    // Activity log drag & drop
    const row=rawData.find(r=>r.id===rawId);
    const wpList=entries.map(e=>e.wp).join(", ");
    const kompList=entries.flatMap(e=>e.komponen||[]).join(", ");
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({
      user_name:uname,
      action:mode==="move"?"PINDAH JADWAL":"COPY JADWAL",
      description:(mode==="move"?"Pindah":"Copy")+" jadwal "+row?.panel+" ("+row?.proyek+") proses "+row?.proses+" WP: "+wpList+" dari "+fromDate+" ke "+toDate,
      module:"raw",
      halaman:"Raw Schedule",
      proyek:row?.proyek||"",
      panel:row?.panel||"",
    });
  };"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Task 3: Drag & Drop activity log added!")
else:
    print("❌ Not found!")
