import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'
import { useAutoRefresh } from '../../lib/useAutoRefresh'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ ...glass, padding: '16px 18px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Fenêtre d'activité : 30 jours, la même que les cartes "Clients actifs /
// inactifs" de la rangée Community (voir admin.marketing.service.js).
const ACTIVITY_DAYS = 30

export default function RetentionTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/marketing/retention', { params: { days: ACTIVITY_DAYS } })
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const r = data.retention30d
  const prev = data.previousRetention30d
  const a = data.activity

  const lostData = [
    { label: '30 jours précédents', perdus: prev.lost, base: prev.baseClients },
    { label: '30 derniers jours',   perdus: r.lost,    base: r.baseClients },
  ]
  const activityData = [
    { label: 'Actifs',        value: a.active,      color: '#22c55e' },
    { label: 'Inactifs',      value: a.inactive,    color: '#f59e0b' },
    { label: 'Jamais servis', value: a.neverServed, color: '#94a3b8' },
  ]

  const exportRows = [
    { metric: 'Rétention 30 jours', value: `${r.rate}% (${r.retained}/${r.baseClients})` },
    { metric: 'Rétention 30 jours — période précédente', value: `${prev.rate}% (${prev.retained}/${prev.baseClients})` },
    { metric: 'Clients perdus — 30 derniers jours', value: r.lost },
    { metric: 'Clients perdus — période précédente', value: prev.lost },
    { metric: 'Taux de réachat (depuis le lancement)', value: `${data.repeatRate}%` },
    { metric: 'Clients servis (depuis le lancement)', value: data.clientsServed },
    { metric: 'Clients servis 2 fois ou plus', value: data.repeatClients },
    { metric: 'Courses livrées par client (moyenne)', value: data.avgOrdersPerClient },
    { metric: `Comptes clients actifs (${ACTIVITY_DAYS} j)`, value: a.active },
    { metric: `Comptes clients inactifs (${ACTIVITY_DAYS} j)`, value: a.inactive },
    { metric: 'Comptes clients jamais servis', value: a.neverServed },
    { metric: 'Comptes clients (total)', value: a.registered },
  ]

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        « Client servi » = au moins une course <strong>livrée</strong>, comptes clients particuliers uniquement (DEM Pro exclus).
        <strong> Rétention 30 jours</strong> = parmi les clients servis sur les 30 jours précédents, part servie à nouveau sur les 30 derniers jours ;
        les <strong>clients perdus</strong> sont ceux qui ne sont pas revenus. <strong>Taux de réachat</strong> = clients servis au moins deux fois,
        depuis le lancement.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <ExportPdfButton
          title="Rétention clients"
          filename={`retention-${new Date().toISOString().slice(0, 10)}.pdf`}
          columns={[{ header: 'Indicateur', key: 'metric' }, { header: 'Valeur', key: 'value' }]}
          rows={exportRows}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatBox label="RÉTENTION 30 JOURS" value={`${r.rate}%`} color="#8b5cf6"
          sub={`${r.retained} revenus sur ${r.baseClients} · avant : ${prev.rate}%`} />
        <StatBox label="CLIENTS PERDUS (30 J)" value={r.lost} color="#ef4444" sub={`période précédente : ${prev.lost}`} />
        <StatBox label="TAUX DE RÉACHAT" value={`${data.repeatRate}%`} color="#06b6d4"
          sub={`${data.repeatClients} sur ${data.clientsServed} clients servis`} />
        <StatBox label="COURSES PAR CLIENT" value={data.avgOrdersPerClient} color="#06b6d4" sub="moyenne, depuis le lancement" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Clients perdus — 30 derniers jours vs précédents</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={lostData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, _n, item) => [`${v} sur ${item.payload.base}`, 'Clients perdus']} />
              <Bar dataKey="perdus" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Comptes clients — activité sur {ACTIVITY_DAYS} jours ({a.registered})</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={activityData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, 'Comptes']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {activityData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
            actifs + inactifs + jamais servis = {a.registered} comptes clients (hors comptes supprimés)
          </div>
        </div>
      </div>
    </div>
  )
}
