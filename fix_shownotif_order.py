from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# 1. Hapus showNotif dari posisi lama (baris 5208)
old_notif_state = """  const [showNotif,setShowNotif]=useState(false);

  // Data notifikasi lengkap
  const notifItems=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)))"""

new_notif_state = """  // Data notifikasi lengkap
  const notifItems=woData.filter(w=>woOverall(w)<100&&(isDelayed(w.target)||isUrgent(w.target)))"""

if old_notif_state in content:
    content = content.replace(old_notif_state, new_notif_state)
    print("✅ showNotif removed from old position")
else:
    print("❌ old position not found")

# 2. Tambah showNotif SEBELUM useEffect yang memakainya
old_before_effect = """  // Tutup notif saat klik di luar
  useEffect(()=>{"""

new_before_effect = """  const [showNotif,setShowNotif]=useState(false);

  // Tutup notif saat klik di luar
  useEffect(()=>{"""

if old_before_effect in content:
    content = content.replace(old_before_effect, new_before_effect)
    print("✅ showNotif moved to correct position")
else:
    print("❌ useEffect anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
