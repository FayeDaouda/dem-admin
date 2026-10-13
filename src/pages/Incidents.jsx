import { useState, useEffect, useCallback } from 'react'
import { useLocation, useSearchParams, Link } from 'react-router-dom'
import { AlertTriangle, RefreshCw, Flag, X, Phone, MessageCircle, ChevronDown, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import { connectSocket } from '../lib/socket'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../lib/glassStyles'
import { useAuth } from '../contexts/AuthContext'
import SosPhonesCard from './SosPhonesCard'
import ReportUserModal from '../components/ReportUserModal'
import PageHeader from '../components/PageHeader'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { cancelReasonLabel } from '../lib/cancelReasons'

// ── Constantes ────────────────────────────────────────────────────────────────
const SEVERITY_CFG = {
  critical: { bg: '#ef444420', color: '#ef4444', label: 'Critique', rank: 0 },
  high:     { bg: '#f9731620', color: '#f97316', label: 'Élevé',    rank: 1 },
  medium:   { bg: '#f59e0b20', color: '#f59e0b', label: 'Moyen',    rank: 2 },
  low:      { bg: '#6366f120', color: '#818cf8', label: 'Faible',   rank: 3 },
}

const STATUS_CFG = {
  OPEN:          { bg: '#ef444420', color: '#ef4444', label: 'Nouveau'  },
  INVESTIGATING: { bg: '#f59e0b20', color: '#f59e0b', label: 'En cours' },
  RESOLVED:      { bg: '#22c55e20', color: '#22c55e', label: 'Résolu'   },
}

// Types créés par le serveur (admin.incidents.js, driver-sos.service.js,
// admin.report.controller.js)
const TYPE_LABELS = {
  SOS:                'Alerte SOS coursier',
  DRIVER_ABANDONED:   'Coursier disparu (course acceptée)',
  DRIVER_UNREACHABLE: 'Coursier injoignable (colis récupéré)',
  PAYMENT_DISPUTE:    'Litige de paiement',
  ORDER_STUCK:        'Course bloquée',
  USER_REPORT:        'Signalement d’un utilisateur',
}

const VIEWS = [
  { key: 'open',     label: 'À traiter', match: i => i.status !== 'RESOLVED' },
  { key: 'resolved', label: 'Résolus',   match: i => i.status === 'RESOLVED' },
  { key: 'all',      label: 'Tous',      match: () => true },
]

const STALE_HOURS = 24 // un incident ouvert depuis plus longtemps s'affiche en orange

function hoursSince(date) {
  return date ? (Date.now() - new Date(date).getTime()) / 3_600_000 : null
}

function formatAge(date) {
  const h = hoursSince(date)
  if (h == null) return '—'
  if (h < 1) return `${Math.max(0, Math.round(h * 60))} min`
  if (h < 24) return `${Math.floor(h)} h`
  return `${Math.floor(h / 24)} j ${Math.floor(h % 24)} h`
}

function Chip({ cfg, text }) {
  return (
    <span style={{ background: cfg?.bg ?? '#7c849920', color: cfg?.color ?? '#7c8499', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {text ?? cfg?.label}
    </span>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function Incidents() {
  const { user } = useAuth()
  const canUpdate = canSee(user?.adminRole, ACTION_ROLES.incidentUpdate)

  const [incidents, setIncidents] = useState([])
  const [counts, setCounts]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [detail, setDetail]       = useState(null)
  const [showReport, setShowReport] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [showSos, setShowSos]     = useState(false)

  // Vue (à traiter / résolus / tous), type et filtre « ouverts depuis > 24 h »
  // gardés dans l'adresse.
  const [params, setParams] = useSearchParams()
  const view   = VIEWS.find(v => v.key === params.get('vue')) ?? VIEWS[0]
  const type   = TYPE_LABELS[params.get('type')] ? params.get('type') : ''
  const filter = params.get('filtre') // 'critique' | 'en-cours' | 'ancien' | null
  // Plusieurs paramètres en une seule mise à jour de l'adresse
  function setParam(changes) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key) })
      return next
    }, { replace: true })
  }

  // ── Chargement : tous les incidents (peu nombreux), filtrés dans la page,
  // pour avoir les nombres de chaque vue et de chaque type ──
  const fetch = useCallback(async () => {
    try {
      const res = await api.get('/admin/incidents')
      setIncidents(res.data?.incidents ?? [])
      setCounts(res.data?.counts ?? null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // ── Temps réel : nouveaux incidents via socket ──
  useEffect(() => {
    const s = connectSocket()
    const events = ['admin:incident:driver_redispatched', 'admin:incident:driver_unreachable', 'admin:incident:user_report', 'admin:payment:disputed', 'admin:incident:sos', 'admin:incident:sos_safe']
    events.forEach(ev => s.on(ev, fetch))
    return () => events.forEach(ev => s.off(ev, fetch))
  }, [fetch])

  function openDetail(inc) {
    setDetail(inc)
    setEditStatus(inc.status)
    setEditNotes(inc.notes ?? '')
    setSaveError('')
  }

  // Arrivée depuis le bandeau SOS (« Prendre en charge ») : ouvre l'alerte.
  const location = useLocation()
  const focusId = location.state?.focusIncidentId
  useEffect(() => {
    if (!focusId || detail?.id === focusId) return
    const inc = incidents.find(i => i.id === focusId)
    if (inc) { openDetail(inc); setEditStatus('INVESTIGATING') }
  }, [focusId, incidents]) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!detail) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await api.patch(`/admin/incidents/${detail.id}`, { status: editStatus, notes: editNotes || null })
      setDetail(res.data)
      setIncidents(prev => prev.map(i => i.id === res.data.id ? res.data : i))
      if (res.data.status !== detail.status) fetch() // compteurs globaux à jour
    } catch (e) {
      setSaveError(e.response?.data?.message ?? 'L’enregistrement a échoué. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  // ── Listes ──
  const open = incidents.filter(i => i.status !== 'RESOLVED')
  const staleOpen = open.filter(i => hoursSince(i.openedAt) > STALE_HOURS)
  const inView = incidents.filter(view.match)
  const typeCounts = Object.fromEntries(Object.keys(TYPE_LABELS).map(t => [t, inView.filter(i => i.type === t).length]))
  const shown = inView
    .filter(i => !type || i.type === type)
    .filter(i => filter === 'critique' ? i.severity === 'critical'
      : filter === 'en-cours' ? i.status === 'INVESTIGATING'
      : filter === 'ancien' ? hoursSince(i.openedAt) > STALE_HOURS
      : true)
    // Les plus graves d'abord, puis les plus anciens
    .sort((a, b) => view.key === 'resolved'
      ? new Date(b.resolvedAt ?? b.openedAt) - new Date(a.resolvedAt ?? a.openedAt)
      : (SEVERITY_CFG[a.severity]?.rank ?? 9) - (SEVERITY_CFG[b.severity]?.rank ?? 9) || new Date(a.openedAt) - new Date(b.openedAt))

  // Cartes : compteurs du serveur (ouverts, critiques, en cours) + ancienneté.
  // Un clic filtre la liste à traiter.
  const cards = [
    { key: null,       label: 'Ouverts (nouveaux + en cours)', value: counts?.open ?? open.length, color: '#ef4444' },
    { key: 'critique', label: 'Critiques ouverts',              value: counts?.criticalOpen ?? 0, color: '#f97316' },
    { key: 'en-cours', label: 'En cours de traitement',         value: counts?.investigating ?? 0, color: '#f59e0b' },
    { key: 'ancien',   label: `Ouverts depuis plus de ${STALE_HOURS} h`, value: staleOpen.length, color: '#b45309' },
  ]

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Incidents"
        subtitle="Alertes SOS, coursiers disparus ou injoignables, litiges et signalements"
        actions={<>
          {canSee(user?.adminRole, ACTION_ROLES.reportUser) && (
            <button onClick={() => setShowReport(true)} style={btnOutline}><Flag size={14} /> Signaler un utilisateur</button>
          )}
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
        </>}
      />
      {showReport && <ReportUserModal onClose={() => { setShowReport(false); fetch() }} />}

      {/* ── Cartes (clic = filtre de la liste à traiter) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 16, flexShrink: 0 }}>
        {cards.map(c => {
          const active = view.key === 'open' && (filter ?? null) === c.key
          return (
            <button key={c.label} onClick={() => setParam({ vue: null, filtre: c.key })} style={{
              ...glass, padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
              ...(active ? { borderColor: c.color, boxShadow: `0 0 0 1px ${c.color}66` } : {}),
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.value > 0 ? c.color : 'var(--text-muted)' }}>{loading ? '…' : c.value}</div>
            </button>
          )
        })}
      </div>

      {/* ── Vues + types ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {VIEWS.map(v => {
            const active = view.key === v.key
            const n = incidents.filter(v.match).length
            return (
              <button key={v.key} onClick={() => setParam({ vue: v.key === 'open' ? null : v.key, filtre: null })} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>{v.label} <span style={{ opacity: 0.8 }}>{loading ? '' : n}</span></button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(TYPE_LABELS).map(([k, label]) => {
            const active = type === k
            const n = typeCounts[k]
            if (!n && !active) return null
            return (
              <button key={k} onClick={() => setParam({ type: active ? null : k })} style={{
                padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: active ? 'none' : '1px solid var(--border)', background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: 600,
              }}>{label} {n}</button>
            )
          })}
        </div>
        {(filter || type) && (
          <button onClick={() => setParam({ filtre: null, type: null })} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Effacer les filtres</button>
        )}
      </div>

      {/* ── Liste ── */}
      <div style={pageScroll}>
        <div style={{ ...glass, padding: '0 0 4px' }}>
          {loading ? (
            <div style={{ padding: 24, color: 'var(--text-muted)' }}>Chargement…</div>
          ) : shown.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
              <AlertTriangle size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>{view.key === 'open' && !filter && !type ? 'Aucun incident à traiter.' : 'Aucun incident pour ce filtre.'}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Gravité', 'Type', 'Statut', 'Coursier', 'Course', view.key === 'resolved' ? 'Résolu le' : 'Ouvert depuis', 'Notes'].map(h => (
                      <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(inc => {
                    const stale = inc.status !== 'RESOLVED' && hoursSince(inc.openedAt) > STALE_HOURS
                    return (
                      <tr key={inc.id} onClick={() => openDetail(inc)} style={{
                        borderBottom: '1px solid var(--border)', cursor: 'pointer',
                        background: inc.status !== 'RESOLVED' && inc.severity === 'critical' ? '#ef444408' : 'transparent',
                      }}>
                        <td style={tdStyle}><Chip cfg={SEVERITY_CFG[inc.severity]} /></td>
                        <td style={{ ...tdStyle, fontSize: 12.5 }}>{TYPE_LABELS[inc.type] ?? inc.label ?? inc.type}</td>
                        <td style={tdStyle}><Chip cfg={STATUS_CFG[inc.status]} /></td>
                        <td style={{ ...tdStyle, fontSize: 12.5 }}>{inc.driverName ?? '—'}</td>
                        <td style={tdStyle} onClick={e => e.stopPropagation()}>
                          {inc.orderId
                            ? <Link to={`/orders?q=${inc.orderId.slice(0, 8)}`} style={{ fontSize: 11.5, fontFamily: 'monospace', color: 'var(--primary)' }}>{inc.orderId.slice(0, 8)}</Link>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {view.key === 'resolved'
                            ? <span style={{ color: 'var(--text-muted)' }}>{inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                            : <span style={{ fontWeight: stale ? 700 : 500, color: stale ? '#b45309' : 'var(--text-muted)' }}>{inc.status === 'RESOLVED' ? 'résolu' : formatAge(inc.openedAt)}</span>}
                        </td>
                        <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.notes ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Réglage : numéros qui reçoivent les alertes SOS (replié) ── */}
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setShowSos(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '4px 2px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 600 }}>
            {showSos ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Numéros qui reçoivent les alertes SOS
          </button>
          {showSos && <div style={{ marginTop: 8 }}><SosPhonesCard canEdit={!user?.adminRole || user.adminRole === 'SUPER'} /></div>}
        </div>
      </div>

      {/* ── Fiche d'un incident ── */}
      {detail && (
        <div style={overlayStyle} onClick={() => !saving && setDetail(null)}>
          <div style={modalStyle} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{TYPE_LABELS[detail.type] ?? detail.label ?? detail.type}</h2>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip cfg={SEVERITY_CFG[detail.severity]} />
                  <Chip cfg={STATUS_CFG[detail.status]} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    ouvert le {new Date(detail.openedAt).toLocaleString('fr-FR')}{detail.status !== 'RESOLVED' ? ` · depuis ${formatAge(detail.openedAt)}` : ''}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <Section title="Ce qui s'est passé">
              <IncidentFacts inc={detail} />
            </Section>

            {(detail.driverName || detail.driverPhone) && (
              <Section title={detail.type === 'USER_REPORT' ? 'Utilisateur signalé' : 'Coursier'}>
                <Person name={detail.driverName ?? '—'} phone={detail.driverPhone} />
              </Section>
            )}

            {detail.orderId && (
              <Section title="Course liée">
                <Link to={`/orders?q=${detail.orderId.slice(0, 8)}`} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                  Ouvrir la course <code>{detail.orderId.slice(0, 8)}</code> dans Courses →
                </Link>
              </Section>
            )}

            <Section title="Suivi">
              {canUpdate ? (
                <>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['OPEN', 'INVESTIGATING', 'RESOLVED'].map(s => (
                      <button key={s} onClick={() => setEditStatus(s)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        border: `1.5px solid ${editStatus === s ? STATUS_CFG[s].color : 'rgba(0,0,0,0.1)'}`,
                        background: editStatus === s ? STATUS_CFG[s].bg : 'transparent',
                        color: editStatus === s ? STATUS_CFG[s].color : 'var(--text-muted)',
                      }}>{STATUS_CFG[s].label}</button>
                    ))}
                  </div>
                  <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3}
                    placeholder="Notes internes — ex : contacté le coursier par WhatsApp, en attente de confirmation…"
                    style={{ ...glassInput, marginTop: 8, resize: 'vertical', fontFamily: 'inherit' }} />
                  {saveError && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{saveError}</div>}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <button onClick={() => setDetail(null)} disabled={saving} style={btnOutline}>Fermer</button>
                    <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
                  </div>
                </>
              ) : (
                <>
                  <Row label="Statut" value={<Chip cfg={STATUS_CFG[detail.status]} />} />
                  <Row label="Notes" value={detail.notes ?? '—'} />
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Le traitement des incidents est réservé au Super Admin et à l'Assistance exécutive.</div>
                </>
              )}
              {detail.resolvedAt && <Row label="Résolu le" value={new Date(detail.resolvedAt).toLocaleString('fr-FR')} />}
            </Section>
          </div>
        </div>
      )}
    </div>
  )
}

// Détails propres à chaque type d'incident (champ meta enregistré par le serveur)
function IncidentFacts({ inc }) {
  const m = inc.meta ?? {}
  if (inc.type === 'SOS') {
    return (
      <>
        <Row label="Position" value={m.mapsUrl ? <a href={m.mapsUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>Voir sur la carte</a> : 'inconnue'} />
        <Row label="Contact d'urgence" value={m.emergencyContact
          ? <a href={`tel:${m.emergencyContact.phone}`} style={{ color: 'var(--primary)' }}>{`${m.emergencyContact.name ?? ''} ${m.emergencyContact.phone}`.trim()}</a>
          : 'aucun'} />
        <Row label="SMS envoyés" value={m.notified
          ? `équipe ${m.notified.teamNotified ? '✓' : '✗'} · contact ${m.notified.hasEmergencyContact ? (m.notified.contactNotified ? '✓' : '✗') : '—'}`
          : 'envoi en cours…'} />
        <Row label="En sécurité" value={m.safeAt ? `oui, signalé le ${new Date(m.safeAt).toLocaleString('fr-FR')}` : 'non signalé'} />
      </>
    )
  }
  return (
    <>
      {inc.type === 'USER_REPORT' && <Row label="Motif" value={m.message ?? 'non précisé'} />}
      {inc.type === 'DRIVER_ABANDONED' && <Row label="Motif du coursier" value={m.reason ? cancelReasonLabel(m.reason) : 'aucun motif donné'} />}
      {inc.offlineMin != null && <Row label="Hors ligne depuis" value={`${inc.offlineMin} min au moment de l'incident`} />}
      {m.message && inc.type !== 'USER_REPORT' && <Row label="Message" value={m.message} />}
      {!m.message && !m.reason && inc.offlineMin == null && inc.type !== 'USER_REPORT' && inc.type !== 'DRIVER_ABANDONED' && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun détail supplémentaire enregistré.</div>
      )}
    </>
  )
}

function Person({ name, phone }) {
  const digits = (phone ?? '').replace(/[^\d]/g, '')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <span style={{ fontWeight: 600, flex: 1 }}>{name}{phone && <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>{phone}</span>}</span>
      {digits.length >= 7 && (
        <>
          <a href={`tel:${phone}`} title={`Appeler ${phone}`} style={iconLink}><Phone size={13} /></a>
          <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" title="WhatsApp" style={iconLink}><MessageCircle size={13} /></a>
        </>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 130 }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)', whiteSpace: 'nowrap' }
const tdStyle    = { padding: '10px 12px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'linear-gradient(135deg,#00b4d8,#0077b6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }
const iconLink   = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 13, border: '1px solid var(--border)', color: 'var(--primary)', background: 'rgba(255,255,255,0.7)' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }
const modalStyle   = { background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 'var(--radius)', padding: '22px 26px', width: 560, maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,40,80,0.25)' }
