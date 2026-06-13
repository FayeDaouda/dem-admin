import { useState, useEffect, useCallback } from 'react'
import fleetApi from '../../lib/fleetApi'
import { RefreshCw, Plus, X, Star, Eye } from 'lucide-react'
import { glass, glassSolid, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../../lib/glassStyles'

const STATUS_TABS = [
  ['all',       'Tous'],
  ['active',    '✓ Actifs'],
  ['pending',   '⏳ En attente'],
  ['rejected',  '✗ Refusés'],
  ['suspended', '⚠ Suspendus'],
]

const DOC_LIST = [
  { key: 'idCardFront',    label: 'CNI recto' },
  { key: 'idCardBack',     label: 'CNI verso' },
  { key: 'licenseFront',   label: 'Permis recto' },
  { key: 'licenseBack',    label: 'Permis verso' },
  { key: 'vehiclePhoto',   label: 'Photo moto' },
  { key: 'carteGrise',     label: 'Carte grise recto' },
  { key: 'carteGriseBack', label: 'Carte grise verso' },
  { key: 'assurance',      label: 'Assurance' },
  { key: 'casquePhoto',    label: 'Casque' },
]

function driverStatusLabel(d) {
  if (d.chefDeFlotteStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (d.chefDeFlotteStatus === 'REJECTED') return { text: '✗ Refusé',     color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE' && !d.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE')   return { text: '✓ Actif',       color: '#22c55e' }
  return { text: d.chefDeFlotteStatus ?? '—', color: '#888' }
}

// ── Vignette document (zoomable) ───────────────────────────────────────────────
function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 80, height: 64, borderRadius: 8, background: 'rgba(0,119,182,.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span style={{ fontSize: 18 }}>📄</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', padding: '0 4px' }}>{label}</span>
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

// ── Sélecteur de fichier document ───────────────────────────────────────────────
function DocPicker({ file, hasExisting, onPick }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer',
      padding: '6px 8px', borderRadius: 8, fontSize: 11,
      border: `1px solid ${file ? 'rgba(0,180,100,.5)' : 'rgba(0,119,182,.2)'}`,
      background: file ? 'rgba(0,180,100,.07)' : 'rgba(255,255,255,.6)',
      color: file ? '#15803d' : 'var(--text-muted)',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: 80, boxSizing: 'border-box',
    }}>
      <span>{file ? `✓ ${file.name}` : hasExisting ? '↻ Remplacer' : '+ Ajouter'}</span>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => onPick(e.target.files[0] ?? null)} />
    </label>
  )
}

// ── Modal Nouveau livreur ──────────────────────────────────────────────────────
function NewDriverModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ phone: '+221 ', name: '' })
  const [docs, setDocs] = useState({ insuranceExpiry: '' })
  const [showDocs, setShowDocs] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingStep, setSavingStep] = useState('')
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setDoc(k, v) { setDocs(d => ({ ...d, [k]: v })) }

  const filesCount = DOC_LIST.filter(d => docs[d.key] instanceof File).length
  const hasFiles = filesCount > 0 || !!docs.insuranceExpiry

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      setSavingStep('Création du compte…')
      const { data } = await fleetApi.post('/chefs-de-flotte/me/drivers', { ...form, vehicleType: 'MOTO' })
      const driverId = data.driver.id

      if (hasFiles) {
        setSavingStep('Upload des documents…')
        const fd = new FormData()
        DOC_LIST.forEach(({ key }) => { if (docs[key] instanceof File) fd.append(key, docs[key]) })
        if (docs.insuranceExpiry) fd.append('insuranceExpiry', docs.insuranceExpiry)
        await fleetApi.patch(`/chefs-de-flotte/me/drivers/${driverId}/documents`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false); setSavingStep('') }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 460, maxWidth: '94vw', borderRadius: 16, padding: 24, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Nouveau livreur</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Téléphone *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+221 77 000 00 00"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nom complet</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex : Moussa Diop"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Type de véhicule</label>
          <div style={{ ...inputStyle, color: 'var(--text-muted)', background: 'rgba(0,119,182,.06)' }}>🏍 Moto</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Seul le type Moto est disponible pour le moment.
          </div>
        </div>

        {/* Section documents */}
        <div style={{ borderTop: '1px solid rgba(0,119,182,.12)', paddingTop: 14, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: showDocs ? 14 : 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              Documents livreur {hasFiles ? `(${filesCount + (docs.insuranceExpiry ? 1 : 0)} sélectionné(s))` : '(optionnel)'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showDocs ? '▲' : '▼'}</span>
          </button>

          {showDocs && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 80px)', gap: 10, justifyContent: 'space-between' }}>
              {DOC_LIST.map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{label}</span>
                  <DocPicker file={docs[key]} hasExisting={false} onPick={f => setDoc(key, f)} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                <label style={labelStyle}>Date expiration assurance</label>
                <input type="date" value={docs.insuranceExpiry} onChange={e => setDoc('insuranceExpiry', e.target.value)} style={inputStyle} />
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ ...errorStyle, marginTop: 14 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
            {saving ? savingStep || 'Enregistrement…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal détail livreur ────────────────────────────────────────────────────────
function DriverDetailModal({ driverId, onClose, onUpdated }) {
  const [driver, setDriver]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [docs, setDocs]       = useState({ insuranceExpiry: '' })
  const [saving, setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved]     = useState(false)
  const [resubmitting, setResubmitting] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true); setLoadError('')
    try {
      const { data } = await fleetApi.get(`/chefs-de-flotte/me/drivers/${driverId}`)
      setDriver(data.driver)
      setDocs(d => ({ ...d, insuranceExpiry: data.driver.insuranceExpiry ? data.driver.insuranceExpiry.slice(0, 10) : '' }))
    } catch (e) {
      setLoadError(e.response?.data?.message ?? 'Erreur de chargement.')
    } finally { setLoading(false) }
  }, [driverId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  function setDoc(k, v) { setDocs(d => ({ ...d, [k]: v })); setSaved(false) }
  const hasNewFiles = DOC_LIST.some(d => docs[d.key] instanceof File)
  const insuranceChanged = driver && (docs.insuranceExpiry || '') !== (driver.insuranceExpiry ? driver.insuranceExpiry.slice(0, 10) : '')

  async function saveDocs() {
    setSaving(true); setSaveError('')
    try {
      const fd = new FormData()
      DOC_LIST.forEach(({ key }) => { if (docs[key] instanceof File) fd.append(key, docs[key]) })
      if (docs.insuranceExpiry) fd.append('insuranceExpiry', docs.insuranceExpiry)
      await fleetApi.patch(`/chefs-de-flotte/me/drivers/${driverId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })
      await fetchDetail()
      setSaved(true)
      onUpdated?.()
    } catch (e) {
      if (e.code === 'ECONNABORTED') setSaveError('Envoi trop long — réessayez avec des images plus légères.')
      else setSaveError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  async function resubmit() {
    setResubmitting(true); setSaveError('')
    try {
      await fleetApi.patch(`/chefs-de-flotte/me/drivers/${driverId}/resubmit`)
      await fetchDetail()
      onUpdated?.()
    } catch (e) {
      setSaveError(e.response?.data?.message ?? 'Erreur.')
    } finally { setResubmitting(false) }
  }

  const status = driver ? driverStatusLabel(driver) : null

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glassSolid, width: 960, maxWidth: '96vw', borderRadius: 16, padding: 24, maxHeight: '94vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Chargement…</div>
        ) : loadError || !driver ? (
          <>
            <div style={errorStyle}>{loadError || 'Livreur introuvable.'}</div>
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <button onClick={onClose} style={btnOutline}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.18),rgba(6,113,186,.18))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#7c3aed', fontWeight: 700, flexShrink: 0 }}>
                {driver.avatar
                  ? <img src={driver.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                  : (driver.name?.trim() || driver.phone || '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{driver.name?.trim() || '—'}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{driver.phone}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏍 {driver.vehicleType ?? '—'}</span>
              </div>
              <button onClick={onClose} style={btnIcon}><X size={16} /></button>
            </div>

            {driver.chefDeFlotteStatus === 'REJECTED' && (
              <div style={{ ...errorStyle, marginBottom: 14 }}>
                {driver.rejectionReason && <div>Motif de refus : {driver.rejectionReason}</div>}
                <div style={{ marginTop: driver.rejectionReason ? 6 : 0 }}>
                  Corrigez les documents concernés ci-dessous, puis cliquez sur « Resoumettre pour validation ».
                </div>
              </div>
            )}

            {/* Corps en deux colonnes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              <div>
                {/* Chiffres */}
                <div style={{ marginBottom: 16 }}>
                  <div style={sectionTitle}>Chiffres</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {[
                      ['Courses livrées', driver.deliveredCourses ?? 0, 'var(--success, #22c55e)'],
                      ['Total généré',    `${(driver.totalEarned ?? 0).toLocaleString()} F`, 'var(--primary)'],
                      ['Courses en cours', driver.pendingCourses ?? 0, '#f59e0b'],
                      ['Note moyenne',     driver.avgRating != null ? `★ ${driver.avgRating}` : '—', '#f59e0b'],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ background: 'rgba(0,119,182,.05)', borderRadius: 10, padding: '10px 14px', borderLeft: `3px solid ${color}` }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Informations */}
                <div>
                  <div style={sectionTitle}>Informations</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', background: 'rgba(0,119,182,.05)', borderRadius: 10, padding: '12px 14px' }}>
                    {[
                      ['Plaque', driver.vehiclePlate ?? '—'],
                      ['Email', driver.email ?? '—'],
                      ['Vérifié par DEM', driver.isVerified ? '✓ Oui' : 'Non'],
                      ['Statut dossier', driver.driverStatus ?? '—'],
                      ['Solde', `${(driver.balance ?? 0).toLocaleString()} F`],
                      ['Inscrit le', driver.createdAt ? new Date(driver.createdAt).toLocaleDateString('fr-FR') : '—'],
                    ].map(([label, val]) => (
                      <div key={label}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <div style={sectionTitle}>Documents</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 84px)', gap: 12, justifyContent: 'space-between' }}>
                  {DOC_LIST.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                      <DocThumb url={driver[key]} label={label} />
                      <DocPicker file={docs[key]} hasExisting={!!driver[key]} onPick={f => setDoc(key, f)} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, maxWidth: 220 }}>
                  <label style={labelStyle}>Date expiration assurance</label>
                  <input type="date" value={docs.insuranceExpiry} onChange={e => setDoc('insuranceExpiry', e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>

            {saveError && <div style={{ ...errorStyle, marginTop: 14 }}>{saveError}</div>}
            {saved && !hasNewFiles && !insuranceChanged && (
              <div style={{ fontSize: 12, color: '#15803d', marginTop: 14 }}>✓ Documents enregistrés.</div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Fermer</button>
              {(hasNewFiles || insuranceChanged) && (
                <button onClick={saveDocs} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer les documents'}
                </button>
              )}
              {driver.chefDeFlotteStatus === 'REJECTED' && (
                <button
                  onClick={resubmit}
                  disabled={resubmitting || hasNewFiles || insuranceChanged}
                  title={(hasNewFiles || insuranceChanged) ? 'Enregistrez les documents avant de resoumettre.' : undefined}
                  style={{ ...btnPrimary, flex: 1, opacity: (resubmitting || hasNewFiles || insuranceChanged) ? 0.5 : 1 }}
                >
                  {resubmitting ? 'Envoi…' : 'Resoumettre pour validation'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [detailId, setDetailId] = useState(null)

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter }
      const res = await fleetApi.get('/chefs-de-flotte/me/drivers', { params })
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchDrivers() }, [fetchDrivers])

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mes livreurs</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={fetchDrivers} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={() => setShowNew(true)} style={btnPrimary}><Plus size={14} /> Nouveau livreur</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {STATUS_TABS.map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: statusFilter === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: statusFilter === key ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={pageScroll}>
        <div style={card}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          ) : drivers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun livreur pour ce filtre.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Livreur', 'Téléphone', 'Véhicule', 'Statut', 'Note', 'Courses livrées', 'Inscription', ''].map((h, i) => (
                    <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => {
                  const status = driverStatusLabel(d)
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ ...tdStyle, ...stickyCol }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13, flexShrink: 0 }}>
                            {d.avatar ? <img src={d.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} /> : (d.name?.trim() || d.phone || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{d.name?.trim() || '—'}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{d.phone}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{d.vehicleType}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
                        {d.chefDeFlotteStatus === 'REJECTED' && d.rejectionReason && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.rejectionReason}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {d.avgRating != null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                            <Star size={12} fill="#f59e0b" color="#f59e0b" /> {d.avgRating}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{d.deliveredCourses}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td style={tdStyle}>
                        <button onClick={() => setDetailId(d.id)} style={btnSmall} title="Voir les détails">
                          <Eye size={13} /> Détails
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNew && (
        <NewDriverModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchDrivers() }}
        />
      )}

      {detailId && (
        <DriverDetailModal
          driverId={detailId}
          onClose={() => setDetailId(null)}
          onUpdated={fetchDrivers}
        />
      )}
    </div>
  )
}

const overlay     = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const card        = { ...glass, padding: '20px 24px' }
const tableStyle  = { width: '100%', minWidth: 820, borderCollapse: 'collapse' }
const thStyle     = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle     = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle  = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle  = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle  = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const sectionTitle = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }
const btnOutline  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall    = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnIcon     = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
