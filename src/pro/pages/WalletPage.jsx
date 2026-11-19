import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock, Wallet, AlertTriangle, Send, Lock, ShieldCheck } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { dateTime, fcfa, phoneFmt } from '../lib/format'
import { Button, Card, Chip, CountUp, Empty, Modal, SectionTitle, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Wallet DEM Pro : mêmes soldes et historique que l'app ; retrait Wave /
// Orange Money avec la même sécurité (code secret, ou code SMS si l'argent
// part vers un autre numéro).
const TX = {
  CREDIT_PRO_SALE:       ['Vente encaissée', '#16a34a'],
  CREDIT_TOPUP:          ['Rechargement', '#16a34a'],
  CREDIT_REFUND:         ['Remboursement', '#16a34a'],
  CREDIT_DELIVERY:       ['Crédit', '#16a34a'],
  CREDIT_PROMO_SUBSIDY:  ['Prise en charge DEM', '#16a34a'],
  DEBIT_CASHOUT:         ['Retrait', '#0671ba'],
  DEBIT_SUBSCRIPTION:    ['Abonnement DEM Pro', '#475569'],
  DEBIT_ORDER:           ['Livraison payée', '#d97706'],
  DEBIT_PRO_SALE_REFUND: ['Vente remboursée', '#dc2626'],
  DEBIT_CASH_FEE:        ['Frais', '#d97706'],
  DEBIT_FORFAIT:         ['Passe', '#d97706'],
}
const OPERATORS = [['WAVE', 'Wave', '#1dc3ff'], ['ORANGE_MONEY', 'Orange Money', '#ff7900']]

export default function WalletPage() {
  const [wallet, setWallet] = useState(null)
  const [txs, setTxs] = useState(null)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [more, setMore] = useState(false)
  const [cashout, setCashout] = useState(false)

  const load = useCallback(async () => {
    const [w, t] = await Promise.all([
      proApi.get('/users/dem-pro/wallet').then(r => r.data).catch(() => null),
      proApi.get('/users/dem-pro/wallet/transactions', { params: { page: 1, limit: 25, cashouts: 'all' } }).then(r => r.data).catch(() => null),
    ])
    setWallet(w); setTxs(t?.transactions ?? []); setTotal(t?.total ?? 0); setPage(1)
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const loadMore = async () => {
    setMore(true)
    try {
      const r = await proApi.get('/users/dem-pro/wallet/transactions', { params: { page: page + 1, limit: 25, cashouts: 'all' } })
      setTxs(list => [...list, ...(r.data.transactions ?? [])]); setPage(p => p + 1)
    } finally { setMore(false) }
  }

  // Entrées / sorties des 8 dernières semaines
  const weekly = useMemo(() => {
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay() + 1 - (7 - i) * 7)
      return { start: d.getTime(), label: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), in: 0, out: 0 }
    })
    for (const t of txs ?? []) {
      const at = new Date(t.createdAt).getTime()
      const w = [...weeks].reverse().find(x => at >= x.start)
      if (!w) continue
      if (t.amount > 0) w.in += t.amount; else w.out += -t.amount
    }
    return weeks
  }, [txs])

  return (
    <div>
      <div className="anim-up" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>Wallet</h1>
          <div className="muted" style={{ marginTop: 4 }}>Vos ventes encaissées en ligne et vos retraits, comme dans l'application.</div>
        </div>
        <Button icon={Banknote} disabled={!wallet || wallet.withdrawableBalance < (wallet.minCashoutAmount ?? 1000)} onClick={() => setCashout(true)}>Retirer</Button>
      </div>

      {wallet?.cashoutAlert && (
        <div className="anim-up" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: 'var(--p-warning-bg)', color: '#92400e', marginBottom: 18, fontWeight: 600, fontSize: 13.5 }}>
          <AlertTriangle size={18} /> {wallet.cashoutAlert.message ?? 'Un retrait demande votre attention.'}
        </div>
      )}

      <div className="grid-main" style={{ marginBottom: 20 }}>
        <div className="card anim-up" style={{ padding: 26, background: 'linear-gradient(140deg, #04317c 0%, #021b47 100%)', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}>
          <div aria-hidden style={{ position: 'absolute', right: -50, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(12,184,222,.4), transparent 70%)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', opacity: .8, fontWeight: 700, fontSize: 13 }}><Wallet size={17} /> Solde retirable</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.4px', marginTop: 8, position: 'relative' }}>
            {wallet ? <CountUp value={wallet.withdrawableBalance} format={fcfa} /> : <Skeleton w={200} h={44} style={{ opacity: .3 }} />}
          </div>
          <div style={{ display: 'flex', gap: 24, marginTop: 18, flexWrap: 'wrap', position: 'relative' }}>
            <Mini label="Solde total" value={wallet ? fcfa(wallet.balance) : '…'} hint="Dont ventes en attente de livraison" />
            {wallet?.pendingCashoutAmount > 0 && <Mini label="Retrait en cours" value={fcfa(wallet.pendingCashoutAmount)} />}
            {OPERATORS.map(([k, label]) => wallet?.receivedByOperator?.[k] > 0 && <Mini key={k} label={`Reçu via ${label}`} value={fcfa(wallet.receivedByOperator[k])} />)}
          </div>
        </div>
        <Card className="anim-up">
          <SectionTitle title="Entrées et sorties" hint="8 dernières semaines" />
          <div style={{ height: 150, marginLeft: -8 }}>
            {!txs ? <Skeleton h={140} r={12} /> : !weekly.some(w => w.in || w.out) ? (
              <div className="muted" style={{ height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', fontSize: 13.5, padding: '0 16px', marginLeft: 8, background: 'var(--p-soft)', borderRadius: 14 }}>
                Aucun mouvement sur les 8 dernières semaines.<br />Vos ventes en ligne et vos retraits s'afficheront ici.
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={weekly} barGap={2}>
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#8a9ab0' }} />
                  <Tooltip cursor={{ fill: 'rgba(12,184,222,.06)' }} contentStyle={{ borderRadius: 12, border: '1px solid #e6ebf3', fontFamily: 'Plus Jakarta Sans', fontSize: 12.5 }}
                    formatter={(v, n) => [fcfa(v), n === 'in' ? 'Entrées' : 'Sorties']} />
                  <Bar dataKey="in" fill="#16a34a" radius={[6, 6, 0, 0]} animationDuration={800} />
                  <Bar dataKey="out" fill="#0671ba" radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="anim-up" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 8px' }}><SectionTitle title="Historique" hint={txs ? `${total} opération${total > 1 ? 's' : ''}` : ' '} /></div>
        {!txs ? <div style={{ padding: 22, display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={50} r={12} />)}</div>
          : txs.length === 0 ? <Empty icon={Wallet} title="Aucune opération" text="Les ventes payées en ligne via votre lien de commande arrivent ici." />
          : (
            <div className="stagger">
              {txs.map(t => {
                const [label, color] = TX[t.type] ?? [t.type, '#6b7c93']
                const credit = t.amount > 0
                return (
                  <div key={t.id} className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 22px', borderTop: '1px solid var(--p-line)' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: color + '14', color, flexShrink: 0 }}>{credit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</div>
                      <div className="muted" style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                    </div>
                    {t.samirpayStatus === 'PENDING' && <Chip color="#d97706"><Clock size={11} /> En cours</Chip>}
                    {t.samirpayStatus === 'FAILED' && <Chip color="#dc2626">Échoué</Chip>}
                    <div style={{ textAlign: 'right' }}>
                      <div className="num" style={{ fontWeight: 800, color: credit ? 'var(--p-success)' : 'var(--p-ink)' }}>{credit ? '+' : '−'} {fcfa(Math.abs(t.amount))}</div>
                      <div className="muted" style={{ fontSize: 11.5 }}>{dateTime(t.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
              {txs.length < total && <div style={{ padding: 16, textAlign: 'center', borderTop: '1px solid var(--p-line)' }}><Button variant="ghost" size="sm" loading={more} onClick={loadMore}>Voir plus</Button></div>}
            </div>
          )}
      </Card>

      <CashoutModal open={cashout} wallet={wallet} onClose={() => setCashout(false)} onDone={() => { setCashout(false); load(); window.dispatchEvent(new CustomEvent('dem-pro:refresh')) }} />
    </div>
  )
}

function Mini({ label, value, hint }) {
  return (
    <div title={hint}>
      <div style={{ fontSize: 12, opacity: .65, fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontWeight: 800, fontSize: 16 }}>{value}</div>
    </div>
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
  const needsOtp = !hasPin && other
  const valid = n >= min && n <= max && (!other || (/^\+2217[015678]\d{7}$/.test(destE164) && destName.trim().length >= 2)) &&
    (hasPin ? pin.length === 6 : !needsOtp || otp.length >= 4)

  const sendOtp = async () => {
    setBusy(true)
    try { await proApi.post('/users/dem-pro/wallet/cashout/request-otp', { destinationPhone: destE164 }); setOtpSent(true); notify.info('Code envoyé', `Par SMS au ${phoneFmt(user?.phone)}.`) }
    catch (e) { notify.error('Envoi impossible', errMsg(e)) } finally { setBusy(false) }
  }

  const submit = async () => {
    setBusy(true)
    try {
      await proApi.post('/users/dem-pro/wallet/cashout', {
        amount: n, operatorName: operator,
        ...(other ? { destinationPhone: destE164, destinationName: destName.trim() } : {}),
        ...(hasPin ? { pin } : {}), ...(needsOtp ? { otp } : {}),
      })
      notify.success('Retrait demandé', `${fcfa(n)} vers ${OPERATORS.find(o => o[0] === operator)[1]} · ${phoneFmt(destE164)}.`)
      onDone()
    } catch (e) { notify.error('Retrait refusé', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Retirer de l'argent" subtitle={`Disponible : ${fcfa(max)} · minimum ${fcfa(min)}`} width={480}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button icon={Send} loading={busy} disabled={!valid} onClick={submit}>Retirer {n ? fcfa(n) : ''}</Button></>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <label className="field"><span>Montant</span>
          <div style={{ position: 'relative' }}>
            <input className="input" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder="0" style={{ fontSize: 22, fontWeight: 800, height: 56, paddingRight: 70 }} />
            <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 8, top: 11 }} onClick={() => setAmount(String(Math.floor(max)))}>Tout</button>
          </div>
          {n > max && <small style={{ color: 'var(--p-danger)', fontWeight: 600 }}>Au-delà de votre solde retirable.</small>}
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {OPERATORS.map(([k, label, color]) => (
            <button key={k} onClick={() => setOperator(k)} style={{ padding: 14, borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, border: `1.5px solid ${operator === k ? color : 'var(--p-line)'}`, background: operator === k ? color + '12' : '#fff', color: 'var(--p-ink)', transition: 'all .18s' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 8 }} />{label}
            </button>
          ))}
        </div>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={other} onChange={e => setOther(e.target.checked)} /> Envoyer vers un autre numéro que {phoneFmt(user?.phone)}
        </label>
        {other && (
          <div className="anim-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field"><span>Numéro</span><input className="input" inputMode="numeric" value={destPhone} onChange={e => setDestPhone(e.target.value)} placeholder="77 123 45 67" /></label>
            <label className="field"><span>Nom du bénéficiaire</span><input className="input" value={destName} onChange={e => setDestName(e.target.value)} placeholder="Prénom Nom" /></label>
          </div>
        )}
        {hasPin ? (
          <label className="field"><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Lock size={13} /> Votre code secret</span>
            <input className="input" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ letterSpacing: 6, fontSize: 18 }} />
          </label>
        ) : needsOtp && (
          <div style={{ display: 'grid', gap: 8 }}>
            {!otpSent ? <Button variant="ghost" icon={ShieldCheck} loading={busy} disabled={!/^\+2217[015678]\d{7}$/.test(destE164)} onClick={sendOtp}>Recevoir un code de confirmation par SMS</Button>
              : <label className="field"><span>Code reçu par SMS</span><input className="input" inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /></label>}
          </div>
        )}
      </div>
    </Modal>
  )
}
