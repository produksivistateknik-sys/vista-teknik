file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_swap_step2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Marker unik dengan tambahan state swap dari step 1 sebelumnya
OLD_FETCHEFFECT = '''  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<number[]>([]);
  const [swapLoading,setSwapLoading]=useState(false);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit"),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);'''

count_marker = content.count(OLD_FETCHEFFECT)
print(f"  MARKER occurrences: {count_marker}")

NEW_FETCHEFFECT = '''  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<number[]>([]);
  const [swapLoading,setSwapLoading]=useState(false);
  const [processTimeList,setProcessTimeList]=useState<any[]>([]);

  useEffect(()=>{
    const fetchCap=async()=>{
      const [{data:s},{data:k},{data:pt}]=await Promise.all([
        supabase.from("fcs_schedule").select("tanggal,jenis_pekerjaan,total_menit").neq("status","cancelled"),
        supabase.from("fcs_kapasitas_override").select("tanggal,jenis_pekerjaan,kapasitas_menit"),
        supabase.from("fcs_process_time").select("tipe_panel,jenis_pekerjaan,kode_komponen,menit_per_pcs").eq("is_active",true),
      ]);
      setFcsCapData(s??[]);
      setFcsKapasitas(k??[]);
      setProcessTimeList(pt??[]);
    };
    fetchCap();
    const ch=supabase.channel("realtime-fcs-cap-raw")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_schedule"},fetchCap)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_kapasitas_override"},fetchCap)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const getMenitPerPcs=(tipePanel:string,proses:string,kode:string):number=>{
    const pt=processTimeList.find((p:any)=>p.tipe_panel===tipePanel&&p.jenis_pekerjaan===proses&&p.kode_komponen===kode);
    return pt?Number(pt.menit_per_pcs):0;
  };'''

if count_marker==1:
    content = content.replace(OLD_FETCHEFFECT, NEW_FETCHEFFECT, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Fetch process_time + helper getMenitPerPcs berhasil ditambah")
    print("[INFO] Lanjut step 3 untuk sisip validasi di addEntry")
else:
    print(f"[FAIL] MARKER occurrences = {count_marker}, bukan 1. TIDAK menyimpan apapun")
