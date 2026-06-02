with open('src/App.tsx', encoding='utf-8') as f:
    c = f.read()

rb_start = c.index('function RecycleBinTab({user}:any){')
rb_end = c.index('\nfunction SystemTab(', rb_start)

new_rb = '''function RecycleBinTab({user}:any){
  const [items,setItems]=useState<any[]>([]);
  const [loading,setLoading]=useState(true);
  const [filterCat,setFilterCat]=useState("ALL");
  const CATS:any={work_orders:{label:"Work Order"},mesin:{label:"Mesin"},pekerja:{label:"Pekerja"},raw_schedule:{label:"Raw Schedule"},renhar:{label:"Rencana Harian"},kendala:{label:"Kendala"}};
  useEffect(()=>{
    const load=async()=>{
      setLoading(true);
      const cats=["work_orders","mesin","pekerja","raw_schedule","renhar","kendala"];
      const results=await Promise.all(cats.map((t:string)=>supabase.from(t).select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false})));
      const all:any[]=[];
      results.forEach(({data}:any,i:number)=>{(data??[]).forEach((row:any)=>all.push({...row,_cat:cats[i]}));});
      all.sort((a:any,b:any)=>new Date(b.deleted_at).getTime()-new Date(a.deleted_at).getTime());
      setItems(all);setLoading(false);
    };load();
  },[]);
  const sisa=(d:string)=>Math.max(0,15-Math.floor((new Date().getTime()-new Date(d).getTime())/86400000));
  const fmt=(ts:string)=>ts?new Date(ts).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"}):"--";
  const getTitle=(item:any):string=>{
    if(item._cat==="work_orders")return"WO-"+item.wo+" -- "+item.proyek;
    if(item._cat==="mesin")return(item.kode||"")+" -- "+(item.nama||"");
    if(item._cat==="pekerja")return item.nama||"--";
    if(item._cat==="raw_schedule")return(item.panel||"")+" ("+item.proses+")";
    if(item._cat==="renhar")return(item.panel||"")+" -- "+(item.proses||"");
    if(item._cat==="kendala")return(item.catatan||"").slice(0,60);
    return"--";
  };
  const restore=async(item:any)=>{
    await supabase.from(item._cat).update({deleted_at:null,deleted_by:null}).eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
  };
  const permDel=async(item:any)=>{
    await supabase.from(item._cat).delete().eq("id",item.id);
    setItems(prev=>prev.filter((x:any)=>!(x.id===item.id&&x._cat===item._cat)));
  };
  const filtered=filterCat==="ALL"?items:items.filter((x:any)=>x._cat===filterCat);
  const counts:any={};items.forEach((x:any)=>{counts[x._cat]=(counts[x._cat]||0)+1;});
  const thS:any={background:"#1e2330",color:"#c8d0e8",padding:"8px 10px",fontWeight:600,fontSize:10,textAlign:"left",whiteSpace:"nowrap",borderRight:"1px solid #ffffff10"};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:16}}>
        {[{l:"Total Item",v:items.length,c:"#2563eb"},{l:"Kritis 3 hari",v:items.filter((x:any)=>sisa(x.deleted_at)<=3).length,c:"#dc2626"},{l:"Auto-delete",v:"15 hari",c:"#16a34a"},{l:"Kategori",v:Object.keys(CATS).length,c:"#8b5cf6"}].map((s:any,i:number)=>(
          <Card key={i} style={{padding:"12px 16px",borderLeft:3px solid }}>
            <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
            <div style={{fontSize:10,color:"#94a3b8",fontWeight:600,textTransform:"uppercase",letterSpacing:.3,marginTop:2}}>{s.l}</div>
          </Card>
        ))}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <button onClick={()=>setFilterCat("ALL")} style={{padding:"5px 12px",borderRadius:20,border:1.5px solid ,background:filterCat==="ALL"?"#1d4ed8":"#fff",color:filterCat==="ALL"?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>Semua ({items.length})</button>
        {Object.entries(CATS).map(([k,v]:any)=>counts[k]>0&&(
          <button key={k} onClick={()=>setFilterCat(filterCat===k?"ALL":k)} style={{padding:"5px 12px",borderRadius:20,border:1.5px solid ,background:filterCat===k?"#1d4ed8":"#fff",color:filterCat===k?"#fff":"#64748b",cursor:"pointer",fontSize:11,fontWeight:700}}>{v.label} ({counts[k]})</button>
        ))}
        <div style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>Item otomatis dihapus setelah 15 hari</div>
      </div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:"#94a3b8"}}>Memuat...</div>:filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px",color:"#94a3b8"}}><div style={{fontSize:32,marginBottom:8}}>🗑</div><div style={{fontSize:13,fontWeight:600}}>Recycle bin kosong</div><div style={{fontSize:12,marginTop:4}}>Semua data aktif</div></div>
      ):(
        <div style={{overflowX:"auto",borderRadius:10,border:"1px solid #e2e8f0"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr><th style={thS}>Kategori</th><th style={thS}>Item</th><th style={thS}>Dihapus Oleh</th><th style={thS}>Dihapus Pada</th><th style={{...thS,textAlign:"center"}}>Sisa Hari</th><th style={{...thS,textAlign:"center"}}>Aksi</th></tr></thead>
            <tbody>
              {filtered.map((item:any,i:number)=>{
                const cat=CATS[item._cat];
                const s=sisa(item.deleted_at);
                const sc=s<=3?"#dc2626":s<=7?"#f59e0b":"#16a34a";
                const bg=i%2===0?"#fff":"#f8fafc";
                const td:any={padding:"9px 10px",borderBottom:"1px solid #f1f5f9",borderRight:"1px solid #f1f5f9",background:bg,verticalAlign:"middle"};
                return(
                  <tr key={item._cat+"-"+item.id}>
                    <td style={td}><span style={{background:"#f1f5f9",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700,color:"#475569"}}>{cat?.label}</span></td>
                    <td style={{...td,fontWeight:600,color:"#1e293b"}}>{getTitle(item)}</td>
                    <td style={{...td,color:"#64748b"}}>{item.deleted_by||"--"}</td>
                    <td style={{...td,fontSize:11,color:"#94a3b8"}}>{fmt(item.deleted_at)}</td>
                    <td style={{...td,textAlign:"center"}}><span style={{background:sc+"18",color:sc,border:"1px solid "+sc+"33",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:700}}>{s} hari</span></td>
                    <td style={{...td,textAlign:"center"}}>
                      <div style={{display:"flex",gap:5,justifyContent:"center"}}>
                        <button onClick={()=>restore(item)} style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#16a34a",fontWeight:700}}>Pulihkan</button>
                        <button onClick={()=>permDel(item)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#dc2626"}}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
'''

c = c[:rb_start] + new_rb + c[rb_end:]

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Done! Lines:', c.count('\n'))
print('RecycleBinTab count:', c.count('function RecycleBinTab'))
