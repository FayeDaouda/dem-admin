import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, Copy, Crown, MessageCircle, MoreHorizontal, Plus, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { phoneFmt, timeAgo } from '../lib/format'
import { Button, Chip, Empty, ErrorState, IconButton, Modal, PageHeader, Segmented, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import RequireAccess from '../ui/RequireAccess'
import PlanPurchaseModal from '../ui/PlanPurchaseModal'
import '../styles/account.css'

// Équipe DEM Pro (responsable) — même écran que l'app (dem_pro_team_screen.dart) :
// GET/POST /dem-pro/me/team, PATCH/DELETE /dem-pro/me/team/:id. Chaque membre
// se connecte avec SON numéro et son propre code SMS, puis choisit la
// boutique. Places = téléphones de l'offre − 1 (le responsable).
const ROLES = {
  STAFF: {
    label: 'Employé', icon: BadgeCheck, tagline: 'Les livraisons au quotidien',
    can: ['Créer et suivre les livraisons et tournées', 'Confirmer les commandes reçues', 'Gérer le catalogue et les adresses'],
  },
  MANAGER: {
    label: 'Gérant', icon: Crown, tagline: 'Tout l\'employé, plus le pilotage',
    can: ['Tout ce que fait un employé', 'Dashboard : ventes, livraisons, activité, export', 'Clients et solde du wallet (consultation)'],
  },
}
const OWNER_ONLY = 'Retraits, offres, paiement intégré, équipe et profil de la boutique restent réservés au responsable.'
const roleOf = (r) => ROLES[r] ?? ROLES.STAFF

const localDigits = (raw) => {
  let d = String(raw).replace(/\D/g, '')
  if (d.startsWith('00221')) d = d.slice(5)
  else if (d.startsWith('221') && d.length > 9) d = d.slice(3)
  return d.slice(0, 9)
}
const prettyPhone = (d) => d.replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2})/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
const isMobile = (d) => /^7[015678]\d{7}$/.test(d)

function inviteText(member, shop) {
  return `Bonjour ${member.name}, je vous ai ajouté comme ${roleOf(member.role).label.toLowerCase()} de ${shop} sur DEM Pro. `
    + `Installez l'application DEM (https://www.dem.sn), connectez-vous avec votre numéro ${phoneFmt(member.phone)} `
    + `(vous recevrez votre propre code SMS), puis choisissez « ${shop} ». Sur ordinateur : https://pro.dem.sn`
}
const waTo = (phone, text) => `https://wa.me/${String(phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

export default function TeamPage() {
  return <RequireAccess area="team"><Team /></RequireAccess>
}

function Team() {
  const { user } = useProAuth()
  const notify = useNotify()
  const shop = user?.proBusinessName || 'ma boutique'
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [invite, setInvite] = useState(null)
  const [removing, setRemoving] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [offers, setOffers] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try { setData((await proApi.get('/dem-pro/me/team')).data) } catch { setFailed(true) }
  }, [])
  useEffect(() => { load() }, [load])

  const members = data?.members ?? []
  const max = data?.max ?? 0
  const full = data && members.length >= max

  const setRole = async (m, role) => {
    if (m.role === role || busyId) return
    setBusyId(m.id)
    try {
      setData((await proApi.patch(`/dem-pro/me/team/${m.id}`, { role })).data)
      notify.success(`${m.name} est maintenant ${roleOf(role).label.toLowerCase()}`, 'Le changement s\'applique tout de suite.')
    } catch (e) { notify.error('Le rôle n\'a pas changé', errMsg(e)) } finally { setBusyId(null) }
  }

  const remove = async () => {
    if (!removing) return
    setRemoveBusy(true)
    try {
      setData((await proApi.delete(`/dem-pro/me/team/${removing.id}`)).data)
      notify.success(`${removing.name} a été retiré de l'équipe`, 'Déconnecté de tous ses téléphones.')
      setRemoving(null)
    } catch (e) { notify.error('Le membre n\'a pas été retiré', errMsg(e)) } finally { setRemoveBusy(false) }
  }

  const copyInvite = async (m) => {
    try { await navigator.clipboard.writeText(inviteText(m, shop)); notify.success('Invitation copiée', 'Collez-la dans un SMS ou un message.') }
    catch { notify.error('Copie impossible', 'Sélectionnez le texte à la main.') }
  }

  return (
    <div className="tm-page">
      <PageHeader eyebrow="Compte" title={<>Équipe<span className="dot">.</span></>}
        description="Faites travailler vos employés sur votre boutique, chacun avec son propre numéro : pas de code partagé, et vous gardez la main sur l'argent."
        actions={data && max > 0 && (
          <Button icon={Plus} onClick={() => (full ? setOffers(true) : setAdding(true))}>Ajouter un membre</Button>
        )} />

      {failed && !data ? <div className="card"><ErrorState title="Impossible de charger votre équipe" onRetry={load} /></div>
        : !data ? <div className="card" style={{ padding: 24, display: 'grid', gap: 12 }}><Skeleton h={18} w={220} /><Skeleton h={56} /><Skeleton h={56} /></div>
        : max === 0 && members.length === 0 ? (
          <div className="card tm-locked">
            <span className="tm-locked-ico"><Users size={22} aria-hidden /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="tm-locked-title">L'équipe est incluse à partir de l'offre Business</h2>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>
                Ajoutez vos employés avec leur propre numéro : chacun ses notifications, chaque course porte le nom de qui l'a créée, et l'argent reste à vous.
              </p>
            </div>
            <Button arrow="right" onClick={() => setOffers(true)}>Voir les offres</Button>
          </div>
        ) : (
          <>
            <div className="tm-meter card">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tm-meter-label"><span className="num">{members.length}</span> sur <span className="num">{max}</span> place{max > 1 ? 's' : ''} utilisée{members.length > 1 ? 's' : ''}</div>
                <div className="ac-bar" role="progressbar" aria-valuenow={members.length} aria-valuemin={0} aria-valuemax={max} aria-label="Places d'équipe utilisées">
                  <i style={{ width: `${max ? Math.min(100, (members.length / max) * 100) : 0}%` }} />
                </div>
              </div>
              <div className="muted tm-meter-hint">
                {full ? 'Équipe complète : passez à l\'offre supérieure pour ajouter quelqu\'un.' : 'Chaque membre occupe un des téléphones autorisés par votre offre.'}
              </div>
              {full && <Button size="sm" variant="ghost" onClick={() => setOffers(true)}>Voir les offres</Button>}
            </div>

            <div className="card tm-list">
              {members.length === 0 ? (
                <Empty icon={Users} title="Pas encore d'équipe" text="Ajoutez un employé ou un gérant pour partager le travail."
                  action={<Button icon={Plus} onClick={() => setAdding(true)}>Ajouter un membre</Button>} />
              ) : (
                <table className="tm-table">
                  <thead>
                    <tr><th>Membre</th><th>Rôle</th><th className="tm-c-activity">Activité</th><th className="tm-c-month">Ce mois-ci</th><th aria-label="Actions" /></tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        <td>
                          <div className="tm-who">
                            <span className="tm-avatar" aria-hidden>{(m.name || '?').trim().charAt(0).toUpperCase()}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="tm-name">{m.name}</div>
                              <div className="muted num tm-phone">{phoneFmt(m.phone)}</div>
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={m.role} /></td>
                        <td className="tm-c-activity">
                          {m.connected
                            ? <span className="tm-online"><span className="tm-dot" aria-hidden /> Connecté</span>
                            : <span className="muted">{m.lastSeenAt ? `Actif ${timeAgo(m.lastSeenAt)}` : 'Jamais connecté'}</span>}
                        </td>
                        <td className="tm-c-month">
                          {m.ordersThisMonth
                            ? <span><b className="num">{m.ordersThisMonth}</b> course{m.ordersThisMonth > 1 ? 's' : ''} · <span className="num">{m.deliveredThisMonth}</span> livrée{m.deliveredThisMonth > 1 ? 's' : ''}</span>
                            : <span className="muted">Aucune course</span>}
                        </td>
                        <td className="tm-c-menu">
                          <MemberMenu member={m} busy={busyId === m.id}
                            onRole={(r) => setRole(m, r)} onInvite={() => setInvite(m)} onCopy={() => copyInvite(m)} onRemove={() => setRemoving(m)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

      <section className="tm-roles" aria-label="Rôles de l'équipe">
        {Object.entries(ROLES).map(([k, r]) => {
          const Icon = r.icon
          return (
            <div key={k} className="card tm-role">
              <div className="tm-role-head"><Icon size={18} aria-hidden /><strong>{r.label}</strong><span className="muted">{r.tagline}</span></div>
              <ul>{r.can.map(c => <li key={c}>{c}</li>)}</ul>
            </div>
          )
        })}
        <div className="card tm-role tm-role-owner">
          <div className="tm-role-head"><ShieldCheck size={18} aria-hidden /><strong>Vous, le responsable</strong></div>
          <p className="muted" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>{OWNER_ONLY} Un membre retiré est déconnecté immédiatement de tous ses téléphones.</p>
        </div>
      </section>

      <AddMemberModal open={adding} onClose={() => setAdding(false)}
        onAdded={(next, added) => { setData(next); setAdding(false); notify.success('Membre ajouté', 'Envoyez-lui l\'invitation pour qu\'il se connecte.'); if (added) setInvite(added) }} />

      <Modal open={!!invite} onClose={() => setInvite(null)} title={`Inviter ${invite?.name ?? ''}`} width={500}
        subtitle="Il se connecte avec son numéro et reçoit son propre code SMS."
        footer={<>
          <Button variant="ghost" icon={Copy} onClick={() => invite && copyInvite(invite)}>Copier</Button>
          {invite && <Button icon={MessageCircle} href={waTo(invite.phone, inviteText(invite, shop))} target="_blank" rel="noopener noreferrer">Envoyer par WhatsApp</Button>}
        </>}>
        {invite && <p className="tm-invite">{inviteText(invite, shop)}</p>}
      </Modal>

      <Modal open={!!removing} onClose={() => !removeBusy && setRemoving(null)} title={`Retirer ${removing?.name ?? ''} ?`} width={460}
        subtitle="Il sera déconnecté tout de suite de tous ses téléphones. Les courses qu'il a créées gardent son nom."
        footer={<><Button variant="ghost" onClick={() => setRemoving(null)} disabled={removeBusy}>Annuler</Button><Button variant="danger" loading={removeBusy} onClick={remove}>Retirer de l'équipe</Button></>} />

      <PlanPurchaseModal open={offers} onClose={() => setOffers(false)} onChanged={load} />
    </div>
  )
}

function RoleBadge({ role }) {
  const r = roleOf(role)
  return role === 'MANAGER'
    ? <Chip color="var(--p-dark)" bg="#EEF4FF">{r.label}</Chip>
    : <Chip color="var(--p-slate)" bg="var(--p-slate-bg)">{r.label}</Chip>
}

function MemberMenu({ member, busy, onRole, onInvite, onCopy, onRemove }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const k = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open])
  const other = member.role === 'MANAGER' ? 'STAFF' : 'MANAGER'
  const act = (fn) => () => { setOpen(false); fn() }
  return (
    <div className="dl-menu-wrap" ref={ref}>
      <IconButton icon={MoreHorizontal} label={`Actions pour ${member.name}`} size="sm" variant="plain" disabled={busy}
        aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)} />
      {open && (
        <div className="dl-menu" role="menu">
          <button type="button" role="menuitem" onClick={act(() => onRole(other))}><UserCog size={15} aria-hidden /> Passer en {roleOf(other).label.toLowerCase()}</button>
          <button type="button" role="menuitem" onClick={act(onInvite)}><MessageCircle size={15} aria-hidden /> Renvoyer l'invitation</button>
          <button type="button" role="menuitem" onClick={act(onCopy)}><Copy size={15} aria-hidden /> Copier l'invitation</button>
          <span className="dl-menu-sep" aria-hidden />
          <button type="button" role="menuitem" className="danger" onClick={act(onRemove)}><Trash2 size={15} aria-hidden /> Retirer de l'équipe</button>
        </div>
      )}
    </div>
  )
}

function AddMemberModal({ open, onClose, onAdded }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('STAFF')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setName(''); setPhone(''); setRole('STAFF'); setTouched(false); setError('') } }, [open])

  const okName = name.trim().length >= 2
  const okPhone = isMobile(phone)
  const save = async (ev) => {
    ev?.preventDefault()
    setTouched(true)
    if (!okName || !okPhone || busy) return
    setBusy(true); setError('')
    try {
      const res = await proApi.post('/dem-pro/me/team', { name: name.trim(), phone, role })
      const added = (res.data?.members ?? []).find(m => String(m.phone).endsWith(phone)) ?? null
      onAdded(res.data, added)
    } catch (e) { setError(errMsg(e, 'Impossible d\'ajouter ce membre.')) } finally { setBusy(false) }
  }
  const r = roleOf(role)
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Ajouter un membre" width={520}
      subtitle="Il se connectera avec ce numéro et recevra son propre code SMS."
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button><Button loading={busy} onClick={save}>Ajouter comme {r.label.toLowerCase()}</Button></>}>
      <form onSubmit={save} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(e) }} style={{ display: 'grid', gap: 16 }} noValidate>
        <label className="field">
          <span>Nom</span>
          <input className="input" autoFocus value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Ex. Awa Diop"
            aria-invalid={touched && !okName} />
          {touched && !okName && <small className="ac-field-error">Indiquez le nom du membre.</small>}
        </label>
        <label className="field">
          <span>Numéro de téléphone</span>
          <div className="ac-phone">
            <span className="ac-phone-prefix">+221</span>
            <input className="input" type="tel" inputMode="numeric" autoComplete="off" value={prettyPhone(phone)} placeholder="77 123 45 67"
              onChange={e => setPhone(localDigits(e.target.value))} aria-invalid={touched && !okPhone} />
          </div>
          {touched && !okPhone && <small className="ac-field-error">9 chiffres, commençant par 70, 71, 75, 76, 77 ou 78.</small>}
        </label>
        <div className="field">
          <span>Rôle</span>
          <Segmented full value={role} onChange={setRole} label="Rôle du membre" options={[['STAFF', 'Employé', BadgeCheck], ['MANAGER', 'Gérant', Crown]]} />
          <ul className="tm-role-can">{r.can.map(c => <li key={c}>{c}</li>)}</ul>
        </div>
        {error && <p className="ac-form-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}
