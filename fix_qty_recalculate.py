from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """      const nq2=Number(qty)||0;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq2}};
      if(nq2===0)nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
      return{...p,checklist:nc};"""

new = """      const nq2=Number(qty)||0;
      const oldQty2=p.checklist[kode]?.qty||1;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq2}};
      if(nq2===0){
        // qty 0 → reset semua progress
        nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
        nc[kode].progressByDate=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:{}}),{});
        nc[kode].history=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:[]}),{});
      } else if(nq2!==oldQty2 && oldQty2>0){
        // qty berubah → recalculate progress proporsional
        const ratio=oldQty2/nq2;
        const newProgress:any={};
        ALL_PROSES.forEach(pr=>{
          const old=nc[kode].progress?.[pr]||0;
          newProgress[pr]=Math.min(100,Math.round(old*ratio));
        });
        nc[kode].progress=newProgress;
      }
      return{...p,checklist:nc};"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Qty recalculate otomatis added!")
else:
    print("❌ Not found!")
