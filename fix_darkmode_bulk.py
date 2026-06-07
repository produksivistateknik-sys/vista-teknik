from pathlib import Path
import re

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Simpan backup
backup = APP_PATH.with_suffix('.tsx.bak')
backup.write_text(content, encoding="utf-8")
print("✅ Backup saved")

before = len([l for l in content.splitlines() if 'background:"#fff"' in l or 'background:"#f8fafc"' in l or 'background:"#f1f5f9"' in l])

# Bulk replace — hanya untuk inline JSX styles (bukan CSS string di GCss)
# Kita skip baris yang ada di dalam backtick string (GCss)

lines = content.splitlines()
new_lines = []
in_gcss = False

for line in lines:
    # Deteksi apakah kita di dalam GCss template literal
    if 'const GCss=' in line or "GCss=`" in line:
        in_gcss = True
    if in_gcss and line.strip() == '`':
        in_gcss = False
    
    if not in_gcss:
        # Replace background colors
        line = line.replace('background:"#fff"', 'background:"var(--card-bg,#fff)"')
        line = line.replace('background:"#ffffff"', 'background:"var(--card-bg,#fff)"')
        line = line.replace('background:"#f8fafc"', 'background:"var(--bg-secondary,#f8fafc)"')
        line = line.replace('background:"#f1f5f9"', 'background:"var(--bg-tertiary,#f1f5f9)"')
        line = line.replace('background:"#f9fafb"', 'background:"var(--bg-secondary,#f9fafb)"')
        line = line.replace('background:"#fafafa"', 'background:"var(--bg-secondary,#fafafa)"')
        # Replace border colors
        line = line.replace('border:"1px solid #e2e8f0"', 'border:"1px solid var(--border-color,#e2e8f0)"')
        line = line.replace('border:"1.5px solid #e2e8f0"', 'border:"1.5px solid var(--border-color,#e2e8f0)"')
        line = line.replace('border:"0.5px solid #e2e8f0"', 'border:"0.5px solid var(--border-color,#e2e8f0)"')
        line = line.replace('border:"1px solid #eaecf0"', 'border:"1px solid var(--border-color,#eaecf0)"')
        line = line.replace('borderBottom:"1px solid #e2e8f0"', 'borderBottom:"1px solid var(--border-color,#e2e8f0)"')
        line = line.replace('borderTop:"1px solid #e2e8f0"', 'borderTop:"1px solid var(--border-color,#e2e8f0)"')
        line = line.replace('borderBottom:"1px solid #f1f5f9"', 'borderBottom:"1px solid var(--border-light,#f1f5f9)"')
        line = line.replace('borderRight:"1px solid #f1f5f9"', 'borderRight:"1px solid var(--border-light,#f1f5f9)"')
        # Replace text colors
        line = line.replace('color:"#1e293b"', 'color:"var(--text-primary,#1e293b)"')
        line = line.replace('color:"#0f172a"', 'color:"var(--text-primary,#0f172a)"')
        line = line.replace('color:"#1a1d23"', 'color:"var(--text-primary,#1a1d23)"')
    
    new_lines.append(line)

new_content = '\n'.join(new_lines)
after = len([l for l in new_content.splitlines() if 'background:"#fff"' in l or 'background:"#f8fafc"' in l or 'background:"#f1f5f9"' in l])

APP_PATH.write_text(new_content, encoding="utf-8")
print(f"✅ Before: {before} white baris → After: {after} white baris")
print(f"✅ Fixed {before-after} baris!")
print("\n✅ Selesai!")
