import { useState, useEffect, useCallback } from 'react'
import { Tag, Save } from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput } from '../lib/glassStyles'

// Promotion « prix unique » de la page Tarifs — tant qu'elle est active,
// chaque course (Normale ou Express, sans majoration heure de pointe) et
// chaque arrêt de tournée coûte le même montant au client. La matrice zones
// en dessous n'est jamais modifiée : désactiver (ou atteindre la date de fin)
// fait revenir automatiquement aux prix normaux. Endpoints /admin/flat-promo
// (lecture SUPER/FINANCE/AE, écriture SUPER uniquement).

// ISO → valeur d'un <input type="datetime-local"> (heure locale)
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
}

export default function FlatPromoSection() {
  const { user } = useAuth()
  const isSuper = user?.adminRole === 'SUPER'

  const [data, setData]       = useState(null)
  const [price, setPrice]     = useState('1100')
  const [endsAt, setEndsAt]   = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.get('/admin/flat-promo')
      setData(res.data)
      if (res.data.price) setPrice(String(res.data.price))
      setEndsAt(res.data.expired ? '' : toLocalInput(res.data.endsAt))
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(enabled) {
    setBusy(true); setError('')
    try {
      const res = await api.put('/admin/flat-promo', {
        enabled,
        price:  Number(price),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      })
      setData(res.data)
    } catch (e) { setError(e.response?.data?.message ?? 'Erreur.') }
    finally { setBusy(false) }
  }

  if (!data) return null

  const active   = data.active
  const priceNum = Number(price)
  const priceOk  = Number.isInteger(priceNum) && priceNum > data.demFee
  const dirty    = priceNum !== data.price || endsAt !== (data.expired ? '' : toLocalInput(data.endsAt))

  return (
    <div style={{
      ...glass, padding: '18px 20px', marginBottom: 16,
      border: active ? '1.5px solid var(--success, #16a34a)' : glass.border,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag size={16} /> Promotion prix unique
        </h2>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
          background: active ? 'rgba(22,163,74,.12)' : 'rgba(0,0,0,.06)',
          color: active ? 'var(--success, #16a34a)' : 'var(--text-muted)',
        }}>
          {active ? 'EN COURS' : data.expired ? 'TERMINÉE (date de fin atteinte)' : 'DÉSACTIVÉE'}
        </span>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 14, maxWidth: 640 }}>
        Quand elle est activée, <b>chaque course coûte le même prix au client</b>, quelle que soit la distance :
        course Normale ou Express (sans majoration heure de pointe) et chaque arrêt d'une tournée groupée.
        Le livreur touche le montant moins {data.demFee} F, DEM garde {data.demFee} F.
        La grille des zones ci-dessous n'est pas modifiée : en désactivant, on revient aux prix normaux.
      </p>

      {active && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(22,163,74,.08)', fontSize: 13, marginBottom: 14 }}>
          Toutes les courses sont actuellement à <b>{data.price.toLocaleString('fr-FR')} F</b>
          {' '}({(data.price - data.demFee).toLocaleString('fr-FR')} F livreur + {data.demFee} F DEM)
          {data.endsAt ? <> — fin automatique le <b>{formatDate(data.endsAt)}</b>.</> : ' — sans date de fin, à désactiver manuellement.'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Prix par course (client)
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="number" min={data.demFee + 1} step={50} value={price} disabled={!isSuper || busy}
              onChange={e => setPrice(e.target.value)}
              style={{ ...glassInput, width: 120, fontSize: 15, fontWeight: 600 }}
            />
            <span style={{ color: 'var(--text-muted)' }}>F</span>
          </div>
        </label>
        <label style={{ fontSize: 12, fontWeight: 600 }}>
          Fin automatique (optionnelle)
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <input
              type="datetime-local" value={endsAt} disabled={!isSuper || busy}
              onChange={e => setEndsAt(e.target.value)}
              style={{ ...glassInput, fontSize: 13 }}
            />
            {endsAt && isSuper && (
              <button onClick={() => setEndsAt('')} disabled={busy}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
                Retirer
              </button>
            )}
          </div>
        </label>

        {isSuper && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {active && dirty && (
              <button onClick={() => save(true)} disabled={busy || !priceOk} style={btn('var(--primary)', busy || !priceOk)}>
                <Save size={14} /> Mettre à jour
              </button>
            )}
            {active ? (
              <button onClick={() => save(false)} disabled={busy} style={btn('#dc2626', busy)}>
                {busy ? '…' : 'Désactiver — revenir aux prix normaux'}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (window.confirm(`Activer la promotion ? Toutes les courses passeront à ${priceNum.toLocaleString('fr-FR')} F.`)) save(true)
                }}
                disabled={busy || !priceOk} style={btn('var(--success, #16a34a)', busy || !priceOk)}
              >
                {busy ? '…' : `Activer à ${priceOk ? priceNum.toLocaleString('fr-FR') : '—'} F`}
              </button>
            )}
          </div>
        )}
      </div>

      {!isSuper && (
        <p style={{ color: 'var(--text-muted)', fontSize: 11.5, marginTop: 10 }}>Seul le super admin peut activer ou désactiver la promotion.</p>
      )}
      {!priceOk && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>Le prix doit être un nombre entier supérieur à {data.demFee} F.</p>}
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
