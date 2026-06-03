from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── Fix 1: cascade delete - ganti setRawData & setRenhar dengan filter dari woData ──
old_cascade = """  // 8. Update local state
  setWoData(prev=>prev.filter(w=>w.id!==delId));
  setRawData(prev=>prev.filter(r=>(r.wo_id||r.woId)!==delId));
  setRenhar(prev=>prev.filter(r=>(r.wo_id||r.woId)!==delId));
  setDelId(null);"""

new_cascade = """  // 8. Update local state
  setWoData(prev=>prev.filter(w=>w.id!==delId));
  setDelId(null);"""

if old_cascade in content:
    content = content.replace(old_cascade, new_cascade)
    print("✅ Fix 1: cascade delete setRawData/setRenhar removed")
else:
    print("❌ Fix 1: not found")

# ── Fix 2: Restore realtime INSERT di useWorkOrders ──
HOOK_PATH = Path(r"C:\Users\User\vista-teknik\src\hooks\useWorkOrders.ts")
hook = HOOK_PATH.read_text(encoding="utf-8")

old_rt = "schema: 'public', table: 'work_orders' },\n        () => { /* INSERT handled by App.tsx setWoData to include panels */ }\n      )"
new_rt = "schema: 'public', table: 'work_orders' },\n        (payload) => { setData(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new]) }\n      )"

if old_rt in hook:
    hook = hook.replace(old_rt, new_rt)
    HOOK_PATH.write_text(hook, encoding="utf-8")
    print("✅ Fix 2: Realtime INSERT restored")
else:
    print("❌ Fix 2: not found")

# ── Fix 3: Di App.tsx, saat createWO - refetch woData setelah save panels ──
# Ganti setWoData manual dengan refetch agar panels ter-include
old_create = """      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        setWoData(prev=>[...prev,{...result.data,panels:np}]);
        if(log) await log("TAMBAH WO","Tambah WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"create",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }"""

new_create = """      const result=await createWO({wo:form.wo,proyek:form.proyek,target:form.target});
      if(result.success){
        await workOrderService.savePanels(result.data.id, np);
        // Update local state dengan data lengkap termasuk panels
        const newWo={...result.data,panels:np};
        setWoData(prev=>{
          // cek duplikat dari realtime
          if(prev.some(w=>w.id===result.data.id)){
            return prev.map(w=>w.id===result.data.id?newWo:w);
          }
          return [...prev,newWo];
        });
        if(log) await log("TAMBAH WO","Tambah WO "+form.wo+" - "+form.proyek,"work_orders",{module:"wo",action_type:"create",proyek:form.proyek,wo_number:form.wo,halaman:"Manajemen WO"});
      }"""

if old_create in content:
    content = content.replace(old_create, new_create)
    print("✅ Fix 3: createWO dedup logic added")
else:
    print("❌ Fix 3: not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
