from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = '  useEffect(()=>{\n    const fetchAll=async()=>{\n      setLoading(true);\n      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([\n        supabase.from("admins").select("*").order("created_at",{ascending:true}),\n        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),\n        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),\n      ]);\n      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);\n      setLoading(false);\n    };\n    fetchAll();\n  },[]);'

new = '  useEffect(()=>{\n    const fetchAll=async()=>{\n      setLoading(true);\n      const [{data:ad},{data:ms},{data:ml}]=await Promise.all([\n        supabase.from("admins").select("*").order("created_at",{ascending:true}),\n        supabase.from("mesin").select("*").is("deleted_at",null).order("kode",{ascending:true}),\n        supabase.from("maintenance_log").select("*,mesin(nama,kode)").order("created_at",{ascending:false}),\n      ]);\n      setAdmins(ad??[]);setMesinList(ms??[]);setMaintenanceList(ml??[]);\n      setLoading(false);\n    };\n    fetchAll();\n    const ch=supabase.channel("realtime-maintenance-log")\n      .on("postgres_changes",{event:"INSERT",schema:"public",table:"maintenance_log"},\n        async(payload)=>{\n          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();\n          if(data) setMaintenanceList(prev=>prev.some(m=>m.id===data.id)?prev:[data,...prev]);\n        })\n      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"maintenance_log"},\n        async(payload)=>{\n          const{data}=await supabase.from("maintenance_log").select("*,mesin(nama,kode)").eq("id",payload.new.id).single();\n          if(data) setMaintenanceList(prev=>prev.map(m=>m.id===data.id?data:m));\n        })\n      .on("postgres_changes",{event:"DELETE",schema:"public",table:"maintenance_log"},\n        (payload)=>{setMaintenanceList(prev=>prev.filter(m=>m.id!==payload.old.id));})\n      .subscribe();\n    return()=>{supabase.removeChannel(ch);};\n  },[]);'

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Realtime maintenance_log added!")
else:
    print("❌ Not found!")
