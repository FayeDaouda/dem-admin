import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronDown, ChevronUp, AlertTriangle, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useAuth } from '../contexts/AuthContext'
import { canSee, ACTION_ROLES } from '../lib/droits'
import PageHeader from '../components/PageHeader'
import ProReferralCounter from './ProReferralCounter'
import InfoTip from '../components/InfoTip'

// Au-delà de ce nombre de filleuls, un parrain est signalé « à vérifier ».
const SUSPICIOUS_COUNT = 8

const SORTS = [
  { key: '',       label: 'Plus de filleuls d’abord' },
  { key: 'recent', label: 'Derniers filleuls inscrits d’abord' },
]

const StatBox = ({ label, value, color }) => (
  <div style={{ ...glass, padding: '14px 16px', flex: '1 1 160px' }}>
    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '.5px', marginBottom: 4, textTransform: 'uppercase' }}>{label}<InfoTip k={label} size={12} /></div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</div>
  </div>
)

// Date d'inscription du filleul le plus récent d'un parrain (filleuls renvoyés du plus
// récent au plus ancien par le serveur).
const lastReferralAt = r => Math.max(0, ...(r.referrals ?? []).map(f => (f.createdAt ? new Date(f.createdAt).getTime() : 0)))
const fmtDate = d => (d ? new Date(d).toLocaleDateString('fr-FR') : '—')

export default function Parrainage() {
  const { user } = useAuth()
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  // Recherche et tri gardés dans l'adresse.
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const sort   = SORTS.some(s => s.key === params.get('tri')) ? params.get('tri') : ''
  function setParam(key, value) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await api.get('/admin/acquisition/referrals')
      setData(r.data)
    } catch { /* silencieux */ }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))

  const total         = data?.totalReferrals ?? 0
  const bonusRecorded = data?.bonusRecorded ?? 0
  const q = search.trim().toLowerCase()
  const referrers = (data?.referrers ?? [])
    .filter(r => !q || r.name?.toLowerCase().includes(q) || r.phone?.includes(q) || r.referralCode?.toLowerCase().includes(q))
  const sorted = sort === 'recent' ? [...referrers].sort((a, b) => lastReferralAt(b) - lastReferralAt(a)) : referrers

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Parrainage"
        subtitle="Parrainages des clients. Ceux des commerçants DEM Pro se gèrent dans DEM Pro › Parrainage."
        actions={<button onClick={() => load()} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14, flexShrink: 0 }}>
        <StatBox label="Total parrainages" value={total} />
        <StatBox label="Parrains (au moins 1 filleul)" value={data?.referrers?.length ?? 0} color="#22c55e" />
        {/* Aucun crédit de parrainage n'est versé dans l'app — l'ancien chiffre était 20 % de toutes les commissions */}
        <StatBox label="Bonus promis (non versés)" value={`${bonusRecorded.toLocaleString('fr-FR')} F`} color="#f59e0b" />
        {canSee(user?.adminRole, ACTION_ROLES.proReferralCounter) && <ProReferralCounter />}
      </div>

      {/* Recherche + tri */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 320px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            placeholder="Nom, téléphone ou code du parrain…"
            value={search}
            onChange={e => setParam('q', e.target.value)}
            style={{ ...glassInput, paddingLeft: 36, width: '100%', boxSizing: 'border-box' }}
          />
        </div>
        <select value={sort} onChange={e => setParam('tri', e.target.value)} style={{ ...glassInput, width: 240 }}>
          {SORTS.map(s => <option key={s.key || 'count'} value={s.key}>{s.label}</option>)}
        </select>
        {!loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sorted.length} parrain{sorted.length !== 1 ? 's' : ''}</span>}
      </div>

      <div style={pageScroll}>
        <div style={{ ...glass, padding: '6px 16px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>Chargement…</div>
          ) : sorted.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>Aucun parrainage enregistré{q ? ' pour cette recherche' : ''}.</div>
          ) : sorted.map(r => {
            const isOpen = expanded === r.id
            const referred = r.referrals ?? []
            const suspicious = r.referralCount > SUSPICIOUS_COUNT
            return (
              <div key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <div onClick={() => setExpanded(isOpen ? null : r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', flexWrap: 'wrap' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,180,216,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: 'var(--primary)', fontSize: 14, flexShrink: 0 }}>
                    {(r.name ?? '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.name ?? '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.phone} · Code <strong style={{ color: 'var(--text)' }}>{r.referralCode ?? '—'}</strong></div>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dernier filleul inscrit le {fmtDate(lastReferralAt(r) || null)}</span>
                  {suspicious && (
                    <span title={`Plus de ${SUSPICIOUS_COUNT} filleuls`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(239,68,68,.10)', color: '#dc2626' }}>
                      <AlertTriangle size={12} /> À vérifier
                    </span>
                  )}
                  <span style={{ padding: '3px 12px', borderRadius: 20, background: 'rgba(0,180,216,.10)', color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>
                    {r.referralCount} filleul{r.referralCount !== 1 ? 's' : ''}
                  </span>
                  <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </div>

                {isOpen && referred.length > 0 && (
                  <div style={{ margin: '0 0 12px 48px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {referred.map(f => (
                      <div key={f.id} style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 140 }}>{f.name ?? '—'}</span>
                        <span>{f.phone}</span>
                        <span>inscrit le {fmtDate(f.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
