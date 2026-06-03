from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari posisi setelah isWpDone function untuk sisipkan drag functions
old_anchor = """  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);"""

new_anchor = """  const onDragStart=(e,rawId,fromDate,entries)=>{
    e.dataTransfer.effectAllowed="move";
    setDragInfo({rawId,fromDate,entries});
  };

  const onDragOver=(e,rawId,date)=>{
    e.preventDefault();
    e.dataTransfer.dropEffect="move";
    setDragOverCell({rawId,date});
  };

  const onDrop=(e,rawId,toDate)=>{
    e.preventDefault();
    setDragOverCell(null);
    if(!dragInfo)return;
    if(dragInfo.rawId!==rawId){setDragInfo(null);return;}
    if(dragInfo.fromDate===toDate){setDragInfo(null);return;}
    setDragMode({...dragInfo,toDate});
    setDragInfo(null);
  };

  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);"""

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Drag & Drop functions restored!")
else:
    print("❌ Anchor not found!")
    # debug
    lines = content.splitlines()
    for i, l in enumerate(lines[2855:2870], 2856):
        print(f"{i}: {l}")
