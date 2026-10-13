import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'

// Frais de mise en relation depuis le lancement — ancien onglet « Frais » du
// Plan d'acquisition (GET /admin/acquisition/fees, Super Admin seul côté
// serveur). Mêmes définitions que Finance : facturés = demFee réel des courses
// livrées ; encaissés = payés en ligne / wallet, ou repris sur le wallet du
// coursier (espèces).
export default function FeesSection() {
  const [data, setData] = useState(null)

  const load = useCallback(() => {
    api.get('/admin/acquisition/fees').then(r => setData(r.data)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(load)

  if (!data) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>

  const fee       = data.connectionFee ?? 100
  const billed    = data.commissionBilled ?? 0
  const collected = data.commissionCollected ?? 0
  const delivered = data.deliveredCount ?? 0

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        ['Frais facturés depuis le lancement', `${billed.toLocaleString('fr-FR')} F`, 'var(--primary)'],
        ['Dont encaissés par DEM', `${collected.toLocaleString('fr-FR')} F`, 'var(--success)'],
        ['Frais de mise en relation', `${fee.toLocaleString('fr-FR')} F par course`, '#0ea5e9'],
        ['Frais moyens réels', `${delivered > 0 ? Math.round(billed / delivered).toLocaleString('fr-FR') : 0} F (${delivered.toLocaleString('fr-FR')} courses livrées)`, '#06b6d4'],
      ].map(([label, value, color]) => (
        <div key={label} style={{ ...glass, padding: '14px 16px', flex: '1 1 200px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
        </div>
      ))}
    </div>
  )
}
