import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { glass, glassInput, pageWrap, pageScroll } from '../lib/glassStyles'
import { RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Shield, Truck, Layers, AlertTriangle } from 'lucide-react'
import SuspendModal from '../components/SuspendModal'
import AmbassadorDetailModal from '../components/AmbassadorDetailModal'

// ── Styles partagés ───────────────────────────────────────────────────────────
const card      = { ...glass, padding: '18px 20px' }
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
  const [tab, setTab] = useState('ambassadors')

  return (
    <div style={pageWrap}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20, flexShrink: 0 }}>Validation</h1>
      <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(255,255,255,.45)', borderRadius:'var(--radius)', padding:4, width:'fit-content', flexShrink: 0 }}>
        <button style={TAB(tab === 'ambassadors')} onClick={() => setTab('ambassadors')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Shield size={13} />Ambassadeurs</span>
        </button>
        <button style={TAB(tab === 'drivers')} onClick={() => setTab('drivers')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Truck size={13} />Livreurs en attente</span>
        </button>
        <button style={TAB(tab === 'fleet')} onClick={() => setTab('fleet')}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><Layers size={13} />Extensions flotte</span>
        </button>
      </div>
      <div style={pageScroll}>
        {tab === 'ambassadors' && <AmbassadorsTab />}
        {tab === 'drivers'     && <DriversTab />}
        {tab === 'fleet'       && <FleetTab />}
      </div>
    </div>
  )
}

// ── Tab Ambassadeurs ──────────────────────────────────────────────────────────
function AmbassadorsTab() {
  const [list,     setList]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('PENDING')
  const [expanded,      setExpanded]      = useState(null)
  const [reason,        setReason]        = useState('')
  const [acting,        setActing]        = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspending,    setSuspending]    = useState(false)
  const [detailAmId,    setDetailAmId]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/chefs-de-flotte', { params: { status: filter } })
      setList(res.data.chefs ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

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
      : list.length === 0 ? <div style={{ ...card, color:'var(--text-muted)', textAlign:'center', padding:32 }}>Aucun ambassadeur.</div>
      : list.map(am => {
        const isOpen = expanded === am.id
        return (
          <div key={am.id} style={card}>
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

                {/* Action ACTIVE → Suspendre */}
                {am.chefDeFlotteStatus === 'ACTIVE' && (
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
function DriversTab() {
  const [list,     setList]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [reason,   setReason]   = useState('')
  const [acting,   setActing]   = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/drivers/pending')
      setList(res.data.drivers ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
          <div key={d.id} style={card}>
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
                      <strong>Activation bloquée</strong> — L'ambassadeur <em>{d.managedBy?.name ?? ''}</em> n'est pas encore validé ({d.managedBy?.chefDeFlotteStatus ?? '—'}).
                      Validez d'abord l'ambassadeur dans l'onglet <strong>Ambassadeurs</strong>.
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
                      title={!canValidate ? (amNotActive ? 'Validez d\'abord l\'ambassadeur' : 'Assurance expirée') : ''}
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

// ── Tab Extensions flotte ─────────────────────────────────────────────────────
function FleetTab() {
  const [list,    setList]    = useState([])
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(null)
  const [notes,   setNotes]   = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/fleet-extensions', { params: { status: 'PENDING' } })
      setList(res.data.extensions ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

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
        <div key={ext.id} style={card}>
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
