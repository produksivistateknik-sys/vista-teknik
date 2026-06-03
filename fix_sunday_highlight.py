from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah helper isSunday dan update cell background
# Tambah isSunday helper setelah days useMemo
old_days = "  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);"
new_days = """  const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(weekStart,i)),[weekStart]);
  const isSunday=(d:string)=>new Date(d).getDay()===0;"""

if old_days in content:
    content = content.replace(old_days, new_days)
    print("✅ isSunday helper added")
else:
    print("❌ days useMemo not found")

# Update header th untuk hari minggu
old_th_bg = 'background:d===TODAY?"#1e40af":selDate===d?"#1d4ed8":"#1e3a8a"'
new_th_bg = 'background:d===TODAY?"#1e40af":isSunday(d)?"#7f1d1d":selDate===d?"#1d4ed8":"#1e3a8a"'

if old_th_bg in content:
    content = content.replace(old_th_bg, new_th_bg)
    print("✅ Sunday header highlight added")
else:
    print("❌ th background not found")

# Update cell body untuk hari minggu
old_cell = '{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSelDate&&entries.length?"#f0f9ff":rBg,borderLeft:d===TODAY?"2px solid #3b82f6":"none"'
new_cell = '{...td,textAlign:"center",padding:"2px",background:isOver?"#eff6ff":d===TODAY?"#eff6ff":isSunday(d)?"#fff1f2":isSelDate&&entries.length?"#f0f9ff":rBg,borderLeft:d===TODAY?"2px solid #3b82f6":isSunday(d)?"2px solid #fda4af":"none"'

if old_cell in content:
    content = content.replace(old_cell, new_cell)
    print("✅ Sunday cell highlight added")
else:
    print("❌ cell background not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
