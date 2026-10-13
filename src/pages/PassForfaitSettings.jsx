import { useState, useEffect, useCallback } from 'react'
import { ToggleLeft, ToggleRight } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// Activation et montants des pass coursiers — Super Admin seul (PUT
// /admin/forfait/config est réservé au Super Admin côté serveur). Déplacé de
// l'onglet Pass du Plan d'acquisition (plan de refonte, étape 3.3) : tous
// les prix se règlent dans Tarifs et zones.
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

export default function PassForfaitSettings() {
  const [data,    setData]    = useState(null)
  const [amount,  setAmount]  = useState('')
  const [amountM3, setAmountM3] = useState('')
  const [saving,  setSaving]  = useState(false)
  const [savingM3, setSavingM3] = useState(false)
  const [msg, setMsg] = useState(null)
  const notify = (text, ok = true) => setMsg({ text, ok })

  const load = useCallback(() => {
    api.get('/admin/config').then(cfg => {
      const map = Object.fromEntries((cfg.data ?? []).map(r => [r.key, r.value]))
      setData({
        active:   map['forfait_active'] === 'true',
        amount:   Number(map['forfait_amount'] ?? 480),
        amountM3: Number(map['forfait_amount_m3'] ?? 650),
      })
      setAmount(map['forfait_amount'] ?? '480')
      setAmountM3(map['forfait_amount_m3'] ?? '650')
    }).catch(() => { /* silencieux */ })
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive() {
    try {
      await api.put('/admin/forfait/config', { active: !data.active })
      notify(data.active ? 'Pass désactivé' : 'Pass activé ✓', !data.active)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
  }

  async function saveAmount(val) {
    const n = Number(val ?? amount)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await api.put('/admin/forfait/config', { amount: n })
      notify(`Montant mis à jour : ${n} FCFA/jour ✓`)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  async function saveAmountM3(val) {
    const n = Number(val ?? amountM3)
    if (isNaN(n) || n < 0) return
    setSavingM3(true)
    try {
      await api.put('/admin/forfait/config', { amountM3: n })
      notify(`Montant Voiture mis à jour : ${n} FCFA/jour ✓`)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
    setSavingM3(false)
  }

  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const active = data.active

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      <Notice msg={msg} />
      {/* Toggle ON/OFF */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Label>Activation du forfait</Label>
            <div style={{ fontSize: 13, color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
              {active ? `Actif — ${data.amount} FCFA/jour` : 'Inactif — aucun prélèvement'}
            </div>
          </div>
          <button onClick={toggleActive} style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
            {active ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,.08)', padding: '6px 10px', borderRadius: 6 }}>
          ⚠ Toute modification s'applique au prochain prélèvement (jour suivant)
        </div>
      </Card>

      {/* Modifier le montant — Moto (S4) */}
      <Card>
        <Label>Montant journalier — Moto (FCFA)</Label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ ...glassInput, width: 130, fontWeight: 700, fontSize: 16 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>FCFA / jour</span>
          <button
            onClick={() => saveAmount()}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {saving ? '…' : 'Sauver'}
          </button>
        </div>
        {/* Boutons rapides */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['480 FCFA (S4)', 480], ['650 FCFA (M3)', 650], ['Promo 0 FCFA', 0], ['Promo 200 FCFA', 200]].map(([label, val]) => (
            <button key={val} onClick={() => { setAmount(String(val)); saveAmount(val) }}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid rgba(0,180,216,.35)',
                background: 'rgba(0,180,216,.07)', color: 'var(--primary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Modifier le montant — Voiture (M3+) */}
      <Card>
        <Label>Montant journalier — Voiture (FCFA)</Label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="number"
            value={amountM3}
            onChange={e => setAmountM3(e.target.value)}
            style={{ ...glassInput, width: 130, fontWeight: 700, fontSize: 16 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>FCFA / jour</span>
          <button
            onClick={() => saveAmountM3()}
            disabled={savingM3}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {savingM3 ? '…' : 'Sauver'}
          </button>
        </div>
      </Card>

    </div>
  )
}
