from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Tambah realtime untuk komponen_stok di KomponenStokTab ──
old_fetch = """  useEffect(()=>{fetchAll();},[]);

  const fetchAll=async()=>{"""

new_fetch = """  useEffect(()=>{
    fetchAll();
    // Realtime listener untuk komponen_stok
    const ch=supabase.channel("realtime-komponen-stok")
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.map(s=>s.id===payload.new.id?{...s,...payload.new}:s));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.some(s=>s.id===payload.new.id)?prev:[...prev,payload.new]);})
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"komponen_stok"},
        (payload)=>{setStokList(prev=>prev.filter(s=>s.id!==payload.old.id));})
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"komponen_stok_masuk"},
        (payload)=>{setMasukList(prev=>prev.some(m=>m.id===payload.new.id)?prev:[payload.new,...prev]);})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const fetchAll=async()=>{"""

if old_fetch in content:
    content = content.replace(old_fetch, new_fetch)
    print("✅ Realtime added to KomponenStokTab")
else:
    print("❌ KomponenStokTab useEffect not found")

# ── 2. Tambah realtime untuk maintenance_log di SystemTab ──
old_system_effect = """  useEffect(()=>{
    const fetchAll=async()=>{
      setLoading(true);
      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([
        supabase.from("admins").select("*").order("created_at",{ascending:true}),
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
      ]);
      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);   
      setLoading(false);
    };
    fetchAll();
  },[]);"""

new_system_effect = """  useEffect(()=>{
    const fetchAll=async()=>{
      setLoading(true);
      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([
        supabase.from("admins").select("*").order("created_at",{ascending:true}),
        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),
        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),
      ]);
      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);
      setLoading(false);
    };
    fetchAll();
    // Realtime listener untuk maintenance_log
    const ch=supabase.channel("realtime-maintenance-log")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.some(m=>m.id===data.id)?prev:[data,...prev]);
        })
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"maintenance_log"},
        async(payload)=>{
          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();
          if(data) setMaintenanceList(prev=>prev.map(m=>m.id===data.id?data:m));
        })
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"maintenance_log"},
        (payload)=>{setMaintenanceList(prev=>prev.filter(m=>m.id!==payload.old.id));})
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);"""

if old_system_effect in content:
    content = content.replace(old_system_effect, new_system_effect)
    print("✅ Realtime added to SystemTab maintenance_log")
else:
    print("❌ SystemTab useEffect not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
