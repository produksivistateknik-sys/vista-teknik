file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_global_refresh", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Tambah refetch ke useWorkOrders
OLD1 = "const { data: woList, loading: woLoading, create: createWO, update: updateWO, remove: removeWO } = useWorkOrders()"
NEW1 = "const { data: woList, loading: woLoading, create: createWO, update: updateWO, remove: removeWO, refetch: refetchWO } = useWorkOrders()"

# Fix 2: Tambah refetch ke useKendala
OLD2 = "  const { data: kendalaLog, create: createKendala, remove: removeKendala } = useKendala()"
NEW2 = "  const { data: kendalaLog, create: createKendala, remove: removeKendala, refetch: refetchKendala } = useKendala()"

# Fix 3: Tambah refetch ke usePekerja
OLD3 = "const { data: pekerjaList, loading: pekerjaLoading, create: createPekerja, update: updatePekerja, remove: removePekerja } = usePekerja()"
NEW3 = "const { data: pekerjaList, loading: pekerjaLoading, create: createPekerja, update: updatePekerja, remove: removePekerja, refetch: refetchPekerja } = usePekerja()"

# Fix 4: Tambah state isRefreshing + function refreshAll, taruh dekat hooks lain
OLD4 = "  const { data: activityLog } = useActivityLog()"
NEW4 = """  const { data: activityLog, refetch: refetchActivityLog } = useActivityLog()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshAll = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        refetchWO?.(),
        refetchRaw?.(),
        refetchRenhar?.(),
        refetchKendala?.(),
        refetchPekerja?.(),
        refetchActivityLog?.(),
      ])
    } finally {
      setTimeout(() => setIsRefreshing(false), 400)
    }
  }"""

# Fix 5: Tambah tombol Refresh di topbar, sebelum dark mode toggle
OLD5 = """              <div className="erp-topbar-right">
                {/* Dark mode toggle */}"""
NEW5 = """              <div className="erp-topbar-right">
                {/* Refresh global */}
                <button onClick={refreshAll} disabled={isRefreshing}
                  title="Refresh semua data"
                  style={{width:26,height:26,border:"1px solid var(--border-color,#e5e8ed)",
                    borderRadius:5,background:"var(--bg-secondary,#f8f9fb)",
                    display:"flex",alignItems:"center",justifyContent:"center",
                    cursor:isRefreshing?"not-allowed":"pointer",color:"var(--text-secondary,#64748b)"}}>
                  <i className="ti ti-refresh" style={{fontSize:13,display:"inline-block",
                    animation:isRefreshing?"spin .6s linear infinite":"none"}}/>
                </button>

                {/* Dark mode toggle */}"""

ok1 = OLD1 in content
ok2 = OLD2 in content
ok3 = OLD3 in content
ok4 = OLD4 in content
ok5 = OLD5 in content

print(f"  WO_HOOK:    {'FOUND' if ok1 else 'MISSING'}")
print(f"  KENDALA:    {'FOUND' if ok2 else 'MISSING'}")
print(f"  PEKERJA:    {'FOUND' if ok3 else 'MISSING'}")
print(f"  ACTIVITY:   {'FOUND' if ok4 else 'MISSING'}")
print(f"  TOPBAR:     {'FOUND' if ok5 else 'MISSING'}")

if all([ok1,ok2,ok3,ok4,ok5]):
    content = content.replace(OLD1, NEW1)
    content = content.replace(OLD2, NEW2)
    content = content.replace(OLD3, NEW3)
    content = content.replace(OLD4, NEW4)
    content = content.replace(OLD5, NEW5)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Tombol Refresh global berhasil ditambah di topbar")
    print("[INFO] Jalankan: npm run build")
