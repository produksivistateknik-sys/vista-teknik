import shutil, sys
from pathlib import Path

APP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx")
BACKUP_PATH = Path(r"C:\Users\User\vista-teknik\src\App.tsx.bak_masteruser")

print("📖 Membaca App.tsx...")
content = APP_PATH.read_text(encoding="utf-8")

print("📦 Backup App.tsx...")
shutil.copy2(APP_PATH, BACKUP_PATH)
print(f"✅ Backup: {BACKUP_PATH}")

# ════════════════════════════════════════════════════════
# HELPER: cari batas fungsi dengan hitung kurung kurawal
# Lebih ketat: cari "function NAMA(" lalu cari { pembuka pertama
# ════════════════════════════════════════════════════════
def find_function_bounds(text, func_name):
    import re
    # cari semua kemunculan "function NamaFungsi("
    pattern = rf'\nfunction {re.escape(func_name)}\s*\('
    matches = list(re.finditer(pattern, text))
    if not matches:
        return -1, -1
    # ambil yang pertama
    match = matches[0]
    func_start = match.start() + 1  # +1 skip \n di depan
    
    # cari kurung kurawal pembuka pertama setelah signature
    # harus melewati parameter function dulu
    # cari { yang merupakan body function (bukan di dalam parameter)
    i = match.end()
    paren_depth = 1  # sudah melewati '(' pembuka
    # skip parameter
    while i < len(text) and paren_depth > 0:
        if text[i] == '(':
            paren_depth += 1
        elif text[i] == ')':
            paren_depth -= 1
        i += 1
    # sekarang cari { body
    while i < len(text) and text[i] != '{':
        i += 1
    if i >= len(text):
        return -1, -1
    brace_start = i
    
    # hitung kurung kurawal sampai depth kembali ke 0
    depth = 0
    i = brace_start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return func_start, i + 1
        i += 1
    return -1, -1

# ════════════════════════════════════════════════════════
# FUNGSI BARU: MasterUserTab
# ════════════════════════════════════════════════════════
NEW_MASTER_USER_TAB = r"""function MasterUserTab({ admins, setAdmins, user }){
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
    if (!error) { setResetId(null); setNewPwd(""); }
  };

  const toggleActive = async (id, val) => {
    await supabase.from("admins").update({ is_active: val }).eq("id", id);
    setAdmins(prev => prev.map(a => a.id === id ? { ...a, is_active: val } : a));
  };

  const del = async () => {
    await supabase.from("admins").delete().eq("id", delId);
    setAdmins(prev => prev.filter(a => a.id !== delId));
    setDelId(null);
  };

  const fmtTime = (ts) => {
    if (!ts) return "\u2014";
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
      <MasterPekerjaInline />
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
"""

# ════════════════════════════════════════════════════════
# FUNGSI BARU: MasterPekerjaInline
# ════════════════════════════════════════════════════════
NEW_MASTER_PEKERJA_INLINE = r"""function MasterPekerjaInline(){
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
  const [editId, setEditId] = useState<any>(null);
  const [delId, setDelId] = useState<any>(null);
  const [showPwd, setShowPwd] = useState<any>({});
  const [resetId, setResetId] = useState<any>(null);
  const [newPwd, setNewPwd] = useState("");
  const [filterDiv, setFilterDiv] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("operator_users")
        .select("*")
        .order("divisi", { ascending: true })
        .order("nama", { ascending: true });
      if (!error) setOps(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const opDiv = Object.entries(DIVISI_CONFIG)
    .filter(([k]) => OPERATOR_ROLES.includes(k))
    .map(([k, v]: any) => ({ key: k, ...v }));

  const save = async () => {
    if (!form.nama.trim() || !form.username.trim()) return;
    if (editId) {
      const { data, error } = await supabase
        .from("operator_users")
        .update({ nama: form.nama, username: form.username, divisi: form.divisi, is_active: form.is_active })
        .eq("id", editId).select().single();
      if (!error) {
        setOps(p => p.map((o: any) => o.id === editId ? data : o));
        setEditId(null);
        setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
      }
    } else {
      if (!form.password.trim()) return;
      const { data, error } = await supabase
        .from("operator_users")
        .insert({ nama: form.nama, username: form.username, password: form.password, divisi: form.divisi, is_active: form.is_active })
        .select().single();
      if (!error) {
        setOps(p => [...p, data]);
        setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true });
      }
    }
  };

  const resetPwd = async () => {
    if (!newPwd.trim()) return;
    const { error } = await supabase.from("operator_users").update({ password: newPwd }).eq("id", resetId);
    if (!error) { setResetId(null); setNewPwd(""); }
  };

  const toggleActive = async (id: any, val: boolean) => {
    await supabase.from("operator_users").update({ is_active: val }).eq("id", id);
    setOps(p => p.map((o: any) => o.id === id ? { ...o, is_active: val } : o));
  };

  const del = async () => {
    await supabase.from("operator_users").delete().eq("id", delId);
    setOps(p => p.filter((o: any) => o.id !== delId));
    setDelId(null);
  };

  const fmtTime = (ts: string) => {
    if (!ts) return "\u2014";
    return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) +
      " " + new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const filtered = ops.filter((o: any) =>
    (filterDiv === "ALL" || o.divisi === filterDiv) &&
    (!search || o.nama.toLowerCase().includes(search.toLowerCase()) ||
      o.username.toLowerCase().includes(search.toLowerCase()))
  );

  const thS: any = {
    background: "#1e2330", color: "#c8d0e8", padding: "8px 10px",
    fontWeight: 600, fontSize: 10, textAlign: "left",
    whiteSpace: "nowrap", borderRight: "1px solid #ffffff10",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{"👷"}</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1e293b" }}>User Pekerja</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>Akun login untuk Vista Pekerja (username + password)</div>
        </div>
        <span style={{ marginLeft: "auto", background: "#f0fdf4", color: "#16a34a", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700 }}>{ops.length} pekerja</span>
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b", marginBottom: 14 }}>{editId ? "Edit User Pekerja" : "Tambah User Pekerja"}</div>
        <div style={{ display: "grid", gridTemplateColumns: editId ? "1fr 1fr 1fr auto" : "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
          <div><Lbl>Nama Lengkap</Lbl><Inp value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama pekerja..." /></div>
          <div><Lbl>Username</Lbl><Inp value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="username_pekerja" /></div>
          {!editId && (<div><Lbl>Password</Lbl><Inp type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Default: 1234" /></div>)}
          <div><Lbl>Divisi</Lbl>
            <Sel value={form.divisi} onChange={e => setForm({ ...form, divisi: e.target.value })}>
              {opDiv.map((d: any) => (<option key={d.key} value={d.key}>{d.icon} {d.label}</option>))}
            </Sel>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", paddingBottom: 2 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Aktif
            </label>
            <Btn color="#16a34a" onClick={save}>{editId ? "Simpan" : "+ Tambah"}</Btn>
            {editId && (<Btn outline color="#64748b" onClick={() => { setEditId(null); setForm({ nama: "", username: "", password: "1234", divisi: "mekanik", is_active: true }); }}>Batal</Btn>)}
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau username..."
          style={{ height: 30, padding: "0 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, background: "#f8fafc", outline: "none", color: "#1e293b", fontFamily: "inherit", width: 220 }} />
        <button onClick={() => setFilterDiv("ALL")}
          style={{ padding: "4px 14px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 700, border: filterDiv === "ALL" ? "1.5px solid #1d4ed8" : "1.5px solid #e2e8f0", background: filterDiv === "ALL" ? "#1d4ed8" : "#fff", color: filterDiv === "ALL" ? "#fff" : "#64748b" }}>
          Semua ({ops.length})
        </button>
        {opDiv.map((d: any) => {
          const cnt = ops.filter((o: any) => o.divisi === d.key).length;
          const isSel = filterDiv === d.key;
          return (
            <button key={d.key} onClick={() => setFilterDiv(isSel ? "ALL" : d.key)}
              style={{ padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 700, border: isSel ? "1.5px solid "+d.color : "1.5px solid #e2e8f0", background: isSel ? d.color+"18" : "#fff", color: isSel ? d.color : "#64748b" }}>
              {d.icon} {d.label} ({cnt})
            </button>
          );
        })}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>Memuat data...</div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr>
              <th style={thS}>NAMA</th>
              <th style={thS}>USERNAME</th>
              <th style={thS}>PASSWORD</th>
              <th style={thS}>DIVISI</th>
              <th style={{ ...thS, textAlign: "center" }}>STATUS</th>
              <th style={thS}>LAST LOGIN</th>
              <th style={thS}>DIBUAT</th>
              <th style={{ ...thS, textAlign: "center" }}>AKSI</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#94a3b8" }}>{search || filterDiv !== "ALL" ? "Tidak ada pekerja ditemukan" : "Belum ada user pekerja"}</td></tr>
              ) : filtered.map((o: any, i: number) => {
                const dc: any = DIVISI_CONFIG[o.divisi] || {};
                const rBg = i % 2 === 0 ? "#fff" : "#f8fafc";
                const td: any = { padding: "9px 10px", borderBottom: "1px solid #f1f5f9", borderRight: "1px solid #f1f5f9", background: rBg, verticalAlign: "middle" };
                return (
                  <tr key={o.id}>
                    <td style={{ ...td, fontWeight: 700, color: "#1e293b" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: dc.bg || "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: dc.color || "#64748b", flexShrink: 0 }}>{o.nama?.slice(0, 2).toUpperCase()}</div>
                        {o.nama}
                      </div>
                    </td>
                    <td style={{ ...td, fontFamily: "monospace", color: "#475569" }}>{o.username}</td>
                    <td style={td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace", color: "#94a3b8", letterSpacing: 2, fontSize: 12 }}>{showPwd[o.id] ? o.password : "••••••••"}</span>
                        <button onClick={() => setShowPwd((p: any) => ({ ...p, [o.id]: !p[o.id] }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13, padding: 0 }}>{showPwd[o.id] ? "hide" : "show"}</button>
                      </div>
                    </td>
                    <td style={td}>{dc.label && (<span style={{ background: dc.bg, color: dc.color, border: "1px solid "+dc.color+"30", borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>{dc.icon} {dc.label}</span>)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <button onClick={() => toggleActive(o.id, !o.is_active)}
                        style={{ background: o.is_active ? "#f0fdf4" : "#fef2f2", border: "1px solid "+(o.is_active ? "#bbf7d0" : "#fecaca"), color: o.is_active ? "#16a34a" : "#dc2626", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {o.is_active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(o.last_login)}</td>
                    <td style={{ ...td, fontSize: 11, color: "#94a3b8" }}>{fmtTime(o.created_at)}</td>
                    <td style={{ ...td, textAlign: "center" as const }}>
                      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                        <button onClick={() => { setEditId(o.id); setForm({ nama: o.nama, username: o.username, password: o.password, divisi: o.divisi, is_active: o.is_active }); }} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#475569" }}>Edit</button>
                        <button onClick={() => { setResetId(o.id); setNewPwd(""); }} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#92400e" }}>Reset Pwd</button>
                        <button onClick={() => setDelId(o.id)} style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11, color: "#dc2626" }}>Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {resetId && (
        <Modal title="Reset Password Pekerja" onClose={() => setResetId(null)} width={380}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 14 }}>Reset password untuk <strong>{ops.find((o: any) => o.id === resetId)?.nama}</strong></div>
          <Lbl>Password Baru</Lbl>
          <Inp type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && resetPwd()} placeholder="Password baru..." style={{ marginBottom: 16 }} />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setResetId(null)}>Batal</Btn>
            <Btn color="#f59e0b" onClick={resetPwd}>Reset Password</Btn>
          </div>
        </Modal>
      )}
      {delId && (
        <Modal title="Hapus User Pekerja?" onClose={() => setDelId(null)} width={360}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 20 }}>User <strong>{ops.find((o: any) => o.id === delId)?.nama}</strong> akan dihapus permanen.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn outline color="#64748b" onClick={() => setDelId(null)}>Batal</Btn>
            <Btn color="#dc2626" onClick={del}>Hapus</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
"""

# ════════════════════════════════════════════════════════
# EKSEKUSI REPLACE
# ════════════════════════════════════════════════════════

# 1. Replace MasterUserTab
print("🔄 Replace MasterUserTab...")
s1, e1 = find_function_bounds(content, "MasterUserTab")
if s1 == -1:
    print("❌ ERROR: MasterUserTab tidak ditemukan!")
    sys.exit(1)
print(f"   Ditemukan karakter {s1}–{e1}, panjang {e1-s1} chars")

# Verifikasi: cek closing } ada di posisi yang benar
snippet_end = content[e1-50:e1+50]
print(f"   Konteks akhir fungsi: ...{repr(snippet_end[-30:])}")

content = content[:s1] + NEW_MASTER_USER_TAB + "\n" + content[e1:]

# 2. Sisipkan MasterPekerjaInline tepat setelah MasterUserTab
print("➕ Sisipkan MasterPekerjaInline setelah MasterUserTab...")
s_new, e_new = find_function_bounds(content, "MasterUserTab")
if s_new == -1:
    print("❌ ERROR: MasterUserTab baru tidak ditemukan!")
    sys.exit(1)
content = content[:e_new] + "\n\n" + NEW_MASTER_PEKERJA_INLINE + "\n" + content[e_new:]
print("   ✅ MasterPekerjaInline disisipkan")

# 3. Verifikasi kedua fungsi ada
import re
fns = re.findall(r'function\s+(\w+)\s*\(', content)
print(f"\n📋 Verifikasi fungsi:")
print(f"   MasterUserTab: {'✅' if 'MasterUserTab' in fns else '❌'}")
print(f"   MasterPekerjaInline: {'✅' if 'MasterPekerjaInline' in fns else '❌'}")
print(f"   Total fungsi: {len(fns)}")

# 4. Simpan
print("\n💾 Menyimpan App.tsx...")
APP_PATH.write_text(content, encoding="utf-8")

print("\n✅ SELESAI! Jalankan: npm run dev")
