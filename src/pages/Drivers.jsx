import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import Badge from '../components/Badge'
import SuspendModal from '../components/SuspendModal'
import { RefreshCw, BarChart2, Phone, CheckCircle, XCircle, Eye, Plus, Pencil, Trash2, Search, Flag } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

const DOC_LIST = [
  { key: 'idCardFront',    label: 'CNI recto' },
  { key: 'idCardBack',     label: 'CNI verso' },
  { key: 'licenseFront',   label: 'Permis recto' },
  { key: 'licenseBack',    label: 'Permis verso' },
  { key: 'vehiclePhoto',   label: 'Photo moto' },
  { key: 'carteGrise',     label: 'Carte grise recto' },
  { key: 'carteGriseBack', label: 'Carte grise verso' },
  { key: 'assurance',      label: 'Assurance' },
]

// ── Modal Créer / Modifier livreur ────────────────────────────────────────────
function DriverFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name:         initial?.name         ?? '',
    phone:        initial?.phone        ?? '',
    vehiclePlate: initial?.vehiclePlate ?? '',
    managedById:  initial?.managedById  ?? '',
  })
  const [docs, setDocs]         = useState({ insuranceExpiry: '' })
  const [showDocs, setShowDocs] = useState(false)
  const [chefs, setChefs]       = useState([])
  const [saving, setSaving]     = useState(false)
  const [savingStep, setSavingStep] = useState('')
  const [error, setError]       = useState('')

  useEffect(() => {
    api.get('/admin/chefs-de-flotte', { params: { status: 'all' } })
      .then(r => setChefs(Array.isArray(r.data?.chefs) ? r.data.chefs.filter(c => c.isActive) : []))
      .catch(() => {})
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setDoc(k, v) { setDocs(d => ({ ...d, [k]: v })) }

  const hasFiles = DOC_LIST.some(d => docs[d.key] instanceof File) || !!docs.insuranceExpiry

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, managedById: form.managedById || null }
      let driverId = initial?.id

      if (isEdit) {
        setSavingStep('Mise à jour…')
        await api.patch(`/admin/drivers/${initial.id}`, payload)
      } else {
        setSavingStep('Création du compte…')
        const { data } = await api.post('/admin/drivers', payload)
        driverId = data.driver.id
      }

      if (hasFiles && driverId) {
        setSavingStep('Upload des documents…')
        const fd = new FormData()
        DOC_LIST.forEach(({ key }) => { if (docs[key] instanceof File) fd.append(key, docs[key]) })
        if (docs.insuranceExpiry) fd.append('insuranceExpiry', docs.insuranceExpiry)
        await api.patch(`/admin/drivers/${driverId}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false); setSavingStep('') }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={onClose}>
      <div style={{ ...glass, width: 460, maxWidth: '94vw', borderRadius: 16, padding: 24, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le livreur' : 'Créer un livreur'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}><XCircle size={16} /></button>
        </div>

        {/* Infos de base */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nom complet</label>
          <input type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Moussa Diop" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Téléphone *</label>
          <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+221 77 000 00 00" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Plaque d'immatriculation</label>
          <input type="text" value={form.vehiclePlate} onChange={e => set('vehiclePlate', e.target.value)} placeholder="Ex : DK 1234 AB" style={inputStyle} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Chef de flotte (optionnel)</label>
          <select value={form.managedById} onChange={e => set('managedById', e.target.value)} style={inputStyle}>
            <option value="">— Indépendant —</option>
            {chefs.map(c => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.phone}{c.companyName ? ` · ${c.companyName}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Section documents */}
        <div style={{ borderTop: '1px solid rgba(0,119,182,.12)', paddingTop: 14, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: showDocs ? 14 : 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              Documents livreur {hasFiles ? `(${DOC_LIST.filter(d => docs[d.key] instanceof File).length + (docs.insuranceExpiry ? 1 : 0)} sélectionné(s))` : '(optionnel)'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showDocs ? '▲' : '▼'}</span>
          </button>

          {showDocs && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {DOC_LIST.map(({ key, label }) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <label htmlFor={`doc-${key}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '7px 10px', borderRadius: 8, fontSize: 12,
                    border: `1px solid ${docs[key] ? 'rgba(0,180,100,.5)' : 'rgba(0,119,182,.2)'}`,
                    background: docs[key] ? 'rgba(0,180,100,.07)' : 'rgba(255,255,255,.6)',
                    color: docs[key] ? '#15803d' : 'var(--text-muted)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    <span>{docs[key] ? '✓' : '+'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {docs[key] ? docs[key].name : 'Choisir'}
                    </span>
                    <input id={`doc-${key}`} type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => setDoc(key, e.target.files[0] ?? null)} />
                  </label>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Date expiration assurance</label>
                <input type="date" value={docs.insuranceExpiry} onChange={e => setDoc('insuranceExpiry', e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            {saving ? savingStep || 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Propriétés visuelles fixes par tier (couleurs/emojis non configurables)
const BADGE_VISUALS = {
  gainde:    { emoji: '🏅', color: '#B8860B', bg: '#FFF8E1' },
  buur:      { emoji: '👑', color: '#7B1FA2', bg: '#F3E5F5' },
  domouNdey: { emoji: '⭐', color: '#1565C0', bg: '#E3F2FD' },
  doorWarr:  { emoji: '✅', color: '#00838F', bg: '#E0F7FA' },
  mbokk:     { emoji: '👥', color: '#00695C', bg: '#E0F2F1' },
  xarit:     { emoji: '🤝', color: '#0288D1', bg: '#E1F5FE' },
}

const DEFAULT_BADGE_TIERS = [
  { tier: 'gainde',    name: 'DEM Gainde',     courses: 500, referrals: 0,  rating: 4.2 },
  { tier: 'buur',      name: 'DEM Buur',       courses: 300, referrals: 0,  rating: 4.0 },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', courses: 135, referrals: 0,  rating: 4.0 },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  courses: 70,  referrals: 0,  rating: 3.5 },
  { tier: 'mbokk',     name: 'DEM Mbokk',      courses: 30,  referrals: 12, rating: 3.5 },
  { tier: 'xarit',     name: 'DEM Xarit',      courses: 3,   referrals: 3,  rating: 0   },
]

function computeBadge(courses, referrals, rating, tiers) {
  for (const tier of (tiers ?? DEFAULT_BADGE_TIERS)) {
    const okRating = tier.rating === 0 || rating >= tier.rating
    if (courses >= tier.courses && referrals >= tier.referrals && okRating) return tier
  }
  return null
}

function DriverBadgeChip({ driver, badgeTiers }) {
  const badge = computeBadge(driver.deliveredCourses ?? 0, driver.referralCount ?? 0, driver.avgRating ?? 0, badgeTiers)
  if (!badge) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nouveau</span>
  const v = BADGE_VISUALS[badge.tier] ?? { emoji: '🏅', color: '#888', bg: '#f5f5f5' }
  return (
    <span style={{ background: v.bg, color: v.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {v.emoji} {badge.name}
    </span>
  )
}

function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 80, height: 64, borderRadius: 8, background: 'var(--surface2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span style={{ fontSize: 20 }}>📄</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
  return (
    <>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setZoomed(true)} title={label}>
        <img src={url} alt={label} style={{ width: 80, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,119,182,.15)', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.45)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: '2px 4px', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff' }}>{label}</span>
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

export default function Drivers() {
  const { user } = useAuth()
  const isServiceClient = user?.adminRole === 'SERVICE_CLIENT'
  const LIMIT = 50
  const [drivers, setDrivers]           = useState([])
  const [total, setTotal]               = useState(0)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [badgeTiers, setBadgeTiers]     = useState(null)
  const [fleetFilter, setFleetFilter]   = useState('all')
  const [chefFilter, setChefFilter]     = useState('all')
  const [search, setSearch]             = useState('')
  const [onlineFilter, setOnlineFilter] = useState('all')
  const [verifFilter, setVerifFilter]   = useState('all')
  const [badgeFilter, setBadgeFilter]   = useState('all')
  const [sortCourses, setSortCourses]   = useState(null)
  const [stats, setStats]               = useState(null)
  const [detail, setDetail]             = useState(null)
  const [formTarget, setFormTarget]     = useState(null)
  const [suspendTarget, setSuspendTarget] = useState(null)
  const [suspending, setSuspending]     = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejecting, setRejecting]       = useState(false)
  const [phoneReqs, setPhoneReqs]       = useState([])
  const [phoneLoading, setPhoneLoading] = useState(true)
  const [resolving, setResolving]       = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/drivers', { params: { page, limit: LIMIT } })
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : (Array.isArray(res.data) ? res.data : []))
      setTotal(res.data?.total ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [page])

  const fetchPhoneRequests = useCallback(async () => {
    setPhoneLoading(true)
    try {
      const res = await api.get('/admin/drivers', { params: { status: 'phone-change', limit: 50 } })
      setPhoneReqs(Array.isArray(res.data?.drivers) ? res.data.drivers : [])
    } catch (e) {
      console.error(e)
    } finally {
      setPhoneLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    fetchPhoneRequests()
    api.get('/admin/badges/config')
      .then(r => setBadgeTiers(r.data.badges))
      .catch(() => {})
  }, [fetch, fetchPhoneRequests])

  async function showStats(driverId) {
    setStats({ driverId, loading: true })
    try {
      const res = await api.get(`/admin/drivers/${driverId}/payment-stats`)
      setStats({ driverId, ...res.data })
    } catch (e) {
      setStats(null)
    }
  }

  async function handleSuspendConfirm(reason, fix) {
    if (!suspendTarget) return
    setSuspending(true)
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    try {
      await api.patch(`/admin/drivers/${suspendTarget.id}/suspend`, { reason: fullReason })
      setSuspendTarget(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setSuspending(false)
    }
  }

  async function activateDriver(driver) {
    if (!confirm(`Réactiver ${driver.name ?? driver.phone} ?`)) return
    try {
      await api.patch(`/admin/drivers/${driver.id}/activate`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function activateFleetDriver(driver) {
    if (!confirm(`Activer ${driver.name ?? driver.phone} ? Ce livreur pourra commencer à accepter des courses.`)) return
    try {
      await api.patch(`/admin/drivers/${driver.id}/validate`, { approve: true })
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function handleRejectConfirm(reason, fix) {
    if (!rejectTarget) return
    setRejecting(true)
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    try {
      await api.patch(`/admin/drivers/${rejectTarget.id}/validate`, { approve: false, reason: fullReason })
      setRejectTarget(null)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setRejecting(false)
    }
  }

  async function deleteDriver(driver) {
    if (!confirm(`Supprimer définitivement ${driver.name ?? driver.phone} ? Cette action est irréversible.`)) return
    try {
      await api.delete(`/admin/drivers/${driver.id}`)
      fetch()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function reportDriver(driver) {
    const reason = window.prompt(`Motif du signalement pour ${driver.name ?? driver.phone} :`)
    if (!reason?.trim()) return
    try {
      await api.post('/admin/report-user', { userId: driver.id, userRole: 'DRIVER', reason: reason.trim() })
      alert('Signalement envoyé.')
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function resolvePhoneChange(driverId, approve) {
    setResolving(driverId)
    try {
      await api.patch(`/admin/drivers/${driverId}/phone-change`, { approve })
      await fetchPhoneRequests()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur')
    } finally {
      setResolving(null)
    }
  }

  const chefs = [...new Map(
    drivers.filter(d => d.managedBy).map(d => [d.managedBy.id, d.managedBy])
  ).values()]

  const chefIndexMap = new Map(chefs.map((c, i) => [c.id, i + 1]))

  const visibleDrivers = drivers
    .filter(d =>
      fleetFilter === 'fleet'       ? !!d.managedById :
      fleetFilter === 'independent' ? !d.managedById  : true
    )
    .filter(d =>
      chefFilter === 'all' ? true : d.managedById === chefFilter
    )
    .filter(d =>
      onlineFilter === 'online'  ? d.isAvailable :
      onlineFilter === 'offline' ? !d.isAvailable : true
    )
    .filter(d =>
      verifFilter === 'verified' ? d.isVerified :
      verifFilter === 'pending'  ? !d.isVerified : true
    )
    .filter(d => {
      if (badgeFilter === 'all') return true
      const badge = computeBadge(d.deliveredCourses ?? 0, d.referralCount ?? 0, d.avgRating ?? 0, badgeTiers)
      return badgeFilter === 'nouveau' ? !badge : badge?.tier === badgeFilter
    })
    .filter(d => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (d.name ?? '').toLowerCase().includes(q) || (d.phone ?? '').includes(q)
    })

  const sortedDrivers = sortCourses
    ? [...visibleDrivers].sort((a, b) => {
        const diff = (a.deliveredCourses ?? 0) - (b.deliveredCourses ?? 0)
        return sortCourses === 'asc' ? diff : -diff
      })
    : visibleDrivers

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Livreurs</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { fetch(); fetchPhoneRequests() }} style={btnOutline}>
            <RefreshCw size={14} /> Actualiser
          </button>
          {!isServiceClient && (
            <button onClick={() => setFormTarget({})} style={btnPrimary}>
              <Plus size={14} /> Nouveau livreur
            </button>
          )}
        </div>
      </div>

      {/* ── Demandes changement de numéro ── */}
      {(phoneLoading || phoneReqs.length > 0) && (
        <div style={{ marginBottom: 28, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Phone size={16} color="var(--warning)" />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              Demandes de changement de numéro
            </h2>
            {!phoneLoading && (
              <span style={{
                background: 'rgba(245,158,11,0.15)',
                color: '#F59E0B',
                fontSize: 11, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
              }}>
                {phoneReqs.length}
              </span>
            )}
          </div>

          <div style={card}>
            {phoneLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['Livreur', 'Véhicule', 'Numéro actuel', '', 'Nouveau numéro', 'Actions'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {phoneReqs.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{d.name ?? '—'}</div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {d.vehicleType === 'MOTO' ? '🏍 Moto' : '🚗 Voiture'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.phone}</span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 18, textAlign: 'center' }}>→</td>
                      <td style={tdStyle}>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
                          {d.pendingPhone ?? '—'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {isServiceClient ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Lecture seule</span>
                        ) : resolving === d.id ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>En cours…</span>
                        ) : (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={() => resolvePhoneChange(d.id, true)}
                              style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}
                            >
                              <CheckCircle size={13} /> Approuver
                            </button>
                            <button
                              onClick={() => resolvePhoneChange(d.id, false)}
                              style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}
                            >
                              <XCircle size={13} /> Refuser
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Liste complète drivers ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>Tous les livreurs</h2>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {[
            ['all',         'Tous'],
            ['fleet',       '🏍 Flotte'],
            ['independent', '👤 Indépendants'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFleetFilter(key)} style={{
              padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
              background: fleetFilter === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
              color: fleetFilter === key ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Recherche & filtres ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom ou téléphone…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <select value={chefFilter} onChange={e => setChefFilter(e.target.value)} style={{ ...glassInput, width: 200 }}>
          <option value="all">Chef de flotte : Tous</option>
          {chefs.map(c => (
            <option key={c.id} value={c.id}>{c.companyName || c.name || c.phone}</option>
          ))}
        </select>
        <select value={onlineFilter} onChange={e => setOnlineFilter(e.target.value)} style={{ ...glassInput, width: 160 }}>
          <option value="all">Disponibilité : Tous</option>
          <option value="online">🟢 En ligne</option>
          <option value="offline">⚪ Hors ligne</option>
        </select>
        <select value={verifFilter} onChange={e => setVerifFilter(e.target.value)} style={{ ...glassInput, width: 160 }}>
          <option value="all">Vérification : Tous</option>
          <option value="verified">✓ Vérifié</option>
          <option value="pending">En attente</option>
        </select>
        <select value={badgeFilter} onChange={e => setBadgeFilter(e.target.value)} style={{ ...glassInput, width: 180 }}>
          <option value="all">Badge : Tous</option>
          <option value="nouveau">Nouveau</option>
          {(badgeTiers ?? DEFAULT_BADGE_TIERS).map(t => (
            <option key={t.tier} value={t.tier}>{BADGE_VISUALS[t.tier]?.emoji} {t.name}</option>
          ))}
        </select>
      </div>
      <div style={pageScroll}>
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : (
          <table style={{ ...tableStyle, minWidth: 900 }}>
            <thead>
              <tr>
                {['#', 'Nom', 'Badge', 'Courses', 'Téléphone', 'Véhicule', 'Statut', 'Vérifié', 'Actions'].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      ...thStyle, ...(i === 0 ? stickyThCol : stickyTh),
                      ...(h === 'Courses' ? { cursor: 'pointer', userSelect: 'none' } : {}),
                    }}
                    onClick={h === 'Courses'
                      ? () => setSortCourses(s => s === 'desc' ? 'asc' : s === 'asc' ? null : 'desc')
                      : undefined}
                    title={h === 'Courses' ? 'Trier par nombre de courses' : undefined}
                  >
                    {h}{h === 'Courses' && (sortCourses === 'desc' ? ' ▼' : sortCourses === 'asc' ? ' ▲' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDrivers.map((d, idx) => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, width: 40, textAlign: 'center' }}>{(page - 1) * LIMIT + idx + 1}</td>
                  <td style={{ ...tdStyle, ...stickyCol }}>
                    <div style={{ fontWeight: 600 }}>{d.name?.trim() || d.phone}</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                      <Badge status={d.isAvailable ? 'ONLINE' : 'OFFLINE'} />
                      {d.managedById && (
                        <span title={d.managedBy?.companyName || d.managedBy?.name || d.managedBy?.phone || ''} style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                          background: d.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? 'rgba(124,58,237,.10)' : 'rgba(245,158,11,.12)',
                          color:      d.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? '#7c3aed' : '#b45309',
                        }}>
                          CF.{chefIndexMap.get(d.managedById) ?? '?'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={tdStyle}><DriverBadgeChip driver={d} badgeTiers={badgeTiers} /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{d.deliveredCourses ?? 0}</div>
                    {d.avgRating > 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>★ {d.avgRating}</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {d.phone ? <a href={`tel:${d.phone}`} style={{ color: '#0077b6' }}>{d.phone}</a> : '—'}
                  </td>
                  <td style={tdStyle}>{d.vehicleType ?? '—'}</td>
                  <td style={tdStyle}>
                    {d.chefDeFlotteStatus === 'PENDING'
                      ? <span style={{ color: '#f59e0b' }}>⏳ En attente</span>
                      : d.chefDeFlotteStatus === 'REJECTED'
                        ? <span style={{ color: 'var(--danger)' }}>✗ Refusé</span>
                        : d.isActive
                          ? <span style={{ color: 'var(--success)' }}>✓ Actif</span>
                          : <span style={{ color: 'var(--danger)' }}>Suspendu</span>}
                  </td>
                  <td style={tdStyle}>
                    {d.isVerified
                      ? <span style={{ color: 'var(--success)' }}>✓</span>
                      : <span style={{ color: 'var(--warning)' }}>En attente</span>}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      <button onClick={() => setDetail(d)} style={btnSmall} title="Voir infos & documents">
                        <Eye size={13} />
                      </button>
                      {isServiceClient ? (
                        <>
                          {d.phone && (
                            <a href={`tel:${d.phone}`} style={btnSmall} title="Appeler">
                              <Phone size={13} />
                            </a>
                          )}
                          <button onClick={() => reportDriver(d)} style={{ ...btnSmall, color: '#dc2626', borderColor: '#dc2626' }} title="Signaler">
                            <Flag size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => showStats(d.id)} style={btnSmall} title="Statistiques paiement">
                            <BarChart2 size={13} />
                          </button>
                          <button onClick={() => setFormTarget(d)} style={btnSmall} title="Modifier">
                            <Pencil size={13} />
                          </button>
                          {d.chefDeFlotteStatus === 'PENDING' ? (
                            <>
                              <button onClick={() => activateFleetDriver(d)} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}>Activer</button>
                              <button onClick={() => setRejectTarget(d)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}>Refuser</button>
                            </>
                          ) : d.isActive ? (
                            <button onClick={() => setSuspendTarget(d)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}>Suspendre</button>
                          ) : (
                            <button onClick={() => activateDriver(d)} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}>Réactiver</button>
                          )}
                          <button onClick={() => deleteDriver(d)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Supprimer">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>

      {/* Pagination */}
      {(() => {
        const totalPages = Math.max(1, Math.ceil(total / LIMIT))
        return totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, flexShrink: 0 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Page {page} / {totalPages} — {total} livreurs
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
          </div>
        )
      })()}

      {/* Modal suspension driver */}
      {suspendTarget && (
        <SuspendModal
          target="driver"
          onConfirm={handleSuspendConfirm}
          onClose={() => setSuspendTarget(null)}
          loading={suspending}
        />
      )}

      {/* Modal refus driver (nouveau livreur de flotte en attente) */}
      {rejectTarget && (
        <SuspendModal
          target="driver"
          title="Motif de refus"
          confirmLabel="Confirmer le refus"
          loadingLabel="Refus…"
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
          loading={rejecting}
        />
      )}

      {/* Modal détail driver */}
      {detail && (
        <div style={overlay} onClick={() => setDetail(null)}>
          <div style={{ ...modalBox, width: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#0CB8DE,#0671BA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                {detail.avatar
                  ? <img src={detail.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                  : (detail.name ?? '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{detail.name ?? '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{detail.phone}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 20, fontWeight: 600, background: detail.isActive ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', color: detail.isActive ? '#059669' : '#dc2626' }}>
                  {detail.isActive ? '✓ Actif' : 'Suspendu'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {detail.vehicleType === 'MOTO' ? '🏍 Moto' : detail.vehicleType === 'TAXI' ? '🚗 Taxi' : '—'}
                </span>
              </div>
            </div>

            {/* Infos */}
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Informations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                {[
                  ['Plaque', detail.vehiclePlate ?? '—'],
                  ['Email', detail.email ?? '—'],
                  ['Vérifié', detail.isVerified ? '✓ Oui' : 'Non'],
                  ['Inscrit le', detail.createdAt ? new Date(detail.createdAt).toLocaleDateString('fr-FR') : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ambassadeur */}
            {detail.managedById && (
              <div style={{ background: 'rgba(124,58,237,.06)', border: '1px solid rgba(124,58,237,.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>👤 Flotte AM : </span>
                <span>{detail.managedBy?.name ?? '—'}</span>
                <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 8, background: detail.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? 'rgba(124,58,237,.12)' : 'rgba(245,158,11,.12)', color: detail.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? '#7c3aed' : '#b45309', fontWeight: 700 }}>
                  {detail.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? 'AM ✓' : 'AM ⏳'}
                </span>
              </div>
            )}

            {/* Documents */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Documents</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <DocThumb url={detail.licenseFront}  label="Permis recto" />
                <DocThumb url={detail.licenseBack}   label="Permis verso" />
                <DocThumb url={detail.vehiclePhoto}  label="Véhicule" />
                <DocThumb url={detail.casquePhoto}   label="Casque" />
                <DocThumb url={detail.cniRecto}      label="CNI recto" />
                <DocThumb url={detail.cniVerso}      label="CNI verso" />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button onClick={() => setDetail(null)} style={btnOutline}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal créer / modifier driver */}
      {formTarget !== null && (
        <DriverFormModal
          initial={formTarget.id ? formTarget : null}
          onClose={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); fetch() }}
        />
      )}

      {/* Modal stats */}
      {stats && (
        <div style={overlay} onClick={() => setStats(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 20, fontSize: 16 }}>Statistiques paiement</h2>
            {stats.loading ? (
              <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  ['Courses payées',   stats.paidOrders,    'var(--success)'],
                  ['Total gagné',      `${(stats.totalEarned ?? 0).toLocaleString()} F`, 'var(--primary)'],
                  ['En attente',       stats.pendingOrders, 'var(--warning)'],
                  ['Litiges',          stats.disputedOrders,'var(--danger)'],
                ].map(([label, val, color]) => (
                  <div key={label} style={{
                    background: 'var(--surface2)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    borderLeft: `3px solid ${color}`,
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={() => setStats(null)} style={btnOutline}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const card       = { ...glass, padding: '20px 24px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, padding: '28px 32px', width: 440, maxWidth: '90vw' }
