import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import DateRangeFilter from '../../components/DateRangeFilter'
import { exportCsv } from '../../lib/exportCsv'

function isoDaysAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const PM_LABELS = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money' }

function StatusPill({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px',
      borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: ok ? 'rgba(56,161,105,0.12)' : 'rgba(229,62,62,0.12)',
      color: ok ? '#38a169' : '#e53e3e',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#38a169' : '#e53e3e' }} />
      {label}
    </span>
  )
}

export default function SamirpayTab() {
  const [config, setConfig]     = useState(null)   // { active }
  const [toggling, setToggling] = useState(false)
  const [health, setHealth]     = useState(null)
  const [manualReview, setManualReview] = useState(null)
  const [orphans, setOrphans]           = useState(null)
  const [collections, setCollections]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [range, setRange] = useState({ from: isoDaysAgo(0), to: isoDaysAgo(0) })
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, reviewRes, orphansRes, collectionsRes] = await Promise.all([
        api.get('/admin/samirpay/config'),
        api.get('/admin/samirpay/manual-review'),
        api.get('/admin/samirpay/orphans'),
        api.get('/admin/samirpay/collections-by-operator'),
      ])
      setConfig(cfgRes.data)
      setManualReview(reviewRes.data.cashouts ?? [])
      setOrphans(orphansRes.data)
      setCollections(collectionsRes.data?.byOperator ?? null)
      // Le solde SamirPay n'est interrogeable que si le paiement en ligne
      // est actif (sinon 503, voir samirpay.service.js:_assertActive) — pas
      // une erreur à afficher, juste une donnée indisponible pour l'instant.
      if (cfgRes.data?.active) {
        try {
          const healthRes = await api.get('/admin/samirpay/balance-health')
          setHealth(healthRes.data)
        } catch { setHealth(null) }
      } else {
        setHealth(null)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive() {
    if (!config) return
    setToggling(true)
    try {
      const res = await api.put('/admin/samirpay/config', { active: !config.active })
      setConfig({ active: res.data.active })
      load()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors du changement.')
    } finally { setToggling(false) }
  }

  async function handleExportDailyReport() {
    setExporting(true)
    try {
      const res = await api.get('/admin/samirpay/daily-report', {
        params: { from: `${range.from}T00:00:00.000Z`, to: `${range.to}T23:59:59.999Z` },
      })
      const { walletTransactions = [], orderPayments = [] } = res.data
      exportCsv({
        filename: `samirpay-wallet-${range.from}_${range.to}.csv`,
        columns: [
          { header: 'Type', key: 'type' }, { header: 'Montant', key: 'amount' },
          { header: 'Statut', key: 'samirpayStatus' }, { header: 'Utilisateur', key: 'userName' },
          { header: 'Téléphone', key: 'userPhone' }, { header: 'Date', key: 'createdAt' },
        ],
        rows: walletTransactions.map(t => ({ ...t, userName: t.user?.name, userPhone: t.user?.phone })),
      })
      exportCsv({
        filename: `samirpay-commandes-${range.from}_${range.to}.csv`,
        columns: [
          { header: 'ID commande', key: 'id' }, { header: 'Prix', key: 'price' },
          { header: 'Transaction SamirPay', key: 'samirpayTransactionId' }, { header: 'Date', key: 'updatedAt' },
        ],
        rows: orderPayments,
      })
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'export.')
    } finally { setExporting(false) }
  }

  if (loading && !config) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Activation globale */}
      <div style={{ ...glass, padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Paiement en ligne SamirPay</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {config?.active
              ? 'Actif — recharge, retrait et paiement de commande en ligne disponibles.'
              : 'Désactivé — aucun impact sur le cash, ces flux sont simplement indisponibles.'}
          </div>
        </div>
        <button
          onClick={toggleActive}
          disabled={toggling}
          style={{
            width: 52, height: 28, borderRadius: 14, border: 'none', cursor: toggling ? 'wait' : 'pointer',
            background: config?.active ? '#38a169' : 'rgba(0,0,0,.15)', position: 'relative', flexShrink: 0,
            opacity: toggling ? 0.6 : 1, transition: 'background .2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: config?.active ? 27 : 3,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          }} />
        </button>
      </div>

      {/* Santé du solde partenaire */}
      {config?.active && (
        <div style={{ ...glass, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Santé du solde partenaire</h2>
            {health && <StatusPill ok={health.healthy} label={health.healthy ? 'Sain' : 'Écart détecté'} />}
          </div>
          {!health ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Indisponible pour le moment.</div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px' }}>SOLDE SAMIRPAY</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{health.samirpaySolde.toLocaleString()} F</div>
                {health.lowBalance && <div style={{ fontSize: 11, color: '#e53e3e', fontWeight: 600 }}>⚠ Solde bas</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px' }}>RETIRABLE ATTENDU (LIVREURS)</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{health.expectedWithdrawable.toLocaleString()} F</div>
              </div>
              {health.shortfall > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#e53e3e', fontWeight: 700, letterSpacing: '.5px' }}>ÉCART</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#e53e3e' }}>{health.shortfall.toLocaleString()} F</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collecté par opérateur */}
      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Collecté par opérateur</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Recharges livreur + paiements de commande confirmés en ligne, toutes plateformes confondues.
        </p>
        {!collections ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['WAVE', 'ORANGE_MONEY'].map(op => (
              <div key={op} style={{ flex: '1 1 220px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,119,182,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{PM_LABELS[op]}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{collections[op].total.toLocaleString()} F</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Recharges : {collections[op].topups.toLocaleString()} F · Commandes : {collections[op].deliveries.toLocaleString()} F
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retraits en attente de vérification manuelle */}
      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Retraits en vérification manuelle {manualReview?.length > 0 && <span style={{ color: '#e53e3e' }}>({manualReview.length})</span>}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Panne réseau pendant le virement — le solde du livreur a déjà été débité, à vérifier manuellement auprès de SamirPay avant toute action.
        </p>
        {!manualReview || manualReview.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aucun retrait en attente. ✓</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Livreur</th>
                  <th style={thStyle}>Téléphone</th>
                  <th style={thStyle}>Montant</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Depuis</th>
                </tr>
              </thead>
              <tbody>
                {manualReview.map(tx => (
                  <tr key={tx.id}>
                    <td style={tdStyle}>{tx.user?.name ?? '—'}</td>
                    <td style={tdStyle}>{tx.user?.phone ?? '—'}</td>
                    <td style={tdStyle}>{Math.abs(tx.amount).toLocaleString()} F</td>
                    <td style={tdStyle}>{tx.description}</td>
                    <td style={tdStyle}>{new Date(tx.createdAt).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions orphelines */}
      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Transactions orphelines {(orphans?.topups.length ?? 0) + (orphans?.orders.length ?? 0) > 0 &&
            <span style={{ color: '#e53e3e' }}>({(orphans?.topups.length ?? 0) + (orphans?.orders.length ?? 0)})</span>}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          SamirPay n'a jamais renvoyé d'identifiant de transaction — en attente depuis plus de 30 min, aucun suivi automatique possible.
        </p>
        {!orphans || (orphans.topups.length === 0 && orphans.orders.length === 0) ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aucune transaction orpheline. ✓</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orphans.topups.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Recharges ({orphans.topups.length})</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>Utilisateur</th><th style={thStyle}>Montant</th><th style={thStyle}>Depuis</th></tr></thead>
                    <tbody>
                      {orphans.topups.map(tx => (
                        <tr key={tx.id}>
                          <td style={tdStyle}>{tx.user?.name ?? '—'} ({tx.user?.phone ?? '—'})</td>
                          <td style={tdStyle}>{tx.amount.toLocaleString()} F</td>
                          <td style={tdStyle}>{new Date(tx.createdAt).toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {orphans.orders.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Paiements de commande ({orphans.orders.length})</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                    <thead><tr><th style={thStyle}>Client</th><th style={thStyle}>Prix commande</th><th style={thStyle}>Opérateur</th><th style={thStyle}>Depuis</th></tr></thead>
                    <tbody>
                      {orphans.orders.map(a => (
                        <tr key={a.id}>
                          <td style={tdStyle}>{a.order?.client?.name ?? '—'} ({a.order?.client?.phone ?? '—'})</td>
                          <td style={tdStyle}>{a.order?.price != null ? `${a.order.price.toLocaleString()} F` : '—'}</td>
                          <td style={tdStyle}>{PM_LABELS[a.operatorName] ?? a.operatorName}</td>
                          <td style={tdStyle}>{new Date(a.createdAt).toLocaleString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export rapprochement comptable */}
      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Export rapprochement comptable</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <DateRangeFilter value={range} onChange={setRange} />
          <button onClick={handleExportDailyReport} disabled={exporting} style={btnPrimary}>
            {exporting ? 'Export…' : 'Exporter (2 CSV)'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
          Génère un CSV des recharges/retraits wallet et un CSV des paiements de commande en ligne sur la période choisie.
        </p>
      </div>
    </div>
  )
}

const thStyle  = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle  = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid rgba(0,0,0,0.04)' }
const btnPrimary = { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
