from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Hapus keyboard handler dari App component
old = """  // Keyboard handler untuk Ctrl+C / Ctrl+V / Esc
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){
        if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,lastSelected,rawData,woData]);

  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""

new = """  const isOp=OPERATOR_ROLES.includes(user?.divisi);"""

if old in content:
    content = content.replace(old, new)
    print("✅ Keyboard handler removed from App!")
else:
    print("❌ Not found!")

APP_PATH.write_text(content, encoding="utf-8")

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const [busbarSel,setBusbarSel]=useState<string[]>([]);"""

new = """  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;
  const [busbarSel,setBusbarSel]=useState<string[]>([]);

  // Keyboard handler Ctrl+C / Ctrl+V / Esc / Delete
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key==="c"){
        if(selectedCells.length>0){e.preventDefault();copySelected();}
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="v"){
        if(copiedCells.length>0&&lastSelected){
          e.preventDefault();
          pasteToCell(lastSelected.rawId,lastSelected.date);
        }
      }
      if(e.key==="Escape"){setSelectedCells([]);setCopiedCells([]);}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[selectedCells,copiedCells,lastSelected,rawData,woData]);"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Keyboard handler added to RawSchedule!")
else:
    print("❌ Not found!")
