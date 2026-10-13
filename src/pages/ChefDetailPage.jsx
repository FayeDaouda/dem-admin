import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp, Ban, RotateCcw, Trash2, UserPlus, Search, X, KeyRound, Phone, MessageCircle, Pencil, Flag, Send, Copy, Check, UserMinus } from 'lucide-react'
import { glass, pageWrap, pageScroll } from '../lib/glassStyles'
import SuspendModal from '../components/SuspendModal'
import DocThumb from '../components/DocThumb'
import SubmitRequestModal from './service-client/components/SubmitRequestModal'
import ChefFormModal from './chefs/ChefFormModal'
import { chefStatusInfo, driverStatusInfo } from './chefs/chefStatus'
import { canSee, ACTION_ROLES } from '../lib/droits'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import InfoTip from '../components/InfoTip'
import { PAGES } from '../lib/aide'

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

// ── Mot de passe provisoire affiché dans la page (avant : fenêtre d'alerte) ──
function TempPassword({ who, password, onClose }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.35)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Mot de passe provisoire de {who} :</span>
        <code style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, background: '#fff', padding: '3px 10px', borderRadius: 6 }}>{password}</code>
        <button onClick={() => navigator.clipboard?.writeText(password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }).catch(() => {})} style={{ ...btnOutline, padding: '4px 10px', color: copied ? '#15803d' : 'var(--text-muted)' }}>
          {copied ? <><Check size={13} /> Copié</> : <><Copy size={13} /> Copier</>}
        </button>
        <button onClick={onClose} style={{ ...btnIcon, marginLeft: 'auto' }} title="Masquer"><X size={16} /></button>
      </div>
      <div style={{ fontSize: 12, color: '#92400e' }}>
        Il ne sera plus affiché : notez-le et communiquez-le au chef de flotte. Il devra le changer à sa prochaine connexion sur l'Espace flotte.
      </div>
    </div>
  )
}

// ── Page détail chef de flotte ────────────────────────────────────────────────
export default function ChefDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = user?.adminRole
  const rights = {
    manage:   canSee(role, ACTION_ROLES.chefManage),
    edit:     canSee(role, ACTION_ROLES.chefEdit),
    validate: canSee(role, ACTION_ROLES.chefValidate),
    drivers:  canSee(role, ACTION_ROLES.fleetDriverActions),
    report:   canSee(role, ACTION_ROLES.reportChef),
  }
  const isServiceClient = role === 'SERVICE_CLIENT'

  const [chef, setChef] = useState(null)
  const [loading, setLoading] = useState(true)

  // Actions sur le chef
  const [open, setOpen]       = useState(null) // 'validate' | 'reactivate' | 'password' | 'report' | 'delete'
  const [text, setText]       = useState('')
  const [acting, setActing]   = useState(false)
  const [error, setError]     = useState('')
  const [notice, setNotice]   = useState('')
  const [tempPassword, setTempPassword] = useState(null)
  const [modal, setModal]     = useState(null) // 'edit' | 'request' | { kind: 'chef-suspend'|'driver-reject'|'driver-suspend', target }

  // Coursiers de la flotte
  const [expandedDriver, setExpandedDriver] = useState(null)
  const [driverConfirm, setDriverConfirm]   = useState(null) // { id, kind: 'reactivate'|'detach' }
  const [actingId, setActingId]             = useState(null)
  const [driverErrors, setDriverErrors]     = useState({})
  const [showAddDriver, setShowAddDriver]   = useState(false)
  const [searchPhone, setSearchPhone]       = useState('')
  const [searchResult, setSearchResult]     = useState(null) // driver object or 'not-found'
  const [searching, setSearching]           = useState(false)
  const [adding, setAdding]                 = useState(false)
  const [addError, setAddError]             = useState('')

  const refetch = useCallback(() => {
    return api.get(`/admin/chefs-de-flotte/${id}`)
      .then(r => setChef(r.data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    refetch().finally(() => setLoading(false))
  }, [refetch])
  useAutoRefresh(() => refetch())

  function toggle(action) {
    setOpen(o => (o === action ? null : action))
    setText(''); setError('')
  }

  // ── Actions sur le chef ────────────────────────────────────────────────────
  async function confirmAction() {
    const who = chef.companyName?.trim() || chef.name?.trim() || chef.phone
    const v = text.trim()
    if (open === 'report' && !v) { setError('Saisissez le motif du signalement.'); return }
    setActing(true); setError('')
    try {
      if (open === 'validate' || open === 'reactivate') {
        await api.patch(`/admin/chefs-de-flotte/${id}/validate`, { approve: true })
        setNotice(`${who} : ${open === 'validate' ? 'chef de flotte validé' : 'chef de flotte réactivé'}.`)
      } else if (open === 'password') {
        const res = await api.patch(`/admin/chefs-de-flotte/${id}/reset-password`)
        setTempPassword({ who, password: res.data?.temporaryPassword ?? res.data?.defaultPassword })
      } else if (open === 'report') {
        await api.post('/admin/report-user', { userId: id, userRole: 'CHEF_DE_FLOTTE', reason: v })
        setNotice('Signalement envoyé (incident ouvert).')
      } else if (open === 'delete') {
        await api.delete(`/admin/chefs-de-flotte/${id}`)
        navigate('/chefs-de-flotte', { state: { notice: `${who} est supprimé.` } })
        return
      }
      setOpen(null); setText('')
      await refetch()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally {
      setActing(false)
    }
  }

  async function handleReasonConfirm(reason, fix) {
    if (!modal?.kind) return
    const fullReason = [reason, fix ? `À corriger : ${fix}` : ''].filter(Boolean).join('\n')
    setActing(true)
    try {
      if (modal.kind === 'chef-suspend') {
        await api.patch(`/admin/chefs-de-flotte/${id}/suspend`, { reason: fullReason })
        setNotice('Chef de flotte suspendu, avec tous ses coursiers.')
      } else if (modal.kind === 'driver-reject') {
        await api.patch(`/admin/drivers/${modal.target.id}/validate`, { approve: false, reason: fullReason })
      } else if (modal.kind === 'driver-suspend') {
        await api.patch(`/admin/drivers/${modal.target.id}/suspend`, { reason: fullReason })
      }
      setModal(null)
      await refetch()
    } catch (e) {
      const msg = e.response?.data?.message ?? 'Erreur.'
      if (modal.target) setDriverErrors(er => ({ ...er, [modal.target.id]: msg }))
      else setError(msg)
      setModal(null)
    } finally {
      setActing(false)
    }
  }

  // ── Coursiers de la flotte ─────────────────────────────────────────────────
  async function driverRequest(driver, request) {
    setActingId(driver.id)
    setDriverErrors(er => ({ ...er, [driver.id]: null }))
    try {
      await request()
      setDriverConfirm(null)
      await refetch()
    } catch (e) {
      setDriverErrors(er => ({ ...er, [driver.id]: e.response?.data?.message ?? 'Erreur.' }))
    } finally {
      setActingId(null)
    }
  }

  async function searchDriverByPhone() {
    if (!searchPhone.trim()) return
    setSearching(true)
    setSearchResult(null)
    try {
      // Avant : paramètre `phone` ignoré par le serveur → renvoyait le coursier
      // inscrit le plus récemment, quel que soit le numéro saisi. Recherche
      // réelle, puis correspondance exacte du numéro (chiffres, indicatif toléré).
      const local = searchPhone.replace(/\D/g, '').slice(-9) // numéro local sénégalais (9 chiffres)
      if (local.length < 9) { setSearchResult('not-found'); return }
      const r = await api.get('/admin/drivers', { params: { search: local, limit: 20 } })
      const driver = (r.data?.drivers ?? []).find(d => (d.phone ?? '').replace(/\D/g, '').slice(-9) === local)
      setSearchResult(driver || 'not-found')
    } catch {
      setSearchResult('not-found')
    } finally {
      setSearching(false)
    }
  }

  async function attachDriver(driverId) {
    setAdding(true); setAddError('')
    try {
      await api.patch(`/admin/drivers/${driverId}`, { managedById: id })
      setShowAddDriver(false)
      setSearchPhone('')
      setSearchResult(null)
      await refetch()
    } catch (e) {
      setAddError(e.response?.data?.message ?? 'Erreur lors du rattachement.')
    } finally {
      setAdding(false)
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
  const who = chef.companyName?.trim() || chef.name?.trim() || chef.phone
  const digits = (chef.phone ?? '').replace(/[^\d]/g, '')
  const confirmTexts = {
    validate:   { title: `Valider ${who} comme chef de flotte ?`, confirm: 'Valider', color: '#16a34a' },
    reactivate: { title: `Réactiver ${who} comme chef de flotte ?`, confirm: 'Réactiver', color: '#16a34a' },
    password:   { title: `Réinitialiser le mot de passe de ${who} ? Un mot de passe provisoire sera généré ; il devra le changer à sa prochaine connexion.`, confirm: 'Générer', color: '#d97706' },
    report:     { title: 'Signaler ce chef de flotte', placeholder: 'Motif du signalement', confirm: 'Envoyer le signalement', color: '#dc2626' },
    delete:     { title: `Supprimer définitivement ${who} ? Cette action est irréversible.`, confirm: 'Supprimer définitivement', color: '#dc2626' },
  }
  const current = open ? confirmTexts[open] : null
  const btn = (color, border) => ({ ...btnOutline, padding: '6px 12px', color, borderColor: border })

  return (
    <div style={pageWrap}>
      {/* En-tête : identité, statut et actions */}
      <div style={{ ...glass, padding: '16px 20px', marginBottom: 16, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/chefs-de-flotte')} style={btnIcon} title="Retour à la liste">
            <ArrowLeft size={18} />
          </button>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 20, flexShrink: 0, overflow: 'hidden' }}>
            {chef.avatar ? <img src={chef.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (who || '?')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center' }}>{who}<InfoTip title="Fiche chef de flotte" text={PAGES['/chefs-de-flotte/']} size={15} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {chef.companyName?.trim() && chef.name ? `${chef.name} · ` : ''}{chef.phone}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: status.bg, color: status.color, whiteSpace: 'nowrap' }}>
            {status.text}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {digits.length >= 7 && (<>
            <a href={`tel:${chef.phone}`} style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><Phone size={14} /> Appeler</a>
            <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><MessageCircle size={14} /> WhatsApp</a>
          </>)}
          {rights.edit && <button onClick={() => setModal('edit')} style={btn('var(--text-muted)', 'rgba(0,119,182,0.25)')}><Pencil size={14} /> Modifier</button>}
          {rights.validate && chef.isActive && chef.chefDeFlotteStatus !== 'ACTIVE' && (
            <button onClick={() => toggle('validate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><CheckCircle size={14} /> Valider</button>
          )}
          {rights.manage && chef.isActive && chef.chefDeFlotteStatus === 'ACTIVE' && (
            <button onClick={() => setModal({ kind: 'chef-suspend' })} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Ban size={14} /> Suspendre</button>
          )}
          {rights.validate && !chef.isActive && (
            <button onClick={() => toggle('reactivate')} style={btn('#15803d', 'rgba(34,197,94,.4)')}><RotateCcw size={14} /> Réactiver</button>
          )}
          {rights.edit && <button onClick={() => toggle('password')} style={btn('#d97706', 'rgba(245,158,11,.45)')}><KeyRound size={14} /> Mot de passe provisoire</button>}
          {isServiceClient && chef.isActive && (
            <button onClick={() => setModal('request')} style={btn('#b45309', 'rgba(245,158,11,.45)')}><Send size={14} /> Demander une suspension</button>
          )}
          {rights.report && <button onClick={() => toggle('report')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Flag size={14} /> Signaler</button>}
          {rights.manage && <button onClick={() => toggle('delete')} style={btn('#dc2626', 'rgba(239,68,68,.35)')}><Trash2 size={14} /> Supprimer</button>}
        </div>

        {current && (
          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{current.title}</div>
            {current.placeholder && (
              <input autoFocus value={text} onChange={e => { setText(e.target.value); setError('') }} placeholder={current.placeholder} style={inputStyle} />
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => toggle(open)} disabled={acting} style={btnOutline}>Retour</button>
              <button onClick={confirmAction} disabled={acting} style={{ ...btnOutline, color: '#fff', background: current.color, borderColor: 'transparent', fontWeight: 600 }}>
                {acting ? 'En cours…' : current.confirm}
              </button>
            </div>
          </div>
        )}
        {error && <div style={errorStyle}>{error}</div>}
        {notice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: '#15803d', background: 'rgba(34,197,94,.10)', padding: '7px 12px', borderRadius: 10 }}>
            <CheckCircle size={14} /> {notice}
            <button onClick={() => setNotice('')} style={{ ...btnIcon, marginLeft: 'auto' }} title="Masquer"><X size={14} /></button>
          </div>
        )}
        {tempPassword && <TempPassword who={tempPassword.who} password={tempPassword.password} onClose={() => setTempPassword(null)} />}
      </div>

      <div style={pageScroll}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
          {/* Colonne gauche : informations, pièces, statistiques */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={infoBox}>
              <div style={sectionLabel}>Informations<InfoTip k="Informations" size={12} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px 16px' }}>
                {[
                  ['Société',     chef.companyName ?? '—'],
                  ['NINEA',       chef.ninea ?? '—'],
                  ['RCCM',        chef.rccm ?? '—'],
                  ['Flotte max.', chef.fleetMaxSize ?? '—'],
                  ['Coursiers',   chef._count?.managedDrivers ?? 0],
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

            <div style={infoBox}>
              <div style={sectionLabel}>Pièces du chef de flotte<InfoTip k="Pièces du chef de flotte" size={12} /></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <DocThumb url={chef.cniRecto} label="CNI recto" />
                <DocThumb url={chef.cniVerso} label="CNI verso" />
                <DocThumb url={chef.rccmDocument} label="RCCM" />
              </div>
            </div>

            <div style={infoBox}>
              <div style={sectionLabel}>Statistiques de la flotte<InfoTip k="Statistiques de la flotte" size={12} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px 16px' }}>
                {[
                  ['Total coursiers',  totalDrivers],
                  ['Coursiers actifs', activeDrivers],
                  ['En attente',       pendingDrivers],
                  ['Courses livrées',  totalCourses],
                  ['Note moyenne',     avgFleetRating != null ? `★ ${avgFleetRating}` : '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Colonne droite : coursiers de la flotte */}
          <div style={infoBox}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ ...sectionLabel, marginBottom: 0 }}>Coursiers gérés ({drivers.length})<InfoTip k="Coursiers gérés" size={12} /></div>
              {rights.drivers && (
                <button onClick={() => { setShowAddDriver(true); setSearchPhone(''); setSearchResult(null); setAddError('') }} style={{ ...btnSmall, color: 'var(--primary, #0077b6)' }}>
                  <UserPlus size={14} /> Ajouter un coursier
                </button>
              )}
            </div>
            {drivers.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Aucun coursier ajouté pour le moment.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {drivers.map(dr => {
                  const dStatus = driverStatusInfo(dr)
                  const scores = dr.ratingsReceived?.map(r => r.score) ?? []
                  const avgRating = scores.length > 0 ? Math.round((scores.reduce((s, r) => s + r, 0) / scores.length) * 10) / 10 : null
                  const expanded = expandedDriver === dr.id
                  const busy = actingId === dr.id
                  const confirmKind = driverConfirm?.id === dr.id ? driverConfirm.kind : null
                  const label = dr.name?.trim() || dr.phone
                  return (
                    <div key={dr.id} style={{ border: '1px solid rgba(0,119,182,.12)', borderRadius: 10, padding: '10px 12px', background: 'rgba(255,255,255,.4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{dr.name?.trim() || '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                            {dr.phone} · {dr.vehicleType}{dr.vehiclePlate ? ` · ${dr.vehiclePlate}` : ''} · {dr._count?.ordersAsDriver ?? 0} courses{avgRating != null ? ` · ★ ${avgRating}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, background: dStatus.bg, color: dStatus.color, whiteSpace: 'nowrap' }}>{dStatus.text}</span>
                        <button onClick={() => setExpandedDriver(expanded ? null : dr.id)} style={{ ...btnSmall, color: 'var(--text-muted)' }} title="Pièces du coursier">
                          Pièces {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>

                      {rights.drivers && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {dr.chefDeFlotteStatus === 'PENDING' && (<>
                            <button onClick={() => driverRequest(dr, () => api.patch(`/admin/drivers/${dr.id}/validate`, { approve: true }))} disabled={busy} style={{ ...btnSmall, color: '#15803d', borderColor: 'rgba(34,197,94,.4)' }}><CheckCircle size={13} /> Valider</button>
                            <button onClick={() => setModal({ kind: 'driver-reject', target: dr })} disabled={busy} style={{ ...btnSmall, color: '#dc2626', borderColor: 'rgba(239,68,68,.35)' }}><XCircle size={13} /> Refuser</button>
                          </>)}
                          {dr.chefDeFlotteStatus === 'ACTIVE' && dr.isActive && (
                            <button onClick={() => setModal({ kind: 'driver-suspend', target: dr })} disabled={busy} style={{ ...btnSmall, color: '#dc2626', borderColor: 'rgba(239,68,68,.35)' }}><Ban size={13} /> Suspendre</button>
                          )}
                          {dr.chefDeFlotteStatus === 'ACTIVE' && !dr.isActive && (
                            <button onClick={() => setDriverConfirm({ id: dr.id, kind: 'reactivate' })} disabled={busy} style={{ ...btnSmall, color: '#15803d', borderColor: 'rgba(34,197,94,.4)' }}><RotateCcw size={13} /> Réactiver</button>
                          )}
                          <button onClick={() => setDriverConfirm({ id: dr.id, kind: 'detach' })} disabled={busy} style={{ ...btnSmall, color: '#dc2626', borderColor: 'rgba(239,68,68,.35)' }}><UserMinus size={13} /> Retirer de la flotte</button>
                        </div>
                      )}

                      {confirmKind && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5 }}>
                          <span style={{ fontWeight: 600 }}>{confirmKind === 'detach' ? `Retirer ${label} de cette flotte ?` : `Réactiver ${label} ?`}</span>
                          <button
                            onClick={() => driverRequest(dr, confirmKind === 'detach'
                              ? () => api.patch(`/admin/drivers/${dr.id}`, { managedById: null })
                              : () => api.patch(`/admin/drivers/${dr.id}/activate`))}
                            disabled={busy}
                            style={{ ...btnSmall, color: '#fff', background: confirmKind === 'detach' ? '#dc2626' : '#16a34a', border: 'none' }}
                          >
                            {busy ? 'En cours…' : 'Confirmer'}
                          </button>
                          <button onClick={() => setDriverConfirm(null)} disabled={busy} style={btnSmall}>Annuler</button>
                        </div>
                      )}
                      {driverErrors[dr.id] && <div style={{ ...errorStyle, marginTop: 8 }}>{driverErrors[dr.id]}</div>}

                      {expanded && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,119,182,.08)' }}>
                          {dr.chefDeFlotteStatus === 'REJECTED' && dr.rejectionReason && (
                            <div style={{ ...errorStyle, marginBottom: 10 }}>Motif de refus : {dr.rejectionReason}</div>
                          )}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {DOC_LIST.map(({ key, label: l }) => (
                              <DocThumb key={key} url={dr[key]} label={l} width={70} height={56} />
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
      </div>

      {modal?.kind === 'chef-suspend' && (
        <SuspendModal
          target="ambassador"
          onConfirm={handleReasonConfirm}
          onClose={() => setModal(null)}
          loading={acting}
        />
      )}
      {modal?.kind === 'driver-reject' && (
        <SuspendModal
          target="driver"
          title="Motif de refus"
          confirmLabel="Confirmer le refus"
          loadingLabel="Refus…"
          onConfirm={handleReasonConfirm}
          onClose={() => setModal(null)}
          loading={acting}
        />
      )}
      {modal?.kind === 'driver-suspend' && (
        <SuspendModal
          target="driver"
          onConfirm={handleReasonConfirm}
          onClose={() => setModal(null)}
          loading={acting}
        />
      )}
      {modal === 'edit' && (
        <ChefFormModal
          initial={chef}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setNotice('Modifications enregistrées.'); refetch() }}
        />
      )}
      {modal === 'request' && (
        <SubmitRequestModal
          kind="CHEF_SUSPEND"
          targetUser={{ id: chef.id, label: who }}
          onClose={() => setModal(null)}
          onSubmitted={() => { setModal(null); setNotice('Demande de suspension envoyée pour validation.') }}
        />
      )}

      {/* Modal ajout coursier */}
      {showAddDriver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowAddDriver(false)}>
          <div style={{ ...glass, background: 'rgba(255,255,255,0.97)', padding: '20px 24px', borderRadius: 14, width: '100%', maxWidth: 420, position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAddDriver(false)} style={{ ...btnIcon, position: 'absolute', top: 12, right: 12 }} title="Fermer">
              <X size={18} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Ajouter un coursier</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Recherchez un coursier existant par son numéro de téléphone pour le rattacher à cette flotte.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="tel"
                placeholder="Ex : 771234567"
                value={searchPhone}
                onChange={e => { setSearchPhone(e.target.value); setSearchResult(null) }}
                onKeyDown={e => e.key === 'Enter' && searchDriverByPhone()}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', fontSize: 13, outline: 'none', background: 'var(--surface2, #f8f9fa)' }}
              />
              <button onClick={searchDriverByPhone} disabled={searching || !searchPhone.trim()} style={{ ...btnOutline, padding: '8px 14px' }}>
                <Search size={14} /> {searching ? 'Recherche…' : 'Chercher'}
              </button>
            </div>

            {searchResult === 'not-found' && (
              <div style={{ fontSize: 12, color: 'var(--danger, #ef4444)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 10px' }}>
                Aucun coursier trouvé avec ce numéro.
              </div>
            )}

            {searchResult && searchResult !== 'not-found' && (
              <div style={{ border: '1px solid rgba(0,119,182,.12)', borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 14, flexShrink: 0 }}>
                    {(searchResult.name?.trim() || searchResult.phone || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{searchResult.name?.trim() || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {searchResult.phone}{searchResult.vehicleType ? ` · ${searchResult.vehicleType}` : ''}
                    </div>
                  </div>
                  {searchResult.managedById && searchResult.managedById !== id ? (
                    <span style={{ fontSize: 11, color: 'var(--danger, #ef4444)', fontWeight: 600 }}>Déjà dans une flotte</span>
                  ) : searchResult.managedById === id ? (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Déjà dans cette flotte</span>
                  ) : (
                    <button onClick={() => attachDriver(searchResult.id)} disabled={adding} style={{ ...btnSmall, color: '#fff', background: 'var(--primary, #0077b6)', border: 'none' }}>
                      {adding ? 'Ajout…' : 'Rattacher'}
                    </button>
                  )}
                </div>
              </div>
            )}
            {addError && <div style={{ ...errorStyle, marginTop: 10 }}>{addError}</div>}
          </div>
        </div>
      )}
    </div>
  )
}

const infoBox      = { background: 'var(--surface2)', borderRadius: 10, padding: '12px 14px' }
const sectionLabel = { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }
const errorStyle   = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const inputStyle   = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const btnOutline   = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'none' }
const btnIcon      = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const btnSmall     = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid rgba(0,119,182,0.2)', background: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }
