from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
content = APP_PATH.read_text(encoding="utf-8")

# Tambah riwayat section di KomponenStokTab
# Tambah activityLog prop dan riwayat section

# 1. Update render call untuk pass activityLog
old_render = '{subTab==="stok"&&<KomponenStokTab user={user}/>}'
new_render = '{subTab==="stok"&&<KomponenStokTab user={user} activityLog={activityLog}/>}'

if old_render in content:
    content = content.replace(old_render, new_render)
    print("✅ activityLog prop added to KomponenStokTab render")
else:
    print("❌ Render not found")

# 2. Update KomponenStokTab signature dan tambah riwayat section
old_sig = "function KomponenStokTab({user}:any){"
new_sig = "function KomponenStokTab({user,activityLog}:any){"

if old_sig in content:
    content = content.replace(old_sig, new_sig)
    print("✅ KomponenStokTab signature updated")
else:
    print("❌ Signature not found")

# 3. Tambah riwayat section sebelum Modal Keluarkan
old_anchor = """      {/* Modal Keluarkan */}
      {showKeluar&&("""

new_anchor = """      {/* Riwayat Pengeluaran */}
      <div style={{marginTop:20}}>
        <div style={{fontWeight:700,fontSize:13,color:"#1e293b",marginBottom:10,
          display:"flex",alignItems:"center",gap:8}}>
          📋 Riwayat Pengeluaran
          <span style={{fontSize:10,color:"#94a3b8",fontWeight:400}}>
            (dari Activity Log)
          </span>
        </div>
        {(()=>{
          const riwayat=(activityLog||[])
            .filter((l:any)=>l.action==="KELUAR KOMPONEN")
            .slice(0,50);
          if(!riwayat.length) return(
            <div style={{textAlign:"center",padding:"20px",color:"#94a3b8",fontSize:12,
              background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
              Belum ada riwayat pengeluaran
            </div>
          );
          const thR:any={background:"#1e2330",color:"#c8d0e8",padding:"6px 10px",fontWeight:600,
            fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10",
            textTransform:"uppercase",letterSpacing:.4};
          return(
            <div style={{overflowX:"auto" as const,borderRadius:10,border:"1px solid #e2e8f0"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr>
                  <th style={{...thR,width:130}}>Tanggal</th>
                  <th style={thR}>Komponen</th>
                  <th style={{...thR,textAlign:"center" as const,width:80}}>Jumlah</th>
                  <th style={thR}>Proyek</th>
                  <th style={thR}>Panel</th>
                  <th style={thR}>Keterangan</th>
                  <th style={thR}>Oleh</th>
                </tr></thead>
                <tbody>
                  {riwayat.map((l:any,i:number)=>{
                    const rBg=i%2===0?"#fff":"#f8fafc";
                    const td:any={padding:"7px 10px",borderBottom:"1px solid #f1f5f9",
                      borderRight:"1px solid #f1f5f9",background:rBg,verticalAlign:"middle"};
                    // Parse description: "Keluar: Frame x3 pcs → Proyek: GODREJ, Panel: LVMDP, Ket: -, Sisa stok: 47"
                    const desc=l.description||"";
                    const komMatch=desc.match(/Keluar:\s*(.+?)\s*x(\d+)\s*pcs/);
                    const sisaMatch=desc.match(/Sisa stok:\s*(\d+)/);
                    const ketMatch=desc.match(/Ket:\s*(.+?)\./);
                    const nama=komMatch?komMatch[1]:"-";
                    const jml=komMatch?komMatch[2]:"-";
                    const sisa=sisaMatch?sisaMatch[1]:"-";
                    const ket=ketMatch?ketMatch[1]:"-";
                    const tgl=l.created_at?new Date(l.created_at).toLocaleDateString("id-ID",
                      {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";
                    return(
                      <tr key={l.id}>
                        <td style={{...td,color:"#94a3b8",fontSize:10}}>{tgl}</td>
                        <td style={{...td,fontWeight:600,color:"#1e293b"}}>{nama}</td>
                        <td style={{...td,textAlign:"center" as const}}>
                          <span style={{background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",
                            borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:700}}>
                            -{jml} pcs
                          </span>
                        </td>
                        <td style={{...td,color:"#475569"}}>{l.proyek||"-"}</td>
                        <td style={{...td,color:"#475569"}}>{l.panel||"-"}</td>
                        <td style={{...td,color:"#94a3b8",fontSize:10}}>{ket}</td>
                        <td style={{...td,color:"#64748b"}}>{l.user_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Modal Keluarkan */}
      {showKeluar&&("""

if old_anchor in content:
    content = content.replace(old_anchor, new_anchor)
    print("✅ Riwayat section added")
else:
    print("❌ Riwayat anchor not found")

APP_PATH.write_text(content, encoding="utf-8")
print("\n✅ Selesai!")
