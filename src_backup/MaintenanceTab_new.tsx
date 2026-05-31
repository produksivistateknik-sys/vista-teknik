function MaintenanceTab({user,logActivity}:any){
  const [machines,setMachines]=useState<any[]>([]);
  const [logs,setLogs]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [selMachine,setSelMachine]=useState<any>(null);
  const [machineModal,setMachineModal]=useState<any>(null);
  const [logModal,setLogModal]=useState<any>(null);
  const [machineForm,setMachineForm]=useState<any>({nama_mesin:'',divisi:'',tipe_mesin:'',status_terakhir:'Normal'});
  const [logForm,setLogForm]=useState<any>({issue_title:'',issue_type:'Mechanical',problem_description:'',repair_action:'',technician:'',status:'Open',priority:'Medium',downtime_hours:0,start_date:'',finish_date:''});
  const [saving,setSaving]=useState(false);
  const [filterStatus,setFilterStatus]=useState('ALL');
  const [filterType,setFilterType]=useState('ALL');
  const [delMachine,setDelMachine]=useState<any>(null);
  const [delLog,setDelLog]=useState<any>(null);

  const STATUS_LIST=['Open','Checking','On Repair','Waiting Sparepart','Trial','Resolved','Closed'];
  const TYPE_LIST=['Mechanical','Electrical','Sensor','Hydraulic','Pneumatic','Software'];
  const PRIORITY_LIST=['Low','Medium','High','Critical'];

  const STATUS_COLOR:any={
    'Open':{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    'Checking':{bg:'#fffbeb',color:'#f59e0b',border:'#fde68a'},
    'On Repair':{bg:'#eff6ff',color:'#2563eb',border:'#bfdbfe'},
    'Waiting Sparepart':{bg:'#f5f3ff',color:'#7c3aed',border:'#ddd6fe'},
    'Trial':{bg:'#ecfeff',color:'#0891b2',border:'#a5f3fc'},
    'Resolved':{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
    'Closed':{bg:'#f8fafc',color:'#64748b',border:'#e2e8f0'},
  };
  const PRIORITY_COLOR:any={
    'Low':'#16a34a','Medium':'#f59e0b','High':'#f97316','Critical':'#dc2626'
  };
  const TYPE_COLOR:any={
    'Mechanical':'#2563eb','Electrical':'#f59e0b','Sensor':'#8b5cf6',
    'Hydraulic':'#0891b2','Pneumatic':'#10b981','Software':'#f97316'
  };
  const MACHINE_STATUS_COLOR:any={
    'Normal':{bg:'#f0fdf4',color:'#16a34a',border:'#bbf7d0'},
    'Rusak':{bg:'#fef2f2',color:'#dc2626',border:'#fecaca'},
    'Maintenance':{bg:'#fffbeb',color:'#f59e0b',border:'#fde68a'},
  };

  const load=async()=>{
    setLoading(true);
    const [{data:m},{data:l}]=await Promise.all([
      supabase.from('machines').select('*').is('deleted_at',null).order('nama_mesin'),
      supabase.from('maintenance_logs').select('*').order('created_at',{ascending:false}),
    ]);
    setMachines(m??[]);
    setLogs(l??[]);
    setLoading(false);
  };

  useEffect(()=>{
    load();
    const ch=supabase.channel('realtime-maintenance')
      .on('postgres_changes',{event:'*',schema:'public',table:'maintenance_logs'},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'machines'},()=>load())
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const saveMachine=async()=>{
    if(!machineForm.nama_mesin.trim())return;
    setSaving(true);
    if(machineModal.mode==='add'){
      await supabase.from('machines').insert({...machineForm});
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah mesin '+machineForm.nama_mesin,'','Maintenance');
    } else {
      await supabase.from('machines').update({...machineForm}).eq('id',machineModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Edit mesin '+machineForm.nama_mesin,'','Maintenance');
    }
    await load();
    setMachineModal(null);
    setSaving(false);
  };

  const saveLog=async()=>{
    if(!logForm.issue_title.trim())return;
    setSaving(true);
    const machineId=selMachine?.id||logModal?.machine_id;
    if(logModal.mode==='add'){
      await supabase.from('maintenance_logs').insert({...logForm,machine_id:machineId,created_by:user?.name||user?.nama||'Admin'});
      // Update status mesin
      const newStatus=logForm.status==='Resolved'||logForm.status==='Closed'?'Normal':'Maintenance';
      await supabase.from('machines').update({status_terakhir:newStatus}).eq('id',machineId);
      await createLog(user?.name||user?.nama||'Admin','general','create','Tambah maintenance log: '+logForm.issue_title+' pada '+selMachine?.nama_mesin,'','Maintenance');
    } else {
      await supabase.from('maintenance_logs').update({...logForm}).eq('id',logModal.id);
      await createLog(user?.name||user?.nama||'Admin','general','update','Update maintenance log: '+logForm.issue_title,'','Maintenance');
    }
    await load();
    setLogModal(null);
    setSaving(false);
  };

  const hapusMachine=async()=>{
    await supabase.from('machines').update({deleted_at:new Date().toISOString(),deleted_by:user?.name||user?.nama||'Admin'}).eq('id',delMachine.id);
    await createLog(user?.name||user?.nama||'Admin','general','delete','Hapus mesin '+delMachine.nama_mesin,'','Maintenance');
    if(selMachine?.id===delMachine.id) setSelMachine(null);
    await load();
    setDelMachine(null);
  };

  const hapusLog=async()=>{
    await supabase.from('maintenance_logs').delete().eq('id',delLog.id);
    await load();
    setDelLog(null);
  };

  const machineLogs=selMachine?logs.filter(l=>l.machine_id===selMachine.id):logs;
  const filteredLogs=machineLogs.filter(l=>
    (filterStatus==='ALL'||l.status===filterStatus)&&
    (filterType==='ALL'||l.issue_type===filterType)
  );

  const totalDowntime=logs.reduce((a,l)=>a+(Number(l.downtime_hours)||0),0);
  const thisMonth=logs.filter(l=>l.created_at?.startsWith(new Date().toISOString().slice(0,7))).length;
  const mostBroken=machines.map(m=>({...m,count:logs.filter(l=>l.machine_id===m.id).length})).sort((a,b)=>b.count-a.count)[0];

  const fmtDate=(d:string)=>d?new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}):'—';

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat data...</div>;

  return(
    <div className="fi">
      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:16}}>
        {[
          {l:'Total Mesin',v:machines.length,c:'#2563eb',i:'🔧'},
          {l:'Normal',v:machines.filter(m=>m.status_terakhir==='Normal').length,c:'#16a34a',i:'✅'},
          {l:'Dalam Perbaikan',v:machines.filter(m=>m.status_terakhir==='Maintenance').length,c:'#f59e0b',i:'⚠️'},
          {l:'Rusak',v:machines.filter(m=>m.status_terakhir==='Rusak').length,c:'#dc2626',i:'❌'},
          {l:'Total Breakdown',v:logs.length,c:'#8b5cf6',i:'📋'},
          {l:'Bulan Ini',v:thisMonth,c:'#0891b2',i:'📅'},
          {l:'Total Downtime',v:totalDowntime+'h',c:'#f97316',i:'⏱'},
          {l:'Sering Rusak',v:mostBroken?.nama_mesin||'—',c:'#dc2626',i:'🔴'},
        ].map((s,i)=>(
          <Card key={i} style={{padding:'12px 14px',borderLeft:`3px solid ${s.c}`}}>
            <div style={{fontSize:16,marginBottom:4}}>{s.i}</div>
            <div style={{fontSize:i===7?11:20,fontWeight:800,color:s.c,lineHeight:1.2}}>{s.v}</div>
            <div style={{fontSize:10,color:'#94a3b8',fontWeight:600,textTransform:'uppercase' as const,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:16}}>
        {/* Daftar Mesin */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e293b'}}>🔧 Daftar Mesin</div>
            <Btn color="#1d4ed8" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>{setMachineModal({mode:'add'});setMachineForm({nama_mesin:'',divisi:'',tipe_mesin:'',status_terakhir:'Normal'});}}>+ Tambah</Btn>
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:8,maxHeight:600,overflowY:'auto' as const}}>
            {machines.length===0&&<div style={{textAlign:'center',padding:20,color:'#94a3b8',fontSize:13}}>Belum ada mesin</div>}
            {machines.map(m=>{
              const sc=MACHINE_STATUS_COLOR[m.status_terakhir]||MACHINE_STATUS_COLOR['Normal'];
              const isSel=selMachine?.id===m.id;
              const mLogs=logs.filter(l=>l.machine_id===m.id);
              const lastLog=mLogs[0];
              return(
                <div key={m.id} onClick={()=>setSelMachine(isSel?null:m)}
                  style={{background:isSel?'#eff6ff':'#fff',borderRadius:12,
                    border:`1.5px solid ${isSel?'#2563eb':'#e2e8f0'}`,
                    padding:'12px 14px',cursor:'pointer',transition:'all .15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                    <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{m.nama_mesin}</div>
                    <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,
                      borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700,flexShrink:0}}>{m.status_terakhir}</span>
                  </div>
                  {m.tipe_mesin&&<div style={{fontSize:11,color:'#64748b',marginBottom:4}}>🏷 {m.tipe_mesin}</div>}
                  {m.divisi&&<div style={{fontSize:11,color:'#64748b',marginBottom:4}}>📍 {m.divisi}</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:6}}>
                    <span style={{fontSize:10,color:'#94a3b8'}}>{mLogs.length} breakdown</span>
                    {lastLog&&<span style={{fontSize:10,color:'#94a3b8'}}>Terakhir: {fmtDate(lastLog.created_at)}</span>}
                  </div>
                  <div style={{display:'flex',gap:4,marginTop:8,justifyContent:'flex-end'}}>
                    <button onClick={e=>{e.stopPropagation();setMachineModal({mode:'edit',id:m.id});setMachineForm({nama_mesin:m.nama_mesin,divisi:m.divisi||'',tipe_mesin:m.tipe_mesin||'',status_terakhir:m.status_terakhir});}}
                      style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();setDelMachine(m);}}
                      style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'2px 8px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Maintenance */}
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,flexWrap:'wrap' as const,gap:8}}>
            <div style={{fontWeight:800,fontSize:14,color:'#1e293b'}}>
              📋 {selMachine?`History — ${selMachine.nama_mesin}`:'Semua Log Maintenance'}
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap' as const}}>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
                style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:11,fontWeight:600,color:'#475569',background:'#f8fafc'}}>
                <option value="ALL">Semua Status</option>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                style={{padding:'5px 10px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:11,fontWeight:600,color:'#475569',background:'#f8fafc'}}>
                <option value="ALL">Semua Tipe</option>
                {TYPE_LIST.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              {selMachine&&(
                <Btn color="#16a34a" style={{fontSize:11,padding:'5px 14px'}} onClick={()=>{setLogModal({mode:'add',machine_id:selMachine.id});setLogForm({issue_title:'',issue_type:'Mechanical',problem_description:'',repair_action:'',technician:'',status:'Open',priority:'Medium',downtime_hours:0,start_date:'',finish_date:''});}}>
                  + Tambah Log
                </Btn>
              )}
            </div>
          </div>

          {filteredLogs.length===0?(
            <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
              <div style={{fontSize:40,marginBottom:12}}>📋</div>
              <div style={{fontSize:14,fontWeight:600}}>{selMachine?'Belum ada log maintenance':'Pilih mesin untuk lihat history'}</div>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column' as const,gap:10,maxHeight:600,overflowY:'auto' as const}}>
              {filteredLogs.map((l:any)=>{
                const sc=STATUS_COLOR[l.status]||STATUS_COLOR['Open'];
                const tc=TYPE_COLOR[l.issue_type]||'#64748b';
                const pc=PRIORITY_COLOR[l.priority]||'#f59e0b';
                const machineName=machines.find(m=>m.id===l.machine_id)?.nama_mesin||'—';
                return(
                  <Card key={l.id} style={{padding:'14px 16px',borderLeft:`4px solid ${sc.color}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:8}}>
                      <div style={{flex:1}}>
                        {!selMachine&&<div style={{fontSize:11,fontWeight:700,color:'#2563eb',marginBottom:4}}>🔧 {machineName}</div>}
                        <div style={{fontWeight:800,fontSize:14,color:'#1e293b',marginBottom:4}}>{l.issue_title}</div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap' as const,marginBottom:6}}>
                          <span style={{background:tc+'18',color:tc,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{l.issue_type}</span>
                          <span style={{background:pc+'18',color:pc,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>⚡ {l.priority}</span>
                          {l.downtime_hours>0&&<span style={{background:'#fef2f2',color:'#dc2626',borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>⏱ {l.downtime_hours}h downtime</span>}
                        </div>
                        {l.problem_description&&<div style={{fontSize:12,color:'#475569',marginBottom:4}}>❌ <strong>Masalah:</strong> {l.problem_description}</div>}
                        {l.repair_action&&<div style={{fontSize:12,color:'#16a34a',marginBottom:4}}>🔨 <strong>Perbaikan:</strong> {l.repair_action}</div>}
                        <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,fontSize:11,color:'#64748b',marginTop:6}}>
                          {l.start_date&&<span>📅 Mulai: <strong>{fmtDate(l.start_date)}</strong></span>}
                          {l.finish_date&&<span>✅ Selesai: <strong>{fmtDate(l.finish_date)}</strong></span>}
                          {l.technician&&<span>👤 Teknisi: <strong>{l.technician}</strong></span>}
                          {l.created_by&&<span>✍️ Dicatat: <strong>{l.created_by}</strong></span>}
                          <span style={{color:'#94a3b8'}}>{new Date(l.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',flexDirection:'column' as const,alignItems:'flex-end',gap:6,flexShrink:0}}>
                        <span style={{background:sc.bg,color:sc.color,border:`1px solid ${sc.border}`,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700}}>{l.status}</span>
                        <div style={{display:'flex',gap:4}}>
                          <button onClick={()=>{setLogModal({mode:'edit',id:l.id,machine_id:l.machine_id});setLogForm({issue_title:l.issue_title,issue_type:l.issue_type,problem_description:l.problem_description||'',repair_action:l.repair_action||'',technician:l.technician||'',status:l.status,priority:l.priority,downtime_hours:l.downtime_hours||0,start_date:l.start_date||'',finish_date:l.finish_date||'',});}}
                            style={{background:'none',border:'1px solid #e2e8f0',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:11,color:'#64748b'}}>✏️</button>
                          <button onClick={()=>setDelLog(l)}
                            style={{background:'none',border:'1px solid #fecaca',borderRadius:6,padding:'3px 10px',cursor:'pointer',fontSize:11,color:'#dc2626'}}>🗑</button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Mesin */}
      {machineModal&&(
        <Modal title={(machineModal.mode==='add'?'Tambah':'Edit')+' Mesin'} onClose={()=>setMachineModal(null)} width={440}>
          <div style={{display:'flex',flexDirection:'column' as const,gap:12}}>
            <div><Lbl>Nama Mesin</Lbl><Inp value={machineForm.nama_mesin} onChange={(e:any)=>setMachineForm({...machineForm,nama_mesin:e.target.value})} placeholder="Nama mesin..."/></div>
            <div><Lbl>Tipe Mesin</Lbl><Inp value={machineForm.tipe_mesin} onChange={(e:any)=>setMachineForm({...machineForm,tipe_mesin:e.target.value})} placeholder="CNC, Laser, Press, dll..."/></div>
            <div><Lbl>Divisi / Lokasi</Lbl><Inp value={machineForm.divisi} onChange={(e:any)=>setMachineForm({...machineForm,divisi:e.target.value})} placeholder="Mekanik, Painting, dll..."/></div>
            <div><Lbl>Status</Lbl>
              <Sel value={machineForm.status_terakhir} onChange={(e:any)=>setMachineForm({...machineForm,status_terakhir:e.target.value})}>
                <option value="Normal">✅ Normal</option>
                <option value="Maintenance">⚠️ Maintenance</option>
                <option value="Rusak">❌ Rusak</option>
              </Sel>
            </div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end',marginTop:20}}>
            <Btn outline color="#64748b" onClick={()=>setMachineModal(null)}>Batal</Btn>
            <Btn color="#1d4ed8" onClick={saveMachine}>{saving?'Menyimpan...':'Simpan'}</Btn>
          </div>
        </Modal>
      )}

      {/* Modal Log */}
      {logModal&&(
        <Modal title={(logModal.mode==='add'?'Tambah':'Edit')+' Maintenance Log'} onClose={()=>setLogModal(null)} width={520}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}><Lbl>Judul Masalah</Lbl><Inp value={logForm.issue_title} onChange={(e:any)=>setLogForm({...logForm,issue_title:e.target.value})} placeholder="Contoh: Motor Overheating..."/></div>
            <div><Lbl>Jenis Kerusakan</Lbl>
              <Sel value={logForm.issue_type} onChange={(e:any)=>setLogForm({...logForm,issue_type:e.target.value})}>
                {TYPE_LIST.map(t=><option key={t} value={t}>{t}</option>)}
              </Sel>
            </div>
            <div><Lbl>Priority</Lbl>
              <Sel value={logForm.priority} onChange={(e:any)=>setLogForm({...logForm,priority:e.target.value})}>
                {PRIORITY_LIST.map(p=><option key={p} value={p}>{p}</option>)}
              </Sel>
            </div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Deskripsi Masalah</Lbl>
              <textarea value={logForm.problem_description} onChange={(e:any)=>setLogForm({...logForm,problem_description:e.target.value})}
                placeholder="Detail masalah yang terjadi..."
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,minHeight:60,resize:'vertical' as const,fontFamily:'inherit'}}/>
            </div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Tindakan Perbaikan</Lbl>
              <textarea value={logForm.repair_action} onChange={(e:any)=>setLogForm({...logForm,repair_action:e.target.value})}
                placeholder="Apa yang dilakukan untuk perbaikan..."
                style={{width:'100%',padding:'8px 12px',borderRadius:8,border:'1.5px solid #e2e8f0',fontSize:12,minHeight:60,resize:'vertical' as const,fontFamily:'inherit'}}/>
            </div>
            <div><Lbl>Teknisi</Lbl><Inp value={logForm.technician} onChange={(e:any)=>setLogForm({...logForm,technician:e.target.value})} placeholder="Nama teknisi..."/></div>
            <div><Lbl>Downtime (jam)</Lbl><Inp type="number" min="0" value={logForm.downtime_hours} onChange={(e:any)=>setLogForm({...logForm,downtime_hours:Number(e.target.value)})}/></div>
            <div><Lbl>Tanggal Mulai</Lbl><Inp type="date" value={logForm.start_date} onChange={(e:any)=>setLogForm({...logForm,start_date:e.target.value})}/></div>
            <div><Lbl>Tanggal Selesai</Lbl><Inp type="date" value={logForm.finish_date} onChange={(e:any)=>setLogForm({...logForm,finish_date:e.target.value})}/></div>
            <div style={{gridColumn:'1/-1'}}><Lbl>Status</Lbl>
              <Sel value={logForm.status} onChange={(e:any)=>setLogForm({...logForm,status:e.target.value})}>
                {STATUS_LIST.map(s=><option key={s} value={s}>{s}</option>)}
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
      {delMachine&&(
        <Modal title="Hapus Mesin?" onClose={()=>setDelMachine(null)} width={360}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:32,marginBottom:8}}>🗑</div>
            <div style={{fontSize:13,color:'#64748b',marginBottom:20}}>Mesin <strong>{delMachine.nama_mesin}</strong> akan dipindah ke Recycle Bin.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn outline color="#64748b" onClick={()=>setDelMachine(null)}>Batal</Btn>
              <Btn color="#dc2626" onClick={hapusMachine}>Hapus</Btn>
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
