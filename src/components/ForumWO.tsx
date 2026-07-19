import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function ForumWO({user}:any){
  const [posts,setPosts]=useState<any[]>([]);
  const [attachMap,setAttachMap]=useState<Record<number,any[]>>({});
  const [caption,setCaption]=useState("");
  const [files,setFiles]=useState<File[]>([]);
  const [uploading,setUploading]=useState(false);
  const [loading,setLoading]=useState(true);
  const [searchQuery,setSearchQuery]=useState("");
  const [filterAuthor,setFilterAuthor]=useState("ALL");

  const fetchPosts=async()=>{
    setLoading(true);
    const{data:p}=await supabase.from("fcs_forum_post").select("*").order("created_at",{ascending:false});
    setPosts(p??[]);
    if(p&&p.length>0){
      const ids=p.map((x:any)=>x.id);
      const{data:a}=await supabase.from("fcs_forum_attachment").select("*").in("post_id",ids).order("uploaded_at",{ascending:true});
      const map:Record<number,any[]>={};
      (a??[]).forEach((att:any)=>{
        if(!map[att.post_id])map[att.post_id]=[];
        map[att.post_id].push(att);
      });
      setAttachMap(map);
    } else {
      setAttachMap({});
    }
    setLoading(false);
  };

  useEffect(()=>{
    fetchPosts();
    const ch=supabase.channel("realtime-forum-wo")
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_forum_post"},fetchPosts)
      .on("postgres_changes",{event:"*",schema:"public",table:"fcs_forum_attachment"},fetchPosts)
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  const handleFileSelect=(e:any)=>{
    const picked=Array.from(e.target.files||[]) as File[];
    setFiles(prev=>[...prev,...picked]);
  };

  const removeSelectedFile=(idx:number)=>{
    setFiles(prev=>prev.filter((_,i)=>i!==idx));
  };

  const submitPost=async()=>{
    if(!caption.trim()&&files.length===0){alert("Tulis caption atau lampirkan minimal 1 file");return;}
    setUploading(true);
    const authorName=user?.name||user?.nama||"Admin";
    const{data:post,error:postErr}=await supabase.from("fcs_forum_post").insert({
      author_name:authorName,
      caption:caption.trim()||null,
    }).select().single();
    if(postErr||!post){
      alert("Gagal membuat post: "+(postErr?.message||"unknown error"));
      setUploading(false);
      return;
    }
    for(const file of files){
      const ext=file.name.split(".").pop();
      const safeName=`${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const path=`${post.id}/${safeName}`;
      const{error:upErr}=await supabase.storage.from("Forum-attachments").upload(path,file);
      if(upErr){
        alert("Gagal upload file "+file.name+": "+upErr.message);
        continue;
      }
      const{data:urlData}=supabase.storage.from("Forum-attachments").getPublicUrl(path);
      await supabase.from("fcs_forum_attachment").insert({
        post_id:post.id,
        file_name:file.name,
        file_url:urlData.publicUrl,
        file_type:file.type,
        file_size:file.size,
      });
    }
    setCaption("");
    setFiles([]);
    setUploading(false);
    await fetchPosts();
  };

  const deletePost=async(postId:number)=>{
    if(!confirm("Hapus post ini beserta semua lampirannya?"))return;
    const atts=attachMap[postId]||[];
    for(const att of atts){
      const path=att.file_url.split("/Forum-attachments/")[1];
      if(path){await supabase.storage.from("Forum-attachments").remove([path]);}
    }
    await supabase.from("fcs_forum_post").delete().eq("id",postId);
    await fetchPosts();
  };

  const fmtDateTime=(d:string)=>d?new Date(d).toLocaleString("id-ID",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"-";

  const fmtRelativeTime=(d:string)=>{
    if(!d)return "-";
    const diffMs=Date.now()-new Date(d).getTime();
    const diffMin=Math.floor(diffMs/60000);
    if(diffMin<1)return "Baru saja";
    if(diffMin<60)return `${diffMin} menit lalu`;
    const diffJam=Math.floor(diffMin/60);
    if(diffJam<24)return `${diffJam} jam lalu`;
    const diffHari=Math.floor(diffJam/24);
    if(diffHari<7)return `${diffHari} hari lalu`;
    return fmtDateTime(d);
  };

  const fmtFileSize=(bytes:number)=>{
    if(!bytes)return "";
    if(bytes<1024)return bytes+" B";
    if(bytes<1024*1024)return Math.round(bytes/1024)+" KB";
    return (bytes/(1024*1024)).toFixed(1)+" MB";
  };

  const fileIconInfo=(type:string)=>{
    if(type?.includes("pdf"))return{icon:"ti ti-file-type-pdf",bg:"#fee2e2",color:"#dc2626",label:"PDF"};
    if(type?.includes("image"))return{icon:"ti ti-photo",bg:"#dbeafe",color:"#1d4ed8",label:"Gambar"};
    if(type?.includes("sheet")||type?.includes("excel"))return{icon:"ti ti-file-spreadsheet",bg:"#dcfce7",color:"#16a34a",label:"Spreadsheet"};
    if(type?.includes("word")||type?.includes("document"))return{icon:"ti ti-file-text",bg:"#dbeafe",color:"#1d4ed8",label:"Dokumen"};
    return{icon:"ti ti-file",bg:"#f1f5f9",color:"#64748b",label:"File"};
  };

  const filteredPosts=posts.filter((p:any)=>{
    if(filterAuthor!=="ALL"&&p.author_name!==filterAuthor)return false;
    if(!searchQuery.trim())return true;
    const q=searchQuery.toLowerCase();
    const captionMatch=(p.caption||"").toLowerCase().includes(q);
    const fileMatch=(attachMap[p.id]||[]).some((att:any)=>(att.file_name||"").toLowerCase().includes(q));
    return captionMatch||fileMatch;
  });

  return(
    <div className="fi">
      <div style={{fontWeight:800,fontSize:20,color:"#1e293b",marginBottom:4}}>📢 Forum WO</div>
      <div style={{fontSize:12,color:"#64748b",marginBottom:16}}>Bagikan update, revisi, atau dokumen Work Order ke seluruh tim</div>

      <div style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderRadius:10,padding:16,marginBottom:20}}>
        <textarea value={caption} onChange={(e:any)=>setCaption(e.target.value)}
          placeholder="Tulis update, revisi, atau catatan disini..."
          style={{width:"100%",minHeight:70,padding:"10px 12px",borderRadius:8,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",resize:"vertical" as const}}/>
        {files.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap" as const,gap:8,marginTop:10}}>
            {files.map((f,idx)=>(
              <div key={idx} style={{display:"flex",alignItems:"center",gap:6,background:"#f1f5f9",borderRadius:6,padding:"5px 10px",fontSize:12}}>
                <span>{fileIconInfo(f.type).label==="PDF"?"📕":fileIconInfo(f.type).label==="Gambar"?"🖼️":fileIconInfo(f.type).label==="Spreadsheet"?"📊":fileIconInfo(f.type).label==="Dokumen"?"📄":"📎"}</span>
                <span style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{f.name}</span>
                <button onClick={()=>removeSelectedFile(idx)} style={{border:"none",background:"none",cursor:"pointer",color:"#dc2626",fontWeight:700,fontSize:13}}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
          <label style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:7,border:"1px solid #e2e8f0",background:"#f8fafc",cursor:"pointer",fontSize:12,fontWeight:600,color:"#475569"}}>
            📎 Lampirkan File
            <input type="file" multiple onChange={handleFileSelect} style={{display:"none"}}/>
          </label>
          <button onClick={submitPost} disabled={uploading}
            style={{padding:"8px 20px",borderRadius:7,border:"none",background:uploading?"#94a3b8":"#1d4ed8",color:"#fff",fontSize:13,fontWeight:700,cursor:uploading?"default":"pointer",fontFamily:"inherit"}}>
            {uploading?"Mengunggah...":"Post"}
          </button>
        </div>
      </div>

      {posts.length>0&&(
        <div style={{display:"flex",gap:10,marginBottom:16}}>
          <div style={{flex:1,position:"relative" as const}}>
            <i className="ti ti-search" style={{position:"absolute" as const,left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#94a3b8"}}/>
            <input value={searchQuery} onChange={(e:any)=>setSearchQuery(e.target.value)}
              placeholder="Cari caption atau nama file..."
              style={{width:"100%",padding:"8px 12px 8px 34px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit"}}/>
          </div>
          <select value={filterAuthor} onChange={(e:any)=>setFilterAuthor(e.target.value)}
            style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid #e2e8f0",fontSize:13,fontFamily:"inherit",background:"#fff",minWidth:160}}>
            <option value="ALL">Semua Penulis</option>
            {Array.from(new Set(posts.map((p:any)=>p.author_name))).map((name:any)=>(
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}
      {loading?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8"}}>Memuat...</div>
      ):posts.length===0?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8",fontSize:13}}>Belum ada post. Jadilah yang pertama membagikan update!</div>
      ):filteredPosts.length===0?(
        <div style={{textAlign:"center" as const,padding:40,color:"#94a3b8",fontSize:13}}>Tidak ada post yang cocok dengan pencarian.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column" as const,gap:14}}>
          {filteredPosts.map((p:any)=>(
            <div key={p.id} style={{background:"var(--card-bg,#fff)",border:"1px solid var(--border-color,#e2e8f0)",borderLeft:"3px solid #1d4ed8",borderRadius:10,padding:"16px 20px",textAlign:"left" as const}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"#eff6ff",color:"#1d4ed8",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:13,flexShrink:0}}>
                    {(p.author_name||"A").slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#1e293b",textAlign:"left" as const}}>{p.author_name}</div>
                    <div style={{fontSize:11,color:"#94a3b8",textAlign:"left" as const,marginTop:1}}>{fmtRelativeTime(p.created_at)}</div>
                  </div>
                </div>
                <button onClick={()=>deletePost(p.id)}
                  style={{border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:15,padding:4}}
                  title="Hapus post"><i className="ti ti-trash"/></button>
              </div>
              {p.caption&&(
                <div style={{marginTop:14,fontSize:14,color:"#1e293b",whiteSpace:"pre-wrap" as const,lineHeight:1.6,textAlign:"left" as const}}>{p.caption}</div>
              )}
              {(attachMap[p.id]||[]).length>0&&(
                <div style={{display:"flex",flexDirection:"column" as const,gap:8,marginTop:14}}>
                  {(attachMap[p.id]||[]).map((att:any)=>{
                    const fi=fileIconInfo(att.file_type);
                    return(
                      <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"1px solid #e2e8f0",borderRadius:8,textDecoration:"none",transition:"border-color .15s"}}
                        onMouseEnter={(e:any)=>e.currentTarget.style.borderColor="#cbd5e1"}
                        onMouseLeave={(e:any)=>e.currentTarget.style.borderColor="#e2e8f0"}>
                        <div style={{width:32,height:32,borderRadius:6,background:fi.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <i className={fi.icon} style={{fontSize:16,color:fi.color}}/>
                        </div>
                        <div style={{flex:1,minWidth:0,textAlign:"left" as const}}>
                          <div style={{fontSize:13,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis" as const,whiteSpace:"nowrap" as const}}>{att.file_name}</div>
                          <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{fi.label}{att.file_size?" · "+fmtFileSize(att.file_size):""}</div>
                        </div>
                        <i className="ti ti-external-link" style={{fontSize:14,color:"#94a3b8",flexShrink:0}}/>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
