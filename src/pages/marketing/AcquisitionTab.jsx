import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import ExportPdfButton from '../../components/ExportPdfButton'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }
const SOURCE_COLORS = ['#06b6d4', '#8b5cf6']

function PeriodBox({ label, value }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 140px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  )
}

export default function AcquisitionTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/acquisition')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const pieData = [
    { name: 'Organique', value: data.source.organic },
    { name: 'Parrainage', value: data.source.referred },
  ]

  const exportRows = data.growth.map(g => ({ date: g.date, clients: g.clients, drivers: g.drivers }))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <ExportPdfButton
          title="Acquisition — inscriptions"
          filename={`acquisition-${new Date().toISOString().slice(0, 10)}.pdf`}
          columns={[{ header: 'Date', key: 'date' }, { header: 'Nouveaux clients', key: 'clients' }, { header: 'Nouveaux livreurs', key: 'drivers' }]}
          rows={exportRows}
        />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nouveaux clients</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.newClients.today} />
        <PeriodBox label="7 JOURS" value={data.newClients.week} />
        <PeriodBox label="30 JOURS" value={data.newClients.month} />
        <PeriodBox label="6 MOIS" value={data.newClients.sixMonths} />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nouveaux livreurs</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.newDrivers.today} />
        <PeriodBox label="7 JOURS" value={data.newDrivers.week} />
        <PeriodBox label="30 JOURS" value={data.newDrivers.month} />
        <PeriodBox label="6 MOIS" value={data.newDrivers.sixMonths} />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nouveaux DEM Pro</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.newDemPro?.today ?? 0} />
        <PeriodBox label="7 JOURS" value={data.newDemPro?.week ?? 0} />
        <PeriodBox label="30 JOURS" value={data.newDemPro?.month ?? 0} />
        <PeriodBox label="6 MOIS" value={data.newDemPro?.sixMonths ?? 0} />
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Nouveaux chefs de flotte</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" value={data.newChefsDeFlotte?.today ?? 0} />
        <PeriodBox label="7 JOURS" value={data.newChefsDeFlotte?.week ?? 0} />
        <PeriodBox label="30 JOURS" value={data.newChefsDeFlotte?.month ?? 0} />
        <PeriodBox label="6 MOIS" value={data.newChefsDeFlotte?.sixMonths ?? 0} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Courbe de croissance — 30 derniers jours</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={growth} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="clients" name="Clients" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 3 }} />
              <Line type="monotone" dataKey="drivers" name="Livreurs" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Source d'inscription (clients)</h2>
          {data.source.total === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            Source "promo" non trackée à l'inscription — non incluse
          </div>
        </div>
      </div>
    </div>
  )
}
