import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, Plus, Send, Copy, MessageCircle, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import RequestModal from '../../components/RequestModal'
import { targetLabel } from '../../lib/broadcastTargets'

// ── Campagnes du CM / CRM Client (dossier du 07/11/2026) ────────────────────
//  - Segments (C3) : filtres de la Base de données Clients enregistrés, pour
//    un envoi ciblé (niveau 1) ; destinataires recalculés à chaque envoi.
//  - Résultats (C4) : par envoi, destinataires et clients qui ont commandé
//    dans les 48 h.
//  - Codes de campagne (C6) : code de suivi sans avantage, saisi à
//    l'inscription (champ du code parrain) ; un code avec réduction ou course
//    offerte est une demande au Super Admin (PROMO_CODE).
// Serveur : /admin/cm/segments, /admin/cm/campaigns, /admin/cm/codes.
const FILTER_LABELS = { jamais: 'Jamais servis', inactifs: 'Inactifs 30 j', semaine: 'Inscrits cette semaine', fideles: 'Fidèles', relancer: 'À relancer' }
const fmt = d => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

function describeFilter(f = {}) {
  return [f.filter && FILTER_LABELS[f.filter], f.source && `source ${f.source.toLowerCase()}`, f.status && `statut ${f.status.toLowerCase()}`, f.q && `« ${f.q} »`].filter(Boolean).join(' · ') || 'Tous les clients'
}

export function SegmentsTab() {
  const navigate = useNavigate()
  const [segments, setSegments] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => api.get('/admin/cm/segments').then(r => setSegments(r.data?.segments ?? [])).catch(e => setError(e.response?.data?.message ?? 'Segments indisponibles.')), [])
  useEffect(() => { load() }, [load])

  async function remove(sg) {
    if (!window.confirm(`Supprimer le segment « ${sg.name} » ?`)) return
    try { await api.delete(`/admin/cm/segments/${sg.id}`); load() } catch (e) { setError(e.response?.data?.message ?? 'Suppression impossible.') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 820 }}>
      <p style={hint}>Un segment se crée depuis la Base de données Clients (« Créer un segment » avec les filtres choisis). Les clients bannis et ceux marqués « Ne plus relancer » n'en font jamais partie.</p>
      <div><button onClick={() => navigate('/base-clients')} style={btnOutline}><Plus size={14} /> Créer depuis la Base de données Clients</button></div>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      <div style={{ ...glass, padding: 0, overflow: 'hidden' }}>
        {!segments ? <div style={empty}>Chargement…</div>
        : segments.length === 0 ? <div style={empty}>Aucun segment.</div>
        : segments.map(sg => (
          <div key={sg.id} style={row}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{sg.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{describeFilter(sg.filter)} · créé le {fmt(sg.createdAt)}</div>
            </div>
            <strong style={{ fontSize: 13 }}>{sg.size} client{sg.size > 1 ? 's' : ''}</strong>
            <button onClick={() => navigate('/notifications?tab=envoyer')} style={btnOutline} title="Envoyer une notification à ce segment"><Send size={13} /> Envoyer</button>
            <button onClick={() => remove(sg)} style={{ ...btnOutline, color: '#e53e3e', borderColor: 'rgba(229,62,62,.3)' }} title="Supprimer"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ResultsTab() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/admin/cm/campaigns').then(r => setData(r.data)).catch(e => setError(e.response?.data?.message ?? 'Résultats indisponibles.'))
  }, [])
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>
  if (!data) return <div style={empty}>Chargement…</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={hint}>
        Clients qui ont commandé dans les {data.windowHours} h après l'envoi. Pour un segment, on compte parmi ses destinataires (conversion) ;
        pour tous les clients, c'est une simple concordance dans le temps.
      </p>
      <div style={{ ...glass, padding: '10px 14px', overflowX: 'auto' }}>
        {data.campaigns.length === 0 ? <div style={empty}>Aucun envoi aux clients.</div> : (
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead><tr>{['Envoi', 'Cible', 'Destinataires', 'Envoyées', `Ont commandé (${data.windowHours} h)`, 'Conversion'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.campaigns.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}><strong>{c.title}</strong><div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{fmt(c.sentAt)}</div></td>
                  <td style={td}>{targetLabel(c.target, c.segmentName)}</td>
                  <td style={td}>{c.recipients ?? '—'}</td>
                  <td style={td}>{c.sent ?? '—'}{c.failed ? <span style={{ color: '#ef4444' }}> · {c.failed} échec{c.failed > 1 ? 's' : ''}</span> : null}</td>
                  <td style={td}><strong>{c.buyers48h}</strong></td>
                  <td style={td}>{c.conversion != null ? `${c.conversion.toLocaleString('fr-FR')} %` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export function CodesTab({ asks }) {
  const [codes, setCodes] = useState(null)
  const [form, setForm] = useState({ code: '', name: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [promo, setPromo] = useState(null) // demande d'un code avec avantage
  const load = useCallback(() => api.get('/admin/cm/codes').then(r => setCodes(r.data?.codes ?? [])).catch(e => setError(e.response?.data?.message ?? 'Codes indisponibles.')), [])
  useEffect(() => { load() }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      await api.post('/admin/cm/codes', form)
      setForm({ code: '', name: '' }); setNotice('Code créé.'); load()
    } catch (err) { setError(err.response?.data?.message ?? 'Création impossible.') } finally { setBusy(false) }
  }
  async function toggle(c) {
    try { await api.patch(`/admin/cm/codes/${c.id}`, { active: !c.active }); load() } catch (err) { setError(err.response?.data?.message ?? 'Erreur.') }
  }
  const shareText = c => `Inscris-toi sur DEM et saisis le code ${c.code} à l'inscription : https://dem.sn`
  function copy(c) {
    navigator.clipboard?.writeText(shareText(c)).then(() => setNotice(`Message du code ${c.code} copié.`)).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
      <p style={hint}>
        Code de suivi, sans avantage : le client le saisit à l'inscription (champ du code parrain) et sa source devient « Code de campagne ».
        Un code avec réduction ou course offerte passe par le Super Admin.
      </p>
      <form onSubmit={create} style={{ ...glass, padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))} placeholder="CODE (ex. TABASKI26)" maxLength={20} style={{ ...glassInput, width: 180 }} />
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Campagne (ex. affiches marché Sandaga)" maxLength={80} style={{ ...glassInput, flex: '1 1 240px' }} />
        <button type="submit" disabled={busy || !form.code || !form.name.trim()} style={btnPrimary}><Plus size={14} /> Créer le code</button>
        {asks && <button type="button" onClick={() => setPromo({ name: '', code: '', type: 'PERCENT_OFF', value: '', maxUsesTotal: '' })} style={btnOutline}><Send size={13} /> Demander un code avec réduction</button>}
      </form>
      {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {notice && <div style={{ color: '#15803d', fontSize: 13, fontWeight: 600 }}>{notice}</div>}

      <div style={{ ...glass, padding: '10px 14px', overflowX: 'auto' }}>
        {!codes ? <div style={empty}>Chargement…</div> : codes.length === 0 ? <div style={empty}>Aucun code de campagne.</div> : (
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead><tr>{['Code', 'Campagne', 'Inscrits', 'Ont commandé', 'Courses livrées', 'Conversion', 'Actif', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize: 12.5, fontWeight: 700 }}>{c.code}</code></td>
                  <td style={td}>{c.name}<div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>créé le {fmt(c.createdAt)}</div></td>
                  <td style={td}><strong>{c.signups}</strong></td>
                  <td style={td}>{c.ordered}</td>
                  <td style={td}>{c.deliveredOrders}</td>
                  <td style={td}>{c.conversion != null ? `${c.conversion.toLocaleString('fr-FR')} %` : '—'}</td>
                  <td style={td}>
                    <button onClick={() => toggle(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.active ? 'var(--primary)' : 'var(--text-muted)', display: 'flex' }} title={c.active ? 'Désactiver' : 'Activer'}>
                      {c.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => copy(c)} style={{ ...btnOutline, padding: '5px 8px' }} title="Copier le message"><Copy size={13} /></button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(shareText(c))}`} target="_blank" rel="noreferrer" style={{ ...btnOutline, padding: '5px 8px', color: '#15803d' }} title="Partager sur WhatsApp"><MessageCircle size={13} /></a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {promo && (
        <RequestModal kind="PROMO_CODE" title="Demander un code avec réduction"
          intro="Code pour les clients, avec une réduction ou une course offerte."
          payload={{
            name: promo.name.trim(), code: promo.code.trim(), type: promo.type,
            value: promo.type === 'FREE_COURSE' ? null : Number(promo.value),
            maxUsesTotal: promo.maxUsesTotal ? Number(promo.maxUsesTotal) : null,
          }}
          ready={!!promo.name.trim() && !!promo.code.trim() && (promo.type === 'FREE_COURSE' || Number(promo.value) > 0)}
          onClose={() => setPromo(null)} onDone={text => { setPromo(null); setNotice(text) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <input value={promo.name} onChange={e => setPromo(p => ({ ...p, name: e.target.value }))} placeholder="Nom de la campagne" style={glassInput} />
            <input value={promo.code} onChange={e => setPromo(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s/g, '') }))} placeholder="CODE" maxLength={20} style={glassInput} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={promo.type} onChange={e => setPromo(p => ({ ...p, type: e.target.value }))} style={{ ...glassInput, width: 'auto' }}>
                <option value="PERCENT_OFF">Réduction %</option>
                <option value="FIXED_OFF">Réduction F</option>
                <option value="FREE_COURSE">Course offerte</option>
              </select>
              {promo.type !== 'FREE_COURSE' && <input type="number" min={1} value={promo.value} onChange={e => setPromo(p => ({ ...p, value: e.target.value }))} placeholder={promo.type === 'PERCENT_OFF' ? '%' : 'F'} style={{ ...glassInput, width: 90 }} />}
              <input type="number" min={1} value={promo.maxUsesTotal} onChange={e => setPromo(p => ({ ...p, maxUsesTotal: e.target.value }))} placeholder="Utilisations max (facultatif)" style={{ ...glassInput, width: 210 }} />
            </div>
          </div>
        </RequestModal>
      )}
    </div>
  )
}

const hint = { fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }
const empty = { color: 'var(--text-muted)', padding: 20, textAlign: 'center', fontSize: 13 }
const row = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }
const th = { textAlign: 'left', padding: '8px 8px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const td = { padding: '8px 8px', fontSize: 13, verticalAlign: 'top' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12.5, cursor: 'pointer', textDecoration: 'none' }
const btnPrimary = { ...btnOutline, color: '#fff', borderColor: 'var(--primary)', background: 'var(--primary)' }
