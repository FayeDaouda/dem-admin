import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Shield, Truck, Layers, AlertTriangle, Briefcase, ClipboardList, Wallet } from 'lucide-react'
import SuspendModal from '../components/SuspendModal'
import AmbassadorDetailModal from '../components/AmbassadorDetailModal'

// ── Styles partagés ───────────────────────────────────────────────────────────
const card      = { ...glass, padding: '18px 20px' }
const cardHighlight = { boxShadow: '0 0 0 2px var(--primary)' }
const btnAccept ={ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(34,197,94,.12)', color:'#15803d', fontWeight:700, fontSize:12, cursor:'pointer' }
const btnRefuse = { display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(239,68,68,.10)', color:'#dc2626', fontWeight:700, fontSize:12, cursor:'pointer' }
const btnDisabled = { ...{}, opacity: 0.45, cursor: 'not-allowed' }

const TAB = (active) => ({
  padding: '7px 18px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
  fontWeight: active ? 700 : 500, fontSize: 13,
})

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING:  { bg: 'rgba(245,158,11,.12)', color: '#b45309', label: 'En attente' },
    ACTIVE:   { bg: 'rgba(34,197,94,.12)',  color: '#15803d', label: 'Actif' },
    REJECTED: { bg: 'rgba(239,68,68,.10)',  color: '#dc2626', label: 'Refusé' },
    APPROVED: { bg: 'rgba(34,197,94,.12)',  color: '#15803d', label: 'Approuvé' },
  }
  const s = map[status] ?? { bg: '#f5f5f5', color: '#888', label: status ?? '—' }
  return (
    <span style={{ background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  )
}

// ── DocThumb : miniature cliquable ────────────────────────────────────────────
function DocThumb({ url, label }) {
  const [imgError, setImgError] = useState(false)

  if (!url) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <div style={{ width:58, height:58, borderRadius:10, background:'rgba(0,0,0,.04)', border:'1px dashed rgba(0,0,0,.12)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:18, opacity:.3 }}>—</span>
      </div>
      <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600, textAlign:'center' }}>{label}</span>
    </div>
  )

  return (
    <a href={url} target="_blank" rel="noreferrer" title={`Ouvrir ${label}`}
      style={{ textDecoration:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{
        width:58, height:58, borderRadius:10, overflow:'hidden',
        background:'rgba(0,180,216,.08)',
        border:'1.5px solid rgba(0,180,216,.25)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'transform .15s', cursor:'pointer',
      }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.06)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {!imgError
          ? <img src={url} alt={label} onError={() => setImgError(true)}
              style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:22 }}>📄</span>
        }
      </div>
      <span style={{ fontSize:10, color:'var(--primary)', fontWeight:700, textAlign:'center' }}>{label}</span>
    </a>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Validation() {
  const { user } = useAuth()
  const isServiceClient = user?.adminRole === 'SERVICE_CLIENT'
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(searchParams.get('tab') || 'ambassadors')
  const highlightId = searchParams.get('highlight') || null

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t) setTab(t)
  }, [searchParams])

  return (
    <div style={pageWrap}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, flexShrink: 0 }}>Validation</h1>
      <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(255,255,255,.45)', borderRadius:'var(--radius)', padding:4, width:'fit-content', flexShrink: 0 }}>
        <button style={TAB(tab === 'ambassadors')} onClick={() => setTab('ambassadors')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Shield size={13} />Chefs de flotte</span>
        </button>
        <button style={TAB(tab === 'drivers')} onClick={() => setTab('drivers')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Truck size={13} />Livreurs en attente</span>
        </button>
        <button style={TAB(tab === 'dem-pro')} onClick={() => setTab('dem-pro')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Briefcase size={13} />DEM Pro</span>
        </button>
        {!isServiceClient && (
          <>
            <button style={TAB(tab === 'fleet')} onClick={() => setTab('fleet')}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}><Layers size={13} />Extensions flotte</span>
            </button>
            <button style={TAB(tab === 'service-requests')} onClick={() => setTab('service-requests')}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}><ClipboardList size={13} />Demandes Service Client</span>
            </button>
            <button style={TAB(tab === 'finance-requests')} onClick={() => setTab('finance-requests')}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}><Wallet size={13} />Demandes Finance</span>
            </button>
          </>
        )}
      </div>
      <div style={pageScroll}>
        {tab === 'ambassadors'       && <AmbassadorsTab isServiceClient={isServiceClient} highlightId={highlightId} />}
        {tab === 'drivers'           && <DriversTab highlightId={highlightId} />}
        {tab === 'dem-pro'           && <DemProTab highlightId={highlightId} />}
        {!isServiceClient && tab === 'fleet'             && <FleetTab highlightId={highlightId} />}
        {!isServiceClient && tab === 'service-requests'  && <ServiceRequestsTab highlightId={highlightId} />}
        {!isServiceClient && tab === 'finance-requests'  && <FinanceRequestsTab highlightId={highlightId} />}
      </div>
    </div>
  )
}

// ── Tab Chefs de flotte ────────────────────────────────────────────────────────
function AmbassadorsTab({ isServiceClient, highlightId }) {
  const [list,     setList]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('PENDING')
  const [expanded,      setExpanded]      = useState(null)
  const [reason,        setReason]        = useState('')
  const [acting,        setActing]        = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspending,    setSuspending]    = useState(false)
  const [detailAmId,    setDetailAmId]    = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/chefs-de-flotte', { params: { status: filter } })
      setList(res.data.chefs ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || !list.some(am => am.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(id, approve) {
    if (!approve && !reason.trim()) { alert('Saisissez un motif de refus.'); return }
    setActing(id)
    try {
      await api.patch(`/admin/chefs-de-flotte/${id}/validate`, { approve, reason: reason.trim() || undefined })
      setReason('')
      setExpanded(null)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setActing(null) }
  }

  async function handleSuspendConfirm(reason, fix) {
    if (!suspendTarget) return
    setSuspending(true)
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    try {
      await api.patch(`/admin/chefs-de-flotte/${suspendTarget.id}/suspend`, { reason: fullReason })
      setSuspendTarget(null)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setSuspending(false) }
  }

  return (<>
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap' }}>
        {[['PENDING','En attente'],['ACTIVE','Actifs'],['REJECTED','Refusés'],['all','Tous']].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:'5px 14px', borderRadius:20, border:'1px solid rgba(0,119,182,.25)',
            background: filter===s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filter===s ? '#fff' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer',
          }}>{label}</button>
        ))}
        <button onClick={load} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(0,119,182,.2)', background:'rgba(255,255,255,.5)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {loading ? <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>Aucun chef de flotte.</div>
      : list.map(am => {
        const isOpen = expanded === am.id
        return (
          <div key={am.id} ref={el => { rowRefs.current[am.id] = el }} style={{ ...card, ...(am.id === highlightId ? cardHighlight : {}) }}>
            {/* Ligne résumé */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(0,180,216,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'var(--primary)', fontSize:15, flexShrink:0 }}>
                {(am.name ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{am.name ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {am.phone}
                  {am.companyName && <> · {am.companyName}</>}
                  <> · <strong>{am._count?.managedDrivers ?? 0}</strong> livreur(s)</>
                </div>
              </div>
              <StatusBadge status={am.chefDeFlotteStatus} />
              <button onClick={() => setDetailAmId(am.id)}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, border:'1px solid rgba(0,119,182,.25)', background:'rgba(255,255,255,.5)', color:'var(--primary)', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                Voir
              </button>
              <button onClick={() => { setExpanded(isOpen ? null : am.id); setReason('') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Détail dépliable */}
            {isOpen && (
              <div style={{ marginTop:16, borderTop:'1px solid rgba(0,0,0,.06)', paddingTop:14, display:'flex', flexDirection:'column', gap:14 }}>

                {/* Miniatures CNI */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'.4px', marginBottom:8 }}>PIÈCES D'IDENTITÉ</div>
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-start' }}>
                    <DocThumb url={am.cniRecto} label="CNI recto" />
                    <DocThumb url={am.cniVerso} label="CNI verso" />
                  </div>
                </div>

                {/* Infos entreprise */}
                {(am.ninea || am.rccm || am.companyName) && (
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12 }}>
                    {am.companyName && <span><strong>Entreprise :</strong> {am.companyName}</span>}
                    {am.ninea       && <span><strong>NINEA :</strong> {am.ninea}</span>}
                    {am.rccm        && <span><strong>RCCM :</strong> {am.rccm}</span>}
                  </div>
                )}

                {/* Actions PENDING */}
                {am.chefDeFlotteStatus === 'PENDING' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <input
                      placeholder="Motif de refus (obligatoire si refus)"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      style={{ ...glassInput, maxWidth:400 }}
                    />
                    <div style={{ display:'flex', gap:10 }}>
                      <button style={btnAccept} disabled={acting===am.id} onClick={() => handleValidate(am.id, true)}>
                        <CheckCircle size={13} /> Valider
                      </button>
                      <button style={btnRefuse} disabled={acting===am.id} onClick={() => handleValidate(am.id, false)}>
                        <XCircle size={13} /> Refuser
                      </button>
                    </div>
                  </div>
                )}

                {/* Action ACTIVE → Suspendre (SUPER uniquement — SC passe par "Demander suspension" sur la page Chefs de flotte) */}
                {am.chefDeFlotteStatus === 'ACTIVE' && !isServiceClient && (
                  <button style={{ ...btnRefuse, alignSelf:'flex-start' }} onClick={() => setSuspendTarget(am)}>
                    Suspendre (+ tous ses livreurs)
                  </button>
                )}

                {/* Motif refus */}
                {am.chefDeFlotteStatus === 'REJECTED' && am.rejectionReason && (
                  <div style={{ fontSize:12, color:'#dc2626', background:'rgba(239,68,68,.06)', padding:'8px 12px', borderRadius:8 }}>
                    <strong>Motif :</strong> {am.rejectionReason}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
    {suspendTarget && (
      <SuspendModal
        target="ambassador"
        onConfirm={handleSuspendConfirm}
        onClose={() => setSuspendTarget(null)}
        loading={suspending}
      />
    )}
    {detailAmId && (
      <AmbassadorDetailModal
        ambassadorId={detailAmId}
        onClose={() => setDetailAmId(null)}
      />
    )}
  </>)
}

// ── Tab Livreurs en attente ───────────────────────────────────────────────────
function DriversTab({ highlightId }) {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [reason,   setReason]   = useState('')
  const [acting,   setActing]   = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/drivers/pending')
      setList(res.data.drivers ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || !list.some(d => d.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(id, approve) {
    if (!approve && !reason.trim()) { alert('Saisissez un motif de refus.'); return }
    setActing(id)
    try {
      await api.patch(`/admin/drivers/${id}/validate`, { approve, reason: reason.trim() || undefined })
      setReason('')
      setExpanded(null)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setActing(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
        <button onClick={load} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(0,119,182,.2)', background:'rgba(255,255,255,.5)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {loading ? <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>Aucun livreur en attente.</div>
      : list.map(d => {
        const isOpen       = expanded === d.id
        const insurance    = d.insuranceExpiry ? new Date(d.insuranceExpiry) : null
        const isExpired    = insurance && insurance < new Date()
        const amNotActive  = d.managedBy && d.managedBy.chefDeFlotteStatus !== 'ACTIVE'
        const canValidate  = !isExpired && !amNotActive

        return (
          <div key={d.id} ref={el => { rowRefs.current[d.id] = el }} style={{ ...card, ...(d.id === highlightId ? cardHighlight : {}) }}>
            {/* Ligne résumé */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(99,102,241,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#6366f1', fontSize:14, flexShrink:0 }}>
                {(d.name ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{d.name ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                  {d.phone} · {d.vehicleType ?? '—'}
                  {d.managedBy && (
                    <> · AM : <strong style={{ color: d.managedBy.chefDeFlotteStatus === 'ACTIVE' ? '#15803d' : '#b45309' }}>
                      {d.managedBy.name ?? d.managedBy.phone}
                    </strong>
                    <span style={{ marginLeft:4, fontSize:11, background: d.managedBy.chefDeFlotteStatus === 'ACTIVE' ? 'rgba(34,197,94,.12)' : 'rgba(245,158,11,.12)', color: d.managedBy.chefDeFlotteStatus === 'ACTIVE' ? '#15803d' : '#b45309', padding:'1px 6px', borderRadius:10, fontWeight:600 }}>
                      {d.managedBy.chefDeFlotteStatus === 'ACTIVE' ? 'Actif' : d.managedBy.chefDeFlotteStatus ?? '—'}
                    </span></>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {isExpired    && <span style={{ fontSize:11, color:'#dc2626', fontWeight:700, background:'rgba(239,68,68,.08)', padding:'2px 8px', borderRadius:8 }}>⚠ Assurance</span>}
                {amNotActive  && <span style={{ fontSize:11, color:'#b45309', fontWeight:700, background:'rgba(245,158,11,.10)', padding:'2px 8px', borderRadius:8 }}>⚠ AM non validé</span>}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</div>
              <button onClick={() => { setExpanded(isOpen ? null : d.id); setReason('') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Détail dépliable */}
            {isOpen && (
              <div style={{ marginTop:14, borderTop:'1px solid rgba(0,0,0,.06)', paddingTop:12, display:'flex', flexDirection:'column', gap:12 }}>

                {/* Alerte AM non validé */}
                {amNotActive && (
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10, background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:10, padding:'10px 14px' }}>
                    <AlertTriangle size={16} style={{ color:'#b45309', flexShrink:0, marginTop:1 }} />
                    <div style={{ fontSize:13, color:'#92400e' }}>
                      <strong>Activation bloquée</strong> — Le chef de flotte <em>{d.managedBy?.name ?? ''}</em> n'est pas encore validé ({d.managedBy?.chefDeFlotteStatus ?? '—'}).
                      Validez d'abord le chef de flotte dans l'onglet <strong>Chefs de flotte</strong>.
                    </div>
                  </div>
                )}

                {/* Miniatures documents */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'.4px', marginBottom:8 }}>DOCUMENTS</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(72px, 1fr))', gap:12 }}>
                    {[
                      ['licenseFront', 'Permis recto'],
                      ['licenseBack',  'Permis verso'],
                      ['vehiclePhoto', 'Photo moto'],
                      ['carteGrise',   'Carte grise'],
                      ['assurance',    'Assurance'],
                      ['casquePhoto',  'Casque'],
                    ].map(([field, label]) => (
                      <DocThumb key={field} url={d[field]} label={label} />
                    ))}
                  </div>
                </div>

                {/* Expiration assurance */}
                {insurance && (
                  <div style={{ fontSize:12, color: isExpired ? '#dc2626' : '#15803d', fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                    {isExpired ? '❌' : '✅'} Assurance exp. : {insurance.toLocaleDateString('fr-FR')}
                    {isExpired && <span style={{ fontWeight:400, color:'#dc2626' }}> — validation impossible</span>}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <input
                    placeholder="Motif de refus (obligatoire si refus)"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    style={{ ...glassInput, maxWidth:400 }}
                  />
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <button
                      style={{ ...btnAccept, ...(!canValidate ? btnDisabled : {}) }}
                      disabled={acting===d.id || !canValidate}
                      onClick={() => canValidate && handleValidate(d.id, true)}
                      title={!canValidate ? (amNotActive ? 'Validez d\'abord le chef de flotte' : 'Assurance expirée') : ''}
                    >
                      <CheckCircle size={13} /> Valider
                    </button>
                    <button style={btnRefuse} disabled={acting===d.id} onClick={() => handleValidate(d.id, false)}>
                      <XCircle size={13} /> Refuser
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab DEM Pro ────────────────────────────────────────────────────────────────
const SECTOR_LABELS = {
  commerce:     'Commerce',
  restauration: 'Restauration',
  services:     'Services',
  artisanat:    'Artisanat',
  autre:        'Autre',
}
const VOLUME_LABELS = {
  low:    '1 à 4 livraisons / semaine',
  medium: '5 à 8 livraisons / semaine',
  high:   '9 ou plus / semaine',
}

function DemProTab({ highlightId }) {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('PENDING')
  const [expanded, setExpanded] = useState(null)
  const [reason,   setReason]   = useState('')
  const [acting,   setActing]   = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro', { params: { status: filter } })
      setList(res.data.accounts ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || !list.some(pro => pro.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(id, approve) {
    if (!approve && !reason.trim()) { alert('Saisissez un motif de refus.'); return }
    setActing(id)
    try {
      await api.patch(`/admin/dem-pro/${id}/validate`, { approve, reason: reason.trim() || undefined })
      setReason('')
      setExpanded(null)
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setActing(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Filtres */}
      <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap' }}>
        {[['PENDING','En attente'],['ACTIVE','Actifs'],['REJECTED','Refusés'],['all','Tous']].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:'5px 14px', borderRadius:20, border:'1px solid rgba(0,119,182,.25)',
            background: filter===s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filter===s ? '#fff' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer',
          }}>{label}</button>
        ))}
        <button onClick={load} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(0,119,182,.2)', background:'rgba(255,255,255,.5)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {loading ? <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>Aucun compte DEM Pro.</div>
      : list.map(pro => {
        const isOpen = expanded === pro.id
        return (
          <div key={pro.id} ref={el => { rowRefs.current[pro.id] = el }} style={{ ...card, ...(pro.id === highlightId ? cardHighlight : {}) }}>
            {/* Ligne résumé */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:42, height:42, borderRadius:'50%', background:'rgba(0,180,216,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'var(--primary)', fontSize:15, flexShrink:0 }}>
                {(pro.proBusinessName ?? pro.name ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{pro.proBusinessName ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {pro.name ?? '—'} · {pro.phone}
                </div>
              </div>
              <StatusBadge status={pro.proStatus} />
              <button onClick={() => { setExpanded(isOpen ? null : pro.id); setReason('') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {/* Détail dépliable */}
            {isOpen && (
              <div style={{ marginTop:16, borderTop:'1px solid rgba(0,0,0,.06)', paddingTop:14, display:'flex', flexDirection:'column', gap:14 }}>

                {/* Infos entreprise */}
                <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12 }}>
                  <span><strong>Secteur :</strong> {SECTOR_LABELS[pro.proSector] ?? pro.proSector ?? '—'}</span>
                  <span><strong>Volume :</strong> {VOLUME_LABELS[pro.proWeeklyVolume] ?? pro.proWeeklyVolume ?? '—'}</span>
                  {pro.email && <span><strong>Email :</strong> {pro.email}</span>}
                  <span><strong>Inscrit le :</strong> {new Date(pro.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>

                {/* Actions PENDING */}
                {pro.proStatus === 'PENDING' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    <input
                      placeholder="Motif de refus (obligatoire si refus)"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      style={{ ...glassInput, maxWidth:400 }}
                    />
                    <div style={{ display:'flex', gap:10 }}>
                      <button style={btnAccept} disabled={acting===pro.id} onClick={() => handleValidate(pro.id, true)}>
                        <CheckCircle size={13} /> Valider
                      </button>
                      <button style={btnRefuse} disabled={acting===pro.id} onClick={() => handleValidate(pro.id, false)}>
                        <XCircle size={13} /> Refuser
                      </button>
                    </div>
                  </div>
                )}

                {/* Motif refus */}
                {pro.proStatus === 'REJECTED' && pro.rejectionReason && (
                  <div style={{ fontSize:12, color:'#dc2626', background:'rgba(239,68,68,.06)', padding:'8px 12px', borderRadius:8 }}>
                    <strong>Motif :</strong> {pro.rejectionReason}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab Demandes Service Client (AdminRequest) ────────────────────────────────
const REQUEST_KIND_LABELS = {
  DEM_PRO_CREATE:   'Création compte DEM Pro',
  DEM_PRO_SUSPEND:  'Suspension compte DEM Pro',
  DEM_PRO_ACTIVATE: 'Réactivation compte DEM Pro',
  GESTE_FREE_RIDE:  'Course gratuite',
  GESTE_DISCOUNT:   'Remise',
  TARIFF_CHANGE:    'Modification tarifaire',
  DRIVER_SUSPEND:   'Suspension livreur',
  CHEF_SUSPEND:     'Suspension chef de flotte',
}

// kindFilter distingue les demandes soumises par le Service Client (création/
// suspension DEM Pro, gestes commerciaux, suspensions livreur/chef de flotte)
// de celles soumises par l'admin Finance (TARIFF_CHANGE) — même backend
// (/admin/requests), deux onglets pour ne pas les noyer les unes dans les autres.
// Références stables (pas de fonction inline) pour ne pas invalider le
// useCallback de chargement à chaque rendu.
const SC_KIND_FILTER      = kind => kind !== 'TARIFF_CHANGE'
const FINANCE_KIND_FILTER = kind => kind === 'TARIFF_CHANGE'

function ServiceRequestsTab({ highlightId }) {
  return <AdminRequestsTab highlightId={highlightId} kindFilter={SC_KIND_FILTER} emptyText="Aucune demande." />
}

function FinanceRequestsTab({ highlightId }) {
  return <AdminRequestsTab highlightId={highlightId} kindFilter={FINANCE_KIND_FILTER} emptyText="Aucune demande Finance." />
}

function AdminRequestsTab({ highlightId, kindFilter, emptyText }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('PENDING')
  const [acting,  setActing]  = useState(null)
  const [notes,   setNotes]   = useState({})
  const rowRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: filter === 'all' ? {} : { status: filter } })
      setList((res.data.requests ?? []).filter(r => kindFilter(r.kind)))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter, kindFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || !list.some(r => r.id === highlightId)) return
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleDecide(id, approve) {
    setActing(id)
    try {
      const path = approve ? 'approve' : 'reject'
      await api.patch(`/admin/requests/${id}/${path}`, { reviewNotes: notes[id] ?? undefined })
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setActing(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap' }}>
        {[['PENDING','En attente'],['APPROVED','Approuvées'],['REJECTED','Refusées'],['all','Toutes']].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding:'5px 14px', borderRadius:20, border:'1px solid rgba(0,119,182,.25)',
            background: filter===s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filter===s ? '#fff' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer',
          }}>{label}</button>
        ))}
        <button onClick={load} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(0,119,182,.2)', background:'rgba(255,255,255,.5)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {loading ? <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>{emptyText}</div>
      : list.map(r => (
        <div key={r.id} ref={el => { rowRefs.current[r.id] = el }} style={{ ...card, ...(r.id === highlightId ? cardHighlight : {}) }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{REQUEST_KIND_LABELS[r.kind] ?? r.kind}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                Soumis par {r.submittedBy?.name ?? r.submittedBy?.email ?? '—'}
                {r.targetUser && <> · Concerne : {r.targetUser.proBusinessName ?? r.targetUser.name ?? r.targetUser.phone}</>}
                {' · '}{new Date(r.createdAt).toLocaleString('fr-FR')}
              </div>
            </div>
            <StatusBadge status={r.status} />
          </div>

          {r.reason && (
            <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(0,0,0,.03)', borderRadius:8, fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
              « {r.reason} »
            </div>
          )}

          {r.payload && Object.keys(r.payload).length > 0 && (
            <div style={{ marginTop:10, display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)' }}>
              {Object.entries(r.payload).map(([k, v]) => (
                <span key={k}><strong>{k} :</strong> {String(v)}</span>
              ))}
            </div>
          )}

          {r.status === 'PENDING' && (
            <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <input
                placeholder="Notes (optionnel)"
                value={notes[r.id] ?? ''}
                onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))}
                style={{ ...glassInput, flex:1, maxWidth:300 }}
              />
              <button style={btnAccept} disabled={acting===r.id} onClick={() => handleDecide(r.id, true)}>
                <CheckCircle size={13} /> Approuver
              </button>
              <button style={btnRefuse} disabled={acting===r.id} onClick={() => handleDecide(r.id, false)}>
                <XCircle size={13} /> Refuser
              </button>
            </div>
          )}

          {r.status !== 'PENDING' && r.reviewNotes && (
            <div style={{ marginTop:10, fontSize:12, color:'var(--text-muted)' }}>
              <strong>Notes de revue :</strong> {r.reviewNotes}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tab Extensions flotte ─────────────────────────────────────────────────────
function FleetTab({ highlightId }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(null)
  const [notes,   setNotes]   = useState({})
  const rowRefs = useRef({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/fleet-extensions', { params: { status: 'PENDING' } })
      setList(res.data.extensions ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!highlightId || !list.some(ext => ext.id === highlightId)) return
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(id, approve) {
    setActing(id)
    try {
      await api.patch(`/admin/fleet-extensions/${id}/validate`, { approve, adminNotes: notes[id] ?? undefined })
      load()
    } catch (e) { alert(e.response?.data?.message ?? 'Erreur.') }
    finally { setActing(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {loading ? <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>Aucune demande d'extension en attente.</div>
      : list.map(ext => (
        <div key={ext.id} ref={el => { rowRefs.current[ext.id] = el }} style={{ ...card, ...(ext.id === highlightId ? cardHighlight : {}) }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:160 }}>
              <div style={{ fontWeight:700, fontSize:14 }}>{ext.ambassador?.name ?? '—'}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>{ext.ambassador?.phone}</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>ACTUEL</div>
                <div style={{ fontSize:22, fontWeight:800 }}>{ext.ambassador?.fleetMaxSize}</div>
              </div>
              <div style={{ fontSize:20, color:'var(--text-muted)' }}>→</div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:10, color:'var(--primary)', fontWeight:600 }}>DEMANDÉ</div>
                <div style={{ fontSize:22, fontWeight:800, color:'var(--primary)' }}>{ext.requestedSize}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(0,0,0,.03)', borderRadius:8, fontSize:13, color:'var(--text-muted)', fontStyle:'italic' }}>
            « {ext.justification} »
          </div>

          <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <input
              placeholder="Notes admin (optionnel)"
              value={notes[ext.id] ?? ''}
              onChange={e => setNotes(n => ({ ...n, [ext.id]: e.target.value }))}
              style={{ ...glassInput, flex:1, maxWidth:300 }}
            />
            <button style={btnAccept} disabled={acting===ext.id} onClick={() => handleValidate(ext.id, true)}>
              <CheckCircle size={13} /> Approuver
            </button>
            <button style={btnRefuse} disabled={acting===ext.id} onClick={() => handleValidate(ext.id, false)}>
              <XCircle size={13} /> Refuser
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
