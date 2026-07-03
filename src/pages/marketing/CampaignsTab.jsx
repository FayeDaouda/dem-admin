import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Send, MessageSquareWarning, Trophy, ArrowRight } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'

const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro' }
const AUDIENCE_OPTIONS = [['all', 'Tous'], ['clients', 'Clients'], ['drivers', 'Livreurs']]

function Section({ icon: Icon, title, children, action }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} color="var(--primary)" />
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function AlertForm() {
  const [banner, setBanner] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/marketing/alert')
      setBanner(res.data)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true); setSaved(false); setError('')
    try {
      const res = await api.put('/admin/marketing/alert', banner)
      setBanner(res.data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  if (!banner) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 12 }}>
        Message enregistré côté serveur — son affichage réel à l'ouverture de l'app mobile nécessite un développement côté app (à venir).
      </p>
      <textarea
        value={banner.message}
        onChange={e => setBanner(a => ({ ...a, message: e.target.value }))}
        placeholder="Ex : Maintenance prévue ce soir de 22h à 23h."
        rows={3}
        style={{ ...glassInput, resize: 'vertical', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={banner.audience} onChange={e => setBanner(a => ({ ...a, audience: e.target.value }))} style={{ ...glassInput, width: 160 }}>
          {AUDIENCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={banner.active} onChange={e => setBanner(a => ({ ...a, active: e.target.checked }))} />
          Alerte active
        </label>
        <button onClick={save} disabled={saving} style={{
          marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: 'none',
          background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{error}</div>}
      {saved && <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e' }}>Alerte enregistrée.</div>}
      {banner.updatedAt && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Dernière mise à jour : {new Date(banner.updatedAt).toLocaleString('fr-FR')}</div>}
    </div>
  )
}

function BroadcastHistory() {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/marketing/broadcasts', { params: { limit: 15 } })
      .then(res => setBroadcasts(res.data?.broadcasts ?? []))
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  if (broadcasts.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Aucune campagne envoyée.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {broadcasts.map(b => (
        <div key={b.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{b.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.body}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'rgba(0,119,182,.08)', padding: '2px 8px', borderRadius: 8 }}>
            {TARGET_LABELS[b.data?.target] ?? b.data?.target ?? '—'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.data?.sent ?? 0} envoyée(s)</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('fr-FR')}</span>
        </div>
      ))}
    </div>
  )
}

function Milestones() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.get('/admin/marketing/milestones').then(res => setData(res.data)).catch(e => console.error(e))
  }, [])

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>CLIENTS ({data.totalClients})</div>
        {data.clients.map(m => (
          <div key={m.threshold} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, opacity: m.reached ? 1 : 0.4 }}>
            <span>{m.reached ? '🎉' : '⏳'} {m.threshold}e client</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.reachedAt ? new Date(m.reachedAt).toLocaleDateString('fr-FR') : '—'}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>COURSES LIVRÉES ({data.totalDelivered})</div>
        {data.orders.map(m => (
          <div key={m.threshold} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, opacity: m.reached ? 1 : 0.4 }}>
            <span>{m.reached ? '🎉' : '⏳'} {m.threshold}e course</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.reachedAt ? new Date(m.reachedAt).toLocaleDateString('fr-FR') : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CampaignsTab() {
  return (
    <div>
      <Section
        icon={Send}
        title="Notifications push"
        action={
          <Link to="/broadcast" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
            Envoyer une notification <ArrowRight size={13} />
          </Link>
        }
      >
        <BroadcastHistory />
      </Section>

      <Section icon={MessageSquareWarning} title="Alerte in-app">
        <AlertForm />
      </Section>

      <Section icon={Trophy} title="Jalons de croissance">
        <Milestones />
      </Section>
    </div>
  )
}
