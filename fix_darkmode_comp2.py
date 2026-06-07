from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix Card
old_card = 'function Card({children,style={}}){\n  return <div style={{background:"#fff",borderRadius:12,border:"1px solid #e2e8f0",\n    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;\n}'
new_card = 'function Card({children,style={}}){\n  return <div className="erp-card" style={{background:"var(--card-bg,#fff)",borderRadius:12,border:"1px solid var(--border-color,#e2e8f0)",\n    padding:16,boxShadow:"0 1px 3px #00000008",...style}}>{children}</div>;\n}'

if old_card in content:
    content = content.replace(old_card, new_card)
    print("✅ Card fixed")
else:
    print("❌ Card not found")

# Cek Inp lebih lengkap
lines = content.splitlines()
for i, l in enumerate(lines[550:560], 551):
    print(f"{i}: {repr(l)}")

APP_PATH.write_text(content, encoding="utf-8")
