import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, UserPlus, Bike, Briefcase, UserCog, Phone } from 'lucide-react'
import StatCard from '../components/StatCard'
import { glass, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

const PERIODS = [
  ['week',        'Semaine (7j)'],
  ['month',       'Mois'],
  ['threeMonths', '3 mois'],
  ['sixMonths',   '6 mois'],
]

const CATEGORIES = [
  ['CLIENT',         'newClients',        'Nouveaux clients',          UserPlus, '#06b6d4'],
  ['DRIVER',         'newDrivers',        'Nouveaux livreurs',         Bike,     '#6366f1'],
  ['DEM_PRO',        'newDemPro',         'Nouveaux DEM Pro',          Briefcase, '#7c3aed'],
  ['CHEF_DE_FLOTTE', 'newChefsDeFlotte',  'Nouveaux chefs de flotte',  UserCog,  '#B8860B'],
]

export default function NewProfiles() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod]   = useState('week')
  const [openRole, setOpenRole] = useState(null)
  const [list, setList]         = useState(null)
  const [listLoading, setListLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/marketing/acquisition')
      setData(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const loadList = useCallback(async (role, p) => {
    setListLoading(true)
    try {
      const res = await api.get('/admin/marketing/new-profiles', { params: { role, period: p } })
      setList(res.data)
    } catch (e) {
      console.error(e)
      setList(null)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (openRole) loadList(openRole, period)
  }, [openRole, period, loadList])

  const v = (bucket) => loading ? '…' : bucket?.[period] ?? 0

  function toggle(role) {
    setOpenRole(r => r === role ? null : role)
  }

  const activeCategory = CATEGORIES.find(([role]) => role === openRole)

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Nouveaux profils</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Nouvelles inscriptions par catégorie de compte.
          </p>
        </div>
        <button onClick={fetch} style={btnOutline}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', flexShrink: 0 }}>
        {PERIODS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            style={{
              padding: '6px 16px', borderRadius: 20,
              border: '1px solid rgba(0,119,182,.25)',
              background: period === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: period === key ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={pageScroll}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
          {CATEGORIES.map(([role, statKey, label, Icon, color]) => (
            <StatCard
              key={role}
              icon={Icon}
              label={label}
              value={v(data?.[statKey])}
              color={color}
              onClick={() => toggle(role)}
            />
          ))}
        </div>

        {activeCategory && (
          <div style={{ ...glass, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{activeCategory[2]}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {listLoading ? 'Chargement…' : `${list?.total ?? 0} résultat${(list?.total ?? 0) !== 1 ? 's' : ''}`}
              </div>
            </div>

            {listLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
            ) : !list?.users?.length ? (
              <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun nouveau profil sur cette période.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    {['Nom', 'Téléphone', 'Email', 'Inscrit le'].map((h, i) => (
                      <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, ...stickyCol, fontWeight: 600 }}>
                        {u.proBusinessName || u.companyName || u.name || '—'}
                        {(u.proBusinessName || u.companyName) && u.name && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{u.name}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {u.phone ? <a href={`tel:${u.phone}`} style={{ color: '#0077b6', display: 'flex', alignItems: 'center', gap: 5 }}><Phone size={12} />{u.phone}</a> : '—'}
                      </td>
                      <td style={tdStyle}>{u.email ?? '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                        {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
