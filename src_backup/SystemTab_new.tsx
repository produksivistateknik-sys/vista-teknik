function RecycleBin({user}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState('ALL');

  const load=async()=>{
    setLoading(true);
    const [wo,raw,pkr,rnh]=await Promise.all([
      supabase.from('work_orders').select('*').not('deleted_at','is',null),
      supabase.from('raw_schedule').select('*').not('deleted_at','is',null),
      supabase.from('pekerja').select('*').not('deleted_at','is',null),
      supabase.from('renhar').select('*').not('deleted_at','is',null),
    ]);
    const all=[
      ...(wo.data||[]).map(i=>({...i,_type:'wo',_label:'Work Order',_name:i.wo+' - '+i.proyek})),
      ...(raw.data||[]).map(i=>({...i,_type:'raw',_label:'Raw Schedule',_name:i.proses+' - '+i.panel})),
      ...(pkr.data||[]).map(i=>({...i,_type:'pekerja',_label:'Pekerja',_name:i.nama})),
      ...(rnh.data||[]).map(i=>({...i,_type:'renhar',_label:'Rencana Harian',_name:i.proses+' - '+i.panel})),
    ].sort((a,b)=>new Date(b.deleted_at).getTime()-new Date(a.deleted_at).getTime());
    setItems(all);
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const restore=async(item:any)=>{
    await supabase.from(
      item._type==='wo'?'work_orders':
      item._type==='raw'?'raw_schedule':
      item._type==='pekerja'?'pekerja':'renhar'
    ).update({deleted_at:null,deleted_by:null}).eq('id',item.id);
    await load();
  };

  const deletePermanent=async(item:any)=>{
    await supabase.from(
      item._type==='wo'?'work_orders':
      item._type==='raw'?'raw_schedule':
      item._type==='pekerja'?'pekerja':'renhar'
    ).delete().eq('id',item.id);
    await load();
  };

  const TYPE_COLOR:any={wo:'#2563eb',raw:'#f59e0b',pekerja:'#0891b2',renhar:'#10b981'};
  const filtered=filter==='ALL'?items:items.filter(i=>i._type===filter);

  const fmtDate=(d:string)=>new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  const daysLeft=(d:string)=>Math.max(0,15-Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24)));

  if(loading) return <div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Memuat...</div>;

  return(
    <div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap' as const,alignItems:'center'}}>
        {['ALL','wo','raw','pekerja','renhar'].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:'6px 14px',borderRadius:20,border:`1.5px solid ${filter===f?(TYPE_COLOR[f]||'#1d4ed8'):'#e2e8f0'}`,
              background:filter===f?(TYPE_COLOR[f]||'#1d4ed8')+'18':'#fff',
              color:filter===f?(TYPE_COLOR[f]||'#1d4ed8'):'#64748b',
              cursor:'pointer',fontSize:12,fontWeight:700}}>
            {f==='ALL'?'Semua':f==='wo'?'Work Order':f==='raw'?'Raw Schedule':f==='pekerja'?'Pekerja':'Rencana Harian'}
            {' '}({f==='ALL'?items.length:items.filter(i=>i._type===f).length})
          </button>
        ))}
      </div>
      {filtered.length===0?(
        <div style={{textAlign:'center',padding:'60px 20px',color:'#94a3b8'}}>
          <div style={{fontSize:40,marginBottom:12}}>🗑</div>
          <div style={{fontSize:14,fontWeight:600}}>Recycle Bin Kosong</div>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
          {filtered.map((item:any)=>{
            const c=TYPE_COLOR[item._type]||'#64748b';
            const days=daysLeft(item.deleted_at);
            return(
              <div key={item._type+item.id} style={{background:'#fff',borderRadius:12,border:'1px solid #e2e8f0',
                padding:'12px 16px',borderLeft:`4px solid ${c}`,display:'flex',alignItems:'center',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13,color:'#1e293b'}}>{item._name}</div>
                  <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap' as const}}>
                    <span style={{background:c+'18',color:c,borderRadius:20,padding:'1px 8px',fontSize:10,fontWeight:700}}>{item._label}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>Dihapus: {fmtDate(item.deleted_at)}</span>
                    {item.deleted_by&&<span style={{fontSize:11,color:'#94a3b8'}}>oleh {item.deleted_by}</span>}
                    <span style={{fontSize:11,color:days<=3?'#dc2626':'#f59e0b',fontWeight:700}}>⏱ {days} hari tersisa</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:6}}>
                  <Btn color="#16a34a" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>restore(item)}>↩ Pulihkan</Btn>
                  <Btn color="#dc2626" style={{fontSize:11,padding:'5px 12px'}} onClick={()=>deletePermanent(item)}>🗑 Hapus</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SystemTab({user,logActivity,activityLog,pekerja,setPekerja,createPekerja,updatePekerja,removePekerja}:any){
  const [subTab,setSubTab]=useState('masteruser');
  const SUB_TABS=[
    {id:'masteruser',label:'👤 Master User'},
    {id:'activity',label:'📊 Activity Log'},
    {id:'recycle',label:'🗑 Recycle Bin'},
  ];
  return(
    <div className="fi">
      <div style={{display:'flex',gap:8,marginBottom:16,borderBottom:'2px solid #e2e8f0',paddingBottom:8}}>
        {SUB_TABS.map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)}
            style={{padding:'8px 20px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',
              fontWeight:700,fontSize:13,
              background:subTab===t.id?'#1d4ed8':'transparent',
              color:subTab===t.id?'#fff':'#64748b',
              borderBottom:subTab===t.id?'2px solid #1d4ed8':'none',
              transition:'all .15s'}}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab==='masteruser'&&<MasterUser logActivity={logActivity} user={user}/>}
      {subTab==='activity'&&<ActivityLogView activityLog={activityLog} user={user}/>}
      {subTab==='recycle'&&<RecycleBin user={user}/>}
    </div>
  );
}
