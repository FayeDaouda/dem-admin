import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import logoSrc from '../assets/logo-dem.svg'
import { glassInput } from '../lib/glassStyles'
import { homeRouteForRole } from '../lib/roleHome'

// Politique mot de passe (identique au backend)
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
const PASSWORD_HINT = '8 caracteres minimum, avec une majuscule, une minuscule et un chiffre.'

// Champ mot de passe avec bouton afficher / masquer
function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        style={{ ...inputStyle, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        title={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: '#5a7a96', display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  // Changement mot de passe obligatoire
  const [mustChange, setMustChange]       = useState(false)
  const [currentPwd, setCurrentPwd]       = useState('')
  const [pendingRole, setPendingRole]     = useState(null)
  const [newPwd, setNewPwd]               = useState('')
  const [confirmPwd, setConfirmPwd]       = useState('')
  const [changeError, setChangeError]     = useState('')
  const [changeSaving, setChangeSaving]   = useState(false)

  // Reset password via OTP (identifiant = email ou téléphone)
  const [resetMode, setResetMode]           = useState(false)
  const [resetStep, setResetStep]           = useState('identifier') // identifier | otp | done
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetPhoneMasked, setResetPhoneMasked] = useState('')
  const [resetCode, setResetCode]           = useState('')
  const [resetNewPwd, setResetNewPwd]       = useState('')
  const [resetError, setResetError]         = useState('')
  const [resetLoading, setResetLoading]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(identifier, password)
      if (result.mustChangePassword) {
        setCurrentPwd(password)
        setPendingRole(result.adminRole)
        setMustChange(true)
      } else {
        navigate(homeRouteForRole(result.adminRole))
      }
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setChangeError('')
    if (!PASSWORD_PATTERN.test(newPwd)) { setChangeError(PASSWORD_HINT); return }
    if (newPwd !== confirmPwd) { setChangeError('Les mots de passe ne correspondent pas.'); return }
    setChangeSaving(true)
    try {
      await api.post('/admin/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd })
      navigate(homeRouteForRole(pendingRole))
    } catch (err) {
      setChangeError(err.response?.data?.message ?? 'Erreur.')
    } finally {
      setChangeSaving(false)
    }
  }

  async function handleRequestReset(e) {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)
    try {
      const { data } = await api.post('/admin/auth/request-reset', { identifier: resetIdentifier.trim() })
      setResetPhoneMasked(data.phoneMasked ?? '')
      setResetStep('otp')
    } catch (err) {
      setResetError(err.response?.data?.message ?? 'Erreur.')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setResetError('')
    if (!PASSWORD_PATTERN.test(resetNewPwd)) { setResetError(PASSWORD_HINT); return }
    setResetLoading(true)
    try {
      await api.post('/admin/auth/reset-password', { identifier: resetIdentifier.trim(), code: resetCode, newPassword: resetNewPwd })
      setResetStep('done')
    } catch (err) {
      setResetError(err.response?.data?.message ?? 'Erreur.')
    } finally {
      setResetLoading(false)
    }
  }

  // ── Modal changement mot de passe obligatoire ──
  if (mustChange) {
    return (
      <div style={pageStyle}>
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,180,216,0.15)', top: '-80px', left: '-100px', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'rgba(0,119,182,0.12)', bottom: '-60px', right: '-80px', filter: 'blur(50px)' }} />
        </div>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src={logoSrc} alt="DEM" style={{ width: 70, height: 70, objectFit: 'contain', borderRadius: 16, marginBottom: 10 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a3a52', marginBottom: 4 }}>Changement de mot de passe</h2>
            <p style={{ color: '#5a7a96', fontSize: 12, margin: 0 }}>Vous devez changer votre mot de passe par defaut avant de continuer.</p>
          </div>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <PasswordInput value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" />
              <p style={hintStyle}>{PASSWORD_HINT}</p>
            </div>
            <div>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <PasswordInput value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="Retapez le mot de passe" autoComplete="new-password" />
            </div>
            {changeError && <div style={errorStyle}>{changeError}</div>}
            <button type="submit" disabled={changeSaving} style={btnStyle(changeSaving)}>
              {changeSaving ? 'Mise a jour...' : 'Valider le nouveau mot de passe'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Flow reset mot de passe via OTP ──
  if (resetMode) {
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
              {resetStep === 'done' ? 'Mot de passe reinitialise' : 'Reinitialiser le mot de passe'}
            </h2>
          </div>

          {resetStep === 'identifier' && (
            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#5a7a96', fontSize: 12, margin: 0, textAlign: 'center' }}>
                Un code de verification sera envoye par SMS au numero associe a votre compte.
              </p>
              <div>
                <label style={labelStyle}>Email ou telephone</label>
                <input type="text" value={resetIdentifier} onChange={e => setResetIdentifier(e.target.value)} placeholder="nom@dem.sn ou +221 7X XXX XX XX" required style={inputStyle} />
              </div>
              {resetError && <div style={errorStyle}>{resetError}</div>}
              <button type="submit" disabled={resetLoading} style={btnStyle(resetLoading)}>
                {resetLoading ? 'Envoi...' : 'Envoyer le code SMS'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setResetError('') }} style={linkBtnStyle}>
                Retour a la connexion
              </button>
            </form>
          )}

          {resetStep === 'otp' && (
            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#5a7a96', fontSize: 12, margin: 0, textAlign: 'center' }}>
                Code envoye au {resetPhoneMasked || 'numero associe a votre compte'}
              </p>
              <div>
                <label style={labelStyle}>Code OTP (6 chiffres)</label>
                <input type="text" maxLength={6} value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" required style={{ ...inputStyle, textAlign: 'center', fontSize: 20, letterSpacing: 8 }} />
              </div>
              <div>
                <label style={labelStyle}>Nouveau mot de passe</label>
                <PasswordInput value={resetNewPwd} onChange={e => setResetNewPwd(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" />
                <p style={hintStyle}>{PASSWORD_HINT}</p>
              </div>
              {resetError && <div style={errorStyle}>{resetError}</div>}
              <button type="submit" disabled={resetLoading} style={btnStyle(resetLoading)}>
                {resetLoading ? 'Verification...' : 'Reinitialiser le mot de passe'}
              </button>
              <button type="button" onClick={() => { setResetStep('identifier'); setResetError('') }} style={linkBtnStyle}>
                Renvoyer le code
              </button>
            </form>
          )}

          {resetStep === 'done' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: 20 }}>Mot de passe mis a jour avec succes.</p>
              <button onClick={() => { setResetMode(false); setResetStep('identifier'); setResetError('') }} style={btnStyle(false)}>
                Se connecter
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Page login principale ──
  return (
    <div style={pageStyle}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,180,216,0.15)', top: '-80px', left: '-100px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'rgba(0,119,182,0.12)', bottom: '-60px', right: '-80px', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(144,224,239,0.20)', top: '40%', right: '15%', filter: 'blur(40px)' }} />
      </div>

      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={logoSrc} alt="DEM" style={{ width: 90, height: 90, objectFit: 'contain', borderRadius: 20, marginBottom: 12 }} />
          <div style={{ color: '#5a7a96', fontSize: 13, letterSpacing: '0.02em' }}>
            Connexion administrateur
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label htmlFor="identifier" style={labelStyle}>
              Email ou telephone
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="admin@dem.com ou +221..."
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>
              Mot de passe
            </label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" disabled={loading} style={btnStyle(loading)}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <button type="button" onClick={() => setResetMode(true)} style={linkBtnStyle}>
            Mot de passe oublie ?
          </button>
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

const hintStyle = { margin: '6px 0 0', fontSize: 11, color: '#5a7a96' }

const inputStyle = {
  ...glassInput,
  padding: '11px 14px',
  fontSize: 14,
}

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
