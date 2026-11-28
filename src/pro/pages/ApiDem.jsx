import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, BookOpen, Check, CheckCircle2, Copy, FlaskConical, Globe, KeyRound, Lock, Mail, MoreHorizontal,
  Pause, Play, Plug, RefreshCw, ShoppingCart, Trash2, Webhook,
} from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { dateTime, num, timeAgo } from '../lib/format'
import { Button, Chip, Drawer, Empty, ErrorState, IconButton, Modal, PageHeader, Segmented, Skeleton, Spinner } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import RequireAccess from '../ui/RequireAccess'
import PlanPurchaseModal from '../ui/PlanPurchaseModal'
import { SUPPORT } from '../support'
import '../styles/account.css'

// API DEM et « Brancher mon site » (offre Premium) — même écran que l'app
// (dem_pro_api_screen.dart, dem_pro_api_logs.dart), routes /dem-pro/me/api/*.
// La clé complète n'est renvoyée qu'UNE fois par le serveur (création,
// renouvellement) : affichée dans une fenêtre qu'on ne ferme qu'après l'avoir
// copiée, jamais gardée ensuite.
const SCOPES = [
  ['quotes:read', 'Devis', 'Demander le prix d\'une livraison'],
  ['deliveries:create', 'Créer des livraisons', 'Envoyer une commande à DEM'],
  ['deliveries:read', 'Lire les livraisons', 'Voir leur statut'],
  ['tracking:read', 'Suivi', 'Lien de suivi et position du coursier'],
  ['deliveries:cancel', 'Annuler', 'Annuler une livraison'],
  ['webhooks:manage', 'Webhooks', 'Déclarer les adresses prévenues à chaque étape'],
]
const CONNECT_SCOPES = ['quotes:read', 'deliveries:create', 'deliveries:read', 'deliveries:cancel', 'tracking:read', 'webhooks:manage']
const DEFAULT_SCOPES = ['quotes:read', 'deliveries:create', 'deliveries:read', 'tracking:read']
const scopeLabel = (s) => SCOPES.find(x => x[0] === s)?.[1] ?? s

// Erreurs de l'API expliquées simplement (dem_pro_api_logs.dart)
const ERROR_HELP = {
  UNAUTHORIZED: 'Clé absente ou mal recopiée.',
  API_KEY_REVOKED: 'Cette clé a été révoquée : donnez-en une nouvelle à votre développeur.',
  API_KEY_DISABLED: 'Cette clé est désactivée : réactivez-la ici.',
  API_KEY_EXPIRED: 'Cette clé a expiré : créez-en une nouvelle.',
  FORBIDDEN: 'La clé n\'a pas le droit de faire cette action (droits choisis à sa création).',
  IP_NOT_ALLOWED: 'Appel venu d\'une adresse IP non autorisée pour votre compte.',
  RATE_LIMIT_EXCEEDED: 'Trop d\'appels en une minute : le site doit ralentir puis réessayer.',
  DELIVERY_QUOTA_EXCEEDED: 'Nombre de livraisons autorisées aujourd\'hui atteint.',
  INVALID_REQUEST: 'Informations envoyées incomplètes ou invalides.',
  INVALID_ADDRESS: 'Adresse introuvable : à préciser (quartier, repère).',
  OUT_OF_SERVICE_AREA: 'Adresse hors de la zone desservie par DEM.',
  PICKUP_REQUIRED: 'Point de retrait manquant.',
  INVALID_STORE: 'Point de retrait inconnu.',
  QUOTE_EXPIRED: 'Prix expiré (valable 15 min) : le site doit redemander un prix.',
  QUOTE_ALREADY_USED: 'Ce prix a déjà servi pour une livraison.',
  QUOTE_MISMATCH: 'Le prix ne correspond pas à cette livraison.',
  QUOTE_NOT_FOUND: 'Prix introuvable.',
  IDEMPOTENCY_KEY_REQUIRED: 'Le site doit envoyer un identifiant unique par commande (Idempotency-Key).',
  IDEMPOTENCY_CONFLICT: 'Même identifiant de commande réutilisé avec d\'autres informations.',
  IDEMPOTENCY_IN_PROGRESS: 'La même commande est déjà en cours de création.',
  INSUFFICIENT_WALLET_BALANCE: 'Solde du wallet insuffisant pour payer la livraison.',
  DELIVERY_NOT_FOUND: 'Livraison introuvable.',
  INVALID_DELIVERY_STATE: 'Action impossible à cette étape de la livraison.',
  NOT_FOUND: 'Adresse d\'API inconnue.',
  WEBHOOK_LIMIT: 'Nombre maximum d\'adresses webhook atteint.',
  INTERNAL_ERROR: 'Incident côté DEM : réessayez ; s\'il persiste, contactez le support avec l\'identifiant de l\'appel.',
}
const msOf = (n) => (n == null ? '—' : n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(1).replace('.', ',')} s`)
const keyUsed = (d) => (d ? `Utilisée ${timeAgo(d)}` : 'Jamais utilisée')

export default function ApiDemPage() {
  return <RequireAccess area="api"><ApiDem /></RequireAccess>
}

function ApiDem() {
  const { user } = useProAuth()
  const notify = useNotify()
  const shop = user?.proBusinessName || 'ma boutique'
  const [overview, setOverview] = useState(null)
  const [webhooks, setWebhooks] = useState(null)
  const [logs, setLogs] = useState(null)
  const [failed, setFailed] = useState(false)
  const [connecting, setConnecting] = useState(null)
  const [creating, setCreating] = useState(false)
  const [secret, setSecret] = useState(null) // { secret, key, platform?, note? } — affiché une fois
  const [confirm, setConfirm] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [offers, setOffers] = useState(false)
  const [journal, setJournal] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const [o, w, l] = await Promise.allSettled([
      proApi.get('/dem-pro/me/api'),
      proApi.get('/dem-pro/me/api/webhooks'),
      proApi.get('/dem-pro/me/api/logs', { params: { limit: 8 } }),
    ])
    if (o.status === 'fulfilled') setOverview(o.value.data); else setFailed(true)
    setWebhooks(w.status === 'fulfilled' ? w.value.data : null)
    setLogs(l.status === 'fulfilled' ? (l.value.data?.logs ?? []) : null)
  }, [])
  useEffect(() => { load() }, [load])

  const available = overview?.available === true
  const keys = overview?.keys ?? []
  const activeKeys = keys.filter(k => k.status === 'ACTIVE').length

  // « Brancher mon site » : un code de connexion de Production, tous droits
  const connect = async (platform) => {
    if (connecting) return
    setConnecting(platform)
    try {
      const r = await proApi.post('/dem-pro/me/api/keys', { name: platform === 'woocommerce' ? 'Site WooCommerce' : 'Mon site', environment: 'LIVE', scopes: CONNECT_SCOPES })
      setSecret({ ...r.data, platform })
      load()
    } catch (e) { notify.error('Le code n\'a pas été créé', errMsg(e)) } finally { setConnecting(null) }
  }

  const keyAction = (k, action) => {
    const name = k.name ?? 'cette clé'
    const cfg = {
      rotate: { title: `Renouveler « ${name} » ?`, text: 'Une nouvelle clé est créée avec les mêmes droits. L\'ancienne fonctionne encore 24 h, le temps que votre développeur la remplace.', cta: 'Renouveler', variant: 'primary' },
      revoke: { title: `Révoquer « ${name} » ?`, text: 'Définitif : le site qui l\'utilise ne pourra plus créer de livraisons. Il faudra lui donner une nouvelle clé.', cta: 'Révoquer la clé', variant: 'danger' },
      disable: { title: `Désactiver « ${name} » ?`, text: 'Ses appels sont refusés jusqu\'à ce que vous la réactiviez.', cta: 'Désactiver', variant: 'primary' },
      enable: { title: `Réactiver « ${name} » ?`, text: 'Le site qui l\'utilise pourra de nouveau créer des livraisons.', cta: 'Réactiver', variant: 'primary' },
    }[action]
    setConfirm({
      ...cfg,
      run: async () => {
        try {
          if (action === 'rotate') {
            const r = await proApi.post(`/dem-pro/me/api/keys/${k.id}/rotate`)
            setSecret({ ...r.data, note: 'L\'ancienne clé fonctionne encore 24 h.' })
          } else if (action === 'revoke') {
            await proApi.post(`/dem-pro/me/api/keys/${k.id}/revoke`)
            notify.success('Clé révoquée')
          } else {
            await proApi.patch(`/dem-pro/me/api/keys/${k.id}`, { status: action === 'disable' ? 'DISABLED' : 'ACTIVE' })
            notify.success(action === 'disable' ? 'Clé désactivée' : 'Clé réactivée')
          }
          load()
        } catch (e) { notify.error('Action impossible', errMsg(e)); throw e }
      },
    })
  }
  const runConfirm = async () => {
    setConfirmBusy(true)
    try { await confirm.run(); setConfirm(null) } catch { /* message déjà affiché */ } finally { setConfirmBusy(false) }
  }

  return (
    <div className="api-page">
      <PageHeader eyebrow="Compte" title={<>API DEM<span className="dot">.</span></>}
        description="Votre site ou votre application crée ses livraisons DEM tout seul : plus rien à recopier quand une commande arrive."
        actions={<Button variant="ghost" icon={BookOpen} href={SUPPORT.apiDocs} target="_blank" rel="noopener noreferrer">Documentation</Button>} />

      {failed && !overview ? <div className="card"><ErrorState title="Impossible de charger l'API DEM" onRetry={load} /></div>
        : !overview ? <div style={{ display: 'grid', gap: 16 }}><Skeleton h={180} /><Skeleton h={120} /></div>
        : (
          <div style={{ display: 'grid', gap: 24 }}>
            {!available ? (
              <LockedCard reason={overview.reason} enterprise={overview.enterprise} onOffers={() => setOffers(true)} />
            ) : (
              <section className="card api-connect has-corners">
                <span className="corner tl" aria-hidden /><span className="corner tr" aria-hidden />
                <div className="api-connect-head">
                  <span className="api-connect-ico"><Plug size={20} aria-hidden /></span>
                  <div>
                    <h2 className="api-h2">Brancher mon site</h2>
                    <p className="muted" style={{ margin: '4px 0 0', fontSize: 14 }}>Vos commandes en ligne partent seules chez un coursier DEM, qui récupère le colis et le livre à votre client.</p>
                  </div>
                </div>
                <div className="api-connect-opts">
                  <button type="button" className="api-opt" disabled={!!connecting} onClick={() => connect('woocommerce')} aria-busy={connecting === 'woocommerce' || undefined}>
                    <ShoppingCart size={20} aria-hidden />
                    <span><strong>Mon site est sur WooCommerce</strong><small>Module DEM à installer, puis collez votre code</small></span>
                    {connecting === 'woocommerce' && <Spinner size={16} />}
                  </button>
                  <button type="button" className="api-opt" disabled={!!connecting} onClick={() => connect('other')} aria-busy={connecting === 'other' || undefined}>
                    <Globe size={20} aria-hidden />
                    <span><strong>Autre site</strong><small>Envoyez le code à votre développeur</small></span>
                    {connecting === 'other' && <Spinner size={16} />}
                  </button>
                </div>
                <div className="api-quotas">
                  <div><span className="num">{overview.quotas?.deliveriesPerDay != null ? num(overview.quotas.deliveriesPerDay) : '—'}</span> livraisons par jour</div>
                  <div><span className="num">{overview.quotas?.requestsPerMinute != null ? num(overview.quotas.requestsPerMinute) : '—'}</span> appels par minute</div>
                  <div><span className="num">{activeKeys}</span> clé{activeKeys > 1 ? 's' : ''} active{activeKeys > 1 ? 's' : ''}</div>
                </div>
              </section>
            )}

            {(keys.length > 0 || available) && (
              <section>
                <div className="api-sec-head">
                  <h2 className="api-h2">Mes clés</h2>
                  {available && <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setCreating(true)}>Créer une clé</Button>}
                </div>
                <div className="card api-keys">
                  {keys.length === 0 ? (
                    <Empty icon={KeyRound} title="Pas encore de clé" text="Branchez votre site ci-dessus, ou créez une clé de Test pour votre développeur." />
                  ) : keys.map(k => <KeyRow key={k.id} k={k} editable={available} onAction={(a) => keyAction(k, a)} />)}
                </div>
                {available && <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>Clé sur mesure (droits, mode Test) : pour les développeurs. Une clé donne accès à votre compte : ne la publiez jamais.</p>}
              </section>
            )}

            {webhooks?.endpoints?.length > 0 && <WebhooksCard webhooks={webhooks} />}

            {logs && (available || logs.length > 0) && (
              <section>
                <div className="api-sec-head">
                  <h2 className="api-h2">Derniers appels de votre site</h2>
                  <Button size="sm" variant="quiet" onClick={() => setJournal(true)}>Voir tout le journal</Button>
                </div>
                <div className="card api-logs">
                  {logs.length === 0
                    ? <Empty icon={Webhook} title="Aucun appel pour l'instant" text="Les appels faits par votre site avec vos clés apparaîtront ici." />
                    : <LogsList logs={logs} />}
                </div>
              </section>
            )}

            <HowItWorks />
          </div>
        )}

      <CreateKeyModal open={creating} onClose={() => setCreating(false)} onCreated={(d) => { setCreating(false); setSecret(d); load() }} />
      {/* key : chaque nouvelle clé repart de « pas encore copiée » */}
      <SecretModal key={secret?.key?.id ?? 'none'} data={secret} shop={shop} onClose={() => setSecret(null)} />
      <Modal open={!!confirm} onClose={() => !confirmBusy && setConfirm(null)} title={confirm?.title} subtitle={confirm?.text} width={460}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>Annuler</Button><Button variant={confirm?.variant} loading={confirmBusy} onClick={runConfirm}>{confirm?.cta}</Button></>} />
      <PlanPurchaseModal open={offers} onClose={() => setOffers(false)} onChanged={load} />
      <JournalDrawer open={journal} onClose={() => setJournal(false)} />
    </div>
  )
}

function LockedCard({ reason, enterprise, onOffers }) {
  const suspended = reason === 'ORGANIZATION_SUSPENDED'
  const inactive = reason === 'ACCOUNT_INACTIVE'
  return (
    <section className="card api-locked">
      <span className="api-locked-ico"><Lock size={20} aria-hidden /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 className="api-h2">{suspended ? 'Accès API suspendu' : 'Branchez votre site à DEM'}</h2>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14, lineHeight: 1.55 }}>
          {suspended ? 'L\'équipe DEM a suspendu l\'accès API de votre compte. Contactez le support pour le rétablir.'
            : inactive ? 'Votre compte DEM Pro doit être actif pour utiliser l\'API.'
            : enterprise ? 'Votre accès à l\'API est prévu par votre contrat DEM Entreprise.'
            : 'L\'API DEM est incluse dans l\'offre Premium : votre site WooCommerce ou votre application crée ses livraisons tout seul. Si l\'offre s\'arrête, vos clés sont refusées jusqu\'à son renouvellement.'}
        </p>
      </div>
      {!suspended && !inactive && <Button arrow="right" onClick={onOffers}>Voir les offres</Button>}
      {suspended && <Button variant="ghost" href={`mailto:${SUPPORT.email}`} icon={Mail}>Écrire au support</Button>}
    </section>
  )
}

function KeyRow({ k, editable, onAction }) {
  const live = k.environment === 'LIVE'
  const expired = k.status === 'ACTIVE' && k.expiresAt && new Date(k.expiresAt) < new Date()
  const [label, color, bg] = expired ? ['Expirée', 'var(--p-danger)', 'var(--p-danger-bg)']
    : k.status === 'DISABLED' ? ['Désactivée', 'var(--p-warning)', 'var(--p-warning-bg)']
    : k.status === 'REVOKED' ? ['Révoquée', 'var(--p-danger)', 'var(--p-danger-bg)']
    : ['Active', 'var(--p-success)', 'var(--p-success-bg)']
  return (
    <div className={`api-key ${k.status === 'REVOKED' ? 'is-revoked' : ''}`}>
      <span className="api-key-ico" aria-hidden>{live ? <KeyRound size={17} /> : <FlaskConical size={17} />}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="api-key-top">
          <strong>{k.name ?? 'Clé'}</strong>
          <Chip color={live ? 'var(--p-dark)' : 'var(--p-slate)'} bg={live ? '#EEF4FF' : 'var(--p-slate-bg)'}>{live ? 'Production' : 'Test'}</Chip>
          <Chip color={color} bg={bg}>{label}</Chip>
        </div>
        <div className="mono api-key-prefix">{k.prefix}••••••••</div>
        <div className="muted api-key-meta">{keyUsed(k.lastUsedAt)} · {(k.scopes ?? []).map(scopeLabel).join(', ')}</div>
      </div>
      {editable && k.status !== 'REVOKED' && <KeyMenu k={k} expired={expired} onAction={onAction} />}
    </div>
  )
}

function KeyMenu({ k, expired, onAction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc) }
  }, [open])
  const act = (a) => () => { setOpen(false); onAction(a) }
  return (
    <div className="dl-menu-wrap" ref={ref}>
      <IconButton icon={MoreHorizontal} label={`Actions pour ${k.name}`} size="sm" variant="plain" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} />
      {open && (
        <div className="dl-menu" role="menu">
          {k.status === 'ACTIVE' && !expired && <button type="button" role="menuitem" onClick={act('rotate')}><RefreshCw size={15} aria-hidden /> Renouveler la clé</button>}
          {k.status === 'ACTIVE'
            ? <button type="button" role="menuitem" onClick={act('disable')}><Pause size={15} aria-hidden /> Désactiver</button>
            : <button type="button" role="menuitem" onClick={act('enable')}><Play size={15} aria-hidden /> Réactiver</button>}
          <span className="dl-menu-sep" aria-hidden />
          <button type="button" role="menuitem" className="danger" onClick={act('revoke')}><Trash2 size={15} aria-hidden /> Révoquer</button>
        </div>
      )}
    </div>
  )
}

function CreateKeyModal({ open, onClose, onCreated }) {
  const notify = useNotify()
  const [name, setName] = useState('')
  const [env, setEnv] = useState('TEST')
  const [scopes, setScopes] = useState(DEFAULT_SCOPES)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setName(''); setEnv('TEST'); setScopes(DEFAULT_SCOPES); setError('') } }, [open])
  const toggle = (s) => setScopes(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]))
  const ok = name.trim().length >= 2 && scopes.length > 0
  const save = async () => {
    if (!ok || busy) return
    setBusy(true); setError('')
    try {
      const r = await proApi.post('/dem-pro/me/api/keys', { name: name.trim(), environment: env, scopes })
      onCreated(r.data)
    } catch (e) { setError(errMsg(e, 'Impossible de créer la clé.')); notify.error('La clé n\'a pas été créée', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Créer une clé" subtitle="Donnez-lui le nom du site qui l'utilisera." width={540}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} disabled={!ok} onClick={save}>Créer la clé</Button></>}>
      <div style={{ display: 'grid', gap: 18 }}>
        <label className="field">
          <span>Nom de la clé</span>
          <input className="input" autoFocus maxLength={60} value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Site WooCommerce" />
        </label>
        <div className="field">
          <span>Mode</span>
          <Segmented full value={env} onChange={setEnv} label="Mode de la clé" options={[['TEST', 'Test : aucune vraie course', FlaskConical], ['LIVE', 'Production : vraies livraisons', KeyRound]]} />
        </div>
        <fieldset className="api-scopes">
          <legend>Ce que la clé peut faire</legend>
          {SCOPES.map(([k, label, hint]) => (
            <label key={k} className={`api-scope ${scopes.includes(k) ? 'is-on' : ''}`}>
              <input type="checkbox" checked={scopes.includes(k)} onChange={() => toggle(k)} />
              <span className="api-scope-box" aria-hidden>{scopes.includes(k) && <Check size={12} strokeWidth={3} />}</span>
              <span><strong>{label}</strong><small>{hint}</small></span>
            </label>
          ))}
        </fieldset>
        {error && <p className="ac-form-error" role="alert">{error}</p>}
      </div>
    </Modal>
  )
}

// La clé complète, affichée UNE fois : fermeture seulement après copie (ou
// confirmation explicite), puis oubliée.
function SecretModal({ data, shop, onClose }) {
  const notify = useNotify()
  const [copied, setCopied] = useState(false)
  const [sure, setSure] = useState(false)
  if (!data) return null
  const value = data.secret ?? ''
  const platform = data.platform
  const woo = platform === 'woocommerce'
  const live = data.key?.environment === 'LIVE'
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); notify.success(platform ? 'Code copié' : 'Clé copiée') }
    catch { notify.error('Copie impossible', 'Sélectionnez le texte et copiez-le à la main.') }
  }
  const mailBody = platform
    ? (woo
      ? `Code de connexion DEM de ${shop} pour WooCommerce :\n\n${value}\n\n1. Télécharger le module DEM Livraison : ${SUPPORT.connectSite}\n2. WordPress › Extensions › Ajouter › Téléverser, puis activer\n3. WooCommerce › Réglages › DEM Livraison : coller ce code, enregistrer, puis « Brancher les webhooks ».\n\nCe code est secret : ne le publiez nulle part.`
      : `Code de connexion DEM de ${shop} :\n\n${value}\n\nDocumentation pour brancher le site : ${SUPPORT.apiDocs}\nCe code est secret : à garder sur le serveur du site, jamais dans le code visible par les visiteurs.`)
    : `Voici la clé API DEM de ${shop} (${live ? 'Production, vraies livraisons' : 'Test, aucune vraie course'}) :\n\n${value}\n\nDocumentation : ${SUPPORT.apiDocs}\nCette clé est secrète : ne la publiez pas dans le code de votre site visible par les visiteurs.`
  const mailto = `mailto:?subject=${encodeURIComponent(platform ? `Code de connexion DEM — ${shop}` : `Clé API DEM — ${shop}`)}&body=${encodeURIComponent(mailBody)}`
  const canClose = copied || sure
  const steps = woo
    ? ['Téléchargez le module DEM Livraison sur dem.sn/brancher.', 'WordPress › Extensions › Ajouter › Téléverser, puis Activer.', 'WooCommerce › Réglages › DEM Livraison : collez le code, enregistrez, puis cliquez sur « Brancher les webhooks ».']
    : platform ? ['Envoyez ce code à votre développeur.', 'Il suit la documentation sur dem.sn/developpeurs.', 'Vos commandes arrivent ensuite ici comme les autres livraisons.'] : null
  return (
    <Modal open onClose={() => canClose && onClose()} title={platform ? 'Votre code de connexion' : `Clé « ${data.key?.name ?? 'API'} » prête`} width={560}
      subtitle={platform ? 'Copiez-le maintenant : il ne sera plus jamais affiché.' : `Copiez-la maintenant : elle ne sera plus jamais affichée. ${data.note ?? ''}`}
      footer={<>
        <Button variant="ghost" icon={Mail} href={mailto}>Préparer un e-mail</Button>
        <Button onClick={onClose} disabled={!canClose}>{canClose ? 'Terminé' : 'Copiez d\'abord'}</Button>
      </>}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div className="api-secret">
          <code className="mono" aria-label="Clé secrète">{value}</code>
          <Button size="sm" variant={copied ? 'ghost' : 'primary'} icon={copied ? CheckCircle2 : Copy} onClick={copy}>{copied ? 'Copié' : 'Copier'}</Button>
        </div>
        <p className="api-warn"><AlertTriangle size={15} aria-hidden /> En cas de perte, créez-en un autre et révoquez l'ancien. Envoyez-le directement à votre développeur, jamais dans un groupe.</p>
        {steps && <ol className="api-steps">{steps.map(s => <li key={s}>{s}</li>)}</ol>}
        {!copied && (
          <label className="api-sure">
            <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} />
            J'ai enregistré {platform ? 'ce code' : 'cette clé'} ailleurs
          </label>
        )}
      </div>
    </Modal>
  )
}

function WebhooksCard({ webhooks }) {
  const endpoints = webhooks.endpoints ?? []
  const failedCount = (webhooks.messages ?? []).filter(m => m.status === 'FAILED').length
  return (
    <section>
      <div className="api-sec-head"><h2 className="api-h2">Webhooks de votre site</h2></div>
      <div className="card api-keys">
        <p className="muted" style={{ margin: 0, padding: '14px 18px 0', fontSize: 13 }}>Adresses prévenues à chaque étape d'une livraison, déclarées par votre site.{failedCount ? ` ${failedCount} envoi${failedCount > 1 ? 's' : ''} en échec récemment.` : ''}</p>
        {endpoints.map(e => (
          <div key={e.id ?? e.url} className="api-key">
            <span className="api-key-ico" aria-hidden><Webhook size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono dl-ellipsis" style={{ fontSize: 13 }}>{e.url}</div>
              <div className="api-key-top" style={{ marginTop: 4 }}>
                <Chip color={e.status === 'ACTIVE' ? 'var(--p-success)' : 'var(--p-warning)'} bg={e.status === 'ACTIVE' ? 'var(--p-success-bg)' : 'var(--p-warning-bg)'}>{e.status === 'ACTIVE' ? 'Active' : 'En pause'}</Chip>
                <Chip color="var(--p-slate)" bg="var(--p-slate-bg)">{e.livemode ? 'Production' : 'Test'}</Chip>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function statusTone(code) {
  if (code >= 500) return ['var(--p-danger)', 'var(--p-danger-bg)']
  if (code === 429) return ['var(--p-warning)', 'var(--p-warning-bg)']
  if (code >= 400) return ['var(--p-warning)', 'var(--p-warning-bg)']
  return ['var(--p-success)', 'var(--p-success-bg)']
}

function LogsList({ logs, onOpen }) {
  const [detail, setDetail] = useState(null)
  const open = onOpen ?? setDetail
  return (
    <>
      <ul className="api-loglist">
        {logs.map(l => {
          const code = Number(l.status_code) || 0
          const [c, bg] = statusTone(code)
          return (
            <li key={l.request_id ?? `${l.created_at}${l.route}`}>
              <button type="button" className="api-log row-hover" onClick={() => open(l)}>
                <span className="api-log-code num" style={{ color: c, background: bg }}>{code || '—'}</span>
                <span className="api-log-main">
                  <span className="mono api-log-route">{l.method} {(l.route ?? '').replace(/^\/v1/, '')}</span>
                  <span className="muted api-log-sub">{l.error_code ? (ERROR_HELP[l.error_code] ?? l.error_code) : `${dateTime(l.created_at)} · ${msOf(l.duration_ms)}`}</span>
                </span>
                <span className="api-log-env">{l.environment === 'LIVE' ? 'Production' : 'Test'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {!onOpen && <LogDetail log={detail} onClose={() => setDetail(null)} />}
    </>
  )
}

function LogDetail({ log, onClose }) {
  const notify = useNotify()
  if (!log) return null
  const code = Number(log.status_code) || 0
  const rid = log.request_id ?? ''
  const copy = async () => { try { await navigator.clipboard.writeText(rid); notify.success('Identifiant copié') } catch { /* rien */ } }
  return (
    <Modal open onClose={onClose} width={520}
      title={code < 400 ? 'Appel réussi' : code >= 500 ? 'Incident côté DEM' : code === 429 ? 'Limite atteinte' : 'Appel refusé'}
      subtitle={`${log.method} ${log.path ?? log.route ?? ''}`}
      footer={<Button variant="ghost" onClick={onClose}>Fermer</Button>}>
      <div style={{ display: 'grid', gap: 14 }}>
        {log.error_code && <p className="api-warn"><AlertTriangle size={15} aria-hidden /> {ERROR_HELP[log.error_code] ?? log.error_code}</p>}
        <dl className="pl-summary">
          <div><dt>Réponse</dt><dd className="num">{code}</dd></div>
          <div><dt>Heure</dt><dd>{dateTime(log.created_at)}</dd></div>
          <div><dt>Durée</dt><dd>{msOf(log.duration_ms)}</dd></div>
          <div><dt>Environnement</dt><dd>{log.environment === 'LIVE' ? 'Production' : 'Test'}</dd></div>
          <div><dt>Clé</dt><dd className="mono">{log.api_key_id ?? '—'}</dd></div>
          <div><dt>Adresse IP</dt><dd className="mono">{log.ip ?? '—'}</dd></div>
        </dl>
        {rid && (
          <div className="api-secret">
            <span style={{ minWidth: 0 }}><small className="muted" style={{ display: 'block', fontSize: 12 }}>Identifiant pour le support</small><code className="mono">{rid}</code></span>
            <IconButton icon={Copy} label="Copier l'identifiant" size="sm" onClick={copy} />
          </div>
        )}
      </div>
    </Modal>
  )
}

// Journal complet : filtres, pages de 50 (GET /dem-pro/me/api/logs)
function JournalDrawer({ open, onClose }) {
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [env, setEnv] = useState('')
  const [rows, setRows] = useState(null)
  const [next, setNext] = useState(null)
  const [failed, setFailed] = useState(false)
  const [more, setMore] = useState(false)
  const [detail, setDetail] = useState(null)
  const params = useCallback((before) => ({ limit: 50, ...(errorsOnly ? { status: 'errors' } : {}), ...(env ? { environment: env } : {}), ...(before ? { before } : {}) }), [errorsOnly, env])
  useEffect(() => {
    if (!open) return
    let alive = true
    setRows(null); setFailed(false)
    proApi.get('/dem-pro/me/api/logs', { params: params() })
      .then(r => { if (alive) { setRows(r.data?.logs ?? []); setNext(r.data?.next_before ?? null) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [open, params])
  const loadMore = async () => {
    if (!next || more) return
    setMore(true)
    try { const r = await proApi.get('/dem-pro/me/api/logs', { params: params(next) }); setRows(cur => [...(cur ?? []), ...(r.data?.logs ?? [])]); setNext(r.data?.next_before ?? null) }
    catch { /* bouton toujours là pour réessayer */ } finally { setMore(false) }
  }
  return (
    <Drawer open={open} onClose={onClose} width={620} label="Journal des appels">
      <div className="api-drawer-head">
        <div style={{ flex: 1 }}>
          <div style={{ font: '700 18px/1.3 var(--p-head)' }}>Journal des appels</div>
          <div className="muted" style={{ fontSize: 13 }}>Appels faits par votre site avec vos clés, gardés 30 jours.</div>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
      <div className="api-drawer-filters">
        <Segmented value={errorsOnly ? 'err' : 'all'} onChange={(v) => setErrorsOnly(v === 'err')} label="Appels" options={[['all', 'Tous les appels'], ['err', 'Erreurs']]} />
        <Segmented value={env || 'any'} onChange={(v) => setEnv(v === 'any' ? '' : v)} label="Environnement" options={[['any', 'Tout'], ['LIVE', 'Production'], ['TEST', 'Test']]} />
      </div>
      <div className="scroll-y" style={{ flex: 1 }}>
        {failed ? <ErrorState compact title="Impossible de charger le journal" onRetry={() => { setFailed(false); setRows(null); proApi.get('/dem-pro/me/api/logs', { params: params() }).then(r => { setRows(r.data?.logs ?? []); setNext(r.data?.next_before ?? null) }).catch(() => setFailed(true)) }} />
          : !rows ? <div style={{ padding: 20, display: 'grid', gap: 10 }}>{[0, 1, 2, 3].map(i => <Skeleton key={i} h={44} />)}</div>
          : rows.length === 0 ? <Empty icon={Webhook} title={errorsOnly ? 'Aucune erreur : tout fonctionne.' : 'Aucun appel pour l\'instant.'} />
          : (
            <>
              <LogsList logs={rows} onOpen={setDetail} />
              {next && <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}><Button size="sm" variant="ghost" loading={more} onClick={loadMore}>Charger la suite</Button></div>}
            </>
          )}
      </div>
      <LogDetail log={detail} onClose={() => setDetail(null)} />
    </Drawer>
  )
}

function HowItWorks() {
  const steps = [
    ['Vous créez une clé', 'Commencez par une clé de Test : votre développeur essaie sans créer de vraies courses ni déranger les coursiers.'],
    ['Votre développeur branche votre site', 'Il suit la documentation DEM : prix de la livraison, création, suivi, et mise à jour de vos commandes à chaque étape.'],
    ['Vous passez en Production', 'Créez une clé de Production : chaque commande de votre site devient une vraie livraison DEM, visible ici comme les autres.'],
  ]
  return (
    <section className="card api-how">
      <h2 className="api-h2">Comment ça marche</h2>
      <ol>
        {steps.map(([t, d]) => <li key={t}><strong>{t}</strong><span className="muted">{d}</span></li>)}
      </ol>
    </section>
  )
}
