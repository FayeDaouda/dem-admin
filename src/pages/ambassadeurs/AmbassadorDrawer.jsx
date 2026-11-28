import { useCallback, useEffect, useState } from 'react'
import { X, Check, Ban, RotateCcw, ExternalLink, Image as ImageIcon, Store, Zap } from 'lucide-react'
import api from '../../lib/api'
import { isSuperRole } from '../../lib/droits'
import { glass, glassInput } from '../../lib/glassStyles'
import { StatusPill } from './AmbassadeursPage'
import { MEDAL, GAIN_STATUS, fcfa, dateShort, gainLabel } from './ambassadorUi'

// Fiche d'un ambassadeur : dossier, décision, Pro, gains, boosters.
// Décision sur le dossier : Super, SC, AE, Commercial ; argent et
// suspension : Super (le serveur vérifie de toute façon).
export default function AmbassadorDrawer({ id, role, onClose, onChanged }) {
  const superAdmin = isSuperRole(role)
  const [a, setA] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState(null) // { title, label, run(reason) }
  const [reason, setReason] = useState('')

  const load = useCallback(() => {
    api.get(`/admin/ambassadors/${id}`).then(r => setA(r.data)).catch(e => setError(e.response?.data?.message ?? 'Erreur de chargement.'))
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const act = async (fn) => {
    setBusy(true); setError('')
    try { await fn(); load(); onChanged?.() } catch (e) { setError(e.response?.data?.message ?? 'Action impossible.') } finally { setBusy(false) }
  }
  const askReason = (title, label, run) => { setReason(''); setAsk({ title, label, run }) }

  const u = a?.user
  const canDecide = a && ['PENDING', 'REJECTED'].includes(a.status)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(2,21,32,.45)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
      <aside onClick={e => e.stopPropagation()} role="dialog" aria-label="Fiche ambassadeur"
        style={{ width: 'min(620px, 100vw)', height: '100%', background: 'var(--bg, #f6f8fb)', overflowY: 'auto', boxShadow: '-12px 0 40px rgba(0,0,0,.18)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--bg, #f6f8fb)', padding: '18px 22px 12px', display: 'flex', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid rgba(0,0,0,.06)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{u?.name || 'Ambassadeur'}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-muted)' }}>
              {a && <StatusPill status={a.status} training={!!a.trainingPassedAt} />}
              <span>{u?.phone}</span>
              <span>· {u?.role === 'DRIVER' ? 'Coursier' : 'Client'}</span>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 22px 32px', display: 'grid', gap: 14 }}>
          {error && <div style={{ ...glass, padding: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>}
          {!a ? <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div> : (
            <>
              <Card title="Dossier">
                <KV k="Paiement des gains" v={`${a.payoutOperator === 'WAVE' ? 'Wave' : 'Orange Money'} · ${a.payoutPhone}`} />
                <KV k="Inscrit le" v={dateShort(a.createdAt)} />
                {a.validatedAt && <KV k="Validé le" v={dateShort(a.validatedAt)} />}
                <KV k="Formation" v={a.trainingPassedAt ? `Réussie le ${dateShort(a.trainingPassedAt)}` : `À faire${a.quizAttempts ? ` (${a.quizAttempts} essai${a.quizAttempts > 1 ? 's' : ''})` : ''}`} />
                {a.rejectionReason && <KV k="Motif du refus" v={a.rejectionReason} />}
                {a.suspendedReason && <KV k="Motif de la suspension" v={a.suspendedReason} />}
                <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                  {[['idFront', 'Recto'], ['idBack', 'Verso']].map(([k, label]) => a[k]
                    ? <a key={k} href={a[k]} target="_blank" rel="noreferrer" style={docLink}><img src={a[k]} alt={`Pièce d'identité, ${label}`} style={{ width: 120, height: 76, objectFit: 'cover', borderRadius: 8, display: 'block' }} /><span>{label}</span></a>
                    : <div key={k} style={{ ...docLink, color: '#b45309' }}><ImageIcon size={18} /><span>{label} manquant</span></div>)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                  {canDecide && <>
                    <button disabled={busy} onClick={() => act(() => api.post(`/admin/ambassadors/${id}/decide`, { approve: true }))} style={btnPrimary}><Check size={14} /> Valider le dossier</button>
                    {a.status === 'PENDING' && <button disabled={busy} onClick={() => askReason('Refuser le dossier', 'Refuser', (r) => api.post(`/admin/ambassadors/${id}/decide`, { approve: false, reason: r }))} style={btnDanger}><Ban size={14} /> Refuser</button>}
                  </>}
                  {superAdmin && a.status === 'ACTIVE' && <button disabled={busy} onClick={() => askReason('Suspendre l\'ambassadeur (fraude, abus)', 'Suspendre et annuler les gains en vérification', (r) => api.post(`/admin/ambassadors/${id}/suspend`, { reason: r, cancelPending: true }))} style={btnDanger}><Ban size={14} /> Suspendre</button>}
                  {superAdmin && a.status === 'SUSPENDED' && <button disabled={busy} onClick={() => act(() => api.post(`/admin/ambassadors/${id}/reactivate`))} style={btnGhost}><RotateCcw size={14} /> Réactiver</button>}
                  {a.status === 'ACTIVE' && <button disabled={busy} onClick={() => act(() => api.post(`/admin/ambassadors/${id}/recompute`))} style={btnGhost}><RotateCcw size={14} /> Recalculer</button>}
                </div>
              </Card>

              <Card title={`Commerçants (${a.merchants.filter(m => m.status === 'VALID').length})`}>
                {a.merchants.length === 0 ? <Empty text="Aucun commerçant rattaché." /> : a.merchants.map(m => (
                  <div key={m.id} style={{ padding: '10px 0', borderTop: '1px solid rgba(0,0,0,.06)', display: 'grid', gap: 4, opacity: m.status === 'REJECTED' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Store size={15} color="var(--primary)" />
                      <b style={{ flex: 1, minWidth: 0 }}>{m.merchant?.proBusinessName || m.merchant?.name || 'Commerçant'}</b>
                      <span style={{ fontSize: 12, fontWeight: 700, color: m.unlockedAt ? '#15803d' : 'var(--text-muted)' }}>{m.validCourses} course{m.validCourses > 1 ? 's' : ''}{m.unlockedAt ? ' · débloqué' : ''}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.merchant?.phone} · {m.source === 'ON_SITE' ? 'créé sur place' : 'code ambassadeur'} · rattaché le {dateShort(m.attachedAt)} · compte DEM Pro {m.merchant?.proStatus === 'ACTIVE' ? 'validé' : m.merchant?.proStatus === 'PENDING' ? 'en attente' : (m.merchant?.proStatus ?? '—').toLowerCase()}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap' }}>
                      {m.proofImage && <a href={m.proofImage} target="_blank" rel="noreferrer" style={link}><ImageIcon size={13} /> Photo de la boutique</a>}
                      {m.proofLink && <a href={m.proofLink} target="_blank" rel="noreferrer" style={link}><ExternalLink size={13} /> Page en ligne</a>}
                      {!m.proofImage && !m.proofLink && <span style={{ color: '#b45309' }}>Pas encore de preuve d'activité : ne compte pas</span>}
                      {m.status === 'REJECTED' && <span style={{ color: '#b91c1c' }}>Retiré : {m.rejectedReason}</span>}
                      {superAdmin && m.status === 'VALID' && <button disabled={busy} onClick={() => askReason('Retirer ce commerçant (faux commerce, déjà client…)', 'Retirer', (r) => api.post(`/admin/ambassador-merchants/${m.id}/reject`, { reason: r }))} style={{ ...linkBtn, color: '#b91c1c' }}>Retirer</button>}
                      {superAdmin && m.status === 'REJECTED' && <button disabled={busy} onClick={() => act(() => api.post(`/admin/ambassador-merchants/${m.id}/restore`))} style={linkBtn}>Remettre</button>}
                    </div>
                  </div>
                ))}
              </Card>

              <Card title="Gains">
                {a.gains.length === 0 ? <Empty text="Aucun gain pour le moment." /> : a.gains.map(g => (
                  <div key={g.id} style={{ padding: '9px 0', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{g.kind === 'MEDAL' ? MEDAL[g.code]?.emoji : '⚡'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{gainLabel(g)}</div>
                      <div style={{ fontSize: 12, color: GAIN_STATUS[g.status]?.color }}>
                        {GAIN_STATUS[g.status]?.label}{g.status === 'PENDING' ? ` jusqu'au ${dateShort(g.availableAt)}` : g.status === 'AVAILABLE' ? ` le ${dateShort(g.releasedAt)}` : g.cancelReason ? ` : ${g.cancelReason}` : ''}
                      </div>
                    </div>
                    <b style={{ fontSize: 13.5, textDecoration: g.status === 'CANCELLED' ? 'line-through' : 'none' }}>{fcfa(g.amount)}</b>
                    {superAdmin && g.status === 'PENDING' && <button disabled={busy} onClick={() => askReason(`Annuler : ${gainLabel(g)} (${fcfa(g.amount)})`, 'Annuler le gain', (r) => api.post(`/admin/ambassador-gains/${g.id}/cancel`, { reason: r }))} style={{ ...linkBtn, color: '#b91c1c' }}>Annuler</button>}
                  </div>
                ))}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 0' }}>Un gain déjà versé au wallet ne s'annule pas ici : il se règle depuis le wallet de l'utilisateur.</p>
              </Card>

              <Card title="Boosters">
                {a.boosters.length === 0 ? <Empty text="Aucun booster." /> : a.boosters.map(b => (
                  <div key={b.id} style={{ padding: '9px 0', borderTop: '1px solid rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <Zap size={15} color={b.status === 'WON' ? '#15803d' : b.status === 'ACTIVE' ? 'var(--primary)' : 'var(--text-muted)'} />
                    <div style={{ flex: 1 }}>
                      <b>{MEDAL[b.tier]?.label}</b> · {b.progress} / {b.target} courses · {fcfa(b.bonus)}
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dateShort(b.startsAt)} → {dateShort(b.endsAt)} · {b.status === 'WON' ? 'réussi' : b.status === 'ACTIVE' ? 'en cours' : 'manqué'}</div>
                    </div>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>

        {ask && (
          <div onClick={() => setAsk(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(2,21,32,.35)', display: 'grid', placeItems: 'center', zIndex: 1001 }}>
            <div onClick={e => e.stopPropagation()} style={{ ...glass, background: '#fff', padding: 22, width: 'min(440px, 92vw)', display: 'grid', gap: 12 }}>
              <b style={{ fontSize: 15 }}>{ask.title}</b>
              <textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={300} placeholder="Motif (envoyé à l'ambassadeur)"
                style={{ ...glassInput, padding: 10, fontSize: 13, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setAsk(null)} style={btnGhost}>Retour</button>
                <button disabled={!reason.trim() || busy} onClick={() => { const run = ask.run; setAsk(null); act(() => run(reason.trim())) }} style={{ ...btnDanger, opacity: reason.trim() ? 1 : 0.5 }}>{ask.label}</button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Card({ title, children }) {
  return <section style={{ ...glass, padding: '14px 18px' }}><h3 style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 800 }}>{title}</h3>{children}</section>
}
function KV({ k, v }) {
  return <div style={{ display: 'flex', gap: 12, fontSize: 13, padding: '3px 0' }}><span style={{ width: 150, flexShrink: 0, color: 'var(--text-muted)' }}>{k}</span><span style={{ minWidth: 0 }}>{v}</span></div>
}
function Empty({ text }) { return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</div> }

const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, borderRadius: 8, color: 'var(--text-muted)' }
const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary = { ...base, border: 'none', background: 'var(--primary)', color: '#fff' }
const btnDanger = { ...base, border: 'none', background: '#b91c1c', color: '#fff' }
const btnGhost = { ...base, border: '1px solid rgba(0,119,182,.25)', background: 'transparent', color: 'var(--primary)' }
const link = { display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }
const linkBtn = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5 }
const docLink = { display: 'grid', gap: 4, justifyItems: 'center', fontSize: 12, color: 'var(--text-muted)', textDecoration: 'none', padding: 6, border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, minWidth: 120, alignContent: 'center' }
