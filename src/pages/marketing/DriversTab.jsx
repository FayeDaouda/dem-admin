import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

export default function DriversTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/drivers')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const daily = data.activeDriversByDay.map(d => ({ ...d, dateLabel: new Date(d.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const hourly = data.hourlyActivity.map(h => ({ ...h, label: `${String(h.hour).padStart(2, '0')}h` }))
  const peakHour = hourly.reduce((max, h) => h.orders > max.orders ? h : max, hourly[0])

  return (
    <div>
      <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Livreurs actifs par jour (30 derniers jours)</h2>
        {daily.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 40 }}>Pas de données</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={daily} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="activeDrivers" name="Livreurs actifs" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ ...glass, padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Activité commandes par heure de la journée</h2>
          {peakHour && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pic : <strong>{peakHour.label}</strong></span>}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14 }}>
          Approximation basée sur l'heure de création des commandes — aucun historique de disponibilité des livreurs n'existe aujourd'hui pour un calcul strict du taux de disponibilité.
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourly} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={1} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="orders" name="Commandes" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
