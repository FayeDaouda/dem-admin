import { useState, useEffect } from 'react'
import { Power, Save, Crown, Gift, Headphones } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import InlineConfirm from './InlineConfirm'

// ── Récompenses › Fidélité (serveur : loyalty/loyalty.service.js) ────────────
// Ce que rapporte chaque palier client (Classic → VIP), éteint par défaut :
// réduction automatique (%, plafond par course, courses par mois — jamais
// cumulée avec une promo), cadeau au passage du palier, support prioritaire.
// Les seuils des paliers se règlent dans Badges client.

const GIFTS = [
  { key: '', label: 'Aucun' },
  { key: 'COURSE_FREE', label: 'Course offerte' },
  { key: 'COURSE_PERCENT', label: 'Réduction en %' },
  { key: 'COURSE_FIXED', label: 'Réduction en F' },
]
const fcfa = n => `${Math.round(n).toLocaleString('fr-FR')} F`
const toLocal = iso => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

function draftOf(view) {
  return {
    startsAt: toLocal(view.startsAt),
    endsAt: toLocal(view.endsAt),
    prioritySupportFrom: view.prioritySupportFrom ?? '',
    tiers: Object.fromEntries(Object.entries(view.tiers).map(([id, p]) => [id, {
      discountPercent: String(p.discountPercent ?? 0),
      discountCap: String(p.discountCap ?? 500),
      monthlyCourses: String(p.monthlyCourses ?? 0),
      giftType: p.gift?.type ?? '',
      giftValue: p.gift?.value == null ? '' : String(p.gift.value),
      giftDays: String(p.gift?.validDays ?? 30),
    }])),
  }
}

function bodyOf(d) {
  return {
    startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
    endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
    prioritySupportFrom: d.prioritySupportFrom || null,
    tiers: Object.fromEntries(Object.entries(d.tiers).map(([id, t]) => [id, {
      discountPercent: Number(t.discountPercent) || 0,
      discountCap: Number(t.discountCap) || 0,
      monthlyCourses: Number(t.monthlyCourses) || 0,
      gift: t.giftType ? {
        type: t.giftType,
        validDays: Number(t.giftDays) || 30,
        ...(t.giftType === 'COURSE_FREE' ? {} : { value: Number(t.giftValue) || 0 }),
      } : null,
    }])),
  }
}

function describePerk(t) {
  const parts = []
  if (Number(t.discountPercent) > 0 && Number(t.monthlyCourses) > 0) {
    parts.push(`-${t.discountPercent} % (≤ ${fcfa(Number(t.discountCap) || 0)}) sur ${t.monthlyCourses} course${Number(t.monthlyCourses) > 1 ? 's' : ''}/mois`)
  }
  if (t.giftType) {
    const g = t.giftType === 'COURSE_FREE' ? 'course offerte' : t.giftType === 'COURSE_PERCENT' ? `-${t.giftValue || '…'} %` : `-${t.giftValue || '…'} F`
    parts.push(`cadeau ${g} (${t.giftDays} j)`)
  }
  return parts.join(' · ') || 'aucun avantage'
}

export default function LoyaltyPerksPanel() {
  const [view, setView] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'activate' | 'save'
  const [saved, setSaved] = useState('')

  useEffect(() => {
    api.get('/admin/rewards/loyalty')
      .then(({ data }) => { setView(data); setDraft(draftOf(data)) })
      .catch(e => setError(e.response?.status === 404 ? 'Le serveur n’a pas encore cette fonction (déploiement en cours).' : (e.response?.data?.message ?? 'Chargement impossible.')))
  }, [])

  if (!view || !draft) return <div style={{ color: error ? 'var(--danger)' : 'var(--text-muted)', padding: 30 }}>{error || 'Chargement…'}</div>

  const setTier = (id, k, v) => { setSaved(''); setDraft(d => ({ ...d, tiers: { ...d.tiers, [id]: { ...d.tiers[id], [k]: v } } })) }
  const set = (k, v) => { setSaved(''); setDraft(d => ({ ...d, [k]: v })) }
  // Du plus haut au plus bas, comme dans Badges client
  const tiers = [...view.tierList].reverse()

  async function send(patch, message) {
    setBusy(true); setError('')
    try {
      const { data } = await api.put('/admin/rewards/loyalty', { ...bodyOf(draft), ...patch })
      setView(data); setDraft(draftOf(data)); setConfirm(null); setSaved(message)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Enregistrement impossible.')
      setConfirm(null)
    } finally { setBusy(false) }
  }

  const summary = tiers.map(t => `${t.name} : ${describePerk(draft.tiers[t.id])}`)
  const maxPerClient = t => (Number(t.discountPercent) > 0 ? (Number(t.discountCap) || 0) * (Number(t.monthlyCourses) || 0) : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1040 }}>
      {/* ── État ── */}
      <div style={{ ...glass, padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Crown size={18} color="var(--primary)" />
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontWeight: 700 }}>Avantages de fidélité</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Appliqués automatiquement aux clients selon leur palier. Une réduction fidélité ne se cumule jamais avec une promo : le client garde la plus avantageuse. DEM la prend en charge, le livreur est remboursé.
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: view.live ? '#16a34a' : '#64748b' }}>
            {view.live ? 'Active' : view.active ? 'Programmée' : 'Éteinte'}
          </span>
          <button onClick={() => (view.active ? send({ active: false }, 'Fidélité éteinte.') : setConfirm('activate'))} disabled={busy || !!confirm} style={view.active ? btnOutline : btnPrimary}>
            <Power size={13} /> {view.active ? 'Éteindre' : 'Activer'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap', fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ce mois-ci</div>
            <div><strong>{view.thisMonth.courses}</strong> course{view.thisMonth.courses > 1 ? 's' : ''} réduite{view.thisMonth.courses > 1 ? 's' : ''} · <strong>{fcfa(view.thisMonth.amount)}</strong> pris en charge par DEM</div>
          </div>
          <label style={labelStyle}>Du (optionnel)
            <input type="datetime-local" value={draft.startsAt} onChange={e => set('startsAt', e.target.value)} style={glassInput} />
          </label>
          <label style={labelStyle}>Au (optionnel)
            <input type="datetime-local" value={draft.endsAt} onChange={e => set('endsAt', e.target.value)} style={glassInput} />
          </label>
        </div>
        {confirm === 'activate' && (
          <InlineConfirm
            lines={['Activer les avantages de fidélité ?', 'Ils s’appliquent dès maintenant aux prochaines courses :', ...summary]}
            confirmLabel="Confirmer l’activation" busy={busy}
            onConfirm={() => send({ active: true }, 'Fidélité activée.')} onCancel={() => setConfirm(null)} />
        )}
      </div>

      {/* ── Paliers ── */}
      <div style={{ ...glass, padding: '6px 0 10px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Palier', 'Réduction', 'Plafond / course', 'Courses / mois', 'Cadeau au passage du palier', 'Coût max / client / mois'].map(h => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {tiers.map(t => {
                const d = draft.tiers[t.id]
                const off = !(Number(d.discountPercent) > 0)
                return (
                  <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{t.clients} client{t.clients > 1 ? 's' : ''}</div>
                    </td>
                    <td style={td}>
                      <span style={inline}><input aria-label={`Réduction ${t.name} en %`} type="number" min={0} max={30} value={d.discountPercent} onChange={e => setTier(t.id, 'discountPercent', e.target.value)} style={{ ...glassInput, width: 64 }} /> %</span>
                    </td>
                    <td style={td}>
                      <span style={inline}><input aria-label={`Plafond ${t.name}`} type="number" min={0} max={10000} step={50} value={d.discountCap} disabled={off} onChange={e => setTier(t.id, 'discountCap', e.target.value)} style={{ ...glassInput, width: 84 }} /> F</span>
                    </td>
                    <td style={td}>
                      <input aria-label={`Courses par mois ${t.name}`} type="number" min={0} max={30} value={d.monthlyCourses} disabled={off} onChange={e => setTier(t.id, 'monthlyCourses', e.target.value)} style={{ ...glassInput, width: 64 }} />
                    </td>
                    <td style={td}>
                      <span style={{ ...inline, flexWrap: 'wrap' }}>
                        <Gift size={13} color="var(--text-muted)" />
                        <select aria-label={`Cadeau ${t.name}`} value={d.giftType} onChange={e => setTier(t.id, 'giftType', e.target.value)} style={glassInput}>
                          {GIFTS.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                        </select>
                        {(d.giftType === 'COURSE_PERCENT' || d.giftType === 'COURSE_FIXED') && (
                          <span style={inline}><input aria-label={`Valeur du cadeau ${t.name}`} type="number" min={1} value={d.giftValue} onChange={e => setTier(t.id, 'giftValue', e.target.value)} style={{ ...glassInput, width: 74 }} /> {d.giftType === 'COURSE_PERCENT' ? '%' : 'F'}</span>
                        )}
                        {d.giftType && (
                          <span style={inline}>valable <input aria-label={`Validité du cadeau ${t.name}`} type="number" min={1} max={90} value={d.giftDays} onChange={e => setTier(t.id, 'giftDays', e.target.value)} style={{ ...glassInput, width: 58 }} /> j</span>
                        )}
                      </span>
                    </td>
                    <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {maxPerClient(d) ? fcfa(maxPerClient(d)) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 0', flexWrap: 'wrap', fontSize: 13 }}>
          <Headphones size={15} color="var(--text-muted)" />
          <span>Support prioritaire à partir de</span>
          <select aria-label="Support prioritaire à partir du palier" value={draft.prioritySupportFrom} onChange={e => set('prioritySupportFrom', e.target.value)} style={glassInput}>
            <option value="">Aucun palier</option>
            {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>leurs réclamations passent d’un cran plus haut dans Incidents.</span>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div>}
      {saved && <div style={{ color: '#15803d', fontSize: 12.5, fontWeight: 600 }}>{saved}</div>}
      {confirm === 'save' ? (
        <InlineConfirm
          lines={['Enregistrer ces avantages ?', ...(view.live ? ['La fidélité est active : ils s’appliquent dès maintenant.'] : ['La fidélité est éteinte : rien ne change pour les clients tant qu’elle n’est pas activée.']), ...summary]}
          confirmLabel="Enregistrer" busy={busy}
          onConfirm={() => send({}, 'Réglages enregistrés.')} onCancel={() => setConfirm(null)} />
      ) : (
        <div>
          <button onClick={() => setConfirm('save')} disabled={busy} style={btnPrimary}><Save size={14} /> Enregistrer les réglages</button>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-muted)' }
const inline = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }
const th = { textAlign: 'left', padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }
const td = { padding: '10px 12px', verticalAlign: 'middle', fontSize: 13 }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
