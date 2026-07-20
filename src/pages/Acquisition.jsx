import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import {
  Zap, Users, GitBranch, DollarSign, Award, Truck,
  ToggleLeft, ToggleRight, Play, RefreshCw, CheckCircle, Circle,
} from 'lucide-react'

const TAB_STYLE = (active) => ({
  padding: '8px 18px',
  borderRadius: 'var(--radius-sm)',
  border: 'none',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500,
  fontSize: 13,
  cursor: 'pointer',
  transition: 'all .15s',
})

const TABS = [
  { id: 'forfait',        label: 'Pass',             icon: Zap },
  { id: 'clients',        label: '100 Clients',      icon: Users },
  { id: 'fees',           label: 'Frais',            icon: DollarSign },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{ ...glass, padding: '20px 24px', ...style }}>{children}</div>
)

const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.6px', marginBottom: 8, textTransform: 'uppercase' }}>
    {children}
  </div>
)

const StatBox = ({ label, value, color }) => (
  <div style={{ ...glass, padding: '14px 16px', flex: '1 1 140px' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
  </div>
)

const Snack = ({ msg, ok }) => (
  <div style={{
    position: 'fixed', bottom: 28, right: 28, zIndex: 999,
    background: ok ? '#22c55e' : '#ef4444',
    color: '#fff', padding: '10px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13,
    boxShadow: '0 4px 20px rgba(0,0,0,.18)',
  }}>{msg}</div>
)

// ─────────────────────────────────────────────────────────────────────────────
export default function Acquisition() {
  const [tab, setTab] = useState('forfait')
  const [snack, setSnack] = useState(null)

  function notify(msg, ok = true) {
    setSnack({ msg, ok })
    setTimeout(() => setSnack(null), 3000)
  }

  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Plan d'acquisition</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Gestion du forfait, offre 100 clients, chefs de flotte et grille des frais.
        </p>
      </div>

      {/* TabBar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', flexShrink: 0 }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={TAB_STYLE(tab === id)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon size={14} />{label}
            </span>
          </button>
        ))}
      </div>

      <div style={pageScroll}>
        {tab === 'forfait'        && <PassTab notify={notify} />}
        {tab === 'clients'        && <ClientsTab notify={notify} />}
        {tab === 'fees'           && <FeesTab />}
      </div>

      {snack && <Snack msg={snack.msg} ok={snack.ok} />}
    </div>
  )
}

// ── Tab Pass ───────────────────────────────────────────────────────────────
function PassTab({ notify }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [amount,  setAmount]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [processing, setProcessing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [summary, cfg] = await Promise.all([
        api.get('/admin/forfait/summary'),
        api.get('/admin/config'),
      ])
      const map = Object.fromEntries((cfg.data ?? []).map(r => [r.key, r.value]))
      setData({
        ...summary.data,
        active:   map['forfait_active'] === 'true',
        amount:   Number(map['forfait_amount'] ?? 480),
        amountM3: Number(map['forfait_amount_m3'] ?? 650),
      })
      setAmount(map['forfait_amount'] ?? '480')
    } catch { /* silencieux */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleActive() {
    try {
      await api.put('/admin/forfait/config', { active: !data.active })
      notify(data.active ? 'Pass désactivé' : 'Pass activé ✓', !data.active)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
  }

  async function saveAmount(val) {
    const n = Number(val ?? amount)
    if (isNaN(n) || n < 0) return
    setSaving(true)
    try {
      await api.put('/admin/forfait/config', { amount: n })
      notify(`Montant mis à jour : ${n} FCFA/jour ✓`)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
    setSaving(false)
  }

  async function processPass() {
    if (!window.confirm('Déclencher le prélèvement du jour pour tous les livreurs actifs ?')) return
    setProcessing(true)
    try {
      const res = await api.post('/admin/forfait/process')
      notify(`${res.data.charged} livreur(s) prélevé(s) ✓`)
      load()
    } catch (e) { notify(e.response?.data?.message ?? 'Erreur', false) }
    setProcessing(false)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const active     = data?.active ?? false
  const totalOwed  = data?.totalOwed ?? 0
  const records    = data?.recordCount ?? 0
  const drivers    = data?.driverCount ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>

      {/* Toggle ON/OFF */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Label>Activation du forfait</Label>
            <div style={{ fontSize: 13, color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
              {active ? `Actif — ${data.amount} FCFA/jour` : 'Inactif — aucun prélèvement'}
            </div>
          </div>
          <button onClick={toggleActive} style={{ background: 'none', border: 'none', cursor: 'pointer', color: active ? 'var(--primary)' : 'var(--text-muted)' }}>
            {active ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#f59e0b', background: 'rgba(245,158,11,.08)', padding: '6px 10px', borderRadius: 6 }}>
          ⚠ Toute modification s'applique au prochain prélèvement (jour suivant)
        </div>
      </Card>

      {/* Modifier le montant */}
      <Card>
        <Label>Montant journalier (FCFA)</Label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ ...glassInput, width: 130, fontWeight: 700, fontSize: 16 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>FCFA / jour</span>
          <button
            onClick={() => saveAmount()}
            disabled={saving}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: 'var(--primary)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {saving ? '…' : 'Sauver'}
          </button>
        </div>
        {/* Boutons rapides */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['480 FCFA (S4)', 480], ['650 FCFA (M3)', 650], ['Promo 0 FCFA', 0], ['Promo 200 FCFA', 200]].map(([label, val]) => (
            <button key={val} onClick={() => { setAmount(String(val)); saveAmount(val) }}
              style={{
                padding: '5px 12px', borderRadius: 6,
                border: '1px solid rgba(0,180,216,.35)',
                background: 'rgba(0,180,216,.07)', color: 'var(--primary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      {/* Résumé */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatBox label="Total dû" value={`${totalOwed.toLocaleString()} F`} color={totalOwed > 0 ? '#ef4444' : '#22c55e'} />
        <StatBox label="Enregistrements" value={records} />
        <StatBox label="Livreurs concernés" value={drivers} />
      </div>

      {/* Déclenchement manuel */}
      <Card>
        <Label>Déclenchement manuel</Label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          Le prélèvement automatique se fait à minuit (Dakar). Utilisez ce bouton en cas d'urgence ou de test.
        </p>
        <button
          onClick={processPass}
          disabled={processing || !active}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: active ? 'var(--primary)' : 'var(--surface2)',
            color: active ? '#fff' : 'var(--text-muted)',
            fontWeight: 700, fontSize: 13, cursor: active ? 'pointer' : 'default',
          }}
        >
          {processing ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={15} />}
          {processing ? 'Traitement…' : 'Déclencher le prélèvement du jour'}
        </button>
      </Card>
    </div>
  )
}

// ── Tab 100 Clients ───────────────────────────────────────────────────────────
function ClientsTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    api.get('/admin/acquisition/free-course')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const slots     = data?.slots ?? 100
  const filled    = data?.filled ?? 0
  const remaining = data?.remaining ?? 100
  const used      = data?.usedCount ?? 0
  const clients   = (data?.clients ?? []).filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const pct = Math.round(filled / slots * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Compteur */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatBox label="Places occupées" value={`${filled} / ${slots}`} />
        <StatBox label="Restantes" value={remaining} color={remaining > 10 ? '#22c55e' : '#ef4444'} />
        <StatBox label="Offre utilisée" value={used} color="var(--primary)" />
      </div>

      {/* Progress bar */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Remplissage des 100 places</span>
          <span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
        </div>
        <div style={{ height: 10, background: 'rgba(0,0,0,.08)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 10, transition: 'width .4s',
            width: `${pct}%`,
            background: filled >= slots ? '#ef4444' : 'var(--primary)',
          }} />
        </div>
      </Card>

      {/* Recherche */}
      <input
        placeholder="Rechercher par nom ou téléphone…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...glassInput, maxWidth: 340 }}
      />

      {/* Liste */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(0,119,182,.06)' }}>
              {['#', 'Nom', 'Téléphone', 'Commandes', 'Offre'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => (
              <tr key={c.id} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,.05)' }}>
                <td style={{ padding: '9px 14px', color: 'var(--text-muted)', fontWeight: 700 }}>{c.rank}</td>
                <td style={{ padding: '9px 14px', fontWeight: 600 }}>{c.name || '—'}</td>
                <td style={{ padding: '9px 14px', color: 'var(--text-muted)' }}>{c.phone}</td>
                <td style={{ padding: '9px 14px' }}>{c.totalOrders}</td>
                <td style={{ padding: '9px 14px' }}>
                  {c.usedOffer
                    ? <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 12 }}>🎁 Utilisée</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Non utilisée</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Aucun résultat</div>
        )}
      </Card>
    </div>
  )
}

// ── Tab Parrainage ────────────────────────────────────────────────────────────
function ReferralsTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/admin/acquisition/referrals')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const total   = data?.totalReferrals ?? 0
  const credits = data?.totalCreditsDistributed ?? 0
  const referrers = (data?.referrers ?? []).filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatBox label="Total parrainages" value={total} />
        <StatBox label="Crédits MLM distribués" value={`${credits.toLocaleString()} F`} color="var(--primary)" />
      </div>

      <input
        placeholder="Rechercher un parrain…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...glassInput, maxWidth: 340 }}
      />

      {referrers.length === 0
        ? <div style={{ color: 'var(--text-muted)' }}>Aucun parrainage enregistré.</div>
        : referrers.map(r => {
          const isOpen = expanded === r.id
          const referred = r.referrals ?? []
          return (
            <Card key={r.id} style={{ padding: '14px 18px' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : r.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'rgba(0,180,216,.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, color: 'var(--primary)', fontSize: 14,
                }}>
                  {(r.name ?? '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.phone} · Code : {r.referralCode}</div>
                </div>
                <div style={{
                  padding: '4px 12px', borderRadius: 20,
                  background: 'rgba(0,180,216,.10)',
                  color: 'var(--primary)', fontWeight: 700, fontSize: 13,
                }}>
                  {r.referralCount} filleul{r.referralCount !== 1 ? 's' : ''}
                </div>
                {r.referralCount > 8 && (
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠ Vérifier</span>
                )}
              </div>

              {/* Filleuls dépliés */}
              {isOpen && referred.length > 0 && (
                <div style={{ marginTop: 12, paddingLeft: 50, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {referred.map(f => (
                    <div key={f.id} style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>↳</span>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{f.name ?? '—'}</span>
                      <span>{f.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )
        })
      }
    </div>
  )
}

// ── Tab Chefs de flotte ────────────────────────────────────────────────────────
function AmbassadeursTab() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/ambassadors')
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const ambassadors = data?.ambassadors ?? []
  const totalDrivers    = ambassadors.reduce((s, a) => s + a.referredCount, 0)
  const totalDelivered  = ambassadors.reduce((s, a) => s + a.totalDelivered, 0)

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats globales */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatBox label="Chefs de flotte actifs"  value={ambassadors.length}           color="#B8860B" />
        <StatBox label="Livreurs recrutés"        value={totalDrivers}                 color="var(--primary)" />
        <StatBox label="Courses livrées (réseau)" value={totalDelivered.toLocaleString()} color="var(--success)" />
      </div>

      {ambassadors.length === 0 ? (
        <Card>
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0', fontSize: 13 }}>
            Aucun chef de flotte actif pour le moment.
          </div>
        </Card>
      ) : ambassadors.map(a => {
        const isOpen  = expanded === a.id
        const drivers = a.referredDrivers ?? []

        return (
          <Card key={a.id} style={{ padding: '14px 18px' }}>
            {/* En-tête chef de flotte */}
            <div
              onClick={() => setExpanded(isOpen ? null : a.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
            >
              {/* Avatar */}
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#FFF8E1,#FFD700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#B8860B', fontSize: 15,
              }}>
                {(a.name ?? '?')[0].toUpperCase()}
              </div>

              {/* Infos */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.name ?? '—'}</span>
                  <span style={{ background: '#FFF8E1', color: '#B8860B', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>
                    🏅 Chef de flotte
                  </span>
                  {!a.isActive && (
                    <span style={{ background: '#fee2e2', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20 }}>
                      Suspendu
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {a.phone} · Code : <code style={{ background: 'rgba(0,0,0,.05)', padding: '0 4px', borderRadius: 4 }}>{a.referralCode}</code>
                </div>
              </div>

              {/* Stats résumé */}
              <div style={{ display: 'flex', gap: 16, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{a.referredCount}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>recrutés</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>{a.activeReferrals}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>actifs</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{a.totalDelivered}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>courses</div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: '42px' }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>
            </div>

            {/* Tableau des drivers filleuls */}
            {isOpen && (
              <div style={{ marginTop: 16, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 14 }}>
                <Label>Livreurs recrutés par {a.name}</Label>
                {drivers.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun livreur recruté pour l'instant.</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Livreur', 'Véhicule', 'Statut', 'Courses livrées', 'Rejoint le'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(0,0,0,.07)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map(d => (
                        <tr key={d.id} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                          <td style={{ padding: '9px 8px', fontWeight: 600 }}>{d.name ?? '—'}</td>
                          <td style={{ padding: '9px 8px', color: 'var(--text-muted)' }}>{d.vehicleType ?? '—'}</td>
                          <td style={{ padding: '9px 8px' }}>
                            {d.isActive
                              ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Actif</span>
                              : <span style={{ color: 'var(--danger)' }}>Suspendu</span>}
                          </td>
                          <td style={{ padding: '9px 8px', fontWeight: 700, color: 'var(--primary)' }}>
                            {d.deliveredCourses}
                          </td>
                          <td style={{ padding: '9px 8px', color: 'var(--text-muted)', fontSize: 12 }}>
                            {new Date(d.joinedAt).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// ── Tab Frais ─────────────────────────────────────────────────────────────────
function FeesTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/acquisition/fees')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>

  const grid  = data?.grid ?? []
  const total = data?.totalFeesCollected ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      <StatBox label="Total frais collectés depuis le lancement" value={`${total.toLocaleString()} FCFA`} color="var(--primary)" />

      <Card>
        <Label>Grille tarifaire DEM</Label>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          Appliquée automatiquement à chaque commande. Frais non prélevés sur la part du livreur.
        </p>

        {/* En-tête */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(0,0,0,.07)', marginBottom: 4 }}>
          {['Tranche (FCFA)', 'Frais DEM', 'Volume réel'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.5px' }}>{h}</div>
          ))}
        </div>

        {grid.map((tier, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 8,
            padding: '9px 0',
            borderBottom: i < grid.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>{tier.min.toLocaleString()} — {tier.max.toLocaleString()}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--primary)' }}>{tier.fee} F</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                height: 6, borderRadius: 6,
                background: 'var(--primary)',
                width: `${Math.max(tier.pct, 2)}%`,
                maxWidth: '60%',
                opacity: .7,
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tier.count} ({tier.pct}%)</span>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(0,180,216,.06)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          Frais moyen pondéré : ~120 FCFA · Net MLM (–20%) : ~96 FCFA/course
        </div>
      </Card>
    </div>
  )
}

// ── Tab Badges Clients ────────────────────────────────────────────────────────

const BADGE_VISUALS = {
  vip:     { emoji: '💎', color: '#7c3aed', bg: 'rgba(124,58,237,.10)',  name: 'DEM VIP' },
  buur:    { emoji: '👑', color: '#7B1FA2', bg: 'rgba(123,31,162,.10)',  name: 'DEM Buur' },
  djambar: { emoji: '🏆', color: '#1565C0', bg: 'rgba(21,101,192,.10)',  name: 'DEM Djambar' },
  mbokk:   { emoji: '⭐', color: '#00695C', bg: 'rgba(0,105,92,.10)',    name: 'DEM Mbokk' },
  xarit:   { emoji: '🤝', color: '#0288D1', bg: 'rgba(2,136,209,.10)',   name: 'DEM Xarit' },
  classic: { emoji: '✅', color: '#00838F', bg: 'rgba(0,131,143,.10)',   name: 'DEM Classic' },
}

function BadgesTab() {
  const [stats,    setStats]    = useState(null)
  const [referrers, setReferrers] = useState([])
  const [tiers,    setTiers]    = useState([])
  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [validating, setValidating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r, t, p] = await Promise.all([
        api.get('/admin/client-badges/stats'),
        api.get('/admin/client-badges/top-referrers'),
        api.get('/admin/client-badges/tiers'),
        api.get('/admin/clients', { params: { needsBadgeValidation: true } }).catch(() => ({ data: { clients: [] } })),
      ])
      setStats(s.data)
      setReferrers(r.data.referrers ?? [])
      setTiers(t.data.tiers ?? [])
      // Pending validation = clients who reached mbokk+ but not yet validated
      const allClients = p.data.clients ?? []
      setPending(allClients.filter(c => ['mbokk','djambar','buur','vip'].includes(c.clientBadge) && !c.clientBadgeValidated))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function validate(clientId) {
    setValidating(clientId)
    try {
      await api.patch(`/admin/clients/${clientId}/badge/validate`)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur') }
    finally { setValidating(null) }
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement…</div>

  const total = stats?.total ?? 0
  const dist  = stats?.distribution ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Distribution */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Distribution des badges</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(BADGE_VISUALS).map(([id, v]) => {
            const count = dist.find(d => d.badge === id)?._count ?? dist.find(d => d.badge === id)?.count ?? 0
            const pct   = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={id} style={{ flex: '1 1 140px', background: v.bg, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{v.emoji}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: v.color }}>{v.name}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 800, color: v.color }}>{count}</div>
                <div style={{ height: 4, borderRadius: 4, background: 'rgba(0,0,0,.08)', marginTop: 6 }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${pct}%`, background: v.color, transition: 'width .4s' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{pct}% des clients</div>
              </div>
            )
          })}
          <div style={{ flex: '1 1 140px', background: 'var(--surface2)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>Sans badge</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-muted)' }}>
              {total - dist.reduce((s, d) => s + (d.count ?? d._count ?? 0), 0)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 14 }}>Nouveau ou 0 course</div>
          </div>
        </div>
      </Card>

      {/* Validations en attente (Mbokk+) */}
      {pending.length > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Validations internes en attente</div>
            <span style={{ background: 'rgba(245,158,11,.15)', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{pending.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(c => {
              const v = BADGE_VISUALS[c.clientBadge] ?? {}
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <span style={{ fontSize: 18 }}>{v.emoji ?? '🎯'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone} · <span style={{ color: v.color, fontWeight: 700 }}>{v.name}</span></div>
                  </div>
                  <button
                    onClick={() => validate(c.id)}
                    disabled={validating === c.id}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#15803d', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: validating === c.id ? 0.5 : 1 }}
                  >
                    {validating === c.id ? '…' : '✓ Valider'}
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Top parrains */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>🏅 Top parrains (filleuls actifs)</div>
        {referrers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun parrainage validé.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['#', 'Client', 'Badge', 'Code parrain', 'Filleuls actifs'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,.10)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {referrers.slice(0, 20).map((r, i) => {
                const v = BADGE_VISUALS[r.clientBadge] ?? {}
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: i < 3 ? '#f59e0b' : 'var(--text-muted)', fontSize: 13 }}>#{i + 1}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.phone}</div>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {v.name
                        ? <span style={{ background: v.bg, color: v.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{v.emoji} {v.name}</span>
                        : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Sans badge</span>}
                    </td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{r.referralCode}</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{r.validReferralCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Conditions des tiers */}
      <Card>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>📋 Conditions des tiers</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tiers.map(tier => {
            const v = BADGE_VISUALS[tier.id] ?? {}
            return (
              <div key={tier.id} style={{ background: v.bg ?? 'var(--surface2)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{v.emoji ?? '🎯'}</span>
                  <span style={{ fontWeight: 700, fontSize: 14, color: v.color }}>{tier.name}</span>
                  {tier.requiresValidation && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(245,158,11,.20)', color: '#b45309' }}>validation admin</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' }}>
                  {Object.entries(tier.paths).map(([path, conds]) => (
                    <div key={path} style={{ background: 'rgba(255,255,255,.6)', borderRadius: 8, padding: '6px 10px', minWidth: 150 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, textTransform: 'capitalize', color: 'var(--text)' }}>
                        {path === 'commandeur' ? '⚔️ Commandeur' : path === 'parrain' ? '🤝 Parrain' : '⚖️ Équilibre'}
                      </div>
                      {conds.courses   > 0 && <div>🏍 {conds.courses} courses</div>}
                      {conds.referrals > 0 && <div>👥 {conds.referrals} filleuls</div>}
                      {conds.rating    > 0 && <div>⭐ note ≥ {conds.rating}</div>}
                      {conds.profileComplete && <div title="nom + email + ≥1 adresse favorite">📍 profil complet</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
