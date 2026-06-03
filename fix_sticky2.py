from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Revert background inherit ke solid color untuk td body sticky
fixes = [
    # td PROYEK
    (
        'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap",background:"inherit"}}',
        'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}'
    ),
    # td PANEL
    (
        'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260,background:"inherit"}}',
        'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}'
    ),
    # td PROSES - revert ke tanpa background inherit
    (
        'position:"sticky",left:380,zIndex:2,textAlign:"center",background:"inherit"}}',
        'position:"sticky",left:380,zIndex:2,textAlign:"center"}}'
    ),
]

# Fix utama: td sticky harus pakai background dari rBg (bukan transparan)
# Ganti background pada td sticky rows agar solid
# Cari pola td sticky di tbody dan pastikan background explicit

count = 0
for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Reverted: {old[:70]}...")
    else:
        print(f"⚠️  Not found: {old[:70]}...")

# Fix sticky td - tambahkan background solid berdasarkan rBg
# Masalah asli: kolom tanggal tidak sticky tapi terlihat di atas kolom sticky
# Solusi: pastikan kolom sticky punya background solid sesuai row

old_proyek = 'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap"}}'
new_proyek = 'position:"sticky",left:0,zIndex:2,fontWeight:600,fontSize:11,color:"#475569",whiteSpace:"nowrap",background:rBg}}'

old_panel = 'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260}}'
new_panel = 'position:"sticky",left:120,zIndex:2,fontWeight:600,fontSize:11,color:"#1e293b",whiteSpace:"nowrap",minWidth:260,background:rBg}}'

old_proses = 'position:"sticky",left:380,zIndex:2,textAlign:"center"}}'
new_proses = 'position:"sticky",left:380,zIndex:2,textAlign:"center",background:rBg}}'

old_prioritas = 'position:"sticky",left:370,zIndex:2,textAlign:"center"}}'
new_prioritas = 'position:"sticky",left:490,zIndex:2,textAlign:"center",background:rBg}}'

for old, new in [(old_proyek,new_proyek),(old_panel,new_panel),(old_proses,new_proses),(old_prioritas,new_prioritas)]:
    if old in content:
        content = content.replace(old, new)
        count += 1
        print(f"✅ Fixed bg: {old[:70]}...")
    else:
        print(f"⚠️  Not found: {old[:70]}...")

APP_PATH.write_text(content, encoding="utf-8")
print(f"\n✅ Selesai! {count} fix diterapkan.")
