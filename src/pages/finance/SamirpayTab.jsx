import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import DateRangeFilter from '../../components/DateRangeFilter'
import { exportCsv } from '../../lib/exportCsv'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { formatF } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'

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
  const { user } = useAuth()
  // Confirmations manuelles (orphelins, remboursements) : SUPER uniquement côté API
  const isSuper = !user?.adminRole || user.adminRole === 'SUPER'
  const [config, setConfig]     = useState(null)   // { active }
  const [toggling, setToggling] = useState(false)
  const [health, setHealth]     = useState(null)
  const [manualReview, setManualReview] = useState(null)
  const [orphans, setOrphans]           = useState(null)
  const [collections, setCollections]   = useState(null)
  const [refunds, setRefunds]           = useState(null)
  const [duplicates, setDuplicates]     = useState(null)
  const [loading, setLoading]           = useState(true)
  const [range, setRange] = useState({ from: isoDaysAgo(0), to: isoDaysAgo(0) })
  const [exporting, setExporting] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [cfgRes, reviewRes, orphansRes, collectionsRes, refundsRes] = await Promise.all([
        api.get('/admin/samirpay/config'),
        api.get('/admin/samirpay/manual-review'),
        api.get('/admin/samirpay/orphans'),
        api.get('/admin/samirpay/collections-by-operator'),
        api.get('/admin/samirpay/refunds'),
      ])
      setConfig(cfgRes.data)
      setManualReview(reviewRes.data.cashouts ?? [])
      setOrphans(orphansRes.data)
      setCollections(collectionsRes.data?.byOperator ?? null)
      setRefunds(refundsRes.data?.refunds ?? [])
      setDuplicates(refundsRes.data?.duplicates ?? [])
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
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

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
          { header: 'ID commande', key: 'id' },
          { header: 'Payé par le client', key: 'amount' },
          { header: 'Part livreur', key: 'price' }, { header: 'Commission DEM', key: 'demFee' },
          { header: 'Remise promo', key: 'discountAmount' },
          { header: 'Opérateur', key: 'operatorLabel' },
          { header: 'Transaction SamirPay', key: 'samirpayTransactionId' },
          { header: 'Date du paiement', key: 'paidAt' }, { header: 'Statut commande', key: 'status' },
          { header: 'Livrée le', key: 'deliveredAt' }, { header: 'Annulée le', key: 'cancelledAt' },
          { header: 'Remboursée le', key: 'refundedAt' },
        ],
        rows: orderPayments.map(o => ({ ...o, operatorLabel: PM_LABELS[o.operatorName] ?? o.operatorName })),
      })
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'export.')
    } finally { setExporting(false) }
  }

  async function confirmOrphan(kind, id) {
    const note = window.prompt(
      'Confirme UNIQUEMENT après vérification auprès de SamirPay (support ou dashboard) que ce paiement a bien été encaissé.\n\nNote (référence SamirPay, qui a vérifié, etc.) :'
    )
    if (note === null) return // annulé
    setConfirmingId(id)
    try {
      const path = kind === 'order'
        ? `/admin/samirpay/orphans/order/${id}/confirm`
        : `/admin/samirpay/orphans/topup/${id}/confirm`
      await api.post(path, { note })
      await load()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de la confirmation.')
    } finally { setConfirmingId(null) }
  }

  async function confirmDuplicateRefund(id) {
    const note = window.prompt(
      'Confirme UNIQUEMENT une fois le client effectivement remboursé de ce double paiement.\n\nNote (moyen de remboursement, référence, qui l\'a fait) :'
    )
    if (note === null) return // annulé
    setConfirmingId(id)
    try {
      await api.post(`/admin/samirpay/duplicate-payments/${id}/refunded`, { note })
      await load()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'enregistrement du remboursement.')
    } finally { setConfirmingId(null) }
  }

  async function confirmRefund(orderId) {
    const note = window.prompt(
      'Confirme UNIQUEMENT une fois le client effectivement remboursé (SamirPay, Wave, Orange Money, espèces…).\n\nNote (moyen de remboursement, référence, qui l\'a fait) :'
    )
    if (note === null) return // annulé
    setConfirmingId(orderId)
    try {
      await api.post(`/admin/samirpay/refunds/${orderId}/confirm`, { note })
      await load()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'enregistrement du remboursement.')
    } finally { setConfirmingId(null) }
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
                <div style={{ fontSize: 20, fontWeight: 800 }}>{formatF(health.samirpaySolde)}</div>
                {health.lowBalance && <div style={{ fontSize: 11, color: '#e53e3e', fontWeight: 600 }}>⚠ Solde bas</div>}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px' }}>RETIRABLE DÛ (LIVREURS + COMMERÇANTS)</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{formatF(health.expectedWithdrawable)}</div>
                {health.expectedWithdrawableByRole && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Livreurs : {formatF(health.expectedWithdrawableByRole.drivers)} · Commerçants DEM Pro : {formatF(health.expectedWithdrawableByRole.merchants)}
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px' }}>REMBOURSEMENTS DUS AUX CLIENTS</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: health.refundsDue > 0 ? '#e53e3e' : undefined }}>{formatF(health.refundsDue)}</div>
                {health.duplicatesDue > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>dont doubles paiements : {formatF(health.duplicatesDue)}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total à couvrir : {formatF(health.obligations)}</div>
              </div>
              {health.shortfall > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#e53e3e', fontWeight: 700, letterSpacing: '.5px' }}>ÉCART</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#e53e3e' }}>{formatF(health.shortfall)}</div>
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
          Argent réellement reçu via SamirPay depuis le début : recharges wallet (y compris achats directs de pass et d'abonnements DEM Pro)
          + commandes payées en ligne (livrées, en cours ou annulées), au montant payé par le client, hors commandes déjà remboursées.
          L'opérateur est celui réellement utilisé pour le paiement.
        </p>
        {!collections ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {['WAVE', 'ORANGE_MONEY'].map(op => (
              <div key={op} style={{ flex: '1 1 220px', padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(0,119,182,0.06)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{PM_LABELS[op]}</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{formatF(collections[op].total)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Recharges, pass et abonnements : {formatF(collections[op].topups)} · Commandes : {formatF(collections[op].orders)}
                </div>
                {collections[op].toRefund > 0 && (
                  <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }}>
                    dont {formatF(collections[op].toRefund)} à rembourser (commandes annulées{collections[op].duplicates > 0 ? `, dont ${formatF(collections[op].duplicates)} de doubles paiements` : ''})
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paiements en ligne sur commandes annulées — à rembourser */}
      <div style={{ ...glass, padding: '18px 20px' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Paiements à rembourser {(refunds?.length > 0 || duplicates?.length > 0) && (
            <span style={{ color: '#e53e3e' }}>
              ({(refunds?.length ?? 0) + (duplicates?.length ?? 0)} · {formatF((refunds ?? []).reduce((s, r) => s + r.amountDue, 0) + (duplicates ?? []).reduce((s, d) => s + d.amount, 0))})
            </span>
          )}
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Commandes payées en ligne puis annulées, et doubles paiements : l'argent est chez SamirPay mais appartient au client. Aucun remboursement n'est automatique —
          rembourser le client hors application, puis le déclarer ici (tracé dans l'audit).
        </p>
        {duplicates?.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Doubles paiements</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Payés en ligne alors que la commande était déjà payée (au livreur, ou par un autre paiement en ligne) : montant réellement encaissé par SamirPay.
            </p>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Montant à rembourser</th><th style={thStyle}>Opérateur</th>
                <th style={thStyle}>Transaction SamirPay</th><th style={thStyle}>Reçu le</th><th style={thStyle}>Déjà payée</th><th style={thStyle}></th>
              </tr></thead>
              <tbody>
                {duplicates.map(d => (
                  <tr key={d.id}>
                    <td style={tdStyle}>{d.order?.clientName ?? '—'} ({d.order?.clientPhone ?? '—'})</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{formatF(d.amount)}</td>
                    <td style={tdStyle}>{PM_LABELS[d.operatorName] ?? d.operatorName ?? '—'}</td>
                    <td style={tdStyle}><code style={{ fontSize: 11 }}>{d.transactionId}</code></td>
                    <td style={tdStyle}>{new Date(d.receivedAt).toLocaleString('fr-FR')}</td>
                    <td style={tdStyle}>{d.reason === 'ALREADY_PAID_ONLINE' ? 'En ligne (autre paiement)' : 'Au livreur'}</td>
                    <td style={tdStyle}>
                      {isSuper && (
                        <button onClick={() => confirmDuplicateRefund(d.id)} disabled={confirmingId === d.id} style={btnConfirm}>
                          {confirmingId === d.id ? '…' : 'Marquer remboursé'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!refunds || refunds.length === 0 ? (
          (!duplicates || duplicates.length === 0) && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Aucun remboursement dû. ✓</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={thStyle}>Client</th><th style={thStyle}>Montant à rembourser</th><th style={thStyle}>Opérateur</th>
                <th style={thStyle}>Payée le</th><th style={thStyle}>Annulée le</th><th style={thStyle}></th>
              </tr></thead>
              <tbody>
                {refunds.map(r => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.clientName ?? '—'} ({r.clientPhone ?? '—'})</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{formatF(r.amountDue)}</td>
                    <td style={tdStyle}>{PM_LABELS[r.operatorName] ?? r.operatorName ?? '—'}</td>
                    <td style={tdStyle}>{new Date(r.paidOnlineAt).toLocaleString('fr-FR')}</td>
                    <td style={tdStyle}>{r.cancelledAt ? new Date(r.cancelledAt).toLocaleString('fr-FR') : '—'}</td>
                    <td style={tdStyle}>
                      {isSuper && (
                        <button onClick={() => confirmRefund(r.id)} disabled={confirmingId === r.id} style={btnConfirm}>
                          {confirmingId === r.id ? '…' : 'Marquer remboursé'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    <thead><tr><th style={thStyle}>Utilisateur</th><th style={thStyle}>Montant</th><th style={thStyle}>Depuis</th><th style={thStyle}></th></tr></thead>
                    <tbody>
                      {orphans.topups.map(tx => (
                        <tr key={tx.id}>
                          <td style={tdStyle}>{tx.user?.name ?? '—'} ({tx.user?.phone ?? '—'})</td>
                          <td style={tdStyle}>{tx.amount.toLocaleString()} F</td>
                          <td style={tdStyle}>{new Date(tx.createdAt).toLocaleString('fr-FR')}</td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => confirmOrphan('topup', tx.id)}
                              disabled={confirmingId === tx.id}
                              style={btnConfirm}
                            >
                              {confirmingId === tx.id ? '…' : 'Marquer payé'}
                            </button>
                          </td>
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
                    <thead><tr><th style={thStyle}>Client</th><th style={thStyle}>Montant demandé au client</th><th style={thStyle}>Opérateur</th><th style={thStyle}>Depuis</th><th style={thStyle}></th></tr></thead>
                    <tbody>
                      {orphans.orders.map(a => (
                        <tr key={a.id}>
                          <td style={tdStyle}>{a.order?.client?.name ?? '—'} ({a.order?.client?.phone ?? '—'})</td>
                          <td style={tdStyle}>{a.order?.amountDue != null ? formatF(a.order.amountDue) : '—'}</td>
                          <td style={tdStyle}>{PM_LABELS[a.operatorName] ?? a.operatorName}</td>
                          <td style={tdStyle}>{new Date(a.createdAt).toLocaleString('fr-FR')}</td>
                          <td style={tdStyle}>
                            <button
                              onClick={() => confirmOrphan('order', a.id)}
                              disabled={confirmingId === a.id}
                              style={btnConfirm}
                            >
                              {confirmingId === a.id ? '…' : 'Marquer payé'}
                            </button>
                          </td>
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
          Génère un CSV des recharges/retraits wallet et un CSV de toutes les commandes payées en ligne sur la période (heure exacte de
          confirmation SamirPay, montant payé par le client, opérateur, statut de la commande et remboursement éventuel).
        </p>
      </div>
    </div>
  )
}

const thStyle  = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle  = { padding: '8px 10px', fontSize: 12.5, borderBottom: '1px solid rgba(0,0,0,0.04)' }
const btnPrimary = { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnConfirm  = { padding: '5px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(56,161,105,0.4)', background: 'rgba(56,161,105,0.08)', color: '#38a169', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
