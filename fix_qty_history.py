from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Update recalculate logic untuk juga update history
old = """      } else if(nq2!==oldQty2 && oldQty2>0){
        // qty berubah → recalculate progress proporsional
        const ratio=oldQty2/nq2;
        const newProgress:any={};
        ALL_PROSES.forEach(pr=>{
          const old=nc[kode].progress?.[pr]||0;
          newProgress[pr]=Math.min(100,Math.round(old*ratio));
        });
        nc[kode].progress=newProgress;
      }"""

new = """      } else if(nq2!==oldQty2 && oldQty2>0){
        // qty berubah → recalculate progress proporsional
        const ratio=oldQty2/nq2;
        const newProgress:any={};
        const newHistory:any={...(nc[kode].history||{})};
        ALL_PROSES.forEach(pr=>{
          const oldPct=nc[kode].progress?.[pr]||0;
          const newPct=Math.min(100,Math.round(oldPct*ratio));
          newProgress[pr]=newPct;
          // Update entry terakhir di history jika ada
          if(newHistory[pr]&&newHistory[pr].length>0){
            const lastIdx=newHistory[pr].length-1;
            newHistory[pr]=[...newHistory[pr]];
            newHistory[pr][lastIdx]={
              ...newHistory[pr][lastIdx],
              pct:newPct,
              ts:new Date().toISOString()
            };
          }
        });
        nc[kode].progress=newProgress;
        nc[kode].history=newHistory;
      }"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ History recalculate added!")
else:
    print("❌ Not found!")
