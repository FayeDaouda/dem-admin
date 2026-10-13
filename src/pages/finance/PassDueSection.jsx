import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Play } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'

// Dû par les coursiers et prélèvement manuel du jour — Super Admin seul
// (décision du plan de refonte : comme avant, dans le Plan d'acquisition).
// Déplacé dans Finance › Pass coursiers (étape 3.3) ; les montants des pass se
// règlent dans Tarifs et zones.
const Card = ({ children, style = {} }) => (
  <div style={{ ...glass, padding: '20px 24px', ...style }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.6px', marginBottom: 8, textTransform: 'uppercase' }}>
    {children}
  </div>
)

const StatBox = ({ label, value, color }) => (
  <div style={{ ...glass, padding: '14px 16px', flex: '1 1 140px' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
  </div>
)

function Notice({ msg }) {
  if (!msg) return null
  return <div style={{ fontSize: 12, fontWeight: 600, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.text}</div>
}

export default function PassDueSection() {
  const [data, setData] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [msg, setMsg] = useState(null)
  const notify = (text, ok = true) => setMsg({ text, ok })

  const load = useCallback(() => {
    Promise.all([api.get('/admin/forfait/summary'), api.get('/admin/config')])
      .then(([summary, cfg]) => {
        const map = Object.fromEntries((cfg.data ?? []).map(r => [r.key, r.value]))
        setData({ ...summary.data, active: map['forfait_active'] === 'true' })
      })
      .catch(() => { /* silencieux */ })
  }, [])

  useEffect(() => { load() }, [load])

  async function processPass() {
    if (!window.confirm('Déclencher le prélèvement du jour pour tous les coursiers actifs ?')) return
    setProcessing(true)
    try {
      const res = await api.post('/admin/forfait/process')
      notify(`${res.data.charged} coursier(s) prélevé(s) ✓`)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
    setProcessing(false)
  }

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const active     = data.active ?? false
  const totalOwed  = data.totalOwed ?? 0
  const records    = data.recordCount ?? 0
  const drivers    = data.driverCount ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      <Notice msg={msg} />
      {/* Résumé */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {/* Dette = passe impayée d'un jour où le coursier a livré (même règle que le prélèvement) */}
        <StatBox label="Dû par les coursiers" value={`${totalOwed.toLocaleString()} F`} color={totalOwed > 0 ? '#ef4444' : '#22c55e'} />
        <StatBox label="Passes impayées (jours travaillés)" value={records} />
        <StatBox label="Coursiers concernés" value={drivers} />
      </div>
      {data?.abandonedPurchases?.count > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          + {data.abandonedPurchases.count} achat{data.abandonedPurchases.count > 1 ? 's' : ''} en ligne abandonné{data.abandonedPurchases.count > 1 ? 's' : ''} ({data.abandonedPurchases.amount.toLocaleString()} F) — pas une dette : le coursier n'a pas livré ce jour-là.
        </div>
      )}

      {/* Déclenchement manuel */}
      <Card>
        <Label>Déclenchement manuel</Label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Le prélèvement automatique se fait à minuit (Dakar). Utilisez ce bouton en cas d'urgence ou de test.
        </p>
        <button
          onClick={processPass}
          disabled={processing || !active}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: active ? 'var(--primary)' : 'var(--surface2)',
            color: active ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: 13, cursor: active ? 'pointer' : 'default',
          }}
        >
          {processing ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} />}
          {processing ? 'Traitement…' : 'Déclencher le prélèvement du jour'}
        </button>
      </Card>
    </div>
  )
}
