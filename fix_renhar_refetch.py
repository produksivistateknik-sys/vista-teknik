from pathlib import Path

# Fix 1: Expose refetch dari useRenhar
HOOK_PATH = Path(r"C:\Users\User\vista-teknik\src\hooks\useRenhar.ts")
content = HOOK_PATH.read_text(encoding="utf-8")

old = "  return { data, loading, error, refetch: fetch, create, update, remove }"
new = "  return { data, loading, error, refetch: fetch, create, update, remove, refetch: fetch }"

# Already has refetch, check
if 'refetch: fetch' in content:
    print("✅ useRenhar already has refetch!")
else:
    print("❌ No refetch in useRenhar")

# Fix 2: Destructure refetch dari useRenhar di App
APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old_hook = "const { data: renharList, loading: renharLoading, create: createRenhar, update: updateRenhar, remove: removeRenhar } = useRenhar()"
new_hook = "const { data: renharList, loading: renharLoading, create: createRenhar, update: updateRenhar, remove: removeRenhar, refetch: refetchRenhar } = useRenhar()"

if old_hook in content:
    content = content.replace(old_hook, new_hook)
    print("✅ refetchRenhar destructured!")
else:
    print("❌ useRenhar destructure not found")

# Fix 3: Pass refetchRenhar ke RawSchedule
old_raw = "renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar}"
new_raw = "renhar={renhar} setRenhar={setRenhar} pekerja={pekerja} createRaw={createRaw} updateRaw={updateRaw} removeRaw={removeRaw} refetchRaw={refetchRaw} createRenhar={createRenhar} updateRenhar={updateRenhar} removeRenhar={removeRenhar} refetchRenhar={refetchRenhar}"

if old_raw in content:
    content = content.replace(old_raw, new_raw)
    print("✅ refetchRenhar passed to RawSchedule!")
else:
    print("❌ RawSchedule props not found")

# Fix 4: Tambah refetchRenhar ke RawSchedule props
old_rs_props = "function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,logActivity,logAct,log,user}){"
new_rs_props = "function RawSchedule({woData,rawData,setRawData,renhar,setRenhar,pekerja,createRaw,updateRaw,removeRaw,refetchRaw,createRenhar,updateRenhar,removeRenhar,refetchRenhar,logActivity,logAct,log,user}){"

if old_rs_props in content:
    content = content.replace(old_rs_props, new_rs_props)
    print("✅ refetchRenhar added to RawSchedule props!")
else:
    print("❌ RawSchedule function not found")

# Fix 5: Panggil refetchRenhar setelah syncRenharKomp dan syncRenharDel
old_sync = """  const syncRenharKomp=async(rawId,date,wp,newKomp)=>{
    setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKomp}:r));
    // Update ke Supabase
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await updateRenhar(existing.id,{komponen:newKomp});
    }
  };"""

new_sync = """  const syncRenharKomp=async(rawId,date,wp,newKomp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await updateRenhar(existing.id,{komponen:newKomp});
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.map(r=>((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)?{...r,komponen:newKomp}:r));
    }
  };"""

if old_sync in content:
    content = content.replace(old_sync, new_sync)
    print("✅ syncRenharKomp uses refetch!")
else:
    print("❌ syncRenharKomp not found")

old_del = """  const syncRenharDel=async(rawId,date,wp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
    // Hapus dari Supabase
    if(existing){
      await removeRenhar(existing.id);
    }
  };"""

new_del = """  const syncRenharDel=async(rawId,date,wp)=>{
    const existing=renhar.find(r=>(r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date);
    if(existing){
      await removeRenhar(existing.id);
      if(refetchRenhar) await refetchRenhar();
    } else {
      setRenhar(prev=>prev.filter(r=>!((r.raw_id||r.rawId)===rawId&&r.wp===wp&&r.tanggal===date)));
    }
  };"""

if old_del in content:
    content = content.replace(old_del, new_del)
    print("✅ syncRenharDel uses refetch!")
else:
    print("❌ syncRenharDel not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
