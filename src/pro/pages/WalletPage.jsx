import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, Wallet, AlertTriangle, Send, Lock, ShieldCheck, Download, Hourglass } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { dateTime, fcfa, num, phoneFmt, timeAgo } from '../lib/format'
import { Button, Card, Empty, ErrorState, Modal, PageHeader, SectionTitle, Skeleton, StatCard } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Wallet DEM Pro : mêmes soldes et historique que l'app ; retrait Wave /
// Orange Money avec la même sécurité (code secret, ou code SMS si l'argent
// part vers un autre numéro).
const TX = {
  CREDIT_PRO_SALE:               ['Vente encaissée', 'sale'],
  CREDIT_PRO_SALE_CASH:          ['Vente en espèces · en attente de reversement', 'sale'],
  RELEASE_PRO_SALE_CASH:         ['Vente en espèces · devenue retirable', 'release'],
  DEBIT_PRO_SALE_CASH_CANCELLED: ['Vente en espèces reprise', 'refund'],
  CREDIT_TOPUP:                  ['Rechargement', 'other'],
  CREDIT_REFUND:                 ['Remboursement', 'other'],
  CREDIT_DELIVERY:               ['Crédit', 'other'],
  CREDIT_PROMO_SUBSIDY:          ['Prise en charge DEM', 'other'],
  DEBIT_CASHOUT:                 ['Retrait', 'cashout'],
  DEBIT_SUBSCRIPTION:            ['Abonnement DEM Pro', 'other'],
  DEBIT_ORDER:                   ['Livraison payée', 'other'],
  DEBIT_PRO_SALE_REFUND:         ['Vente remboursée', 'refund'],
  DEBIT_CASH_FEE:                ['Frais', 'other'],
  DEBIT_FORFAIT:                 ['Passe', 'other'],
}
const FILTERS = [['all', 'Tout'], ['sale', 'Ventes'], ['cashout', 'Retraits'], ['refund', 'Remboursements'], ['other', 'Autres']]
const OPERATORS = [['WAVE', 'Wave', '#1DC8CE'], ['ORANGE_MONEY', 'Orange Money', '#FF7900']]
const kindOf = (t) => (TX[t.type]?.[1] === 'release' ? 'sale' : TX[t.type]?.[1]) ?? 'other'
// Mouvement « devenu retirable » : montant positif mais solde inchangé
const isRelease = (t) => t.type === 'RELEASE_PRO_SALE_CASH'
const PAGE = 25

function txStatus(t) {
  if (t.samirpayStatus === 'PENDING') return ['En cours', 'var(--p-warning)', 'var(--p-warning-bg)']
  if (t.samirpayStatus === 'FAILED') return ['Échoué', 'var(--p-danger)', 'var(--p-danger-bg)']
  if (t.type === 'CREDIT_PRO_SALE_CASH') return ['Bloqué', 'var(--p-slate)', 'var(--p-slate-bg)']
  return ['Effectué', 'var(--p-success)', 'var(--p-success-bg)']
}

function exportCsv(rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Date', 'Opération', 'Détail', 'Statut', 'Montant (F)']
  const lines = rows.map(t => [
    dateTime(t.createdAt), TX[t.type]?.[0] ?? t.type, t.description ?? '', txStatus(t)[0],
    isRelease(t) ? 0 : t.amount,
  ].map(cell).join(';'))
  const blob = new Blob(['﻿' + [head.map(cell).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = `wallet-dem-pro-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export default function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [txs, setTxs] = useState(null)
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState('all')
  const [cashout, setCashout] = useState(false)

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([
        proApi.get('/users/dem-pro/wallet').then(r => r.data),
        proApi.get('/users/dem-pro/wallet/transactions', { params: { page: 1, limit: PAGE, cashouts: 'all' } }).then(r => r.data),
      ])
      setWallet(w); setTxs(t?.transactions ?? []); setTotal(typeof t?.total === 'number' ? t.total : null); setPage(1); setFailed(false)
    } catch { setFailed(true) }
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const hasMore = txs && (total != null ? txs.length < total : txs.length >= page * PAGE)
  const loadMore = async () => {
    setMore(true)
    try {
      const r = await proApi.get('/users/dem-pro/wallet/transactions', { params: { page: page + 1, limit: PAGE, cashouts: 'all' } })
      setTxs(list => [...list, ...(r.data.transactions ?? [])]); setPage(p => p + 1)
    } catch { /* bouton laissé actif : l'utilisateur peut réessayer */ } finally { setMore(false) }
  }

  // Entrées / sorties des 8 dernières semaines (hors « devenu retirable »)
  const weekly = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - (7 - i) * 7)
      return { start: d.getTime(), label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), in: 0, out: 0 }
    })
    for (const t of txs ?? []) {
      if (isRelease(t)) continue
      const at = new Date(t.createdAt).getTime()
      const w = [...weeks].reverse().find(x => at >= x.start)
      if (!w) continue
      if (t.amount > 0) w.in += t.amount; else w.out += -t.amount
    }
    return weeks
  }, [txs])

  // Ventes du mois : seulement si l'historique chargé couvre tout le mois
  const monthSales = useMemo(() => {
    if (!txs) return null
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0)
    const oldest = txs.length ? new Date(txs[txs.length - 1].createdAt) : null
    const complete = !hasMore || (oldest && oldest < start)
    if (!complete) return null
    return txs.filter(t => new Date(t.createdAt) >= start && (t.type === 'CREDIT_PRO_SALE' || t.type === 'CREDIT_PRO_SALE_CASH')).reduce((s, t) => s + t.amount, 0)
  }, [txs, hasMore])

  const shown = useMemo(() => (txs ?? []).filter(t => filter === 'all' || kindOf(t) === filter), [txs, filter])
  const min = wallet?.minCashoutAmount ?? 1000
  const canCashout = !!wallet && wallet.withdrawableBalance >= min
  const blocked = wallet ? Math.max(0, (wallet.balance ?? 0) - (wallet.withdrawableBalance ?? 0)) : 0
  const remittance = Number(wallet?.pendingCashRemittanceAmount) || 0

  if (failed && !wallet) return (
    <div>
      <PageHeader eyebrow="Wallet" title={<>Votre wallet<span className="dot">.</span></>} />
      <Card><ErrorState title="Impossible de charger votre wallet" onRetry={load} /></Card>
    </div>
  )

  return (
    <div>
      <PageHeader
        eyebrow="Wallet"
        title={<>Votre wallet<span className="dot">.</span></>}
        description="Vos ventes encaissées et vos retraits, comme dans l'application."
      />

      {wallet?.cashoutAlert && (
        <div role="alert" className="wl-alert"><AlertTriangle size={17} aria-hidden /> {wallet.cashoutAlert.message ?? 'Un retrait demande votre attention.'}</div>
      )}

      <div className="wl-stats">
        <div className="card stat-card wl-main">
          <span className="label-caps">Solde retirable</span>
          <div className="num stat-value">{wallet ? fcfa(wallet.withdrawableBalance) : <Skeleton w={130} h={30} />}</div>
          <div className="wl-main-foot">
            <span className="muted stat-sub">{wallet ? `Minimum ${fcfa(min)} par retrait` : ''}</span>
            <Button size="sm" icon={Banknote} disabled={!canCashout} onClick={() => setCashout(true)}>Retirer</Button>
          </div>
        </div>
        <StatCard label="Solde total" loading={!wallet} value={wallet && fcfa(wallet.balance)}
          sub={blocked > 0 ? `dont ${fcfa(blocked)} en attente` : 'Tout est retirable'} />
        {remittance > 0
          ? <StatCard label="En attente de reversement" icon={Hourglass} value={fcfa(remittance)}
              sub="Espèces encaissées par les coursiers, versées dès leur reversement" />
          : wallet?.pendingCashoutAmount > 0
            ? <StatCard label="Retrait en cours" value={fcfa(wallet.pendingCashoutAmount)} sub="Arrive sur votre Wave ou Orange Money" />
            : <StatCard label="Ventes ce mois" loading={!txs} value={monthSales == null ? '—' : fcfa(monthSales)}
                sub={monthSales == null ? 'Voir l’historique ci-dessous' : 'Ventes encaissées dans votre wallet'} />}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <SectionTitle title="Entrées et sorties" hint="8 dernières semaines"
          action={<div className="wl-legend" aria-hidden><span><i style={{ background: 'var(--p-dark)' }} />Entrées</span><span><i style={{ background: '#CBD5E1' }} />Sorties</span></div>} />
        <div style={{ height: 200 }}>
          {!txs ? <Skeleton h={190} /> : !weekly.some(w => w.in || w.out) ? (
            <div className="wl-empty-chart muted">Aucun mouvement sur les 8 dernières semaines. Vos ventes et vos retraits s'afficheront ici.</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={weekly} barGap={3} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: '#5B6B82' }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11.5, fill: '#5B6B82' }}
                  tickFormatter={(v) => v >= 1000 ? `${num(v / 1000)} k` : num(v)} />
                <Tooltip cursor={{ fill: 'rgba(0, 134, 200, .06)' }} contentStyle={{ borderRadius: 0, border: '1px solid #E2E8F0', fontFamily: 'DM Sans', fontSize: 12.5 }}
                  formatter={(v, n) => [fcfa(v), n === 'in' ? 'Entrées' : 'Sorties']} />
                <Bar dataKey="in" fill="#021520" maxBarSize={18} isAnimationActive={false} />
                <Bar dataKey="out" fill="#CBD5E1" maxBarSize={18} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div className="dl-tabs" role="tablist" aria-label="Filtrer l'historique">
          {FILTERS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className="dl-tab" onClick={() => setFilter(k)}>{label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" icon={Download} className="wl-export" disabled={!shown.length} onClick={() => exportCsv(shown)}>Exporter CSV</Button>
        </div>

        {!txs ? <div style={{ padding: 20, display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={44} />)}</div>
          : shown.length === 0 ? (
            <Empty icon={Wallet} title={filter === 'all' ? 'Aucune opération' : 'Aucune opération de ce type'}
              text={filter === 'all' ? 'Les ventes payées via votre lien de commande et vos retraits arrivent ici.' : null}
              action={filter !== 'all' && <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>Tout afficher</Button>} />
          ) : (
            <>
              <ul className="dl-mlist pro-only-sm">
                {shown.map(t => <TxCard key={t.id} t={t} />)}
              </ul>
              <table className="dl-table wl-table pro-hide-only-sm">
                <colgroup><col className="c-date" /><col className="c-op" /><col /><col className="c-status" /><col className="c-amount" /></colgroup>
                <thead><tr><th>Date</th><th>Opération</th><th>Détail</th><th>Statut</th><th className="num-col">Montant</th></tr></thead>
                <tbody>
                  {shown.map(t => {
                    const [label] = TX[t.type] ?? [t.type]
                    const [st, color, bg] = txStatus(t)
                    return (
                      <tr key={t.id}>
                        <td><span className="dl-date" title={timeAgo(t.createdAt)}>{dateTime(t.createdAt)}</span></td>
                        <td><span className="dl-ellipsis" style={{ fontWeight: 600 }}>{label}</span></td>
                        <td><span className="dl-ellipsis muted">{t.description || '—'}</span></td>
                        <td><span className="badge" style={{ background: bg, color }}><span className="badge-dot" aria-hidden />{st}</span></td>
                        <td className="num-col"><Amount t={t} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        {txs && (hasMore || shown.length > 0) && (
          <div className="dl-pager">
            <span>{total != null ? `${txs.length} sur ${total} opérations` : `${txs.length} opérations affichées`}</span>
            {hasMore && <Button variant="ghost" size="sm" loading={more} onClick={loadMore}>Charger plus</Button>}
          </div>
        )}
      </Card>

      <CashoutModal open={cashout} wallet={wallet} onClose={() => setCashout(false)} onDone={() => { setCashout(false); load(); window.dispatchEvent(new CustomEvent('dem-pro:refresh')) }} />
    </div>
  )
}

function Amount({ t }) {
  if (isRelease(t)) return <span className="num wl-amount" style={{ color: 'var(--p-muted)' }} title="Le solde ne change pas : ce montant devient retirable">{fcfa(t.amount)}</span>
  const credit = t.amount > 0
  return <span className="num wl-amount" style={{ color: credit ? 'var(--p-success)' : 'var(--p-ink)' }}>{credit ? '+ ' : '− '}{fcfa(Math.abs(t.amount))}</span>
}

function TxCard({ t }) {
  const [label] = TX[t.type] ?? [t.type]
  const [st, color, bg] = txStatus(t)
  return (
    <li className="dl-mcard" style={{ padding: '14px 16px', display: 'grid', gap: 6 }}>
      <span className="dl-mcard-top"><span style={{ fontWeight: 600, minWidth: 0 }} className="dl-ellipsis">{label}</span><Amount t={t} /></span>
      {t.description && <span className="muted dl-ellipsis" style={{ fontSize: 12.5 }}>{t.description}</span>}
      <span className="dl-mcard-bot"><span className="badge" style={{ background: bg, color }}><span className="badge-dot" aria-hidden />{st}</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{dateTime(t.createdAt)}</span></span>
    </li>
  )
}

function CashoutModal({ open, wallet, onClose, onDone }) {
  const { user } = useProAuth()
  const notify = useNotify()
  const [amount, setAmount] = useState('')
  const [operator, setOperator] = useState('WAVE')
  const [other, setOther] = useState(false)
  const [destPhone, setDestPhone] = useState('')
  const [destName, setDestName] = useState('')
  const [pin, setPin] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setAmount(''); setPin(''); setOtp(''); setOtpSent(false); setOther(false); setDestPhone(''); setDestName('') } }, [open])

  const hasPin = !!user?.hasPin || !!user?.pinSetAt
  const max = wallet?.withdrawableBalance ?? 0
  const min = wallet?.minCashoutAmount ?? 1000
  const n = Number(amount) || 0
  const destE164 = other ? '+221' + destPhone.replace(/\D/g, '').slice(0, 9) : user?.phone
  const destOk = /^\+2217[015678]\d{7}$/.test(destE164 ?? '')
  const needsOtp = !hasPin && other
  const valid = n >= min && n <= max && (!other || (destOk && destName.trim().length >= 2)) &&
    (hasPin ? pin.length === 6 : !needsOtp || otp.length >= 4)

  const sendOtp = async () => {
    setBusy(true)
    try { await proApi.post('/users/dem-pro/wallet/cashout/request-otp', { destinationPhone: destE164 }); setOtpSent(true); notify.info('Code envoyé', `Par SMS au ${phoneFmt(user?.phone)}.`) }
    catch (e) { notify.error('Le code n’a pas été envoyé', errMsg(e)) } finally { setBusy(false) }
  }

  // Un seul retrait à la fois, même si l'envoi est relancé (Entrée, double clic)
  const sending = useRef(false)
  const submit = async () => {
    if (sending.current || !valid) return
    sending.current = true
    setBusy(true)
    try {
      await proApi.post('/users/dem-pro/wallet/cashout', {
        amount: n, operatorName: operator,
        ...(other ? { destinationPhone: destE164, destinationName: destName.trim() } : {}),
        ...(hasPin ? { pin } : {}), ...(needsOtp ? { otp } : {}),
      })
      notify.success('Retrait demandé', `${fcfa(n)} vers ${OPERATORS.find(o => o[0] === operator)[1]} · ${phoneFmt(destE164)}.`)
      onDone()
    } catch (e) {
      // Code secret faux : champ vidé pour la nouvelle saisie
      if (e?.response?.data?.code === 'PIN_INCORRECT') setPin('')
      notify.error('Retrait refusé', errMsg(e))
    } finally { sending.current = false; setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Retirer de l'argent" subtitle={`Disponible : ${fcfa(max)} · minimum ${fcfa(min)}`} width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button icon={Send} loading={busy} disabled={!valid} onClick={submit}>Retirer {n ? fcfa(n) : ''}</Button></>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <label className="field"><span>Montant</span>
          <div style={{ position: 'relative' }}>
            <input className="input num" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0"
              aria-invalid={n > max || undefined} style={{ fontSize: 22, fontWeight: 700, height: 56, paddingRight: 128 }} />
            <button type="button" className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 8, top: 10 }} onClick={() => setAmount(String(Math.floor(max)))}>Tout retirer</button>
          </div>
          {n > max && <small role="alert" style={{ color: 'var(--p-danger)', fontWeight: 600 }}>Au-delà de votre solde retirable.</small>}
          {n > 0 && n < min && <small style={{ color: 'var(--p-muted)' }}>Minimum {fcfa(min)}.</small>}
        </label>

        <div className="field"><span id="wl-op-label">Vers</span>
        <div className="dl-reasons wl-ops" role="radiogroup" aria-labelledby="wl-op-label">
          {OPERATORS.map(([k, label, color]) => (
            <label key={k} className={`dl-radio ${operator === k ? 'on' : ''}`}>
              <input type="radio" name="operator" value={k} checked={operator === k} onChange={() => setOperator(k)} />
              <span className="dl-radio-mark" aria-hidden />
              <span className="wl-op-dot" style={{ background: color }} aria-hidden />
              <span style={{ fontWeight: 600 }}>{label}</span>
            </label>
          ))}
        </div>
        </div>

        <label className="wl-check">
          <input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} />
          <span className="wl-check-box" aria-hidden />
          Envoyer vers un autre numéro que le {phoneFmt(user?.phone)}
        </label>
        {other && (
          <div className="wl-two">
            <label className="field"><span>Numéro</span><input className="input" inputMode="numeric" value={destPhone} onChange={e => setDestPhone(e.target.value)} placeholder="77 123 45 67"
              aria-invalid={(destPhone.length >= 9 && !destOk) || undefined} /></label>
            <label className="field"><span>Nom du bénéficiaire</span><input className="input" value={destName} onChange={e => setDestName(e.target.value)} placeholder="Prénom Nom" /></label>
          </div>
        )}
        {hasPin ? (
          <label className="field"><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Lock size={13} aria-hidden /> Votre code secret</span>
            <input className="input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ letterSpacing: 6, fontSize: 18 }} />
          </label>
        ) : needsOtp && (
          <div style={{ display: 'grid', gap: 8 }}>
            {!otpSent ? <Button variant="ghost" icon={ShieldCheck} loading={busy} disabled={!destOk} onClick={sendOtp}>Recevoir un code de confirmation par SMS</Button>
              : <label className="field"><span>Code reçu par SMS</span><input className="input" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>}
          </div>
        )}
      </div>
    </Modal>
  )
}
