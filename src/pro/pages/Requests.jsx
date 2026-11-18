import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, MapPin, Phone, CheckCircle2, XCircle, StickyNote, BadgeCheck, Clock } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { dateTime, fcfa, phoneFmt, timeAgo } from '../lib/format'
import { Button, Card, Chip, Empty, Modal, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Commandes reçues par le lien de commande : à valider (livraison
// pré-remplie) ou à refuser — même file que l'app.
const TABS = [['PENDING', 'À traiter'], ['CONFIRMED', 'Validées'], ['REJECTED', 'Refusées']]

export default function Requests() {
  const navigate = useNavigate()
  const notify = useNotify()
  const [all, setAll] = useState(null)
  const [tab, setTab] = useState('PENDING')
  const [rejecting, setRejecting] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const r = await proApi.get('/dem-pro/order-requests').catch(() => null)
    setAll(r?.data ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const list = useMemo(() => (all ?? []).filter(r => (r.status ?? 'PENDING') === tab), [all, tab])
  const count = (k) => (all ?? []).filter(r => (r.status ?? 'PENDING') === k).length

  const reject = async () => {
    setBusy(true)
    try {
      await proApi.post(`/dem-pro/order-requests/${rejecting.id}/reject`)
      notify.success('Commande refusée', rejecting.paidAt ? 'Votre client est remboursé automatiquement.' : null)
      setRejecting(null); load(); window.dispatchEvent(new CustomEvent('dem-pro:refresh'))
    } catch (e) { notify.error('Refus impossible', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="anim-up" style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>Commandes reçues</h1>
        <div className="muted" style={{ marginTop: 4 }}>Passées par vos clients sur votre lien de commande. Elles arrivent ici en direct.</div>
      </div>

      <div className="anim-up" style={{ display: 'flex', gap: 4, background: '#fff', padding: 4, borderRadius: 12, border: '1px solid var(--p-line)', width: 'fit-content', marginBottom: 18 }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 9, fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
            background: tab === k ? 'var(--p-navy)' : 'transparent', color: tab === k ? '#fff' : 'var(--p-muted)', transition: 'all .18s',
          }}>{label}{all && count(k) > 0 ? ` · ${count(k)}` : ''}</button>
        ))}
      </div>

      {!all ? (
        <div style={{ display: 'grid', gap: 14 }}>{[0, 1].map(i => <Skeleton key={i} h={170} r={18} />)}</div>
      ) : list.length === 0 ? (
        <Card><Empty icon={Inbox} title={tab === 'PENDING' ? 'Aucune commande en attente' : 'Rien ici pour le moment'}
          text={tab === 'PENDING' ? 'Partagez votre lien de commande : chaque nouvelle commande apparaît ici, avec une notification.' : null}
          action={tab === 'PENDING' && <Button variant="ghost" onClick={() => navigate('/boutique')}>Voir mon lien de commande</Button>} /></Card>
      ) : (
        <div style={{ display: 'grid', gap: 14 }} className="stagger">
          {list.map(r => (
            <Card key={r.id} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 16, padding: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>{r.customerName || 'Client'}</span>
                    {r.paidAt ? <Chip color="#16a34a"><BadgeCheck size={12} /> Payée en ligne</Chip> : <Chip color="#d97706"><Clock size={12} /> Paiement à la livraison</Chip>}
                    <span className="muted" style={{ fontSize: 12.5 }}>{timeAgo(r.createdAt)}</span>
                  </div>
                  <div style={{ display: 'grid', gap: 6, marginTop: 10, fontSize: 13.5 }}>
                    <span style={{ display: 'flex', gap: 8 }}><Phone size={15} color="var(--p-cyan-2)" /> {phoneFmt(r.customerPhone)}</span>
                    <span style={{ display: 'flex', gap: 8 }}><MapPin size={15} color="var(--p-cyan-2)" /> {r.deliveryAddress}{r.landmark ? ` · ${r.landmark}` : ''}</span>
                    {r.notes && <span style={{ display: 'flex', gap: 8 }}><StickyNote size={15} color="var(--p-cyan-2)" /> {r.notes}</span>}
                  </div>
                </div>
                <div style={{ flex: '1 1 260px', background: 'var(--p-soft)', borderRadius: 14, padding: 14 }}>
                  {(r.items ?? []).map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 0', fontSize: 13.5 }}>
                      {it.image ? <img src={it.image} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'cover' }} /> : <span style={{ width: 30, height: 30, borderRadius: 8, background: '#e3f8fc', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#7fb8d6', fontSize: 12 }}>{it.name?.charAt(0)}</span>}
                      <span style={{ flex: 1 }}>{it.name} <span className="muted">×{it.quantity}</span></span>
                      <span className="num" style={{ fontWeight: 700 }}>{fcfa((it.price ?? 0) * (it.quantity ?? 1))}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #d6e1ee', marginTop: 8, paddingTop: 8 }}>
                    <span style={{ fontWeight: 800 }}>Articles</span><span className="num" style={{ fontWeight: 800 }}>{fcfa(r.productAmount ?? r.total)}</span>
                  </div>
                </div>
              </div>
              {(r.status ?? 'PENDING') === 'PENDING' ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--p-line)', background: 'var(--p-soft)' }}>
                  <Button variant="ghost" icon={XCircle} onClick={() => setRejecting(r)}>Refuser</Button>
                  <Button icon={CheckCircle2} onClick={() => navigate(`/livraisons/nouvelle?commande=${r.id}`)}>Valider et lancer la livraison</Button>
                </div>
              ) : (
                <div className="muted" style={{ padding: '10px 20px', borderTop: '1px solid var(--p-line)', fontSize: 12.5 }}>
                  {r.status === 'CONFIRMED' ? 'Validée' : 'Refusée'}{r.handledByName ? ` par ${r.handledByName}` : ''} · {dateTime(r.createdAt)}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Refuser cette commande ?"
        subtitle={rejecting?.paidAt ? 'Elle a été payée en ligne : votre client est remboursé automatiquement.' : 'Votre client ne sera pas livré.'}
        footer={<><Button variant="ghost" onClick={() => setRejecting(null)}>Annuler</Button><Button variant="danger" loading={busy} onClick={reject}>Refuser la commande</Button></>} />
    </div>
  )
}
