from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix 1: Hapus maxHeight dari container agar scroll ikut page
old_wrap = '<div style={{overflowX:"auto",overflowY:"auto",maxHeight:"calc(100vh - 320px)",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'
new_wrap = '<div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>'

if old_wrap in content:
    content = content.replace(old_wrap, new_wrap)
    print("✅ Fix 1: maxHeight removed")
else:
    print("❌ Fix 1: not found")

# Fix 2: thead tr sticky top - hitung offset dari topbar (40px) + erp-body padding (10px)
# topbar height = 40px
old_thead = '<thead>'
new_thead = '<thead style={{position:"sticky",top:0,zIndex:10}}>'

# Hanya replace yang ada di RawSchedule (bukan thead lain)
# Cari konteks yang benar
raw_table_old = '<div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>\n        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>\n          <thead>'
raw_table_new = '<div style={{overflowX:"auto",borderRadius:12,border:"1px solid #e2e8f0",boxShadow:"0 1px 4px #00000008"}}>\n        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9}}>\n          <thead style={{position:"sticky",top:0,zIndex:10}}>'

if raw_table_old in content:
    content = content.replace(raw_table_old, raw_table_new)
    APP_PATH.write_text(content, encoding="utf-8")
    print("✅ Fix 2: thead sticky top added")
else:
    print("❌ Fix 2: not found - cek manual")
    lines = content.splitlines()
    for i, l in enumerate(lines[3111:3117], 3112):
        print(f"{i}: {l}")

