import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import Badge from '../../components/Badge'
import { glass, glassInput, stickyTh } from '../../lib/glassStyles'
import DateRangeFilter from '../../components/DateRangeFilter'
import { exportCsv } from '../../lib/exportCsv'
import { useAuth } from '../../contexts/AuthContext'
import PaymentStatusEditor from './components/PaymentStatusEditor'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF, formatCount, CHANNEL_LABELS, CHANNEL_BADGE_STATUS, OPERATOR_LABELS } from '../../lib/format'

// Jour calendaire (UTC = heure de Dakar), au format attendu par l'API
function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

function SummaryBox({ label, bucket, color }) {
  return (
    <div style={{ ...glass, padding: '14px 16px', flex: '1 1 170px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{formatF(bucket.clientCharge)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCount(bucket.count)} course(s) · commission {formatF(bucket.commission)}</div>
    </div>
  )
}

const channelLabel = (t) => t.channel === 'ONLINE' && t.operator
  ? `En ligne — ${OPERATOR_LABELS[t.operator] ?? t.operator}`
  : CHANNEL_LABELS[t.channel]

// Paiement des courses LIVRÉES sur la période (par date de livraison) : ce
// que le client a payé, sa répartition, et par quel canal l'argent est
// réellement arrivé. Récapitulatif et liste portent toujours sur la même
// population (une seule requête côté backend).
export default function TransactionsTab() {
  const { user } = useAuth()
  const canEditPayment = !user?.adminRole || user.adminRole === 'SUPER' || user.adminRole === 'FINANCE'
  const [range, setRange] = useState({ from: isoDaysAgo(0), to: isoDaysAgo(0) })
  const [channel, setChannel] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const params = useCallback((extra = {}) => ({
    from: range.from, to: range.to, channel: channel || undefined, ...extra,
  }), [range, channel])

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/finance/transactions', { params: params({ page, limit: 50 }) })
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [params, page])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  // Toute la période filtrée — plus seulement la page affichée
  async function handleExport() {
    setExporting(true)
    try {
      const res = await api.get('/admin/finance/transactions', { params: params({ export: 'true' }) })
      exportCsv({
        filename: `paiements-courses-${range.from}_${range.to}.csv`,
        columns: [
          { header: 'ID', key: 'id' }, { header: 'Type', key: 'orderType' },
          { header: 'Livrée le', key: 'deliveredAt' },
          { header: 'Payé par le client', key: 'clientCharge' }, { header: 'Part livreur', key: 'price' },
          { header: 'Commission DEM', key: 'demFee' }, { header: 'Remise promo', key: 'discountAmount' },
          { header: 'Canal', key: 'channelLabel' }, { header: 'Payée en ligne le', key: 'paidOnlineAt' },
          { header: 'Statut paiement', key: 'paymentStatus' },
          { header: 'Note litige', key: 'disputeNotes' },
        ],
        rows: res.data.transactions.map(t => ({ ...t, channelLabel: channelLabel(t) })),
      })
      logExport('csv')
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'export.')
    } finally { setExporting(false) }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const s = data?.summary

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 0, marginBottom: 14, lineHeight: 1.5 }}>
        Courses livrées sur la période (date de livraison). Montant = ce que le client a payé (part livreur + commission DEM − remise promo).
        <strong> En ligne</strong> = paiement SamirPay confirmé, argent reçu par DEM, avec l'opérateur réellement utilisé.
        <strong> Cash</strong> = paiement confirmé hors application : le livreur a encaissé, y compris la commission DEM.
      </p>

      {s && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <SummaryBox label="EN LIGNE — WAVE"         bucket={s.onlineWave}        color="#00a3e0" />
          <SummaryBox label="EN LIGNE — ORANGE MONEY" bucket={s.onlineOrangeMoney} color="#ff7900" />
          <SummaryBox label="CASH (LIVREUR)"          bucket={s.cash}              color="#6366f1" />
          <SummaryBox label="NON PAYÉES"              bucket={s.unpaid}            color="#94a3b8" />
          <SummaryBox label="LITIGES"                 bucket={s.disputed}          color="#ef4444" />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <DateRangeFilter value={range} onChange={v => { setRange(v); setPage(1) }} />
        <select value={channel} onChange={e => { setChannel(e.target.value); setPage(1) }} style={{ ...glassInput, width: 190 }}>
          <option value="">Canal : Tous</option>
          <option value="ONLINE">Payées en ligne</option>
          <option value="CASH">Cash (livreur)</option>
          <option value="UNPAID">Non payées</option>
          <option value="DISPUTED">Litiges</option>
        </select>
        {s && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatCount(s.total.count)} course(s) livrée(s) · {formatF(s.total.clientCharge)} payés par les clients</span>}
        <button onClick={handleExport} disabled={exporting} style={{ ...btnOutline, marginLeft: 'auto' }}>
          {exporting ? 'Export…' : 'Exporter CSV (toute la période)'}
        </button>
      </div>

      <div style={{ ...glass, padding: '16px 18px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : !data || data.transactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune course livrée sur cette période.</div>
        ) : (
          <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'Livrée le', 'Payé par le client', 'Part livreur', 'Commission DEM', 'Remise', 'Canal', 'Statut paiement'].map(h => (
                  <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.transactions.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.id.slice(0, 8)}</code></td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.deliveredAt).toLocaleString('fr-FR')}</td>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{formatF(t.clientCharge)}</td>
                  <td style={tdStyle}>{formatF(t.price)}</td>
                  <td style={tdStyle}>{formatF(t.demFee)}</td>
                  <td style={tdStyle}>{t.discountAmount > 0 ? `− ${formatF(t.discountAmount)}` : '—'}</td>
                  <td style={tdStyle}><Badge status={CHANNEL_BADGE_STATUS[t.channel]} label={channelLabel(t)} /></td>
                  <td style={tdStyle}>
                    {/* Un paiement en ligne confirmé par SamirPay ne se modifie pas à la main */}
                    {canEditPayment && t.channel !== 'ONLINE' ? (
                      <PaymentStatusEditor order={t} onUpdated={fetch} />
                    ) : (
                      <Badge status={t.paymentStatus} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {formatCount(data.total)} course(s)</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle', fontSize: 13 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
