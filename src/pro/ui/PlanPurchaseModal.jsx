import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ArrowLeft, Check, CheckCircle2, Gift, MessageCircle, Sparkles } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { proSocket } from '../lib/proSocket'
import { fcfa } from '../lib/format'
import { Button, ErrorState, Modal, Skeleton, Spinner } from './ui'
import { useNotify } from './notifyContext'
import { whatsappUrl } from '../support'
import '../styles/account.css'

// Offres DEM Pro : essai gratuit et achat d'une offre, comme l'app
// (dem_pro_offers_window.dart, dem_pro_plan_gate.dart:purchaseDemProTier) :
// 1. comparatif Starter / Business / Premium (payées à la semaine) et essai
//    gratuit quand l'équipe DEM l'a ouvert ;
// 2. récapitulatif + choix de l'opérateur, puis paiement confirmé par un clic ;
// 3. page Wave / Orange Money dans un nouvel onglet + QR code ;
// 4. confirmation par la socket (wallet:updated, même orderRef) ou, à défaut,
//    relecture de l'offre toutes les 4 s — sans rien à cliquer.
// Le montant n'est jamais envoyé : le serveur le fixe (ProPlanLimits).
const OPERATORS = [['WAVE', 'Wave'], ['ORANGE_MONEY', 'Orange Money']]
const TIER_ORDER = ['STARTER', 'BUSINESS', 'PREMIUM']
const longDate = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' })

// Limites d'une offre en lignes lisibles, les plus parlantes d'abord
// (dem_pro_plan_gate.dart : demProTierFeatureRows + demProPrioritizedFeatures)
const PRIORITY = ['Lien de commande', 'Dashboard', 'Facture', 'Mes clients', 'Produits', 'Wallet']
function tierFeatureRows(limits = {}) {
  const qty = (key, label, fem) => (limits[key] == null ? `${label} illimité${fem ? 'e' : ''}s` : `${label} : ${limits[key]} max`)
  const rows = [
    qty('maxBatchSimultaneous', 'Tournées groupées simultanées', true),
    qty('maxScheduledSimultaneous', 'Commandes programmées simultanées', true),
    qty('maxCatalogues', 'Catalogues'),
    qty('maxProducts', 'Produits'),
  ]
  if (limits.onlineSalesEnabled) {
    rows.push('Lien de commande (mini-boutique) et paiement en ligne')
    const cap = limits.withdrawalWeeklyCapFcfa
    rows.push(cap != null ? `Wallet DEM Pro, retrait jusqu'à ${fcfa(cap)} par semaine` : 'Wallet DEM Pro')
  }
  if (limits.apiAccessEnabled) rows.push('API DEM : branchez votre propre site')
  if (limits.financeViewsEnabled) rows.push('Dashboard : ventes, livraisons, activité et export')
  if (limits.crmEnabled) rows.push('Mes clients : historique et fidélisation')
  if (limits.invoiceEnabled) rows.push('Facture avec logo après chaque vente')
  if (limits.invoiceBatchEnabled) rows.push('Facturation groupée')
  const users = limits.maxUsers
  if (users != null) {
    rows.push(users > 1 ? `Jusqu'à ${users} téléphones connectés en même temps` : '1 téléphone connecté à la fois')
    if (users > 1) rows.push(`Équipe : jusqu'à ${users - 1} membre${users > 2 ? 's' : ''} avec leur propre numéro`)
  }
  rows.push(qty('maxAddresses', 'Adresses de retrait', true))
  rows.push(limits.supportTier === 'premium' ? 'Support premium et interlocuteur dédié' : limits.supportTier === 'priority' ? 'Support prioritaire' : 'Support standard')
  const rank = (r) => { const i = PRIORITY.findIndex(k => r.startsWith(k)); return i < 0 ? PRIORITY.length : i }
  return rows.map((r, i) => [r, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([r]) => r)
}

// Offre en cours (payée ou essai), comme le serveur (runningTier)
function running(info) {
  if (!info || !TIER_ORDER.includes(info.plan) || info.status === 'EXPIRED') return null
  const end = info.expiresAt ? new Date(info.expiresAt) : null
  return end && end > new Date() ? { plan: info.plan, end } : null
}

// Le paiement de `plan` est passé : offre active alors qu'elle ne l'était
// pas, ou date de fin changée (dem_pro_plan_gate.dart:demProTierPaymentLanded)
function landed(plan, before, after) {
  if (!after || after.plan !== plan || after.status !== 'ACTIVE' || after.isTrial) return false
  if (!before) return true
  if (before.plan !== plan || before.status !== 'ACTIVE' || before.isTrial) return true
  return !!after.expiresAt && after.expiresAt !== before.expiresAt
}

export default function PlanPurchaseModal({ open, onClose, onChanged }) {
  const notify = useNotify()
  const [info, setInfo] = useState(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState('choose') // choose | confirm | pay | done
  const [choice, setChoice] = useState(null) // { plan, label, price, days, legacy }
  const [operator, setOperator] = useState(null)
  const [payment, setPayment] = useState(null)
  const [qr, setQr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null) // { label, until, trial, features }
  // Semaine (7 j, toujours en vente) ou mois (30 j, si le Super Admin en a
  // fixé le prix : limits.pricePerMonth)
  const [period, setPeriod] = useState('WEEK')
  const sending = useRef(false)
  const before = useRef(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const r = await proApi.get('/dem-pro/me/plan')
      setInfo(r.data); before.current = r.data
      return r.data
    } catch { setFailed(true); return null }
  }, [])

  useEffect(() => {
    if (!open) return
    setView('choose'); setChoice(null); setOperator(null); setPayment(null); setQr(null); setDone(null); setInfo(null)
    load()
  }, [open, load])

  const close = () => {
    const changed = !!done || view === 'pay'
    onClose?.()
    if (changed) onChanged?.()
  }

  const tiers = (info?.allTiers ?? []).slice().sort((a, b) => TIER_ORDER.indexOf(a.plan) - TIER_ORDER.indexOf(b.plan))
  const offersTiers = tiers.length > 0 && (info?.planSystem === 'tiers' || info?.tiersPurchasable)
  const legacyNext = !offersTiers && info?.nextTier === 'PRO' && info?.nextTierPrice ? info : null
  const run = running(info)
  const tierLabel = (p) => tiers.find(t => t.plan === p)?.label ?? ({ STARTER: 'Starter', BUSINESS: 'Business', PREMIUM: 'Premium' })[p] ?? p
  const limitsOf = (p) => tiers.find(t => t.plan === p)?.limits ?? {}
  const monthOf = (l) => (l?.pricePerMonth > 0 ? l.pricePerMonth : null)
  const monthly = tiers.some(t => monthOf(t.limits) != null)
  const priceOf = (l) => (period === 'MONTH' ? monthOf(l) : l?.priceMonthly ?? null)
  // Économie du mois comparée à 30 jours payés à la semaine
  const savingOf = (l) => {
    const w = l?.priceMonthly, m = monthOf(l)
    if (!(w > 0) || !m) return null
    const pct = Math.floor((1 - m / (w * 30 / 7)) * 100)
    return pct >= 1 ? pct : null
  }
  const bestSaving = Math.max(0, ...tiers.map(t => savingOf(t.limits) ?? 0)) || null

  // ── Essai gratuit ────────────────────────────────────────────────────────
  const startTrial = async () => {
    if (sending.current) return
    sending.current = true; setBusy(true)
    try {
      const r = await proApi.post('/dem-pro/me/trial')
      setInfo(r.data)
      setDone({ trial: true, label: r.data?.planLabel ?? tierLabel(info.trialPlan), until: r.data?.expiresAt, features: tierFeatureRows(r.data?.tierLimits ?? limitsOf(info.trialPlan)) })
      setView('done')
      onChanged?.()
    } catch (e) {
      notify.error('L\'essai n\'a pas démarré', errMsg(e))
    } finally { setBusy(false); sending.current = false }
  }

  // ── Achat ────────────────────────────────────────────────────────────────
  const choose = (c) => { setChoice(c); setOperator(null); setView('confirm') }

  const pay = async () => {
    if (sending.current || !choice || !operator) return
    sending.current = true; setBusy(true)
    try {
      const url = choice.legacy ? '/dem-pro/me/plan/purchase' : '/dem-pro/me/tiers/purchase'
      const r = await proApi.post(url, choice.legacy
        ? { plan: choice.plan, operatorName: operator }
        : { plan: choice.plan, operatorName: operator, period: choice.period ?? 'WEEK' })
      setPayment(r.data ?? {})
      setView('pay')
      if (r.data?.paymentUrl) window.open(r.data.paymentUrl, '_blank', 'noopener')
    } catch (e) {
      notify.error('Paiement impossible', errMsg(e))
    } finally { setBusy(false); sending.current = false }
  }

  useEffect(() => {
    const url = payment?.paymentUrl
    if (!url) return
    let alive = true
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#021520', light: '#ffffff' } })
      .then(d => { if (alive) setQr(d) }).catch(() => {})
    return () => { alive = false }
  }, [payment])

  // Confirmation : socket (même orderRef), sinon relecture de l'offre
  useEffect(() => {
    if (view !== 'pay' || !payment || !choice) return
    let stop = false
    const finish = (next) => {
      if (stop) return
      stop = true
      const limits = next?.tierLimits ?? limitsOf(choice.plan)
      setInfo(next ?? info)
      setDone({ trial: false, label: choice.label, until: next?.plan === choice.plan ? next?.expiresAt : null, features: choice.legacy ? (next?.features ?? []) : tierFeatureRows(limits) })
      setView('done')
      onChanged?.()
    }
    const check = async () => {
      try {
        const next = (await proApi.get('/dem-pro/me/plan')).data
        if (landed(choice.plan, before.current, next)) finish(next)
      } catch { /* réseau : on réessaiera */ }
    }
    const s = proSocket()
    // Paiement confirmé pour CET achat : offre relue pour la date de fin
    const onWallet = (p) => {
      if (!p?.orderRef || p.orderRef !== payment.orderRef) return
      proApi.get('/dem-pro/me/plan').then(r => finish(r.data)).catch(() => finish(null))
    }
    s.on('wallet:updated', onWallet)
    const t = setInterval(() => { if (!document.hidden) check() }, 4000)
    const onVisible = () => { if (!document.hidden) check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { stop = true; s.off('wallet:updated', onWallet); clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, payment, choice])

  // ── Rendu ────────────────────────────────────────────────────────────────
  const title = view === 'done' ? (done?.trial ? 'Essai activé' : 'Offre activée')
    : view === 'confirm' ? `Offre ${choice?.label}`
    : view === 'pay' ? 'Paiement en cours'
    : 'Les offres DEM Pro'
  const subtitle = view === 'choose' ? `Payées ${monthly ? 'à la semaine ou au mois' : 'à la semaine'} par Wave ou Orange Money. Sans engagement.` : undefined

  let footer = null
  if (view === 'choose') footer = <Button variant="ghost" onClick={close}>Fermer</Button>
  if (view === 'confirm') footer = (
    <>
      <Button variant="ghost" icon={ArrowLeft} onClick={() => setView('choose')} disabled={busy}>Retour</Button>
      <Button loading={busy} disabled={!operator} onClick={pay}>Payer {fcfa(choice?.price)}</Button>
    </>
  )
  if (view === 'pay') footer = <Button variant="ghost" onClick={close}>Fermer</Button>
  if (view === 'done') footer = <Button onClick={close}>Continuer</Button>

  return (
    <Modal open={open} onClose={busy ? undefined : close} title={title} subtitle={subtitle} width={view === 'choose' ? 980 : 520} footer={footer}>
      {view === 'choose' && (
        failed ? <ErrorState compact title="Impossible de charger les offres" onRetry={load} />
        : !info ? <div className="pl-grid">{[0, 1, 2].map(i => <Skeleton key={i} h={320} />)}</div>
        : (
          <div style={{ display: 'grid', gap: 20 }}>
            {info.trialAvailable && (
              <div className="pl-trial has-corners">
                <span className="corner tl" aria-hidden /><span className="corner br" aria-hidden />
                <Gift size={22} aria-hidden className="pl-trial-ico" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pl-trial-title">Essai gratuit {tierLabel(info.trialPlan)} · {info.trialDays} jours</div>
                  <div className="pl-trial-text">Offert une fois par l'équipe DEM. Aucun paiement, aucune carte : à la fin de l'essai, vous choisissez votre offre.</div>
                </div>
                <Button loading={busy} onClick={startTrial}>Activer l'essai gratuit</Button>
              </div>
            )}

            {offersTiers && monthly && (
              <div role="radiogroup" aria-label="Durée" className="pl-period">
                {[['WEEK', 'À la semaine'], ['MONTH', 'Au mois']].map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={period === k}
                    className={`pl-period-btn ${period === k ? 'is-on' : ''}`} onClick={() => setPeriod(k)}>
                    {label}
                    {k === 'MONTH' && bestSaving && <span className="pl-period-save">−{bestSaving} %</span>}
                  </button>
                ))}
              </div>
            )}

            {offersTiers ? (
              <div className="pl-grid">
                {tiers.map(t => {
                  const price = priceOf(t.limits)
                  const saving = period === 'MONTH' ? savingOf(t.limits) : null
                  const current = run?.plan === t.plan
                  const lower = run && TIER_ORDER.indexOf(t.plan) < TIER_ORDER.indexOf(run.plan)
                  const renew = !run && info.lastPlan === t.plan
                  const featured = t.plan === 'BUSINESS'
                  return (
                    <div key={t.plan} className={`pl-card ${featured ? 'is-featured' : ''} ${current ? 'is-current' : ''}`}>
                      {featured && <span className="pl-flag">Le plus choisi</span>}
                      <div className="pl-name">{t.label}</div>
                      <div className="pl-price">
                        <span className="num">{price != null ? fcfa(price) : '—'}</span>
                        <small>{period === 'MONTH' ? 'par mois' : 'par semaine'}</small>
                        {saving && <span className="pl-period-save">−{saving} %</span>}
                      </div>
                      <ul className="pl-feats">
                        {tierFeatureRows(t.limits).map(f => <li key={f}><Check size={14} aria-hidden /> {f}</li>)}
                      </ul>
                      <div className="pl-cta">
                        {current ? (
                          <div className="pl-state">
                            <CheckCircle2 size={15} aria-hidden /> {info.isTrial ? 'Votre essai en cours' : 'Votre offre actuelle'}
                            <small>jusqu'au {longDate(run.end)}{info.isTrial ? '' : ', renouvelable à sa fin'}</small>
                          </div>
                        ) : lower ? (
                          <div className="pl-state is-muted">Disponible à la fin de votre offre actuelle</div>
                        ) : price == null ? (
                          <div className="pl-state is-muted">{period === 'MONTH' ? 'Proposée à la semaine seulement' : 'Prix bientôt disponible'}</div>
                        ) : (
                          <Button variant={featured ? 'primary' : 'ghost'} className="pl-btn" arrow="right"
                            onClick={() => choose({ plan: t.plan, label: t.label, price, days: period === 'MONTH' ? 30 : 7, period, upgrade: !!run, renew })}>
                            {run ? `Passer à ${t.label}` : renew ? `Renouveler ${t.label}` : `Choisir ${t.label}`}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : legacyNext ? (
              <div className="pl-grid pl-grid-one">
                <div className="pl-card is-featured">
                  <div className="pl-name">Offre Pro</div>
                  <div className="pl-price"><span className="num">{fcfa(legacyNext.nextTierPrice)}</span><small>par mois</small></div>
                  <ul className="pl-feats">{(legacyNext.nextTierFeatures ?? []).map(f => <li key={f}><Check size={14} aria-hidden /> {f}</li>)}</ul>
                  <div className="pl-cta">
                    <Button className="pl-btn" arrow="right" onClick={() => choose({ plan: 'PRO', label: 'Pro', price: legacyNext.nextTierPrice, days: 30, legacy: true })}>Passer à l'offre Pro</Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="pl-empty">
                <Sparkles size={20} aria-hidden />
                <div>
                  <strong>{info.plan && info.plan !== 'FREE' ? `Vous avez l'${info.planLabel ? `offre ${info.planLabel}` : 'offre la plus complète'}.` : 'Aucune offre en vente pour le moment.'}</strong>
                  <div className="muted">Une question sur les offres ? L'équipe DEM vous répond sur WhatsApp.</div>
                </div>
              </div>
            )}

            <a className="link-caps" href={whatsappUrl('Bonjour DEM, j\'ai une question sur les offres DEM Pro.')} target="_blank" rel="noopener noreferrer" style={{ justifySelf: 'start' }}>
              <MessageCircle size={14} aria-hidden /> Une question ? Écrire à l'équipe DEM
            </a>
          </div>
        )
      )}

      {view === 'confirm' && choice && (
        <div style={{ display: 'grid', gap: 18 }}>
          <dl className="pl-summary">
            <div><dt>Offre</dt><dd>{choice.label}</dd></div>
            <div><dt>Durée</dt><dd>{choice.days} jours</dd></div>
            <div><dt>Début</dt><dd>{choice.upgrade ? 'Tout de suite, elle remplace votre offre actuelle' : 'Dès le paiement confirmé'}</dd></div>
            <div className="is-total"><dt>À payer</dt><dd className="num">{fcfa(choice.price)}</dd></div>
          </dl>
          <div role="radiogroup" aria-label="Payer avec" className="pl-ops">
            <span className="pl-ops-label">Payer avec</span>
            {OPERATORS.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={operator === k} className={`pl-op ${operator === k ? 'is-on' : ''}`}
                onClick={() => setOperator(k)} disabled={busy}>
                <span className="pl-op-dot" aria-hidden />{label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            En cliquant sur « Payer », la page {operator === 'ORANGE_MONEY' ? 'Orange Money' : operator === 'WAVE' ? 'Wave' : 'de paiement'} s'ouvre dans un nouvel onglet. Votre offre s'active dès que l'opérateur confirme.
          </p>
        </div>
      )}

      {view === 'pay' && payment && (
        <div style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            Terminez le paiement de <b className="num">{fcfa(payment.amount ?? choice?.price)}</b> sur la page {operator === 'WAVE' ? 'Wave' : 'Orange Money'} qui vient de s'ouvrir, ou scannez ce code avec votre téléphone.
          </p>
          {qr ? <img src={qr} alt="QR code de paiement" width={180} height={180} style={{ border: '1px solid var(--p-line)' }} /> : payment.paymentUrl ? <Skeleton w={180} h={180} /> : null}
          {payment.paymentUrl && (
            <Button variant="ghost" size="sm" href={payment.paymentUrl} target="_blank" rel="noopener noreferrer" arrow="ne">Ouvrir la page de paiement</Button>
          )}
          {!payment.paymentUrl && <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Validez le paiement dans l'application {operator === 'WAVE' ? 'Wave' : 'Orange Money'} de votre téléphone.</p>}
          <span className="muted" role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <Spinner size={14} /> En attente de la confirmation de l'opérateur…
          </span>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Vous pouvez fermer cette fenêtre : l'offre s'activera quand même dès la confirmation.</p>
        </div>
      )}

      {view === 'done' && done && (
        <div role="status" style={{ display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <CheckCircle2 size={32} color="var(--p-success)" aria-hidden />
            <div>
              <div style={{ font: '700 18px/1.3 var(--p-head)' }}>{done.trial ? `Essai ${done.label} activé` : `Offre ${done.label} activée`}</div>
              {done.until && <div className="muted" style={{ fontSize: 13.5 }}>Jusqu'au {longDate(done.until)}</div>}
            </div>
          </div>
          {done.features?.length > 0 && (
            <ul className="pl-feats">{done.features.slice(0, 6).map(f => <li key={f}><Check size={14} aria-hidden /> {f}</li>)}</ul>
          )}
        </div>
      )}
    </Modal>
  )
}
