import { useState, useEffect } from 'react'
import { Search, CheckCircle } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import AddressField from '../../components/AddressField'

// ── Course saisie pour un client (Responsable de flottes, C3) ──────────────
// Commande reçue par téléphone ou WhatsApp : le client est retrouvé par son
// numéro, sinon créé (nom + téléphone) ; le prix est celui de la grille
// (aperçu, non modifiable) ; la course porte « Créée par … ». Ensuite :
// proposer ou attribuer tout de suite (onDispatch ouvre la fenêtre de dispatch).
export default function ClientOrderModal({ onClose, onCreated, onDispatch }) {
  const [phone, setPhone] = useState('')
  const [lookup, setLookup] = useState(null) // { client } | { error }
  const [looking, setLooking] = useState(false)
  const [clientName, setClientName] = useState('')
  const [pickup, setPickup] = useState(null)
  const [delivery, setDelivery] = useState(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [description, setDescription] = useState('')
  const [estimate, setEstimate] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null) // { order, client, clientCreated }

  async function findClient() {
    if (!phone.trim()) return
    setLooking(true); setLookup(null); setError('')
    try {
      const { data } = await api.get('/admin/client-lookup', { params: { phone: phone.trim() } })
      setLookup({ client: data.client })
      setPhone(data.phone)
    } catch (e) {
      setLookup({ error: e.response?.data?.message ?? 'Recherche impossible.' })
    } finally { setLooking(false) }
  }

  // Aperçu du prix dès que les deux adresses ont une position
  useEffect(() => {
    if (!pickup || !delivery) return
    let alive = true
    api.post('/admin/orders/estimate', {
      pickupLatitude: pickup.lat, pickupLongitude: pickup.lng, deliveryLatitude: delivery.lat, deliveryLongitude: delivery.lng,
    }).then(r => alive && setEstimate(r.data)).catch(() => alive && setEstimate(null))
    return () => { alive = false }
  }, [pickup, delivery])

  const newClient = lookup && !lookup.error && !lookup.client
  const ready = lookup && !lookup.error && (lookup.client || clientName.trim().length >= 2) && pickup && delivery && receiverPhone.trim()

  async function submit(e) {
    e.preventDefault()
    if (!ready) return
    setSaving(true); setError('')
    try {
      const { data } = await api.post('/admin/orders', {
        clientPhone: phone, clientName: newClient ? clientName.trim() : '',
        pickupAddress: pickup.address, pickupLatitude: pickup.lat, pickupLongitude: pickup.lng,
        deliveryAddress: delivery.address, deliveryLatitude: delivery.lat, deliveryLongitude: delivery.lng,
        receiverName: receiverName.trim(), receiverPhone: receiverPhone.trim(), description: description.trim(),
      })
      setCreated(data)
      onCreated?.(data)
    } catch (err) {
      setError(err.response?.data?.message ?? 'Création impossible.')
    } finally { setSaving(false) }
  }

  if (created) {
    const o = created.order
    return (
      <div style={overlay} onClick={onClose}>
        <div style={box} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#15803d', fontWeight: 700, fontSize: 15 }}>
            <CheckCircle size={18} /> Course {o.id.slice(0, 8).toUpperCase()} enregistrée
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 16px' }}>
            {created.clientCreated ? `Client créé : ${created.client.name}. ` : `Client : ${created.client.name ?? created.client.phone}. `}
            Prix : {((o.price ?? 0) + (o.demFee ?? 0)).toLocaleString('fr-FR')} F, payé à la livraison. La recherche automatique d'un coursier a démarré.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={btnOutline}>Fermer</button>
            <button onClick={() => onDispatch({ ...o, driver: null })} style={btnPrimary}>Proposer / attribuer maintenant</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlay} onClick={() => !saving && onClose()}>
      <form style={box} onClick={e => e.stopPropagation()} onSubmit={submit}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>Nouvelle course client</h2>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
          Commande reçue par téléphone ou WhatsApp. Le prix est celui de la grille ; la course portera « Créée par » votre nom.
        </p>

        <label style={labelStyle}>Téléphone du client *</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={phone} onChange={e => { setPhone(e.target.value); setLookup(null) }} placeholder="77 123 45 67" style={inputStyle}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); findClient() } }} />
          <button type="button" onClick={findClient} disabled={looking || !phone.trim()} style={btnOutline}><Search size={13} /> {looking ? '…' : 'Chercher'}</button>
        </div>
        {lookup?.error && <div style={errorLine}>{lookup.error}</div>}
        {lookup?.client && <div style={{ fontSize: 12.5, color: '#15803d', marginTop: 4, fontWeight: 600 }}>Client trouvé : {lookup.client.name ?? lookup.client.phone}</div>}
        {newClient && (
          <div style={{ marginTop: 8 }}>
            <label style={labelStyle}>Nouveau client : son nom *</label>
            <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Awa Diop" style={inputStyle} />
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          <AddressField label="Retrait (où le coursier prend le colis) *" value={pickup} onChange={setPickup} placeholder="Quartier, rue, repère…" />
          <AddressField label="Livraison *" value={delivery} onChange={setDelivery} placeholder="Quartier, rue, repère…" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Destinataire</label>
              <input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Nom" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone du destinataire *</label>
              <input value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} placeholder="77 …" style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Colis / instructions</label>
            <input value={description} onChange={e => setDescription(e.target.value)} maxLength={500} placeholder="Ce que le coursier transporte, repères…" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--surface2)', fontSize: 13 }}>
          {estimate && pickup && delivery ? <><strong>Prix : {estimate.totalClient.toLocaleString('fr-FR')} F</strong> <span style={{ color: 'var(--text-muted)' }}>· grille, payé à la livraison</span></>
            : <span style={{ color: 'var(--text-muted)' }}>Le prix s'affiche une fois les deux adresses choisies.</span>}
        </div>

        {error && <div style={errorLine}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnOutline}>Annuler</button>
          <button type="submit" disabled={!ready || saving} style={{ ...btnPrimary, opacity: !ready || saving ? 0.6 : 1 }}>{saving ? 'Création…' : 'Créer la course'}</button>
        </div>
      </form>
    </div>
  )
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }
const box        = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '22px 26px', width: 520, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }
const inputStyle = { ...glassInput, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }
const errorLine  = { fontSize: 12, color: '#dc2626', marginTop: 6 }
const btnOutline = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnPrimary = { padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
