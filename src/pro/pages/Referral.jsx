import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, CheckCircle2, Clock, Copy, Gift, Hourglass, MessageCircle, Redo2, UserPlus } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { dateTime } from '../lib/format'
import { Button, Empty, ErrorState, PageHeader, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import RequireAccess from '../ui/RequireAccess'
import '../styles/account.css'

// Parrainage DEM Pro (responsable) — même écran que l'app
// (dem_pro_referral_screen.dart) : GET/POST /dem-pro/me/referral. Rien n'est
// automatique : l'équipe DEM étudie chaque parrainage et peut offrir des
// jours d'offre. Aucune promesse chiffrée ici.
const STATUS = {
  REWARDED: { icon: BadgeCheck, tone: 'ok', label: (f) => (f.daysEarned > 0 ? `+${f.daysEarned} jours offerts par l'équipe DEM` : 'Parrainage récompensé') },
  QUALIFIED: { icon: Gift, tone: 'info', label: () => 'Offre activée, récompense étudiée par l\'équipe DEM' },
  VALIDATED: { icon: Hourglass, tone: 'info', label: () => 'Validé, n\'a pas encore activé d\'offre' },
  SIGNED_UP: { icon: Clock, tone: 'muted', label: () => 'Inscrit, en cours de validation' },
}

export default function ReferralPage() {
  return <RequireAccess area="referral"><Referral /></RequireAccess>
}

function Referral() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    try { const r = await proApi.get('/dem-pro/me/referral'); setData(r.data); setFailed(false) } catch { setFailed(true) }
  }, [])
  useEffect(() => { load() }, [load])

  const shop = user?.proBusinessName || 'ma boutique'
  const code = data?.code ?? ''
  const shareText = `J'utilise DEM Pro pour les livraisons de ${shop}. Inscrivez votre commerce sur l'application DEM (https://www.dem.sn) et saisissez mon code de parrainage : ${code}`
  const copy = async (text, title) => {
    try { await navigator.clipboard.writeText(text); notify.success(title) } catch { notify.error('Copie impossible', 'Sélectionnez le texte à la main.') }
  }
  const t = data?.totals ?? {}

  return (
    <div className="rf-page">
      <PageHeader eyebrow="Compte" title={<>Parrainage<span className="dot">.</span></>}
        description="Recommandez DEM Pro aux commerçants de votre entourage. L'équipe DEM remercie les parrains dont les filleuls activent leur offre." />

      {failed && !data ? <div className="card"><ErrorState title="Impossible de charger votre parrainage" onRetry={load} /></div>
        : !data ? <div style={{ display: 'grid', gap: 16 }}><Skeleton h={180} /><Skeleton h={96} /></div>
        : (
          <div style={{ display: 'grid', gap: 24 }}>
            {data.active !== true && (
              <p className="rf-note" role="status">Le parrainage DEM Pro n'est pas ouvert pour le moment, ou votre compte attend encore sa validation. Votre code est prêt : les filleuls compteront dès l'ouverture.</p>
            )}

            <section className="rf-hero has-corners">
              <span className="corner tl" aria-hidden /><span className="corner br" aria-hidden />
              <div className="rf-hero-text">
                <p className="eyebrow on-dark">Votre code</p>
                <div className="rf-code mono" aria-label={`Code de parrainage ${code}`}>{code || '—'}</div>
                <p className="rf-hero-sub">Partagez-le : le commerçant le saisit en créant son compte DEM Pro.</p>
              </div>
              <div className="rf-hero-actions">
                <Button className="rf-btn-light" icon={Copy} disabled={!code} onClick={() => copy(code, 'Code copié')}>Copier le code</Button>
                <Button variant="ghost" className="rf-btn-ghost" icon={MessageCircle} disabled={!code} href={code ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : undefined} target="_blank" rel="noopener noreferrer">Partager sur WhatsApp</Button>
                <button type="button" className="rf-copy-msg" disabled={!code} onClick={() => copy(shareText, 'Message copié')}><Redo2 size={14} aria-hidden /> Copier le message complet</button>
              </div>
            </section>

            <div className="rf-stats">
              <Stat icon={UserPlus} value={t.invited ?? 0} label="Inscrits" />
              <Stat icon={BadgeCheck} value={t.qualified ?? 0} label="Offres activées" />
              <Stat icon={Gift} value={`${t.daysEarned ?? 0} j`} label="Offerts par DEM" />
            </div>

            <section>
              <h2 className="api-h2" style={{ marginBottom: 12 }}>Mes filleuls</h2>
              <div className="card">
                {(data.filleuls ?? []).length === 0 ? (
                  <Empty icon={UserPlus} title="Personne pour l'instant" text="Partagez votre code à un commerçant de votre entourage." />
                ) : (
                  <ul className="rf-list">
                    {data.filleuls.map(f => {
                      const s = STATUS[f.status] ?? STATUS.SIGNED_UP
                      const Icon = s.icon
                      return (
                        <li key={f.id}>
                          <span className={`rf-ico rf-${s.tone}`} aria-hidden><Icon size={16} /></span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600 }}>{f.businessName ?? 'Commerçant'}</div>
                            <div className="muted" style={{ fontSize: 13 }}>{s.label(f)}</div>
                          </div>
                          <span className="muted rf-date">Inscrit le {dateTime(f.joinedAt)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>

            <div className="rf-bottom">
              <section className="card rf-how">
                <h2 className="api-h2">Comment ça marche</h2>
                <ol>
                  <li>Partagez votre code à un commerçant.</li>
                  <li>Il inscrit son commerce sur DEM Pro et saisit votre code.</li>
                  <li>Quand il paie sa première offre, l'équipe DEM étudie votre parrainage et peut vous offrir, à vous et à lui, des jours d'offre. Vous êtes prévenu par notification.</li>
                </ol>
              </section>
              {data.referredBy ? (
                <section className="card rf-how">
                  <h2 className="api-h2">Votre parrain</h2>
                  <p style={{ margin: '8px 0 0', fontSize: 14 }}>
                    <CheckCircle2 size={15} color="var(--p-success)" aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
                    Vous avez été parrainé par <b>{data.referredBy.businessName}</b>.
                    {data.referredBy.rewardedDays > 0 ? ` L'équipe DEM vous a offert ${data.referredBy.rewardedDays} jours.` : ''}
                  </p>
                </section>
              ) : data.canEnterCode ? <EnterCode onDone={load} /> : null}
            </div>
          </div>
        )}
    </div>
  )
}

function Stat({ icon, value, label }) {
  const Icon = icon
  return (
    <div className="card rf-stat">
      <Icon size={16} color="var(--p-subtle)" aria-hidden />
      <div className="rf-stat-value num">{value}</div>
      <div className="muted rf-stat-label">{label}</div>
    </div>
  )
}

function EnterCode({ onDone }) {
  const notify = useNotify()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (ev) => {
    ev?.preventDefault()
    if (code.trim().length < 3 || busy) return
    setBusy(true); setError('')
    try {
      const r = await proApi.post('/dem-pro/me/referral', { code: code.trim() })
      notify.success('C\'est noté', `Vous êtes parrainé par ${r.data?.referrerName ?? 'ce commerçant'}.`)
      onDone()
    } catch (e) { setError(errMsg(e, 'Impossible d\'enregistrer ce code.')) } finally { setBusy(false) }
  }
  return (
    <form className="card rf-how" onSubmit={save} noValidate>
      <h2 className="api-h2">Vous avez un code de parrainage ?</h2>
      <p className="muted" style={{ margin: '6px 0 14px', fontSize: 13.5 }}>Le code d'un commerçant DEM Pro qui vous a recommandé. À saisir avant votre première offre payée.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="input mono" style={{ flex: '1 1 180px', textTransform: 'uppercase' }} value={code} maxLength={20}
          onChange={e => { setCode(e.target.value); setError('') }} placeholder="Code de parrainage" aria-label="Code de parrainage" aria-invalid={!!error} />
        <Button type="submit" loading={busy} disabled={code.trim().length < 3} onClick={save}>Valider le code</Button>
      </div>
      {error && <p className="ac-form-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </form>
  )
}
