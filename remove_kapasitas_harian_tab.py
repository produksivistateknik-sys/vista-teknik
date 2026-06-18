file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

with open(file_path + ".bak_remove_kapasitas_harian", "w", encoding="utf-8", errors="replace") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

start_idx = None
end_idx = None
for i, l in enumerate(lines):
    if '{/* TAB: Kapasitas Harian */}' in l:
        start_idx = i
    if '{/* TAB: Process Time */}' in l and start_idx is not None and end_idx is None:
        end_idx = i
        break

print(f"  Start (komentar Kapasitas Harian): baris {start_idx+1 if start_idx is not None else 'NOT FOUND'}")
print(f"  End (komentar Process Time): baris {end_idx+1 if end_idx is not None else 'NOT FOUND'}")

if start_idx is not None and end_idx is not None:
    # Cek beberapa baris ke belakang untuk cari closing ')}'
    closing_idx = None
    for j in range(end_idx-1, max(start_idx, end_idx-4), -1):
        if lines[j].strip() == ')}':
            closing_idx = j
            break
    
    print(f"  Closing ')}}'  ditemukan di baris: {closing_idx+1 if closing_idx is not None else 'NOT FOUND'}")
    
    if closing_idx is not None:
        # Hapus dari start_idx sampai closing_idx (inclusive)
        removed = lines[start_idx:closing_idx+1]
        print(f"  Akan menghapus {len(removed)} baris (baris {start_idx+1} s/d {closing_idx+1})")
        del lines[start_idx:closing_idx+1]
        
        content = "".join(lines)
        OLD_DEFAULT = '  const [activeTab,setActiveTab]=useState("kapasitas");'
        NEW_DEFAULT = '  const [activeTab,setActiveTab]=useState("processtime");'
        if OLD_DEFAULT in content:
            content = content.replace(OLD_DEFAULT, NEW_DEFAULT)
            print("  [OK] Default activeTab diubah ke 'processtime'")
        else:
            print("  [WARN] Default activeTab pattern tidak ketemu, skip")
        
        with open(file_path, "w", encoding="utf-8", errors="replace") as f:
            f.write(content)
        print("[OK] Blok render Kapasitas Harian berhasil dihapus dengan aman")
        print("[INFO] Jalankan: npm run build")
    else:
        print("[FAIL] Closing ')}'  tidak ditemukan dalam range aman, TIDAK menghapus apapun")
else:
    print("[FAIL] Marker tidak ditemukan, TIDAK menghapus apapun")
