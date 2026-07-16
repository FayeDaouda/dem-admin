import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import Badge from '../../components/Badge'
import { glass, glassInput, stickyTh } from '../../lib/glassStyles'
import DateRangeFilter from '../../components/DateRangeFilter'
import { exportCsv } from '../../lib/exportCsv'
import { useAuth } from '../../contexts/AuthContext'
import PaymentStatusEditor from './components/PaymentStatusEditor'

const PM_LABELS = { CASH: 'Espèces', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function logExport(type) {
  try { await api.post('/admin/finance/export-log', { type }) } catch (e) { console.error(e) }
}

export default function TransactionsTab() {
  const { user } = useAuth()
  const canEditPayment = !user?.adminRole || user.adminRole === 'SUPER' || user.adminRole === 'FINANCE'
  const [range, setRange] = useState({ from: isoDaysAgo(0), to: isoDaysAgo(0) })
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/transactions', {
        params: { from: range.from, to: range.to, method: method || undefined, status: status || undefined, minAmount: minAmount || undefined, maxAmount: maxAmount || undefined, page, limit: 50 },
      })
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [range, method, status, minAmount, maxAmount, page])

  useEffect(() => { fetch() }, [fetch])

  function handleExport() {
    if (!data) return
    exportCsv({
      filename: `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      columns: [
        { header: 'ID', key: 'id' }, { header: 'Type', key: 'orderType' }, { header: 'Montant', key: 'price' },
        { header: 'Commission DEM', key: 'demFee' }, { header: 'Méthode', key: 'paymentMethod' },
        { header: 'Statut', key: 'paymentStatus' }, { header: 'Créée le', key: 'createdAt' },
      ],
      rows: data.transactions,
    })
    logExport('csv')
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  return (
    <div>
      {data && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <div style={{ ...glass, padding: '14px 16px', flex: '1 1 200px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>WAVE — AUJOURD'HUI</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#00d1a0' }}>{data.today.wave.amount.toLocaleString()} F</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.today.wave.count} transaction(s)</div>
          </div>
          <div style={{ ...glass, padding: '14px 16px', flex: '1 1 200px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>ORANGE MONEY — AUJOURD'HUI</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ff7900' }}>{data.today.orange.amount.toLocaleString()} F</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.today.orange.count} transaction(s)</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <DateRangeFilter value={range} onChange={v => { setRange(v); setPage(1) }} />
        <select value={method} onChange={e => { setMethod(e.target.value); setPage(1) }} style={{ ...glassInput, width: 150 }}>
          <option value="">Méthode : Toutes</option>
          <option value="CASH">Espèces</option>
          <option value="WAVE">Wave</option>
          <option value="ORANGE_MONEY">Orange Money</option>
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} style={{ ...glassInput, width: 150 }}>
          <option value="">Statut : Tous</option>
          <option value="PAID">Confirmée</option>
          <option value="PENDING">En attente</option>
          <option value="DISPUTED">Litige</option>
        </select>
        <input type="number" placeholder="Montant min" value={minAmount} onChange={e => { setMinAmount(e.target.value); setPage(1) }} style={{ ...glassInput, width: 110 }} />
        <input type="number" placeholder="Montant max" value={maxAmount} onChange={e => { setMaxAmount(e.target.value); setPage(1) }} style={{ ...glassInput, width: 110 }} />
        <button onClick={handleExport} style={{ ...btnOutline, marginLeft: 'auto' }}>Exporter CSV</button>
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : !data || data.transactions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune transaction.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['ID', 'Type', 'Montant', 'Méthode', 'Statut', 'Créée le'].map(h => (
                  <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.transactions.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={tdStyle}><code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.id.slice(0, 8)}</code></td>
                  <td style={tdStyle}><Badge status={t.orderType} /></td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{t.price?.toLocaleString()} F</td>
                  <td style={tdStyle}>{t.paymentMethod ? PM_LABELS[t.paymentMethod] : '—'}</td>
                  <td style={tdStyle}>
                    {canEditPayment ? (
                      <PaymentStatusEditor order={t} onUpdated={fetch} />
                    ) : (
                      <Badge status={t.paymentStatus} />
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--text-muted)' }}>{new Date(t.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {data.total} transactions</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
