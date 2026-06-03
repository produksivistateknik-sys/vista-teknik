from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

old = """      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){setMesinList((prev:any[])=>prev.map(m=>m.id===editId?data:m));setEditId(null);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}
    } else {
      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){setMesinList((prev:any[])=>[...prev,data]);setForm({kode:"",nama:"",lokasi:"",status:"aktif"});}
    }"""

new = """      const{data,error}=await supabase.from("mesin").update({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).eq("id",editId).select().single();
      if(!error){
        setMesinList((prev:any[])=>prev.map(m=>m.id===editId?data:m));
        setEditId(null);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"EDIT MESIN",description:"Edit mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    } else {
      const{data,error}=await supabase.from("mesin").insert({kode:form.kode,nama:form.nama,lokasi:form.lokasi,status:form.status}).select().single();
      if(!error){
        setMesinList((prev:any[])=>[...prev,data]);
        setForm({kode:"",nama:"",lokasi:"",status:"aktif"});
        const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
        await activityLogService.insert({user_name:user?.name||user?.nama||sess?.nama||"Admin",action:"TAMBAH MESIN",description:"Tambah mesin: "+form.kode+" - "+form.nama,module:"maintenance",halaman:"System"});
      }
    }"""

if old in content:
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Master Mesin Insert/Update activity log added!")
else:
    print("❌ Not found!")
