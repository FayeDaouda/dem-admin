import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Gift, Send } from 'lucide-react'
import api from '../../lib/api'
import RequestModal from '../../components/RequestModal'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '../../lib/requestKinds'

// ── Fiche client › Suivi CM (CM / CRM Client, C5) ───────────────────────────
// Source, statut, courses, note donnée, récompenses reçues, parrainage,
// incidents, demandes en cours (GET /admin/cm/clients/:id/crm). Le CM offre
// la course de bienvenue dans son plafond (1 par client, 10 par mois) ; au-
// delà, et pour bannir ou valider un badge, il demande au Super Admin.
// asks : rôle qui demande (le Super Admin agit depuis les autres écrans).
const GRANT_LABELS = { COURSE_FREE: 'Course offerte', COURSE_PERCENT: 'Réduction %', COURSE_FIXED: 'Réduction F' }
const STATUS_COLORS = { NEVER_SERVED: '#64748b', ACTIVE: '#0077b6', INACTIVE: '#d97706', LOYAL: '#16a34a' }
const fmt = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function ClientCrmSection({ clientId, asks, banned }) {
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [request, setRequest] = useState(null) // 'reward' | 'ban' | 'badge'

  const load = useCallback(() => api.get(`/admin/cm/clients/${clientId}/crm`)
    .then(r => setFile(r.data)).catch(e => setError(e.response?.data?.message ?? 'Suivi indisponible.')), [clientId])
  useEffect(() => { load() }, [load])

  async function offer() {
    setBusy(true); setError(''); setNotice('')
    try {
      await api.post('/admin/rewards/grants', { userId: clientId, type: 'COURSE_FREE', uses: 1, reason: 'GESTURE', note: 'Course offerte par le CM' })
      setNotice('Course offerte : le client est prévenu par notification.')
      load()
    } catch (e) {
      if (e.response?.data?.code === 'BONUS_CAP') setRequest('reward')
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  if (error && !file) return <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
  if (!file) return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement du suivi…</div>
  const fc = file.bonus.freeCourse
  const kids = file.referral.children

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Block title="Suivi CM">
        <Line label="Statut" value={<span style={{ fontWeight: 800, color: STATUS_COLORS[file.status] }}>{file.statusLabel}</span>} />
        <Line label="Source" value={file.sourceLabel} />
        <Line label="Courses" value={`${file.orders.delivered} livrée${file.orders.delivered > 1 ? 's' : ''} / ${file.orders.count} · ${file.orders.cancelled} annulée${file.orders.cancelled > 1 ? 's' : ''}`} />
        <Line label="1re course" value={file.orders.first ? fmt(file.orders.first.deliveredAt) : 'pas encore'} />
        <Line label="Dernière commande" value={file.orders.last ? fmt(file.orders.last.createdAt) : '—'} />
        <Line label="Note donnée" value={file.rating.avg != null ? `${file.rating.avg.toLocaleString('fr-FR')} / 5 (${file.rating.count})` : '—'} />
        <Line label="Prochaine action" value={`${file.nextActions[file.followup.nextAction]}${file.followup.nextAction === 'CALLED' && file.followup.calledAt ? ` le ${fmt(file.followup.calledAt)}` : ''}${file.followup.note ? ` · ${file.followup.note}` : ''}`} />
        <button onClick={() => navigate('/base-clients')} style={linkBtn}>Modifier dans la Base de données Clients</button>
      </Block>

      <Block title="Parrainage">
        <Line label="Parrainé par" value={file.referral.referredBy ? `${file.referral.referredBy.referrer?.name ?? file.referral.referredBy.referrer?.phone ?? '—'} · ${fmt(file.referral.referredBy.createdAt)}` : '—'} />
        <Line label="Filleuls" value={kids.length === 0 ? 'aucun' : kids.map(k => k.referred?.name ?? k.referred?.phone).join(', ')} />
        {kids.some(k => k.bonus > 0 && !k.isBonusApplied) && <Line label="Bonus promis" value={<span style={{ color: '#b45309', fontWeight: 600 }}>non versé</span>} />}
      </Block>

      <Block title={`Récompenses reçues (${file.rewards.length})`}>
        {file.rewards.length === 0 ? <Empty>Aucune récompense.</Empty> : file.rewards.map(g => (
          <Line key={g.id} label={fmt(g.createdAt)} value={`${GRANT_LABELS[g.type] ?? g.type}${g.value ? ` · ${g.value}${g.type === 'COURSE_PERCENT' ? ' %' : ' F'}` : ''}${g.channel === 'CM' ? ' · par le CM' : ''} · ${g.status === 'CANCELLED' ? 'annulée' : g.status === 'APPLIED' ? 'utilisée' : 'disponible'}`} />
        ))}
      </Block>

      <Block title={`Incidents (${file.incidents.length})`}>
        {file.incidents.length === 0 ? <Empty>Aucun incident.</Empty> : file.incidents.map(i => (
          <Line key={i.id} label={fmt(i.openedAt)} value={<>
            <button onClick={() => navigate('/incidents', { state: { focusIncidentId: i.id } })} style={linkBtn}>{i.label ?? i.type}</button>
            {' · '}{i.status === 'RESOLVED' ? 'résolu' : 'ouvert'}{i.side === 'DRIVER' ? ' · côté coursier (lecture)' : ''}
          </>} />
        ))}
      </Block>

      <Block title={`Demandes en cours (${file.requests.length})`}>
        {file.requests.length === 0 ? <Empty>Aucune demande en cours.</Empty> : file.requests.map(r => (
          <Line key={r.id} label={REQUEST_KIND_LABELS[r.kind] ?? r.kind} value={`${REQUEST_STATUS_LABELS[r.status]} · ${r.submittedBy?.name ?? '—'} · ${fmt(r.createdAt)}`} />
        ))}
      </Block>

      <Block title="Actions">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {fc.allowed || !asks
            ? <button onClick={offer} disabled={busy} style={btnGreen}><Gift size={13} /> Offrir une course</button>
            : <button onClick={() => setRequest('reward')} style={btn}><Send size={13} /> Demander une course offerte</button>}
          {asks && !banned && <button onClick={() => setRequest('ban')} style={btn}><Send size={13} /> Demander de bannir</button>}
          {asks && <button onClick={() => setRequest('badge')} style={btn}><Send size={13} /> Demander de valider le badge</button>}
        </div>
        {asks && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
            {fc.usedForClient ? 'Ce client a déjà reçu sa course offerte. ' : ''}Ce mois : {fc.monthUsed} / {fc.monthCap} courses offertes.
          </div>
        )}
        {notice && <div style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600, marginTop: 8 }}>{notice}</div>}
        {error && <div style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: 8 }}>{error}</div>}
      </Block>

      {request === 'reward' && (
        <RequestModal kind="CLIENT_REWARD" title="Demander une course offerte" targetUserId={clientId}
          intro="Au-delà du plafond de votre rôle (1 course par client, 10 par mois)."
          payload={{ type: 'COURSE_FREE', uses: 1, reason: 'GESTURE' }}
          onClose={() => setRequest(null)} onDone={text => { setRequest(null); setError(''); setNotice(text); load() }} />
      )}
      {request === 'ban' && (
        <RequestModal kind="CLIENT_BAN" title="Demander de bannir ce client" targetUserId={clientId}
          onClose={() => setRequest(null)} onDone={text => { setRequest(null); setNotice(text); load() }} />
      )}
      {request === 'badge' && (
        <RequestModal kind="CLIENT_BADGE" title="Demander de valider le badge" targetUserId={clientId}
          intro="Valide le palier que le client a atteint (Mbokk et au-delà demandent une validation)."
          onClose={() => setRequest(null)} onDone={text => { setRequest(null); setNotice(text); load() }} />
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
const btnGreen = { ...btn, border: '1px solid rgba(21,128,61,.45)', background: 'rgba(34,197,94,.08)', color: '#15803d' }
const linkBtn = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600, fontSize: 13, textAlign: 'left' }
