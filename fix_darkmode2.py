from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Cari dan hapus useEffect darkMode
import re
# Pattern: useEffect dengan darkMode
pattern = r'  useEffect\(\(\)=>\{\s*localStorage\.setItem\("vista_dark_mode".*?\}\s*,\s*\[darkMode\]\s*\);'
match = re.search(pattern, content, re.DOTALL)
if match:
    # Ganti dengan direct call
    old = match.group()
    new = """  // Apply dark mode langsung tanpa useEffect
  localStorage.setItem("vista_dark_mode", String(darkMode));
  document.documentElement.setAttribute("data-theme", darkMode?"dark":"light");"""
    content = content.replace(old, new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ useEffect darkMode removed and replaced!")
else:
    print("❌ Pattern not found, trying line-based approach")
    lines = content.splitlines()
    for i, l in enumerate(lines):
        if 'vista_dark_mode' in l:
            print(f"  Line {i+1}: {l.strip()}")
