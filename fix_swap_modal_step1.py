file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_swap_step1", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Fix 1: Update import
OLD_IMPORT = "import { generateFCSSchedule, syncFCSToRawSchedule } from './services/fcsService'"
NEW_IMPORT = "import { generateFCSSchedule, syncFCSToRawSchedule, checkKapasitasDanKomponenSwap, executeSwapKomponen } from './services/fcsService'"

ok1 = OLD_IMPORT in content
print(f"  IMPORT: {'FOUND' if ok1 else 'MISSING'}")

# Fix 2: marker unik - hanya ada di RawSchedule (expandedTasks+assignModal+selPekerja berurutan)
OLD_MARKER = '''  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);'''

count_marker = content.count(OLD_MARKER)
print(f"  MARKER occurrences: {count_marker}")

NEW_MARKER = '''  const [expandedTasks,setExpandedTasks]=useState({});
  const [assignModal,setAssignModal]=useState(null);
  const [selPekerja,setSelPekerja]=useState([]);
  const [fcsCapData,setFcsCapData]=useState<any[]>([]);
  const [fcsKapasitas,setFcsKapasitas]=useState<any[]>([]);
  const [swapModal,setSwapModal]=useState<any>(null);
  const [swapSelected,setSwapSelected]=useState<number[]>([]);
  const [swapLoading,setSwapLoading]=useState(false);'''

if ok1 and count_marker==1:
    content = content.replace(OLD_IMPORT, NEW_IMPORT)
    content = content.replace(OLD_MARKER, NEW_MARKER, 1)
    with open(file_path, "w", encoding="utf-8", errors="replace") as f:
        f.write(content)
    print("[OK] Import diupdate + state swapModal berhasil ditambah HANYA di RawSchedule")
    print("[INFO] Lanjut step 2 untuk logic cek kapasitas saat addEntry dipanggil")
else:
    print(f"[FAIL] Validasi gagal (IMPORT={ok1}, MARKER_COUNT={count_marker}), TIDAK menyimpan apapun")
