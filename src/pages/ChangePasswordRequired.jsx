import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import logoSrc from '../assets/logo-dem.svg'
import { glassInput } from '../lib/glassStyles'
import { homeRouteForRole } from '../lib/roleHome'
import { PASSWORD_PATTERN, PASSWORD_HINT } from '../lib/passwordPolicy'
import PasswordInput from '../components/PasswordInput'

// Ecran de changement de mot de passe — deux entrées possibles :
// 1) Obligatoire : juste après le login (mustChangePassword) ou via
//    ProtectedRoute si une session existante le porte encore.
// 2) Volontaire : lien "Changer mon mot de passe" dans la sidebar (Layout),
//    accessible à tout moment par n'importe quel admin sur son propre compte.
export default function ChangePasswordRequired() {
  const { user, applySession, logout } = useAuth()
  const navigate = useNavigate()
  const forced = !!user?.mustChangePassword

  const [currentPwd, setCurrentPwd]   = useState('')
  const [newPwd, setNewPwd]           = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [error, setError]             = useState('')
  const [saving, setSaving]           = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!PASSWORD_PATTERN.test(newPwd)) { setError(PASSWORD_HINT); return }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return }
    if (newPwd === currentPwd) { setError('Le nouveau mot de passe doit être différent de l\'ancien.'); return }

    setSaving(true)
    try {
      const { data } = await api.post('/admin/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd })
      applySession(data.token, data.admin)
      navigate(homeRouteForRole(data.admin.adminRole), { replace: true })
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,180,216,0.15)', top: '-80px', left: '-100px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'rgba(0,119,182,0.12)', bottom: '-60px', right: '-80px', filter: 'blur(50px)' }} />
      </div>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src={logoSrc} alt="DEM" style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 16, marginBottom: 10 }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a3a52', marginBottom: 4 }}>
            {forced ? 'Changement de mot de passe requis' : 'Changer mon mot de passe'}
          </h2>
          <p style={{ color: '#5a7a96', fontSize: 12, margin: 0 }}>
            {forced
              ? `${user?.name ? `${user.name}, votre` : 'Votre'} mot de passe a été défini par un administrateur. Vous devez le changer avant de continuer.`
              : 'Renseignez votre mot de passe actuel puis choisissez-en un nouveau.'}
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Mot de passe actuel</label>
            <PasswordInput value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} placeholder="Mot de passe actuel" autoComplete="current-password" inputStyle={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nouveau mot de passe</label>
            <PasswordInput value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" inputStyle={inputStyle} />
            <p style={hintStyle}>{PASSWORD_HINT}</p>
          </div>
          <div>
            <label style={labelStyle}>Confirmer le mot de passe</label>
            <PasswordInput value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Retapez le mot de passe" autoComplete="new-password" inputStyle={inputStyle} />
          </div>
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={saving} style={btnStyle(saving)}>
            {saving ? 'Mise a jour...' : 'Valider le nouveau mot de passe'}
          </button>
          {forced ? (
            <button type="button" onClick={() => { logout(); navigate('/login', { replace: true }) }} style={linkBtnStyle}>
              Se déconnecter
            </button>
          ) : (
            <button type="button" onClick={() => navigate(homeRouteForRole(user?.adminRole))} style={linkBtnStyle}>
              Annuler
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(145deg, #caf0f8 0%, #90e0ef 35%, #ade8f4 65%, #e0f7fa 100%)',
  backgroundAttachment: 'fixed',
}

const cardStyle = {
  position: 'relative', zIndex: 1,
  background: 'rgba(255,255,255,0.65)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: 20,
  padding: '44px 40px',
  width: 380,
  boxShadow: '0 20px 60px rgba(0,119,182,0.18), 0 2px 8px rgba(0,0,0,0.05)',
}

const labelStyle = { display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 500, color: '#3a6080' }
const hintStyle  = { margin: '6px 0 0', fontSize: 11, color: '#5a7a96' }
const inputStyle = { ...glassInput, padding: '11px 14px', fontSize: 14 }

const errorStyle = {
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.25)',
  color: '#dc2626',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
}

const btnStyle = (disabled) => ({
  marginTop: 4,
  padding: '13px',
  borderRadius: 10,
  border: 'none',
  background: disabled
    ? 'rgba(0,180,216,0.5)'
    : 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: '0.02em',
  transition: 'all .2s',
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(0,119,182,0.35)',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const linkBtnStyle = {
  background: 'none', border: 'none', color: '#0077b6',
  fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
  padding: '4px 0',
}
