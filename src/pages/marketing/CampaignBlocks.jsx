// Blocs de l'ancien onglet Marketing › Campagnes et alertes (plan de
// refonte, 3.10) : historique des envois et alerte dans l'app → page
// Notifications ; jalons de croissance → Marketing.
import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glassInput } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { targetLabel } from '../../lib/broadcastTargets'

const AUDIENCE_OPTIONS = [['all', 'Tous'], ['clients', 'Clients'], ['drivers', 'Coursiers']]

export function AlertForm() {
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

export function BroadcastHistory() {
  const [broadcasts, setBroadcasts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/marketing/broadcasts', { params: { limit: 15 } })
      setBroadcasts(res.data?.broadcasts ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

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
            {b.data?.target ? targetLabel(b.data.target) : '—'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {b.data?.sent ?? 0} envoyée(s){b.data?.totalUsers != null ? ` sur ${b.data.totalUsers}` : ''}
            {b.data?.failed > 0 && <span style={{ color: '#ef4444' }}> · {b.data.failed} échec(s)</span>}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(b.createdAt).toLocaleString('fr-FR')}</span>
        </div>
      ))}
    </div>
  )
}

export function Milestones() {
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/marketing/milestones')
      setData(res.data)
    } catch (e) { console.error(e) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load())

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>INSCRIPTIONS CLIENTS ({data.totalClients})</div>
        {data.clients.map(m => (
          <div key={m.threshold} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, opacity: m.reached ? 1 : 0.4 }}>
            <span>{m.reached ? '🎉' : '⏳'} {m.threshold}e inscription client</span>
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
