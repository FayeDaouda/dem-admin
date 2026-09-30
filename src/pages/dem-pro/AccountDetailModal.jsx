import { useState, useEffect } from 'react'
import { X, Phone, Mail, Store, Package, Wallet, ExternalLink, ChevronDown, ChevronRight, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import api from '../../lib/api'
import Badge from '../../components/Badge'
import { glass } from '../../lib/glassStyles'
import { formatF, formatCount, CHANNEL_LABELS, CHANNEL_BADGE_STATUS, OPERATOR_LABELS } from '../../lib/format'
import {
  SECTOR_LABELS, SECTOR_COLORS, VOLUME_LABELS, PLAN_COLORS, proStatusInfo,
  planLabel, PLAN_STATUS_LABELS, PURCHASE_STATUS, WALLET_TX_LABELS, SAMIRPAY_STATUS,
  REQUEST_STATUS, STOREFRONT_PAYMENT_LABELS, SITE_ICON_LABELS, BATCH_STATUS,
} from './labels'
import { ProductFormModal, DeleteProductModal } from './ProductModals'

// ── Fiche commerçant DEM Pro (admin) ──────────────────────────────────────────
// Données : GET /admin/dem-pro/:id (admin.dem-pro-accounts.service.js) — mêmes
// définitions que le reste de l'admin, indépendantes du palier du commerçant.
// Onglets : Vue d'ensemble, Commandes, Abonnement, Wallet, Boutique, Tournées.
// `canEdit` (SUPER + Service client) : catalogue modifiable dans l'onglet Boutique.

const PERIODS = [
  { key: 'today',       label: "Aujourd'hui" },
  { key: 'week',        label: '7 jours' },
  { key: 'month',       label: '30 jours' },
  { key: 'threeMonths', label: '3 mois' },
  { key: 'sixMonths',   label: '6 mois' },
  { key: 'all',         label: 'Depuis le début' },
]

const TABS = [
  { key: 'overview', label: "Vue d'ensemble" },
  { key: 'orders',   label: 'Commandes' },
  { key: 'subscription', label: 'Abonnement' },
  { key: 'wallet',       label: 'Wallet' },
  { key: 'shop',         label: 'Boutique' },
  { key: 'batches',      label: 'Tournées' },
]

const REASON_LABELS = {
  NO_DRIVER_FOUND: 'Aucun livreur trouvé', CHANGED_MIND: "Changement d'avis", TOO_LONG: 'Trop long',
  WRONG_ADDRESS: 'Adresse erronée', PRICE: 'Prix', DRIVER_ISSUE: 'Problème livreur',
  OTHER: 'Autre', NON_RENSEIGNE: 'Non renseigné',
}

const fmtDate = (d, withTime = false) => d
  ? new Date(d).toLocaleString('fr-FR', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
  : '—'

export default function AccountDetailModal({ accountId, onClose, canEdit = false }) {
  const [tab, setTab]       = useState('overview')
  const [period, setPeriod] = useState('month')
  const [version, setVersion] = useState(0) // relit la fiche après une modification du catalogue
  // Dernière réponse reçue, étiquetée par sa requête : "chargement" = la
  // réponse affichée ne correspond pas encore à la période demandée.
  const [result, setResult] = useState(null) // { key, data?, error? }
  const requestKey = `${accountId}|${period}|${version}`

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/dem-pro/${accountId}`, { params: { period } })
      .then(r => { if (!cancelled) setResult({ key: requestKey, data: r.data }) })
      .catch(e => { if (!cancelled) setResult({ key: requestKey, error: e.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [accountId, period, requestKey])

  const loading = result?.key !== requestKey
  const data    = result?.data ?? null
  const error   = result?.key === requestKey ? result.error : ''
  const a = data?.account

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 940, maxWidth: '96vw', maxHeight: '92vh', padding: 0, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <Avatar account={a} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{a?.proBusinessName?.trim() || a?.name || (loading ? 'Chargement…' : '—')}</div>
              {a && (
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {a.name && <span>{a.name}</span>}
                  {a.phone && <a href={`tel:${a.phone}`} style={link}><Phone size={11} /> {a.phone}</a>}
                  {a.email && <a href={`mailto:${a.email}`} style={link}><Mail size={11} /> {a.email}</a>}
                </div>
              )}
              {a && <HeaderChips data={data} />}
            </div>
            <button onClick={onClose} style={closeBtn} title="Fermer"><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ padding: '18px 24px 24px', overflowY: 'auto', flex: 1 }}>
          {error ? (
            <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 40 }}>{error}</div>
          ) : !data ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Chargement…</div>
          ) : tab === 'overview' ? (
            <OverviewTab data={data} period={period} onPeriod={setPeriod} loading={loading} />
          ) : tab === 'orders' ? (
            <OrdersTab accountId={accountId} />
          ) : tab === 'subscription' ? (
            <SubscriptionTab accountId={accountId} />
          ) : tab === 'wallet' ? (
            <WalletTab accountId={accountId} />
          ) : tab === 'shop' ? (
            <ShopTab accountId={accountId} canEdit={canEdit} onCatalogueChange={() => setVersion(v => v + 1)} />
          ) : (
            <BatchesTab accountId={accountId} />
          )}
        </div>
      </div>
    </div>
  )
}

function Avatar({ account }) {
  const initial = (account?.proBusinessName?.trim() || account?.name?.trim() || account?.phone || '?')[0].toUpperCase()
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, overflow: 'hidden', flexShrink: 0,
      background: 'linear-gradient(135deg,rgba(99,102,241,.18),rgba(6,113,186,.18))',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#6366f1',
    }}>
      {account?.avatar ? <img src={account.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  )
}

function Chip({ color, children, title }) {
  return (
    <span title={title} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color + '18', color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

function HeaderChips({ data }) {
  const { account: a, subscription: sub } = data
  const status = proStatusInfo(a)
  const planColor = PLAN_COLORS[sub.plan] ?? '#6366f1'
  const hasTier = (sub.plan ?? 'FREE') !== 'FREE'
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      <Chip color={status.color}>{status.text}</Chip>
      <Chip color={planColor}>Plan {planLabel(sub.plan)}</Chip>
      {hasTier && (sub.paidPlanActive
        ? <Chip color="#22c55e">Abonnement payé</Chip>
        : <Chip color="#f59e0b">{sub.planStatus === 'TRIAL' ? 'Offert' : 'Sans paiement'}</Chip>)}
      {hasTier && sub.expiresAt && <Chip color="#64748b">jusqu'au {fmtDate(sub.expiresAt)}</Chip>}
      <Chip color={a.proInAppPaymentEnabled ? '#0ea5e9' : '#94a3b8'} title="Paiement des produits via DEM (wallet commerçant)">
        Paiement intégré {a.proInAppPaymentEnabled ? 'activé' : 'désactivé'}
      </Chip>
    </div>
  )
}

// ── Vue d'ensemble ────────────────────────────────────────────────────────────
function OverviewTab({ data, period, onPeriod, loading }) {
  const { account: a, activity: act, now, allTime } = data
  const sectorColor = SECTOR_COLORS[a.proSector] ?? '#8b5cf6'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      {(!a.isActive && a.suspensionReason) || (a.proStatus === 'REJECTED' && a.rejectionReason) ? (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ef444412', color: '#b91c1c', fontSize: 13 }}>
          {!a.isActive ? `Suspendu : ${a.suspensionReason}` : `Refusé : ${a.rejectionReason}`}
        </div>
      ) : null}

      {/* Période */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => onPeriod(p.key)} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: period === p.key ? 'none' : '1px solid var(--border)',
            background: period === p.key ? 'var(--primary)' : 'transparent',
            color: period === p.key ? '#fff' : 'var(--text-muted)',
          }}>{p.label}</button>
        ))}
      </div>

      {/* Activité sur la période */}
      <Section title="Activité sur la période" hint="Livraisons et montants datés à la livraison ; annulation parmi les commandes créées sur la période.">
        <div style={grid3}>
          <Stat label="Commandes créées" value={formatCount(act.created)} />
          <Stat label="Livrées" value={formatCount(act.delivered)} color="var(--success)" />
          <Stat label="Taux d'annulation" value={`${act.cancellationRate}%`} sub={`${formatCount(act.cancelled)} annulée${act.cancelled > 1 ? 's' : ''} / ${formatCount(act.created)}`} color={act.cancellationRate >= 20 ? 'var(--danger)' : undefined} />
          <Stat label="Montant des livraisons" value={formatF(act.deliveryAmount)} sub="part livreur + commission − promo" />
          <Stat label="Commission DEM" value={formatF(act.commission)} color="var(--primary)" />
          <Stat label="Remises promo (payées par DEM)" value={formatF(act.discounts)} />
        </div>
        {act.delivered > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            Livraison réglée par le commerçant : <strong>{formatCount(act.paidByMerchant)}</strong> · par le destinataire : <strong>{formatCount(act.paidByRecipient)}</strong>
          </div>
        )}
        {act.cancelReasons.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {act.cancelReasons.map(r => (
              <span key={r.reason} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text-muted)' }}>
                {REASON_LABELS[r.reason] ?? r.reason} · {r.count}
              </span>
            ))}
          </div>
        )}
      </Section>

      {/* En ce moment */}
      <Section title="En ce moment">
        <div style={grid5}>
          <Stat small label="Programmées" value={formatCount(now.scheduled)} />
          <Stat small label="En attente d'un livreur" value={formatCount(now.pending)} color={now.pending > 0 ? '#f59e0b' : undefined} />
          <Stat small label="En cours" value={formatCount(now.inProgress)} color={now.inProgress > 0 ? '#6366f1' : undefined} />
          <Stat small label="Livrées non réglées" value={formatCount(now.unpaidDeliveries)} color={now.unpaidDeliveries > 0 ? '#f59e0b' : undefined} />
          <Stat small label="Paiements en litige" value={formatCount(now.disputedDeliveries)} color={now.disputedDeliveries > 0 ? 'var(--danger)' : undefined} />
        </div>
      </Section>

      {/* Informations */}
      <Section title="Informations">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 18px' }}>
          <Info label="Secteur" value={a.proSector ? <span style={{ color: sectorColor, fontWeight: 700 }}>{SECTOR_LABELS[a.proSector] ?? a.proSector}</span> : '—'} />
          <Info label="Volume déclaré" value={VOLUME_LABELS[a.proWeeklyVolume] ?? '—'} />
          <Info label="NINEA" value={a.proNinea ?? '—'} />
          <Info label="Inscrit le" value={fmtDate(a.createdAt)} />
          <Info label="Première commande" value={fmtDate(allTime.firstOrderAt)} />
          <Info label="Dernière commande" value={fmtDate(allTime.lastOrderAt, true)} />
          <Info label="Historique" value={`${formatCount(allTime.orders)} commandes · ${formatCount(allTime.delivered)} livrées · ${formatCount(allTime.cancelled)} annulées`} />
          <Info label="Points de vente" icon={Store} value={formatCount(a._count?.proAddresses)} />
          <Info label="Produits au catalogue" icon={Package} value={formatCount(a._count?.proProducts)} />
          <Info label="Paiement intégré" icon={Wallet} value={a.proInAppPaymentEnabled ? 'Activé' : 'Désactivé'} />
        </div>
      </Section>
    </div>
  )
}

// ── Commandes du commerçant ──────────────────────────────────────────────────
// Même liste que la page Commandes (/admin/orders), filtrée sur ce compte.
const ORDER_GROUPS = [
  ['all', 'Toutes'], ['scheduled', 'Programmées'], ['pending', 'En attente'],
  ['active', 'En cours'], ['delivered', 'Livrées'], ['cancelled', 'Annulées'],
]
const LIMIT = 20

// Canal d'encaissement — même règle que kpi-definitions:paymentChannelOf
function channelOf(o) {
  if (o.paidOnlineAt) return 'ONLINE'
  if (o.paymentStatus === 'PAID') return 'CASH'
  if (o.paymentStatus === 'DISPUTED') return 'DISPUTED'
  return 'UNPAID'
}

function OrdersTab({ accountId }) {
  const [group, setGroup] = useState('all')
  const [page, setPage]   = useState(1)
  const [result, setResult] = useState(null) // { key, data }
  const requestKey = `${accountId}|${group}|${page}`

  useEffect(() => {
    let cancelled = false
    const params = { clientId: accountId, page, limit: LIMIT }
    if (group !== 'all') params.group = group
    api.get('/admin/orders', { params })
      .then(r => { if (!cancelled) setResult({ key: requestKey, data: r.data }) })
      .catch(() => { if (!cancelled) setResult({ key: requestKey, data: { orders: [], total: 0 } }) })
    return () => { cancelled = true }
  }, [accountId, group, page, requestKey])

  const loading = result?.key !== requestKey
  const res = result?.data ?? null

  const total = res?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ORDER_GROUPS.map(([key, label]) => (
          <button key={key} onClick={() => { setGroup(key); setPage(1) }} style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: group === key ? 'none' : '1px solid var(--border)',
            background: group === key ? 'var(--primary)' : 'transparent',
            color: group === key ? '#fff' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      {loading && !res ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Chargement…</div>
      ) : (res?.orders ?? []).length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Aucune commande.</div>
      ) : (
        <div style={{ overflowX: 'auto', opacity: loading ? 0.6 : 1 }}>
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Créée le', 'Statut', 'Destination', 'Livreur', 'Montant', 'Livraison payée par', 'Paiement'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {res.orders.map(o => {
                const channel = channelOf(o)
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, color: 'var(--text-muted)', fontSize: 12 }}>{fmtDate(o.createdAt, true)}</td>
                    <td style={td}><Badge status={o.status} /></td>
                    <td style={{ ...td, fontSize: 12, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.deliveryAddress}>
                      {o.receiverName ? <strong>{o.receiverName} · </strong> : null}{o.deliveryAddress ?? '—'}
                    </td>
                    <td style={td}>{o.driver?.name ?? '—'}</td>
                    <td style={{ ...td, fontWeight: 700 }} title={`Part livreur ${formatF(o.price)} · commission ${formatF(o.demFee)} · promo ${formatF(o.discountAmount)}`}>
                      {formatF((o.price ?? 0) + (o.demFee ?? 0) - (o.discountAmount ?? 0))}
                    </td>
                    <td style={{ ...td, fontSize: 12 }}>{o.paymentMode === 'merchant' ? 'Commerçant' : 'Destinataire'}</td>
                    <td style={td}>{o.status === 'DELIVERED' ? <Badge status={CHANNEL_BADGE_STATUS[channel]} label={CHANNEL_LABELS[channel]} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtn}>← Préc.</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {formatCount(total)} commandes</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtn}>Suiv. →</button>
        </div>
      )}
    </div>
  )
}

// ── Abonnement ────────────────────────────────────────────────────────────────
// GET /admin/dem-pro/:id/subscription — achats (issue réelle du paiement
// SamirPay), total payé (journal wallet, même source que Finance) et
// changements de plan faits par un admin.
function SubscriptionTab({ accountId }) {
  const [result, setResult] = useState(null) // { key, data?, error? }

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/dem-pro/${accountId}/subscription`)
      .then(r => { if (!cancelled) setResult({ key: accountId, data: r.data }) })
      .catch(e => { if (!cancelled) setResult({ key: accountId, error: e.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [accountId])

  if (result?.key !== accountId) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Chargement…</div>
  if (result.error) return <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>{result.error}</div>

  const { current, totals, purchases, adminChanges } = result.data
  const hasTier = (current.plan ?? 'FREE') !== 'FREE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Section title="Situation actuelle">
        <div style={grid3}>
          <Stat
            label="Plan"
            value={planLabel(current.plan)}
            sub={[PLAN_STATUS_LABELS[current.planStatus] ?? current.planStatus, current.expiresAt && hasTier ? `jusqu'au ${fmtDate(current.expiresAt)}` : null].filter(Boolean).join(' · ')}
            color={PLAN_COLORS[current.plan]}
          />
          <Stat
            label="Abonnement payé en cours"
            value={current.paidPlanActive ? 'Oui' : 'Non'}
            sub={current.purchase
              ? `${formatF(current.purchase.amount)} · jusqu'au ${fmtDate(current.purchase.expiresAt)}`
              : hasTier ? 'Accès sans paiement (offert ou attribué par un admin)' : null}
            color={current.paidPlanActive ? 'var(--success)' : hasTier ? '#f59e0b' : undefined}
          />
          <Stat
            label="Total payé en abonnements"
            value={formatF(totals.paidAmount)}
            sub={`${formatCount(totals.paidCount)} paiement${totals.paidCount > 1 ? 's' : ''}${totals.unsuccessful ? ` · ${formatCount(totals.unsuccessful)} achat${totals.unsuccessful > 1 ? 's' : ''} non abouti${totals.unsuccessful > 1 ? 's' : ''}` : ''}`}
            color="var(--primary)"
          />
        </div>
      </Section>

      <Section title="Achats d'abonnement" hint="Issue réelle du paiement SamirPay rattaché à chaque achat.">
        {purchases.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun achat d'abonnement.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Initié le', 'Plan', 'Montant', 'Durée', 'Issue', 'Activé le', 'Expire le', 'Opérateur'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {purchases.map(p => {
                  const st = PURCHASE_STATUS[p.status] ?? { label: p.status, color: '#94a3b8' }
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(p.createdAt, true)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{planLabel(p.plan)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{formatF(p.amount)}</td>
                      <td style={td}>{p.durationDays} j</td>
                      <td style={td}><Chip color={st.color}>{st.label}</Chip></td>
                      <td style={{ ...td, fontSize: 12 }}>{fmtDate(p.activatedAt, true)}</td>
                      <td style={{ ...td, fontSize: 12 }}>{fmtDate(p.expiresAt, true)}</td>
                      <td style={{ ...td, fontSize: 12 }} title={p.samirpayTransactionId ?? ''}>{OPERATOR_LABELS[p.operatorName] ?? p.operatorName ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Changements de plan par un admin" hint="Essais offerts, attributions ou retraits manuels (journal d'audit).">
        {adminChanges.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun changement manuel.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {adminChanges.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '8px 12px', borderRadius: 8, background: 'var(--surface2)', fontSize: 13 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 140 }}>{fmtDate(c.at, true)}</span>
                <span style={{ flex: 1 }}>
                  {c.plan && <>Plan <strong>{planLabel(c.plan)}</strong></>}
                  {c.status && <> · {PLAN_STATUS_LABELS[c.status] ?? c.status}</>}
                  {c.expiresAt ? <> · jusqu'au {fmtDate(c.expiresAt)}</> : c.expiresAt === null && c.plan ? <> · sans date de fin</> : null}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>par {c.admin}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Wallet ────────────────────────────────────────────────────────────────────
// GET /admin/dem-pro/:id/wallet — soldes (avec contrôle de cohérence contre le
// journal), ventes en paiement intégré, retraits, journal paginé.
function WalletTab({ accountId }) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null) // { key, data?, error? }
  const requestKey = `${accountId}|${page}`

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/dem-pro/${accountId}/wallet`, { params: { page } })
      .then(r => { if (!cancelled) setResult({ key: requestKey, data: r.data }) })
      .catch(e => { if (!cancelled) setResult({ key: requestKey, error: e.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [accountId, page, requestKey])

  const loading = result?.key !== requestKey
  if (!result) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Chargement…</div>
  if (result.error && !loading) return <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>{result.error}</div>
  if (!result.data) return null

  const { balances: b, sales, cashouts: c, subscriptionsPaid, transactions: tx } = result.data
  const totalPages = Math.max(1, Math.ceil(tx.total / tx.pageSize))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      {b.gap !== 0 && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ef444412', color: '#b91c1c', fontSize: 13 }}>
          ⚠ Écart de {formatF(b.gap)} entre le solde retirable ({formatF(b.withdrawable)}) et le journal du wallet ({formatF(b.expectedWithdrawable)}) — à vérifier avant tout retrait.
        </div>
      )}

      <Section title="Soldes" hint="Retirable = argent réellement détenu par DEM pour ce commerçant (ventes encaissées en ligne).">
        <div style={grid3}>
          <Stat label="Solde retirable" value={formatF(b.withdrawable)} color="var(--primary)" sub={b.gap === 0 ? 'cohérent avec le journal ✓' : `journal : ${formatF(b.expectedWithdrawable)}`} />
          <Stat label="Solde total" value={formatF(b.balance)} />
          <Stat label="Paiement intégré" value={b.inAppPaymentEnabled ? 'Activé' : 'Désactivé'} color={b.inAppPaymentEnabled ? '#0ea5e9' : 'var(--text-muted)'} sub="produits payés via DEM puis reversés au commerçant" />
        </div>
      </Section>

      <Section title="Ventes en paiement intégré" hint="Créditées à la livraison, nettes de la commission DEM.">
        <div style={grid3}>
          <Stat label="Ventes créditées" value={formatF(sales.net)} sub={`${formatCount(sales.count)} vente${sales.count > 1 ? 's' : ''} · brut ${formatF(sales.gross)}`} color="var(--success)" />
          <Stat label="Commission DEM retenue" value={formatF(sales.commission)} color="var(--primary)" />
          <Stat label="Encaissées, pas encore créditées" value={formatF(sales.held.gross)} sub={`${formatCount(sales.held.count)} commande${sales.held.count > 1 ? 's' : ''} payée${sales.held.count > 1 ? 's' : ''} en ligne, non livrée${sales.held.count > 1 ? 's' : ''}`} color={sales.held.count > 0 ? '#f59e0b' : undefined} />
        </div>
      </Section>

      <Section title="Retraits">
        <div style={grid5}>
          <Stat small label="Versés" value={formatF(c.paid.amount)} sub={`${formatCount(c.paid.count)} retrait${c.paid.count > 1 ? 's' : ''}`} />
          <Stat small label="En cours" value={formatF(c.pending.amount - c.manualReview.amount)} sub={`${formatCount(c.pending.count - c.manualReview.count)}`} color={c.pending.count - c.manualReview.count > 0 ? '#0ea5e9' : undefined} />
          <Stat small label="En vérification manuelle" value={formatF(c.manualReview.amount)} sub={`${formatCount(c.manualReview.count)} — Finance > SamirPay`} color={c.manualReview.count > 0 ? 'var(--danger)' : undefined} />
          <Stat small label="Échoués (recrédités)" value={formatF(c.failed.amount)} sub={`${formatCount(c.failed.count)}`} />
          <Stat small label="Abonnements payés" value={formatF(subscriptionsPaid.amount)} sub={`${formatCount(subscriptionsPaid.count)} — voir onglet Abonnement`} />
        </div>
      </Section>

      <Section title="Journal du wallet" hint={`${formatCount(tx.total)} écriture${tx.total > 1 ? 's' : ''}`}>
        {tx.items.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucune écriture.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Date', 'Opération', 'Montant', 'Statut', 'Opérateur', 'Détail'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {tx.items.map(t => {
                  const st = t.needsManualReview && t.samirpayStatus === 'PENDING'
                    ? { label: 'Vérification manuelle', color: '#ef4444' }
                    : SAMIRPAY_STATUS[t.samirpayStatus]
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(t.createdAt, true)}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{WALLET_TX_LABELS[t.type] ?? t.type}</td>
                      <td style={{ ...td, fontWeight: 700, color: t.amount >= 0 ? 'var(--success)' : 'var(--text)' }}>{t.amount >= 0 ? '+' : ''}{formatF(t.amount)}</td>
                      <td style={td}>{st ? <Chip color={st.color}>{st.label}</Chip> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                      <td style={{ ...td, fontSize: 12 }} title={t.samirpayTransactionId ?? ''}>{OPERATOR_LABELS[t.operatorName] ?? t.operatorName ?? '—'}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {tx.total > tx.pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={pageBtn}>← Préc.</button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtn}>Suiv. →</button>
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Boutique (support) ────────────────────────────────────────────────────────
// GET /admin/dem-pro/:id/shop — boutique en ligne, catalogue & stock, points de vente.
// Catalogue modifiable avec `canEdit` : ajouter un produit dans le catalogue
// de son choix, le modifier (dont le changer de catalogue), le supprimer
// (ProductModals.jsx — mêmes règles que l'app du commerçant).
const STOCK_FILTERS = [['all', 'Tous'], ['out', 'En rupture'], ['low', 'Stock bas'], ['untracked', 'Stock non suivi']]
const NO_CATALOGUE = '__none__'
const catalogueOf = p => p.category?.trim() || null

function ShopTab({ accountId, canEdit, onCatalogueChange }) {
  const [version, setVersion] = useState(0) // relit la boutique après une modification
  const [result, setResult] = useState(null) // { key, accountId, data?, error? }
  const [stockFilter, setStockFilter] = useState('all')
  const [catFilter, setCatFilter] = useState(null) // null = tous, NO_CATALOGUE, ou nom du catalogue
  const [editing, setEditing]   = useState(null) // { product? } — formulaire ajout / modification
  const [deleting, setDeleting] = useState(null) // produit à supprimer
  const [notice, setNotice]     = useState('')
  const requestKey = `${accountId}|${version}`

  useEffect(() => {
    let cancelled = false
    api.get(`/admin/dem-pro/${accountId}/shop`)
      .then(r => { if (!cancelled) setResult({ key: requestKey, accountId, data: r.data }) })
      .catch(e => { if (!cancelled) setResult({ key: requestKey, accountId, error: e.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [accountId, requestKey])

  // Pendant une relecture après modification, l'affichage précédent reste en place
  if (result?.accountId !== accountId) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Chargement…</div>
  if (result.error) return <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>{result.error}</div>

  const { catalogue, sites, storefront } = result.data
  const { stock } = catalogue
  // Backend pas encore à jour (admin et backend ne se déploient pas en même
  // temps) : ni catalogues ni limites renvoyés → onglet en lecture seule.
  const categories    = catalogue.categories ?? []
  const uncategorized = catalogue.uncategorized ?? 0
  const limits        = catalogue.limits ?? null
  const editable      = canEdit && limits !== null
  const rq = storefront.requests
  const siteLabel = new Map(sites.map(s => [s.id, s.label]))
  const catalogueSize = new Map(categories.map(c => [c.name, c.products]))
  // Le catalogue sélectionné a pu disparaître (dernier produit supprimé ou déplacé)
  const activeCat = catFilter === NO_CATALOGUE
    ? (uncategorized > 0 ? NO_CATALOGUE : null)
    : (catalogueSize.has(catFilter) ? catFilter : null)
  const atProductLimit = limits?.maxProducts != null && catalogue.total >= limits.maxProducts
  const products = catalogue.products.filter(p => {
    if (activeCat === NO_CATALOGUE && catalogueOf(p) !== null) return false
    if (activeCat && activeCat !== NO_CATALOGUE && catalogueOf(p) !== activeCat) return false
    const tracked = p.quantity !== null && p.quantity !== undefined
    if (stockFilter === 'out') return tracked && p.quantity <= 0
    if (stockFilter === 'low') return tracked && p.quantity > 0 && p.quantity <= stock.lowThreshold
    if (stockFilter === 'untracked') return !tracked
    return true
  })

  function afterChange(message) {
    setEditing(null)
    setDeleting(null)
    setNotice(message)
    setVersion(v => v + 1)
    onCatalogueChange?.()
  }
  const openForm = (product) => { setNotice(''); setEditing({ product }) }
  const askDelete = (product) => { setNotice(''); setDeleting(product) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Boutique en ligne */}
      <Section title="Boutique en ligne" hint="Demandes passées par les clients via le lien public du commerçant.">
        <div style={{ fontSize: 12, marginBottom: 10 }}>
          <a href={storefront.url} target="_blank" rel="noreferrer" style={link}>{storefront.url} <ExternalLink size={11} /></a>
        </div>
        <div style={grid5}>
          <Stat small label="En attente de réponse" value={formatCount(rq.pending)} sub={rq.oldestPendingAt ? `la plus ancienne : ${fmtDate(rq.oldestPendingAt, true)}` : null} color={rq.pending > 0 ? '#f59e0b' : undefined} />
          <Stat small label="Acceptées" value={formatCount(rq.confirmed)} color="var(--success)" />
          <Stat small label="Refusées" value={formatCount(rq.rejected)} />
          <Stat small label="Taux d'acceptation" value={rq.acceptanceRate === null ? '—' : `${rq.acceptanceRate}%`} sub="parmi les demandes traitées" />
          <Stat small label="Valeur des demandes acceptées" value={formatF(rq.confirmedValue)} />
        </div>
        {storefront.recent.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Reçue le', 'Client', 'Adresse', 'Articles', 'Total', 'Paiement prévu', 'Statut'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {storefront.recent.map(r => {
                  const st = REQUEST_STATUS[r.status] ?? { label: r.status, color: '#94a3b8' }
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(r.createdAt, true)}</td>
                      <td style={td}>{r.customerName ?? '—'}{r.customerPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.customerPhone}</div>}</td>
                      <td style={{ ...td, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.deliveryAddress}>{r.deliveryAddress}</td>
                      <td style={td}>{formatCount(r.itemsCount)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{r.total != null ? formatF(r.total) : '—'}</td>
                      <td style={{ ...td, fontSize: 12 }}>{STOREFRONT_PAYMENT_LABELS[r.customerPaymentMethod] ?? r.customerPaymentMethod ?? '—'}</td>
                      <td style={td}><Chip color={st.color}>{st.label}</Chip></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>20 demandes les plus récentes.</div>
          </div>
        )}
      </Section>

      {/* Catalogue & stock */}
      <Section
        title="Catalogue & stock"
        hint={`Stock bas = ${stock.lowThreshold} unités ou moins (même seuil que l'alerte envoyée au commerçant).`}
        action={editable && (
          <button
            onClick={() => openForm(null)}
            disabled={atProductLimit}
            title={atProductLimit ? `Limite de ${formatCount(limits.maxProducts)} produits de l'offre ${planLabel(limits.plan)} atteinte : supprimez un produit ou changez son offre.` : 'Ajouter un produit au catalogue du commerçant'}
            style={{ ...btnPrimary, ...(atProductLimit && { opacity: 0.5, cursor: 'not-allowed' }) }}
          ><Plus size={14} /> Ajouter un produit</button>
        )}
      >
        <div style={grid5}>
          <Stat small label="Produits" value={formatCount(catalogue.total)} sub={!limits ? null : limits.maxProducts != null ? `max ${formatCount(limits.maxProducts)} (offre ${planLabel(limits.plan)})` : `illimité (offre ${planLabel(limits.plan)})`} color={atProductLimit ? '#f59e0b' : undefined} />
          {limits && <Stat small label="Catalogues" value={formatCount(categories.length)} sub={!limits.cataloguesAllowed ? 'non inclus dans son offre' : limits.maxCatalogues != null ? `max ${formatCount(limits.maxCatalogues)}` : null} />}
          <Stat small label="Stock suivi" value={formatCount(stock.tracked)} />
          <Stat small label="En rupture" value={formatCount(stock.outOfStock)} color={stock.outOfStock > 0 ? 'var(--danger)' : undefined} />
          <Stat small label="Stock bas" value={formatCount(stock.low)} color={stock.low > 0 ? '#f59e0b' : undefined} />
        </div>
        {notice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>
            <CheckCircle2 size={14} /> {notice}
          </div>
        )}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Catalogue</span>
            <FilterChip active={activeCat === null} onClick={() => setCatFilter(null)}>Tous · {formatCount(catalogue.total)}</FilterChip>
            {categories.map(c => (
              <FilterChip key={c.name} active={activeCat === c.name} onClick={() => setCatFilter(c.name)}>{c.name} · {formatCount(c.products)}</FilterChip>
            ))}
            {uncategorized > 0 && (
              <FilterChip active={activeCat === NO_CATALOGUE} onClick={() => setCatFilter(NO_CATALOGUE)}>Sans catalogue · {formatCount(uncategorized)}</FilterChip>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', margin: '10px 0 12px' }}>
          {categories.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Stock</span>}
          {STOCK_FILTERS.map(([key, label]) => (
            <FilterChip key={key} active={stockFilter === key} onClick={() => setStockFilter(key)}>{label}</FilterChip>
          ))}
        </div>
        {products.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun produit{stockFilter !== 'all' || activeCat ? ' sur ce filtre' : ''}.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Produit', 'Catalogue', 'Prix', 'Stock', 'Utilisations', 'Point de vente', ...(editable ? [''] : [])].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const tracked = p.quantity !== null && p.quantity !== undefined
                  const stockColor = !tracked ? 'var(--text-muted)' : p.quantity <= 0 ? 'var(--danger)' : p.quantity <= stock.lowThreshold ? '#f59e0b' : 'var(--text)'
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...td, fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {p.image && <img src={p.image} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />}
                          {p.name}
                        </div>
                      </td>
                      <td style={{ ...td, fontSize: 12 }}>{catalogueOf(p) ?? '—'}</td>
                      <td style={td}>{p.defaultPrice != null ? formatF(p.defaultPrice) : '—'}</td>
                      <td style={{ ...td, fontWeight: 700, color: stockColor }}>{tracked ? formatCount(p.quantity) : 'non suivi'}</td>
                      <td style={td}>{formatCount(p.usageCount)}</td>
                      <td style={{ ...td, fontSize: 12 }}>{p.proAddressId ? (siteLabel.get(p.proAddressId) ?? '—') : 'Tous'}</td>
                      {editable && (
                        <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                          <button onClick={() => openForm(p)} style={iconBtn} title="Modifier (photo, nom, catalogue, prix, stock, point de vente)"><Pencil size={14} /></button>
                          <button onClick={() => askDelete(p)} style={{ ...iconBtn, color: 'var(--danger)' }} title="Supprimer du catalogue"><Trash2 size={14} /></button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {catalogue.truncated && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{formatCount(catalogue.products.length)} produits les plus utilisés affichés sur {formatCount(catalogue.total)} (compteurs calculés sur tout le catalogue).</div>}
          </div>
        )}
      </Section>

      {editing && (
        <ProductFormModal
          accountId={accountId}
          product={editing.product}
          defaultCategory={activeCat && activeCat !== NO_CATALOGUE ? activeCat : ''}
          categories={categories}
          sites={sites}
          limits={limits}
          onClose={() => setEditing(null)}
          onSaved={afterChange}
        />
      )}
      {deleting && (
        <DeleteProductModal
          accountId={accountId}
          product={deleting}
          isLastOfCatalogue={catalogueOf(deleting) !== null && catalogueSize.get(catalogueOf(deleting)) === 1}
          onClose={() => setDeleting(null)}
          onDeleted={afterChange}
        />
      )}

      {/* Points de vente */}
      <Section title="Points de vente" hint="Activité = livraisons terminées parties de ce site.">
        {sites.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun point de vente enregistré.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Point de vente', 'Adresse', 'Produits', 'Livraisons', 'Valeur produits', 'Coût livraisons', 'Dernière livraison'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sites.map(site => (
                  <tr key={site.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {site.label}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                        {SITE_ICON_LABELS[site.icon] ?? site.icon}{site.isDefault ? ' · par défaut' : ''}
                      </div>
                    </td>
                    <td style={{ ...td, fontSize: 12, maxWidth: 220 }} title={site.landmark ?? ''}>{site.address}{site.landmark && <div style={{ color: 'var(--text-muted)' }}>{site.landmark}</div>}</td>
                    <td style={td}>{formatCount(site.products)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{formatCount(site.activity.deliveries)}</td>
                    <td style={td}>{formatF(site.activity.productsValue)}</td>
                    <td style={td}>{formatF(site.activity.deliveryCost)}</td>
                    <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(site.activity.lastDeliveredAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

// ── Tournées (support, lecture seule) ────────────────────────────────────────
// GET /admin/dem-pro/:id/batches — tournées groupées ; chaque arrêt est une
// vraie commande. Montant livré = arrêts réellement livrés (remise déduite).
const BATCH_FILTERS = [
  ['all', 'Toutes'], ['SCHEDULED', 'Programmées'], ['PENDING', 'En attente'], ['IN_PROGRESS', 'En cours'],
  ['COMPLETED', 'Terminées'], ['CANCELLED', 'Annulées'],
]

function BatchesTab({ accountId }) {
  const [status, setStatus] = useState('all')
  const [page, setPage]     = useState(1)
  const [open, setOpen]     = useState(null) // tournée dépliée
  const [result, setResult] = useState(null) // { key, data?, error? }
  const requestKey = `${accountId}|${status}|${page}`

  useEffect(() => {
    let cancelled = false
    const params = { page }
    if (status !== 'all') params.status = status
    api.get(`/admin/dem-pro/${accountId}/batches`, { params })
      .then(r => { if (!cancelled) setResult({ key: requestKey, data: r.data }) })
      .catch(e => { if (!cancelled) setResult({ key: requestKey, error: e.response?.data?.message ?? 'Erreur de chargement.' }) })
    return () => { cancelled = true }
  }, [accountId, status, page, requestKey])

  const loading = result?.key !== requestKey
  if (!result) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 30 }}>Chargement…</div>
  if (result.error && !loading) return <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 30 }}>{result.error}</div>
  if (!result.data) return null

  const { counts, batches, total, pageSize } = result.data
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const inProgress = (counts.ACCEPTED ?? 0) + (counts.IN_PROGRESS ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading ? 0.6 : 1, transition: 'opacity .15s' }}>
      <div style={grid5}>
        <Stat small label="Tournées" value={formatCount(counts.total)} />
        <Stat small label="En attente / programmées" value={formatCount((counts.PENDING ?? 0) + (counts.SCHEDULED ?? 0))} color={(counts.PENDING ?? 0) > 0 ? '#f59e0b' : undefined} />
        <Stat small label="En cours" value={formatCount(inProgress)} color={inProgress > 0 ? '#6366f1' : undefined} />
        <Stat small label="Terminées" value={formatCount(counts.COMPLETED ?? 0)} color="var(--success)" />
        <Stat small label="Annulées" value={formatCount(counts.CANCELLED ?? 0)} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {BATCH_FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => { setStatus(key); setPage(1); setOpen(null) }} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: status === key ? 'none' : '1px solid var(--border)',
            background: status === key ? 'var(--primary)' : 'transparent',
            color: status === key ? '#fff' : 'var(--text-muted)',
          }}>{label}</button>
        ))}
      </div>

      {batches.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucune tournée{status !== 'all' ? ' sur ce filtre' : ''}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {batches.map(b => {
            const st = BATCH_STATUS[b.status] ?? { label: b.status, color: '#94a3b8' }
            const isOpen = open === b.id
            return (
              <div key={b.id} style={{ background: 'var(--surface2)', borderRadius: 10 }}>
                <div onClick={() => setOpen(isOpen ? null : b.id)} style={{ display: 'grid', gridTemplateColumns: '20px 1.3fr 1fr 1fr 0.9fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div>
                    <div style={{ fontWeight: 600 }}>{fmtDate(b.createdAt, true)}</div>
                    {b.scheduledAt && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>prévue {fmtDate(b.scheduledAt, true)}</div>}
                  </div>
                  <div><Chip color={st.color}>{st.label}</Chip></div>
                  <div style={{ fontSize: 12 }}>{b.driver?.name ?? <span style={{ color: 'var(--text-muted)' }}>Aucun livreur</span>}</div>
                  <div style={{ fontSize: 12 }}>
                    <strong>{b.stops.delivered}</strong> / {b.stops.total} livrés
                    {b.stops.cancelled > 0 && <div style={{ color: 'var(--danger)', fontSize: 11 }}>{b.stops.cancelled} annulé{b.stops.cancelled > 1 ? 's' : ''}</div>}
                  </div>
                  <div style={{ fontSize: 12 }} title="Montant estimé à la création (part livreur + commission)">
                    estimé <strong>{formatF(b.estimatedAmount)}</strong>
                  </div>
                  <div style={{ fontSize: 12 }} title="Arrêts réellement livrés (part livreur + commission − promo)">
                    livré <strong style={{ color: 'var(--success)' }}>{formatF(b.deliveredAmount)}</strong>
                  </div>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 12px 12px 42px' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                      Départ : {b.pickupAddress}{b.notes && <> · Instructions : {b.notes}</>}
                      {b.driver?.phone && <> · <a href={`tel:${b.driver.phone}`} style={link}><Phone size={11} /> {b.driver.phone}</a></>}
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['#', 'Destinataire', 'Adresse', 'Statut', 'Montant', 'Paiement', 'Livré le'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {b.orders.map(o => {
                          const channel = channelOf(o)
                          return (
                            <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ ...td, color: 'var(--text-muted)' }}>{(o.sequenceIndex ?? 0) + 1}</td>
                              <td style={td}>{o.receiverName ?? '—'}{o.receiverPhone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.receiverPhone}</div>}</td>
                              <td style={{ ...td, fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o.deliveryAddress}>{o.deliveryAddress}</td>
                              <td style={td}>
                                <Badge status={o.status} />
                                {o.cancelReason && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{REASON_LABELS[o.cancelReason] ?? o.cancelReason}</div>}
                              </td>
                              <td style={{ ...td, fontWeight: 700 }}>{formatF((o.price ?? 0) + (o.demFee ?? 0) - (o.discountAmount ?? 0))}</td>
                              <td style={td}>{o.status === 'DELIVERED' ? <Badge status={CHANNEL_BADGE_STATUS[channel]} label={CHANNEL_LABELS[channel]} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                              <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{fmtDate(o.deliveredAt, true)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {total > pageSize && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <button onClick={() => { setPage(p => Math.max(1, p - 1)); setOpen(null) }} disabled={page <= 1} style={pageBtn}>← Préc.</button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {page} / {totalPages} — {formatCount(total)} tournées</span>
          <button onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setOpen(null) }} disabled={page >= totalPages} style={pageBtn}>Suiv. →</button>
        </div>
      )}
    </div>
  )
}

// ── Petits composants ─────────────────────────────────────────────────────────
function Section({ title, hint, action, children }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-muted)' }}>{title}</h3>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        {action && <div style={{ marginLeft: 'auto', alignSelf: 'center' }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: active ? 'none' : '1px solid var(--border)',
      background: active ? 'var(--primary)' : 'transparent',
      color: active ? '#fff' : 'var(--text-muted)',
    }}>{children}</button>
  )
}

function Stat({ label, value, sub, color, small }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: small ? '10px 12px' : '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: small ? 18 : 20, fontWeight: 800, color: color ?? 'var(--text)', marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Info({ label, value, icon: Icon }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {Icon && <Icon size={11} />}{label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  )
}

const overlay  = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }
const link     = { color: '#0077b6', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }
const grid3    = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }
const grid5    = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }
const th       = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td       = { padding: '9px 8px', verticalAlign: 'middle', fontSize: 13 }
const pageBtn  = { padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
const iconBtn  = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 5, borderRadius: 6, display: 'inline-flex' }
