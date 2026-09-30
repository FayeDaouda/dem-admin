import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import { glassSolid, glassInput } from '../../lib/glassStyles'
import { formatCount } from '../../lib/format'

// ── Catalogue du commerçant modifié par le support (onglet Boutique) ─────────
// POST/PATCH/DELETE /admin/dem-pro/:id/products[/:productId]
// (admin.dem-pro-catalogue.service.js) — mêmes règles que l'app du commerçant :
// limite de produits de son offre, catalogues seulement si son offre les
// inclut. Un catalogue = un nom partagé par des produits : taper un nouveau
// nom le crée, retirer son dernier produit le fait disparaître.

const CATALOGUES_DATALIST = 'dem-pro-catalogues'

// `product` absent = ajout (catalogue pré-rempli avec `defaultCategory`).
export function ProductFormModal({ accountId, product, defaultCategory, categories, sites, limits, onClose, onSaved }) {
  const isEdit = !!product
  const [form, setForm] = useState({
    name:         product?.name ?? '',
    category:     (isEdit ? product.category : limits.cataloguesAllowed ? defaultCategory : null) ?? '',
    defaultPrice: product?.defaultPrice != null ? String(product.defaultPrice) : '',
    quantity:     product?.quantity != null ? String(product.quantity) : '',
    proAddressId: product?.proAddressId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const typed = form.category.trim()
  const existing = categories.find(c => c.name.toLowerCase() === typed.toLowerCase())
  const createsCatalogue = typed !== '' && !existing && typed !== (product?.category ?? '').trim()

  async function save() {
    const name = form.name.trim()
    if (name.length < 2) { setError('Le nom du produit doit contenir au moins 2 caractères.'); return }
    const price = form.defaultPrice.trim() === '' ? null : Number(form.defaultPrice.replace(',', '.'))
    if (price !== null && !(price > 0)) { setError('Le prix doit être un nombre positif (ou laissé vide).'); return }
    const quantity = form.quantity.trim() === '' ? null : Number(form.quantity)
    if (quantity !== null && !(Number.isInteger(quantity) && quantity >= 0)) { setError('Le stock doit être un nombre entier positif ou nul (ou laissé vide).'); return }

    const body = { name, defaultPrice: price, quantity, proAddressId: form.proAddressId || null }
    // Offre sans catalogues : le champ n'est pas modifiable, on ne l'envoie pas
    if (limits.cataloguesAllowed) body.category = typed || null

    setSaving(true); setError('')
    try {
      if (isEdit) await api.patch(`/admin/dem-pro/${accountId}/products/${product.id}`, body)
      else        await api.post(`/admin/dem-pro/${accountId}/products`, body)
      onSaved(isEdit ? 'Produit mis à jour.' : 'Produit ajouté au catalogue.')
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
      setSaving(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h2>
          <button onClick={onClose} style={btnIcon} title="Fermer"><X size={16} /></button>
        </div>

        <Field label="Nom du produit *">
          <input value={form.name} onChange={e => set('name', e.target.value)} maxLength={80} placeholder="Ex : Ceebu jën, T-shirt col rond M" style={glassInput} autoFocus />
        </Field>

        <Field
          label="Catalogue"
          hint={!limits.cataloguesAllowed
            ? "L'offre de ce commerçant n'inclut pas les catalogues : ils ne s'afficheraient pas dans son application."
            : createsCatalogue
              ? `Nouveau catalogue « ${typed} » — il sera créé avec ce produit.`
              : `Choisissez un catalogue existant ou tapez un nouveau nom pour le créer. Vide = sans catalogue.${limits.maxCatalogues != null ? ` Maximum de l'offre : ${formatCount(limits.maxCatalogues)} catalogue${limits.maxCatalogues > 1 ? 's' : ''}.` : ''}`}
          hintColor={createsCatalogue ? 'var(--primary)' : undefined}
        >
          <input
            value={form.category}
            onChange={e => set('category', e.target.value)}
            list={CATALOGUES_DATALIST}
            maxLength={40}
            disabled={!limits.cataloguesAllowed}
            placeholder={limits.cataloguesAllowed ? 'Ex : Boissons, Plats' : 'Non disponible sur cette offre'}
            style={{ ...glassInput, ...(!limits.cataloguesAllowed && { opacity: 0.6, cursor: 'not-allowed' }) }}
          />
          <datalist id={CATALOGUES_DATALIST}>
            {categories.map(c => <option key={c.name} value={c.name} />)}
          </datalist>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prix par défaut (FCFA)" hint="Vide = saisi à chaque commande.">
            <input value={form.defaultPrice} onChange={e => set('defaultPrice', e.target.value)} inputMode="decimal" placeholder="Ex : 2500" style={glassInput} />
          </Field>
          <Field label="Stock" hint="Vide = stock non suivi.">
            <input value={form.quantity} onChange={e => set('quantity', e.target.value)} inputMode="numeric" placeholder="Non suivi" style={glassInput} />
          </Field>
        </div>

        <Field label="Point de vente">
          <select value={form.proAddressId} onChange={e => set('proAddressId', e.target.value)} style={glassInput}>
            <option value="">Tous les points de vente</option>
            {sites.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteProductModal({ accountId, product, isLastOfCatalogue, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError]       = useState('')

  async function confirm() {
    setDeleting(true); setError('')
    try {
      await api.delete(`/admin/dem-pro/${accountId}/products/${product.id}`)
      onDeleted('Produit supprimé du catalogue.')
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
      setDeleting(false)
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...box, width: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <AlertTriangle size={20} color="var(--danger)" />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Supprimer « {product.name} » ?</h2>
        </div>
        <ul style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 6px', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Le produit disparaît de l'application du commerçant et de sa boutique en ligne.</li>
          <li>Les commandes déjà passées ne changent pas.</li>
          {isLastOfCatalogue && <li>C'est le dernier produit du catalogue « {product.category} » : ce catalogue disparaîtra aussi.</li>}
        </ul>
        {error && <div style={errorStyle}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} style={btnOutline}>Annuler</button>
          <button onClick={confirm} disabled={deleting} style={{ ...btnDanger, opacity: deleting ? 0.7 : 1 }}>
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, hint, hintColor, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: hintColor ?? 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

// Au-dessus de la fiche commerçant (zIndex 300) ; fond opaque pour rester lisible
const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }
const box        = { ...glassSolid, width: 480, maxWidth: '92vw', borderRadius: 16, padding: 24 }
const btnOutline = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnDanger  = { padding: '8px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const errorStyle = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
