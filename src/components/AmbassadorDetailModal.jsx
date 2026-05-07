import { useState, useEffect } from 'react'
import api from '../lib/api'
import { glass } from '../lib/glassStyles'
import { X, RefreshCw } from 'lucide-react'

function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 72, height: 56, borderRadius: 8, background: 'var(--surface2)', border: '1px dashed rgba(0,0,0,.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      <span style={{ fontSize: 16 }}>📄</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: '0 4px' }}>{label}</span>
    </div>
  )
  return (
    <>
      <div style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setZoomed(true)} title={label}>
        <img src={url} alt={label} style={{ width: 72, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,119,182,.15)', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.45)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: '2px 0', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff' }}>{label}</span>
        </div>
      </div>
      {zoomed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.80)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setZoomed(false)}>
          <img src={url} alt={label} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </>
  )
}

function StatusBadge({ status, isActive }) {
  if (!isActive) return <span style={badge('#dc2626', 'rgba(239,68,68,.10)')}>Suspendu</span>
  if (status === 'ACTIVE')   return <span style={badge('#15803d', 'rgba(34,197,94,.10)')}>Actif</span>
  if (status === 'PENDING')  return <span style={badge('#b45309', 'rgba(245,158,11,.10)')}>En attente</span>
  if (status === 'REJECTED') return <span style={badge('#dc2626', 'rgba(239,68,68,.10)')}>Refusé</span>
  return null
}

function badge(color, bg) {
  return { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color, background: bg }
}

export default function AmbassadorDetailModal({ ambassadorId, onClose }) {
  const [am, setAm]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!ambassadorId) return
    setLoading(true)
    api.get(`/admin/ambassadors/${ambassadorId}`)
      .then(r => { setAm(r.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ambassadorId])

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* ── Barre du haut ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid rgba(0,119,182,.10)', flexShrink: 0 }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>Détail ambassadeur</div>
          {!loading && am && (
            <button onClick={() => { setLoading(true); api.get(`/admin/ambassadors/${ambassadorId}`).then(r => { setAm(r.data); setLoading(false) }) }}
              style={btnIcon} title="Actualiser">
              <RefreshCw size={14} />
            </button>
          )}
          <button onClick={onClose} style={btnIcon} title="Fermer"><X size={18} /></button>
        </div>

        {/* ── Contenu ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Chargement…</div>
          ) : !am ? (
            <div style={{ color: 'var(--danger)', padding: 40, textAlign: 'center' }}>Erreur de chargement.</div>
          ) : (<>

            {/* ── Profil AM ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#0CB8DE,#0671BA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 800, flexShrink: 0, overflow: 'hidden' }}>
                {am.avatar
                  ? <img src={am.avatar} alt="" style={{ width: 52, height: 52, objectFit: 'cover' }} />
                  : (am.name ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{am.name ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{am.phone}</div>
              </div>
              <StatusBadge status={am.ambassadorStatus} isActive={am.isActive} />
            </div>

            {/* Infos entreprise */}
            {(am.companyName || am.ninea || am.rccm) && (
              <div style={{ ...infoBox, marginBottom: 16 }}>
                <div style={sectionLabel}>Entreprise</div>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
                  {am.companyName && <span><span style={{ color: 'var(--text-muted)' }}>Nom : </span><strong>{am.companyName}</strong></span>}
                  {am.ninea       && <span><span style={{ color: 'var(--text-muted)' }}>NINEA : </span><strong>{am.ninea}</strong></span>}
                  {am.rccm        && <span><span style={{ color: 'var(--text-muted)' }}>RCCM : </span><strong>{am.rccm}</strong></span>}
                </div>
              </div>
            )}

            {/* Documents AM */}
            <div style={{ ...infoBox, marginBottom: 20 }}>
              <div style={sectionLabel}>Documents ambassadeur</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <DocThumb url={am.cniRecto} label="CNI recto" />
                <DocThumb url={am.cniVerso} label="CNI verso" />
              </div>
            </div>

            {/* Flotte */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Flotte ({am.managedDrivers?.length ?? 0} / {am.fleetMaxSize ?? 10} livreurs)
              </div>
              <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, width: `${Math.min(100, ((am.managedDrivers?.length ?? 0) / (am.fleetMaxSize ?? 10)) * 100)}%`, background: 'linear-gradient(90deg,#0CB8DE,#0671BA)' }} />
              </div>
            </div>

            {/* Liste drivers */}
            {!am.managedDrivers?.length ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>Aucun livreur dans cette flotte.</div>
            ) : am.managedDrivers.map(d => {
              const scores = d.ratingsReceived?.map(r => r.score) ?? []
              const avg    = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : null
              const courses = d._count?.ordersAsDriver ?? 0
              const isOpen  = expanded === d.id

              return (
                <div key={d.id} style={{ ...infoBox, marginBottom: 10 }}>
                  {/* Ligne résumé driver */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : d.id)}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,180,216,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#0671BA', fontSize: 14, flexShrink: 0 }}>
                      {(d.name ?? '?')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name ?? '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {d.phone}
                        {d.vehicleType && <> · {d.vehicleType === 'MOTO' ? '🏍' : '🚗'} {d.vehiclePlate ?? ''}</>}
                        <> · {courses} courses</>
                        {avg && <> · ★ {avg}</>}
                      </div>
                    </div>
                    <StatusBadge status={d.ambassadorStatus} isActive={d.isActive} />
                    <span style={{ color: 'var(--text-muted)', fontSize: 16, marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {/* Documents driver (dépliables) */}
                  {isOpen && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.06)' }}>
                      <div style={sectionLabel}>Documents</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <DocThumb url={d.licenseFront}  label="Permis recto" />
                        <DocThumb url={d.licenseBack}   label="Permis verso" />
                        <DocThumb url={d.vehiclePhoto}  label="Véhicule" />
                        <DocThumb url={d.casquePhoto}   label="Casque" />
                        <DocThumb url={d.cniRecto}      label="CNI recto" />
                        <DocThumb url={d.cniVerso}      label="CNI verso" />
                      </div>
                      {d.isVerified && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#15803d', fontWeight: 600 }}>✓ Dossier vérifié</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>)}
        </div>
      </div>
    </div>
  )
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,20,50,.50)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }
const panel      = { ...glass, width: 520, maxWidth: '95vw', height: '100vh', borderRadius: '16px 0 0 16px', display: 'flex', flexDirection: 'column' }
const infoBox    = { background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }
const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const btnIcon    = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(0,0,0,.10)', background: 'rgba(255,255,255,.5)', cursor: 'pointer', color: 'var(--text-muted)' }
