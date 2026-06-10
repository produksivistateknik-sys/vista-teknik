file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_markdone", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Tambah fungsi markDone setelah fungsi del
OLD_DEL = """  const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};"""

NEW_DEL = """  const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};

  const markDone=async(item:any)=>{
    const todayStr=new Date().toISOString().slice(0,10);
    const nextDate=calcNext(todayStr,item.frekuensi);
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    const{data}=await supabase.from("maintenance_rutin").update({
      terakhir_dilakukan:todayStr,
      jatuh_tempo:nextDate,
    }).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){
      setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));
      await activityLogService.insert({
        user_name:uname,
        action:"MAINTENANCE RUTIN DONE",
        description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+todayStr+"). Jadwal berikutnya: "+nextDate,
        module:"maintenance",halaman:"Maintenance"
      });
    }
    setDoneId(null);
  };"""

if OLD_DEL in content:
    content = content.replace(OLD_DEL, NEW_DEL)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Fungsi markDone ditambah dengan auto-hitung jadwal berikutnya")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Pattern tidak cocok")
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if "const del=async()=>{" in l and i > 4750:
            print(f"Baris {i+1}: {repr(l)}")
            for j in range(i, min(i+10, len(lines))):
                print(repr(lines[j]))
            break
