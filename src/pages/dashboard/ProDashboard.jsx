import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, Map as MapIcon, Gift, AlertTriangle, Clock } from 'lucide-react'
import api from '../../lib/api'
import { glass, pageWrap, pageScroll } from '../../lib/glassStyles'
import { useAutoRefresh } from '../../lib/useAutoRefresh'
import { useResponsive } from '../../lib/useResponsive'
import PageHeader from '../../components/PageHeader'
import InfoTip from '../../components/InfoTip'
import WhatsAppButton from '../../components/WhatsAppButton'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS } from '../../lib/requestKinds'
import { clientCharge } from '../../lib/orderPrice'

// ── Dashboard Pro (Commercial / CRM Pro, C1 à C4) ───────────────────────────
// « Où en sont mes Pro, et qui dois-je appeler maintenant ? » — dans l'ordre
// du dossier du 07/11/2026 : à traiter, objectif, tunnel, activité, plans,
// courses Pro en direct, mes bonus. GET /admin/dem-pro/dashboard.
const PRO_ALERT_MIN = 3 // courses Pro en attente : alerte au-delà de 3 min (dossier)

const fmtDate = d => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '—')
const proName = p => p.proBusinessName ?? p.name ?? p.phone

function Section({ title, hint, right, children }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{title}<InfoTip k={`Pro › ${title}`} size={12} /></h2>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{hint}</span>}
        {right && <div style={{ marginLeft: 'auto' }}>{right}</div>}
      </div>
      {children}
    </section>
  )
}

function ProRow({ p, extra, onOpen }) {
  return (
    <div style={row}>
      <button onClick={() => onOpen(p.id)} style={linkBtn}>{proName(p)}</button>
      <span style={{ color: 'var(--text-muted)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extra}</span>
      {p.phone && <a href={`tel:${p.phone}`} title={`Appeler ${p.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
      <WhatsAppButton phone={p.phone} compact />
    </div>
  )
}

// Jauge en demi-cercle : part de `value` sur `total`, en pourcentage au centre.
function Gauge({ title, hint, value, total, color }) {
  const pct = total ? Math.round(value / total * 1000) / 10 : 0
  const arc = 'M 14 96 A 82 82 0 0 1 178 96'
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4 }}>
      <h3 style={{ ...cardTitle, marginBottom: 2 }}>{title}</h3>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 6 }}>{hint}</div>
      <svg viewBox="0 0 192 104" width="100%" style={{ maxWidth: 240 }} role="img" aria-label={`${title} : ${value} sur ${total}`}>
        <path d={arc} pathLength="100" fill="none" stroke="rgba(0,0,0,.08)" strokeWidth="14" strokeLinecap="round" />
        {pct > 0 && <path d={arc} pathLength="100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${Math.min(100, pct)} 100`} />}
        <text x="96" y="82" textAnchor="middle" style={{ fontSize: 28, fontWeight: 800, fill: 'var(--text)' }}>{pct.toLocaleString('fr-FR')} %</text>
      </svg>
      <div style={{ fontSize: 13 }}>
        <strong style={{ fontSize: 20, color }}>{value}</strong>
        <span style={{ color: 'var(--text-muted)' }}> / {total} DEM Pro</span>
      </div>
    </div>
  )
}

// ── Nouveaux clients et nouveaux DEM Pro (GET /admin/dem-pro/newcomers) ──
const PRO_STATUS = {
  PENDING:  { label: 'En attente', color: '#b45309' },
  ACTIVE:   { label: 'Validé',     color: '#15803d' },
  REJECTED: { label: 'Refusé',     color: '#dc2626' },
}
const fmtDay = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function Newcomers({ isMobile, onOpenPro, onOpenClient }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    api.get('/admin/dem-pro/newcomers', { params: { days } })
      .then(r => { setData(r.data); setError('') })
      .catch(e => setError(e.response?.data?.message ?? 'Liste indisponible.'))
  }, [days])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load, 60_000)

  const periodSwitch = (
    <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.45)', borderRadius: 8, padding: 3 }}>
      {[7, 30].map(n => (
        <button key={n} onClick={() => setDays(n)} style={{
          padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
          background: days === n ? 'var(--primary)' : 'transparent', color: days === n ? '#fff' : 'var(--text-muted)', fontWeight: days === n ? 700 : 500,
        }}>{n} jours</button>
      ))}
    </div>
  )

  const contact = phone => phone && (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      <a href={`tel:${phone}`} title={`Appeler ${phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>
      <WhatsAppButton phone={phone} compact />
    </span>
  )

  return (
    <Section title="Nouveaux inscrits" hint="Du plus récent au plus ancien" right={periodSwitch}>
      {error ? <div style={{ ...card, color: '#dc2626', fontSize: 13 }}>{error}</div> : !data ? <div style={{ ...card, ...emptyStyle }}>Chargement…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))', gap: 10 }}>
          <NewcomerTable
            title="Nouveaux clients" total={data.clients.total} shown={data.clients.list.length} empty={`Aucun client inscrit sur ${days} jours.`}
            head={['Nom', 'Téléphone', 'Inscrit le', 'Courses', '']}
            rows={data.clients.list.map(c => ({
              key: c.id,
              cells: [
                <button key="n" onClick={() => onOpenClient(c.phone)} style={linkBtn}>{c.name || 'Sans nom'}</button>,
                c.phone,
                fmtDay(c.createdAt),
                <strong key="o" style={{ color: c.orders ? '#15803d' : 'var(--text-muted)' }}>{c.orders}</strong>,
                contact(c.phone),
              ],
            }))} />
          <NewcomerTable
            title="Nouveaux DEM Pro" total={data.pros.total} shown={data.pros.list.length} empty={`Aucun DEM Pro inscrit sur ${days} jours.`}
            head={['Boutique', 'Statut', 'Inscrit le', 'Courses', '']}
            rows={data.pros.list.map(p => {
              const st = !p.isActive && p.proStatus === 'ACTIVE' ? { label: 'Suspendu', color: '#dc2626' } : (PRO_STATUS[p.proStatus] ?? { label: p.proStatus ?? '—', color: 'var(--text-muted)' })
              return {
                key: p.id,
                cells: [
                  <div key="n" style={{ minWidth: 0 }}>
                    <button onClick={() => onOpenPro(p.id)} style={linkBtn}>{p.proBusinessName || p.name || 'Sans nom'}</button>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[p.proBusinessName ? p.name : null, p.phone].filter(Boolean).join(' · ')}</div>
                  </div>,
                  <span key="s" style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: st.color, background: 'rgba(0,0,0,.05)', whiteSpace: 'nowrap' }}>{st.label}</span>,
                  <div key="d">
                    {fmtDay(p.createdAt)}
                    {p.sourceLabel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.sourceLabel}</div>}
                  </div>,
                  <strong key="o" style={{ color: p.orders ? '#15803d' : 'var(--text-muted)' }}>{p.orders}</strong>,
                  contact(p.phone),
                ],
              }
            })} />
        </div>
      )}
    </Section>
  )
}

function NewcomerTable({ title, total, shown, head, rows, empty }) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ ...cardTitle, margin: 0 }}>{title}</h3>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{total}</span>
        {total > shown && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({shown} plus récents affichés)</span>}
      </div>
      {rows.length === 0 ? <div style={{ ...emptyStyle, padding: '0 16px 14px' }}>{empty}</div> : (
        <div style={{ maxHeight: 340, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>{head.map((h, i) => <th key={i} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  {r.cells.map((c, i) => <td key={i} style={td}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ListCard({ title, color, items, empty, render }) {
  return (
    <div style={{ ...card, borderLeft: items.length ? `4px solid ${color}` : undefined }}>
      <h3 style={{ ...cardTitle, color: items.length ? color : undefined }}>{title} ({items.length})</h3>
      {items.length === 0 ? <div style={emptyStyle}>{empty}</div> : (
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>{items.map(render)}</div>
      )}
    </div>
  )
}

export default function ProDashboard() {
  const navigate = useNavigate()
  const { isMobile } = useResponsive()
  const [d, setD] = useState(null)
  const [live, setLive] = useState({ pending: [], active: [] })
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/admin/dem-pro/dashboard').then(r => { setD(r.data); setError('') }).catch(e => setError(e.response?.data?.message ?? 'Dashboard indisponible.'))
    Promise.all([
      api.get('/admin/stats/stuck-pending-orders', { params: { period: 'all', clientType: 'DEM_PRO' } }),
      api.get('/admin/stats/recent-active-orders', { params: { period: 'all', clientType: 'DEM_PRO' } }),
    ]).then(([p, a]) => setLive({ pending: p.data?.orders ?? [], active: a.data?.orders ?? [], at: Date.now() })).catch(() => {})
  }, [])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load, 60_000)

  const openPro = id => navigate(`/dem-pro?fiche=${id}`)
  const grid = min => ({ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 10 })

  if (!d) return (
    <div style={pageWrap}>
      <PageHeader title="Dashboard Pro" subtitle="Où en sont mes Pro, et qui appeler maintenant" />
      <div style={{ color: error ? '#dc2626' : 'var(--text-muted)' }}>{error || 'Chargement…'}</div>
    </div>
  )

  const t = d.toHandle
  const g = d.gauges ?? { total: 0, activeWithTrials: 0, paying: 0 } // serveur pas encore à jour
  const waitMin = o => Math.max(0, Math.round((live.at - new Date(o.createdAt)) / 60000))

  return (
    <div style={pageWrap}>
      <PageHeader title="Dashboard Pro" subtitle="Où en sont mes Pro, et qui appeler maintenant" />
      <div style={pageScroll}>

        {/* 1. À traiter */}
        <Section title="À traiter" hint="Appels du jour : 10h–12h nouveaux appels, 15h–16h rappels et suivis">
          <div style={grid(280)}>
            <ListCard title="Essais qui finissent (≤ 2 j)" color="#dc2626" items={t.trialEnding} empty="Aucun essai ne finit d'ici 2 jours."
              render={p => <ProRow key={p.id} p={p} onOpen={openPro} extra={`fin ${fmtDate(p.planEndsAt)} · ${p.ordersDuringTrial} commande${p.ordersDuringTrial > 1 ? 's' : ''} pendant l'essai`} />} />
            <ListCard title="Pro dormants (7 j sans commande)" color="#d97706" items={t.dormant} empty="Aucun Pro dormant."
              render={p => <ProRow key={p.id} p={p} onOpen={openPro} extra={`dernière commande ${fmtDate(p.lastOrderAt)} · ${p.orders} au total`} />} />
            <ListCard title="Validés, jamais commandé" color="#d97706" items={t.neverOrdered} empty="Tous les Pro validés ont commandé."
              render={p => <ProRow key={p.id} p={p} onOpen={openPro} extra={`inscrit ${fmtDate(p.createdAt)}${p.inTrial ? ' · en essai' : ''}`} />} />
            <ListCard title="En attente de validation" color="#6366f1" items={t.pending} empty="Aucun Pro en attente."
              render={p => <ProRow key={p.id} p={p} onOpen={() => navigate('/validation?tab=dem-pro')} extra={`inscrit ${fmtDate(p.createdAt)}`} />} />
            <ListCard title="Réponses à mes demandes (7 j)" color="#0ea5e9" items={t.responses} empty="Aucune réponse récente."
              render={r => (
                <div key={r.id} style={row}>
                  <button onClick={() => navigate('/service-client?tab=requests')} style={linkBtn}>{REQUEST_KIND_LABELS[r.kind] ?? r.kind}</button>
                  <span style={{ color: 'var(--text-muted)', flex: 1 }}>{r.targetUser?.proBusinessName ?? r.targetUser?.name ?? ''}</span>
                  <span style={{ fontWeight: 700, color: r.status === 'APPROVED' ? '#15803d' : r.status === 'REJECTED' ? '#dc2626' : '#4f46e5' }}>{REQUEST_STATUS_LABELS[r.status]}</span>
                </div>
              )} />
          </div>
        </Section>

        {/* 2. Objectif */}
        <Section title="Objectif" hint="Sur l'ensemble des comptes DEM Pro">
          <div style={grid(260)}>
            <Gauge title="DEM Pro actifs, essais compris" hint="Au moins 1 commande sur 7 jours, ou essai gratuit en cours"
              value={g.activeWithTrials} total={g.total} color="#f97316" />
            <Gauge title="DEM Pro payants" hint="Abonnement payé en cours"
              value={g.paying} total={g.total} color="#16a34a" />
          </div>
        </Section>

        {/* 2 bis. Nouveaux clients et nouveaux DEM Pro */}
        <Newcomers isMobile={isMobile} onOpenPro={openPro} onOpenClient={phone => navigate(`/clients?q=${encodeURIComponent(phone)}`)} />

        {/* 3. Tunnel Pro */}
        <Section title="Tunnel Pro" hint="Nombre à chaque étape et taux de passage depuis l'étape précédente">
          <div style={grid(150)}>
            {d.funnel.map(s => (
              <div key={s.key} style={card}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{s.count}</div>
                {s.rate != null && <div style={{ fontSize: 11.5, color: s.rate < 30 ? '#dc2626' : 'var(--text-muted)', fontWeight: 600 }}>{s.rate.toLocaleString('fr-FR')} % de l'étape d'avant</div>}
              </div>
            ))}
          </div>
        </Section>

        {/* 4. Activité Pro */}
        <Section title="Activité Pro" hint="Commandes des comptes DEM Pro">
          <div style={grid(220)}>
            {[['Aujourd\'hui', d.activity.today], ['7 derniers jours', d.activity.week]].map(([label, a]) => (
              <div key={label} style={card}>
                <h3 style={cardTitle}>{label}</h3>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
                  <span><strong style={{ fontSize: 20 }}>{a.orders}</strong> commande{a.orders > 1 ? 's' : ''}</span>
                  <span><strong style={{ fontSize: 20 }}>{a.pros}</strong> Pro {a.pros > 1 ? 'ont' : 'a'} commandé</span>
                  <span><strong style={{ fontSize: 20 }}>{a.firstOrders}</strong> 1re{a.firstOrders > 1 ? 's' : ''} course{a.firstOrders > 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. Plans */}
        <Section title="Plans" hint="Plan en cours de chaque compte">
          <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'baseline', fontSize: 13 }}>
            {d.plans.distribution.map(p => <span key={p.key}><strong style={{ fontSize: 20 }}>{p.count}</strong> {p.label}</span>)}
            <span style={{ color: '#7c3aed' }}><strong style={{ fontSize: 20 }}>{d.plans.trials}</strong> en essai</span>
            <span style={{ color: '#b45309' }}><strong style={{ fontSize: 20 }}>{d.plans.noPayment}</strong> sans paiement</span>
          </div>
        </Section>

        {/* 6. Courses Pro en direct */}
        <Section title="Courses Pro en direct" hint={`Alerte au-delà de ${PRO_ALERT_MIN} min sans coursier`}
          right={<button onClick={() => navigate('/map')} style={outlineBtn}><MapIcon size={13} /> Carte live</button>}>
          <div style={grid(280)}>
            <ListCard title="En attente d'un coursier" color="#dc2626" items={live.pending} empty="Aucune course Pro en attente."
              render={o => {
                const late = waitMin(o) >= PRO_ALERT_MIN
                return (
                  <div key={o.id} style={{ ...row, color: late ? '#dc2626' : undefined }}>
                    {late ? <AlertTriangle size={13} /> : <Clock size={13} />}
                    <button onClick={() => navigate(`/orders?q=${o.id.slice(0, 8)}`)} style={{ ...linkBtn, color: 'inherit' }}>{o.client?.proBusinessName ?? o.client?.name ?? o.id.slice(0, 8).toUpperCase()}</button>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.pickupAddress}</span>
                    <strong>{waitMin(o)} min</strong>
                  </div>
                )
              }} />
            <ListCard title="En cours" color="#0077b6" items={live.active} empty="Aucune course Pro en cours."
              render={o => (
                <div key={o.id} style={row}>
                  <button onClick={() => navigate(`/orders?q=${o.id.slice(0, 8)}`)} style={linkBtn}>{o.client?.proBusinessName ?? o.client?.name ?? o.id.slice(0, 8).toUpperCase()}</button>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{o.driver?.name ?? '—'}</span>
                  <span>{clientCharge(o).toLocaleString('fr-FR')} F</span>
                </div>
              )} />
          </div>
        </Section>

        {/* 7. Mes bonus */}
        <Section title="Mes bonus" hint="Ce mois">
          <div style={{ ...card, display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <Gift size={20} color="#16a34a" />
            <span><strong style={{ fontSize: 20, color: d.bonus.freeCourses.used >= d.bonus.freeCourses.cap ? '#dc2626' : undefined }}>{d.bonus.freeCourses.used}</strong> / {d.bonus.freeCourses.cap} courses offertes</span>
            <span><strong style={{ fontSize: 20 }}>{d.bonus.trialExtensions.count}</strong> essai{d.bonus.trialExtensions.count > 1 ? 's' : ''} prolongé{d.bonus.trialExtensions.count > 1 ? 's' : ''} ({d.bonus.trialExtensions.days} j)</span>
            <button onClick={() => navigate('/service-client?tab=requests')} style={outlineBtn}>{d.bonus.pendingRequests} demande{d.bonus.pendingRequests > 1 ? 's' : ''} en attente</button>
          </div>
        </Section>
      </div>
    </div>
  )
}

const card       = { ...glass, padding: '14px 16px', minWidth: 0 }
const cardTitle  = { fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 0 }
const emptyStyle = { fontSize: 12.5, color: 'var(--text-muted)' }
const row        = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 0', borderBottom: '1px solid var(--border)' }
const linkBtn    = { background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, textAlign: 'left', whiteSpace: 'nowrap' }
const th = { position: 'sticky', top: 0, background: 'rgba(240,249,255,0.97)', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '7px 8px', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.3 }
const td = { padding: '7px 8px', verticalAlign: 'middle', whiteSpace: 'nowrap' }
const outlineBtn = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
