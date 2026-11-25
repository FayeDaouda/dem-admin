import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MapPin, Plus, Star, Trash2, Monitor, LogOut, Smartphone, Tablet, CheckCircle2, ArrowRight, Camera, Pencil,
  Phone, MessageCircle, Mail, Globe, FileText, ShieldCheck, KeyRound, Users, Plug, Gift, AlertTriangle, Store,
  Lock, Sparkles, Upload, Eye,
} from 'lucide-react'
import proApi, { errMsg, endSession } from '../lib/proApi'
import { useProAuth, ROLE_LABEL } from '../proAuthContext'
import { Avatar } from '../ProLayout'
import { dateTime, phoneFmt, planName, timeAgo } from '../lib/format'
import { Button, Chip, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton, Spinner, Toggle } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import PlanPurchaseModal from '../ui/PlanPurchaseModal'
import { PlaceSearch } from './NewDelivery'
import { SUPPORT, whatsappUrl } from '../support'
import '../styles/account.css'

// Compte (modèle « réglages ») : profil, offre, paiement, adresses de
// retrait, sécurité, aide — les mêmes réglages que dans l'application
// (dem_pro_home_screen.dart:_CompteTab). Un membre de l'équipe ne voit que
// ce que le serveur lui ouvre (auth.middleware.js : ownerOnly).

// Secteur et volume : mêmes valeurs que l'app (_sectorLabels, _volumeLabels)
const SECTORS = { commerce: 'Commerce', restauration: 'Restauration', services: 'Services', artisanat: 'Artisanat', autre: 'Autre' }
const VOLUMES = { low: '1 à 4 livraisons par semaine', medium: '5 à 8 livraisons par semaine', high: '9 ou plus par semaine' }
const MAX_IMAGE = 5 * 1024 * 1024 // upload.middleware.js : 5 Mo, images seulement

const longDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })
const localDigits = (raw) => {
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00221')) d = d.slice(5)
  else if (d.startsWith('221') && d.length > 9) d = d.slice(3)
  return d.slice(0, 9)
}
const prettyPhone = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
const isMobile = (d) => /^7[015678]\d{7}$/.test(d)
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)

// Règles du code secret — les mêmes que le serveur (pin.policy.js) et l'app
// (pin_rules.dart), pour prévenir avant l'envoi
function pinWeakness(pin, phone) {
  if (!/^\d{6}$/.test(pin)) return 'Le code secret doit contenir exactement 6 chiffres.'
  const d = pin.split('').map(Number)
  if (new Set(d).size === 1) return 'Code trop facile à deviner (un seul chiffre répété).'
  const steps = d.slice(1).map((x, i) => (x - d[i] + 10) % 10)
  if (steps.every(s => s === 1) || steps.every(s => s === 9)) return 'Code trop facile à deviner (une suite de chiffres).'
  if (pin.slice(0, 2).repeat(3) === pin || pin.slice(0, 3).repeat(2) === pin) return 'Code trop facile à deviner (un motif répété).'
  if (pin[0] === pin[1] && pin[2] === pin[3] && pin[4] === pin[5]) return 'Code trop facile à deviner (des paires de chiffres).'
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length >= 6 && digits.endsWith(pin)) return 'Code trop facile à deviner (la fin de votre numéro de téléphone).'
  return null
}

// Téléphones (comptés dans l'offre) et navigateurs de l'espace web (non
// comptés, décision du 25/11) — un serveur plus ancien ne distingue pas
function devicesSummary({ sessions = [], max }) {
  const phones = sessions.filter(x => x.platform !== 'web').length
  const web = sessions.length - phones
  const limit = max == null ? 'sans limite' : `${phones} sur ${max} autorisé${max > 1 ? 's' : ''} par votre offre`
  return `Téléphones : ${limit}.${web ? ` Espace web : ${web} navigateur${web > 1 ? 's' : ''}, non compté${web > 1 ? 's' : ''}.` : ' L\'espace web ne compte pas dans cette limite.'}`
}

function deviceIcon(s) {
  const p = (s.platform ?? s.deviceLabel ?? '').toLowerCase()
  if (/web|chrome|safari|firefox|edge|mac|windows|linux|ordinateur/.test(p)) return Monitor
  if (/ipad|tablet|tablette/.test(p)) return Tablet
  return Smartphone
}

function Section({ title, description, children, action, id }) {
  return (
    <section className="ac-sec" id={id}>
      <div className="ac-sec-head">
        <h2 className="ac-sec-title">{title}</h2>
        {description && <p className="muted ac-sec-desc">{description}</p>}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
      <div className="ac-sec-body">{children}</div>
    </section>
  )
}

// Ligne de réglage : libellé, valeur, action à droite
function Row({ icon, label, value, placeholder, action, href, external }) {
  const Icon = icon
  const body = (
    <>
      {Icon && <Icon size={16} aria-hidden className="ac-ico" />}
      <div className="ac-row-text">
        <div className="ac-row-label">{label}</div>
        <div className={`ac-row-value ${placeholder ? 'is-placeholder' : ''}`}>{value}</div>
      </div>
      {action}
    </>
  )
  if (href) return <li><a className="ac-row-link" href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{body}<ArrowRight size={15} aria-hidden className="ac-row-arrow" /></a></li>
  return <li>{body}</li>
}

const OWNER_TABS = [['profil', 'Profil'], ['offre', 'Offre et paiement'], ['adresses', 'Adresses'], ['securite', 'Sécurité'], ['aide', 'Aide']]
const MEMBER_TABS = [['profil', 'Mon accès'], ['adresses', 'Adresses'], ['aide', 'Aide']]

export default function Account() {
  const auth = useProAuth()
  const { user, isOwner } = auth
  const notify = useNotify()
  const [params, setParams] = useSearchParams()
  const tabs = isOwner ? OWNER_TABS : MEMBER_TABS
  const tab = tabs.some(([k]) => k === params.get('onglet')) ? params.get('onglet') : 'profil'
  const setTab = (k) => setParams(k === 'profil' ? {} : { onglet: k }, { replace: true })

  const [plan, setPlan] = useState(null)
  const [addresses, setAddresses] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [failed, setFailed] = useState({})
  const [confirm, setConfirm] = useState(null) // { title, text, cta, run, variant }
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = useCallback(async () => {
    const calls = [proApi.get('/dem-pro/addresses')]
    if (isOwner) calls.push(proApi.get('/dem-pro/me/plan'), proApi.get('/dem-pro/me/sessions'))
    const [a, p, s] = await Promise.allSettled(calls)
    if (a.status === 'fulfilled') setAddresses(a.value.data ?? [])
    if (p?.status === 'fulfilled') setPlan(p.value.data)
    if (s?.status === 'fulfilled') setSessions(s.value.data)
    setFailed({ addresses: a.status === 'rejected', plan: p?.status === 'rejected', sessions: s?.status === 'rejected' })
  }, [isOwner])
  useEffect(() => { load() }, [load])

  const askConfirm = (c) => setConfirm(c)
  const runConfirm = async () => {
    setConfirmBusy(true)
    try { await confirm.run(); setConfirm(null) } catch { /* message déjà affiché */ } finally { setConfirmBusy(false) }
  }

  return (
    <div className="ac-page ac-page-wide">
      <PageHeader eyebrow="Compte" title={<>Votre compte<span className="dot">.</span></>}
        description={isOwner ? 'Les réglages de votre compte DEM Pro, partagés avec l\'application.' : `Vous travaillez sur ${user?.proBusinessName ?? 'la boutique'} comme membre de l'équipe.`} />

      {isOwner && <Shortcuts />}

      <div className="sp-tabs ac-tabs" role="tablist" aria-label="Réglages du compte">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" role="tab" className="dl-tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="card ac-card" role="tabpanel">
        {tab === 'profil' && (isOwner ? <OwnerProfile /> : <MemberProfile />)}
        {tab === 'offre' && isOwner && <OfferTab plan={plan} failed={failed.plan} reload={load} notify={notify} />}
        {tab === 'adresses' && <AddressesTab addresses={addresses} failed={failed.addresses} reload={load} onConfirm={askConfirm} />}
        {tab === 'securite' && isOwner && <SecurityTab sessions={sessions} setSessions={setSessions} failed={failed.sessions} reload={load} onConfirm={askConfirm} />}
        {tab === 'aide' && <HelpTab />}
      </div>

      <Modal open={!!confirm} onClose={() => !confirmBusy && setConfirm(null)} title={confirm?.title} subtitle={confirm?.text} width={460}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>Annuler</Button><Button variant={confirm?.variant ?? 'danger'} loading={confirmBusy} onClick={runConfirm}>{confirm?.cta}</Button></>} />
    </div>
  )
}

// ── Raccourcis du responsable : équipe, API, parrainage ─────────────────────
function Shortcuts() {
  const items = [
    ['/compte/equipe', Users, 'Équipe', 'Vos employés, chacun avec son numéro'],
    ['/compte/api', Plug, 'API DEM', 'Branchez votre site à DEM'],
    ['/compte/parrainage', Gift, 'Parrainage', 'Recommandez DEM Pro'],
  ]
  return (
    <nav className="ac-shortcuts" aria-label="Outils du compte">
      {items.map(([to, icon, title, text]) => {
        const Icon = icon
        return (
        <Link key={to} to={to} className="card ac-shortcut">
          <span className="ac-shortcut-ico" aria-hidden><Icon size={18} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="ac-shortcut-title">{title}</span>
            <span className="muted ac-shortcut-text">{text}</span>
          </span>
          <ArrowRight size={16} aria-hidden className="ac-shortcut-arrow" />
        </Link>
        )
      })}
    </nav>
  )
}

// ── Profil (responsable) ─────────────────────────────────────────────────────
function OwnerProfile() {
  const { user, refreshMe } = useProAuth()
  const notify = useNotify()
  const [editing, setEditing] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(null) // 'avatar' | 'rccmDocument'
  const avatarInput = useRef(null)
  const rccmInput = useRef(null)

  const upload = async (field, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify.error('Fichier refusé', 'Choisissez une image (JPG, PNG).'); return }
    if (file.size > MAX_IMAGE) { notify.error('Image trop lourde', '5 Mo au maximum.'); return }
    setUploading(field)
    try {
      const form = new FormData()
      form.append('field', field)
      form.append('file', file)
      await proApi.post('/users/driver/documents', form, { timeout: 60000 })
      await refreshMe()
      notify.success(field === 'avatar' ? 'Photo mise à jour' : 'Document RCCM déposé', field === 'avatar' ? 'Visible sur votre boutique et dans l\'application.' : 'L\'équipe DEM peut le consulter.')
    } catch (e) { notify.error(field === 'avatar' ? 'La photo n\'a pas été changée' : 'Le document n\'a pas été déposé', errMsg(e)) } finally { setUploading(null) }
  }

  const pendingPhone = user?.phoneChangeStatus === 'PENDING' ? user?.pendingPhone : null

  return (
    <>
      <Section title="Profil" description="Ces informations apparaissent sur votre boutique, vos livraisons et vos factures.">
        <div className="ac-profile">
          <button type="button" className="ac-avatar-btn" onClick={() => avatarInput.current?.click()} disabled={!!uploading}
            aria-label="Changer la photo de la boutique">
            <Avatar user={user} size={64} />
            <span className="ac-avatar-badge" aria-hidden>{uploading === 'avatar' ? <Spinner size={13} /> : <Camera size={13} />}</span>
          </button>
          <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => { upload('avatar', e.target.files?.[0]); e.target.value = '' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ac-strong">{user?.proBusinessName ?? user?.name}</div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{user?.name} · <span className="num">{phoneFmt(user?.phone)}</span></div>
            {user?.isVerified === true && <div style={{ marginTop: 8 }}><Chip color="var(--p-success)" bg="var(--p-success-bg)"><CheckCircle2 size={12} aria-hidden /> Compte vérifié</Chip></div>}
          </div>
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(true)}>Modifier</Button>
        </div>
      </Section>

      <Section title="Informations" description="Utilisées par l'équipe DEM et sur vos factures (NINEA, RCCM).">
        <ul className="ac-list ac-rows">
          <Row icon={Store} label="Nom de la boutique" value={user?.proBusinessName || 'Ajouter'} placeholder={!user?.proBusinessName}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>} />
          <Row icon={Users} label="Responsable" value={user?.name || 'Ajouter'} placeholder={!user?.name}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>} />
          <Row icon={Phone} label="Téléphone"
            value={pendingPhone ? <>{phoneFmt(user?.phone)} <span className="ac-pending">· changement vers {phoneFmt(pendingPhone)} en attente de validation</span></> : <span className="num">{phoneFmt(user?.phone)}</span>}
            action={<Button size="sm" variant="quiet" onClick={() => setPhoneOpen(true)}>Changer</Button>} />
          <Row icon={Mail} label="E-mail" value={user?.email || 'Ajouter un e-mail'} placeholder={!user?.email}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>{user?.email ? 'Modifier' : 'Ajouter'}</Button>} />
          <Row icon={Sparkles} label="Secteur" value={SECTORS[user?.proSector] ?? 'Non renseigné'} placeholder={!SECTORS[user?.proSector]}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>} />
          <Row icon={Store} label="Volume de livraisons" value={VOLUMES[user?.proWeeklyVolume] ?? 'Non renseigné'} placeholder={!VOLUMES[user?.proWeeklyVolume]}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>Modifier</Button>} />
          <Row icon={FileText} label="NINEA" value={user?.proNinea || 'Ajouter (pour vos factures)'} placeholder={!user?.proNinea}
            action={<Button size="sm" variant="quiet" onClick={() => setEditing(true)}>{user?.proNinea ? 'Modifier' : 'Ajouter'}</Button>} />
          <Row icon={FileText} label="Document RCCM" value={user?.rccmDocument ? 'Document déposé' : 'Facultatif : il accélère la vérification de votre boutique'} placeholder={!user?.rccmDocument}
            action={
              <span style={{ display: 'flex', gap: 4 }}>
                {user?.rccmDocument && <IconButton icon={Eye} label="Voir le document RCCM" size="sm" variant="plain" onClick={() => window.open(user.rccmDocument, '_blank', 'noopener')} />}
                <Button size="sm" variant="quiet" icon={uploading === 'rccmDocument' ? undefined : Upload} loading={uploading === 'rccmDocument'} onClick={() => rccmInput.current?.click()}>
                  {user?.rccmDocument ? 'Remplacer' : 'Déposer'}
                </Button>
              </span>
            } />
        </ul>
        <input ref={rccmInput} type="file" accept="image/*" hidden onChange={(e) => { upload('rccmDocument', e.target.files?.[0]); e.target.value = '' }} />
        <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0' }}>RCCM : une photo nette du registre du commerce (image, 5 Mo au maximum).</p>
      </Section>

      <Section title="Supprimer le compte" description="Ferme votre boutique DEM Pro et efface vos informations personnelles. Définitif.">
        <div className="ac-danger">
          <AlertTriangle size={18} aria-hidden />
          <p style={{ margin: 0, flex: 1, fontSize: 13.5 }}>Avant la suppression, DEM vérifie qu'aucune livraison, aucun retrait ni aucun solde ne reste en cours.</p>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>Supprimer mon compte</Button>
        </div>
      </Section>

      <EditProfileModal open={editing} onClose={() => setEditing(false)} />
      <PhoneChangeModal open={phoneOpen} onClose={() => setPhoneOpen(false)} />
      {deleting && <DeleteAccountModal onClose={() => setDeleting(false)} />}
    </>
  )
}

// ── Profil (membre de l'équipe) ─────────────────────────────────────────────
function MemberProfile() {
  const { user, member, memberRole, logout } = useProAuth()
  const manager = memberRole === 'MANAGER'
  const can = manager
    ? ['Créer et suivre les livraisons et tournées', 'Confirmer les commandes reçues', 'Gérer le catalogue et les adresses', 'Dashboard : ventes, livraisons, activité', 'Clients et solde du wallet (consultation)']
    : ['Créer et suivre les livraisons et tournées', 'Confirmer les commandes reçues', 'Gérer le catalogue et les adresses']
  return (
    <>
      <Section title="Votre accès" description="Vous êtes connecté avec votre propre numéro au compte de la boutique.">
        <div className="ac-profile">
          <Avatar user={user} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ac-strong">{user?.proBusinessName ?? 'Boutique DEM Pro'}</div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>
              {member?.name ?? 'Membre de l\'équipe'}{member?.phone ? <> · <span className="num">{phoneFmt(member.phone)}</span></> : null}
            </div>
          </div>
          <Chip color={manager ? 'var(--p-dark)' : 'var(--p-slate)'} bg={manager ? '#EEF4FF' : 'var(--p-slate-bg)'}>{ROLE_LABEL[memberRole] ?? 'Membre'}</Chip>
        </div>
      </Section>
      <Section title="Ce que vous pouvez faire" description={`Rôle ${ROLE_LABEL[memberRole]?.toLowerCase() ?? 'membre'}, choisi par le responsable de la boutique.`}>
        <ul className="ac-can">
          {can.map(c => <li key={c}><CheckCircle2 size={15} aria-hidden /> {c}</li>)}
          <li className="is-no"><Lock size={15} aria-hidden /> Retraits, offres, paiement intégré, équipe et profil de la boutique : réservés au responsable</li>
        </ul>
      </Section>
      <Section title="Session" description="Sur un ordinateur partagé, déconnectez-vous à la fin de votre service.">
        <div><Button variant="ghost" icon={LogOut} onClick={logout}>Se déconnecter</Button></div>
      </Section>
    </>
  )
}

// ── Offre et paiement ───────────────────────────────────────────────────────
function OfferTab({ plan, failed, reload, notify }) {
  const [offers, setOffers] = useState(false)
  const [savingPay, setSavingPay] = useState(false)
  const start = plan?.startedAt ?? plan?.activatedAt ?? null
  const end = plan?.expiresAt ?? null
  const active = plan && plan.status !== 'EXPIRED' && plan.plan !== 'FREE'
  const daysLeft = end && active ? Math.max(0, Math.ceil((new Date(end) - Date.now()) / 86400000)) : null
  const progress = start && end ? Math.min(100, Math.max(0, ((Date.now() - new Date(start)) / (new Date(end) - new Date(start))) * 100)) : null
  const togglePay = async (next) => {
    setSavingPay(true)
    try { await proApi.patch('/dem-pro/me/payment-settings', { inAppPaymentEnabled: next }); notify.success(next ? 'Paiement en ligne activé' : 'Paiement en ligne désactivé'); reload() }
    catch (e) { notify.error('Le paiement en ligne n\'a pas changé', errMsg(e)) } finally { setSavingPay(false) }
  }
  return (
    <>
      <Section title="Offre" description="Votre abonnement DEM Pro, payé à la semaine par Wave ou Orange Money.">
        {failed && !plan ? <ErrorState compact title="Impossible de charger votre offre" onRetry={reload} />
          : !plan ? <Skeleton h={64} />
          : (
            <div className="ac-plan">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span className="ac-strong">{plan.planLabel ?? planName(plan.plan)}</span>
                <span className="muted" style={{ fontSize: 13.5 }}>
                  {plan.status === 'EXPIRED' ? 'terminée' : plan.isTrial ? 'période d\'essai' : plan.plan === 'FREE' ? 'sans abonnement' : 'active'}{end && active ? ` · jusqu'au ${longDate(end)}` : ''}
                </span>
              </div>
              {progress != null && active && <div className="ac-bar" role="progressbar" aria-label="Durée de l'offre écoulée" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>}
              {daysLeft != null && <div className="muted" style={{ fontSize: 13, marginTop: 8, color: daysLeft <= 2 ? 'var(--p-danger)' : undefined }}>{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</div>}
              {plan.planRequired && <p className="ac-alert" role="status"><AlertTriangle size={15} aria-hidden /> Sans offre, la création de livraisons est en pause. Choisissez une offre pour reprendre.</p>}
              {plan.trialAvailable && (
                <p className="ac-trial"><Gift size={15} aria-hidden /> Essai gratuit de {plan.trialDays} jours disponible pour votre boutique.</p>
              )}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <Button arrow="right" onClick={() => setOffers(true)}>
                  {plan.trialAvailable ? 'Essai gratuit et offres' : active ? 'Changer d\'offre' : 'Choisir une offre'}
                </Button>
              </div>
            </div>
          )}
      </Section>

      <Section title="Paiement" description="Comment vos clients règlent leurs articles.">
        {plan && (
          <div className="sp-switch-row">
            <Toggle checked={!!plan.inAppPaymentEnabled} onChange={togglePay} busy={savingPay} label="Paiement en ligne (intégré)" />
            <div style={{ flex: 1 }}>
              <div className="sp-switch-label">Paiement en ligne (intégré)</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>Vos clients paient leurs articles par Wave ou Orange Money. L'argent arrive dans votre wallet.</div>
            </div>
          </div>
        )}
        {!plan && !failed && <Skeleton h={44} />}
        <Link className="link-caps" to="/boutique?onglet=apparence" style={{ marginTop: 16 }}>
          Modes de paiement du lien de commande · Boutique › Apparence et paiement <ArrowRight size={14} aria-hidden />
        </Link>
      </Section>

      <PlanPurchaseModal open={offers} onClose={() => setOffers(false)} onChanged={reload} />
    </>
  )
}

// ── Adresses de retrait ─────────────────────────────────────────────────────
function AddressesTab({ addresses, failed, reload, onConfirm }) {
  const notify = useNotify()
  const [adding, setAdding] = useState(false)
  const setDefault = async (a) => {
    try { await proApi.patch(`/dem-pro/addresses/${a.id}/default`); notify.success('Adresse par défaut changée', `${a.label} sert maintenant au prix de votre lien de commande.`); reload() }
    catch (e) { notify.error('L\'adresse par défaut n\'a pas changé', errMsg(e)) }
  }
  const askRemove = (a) => onConfirm({
    title: `Supprimer « ${a.label} » ?`, text: 'Cette adresse de retrait disparaît aussi de l\'application.', cta: 'Supprimer l\'adresse',
    run: async () => {
      try { await proApi.delete(`/dem-pro/addresses/${a.id}`); notify.success('Adresse supprimée'); reload() }
      catch (e) { notify.error('L\'adresse n\'a pas été supprimée', errMsg(e)); throw e }
    },
  })
  return (
    <>
      <Section title="Adresses de retrait" description="Là où les coursiers viennent chercher vos colis. L'adresse par défaut sert au prix de livraison de votre lien de commande."
        action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>Ajouter une adresse</Button>}>
        {failed && !addresses ? <ErrorState compact title="Impossible de charger vos adresses" onRetry={reload} />
          : !addresses ? <Skeleton h={56} />
          : addresses.length === 0 ? <Empty icon={MapPin} title="Aucune adresse" text="Ajoutez l'adresse de votre boutique pour lancer vos livraisons." />
          : (
            <ul className="ac-list">
              {addresses.map(a => (
                <li key={a.id}>
                  <MapPin size={16} aria-hidden className="ac-ico" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{a.label}</div>
                    <div className="muted dl-ellipsis" style={{ fontSize: 13 }}>{a.address}{a.landmark ? ` · ${a.landmark}` : ''}</div>
                    {a.isDefault && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--p-link)', fontWeight: 600 }}>Par défaut · utilisée pour le prix du lien de commande</div>}
                  </div>
                  {!a.isDefault && <Button size="sm" variant="quiet" icon={Star} onClick={() => setDefault(a)}>Par défaut</Button>}
                  {!a.isDefault && <IconButton icon={Trash2} label={`Supprimer ${a.label}`} size="sm" variant="plain" onClick={() => askRemove(a)} />}
                </li>
              ))}
            </ul>
          )}
      </Section>
      <AddAddressModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} hasDefault={(addresses ?? []).some(a => a.isDefault)} />
    </>
  )
}

// ── Sécurité : code secret, numéro, appareils ───────────────────────────────
function SecurityTab({ sessions, setSessions, failed, reload, onConfirm }) {
  const auth = useProAuth()
  const { user } = auth
  const notify = useNotify()
  const [pinOpen, setPinOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const pinSession = auth.hasPinSession()

  const revokeOne = async (s) => {
    await proApi.delete(`/dem-pro/me/sessions/${s.id}`)
    setSessions(cur => cur && { ...cur, sessions: (cur.sessions ?? []).filter(x => x.id !== s.id) })
  }
  const askRevoke = (s) => onConfirm({
    title: `Déconnecter « ${s.deviceLabel ?? 'Appareil inconnu'} » ?`,
    text: s.memberName ? `${s.memberName} devra se reconnecter sur cet appareil. Pour lui retirer l'accès, retirez-le de l'équipe.` : 'Il faudra se reconnecter avec le numéro et le code secret sur cet appareil.',
    cta: 'Déconnecter',
    run: async () => {
      try { await revokeOne(s); notify.success('Appareil déconnecté', s.deviceLabel ?? undefined) }
      catch (e) { notify.error('L\'appareil n\'a pas été déconnecté', errMsg(e)); throw e }
    },
  })
  // Mes autres appareils seulement : les téléphones de l'équipe restent
  // connectés (ils se gèrent dans Équipe)
  const mine = (sessions?.sessions ?? []).filter(s => !s.current && !s.memberName)
  const askRevokeOthers = () => onConfirm({
    title: `Déconnecter ${mine.length} autre${mine.length > 1 ? 's' : ''} appareil${mine.length > 1 ? 's' : ''} ?`,
    text: 'Seul cet appareil restera connecté à votre compte. Vos autres appareils devront retaper votre numéro et votre code secret. Les téléphones de votre équipe ne sont pas touchés.',
    cta: 'Déconnecter mes autres appareils',
    run: async () => {
      // Connexion par code secret : sessions closes côté serveur (jetons de
      // renouvellement compris), puis les téléphones restants un par un
      if (pinSession) { try { await proApi.post('/auth/sessions/revoke-others') } catch { /* repli ci-dessous */ } }
      let rest = mine
      try { rest = ((await proApi.get('/dem-pro/me/sessions')).data?.sessions ?? []).filter(s => !s.current && !s.memberName) } catch { /* liste d'avant */ }
      const r = await Promise.allSettled(rest.map(s => proApi.delete(`/dem-pro/me/sessions/${s.id}`)))
      const ko = r.filter(x => x.status === 'rejected' && x.reason?.response?.status !== 404).length
      if (ko) notify.error(`${ko} appareil${ko > 1 ? 's' : ''} n'${ko > 1 ? 'ont' : 'a'} pas été déconnecté${ko > 1 ? 's' : ''}`, 'Réessayez dans un instant.')
      else notify.success('Autres appareils déconnectés')
      reload()
    },
  })
  const sorted = [...(sessions?.sessions ?? [])].sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0))

  return (
    <>
      <Section title="Code secret" description="Le code à 6 chiffres qui ouvre votre compte, dans l'application comme ici.">
        {user?.hasPin === false ? (
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>Vous n'avez pas encore de code secret. Créez-le depuis l'application DEM (Compte › Sécurité du compte), ou à votre prochaine connexion ici.</p>
        ) : (
          <div className="ac-inline">
            <KeyRound size={16} aria-hidden className="ac-ico" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>Changer mon code secret</div>
              <div className="muted" style={{ fontSize: 13 }}>{pinSession ? 'Vos autres appareils seront déconnectés.' : 'Pour le changer ici, reconnectez-vous avec votre code secret (et non par SMS).'}</div>
            </div>
            <Button size="sm" variant="ghost" disabled={!pinSession} onClick={() => setPinOpen(true)}>Changer</Button>
          </div>
        )}
      </Section>

      <Section title="Numéro de téléphone" description={pinSession ? 'Votre code secret, puis un code SMS envoyé au nouveau numéro.' : 'La demande est validée par l\'équipe DEM.'}>
        <div className="ac-inline">
          <Phone size={16} aria-hidden className="ac-ico" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }} className="num">{phoneFmt(user?.phone)}</div>
            {user?.phoneChangeStatus === 'PENDING' && user?.pendingPhone && <div className="ac-pending" style={{ fontSize: 13 }}>Changement vers {phoneFmt(user.pendingPhone)} en attente de validation</div>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setPhoneOpen(true)}>Changer de numéro</Button>
        </div>
      </Section>

      <Section title="Appareils connectés"
        description={sessions ? devicesSummary(sessions) : 'Les appareils où votre compte est ouvert.'}
        action={mine.length > 0 && <Button size="sm" variant="ghost" icon={LogOut} onClick={askRevokeOthers}>Déconnecter mes autres appareils</Button>}>
        {failed && !sessions ? <ErrorState compact title="Impossible de charger vos appareils" onRetry={reload} />
          : !sessions ? <Skeleton h={56} />
          : (
            <ul className="ac-list">
              {sorted.map(s => {
                const Icon = deviceIcon(s)
                return (
                  <li key={s.id}>
                    <Icon size={16} aria-hidden className="ac-ico" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {s.deviceLabel ?? 'Appareil inconnu'}
                        {s.current && <Chip color="var(--p-success)" bg="var(--p-success-bg)">Cet appareil</Chip>}
                        {s.memberName && <Chip color="var(--p-dark)" bg="#EEF4FF">Équipe · {s.memberName}</Chip>}
                        {s.platform === 'web' && !s.current && <Chip color="var(--p-slate)" bg="var(--p-slate-bg)">Espace web</Chip>}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>Connecté le {dateTime(s.createdAt)} · actif {timeAgo(s.lastSeenAt)}</div>
                    </div>
                    {!s.current && <Button size="sm" variant="quiet" icon={LogOut} onClick={() => askRevoke(s)}>Déconnecter</Button>}
                  </li>
                )
              })}
            </ul>
          )}
      </Section>

      <Section title="Bon à savoir">
        <p className="ac-tip"><ShieldCheck size={16} aria-hidden /> DEM ne vous demandera jamais votre code secret ni un code reçu par SMS, ni par téléphone, ni par WhatsApp. Ne les donnez à personne, même à un membre de votre équipe.</p>
      </Section>

      <ChangePinModal open={pinOpen} onClose={() => setPinOpen(false)} onDone={reload} />
      <PhoneChangeModal open={phoneOpen} onClose={() => setPhoneOpen(false)} />
    </>
  )
}

// ── Aide ─────────────────────────────────────────────────────────────────────
function HelpTab() {
  return (
    <>
      <Section title="Support DEM" description="Une question, un souci sur une livraison ? L'équipe DEM vous répond.">
        <ul className="ac-list ac-rows">
          <Row icon={Phone} label="Appeler le support" value={SUPPORT.phoneDisplay} href={`tel:${SUPPORT.phone}`} />
          <Row icon={MessageCircle} label="WhatsApp" value={SUPPORT.whatsappDisplay} href={whatsappUrl()} external />
          <Row icon={Mail} label="Envoyer un e-mail" value={SUPPORT.email} href={`mailto:${SUPPORT.email}`} />
          <Row icon={Globe} label="Site officiel" value={SUPPORT.websiteDisplay} href={SUPPORT.website} external />
        </ul>
      </Section>
      <Section title="Informations légales">
        <ul className="ac-list ac-rows">
          <Row icon={FileText} label="Conditions d'utilisation" value="dem.sn/terms" href={SUPPORT.terms} external />
          <Row icon={ShieldCheck} label="Confidentialité" value="dem.sn/privacy" href={SUPPORT.privacy} external />
        </ul>
      </Section>
    </>
  )
}

// ── Modifier le profil (PATCH /users/me/profile) ────────────────────────────
function EditProfileModal({ open, onClose }) {
  const { user, refreshMe } = useProAuth()
  const notify = useNotify()
  const [f, setF] = useState({})
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setF({ proBusinessName: user?.proBusinessName ?? '', name: user?.name ?? '', email: user?.email ?? '', proSector: user?.proSector ?? '', proWeeklyVolume: user?.proWeeklyVolume ?? '', proNinea: user?.proNinea ?? '' })
      setTouched(false)
    }
  }, [open, user])
  const set = (k) => (e) => setF(cur => ({ ...cur, [k]: e.target.value }))

  // Seuls les champs changés partent (le serveur ignore un nom ou un e-mail vide)
  const changes = {}
  for (const k of ['proBusinessName', 'name', 'email', 'proSector', 'proWeeklyVolume', 'proNinea']) {
    const before = (user?.[k] ?? '').trim?.() ?? ''
    const now = (f[k] ?? '').trim()
    if (now !== before) changes[k] = k === 'proNinea' ? (now || null) : now
  }
  const errors = {
    proBusinessName: f.proBusinessName?.trim().length < 2 ? 'Indiquez le nom de la boutique.' : null,
    name: f.name?.trim().length < 2 ? 'Indiquez le nom du responsable.' : null,
    email: f.email?.trim() && !isEmail(f.email.trim()) ? 'Adresse e-mail invalide.' : (user?.email && !f.email?.trim() ? 'L\'e-mail ne peut pas être effacé, seulement remplacé.' : null),
    proNinea: f.proNinea?.trim() && !/^[0-9A-Za-z ]{5,20}$/.test(f.proNinea.trim()) ? 'NINEA invalide : chiffres et lettres, 5 à 20 caractères.' : null,
  }
  const invalid = Object.values(errors).some(Boolean)
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    setTouched(true)
    if (invalid || !dirty || busy) return
    setBusy(true)
    try {
      await proApi.patch('/users/me/profile', changes)
      await refreshMe().catch(() => {})
      notify.success('Profil enregistré', 'À jour aussi dans l\'application.')
      onClose()
    } catch (e) { notify.error('Le profil n\'a pas été enregistré', errMsg(e)) } finally { setBusy(false) }
  }
  const err = (k) => touched && errors[k] ? <small className="ac-field-error">{errors[k]}</small> : null
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Modifier le profil" width={560}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} disabled={!dirty} onClick={save}>Enregistrer</Button></>}>
      <div className="ac-form">
        <label className="field"><span>Nom de la boutique</span><input className="input" maxLength={80} value={f.proBusinessName ?? ''} onChange={set('proBusinessName')} aria-invalid={!!(touched && errors.proBusinessName)} />{err('proBusinessName')}</label>
        <label className="field"><span>Responsable</span><input className="input" maxLength={80} value={f.name ?? ''} onChange={set('name')} autoComplete="name" aria-invalid={!!(touched && errors.name)} />{err('name')}</label>
        <label className="field ac-form-full"><span>E-mail</span><input className="input" type="email" maxLength={120} value={f.email ?? ''} onChange={set('email')} autoComplete="email" placeholder="vous@exemple.sn" aria-invalid={!!(touched && errors.email)} />{err('email')}</label>
        <label className="field"><span>Secteur</span>
          <select className="input" value={f.proSector ?? ''} onChange={set('proSector')}>
            {!f.proSector && <option value="">Choisir…</option>}
            {Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field"><span>Volume de livraisons</span>
          <select className="input" value={f.proWeeklyVolume ?? ''} onChange={set('proWeeklyVolume')}>
            {!f.proWeeklyVolume && <option value="">Choisir…</option>}
            {Object.entries(VOLUMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="field ac-form-full"><span>NINEA <em className="muted">(facultatif, pour vos factures)</em></span><input className="input mono" maxLength={20} value={f.proNinea ?? ''} onChange={set('proNinea')} placeholder="Ex. 012345678" aria-invalid={!!(touched && errors.proNinea)} />{err('proNinea')}</label>
      </div>
    </Modal>
  )
}

// Champ de code à 6 chiffres (masqué)
function PinField({ label, value, onChange, autoFocus, invalid, otp }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input mono ac-pin" type={otp ? 'text' : 'password'} inputMode="numeric" autoComplete={otp ? 'one-time-code' : 'off'} maxLength={6}
        autoFocus={autoFocus} value={value} aria-invalid={invalid || undefined} placeholder="••••••"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} />
    </label>
  )
}

// ── Changer le code secret (POST /auth/pin/change) ──────────────────────────
function ChangePinModal({ open, onClose, onDone }) {
  const auth = useProAuth()
  const notify = useNotify()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setCur(''); setNext(''); setAgain(''); setError('') } }, [open])
  const weak = next.length === 6 ? pinWeakness(next, auth.user?.phone) : null
  const mismatch = again.length === 6 && again !== next
  const ok = cur.length === 6 && next.length === 6 && !weak && again === next && next !== cur
  const save = async () => {
    if (!ok || busy) return
    setBusy(true); setError('')
    try {
      const r = await proApi.post('/auth/pin/change', { currentPin: cur, newPin: next })
      auth.saveAccessToken(r.data?.accessToken)
      notify.success('Code secret modifié', 'Vos autres appareils ont été déconnectés.')
      onClose(); onDone?.()
    } catch (e) { setError(errMsg(e, 'Impossible de changer le code secret.')); setCur('') } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Changer mon code secret" subtitle="6 chiffres, à garder pour vous. Il sert aussi dans l'application." width={460}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} disabled={!ok} onClick={save}>Changer le code</Button></>}>
      <form className="ac-form ac-form-one" onSubmit={(e) => { e.preventDefault(); save() }}>
        <PinField label="Code secret actuel" value={cur} onChange={(v) => { setCur(v); setError('') }} autoFocus />
        <PinField label="Nouveau code secret" value={next} onChange={setNext} invalid={!!weak || (next.length === 6 && next === cur)} />
        {weak && <small className="ac-field-error">{weak}</small>}
        {!weak && next.length === 6 && next === cur && <small className="ac-field-error">Le nouveau code doit être différent de l'ancien.</small>}
        <PinField label="Confirmer le nouveau code" value={again} onChange={setAgain} invalid={mismatch} />
        {mismatch && <small className="ac-field-error">Les deux codes ne sont pas identiques.</small>}
        {error && <p className="ac-form-error" role="alert">{error}</p>}
        <button type="submit" className="ac-sr-only" tabIndex={-1} aria-hidden>Changer</button>
      </form>
    </Modal>
  )
}

// ── Changer de numéro ───────────────────────────────────────────────────────
// Connexion par code secret : code secret + SMS au nouveau numéro
// (/auth/phone/change/start puis /confirm). Sinon : demande validée par
// l'équipe DEM (POST /users/dem-pro/phone-change), comme l'app.
function PhoneChangeModal({ open, onClose }) {
  const auth = useProAuth()
  const notify = useNotify()
  const direct = auth.hasPinSession()
  const [step, setStep] = useState('start')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [target, setTarget] = useState(null)
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setStep('start'); setPhone(''); setPin(''); setCode(''); setTarget(null); setError(''); setResendIn(0) } else { setPin('') } }, [open])
  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const okPhone = isMobile(phone)
  const same = okPhone && String(auth.user?.phone ?? '').endsWith(phone)
  const pendingReq = !direct && auth.user?.phoneChangeStatus === 'PENDING'

  const start = async () => {
    if (!okPhone || same || busy || (direct && pin.length !== 6)) return
    setBusy(true); setError('')
    try {
      if (direct) {
        const r = await proApi.post('/auth/phone/change/start', { pin, newPhone: `+221${phone}` })
        setTarget(r.data?.newPhone ?? `+221${phone}`); setResendIn(r.data?.resendAfter ?? 60); setCode(''); setStep('confirm')
      } else {
        await proApi.post('/users/dem-pro/phone-change', { newPhone: `+221${phone}` })
        await auth.refreshMe().catch(() => {})
        notify.success('Demande envoyée', 'L\'équipe DEM va la valider. Vous serez prévenu par SMS.')
        onClose()
      }
    } catch (e) { setError(errMsg(e, 'Impossible de changer de numéro.')); if (direct) setPin('') } finally { setBusy(false) }
  }
  const confirm = async () => {
    if (code.length !== 6 || busy) return
    setBusy(true); setError('')
    try {
      const r = await proApi.post('/auth/phone/change/confirm', { newPhone: target, code })
      auth.saveAccessToken(r.data?.accessToken, r.data?.user)
      await auth.refreshMe().catch(() => {})
      notify.success('Numéro modifié', 'Utilisez désormais ce numéro pour vous connecter.')
      onClose()
    } catch (e) { setError(errMsg(e, 'Impossible de confirmer le nouveau numéro.')); setCode('') } finally { setBusy(false) }
  }
  const resend = async () => {
    if (resendIn > 0 || busy) return
    setBusy(true); setError('')
    try { const r = await proApi.post('/auth/phone/change/start', { pin, newPhone: target }); setResendIn(r.data?.resendAfter ?? 60); notify.success('Code renvoyé') }
    catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  const footer = step === 'confirm'
    ? <><Button variant="ghost" onClick={() => { setStep('start'); setError(''); setPin('') }} disabled={busy}>Retour</Button><Button loading={busy} disabled={code.length !== 6} onClick={confirm}>Confirmer le numéro</Button></>
    : <><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>{!pendingReq && <Button loading={busy} disabled={!okPhone || same || (direct && pin.length !== 6)} onClick={start}>{direct ? 'Recevoir le code SMS' : 'Envoyer la demande'}</Button>}</>
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Changer de numéro" width={480}
      subtitle={step === 'confirm' ? `Saisissez le code à 6 chiffres envoyé au ${phoneFmt(target)}.` : `Numéro actuel : ${phoneFmt(auth.user?.phone)}`}
      footer={footer}>
      {pendingReq ? (
        <p className="ac-alert" role="status"><AlertTriangle size={15} aria-hidden /> Une demande vers le {phoneFmt(auth.user?.pendingPhone)} est déjà en cours de validation par l'équipe DEM.</p>
      ) : step === 'start' ? (
        <form className="ac-form ac-form-one" onSubmit={(e) => { e.preventDefault(); start() }}>
          <label className="field">
            <span>Nouveau numéro</span>
            <div className="ac-phone">
              <span className="ac-phone-prefix">+221</span>
              <input className="input" type="tel" inputMode="numeric" autoFocus value={prettyPhone(phone)} placeholder="77 123 45 67" onChange={(e) => { setPhone(localDigits(e.target.value)); setError('') }} />
            </div>
            {phone.length === 9 && !okPhone && <small className="ac-field-error">Numéro mobile invalide : il commence par 70, 71, 75, 76, 77 ou 78.</small>}
            {same && <small className="ac-field-error">C'est déjà le numéro de votre compte.</small>}
          </label>
          {direct && <PinField label="Votre code secret" value={pin} onChange={(v) => { setPin(v); setError('') }} />}
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {direct ? 'Après confirmation, vos autres appareils sont déconnectés et les retraits bloqués 48 h, pour votre sécurité.' : 'La demande sera validée par l\'équipe DEM. Une seule demande tous les 7 jours.'}
          </p>
          {error && <p className="ac-form-error" role="alert">{error}</p>}
          <button type="submit" className="ac-sr-only" tabIndex={-1} aria-hidden>Continuer</button>
        </form>
      ) : (
        <form className="ac-form ac-form-one" onSubmit={(e) => { e.preventDefault(); confirm() }}>
          <PinField label="Code reçu par SMS" value={code} onChange={(v) => { setCode(v); setError('') }} autoFocus otp />
          <div className="muted" style={{ fontSize: 13 }}>
            {resendIn > 0 ? <>Renvoyer le code dans <span className="num">{Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, '0')}</span></> : <button type="button" className="link" onClick={resend}>Renvoyer le code</button>}
          </div>
          {error && <p className="ac-form-error" role="alert">{error}</p>}
          <button type="submit" className="ac-sr-only" tabIndex={-1} aria-hidden>Confirmer</button>
        </form>
      )}
    </Modal>
  )
}

// ── Supprimer le compte (GET /users/me/deletion-check, DELETE /users/me) ────
const CONFIRM_WORD = 'SUPPRIMER'
// Montée seulement à l'ouverture : chaque ouverture repart de zéro
function DeleteAccountModal({ onClose }) {
  const { user } = useProAuth()
  const [check, setCheck] = useState(null)
  const [failed, setFailed] = useState(false)
  const [word, setWord] = useState('')
  const [understood, setUnderstood] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fetchCheck = useCallback(async () => {
    try { const r = await proApi.get('/users/me/deletion-check'); setCheck(r.data); setFailed(false) } catch (e) { setFailed(true); setError(errMsg(e)) }
  }, [])
  useEffect(() => { fetchCheck() }, [fetchCheck])
  const runCheck = () => { setCheck(null); setFailed(false); setError(''); fetchCheck() }

  const ready = check?.canDelete && understood && word.trim().toUpperCase() === CONFIRM_WORD
  const remove = async () => {
    if (!ready || busy) return
    setBusy(true); setError('')
    try {
      await proApi.delete('/users/me')
      // Compte effacé : session fermée ici, message sur l'écran de connexion
      endSession('Votre compte DEM Pro a été supprimé. Merci d\'avoir travaillé avec DEM.')
    } catch (e) {
      const blockers = e?.response?.data?.blockers
      if (Array.isArray(blockers)) setCheck({ canDelete: false, blockers, warnings: [] })
      setError(errMsg(e, 'La suppression n\'a pas pu aboutir.'))
      setBusy(false)
    }
  }

  const blocked = check && !check.canDelete
  return (
    <Modal open onClose={() => !busy && onClose()} width={520}
      title={blocked ? 'Suppression impossible pour l\'instant' : 'Supprimer votre compte DEM Pro ?'}
      subtitle={blocked ? 'Réglez d\'abord ces points :' : check ? 'Cette action est irréversible. Vos informations personnelles seront effacées et votre numéro libéré.' : undefined}
      footer={blocked || failed
        ? <><Button variant="ghost" onClick={onClose}>Fermer</Button><Button variant="ghost" onClick={runCheck}>Vérifier à nouveau</Button></>
        : <><Button variant="ghost" onClick={onClose} disabled={busy}>Garder mon compte</Button><Button variant="danger" icon={Trash2} loading={busy} disabled={!ready} onClick={remove}>Supprimer définitivement</Button></>}>
      {failed ? <ErrorState compact title="Vérification impossible" text={error || 'Réessayez dans un instant.'} onRetry={runCheck} />
        : !check ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={18} w={240} /><Skeleton h={44} /></div>
        : blocked ? (
          <ul className="ac-checklist is-block">
            {check.blockers.map(b => <li key={b.code}><AlertTriangle size={15} aria-hidden /> {b.message}</li>)}
          </ul>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {check.warnings?.length > 0 && (
              <ul className="ac-checklist">
                {check.warnings.map(w => <li key={w.code}><AlertTriangle size={15} aria-hidden /> {w.message}</li>)}
              </ul>
            )}
            <label className="ac-check">
              <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
              <span>Je comprends que la boutique {user?.proBusinessName ? <b>{user.proBusinessName}</b> : ''} sera fermée et que mes données ne pourront pas être récupérées.</span>
            </label>
            <label className="field">
              <span>Pour confirmer, tapez {CONFIRM_WORD}</span>
              <input className="input mono" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" spellCheck={false} placeholder={CONFIRM_WORD} />
            </label>
            {error && <p className="ac-form-error" role="alert">{error}</p>}
          </div>
        )}
    </Modal>
  )
}

function AddAddressModal({ open, onClose, onSaved, hasDefault }) {
  const notify = useNotify()
  const [label, setLabel] = useState('')
  const [place, setPlace] = useState(null)
  const [landmark, setLandmark] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setLabel(''); setPlace(null); setLandmark('') } }, [open])
  const save = async () => {
    setBusy(true)
    try {
      await proApi.post('/dem-pro/addresses', { label: label.trim(), address: place.address, landmark: landmark.trim() || null, icon: 'other', isDefault: !hasDefault, lat: place.lat, lng: place.lng })
      notify.success('Adresse ajoutée', 'Disponible aussi dans l\'application.')
      onSaved()
    } catch (e) { notify.error('L\'adresse n\'a pas été ajoutée', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle adresse de retrait" width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button loading={busy} disabled={label.trim().length < 2 || !place} onClick={save}>Ajouter</Button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <label className="field"><span>Nom</span><input className="input" autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex. Boutique Médina, Dépôt" /></label>
        <div className="field"><span>Adresse</span><PlaceSearch value={place} onPick={setPlace} /></div>
        <label className="field"><span>Repère</span><input className="input" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Ex. à côté de la boulangerie" /></label>
        {!hasDefault && <div className="muted" style={{ fontSize: 13 }}>Ce sera votre adresse par défaut : elle sert au prix de livraison de votre lien de commande.</div>}
      </div>
    </Modal>
  )
}
