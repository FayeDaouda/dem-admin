import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, Bike, Store, LineChart, Lock, MessageSquareText } from 'lucide-react'
import logoSrc from '../../assets/logo-dem.svg'
import { useProAuth, NotProAccount } from '../proAuthContext'
import { errMsg } from '../lib/proApi'
import { Button } from '../ui/ui'

// Connexion à l'espace web DEM Pro — même compte, même code secret que
// dans l'application.
const toE164 = (v) => '+221' + String(v).replace(/\D/g, '').replace(/^221/, '').slice(0, 9)
const pretty = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))

const PERKS = [
  [Bike, 'Vos livraisons en direct', 'Créez une course et suivez votre coursier jusqu\'au client.'],
  [Store, 'Votre boutique en ligne', 'Produits, lien de commande, commandes reçues.'],
  [LineChart, 'Votre activité', 'Ventes, wallet et livraisons en un coup d\'œil.'],
]

export default function Login() {
  const auth = useProAuth()
  const navigate = useNavigate()
  // phone → pin | otp | setup-otp → setup-pin → setup-confirm
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [pin1, setPin1] = useState('')
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const e164 = toE164(phone)
  const phoneOk = /^\+2217[015678]\d{7}$/.test(e164) || /^\+22133\d{7}$/.test(e164)

  async function run(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) {
      setError(e instanceof NotProAccount ? e.message : errMsg(e, 'Code incorrect.'))
    } finally { setBusy(false) }
  }

  const done = () => navigate('/', { replace: true })

  const submitPhone = (ev) => { ev?.preventDefault(); run(async () => {
    const next = await auth.identify(e164)
    if (next === 'PIN') { setCode(''); setStep('pin'); return }
    if (next === 'OTP_THEN_PIN') { const r = await auth.sendSetupOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('setup-otp'); return }
    const r = await auth.sendOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('otp')
  }) }

  const forgotPin = () => run(async () => {
    const r = await auth.sendSetupOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('setup-otp')
  })

  const onCode = (value) => {
    setCode(value)
    if (value.length !== 6 || busy) return
    if (step === 'pin') run(async () => { await auth.loginWithPin(e164, value); done() })
    if (step === 'otp') run(async () => { await auth.verifyOtp(e164, value); done() })
    if (step === 'setup-otp') run(async () => { setTicket(await auth.verifySetupOtp(e164, value)); setCode(''); setStep('setup-pin') })
    if (step === 'setup-pin') { setPin1(value); setCode(''); setStep('setup-confirm') }
    if (step === 'setup-confirm') {
      if (value !== pin1) { setError('Les deux codes ne sont pas identiques.'); setCode(''); return }
      run(async () => { await auth.setupPin(ticket, value); done() })
    }
  }

  const resend = () => run(async () => {
    const r = step === 'otp' ? await auth.sendOtp(e164) : await auth.sendSetupOtp(e164)
    setResendIn(r?.resendAfter ?? 60)
  })

  const titles = {
    phone: ['Connexion', 'Avec le numéro de votre compte DEM Pro.'],
    pin: ['Votre code secret', 'Le code à 6 chiffres que vous utilisez dans l\'application.'],
    otp: ['Code de vérification', `Envoyé par SMS au ${pretty(phone.replace(/\D/g, ''))}.`],
    'setup-otp': ['Code de vérification', `Envoyé par SMS au ${pretty(phone.replace(/\D/g, ''))}.`],
    'setup-pin': ['Créez votre code secret', '6 chiffres, à garder pour vous. Le même dans l\'application.'],
    'setup-confirm': ['Confirmez votre code', 'Saisissez-le une seconde fois.'],
  }
  const [title, subtitle] = titles[step]

  return (
    <div className="pro" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)', minHeight: '100vh' }}>
      {/* ── Panneau de marque ── */}
      <aside className="pro-login-brand" style={{
        position: 'relative', overflow: 'hidden', color: '#fff', padding: '48px 56px',
        background: 'radial-gradient(1200px 600px at -10% -10%, #0cb8de 0%, transparent 55%), linear-gradient(160deg, #0671ba 0%, #04317c 55%, #021b47 100%)',
        display: 'flex', flexDirection: 'column',
      }}>
        <Glow top="62%" left="70%" size={420} />
        <Glow top="-8%" left="58%" size={260} delay="2s" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }} className="anim-up">
          <img src={logoSrc} alt="DEM" style={{ height: 38 }} />
          <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,.14)', fontSize: 11, fontWeight: 800, letterSpacing: 1.6 }}>PRO</span>
        </div>
        <div style={{ margin: 'auto 0', position: 'relative', maxWidth: 520 }} className="stagger">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 20, background: 'rgba(255,255,255,.1)', fontSize: 12.5, fontWeight: 700 }}>
            <span className="live-dot" style={{ background: '#5eead4' }} /> Synchronisé avec votre application
          </div>
          <h1 style={{ fontSize: 44, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-1.2px', margin: '18px 0 14px' }}>
            Votre activité DEM Pro,<br />sur grand écran.
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.75)', margin: 0, fontWeight: 500 }}>
            Livraisons, boutique, ventes et wallet : tout ce que vous faites dans l'application, en plus confortable.
          </p>
          <div style={{ marginTop: 34, display: 'grid', gap: 16 }}>
            {PERKS.map((perk) => <Perk key={perk[1]} perk={perk} />)}
          </div>
        </div>
        <div style={{ position: 'relative', fontSize: 12, color: 'rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> Connexion chiffrée · Même code secret que l'application
        </div>
      </aside>

      {/* ── Formulaire ── */}
      <main style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
        <div key={step} className="anim-scale" style={{ width: '100%', maxWidth: 400 }}>
          {step !== 'phone' && (
            <button className="btn btn-ghost btn-sm" style={{ marginBottom: 22 }} onClick={() => { setStep('phone'); setError(''); setCode('') }}>
              <ArrowLeft size={15} /> Changer de numéro
            </button>
          )}
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(135deg, #e3f8fc, #e6f0fb)', color: 'var(--p-cyan-2)', display: 'grid', placeItems: 'center', marginBottom: 18 }}>
            {step === 'phone' ? <Store size={24} /> : step.startsWith('setup-p') || step === 'setup-confirm' || step === 'pin' ? <Lock size={24} /> : <MessageSquareText size={24} />}
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.6px', margin: 0 }}>{title}</h2>
          <p className="muted" style={{ margin: '6px 0 26px', fontSize: 14 }}>{subtitle}</p>

          {step === 'phone' ? (
            <form onSubmit={submitPhone}>
              <label className="field">
                <span>Numéro de téléphone</span>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="input" style={{ width: 82, display: 'grid', placeItems: 'center', background: 'var(--p-soft)', flexShrink: 0 }}>🇸🇳 +221</div>
                  <input className="input" autoFocus inputMode="numeric" placeholder="77 123 45 67"
                    value={pretty(phone.replace(/\D/g, '').slice(0, 9))}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} />
                </div>
              </label>
              {error && <ErrorBox>{error}</ErrorBox>}
              <Button size="lg" loading={busy} disabled={!phoneOk} style={{ width: '100%', marginTop: 20 }} type="submit">
                Continuer <ArrowRight size={17} />
              </Button>
              <p className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 18 }}>
                Pas encore de compte DEM Pro ? Créez-le dans l'application DEM, puis connectez-vous ici.
              </p>
            </form>
          ) : (
            <>
              <CodeInput value={code} onChange={onCode} disabled={busy} secret={step === 'pin' || step === 'setup-pin' || step === 'setup-confirm'} />
              {error && <ErrorBox>{error}</ErrorBox>}
              {busy && <div className="muted" style={{ fontSize: 13, marginTop: 14, textAlign: 'center' }}>Vérification…</div>}
              <div style={{ marginTop: 22, textAlign: 'center', fontSize: 13 }}>
                {step === 'pin' && <span className="link" onClick={forgotPin}>Code secret oublié ?</span>}
                {(step === 'otp' || step === 'setup-otp') && (
                  resendIn > 0
                    ? <span className="muted">Renvoyer le code dans {resendIn} s</span>
                    : <span className="link" onClick={resend}>Renvoyer le code</span>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <style>{`@media (max-width: 900px) { .pro-login-brand { display: none !important; } .pro[style] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}

function Perk({ perk }) {
  const [Icon, t, d] = perk
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.16)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={20} /></div>
      <div><div style={{ fontWeight: 800, fontSize: 14.5 }}>{t}</div><div style={{ color: 'rgba(255,255,255,.65)', fontSize: 13.5 }}>{d}</div></div>
    </div>
  )
}

function Glow({ top, left, size, delay = '0s' }) {
  return <div aria-hidden style={{
    position: 'absolute', top, left, width: size, height: size, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(12,184,222,.35), transparent 65%)',
    animation: `pro-float 7s ease-in-out ${delay} infinite`, pointerEvents: 'none',
  }} />
}

function ErrorBox({ children }) {
  return <div className="anim-up" style={{ marginTop: 14, padding: '11px 14px', borderRadius: 12, background: 'var(--p-danger-bg)', color: 'var(--p-danger)', fontSize: 13, fontWeight: 600 }}>{children}</div>
}

// 6 cases ; collage d'un code complet accepté
function CodeInput({ value, onChange, disabled, secret }) {
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => { if (!disabled) ref.current?.focus() }, [disabled])
  return (
    <div style={{ position: 'relative' }} onClick={() => ref.current?.focus()}>
      <input ref={ref} value={value} disabled={disabled} inputMode="numeric" autoComplete="one-time-code"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'text' }} aria-label="Code à 6 chiffres" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {Array.from({ length: 6 }, (_, i) => {
          const filled = i < value.length
          const active = i === value.length
          return (
            <div key={i} style={{
              height: 58, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 800,
              border: `1.5px solid ${active ? 'var(--p-cyan)' : filled ? '#b9c8dc' : 'var(--p-line)'}`,
              boxShadow: active ? '0 0 0 4px rgba(12,184,222,.14)' : 'none', background: '#fff',
              transition: 'border-color .15s, box-shadow .15s', transform: filled ? 'scale(1)' : 'scale(.98)',
            }}>
              {filled ? (secret ? <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--p-ink)', animation: 'pro-scale-in .2s both' }} /> : value[i]) : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
