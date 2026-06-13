import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp, Ban, RotateCcw } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../lib/glassStyles'
import SuspendModal from '../components/SuspendModal'

const DOC_LIST = [
  { key: 'idCardFront',    label: 'CNI recto' },
  { key: 'idCardBack',     label: 'CNI verso' },
  { key: 'licenseFront',   label: 'Permis recto' },
  { key: 'licenseBack',    label: 'Permis verso' },
  { key: 'vehiclePhoto',   label: 'Photo véhicule' },
  { key: 'carteGrise',     label: 'Carte grise recto' },
  { key: 'carteGriseBack', label: 'Carte grise verso' },
  { key: 'assurance',      label: 'Assurance' },
  { key: 'casquePhoto',    label: 'Casque' },
]

// ── Vignette document (zoomable) ───────────────────────────────────────────────
function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 70, height: 56, borderRadius: 8, background: 'rgba(0,119,182,.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <span style={{ fontSize: 16 }}>📄</span>
      <span style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', padding: '0 4px' }}>{label}</span>
    </div>
  )
  return (
    <>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setZoomed(true)} title={label}>
        <img src={url} alt={label} style={{ width: 70, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,119,182,.15)', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.45)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: '2px 4px', textAlign: 'center' }}>
          <span style={{ fontSize: 8, color: '#fff' }}>{label}</span>
        </div>
      </div>
      {zoomed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setZoomed(false)}>
          <img src={url} alt={label} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </>
  )
}

// ── Statut d'un livreur géré ─────────────────────────────────────────────────
function driverStatusInfo(d) {
  if (d.chefDeFlotteStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (d.chefDeFlotteStatus === 'REJECTED') return { text: '✗ Refusé',     color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE' && !d.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE')   return { text: '✓ Actif',       color: '#22c55e' }
  return { text: d.chefDeFlotteStatus ?? '—', color: '#888' }
}

// ── Helpers statut chef ──────────────────────────────────────────────────────
function statusLabel(s) {
  return { PENDING: '⏳ En attente', ACTIVE: '✓ Actif', REJECTED: '✗ Refusé' }[s] ?? s ?? '—'
}
function statusColor(s) {
  return { PENDING: '#f59e0b', ACTIVE: '#22c55e', REJECTED: '#ef4444' }[s] ?? '#888'
}
function statusBg(s) {
  return { PENDING: 'rgba(245,158,11,.2)', ACTIVE: 'rgba(34,197,94,.2)', REJECTED: 'rgba(239,68,68,.2)' }[s] ?? 'rgba(0,0,0,.1)'
}
function chefStatusInfo(c) {
  if (!c.isActive) return { text: '⚠ Suspendu', color: '#ef4444', bg: 'rgba(239,68,68,.2)' }
  return { text: statusLabel(c.chefDeFlotteStatus), color: statusColor(c.chefDeFlotteStatus), bg: statusBg(c.chefDeFlotteStatus) }
}

// ── Page détail chef de flotte ────────────────────────────────────────────────
export default function ChefDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chef, setChef] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedDriver, setExpandedDriver] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [acting, setActing] = useState(false)
  const [reasonModal, setReasonModal] = useState(null) // { kind: 'chef-suspend'|'driver-reject'|'driver-suspend', target }

  const refetch = useCallback(() => {
    return api.get(`/admin/chefs-de-flotte/${id}`)
      .then(r => setChef(r.data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    refetch().finally(() => setLoading(false))
  }, [refetch])

  async function validateDriver(driver, approve) {
    setActingId(driver.id)
    try {
      await api.patch(`/admin/drivers/${driver.id}/validate`, { approve })
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActingId(null)
    }
  }

  async function reactivateDriver(driver) {
    if (!confirm(`Réactiver ${driver.name?.trim() || driver.phone} ?`)) return
    setActingId(driver.id)
    try {
      await api.patch(`/admin/drivers/${driver.id}/activate`)
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActingId(null)
    }
  }

  async function reactivateChef() {
    if (!confirm(`Réactiver ${chef.name?.trim() || chef.phone} comme chef de flotte ?`)) return
    setActing(true)
    try {
      await api.patch(`/admin/chefs-de-flotte/${id}/validate`, { approve: true })
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActing(false)
    }
  }

  async function handleReasonConfirm(reason, fix) {
    if (!reasonModal) return
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    setActing(true)
    try {
      if (reasonModal.kind === 'chef-suspend') {
        await api.patch(`/admin/chefs-de-flotte/${id}/suspend`, { reason: fullReason })
      } else if (reasonModal.kind === 'driver-reject') {
        await api.patch(`/admin/drivers/${reasonModal.target.id}/validate`, { approve: false, reason: fullReason })
      } else if (reasonModal.kind === 'driver-suspend') {
        await api.patch(`/admin/drivers/${reasonModal.target.id}/suspend`, { reason: fullReason })
      }
      setReasonModal(null)
      await refetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActing(false)
    }
  }

  if (loading) {
    return (
      <div style={pageWrap}>
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
      </div>
    )
  }

  if (!chef) {
    return (
      <div style={pageWrap}>
        <button onClick={() => navigate('/chefs-de-flotte')} style={{ ...btnOutline, marginBottom: 16, alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> Retour
        </button>
        <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chef de flotte introuvable.</div>
      </div>
    )
  }

  const drivers = chef.managedDrivers ?? []
  const totalDrivers   = drivers.length
  const activeDrivers  = drivers.filter(d => d.chefDeFlotteStatus === 'ACTIVE' && d.isActive).length
  const pendingDrivers = drivers.filter(d => d.chefDeFlotteStatus === 'PENDING').length
  const totalCourses   = drivers.reduce((s, d) => s + (d._count?.ordersAsDriver ?? 0), 0)
  const allScores      = drivers.flatMap(d => d.ratingsReceived?.map(r => r.score) ?? [])
  const avgFleetRating = allScores.length > 0 ? Math.round((allScores.reduce((s, r) => s + r, 0) / allScores.length) * 10) / 10 : null

  const status = chefStatusInfo(chef)

  return (
    <div style={pageWrap}>
      {/* En-tête */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 16, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/chefs-de-flotte')} style={btnIcon} title="Retour">
          <ArrowLeft size={18} />
        </button>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
          {chef.avatar ? <img src={chef.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (chef.name?.trim() || chef.phone || '?')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{chef.name?.trim() || chef.phone}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{chef.phone}</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>
          {status.text}
        </span>
        {chef.isActive ? (
          <button onClick={() => setReasonModal({ kind: 'chef-suspend' })} disabled={acting} style={{ ...btnOutline, color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Ban size={14} /> Suspendre
          </button>
        ) : (
          <button onClick={reactivateChef} disabled={acting} style={{ ...btnOutline, color: 'var(--success)', borderColor: 'var(--success)' }}>
            <RotateCcw size={14} /> Réactiver
          </button>
        )}
      </div>

      <div style={pageScroll}>
        {/* Informations */}
        <div style={infoBox}>
          <div style={sectionLabel}>Informations</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px' }}>
            {[
              ['Société',     chef.companyName ?? '—'],
              ['NINEA',       chef.ninea ?? '—'],
              ['RCCM',        chef.rccm ?? '—'],
              ['Flotte max.', chef.fleetMaxSize ?? '—'],
              ['Livreurs',    chef._count?.managedDrivers ?? 0],
              ['Inscrit le',  chef.createdAt ? new Date(chef.createdAt).toLocaleDateString('fr-FR') : '—'],
              ['Actif',       chef.isActive ? '✓ Oui' : 'Non'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
          {chef.chefDeFlotteStatus === 'REJECTED' && chef.rejectionReason && (
            <div style={{ ...errorStyle, marginTop: 10 }}>Motif de refus : {chef.rejectionReason}</div>
          )}
          {!chef.isActive && chef.suspensionReason && (
            <div style={{ ...errorStyle, marginTop: 10 }}>Motif de suspension : {chef.suspensionReason}</div>
          )}
        </div>

        {/* Statistiques de la flotte */}
        <div style={{ ...infoBox, marginTop: 14 }}>
          <div style={sectionLabel}>Statistiques de la flotte</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px 16px' }}>
            {[
              ['Total livreurs',  totalDrivers],
              ['Livreurs actifs', activeDrivers],
              ['En attente',      pendingDrivers],
              ['Courses livrées', totalCourses],
              ['Note moyenne',    avgFleetRating != null ? `★ ${avgFleetRating}` : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Livreurs gérés */}
        <div style={{ ...infoBox, marginTop: 14, marginBottom: 14 }}>
          <div style={sectionLabel}>Livreurs gérés ({drivers.length})</div>
          {drivers.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun livreur ajouté pour le moment.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {drivers.map(dr => {
                const dStatus = driverStatusInfo(dr)
                const scores = dr.ratingsReceived?.map(r => r.score) ?? []
                const avgRating = scores.length > 0 ? Math.round((scores.reduce((s, r) => s + r, 0) / scores.length) * 10) / 10 : null
                const expanded = expandedDriver === dr.id
                return (
                  <div key={dr.id} style={{ border: '1px solid rgba(0,119,182,.12)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: dStatus.color }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{dr.name?.trim() || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {dr.phone} · {dr.vehicleType}{dr.vehiclePlate ? ` · ${dr.vehiclePlate}` : ''} · {dr._count?.ordersAsDriver ?? 0} courses{avgRating != null ? ` · ★ ${avgRating}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: dStatus.color, whiteSpace: 'nowrap' }}>{dStatus.text}</span>
                      {dr.chefDeFlotteStatus === 'PENDING' && (
                        <>
                          <button onClick={() => validateDriver(dr, true)} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--success)' }} title="Valider">
                            <CheckCircle size={15} />
                          </button>
                          <button onClick={() => setReasonModal({ kind: 'driver-reject', target: dr })} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--danger)' }} title="Refuser">
                            <XCircle size={15} />
                          </button>
                        </>
                      )}
                      {dr.chefDeFlotteStatus === 'ACTIVE' && dr.isActive && (
                        <button onClick={() => setReasonModal({ kind: 'driver-suspend', target: dr })} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--danger)' }} title="Suspendre">
                          <Ban size={15} />
                        </button>
                      )}
                      {dr.chefDeFlotteStatus === 'ACTIVE' && !dr.isActive && (
                        <button onClick={() => reactivateDriver(dr)} disabled={actingId === dr.id} style={{ ...btnIcon, color: 'var(--success)' }} title="Réactiver">
                          <RotateCcw size={15} />
                        </button>
                      )}
                      <button onClick={() => setExpandedDriver(expanded ? null : dr.id)} style={btnIcon} title="Documents">
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>

                    {expanded && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,119,182,.08)' }}>
                        {dr.chefDeFlotteStatus === 'REJECTED' && dr.rejectionReason && (
                          <div style={{ ...errorStyle, marginBottom: 10 }}>Motif de refus : {dr.rejectionReason}</div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {DOC_LIST.map(({ key, label }) => (
                            <DocThumb key={key} url={dr[key]} label={label} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {reasonModal?.kind === 'chef-suspend' && (
        <SuspendModal
          target="ambassador"
          onConfirm={handleReasonConfirm}
          onClose={() => setReasonModal(null)}
          loading={acting}
        />
      )}
      {reasonModal?.kind === 'driver-reject' && (
        <SuspendModal
          target="driver"
          title="Motif de refus"
          confirmLabel="Confirmer le refus"
          loadingLabel="Refus…"
          onConfirm={handleReasonConfirm}
          onClose={() => setReasonModal(null)}
          loading={acting}
        />
      )}
      {reasonModal?.kind === 'driver-suspend' && (
        <SuspendModal
          target="driver"
          onConfirm={handleReasonConfirm}
          onClose={() => setReasonModal(null)}
          loading={acting}
        />
      )}
    </div>
  )
}

const infoBox      = { background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }
const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
