function MaintenanceTab({user,logActivity}:any){
  const [mesinList,setMesinList]=useState<any[]>([]);
  const [logList,setLogList]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [selMesin,setSelMesin]=useState<any>(null);
  const [mesinModal,setMesinModal]=useState<any>(null);
  const [logModal,setLogModal]=useState<any>(null);
  const [mesinForm,setMesinForm]=useState<any>({nama:'',kode:'',lokasi:'',status:'Normal'});
  const [logForm,setLogForm]=useState<any>({kendala:'',perbaikan:'',tgl_kendala:'',tgl_perbaikan:'',teknisi:'',status:'Proses'});
  const [saving,setSaving]=useState(false);
  const [delMesin,setDelMesin]=useState<any>(null);
  const [delLog,setDelLog]=useState<any>(null);

  const STATUS_COLOR:any={
    'Normal':{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
    'Perlu Service':{bg:'#fffbeb',color:'#f59e0b',border:'#fde68a'},
    'Rusak':{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
  };
  const LOG_STATUS_COLOR:any={
    'Proses':{bg:'#fffbeb',color:'#f59e0b'},
    'Selesai':{bg:'#f0fdf4',color:'#16a34a'},
    'Tertunda':{bg:'#fef2f2',color:'#dc2626'},
  };

  const load=async()=>{
    setLoading(true);
    const [{data:m},{data:l}]=await Promise.all([
      supabase.from('mesin').select('*').is('deleted_at',null).order('nama'),
      supabase.from('maintenance_log').select('*,mesin(nama,kode)').order('created_at',{ascending:false}),
    ]);
    setMesinList(m??[]);
    setLogList(l??[]);
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const saveMesin=async()=>{
    if(!mesinForm.nama.trim())return;
    setSaving(true);
    if(mesinModal.mode==='add'){
      await supabase.from('mesin').insert({...mesinForm});
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah mesin '+mesinForm.nama,'','Maintenance');
    } else {
      await supabase.from('mesin').update({...mesinForm}).eq('id',mesinModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Edit mesin '+mesinForm.nama,'','Maintenance');
    }
    await load();
    setMesinModal(null);
    setSaving(false);
  };

  const saveLog=async()=>{
    if(!logForm.kendala.trim())return;
    setSaving(true);
    const mesinId=selMesin?.id||logModal?.mesin_id;
    if(logModal.mode==='add'){
      await supabase.from('maintenance_log').insert({...logForm,mesin_id:mesinId});
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah log maintenance '+selMesin?.nama,'','Maintenance');
    } else {
      await supabase.from('maintenance_log').update({...logForm}).eq('id',logModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Edit log maintenance','','Maintenance');
    }
    await load();
    setLogModal(null);
    setSaving(false);
  };

  const hapusMesin=async()=>{
    await supabase.from('mesin').update({deleted_at:new Date().toISOString(),deleted_by:user?.name||user?.nama||'Admin'}).eq('id',delMesin.id);
    await createLog(user?.name||user?.nama||'Admin','general','delete','Hapus mesin '+delMesin.nama,'','Maintenance');
    await load();
    setDelMesin(null);
  };

  const hapusLog=async()=>{
    await supabase.from('maintenance_log').delete().eq('id',delLog.id);
    await load();
    setDelLog(null);
  };

  const mesinLogs=selMesin?logList.filter(l=>l.mesin_id===selMesin.id):[];
  const totalMasalah=mesinList.filter(m=>m.status!=='Normal').length;

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Total Mesin',v:mesinList.length,c:'#2563eb',i:'🔧'},
          {l:'Normal',v:mesinList.filter(m=>m.status==='Normal').length,c:'#16a34a',i:'✅'},
          {l:'Perlu Service',v:mesinList.filter(m=>m.status==='Perlu Service').length,c:'#f59e0b',i:'⚠️'},
          {l:'Rusak',v:mesinList.filter(m=>m.status==='Rusak').length,c:'#dc2626',i:'❌'},
        ].map((s,i)=>(
          <Card key={i} style={{padding:'12px 16px',borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:18,marginBottom:4}}>{s.i}</div>
            <div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16}}>
        {/* Daftar Mesin */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <STitle style={{marginBottom:0,fontSize:14}}>🔧 Daftar Mesin</STitle>
            <Btn color="#1d4ed8" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setMesinModal({mode:'add'});setMesinForm({nama:'',kode:'',lokasi:'',status:'Normal'});}}>+ Tambah</Btn>
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
            {mesinList.length===0&&<div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>Belum ada mesin</div>}
            {mesinList.map(m=>{
              const sc=STATUS_COLOR[m.status]||STATUS_COLOR['Normal'];
              const isSel=selMesin?.id===m.id;
              return(
                <div key={m.id} onClick={()=>setSelMesin(isSel?null:m)}
                  style={{background:isSel?'#eff6ff':'#fff',borderRadius:12,border:`1.5px solid ${isSel?'#2563eb':'#e2e8f0'}`,
                    padding:'12px 14px',cursor:'pointer',transition:'all .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{m.nama}</div>
                      {m.kode&&<div style={{fontSize:11,color:'#94a3b8',fontFamily:"'DM Mono',monospace"}}>{m.kode}</div>}
                      {m.lokasi&&<div style={{fontSize:11,color:'#64748b',marginTop:2}}>📍 {m.lokasi}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column' as const,alignItems:'flex-end',gap:4}}>
                      <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,
                        borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{m.status}</span>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={e=>{e.stopPropagation();setMesinModal({mode:'edit',id:m.id});setMesinForm({nama:m.nama,kode:m.kode||'',lokasi:m.lokasi||'',status:m.status});}}
                          style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();setDelMesin(m);}}
                          style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Maintenance */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <STitle style={{marginBottom:0,fontSize:14}}>
              📋 {selMesin?`Log Maintenance — ${selMesin.nama}`:'Semua Log Maintenance'}
            </STitle>
            {selMesin&&<Btn color="#16a34a" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setLogModal({mode:'add',mesin_id:selMesin.id});setLogForm({kendala:'',perbaikan:'',tgl_kendala:'',tgl_perbaikan:'',teknisi:'',status:'Proses'});}}>+ Tambah Log</Btn>}
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
            {(selMesin?mesinLogs:logList).length===0&&(
              <div style={{textAlign:'center',padding:40,color:'#94a3b8',fontSize:13}}>
                {selMesin?'Belum ada log maintenance untuk mesin ini':'Pilih mesin atau belum ada log'}
              </div>
            )}
            {(selMesin?mesinLogs:logList).map((l:any)=>{
              const sc=LOG_STATUS_COLOR[l.status]||LOG_STATUS_COLOR['Proses'];
              return(
                <Card key={l.id} style={{padding:'14px 16px',borderLeft:`3px solid ${sc.color}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                    <div style={{flex:1}}>
                      {!selMesin&&<div style={{fontSize:11,fontWeight:700,color:'#2563eb',marginBottom:4}}>🔧 {l.mesin?.nama||'—'} {l.mesin?.kode?`(${l.mesin.kode})`:''}</div>}
                      <div style={{fontWeight:700,fontSize:13,color:'#dc2626',marginBottom:4}}>⚠️ {l.kendala||'—'}</div>
                      {l.perbaikan&&<div style={{fontSize:12,color:'#16a34a',marginBottom:4}}>🔨 {l.perbaikan}</div>}
                      <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,fontSize:11,color:'#64748b',marginTop:6}}>
                        {l.tgl_kendala&&<span>📅 Kendala: <strong>{l.tgl_kendala}</strong></span>}
                        {l.tgl_perbaikan&&<span>✅ Selesai: <strong>{l.tgl_perbaikan}</strong></span>}
                        {l.teknisi&&<span>👤 Teknisi: <strong>{l.teknisi}</strong></span>}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column' as const,alignItems:'flex-end',gap:6}}>
                      <span style={{background:sc.bg,color:sc.color,borderRadius:20,padding:'2px 10px',fontSize:10,fontWeight:700}}>{l.status}</span>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>{setLogModal({mode:'edit',id:l.id,mesin_id:l.mesin_id});setLogForm({kendala:l.kendala||'',perbaikan:l.perbaikan||'',tgl_kendala:l.tgl_kendala||'',tgl_perbaikan:l.tgl_perbaikan||'',teknisi:l.teknisi||'',status:l.status||'Proses'});}}
                          style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                        <button onClick={()=>setDelLog(l)}
                          style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Mesin */}
      {mesinModal&&(
        <Modal title={(mesinModal.mode==='add'?'Tambah':'Edit')+' Mesin'} onClose={()=>setMesinModal(null)} width={440}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Nama Mesin</Lbl><Inp value={mesinForm.nama} onChange={(e:any)=>setMesinForm({...mesinForm,nama:e.target.value})} placeholder="Nama mesin..."/></div>
            <div><Lbl>Kode</Lbl><Inp value={mesinForm.kode} onChange={(e:any)=>setMesinForm({...mesinForm,kode:e.target.value})} placeholder="Kode mesin..."/></div>
            <div><Lbl>Lokasi</Lbl><Inp value={mesinForm.lokasi} onChange={(e:any)=>setMesinForm({...mesinForm,lokasi:e.target.value})} placeholder="Lokasi mesin..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={mesinForm.status} onChange={(e:any)=>setMesinForm({...mesinForm,status:e.target.value})}>
                <option value="Normal">✅ Normal</option>
                <option value="Perlu Service">⚠️ Perlu Service</option>
                <option value="Rusak">❌ Rusak</option>
              </Sel>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setMesinModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveMesin}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Log */}
      {logModal&&(
        <Modal title={(logModal.mode==='add'?'Tambah':'Edit')+' Log Maintenance'} onClose={()=>setLogModal(null)} width={480}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Kendala</Lbl><Inp value={logForm.kendala} onChange={(e:any)=>setLogForm({...logForm,kendala:e.target.value})} placeholder="Deskripsi kendala..."/></div>
            <div><Lbl>Perbaikan</Lbl><Inp value={logForm.perbaikan} onChange={(e:any)=>setLogForm({...logForm,perbaikan:e.target.value})} placeholder="Tindakan perbaikan..."/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              <div><Lbl>Tanggal Kendala</Lbl><Inp type="date" value={logForm.tgl_kendala} onChange={(e:any)=>setLogForm({...logForm,tgl_kendala:e.target.value})}/></div>
              <div><Lbl>Tanggal Selesai</Lbl><Inp type="date" value={logForm.tgl_perbaikan} onChange={(e:any)=>setLogForm({...logForm,tgl_perbaikan:e.target.value})}/></div>
            </div>
            <div><Lbl>Teknisi</Lbl><Inp value={logForm.teknisi} onChange={(e:any)=>setLogForm({...logForm,teknisi:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={logForm.status} onChange={(e:any)=>setLogForm({...logForm,status:e.target.value})}>
                <option value="Proses">⏳ Proses</option>
                <option value="Selesai">✅ Selesai</option>
                <option value="Tertunda">⏸ Tertunda</option>
              </Sel>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setLogModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveLog}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Hapus Mesin */}
      {delMesin&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelMesin(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Mesin <strong>{delMesin.nama}</strong> akan dipindah ke Recycle Bin.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelMesin(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={hapusMesin}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Hapus Log */}
      {delLog&&(
        <Modal title="Hapus Log?" onClose={()=>setDelLog(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Log maintenance ini akan dihapus permanen.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelLog(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={hapusLog}>Hapus</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
