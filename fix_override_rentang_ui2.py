file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

with open(file_path + ".bak_override_rentang_ui2", "w", encoding="utf-8", errors="replace") as f:
    f.write(content)
print("[OK] Backup dibuat")

# Pakai marker yang lebih unik & simpel: cari berdasarkan baris persis sebelum form (tanpa emoji)
OLD_MARKER = '          <div style={{background:"#f0f8ff",borderRadius:10,border:"1.5px solid #bfdbfe",padding:"14px 16px",marginBottom:16}}>\n            <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:12}}>{editOverride?'

count = content.count(OLD_MARKER)
print(f"  MARKER occurrences: {count}")

if count == 1:
    idx = content.find(OLD_MARKER)
    print(f"  Marker found at char index: {idx}")
    print("  Sample context:")
    print(repr(content[idx:idx+200]))
else:
    print("[INFO] Marker tidak unik atau tidak ketemu, perlu approach lain")
