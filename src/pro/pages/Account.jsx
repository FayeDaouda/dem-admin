import { useCallback, useEffect, useState } from 'react'
import { Crown, MapPin, Plus, Star, Trash2, MonitorSmartphone, LogOut, CreditCard, Smartphone, CalendarDays, CheckCircle2, Store, Phone } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { Avatar } from '../ProLayout'
import { dateTime, phoneFmt, planName, timeAgo } from '../lib/format'
import { Button, Card, Chip, Empty, Modal, SectionTitle, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { PlaceSearch } from './NewDelivery'

// Compte : profil, offre, adresses de retrait, paiement en ligne, appareils
// connectés — les mêmes réglages que dans l'application.
export default function Account() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [plan, setPlan] = useState(null)
  const [addresses, setAddresses] = useState(null)
  const [sessions, setSessions] = useState(null)
  const [adding, setAdding] = useState(false)
  const [savingPay, setSavingPay] = useState(false)

  const load = useCallback(async () => {
    const [p, a, s] = await Promise.all([
      proApi.get('/dem-pro/me/plan').then(r => r.data).catch(() => null),
      proApi.get('/dem-pro/addresses').then(r => r.data ?? []).catch(() => []),
      proApi.get('/dem-pro/me/sessions').then(r => r.data).catch(() => null),
    ])
    setPlan(p); setAddresses(a); setSessions(s)
  }, [])
  useEffect(() => { load() }, [load])

  const daysLeft = plan?.expiresAt ? Math.max(0, Math.ceil((new Date(plan.expiresAt) - Date.now()) / 86400000)) : null

  const setDefault = async (a) => {
    try { await proApi.patch(`/dem-pro/addresses/${a.id}/default`); notify.success('Adresse par défaut changée', a.label); load() } catch (e) { notify.error('Impossible', errMsg(e)) }
  }
  const remove = async (a) => {
    try { await proApi.delete(`/dem-pro/addresses/${a.id}`); notify.success('Adresse supprimée'); load() } catch (e) { notify.error('Suppression impossible', errMsg(e)) }
  }
  const revoke = async (s) => {
    try { const r = await proApi.delete(`/dem-pro/me/sessions/${s.id}`); setSessions(r.data?.sessions ? r.data : sessions && { ...sessions, sessions: sessions.sessions.filter(x => x.id !== s.id) }); notify.success('Appareil déconnecté', s.deviceLabel ?? undefined) } catch (e) { notify.error('Impossible', errMsg(e)) }
  }
  const togglePay = async () => {
    setSavingPay(true)
    try { await proApi.patch('/dem-pro/me/payment-settings', { inAppPaymentEnabled: !plan.inAppPaymentEnabled }); notify.success(plan.inAppPaymentEnabled ? 'Paiement en ligne désactivé' : 'Paiement en ligne activé'); load() }
    catch (e) { notify.error('Réglage impossible', errMsg(e)) } finally { setSavingPay(false) }
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>Compte</h1>
        <div className="muted" style={{ marginTop: 4 }}>Les réglages de votre compte DEM Pro, partagés avec l'application.</div>
      </div>

      <div className="grid-main">
        <div style={{ display: 'grid', gap: 20 }} className="stagger">
          {/* Profil */}
          <Card style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar user={user} size={64} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.proBusinessName ?? user?.name}</div>
              <div className="muted" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4, fontSize: 13.5 }}>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Store size={14} /> {user?.name}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Phone size={14} /> {phoneFmt(user?.phone)}</span>
              </div>
            </div>
            <Chip color="#16a34a"><CheckCircle2 size={12} /> Compte vérifié</Chip>
          </Card>

          {/* Adresses */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: '20px 22px 6px' }}>
              <SectionTitle title="Adresses de retrait" hint="Là où les coursiers viennent chercher vos colis"
                action={<Button size="sm" variant="ghost" icon={Plus} onClick={() => setAdding(true)}>Ajouter</Button>} />
            </div>
            {!addresses ? <div style={{ padding: 22 }}><Skeleton h={56} r={12} /></div>
              : addresses.length === 0 ? <Empty icon={MapPin} title="Aucune adresse" text="Ajoutez l'adresse de votre boutique pour lancer vos livraisons." />
              : addresses.map(a => (
                <div key={a.id} className="row-hover" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 22px', borderTop: '1px solid var(--p-line)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: a.isDefault ? 'var(--p-gradient)' : 'var(--p-soft)', color: a.isDefault ? '#fff' : 'var(--p-muted)', display: 'grid', placeItems: 'center' }}><MapPin size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>{a.label} {a.isDefault && <Chip color="#0671ba">Par défaut</Chip>}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{a.address}{a.landmark ? ` · ${a.landmark}` : ''}</div>
                  </div>
                  {!a.isDefault && <Button size="sm" variant="ghost" icon={Star} onClick={() => setDefault(a)}>Par défaut</Button>}
                  {!a.isDefault && <button className="btn btn-ghost btn-icon btn-sm" title="Supprimer" onClick={() => remove(a)}><Trash2 size={15} color="var(--p-danger)" /></button>}
                </div>
              ))}
          </Card>

          {/* Appareils */}
          <Card style={{ padding: 0 }}>
            <div style={{ padding: '20px 22px 6px' }}>
              <SectionTitle title="Appareils connectés" hint={sessions ? `${sessions.sessions?.length ?? 0} sur ${sessions.max ?? '—'} autorisés par votre offre` : ' '} />
            </div>
            {!sessions ? <div style={{ padding: 22 }}><Skeleton h={56} r={12} /></div> : (sessions.sessions ?? []).map(s => (
              <div key={s.id} className="row-hover" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '13px 22px', borderTop: '1px solid var(--p-line)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--p-soft)', color: 'var(--p-cyan-2)', display: 'grid', placeItems: 'center' }}>
                  {/web/i.test(s.deviceLabel ?? '') ? <MonitorSmartphone size={18} /> : <Smartphone size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>{s.deviceLabel ?? 'Téléphone'}{s.memberName ? ` · ${s.memberName}` : ''} {s.current && <Chip color="#16a34a">Cet appareil</Chip>}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>Connecté le {dateTime(s.createdAt)} · actif {timeAgo(s.lastSeenAt)}</div>
                </div>
                {!s.current && <Button size="sm" variant="ghost" icon={LogOut} onClick={() => revoke(s)}>Déconnecter</Button>}
              </div>
            ))}
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 20 }} className="stagger">
          {/* Offre */}
          <div className="card" style={{ padding: 22, background: 'linear-gradient(150deg, #04317c, #021b47)', color: '#fff', border: 'none', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', right: -30, top: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,196,81,.35), transparent 70%)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(245,196,81,.18)', color: '#f5c451', display: 'grid', placeItems: 'center' }}><Crown size={21} /></div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17 }}>{plan ? planName(plan.plan) : '…'}</div>
                <div style={{ fontSize: 12.5, opacity: .7 }}>{plan?.isTrial ? 'Période d\'essai' : plan?.status === 'ACTIVE' ? 'Active' : plan?.status ?? ''}</div>
              </div>
            </div>
            {plan?.expiresAt && (
              <div style={{ marginTop: 18, position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, opacity: .8 }}>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><CalendarDays size={13} /> Jusqu'au {new Date(plan.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
                  <b>{daysLeft} jour{daysLeft > 1 ? 's' : ''}</b>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.15)', marginTop: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (daysLeft / 30) * 100)}%`, background: daysLeft <= 3 ? '#f87171' : 'linear-gradient(90deg, #0cb8de, #5eead4)', borderRadius: 3, transition: 'width .8s var(--p-ease)' }} />
                </div>
              </div>
            )}
            <div style={{ fontSize: 12.5, opacity: .7, marginTop: 16, position: 'relative' }}>Le renouvellement et le changement d'offre se font dans l'application DEM Pro (paiement Wave ou Orange Money).</div>
          </div>

          {/* Paiement en ligne */}
          <Card>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e3f8fc', color: 'var(--p-cyan-2)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><CreditCard size={19} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800 }}>Paiement en ligne</div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Vos clients paient leurs articles par Wave ou Orange Money sur votre lien de commande. L'argent arrive dans votre wallet.</div>
              </div>
              {plan && (
                <button onClick={togglePay} disabled={savingPay} aria-label="Paiement en ligne" style={{ width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative', background: plan.inAppPaymentEnabled ? 'var(--p-cyan)' : '#d3dcea', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: plan.inAppPaymentEnabled ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.2)', transition: 'left .2s var(--p-ease)' }} />
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      <AddAddressModal open={adding} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} hasDefault={(addresses ?? []).some(a => a.isDefault)} />
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
      notify.success('Adresse ajoutée', 'Disponible aussi dans l\'application.')
      onSaved()
    } catch (e) { notify.error('Ajout impossible', errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle adresse de retrait" width={520}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button loading={busy} disabled={label.trim().length < 2 || !place} onClick={save}>Ajouter</Button></>}>
      <div style={{ display: 'grid', gap: 14 }}>
        <label className="field"><span>Nom</span><input className="input" autoFocus value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex. Boutique Médina, Dépôt" /></label>
        <div className="field"><span>Adresse</span><PlaceSearch value={place} onPick={setPlace} /></div>
        <label className="field"><span>Repère</span><input className="input" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Ex. à côté de la boulangerie" /></label>
      </div>
    </Modal>
  )
}
