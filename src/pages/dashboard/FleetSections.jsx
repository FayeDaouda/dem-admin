import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { Bike, Clock, Timer, PackageCheck, Phone } from 'lucide-react'
import { glass } from '../../lib/glassStyles'
import WhatsAppButton from '../../components/WhatsAppButton'

// ── Dashboard du Responsable de flottes (dossier du 06/11/2026, C9) ─────────
// Coursiers aujourd'hui, motifs d'annulation, délais, heures de pointe —
// GET /admin/stats/fleet-analytics (admin.fleet-analytics.service.js).
// `part` : 'drivers' (après « En direct ») ou 'courses' (après « Aujourd'hui ») ;
// `Section` : la section du Dashboard (titre, ⓘ, aide) ; `analytics` :
// lib/useFleetAnalytics.js, chargé une fois pour les deux parties.

const CATEGORY_COLORS = {
  NO_COURIER: '#dc2626', CLIENT: '#0077b6', COURIER: '#f97316', ADDRESS: '#a855f7',
  DUPLICATE: '#64748b', OTHER: '#94a3b8', NONE: '#cbd5e1',
}

function fmtDuration(seconds) {
  if (!seconds) return '0 min'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`
}
const fmtMin = d => (d?.minutes == null ? '—' : `${d.minutes.toLocaleString('fr-FR')} min`)

function DaysToggle({ days, setDays }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[7, 30].map(d => (
        <button key={d} onClick={() => setDays(d)} style={{
          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          border: '1px solid rgba(0,119,182,.25)', background: days === d ? 'var(--primary)' : 'transparent',
          color: days === d ? '#fff' : 'var(--text-muted)',
        }}>{d} j</button>
      ))}
    </div>
  )
}

function Tile(props) {
  const { icon: Icon, color, label, value, sub } = props
  return (
    <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
      </div>
    </div>
  )
}

function DriverRow({ d }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.online ? '#22c55e' : '#cbd5e1', flexShrink: 0 }} title={d.online ? 'En ligne' : 'Hors ligne'} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{d.name ?? d.phone ?? '—'}</span>
      <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtDuration(d.onlineSeconds)}</span>
      <span style={{ width: 70, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: d.courses ? 'var(--text)' : '#dc2626' }}>{d.courses} course{d.courses > 1 ? 's' : ''}</span>
      {d.phone && <a href={`tel:${d.phone}`} title={`Appeler ${d.phone}`} style={{ color: 'var(--primary)', display: 'flex' }}><Phone size={13} /></a>}
      <WhatsAppButton phone={d.phone} compact />
    </div>
  )
}

function DriversPart(props) {
  const { data, Section, isMobile } = props
  const d = data.drivers
  return (
    <Section title="Coursiers aujourd'hui" hint="Depuis minuit · temps en ligne reconstitué depuis l'app">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 10 }}>
        <Tile icon={Bike} color="#22c55e" label="En ligne maintenant" value={d.onlineNow} sub={`${d.freeNow} libre${d.freeNow > 1 ? 's' : ''} · ${d.busyNow} en course`} />
        <Tile icon={Clock} color="#0077b6" label="Connectés aujourd'hui" value={d.connectedToday} />
        <Tile icon={Timer} color="#dc2626" label="Connectés sans course" value={d.idle.length} sub="30 min ou plus, aucune course acceptée" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
        <div style={card}>
          <h3 style={cardTitle}>Classement par temps de connexion</h3>
          {d.ranking.length === 0 ? <div style={empty}>Aucun coursier connecté aujourd'hui.</div> : d.ranking.map(x => <DriverRow key={x.id} d={x} />)}
        </div>
        <div style={card}>
          <h3 style={cardTitle}>Connectés mais à 0 course</h3>
          {d.idle.length === 0 ? <div style={empty}>Aucun : tous les coursiers connectés ont eu au moins une course.</div> : d.idle.map(x => <DriverRow key={x.id} d={x} />)}
        </div>
      </div>
    </Section>
  )
}

function ReasonBars({ rows, total }) {
  if (!rows.length) return <div style={empty}>Aucune annulation.</div>
  return rows.map(r => {
    const pct = total ? Math.round(r.count / total * 100) : 0
    return (
      <div key={r.key} style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
          <span style={{ fontWeight: 600 }}>{r.label}</span>
          <span style={{ color: 'var(--text-muted)' }}>{r.count} · {pct} %</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,.06)' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: CATEGORY_COLORS[r.key] ?? '#94a3b8' }} />
        </div>
      </div>
    )
  })
}

function CoursesPart(props) {
  const { data, days, setDays, Section, isMobile } = props
  const t = data.ordersToday
  const c = data.cancelReasons
  const sum = rows => rows.reduce((s, r) => s + r.count, 0)
  const delayRows = [
    ['Création → acceptation', 'toAccept'],
    ['Acceptation → retrait', 'toPickup'],
    ['Retrait → livraison', 'toDeliver'],
  ]
  const hours = data.peakHours.filter(h => h.hour >= 6) // 6 h – 23 h : la nuit reste vide
  return (<>
    <Section title="Motifs d'annulation" hint="Regroupés : pas de coursier, client, coursier, adresse fausse, doublon, autre" right={<DaysToggle days={days} setDays={setDays} />}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
        <div style={card}>
          <h3 style={cardTitle}>Aujourd'hui · {t.cancelled} annulée{t.cancelled > 1 ? 's' : ''} sur {t.created}{t.cancelRate != null ? ` (${t.cancelRate.toLocaleString('fr-FR')} %)` : ''}</h3>
          <ReasonBars rows={c.today} total={sum(c.today)} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            {t.cancelledWithoutCourier} sans jamais avoir eu de coursier · {t.manualDispatch} course{t.manualDispatch > 1 ? 's' : ''} attribuée{t.manualDispatch > 1 ? 's' : ''} ou proposée{t.manualDispatch > 1 ? 's' : ''} à la main (dont {t.manualDispatchByViewer} par vous)
            {t.createdByAdmin != null && <> · {t.createdByAdmin} saisie{t.createdByAdmin > 1 ? 's' : ''} pour un client (dont {t.createdByViewer} par vous)</>}
          </div>
        </div>
        <div style={card}>
          <h3 style={cardTitle}>{days} derniers jours · {c.periodTotal} annulée{c.periodTotal > 1 ? 's' : ''}</h3>
          <ReasonBars rows={c.period} total={c.periodTotal} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{c.periodWithoutCourier} sans jamais avoir eu de coursier</div>
        </div>
      </div>
    </Section>

    <Section title="Délais" hint="Temps moyen par étape de la course">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>
        {delayRows.map(([label, key]) => (
          <div key={key} style={card}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><PackageCheck size={13} /> {label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{fmtMin(data.delays.today[key])}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              aujourd'hui ({data.delays.today[key].count}) · {days} j : {fmtMin(data.delays.period[key])} ({data.delays.period[key].count})
            </div>
          </div>
        ))}
      </div>
    </Section>

    <Section title="Heures de pointe" hint={`Moyenne par jour sur ${days} jours · courses demandées et coursiers en ligne en même temps`} right={<DaysToggle days={days} setDays={setDays} />}>
      <div style={card}>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={hours} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="hour" tickFormatter={h => `${h}h`} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              labelFormatter={h => `${h}h – ${h + 1}h`}
              formatter={(v, name) => [String(v).replace('.', ','), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="ordersPerDay" name="Courses demandées / jour" fill="#0077b6" radius={[3, 3, 0, 0]} />
            <Line dataKey="onlineDriversAvg" name="Coursiers en ligne (moyenne)" stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line dataKey="noCourierCancels" name={`Annulées faute de coursier (${days} j)`} stroke="#dc2626" strokeWidth={2} dot={false} strokeDasharray="4 3" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Section>
  </>)
}

export default function FleetSections({ part, analytics, Section, isMobile }) {
  const { data, failed, days, setDays } = analytics
  if (failed && !data) return null // serveur pas encore à jour
  if (!data) return null
  return part === 'drivers'
    ? <DriversPart data={data} Section={Section} isMobile={isMobile} />
    : <CoursesPart data={data} days={days} setDays={setDays} Section={Section} isMobile={isMobile} />
}

const card      = { ...glass, padding: '14px 16px', minWidth: 0 }
const cardTitle = { fontSize: 13, fontWeight: 600, marginBottom: 10, marginTop: 0 }
const empty     = { fontSize: 12.5, color: 'var(--text-muted)', padding: '6px 0' }
