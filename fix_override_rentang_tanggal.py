file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_rentang", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state untuk mode rentang
OLD_STATE = '  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});'
NEW_STATE = '''  const [overrideForm,setOverrideForm]=useState({tanggal:new Date().toISOString().slice(0,10),jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});
  const [overrideMode,setOverrideMode]=useState<"single"|"rentang">("single");
  const [rentangForm,setRentangForm]=useState({tanggalMulai:new Date().toISOString().slice(0,10),tanggalAkhir:new Date().toISOString().slice(0,10),hariAktif:[1,2,3,4,5] as number[],jenis_pekerjaan:"POTONG",jam_kerja:8,efektivitas_pct:80,keterangan:""});
  const [rentangSaving,setRentangSaving]=useState(false);
  const [rentangResult,setRentangResult]=useState<{sukses:number;skip:number}|null>(null);

  const HARI_LABEL_OV:any={1:"Sen",2:"Sel",3:"Rab",4:"Kam",5:"Jum",6:"Sab",7:"Min"};

  const toggleHariRentang=(h:number)=>{
    setRentangForm(prev=>({...prev,hariAktif:prev.hariAktif.includes(h)?prev.hariAktif.filter(x=>x!==h):[...prev.hariAktif,h].sort()}));
  };

  const saveRentangOverride=async()=>{
    if(!rentangForm.tanggalMulai||!rentangForm.tanggalAkhir||rentangForm.hariAktif.length===0)return;
    if(rentangForm.tanggalAkhir<rentangForm.tanggalMulai){alert("Tanggal akhir harus setelah tanggal mulai");return;}
    setRentangSaving(true);
    setRentangResult(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const createdBy=sess?.nama||sess?.name||"Admin";
    const rows:any[]=[];
    let cur=new Date(rentangForm.tanggalMulai);
    const end=new Date(rentangForm.tanggalAkhir);
    let safety=0;
    while(cur<=end&&safety<366){
      const hari=cur.getDay()===0?7:cur.getDay();
      if(rentangForm.hariAktif.includes(hari)){
        rows.push({
          tanggal:cur.toISOString().slice(0,10),
          jenis_pekerjaan:rentangForm.jenis_pekerjaan,
          jam_kerja:Number(rentangForm.jam_kerja),
          efektivitas_pct:Number(rentangForm.efektivitas_pct),
          keterangan:rentangForm.keterangan,
          created_by:createdBy,
        });
      }
      cur.setDate(cur.getDate()+1);
      safety++;
    }
    if(rows.length===0){setRentangSaving(false);alert("Tidak ada tanggal yang match dengan hari terpilih");return;}
    const{data,error}=await supabase.from("fcs_kapasitas_override").upsert(rows,{onConflict:"tanggal,jenis_pekerjaan",ignoreDuplicates:false}).select();
    setRentangSaving(false);
    if(error){alert("Gagal: "+error.message);return;}
    setRentangResult({sukses:data?.length||0,skip:rows.length-(data?.length||0)});
    await fetchOverride();
  };'''

ok1 = OLD_STATE in content
print(f"  STATE: {'FOUND' if ok1 else 'MISSING'}")

if ok1:
    content = content.replace(OLD_STATE, NEW_STATE)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] State dan logic rentang tanggal berhasil ditambah")
    print("[INFO] Lanjut step 2 untuk UI toggle dan form rentang")
