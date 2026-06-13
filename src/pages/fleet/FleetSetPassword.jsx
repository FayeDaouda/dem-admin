import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFleetAuth } from '../../contexts/FleetAuthContext'
import logoSrc from '../../assets/logo-dem.svg'
import { glassInput } from '../../lib/glassStyles'

export default function FleetSetPassword() {
  const { fleetUser, setPassword } = useFleetAuth()
  const navigate = useNavigate()

  const [password, setPwd]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fleetUser) navigate('/fleet/login', { replace: true })
    else if (fleetUser.hasPassword) navigate('/fleet', { replace: true })
  }, [fleetUser, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setLoading(true)
    try {
      await setPassword(password, email.trim())
      navigate('/fleet')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Erreur lors de la définition du mot de passe.')
    } finally { setLoading(false) }
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
          <div style={{ fontWeight: 700, fontSize: 16, color: '#04317C', marginBottom: 4 }}>
            Bienvenue {fleetUser?.name?.trim() || ''}
          </div>
          <div style={{ color: '#5a7a96', fontSize: 13, letterSpacing: '0.02em' }}>
            Définissez votre mot de passe pour vos prochaines connexions
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Field label="Nouveau mot de passe">
            <input
              type="password"
              value={password}
              onChange={e => setPwd(e.target.value)}
              placeholder="Au moins 6 caractères"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Confirmer le mot de passe">
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </Field>
          <Field label="Email (optionnel — pour vous reconnecter)">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              style={inputStyle}
            />
          </Field>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.10)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#dc2626',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

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
            {loading ? 'Enregistrement…' : 'Continuer'}
          </button>
        </form>
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

const inputStyle = {
  ...glassInput,
  padding: '11px 14px',
  fontSize: 14,
}
