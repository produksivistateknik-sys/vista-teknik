file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

with open(file_path + ".bak_rutin_save", "w", encoding="utf-8") as f:
    f.write(content)
print("[OK] Backup dibuat")

OLD_SAVE = """  const save=async()=>{
    if(!form.mesin_id||!form.jenis_maintenance.trim())return;
    const jt=calcNext(today,item.frekuensi);
    const{data}=await supabase.from("maintenance_rutin").update({terakhir_dilakukan:today,jatuh_tempo:jt}).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){
      setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));
      await supabase.from("maintenance_rutin_log").insert({rutin_id:item.id,dilakukan_pada:today,teknisi:item.teknisi,catatan:"Selesai"});
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"MAINTENANCE RUTIN DONE",description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+today+")",module:"maintenance",halaman:"Maintenance"});
    }
    setDoneId(null);
  };"""

NEW_SAVE = """  const save=async()=>{
    if(!form.mesin_id||!form.jenis_maintenance.trim())return;
    const uname=user?.name||user?.nama||JSON.parse(localStorage.getItem("vista_admin_session")||"{}")?.nama||"Admin";
    if(editId){
      const{data}=await supabase.from("maintenance_rutin").update({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
      }).eq("id",editId).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>p.map((r:any)=>r.id===editId?data:r));
        await activityLogService.insert({user_name:uname,action:"EDIT MAINTENANCE RUTIN",
          description:"Edit jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    } else {
      const{data}=await supabase.from("maintenance_rutin").insert({
        mesin_id:Number(form.mesin_id),jenis_maintenance:form.jenis_maintenance.trim(),
        frekuensi:form.frekuensi,teknisi:form.teknisi,
        terakhir_dilakukan:form.terakhir_dilakukan||null,
        jatuh_tempo:form.jatuh_tempo||null,catatan:form.catatan,
        aktif:true,
      }).select("*,mesin(nama,kode)").single();
      if(data){
        setRutinList((p:any[])=>[...p,data]);
        await activityLogService.insert({user_name:uname,action:"TAMBAH MAINTENANCE RUTIN",
          description:"Tambah jadwal: "+form.jenis_maintenance+" - "+data.mesin?.nama,
          module:"maintenance",halaman:"Maintenance"});
      }
    }
    setShowForm(false);setEditId(null);
    setForm({mesin_id:"",jenis_maintenance:"",frekuensi:"mingguan",teknisi:"",terakhir_dilakukan:"",jatuh_tempo:"",catatan:""});
  };"""

if OLD_SAVE in content:
    content = content.replace(OLD_SAVE, NEW_SAVE)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Fungsi save MaintenanceRutinTab diperbaiki")
    print("[INFO] Jalankan: npm run build")
else:
    print("[FAIL] Pattern tidak cocok")
    lines = content.split("\n")
    for i,l in enumerate(lines):
        if 'const save=async()=>{' in l and i > 4730 and i < 4760:
            print(f"\nBaris {i+1} s/d {i+12}:")
            for j in range(i, min(i+12, len(lines))):
                print(repr(lines[j]))
            break
