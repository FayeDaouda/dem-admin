import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Gift, TrendingUp, TrendingDown, Megaphone, GitBranch } from 'lucide-react'
import api from '../../lib/api'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { useResponsive } from '../../lib/useResponsive'
import PageHeader from '../../components/PageHeader'
import InfoTip from '../../components/InfoTip'
import WhatsAppButton from '../../components/WhatsAppButton'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '../../lib/requestKinds'
import { targetLabel } from '../../lib/broadcastTargets'

// ── Dashboard CM (CM / CRM Client, C1, C2, C3, C8) ──────────────────────────
// « Comment vont mes clients, et qui relancer maintenant ? » — dans l'ordre
// du dossier du 07/11/2026 : à traiter, KPI clients, tunnel, campagnes,
// parrainage, mes bonus. Ni revenus, ni commission, ni gains coursiers, ni
// coursiers en ligne, ni comptes DEM Pro. GET /admin/cm/dashboard.
const PERIODS = [['today', "Aujourd'hui"], ['week', '7 jours'], ['month', '30 jours']]
const STATUS_COLORS = { NEVER_SERVED: '#64748b', ACTIVE: '#0077b6', INACTIVE: '#d97706', LOYAL: '#16a34a' }

const fmtDate = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—')
const age = d => {
  const h = Math.round((Date.now() - new Date(d)) / 3600000)
  return h < 24 ? `${h} h` : `${Math.round(h / 24)} j`
}

function Section({ title, hint, right, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}<InfoTip k={`CM › ${title}`} size={12} /></h2>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </section>
  )
}

function ListCard({ title, color, items, empty, render }) {
  return (
    <div style={{ ...card, borderLeft: items.length ? `4px solid ${color}` : undefined }}>
      <h3 style={{ ...cardTitle, color: items.length ? color : undefined }}>{title}</h3>
      {items.length === 0 ? <div style={emptyStyle}>{empty}</div> : (
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>{items.map(render)}</div>
      )}
    </div>
  )
}

// Tendance face à la période précédente (points pour un taux)
function Trend({ k, invert = false, unit = '%' }) {
  if (k.trend == null) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
  const good = invert ? k.trend <= 0 : k.trend >= 0
  const Icon = k.trend >= 0 ? TrendingUp : TrendingDown
  return (
    <span style={{ fontSize: 11.5, fontWeight: 700, color: k.trend === 0 ? 'var(--text-muted)' : good ? '#15803d' : '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Icon size={12} />{k.trend > 0 ? '+' : ''}{k.trend.toLocaleString('fr-FR')} {unit}
    </span>
  )
}

export default function CmDashboard() {
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [d, setD] = useState(null)
  const [period, setPeriod] = useState('week')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/admin/cm/dashboard').then(r => { setD(r.data); setError('') }).catch(e => setError(e.response?.data?.message ?? 'Dashboard indisponible.'))
  }, [])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load, 120_000)

  const openClient = c => navigate(`/clients?q=${encodeURIComponent(c.phone ?? c.name ?? '')}`)
  const grid = min => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 })

  if (!d) return (
    <div style={pageWrap}>
      <PageHeader title="Dashboard CM" subtitle="Comment vont mes clients, et qui relancer maintenant" />
      <div style={{ color: error ? '#dc2626' : 'var(--text-muted)' }}>{error || 'Chargement…'}</div>
    </div>
  )

  const t = d.toHandle
  const k = d.kpis[period]

  return (
    <div style={pageWrap}>
      <PageHeader title="Dashboard CM" subtitle="Comment vont mes clients, et qui relancer maintenant" />
      <div style={pageScroll}>

        {/* 1. À traiter */}
        <Section title="À traiter">
          <div style={grid(280)}>
            <ListCard title={`Incidents clients ouverts (${t.openClientIncidents}${t.oldClientIncidents ? ` · ${t.oldClientIncidents} depuis plus de 24 h` : ''})`}
              color="#dc2626" items={t.incidents} empty="Aucun incident client ouvert."
              render={i => (
                <div key={i.id} style={row}>
                  <button onClick={() => navigate('/incidents', { state: { focusIncidentId: i.id } })} style={{ ...linkBtn, color: new Date() - new Date(i.openedAt) > 86400000 ? '#dc2626' : 'var(--primary)' }}>{i.label ?? i.type}</button>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>ouvert depuis {age(i.openedAt)}</span>
                </div>
              )} />
            <ListCard title={`Clients insatisfaits — note < 3/5 (${t.unhappyClients})`} color="#d97706" items={t.unhappy} empty="Aucun client insatisfait."
              render={c => (
                <div key={c.id} style={row}>
                  <button onClick={() => openClient(c)} style={linkBtn}>{c.name ?? c.phone}</button>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{c.avgRating?.toLocaleString('fr-FR')} / 5 · {c.ratingsCount} note{c.ratingsCount > 1 ? 's' : ''}</span>
                  {c.phone && <a href={`tel:${c.phone}`} title={`Appeler ${c.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
                  <WhatsAppButton phone={c.phone} compact />
                </div>
              )} />
            <ListCard title="Réponses à mes demandes (7 j)" color="#0ea5e9" items={t.responses} empty="Aucune réponse récente."
              render={r => (
                <div key={r.id} style={row}>
                  <button onClick={() => navigate('/service-client?tab=requests')} style={linkBtn}>{REQUEST_KIND_LABELS[r.kind] ?? r.kind}</button>
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{r.targetUser?.name ?? r.targetUser?.phone ?? ''}</span>
                  <span style={{ fontWeight: 700, color: r.status === 'APPROVED' ? '#15803d' : r.status === 'REJECTED' ? '#dc2626' : '#4f46e5' }}>{REQUEST_STATUS_LABELS[r.status]}</span>
                </div>
              )} />
          </div>
        </Section>

        {/* 2. KPI clients */}
        <Section title="KPI clients" hint="Tendance face à la période précédente de même durée"
          right={
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIODS.map(([key, label]) => (
                <button key={key} onClick={() => setPeriod(key)} style={{ ...pill, ...(period === key ? pillOn : {}) }}>{label}</button>
              ))}
            </div>
          }>
          <div style={grid(170)}>
            <Kpi label="Nouveaux clients" value={k.newClients.value} trend={<Trend k={k.newClients} />} />
            <Kpi label="Clients actifs" value={k.activeClients.value} sub="au moins une course livrée" trend={<Trend k={k.activeClients} />} />
            <Kpi label="Premières commandes" value={k.firstOrders.value} sub="1re course livrée" trend={<Trend k={k.firstOrders} />} />
            <Kpi label="Taux d'annulation" value={`${k.cancellationRate.value.toLocaleString('fr-FR')} %`} sub="courses des clients" trend={<Trend k={k.cancellationRate} invert unit="pts" />} />
            <Kpi label="Rétention 30 j" value={`${d.snapshot.retention30d.toLocaleString('fr-FR')} %`} sub={`avant : ${d.snapshot.previousRetention30d.toLocaleString('fr-FR')} %`} />
            <Kpi label="Inactifs" value={d.snapshot.inactive} sub={`servis, rien depuis ${d.activeDays} j`} onClick={() => navigate('/base-clients?filtre=inactifs')} />
            <Kpi label="Jamais servis" value={d.snapshot.neverServed} sub="aucune course livrée" onClick={() => navigate('/base-clients?filtre=jamais')} />
          </div>
          {/* C8 : statut automatique */}
          <div style={{ ...card, marginTop: 10, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 13 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Statut des {d.snapshot.registered.toLocaleString('fr-FR')} clients :</span>
            {Object.entries(d.statusLabels).map(([key, label]) => (
              <span key={key} style={{ color: STATUS_COLORS[key] }}><strong style={{ fontSize: 18 }}>{d.statuses[key].toLocaleString('fr-FR')}</strong> {label}</span>
            ))}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fidèle : {d.loyalMinOrders} courses livrées ou plus, dont une sur {d.activeDays} j</span>
          </div>
        </Section>

        {/* 3. Tunnel */}
        <Section title="Tunnel clients" hint="Nombre à chaque étape et taux de passage depuis l'étape précédente">
          <div style={grid(150)}>
            {d.funnel.map(s => (
              <div key={s.key} style={card}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{s.value.toLocaleString('fr-FR')}</div>
                {s.rate != null && <div style={{ fontSize: 11.5, color: s.rate < 30 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>{s.rate.toLocaleString('fr-FR')} % de l'étape d'avant</div>}
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Campagnes */}
        <Section title="Campagnes" hint="Inscriptions et commandes des clients dans les 48 h qui suivent un envoi"
          right={<button onClick={() => navigate('/notifications')} style={outlineBtn}><Megaphone size={13} /> Notifications</button>}>
          <div style={grid(300)}>
            <ListCard title="Derniers envois aux clients" color="#e11d48" items={d.campaigns.broadcasts} empty="Aucun envoi aux clients."
              render={b => (
                <div key={b.id} style={row}>
                  <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{fmtDate(b.sentAt)} · {targetLabel(b.target)}{b.sent != null ? ` · ${b.sent} envoyée${b.sent > 1 ? 's' : ''}` : ''}</span>
                  <strong title="Inscriptions dans les 48 h">+{b.signups48h} insc.</strong>
                  <strong title="Commandes dans les 48 h">{b.orders48h} cmd</strong>
                </div>
              )} />
            <ListCard title="Codes en cours" color="#6366f1" items={d.campaigns.promos} empty="Aucun code actif pour les clients."
              render={c => (
                <div key={c.id} style={row}>
                  <span style={{ fontWeight: 600, flex: 1 }}>{c.name}</span>
                  {c.code && <code style={{ fontSize: 12 }}>{c.code}</code>}
                  <strong>{c.usedCount}{c.maxUsesTotal != null ? ` / ${c.maxUsesTotal}` : ''} util.</strong>
                </div>
              )} />
          </div>
        </Section>

        {/* 5. Parrainage */}
        <Section title="Parrainage" right={<button onClick={() => navigate('/parrainage')} style={outlineBtn}><GitBranch size={13} /> Parrainage</button>}>
          <div style={grid(260)}>
            <div style={{ ...card, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 13 }}>
              <span><strong style={{ fontSize: 20 }}>{d.referral.month}</strong> parrainage{d.referral.month > 1 ? 's' : ''} ce mois</span>
              <span style={{ color: d.referral.unpaidBonuses.count ? '#b45309' : undefined }}>
                <strong style={{ fontSize: 20 }}>{d.referral.unpaidBonuses.count}</strong> bonus promis non versé{d.referral.unpaidBonuses.count > 1 ? 's' : ''}
                {d.referral.unpaidBonuses.amount > 0 && ` (${d.referral.unpaidBonuses.amount.toLocaleString('fr-FR')} F)`}
              </span>
            </div>
            <ListCard title="Top parrains" color="#16a34a" items={d.referral.top} empty="Aucun parrain pour le moment."
              render={p => (
                <div key={p.id} style={row}>
                  <button onClick={() => openClient(p)} style={linkBtn}>{p.name ?? p.phone}</button>
                  <span style={{ flex: 1, color: 'var(--text-muted)' }}>{p.referrals} filleul{p.referrals > 1 ? 's' : ''}</span>
                  <WhatsAppButton phone={p.phone} compact />
                </div>
              )} />
          </div>
        </Section>

        {/* 6. Mes bonus */}
        <Section title="Mes bonus" hint="Ce mois">
          <div style={{ ...card, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <Gift size={20} color="#16a34a" />
            <span><strong style={{ fontSize: 20, color: d.bonus.freeCourses.used >= d.bonus.freeCourses.cap ? '#dc2626' : undefined }}>{d.bonus.freeCourses.used}</strong> / {d.bonus.freeCourses.cap} courses offertes</span>
            <button onClick={() => navigate('/recompenses')} style={outlineBtn}>Offrir une course</button>
            <button onClick={() => navigate('/service-client?tab=requests')} style={outlineBtn}>{d.bonus.pendingRequests} demande{d.bonus.pendingRequests > 1 ? 's' : ''} en attente</button>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, trend, onClick }) {
  return (
    <div onClick={onClick} style={{ ...card, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 24, fontWeight: 800 }}>{typeof value === 'number' ? value.toLocaleString('fr-FR') : value}</span>
        {trend}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

const card       = { ...glass, padding: '14px 16px', minWidth: 0 }
const cardTitle  = { fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 0 }
const emptyStyle = { fontSize: 12.5, color: 'var(--text-muted)' }
const row        = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border)' }
const linkBtn    = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, textAlign: 'left', whiteSpace: 'nowrap' }
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const pill       = { padding: '4px 10px', borderRadius: 14, border: '1px solid rgba(0,119,182,0.2)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }
const pillOn     = { background: 'var(--primary)', color: '#fff', borderColor: 'var(--primary)' }
