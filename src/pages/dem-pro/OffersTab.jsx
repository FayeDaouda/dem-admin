import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, Circle, AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import { glass } from '../../lib/glassStyles'
import { formatF, formatCount, OPERATOR_LABELS } from '../../lib/format'
import TiersActiveToggle from './TiersActiveToggle'
import DemProTiersSection from '../DemProTiersSection'
import { planLabel, PLAN_COLORS, PURCHASE_STATUS } from './labels'

// ── Onglet "Offres DEM Pro" de la page DEM Pro ────────────────────────────────
// Paliers Starter / Business / Premium : activation, préparation de la bascule
// (docs/bascule-paliers-dem-pro.md), contenu et chiffres de chaque offre,
// répartition des comptes, abonnements, réglages.
// Données : GET /admin/dem-pro/offers (admin.dem-pro-offers.service.js).

// Contenu d'une offre, dans l'ordre d'affichage (champs ProPlanLimits)
const FEATURE_ROWS = [
  ['maxProducts',              'Produits au catalogue', 'num'],
  ['maxCatalogues',            'Catalogues (catégories)', 'num'],
  ['maxAddresses',             'Points de vente', 'num'],
  ['maxBatchSimultaneous',     'Tournées en parallèle', 'num'],
  ['maxScheduledSimultaneous', 'Livraisons programmées en parallèle', 'num'],
  ['analyticsMaxPeriodDays',   'Historique des statistiques', 'days'],
  ['onlineSalesEnabled',       'Boutique en ligne, paiement intégré, wallet', 'bool'],
  ['withdrawalWeeklyCapFcfa',  'Plafond de retrait par semaine', 'money'],
  ['financeViewsEnabled',      'Ventes, livraisons, activité + export', 'bool'],
  ['crmEnabled',               'Mes clients (CRM)', 'bool'],
  ['invoiceEnabled',           'Facture par commande', 'bool'],
  ['invoiceBatchEnabled',      'Facturation groupée', 'bool'],
  ['apiAccessEnabled',         'Accès API', 'bool'],
  ['supportTier',              'Support', 'support'],
]
const SUPPORT_LABELS = { standard: 'Standard', priority: 'Prioritaire', premium: 'Premium' }

function formatFeature(value, kind) {
  if (kind === 'bool') return value ? '✓' : '—'
  if (kind === 'support') return SUPPORT_LABELS[value] ?? value ?? '—'
  if (value === null || value === undefined) return kind === 'money' ? 'Sans plafond' : 'Illimité'
  if (kind === 'days') return value >= 365 ? `${Math.round(value / 365)} an${value >= 730 ? 's' : ''}` : `${value} jours`
  if (kind === 'money') return formatF(value)
  return formatCount(value)
}

export default function OffersTab({ isSuper, onSystemChange }) {
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/admin/dem-pro/offers')
      .then(r => { setData(r.data); setError('') })
      .catch(e => setError(e.response?.data?.message ?? 'Erreur de chargement.'))
  }, [])

  useEffect(() => { load() }, [load])

  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>
  if (!data) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const { readiness: r, tiers, legacy, subscriptions: sub } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', paddingBottom: 24 }}>
      {/* ── Activation ── */}
      {isSuper && <TiersActiveToggle onChange={() => { load(); onSystemChange?.() }} />}

      {/* ── Préparation de la bascule ── */}
      {!r.tiersActive && (
        <Card title="Préparation de la bascule" hint="Procédure complète : docs/bascule-paliers-dem-pro.md">
          <Step done={r.pricesSet} label="Prix des 3 offres posés"
            detail={r.pricesSet ? null : 'Admin › Maintenance › tâche 3 « Poser les prix et limites »'} />
          <Step done={null} label="Mise à jour de l'application publiée" detail="À vérifier sur les stores (non détectable ici)" />
          <Step done={r.legacyBusinessAccounts === 0} label="Aucun compte sur l'ancien Business"
            detail={r.legacyBusinessAccounts === 0 ? null : `${formatCount(r.legacyBusinessAccounts)} compte(s) à repasser en Pro dans l'onglet Comptes`} />
          <Step done={false} label="Activer l'interrupteur, puis lancer la migration des comptes Pro"
            detail={`${formatCount(r.proAccountsToMigrate)} compte(s) Pro deviendront Starter (prisma/migrate_pro_plan_tiers.sql)`} />
        </Card>
      )}
      {r.tiersActive && r.proAccountsToMigrate > 0 && (
        <div style={{ ...glass, padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', color: '#b45309', fontSize: 13 }}>
          <AlertTriangle size={16} /> Offres actives, mais {formatCount(r.proAccountsToMigrate)} compte(s) encore en Pro : lancer la migration des comptes Pro vers Starter.
        </div>
      )}

      {/* ── Les 3 offres ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {tiers.map(t => (
          <div key={t.plan} style={{ ...glass, padding: '18px 18px 14px', borderTop: `4px solid ${PLAN_COLORS[t.plan] ?? 'var(--primary)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: PLAN_COLORS[t.plan] }}>{t.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {t.limits?.priceMonthly ? formatF(t.limits.priceMonthly) : <span style={{ color: 'var(--danger)', fontSize: 13 }}>prix non posé</span>}
                {t.limits?.priceMonthly ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}> / mois</span> : null}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, margin: '14px 0' }}>
              <Mini label="Comptes" value={t.accounts.total} />
              <Mini label="Payés" value={t.accounts.paid} color="var(--success)" />
              <Mini label="Essai" value={t.accounts.trial} color="#0ea5e9" />
              <Mini label="Manuels" value={t.accounts.manual} color="#f59e0b" />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Revenus 30 jours : <strong style={{ color: 'var(--text)' }}>{formatF(t.revenue30d)}</strong>
            </div>

            {t.limits ? (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                {FEATURE_ROWS.map(([key, label, kind]) => {
                  const v = formatFeature(t.limits[key], kind)
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, padding: '4px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: v === '—' ? 'var(--text-muted)' : 'var(--text)', textAlign: 'right' }}>{v}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>Offre non configurée — Maintenance › tâche 3.</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Répartition des comptes ── */}
      <Card title="Répartition des comptes DEM Pro" hint="Payé = abonnement SamirPay en cours ; manuel = attribué par un admin sans paiement.">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['Offre', 'Système', 'Comptes', 'Payés', 'Essai', 'Manuels', 'Revenus 30 j'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {[...legacy.map(l => ({ ...l, system: 'Ancien' })), ...tiers.map(t => ({ ...t, system: 'Nouvelles offres' }))].map(row => (
              <tr key={`${row.system}-${row.plan}`} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 700, color: PLAN_COLORS[row.plan] }}>{row.label}</td>
                <td style={{ ...td, fontSize: 12, color: 'var(--text-muted)' }}>{row.system}</td>
                <td style={{ ...td, fontWeight: 700 }}>{formatCount(row.accounts.total)}</td>
                <td style={td}>{formatCount(row.accounts.paid)}</td>
                <td style={td}>{formatCount(row.accounts.trial)}</td>
                <td style={td}>{formatCount(row.accounts.manual)}</td>
                <td style={td}>{row.revenue30d !== undefined ? formatF(row.revenue30d) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* ── Abonnements ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
        <Card title="Achats d'abonnement récents" hint={`Revenus abonnements 30 jours : ${formatF(sub.revenue30d)}`}>
          {sub.recentPurchases.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun achat pour l'instant.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Date', 'Commerçant', 'Offre', 'Montant', 'Issue'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {sub.recentPurchases.map(p => {
                  const st = PURCHASE_STATUS[p.status] ?? { label: p.status, color: '#94a3b8' }
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...td, color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={td}>{p.account.name ?? '—'}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{planLabel(p.plan)}</td>
                      <td style={td}>{formatF(p.amount)}</td>
                      <td style={td}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: st.color + '18', color: st.color }}>{st.label}</span>
                        {p.operatorName && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · {OPERATOR_LABELS[p.operatorName] ?? p.operatorName}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={`Essais qui se terminent sous ${sub.trialSoonDays} jours`} hint="À l'expiration, le compte repasse en Gratuit.">
          {sub.trialsExpiringSoon.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun essai ne se termine bientôt.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sub.trialsExpiringSoon.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', fontSize: 13 }}>
                  <span><strong>{t.name}</strong> · {planLabel(t.plan)}</span>
                  <span style={{ color: '#b45309' }}>fin le {new Date(t.expiresAt).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Réglages (prix, limites) ── */}
      <DemProTiersSection onSaved={load} />
    </div>
  )
}

function Card({ title, hint, children }) {
  return (
    <div style={{ ...glass, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{title}</h3>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// done : true (fait), false (à faire), null (à vérifier manuellement)
function Step({ done, label, detail }) {
  const Icon = done ? CheckCircle2 : Circle
  const color = done ? 'var(--success)' : done === null ? '#0ea5e9' : 'var(--text-muted)'
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}>
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: done ? 'var(--text)' : undefined }}>{label}</div>
        {detail && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail}</div>}
      </div>
    </div>
  )
}

function Mini({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color ?? 'var(--text)' }}>{formatCount(value)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

const th = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td = { padding: '8px', verticalAlign: 'middle' }
