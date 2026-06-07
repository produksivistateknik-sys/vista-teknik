from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """    } else if(e.ctrlKey||e.metaKey){
      // Ctrl+klik = set anchor untuk selection
      setSelectedCells([{rawId,date}]);
      setLastSelected({rawId,date});"""

new = """    } else if(e.ctrlKey||e.metaKey){
      // Ctrl+klik = toggle individual cell (multi select tidak berurutan)
      setSelectedCells(prev=>{
        const exists=prev.some((c:any)=>c.rawId===rawId&&c.date===date);
        return exists?prev.filter((c:any)=>!(c.rawId===rawId&&c.date===date)):[...prev,{rawId,date}];
      });
      setLastSelected({rawId,date});"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Ctrl+click toggle fixed!")
else:
    print("❌ Not found!")
