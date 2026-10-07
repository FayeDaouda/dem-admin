import { useState, useEffect } from 'react'
import { Gift, CheckCircle2, Clock, X } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { planLabel, PLAN_COLORS } from './labels'

// ── Parrainage DEM Pro ────────────────────────────────────────────────────────
// GET /admin/dem-pro/referrals — aucune récompense n'est automatique : quand
// un filleul paie sa première offre, le parrainage passe « À récompenser ».
// Un SUPER décide alors : jours d'offre au parrain, au filleul, aux deux
// (POST /admin/dem-pro/referrals/:id/reward). Jours ajoutés à l'offre en
// cours, ou Business offert sans offre en cours. Une seule fois par parrainage.
const FILTERS = [
  { key: 'to_reward', label: 'À récompenser' },
  { key: 'pending',   label: 'En attente de paiement' },
  { key: 'rewarded',  label: 'Récompensés' },
  { key: 'all',       label: 'Tous' },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const shop = u => u?.proBusinessName || u?.name || '—'

function statusOf(r) {
  if (r.rewardedAt) return { label: 'Récompensé', color: '#16a34a', icon: CheckCircle2 }
  if (r.qualifiedAt) return { label: 'À récompenser', color: '#d97706', icon: Gift }
  return { label: r.referred?.proStatus === 'ACTIVE' ? 'Validé, pas encore payé' : 'Inscrit, en validation', color: '#64748b', icon: Clock }
}

function PlanCell({ user }) {
  const plan = user?.proPlan ?? 'FREE'
  const live = user?.proPlanExpiresAt && new Date(user.proPlanExpiresAt) > new Date()
  return (
    <span style={{ fontSize: 11, color: PLAN_COLORS[plan] ?? 'var(--text-muted)', fontWeight: 600 }}>
      {planLabel(plan)}{live && plan !== 'FREE' ? ` · jusqu'au ${fmtDate(user.proPlanExpiresAt)}` : ''}
    </span>
  )
}

export default function ReferralsTab({ isSuper }) {
  const [filter, setFilter] = useState('to_reward')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [target, setTarget] = useState(null)

  const [version, setVersion] = useState(0) // recharge après une récompense

  useEffect(() => {
    let cancelled = false
    api.get('/admin/dem-pro/referrals', { params: { status: filter, limit: 100 } })
      .then(res => { if (!cancelled) { setData(res.data); setError('') } })
      .catch(e => { if (!cancelled) setError(e.response?.data?.message ?? 'Erreur de chargement.') })
    return () => { cancelled = true }
  }, [filter, version])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...glass, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Gift size={18} color="var(--primary)" />
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>Récompenses attribuées à la main</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>
            Rien n'est offert automatiquement. Un parrainage passe « À récompenser » quand le filleul paie sa première offre
            (l'essai gratuit ne compte pas). Vous choisissez ensuite les jours pour le parrain et pour le filleul.
          </div>
        </div>
        {data?.toReward > 0 && (
          <span style={{ background: '#d9770618', color: '#d97706', fontWeight: 800, fontSize: 12, padding: '4px 12px', borderRadius: 20 }}>
            {data.toReward} à récompenser
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: filter === f.key ? 'none' : '1px solid var(--border)',
            background: filter === f.key ? 'var(--primary)' : 'transparent',
            color: filter === f.key ? '#fff' : 'var(--text-muted)',
          }}>{f.label}</button>
        ))}
      </div>

      <div style={{ ...glass, padding: '8px 14px', overflowX: 'auto' }}>
        {error ? (
          <div style={{ color: 'var(--danger)', padding: 20 }}>{error}</div>
        ) : !data ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : data.referrals.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>
            {filter === 'to_reward' ? 'Aucun parrainage à récompenser.' : 'Aucun parrainage.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>
                {['Parrain', 'Filleul', 'Inscrit le', 'Première offre payée', 'Statut', ''].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.referrals.map(r => {
                const st = statusOf(r)
                const Icon = st.icon
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>
                      <strong>{shop(r.referrer)}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.referrer?.phone} · {r.code}</div>
                      <PlanCell user={r.referrer} />
                    </td>
                    <td style={td}>
                      <strong>{shop(r.referred)}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.referred?.phone}</div>
                      <PlanCell user={r.referred} />
                    </td>
                    <td style={td}>{fmtDate(r.createdAt)}</td>
                    <td style={td}>{fmtDate(r.qualifiedAt)}</td>
                    <td style={td}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: st.color, fontWeight: 700, fontSize: 12 }}>
                        <Icon size={13} /> {st.label}
                      </span>
                      {r.rewardedAt && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Parrain +{r.referrerRewardDays ?? 0} j · filleul +{r.rewardDays ?? 0} j · {fmtDate(r.rewardedAt)}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {!r.rewardedAt && isSuper && (
                        <button onClick={() => setTarget(r)} style={r.qualifiedAt ? btnPrimary : btnOutline}>
                          <Gift size={13} /> Récompenser
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {!isSuper && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Seul un SUPER admin peut attribuer une récompense.</div>
      )}

      {target && (
        <RewardModal
          referral={target}
          suggestedDays={data?.suggestedDays ?? 7}
          onClose={() => setTarget(null)}
          onDone={() => { setTarget(null); setVersion(v => v + 1) }}
        />
      )}
    </div>
  )
}

function RewardModal({ referral, suggestedDays, onClose, onDone }) {
  const [referrerDays, setReferrerDays] = useState(String(suggestedDays))
  const [referredDays, setReferredDays] = useState(String(suggestedDays))
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const parse = v => (v === '' ? 0 : Number(v))
  const a = parse(referrerDays)
  const b = parse(referredDays)
  const valid = [a, b].every(n => Number.isInteger(n) && n >= 0 && n <= 60) && a + b > 0

  async function submit() {
    if (!referral.qualifiedAt && !confirm('Le filleul n\'a pas encore payé d\'offre. Récompenser quand même ?')) return
    setBusy(true); setError('')
    try {
      await api.post(`/admin/dem-pro/referrals/${referral.id}/reward`, { referrerDays: a, referredDays: b, note: note.trim() || undefined })
      onDone()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  const effect = u => {
    const live = u?.proPlan && u.proPlan !== 'FREE' && u.proPlanExpiresAt && new Date(u.proPlanExpiresAt) > new Date()
    return live ? `prolonge son offre ${planLabel(u.proPlan)}` : 'lui offre Business'
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, padding: '24px 28px', width: 460, maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ fontSize: 16, margin: 0, flex: 1 }}>Récompenser le parrainage</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 16 }}>
          {shop(referral.referrer)} a parrainé {shop(referral.referred)}. Les jours s'ajoutent à l'offre en cours,
          ou offrent Business sans offre en cours. Chacun reçoit une notification. Mettez 0 pour ne rien donner à l'un des deux.
        </p>
        <DaysField
          label={`Parrain — ${shop(referral.referrer)}`}
          hint={`${effect(referral.referrer)}`}
          value={referrerDays} onChange={setReferrerDays}
        />
        <DaysField
          label={`Filleul — ${shop(referral.referred)}`}
          hint={`${effect(referral.referred)}`}
          value={referredDays} onChange={setReferredDays}
        />
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 4px' }}>Note interne (optionnelle)</label>
        <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="Ex : geste commercial"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', fontSize: 13, boxSizing: 'border-box' }} />
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 10 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button onClick={submit} disabled={!valid || busy} style={{ ...btnPrimary, opacity: !valid || busy ? 0.6 : 1 }}>
            {busy ? 'Attribution…' : `Offrir ${a + b} jour${a + b > 1 ? 's' : ''} au total`}
          </button>
        </div>
      </div>
    </div>
  )
}

function DaysField({ label, hint, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</div>
      </div>
      <input type="number" min={0} max={60} value={value} onChange={e => onChange(e.target.value)}
        style={{ width: 70, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', fontSize: 13 }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>jours</span>
    </div>
  )
}

const th = { textAlign: 'left', padding: '8px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td = { padding: '10px 8px', verticalAlign: 'top', fontSize: 13 }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
