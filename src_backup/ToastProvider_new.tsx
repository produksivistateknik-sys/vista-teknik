// Toast Notification System
const ToastContext = React.createContext(null);

function ToastProvider({children, currentUser}:any){
  const [toasts,setToasts]=useState<any[]>([]);

  useEffect(()=>{
    if(!currentUser) return;
    const channel = supabase
      .channel('toast-activity')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'activity_log'},
        (payload:any)=>{
          const log = payload.new;
          // Hanya tampilkan notif dari admin LAIN
          const logAdmin = log.admin_nama||log.user_name||'';
          const myName = currentUser?.name||currentUser?.nama||'';
          if(!logAdmin||logAdmin===myName||logAdmin==='System') return;
          
          const MODULE_ICON:any={wo:'📋',raw:'📅',rencana:'📊',pekerja:'👥',auth:'🔐',kendala:'⚠️',raw_schedule:'📅',general:'⚙️'};
          const icon = MODULE_ICON[log.module||log.jenis]||'⚙️';
          
          const toast = {
            id: Date.now(),
            icon,
            admin: logAdmin,
            message: log.description||log.aktivitas||log.action||'Melakukan perubahan',
            module: log.module||log.jenis||'',
            time: new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),
          };
          setToasts(prev=>{
            const next = [toast,...prev].slice(0,3);
            return next;
          });
          // Auto remove setelah 5 detik
          setTimeout(()=>{
            setToasts(prev=>prev.filter(t=>t.id!==toast.id));
          },5000);
        }
      )
      .subscribe();
    return ()=>{ supabase.removeChannel(channel); };
  },[currentUser]);

  const removeToast=(id:number)=>setToasts(prev=>prev.filter(t=>t.id!==id));

  return(
    <ToastContext.Provider value={{toasts,removeToast}}>
      {children}
      {/* Toast Container */}
      <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,display:'flex',flexDirection:'column',gap:10,maxWidth:360}}>
        {toasts.map(t=>(
          <div key={t.id} style={{background:'#fff',borderRadius:14,padding:'12px 16px',
            boxShadow:'0 8px 32px #00000020',border:'1px solid #e2e8f0',
            borderLeft:`4px solid #2563eb`,
            display:'flex',gap:12,alignItems:'flex-start',
            animation:'slideInRight .3s ease'}}>
            <div style={{fontSize:20,flexShrink:0}}>{t.icon}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:12,color:'#1e293b',marginBottom:2}}>
                👤 {t.admin}
              </div>
              <div style={{fontSize:12,color:'#475569',lineHeight:1.4}}>{t.message}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{t.time} WIB</div>
            </div>
            <button onClick={()=>removeToast(t.id)}
              style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:16,padding:0,flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>
      <style>{`@keyframes slideInRight{from{opacity:0;transform:translateX(100%)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastContext.Provider>
  );
}
