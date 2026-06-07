from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """        await workOrderService.savePanels(result.data.id, np);
        // Update local state dengan data lengkap termasuk panels
        const newWo={...result.data,panels:np};
        setWoData(prev=>{
          // cek duplikat dari realtime
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });"""

new = """        await workOrderService.savePanels(result.data.id, np);
        // Refetch panels dengan id yang benar dari database
        const{data:freshPanels}=await supabase.from("panels").select("*").eq("wo_id",result.data.id).order("no_pnl",{ascending:true});
        const newWo={...result.data,panels:freshPanels??np};
        setWoData(prev=>{
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ WO refetch panels fixed!")
else:
    print("❌ Not found!")

# Fix juga untuk edit WO
old_edit = """        await workOrderService.savePanels(editId, np);
        setWoData(prev=>prev.map(w=>w.id==editId?{...w,...form,panels:np}:w));"""

new_edit = """        await workOrderService.savePanels(editId, np);
        const{data:freshPanelsEdit}=await supabase.from("panels").select("*").eq("wo_id",editId).order("no_pnl",{ascending:true});
        setWoData(prev=>prev.map(w=>w.id==editId?{...w,...form,panels:freshPanelsEdit??np}:w));"""

if old_edit in content:
    content = content.replace(old_edit, new_edit)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Edit WO refetch panels fixed!")
else:
    print("❌ Edit WO not found!")
