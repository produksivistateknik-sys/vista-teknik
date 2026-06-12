target = r"C:\Users\User\vista-teknik\src\services\fcsService.ts"

with open(target, "r", encoding="utf-8") as f:
    content = f.read()

# Hapus fungsi addDays duplikat di bagian bawah (setelah export functions)
OLD_DUP = """
function addDays(tanggal: string, n: number): string {
  const d = new Date(tanggal)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
"""

if OLD_DUP in content:
    # Hitung berapa kali muncul
    count = content.count("function addDays(")
    print(f"addDays muncul {count} kali")
    # Hapus yang terakhir
    last_idx = content.rfind("function addDays(")
    # Hapus dari last_idx sampai closing brace
    end_idx = content.find("\n}", last_idx) + 2
    content = content[:last_idx-1] + content[end_idx:]
    with open(target, "w", encoding="utf-8") as f:
        f.write(content)
    print("[OK] Duplikat addDays dihapus")
else:
    # Cari manual
    lines = content.split("\n")
    occurrences = [(i,l) for i,l in enumerate(lines) if "function addDays(" in l]
    print(f"addDays di baris: {[o[0]+1 for o in occurrences]}")
    if len(occurrences) >= 2:
        # Hapus dari baris kedua
        start = occurrences[-1][0]
        # Cari closing brace
        end = start + 1
        while end < len(lines) and not lines[end].startswith("}"):
            end += 1
        del lines[start-1:end+2]  # hapus blank line sebelumnya juga
        content = "\n".join(lines)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"[OK] Duplikat addDays dihapus dari baris {start+1}")
