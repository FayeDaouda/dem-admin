import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, ArrowUpRight, Check, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react'
import wordmarkSrc from '../assets/dem-wordmark-white.svg'
import photoSrc from '../assets/login-coursier.jpg'
import { useProAuth, NotProAccount } from '../proAuthContext'
import { errMsg } from '../lib/proApi'
import { session } from '../lib/session'
import { Spinner } from '../ui/ui'

// Connexion à l'espace web DEM Pro — même compte, même code secret que
// dans l'application. Charte du site www.dem.sn : photo DEM sous voile
// sombre, titres DM Sans monumentaux, mot en serif italique cyan, surtitres
// en capitales espacées, angles vifs.
const pretty = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
// Saisie ou collage : « 77 123 45 67 », « +221 77… », « 0022177… », « 22177… »
const normalizePhone = (raw) => {
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00221')) d = d.slice(5)
  else if (d.startsWith('221') && d.length > 9) d = d.slice(3)
  return d.slice(0, 9)
}
const isValidPhone = (d) => /^7[015678]\d{7}$/.test(d) || /^33\d{7}$/.test(d)

const APP_STORE = 'https://apps.apple.com/us/app/dem-livraison/id6764724342'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=sn.dem.demapp'
const WHATSAPP = 'https://wa.me/221784448524?text=' + encodeURIComponent('Bonjour DEM, je souhaite ouvrir un compte DEM Pro pour ma boutique.')
const TRIAL = 'https://www.dem.sn/essai-gratuit-dem-pro'
const LINKS = [
  ['Conditions', 'https://www.dem.sn/terms'],
  ['Confidentialité', 'https://www.dem.sn/privacy'],
  ['Aide', 'https://wa.me/221784448524'],
]
const SETUP_STEP = { 'setup-otp': 1, 'setup-pin': 2, 'setup-confirm': 3 }

export default function Login() {
  const auth = useProAuth()
  const navigate = useNavigate()
  // phone → pin | otp | setup-otp → setup-pin → setup-confirm
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)
  const [code, setCode] = useState('')
  const [pin1, setPin1] = useState('')
  const [ticket, setTicket] = useState(null)
  // Motif d'une déconnexion par le serveur (appareil déconnecté, compte gelé…)
  const [error, setError] = useState(() => session.takeNotice() ?? '')
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const digits = phone
  const e164 = '+221' + digits
  const phoneOk = isValidPhone(digits)
  // Aide sur le numéro : seulement après la sortie du champ, jamais pendant la frappe
  const phoneHint = touched && digits.length > 0 && !phoneOk
    ? (digits.length < 9 ? 'Numéro incomplet : il faut 9 chiffres.' : 'Ce numéro ne semble pas valide. Il commence par 70, 75, 76, 77 ou 78.')
    : ''

  const failCode = (msg) => { setError(msg); setCode(''); setShake(n => n + 1) }

  async function run(fn) {
    setBusy(true); setError('')
    try { await fn() } catch (e) {
      const msg = e instanceof NotProAccount ? e.message : errMsg(e, 'Code incorrect.')
      if (step === 'phone') setError(msg); else failCode(msg)
    } finally { setBusy(false) }
  }

  const done = () => navigate('/', { replace: true })

  const submitPhone = (ev) => {
    ev?.preventDefault()
    if (!phoneOk) { setTouched(true); return }
    run(async () => {
      const next = await auth.identify(e164)
      if (next === 'PIN') { setCode(''); setStep('pin'); return }
      if (next === 'OTP_THEN_PIN') { const r = await auth.sendSetupOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('setup-otp'); return }
      const r = await auth.sendOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('otp')
    })
  }

  const forgotPin = () => run(async () => {
    const r = await auth.sendSetupOtp(e164); setResendIn(r?.resendAfter ?? 60); setCode(''); setStep('setup-otp')
  })

  const onCode = (value) => {
    setCode(value)
    if (error) setError('')
    if (value.length !== 6 || busy) return
    if (step === 'pin') run(async () => { await auth.loginWithPin(e164, value); done() })
    if (step === 'otp') run(async () => { await auth.verifyOtp(e164, value); done() })
    if (step === 'setup-otp') run(async () => { setTicket(await auth.verifySetupOtp(e164, value)); setCode(''); setStep('setup-pin') })
    if (step === 'setup-pin') { setPin1(value); setCode(''); setStep('setup-confirm') }
    if (step === 'setup-confirm') {
      if (value !== pin1) { failCode('Les deux codes ne sont pas identiques.'); return }
      run(async () => { await auth.setupPin(ticket, value); done() })
    }
  }

  const resend = () => run(async () => {
    const r = step === 'otp' ? await auth.sendOtp(e164) : await auth.sendSetupOtp(e164)
    setResendIn(r?.resendAfter ?? 60)
  })

  const backToPhone = () => { setStep('phone'); setError(''); setCode(''); setReveal(false) }

  const titles = {
    phone: ['Connexion', 'Accédez à vos ventes, vos livraisons et votre wallet avec le numéro de votre compte DEM Pro.'],
    pin: ['Code secret', 'Le code à 6 chiffres que vous utilisez dans l\'application DEM.'],
    otp: ['Vérification', 'Saisissez le code à 6 chiffres envoyé par SMS.'],
    'setup-otp': ['Vérification', 'Saisissez le code à 6 chiffres envoyé par SMS.'],
    'setup-pin': ['Votre code secret', '6 chiffres, à garder pour vous. Vous l\'utiliserez aussi dans l\'application.'],
    'setup-confirm': ['Confirmation', 'Saisissez votre code secret une seconde fois.'],
  }
  const [title, subtitle] = titles[step]
  const setupIndex = SETUP_STEP[step]
  const secret = step === 'pin' || step === 'setup-pin' || step === 'setup-confirm'

  return (
    <div className="pro login">
      <PhotoPanel />

      <section className="login-side">
        <span className="login-watermark" aria-hidden>DEM PRO</span>

        <main className="login-main">
          <div key={step} className="login-step">
            <p className="login-eyebrow"><span aria-hidden />DEM Pro · Espace commerçant</p>

            {step !== 'phone' && (
              <div className="login-chip">
                <span className="num">+221 {pretty(digits)}</span>
                <button type="button" onClick={backToPhone}>Modifier</button>
              </div>
            )}
            {setupIndex && (
              <div className="login-progress" aria-label={`Étape ${setupIndex} sur 3`}>
                <div className="login-progress-bars">{[1, 2, 3].map(i => <span key={i} className={i <= setupIndex ? 'on' : ''} />)}</div>
                <span>Étape {setupIndex} sur 3</span>
              </div>
            )}

            <h1 className="login-title">{title}<span className="login-dot-end">.</span></h1>
            <p className="login-sub">{subtitle}</p>

            {step === 'phone' ? (
              <form onSubmit={submitPhone} noValidate>
                <label className="login-label" htmlFor="login-phone">Numéro de téléphone</label>
                <div className={`login-phone ${error || phoneHint ? 'has-error' : ''} ${phoneOk ? 'is-valid' : ''}`}>
                  <span className="login-prefix"><SenegalFlag /> +221</span>
                  <input id="login-phone" type="tel" autoFocus inputMode="numeric" autoComplete="tel-national" placeholder="77 123 45 67"
                    aria-invalid={!!(error || phoneHint)} aria-describedby="login-phone-help"
                    value={pretty(digits)}
                    onChange={(e) => { setPhone(normalizePhone(e.target.value)); setTouched(false); if (error) setError('') }}
                    onBlur={() => setTouched(true)} />
                  <span className="login-valid" aria-hidden><Check size={16} strokeWidth={2.6} /></span>
                </div>
                <div id="login-phone-help" aria-live="polite">
                  {error ? <FieldError>{error}</FieldError>
                    : phoneHint ? <p className="login-help is-error">{phoneHint}</p>
                    : <p className="login-help">Le numéro utilisé dans l'application DEM.</p>}
                </div>
                <button className={`login-btn ${busy ? 'is-busy' : ''}`} type="submit" disabled={!phoneOk || busy} aria-busy={busy}>
                  {busy ? <><Spinner size={17} /> Vérification…</> : <>Continuer <ArrowRight size={18} className="login-btn-arrow" /></>}
                </button>
                <Assurances />
              </form>
            ) : (
              <>
                <div key={shake} className={shake ? 'login-shake' : undefined}>
                  <CodeInput value={code} onChange={onCode} disabled={busy} masked={secret && !reveal} invalid={!!error}
                    label={secret ? 'Code secret à 6 chiffres' : 'Code reçu par SMS, 6 chiffres'} />
                </div>
                <div aria-live="assertive">{error && <FieldError>{error}</FieldError>}</div>
                <div className="login-code-foot">
                  {busy ? (
                    <span className="login-verifying"><Spinner size={15} /> Vérification…</span>
                  ) : step === 'pin' ? (
                    <button type="button" className="login-link" onClick={forgotPin}>Code secret oublié&#8239;?</button>
                  ) : (step === 'otp' || step === 'setup-otp') ? (
                    resendIn > 0
                      ? <span className="login-muted">Renvoyer le code dans <span className="login-mono">{clock(resendIn)}</span></span>
                      : <button type="button" className="login-link" onClick={resend}>Renvoyer le code</button>
                  ) : <span />}
                  {secret && (
                    <button type="button" className="login-reveal" onClick={() => setReveal(r => !r)} aria-pressed={reveal}
                      aria-label={reveal ? 'Masquer le code' : 'Afficher le code'}>
                      {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                      {reveal ? 'Masquer' : 'Afficher'}
                    </button>
                  )}
                </div>
                <Assurances />
              </>
            )}
          </div>
        </main>

        <div className="login-cta-light"><ProCta tone="light" /></div>

        <div className="login-apps">
          <span>L'application DEM&nbsp;Pro</span>
          <div className="login-apps-row">
            <StoreButton href={APP_STORE} kind="apple" />
            <StoreButton href={PLAY_STORE} kind="google" />
          </div>
        </div>

        <footer className="login-foot">
          <span>© 2026 DEM</span>
          {LINKS.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)}
        </footer>
      </section>
    </div>
  )
}

function Assurances() {
  return (
    <ul className="login-assure">
      <li><Lock size={13} aria-hidden /> Connexion sécurisée</li>
      <li><ShieldCheck size={13} aria-hidden /> Même code secret que l'application</li>
    </ul>
  )
}

function FieldError({ children }) {
  return <p id="login-error" className="login-error" role="alert"><AlertCircle size={14} aria-hidden /> {children}</p>
}

function SenegalFlag() {
  return (
    <svg width="20" height="14" viewBox="0 0 30 20" aria-hidden className="login-flag">
      <rect width="10" height="20" fill="#00853f" />
      <rect x="10" width="10" height="20" fill="#fdef42" />
      <rect x="20" width="10" height="20" fill="#e31b23" />
      <polygon fill="#00853f" points="15,6.2 16.05,9.1 19.1,9.1 16.6,10.9 17.55,13.8 15,12 12.45,13.8 13.4,10.9 10.9,9.1 13.95,9.1" />
    </svg>
  )
}

// 6 cases, tiret au milieu ; collage d'un code complet accepté
function CodeInput({ value, onChange, disabled, masked, invalid, label }) {
  const ref = useRef(null)
  useEffect(() => { if (!disabled) ref.current?.focus() }, [disabled])
  return (
    <div className="login-code" onClick={() => ref.current?.focus()}>
      <input ref={ref} value={value} disabled={disabled} inputMode="numeric" autoComplete={masked ? 'off' : 'one-time-code'}
        aria-label={label} aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      {Array.from({ length: 6 }, (_, i) => {
        const filled = i < value.length
        const active = !disabled && i === value.length
        return (
          <FragmentWithDash key={i} dash={i === 3}>
            <div className={`login-cell ${filled ? 'filled' : ''} ${active ? 'active' : ''} ${invalid ? 'invalid' : ''}`} aria-hidden>
              {filled ? (masked ? <span className="login-dot" /> : <span className="num">{value[i]}</span>) : active ? <span className="login-caret" /> : null}
            </div>
          </FragmentWithDash>
        )
      })}
    </div>
  )
}

function FragmentWithDash({ dash, children }) {
  return <>{dash && <span className="login-code-dash" aria-hidden />}{children}</>
}

// Bloc de conversion pour qui n'a pas encore de compte : un conseiller DEM
// (WhatsApp) et l'essai gratuit. Sombre sur la photo (ordinateur), clair
// sous le formulaire (tablette, mobile).
function ProCta({ tone }) {
  return (
    <div className={`login-cta ${tone}`}>
      <span className="login-corner tl" aria-hidden /><span className="login-corner tr" aria-hidden />
      <span className="login-corner bl" aria-hidden /><span className="login-corner br" aria-hidden />
      <p className="login-cta-eyebrow"><span aria-hidden />Nouveau commerçant</p>
      <p className="login-cta-title">Pas encore DEM&nbsp;Pro&#8239;?</p>
      <p className="login-cta-text">
        On crée votre boutique en ligne et on vous fournit nos coursiers. Vos clients paient par Wave ou Orange&nbsp;Money, on les livre.
      </p>
      <a className="login-cta-btn" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon /> Parler à un conseiller <ArrowUpRight size={16} aria-hidden />
      </a>
      <a className="login-cta-link" href={TRIAL} target="_blank" rel="noopener noreferrer">
        Essai gratuit d'une semaine <ArrowUpRight size={14} aria-hidden />
      </a>
      <p className="login-cta-contacts">
        <a href="tel:+221784448524">+221&nbsp;78&nbsp;444&nbsp;85&nbsp;24</a>
        <span aria-hidden>·</span>
        <a href="mailto:contact@dem.sn">contact@dem.sn</a>
      </p>
    </div>
  )
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// Panneau photo, dans l'esprit du hero de www.dem.sn : photo DEM sous voile
// uni, titre monumental en bas à gauche, carte sombre « Pas encore DEM Pro ».
function PhotoPanel() {
  return (
    <aside className="login-photo" aria-label="DEM Pro">
      <img className="login-photo-img" src={photoSrc} alt="" />
      <span className="login-photo-veil" aria-hidden />

      <header className="login-brand">
        <img src={wordmarkSrc} alt="DEM" />
        <span className="login-brand-pro">Pro</span>
      </header>

      <div className="login-photo-bottom">
        <div className="login-hero">
          <span className="login-hero-script"><span>Espace</span></span>
          <span className="login-hero-title"><span>DEM</span><span>Pro</span></span>
          <p className="login-hero-sub">Votre boutique en ligne. Nos coursiers. Vos ventes livrées.</p>
        </div>
        <div className="login-cta-dark"><ProCta tone="dark" /></div>
      </div>
    </aside>
  )
}

function StoreButton({ href, kind }) {
  const apple = kind === 'apple'
  return (
    <a className="login-store" href={href} target="_blank" rel="noopener noreferrer"
      aria-label={apple ? "Télécharger DEM sur l'App Store" : 'Télécharger DEM sur Google Play'}>
      {apple ? (
        <svg width="15" height="18" viewBox="0 0 384 512" aria-hidden fill="currentColor">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
      ) : (
        <svg width="15" height="17" viewBox="0 0 512 512" aria-hidden>
          <path fill="#00d7fe" d="M47 25c-9 5-15 15-15 28v406c0 13 6 23 15 28l236-231z" />
          <path fill="#ffce00" d="M362 177l-79 79 79 79 89-51c25-14 25-42 0-56z" />
          <path fill="#00f076" d="M47 25l236 231 79-79L91 21c-17-10-33-8-44 4z" />
          <path fill="#f6374f" d="M47 487c11 12 27 14 44 4l271-156-79-79z" />
        </svg>
      )}
      <span className="login-store-text">
        <small>Disponible sur</small>
        <strong>{apple ? 'App Store' : 'Google Play'}</strong>
      </span>
    </a>
  )
}
