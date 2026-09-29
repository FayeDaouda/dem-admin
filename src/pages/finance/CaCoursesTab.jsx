import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatAxisF } from '../../lib/format'

const TOOLTIP_STYLE = { background: '#fff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }

function PeriodBox({ label, commission }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 180px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{formatF(commission.billed)}</div>
      <div style={{ fontSize: 11, color: '#22c55e', marginTop: 2 }}>Encaissée en ligne : {formatF(commission.collectedOnline)}</div>
      <div style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>À recouvrer : {formatF(commission.toRecover)}</div>
    </div>
  )
}

// Commission DEM sur les courses : facturée = encaissée + à recouvrer.
export default function CaCoursesTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/revenue')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  const growth = data.growth.map(g => ({ ...g, dateLabel: new Date(g.date + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }))

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        Commission DEM réellement facturée sur les courses livrées (frais EXPRESS, tournées DEM Pro, tarif par zone…), par date de livraison.
        <strong> Encaissée</strong> = course payée en ligne, l'argent est chez DEM. <strong>À recouvrer</strong> = course payée en espèces au livreur,
        qui a gardé la commission, ou pas encore payée. Une course sans frais DEM (tarif normal hors zone, phase de lancement) ne génère aucune commission.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <PeriodBox label="AUJOURD'HUI" commission={data.today.commission} />
        <PeriodBox label="7 JOURS"     commission={data.week.commission} />
        <PeriodBox label="30 JOURS"    commission={data.month.commission} />
        <PeriodBox label="6 MOIS"      commission={data.sixMonths.commission} />
      </div>

      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Commission sur les courses — 30 derniers jours</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={growth} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={formatAxisF} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [formatF(v), name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Empilées : la hauteur totale d'une barre = commission facturée du jour */}
            <Bar dataKey="commissionCollected" name="Encaissée en ligne" stackId="c" fill="#22c55e" />
            <Bar dataKey="commissionToRecover" name="À recouvrer"        stackId="c" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
