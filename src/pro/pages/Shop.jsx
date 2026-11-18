import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, Store, Copy, Check, ExternalLink, Pencil, Trash2, ImagePlus, Lock, Package, Tag } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { fcfa, orderLink } from '../lib/format'
import { Button, Card, Chip, Empty, Modal, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Boutique : le catalogue de l'app (mêmes produits, mêmes photos) et le
// lien de commande à partager.
export default function Shop() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [products, setProducts] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [editing, setEditing] = useState(null) // produit, ou {} pour un nouveau
  const [deleting, setDeleting] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const r = await proApi.get('/dem-pro/products').catch(() => null)
    setProducts(r?.data ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  useLiveRefresh(load)

  const categories = useMemo(() => [...new Set((products ?? []).map(p => p.category).filter(Boolean))].sort(), [products])
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    return (products ?? []).filter(p => (!cat || p.category === cat) && (!n || p.name.toLowerCase().includes(n)))
  }, [products, q, cat])

  const link = user?.id ? orderLink(user.id) : ''
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
    notify.success('Lien copié', 'Collez-le dans WhatsApp, Instagram, ou votre bio.')
  }

  return (
    <div>
      <div className="anim-up" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.7px', margin: 0 }}>Boutique</h1>
          <div className="muted" style={{ marginTop: 4 }}>Vos produits, visibles par vos clients sur votre lien de commande.</div>
        </div>
        <Button icon={Plus} onClick={() => setEditing({})}>Ajouter un produit</Button>
      </div>

      {/* Lien de commande */}
      <div className="card anim-up" style={{ padding: 24, marginBottom: 20, background: 'linear-gradient(120deg, #04317c 0%, #0671ba 60%, #0cb8de 130%)', color: '#fff', border: 'none', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', right: -60, bottom: -80, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)' }} />
        <div style={{ width: 54, height: 54, borderRadius: 16, background: 'rgba(255,255,255,.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Store size={26} /></div>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Votre lien de commande</div>
          <div style={{ opacity: .8, fontSize: 13.5, marginTop: 2 }}>Vos clients choisissent leurs articles, paient en ligne ou à la livraison, et vous validez.</div>
          <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 11, background: 'rgba(255,255,255,.12)', fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{link}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
          <button className="btn" style={{ background: '#fff', color: '#04317c' }} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copié' : 'Copier'}</button>
          <a className="btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff' }} href={link} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Voir ma boutique</a>
        </div>
      </div>

      {/* Filtres */}
      <div className="anim-up" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <Search size={16} style={{ position: 'absolute', left: 13, top: 15, color: '#9aa8bb' }} />
          <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit" style={{ paddingLeft: 38 }} />
        </div>
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['', ...categories].map(c => (
              <button key={c || 'all'} className="btn btn-sm" onClick={() => setCat(c)} style={{ background: cat === c ? 'var(--p-navy)' : '#fff', color: cat === c ? '#fff' : 'var(--p-ink)', border: '1px solid var(--p-line)' }}>{c || 'Tout'}</button>
            ))}
          </div>
        )}
        <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{products ? `${list.length} produit${list.length > 1 ? 's' : ''}` : ''}</span>
      </div>

      {!products ? (
        <div className="grid-products">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={250} r={18} />)}</div>
      ) : products.length === 0 ? (
        <Card><Empty icon={Package} title="Votre catalogue est vide" text="Ajoutez vos produits avec une photo et un prix : ils apparaissent sur votre lien de commande et dans l'application." action={<Button icon={Plus} onClick={() => setEditing({})}>Ajouter un produit</Button>} /></Card>
      ) : (
        <div className="grid-products stagger">
          {list.map(p => <ProductCard key={p.id} p={p} onEdit={() => setEditing(p)} onDelete={() => setDeleting(p)} />)}
        </div>
      )}

      <ProductModal product={editing} categories={categories} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Supprimer « ${deleting?.name} » ?`} subtitle="Il disparaît du catalogue et du lien de commande. Les commandes passées ne changent pas."
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Annuler</Button><Button variant="danger" onClick={async () => {
          try { await proApi.delete(`/dem-pro/products/${deleting.id}`); notify.success('Produit supprimé'); setDeleting(null); load() } catch (e) { notify.error('Suppression impossible', errMsg(e)) }
        }}>Supprimer</Button></>} />
    </div>
  )
}

function ProductCard({ p, onEdit, onDelete }) {
  return (
    <div className="card card-hover" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ height: 160, background: p.image ? `center / cover no-repeat url(${p.image})` : 'linear-gradient(135deg, #e3f8fc, #e6f0fb)', display: 'grid', placeItems: 'center', position: 'relative' }}>
        {!p.image && <span style={{ fontSize: 42, fontWeight: 800, color: '#9cc9e3' }}>{p.name.charAt(0).toUpperCase()}</span>}
        {p.locked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(2,27,71,.55)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700, fontSize: 12.5, textAlign: 'center', padding: 12 }}><div><Lock size={20} /><br />Au-delà de votre offre</div></div>}
      </div>
      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, lineHeight: 1.3 }}>{p.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, color: 'var(--p-cyan-2)' }} className="num">{p.defaultPrice != null ? fcfa(p.defaultPrice) : 'Prix libre'}</span>
          {p.category && <Chip color="#6d5dfc"><Tag size={11} /> {p.category}</Chip>}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{p.quantity != null ? `${p.quantity} en stock` : 'Stock non suivi'}{p.usageCount ? ` · vendu ${p.usageCount} fois` : ''}</div>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--p-line)' }}>
        <button className="pro-menu-item" style={{ justifyContent: 'center', borderRadius: 0 }} onClick={onEdit}><Pencil size={15} /> Modifier</button>
        <button className="pro-menu-item" style={{ justifyContent: 'center', borderRadius: 0, color: 'var(--p-danger)', borderLeft: '1px solid var(--p-line)' }} onClick={onDelete}><Trash2 size={15} /> Supprimer</button>
      </div>
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSaved }) {
  const notify = useNotify()
  const isNew = product && !product.id
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [stock, setStock] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  useEffect(() => {
    if (!product) return
    setName(product.name ?? ''); setPrice(product.defaultPrice ?? ''); setCategory(product.category ?? '')
    setStock(product.quantity ?? ''); setFile(null); setPreview(product.image ?? null)
  }, [product])

  const pickFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return
    if (f.size > 8 * 1024 * 1024) { notify.error('Image trop lourde', 'Choisissez une photo de moins de 8 Mo.'); return }
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    setBusy(true)
    const body = { name: name.trim(), defaultPrice: price === '' ? null : Number(price), category: category.trim() || null, quantity: stock === '' ? null : Number(stock) }
    try {
      const res = isNew ? await proApi.post('/dem-pro/products', body) : await proApi.patch(`/dem-pro/products/${product.id}`, body)
      const id = res.data?.id ?? res.data?.product?.id ?? product.id
      if (file && id) {
        const fd = new FormData(); fd.append('file', file)
        await proApi.post(`/dem-pro/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      notify.success(isNew ? 'Produit ajouté' : 'Produit mis à jour', 'Déjà visible dans l\'application et sur votre lien.')
      onSaved()
    } catch (e) { notify.error('Enregistrement impossible', errMsg(e)) } finally { setBusy(false) }
  }

  return (
    <Modal open={!!product} onClose={onClose} title={isNew ? 'Nouveau produit' : 'Modifier le produit'} width={560}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button loading={busy} disabled={name.trim().length < 2} onClick={save}>{isNew ? 'Ajouter' : 'Enregistrer'}</Button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 18 }}>
        <div onClick={() => input.current?.click()} onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
          style={{ height: 170, borderRadius: 16, cursor: 'pointer', overflow: 'hidden', display: 'grid', placeItems: 'center', textAlign: 'center',
            border: `2px dashed ${drag ? 'var(--p-cyan)' : '#cfdbea'}`, background: preview ? `center / cover no-repeat url(${preview})` : drag ? '#f0fafd' : 'var(--p-soft)', transition: 'all .18s' }}>
          {!preview && <div className="muted" style={{ fontSize: 12.5, fontWeight: 600, padding: 12 }}><ImagePlus size={26} color="var(--p-cyan-2)" /><br />Glissez une photo<br />ou cliquez</div>}
          <input ref={input} type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files?.[0])} />
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          <label className="field"><span>Nom</span><input className="input" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Robe wax longue" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field"><span>Prix (FCFA)</span><input className="input" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="Ex. 15000" /></label>
            <label className="field"><span>Stock</span><input className="input" inputMode="numeric" value={stock} onChange={e => setStock(e.target.value.replace(/\D/g, ''))} placeholder="Non suivi" /></label>
          </div>
          <label className="field"><span>Catalogue</span>
            <input className="input" list="pro-cats" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ex. Robes, Accessoires" />
            <datalist id="pro-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </label>
        </div>
      </div>
    </Modal>
  )
}
