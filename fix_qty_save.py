from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# ── 1. Replace fungsi updateItemQty ──
old_updateItemQty = """  const updateItemQty=(woId,panelId,kode,qty)=>{
    setWoData(prev=>prev.map(wo=>wo.id!==woId?wo:{...wo,panels:wo.panels.map(p=>{
      if(p.id!==panelId)return p;
      const nq=Number(qty)||0;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq}};
      if(nq===0)nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
      return{...p,checklist:nc};
    })}));
  };"""

new_updateItemQty = """  const [dirtyQty,setDirtyQty]=useState<Record<string,Record<string,{newQty:number,oldQty:number}>>>({});
  const [origChecklist,setOrigChecklist]=useState<Record<string,any>>({});

  const updateItemQty=(woId,panelId,kode,qty)=>{
    const nq=Number(qty)||0;
    // simpan original checklist sebelum edit pertama
    setOrigChecklist(prev=>{
      if(prev[panelId]) return prev;
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      return{...prev,[panelId]:JSON.parse(JSON.stringify(panel?.checklist||{}))};
    });
    // update dirty state
    setDirtyQty(prev=>{
      const panel=woData.flatMap(w=>w.panels||[]).find(p=>p.id===panelId);
      const oldQty=panel?.checklist?.[kode]?.qty??0;
      const panelDirty={...prev[panelId],[kode]:{newQty:nq,oldQty}};
      return{...prev,[panelId]:panelDirty};
    });
    // update local state
    setWoData(prev=>prev.map(wo=>wo.id!==woId?wo:{...wo,panels:wo.panels.map(p=>{
      if(p.id!==panelId)return p;
      const nc={...p.checklist,[kode]:{...p.checklist[kode],qty:nq}};
      if(nq===0)nc[kode].progress=ALL_PROSES.reduce((a,pr)=>({...a,[pr]:0}),{});
      return{...p,checklist:nc};
    })}));
  };

  const cancelQtyEdit=(panelId)=>{
    const orig=origChecklist[panelId];
    if(!orig)return;
    setWoData(prev=>prev.map(wo=>({...wo,panels:wo.panels.map(p=>p.id!==panelId?p:{...p,checklist:orig})})));
    setDirtyQty(prev=>{const n={...prev};delete n[panelId];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[panelId];return n;});
  };

  const saveQtyEdit=async(wo,panelId)=>{
    const panel=wo.panels.find(p=>p.id===panelId);
    if(!panel)return;
    // update checklist di supabase
    const{error}=await supabase.from('panels').update({checklist:panel.checklist}).eq('id',panelId);
    if(error){alert('Gagal menyimpan: '+error.message);return;}
    // activity log
    const dirty=dirtyQty[panelId]||{};
    const changes=Object.entries(dirty)
      .filter(([,v])=>(v as any).newQty!==(v as any).oldQty)
      .map(([kode,v])=>{
        const cfg=PANEL_TYPES[panel.tipe];
        const nama=cfg?.wps.flatMap((w:any)=>w.items).find((it:any)=>it.kode===kode)?.nama||kode;
        return nama+': '+(v as any).oldQty+' -> '+(v as any).newQty;
      });
    const sess=JSON.parse(localStorage.getItem('vista_admin_session')||'{}');
    const uname=user?.name||user?.nama||sess?.nama||'Admin';
    const tgl=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
    await activityLogService.insert({
      user_name:uname,
      action:'EDIT QTY',
      description:'Edit Qty '+panel.nama+' ('+wo.proyek+'): '+changes.join(', '),
      module:'wo',
      halaman:'Manajemen WO',
      proyek:wo.proyek||'',
      panel:panel.nama||'',
      wo_number:wo.wo||'',
    });
    // clear dirty
    setDirtyQty(prev=>{const n={...prev};delete n[panelId];return n;});
    setOrigChecklist(prev=>{const n={...prev};delete n[panelId];return n;});
    alert('Qty berhasil disimpan!');
  };"""

if old_updateItemQty in content:
    content = content.replace(old_updateItemQty, new_updateItemQty)
    print("✅ updateItemQty replaced")
else:
    print("❌ updateItemQty not found - cek manual")

# ── 2. Tambah tombol Save/Cancel di bawah WP terakhir per panel ──
# Cari penutup expand panel checklist dan tambahkan tombol Save/Cancel
old_panel_close = """                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}"""

new_panel_close = """                    </div>
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
                  </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}"""

if old_panel_close in content:
    content = content.replace(old_panel_close, new_panel_close)
    print("✅ Save/Cancel button added")
else:
    print("❌ Panel close pattern not found - cek manual")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai! Jalankan: npm run dev")
