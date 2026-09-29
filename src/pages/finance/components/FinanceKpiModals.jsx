import { useState, useEffect } from 'react'
import api from '../../../lib/api'
import { glass } from '../../../lib/glassStyles'
import { formatF, formatCount } from '../../../lib/format'
import RevenueBreakdownTable from './RevenueBreakdownTable'

function Shell({ icon: Icon, color, title, onClose, children, width = 640 }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...glass, width, maxWidth: '95vw', padding: 0, borderRadius: 16, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} color={color} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}

function PeriodTabs({ periods, active, onChange, color }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
      {periods.map(p => (
        <button key={p.key} onClick={() => onChange(p.key)} style={{
          padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: active === p.key ? 'none' : '1px solid var(--border)',
          background: active === p.key ? color : 'transparent',
          color: active === p.key ? '#fff' : 'var(--text-muted)',
          transition: 'all .15s',
        }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Note({ children }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, marginTop: 16, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}

// Jours calendaires : 1 = aujourd'hui, N = aujourd'hui + les N−1 jours précédents
// (voir admin.kpi-definitions.js:lastNDaysStart) — "Aujourd'hui" affiche donc
// exactement le chiffre de la carte qui a ouvert le modal.
const DAY_PERIODS = [
  { key: 1,   label: "Aujourd'hui" },
  { key: 3,   label: '3 jours' },
  { key: 7,   label: '7 jours' },
  { key: 30,  label: '30 jours' },
  { key: 90,  label: '90 jours' },
  { key: 180, label: '180 jours' },
  { key: 365, label: '365 jours' },
]

function useRevenuePeriod(days) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api.get('/admin/finance/revenue-period', { params: { days } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [days])
  return { data, loading }
}

const Loading = () => <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement...</div>
const LoadError = () => <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Erreur de chargement.</div>

// ── KPI : Revenus DEM ─────────────────────────────────────────────────────────
export function RevenueModal({ icon, color, onClose }) {
  const [days, setDays] = useState(1)
  const { data, loading } = useRevenuePeriod(days)
  const label = DAY_PERIODS.find(p => p.key === days)?.label ?? `${days} jours`

  return (
    <Shell icon={icon} color={color} title="Revenus DEM" onClose={onClose} width={720}>
      <PeriodTabs periods={DAY_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <StatBox label="REVENUS FACTURÉS" value={formatF(data.totals.billed)} color={color} />
            <StatBox label="DONT ENCAISSÉS" value={formatF(data.totals.collected)} color="#0ea5e9" />
            <StatBox label="COMMISSION À RECOUVRER" value={formatF(data.totals.toRecover)} color="#f97316" />
          </div>
          <RevenueBreakdownTable columns={[{ label, rev: data }]} />
          <Note>
            {formatCount(data.deliveredCount)} course(s) livrée(s) sur la période. Commission = frais DEM réellement facturés
            sur les courses livrées (date de livraison). « Encaissée » = payée en ligne, l'argent est chez DEM.
            « À recouvrer » = payée en espèces au livreur (la commission est restée chez lui) ou pas encore payée.
            Pass et abonnements = montants réellement prélevés.
          </Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Commission sur les courses ──────────────────────────────────────────
export function FeesModal({ icon, color, onClose }) {
  const [days, setDays] = useState(1)
  const { data, loading } = useRevenuePeriod(days)

  return (
    <Shell icon={icon} color={color} title="Commission sur les courses" onClose={onClose}>
      <PeriodTabs periods={DAY_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 12 }}>
            <StatBox label="FACTURÉE" value={formatF(data.commission.billed)} color={color} sub={`${formatCount(data.deliveredCount)} course(s) livrée(s)`} />
            <StatBox label="ENCAISSÉE (EN LIGNE)" value={formatF(data.commission.collectedOnline)} color="#22c55e" sub={`${formatCount(data.ordersByChannel.online)} course(s)`} />
            <StatBox label="À RECOUVRER" value={formatF(data.commission.toRecover)} color="#f97316" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <StatBox label="CASH — CHEZ LES LIVREURS" value={formatF(data.commission.toRecoverByChannel.cash)} color="#f97316" sub={`${formatCount(data.ordersByChannel.cash)} course(s)`} />
            <StatBox label="PAS ENCORE PAYÉE" value={formatF(data.commission.toRecoverByChannel.unpaid)} color="#94a3b8" sub={`${formatCount(data.ordersByChannel.unpaid)} course(s)`} />
            <StatBox label="EN LITIGE" value={formatF(data.commission.toRecoverByChannel.disputed)} color="#ef4444" sub={`${formatCount(data.ordersByChannel.disputed)} course(s)`} />
          </div>
          <Note>
            Frais DEM réellement facturés sur les courses livrées (EXPRESS, tournées DEM Pro, tarif par zone…) — plus aucune
            estimation par la grille de commission. Facturée = encaissée + à recouvrer.
          </Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Livraisons payées ───────────────────────────────────────────────────
export function TransactionsModal({ icon, color, onClose }) {
  const [days, setDays] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/finance/transactions-period', { params: { days } })
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [days])

  const s = data?.summary
  const line = (b) => `${formatCount(b.count)} · ${formatF(b.clientCharge)}`

  return (
    <Shell icon={icon} color={color} title="Paiement des courses livrées" onClose={onClose}>
      <PeriodTabs periods={DAY_PERIODS} active={days} onChange={setDays} color={color} />
      {loading ? <Loading /> : !s ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
            <StatBox label="COURSES LIVRÉES" value={line(s.total)} color={color} />
            <StatBox label="PAYÉES (EN LIGNE + CASH)" value={formatCount(s.online.count + s.cash.count)} color="#22c55e" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 12 }}>
            <StatBox label="EN LIGNE — WAVE" value={line(s.onlineWave)} color="#00a3e0" />
            <StatBox label="EN LIGNE — ORANGE MONEY" value={line(s.onlineOrangeMoney)} color="#f97316" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <StatBox label="CASH (LIVREUR)" value={line(s.cash)} color="#6366f1" />
            <StatBox label="NON PAYÉES" value={line(s.unpaid)} color="#94a3b8" />
            <StatBox label="LITIGES" value={line(s.disputed)} color="#ef4444" />
          </div>
          <Note>
            Nombre de courses · montant payé par le client (part livreur + commission − remise). « En ligne » = paiement SamirPay
            confirmé, avec l'opérateur réellement utilisé. « Cash » = paiement confirmé par le livreur ou un admin hors application.
          </Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Pass livreurs ───────────────────────────────────────────────────────
const PASS_PERIODS = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week',  label: '7 jours' },
  { key: 'month', label: '30 jours' },
]

export function PassModal({ icon, color, onClose }) {
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/finance/pass').then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [])

  const periodData = data?.[period]

  return (
    <Shell icon={icon} color={color} title="Pass livreurs" onClose={onClose}>
      <PeriodTabs periods={PASS_PERIODS} active={period} onChange={setPeriod} color={color} />
      {loading ? <Loading /> : !data ? <LoadError /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
            <StatBox label="PASS ACHETÉS" value={formatCount(periodData?.purchased)} color={color} />
            <StatBox label="REVENUS PASS" value={formatF(periodData?.revenue)} color={color} />
            <StatBox label="PASS OFFERTS" value={formatCount(periodData?.gifted)} color="#94a3b8" />
          </div>
          <Note>
            En ce moment : <strong style={{ color: 'var(--text)' }}>{formatCount(data.driversWithActivePass)}</strong> livreur(s) avec
            une passe en cours de validité, sur <strong style={{ color: 'var(--text)' }}>{formatCount(data.totalActiveDrivers)}</strong> comptes
            livreurs actifs ({formatCount(data.driversWithoutActivePass)} sans passe). Revenus = montants réellement prélevés ; les pass offerts ne rapportent rien.
          </Note>
        </>
      )}
    </Shell>
  )
}

// ── KPI : Dernière alerte financière ─────────────────────────────────────────
const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#6366f1' }
const SEVERITY_LABELS = { high: 'Critique', medium: 'Attention', low: 'Info' }
const DETAIL_COLUMNS = {
  ONLINE_REFUND_DUE: { extraLabel: 'Annulée le', extraValue: d => d.cancelledAt ? new Date(d.cancelledAt).toLocaleString('fr-FR') : '—' },
  DUPLICATE_PAYMENT_DUE: { extraLabel: 'Reçu le', extraValue: d => d.receivedAt ? new Date(d.receivedAt).toLocaleString('fr-FR') : '—' },
  PAYMENT_DISPUTED: { extraLabel: 'Motif', extraValue: d => d.disputeNotes ?? '—' },
  UNPAID_DELIVERY:  { extraLabel: 'Livré le', extraValue: d => d.deliveredAt ? new Date(d.deliveredAt).toLocaleString('fr-FR') : '—' },
}

export function AlertsModal({ icon, color, onClose }) {
  const [alerts, setAlerts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/finance/alerts')
      .then(r => setAlerts(r.data.alerts)).catch(() => setAlerts(null)).finally(() => setLoading(false))
  }, [])

  return (
    <Shell icon={icon} color={color} title="Alertes financières" onClose={onClose}>
      {loading ? <Loading /> : !alerts ? <LoadError /> : alerts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Aucune alerte active — tout est normal.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {alerts.map((a, i) => {
            const sevColor = SEVERITY_COLORS[a.severity] ?? color
            const detailCols = DETAIL_COLUMNS[a.type]
            const shown = a.detail?.slice(0, 10) ?? []
            return (
              <div key={i} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: `3px solid ${sevColor}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.message}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sevColor + '18', color: sevColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {SEVERITY_LABELS[a.severity] ?? a.severity}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date(a.triggeredAt).toLocaleString('fr-FR')}</div>

                {shown.length > 0 && detailCols && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                    <thead>
                      <tr>{['Client', ['ONLINE_REFUND_DUE', 'DUPLICATE_PAYMENT_DUE'].includes(a.type) ? 'À rembourser' : 'Montant dû', detailCols.extraLabel].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted)', fontSize: 10, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,.12)' }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {shown.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '5px 6px', fontSize: 12 }}>{d.clientName ?? '—'}{d.clientPhone ? ` · ${d.clientPhone}` : ''}</td>
                          <td style={{ padding: '5px 6px', fontSize: 12 }}>{formatF(d.amountDue)}</td>
                          <td style={{ padding: '5px 6px', fontSize: 12 }}>{detailCols.extraValue(d)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {a.count > shown.length && shown.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    {shown.length} affichée(s) sur {formatCount(a.count)} — liste complète dans l'onglet Transactions.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
