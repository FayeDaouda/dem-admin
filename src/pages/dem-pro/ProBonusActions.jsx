import { useState, useEffect, useCallback } from 'react'
import { Gift, CalendarPlus, Rocket, Percent } from 'lucide-react'
import api from '../../lib/api'
import { glassInput } from '../../lib/glassStyles'
import RequestModal from '../../components/RequestModal'

// ── Semaine gratuite et bonus d'un Pro (Commercial / CRM Pro, C9 et C10) ────
// Niveau 1, dans les plafonds (GET /admin/dem-pro/:id/bonus-status) :
// semaine gratuite Business (une fois), 1 course offerte (une fois par Pro,
// 15 par mois en tout), prolongation d'essai de 7 jours (une fois). Au-delà,
// le bouton devient « Demander » (PRO_BONUS, validé par le Super Admin).
// `asks` : le rôle passe par des demandes (Commercial) ; le Super Admin agit seul.
export default function ProBonusActions({ account, asks, onChanged }) {
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [days, setDays] = useState('7')
  const [request, setRequest] = useState(null) // { kind:'PRO_BONUS', title, payload }

  const load = useCallback(() => api.get(`/admin/dem-pro/${account.id}/bonus-status`)
    .then(r => setStatus(r.data)).catch(e => setError(e.response?.data?.message ?? 'Bonus indisponibles.')), [account.id])
  useEffect(() => { load() }, [load])

  async function run(request_, ok) {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data } = await request_()
      setStatus(data.status ?? null)
      setNotice(ok)
      onChanged?.()
    } catch (e) {
      // Plafond atteint entre-temps : le bouton devient « Demander »
      if (e.response?.data?.code === 'BONUS_CAP') load()
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  if (!status) return error ? <div style={errorStyle}>{error}</div> : null
  const who = account.proBusinessName ?? account.name ?? account.phone
  const { trial, freeCourse, trialExtension } = status

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* C9 — semaine gratuite Business */}
        {trial.available && (
          <button disabled={busy} onClick={() => run(() => api.post(`/admin/dem-pro/${account.id}/trial`), `Semaine gratuite Business lancée pour ${who}.`)} style={btn('#7c3aed')}>
            <Rocket size={14} /> Lancer la semaine gratuite Business
          </button>
        )}
        {trial.inTrial && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#7c3aed' }}>
            En essai jusqu'au {new Date(trial.endsAt).toLocaleDateString('fr-FR')} ({trial.daysLeft} j restant{trial.daysLeft > 1 ? 's' : ''})
          </span>
        )}

        {/* C10 — course offerte */}
        {freeCourse.allowed || !asks ? (
          <button disabled={busy} onClick={() => run(() => api.post(`/admin/dem-pro/${account.id}/bonus`, { kind: 'FREE_COURSE' }), `1 course offerte à ${who}.`)} style={btn('#16a34a')}>
            <Gift size={14} /> Offrir une course
          </button>
        ) : (
          <button onClick={() => setRequest({ title: `Demander une course offerte — ${who}`, payload: { type: 'COURSE_FREE', uses: 1 },
            intro: freeCourse.usedForPro ? 'Ce Pro a déjà reçu sa course offerte.' : `Plafond de ${freeCourse.monthCap} courses offertes ce mois atteint.` })} style={btn('#b45309')}>
            <Gift size={14} /> Demander une course offerte
          </button>
        )}

        {/* C10 — prolongation d'essai */}
        {trial.inTrial && (trialExtension.allowed || !asks ? (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="number" min={1} max={asks ? trialExtension.maxDays : 90} value={days} onChange={e => setDays(e.target.value)} style={{ ...glassInput, width: 64, padding: '6px 8px', fontSize: 13 }} />
            <button disabled={busy} onClick={() => run(() => api.post(`/admin/dem-pro/${account.id}/bonus`, { kind: 'TRIAL_EXTENSION', days: Number(days) }), `Essai prolongé de ${days} jours.`)} style={btn('#0077b6')}>
              <CalendarPlus size={14} /> Prolonger l'essai
            </button>
          </span>
        ) : (
          <button onClick={() => setRequest({ title: `Demander une prolongation d'essai — ${who}`, payload: { type: 'PRO_PLAN_DAYS', value: 7, reason: 'TRIAL_EXTENSION' },
            intro: "L'essai de ce Pro a déjà été prolongé une fois." })} style={btn('#b45309')}>
            <CalendarPlus size={14} /> Demander une prolongation
          </button>
        ))}

        {/* Niveau 2 : réduction, jours DEM Pro hors essai */}
        {asks && (
          <button onClick={() => setRequest({ title: `Demander une réduction — ${who}`, payload: { type: 'COURSE_PERCENT', value: 20, uses: 1 }, discount: true,
            intro: 'Réduction en % ou en F sur ses prochaines courses.' })} style={btn('#b45309')}>
            <Percent size={14} /> Demander une réduction
          </button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        Ce mois : {freeCourse.monthUsed} / {freeCourse.monthCap} courses offertes par le commercial
        {freeCourse.usedForPro && ' · course offerte déjà donnée à ce Pro'}
        {trial.usedAt && !trial.inTrial && ` · semaine gratuite utilisée le ${new Date(trial.usedAt).toLocaleDateString('fr-FR')}`}
      </div>
      {notice && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>{notice}</div>}
      {error && <div style={errorStyle}>{error}</div>}

      {request && (
        <BonusRequest request={request} account={account} onClose={() => setRequest(null)}
          onDone={text => { setRequest(null); setNotice(text) }} />
      )}
    </div>
  )
}

// Demande de bonus au Super Admin : montant / durée réglables
function BonusRequest({ request, account, onClose, onDone }) {
  const [payload, setPayload] = useState(request.payload)
  const set = (k, v) => setPayload(p => ({ ...p, [k]: v }))
  const valid = payload.type === 'COURSE_FREE' || Number(payload.value) > 0
  return (
    <RequestModal kind="PRO_BONUS" title={request.title} intro={request.intro} targetUserId={account.id}
      payload={{ ...payload, value: payload.value != null ? Number(payload.value) : undefined, uses: payload.uses != null ? Number(payload.uses) : undefined }}
      ready={valid} onClose={onClose} onDone={onDone}>
      {request.discount && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={payload.type} onChange={e => set('type', e.target.value)} style={{ ...glassInput, width: 'auto', padding: '7px 10px', fontSize: 13 }}>
            <option value="COURSE_PERCENT">Réduction en %</option>
            <option value="COURSE_FIXED">Réduction en F</option>
          </select>
          <input type="number" min={1} value={payload.value} onChange={e => set('value', e.target.value)} style={{ ...glassInput, width: 90, padding: '7px 10px', fontSize: 13 }} />
          <span style={{ fontSize: 12 }}>sur</span>
          <input type="number" min={1} max={20} value={payload.uses} onChange={e => set('uses', e.target.value)} style={{ ...glassInput, width: 64, padding: '7px 10px', fontSize: 13 }} />
          <span style={{ fontSize: 12 }}>course(s)</span>
        </div>
      )}
      {payload.type === 'PRO_PLAN_DAYS' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <input type="number" min={1} max={90} value={payload.value} onChange={e => set('value', e.target.value)} style={{ ...glassInput, width: 80, padding: '7px 10px', fontSize: 13 }} />
          <span style={{ fontSize: 12 }}>jours</span>
        </div>
      )}
    </RequestModal>
  )
}

const btn = color => ({ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${color}66`, background: color + '12', color })
const errorStyle = { fontSize: 12, color: '#dc2626' }
