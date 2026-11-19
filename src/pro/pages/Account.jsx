import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Plus, Star, Trash2, Monitor, LogOut, Smartphone, Tablet, CheckCircle2, ArrowUpRight, ArrowRight } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { Avatar } from '../ProLayout'
import { dateTime, phoneFmt, planName, timeAgo } from '../lib/format'
import { Button, Chip, Empty, ErrorState, IconButton, Modal, PageHeader, Skeleton, Toggle } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { PlaceSearch } from './NewDelivery'

// Compte (modèle « réglages ») : profil, offre, paiement, adresses de
// retrait, appareils connectés — les mêmes réglages que dans l'application.
const longDate = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function deviceIcon(s) {
  const p = (s.platform ?? s.deviceLabel ?? '').toLowerCase()
  if (/web|chrome|safari|firefox|edge|mac|windows|linux|ordinateur/.test(p)) return Monitor
  if (/ipad|tablet|tablette/.test(p)) return Tablet
  return Smartphone
}

function Section({ title, description, children, action }) {
  return (
    <section className="ac-sec">
      <div className="ac-sec-head">
        <h2 className="ac-sec-title">{title}</h2>
        {description && <p className="muted ac-sec-desc">{description}</p>}
        {action && <div style={{ marginTop: 12 }}>{action}</div>}
      </div>
      <div className="ac-sec-body">{children}</div>
    </section>
  )
}

export default function Account() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [plan, setPlan] = useState(null)
  const [addresses, setAddresses] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [failed, setFailed] = useState({})
  const [adding, setAdding] = useState(false)
  const [savingPay, setSavingPay] = useState(false)
  const [confirm, setConfirm] = useState(null) // { title, text, cta, run }
  const [confirmBusy, setConfirmBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await Promise.allSettled([
      proApi.get('/dem-pro/me/plan'),
      proApi.get('/dem-pro/addresses'),
      proApi.get('/dem-pro/me/sessions'),
    ])
    const [p, a, s] = res
    if (p.status === 'fulfilled') setPlan(p.value.data)
    if (a.status === 'fulfilled') setAddresses(a.value.data ?? [])
    if (s.status === 'fulfilled') setSessions(s.value.data)
    setFailed({ plan: p.status === 'rejected', addresses: a.status === 'rejected', sessions: s.status === 'rejected' })
  }, [])
  useEffect(() => { load() }, [load])

  const runConfirm = async () => {
    setConfirmBusy(true)
    try { await confirm.run(); setConfirm(null) } finally { setConfirmBusy(false) }
  }

  const setDefault = async (a) => {
    try { await proApi.patch(`/dem-pro/addresses/${a.id}/default`); notify.success('Adresse par défaut changée', `${a.label} sert maintenant au prix de votre lien de commande.`); load() }
    catch (e) { notify.error('L’adresse par défaut n’a pas changé', errMsg(e)) }
  }
  const askRemove = (a) => setConfirm({
    title: `Supprimer « ${a.label} » ?`, text: 'Cette adresse de retrait disparaît aussi de l’application.', cta: 'Supprimer l’adresse',
    run: async () => {
      try { await proApi.delete(`/dem-pro/addresses/${a.id}`); notify.success('Adresse supprimée'); load() }
      catch (e) { notify.error('L’adresse n’a pas été supprimée', errMsg(e)); throw e }
    },
  })
  const revokeOne = async (s) => {
    await proApi.delete(`/dem-pro/me/sessions/${s.id}`)
    setSessions(cur => cur && { ...cur, sessions: (cur.sessions ?? []).filter(x => x.id !== s.id) })
  }
  const askRevoke = (s) => setConfirm({
    title: `Déconnecter « ${s.deviceLabel ?? 'Appareil inconnu'} » ?`, text: 'Il faudra se reconnecter avec le numéro et le code secret sur cet appareil.', cta: 'Déconnecter',
    run: async () => {
      try { await revokeOne(s); notify.success('Appareil déconnecté', s.deviceLabel ?? undefined) }
      catch (e) { notify.error('L’appareil n’a pas été déconnecté', errMsg(e)); throw e }
    },
  })
  const others = (sessions?.sessions ?? []).filter(s => !s.current)
  const askRevokeOthers = () => setConfirm({
    title: `Déconnecter ${others.length} autre${others.length > 1 ? 's' : ''} appareil${others.length > 1 ? 's' : ''} ?`,
    text: 'Seul cet appareil restera connecté. Les autres devront se reconnecter.', cta: 'Déconnecter les autres',
    run: async () => {
      const r = await Promise.allSettled(others.map(revokeOne))
      const ko = r.filter(x => x.status === 'rejected').length
      if (ko) notify.error(`${ko} appareil${ko > 1 ? 's' : ''} n’${ko > 1 ? 'ont' : 'a'} pas été déconnecté${ko > 1 ? 's' : ''}`, 'Réessayez dans un instant.')
      else notify.success('Autres appareils déconnectés')
      load()
    },
  })

  const togglePay = async (next) => {
    setSavingPay(true)
    try { await proApi.patch('/dem-pro/me/payment-settings', { inAppPaymentEnabled: next }); notify.success(next ? 'Paiement en ligne activé' : 'Paiement en ligne désactivé'); load() }
    catch (e) { notify.error('Le paiement en ligne n’a pas changé', errMsg(e)) } finally { setSavingPay(false) }
  }

  // Offre : barre de durée seulement si on connaît le début et la fin
  const start = plan?.startedAt ?? plan?.activatedAt ?? null
  const end = plan?.expiresAt ?? null
  const daysLeft = end ? Math.max(0, Math.ceil((new Date(end) - Date.now()) / 86400000)) : null
  const progress = start && end ? Math.min(100, Math.max(0, ((Date.now() - new Date(start)) / (new Date(end) - new Date(start))) * 100)) : null
  const sortedSessions = [...(sessions?.sessions ?? [])].sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0))

  return (
    <div className="ac-page">
      <PageHeader eyebrow="Compte" title={<>Votre compte<span className="dot">.</span></>}
        description="Les réglages de votre compte DEM Pro, partagés avec l'application." />

      <div className="card ac-card">
        <Section title="Profil" description="Ces informations apparaissent sur votre boutique et vos livraisons.">
          <div className="ac-profile">
            <Avatar user={user} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ac-strong">{user?.proBusinessName ?? user?.name}</div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{user?.name} · {phoneFmt(user?.phone)}</div>
            </div>
            {user?.isVerified === true && <Chip color="var(--p-success)" bg="var(--p-success-bg)"><CheckCircle2 size={12} aria-hidden /> Compte vérifié</Chip>}
          </div>
        </Section>

        <Section title="Offre" description="Votre abonnement DEM Pro.">
          {failed.plan && !plan ? <ErrorState compact title="Impossible de charger votre offre" onRetry={load} />
            : !plan ? <Skeleton h={64} />
            : (
              <div className="ac-plan">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <span className="ac-strong">{plan.planLabel ?? planName(plan.plan)}</span>
                  <span className="muted" style={{ fontSize: 13.5 }}>
                    {plan.status === 'EXPIRED' ? 'expirée' : plan.isTrial ? 'période d’essai' : 'active'}{end ? ` · jusqu'au ${longDate(end)}` : ''}
                  </span>
                </div>
                {progress != null && <div className="ac-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress}%` }} /></div>}
                {daysLeft != null && <div className="muted" style={{ fontSize: 13, marginTop: 8, color: daysLeft <= 3 ? 'var(--p-danger)' : undefined }}>{daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</div>}
                <a className="link-caps" href="https://www.dem.sn/dem-pro" target="_blank" rel="noopener noreferrer" style={{ marginTop: 14 }}>
                  Renouveler ou changer d'offre <ArrowUpRight size={14} aria-hidden />
                </a>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>Le paiement de l'offre se fait dans l'application DEM Pro (Wave ou Orange Money).</div>
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
          {!plan && !failed.plan && <Skeleton h={44} />}
          <Link className="link-caps" to="/boutique?onglet=apparence" style={{ marginTop: 16 }}>
            Modes de paiement du lien de commande · Boutique › Apparence et paiement <ArrowRight size={14} aria-hidden />
          </Link>
        </Section>

        <Section title="Adresses de retrait" description="Là où les coursiers viennent chercher vos colis. L'adresse par défaut sert au prix de livraison de votre lien de commande."
          action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>Ajouter une adresse</Button>}>
          {failed.addresses && !addresses ? <ErrorState compact title="Impossible de charger vos adresses" onRetry={load} />
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
                      {a.isDefault && <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--p-cyan-2)', fontWeight: 600 }}>Par défaut · utilisée pour le prix du lien de commande</div>}
                    </div>
                    {!a.isDefault && <Button size="sm" variant="quiet" icon={Star} onClick={() => setDefault(a)}>Par défaut</Button>}
                    {!a.isDefault && <IconButton icon={Trash2} label={`Supprimer ${a.label}`} size="sm" variant="plain" onClick={() => askRemove(a)} />}
                  </li>
                ))}
              </ul>
            )}
        </Section>

        <Section title="Appareils connectés"
          description={sessions ? `${sessions.sessions?.length ?? 0} sur ${sessions.max ?? '—'} autorisés par votre offre.` : 'Les appareils où votre compte est ouvert.'}
          action={others.length > 0 && <Button size="sm" variant="ghost" icon={LogOut} onClick={askRevokeOthers}>Déconnecter les autres appareils</Button>}>
          {failed.sessions && !sessions ? <ErrorState compact title="Impossible de charger vos appareils" onRetry={load} />
            : !sessions ? <Skeleton h={56} />
            : (
              <ul className="ac-list">
                {sortedSessions.map(s => {
                  const Icon = deviceIcon(s)
                  return (
                    <li key={s.id}>
                      <Icon size={16} aria-hidden className="ac-ico" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {s.deviceLabel ?? 'Appareil inconnu'}{s.memberName ? ` · ${s.memberName}` : ''}
                          {s.current && <Chip color="var(--p-success)" bg="var(--p-success-bg)">Cet appareil</Chip>}
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
      </div>

      <AddAddressModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} hasDefault={(addresses ?? []).some(a => a.isDefault)} />

      <Modal open={!!confirm} onClose={() => !confirmBusy && setConfirm(null)} title={confirm?.title} subtitle={confirm?.text} width={460}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)} disabled={confirmBusy}>Annuler</Button><Button variant="danger" loading={confirmBusy} onClick={() => runConfirm().catch(() => {})}>{confirm?.cta}</Button></>} />
    </div>
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
      notify.success('Adresse ajoutée', 'Disponible aussi dans l’application.')
      onSaved()
    } catch (e) { notify.error('L’adresse n’a pas été ajoutée', errMsg(e)) } finally { setBusy(false) }
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
