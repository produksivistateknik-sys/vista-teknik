from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: onClick openCellModal
old1 = '                              onClick={()=>openCellModal(row.id,d)}\n'
new1 = '                              onClick={(e:any)=>{if(e.shiftKey||e.ctrlKey||e.metaKey){handleCellClick(row.id,d,e);return;}openCellModal(row.id,d);}}\n'

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Cell click fixed!")
else:
    print("❌ Not found!")

# Fix 2: handleCellClick - cek exact
lines = content.splitlines()
for i, l in enumerate(lines):
    if 'handleCellClick' in l and 'const ' in l:
        print(f"Found at {i+1}: {l.strip()[:80]}")
        # Print context
        for j in range(i, min(i+5, len(lines))):
            print(f"  {j+1}: {repr(lines[j])}")
        break

APP_PATH.write_text(content, encoding="utf-8")
