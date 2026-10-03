import { useState } from "react";
import { supabase } from "../lib/supabase";
import { uploadToR2, deleteFromR2, extractR2Key } from "../lib/r2Client";
import { activityLogService } from "../services/activityLogService";
import { Card } from "./ui/Primitives";

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD MOM FAT - sisi ADMIN/Engineering (3 Okt 2026, perubahan alur diminta user). Dulu QC yang
// upload & OCR di Vista Pekerja; sekarang Admin/Engineering yang upload dokumen MOM (PDF/foto),
// OCR (Tesseract + pdf.js, lib/ocrHelpers.ts - salinan dari vista-pekerja) mengusulkan daftar poin,
// Admin MENINJAU & MENGOREKSI poin (OCR kadang salah baca), lalu menerbitkan ke QC. QC di Vista
// Pekerja cuma centang + foto per poin. Item checklist = punch list per dokumen (tidak ada
// template baku - dicek dari 3 dokumen yang ada, keputusan user 3 Okt 2026).
// Upload lewat uploadToR2 (pola sama WO Digital). Library OCR (~MB) dimuat lazy HANYA saat tombol
// "Baca Dokumen" ditekan.
// ─────────────────────────────────────────────────────────────────────────────
type Draft = { teks: string; confidence: number | null };
const tipeFile = (f: File): "pdf" | "image" | null =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : f.type.startsWith("image/") || /\.(jpe?g|png)$/i.test(f.name) ? "image" : null;
const BATAS_YAKIN = 70; // sama dgn OCR_CONFIDENCE_THRESHOLD (lib/ocrHelpers.ts), tanpa memuat library OCR

export function MomFatUploadPanel({ uname, onSelesai, onBatal }: { uname: string; onSelesai: () => void; onBatal: () => void }) {
  const [judul, setJudul] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const [ocrPct, setOcrPct] = useState(0);
  const [tahap, setTahap] = useState<"" | "ocr" | "simpan">("");
  const [poinBaru, setPoinBaru] = useState("");

  const pilihFile = (f: File | null) => {
    if (!f) return;
    if (!tipeFile(f)) { alert("File harus PDF atau foto (JPG/PNG)."); return; }
    setFile(f); setDraft(null);
  };

  const bacaDokumen = async () => {
    if (!file) { alert("Pilih dokumen dulu."); return; }
    setTahap("ocr"); setOcrPct(0);
    try {
      const { ocrDocument } = await import("../lib/ocrHelpers");
      const lines = await ocrDocument(file, setOcrPct);
      setDraft(lines.map(l => ({ teks: l.teks, confidence: l.confidence })));
      if (lines.length === 0) alert("Tidak ada teks yang terbaca dari dokumen. Isi poin manual di bawah.");
    } catch (err: any) {
      console.error("[MOM FAT] OCR gagal:", err);
      alert("Gagal membaca dokumen (OCR): " + (err?.message || err) + "\n\nPoin tetap bisa diisi manual di bawah.");
      setDraft([]);
    } finally {
      setTahap("");
    }
  };

  const ubahPoin = (i: number, teks: string) => setDraft(d => d!.map((x, j) => j === i ? { ...x, teks } : x));
  const hapusPoin = (i: number) => setDraft(d => d!.filter((_, j) => j !== i));
  const geser = (i: number, arah: -1 | 1) => setDraft(d => { const a = [...d!]; const j = i + arah; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const tambahPoin = () => { const t = poinBaru.trim(); if (!t) return; setDraft(d => [...(d || []), { teks: t, confidence: null }]); setPoinBaru(""); };

  const terbitkan = async () => {
    const poin = (draft || []).map(p => ({ ...p, teks: p.teks.trim() })).filter(p => p.teks);
    if (!judul.trim()) { alert("Judul dokumen wajib diisi."); return; }
    if (!file) { alert("Pilih dokumen dulu."); return; }
    if (!poin.length) { alert("Belum ada poin checklist. Baca dokumen (OCR) atau tambah poin manual dulu."); return; }
    if (!confirm(`Terbitkan "${judul.trim()}" dengan ${poin.length} poin ke QC?`)) return;
    setTahap("simpan");
    const ft = tipeFile(file)!;
    let fileUrl = "", momFatId: number | null = null;
    try {
      const ext = ft === "pdf" ? "pdf" : (file.type.split("/")[1] || "jpg");
      fileUrl = await uploadToR2(file, `mom-fat/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`, file.type || (ft === "pdf" ? "application/pdf" : "image/jpeg"));
      const { data: row, error } = await (supabase.from("mom_fat" as any) as any).insert({
        judul: judul.trim(), file_url: fileUrl, file_type: ft, status: "ready", pekerja_id: null, operator_nama: uname,
      }).select().single();
      if (error || !row) throw new Error("simpan dokumen: " + (error?.message || "tidak ada data"));
      momFatId = row.id;
      const { error: pErr } = await (supabase.from("mom_fat_poin" as any) as any).insert(
        poin.map((p, i) => ({ mom_fat_id: momFatId, urutan: i + 1, teks: p.teks, ocr_confidence: p.confidence })))
      if (pErr) throw new Error("simpan poin checklist: " + pErr.message);
      await activityLogService.insert({ user_name: uname, action: "UPLOAD MOM FAT", module: "qc", halaman: "MOM FAT",
        description: `Upload MOM FAT "${judul.trim()}" (${ft}, ${poin.length} poin) - diterbitkan ke QC` });
      alert(`MOM FAT "${judul.trim()}" diterbitkan ke QC (${poin.length} poin).`);
      onSelesai();
    } catch (err: any) {
      console.error("[MOM FAT] terbitkan gagal:", err);
      // rollback supaya tidak ada dokumen setengah jadi di daftar QC
      if (momFatId) { const { error } = await (supabase.from("mom_fat" as any) as any).delete().eq("id", momFatId); if (error) console.error("rollback mom_fat gagal:", error) }
      if (fileUrl) { const k = extractR2Key(fileUrl); if (k) await deleteFromR2(k).catch(e => console.error("rollback file R2 gagal:", e)) }
      alert("Gagal menerbitkan MOM FAT: " + (err?.message || err) + "\n\nTidak ada yang tersimpan - coba lagi.");
    } finally {
      setTahap("");
    }
  };

  const sibuk = tahap !== "";
  const inp = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color,#e2e8f0)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const, background: "var(--card-bg,#fff)", color: "var(--text-primary,#1e293b)" };
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: "var(--text-primary,#1e293b)", marginBottom: 4 }}>📄 Upload MOM FAT</div>
      <div style={{ fontSize: 11.5, color: "#94a3b8", marginBottom: 14 }}>Upload dokumen MOM, baca otomatis jadi poin checklist, koreksi seperlunya, lalu terbitkan ke QC. QC hanya mencentang & memberi foto per poin.</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,2fr) auto", gap: 10, alignItems: "end", marginBottom: 12 }}>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>JUDUL DOKUMEN</div>
          <input value={judul} onChange={e => setJudul(e.target.value)} disabled={sibuk} placeholder="mis. FAT CIMORY CITEUREUP - 19 Agustus 2026" style={inp} /></div>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>DOKUMEN (PDF / FOTO)</div>
          <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={sibuk} onChange={e => pilihFile(e.target.files?.[0] || null)} style={{ ...inp, padding: "6px 8px" }} /></div>
        <button onClick={bacaDokumen} disabled={sibuk || !file}
          style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: !file || sibuk ? "#cbd5e1" : "#0f766e", color: "#fff", fontWeight: 700, fontSize: 13, cursor: !file || sibuk ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {tahap === "ocr" ? `Membaca... ${ocrPct}%` : "🔍 Baca Dokumen"}
        </button>
      </div>
      {draft && (
        <div style={{ border: "1px solid var(--border-color,#e2e8f0)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>Tinjau poin checklist ({draft.length}) — koreksi teks, hapus baris yang bukan poin (header, tanda tangan, dll)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {draft.map((p, i) => {
              const ragu = p.confidence != null && p.confidence < BATAS_YAKIN;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", width: 22, textAlign: "right" as const }}>{i + 1}.</span>
                  <input value={p.teks} onChange={e => ubahPoin(i, e.target.value)} disabled={sibuk}
                    style={{ ...inp, padding: "7px 10px", border: `1px solid ${ragu ? "#fbbf24" : "var(--border-color,#e2e8f0)"}`, background: ragu ? "#fffbeb" : inp.background }} />
                  {ragu && <span title="Hasil OCR kurang yakin - cek manual" style={{ fontSize: 10, fontWeight: 800, color: "#b45309", whiteSpace: "nowrap" }}>⚠️ cek</span>}
                  <button onClick={() => geser(i, -1)} disabled={sibuk || i === 0} title="Naik" style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>▲</button>
                  <button onClick={() => geser(i, 1)} disabled={sibuk || i === draft.length - 1} title="Turun" style={{ border: "none", background: "none", cursor: "pointer", color: "#64748b" }}>▼</button>
                  <button onClick={() => hapusPoin(i)} disabled={sibuk} title="Hapus" style={{ border: "none", background: "none", cursor: "pointer", color: "#dc2626" }}>✕</button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input value={poinBaru} onChange={e => setPoinBaru(e.target.value)} onKeyDown={e => { if (e.key === "Enter") tambahPoin(); }} disabled={sibuk} placeholder="Tambah poin manual..." style={inp} />
            <button onClick={tambahPoin} disabled={sibuk} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>+ Tambah</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onBatal} disabled={sibuk} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Batal</button>
        <button onClick={terbitkan} disabled={sibuk || !draft}
          style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: sibuk || !draft ? "#cbd5e1" : "#1d4ed8", color: "#fff", fontWeight: 700, fontSize: 13, cursor: sibuk || !draft ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {tahap === "simpan" ? "Menerbitkan..." : "Terbitkan ke QC"}
        </button>
      </div>
    </Card>
  );
}
