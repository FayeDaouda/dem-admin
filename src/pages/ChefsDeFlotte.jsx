import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, Plus, Search, CheckCircle } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import ChefFormModal from './chefs/ChefFormModal'
import { chefStatusInfo } from './chefs/chefStatus'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useUrlQuery } from '../lib/useUrlQuery'

// Vues de la liste. « Actifs » = validé ET non suspendu (même règle que
// l'ancienne carte « Chefs actifs ») ; les suspendus ont leur propre vue.
const VIEWS = [
  { key: '',          label: 'Tous',       test: () => true },
  { key: 'PENDING',   label: 'En attente', test: c => c.chefDeFlotteStatus === 'PENDING' },
  { key: 'ACTIVE',    label: 'Actifs',     test: c => c.chefDeFlotteStatus === 'ACTIVE' && c.isActive },
  { key: 'SUSPENDED', label: 'Suspendus',  test: c => !c.isActive },
  { key: 'REJECTED',  label: 'Refusés',    test: c => c.chefDeFlotteStatus === 'REJECTED' },
]

function FleetGauge({ count, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 70 }}>
      <span style={{ fontWeight: 600 }}>{count}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> / {max ?? '—'}</span></span>
      <span style={{ height: 4, borderRadius: 2, background: 'rgba(0,119,182,.12)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: pct >= 100 ? '#f59e0b' : 'var(--primary)' }} />
      </span>
    </div>
  )
}

export default function ChefsDeFlotte() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const canCreate = canSee(user?.adminRole, ACTION_ROLES.chefManage)

  // Vue, tri et recherche gardés dans l'adresse.
  const [params, setParams] = useSearchParams()
  const status   = VIEWS.some(v => v.key === params.get('statut')) ? params.get('statut') : ''
  const sortDate = ['desc', 'asc'].includes(params.get('tri')) ? params.get('tri') : null
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  useUrlQuery(setSearch)

  function setParam(changes) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      setParams(prev => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      }, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [search, setParams])

  const [chefs, setChefs]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [creating, setCreating] = useState(false)
  // Message après une suppression faite depuis la fiche (renvoyé à la liste).
  const [notice, setNotice]     = useState(location.state?.notice ?? '')

  useEffect(() => {
    // Message lu une fois : un rechargement ne le réaffiche pas.
    if (location.state?.notice) navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/chefs-de-flotte', { params: { status: 'all' } })
      setChefs(Array.isArray(res.data?.chefs) ? res.data.chefs : [])
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])
  useAutoRefresh(() => fetch(true))

  const q = search.trim().toLowerCase()
  const bySearch = chefs.filter(c => !q
    || (c.name ?? '').toLowerCase().includes(q)
    || (c.phone ?? '').includes(q)
    || (c.companyName ?? '').toLowerCase().includes(q))
  const filtered = bySearch.filter(VIEWS.find(v => v.key === status).test)
  const sorted = sortDate
    ? [...filtered].sort((a, b) => {
        const diff = new Date(a.createdAt) - new Date(b.createdAt)
        return sortDate === 'asc' ? diff : -diff
      })
    : filtered
  const counts = Object.fromEntries(VIEWS.map(v => [v.key, bySearch.filter(v.test).length]))
  const activeCount  = chefs.filter(VIEWS[2].test).length
  const totalDrivers = chefs.reduce((s, c) => s + (c._count?.managedDrivers ?? 0), 0)

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Chefs de flotte"
        subtitle={`${chefs.length} chef${chefs.length !== 1 ? 's' : ''} · ${activeCount} actif${activeCount !== 1 ? 's' : ''} · ${totalDrivers} coursier${totalDrivers !== 1 ? 's' : ''} gérés`}
        actions={<>
          <button onClick={() => fetch()} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {canCreate && <button onClick={() => setCreating(true)} style={btnPrimary}><Plus size={14} /> Nouveau</button>}
        </>}
      />

      {/* Recherche + vues */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, société ou téléphone…" style={{ ...glassInput, paddingLeft: 36, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {VIEWS.map(v => {
            const active = status === v.key
            return (
              <button key={v.key || 'all'} onClick={() => setParam({ statut: v.key })} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>
                {v.label}<span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[v.key]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {notice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 10, flexShrink: 0 }}>
          <CheckCircle size={14} /> {notice}
        </div>
      )}

      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : sorted.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun chef de flotte{status || q ? ' pour ce filtre' : ''}.</div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Chef de flotte', 'Téléphone', 'Flotte', 'Statut', 'Inscription'].map((h, i) => (
                  <th
                    key={h}
                    style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh), ...(h === 'Inscription' ? { cursor: 'pointer', userSelect: 'none' } : {}) }}
                    onClick={h === 'Inscription' ? () => setParam({ tri: sortDate === 'desc' ? 'asc' : sortDate === 'asc' ? '' : 'desc' }) : undefined}
                    title={h === 'Inscription' ? 'Trier par date d\'inscription' : undefined}
                  >
                    {h}{h === 'Inscription' && (sortDate === 'desc' ? ' ▼' : sortDate === 'asc' ? ' ▲' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => {
                const st = chefStatusInfo(c)
                return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate(`/chefs-de-flotte/${c.id}`)} title="Ouvrir la fiche">
                  <td style={{ ...tdStyle, ...stickyCol }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13, flexShrink: 0 }}>
                        {c.avatar ? <img src={c.avatar} alt="" style={{ width: 34, height: 34, objectFit: 'cover' }} /> : (c.companyName?.trim() || c.name?.trim() || c.phone || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.companyName?.trim() || c.name?.trim() || '—'}</div>
                        {c.companyName?.trim() && c.name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.name}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>{c.phone ?? '—'}</td>
                  <td style={tdStyle}><FleetGauge count={c._count?.managedDrivers ?? 0} max={c.fleetMaxSize} /></td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>{st.text}</span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {creating && (
        <ChefFormModal
          initial={null}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); fetch(true); setNotice('Chef de flotte créé.') }}
        />
      )}
    </div>
  )
}

const card       = { ...glass, padding: '12px 16px' }
const tableStyle = { width: '100%', minWidth: 640, borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '9px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
