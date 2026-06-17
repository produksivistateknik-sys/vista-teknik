file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_maint_badge", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah state + fetch maintenanceRutinAlert di level App, setelah useKendala
OLD_HOOK = "  const { data: kendalaLog, create: createKendala, remove: removeKendala } = useKendala()"
NEW_HOOK = """  const { data: kendalaLog, create: createKendala, remove: removeKendala } = useKendala()
  const [maintenanceOverdueCount, setMaintenanceOverdueCount] = useState(0)
  useEffect(() => {
    const fetchMaintAlert = async () => {
      const h3 = new Date(); h3.setDate(h3.getDate() + 3)
      const { data } = await supabase.from('maintenance_rutin').select('id,jatuh_tempo').eq('is_active', true).lte('jatuh_tempo', h3.toISOString().slice(0,10))
      setMaintenanceOverdueCount(data?.length || 0)
    }
    fetchMaintAlert()
    const ch = supabase.channel('realtime-maint-alert')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_rutin' }, fetchMaintAlert)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])"""

# Fix 2: Tambah badge di sidebar menu maintenance
OLD_MENU = '{id:"maintenance",label:"Maintenance",icon:"ti ti-tool"},'
NEW_MENU = '{id:"maintenance",label:"Maintenance",icon:"ti ti-tool",badge:maintenanceOverdueCount>0?maintenanceOverdueCount:null},'

ok1 = OLD_HOOK in content
ok2 = OLD_MENU in content

print(f"  HOOK: {'FOUND' if ok1 else 'MISSING'}")
print(f"  MENU: {'FOUND' if ok2 else 'MISSING'}")

if ok1 and ok2:
    content = content.replace(OLD_HOOK, NEW_HOOK)
    content = content.replace(OLD_MENU, NEW_MENU)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Badge maintenance overdue (H-3 s/d jatuh tempo) berhasil ditambah")
    print("[INFO] Jalankan: npm run build")
