from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── Fix 1: Wrap tombol Save/Cancel dalam fragment agar JSX valid ──
old1 = """                    </div>
                    {dirtyQty[p.id]&&Object.keys(dirtyQty[p.id]).length>0&&(
                      <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"12px 0 4px",borderTop:"1px dashed #e2e8f0",marginTop:8}}>
                        <button onClick={()=>cancelQtyEdit(p.id)}
                          style={{padding:"8px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
                          Batal
                        </button>
                        <button onClick={()=>saveQtyEdit(wo,p.id)}
                          style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #2563eb33"}}>
                          Simpan Perubahan
                        </button>
                      </div>
                    )}
                  )}
                </div>"""

new1 = """                    </div>
                  )}
                  {dirtyQty[p.id]&&Object.keys(dirtyQty[p.id]).length>0&&(
                    <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"12px 16px",borderTop:"1px dashed #e2e8f0",marginTop:4,background:"#f8faff"}}>
                      <button onClick={()=>cancelQtyEdit(p.id)}
                        style={{padding:"8px 20px",borderRadius:8,border:"1.5px solid #e2e8f0",background:"#f8fafc",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit"}}>
                        Batal
                      </button>
                      <button onClick={()=>saveQtyEdit(wo,p.id)}
                        style={{padding:"8px 24px",borderRadius:8,border:"none",background:"#1d4ed8",color:"#fff",cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:"inherit",boxShadow:"0 2px 8px #2563eb33"}}>
                        Simpan Perubahan
                      </button>
                    </div>
                  )}
                </div>"""

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Fix 1: JSX structure fixed")
else:
    print("❌ Fix 1: pattern not found")

# ── Fix 2: Hapus tombol Hapus dobel di WO ──
old2 = '<Btn color="#dc2626" onClick={()=>{setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn><Btn color="#dc2626" onClick={async()=>{const sess=JSON.parse(localStorage.getItem(\'vista_admin_session\')||\'{}});const uname=sess?.nama||sess?.name||\'Admin\';await supabase.from(\'work_orders\').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq(\'id\',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>'

new2 = '<Btn color="#dc2626" onClick={async()=>{const sess=JSON.parse(localStorage.getItem(\'vista_admin_session\')||\'{}});const uname=sess?.nama||sess?.name||\'Admin\';await supabase.from(\'work_orders\').update({deleted_at:new Date().toISOString(),deleted_by:uname}).eq(\'id\',delId);setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>'

# Cara lebih aman: hapus tombol pertama saja
old2_simple = '<Btn color="#dc2626" onClick={()=>{setWoData(prev=>prev.filter(w=>w.id!==delId));setDelId(null);}}>Hapus</Btn>'
if old2_simple in content:
    content = content.replace(old2_simple, '', 1)
    print("✅ Fix 2: Tombol Hapus dobel dihapus")
else:
    print("⚠️  Fix 2: Tombol Hapus dobel tidak ditemukan (mungkin sudah ok)")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai! Jalankan: npm run dev")
