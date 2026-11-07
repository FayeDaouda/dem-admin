import { useState } from 'react'
import { Paperclip, X } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import { REQUEST_KIND_LABELS } from '../lib/requestKinds'

// ── « Demander » au Super Admin (Responsable de flottes, niveau 2) ──────────
// Motif obligatoire, détail, pièce jointe facultative (photo, capture), case
// « Urgent » (le Super Admin est alerté tout de suite). La demande arrive dans
// Validation › Demandes Flotte ; le demandeur la suit dans « Mes demandes ».
//
// children : champs propres au type ; `payload` (objet) les transmet, et
// `ready` (booléen) bloque l'envoi tant qu'ils ne sont pas remplis.
export default function RequestModal({ kind, title, intro, targetUserId, payload, ready = true, children, onClose, onDone }) {
  const [reason, setReason]   = useState('')
  const [detail, setDetail]   = useState('')
  const [urgent, setUrgent]   = useState(false)
  const [file, setFile]       = useState(null) // { url, name }
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function attach(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploading(true); setError('')
    try {
      const form = new FormData()
      form.append('file', f)
      const { data } = await api.post('/admin/requests/attachment', form)
      setFile({ url: data.url, name: f.name })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Envoi de la pièce jointe impossible.')
    } finally { setUploading(false); e.target.value = '' }
  }

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Le motif est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      await api.post('/admin/requests', {
        kind, targetUserId: targetUserId ?? undefined, payload: payload ?? {},
        reason: reason.trim(), detail: detail.trim() || undefined, attachmentUrl: file?.url, urgent,
      })
      onDone(`Demande envoyée au Super Admin${urgent ? ' (urgente)' : ''}. Suivez-la dans « Mes demandes ».`)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Envoi impossible.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={() => !saving && onClose()}>
      <form style={box} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>{title ?? REQUEST_KIND_LABELS[kind] ?? kind}</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          {intro ?? 'Cette action demande la validation du Super Admin.'} Elle s'applique automatiquement s'il la valide.
        </p>

        {children}

        <label style={labelStyle}>Motif *</label>
        <input value={reason} onChange={e => setReason(e.target.value)} maxLength={255} placeholder="Pourquoi cette demande" style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 12 }}>Détail</label>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={3} maxLength={2000} placeholder="Faits, dates, échanges avec le coursier ou le client…" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {file ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
              <Paperclip size={13} /> <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a>
              <button type="button" onClick={() => setFile(null)} style={iconBtn} title="Retirer"><X size={13} /></button>
            </span>
          ) : (
            <label style={{ ...btnOutline, cursor: uploading ? 'wait' : 'pointer' }}>
              <Paperclip size={13} /> {uploading ? 'Envoi…' : 'Pièce jointe (photo, capture)'}
              <input type="file" accept="image/*" onChange={attach} disabled={uploading} style={{ display: 'none' }} />
            </label>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: urgent ? '#dc2626' : 'var(--text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ accentColor: '#dc2626' }} /> Urgent
          </label>
        </div>

        {error && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnOutline}>Annuler</button>
          <button type="submit" disabled={saving || uploading || !ready} style={{ ...btnPrimary, opacity: saving || uploading || !ready ? 0.6 : 1 }}>
            {saving ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </form>
    </div>
  )
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }
const box        = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '22px 26px', width: 480, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const iconBtn    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }
