function MasterUser({logActivity,user}:any){
  const [admins,setAdmins]=useState<any[]>([]);
  const [pekerjaList,setPekerjaList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<'admin'|'pekerja'>('admin');
  const [modal,setModal]=useState<any>(null);
  const [form,setForm]=useState<any>({});
  const [saving,setSaving]=useState(false);
  const [delId,setDelId]=useState<any>(null);
  const [delType,setDelType]=useState<'admin'|'pekerja'>('admin');

  const loadData=async()=>{
    setLoading(true);
    const [{data:a},{data:p}]=await Promise.all([
      supabase.from('admins').select('*').order('nama'),
      supabase.from('pekerja').select('*').order('divisi'),
    ]);
    setAdmins(a??[]);
    setPekerjaList(p??[]);
    setLoading(false);
  };

  useEffect(()=>{loadData();},[]);

  const openAdd=(type:'admin'|'pekerja')=>{
    setModal({type,mode:'add'});
    setForm(type==='admin'?{nama:'',username:'',password:'',is_active:true}:{nama:'',divisi:'mekanik',username:'',password:''});
  };

  const openEdit=(type:'admin'|'pekerja',item:any)=>{
    setModal({type,mode:'edit',id:item.id});
    setForm(type==='admin'
      ?{nama:item.nama,username:item.username,password:item.password,is_active:item.is_active}
      :{nama:item.nama,divisi:item.divisi,username:item.username||'',password:item.password||''}
    );
  };

  const save=async()=>{
    if(!modal)return;
    setSaving(true);
    const{type,mode,id}=modal;
    if(type==='admin'){
      if(mode==='add'){
        const{error}=await supabase.from('admins').insert({nama:form.nama,username:form.username,password:form.password,is_active:form.is_active??true,avatar:'👨‍💼'});
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','create','Tambah admin '+form.nama,'','Master User');
      } else {
        const{error}=await supabase.from('admins').update({nama:form.nama,username:form.username,password:form.password,is_active:form.is_active}).eq('id',id);
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','update','Edit admin '+form.nama,'','Master User');
      }
    } else {
      if(mode==='add'){
        const{error}=await supabase.from('pekerja').insert({nama:form.nama,divisi:form.divisi,username:form.username||null,password:form.password||null});
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','create','Tambah pekerja '+form.nama,'','Master User');
      } else {
        const{error}=await supabase.from('pekerja').update({nama:form.nama,divisi:form.divisi,username:form.username||null,password:form.password||null}).eq('id',id);
        if(!error) await createLog(user?.name||user?.nama||'Admin','pekerja','update','Edit pekerja '+form.nama,'','Master User');
      }
    }
    await loadData();
    setModal(null);
    setSaving(false);
  };

  const confirmDelete=async()=>{
    if(!delId)return;
    if(delType==='admin'){
      await supabase.from('admins').delete().eq('id',delId);
      await createLog(user?.name||user?.nama||'Admin','pekerja','delete','Hapus admin','','Master User');
    } else {
      await supabase.from('pekerja').delete().eq('id',delId);
      await createLog(user?.name||user?.nama||'Admin','pekerja','delete','Hapus pekerja','','Master User');
    }
    await loadData();
    setDelId(null);
  };

  const DIVISI_OPTS=Object.entries(DIVISI_CONFIG).filter(([k])=>k!=='admin').map(([k,v]:any)=>({key:k,label:v.label,icon:v.icon}));

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Tab */}
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['admin','pekerja'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{padding:'8px 24px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,
              background:tab===t?'#1d4ed8':'#f1f5f9',color:tab===t?'#fff':'#64748b',transition:'all .15s'}}>
            {t==='admin'?'⚙️ Admin':'👷 Pekerja'}
          </button>
        ))}
        <button onClick={()=>openAdd(tab)}
          style={{marginLeft:'auto',padding:'8px 20px',borderRadius:8,border:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,background:'#16a34a',color:'#fff'}}>
          + Tambah {tab==='admin'?'Admin':'Pekerja'}
        </button>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #2563eb'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#2563eb'}}>{admins.length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Total Admin</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #16a34a'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#16a34a'}}>{admins.filter(a=>a.is_active).length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Admin Aktif</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #f59e0b'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#f59e0b'}}>{pekerjaList.length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Total Pekerja</div>
        </Card>
        <Card style={{padding:'12px 16px',borderLeft:'3px solid #8b5cf6'}}>
          <div style={{fontSize:22,fontWeight:800,color:'#8b5cf6'}}>{pekerjaList.filter(p=>p.password).length}</div>
          <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>Sudah Password</div>
        </Card>
      </div>

      {/* Admin Table */}
      {tab==='admin'&&(
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{background:'#1e3a8a',padding:'10px 16px'}}>
            <span style={{fontWeight:800,fontSize:14,color:'#fff'}}>⚙️ Daftar Admin</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
            <thead>
              <tr>
                {['No','Nama','Username','Password','Status','Terakhir Login','Aksi'].map(h=>(
                  <th key={h} style={{background:'#f8fafc',padding:'8px 12px',fontWeight:700,color:'#64748b',
                    fontSize:11,textAlign:'left' as const,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a,i)=>(
                <tr key={a.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                  <td style={{padding:'10px 12px',color:'#94a3b8'}}>{i+1}</td>
                  <td style={{padding:'10px 12px',fontWeight:700,color:'#1e293b'}}>{a.avatar||'👨‍💼'} {a.nama}</td>
                  <td style={{padding:'10px 12px',fontFamily:"'DM Mono',monospace",color:'#475569'}}>{a.username}</td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{background:'#f1f5f9',borderRadius:6,padding:'2px 10px',fontFamily:"'DM Mono',monospace",fontSize:11,color:'#475569'}}>
                      {'•'.repeat(Math.min(a.password?.length||0,8))}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <span style={{background:a.is_active?'#f0fdf4':'#fef2f2',color:a.is_active?'#16a34a':'#dc2626',
                      borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>
                      {a.is_active?'Aktif':'Nonaktif'}
                    </span>
                  </td>
                  <td style={{padding:'10px 12px',color:'#94a3b8',fontSize:11}}>
                    {a.last_login?new Date(a.last_login).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'Belum pernah'}
                  </td>
                  <td style={{padding:'10px 12px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>openEdit('admin',a)}
                        style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:11,color:'#475569'}}>✏️</button>
                      <button onClick={()=>{setDelId(a.id);setDelType('admin');}}
                        style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Pekerja Table */}
      {tab==='pekerja'&&(
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{background:'#1e3a8a',padding:'10px 16px'}}>
            <span style={{fontWeight:800,fontSize:14,color:'#fff'}}>👷 Daftar Pekerja</span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
            <thead>
              <tr>
                {['No','Nama','Divisi','Username','Password','Aksi'].map(h=>(
                  <th key={h} style={{background:'#f8fafc',padding:'8px 12px',fontWeight:700,color:'#64748b',
                    fontSize:11,textAlign:'left' as const,borderBottom:'1px solid #e2e8f0'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pekerjaList.map((p,i)=>{
                const dc=DIVISI_CONFIG[p.divisi];
                return(
                  <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={{padding:'10px 12px',color:'#94a3b8'}}>{i+1}</td>
                    <td style={{padding:'10px 12px',fontWeight:700,color:'#1e293b'}}>{p.nama}</td>
                    <td style={{padding:'10px 12px'}}>
                      <span style={{background:dc?.bg||'#f1f5f9',color:dc?.color||'#64748b',borderRadius:20,
                        padding:'2px 10px',fontSize:11,fontWeight:700}}>{dc?.icon} {dc?.label||p.divisi}</span>
                    </td>
                    <td style={{padding:'10px 12px',fontFamily:"'DM Mono',monospace",color:'#475569'}}>
                      {p.username||<span style={{color:'#cbd5e1',fontStyle:'italic'}}>—</span>}
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      {p.password
                        ?<span style={{background:'#f0fdf4',color:'#16a34a',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>✓ Sudah diset</span>
                        :<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:20,padding:'2px 10px',fontSize:11,fontWeight:700}}>⚠ Belum diset</span>
                      }
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>openEdit('pekerja',p)}
                          style={{padding:'4px 10px',borderRadius:6,border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:11,color:'#475569'}}>✏️</button>
                        <button onClick={()=>{setDelId(p.id);setDelType('pekerja');}}
                          style={{padding:'4px 10px',borderRadius:6,border:'1px solid #fecaca',background:'#fef2f2',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Modal Add/Edit */}
      {modal&&(
        <Modal title={(modal.mode==='add'?'Tambah':'Edit')+(modal.type==='admin'?' Admin':' Pekerja')} onClose={()=>setModal(null)} width={440}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Nama Lengkap</Lbl>
              <Inp value={form.nama||''} onChange={(e:any)=>setForm({...form,nama:e.target.value})} placeholder="Nama..."/>
            </div>
            {modal.type==='pekerja'&&(
              <div><Lbl>Divisi</Lbl>
                <Sel value={form.divisi||'mekanik'} onChange={(e:any)=>setForm({...form,divisi:e.target.value})}>
                  {DIVISI_OPTS.map(d=><option key={d.key} value={d.key}>{d.icon} {d.label}</option>)}
                </Sel>
              </div>
            )}
            <div><Lbl>Username</Lbl>
              <Inp value={form.username||''} onChange={(e:any)=>setForm({...form,username:e.target.value})} placeholder="username..."/>
            </div>
            <div><Lbl>Password</Lbl>
              <Inp type="text" value={form.password||''} onChange={(e:any)=>setForm({...form,password:e.target.value})} placeholder="password..."/>
            </div>
            {modal.type==='admin'&&(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="checkbox" checked={form.is_active??true} onChange={(e:any)=>setForm({...form,is_active:e.target.checked})} id="isActive"/>
                <label htmlFor="isActive" style={{fontSize:13,color:'#475569',fontWeight:600}}>Akun Aktif</label>
              </div>
            )}
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={save}>{saving?'Menyimpan...':modal.mode==='add'?'Tambah':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Delete */}
      {delId&&(
        <Modal title="Hapus User?" onClose={()=>setDelId(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Data tidak dapat dikembalikan.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelId(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={confirmDelete}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
