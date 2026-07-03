import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

const REASON_LABELS = {
  NO_DRIVER_FOUND: 'Aucun livreur trouvé', CHANGED_MIND: "Changement d'avis", TOO_LONG: 'Trop long',
  WRONG_ADDRESS: 'Adresse erronée', PRICE: 'Prix', DRIVER_ISSUE: 'Problème livreur',
  OTHER: 'Autre', NON_RENSEIGNE: 'Non renseigné',
}

function PeriodBox({ label, completed, cancelled }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{completed}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>complétées</div></div>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{cancelled}</div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>annulées</div></div>
      </div>
    </div>
  )
}

export default function CoursesTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/courses')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const trend = data.cancellationRateTrend.map(t => ({ ...t, dateLabel: new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) }))
  const reasons = data.reasons.map(r => ({ ...r, label: REASON_LABELS[r.reason] ?? r.reason }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" completed={data.completed.today} cancelled={data.cancelled.today} />
        <PeriodBox label="7 JOURS" completed={data.completed.week} cancelled={data.cancelled.week} />
        <PeriodBox label="30 JOURS" completed={data.completed.month} cancelled={data.cancelled.month} />
        <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>DÉLAI MOYEN PRISE EN CHARGE</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{data.avgPickupDelayMin != null ? `${data.avgPickupDelayMin} min` : '—'}</div>
        </div>
        <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>NOTE MOYENNE CLIENTS</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{data.avgClientRating != null ? `★ ${data.avgClientRating}` : '—'}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Taux d'annulation — évolution (30 derniers jours)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Taux']} />
              <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ ...glass, padding: '18px 20px' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Motifs d'annulation</h2>
          {reasons.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>Pas de données</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={reasons} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Occurrences" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
