from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

count = 0

# ── 1. Maintenance Rutin - Mark Done ──
old = """const{data}=await supabase.from("maintenance_rutin").update({terakhir_dilakukan:today,jatuh_tempo:jt}).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));await supabase.from("maintenance_rutin_log").insert({rutin_id:item.id,dilakukan_pada:today,teknisi:item.teknisi,catatan:"Selesai"});}"""
new = """const{data}=await supabase.from("maintenance_rutin").update({terakhir_dilakukan:today,jatuh_tempo:jt}).eq("id",item.id).select("*,mesin(nama,kode)").single();
    if(data){
      setRutinList((p:any[])=>p.map((r:any)=>r.id===item.id?data:r));
      await supabase.from("maintenance_rutin_log").insert({rutin_id:item.id,dilakukan_pada:today,teknisi:item.teknisi,catatan:"Selesai"});
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"MAINTENANCE RUTIN DONE",description:"Selesai: "+item.jenis_maintenance+" - "+item.mesin?.nama+" ("+today+")",module:"maintenance",halaman:"Maintenance"});
    }"""
if old in content:
    content = content.replace(old, new)
    count += 1
    print("✅ Maintenance Rutin Done")
else:
    print("⚠️  Maintenance Rutin Done not found")

# ── 2. Maintenance Rutin - Nonaktifkan ──
old2 = """const del=async()=>{await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));setDelId(null);};"""
new2 = """const del=async()=>{
  const item=rutinList.find((r:any)=>r.id===delId);
  await supabase.from("maintenance_rutin").update({is_active:false}).eq("id",delId);
  setRutinList((p:any[])=>p.filter((r:any)=>r.id!==delId));
  setDelId(null);
  const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
  await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"NONAKTIF MAINTENANCE RUTIN",description:"Nonaktifkan jadwal: "+(item?.jenis_maintenance||"-")+" - "+(item?.mesin?.nama||"-"),module:"maintenance",halaman:"Maintenance"});
};"""
if old2 in content:
    content = content.replace(old2, new2)
    count += 1
    print("✅ Maintenance Rutin Nonaktif")
else:
    print("⚠️  Maintenance Rutin Nonaktif not found")

# ── 3. Maintenance Log - Insert ──
old3 = """if(!error){
        setMaintenanceList((p:any[])=>[data,...p]);
        await activityLogService.insert({user_name:getUname(),action:"TAMBAH MAINTENANCE",description:"Tambah log maintenance "+data.mesin?.nama,module:"maintenance",halaman:"Maintenance"});
        setShowForm(false);
      }"""
# Sudah ada, skip
print("⚠️  Maintenance Log Insert sudah ada activity log")

# ── 4. Maintenance Log - Update status (kanban) ──
old4 = """const updateStatus=async(id:any,status:string)=>{await supabase.from("maintenance_log").update({status}).eq("id",id);setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));};"""
new4 = """const updateStatus=async(id:any,status:string)=>{
  await supabase.from("maintenance_log").update({status}).eq("id",id);
  setMaintenanceList((p:any[])=>p.map((m:any)=>m.id===id?{...m,status}:m));
  const item=maintenanceList.find((m:any)=>m.id===id);
  await activityLogService.insert({user_name:getUname(),action:"UPDATE STATUS MAINTENANCE",description:"Update status: "+(item?.mesin?.nama||"-")+" -> "+status,module:"maintenance",halaman:"Maintenance"});
};"""
if old4 in content:
    content = content.replace(old4, new4)
    count += 1
    print("✅ Maintenance Log Update Status")
else:
    print("⚠️  Maintenance Log Update Status not found")

# ── 5. Maintenance Log - Delete ──
old5 = """const del=async()=>{await supabase.from("maintenance_log").delete().eq("id",delId);setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));setDelId(null);};"""
new5 = """const del=async()=>{
  const item=maintenanceList.find((m:any)=>m.id===delId);
  await supabase.from("maintenance_log").delete().eq("id",delId);
  setMaintenanceList((p:any[])=>p.filter((m:any)=>m.id!==delId));
  setDelId(null);
  await activityLogService.insert({user_name:getUname(),action:"HAPUS LOG MAINTENANCE",description:"Hapus log: "+(item?.mesin?.nama||"-")+" - "+(item?.kendala||"-").slice(0,50),module:"maintenance",halaman:"Maintenance"});
};"""
if old5 in content:
    content = content.replace(old5, new5)
    count += 1
    print("✅ Maintenance Log Delete")
else:
    print("⚠️  Maintenance Log Delete not found")

# ── 6. Admins - Reset Password ──
old6 = """  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("admins").update({ password: newPwd }).eq("id", resetId);
    if (!error) { setResetId(null); setNewPwd(""); }
  };"""
new6 = """  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("admins").update({ password: newPwd }).eq("id", resetId);
    if (!error) {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      const target=admins.find((a:any)=>a.id===resetId);
      await activityLogService.insert({user_name:uname,action:"RESET PASSWORD ADMIN",description:"Reset password admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
      setResetId(null); setNewPwd("");
    }
  };"""
if old6 in content:
    content = content.replace(old6, new6)
    count += 1
    print("✅ Admin Reset Password")
else:
    print("⚠️  Admin Reset Password not found")

# ── 7. Admins - Toggle Active ──
old7 = """  const toggleActive = async (id, val) => {
    await supabase.from("admins").update({ is_active: val }).eq("id", id);
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
  };"""
new7 = """  const toggleActive = async (id, val) => {
    await supabase.from("admins").update({ is_active: val }).eq("id", id);
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const target=admins.find((a:any)=>a.id===id);
    await activityLogService.insert({user_name:uname,action:val?"AKTIFKAN ADMIN":"NONAKTIFKAN ADMIN",description:(val?"Aktifkan":"Nonaktifkan")+" admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
  };"""
if old7 in content:
    content = content.replace(old7, new7)
    count += 1
    print("✅ Admin Toggle Active")
else:
    print("⚠️  Admin Toggle Active not found")

# ── 8. Admins - Delete ──
old8 = """  const del = async () => {
    await supabase.from("admins").delete().eq("id", delId);
    setAdmins(prev => prev.filter(a => a.id !== delId));
    setDelId(null);
  };"""
new8 = """  const del = async () => {
    const target=admins.find((a:any)=>a.id===delId);
    await supabase.from("admins").delete().eq("id", delId);
    setAdmins(prev => prev.filter(a => a.id !== delId));
    setDelId(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS ADMIN",description:"Hapus admin: "+(target?.nama||"-")+" ("+target?.username+")",module:"auth",halaman:"System"});
  };"""
if old8 in content:
    content = content.replace(old8, new8)
    count += 1
    print("✅ Admin Delete")
else:
    print("⚠️  Admin Delete not found")

# ── 9. Operator Users - Reset Password ──
old9 = """  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("operator_users").update({ password: newPwd }).eq("id", resetId);
    if (!error) { setResetId(null); setNewPwd(""); }
  };"""
new9 = """  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("operator_users").update({ password: newPwd }).eq("id", resetId);
    if (!error) {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      const target=ops.find((o:any)=>o.id===resetId);
      await activityLogService.insert({user_name:uname,action:"RESET PASSWORD PEKERJA",description:"Reset password pekerja: "+(target?.nama||"-"),module:"pekerja",halaman:"System"});
      setResetId(null); setNewPwd("");
    }
  };"""
if old9 in content:
    content = content.replace(old9, new9)
    count += 1
    print("✅ Operator Users Reset Password")
else:
    print("⚠️  Operator Users Reset Password not found")

# ── 10. Operator Users - Toggle Active ──
old10 = """  const toggleActive = async (id: any, val: boolean) => {
    await supabase.from("operator_users").update({ is_active: val }).eq("id", id);
    setOps(p => p.map((o: any) => o.id === id ? { ...o, is_active: val } : o));
  };"""
new10 = """  const toggleActive = async (id: any, val: boolean) => {
    await supabase.from("operator_users").update({ is_active: val }).eq("id", id);
    setOps(p => p.map((o: any) => o.id === id ? { ...o, is_active: val } : o));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const target=ops.find((o:any)=>o.id===id);
    await activityLogService.insert({user_name:uname,action:val?"AKTIFKAN PEKERJA":"NONAKTIFKAN PEKERJA",description:(val?"Aktifkan":"Nonaktifkan")+" user pekerja: "+(target?.nama||"-"),module:"pekerja",halaman:"System"});
  };"""
if old10 in content:
    content = content.replace(old10, new10)
    count += 1
    print("✅ Operator Users Toggle Active")
else:
    print("⚠️  Operator Users Toggle Active not found")

# ── 11. Operator Users - Delete ──
old11 = """  const del = async () => {
    await supabase.from("operator_users").delete().eq("id", delId);
    setOps(p => p.filter((o: any) => o.id !== delId));
    setDelId(null);
  };"""
new11 = """  const del = async () => {
    const target=ops.find((o:any)=>o.id===delId);
    await supabase.from("operator_users").delete().eq("id", delId);
    setOps(p => p.filter((o: any) => o.id !== delId));
    setDelId(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS USER PEKERJA",description:"Hapus user pekerja: "+(target?.nama||"-")+" ("+target?.username+")",module:"pekerja",halaman:"System"});
  };"""
if old11 in content:
    content = content.replace(old11, new11)
    count += 1
    print("✅ Operator Users Delete")
else:
    print("⚠️  Operator Users Delete not found")

# ── 12. Master Mesin - Insert ──
old12 = """      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){setMesinList(prev=>[...prev,data]);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}"""
new12 = """      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){
        setMesinList(prev=>[...prev,data]);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"TAMBAH MESIN",description:"Tambah mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }"""
if old12 in content:
    content = content.replace(old12, new12)
    count += 1
    print("✅ Master Mesin Insert")
else:
    print("⚠️  Master Mesin Insert not found")

# ── 13. Master Mesin - Update ──
old13 = """      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){setMesinList(prev=>prev.map(m=>m.id===editId?data:m));setEditId(null);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}"""
new13 = """      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){
        setMesinList(prev=>prev.map(m=>m.id===editId?data:m));
        setEditId(null);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"EDIT MESIN",description:"Edit mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }"""
if old13 in content:
    content = content.replace(old13, new13)
    count += 1
    print("✅ Master Mesin Update")
else:
    print("⚠️  Master Mesin Update not found")

# ── 14. Recycle Bin - Restore ──
old14 = """  const restore=async(item:any)=>{
    await supabase.from(item._cat).update({deleted_at:null,deleted_by:null}).eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
  };"""
new14 = """  const restore=async(item:any)=>{
    await supabase.from(item._cat).update({deleted_at:null,deleted_by:null}).eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"RESTORE DATA",description:"Restore "+item._cat+": "+getTitle(item),module:"general",halaman:"Recycle Bin"});
  };"""
if old14 in content:
    content = content.replace(old14, new14)
    count += 1
    print("✅ Recycle Bin Restore")
else:
    print("⚠️  Recycle Bin Restore not found")

# ── 15. Recycle Bin - Permanent Delete ──
old15 = """  const permDel=async(item:any)=>{
    await supabase.from(item._cat).delete().eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
  };"""
new15 = """  const permDel=async(item:any)=>{
    await supabase.from(item._cat).delete().eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS PERMANEN",description:"Hapus permanen "+item._cat+": "+getTitle(item),module:"general",halaman:"Recycle Bin"});
  };"""
if old15 in content:
    content = content.replace(old15, new15)
    count += 1
    print("✅ Recycle Bin Permanent Delete")
else:
    print("⚠️  Recycle Bin Permanent Delete not found")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Task 2 Selesai! {count}/14 fix diterapkan.")
