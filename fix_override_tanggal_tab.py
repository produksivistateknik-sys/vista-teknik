file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_tab", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Ubah switcher - hilangkan Kapasitas Harian dari tampilan, tambah Override Tanggal
OLD_SWITCHER = """        {[{id:"kapasitas",l:"\u23f1 Kapasitas Harian"},{id:"processtime",l:"\u26a1 Process Time"}].map(t=>("""
NEW_SWITCHER = """        {[{id:"processtime",l:"\u26a1 Process Time"},{id:"override",l:"\U0001f4c5 Override Tanggal"}].map(t=>("""

# Fix 2: Tambah state untuk override tanggal, setelah state procForm
OLD_STATE = '  const [procForm,setProcForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});'
NEW_STATE = '''  const [procForm,setProcForm]=useState({kode_komponen:"",nama_komponen:"",tipe_panel:"FS",wp:"WP1",jenis_pekerjaan:"POTONG",menit_per_pcs:0});
  const [overrideList,setOverrideList]=useState<any[]>([]);
  const [editOverride,setEditOverride]=useState<any>(null);
  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});'''

# Fix 3: Tambah fetchOverride dipanggil di useEffect awal (dekat fetchAll)
OLD_FETCHALL_CALL = """  useEffect(()=>{
    fetchAll();
  },[]);"""
NEW_FETCHALL_CALL = """  useEffect(()=>{
    fetchAll();
    fetchOverride();
  },[]);

  const fetchOverride=async()=>{
    const{data}=await supabase.from("fcs_kapasitas_override").select("*").order("tanggal",{ascending:false});
    setOverrideList(data??[]);
  };

  const saveOverride=async()=>{
    if(!overrideForm.tanggal||!overrideForm.jam_kerja)return;
    if(editOverride){
      const{error}=await supabase.from("fcs_kapasitas_override").update({
        jam_kerja:Number(overrideForm.jam_kerja),
        efektivitas_pct:Number(overrideForm.efektivitas_pct),
        keterangan:overrideForm.keterangan,
      }).eq("id",editOverride.id);
      if(!error){await fetchOverride();setEditOverride(null);setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});}
      else alert("Gagal simpan: "+error.message);
    } else {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const{error}=await supabase.from("fcs_kapasitas_override").insert({
        tanggal:overrideForm.tanggal,
        jenis_pekerjaan:overrideForm.jenis_pekerjaan,
        jam_kerja:Number(overrideForm.jam_kerja),
        efektivitas_pct:Number(overrideForm.efektivitas_pct),
        keterangan:overrideForm.keterangan,
        created_by:sess?.nama||sess?.name||"Admin",
      });
      if(!error){await fetchOverride();setOverrideForm({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});}
      else alert("Gagal simpan: "+(error.message.includes("duplicate")?"Tanggal + pekerjaan ini sudah ada overridenya":error.message));
    }
  };

  const deleteOverride=async(id:number)=>{
    await supabase.from("fcs_kapasitas_override").delete().eq("id",id);
    setOverrideList(prev=>prev.filter((o:any)=>o.id!==id));
  };"""

ok1 = OLD_SWITCHER in content
ok2 = OLD_STATE in content
ok3 = OLD_FETCHALL_CALL in content

print(f"  SWITCHER: {'FOUND' if ok1 else 'MISSING'}")
print(f"  STATE:    {'FOUND' if ok2 else 'MISSING'}")
print(f"  FETCHALL: {'FOUND' if ok3 else 'MISSING'}")

if ok1 and ok2 and ok3:
    content = content.replace(OLD_SWITCHER, NEW_SWITCHER)
    content = content.replace(OLD_STATE, NEW_STATE)
    content = content.replace(OLD_FETCHALL_CALL, NEW_FETCHALL_CALL)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Step 1 selesai: switcher, state, fetch/save/delete function ditambah")
    print("[INFO] Lanjut step 2 untuk tambah render UI tab Override")
