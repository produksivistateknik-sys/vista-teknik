from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# 1. Hapus showNotif dari posisi yang baru (sebelum useEffect)
old = """  const [showNotif,setShowNotif]=useState(false);

  // Tutup notif saat klik di luar
  useEffect(()=>{"""
new = """  // Tutup notif saat klik di luar
  useEffect(()=>{"""

if old in content:
    content = content.replace(old, new)
    print("✅ showNotif removed from wrong position")
else:
    print("❌ Not found")

# 2. Tambah showNotif di awal App bersama state lainnya
old_states = """  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);"""

new_states = """  const [user,setUser]=useState(null);
  const [tab,setTab]=useState("dashboard");
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [showNotif,setShowNotif]=useState(false);"""

if old_states in content:
    content = content.replace(old_states, new_states)
    print("✅ showNotif added to correct position")
else:
    print("❌ States anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
