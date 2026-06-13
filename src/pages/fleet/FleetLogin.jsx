import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFleetAuth } from '../../contexts/FleetAuthContext'
import logoSrc from '../../assets/logo-dem.svg'
import { glassInput } from '../../lib/glassStyles'

export default function FleetLogin() {
  const { sendOtp, verifyOtp, loginWithPassword } = useFleetAuth()
  const navigate = useNavigate()

  // 'password' | 'otp-phone' | 'otp-code'
  const [mode, setMode] = useState('password')

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [phone, setPhone]           = useState('')
  const [code, setCode]             = useState('')

  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await loginWithPassword(identifier, password)
      navigate('/fleet')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Identifiants invalides.')
    } finally { setLoading(false) }
  }

  async function handleSendOtp(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      await sendOtp(phone)
      setMode('otp-code')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur lors de l\'envoi du code.')
    } finally { setLoading(false) }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const { hasPassword } = await verifyOtp(phone, code)
      navigate(hasPassword ? '/fleet' : '/fleet/set-password')
    } catch (err) {
      setError(err.response?.data?.message ?? err.message ?? 'Code invalide.')
    } finally { setLoading(false) }
  }

  function resetToPassword() {
    setMode('password'); setError(''); setPhone(''); setCode('')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(145deg, #caf0f8 0%, #90e0ef 35%, #ade8f4 65%, #e0f7fa 100%)',
      backgroundAttachment: 'fixed',
    }}>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'rgba(0,180,216,0.15)', top: '-80px', left: '-100px', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'rgba(0,119,182,0.12)', bottom: '-60px', right: '-80px', filter: 'blur(50px)' }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(144,224,239,0.20)', top: '40%', right: '15%', filter: 'blur(40px)' }} />
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(255,255,255,0.65)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.80)',
        borderRadius: 20,
        padding: '44px 40px',
        width: 380,
        boxShadow: '0 20px 60px rgba(0,119,182,0.18), 0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={logoSrc} alt="DEM" style={{ width: 90, height: 90, objectFit: 'contain', borderRadius: 20, marginBottom: 12 }} />
          <div style={{ color: '#5a7a96', fontSize: 13, letterSpacing: '0.02em' }}>
            Espace flotte — Connexion
          </div>
        </div>

        {mode === 'password' && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Téléphone ou email">
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="+221 77 000 00 00 ou email"
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Mot de passe">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={inputStyle}
              />
            </Field>

            {error && <ErrorBox>{error}</ErrorBox>}

            <SubmitButton loading={loading}>Se connecter</SubmitButton>

            <button
              type="button"
              onClick={() => { setMode('otp-phone'); setError('') }}
              style={linkStyle}
            >
              Première connexion ? Recevoir un code par SMS
            </button>
          </form>
        )}

        {mode === 'otp-phone' && (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <Field label="Numéro de téléphone">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+221 77 000 00 00"
                required
                style={inputStyle}
              />
            </Field>

            {error && <ErrorBox>{error}</ErrorBox>}

            <SubmitButton loading={loading}>Recevoir le code</SubmitButton>

            <button type="button" onClick={resetToPassword} style={linkStyle}>
              Retour à la connexion
            </button>
          </form>
        )}

        {mode === 'otp-code' && (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 13, color: '#3a6080', textAlign: 'center' }}>
              Code envoyé au {phone}
            </div>
            <Field label="Code reçu par SMS">
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                required
                style={inputStyle}
              />
            </Field>

            {error && <ErrorBox>{error}</ErrorBox>}

            <SubmitButton loading={loading}>Vérifier</SubmitButton>

            <button type="button" onClick={resetToPassword} style={linkStyle}>
              Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: 7, fontSize: 13, fontWeight: 500, color: '#3a6080' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ErrorBox({ children }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.25)',
      color: '#dc2626',
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 13,
    }}>
      {children}
    </div>
  )
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        marginTop: 4,
        padding: '13px',
        borderRadius: 10,
        border: 'none',
        background: loading
          ? 'rgba(0,180,216,0.5)'
          : 'linear-gradient(135deg, #00b4d8 0%, #0077b6 100%)',
        color: '#fff',
        fontWeight: 700,
        fontSize: 15,
        letterSpacing: '0.02em',
        transition: 'all .2s',
        boxShadow: loading ? 'none' : '0 4px 16px rgba(0,119,182,0.35)',
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? 'Patientez…' : children}
    </button>
  )
}

const inputStyle = {
  ...glassInput,
  padding: '11px 14px',
  fontSize: 14,
}

const linkStyle = {
  background: 'none',
  border: 'none',
  color: '#0077b6',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  padding: 4,
}
