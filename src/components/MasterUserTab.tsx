import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { activityLogService } from '../services/activityLogService'
import { Card, Lbl, Inp, Btn, Modal } from './ui/Primitives'
import { MasterPekerjaInline } from './MasterPekerjaInline'
import { SubBagianPasswordCard } from './SubBagianPasswordCard'

export function MasterUserTab({ admins, setAdmins, user, pekerja }){
  const [form, setForm] = useState({ nama: "", username: "", password: "", is_active: true });
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [showPwd, setShowPwd] = useState({});
  const [resetId, setResetId] = useState(null);
  const [newPwd, setNewPwd] = useState("");

  const save = async () => {
    if (!form.nama.trim() || !form.username.trim()) return;
    if (editId) {
      const { data, error } = await supabase
        .from("admins")
        .update({ nama: form.nama, username: form.username, is_active: form.is_active })
        .eq("id", editId).select().single();
      if (!error) {
        setAdmins(prev => prev.map(a => a.id === editId ? data : a));
        setEditId(null);
        setForm({ nama: "", username: "", password: "", is_active: true });
      }
    } else {
      if (!form.password.trim()) return;
      const { data, error } = await supabase
        .from("admins")
        .insert({ nama: form.nama, username: form.username, password: form.password, is_active: form.is_active })
        .select().single();
      if (!error) {
        setAdmins(prev => [...prev, data]);
        setForm({ nama: "", username: "", password: "", is_active: true });
      }
    }
  };

  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("admins").update({ password: newPwd }).eq("id", resetId);
    if (!error) {
      const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
      const uname=user?.name||user?.nama||sess?.nama||"Admin";
      const target=admins.find((a:any)=>a.id===resetId);
      await activityLogService.insert({user_name:uname,action:"RESET PASSWORD ADMIN",description:"Reset password admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
      setResetId(null); setNewPwd("");
    }
  };

  const toggleActive = async (id, val) => {
    await supabase.from("admins").update({ is_active: val }).eq("id", id);
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    const target=admins.find((a:any)=>a.id===id);
    await activityLogService.insert({user_name:uname,action:val?"AKTIFKAN ADMIN":"NONAKTIFKAN ADMIN",description:(val?"Aktifkan":"Nonaktifkan")+" admin: "+(target?.nama||"-"),module:"auth",halaman:"System"});
  };

  const del = async () => {
    const target=admins.find((a:any)=>a.id===delId);
    await supabase.from("admins").delete().eq("id", delId);
    setAdmins(prev => prev.filter(a => a.id !== delId));
    setDelId(null);
    const sess=JSON.parse(localStorage.getItem("vista_admin_session")||"{}");
    const uname=user?.name||user?.nama||sess?.nama||"Admin";
    await activityLogService.insert({user_name:uname,action:"HAPUS ADMIN",description:"Hapus admin: "+(target?.nama||"-")+" ("+target?.username+")",module:"auth",halaman:"System"});
  };

  const fmtTime = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + " " +
      new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const thS = {
    background: "#1e2330", color: "#c8d0e8", padding: "8px 10px",
    fontWeight: 600, fontSize: 10, textAlign: "left" as const,
    whiteSpace: "nowrap" as const, borderRight: "1px solid #ffffff10",
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{"⚙️"}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>Admin</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Akun login untuk dashboard admin Vista Teknik</div>
          </div>
          <span style={{ marginLeft: "auto", background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700 }}>{admins.length} admin</span>
        </div>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>{editId ? "Edit Admin" : "Tambah Admin Baru"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div><Lbl>Nama Lengkap</Lbl><Inp value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama admin..." /></div>
            <div><Lbl>Username</Lbl><Inp value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username_admin" /></div>
            {!editId && (<div><Lbl>Password</Lbl><Inp type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Password awal..." /></div>)}
            <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Aktif
              </label>
              <Btn color="#1d4ed8" onClick={save}>{editId ? "Simpan" : "+ Tambah"}</Btn>
              {editId && (<Btn outline color="#64748b" onClick={() => { setEditId(null); setForm({ nama: "", username: "", password: "", is_active: true }); }}>Batal</Btn>)}
            </div>
          </div>
        </Card>
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={thS}>NAMA</th>
              <th style={thS}>USERNAME</th>
              <th style={thS}>PASSWORD</th>
              <th style={{ ...thS, textAlign: "center" as const }}>STATUS</th>
              <th style={thS}>LAST LOGIN</th>
              <th style={thS}>DIBUAT</th>
              <th style={{ ...thS, textAlign: "center" as const }}>AKSI</th>
            </tr></thead>
            <tbody>
              {admins.map((a, i) => {
                const rBg = i % 2 === 0 ? "#fff" : "#f8fafc";
                const td: any = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", background: rBg, verticalAlign: "middle" };
                const isSelf = user?.id === a.id;
                return (
                  <tr key={a.id}>
                    <td style={{ ...td, fontWeight: 700, color: "#1e293b" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#1d4ed8", flexShrink: 0 }}>{a.nama?.slice(0, 2).toUpperCase()}</div>
                        {a.nama}
                        {isSelf && (<span style={{ fontSize: 10, background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "1px 7px", fontWeight: 700 }}>Saya</span>)}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#475569" }}>{a.username}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#94a3b8", letterSpacing: 2 }}>{showPwd[a.id] ? a.password : "••••••••"}</span>
                        <button onClick={() => setShowPwd(prev => ({ ...prev, [a.id]: !prev[a.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, padding: 0 }}>{showPwd[a.id] ? "hide" : "show"}</button>
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <button onClick={() => !isSelf && toggleActive(a.id, !a.is_active)}
                        style={{ background: a.is_active ? "#f0fdf4" : "#fef2f2", border: "1px solid "+(a.is_active ? "#bbf7d0" : "#fecaca"), color: a.is_active ? "#16a34a" : "#dc2626", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, cursor: isSelf ? "not-allowed" : "pointer" }}>
                        {a.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(a.last_login)}</td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(a.created_at)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button onClick={() => { setEditId(a.id); setForm({ nama: a.nama, username: a.username, password: a.password, is_active: a.is_active }); }} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#475569" }}>Edit</button>
                        <button onClick={() => { setResetId(a.id); setNewPwd(""); }} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#92400e" }}>Reset Pwd</button>
                        {!isSelf && (<button onClick={() => setDelId(a.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#dc2626" }}>Hapus</button>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (<tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>Belum ada admin</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ borderTop: "2px dashed #e2e8f0", margin: "8px 0 28px" }} />
      <MasterPekerjaInline pekerja={pekerja} />
      <SubBagianPasswordCard/>
      {resetId && (
        <Modal title="Reset Password Admin" onClose={() => setResetId(null)} width={380}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>Reset password untuk <strong>{admins.find(a => a.id === resetId)?.nama}</strong></div>
          <Lbl>Password Baru</Lbl>
          <Inp type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Password baru..." style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setResetId(null)}>Batal</Btn>
            <Btn color="#f59e0b" onClick={resetPwd}>Reset Password</Btn>
          </div>
        </Modal>
      )}
      {delId && (
        <Modal title="Hapus Admin?" onClose={() => setDelId(null)} width={360}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>Admin <strong>{admins.find(a => a.id === delId)?.nama}</strong> akan dihapus permanen.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
