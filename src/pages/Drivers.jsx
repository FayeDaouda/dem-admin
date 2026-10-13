import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import SuspendModal from '../components/SuspendModal'
import { RefreshCw, Phone, CheckCircle, XCircle, Plus, Pencil, Trash2, Search, Flag, RotateCcw, X, MessageCircle, ChevronDown, ChevronUp, PauseCircle, PlayCircle, Send } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'
import SubmitRequestModal from './service-client/components/SubmitRequestModal'
import DocThumb from '../components/DocThumb'
import PageHeader from '../components/PageHeader'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { useUrlQuery } from '../lib/useUrlQuery'


const DOC_LIST = [
  { key: 'avatar',         label: 'Photo de profil' },
  { key: 'idCardFront',    label: 'CNI recto' },
  { key: 'idCardBack',     label: 'CNI verso' },
  { key: 'licenseFront',   label: 'Permis recto' },
  { key: 'licenseBack',    label: 'Permis verso' },
  { key: 'vehiclePhoto',   label: 'Photo moto' },
  { key: 'carteGrise',     label: 'Carte grise recto' },
  { key: 'carteGriseBack', label: 'Carte grise verso' },
  { key: 'assurance',      label: 'Assurance' },
]

const CONNECTION_PERIOD_TABS = [
  ['today',       "Aujourd'hui"],
  ['week',        '7 j'],
  ['month',       '30 j'],
  ['threeMonths', '3 mois'],
]

function formatConnectionTime(seconds) {
  const totalMin = Math.round((seconds ?? 0) / 60)
  if (totalMin < 60) return `${totalMin} min`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}

// ── Modal Créer / Modifier coursier ────────────────────────────────────────────
function DriverFormModal({ initial, canUploadDocs, onClose, onSaved }) {
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
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>{isEdit ? 'Modifier le coursier' : 'Créer un coursier'}</h2>
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

        {/* Section documents — envoi des pièces réservé au Super Admin (serveur) */}
        {canUploadDocs && <div style={{ borderTop: '1px solid rgba(0,119,182,.12)', paddingTop: 14, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', marginBottom: showDocs ? 14 : 0 }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
              Documents coursier {hasFiles ? `(${DOC_LIST.filter(d => docs[d.key] instanceof File).length + (docs.insuranceExpiry ? 1 : 0)} sélectionné(s))` : '(optionnel)'}
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
        </div>}

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
  { tier: 'gainde',    name: 'DEM Gainde',     criteria: [{ courses: 500, referrals: 0,  rating: 4.2 }] },
  { tier: 'buur',      name: 'DEM Buur',       criteria: [{ courses: 300, referrals: 0,  rating: 4.0 }] },
  { tier: 'domouNdey', name: 'DEM Domou Ndey', criteria: [{ courses: 135, referrals: 0,  rating: 4.0 }] },
  { tier: 'doorWarr',  name: 'DEM Door Warr',  criteria: [{ courses: 70,  referrals: 0,  rating: 3.5 }] },
  { tier: 'mbokk',     name: 'DEM Mbokk',      criteria: [{ courses: 30,  referrals: 12, rating: 3.5 }] },
  { tier: 'xarit',     name: 'DEM Xarit',      criteria: [{ courses: 3, referrals: 0, rating: 0 }, { courses: 0, referrals: 3, rating: 0 }] },
]

// ── Modal choix suppression : archiver (réversible, défaut) vs définitif ──────
// La suppression définitive efface aussi l'historique (commandes, notes,
// transactions wallet...) — protégée par une saisie du numéro pour éviter un
// clic accidentel sur une action irréversible.
function DeleteDriverModal({ driver, onClose, onDone }) {
  const [mode, setMode] = useState(null) // null | 'archive' | 'hard'
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const label = driver.name?.trim() || driver.phone

  async function run(permanent) {
    setBusy(true); setError('')
    try {
      await api.delete(`/admin/drivers/${driver.id}`, permanent ? { params: { permanent: true } } : undefined)
      onDone(permanent ? `${label} est supprimé définitivement.` : `${label} est archivé.`)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Supprimer {label}</h2>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

        {mode === null && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Choisissez comment supprimer ce coursier.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={() => setMode('archive')} style={{ ...btnOutline, justifyContent: 'flex-start', padding: '12px 14px' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Archiver</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Compte désactivé, numéro libéré — commandes/transactions conservées. Réversible.
                  </div>
                </div>
              </button>
              <button onClick={() => setMode('hard')} style={{ ...btnOutline, justifyContent: 'flex-start', padding: '12px 14px', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Supprimer définitivement</div>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Efface aussi les commandes, notes, transactions wallet et tout l'historique. Irréversible.
                  </div>
                </div>
              </button>
            </div>
            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button onClick={onClose} style={btnOutline}>Annuler</button>
            </div>
          </>
        )}

        {mode === 'archive' && (
          <>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              {label} sera désactivé et son numéro libéré. Son historique (commandes, transactions…) reste consultable dans la vue « Supprimés ».
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode(null)} style={btnOutline}>Retour</button>
              <button onClick={() => run(false)} disabled={busy} style={btnPrimary}>
                {busy ? 'Archivage…' : 'Confirmer l\'archivage'}
              </button>
            </div>
          </>
        )}

        {mode === 'hard' && (
          <>
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
              Action irréversible : {label} et tout son historique (commandes, notes, transactions wallet, tournées, parrainages) seront définitivement effacés.
            </p>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Tapez le numéro <strong>{driver.phone}</strong> pour confirmer :
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={driver.phone}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(239,68,68,.4)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setMode(null)} style={btnOutline}>Retour</button>
              <button
                onClick={() => run(true)}
                disabled={busy || confirmText.trim() !== driver.phone}
                style={{ padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: (busy || confirmText.trim() !== driver.phone) ? 'default' : 'pointer', opacity: (busy || confirmText.trim() !== driver.phone) ? 0.5 : 1 }}
              >
                {busy ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Badge calculé par le serveur (driver-badges.service:matchBadge — palier de
// rang le plus élevé), le même que celui que voit le coursier dans l'app.
function DriverBadgeChip({ driver }) {
  const badge = driver.badge
  if (!badge) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Nouveau</span>
  const v = BADGE_VISUALS[badge.tier] ?? { emoji: '🏅', color: '#888', bg: '#f5f5f5' }
  return (
    <span style={{ background: v.bg, color: v.color, padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {v.emoji} {badge.name}
    </span>
  )
}

// ── Modal désarchivage ────────────────────────────────────────────────────────
// Remet le compte en service avec tout son historique. Numéro : celui d'avant
// l'archivage (retrouvé par le serveur dans le journal d'audit), modifiable —
// obligatoire s'il est introuvable ou repris entre-temps par un autre compte.
function RestoreDriverModal({ driver, onClose, onRestored }) {
  const [phone, setPhone] = useState(driver.archivedPhone ? driver.archivedPhone.replace(/^\+221/, '') : '')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const label = driver.name?.trim() || 'ce coursier'

  async function submit() {
    setBusy(true); setError('')
    try {
      const digits = phone.replace(/\D/g, '')
      await api.patch(`/admin/drivers/${driver.id}/restore`, digits ? { phone: digits } : {})
      onRestored()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Désarchiver {label}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
          Le compte redevient actif avec tout son historique (courses, wallet, notes, documents).
          Il revient hors ligne : le coursier se reconnecte avec ce numéro.
          {' '}Une suspension ou un bannissement d'avant l'archivage n'est pas repris : refaites-le si besoin.
        </p>
        {driver.deletedBySelf && (
          <p style={{ color: 'var(--warning, #b45309)', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
            Ce compte a été supprimé par le coursier lui-même depuis l'application. Ne le désarchivez qu'à sa demande.
          </p>
        )}
        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
          Numéro de connexion {driver.archivedPhone ? '(numéro d\'avant l\'archivage)' : '(numéro d\'origine introuvable — à saisir)'}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>+221</span>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="77 123 45 67"
            inputMode="tel"
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 6 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button onClick={submit} disabled={busy || (!driver.archivedPhone && !phone.trim())} style={btnPrimary}>
            {busy ? 'Désarchivage…' : 'Désarchiver'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Vues de la liste (paramètre status du serveur) — « Tous » exclut les
// comptes supprimés (archivés), consultables dans leur propre vue.
const VIEWS = [
  { key: '',        label: 'Tous' },
  { key: 'online',  label: 'En ligne' },
  { key: 'offline', label: 'Hors ligne' },
  { key: 'pending', label: 'Non vérifiés' },
  { key: 'deleted', label: 'Supprimés' },
]

const VEHICLE_LABELS = { MOTO: 'Moto', TAXI: 'Taxi', VOITURE: 'Voiture' }
const fmtDate = v => (v ? new Date(v).toLocaleDateString('fr-FR') : '—')
const fleetName = d => d.managedBy?.companyName || d.managedBy?.name || d.managedBy?.phone || null

// Un seul statut par coursier (avant : colonnes Statut et Vérifié séparées).
function DriverStatus({ driver, deleted }) {
  const s = deleted                                  ? { bg: 'rgba(100,116,139,.14)', color: '#475569', label: 'Supprimé' }
    : driver.chefDeFlotteStatus === 'PENDING'        ? { bg: 'rgba(245,158,11,.14)',  color: '#b45309', label: 'En attente' }
    : driver.chefDeFlotteStatus === 'REJECTED'       ? { bg: 'rgba(239,68,68,.12)',   color: '#dc2626', label: 'Refusé' }
    : driver.isActive                                ? { bg: 'rgba(34,197,94,.12)',   color: '#15803d', label: 'Actif' }
    :                                                  { bg: 'rgba(239,68,68,.12)',   color: '#dc2626', label: 'Suspendu' }
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: s.bg, color: s.color, whiteSpace: 'nowrap', width: 'fit-content' }}>{s.label}</span>
      {!deleted && !driver.isVerified && driver.chefDeFlotteStatus !== 'PENDING' && (
        <span style={{ fontSize: 10.5, color: '#b45309', fontWeight: 600 }}>non vérifié</span>
      )}
    </span>
  )
}

function Avatar({ driver, size = 34 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg,rgba(12,184,222,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {driver.avatar
        ? <img src={driver.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontWeight: 700, color: '#0671BA', fontSize: size * 0.38 }}>{(driver.name?.trim() || driver.phone || '?')[0].toUpperCase()}</span>}
    </div>
  )
}

function OnlineDot({ online }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: online ? '#15803d' : 'var(--text-muted)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: online ? '#22c55e' : '#cbd5e1' }} />
      {online ? 'En ligne' : 'Hors ligne'}
    </span>
  )
}

// ── Statistiques de paiement (dans la fiche) ──────────────────────────────────
function PaymentStats({ driverId }) {
  const [stats, setStats] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.get(`/admin/drivers/${driverId}/payment-stats`)
      .then(r => { if (!cancelled) setStats(r.data) })
      .catch(() => { if (!cancelled) setStats(false) })
    return () => { cancelled = true }
  }, [driverId])
  if (stats === false) return null
  return (
    <FicheSection title="Statistiques de paiement">
      {!stats ? <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Chargement…</span> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            ['Courses payées', stats.paidOrders,    'var(--success)'],
            ['Total gagné',    `${(stats.totalEarned ?? 0).toLocaleString()} F`, 'var(--primary)'],
            ['En attente',     stats.pendingOrders, 'var(--warning)'],
            ['Litiges',        stats.disputedOrders, 'var(--danger)'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', borderLeft: `3px solid ${color}` }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color }}>{val ?? 0}</div>
            </div>
          ))}
        </div>
      )}
    </FicheSection>
  )
}

// ── Fiche coursier : informations à gauche, contact et actions à droite ─────
function DriverFiche({ driver: d, deleted, rights, isServiceClient, notice, error, onClose, onAction }) {
  const [open, setOpen] = useState(null) // 'activate' | 'reactivate' | 'report'
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const digits = (d.phone ?? '').replace(/[^\d]/g, '')
  const label = d.name?.trim() || d.phone
  const pending = d.chefDeFlotteStatus === 'PENDING'

  function toggle(action) {
    setOpen(o => (o === action ? null : action))
    setText(''); setLocalError('')
  }

  const inline = {
    activate:   { title: `Activer ${label} ? Ce coursier pourra commencer à accepter des courses.`, confirm: 'Activer', go: () => api.patch(`/admin/drivers/${d.id}/validate`, { approve: true }), ok: `${label} est activé.` },
    reactivate: { title: `Réactiver ${label} ?`, confirm: 'Réactiver', go: () => api.patch(`/admin/drivers/${d.id}/activate`), ok: `${label} est réactivé.` },
    report:     { title: 'Signaler ce coursier', placeholder: 'Motif du signalement', required: true, danger: true, confirm: 'Envoyer le signalement',
      go: v => api.post('/admin/report-user', { userId: d.id, userRole: 'DRIVER', reason: v }), ok: 'Signalement envoyé (incident ouvert).' },
  }
  const current = open ? inline[open] : null

  async function confirmCurrent() {
    const v = text.trim()
    if (current.required && !v) { setLocalError('Ce champ est obligatoire.'); return }
    setBusy(true); setLocalError('')
    const ok = await onAction(() => current.go(v), current.ok)
    setBusy(false)
    if (ok) { setOpen(null); setText('') }
  }

  const btn = (color, border) => ({ ...btnOutline, color, borderColor: border })

  return (
    <div style={overlay} onClick={onClose}>
      <div style={ficheBox} onClick={e => e.stopPropagation()}>
        {/* En-tête de la fiche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
          <Avatar driver={d} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{d.name?.trim() || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {deleted ? (d.archivedPhone ? `Ancien n° ${d.archivedPhone}` : 'Numéro libéré') : (d.phone ?? '—')}
              {!deleted && <OnlineDot online={d.isOnlineNow} />}
            </div>
          </div>
          <DriverBadgeChip driver={d} />
          <DriverStatus driver={d} deleted={deleted} />
          <button onClick={onClose} style={btnIcon} title="Fermer"><X size={18} /></button>
        </div>

        {notice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 8 }}>
            <CheckCircle size={14} /> {notice}
          </div>
        )}
        {error && <div style={{ ...errorStyle, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0 28px' }}>
          {/* Colonne gauche : informations, flotte, pièces, paiements */}
          <div>
            <FicheSection title="Informations">
              <Row label="Véhicule" value={VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType ?? '—'} />
              <Row label="Plaque" value={d.vehiclePlate ?? '—'} />
              <Row label="Email" value={d.email ?? '—'} />
              <Row label="Inscrit le" value={fmtDate(d.createdAt)} />
              <Row label="Vérifié" value={d.isVerified ? '✓ Oui' : 'Non'} />
              <Row label="Courses livrées" value={<>{d.deliveredCourses ?? 0}{d.avgRating > 0 && <span style={{ color: '#f59e0b', marginLeft: 8 }}>★ {d.avgRating}</span>}</>} />
              {deleted && <Row label="Supprimé le" value={<>{fmtDate(d.deletedAt)}{d.deletedBySelf ? ' · par le coursier' : ''}</>} />}
              {d.suspensionReason && !d.isActive && <Row label="Motif" value={d.suspensionReason} />}
            </FicheSection>

            <FicheSection title="Flotte">
              {d.managedById ? (
                <div style={{ fontSize: 13 }}>
                  <strong>{fleetName(d) ?? '—'}</strong>
                  {d.managedBy?.phone && <span style={{ color: 'var(--text-muted)' }}> · {d.managedBy.phone}</span>}
                  <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 8px', borderRadius: 8, fontWeight: 700, background: d.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? 'rgba(124,58,237,.12)' : 'rgba(245,158,11,.12)', color: d.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? '#7c3aed' : '#b45309' }}>
                    {d.managedBy?.chefDeFlotteStatus === 'ACTIVE' ? 'chef de flotte validé' : 'chef de flotte non validé'}
                  </span>
                </div>
              ) : <span style={{ fontSize: 13 }}>Indépendant</span>}
            </FicheSection>

            <FicheSection title="Pièces">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <DocThumb url={d.licenseFront}  label="Permis recto" />
                <DocThumb url={d.licenseBack}   label="Permis verso" />
                <DocThumb url={d.vehiclePhoto}  label="Véhicule" />
                <DocThumb url={d.casquePhoto}   label="Casque" />
                <DocThumb url={d.cniRecto}      label="CNI recto" />
                <DocThumb url={d.cniVerso}      label="CNI verso" />
              </div>
            </FicheSection>

            {rights.paymentStats && !deleted && <PaymentStats driverId={d.id} />}
          </div>

          {/* Colonne droite : contact et actions */}
          <div>
            <FicheSection title="Contact">
              {!deleted && digits.length >= 7 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={`tel:${d.phone}`} style={btnOutline}><Phone size={14} /> Appeler</a>
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" style={btnOutline}><MessageCircle size={14} /> WhatsApp</a>
                </div>
              ) : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pas de numéro actif.</span>}
            </FicheSection>

            <FicheSection title="Actions">
              {deleted ? (
                rights.manage
                  ? <button onClick={() => onAction('restore')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><RotateCcw size={14} /> Désarchiver</button>
                  : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Désarchivage réservé au Super Admin.</span>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {rights.edit && <button onClick={() => onAction('edit')} style={btnOutline}><Pencil size={14} /> Modifier</button>}
                  {rights.validate && pending && (<>
                    <button onClick={() => toggle('activate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><CheckCircle size={14} /> Activer</button>
                    <button onClick={() => onAction('reject')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><XCircle size={14} /> Refuser</button>
                  </>)}
                  {rights.suspend && !pending && (d.isActive
                    ? <button onClick={() => onAction('suspend')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><PauseCircle size={14} /> Suspendre</button>
                    : <button onClick={() => toggle('reactivate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><PlayCircle size={14} /> Réactiver</button>)}
                  {isServiceClient && d.isActive && (
                    <button onClick={() => onAction('request')} style={btn('#b45309', 'rgba(245,158,11,.45)')}><Send size={14} /> Demander une suspension</button>
                  )}
                  {rights.report && <button onClick={() => toggle('report')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Flag size={14} /> Signaler</button>}
                  {rights.manage && <button onClick={() => onAction('delete')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Trash2 size={14} /> Supprimer</button>}
                  {!rights.edit && !rights.report && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lecture seule.</span>}
                </div>
              )}

              {current && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{current.title}</div>
                  {current.placeholder && (
                    <input autoFocus value={text} onChange={e => { setText(e.target.value); setLocalError('') }} placeholder={current.placeholder} style={inputStyle} />
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => toggle(open)} disabled={busy} style={btnOutline}>Retour</button>
                    <button onClick={confirmCurrent} disabled={busy} style={{ ...btnPrimary, background: current.danger ? '#dc2626' : '#16a34a' }}>
                      {busy ? 'En cours…' : current.confirm}
                    </button>
                  </div>
                </div>
              )}
              {localError && <div style={errorStyle}>{localError}</div>}
            </FicheSection>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Demandes de changement de numéro : bandeau repliable ─────────────────────
function PhoneRequests({ requests, canDecide, onDecided }) {
  const [open, setOpen]           = useState(false)
  const [resolving, setResolving] = useState(null)
  const [errors, setErrors]       = useState({})

  async function resolve(id, approve) {
    setResolving(id)
    setErrors(e => ({ ...e, [id]: null }))
    try {
      await api.patch(`/admin/drivers/${id}/phone-change`, { approve })
      onDecided()
    } catch (e) {
      setErrors(er => ({ ...er, [id]: e.response?.data?.message ?? 'Erreur.' }))
    } finally { setResolving(null) }
  }

  if (requests.length === 0) return null
  return (
    <div style={{ ...glass, padding: '10px 16px', marginBottom: 14, flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text)' }}>
        <Phone size={15} color="#b45309" />
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>
          {requests.length} demande{requests.length > 1 ? 's' : ''} de changement de numéro
        </span>
        {!canDecide && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· décision du Super Admin</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', display: 'flex' }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
          {requests.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 600, minWidth: 140 }}>{d.name ?? '—'}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{VEHICLE_LABELS[d.vehicleType] ?? d.vehicleType ?? '—'}</span>
              <span style={{ fontFamily: 'monospace' }}>{d.phone}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>{d.pendingPhone ?? '—'}</span>
              {canDecide && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  {resolving === d.id ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>En cours…</span> : (<>
                    <button onClick={() => resolve(d.id, true)} style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }}><CheckCircle size={13} /> Approuver</button>
                    <button onClick={() => resolve(d.id, false)} style={{ ...btnSmall, color: 'var(--danger)', borderColor: 'var(--danger)' }}><XCircle size={13} /> Refuser</button>
                  </>)}
                </div>
              )}
              {errors[d.id] && <div style={{ ...errorStyle, width: '100%' }}>{errors[d.id]}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
const LIMIT = 50

export default function Drivers() {
  const { user } = useAuth()
  const role = user?.adminRole
  const isServiceClient = role === 'SERVICE_CLIENT'
  const rights = {
    create:       canSee(role, ACTION_ROLES.driverCreate),
    docsUpload:   canSee(role, ACTION_ROLES.driverDocsUpload),
    edit:         canSee(role, ACTION_ROLES.driverEdit),
    validate:     canSee(role, ACTION_ROLES.driverValidate),
    suspend:      canSee(role, ACTION_ROLES.driverSuspend),
    manage:       canSee(role, ACTION_ROLES.driverManage),
    paymentStats: canSee(role, ACTION_ROLES.driverPaymentStats),
    report:       canSee(role, ACTION_ROLES.reportDriver),
  }

  // Vue, filtres, tri et recherche gardés dans l'adresse : un lien ou un
  // rechargement rouvre la même liste. ?q= vient aussi de la recherche globale.
  const [params, setParams] = useSearchParams()
  const status           = VIEWS.some(v => v.key === params.get('statut')) ? params.get('statut') : ''
  const fleetFilter      = params.get('flotte') ?? ''
  const chefFilter       = params.get('chef') ?? ''
  const badgeFilter      = params.get('badge') ?? ''
  const sortCourses      = ['desc', 'asc'].includes(params.get('tri')) ? params.get('tri') : null
  const connectionPeriod = CONNECTION_PERIOD_TABS.some(([k]) => k === params.get('connexion')) ? params.get('connexion') : 'today'
  const [search, setSearch] = useState(() => params.get('q') ?? '')
  useUrlQuery(setSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim())

  const [drivers, setDrivers]       = useState([])
  const [total, setTotal]           = useState(0)
  const [counts, setCounts]         = useState({})
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [badgeTiers, setBadgeTiers] = useState(null)
  const [chefs, setChefs]           = useState([])
  const [phoneReqs, setPhoneReqs]   = useState([])

  // Fiche ouverte et fenêtres qu'elle ouvre
  const [selected, setSelected]     = useState(null)
  const [ficheNotice, setFicheNotice] = useState('')
  const [ficheError, setFicheError] = useState('')
  const [modal, setModal]           = useState(null) // 'edit' | 'suspend' | 'reject' | 'delete' | 'restore' | 'request'
  const [modalBusy, setModalBusy]   = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [pageNotice, setPageNotice] = useState('') // après une suppression / un désarchivage (fiche fermée)

  useEffect(() => {
    if (!pageNotice) return
    const t = setTimeout(() => setPageNotice(''), 6000)
    return () => clearTimeout(t)
  }, [pageNotice])

  // Plusieurs paramètres changés en une seule fois (sinon le second écrase le premier).
  function setParam(changes) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    }, { replace: true })
    setPage(1)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const q = search.trim()
      setDebouncedSearch(q)
      setPage(1)
      setParams(prev => {
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      }, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [search, setParams])

  // Filtres et tri appliqués par le serveur sur TOUS les coursiers ; nombre
  // de coursiers par vue, avec les mêmes filtres.
  const lastRequest = useRef(0)
  const fetch = useCallback(async (silent = false) => {
    const requestId = ++lastRequest.current
    if (!silent) setLoading(true)
    const base = {}
    if (fleetFilter)     base.fleet  = fleetFilter
    if (chefFilter)      base.chefId = chefFilter
    if (badgeFilter)     base.badge  = badgeFilter
    if (debouncedSearch) base.search = debouncedSearch
    try {
      const listParams = { ...base, page, limit: LIMIT }
      if (status)      listParams.status = status
      if (sortCourses) listParams.sort   = `courses_${sortCourses}`
      const [list, ...countRes] = await Promise.all([
        api.get('/admin/drivers', { params: listParams }),
        ...VIEWS.map(v => api.get('/admin/drivers', { params: { ...base, limit: 1, ...(v.key ? { status: v.key } : {}) } }).catch(() => null)),
      ])
      if (requestId !== lastRequest.current) return // réponse périmée (filtre changé entre-temps)
      setDrivers(Array.isArray(list.data?.drivers) ? list.data.drivers : (Array.isArray(list.data) ? list.data : []))
      setTotal(list.data?.total ?? 0)
      setCounts(Object.fromEntries(VIEWS.map((v, i) => [v.key, countRes[i]?.data?.total])))
    } catch (e) {
      console.error(e)
    } finally {
      if (!silent && requestId === lastRequest.current) setLoading(false)
    }
  }, [page, status, fleetFilter, chefFilter, badgeFilter, sortCourses, debouncedSearch])

  const fetchPhoneRequests = useCallback(() => {
    api.get('/admin/drivers', { params: { status: 'phone-change', limit: 50 } })
      .then(res => setPhoneReqs(Array.isArray(res.data?.drivers) ? res.data.drivers : []))
      .catch(e => console.error(e))
  }, [])

  useEffect(() => { fetch(); fetchPhoneRequests() }, [fetch, fetchPhoneRequests])

  useEffect(() => {
    api.get('/admin/badges/config')
      .then(r => setBadgeTiers(r.data.badges))
      .catch(() => {})
    // Tous les chefs de flotte (avant : seulement ceux des coursiers de la page)
    api.get('/admin/chefs-de-flotte', { params: { status: 'all' } })
      .then(r => setChefs(Array.isArray(r.data?.chefs) ? r.data.chefs : []))
      .catch(() => {})
  }, [])
  useAutoRefresh(() => { fetch(true); fetchPhoneRequests() })

  function openFiche(d) {
    setSelected(d); setFicheNotice(''); setFicheError(''); setModal(null)
  }

  // Après une action : liste rafraîchie et fiche relue (le coursier peut
  // avoir quitté la vue affichée).
  async function afterAction(okText) {
    setFicheNotice(okText); setFicheError('')
    fetch(true)
    if (selected && status !== 'deleted') {
      api.get(`/admin/drivers/${selected.id}`)
        .then(r => {
          const f = r.data ?? {}
          setSelected(s => s && ({ ...s, ...pick(f, ['name', 'phone', 'vehiclePlate', 'managedById', 'managedBy', 'isActive', 'isBanned', 'isVerified', 'chefDeFlotteStatus', 'suspensionReason', 'deletedAt']) }))
        })
        .catch(() => {})
    }
  }

  // Action lancée depuis la fiche : soit une requête (confirmée dans la
  // fiche), soit l'ouverture d'une fenêtre (suspension, refus, suppression…).
  async function onFicheAction(action, okText) {
    if (typeof action === 'string') { setFicheError(''); setModal(action); return true }
    try {
      await action()
      await afterAction(okText)
      return true
    } catch (e) {
      setFicheError(e.response?.data?.message ?? 'Erreur.')
      return false
    }
  }

  async function withReason(request, okText) {
    setModalBusy(true)
    try {
      await request()
      setModal(null)
      await afterAction(okText)
    } catch (e) {
      setModal(null)
      setFicheError(e.response?.data?.message ?? 'Erreur.')
    } finally { setModalBusy(false) }
  }

  const fullReason = (reason, fix) => [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
  const label = selected ? (selected.name?.trim() || selected.phone) : ''
  const deletedView = status === 'deleted'
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))
  const hasFilters = !!(fleetFilter || chefFilter || badgeFilter)

  return (
    <div style={pageWrap}>
      <PageHeader
        title="Coursiers"
        subtitle={`${total.toLocaleString('fr-FR')} coursier${total !== 1 ? 's' : ''} dans cette vue`}
        actions={<>
          <button onClick={() => { fetch(); fetchPhoneRequests() }} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          {rights.create && <button onClick={() => setCreateOpen(true)} style={btnPrimary}><Plus size={14} /> Nouveau coursier</button>}
        </>}
      />

      <PhoneRequests requests={phoneReqs} canDecide={rights.manage} onDecided={fetchPhoneRequests} />

      {/* Recherche + vues */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom ou téléphone…" style={{ ...glassInput, paddingLeft: 36, width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4 }}>
          {VIEWS.map(v => {
            const active = status === v.key
            return (
              <button key={v.key || 'all'} onClick={() => setParam({ statut: v.key })} style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 12.5,
                background: active ? 'var(--primary)' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', fontWeight: active ? 700 : 500,
              }}>
                {v.label}{counts[v.key] != null && <span style={{ marginLeft: 5, opacity: 0.8 }}>{counts[v.key].toLocaleString('fr-FR')}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtres secondaires, sur une ligne */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <select value={fleetFilter} onChange={e => setParam({ flotte: e.target.value })} style={{ ...glassInput, width: 210 }}>
          <option value="">Flotte et indépendants</option>
          <option value="fleet">En flotte</option>
          <option value="independent">Indépendants</option>
        </select>
        {chefs.length > 0 && (
          <select value={chefFilter} onChange={e => setParam({ chef: e.target.value })} style={{ ...glassInput, width: 200 }}>
            <option value="">Chef de flotte : tous</option>
            {chefs.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name || c.phone}</option>)}
          </select>
        )}
        <select value={badgeFilter} onChange={e => setParam({ badge: e.target.value })} style={{ ...glassInput, width: 180 }}>
          <option value="">Badge : tous</option>
          <option value="nouveau">Nouveau</option>
          {(badgeTiers ?? DEFAULT_BADGE_TIERS).map(t => (
            <option key={t.tier} value={t.tier}>{BADGE_VISUALS[t.tier]?.emoji} {t.name}</option>
          ))}
        </select>
        <select value={connectionPeriod} onChange={e => setParam({ connexion: e.target.value === 'today' ? '' : e.target.value })} style={{ ...glassInput, width: 200 }} title="Période de la colonne Connexion">
          {CONNECTION_PERIOD_TABS.map(([key, l]) => <option key={key} value={key}>Connexion : {l}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => setParam({ flotte: '', chef: '', badge: '' })} style={{ ...btnSmall, border: 'none', background: 'none', color: 'var(--primary)', fontWeight: 600 }}>
            Effacer les filtres
          </button>
        )}
      </div>

      <div style={pageScroll}>
      {pageNotice && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '8px 12px', borderRadius: 10, marginBottom: 10 }}>
          <CheckCircle size={14} /> {pageNotice}
        </div>
      )}
      <div style={card}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : drivers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun coursier{hasFilters || debouncedSearch ? ' pour ce filtre' : ''}.</div>
        ) : (
          <table style={{ ...tableStyle, minWidth: 820 }}>
            <thead>
              <tr>
                {['Coursier', 'Badge', 'Courses', 'Connexion', 'Téléphone', 'Statut'].map((h, i) => (
                  <th
                    key={h}
                    style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh), ...(h === 'Courses' ? { cursor: 'pointer', userSelect: 'none', textAlign: 'center' } : {}) }}
                    onClick={h === 'Courses' ? () => setParam({ tri: sortCourses === 'desc' ? 'asc' : sortCourses === 'asc' ? '' : 'desc' }) : undefined}
                    title={h === 'Courses' ? 'Trier par nombre de courses' : undefined}
                  >
                    {h}{h === 'Courses' && (sortCourses === 'desc' ? ' ▼' : sortCourses === 'asc' ? ' ▲' : ' ⇅')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} onClick={() => openFiche(d)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} title="Ouvrir la fiche">
                  <td style={{ ...tdStyle, ...stickyCol }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar driver={d} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{d.name?.trim() || d.phone}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {!deletedView && <OnlineDot online={d.isOnlineNow} />}
                          <span style={{ fontSize: 11, color: d.managedById ? '#7c3aed' : 'var(--text-muted)' }}>
                            {d.managedById ? `Flotte ${fleetName(d) ?? ''}` : 'Indépendant'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}><DriverBadgeChip driver={d} /></td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <div style={{ fontWeight: 700 }}>{d.deliveredCourses ?? 0}</div>
                    {d.avgRating > 0 && <div style={{ fontSize: 11, color: '#f59e0b' }}>★ {d.avgRating}</div>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>
                    {formatConnectionTime(d.connectionSecondsByPeriod?.[connectionPeriod])}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13 }}>
                    {deletedView ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{d.archivedPhone ? `Ancien n° ${d.archivedPhone}` : 'Numéro libéré'}</span> : (d.phone ?? '—')}
                  </td>
                  <td style={tdStyle}><DriverStatus driver={d} deleted={deletedView} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, flexShrink: 0 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={btnOutline}>← Préc.</button>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btnOutline}>Suiv. →</button>
        </div>
      )}
      </div>

      {selected && (
        <DriverFiche
          driver={selected}
          deleted={deletedView}
          rights={rights}
          isServiceClient={isServiceClient}
          notice={ficheNotice}
          error={ficheError}
          onClose={() => setSelected(null)}
          onAction={onFicheAction}
        />
      )}

      {/* Fenêtres ouvertes depuis la fiche (au-dessus d'elle) */}
      {selected && modal === 'suspend' && (
        <SuspendModal
          target="driver"
          onConfirm={(reason, fix) => withReason(() => api.patch(`/admin/drivers/${selected.id}/suspend`, { reason: fullReason(reason, fix) }), `${label} est suspendu.`)}
          onClose={() => setModal(null)}
          loading={modalBusy}
        />
      )}
      {selected && modal === 'reject' && (
        <SuspendModal
          target="driver"
          title="Motif de refus"
          confirmLabel="Confirmer le refus"
          loadingLabel="Refus…"
          onConfirm={(reason, fix) => withReason(() => api.patch(`/admin/drivers/${selected.id}/validate`, { approve: false, reason: fullReason(reason, fix) }), `${label} : inscription refusée.`)}
          onClose={() => setModal(null)}
          loading={modalBusy}
        />
      )}
      {selected && modal === 'delete' && (
        <DeleteDriverModal
          driver={selected}
          onClose={() => setModal(null)}
          onDone={okText => { setModal(null); setSelected(null); fetch(true); setPageNotice(okText) }}
        />
      )}
      {selected && modal === 'restore' && (
        <RestoreDriverModal
          driver={selected}
          onClose={() => setModal(null)}
          onRestored={() => { setModal(null); setSelected(null); fetch(true); setPageNotice(`${label} est désarchivé.`) }}
        />
      )}
      {selected && modal === 'request' && (
        <SubmitRequestModal
          kind="DRIVER_SUSPEND"
          targetUser={{ id: selected.id, label }}
          onClose={() => setModal(null)}
          onSubmitted={() => { setModal(null); setFicheNotice('Demande de suspension envoyée pour validation.') }}
        />
      )}
      {selected && modal === 'edit' && (
        <DriverFormModal
          initial={selected}
          canUploadDocs={rights.docsUpload}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); afterAction(`${label} : modifications enregistrées.`) }}
        />
      )}
      {createOpen && (
        <DriverFormModal
          initial={null}
          canUploadDocs={rights.docsUpload}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); fetch() }}
        />
      )}
    </div>
  )
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]))
}

function FicheSection({ title, children }) {
  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 0 8px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 110 }}>{label}</span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

const card       = { ...glass, padding: '12px 16px' }
const tableStyle = { width: '100%', borderCollapse: 'collapse' }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '9px 10px', verticalAlign: 'middle' }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'none' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const inputStyle = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalBox   = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '28px 32px', width: 440, maxWidth: '90vw' }
const ficheBox   = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '20px 24px', width: 900, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
