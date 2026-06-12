file_path = r"C:\Users\User\vista-teknik\src\App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(file_path + ".bak_fcs_pos", "w", encoding="utf-8") as f:
    f.writelines(lines)
print("[OK] Backup dibuat")

# Cari modal start dan end
modal_start = None
modal_end = None
for i, l in enumerate(lines):
    if '{fcsModal&&(' in l and modal_start is None and i > 4530:
        modal_start = i
    if modal_start and i > modal_start:
        if '      )}\n' == l and i > modal_start + 50:
            modal_end = i
            break

print(f"  Modal: baris {modal_start+1} s/d {modal_end+1}")

# Ekstrak modal lines
modal_lines = lines[modal_start:modal_end+1]

# Hapus modal dari posisi lama
del lines[modal_start:modal_end+1]

# Sekarang cari baris '    </div>\n' + '  );\n' pattern di sekitar baris 4534-4536
# Setelah delete, baris 4535 jadi index 4534
# Cari pattern closing ManajemenWO: '    </div>' lalu '  );' lalu '}'
insert_idx = None
for i in range(4520, min(4545, len(lines))):
    if lines[i].rstrip() == '    </div>' and lines[i+1].rstrip() == '  );':
        insert_idx = i  # Insert sebelum </div>
        break

print(f"  Insert position: baris {insert_idx+1 if insert_idx else 'NOT FOUND'}")

if insert_idx:
    # Insert modal sebelum </div>
    for j, ml in enumerate(modal_lines):
        lines.insert(insert_idx + j, ml)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.writelines(lines)
    print("[OK] Modal FCS berhasil dipindah ke dalam return()")
    print("[INFO] Jalankan: npm run build")
else:
    # Debug
    for i in range(4525, min(4540, len(lines))):
        print(f"  {i+1}: {repr(lines[i].rstrip())}")
