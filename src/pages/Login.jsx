import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import logoSrc from '../assets/logo-dem.svg'
import { glassInput } from '../lib/glassStyles'
import { homeRouteForRole } from '../lib/roleHome'
import PasswordInput from '../components/PasswordInput'

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  // Mot de passe oublié : demande envoyée au Super Admin (identifiant = email ou téléphone)
  const [resetMode, setResetMode]             = useState(false)
  const [resetStep, setResetStep]             = useState('identifier') // identifier | sent
  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetMessage, setResetMessage]       = useState('')
  const [resetError, setResetError]           = useState('')
  const [resetLoading, setResetLoading]       = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(identifier, password)
      navigate(result.mustChangePassword ? '/change-password' : homeRouteForRole(result.adminRole))
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestReset(e) {
    e.preventDefault()
    setResetError('')
    setResetLoading(true)
    try {
      const { data } = await api.post('/admin/auth/request-reset', { identifier: resetIdentifier.trim() })
      setResetMessage(data.message ?? 'Demande envoyée au Super Admin.')
      setResetStep('sent')
    } catch (err) {
      setResetError(err.response?.data?.message ?? 'Erreur.')
    } finally {
      setResetLoading(false)
    }
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
              {resetStep === 'sent' ? 'Demande envoyee' : 'Mot de passe oublie'}
            </h2>
          </div>

          {resetStep === 'identifier' && (
            <form onSubmit={handleRequestReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: '#5a7a96', fontSize: 12, margin: 0, textAlign: 'center' }}>
                Une demande de reinitialisation sera envoyee au Super Admin.
                Il reinitialisera votre mot de passe et vous communiquera le mot de passe par defaut.
              </p>
              <div>
                <label style={labelStyle}>Email ou telephone</label>
                <input type="text" value={resetIdentifier} onChange={e => setResetIdentifier(e.target.value)} placeholder="nom@dem.sn ou +221 7X XXX XX XX" required style={inputStyle} />
              </div>
              {resetError && <div style={errorStyle}>{resetError}</div>}
              <button type="submit" disabled={resetLoading} style={btnStyle(resetLoading)}>
                {resetLoading ? 'Envoi...' : 'Envoyer la demande'}
              </button>
              <button type="button" onClick={() => { setResetMode(false); setResetError('') }} style={linkBtnStyle}>
                Retour a la connexion
              </button>
            </form>
          )}

          {resetStep === 'sent' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <p style={{ color: '#22c55e', fontWeight: 600, marginBottom: 8 }}>Demande envoyee.</p>
              <p style={{ color: '#5a7a96', fontSize: 12, marginBottom: 20 }}>{resetMessage}</p>
              <p style={{ color: '#5a7a96', fontSize: 12, marginBottom: 20 }}>
                Apres reinitialisation, connectez-vous avec le mot de passe par defaut :
                vous devrez alors choisir un nouveau mot de passe.
              </p>
              <button onClick={() => { setResetMode(false); setResetStep('identifier'); setResetError(''); setResetIdentifier('') }} style={btnStyle(false)}>
                Retour a la connexion
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
              inputStyle={inputStyle}
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
