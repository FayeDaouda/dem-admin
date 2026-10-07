import { useState, useEffect, useCallback } from 'react'
import { Banknote, Save } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput } from '../lib/glassStyles'

// Frais de mise en relation DEM (page Tarifs) — un montant prélevé sur
// CHAQUE course, quel que soit le paiement (wallet, mobile money, espèces),
// sans rapport avec les passes livreur ni les abonnements DEM Pro. Pris sur
// la part du livreur, jamais ajouté au prix client. Payée en ligne ou par
// wallet : DEM ne verse au livreur que sa part ; en espèces : repris sur
// son wallet. Endpoints /admin/connection-fee (lecture SUPER/FINANCE,
// réglage SUPER), voir dem-backend utils/connection-fee.js.
export default function CashFeeSection() {
  const { user } = useAuth()
  const isSuper = user?.adminRole === 'SUPER'

  const [data, setData]     = useState(null)
  const [amount, setAmount] = useState('100')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [saved, setSaved]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/connection-fee')
      setData(res.data)
      setAmount(String(res.data.amount))
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!window.confirm(`Appliquer ${amountNum.toLocaleString('fr-FR')} F de frais de mise en relation sur chaque nouvelle course ?`)) return
    setBusy(true); setError(''); setSaved(false)
    try {
      const res = await api.put('/admin/connection-fee', { amount: amountNum })
      setData(res.data)
      setAmount(String(res.data.amount))
      setSaved(true)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setBusy(false) }
  }

  if (!data) return error ? <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p> : null

  const amountNum = Number(amount)
  const amountOk  = Number.isInteger(amountNum) && amountNum >= 0 && amountNum <= (data.max ?? 5000)
  const dirty     = amountNum !== data.amount

  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Banknote size={16} /> Frais de mise en relation
        </h2>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: 'rgba(22,163,74,.12)', color: 'var(--success, #16a34a)',
        }}>
          {data.amount.toLocaleString('fr-FR')} F PAR COURSE
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14, maxWidth: 700 }}>
        Prélevés sur <b>chaque course</b>, quel que soit le paiement : wallet, mobile money ou espèces.
        Sans rapport avec les passes livreur ni les abonnements DEM Pro.
        Le <b>prix client ne change pas</b> : le livreur reçoit le prix de la course moins ces frais.
        Payée en ligne ou par wallet, DEM ne lui verse que sa part ; payée en espèces, les frais sont repris
        sur son wallet (une seule fois par course, le solde peut passer en négatif).
        Les courses Express gardent leur commission de 10 % (au moins ce montant). Un changement ne touche que les nouvelles courses.
        Par défaut : {(data.default ?? 100).toLocaleString('fr-FR')} F.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Montant par course
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="number" min={0} max={data.max ?? 5000} step={50} value={amount} disabled={!isSuper || busy}
              onChange={e => { setAmount(e.target.value); setSaved(false) }}
              style={{ ...glassInput, width: 120, fontSize: 15, fontWeight: 600 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>F</span>
          </div>
        </label>

        {isSuper && dirty && (
          <button onClick={save} disabled={busy || !amountOk} style={{ ...btn('var(--primary)', busy || !amountOk), marginLeft: 'auto' }}>
            <Save size={14} /> {busy ? '…' : 'Enregistrer'}
          </button>
        )}
        {saved && !dirty && <span style={{ color: 'var(--success, #16a34a)', fontSize: 12, marginLeft: 'auto' }}>Enregistré.</span>}
      </div>

      {!isSuper && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 10 }}>Seul le super admin peut modifier ce montant.</p>
      )}
      {!amountOk && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>Le montant doit être un nombre entier entre 0 et {(data.max ?? 5000).toLocaleString('fr-FR')} F.</p>}
      {error && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  )
}

function btn(color, disabled) {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: 'none',
    background: color, color: '#fff', fontWeight: 600, fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
  }
}
