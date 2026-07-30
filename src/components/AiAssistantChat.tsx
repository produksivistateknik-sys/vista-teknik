import { useState, useRef, useEffect } from 'react'
import { supabaseUrl, supabaseAnonKey } from '../lib/supabase'

// Format pesan native Gemini: {role:'user'|'model', parts:[{text} | {functionCall} | {functionResponse}]}.
// Disimpan apa adanya (bukan dikonversi ke format lain) biar stateless round-trip ke ai-agent
// selalu konsisten - frontend nyimpen histori penuh, backend gak nyimpen sesi apapun.
type ChatContent = { role: 'user' | 'model'; parts: any[] }

const CONTOH_PERTANYAAN = [
  'WO apa aja yang lagi terlambat?',
  'progress panel apa gimana sekarang?',
  'kapasitas POTONG hari ini penuh gak?',
  'siapa aja yang lagi kerja sekarang?',
]

export function AiAssistantChat() {
  const [contents, setContents] = useState<ChatContent[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [contents, loading])

  const kirim = async (teks?: string) => {
    const pertanyaan = (teks ?? input).trim()
    if (!pertanyaan || loading) return
    setInput('')
    setError('')
    const newContents: ChatContent[] = [...contents, { role: 'user', parts: [{ text: pertanyaan }] }]
    setContents(newContents)
    setLoading(true)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: newContents }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || `Error ${res.status}`)
      setContents(json.contents)
    } catch (e: any) {
      setError(e?.message || 'Gagal menghubungi AI Assistant.')
      setContents(newContents)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const textOf = (parts: any[]): string => (parts || []).filter((p) => p.text).map((p) => p.text).join('\n')
  const displayMsgs = contents.filter((c) => textOf(c.parts).trim().length > 0)

  return (
    <div className="fi" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <i className="ti ti-sparkles" style={{ fontSize: 19, color: '#2563eb' }} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary,#1e293b)' }}>AI Assistant</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>v1 · read-only · tanya apa aja soal kondisi produksi</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--card-bg,#fff)', border: '0.5px solid var(--border-color,#e5e8ed)', borderRadius: 12, overflow: 'hidden' }}>
        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayMsgs.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 40 }}>
              <i className="ti ti-sparkles" style={{ fontSize: 34, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 13, marginBottom: 16 }}>Tanya soal WO, panel, progress, kapasitas, kendala, dan lainnya.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 480, margin: '0 auto' }}>
                {CONTOH_PERTANYAAN.map((c) => (
                  <button key={c} onClick={() => kirim(c)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
          {displayMsgs.map((c, i) => (
            <div key={i} style={{ alignSelf: c.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{ padding: '9px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: c.role === 'user' ? '#2563eb' : '#f1f5f9', color: c.role === 'user' ? '#fff' : '#1e293b' }}>
                {textOf(c.parts)}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 12, background: '#f1f5f9', color: '#94a3b8', fontSize: 12.5 }}>
              Mikir...
            </div>
          )}
          {error && (
            <div style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 12, background: '#fee2e2', color: '#dc2626', fontSize: 12.5, maxWidth: '90%' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '0.5px solid var(--border-color,#e5e8ed)', flexShrink: 0 }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim() } }}
            placeholder="Tulis pertanyaan..."
            disabled={loading}
            autoFocus
            style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            onClick={() => kirim()}
            disabled={loading || !input.trim()}
            style={{ background: loading || !input.trim() ? '#cbd5e1' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '0 18px', cursor: loading || !input.trim() ? 'default' : 'pointer', fontSize: 13.5, fontWeight: 700 }}
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  )
}
