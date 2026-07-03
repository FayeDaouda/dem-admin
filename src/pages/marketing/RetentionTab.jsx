import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function StatBox({ label, value, color }) {
  return (
    <div style={{ ...glass, padding: '16px 18px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  )
}

export default function RetentionTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/retention')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const churnData = [
    { label: 'Mois précédent', perdus: data.churn.lastMonth },
    { label: 'Ce mois', perdus: data.churn.thisMonth },
  ]

  const exportRows = [
    { metric: 'Taux de rétention', value: `${data.retentionRate}%` },
    { metric: 'Clients ayant commandé', value: data.clientsWithOrders },
    { metric: 'Clients répétés (≥2 courses)', value: data.repeatClients },
    { metric: 'Clients actifs (30j)', value: data.activeClients },
    { metric: 'Clients inactifs (+30j)', value: data.inactiveClients },
    { metric: 'Fréquence moyenne de commande', value: data.avgOrderFrequency },
    { metric: 'Clients perdus — ce mois', value: data.churn.thisMonth },
    { metric: 'Clients perdus — mois précédent', value: data.churn.lastMonth },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <ExportPdfButton
          title="Rétention clients"
          filename={`retention-${new Date().toISOString().slice(0, 10)}.pdf`}
          columns={[{ header: 'Indicateur', key: 'metric' }, { header: 'Valeur', key: 'value' }]}
          rows={exportRows}
        />
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatBox label="TAUX DE RÉTENTION" value={`${data.retentionRate}%`} color="#8b5cf6" />
        <StatBox label="CLIENTS ACTIFS (30J)" value={data.activeClients} color="#22c55e" />
        <StatBox label="CLIENTS INACTIFS (+30J)" value={data.inactiveClients} color="#f59e0b" />
        <StatBox label="FRÉQUENCE MOY. COMMANDE" value={data.avgOrderFrequency} color="#06b6d4" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Clients perdus — ce mois vs précédent</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={churnData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="perdus" name="Clients perdus" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Détail</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Clients ayant commandé au moins 1 fois</span>
              <strong>{data.clientsWithOrders}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Clients répétés (≥2 courses)</span>
              <strong>{data.repeatClients}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
              <span style={{ color: 'var(--text-muted)' }}>Taux de rétention</span>
              <strong>{data.retentionRate}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
