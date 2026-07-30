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

// Deteksi link download hasil generate_export di teks jawaban AI - baik dalam bentuk markdown
// link [label](url) maupun URL polos - biar bisa dirender jadi tombol download, bukan teks
// link biasa. Match spesifik ke ekstensi pdf/docx/xlsx (+ query string token signed URL).
const EXPORT_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^\s)]+\.(pdf|docx|xlsx)(?:\?[^\s)]*)?)\)|(https?:\/\/[^\s)]+\.(pdf|docx|xlsx)(?:\?[^\s)]*)?)/g

type MsgSegment = { type: 'text'; value: string } | { type: 'export'; url: string; format: string }

function parseMessageSegments(text: string): MsgSegment[] {
  const segments: MsgSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  EXPORT_LINK_RE.lastIndex = 0
  while ((match = EXPORT_LINK_RE.exec(text))) {
    if (match.index > lastIndex) segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    const url = match[2] || match[4]
    const format = match[3] || match[5]
    segments.push({ type: 'export', url, format })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', value: text.slice(lastIndex) })
  return segments.length ? segments : [{ type: 'text', value: text }]
}

const EXPORT_META: Record<string, { icon: string; label: string; color: string }> = {
  pdf: { icon: 'ti ti-file-type-pdf', label: 'PDF', color: '#dc2626' },
  docx: { icon: 'ti ti-file-type-doc', label: 'Word', color: '#2563eb' },
  xlsx: { icon: 'ti ti-file-type-xls', label: 'Excel', color: '#16a34a' },
}

function ExportDownloadButton({ url, format }: { url: string; format: string }) {
  const meta = EXPORT_META[format] || { icon: 'ti ti-file', label: format.toUpperCase(), color: '#64748b' }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${meta.color}40`, borderRadius: 10, padding: '8px 14px', margin: '4px 0', textDecoration: 'none', color: '#1e293b', fontSize: 13, fontWeight: 600 }}>
      <i className={meta.icon} style={{ fontSize: 18, color: meta.color }} />
      <span>Download {meta.label}</span>
      <i className="ti ti-download" style={{ fontSize: 13, color: '#94a3b8', marginLeft: 2 }} />
    </a>
  )
}

// Pesan ramah buat user - error teknis mentah dari backend (timeout Gemini dkk) gak pernah
// ditampilin langsung, selalu dipetakan ke sini dulu. code:'TIMEOUT' dari backend (sudah lewat
// 1x retry otomatis di sisi server) jadi kasus utama.
const pesanErrorRamah = (code?: string) =>
  code === 'TIMEOUT'
    ? 'Maaf, sistem AI sedang lambat merespons. Coba kirim ulang pertanyaannya sebentar lagi.'
    : 'Maaf, ada gangguan menghubungi AI Assistant. Coba kirim ulang sebentar lagi.'

export function AiAssistantChat() {
  const [contents, setContents] = useState<ChatContent[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingLama, setLoadingLama] = useState(false)
  const [error, setError] = useState('')
  const [lastAttempt, setLastAttempt] = useState<ChatContent[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [contents, loading])

  const kirimKePayload = async (payloadContents: ChatContent[]) => {
    setError('')
    setLastAttempt(null)
    setLoading(true)
    // Kalau prosesnya kelamaan (indikasi backend lagi retry internal), kasih tau user sistem
    // masih jalan bukan diam macet - bukan cuma "Mikir..." tanpa kepastian.
    const timerLama = setTimeout(() => setLoadingLama(true), 8000)
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-agent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${supabaseAnonKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: payloadContents }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        const err: any = new Error(json.error || `Error ${res.status}`)
        err.code = json.code
        throw err
      }
      setContents(json.contents)
    } catch (e: any) {
      setError(pesanErrorRamah(e?.code))
      setContents(payloadContents)
      setLastAttempt(payloadContents)
    } finally {
      clearTimeout(timerLama)
      setLoadingLama(false)
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const kirim = (teks?: string) => {
    const pertanyaan = (teks ?? input).trim()
    if (!pertanyaan || loading) return
    setInput('')
    const newContents: ChatContent[] = [...contents, { role: 'user', parts: [{ text: pertanyaan }] }]
    setContents(newContents)
    kirimKePayload(newContents)
  }

  const cobaLagi = () => {
    if (lastAttempt && !loading) kirimKePayload(lastAttempt)
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
              <div style={{ padding: '9px 14px', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', textAlign: 'left', background: c.role === 'user' ? '#2563eb' : '#f1f5f9', color: c.role === 'user' ? '#fff' : '#1e293b' }}>
                {parseMessageSegments(textOf(c.parts)).map((seg, j) =>
                  seg.type === 'export'
                    ? <ExportDownloadButton key={j} url={seg.url} format={seg.format} />
                    : <span key={j}>{seg.value}</span>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start', padding: '9px 14px', borderRadius: 12, background: '#f1f5f9', color: '#94a3b8', fontSize: 12.5, textAlign: 'left' }}>
              {loadingLama ? 'Masih diproses, ini agak lama dari biasanya...' : 'Mikir...'}
            </div>
          )}
          {error && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 8, padding: '9px 14px', borderRadius: 12, background: '#fee2e2', color: '#dc2626', fontSize: 12.5, maxWidth: '90%', textAlign: 'left' }}>
              <span>{error}</span>
              {lastAttempt && (
                <button onClick={cobaLagi} disabled={loading}
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #dc262640', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#dc2626', cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                  <i className="ti ti-refresh" style={{ fontSize: 13 }} />
                  Coba Lagi
                </button>
              )}
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
            style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'inherit', textAlign: 'left' }}
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
