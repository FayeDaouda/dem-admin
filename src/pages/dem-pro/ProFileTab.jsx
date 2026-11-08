import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import api from '../../lib/api'
import { glassInput } from '../../lib/glassStyles'
import RequestModal from '../../components/RequestModal'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '../../lib/requestKinds'

// ── Fiche Pro › Suivi commercial (Commercial / CRM Pro, C5) ─────────────────
// Source du compte, essai, commandes (dont la 1re), bonus reçus, demandes en
// cours, incidents liés (GET /admin/dem-pro/:id/crm). `canPlan` : changer le
// plan directement (Super + Commercial, 08/11/2026). `asks` : le Commercial
// demande au Super Admin la suspension ou la réactivation du compte.
const GRANT_LABELS = { COURSE_FREE: 'Course offerte', COURSE_PERCENT: 'Réduction %', COURSE_FIXED: 'Réduction F', PRO_PLAN_DAYS: "Jours d'offre" }
const PLAN_OPTIONS = [['STARTER', 'Starter'], ['BUSINESS', 'Business'], ['PREMIUM', 'Premium'], ['FREE', 'Gratuit']]
const fmt = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function ProFileTab({ accountId, asks, canPlan = false }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [request, setRequest] = useState(null) // 'plan' | 'suspend' | 'activate'
  const [plan, setPlan] = useState({ plan: 'BUSINESS', until: '' })
  const [savingPlan, setSavingPlan] = useState(false)
  const [planError, setPlanError] = useState('')

  // Plan donné sans abonnement payé (« sans paiement ») jusqu'à la date
  // choisie, ou sans fin ; Gratuit retire le plan.
  const planPayload = () => ({ plan: plan.plan, status: 'ACTIVE', expiresAt: plan.plan === 'FREE' || !plan.until ? null : new Date(`${plan.until}T23:59:00`).toISOString() })
  async function savePlan() {
    setSavingPlan(true); setPlanError(''); setNotice('')
    try {
      await api.patch(`/admin/dem-pro/${accountId}/plan`, planPayload())
      setNotice(`Plan ${PLAN_OPTIONS.find(([k]) => k === plan.plan)?.[1] ?? plan.plan} enregistré.`)
      load()
    } catch (e) {
      setPlanError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSavingPlan(false) }
  }

  const load = useCallback(() => api.get(`/admin/dem-pro/${accountId}/crm`)
    .then(r => setFile(r.data)).catch(e => setError(e.response?.data?.message ?? 'Suivi indisponible.')), [accountId])
  useEffect(() => { load() }, [load])

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>
  if (!file) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
  const a = file.account

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Block title="Compte">
        <Line label="Source" value={file.sourceLabel ?? 'Non renseignée (compte antérieur)'} />
        <Line label="Essai Business" value={file.trial.inTrial ? `en cours jusqu'au ${fmt(file.trial.endsAt)}` : file.trial.usedAt ? `utilisé le ${fmt(file.trial.usedAt)}` : 'pas encore utilisé'} />
        <Line label="Commandes" value={`${file.orders.count} au total · dernière ${fmt(file.orders.lastAt)}`} />
        <Line label="1re commande" value={file.orders.first ? `${fmt(file.orders.first.createdAt)} (${file.orders.first.id.slice(0, 8).toUpperCase()})` : 'pas encore'} />
      </Block>

      <Block title={`Bonus reçus (${file.bonuses.length})`}>
        {file.bonuses.length === 0 ? <Empty>Aucun bonus.</Empty> : file.bonuses.map(g => (
          <Line key={g.id} label={fmt(g.createdAt)} value={`${GRANT_LABELS[g.type] ?? g.type}${g.value ? ` · ${g.value}${g.type === 'COURSE_PERCENT' ? ' %' : g.type === 'PRO_PLAN_DAYS' ? ' j' : ' F'}` : ''}${g.channel === 'COMMERCIAL' ? ' · par le commercial' : ''} · ${g.status === 'CANCELLED' ? 'annulé' : g.status === 'APPLIED' ? 'appliqué' : 'actif'}`} />
        ))}
      </Block>

      <Block title={`Demandes en cours (${file.requests.length})`}>
        {file.requests.length === 0 ? <Empty>Aucune demande en cours.</Empty> : file.requests.map(r => (
          <Line key={r.id} label={REQUEST_KIND_LABELS[r.kind] ?? r.kind} value={`${REQUEST_STATUS_LABELS[r.status]} · ${r.submittedBy?.name ?? '—'} · ${fmt(r.createdAt)}`} />
        ))}
      </Block>

      <Block title={`Incidents liés (${file.incidents.length})`}>
        {file.incidents.length === 0 ? <Empty>Aucun incident.</Empty> : file.incidents.map(i => (
          <Line key={i.id} label={fmt(i.openedAt)} value={<>{i.label}{i.orderId && <> · <button onClick={() => navigate(`/orders?q=${i.orderId.slice(0, 8)}`)} style={linkBtn}>course {i.orderId.slice(0, 8).toUpperCase()}</button></>} · {i.status === 'RESOLVED' ? 'résolu' : 'ouvert'}</>} />
        ))}
      </Block>

      {canPlan && (
        <Block title="Changer le plan">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={plan.plan} onChange={e => setPlan(p => ({ ...p, plan: e.target.value }))} style={{ ...glassInput, width: 'auto', padding: '7px 10px', fontSize: 13 }}>
              {PLAN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {plan.plan !== 'FREE' && <>
              <span style={{ fontSize: 12 }}>jusqu'au</span>
              <input type="date" value={plan.until} onChange={e => setPlan(p => ({ ...p, until: e.target.value }))} style={{ ...glassInput, width: 'auto', padding: '6px 8px', fontSize: 13 }} />
            </>}
            <button onClick={savePlan} disabled={savingPlan} style={btnPrimary}>{savingPlan ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            Donné sans abonnement payé (« sans paiement »){plan.plan !== 'FREE' ? ' jusqu’à la date choisie, ou sans fin si aucune date' : ''}. Journalisé.
          </div>
          {planError && <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{planError}</div>}
          {!asks && notice && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>{notice}</div>}
        </Block>
      )}

      {asks && (
        <Block title="Demander au Super Admin">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!canPlan && <button onClick={() => setRequest('plan')} style={btn}><Send size={13} /> Changer le plan / sans paiement</button>}
            {a.isActive
              ? <button onClick={() => setRequest('suspend')} style={btn}><Send size={13} /> Suspendre le compte</button>
              : <button onClick={() => setRequest('activate')} style={btn}><Send size={13} /> Réactiver le compte</button>}
          </div>
          {notice && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600, marginTop: 8 }}>{notice}</div>}
        </Block>
      )}

      {request === 'plan' && (
        <RequestModal kind="PRO_PLAN_CHANGE" title="Changer le plan" targetUserId={accountId}
          intro="Le plan est donné sans abonnement payé (« sans paiement ») jusqu'à la date choisie, ou sans fin."
          payload={{ plan: plan.plan, status: 'ACTIVE', expiresAt: plan.plan === 'FREE' || !plan.until ? null : new Date(`${plan.until}T23:59:00`).toISOString() }}
          onClose={() => setRequest(null)} onDone={text => { setRequest(null); setNotice(text); load() }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={plan.plan} onChange={e => setPlan(p => ({ ...p, plan: e.target.value }))} style={{ ...glassInput, width: 'auto', padding: '7px 10px', fontSize: 13 }}>
              {PLAN_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            {plan.plan !== 'FREE' && <>
              <span style={{ fontSize: 12 }}>jusqu'au</span>
              <input type="date" value={plan.until} onChange={e => setPlan(p => ({ ...p, until: e.target.value }))} style={{ ...glassInput, width: 'auto', padding: '6px 8px', fontSize: 13 }} />
            </>}
          </div>
        </RequestModal>
      )}
      {(request === 'suspend' || request === 'activate') && (
        <RequestModal kind={request === 'suspend' ? 'DEM_PRO_SUSPEND' : 'DEM_PRO_ACTIVATE'} title={request === 'suspend' ? 'Suspendre le compte' : 'Réactiver le compte'}
          targetUserId={accountId} onClose={() => setRequest(null)} onDone={text => { setRequest(null); setNotice(text); load() }} />
      )}
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  )
}
function Line({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 120 }}>{label}</span>
      <span style={{ flex: 1 }}>{value}</span>
    </div>
  )
}
const Empty = ({ children }) => <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{children}</div>
const btn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(180,83,9,.45)', background: 'rgba(245,158,11,.08)', color: '#b45309' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--primary)', color: '#fff' }
const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 13 }
