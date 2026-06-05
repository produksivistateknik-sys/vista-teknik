from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Fix: Wrap WP section dengan conditional BUSBAR check
old_wp = """          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{"""

new_wp = """          <div style={{borderTop:"1px solid #f1f5f9",paddingTop:16}}>
          {rawRow?.proses!=="BUSBAR"&&(<>
            <Lbl>Tambah WP</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {WP_LIST.map(wp=>{"""

if old_wp in content:
    content = content.replace(old_wp, new_wp)
    print("✅ WP section opening wrapped")
else:
    print("❌ WP opening not found")

# Wrap closing WP section
old_wp_close = """            {modalWp&&wpItems.length>0&&(
              <>"""

new_wp_close = """            {modalWp&&wpItems.length>0&&(
              <>"""

# Cari closing dari addEntry button
old_add_btn = """                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>+ Tambah {modalWp} ({modalKomponen.length} komponen)</Btn>
              </>
            )}
          </div>"""

new_add_btn = """                <Btn color="#1d4ed8" style={{width:"100%"}} onClick={addEntry} disabled={!modalKomponen.length}>+ Tambah {modalWp} ({modalKomponen.length} komponen)</Btn>
              </>
            )}
          </>)}
          </div>"""

if old_add_btn in content:
    content = content.replace(old_add_btn, new_add_btn)
    print("✅ WP section closing wrapped")
else:
    print("❌ WP closing not found")
    lines = content.splitlines()
    for i, l in enumerate(lines[3425:3445], 3426):
        if 'Tambah' in l and ('modalWp' in l or 'komponen' in l.lower()):
            print(f"  {i}: {l.strip()[:80]}")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
