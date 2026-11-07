import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Shield, Motorbike, Layers, AlertTriangle, Briefcase, ClipboardList, Wallet, FileWarning, Truck, Send, Paperclip, HelpCircle, Megaphone } from 'lucide-react'
import SuspendModal from '../components/SuspendModal'
import AmbassadorDetailModal from '../components/AmbassadorDetailModal'
import DocThumb from '../components/DocThumb'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import { canSee, asksSuper, isSuperRole, TAB_ROLES, ACTION_ROLES } from '../lib/droits'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { REQUEST_KIND_LABELS, REQUEST_STATUS_LABELS, requestDetails } from '../lib/requestKinds'
import RequestModal from '../components/RequestModal'

// ── Styles partagés ───────────────────────────────────────────────────────────
const card      = { ...glass, padding: '18px 20px' }
const cardHighlight = { boxShadow: '0 0 0 2px var(--primary)' }
const btnAccept ={ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(34,197,94,.12)', color:'#15803d', fontWeight:700, fontSize:12, cursor:'pointer' }
const btnRefuse = { display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(239,68,68,.10)', color:'#dc2626', fontWeight:700, fontSize:12, cursor:'pointer' }
const btnGhost  = { display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'rgba(0,0,0,.06)', color:'var(--text-muted)', fontWeight:600, fontSize:12, cursor:'pointer' }
const btnDisabled = { opacity: 0.45, cursor: 'not-allowed' }

// ── StatusBadge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PENDING:  { bg: 'rgba(245,158,11,.12)', color: '#b45309', label: 'En attente' },
    NEEDS_INFO: { bg: 'rgba(99,102,241,.12)', color: '#4f46e5', label: 'Précision demandée' },
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

// ── Barre d'outils commune : filtre de statut (facultatif) + Actualiser ───────
function Toolbar({ filters, value, onChange, onRefresh }) {
  return (
    <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap', alignItems:'center' }}>
      {filters?.map(([s, label]) => (
        <button key={s} onClick={() => onChange(s)} style={{
          padding:'5px 14px', borderRadius:20, border:'1px solid rgba(0,119,182,.25)',
          background: value===s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
          color: value===s ? '#fff' : 'var(--text-muted)', fontSize:12, fontWeight:600, cursor:'pointer',
        }}>{label}</button>
      ))}
      <button onClick={() => onRefresh()} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:8, border:'1px solid rgba(0,119,182,.2)', background:'rgba(255,255,255,.5)', color:'var(--text-muted)', fontSize:12, cursor:'pointer' }}>
        <RefreshCw size={12} /> Actualiser
      </button>
    </div>
  )
}

// ── Messages dans la page (plus de fenêtres d'alerte) ─────────────────────────
function ErrorLine({ children }) {
  return (
    <div style={{ fontSize:12, color:'#dc2626', background:'rgba(239,68,68,.06)', padding:'6px 10px', borderRadius:8, display:'flex', alignItems:'center', gap:6 }}>
      <AlertTriangle size={13} style={{ flexShrink:0 }} /> {children}
    </div>
  )
}

function Notice({ text }) {
  if (!text) return null
  return (
    <div style={{ fontSize:13, color:'#15803d', background:'rgba(34,197,94,.10)', padding:'8px 12px', borderRadius:10, display:'flex', alignItems:'center', gap:8, fontWeight:600 }}>
      <CheckCircle size={14} /> {text}
    </div>
  )
}

// Décisions d'un onglet : action en cours, erreur propre à chaque carte,
// confirmation affichée en haut de la liste quelques secondes.
function useDecisions(reload, onChanged) {
  const [acting, setActing] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  async function run(id, request, okText) {
    setActing(id)
    setErrors(e => ({ ...e, [id]: null }))
    try {
      await request()
      setNotice(okText)
      reload(true)
      onChanged?.()
      return true
    } catch (e) {
      setErrors(er => ({ ...er, [id]: e.response?.data?.message ?? 'Erreur.' }))
      return false
    } finally { setActing(null) }
  }

  return { acting, errors, notice, run }
}

// Valider / Refuser : le motif est demandé dans la carte au moment du refus.
function DecisionBar({ busy, error, canAccept = true, acceptTitle, onAccept, onRefuse }) {
  const [refusing, setRefusing] = useState(false)
  const [reason,   setReason]   = useState('')
  const [missing,  setMissing]  = useState(false)

  function confirmRefuse() {
    if (!reason.trim()) { setMissing(true); return }
    onRefuse(reason.trim())
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {refusing ? (<>
        <input
          autoFocus
          placeholder="Motif du refus (obligatoire)"
          value={reason}
          onChange={e => { setReason(e.target.value); setMissing(false) }}
          style={{ ...glassInput, maxWidth:400 }}
        />
        {missing && <ErrorLine>Saisissez le motif du refus.</ErrorLine>}
        <div style={{ display:'flex', gap:10 }}>
          <button style={btnRefuse} disabled={busy} onClick={confirmRefuse}>
            <XCircle size={13} /> Confirmer le refus
          </button>
          <button style={btnGhost} disabled={busy} onClick={() => { setRefusing(false); setReason(''); setMissing(false) }}>
            Annuler
          </button>
        </div>
      </>) : (
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button
            style={{ ...btnAccept, ...(!canAccept ? btnDisabled : {}) }}
            disabled={busy || !canAccept}
            onClick={() => canAccept && onAccept()}
            title={acceptTitle ?? ''}
          >
            <CheckCircle size={13} /> Valider
          </button>
          <button style={btnRefuse} disabled={busy} onClick={() => setRefusing(true)}>
            <XCircle size={13} /> Refuser
          </button>
        </div>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
    </div>
  )
}

function Loading() {
  return <div style={{ color:'var(--text-muted)' }}>Chargement…</div>
}

function Empty({ children }) {
  return <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>{children}</div>
}

// ── Onglets et compteurs ──────────────────────────────────────────────────────
const TABS = [
  { key: 'ambassadors',      label: 'Chefs de flotte',         icon: Shield },
  { key: 'drivers',          label: 'Coursiers en attente',    icon: Motorbike },
  { key: 'kyc-review',       label: 'Pièces à revoir',         icon: FileWarning },
  { key: 'dem-pro',          label: 'DEM Pro',                 icon: Briefcase },
  { key: 'fleet',            label: 'Extensions de flotte',    icon: Layers },
  { key: 'service-requests', label: 'Demandes Service Client', icon: ClipboardList },
  { key: 'finance-requests', label: 'Demandes Finance',        icon: Wallet },
  { key: 'fleet-requests',   label: 'Demandes Flotte',         icon: Truck },
  { key: 'commercial-requests', label: 'Demandes Commercial',   icon: Briefcase },
  { key: 'cm-requests',      label: 'Demandes CM',             icon: Megaphone },
  { key: 'my-requests',      label: 'Mes demandes',            icon: Send },
]

// Même source et même filtre que chaque onglet en « En attente » : le nombre
// affiché sur l'onglet est celui de la liste qu'il ouvre.
const COUNTERS = {
  ambassadors:  () => api.get('/admin/chefs-de-flotte', { params: { status: 'PENDING' } }).then(r => ({ ambassadors: (r.data.chefs ?? []).length })),
  drivers:      () => api.get('/admin/drivers/pending').then(r => ({ drivers: (r.data.drivers ?? []).length })),
  'kyc-review': () => api.get('/admin/drivers', { params: { status: 'kyc-review', limit: 1 } }).then(r => ({ 'kyc-review': r.data.total ?? (r.data.drivers ?? []).length })),
  'dem-pro':    () => api.get('/admin/dem-pro', { params: { status: 'PENDING' } }).then(r => ({ 'dem-pro': (r.data.accounts ?? []).length })),
  fleet:        () => api.get('/admin/fleet-extensions', { params: { status: 'PENDING' } }).then(r => ({ fleet: (r.data.extensions ?? []).length })),
  'service-requests': () => api.get('/admin/requests', { params: { status: 'PENDING' } }).then(r => {
    const list = r.data.requests ?? []
    return {
      'service-requests': list.filter(SC_FILTER).length,
      'finance-requests': list.filter(FINANCE_FILTER).length,
      'fleet-requests':   list.filter(FLEET_FILTER).length,
      'commercial-requests': list.filter(r => r.origin === 'COMMERCIAL').length,
      'cm-requests':      list.filter(r => r.origin === 'CM').length,
    }
  }),
  // Mes demandes : celles qui attendent ma réponse (précision demandée)
  'my-requests': () => api.get('/admin/requests', { params: { status: 'NEEDS_INFO' } }).then(r => ({ 'my-requests': (r.data.requests ?? []).length })),
}

async function fetchCounts(keys) {
  const results = await Promise.allSettled(keys.filter(k => COUNTERS[k]).map(k => COUNTERS[k]()))
  return Object.assign({}, ...results.map(r => (r.status === 'fulfilled' ? r.value : {})))
}

function CountPill({ n, active }) {
  if (!n) return null
  return (
    <span style={{
      marginLeft: 2, minWidth: 18, padding: '0 6px', borderRadius: 10, fontSize: 11, fontWeight: 800, lineHeight: '18px', textAlign: 'center',
      background: active ? 'rgba(255,255,255,.25)' : 'rgba(245,158,11,.15)',
      color: active ? '#fff' : '#b45309',
    }}>{n}</span>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function Validation() {
  const { user } = useAuth()
  const role = user?.adminRole
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight') || null

  // « Mes demandes » : suivi du demandeur, sans objet pour le Super Admin
  const tabs = useMemo(() => TABS.filter(t => canSee(role, TAB_ROLES.validation[t.key]) && !(t.key === 'my-requests' && isSuperRole(role))), [role])
  const [urlTab, setTab] = useUrlTab(tabs)
  const fromUrl = tabs.some(t => t.key === searchParams.get('tab'))

  // Sans onglet dans l'adresse, la page s'ouvre sur le premier onglet qui a
  // du travail — choisi une fois, au premier chargement des compteurs.
  const [counts, setCounts] = useState(null)
  const [firstTab, setFirstTab] = useState(null)
  const refreshCounts = useCallback(() => {
    fetchCounts(tabs.map(t => t.key)).then(c => {
      setCounts(c)
      setFirstTab(prev => prev ?? (tabs.find(t => c[t.key] > 0)?.key ?? tabs[0]?.key))
    })
  }, [tabs])

  useEffect(() => { refreshCounts() }, [refreshCounts])
  useAutoRefresh(refreshCounts)

  const tab = fromUrl ? urlTab : firstTab
  const barTabs = tabs.map(t => ({ ...t, infoTitle: t.label, label: <>{t.label}<CountPill n={counts?.[t.key]} active={tab === t.key} /></> }))

  const canSuspendChef = canSee(role, ACTION_ROLES.chefSuspend)
  const canReviewKyc   = canSee(role, ACTION_ROLES.kycReview)
  const canDecideChef  = canSee(role, ACTION_ROLES.chefDecision)
  const canDecideFleet = canSee(role, ACTION_ROLES.fleetDecision)
  const askSuper       = asksSuper(role) // Resp. flottes : « Demander la validation »

  return (
    <div style={pageWrap}>
      <PageHeader title="Validation" subtitle="Inscriptions, pièces et demandes en attente de décision." />
      <TabBar tabs={barTabs} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {!tab && <Loading />}
        {tab === 'ambassadors'      && <AmbassadorsTab canSuspend={canSuspendChef} canDecide={canDecideChef} askSuper={askSuper} highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'drivers'          && <DriversTab highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'kyc-review'       && <KycReviewTab canReview={canReviewKyc} highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'dem-pro'          && <DemProTab highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'fleet'            && <FleetTab canDecide={canDecideFleet} askSuper={askSuper} highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'service-requests' && <ServiceRequestsTab highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'finance-requests' && <FinanceRequestsTab highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'fleet-requests'   && <FleetRequestsTab highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'commercial-requests' && <FleetRequestsTab origin="COMMERCIAL" emptyText="Aucune demande du Commercial / CRM Pro." highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'cm-requests' && <FleetRequestsTab origin="CM" emptyText="Aucune demande du CM / CRM Client." highlightId={highlightId} onChanged={refreshCounts} />}
        {tab === 'my-requests'      && <MyRequestsTab highlightId={highlightId} onChanged={refreshCounts} />}
      </div>
    </div>
  )
}

// ── Tab Chefs de flotte ────────────────────────────────────────────────────────
function AmbassadorsTab({ canSuspend, canDecide, askSuper, highlightId, onChanged }) {
  const [asking, setAsking] = useState(null) // chef dont on demande la validation
  const [list,     setList]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('PENDING')
  const [expanded,      setExpanded]      = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspending,    setSuspending]    = useState(false)
  const [detailAmId,    setDetailAmId]    = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/chefs-de-flotte', { params: { status: filter } })
      setList(res.data.chefs ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(am => am.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(am, approve, reason) {
    const ok = await run(am.id,
      () => api.patch(`/admin/chefs-de-flotte/${am.id}/validate`, { approve, reason }),
      `${am.name ?? am.phone} : ${approve ? 'chef de flotte validé' : 'inscription refusée'}.`)
    if (ok) setExpanded(null)
  }

  async function handleSuspendConfirm(reason, fix) {
    if (!suspendTarget) return
    setSuspending(true)
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    await run(suspendTarget.id,
      () => api.patch(`/admin/chefs-de-flotte/${suspendTarget.id}/suspend`, { reason: fullReason }),
      `${suspendTarget.name ?? suspendTarget.phone} : chef de flotte suspendu.`)
    setSuspendTarget(null)
    setSuspending(false)
  }

  return (<>
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar filters={[['PENDING','En attente'],['ACTIVE','Actifs'],['REJECTED','Refusés'],['all','Tous']]} value={filter} onChange={setFilter} onRefresh={load} />
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucun chef de flotte.</Empty>
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
                  <> · <strong>{am._count?.managedDrivers ?? 0}</strong> coursier(s)</>
                </div>
              </div>
              <StatusBadge status={am.chefDeFlotteStatus} />
              <button onClick={() => setDetailAmId(am.id)}
                style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:8, border:'1px solid rgba(0,119,182,.25)', background:'rgba(255,255,255,.5)', color:'var(--primary)', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0 }}>
                Voir
              </button>
              <button onClick={() => setExpanded(isOpen ? null : am.id)}
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
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-start' }}>
                    <DocThumb url={am.cniRecto} label="CNI recto" />
                    <DocThumb url={am.cniVerso} label="CNI verso" />
                    {am.rccmDocument && <DocThumb url={am.rccmDocument} label="RCCM (facultatif)" />}
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

                {/* Actions PENDING (Resp. flottes : lecture, décision du Super Admin) */}
                {am.chefDeFlotteStatus === 'PENDING' && !canDecide && askSuper && (
                  <button style={{ ...btnAccept, alignSelf:'flex-start' }} onClick={() => setAsking(am)}>
                    <Send size={13} /> Demander la validation
                  </button>
                )}
                {am.chefDeFlotteStatus === 'PENDING' && canDecide && (
                  <DecisionBar
                    busy={acting===am.id}
                    error={errors[am.id]}
                    onAccept={() => handleValidate(am, true)}
                    onRefuse={reason => handleValidate(am, false, reason)}
                  />
                )}

                {/* Action ACTIVE → Suspendre (SUPER uniquement — SC passe par "Demander suspension" sur la page Chefs de flotte) */}
                {am.chefDeFlotteStatus === 'ACTIVE' && canSuspend && (<>
                  <button style={{ ...btnRefuse, alignSelf:'flex-start' }} onClick={() => setSuspendTarget(am)}>
                    Suspendre (+ tous ses coursiers)
                  </button>
                  {errors[am.id] && <ErrorLine>{errors[am.id]}</ErrorLine>}
                </>)}

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
    {asking && (
      <RequestModal
        kind="CHEF_VALIDATE"
        title={`Demander la validation — ${asking.name ?? asking.phone}`}
        intro="La validation d'un chef de flotte revient au Super Admin. Donnez votre avis dans le détail."
        targetUserId={asking.id}
        onClose={() => setAsking(null)}
        onDone={() => { setAsking(null); load(true) }}
      />
    )}
  </>)
}

// ── Tab Coursiers en attente ───────────────────────────────────────────────────
function DriversTab({ highlightId, onChanged }) {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/drivers/pending')
      setList(res.data.drivers ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(d => d.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(d, approve, reason) {
    const ok = await run(d.id,
      () => api.patch(`/admin/drivers/${d.id}/validate`, { approve, reason }),
      `${d.name ?? d.phone} : ${approve ? 'coursier validé' : 'inscription refusée'}.`)
    if (ok) setExpanded(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar onRefresh={load} />
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucun coursier en attente.</Empty>
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
              <button onClick={() => setExpanded(isOpen ? null : d.id)}
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
                  <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
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
                <DecisionBar
                  busy={acting===d.id}
                  error={errors[d.id]}
                  canAccept={canValidate}
                  acceptTitle={!canValidate ? (amNotActive ? 'Validez d\'abord le chef de flotte' : 'Assurance expirée') : ''}
                  onAccept={() => handleValidate(d, true)}
                  onRefuse={reason => handleValidate(d, false, reason)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab Pièces à revoir (driverStatus : UNDER_REVIEW / PENDING_DOCUMENTS) ──────
// Système distinct de "Coursiers en attente" ci-dessus (qui opère sur
// chefDeFlotteStatus, la validation à l'inscription) — ici on gère le rejet
// document par document une fois le coursier déjà actif, sans le suspendre.
const KYC_FIELDS = [
  ['licenseFront',   'Permis recto'],
  ['licenseBack',    'Permis verso'],
  ['carteGrise',     'Carte grise recto'],
  ['carteGriseBack', 'Carte grise verso'],
  ['assurance',      'Assurance'],
  ['vehiclePhoto',   'Photo moto'],
  ['avatar',         'Photo profil'],
]

const VEHICLE_LABELS = { MOTO: 'Moto', VELO: 'Vélo', VOITURE: 'Voiture' }
const fmtDate = v => (v ? new Date(v).toLocaleDateString('fr-FR') : '—')

function KycReviewTab({ canReview, highlightId, onChanged }) {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [rejectingField, setRejectingField] = useState(null) // `${driverId}:${field}`
  const [reason,   setReason]   = useState('')
  const [missing,  setMissing]  = useState(false)
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/drivers', { params: { status: 'kyc-review', limit: 50 } })
      setList(res.data.drivers ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(d => d.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  function startReject(key) {
    setRejectingField(key)
    setReason('')
    setMissing(false)
  }

  async function handleReject(d, field, label) {
    if (!reason.trim()) { setMissing(true); return }
    const ok = await run(`${d.id}:${field}`,
      () => api.patch(`/admin/drivers/${d.id}/documents/${field}/reject`, { reason: reason.trim() }),
      `${d.name ?? d.phone} : ${label} rejeté.`)
    if (ok) startReject(null)
  }

  async function handleVerify(d) {
    const ok = await run(d.id,
      () => api.patch(`/admin/drivers/${d.id}/verify`),
      `${d.name ?? d.phone} : coursier certifié.`)
    if (ok) setExpanded(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar onRefresh={load} />
      <div style={{ fontSize:12, color:'var(--text-muted)' }}>
        Coursiers déjà inscrits dont une ou plusieurs pièces sont à vérifier ou à compléter.
      </div>
      {!canReview && (
        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
          Lecture seule : le rejet des pièces et la certification sont faits par le Super Admin ou l'Assistance exécutive.
        </div>
      )}
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucun coursier à revoir.</Empty>
      : list.map(d => {
        const isOpen = expanded === d.id
        const rejections = d.rejectedDocuments ?? {}
        const missingDocs = KYC_FIELDS.filter(([f]) => !d[f])
        const hasActiveRejections = Object.keys(rejections).length > 0
        const canVerify = missingDocs.length === 0 && !hasActiveRejections

        return (
          <div key={d.id} ref={el => { rowRefs.current[d.id] = el }} style={{ ...card, ...(d.id === highlightId ? cardHighlight : {}) }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {d.avatar
                ? <img src={d.avatar} alt="" style={{ width:38, height:38, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                : <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(99,102,241,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#6366f1', fontSize:14, flexShrink:0 }}>
                    {(d.name ?? '?')[0].toUpperCase()}
                  </div>}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{d.name ?? '—'}</div>
                <div style={{ fontSize:12, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {d.phone} · {VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType ?? '—'}
                  {d.vehiclePlate && <> · {d.vehiclePlate}</>}
                  {' · '}{d.managedBy ? <>Flotte <strong>{d.managedBy.name ?? d.managedBy.phone}</strong></> : 'Indépendant'}
                </div>
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>Inscrit le {fmtDate(d.createdAt)}</div>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, background: d.driverStatus === 'UNDER_REVIEW' ? 'rgba(99,102,241,.12)' : 'rgba(245,158,11,.12)', color: d.driverStatus === 'UNDER_REVIEW' ? '#6366f1' : '#b45309' }}>
                {d.driverStatus === 'UNDER_REVIEW' ? 'En révision' : 'Documents manquants'}
              </span>
              <button onClick={() => { setExpanded(isOpen ? null : d.id); startReject(null) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', flexShrink:0 }}>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop:14, borderTop:'1px solid rgba(0,0,0,.06)', paddingTop:12, display:'flex', flexDirection:'column', gap:12 }}>
                {/* Profil du coursier */}
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'.4px', marginBottom:8 }}>PROFIL</div>
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12 }}>
                    <span><strong>Inscrit le :</strong> {fmtDate(d.createdAt)}</span>
                    <span><strong>Courses livrées :</strong> {d.deliveredCourses ?? 0}</span>
                    <span><strong>Note :</strong> {d.avgRating ? `${d.avgRating} / 5` : '—'}</span>
                    <span><strong>Chef de flotte :</strong> {d.managedBy ? `${d.managedBy.name ?? '—'} (${d.managedBy.phone ?? '—'})` : 'Indépendant'}</span>
                    {d.email && <span><strong>Email :</strong> {d.email}</span>}
                    {d.insuranceExpiry && <span><strong>Assurance jusqu'au :</strong> {fmtDate(d.insuranceExpiry)}</span>}
                    {d.verificationDeadline && <span><strong>Pièces à fournir avant le :</strong> {fmtDate(d.verificationDeadline)}</span>}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:6 }}>
                    {d.driverStatus === 'UNDER_REVIEW'
                      ? 'En révision : le coursier a envoyé ses pièces, elles sont à vérifier.'
                      : 'Documents manquants : le coursier doit encore fournir ou remplacer des pièces.'}
                  </div>
                </div>

                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', letterSpacing:'.4px' }}>PIÈCES</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:14 }}>
                  {KYC_FIELDS.map(([field, label]) => {
                    const key = `${d.id}:${field}`
                    const rejection = rejections[field]
                    const uploaded  = !!d[field]
                    const isRejecting = rejectingField === key
                    return (
                      <div key={field} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                        <DocThumb url={d[field]} label={label} />
                        {rejection ? (
                          <span style={{ fontSize:10, fontWeight:700, color:'#dc2626', textAlign:'center' }}>Refusé : {rejection.reason}</span>
                        ) : uploaded ? (
                          <span style={{ fontSize:10, fontWeight:700, color:'#15803d' }}>Valide</span>
                        ) : (
                          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)' }}>Manquant</span>
                        )}
                        {canReview && uploaded && !isRejecting && (
                          <button
                            onClick={() => startReject(key)}
                            style={{ fontSize:10, fontWeight:700, color:'#dc2626', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}
                          >
                            Rejeter
                          </button>
                        )}
                        {isRejecting && (
                          <div style={{ display:'flex', flexDirection:'column', gap:4, width:'100%' }}>
                            <input
                              autoFocus
                              placeholder="Motif du refus"
                              value={reason}
                              onChange={e => { setReason(e.target.value); setMissing(false) }}
                              style={{ ...glassInput, fontSize:11, padding:'4px 8px' }}
                            />
                            {missing && <span style={{ fontSize:10, fontWeight:700, color:'#dc2626' }}>Saisissez le motif.</span>}
                            <div style={{ display:'flex', gap:4 }}>
                              <button
                                disabled={acting === key}
                                onClick={() => handleReject(d, field, label)}
                                style={{ ...btnRefuse, fontSize:10, padding:'3px 8px', flex:1, justifyContent:'center' }}
                              >
                                Rejeter
                              </button>
                              <button
                                onClick={() => startReject(null)}
                                style={{ fontSize:10, padding:'3px 8px', flex:1, borderRadius:8, border:'none', background:'rgba(0,0,0,.06)', color:'var(--text-muted)', cursor:'pointer' }}
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {errors[key] && <span style={{ fontSize:10, fontWeight:700, color:'#dc2626', textAlign:'center' }}>{errors[key]}</span>}
                      </div>
                    )
                  })}
                </div>

                {canReview && (<>
                  <button
                    style={{ ...btnAccept, alignSelf:'flex-start', ...(!canVerify ? btnDisabled : {}) }}
                    disabled={acting === d.id || !canVerify}
                    onClick={() => canVerify && handleVerify(d)}
                    title={!canVerify ? 'Documents manquants ou rejets non corrigés' : ''}
                  >
                    <CheckCircle size={13} /> Vérifier — certifier ce coursier
                  </button>
                  {errors[d.id] && <ErrorLine>{errors[d.id]}</ErrorLine>}
                </>)}
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

function DemProTab({ highlightId, onChanged }) {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('PENDING')
  const [expanded, setExpanded] = useState(null)
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro', { params: { status: filter } })
      setList(res.data.accounts ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(pro => pro.id === highlightId)) return
    setExpanded(highlightId)
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  async function handleValidate(pro, approve, reason) {
    const ok = await run(pro.id,
      () => api.patch(`/admin/dem-pro/${pro.id}/validate`, { approve, reason }),
      `${pro.proBusinessName ?? pro.name ?? pro.phone} : ${approve ? 'compte DEM Pro validé' : 'compte refusé'}.`)
    if (ok) setExpanded(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar filters={[['PENDING','En attente'],['ACTIVE','Actifs'],['REJECTED','Refusés'],['all','Tous']]} value={filter} onChange={setFilter} onRefresh={load} />
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucun compte DEM Pro.</Empty>
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
              <button onClick={() => setExpanded(isOpen ? null : pro.id)}
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
                  <DecisionBar
                    busy={acting===pro.id}
                    error={errors[pro.id]}
                    onAccept={() => handleValidate(pro, true)}
                    onRefuse={reason => handleValidate(pro, false, reason)}
                  />
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

// kindFilter distingue les demandes soumises par le Service Client (création/
// suspension DEM Pro, gestes commerciaux, suspensions coursier/chef de flotte)
// de celles soumises par l'admin Finance (TARIFF_CHANGE) — même backend
// (/admin/requests), deux onglets pour ne pas les noyer les unes dans les autres.
// Références stables (pas de fonction inline) pour ne pas invalider le
// useCallback de chargement à chaque rendu.
const SC_FILTER      = r => r.kind !== 'TARIFF_CHANGE' && !['FLOTTE', 'COMMERCIAL', 'CM'].includes(r.origin)
const FINANCE_FILTER = r => r.kind === 'TARIFF_CHANGE'
const FLEET_FILTER   = r => r.origin === 'FLOTTE'

function ServiceRequestsTab({ highlightId, onChanged }) {
  return <AdminRequestsTab highlightId={highlightId} onChanged={onChanged} kindFilter={SC_FILTER} emptyText="Aucune demande." />
}

function FinanceRequestsTab({ highlightId, onChanged }) {
  return <AdminRequestsTab highlightId={highlightId} onChanged={onChanged} kindFilter={FINANCE_FILTER} emptyText="Aucune demande Finance." />
}

function AdminRequestsTab({ highlightId, onChanged, kindFilter, emptyText }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('PENDING')
  const [notes,   setNotes]   = useState({})
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: filter === 'all' ? {} : { status: filter } })
      setList((res.data.requests ?? []).filter(kindFilter))
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter, kindFilter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(r => r.id === highlightId)) return
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  function handleDecide(r, approve) {
    run(r.id,
      () => api.patch(`/admin/requests/${r.id}/${approve ? 'approve' : 'reject'}`, { reviewNotes: notes[r.id] ?? undefined }),
      `${REQUEST_KIND_LABELS[r.kind] ?? r.kind} : demande ${approve ? 'approuvée' : 'refusée'}.`)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar filters={[['PENDING','En attente'],['APPROVED','Approuvées'],['REJECTED','Refusées'],['all','Toutes']]} value={filter} onChange={setFilter} onRefresh={load} />
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>{emptyText}</Empty>
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
              <button style={btnAccept} disabled={acting===r.id} onClick={() => handleDecide(r, true)}>
                <CheckCircle size={13} /> Approuver
              </button>
              <button style={btnRefuse} disabled={acting===r.id} onClick={() => handleDecide(r, false)}>
                <XCircle size={13} /> Refuser
              </button>
            </div>
          )}
          {errors[r.id] && <div style={{ marginTop:8 }}><ErrorLine>{errors[r.id]}</ErrorLine></div>}

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
function FleetTab({ canDecide, askSuper, highlightId, onChanged }) {
  const [asking, setAsking] = useState(null) // extension dont on demande la validation
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [notes,   setNotes]   = useState({})
  const rowRefs = useRef({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/fleet-extensions', { params: { status: 'PENDING' } })
      setList(res.data.extensions ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  useEffect(() => {
    if (!highlightId || !list.some(ext => ext.id === highlightId)) return
    rowRefs.current[highlightId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlightId, list])

  function handleValidate(ext, approve) {
    run(ext.id,
      () => api.patch(`/admin/fleet-extensions/${ext.id}/validate`, { approve, adminNotes: notes[ext.id] ?? undefined }),
      `${ext.ambassador?.name ?? ext.ambassador?.phone ?? 'Chef de flotte'} : extension ${approve ? 'approuvée' : 'refusée'}.`)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar onRefresh={load} />
      <Notice text={notice} />

      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucune demande d'extension en attente.</Empty>
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

          {!canDecide && askSuper && (
            <button style={{ ...btnAccept, marginTop:12 }} onClick={() => setAsking(ext)}>
              <Send size={13} /> Demander la validation (avec votre avis)
            </button>
          )}
          {canDecide && <div style={{ marginTop:12, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <input
              placeholder="Notes admin (optionnel)"
              value={notes[ext.id] ?? ''}
              onChange={e => setNotes(n => ({ ...n, [ext.id]: e.target.value }))}
              style={{ ...glassInput, flex:1, maxWidth:300 }}
            />
            <button style={btnAccept} disabled={acting===ext.id} onClick={() => handleValidate(ext, true)}>
              <CheckCircle size={13} /> Approuver
            </button>
            <button style={btnRefuse} disabled={acting===ext.id} onClick={() => handleValidate(ext, false)}>
              <XCircle size={13} /> Refuser
            </button>
          </div>}
          {errors[ext.id] && <div style={{ marginTop:8 }}><ErrorLine>{errors[ext.id]}</ErrorLine></div>}
        </div>
      ))}
      {asking && (
        <RequestModal
          kind="FLEET_EXTENSION"
          title={`Extension de flotte — ${asking.ambassador?.name ?? asking.ambassador?.phone ?? 'chef de flotte'}`}
          intro={`Passer de ${asking.ambassador?.fleetMaxSize ?? '?'} à ${asking.requestedSize} coursiers. Donnez votre avis : le Super Admin décide.`}
          payload={{ extensionId: asking.id, requestedSize: asking.requestedSize }}
          onClose={() => setAsking(null)}
          onDone={() => { setAsking(null); load(true) }}
        />
      )}
    </div>
  )
}

// ── Demandes du Responsable de flottes (niveau 2) ─────────────────────────────
// Super Admin : Valider (l'action s'applique), Refuser (motif obligatoire) ou
// Demander une précision. Les urgentes d'abord.
function RequestCard({ r, highlighted, children }) {
  const details = requestDetails(r)
  return (
    <div style={{ ...card, ...(highlighted ? cardHighlight : {}), ...(r.urgent && r.status === 'PENDING' ? { borderLeft: '4px solid #dc2626' } : {}) }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ fontWeight:700, fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
            {REQUEST_KIND_LABELS[r.kind] ?? r.kind}
            {r.urgent && <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:'#dc2626', padding:'2px 8px', borderRadius:10 }}>URGENT</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
            {r.submittedBy?.name ?? r.submittedBy?.email ?? '—'}
            {r.targetUser && <> · Concerne : {r.targetUser.proBusinessName ?? r.targetUser.name ?? r.targetUser.phone}</>}
            {' · '}{new Date(r.createdAt).toLocaleString('fr-FR')}
          </div>
        </div>
        <StatusBadge status={r.status} />
      </div>
      <div style={{ marginTop:10, fontSize:13 }}><strong>Motif :</strong> {r.reason ?? '—'}</div>
      {r.detail && <div style={{ marginTop:6, fontSize:13, color:'var(--text-muted)', whiteSpace:'pre-wrap' }}>{r.detail}</div>}
      {details.length > 0 && (
        <div style={{ marginTop:8, display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'var(--text-muted)' }}>
          {details.map(d => <span key={d}>{d}</span>)}
        </div>
      )}
      {r.attachmentUrl && (
        <a href={r.attachmentUrl} target="_blank" rel="noreferrer" style={{ marginTop:8, display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600 }}>
          <Paperclip size={13} /> Pièce jointe
        </a>
      )}
      {r.infoQuestion && (
        <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(99,102,241,.07)', borderRadius:8, fontSize:12.5 }}>
          <div><strong>Question du Super Admin :</strong> {r.infoQuestion}</div>
          {r.infoReply && <div style={{ marginTop:4 }}><strong>Réponse :</strong> {r.infoReply}</div>}
        </div>
      )}
      {['APPROVED', 'REJECTED'].includes(r.status) && r.reviewNotes && (
        <div style={{ marginTop:8, fontSize:12.5 }}><strong>{r.status === 'REJECTED' ? 'Motif du refus' : 'Note'} :</strong> {r.reviewNotes}</div>
      )}
      {children}
    </div>
  )
}

// origin : FLOTTE (Responsable de flottes), COMMERCIAL (Commercial / CRM Pro) ou CM (CM / CRM Client)
function FleetRequestsTab({ highlightId, onChanged, origin = 'FLOTTE', emptyText = 'Aucune demande du Responsable de flottes.' }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('OPEN')
  const [action,  setAction]  = useState(null) // { id, mode: 'approve'|'reject'|'ask', text }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: { origin, ...(filter === 'all' ? {} : { status: filter }) } })
      const rows = res.data.requests ?? []
      // Urgentes en attente d'abord, puis les plus anciennes
      setList(rows.sort((a, b) => (b.urgent && b.status === 'PENDING') - (a.urgent && a.status === 'PENDING') || new Date(a.createdAt) - new Date(b.createdAt)))
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter, origin])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  const label = r => REQUEST_KIND_LABELS[r.kind] ?? r.kind
  async function submit(r) {
    const text = action.text.trim()
    if (action.mode !== 'approve' && !text) return
    const done = action.mode === 'approve'
      ? await run(r.id, () => api.patch(`/admin/requests/${r.id}/approve`, { reviewNotes: text || undefined }), `${label(r)} : validée et appliquée.`)
      : action.mode === 'reject'
        ? await run(r.id, () => api.patch(`/admin/requests/${r.id}/reject`, { reviewNotes: text }), `${label(r)} : refusée.`)
        : await run(r.id, () => api.patch(`/admin/requests/${r.id}/ask-info`, { question: text }), `${label(r)} : précision demandée.`)
    if (done) setAction(null)
  }

  const MODES = {
    approve: { placeholder: 'Note (facultative)', button: 'Valider et appliquer', style: btnAccept },
    reject:  { placeholder: 'Motif du refus (obligatoire)', button: 'Confirmer le refus', style: btnRefuse },
    ask:     { placeholder: 'Précision demandée (obligatoire)', button: 'Envoyer la question', style: btnAccept },
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar filters={[['OPEN','À traiter'],['APPROVED','Validées'],['REJECTED','Refusées'],['all','Toutes']]} value={filter} onChange={setFilter} onRefresh={load} />
      <Notice text={notice} />
      {loading ? <Loading />
      : list.length === 0 ? <Empty>{emptyText}</Empty>
      : list.map(r => {
        const mine = action?.id === r.id ? action : null
        return (
          <RequestCard key={r.id} r={r} highlighted={r.id === highlightId}>
            {['PENDING', 'NEEDS_INFO'].includes(r.status) && (
              <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                {mine ? (<>
                  <input autoFocus value={mine.text} onChange={e => setAction({ ...mine, text: e.target.value })} placeholder={MODES[mine.mode].placeholder} style={{ ...glassInput, maxWidth:460 }} />
                  <div style={{ display:'flex', gap:10 }}>
                    <button style={MODES[mine.mode].style} disabled={acting === r.id || (mine.mode !== 'approve' && !mine.text.trim())} onClick={() => submit(r)}>{MODES[mine.mode].button}</button>
                    <button style={btnGhost} disabled={acting === r.id} onClick={() => setAction(null)}>Annuler</button>
                  </div>
                </>) : (
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <button style={btnAccept} onClick={() => setAction({ id: r.id, mode: 'approve', text: '' })}><CheckCircle size={13} /> Valider</button>
                    <button style={btnRefuse} onClick={() => setAction({ id: r.id, mode: 'reject', text: '' })}><XCircle size={13} /> Refuser</button>
                    {r.status === 'PENDING' && (
                      <button style={btnGhost} onClick={() => setAction({ id: r.id, mode: 'ask', text: '' })}><HelpCircle size={13} /> Demander une précision</button>
                    )}
                  </div>
                )}
                {r.status === 'NEEDS_INFO' && !mine && <div style={{ fontSize:12, color:'var(--text-muted)' }}>En attente de la réponse du demandeur.</div>}
                {errors[r.id] && <ErrorLine>{errors[r.id]}</ErrorLine>}
              </div>
            )}
          </RequestCard>
        )
      })}
    </div>
  )
}

// Responsable de flottes : suivi de ses demandes, réponse aux précisions.
function MyRequestsTab({ highlightId, onChanged }) {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [replies, setReplies] = useState({})

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await api.get('/admin/requests', { params: filter === 'all' ? {} : { status: filter } })
      setList(res.data.requests ?? [])
    } catch (e) { console.error(e) }
    finally { if (!silent) setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])
  useAutoRefresh(() => load(true))
  const { acting, errors, notice, run } = useDecisions(load, onChanged)

  async function reply(r) {
    const text = (replies[r.id] ?? '').trim()
    if (!text) return
    const ok = await run(r.id, () => api.patch(`/admin/requests/${r.id}/reply`, { reply: text }), 'Réponse envoyée au Super Admin.')
    if (ok) setReplies(x => ({ ...x, [r.id]: '' }))
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <Toolbar filters={[['all','Toutes'],['PENDING', REQUEST_STATUS_LABELS.PENDING],['NEEDS_INFO', REQUEST_STATUS_LABELS.NEEDS_INFO],['APPROVED','Validées'],['REJECTED','Refusées']]} value={filter} onChange={setFilter} onRefresh={load} />
      <Notice text={notice} />
      {loading ? <Loading />
      : list.length === 0 ? <Empty>Aucune demande. Les actions réservées au Super Admin se demandent depuis les fiches (coursier, course, chef de flotte).</Empty>
      : list.map(r => (
        <RequestCard key={r.id} r={r} highlighted={r.id === highlightId}>
          {r.status === 'NEEDS_INFO' && (
            <div style={{ marginTop:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <input value={replies[r.id] ?? ''} onChange={e => setReplies(x => ({ ...x, [r.id]: e.target.value }))} placeholder="Votre réponse" style={{ ...glassInput, flex:1, maxWidth:460 }} />
              <button style={btnAccept} disabled={acting === r.id || !(replies[r.id] ?? '').trim()} onClick={() => reply(r)}><Send size={13} /> Répondre</button>
              {errors[r.id] && <ErrorLine>{errors[r.id]}</ErrorLine>}
            </div>
          )}
        </RequestCard>
      ))}
    </div>
  )
}
