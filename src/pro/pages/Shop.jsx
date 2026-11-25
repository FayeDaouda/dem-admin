import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Plus, Search, Copy, Check, Pencil, Trash2, ImagePlus, Lock, Package, LayoutGrid, List, MoreHorizontal,
  Star, StarOff, QrCode, Download, Eye, MapPin, Clock, Megaphone, ImageOff, X,
} from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { fcfa, orderLink } from '../lib/format'
import { Button, Card, Chip, Corners, Empty, ErrorState, IconButton, Modal, PageHeader, Segmented, Skeleton } from '../ui/ui'
import { useNotify } from '../ui/notifyContext'
import { useLiveRefresh } from '../lib/useLiveRefresh'

// Boutique : le catalogue (mêmes produits que l'app), le lien de commande à
// partager, et l'apparence de la boutique publique (personnalisation).

// Palette fermée, mêmes clés que le serveur (dem_pro.shop.js)
const ACCENTS = {
  dem: ['DEM', '#0086C8'], ocean: ['Océan', '#1D4ED8'], emerald: ['Émeraude', '#047857'],
  terracotta: ['Terracotta', '#C2410C'], gold: ['Or', '#A16207'], rose: ['Rose', '#BE185D'],
  violet: ['Violet', '#6D28D9'], charcoal: ['Anthracite', '#111827'],
}
const DAYS = [['mon', 'Lundi'], ['tue', 'Mardi'], ['wed', 'Mercredi'], ['thu', 'Jeudi'], ['fri', 'Vendredi'], ['sat', 'Samedi'], ['sun', 'Dimanche']]
const LIMITS = { tagline: 60, description: 280, area: 60, announcement: 100, pauseMessage: 120 }
const MAX_FEATURED = 4

const fetchProducts = () => proApi.get('/dem-pro/products').then(r => r.data ?? [])
// GET /dem-pro/me/shop : 404 tant que le serveur n'a pas la personnalisation
const fetchShop = () => proApi.get('/dem-pro/me/shop').then(
  r => ({ status: 'ok', data: r.data?.shop ?? r.data }),
  e => ({ status: e?.response?.status === 404 ? 'unavailable' : 'error' }),
)

const errCode = (e) => e?.response?.data?.code

export default function Shop() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') === 'apparence' ? 'apparence' : 'produits'
  const setTab = (t) => setParams(t === 'apparence' ? { onglet: 'apparence' } : {}, { replace: true })

  const [products, setProducts] = useState(null) // null = chargement, 'error'
  const [shop, setShop] = useState({ status: 'loading' })
  const [editing, setEditing] = useState(null) // produit, ou {} pour un nouveau

  useEffect(() => {
    let alive = true
    fetchProducts().then(p => alive && setProducts(p), () => alive && setProducts('error'))
    fetchShop().then(s => alive && setShop(s))
    return () => { alive = false }
  }, [])

  const reloadProducts = useCallback(() => fetchProducts().then(setProducts, () => setProducts(p => (Array.isArray(p) ? p : 'error'))), [])
  const reloadShop = useCallback(() => fetchShop().then(s => setShop(prev => (s.status === 'error' && prev.status === 'ok' ? prev : s))), [])
  useLiveRefresh(reloadProducts)

  const list = Array.isArray(products) ? products : []
  const featuredIds = useMemo(() => (shop.status === 'ok' ? shop.data?.featuredProductIds ?? [] : []), [shop])

  // Mettre / retirer à la une depuis le catalogue (4 au plus)
  const toggleFeatured = async (p) => {
    const on = featuredIds.includes(p.id)
    if (!on && featuredIds.length >= MAX_FEATURED) {
      notify.error('4 produits à la une au maximum', 'Retirez-en un avant d\'en ajouter un autre.')
      return
    }
    const next = on ? featuredIds.filter(id => id !== p.id) : [...featuredIds, p.id]
    try {
      const r = await proApi.patch('/dem-pro/me/shop', { featuredProductIds: next })
      setShop({ status: 'ok', data: r.data?.shop ?? r.data })
      notify.success(on ? 'Retiré de la une' : 'Mis à la une', on ? null : 'Il apparaît en premier sur votre boutique.')
    } catch (e) { notify.error('Modification impossible', errMsg(e)) }
  }

  const count = list.length
  const description = products === null ? 'Chargement du catalogue…'
    : `${count} produit${count > 1 ? 's' : ''}${featuredIds.length ? ` · ${featuredIds.length} à la une` : ''}`

  return (
    <div>
      <PageHeader eyebrow="Boutique" title={<>Votre boutique<span className="dot">.</span></>} description={description}
        actions={tab === 'produits'
          ? <Button icon={Plus} onClick={() => setEditing({})}>Ajouter un produit</Button>
          : <Button variant="ghost" href={user?.id ? orderLink(user.id) : undefined} target="_blank" rel="noopener noreferrer" arrow="ne">Voir ma boutique</Button>} />

      <div className="sp-tabs" role="tablist" aria-label="Boutique">
        <button type="button" role="tab" className="dl-tab" aria-selected={tab === 'produits'} onClick={() => setTab('produits')}>Produits</button>
        <button type="button" role="tab" className="dl-tab" aria-selected={tab === 'apparence'} onClick={() => setTab('apparence')}>Apparence et paiement</button>
      </div>

      {tab === 'produits' ? (
        <ProductsTab products={products} featuredIds={featuredIds} canFeature={shop.status === 'ok'}
          onAdd={() => setEditing({})} onEdit={setEditing} onToggleFeatured={toggleFeatured} onReload={reloadProducts} />
      ) : (
        <AppearanceTab shop={shop} setShop={setShop} reloadShop={reloadShop} products={list} />
      )}

      {editing && (
        <ProductModal key={editing.id ?? 'new'} product={editing} categories={[...new Set(list.map(p => p.category).filter(Boolean))].sort()}
          // Fermeture après un produit créé sans sa photo : la liste le montre quand même
          onClose={() => { setEditing(null); reloadProducts() }} onSaved={() => { setEditing(null); reloadProducts() }} />
      )}
    </div>
  )
}

// ═══ Onglet Produits ═════════════════════════════════════════════════════════
function ProductsTab({ products, featuredIds, canFeature, onAdd, onEdit, onToggleFeatured, onReload }) {
  const notify = useNotify()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [view, setView] = useState(() => { try { return localStorage.getItem('dem_pro_shop_view') || 'grid' } catch { return 'grid' } })
  const [menuId, setMenuId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const changeView = (v) => { setView(v); try { localStorage.setItem('dem_pro_shop_view', v) } catch { /* navigation privée */ } }

  useEffect(() => {
    if (!menuId) return
    const onDown = (e) => { if (!e.target.closest?.('.dl-menu-wrap')) setMenuId(null) }
    const onKey = (e) => e.key === 'Escape' && setMenuId(null)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuId])

  const all = useMemo(() => (Array.isArray(products) ? products : []), [products])
  const categories = useMemo(() => [...new Set(all.map(p => p.category).filter(Boolean))].sort(), [all])
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    const rank = (p) => { const i = featuredIds.indexOf(p.id); return i === -1 ? 99 : i }
    return all
      .filter(p => (!cat || p.category === cat) && (!n || p.name.toLowerCase().includes(n)))
      .sort((a, b) => rank(a) - rank(b))
  }, [all, q, cat, featuredIds])

  const remove = async () => {
    setBusy(true)
    try {
      await proApi.delete(`/dem-pro/products/${deleting.id}`)
      notify.success('Produit supprimé')
      setDeleting(null); onReload()
    } catch (e) { notify.error('Suppression impossible', errMsg(e)) } finally { setBusy(false) }
  }

  const menu = (p) => (
    <ProductMenu product={p} open={menuId === p.id} featured={featuredIds.includes(p.id)} canFeature={canFeature}
      onToggle={() => setMenuId(id => (id === p.id ? null : p.id))}
      onEdit={() => { setMenuId(null); onEdit(p) }}
      onFeature={() => { setMenuId(null); onToggleFeatured(p) }}
      onDelete={() => { setMenuId(null); setDeleting(p) }} />
  )

  return (
    <>
      <ShareCard />

      {products === 'error' ? (
        <Card><ErrorState title="Impossible de charger votre catalogue" onRetry={onReload} /></Card>
      ) : (
        <>
          <div className="sp-tools">
            <label className="dl-search sp-search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Rechercher un produit</span>
              <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un produit" />
            </label>
            {categories.length > 0 && (
              <div className="sp-cats" role="group" aria-label="Catégories">
                <Chip onClick={() => setCat('')} selected={!cat}>Toutes</Chip>
                {categories.map(c => <Chip key={c} onClick={() => setCat(c)} selected={cat === c}>{c}</Chip>)}
              </div>
            )}
            <div className="sp-view">
              <Segmented label="Affichage" value={view} onChange={changeView}
                options={[['grid', 'Grille', LayoutGrid], ['list', 'Liste', List]]} />
            </div>
          </div>

          {products === null ? (
            <div className="sp-grid">{[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={280} />)}</div>
          ) : all.length === 0 ? (
            <Card><Empty icon={Package} title="Votre catalogue est vide"
              text="Ajoutez vos produits avec une photo et un prix : ils apparaissent sur votre boutique en ligne et dans l'application."
              action={<Button icon={Plus} onClick={onAdd}>Ajouter un produit</Button>} /></Card>
          ) : list.length === 0 ? (
            <Card><Empty icon={Search} title="Aucun produit ne correspond"
              action={<Button variant="ghost" size="sm" onClick={() => { setQ(''); setCat('') }}>Effacer les filtres</Button>} /></Card>
          ) : view === 'grid' ? (
            <div className="sp-grid">
              {list.map(p => (
                <article key={p.id} className="card sp-card">
                  <button type="button" className="sp-card-main" onClick={() => onEdit(p)} aria-label={`Modifier ${p.name}`}>
                    <ProductThumb p={p} />
                    <div className="sp-card-body">
                      <div className="sp-card-name">{p.name}</div>
                      <div className="sp-card-meta">
                        <span className="num sp-price">{p.defaultPrice != null ? fcfa(p.defaultPrice) : 'Prix non défini'}</span>
                        {p.category && <span className="sp-cat">{p.category}</span>}
                      </div>
                      <div className="muted sp-stock">{stockLabel(p)}</div>
                    </div>
                  </button>
                  {featuredIds.includes(p.id) && <span className="sp-badge"><Star size={11} aria-hidden /> À la une</span>}
                  <div className="sp-card-menu">{menu(p)}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className="card sp-table-wrap">
              <table className="sp-table">
                <thead>
                  <tr>
                    <th scope="col" className="c-photo"><span className="sr-only">Photo</span></th>
                    <th scope="col">Produit</th>
                    <th scope="col" className="c-cat">Catégorie</th>
                    <th scope="col" className="num-col">Prix</th>
                    <th scope="col" className="c-stock">Stock</th>
                    <th scope="col" className="c-menu"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(p => (
                    <tr key={p.id} className="row-hover" tabIndex={0} onClick={() => onEdit(p)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onEdit(p) }}>
                      <td className="c-photo"><span className="sp-mini" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>{!p.image && <Package size={16} aria-hidden />}</span></td>
                      <td>
                        <div className="sp-row-name">{p.name}</div>
                        {featuredIds.includes(p.id) && <div className="sp-row-feat"><Star size={11} aria-hidden /> À la une</div>}
                      </td>
                      <td className="c-cat">{p.category ? <span className="sp-cat">{p.category}</span> : <span className="muted">—</span>}</td>
                      <td className="num-col num">{p.defaultPrice != null ? fcfa(p.defaultPrice) : '—'}</td>
                      <td className="c-stock muted">{stockLabel(p)}</td>
                      <td className="c-menu" onClick={e => e.stopPropagation()}>{menu(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Modal open={!!deleting} onClose={() => !busy && setDeleting(null)} title={`Supprimer « ${deleting?.name ?? ''} » ?`}
        subtitle="Il disparaît du catalogue et de votre boutique en ligne. Les commandes passées ne changent pas."
        footer={<>
          <Button variant="ghost" onClick={() => setDeleting(null)} disabled={busy}>Garder le produit</Button>
          <Button variant="danger" loading={busy} onClick={remove}>Supprimer</Button>
        </>} />
    </>
  )
}

const stockLabel = (p) => (p.quantity == null ? 'Stock non suivi' : p.quantity <= 0 ? 'Épuisé' : `${p.quantity} en stock`)

function ProductThumb({ p }) {
  return (
    <div className="sp-thumb" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>
      {!p.image && <span className="sp-thumb-empty"><ImagePlus size={22} aria-hidden />Ajouter une photo</span>}
      {p.locked && <span className="sp-locked"><Lock size={16} aria-hidden />Au-delà de votre offre</span>}
    </div>
  )
}

function ProductMenu({ product: p, open, featured, canFeature, onToggle, onEdit, onFeature, onDelete }) {
  return (
    <div className="dl-menu-wrap">
      <IconButton icon={MoreHorizontal} label={`Actions pour ${p.name}`} size="sm" variant="plain"
        aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle() }} />
      {open && (
        <div className="dl-menu" role="menu">
          <button role="menuitem" type="button" onClick={onEdit}><Pencil size={15} aria-hidden /> Modifier</button>
          {canFeature && (
            <button role="menuitem" type="button" onClick={onFeature}>
              {featured ? <><StarOff size={15} aria-hidden /> Retirer de la une</> : <><Star size={15} aria-hidden /> Mettre à la une</>}
            </button>
          )}
          <span className="dl-menu-sep" aria-hidden />
          <button role="menuitem" type="button" className="danger" onClick={onDelete}><Trash2 size={15} aria-hidden /> Supprimer</button>
        </div>
      )}
    </div>
  )
}

// ── Lien de la boutique : copier, ouvrir, WhatsApp, QR code ──────────────────
function ShareCard() {
  const { user } = useProAuth()
  const notify = useNotify()
  const [copied, setCopied] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const link = user?.id ? orderLink(user.id) : ''
  const id = user?.id ?? ''
  const short = link ? link.replace(/^https?:\/\/(www\.)?/, '').replace(id, `${id.slice(0, 4)}…${id.slice(-4)}`) : '…'
  const name = user?.proBusinessName || user?.name || 'ma boutique'
  const wa = `https://wa.me/?text=${encodeURIComponent(`Commandez chez ${name} en ligne, livraison par un coursier DEM : ${link}`)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true); setTimeout(() => setCopied(false), 1800)
    } catch { notify.error('Copie impossible', 'Sélectionnez le lien et copiez-le à la main.') }
  }

  return (
    <div className="card sp-share">
      <div className="sp-share-text">
        <div className="label-caps">Lien de votre boutique</div>
        <div className="muted" style={{ fontSize: 13 }}>Vos clients commandent, vous validez, on livre.</div>
      </div>
      <div className="sp-share-link" title={link}>
        <span className="mono">{short}</span>
        <IconButton icon={copied ? Check : Copy} label={copied ? 'Copié' : 'Copier le lien'} size="sm" variant="plain" onClick={copy} />
      </div>
      <div className="sp-share-actions">
        <Button variant="ghost" size="sm" href={link} target="_blank" rel="noopener noreferrer" arrow="ne">Ouvrir</Button>
        <Button variant="ghost" size="sm" href={wa} target="_blank" rel="noopener noreferrer" icon={WhatsAppIcon}>WhatsApp</Button>
        <Button variant="ghost" size="sm" icon={QrCode} onClick={() => setQrOpen(true)}>QR code</Button>
      </div>
      {qrOpen && <QrModal link={link} name={name} onClose={() => setQrOpen(false)} />}
    </div>
  )
}

function QrModal({ link, name, onClose }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#021520', light: '#ffffff' } })
      .then(url => alive && setSrc(url), () => alive && setSrc('error'))
    return () => { alive = false }
  }, [link])
  const file = `qr-${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'boutique'}.png`
  return (
    <Modal open onClose={onClose} title="QR code de votre boutique" width={440}
      subtitle="À imprimer pour votre comptoir, vos sacs ou vos cartes : vos clients le scannent pour commander."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
        <Button icon={Download} href={typeof src === 'string' && src !== 'error' ? src : undefined} download={file} disabled={!src || src === 'error'}>Télécharger (PNG)</Button>
      </>}>
      <div className="sp-qr">
        {src === null ? <Skeleton w={280} h={280} /> : src === 'error'
          ? <ErrorState compact title="QR code indisponible" text="Réessayez dans un instant." />
          : <img src={src} alt={`QR code du lien ${link}`} width={280} height={280} />}
        <div className="mono muted" style={{ fontSize: 12, wordBreak: 'break-all', textAlign: 'center' }}>{link}</div>
      </div>
    </Modal>
  )
}

function WhatsAppIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88a9.82 9.82 0 0 1 6.99 2.9 9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.41-18.3A11.81 11.81 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.48-8.41" />
    </svg>
  )
}

// ── Fenêtre produit (ajout / modification) ───────────────────────────────────
function ProductModal({ product, categories, onClose, onSaved }) {
  const notify = useNotify()
  // Produit créé mais photo refusée : la fenêtre passe en modification, un
  // nouvel essai ne crée jamais de doublon
  const [savedId, setSavedId] = useState(product.id ?? null)
  const isNew = !savedId
  const [name, setName] = useState(product.name ?? '')
  const [price, setPrice] = useState(product.defaultPrice != null ? String(product.defaultPrice) : '')
  const [category, setCategory] = useState(product.category ?? '')
  const [stock, setStock] = useState(product.quantity != null ? String(product.quantity) : '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(product.image ?? null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const input = useRef(null)

  const pickFile = (f) => {
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { notify.error('Format non pris en charge', 'Choisissez une photo JPG ou PNG.'); return }
    if (f.size > 5 * 1024 * 1024) { notify.error('Image trop lourde', 'Choisissez une photo de moins de 5 Mo.'); return }
    setFile(f); setPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    const body = { name: name.trim(), defaultPrice: price === '' ? null : Number(price), category: category.trim() || null, quantity: stock === '' ? null : Number(stock) }
    const creating = !savedId
    let id = savedId
    try {
      const res = creating ? await proApi.post('/dem-pro/products', body) : await proApi.patch(`/dem-pro/products/${savedId}`, body)
      id = res.data?.id ?? res.data?.product?.id ?? savedId
      if (id) setSavedId(id)
    } catch (e) { notify.error('Enregistrement impossible', errMsg(e)); setBusy(false); return }
    if (file && id) {
      try {
        const fd = new FormData(); fd.append('file', file)
        await proApi.post(`/dem-pro/products/${id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        setFile(null)
      } catch (e) {
        notify.error(creating ? 'Produit ajouté, sans sa photo' : 'Photo non enregistrée', `${errMsg(e)} Réessayez d'enregistrer, ou choisissez une autre photo.`)
        setBusy(false)
        return
      }
    }
    notify.success(creating ? 'Produit ajouté' : 'Produit mis à jour', 'Visible dans l\'application et sur votre boutique en ligne.')
    setBusy(false)
    onSaved()
  }

  const tooShort = name.trim().length < 2
  return (
    <Modal open onClose={() => !busy && onClose()} title={isNew ? 'Nouveau produit' : 'Modifier le produit'} width={620}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Annuler</Button>
        <Button loading={busy} disabled={tooShort} onClick={save}>{isNew ? 'Ajouter le produit' : 'Enregistrer'}</Button>
      </>}>
      <div className="sp-form">
        <div className={`sp-drop ${drag ? 'is-drag' : ''}`} role="button" tabIndex={0}
          aria-label={preview ? 'Changer la photo' : 'Ajouter une photo'}
          onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
          style={preview ? { backgroundImage: `url(${preview})` } : undefined}>
          {!preview && <span className="sp-drop-empty"><ImagePlus size={24} aria-hidden /><strong>Ajouter une photo</strong><span>JPG ou PNG, 5 Mo max. Glissez-la ici ou cliquez.</span></span>}
          {preview && <span className="sp-drop-change"><ImagePlus size={14} aria-hidden /> Changer la photo</span>}
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => pickFile(e.target.files?.[0])} />
        </div>
        <div className="sp-fields">
          <label className="field sp-full"><span>Nom</span>
            <input className="input" autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="Ex. Robe wax longue" />
          </label>
          <label className="field"><span>Prix (FCFA)</span>
            <input className="input num" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value.replace(/\D/g, ''))} placeholder="Ex. 15000" />
          </label>
          <label className="field"><span>Stock</span>
            <input className="input num" inputMode="numeric" value={stock} onChange={e => setStock(e.target.value.replace(/\D/g, ''))} placeholder="Non suivi" />
          </label>
          <label className="field sp-full"><span>Catégorie</span>
            <input className="input" list="pro-cats" value={category} maxLength={40} onChange={e => setCategory(e.target.value)} placeholder="Ex. Robes, Accessoires" />
            <datalist id="pro-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <p className="muted sp-full" style={{ margin: 0, fontSize: 12.5 }}>Laissez le stock vide si vous ne le suivez pas : le produit reste toujours disponible.</p>
        </div>
      </div>
    </Modal>
  )
}

// ═══ Onglet Apparence et paiement ════════════════════════════════════════════
const EDITABLE = ['tagline', 'description', 'area', 'accent', 'layout', 'hours', 'open', 'pauseMessage', 'announcement',
  'whatsapp', 'whatsappEnabled', 'instagram', 'tiktok', 'facebook', 'featuredProductIds']

const toDraft = (s) => Object.fromEntries(EDITABLE.map(k => [k, s?.[k] ?? (k === 'featuredProductIds' ? [] : k === 'open' ? true : k === 'accent' ? 'dem' : k === 'layout' ? 'grid' : k === 'whatsappEnabled' ? false : k === 'hours' ? null : '')]))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function AppearanceTab({ shop, setShop, reloadShop, products }) {
  // L'éditeur repart des données serveur seulement après un enregistrement
  // (pas quand la bannière change, pour ne pas perdre la saisie en cours)
  const [ver, setVer] = useState(0)
  if (shop.status === 'loading') return <div className="sp-editor"><Skeleton h={520} /><Skeleton h={520} /></div>
  if (shop.status === 'error') return <Card><ErrorState title="Impossible de charger l'apparence de votre boutique" onRetry={reloadShop} /></Card>
  return (
    <>
      {shop.status === 'unavailable'
        ? <Card className="has-corners sp-soon"><Corners />
          <p className="eyebrow">Bientôt disponible</p>
          <h3 className="section-title" style={{ marginTop: 10 }}>Personnalisez votre boutique en ligne</h3>
          <p className="muted" style={{ margin: '8px 0 0', maxWidth: 560 }}>
            Bannière, couleur, horaires, annonce, réseaux et produits à la une : la personnalisation arrive très bientôt dans votre espace.
          </p>
        </Card>
        : <ShopEditor key={ver} shop={shop.data} products={products}
          onSaved={(data) => { setShop({ status: 'ok', data }); setVer(v => v + 1) }}
          onBanner={(banner) => setShop(s => ({ status: 'ok', data: { ...s.data, banner } }))} />}
      <PaymentSettings />
    </>
  )
}

function ShopEditor({ shop, onSaved, onBanner, products }) {
  const { user } = useProAuth()
  const notify = useNotify()
  const [initial] = useState(() => toDraft(shop))
  const banner = shop.banner ?? null
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [bannerBusy, setBannerBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const dirty = !same(draft, initial)

  const save = async () => {
    const body = Object.fromEntries(EDITABLE.filter(k => !same(draft[k], initial[k])).map(k => [k, draft[k] === '' ? null : draft[k]]))
    if (body.whatsappEnabled && !draft.whatsapp) { notify.error('Numéro WhatsApp manquant', 'Ajoutez le numéro avant de l\'afficher sur votre boutique.'); return }
    setSaving(true)
    try {
      const r = await proApi.patch('/dem-pro/me/shop', body)
      notify.success('Boutique mise à jour', 'Les changements sont en ligne.')
      onSaved(r.data?.shop ?? r.data)
    } catch (e) {
      if (e?.response?.status === 403) { setReadOnly(true); notify.error('Modification réservée', 'Seuls le responsable du compte et les gérants peuvent modifier la boutique.') }
      else if (errCode(e) === 'FEATURED_PRODUCT_UNKNOWN') notify.error('Produit à la une introuvable', 'Un des produits choisis a été supprimé. Mettez à jour la sélection.')
      else if (errCode(e) === 'WHATSAPP_REQUIRED') notify.error('Numéro WhatsApp manquant', 'Ajoutez le numéro avant de l\'afficher sur votre boutique.')
      else notify.error('Enregistrement impossible', errMsg(e))
    } finally { setSaving(false) }
  }

  const uploadBanner = async (f) => {
    if (!f) return
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { notify.error('Format non pris en charge', 'Choisissez une photo JPG ou PNG.'); return }
    if (f.size > 5 * 1024 * 1024) { notify.error('Image trop lourde', 'Choisissez une photo de moins de 5 Mo.'); return }
    setBannerBusy(true)
    try {
      const fd = new FormData(); fd.append('file', f)
      const r = await proApi.post('/dem-pro/me/shop/banner', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onBanner((r.data?.shop ?? r.data)?.banner ?? URL.createObjectURL(f))
      notify.success('Bannière en ligne')
    } catch (e) {
      if (e?.response?.status === 403) setReadOnly(true)
      notify.error('Envoi impossible', errMsg(e))
    } finally { setBannerBusy(false) }
  }
  const removeBanner = async () => {
    setBannerBusy(true)
    try { await proApi.delete('/dem-pro/me/shop/banner'); onBanner(null); notify.success('Bannière retirée') }
    catch (e) { notify.error('Suppression impossible', errMsg(e)) } finally { setBannerBusy(false) }
  }

  const preview = <ShopPreview draft={draft} banner={banner} user={user} products={products} />

  return (
    <>
      {readOnly && <div className="sp-readonly" role="status"><Lock size={15} aria-hidden /> Lecture seule : seuls le responsable du compte et les gérants peuvent modifier la boutique.</div>}
      <div className="sp-editor">
        <fieldset className="sp-sections" disabled={readOnly || saving}>
          <legend className="sr-only">Apparence de la boutique</legend>

          {/* 1. Statut */}
          <Section title="Statut de la boutique" text="En pause, votre boutique reste visible mais n'accepte plus de commande.">
            <Switch checked={draft.open} onChange={v => set('open', v)} label={draft.open ? 'Ouverte aux commandes' : 'En pause'} />
            {!draft.open && <TextField label="Message affiché pendant la pause" k="pauseMessage" draft={draft} set={set} placeholder="Ex. Fermé pour Tabaski, retour lundi" />}
          </Section>

          {/* 2. Identité */}
          <Section title="Identité" text="La bannière et les textes en haut de votre boutique. Le logo est la photo de votre compte.">
            <BannerDrop banner={banner} busy={bannerBusy} onPick={uploadBanner} onRemove={removeBanner} disabled={readOnly} />
            <TextField label="Accroche" k="tagline" draft={draft} set={set} placeholder="Ex. La mode wax livrée chez vous" />
            <TextField label="Description" k="description" draft={draft} set={set} multiline placeholder="Présentez votre boutique en quelques phrases." />
            <TextField label="Quartier affiché" k="area" draft={draft} set={set} placeholder="Ex. Médina, Dakar" icon={MapPin} />
          </Section>

          {/* 3. Couleur */}
          <Section title="Couleur de la boutique" text="Utilisée pour les boutons, les prix et les sélections. Le cadre DEM ne change pas.">
            <div className="sp-swatches" role="radiogroup" aria-label="Couleur de la boutique">
              {Object.entries(ACCENTS).map(([k, [label, hex]]) => (
                <button key={k} type="button" role="radio" aria-checked={draft.accent === k}
                  className={`sp-swatch ${draft.accent === k ? 'is-on has-corners' : ''}`} onClick={() => set('accent', k)}>
                  {draft.accent === k && <Corners />}
                  <span className="sp-swatch-color" style={{ background: hex }} aria-hidden>{draft.accent === k && <Check size={16} color="#fff" />}</span>
                  <span className="sp-swatch-label">{label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* 4. Horaires */}
          <Section title="Horaires d'ouverture" text="Affichés sur votre boutique (« Ouvert · ferme à 19 h »).">
            <HoursEditor hours={draft.hours} onChange={v => set('hours', v)} />
          </Section>

          {/* 5. Annonce */}
          <Section title="Annonce" text="Un bandeau en haut de votre boutique. Laissez vide pour ne rien afficher.">
            <TextField label="Texte de l'annonce" k="announcement" draft={draft} set={set} placeholder="Ex. Nouvelle collection Tabaski disponible" icon={Megaphone} />
          </Section>

          {/* 6. Contact et réseaux */}
          <Section title="Contact et réseaux" text="Vos clients peuvent vous écrire ou vous suivre. Aucun autre numéro n'est affiché.">
            <label className="field"><span>WhatsApp de la boutique</span>
              <input className="input" inputMode="tel" value={draft.whatsapp ?? ''} onChange={e => set('whatsapp', e.target.value)} placeholder="77 123 45 67" />
            </label>
            <label className="sp-check">
              <input type="checkbox" checked={!!draft.whatsappEnabled} onChange={e => set('whatsappEnabled', e.target.checked)} />
              <span>Afficher le bouton WhatsApp sur ma boutique</span>
            </label>
            <div className="sp-socials">
              <label className="field"><span>Instagram</span><input className="input" value={draft.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="@maboutique" /></label>
              <label className="field"><span>TikTok</span><input className="input" value={draft.tiktok ?? ''} onChange={e => set('tiktok', e.target.value)} placeholder="@maboutique" /></label>
              <label className="field"><span>Facebook</span><input className="input" value={draft.facebook ?? ''} onChange={e => set('facebook', e.target.value)} placeholder="Nom de la page" /></label>
            </div>
          </Section>

          {/* 7. À la une */}
          <Section title="Produits à la une" text={`Jusqu'à ${MAX_FEATURED} produits affichés en premier. ${draft.featuredProductIds.length}/${MAX_FEATURED} choisis.`}>
            {products.length === 0
              ? <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Ajoutez d'abord des produits dans l'onglet Produits.</p>
              : <div className="sp-featured">
                {products.map(p => {
                  const on = draft.featuredProductIds.includes(p.id)
                  const full = !on && draft.featuredProductIds.length >= MAX_FEATURED
                  return (
                    <Chip key={p.id} selected={on} disabled={full} icon={on ? Star : undefined}
                      onClick={() => set('featuredProductIds', on ? draft.featuredProductIds.filter(id => id !== p.id) : [...draft.featuredProductIds, p.id])}>
                      {p.name}
                    </Chip>
                  )
                })}
              </div>}
          </Section>

          {/* 8. Affichage */}
          <Section title="Affichage du catalogue" text="Grille pour mettre les photos en avant, liste pour un catalogue long.">
            <Segmented label="Affichage du catalogue" value={draft.layout} onChange={v => set('layout', v)}
              options={[['grid', 'Grille', LayoutGrid], ['list', 'Liste', List]]} />
          </Section>
        </fieldset>

        <aside className="sp-preview-col" aria-label="Aperçu de la boutique">
          <div className="sp-preview-sticky">
            <div className="label-caps" style={{ marginBottom: 12 }}>Aperçu en direct</div>
            {preview}
            <Button variant="ghost" size="sm" href={user?.id ? orderLink(user.id) : undefined} target="_blank" rel="noopener noreferrer" arrow="ne" style={{ marginTop: 14, width: '100%' }}>Voir ma boutique</Button>
          </div>
        </aside>
      </div>

      <button type="button" className="btn btn-ghost sp-preview-fab" onClick={() => setPreviewOpen(true)}><Eye size={16} aria-hidden /> Aperçu</button>
      {previewOpen && (
        <Modal open onClose={() => setPreviewOpen(false)} title="Aperçu de votre boutique" width={420}>
          <div style={{ display: 'grid', placeItems: 'center' }}>{preview}</div>
        </Modal>
      )}

      {dirty && !readOnly && (
        <div className="sp-savebar" role="region" aria-label="Modifications non enregistrées">
          <span>Modifications non enregistrées</span>
          <Button variant="ghost" size="sm" onClick={() => setDraft(initial)} disabled={saving}>Annuler</Button>
          <Button size="sm" loading={saving} onClick={save}>Enregistrer</Button>
        </div>
      )}
    </>
  )
}

function Section({ title, text, children }) {
  return (
    <section className="card sp-sec">
      <div className="sp-sec-head">
        <h3 className="section-title">{title}</h3>
        {text && <p className="muted">{text}</p>}
      </div>
      <div className="sp-sec-body">{children}</div>
    </section>
  )
}

function TextField({ label, k, draft, set, placeholder, multiline, icon }) {
  const Icon = icon
  const max = LIMITS[k]
  const v = draft[k] ?? ''
  return (
    <label className="field sp-text">
      <span className="sp-text-label">{label}<span className="sp-count num" aria-hidden>{v.length}/{max}</span></span>
      <div className={Icon ? 'sp-text-icon' : undefined}>
        {Icon && <Icon size={15} aria-hidden />}
        {multiline
          ? <textarea className="input" rows={3} value={v} maxLength={max} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
          : <input className="input" value={v} maxLength={max} onChange={e => set(k, e.target.value)} placeholder={placeholder} />}
      </div>
    </label>
  )
}

function Switch({ checked, onChange, label, disabled, hint }) {
  return (
    <div className="sp-switch-row">
      <button type="button" role="switch" aria-checked={!!checked} disabled={disabled}
        className={`sp-switch ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="sp-switch-knob" aria-hidden />
        <span className="sr-only">{label}</span>
      </button>
      <div>
        <div className="sp-switch-label" aria-hidden>{label}</div>
        {hint && <div className="muted" style={{ fontSize: 12.5 }}>{hint}</div>}
      </div>
    </div>
  )
}

function BannerDrop({ banner, busy, onPick, onRemove, disabled }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  return (
    <div className="sp-banner-wrap">
      <div className={`sp-banner ${drag ? 'is-drag' : ''}`} role="button" tabIndex={disabled ? -1 : 0}
        aria-label={banner ? 'Changer la bannière' : 'Ajouter une bannière'} aria-disabled={disabled}
        onClick={() => !disabled && !busy && input.current?.click()}
        onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) onPick(e.dataTransfer.files?.[0]) }}
        style={banner ? { backgroundImage: `url(${banner})` } : undefined}>
        {busy ? <span className="sp-banner-empty"><Skeleton w={120} h={12} /></span>
          : !banner && <span className="sp-banner-empty"><ImagePlus size={22} aria-hidden /><strong>Ajouter une bannière</strong><span>Photo horizontale, JPG ou PNG, 5 Mo max.</span></span>}
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => onPick(e.target.files?.[0])} />
      </div>
      {banner && !disabled && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button variant="ghost" size="sm" icon={ImagePlus} onClick={() => input.current?.click()} disabled={busy}>Changer</Button>
          <Button variant="quiet" size="sm" icon={ImageOff} onClick={onRemove} disabled={busy}>Retirer</Button>
        </div>
      )}
    </div>
  )
}

function HoursEditor({ hours, onChange }) {
  const enabled = !!hours
  const get = (d) => hours?.[d]?.[0] ?? null
  const setDay = (d, slot) => onChange({ ...(hours ?? {}), [d]: slot ? [slot] : [] })
  if (!enabled) {
    return (
      <div className="sp-hours-off">
        <span className="muted">Aucun horaire affiché.</span>
        <Button variant="ghost" size="sm" icon={Clock} onClick={() => onChange(Object.fromEntries(DAYS.map(([d]) => [d, d === 'sun' ? [] : [['09:00', '19:00']]])))}>Ajouter mes horaires</Button>
      </div>
    )
  }
  const copyAll = () => { const s = get('mon') ?? ['09:00', '19:00']; onChange(Object.fromEntries(DAYS.map(([d]) => [d, [s]]))) }
  return (
    <div className="sp-hours">
      {DAYS.map(([d, label]) => {
        const slot = get(d)
        return (
          <div key={d} className="sp-hours-row">
            <Switch checked={!!slot} onChange={v => setDay(d, v ? ['09:00', '19:00'] : null)} label={label} />
            {slot ? (
              <div className="sp-hours-times">
                <input className="input num" type="time" aria-label={`${label}, ouverture`} value={slot[0]} onChange={e => setDay(d, [e.target.value, slot[1]])} />
                <span className="muted" aria-hidden>–</span>
                <input className="input num" type="time" aria-label={`${label}, fermeture`} value={slot[1]} onChange={e => setDay(d, [slot[0], e.target.value])} />
              </div>
            ) : <span className="muted sp-hours-closed">Fermé</span>}
          </div>
        )
      })}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="ghost" size="sm" icon={Copy} onClick={copyAll}>Copier le lundi sur tous les jours</Button>
        <Button variant="quiet" size="sm" icon={X} onClick={() => onChange(null)}>Ne pas afficher d'horaires</Button>
      </div>
    </div>
  )
}

// Statut d'ouverture lisible à partir des horaires
function openStatus(hours, now) {
  if (!hours) return null
  const d = new Date(now)
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const slot = hours[keys[d.getDay()]]?.[0]
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const h = (t) => t.replace(':00', ' h').replace(':', ' h ')
  if (slot && hm >= slot[0] && hm < slot[1]) return { open: true, text: `Ouvert · ferme à ${h(slot[1])}` }
  if (slot && hm < slot[0]) return { open: false, text: `Fermé · ouvre à ${h(slot[0])}` }
  return { open: false, text: 'Fermé aujourd\'hui' }
}

function ShopPreview({ draft, banner, user, products }) {
  const [now] = useState(() => Date.now())
  const accent = (ACCENTS[draft.accent] ?? ACCENTS.dem)[1]
  const name = user?.proBusinessName || user?.name || 'Ma boutique'
  const status = draft.open ? openStatus(draft.hours, now) : null
  const featured = draft.featuredProductIds.map(id => products.find(p => p.id === id)).filter(Boolean)
  const shown = (featured.length ? featured : products).slice(0, 4)
  return (
    <div className="sp-phone" style={{ '--sp-accent': accent }}>
      <div className="sp-phone-screen">
        <div className="sp-pv-banner" style={banner ? { backgroundImage: `url(${banner})` } : undefined}>
          {!banner && <span className="sp-pv-pills" aria-hidden><i /><i /></span>}
        </div>
        <div className="sp-pv-head">
          <span className="sp-pv-logo" style={user?.avatar ? { backgroundImage: `url(${user.avatar})` } : undefined}>{!user?.avatar && name.charAt(0).toUpperCase()}</span>
          <div className="sp-pv-name">{name}</div>
          <div className="sp-pv-partner">Partenaire DEM Pro</div>
          {draft.tagline && <div className="sp-pv-tagline">{draft.tagline}</div>}
          {(draft.area || status) && (
            <div className="sp-pv-meta">
              {draft.area && <span><MapPin size={11} aria-hidden /> {draft.area}</span>}
              {status && <span className={status.open ? 'is-open' : ''}><Clock size={11} aria-hidden /> {status.text}</span>}
            </div>
          )}
        </div>
        {!draft.open && <div className="sp-pv-paused">{draft.pauseMessage || 'Boutique en pause : les commandes reprennent bientôt.'}</div>}
        {draft.open && draft.announcement && <div className="sp-pv-announce">{draft.announcement}</div>}
        <div className={draft.layout === 'list' ? 'sp-pv-list' : 'sp-pv-grid'}>
          {shown.length === 0 && <div className="muted" style={{ fontSize: 11, padding: 8 }}>Vos produits apparaîtront ici.</div>}
          {shown.map(p => (
            <div key={p.id} className="sp-pv-item">
              <span className="sp-pv-img" style={p.image ? { backgroundImage: `url(${p.image})` } : undefined}>{!p.image && <Package size={14} aria-hidden />}</span>
              <span className="sp-pv-item-txt">
                <span className="sp-pv-item-name">{p.name}</span>
                <span className="sp-pv-item-price num">{p.defaultPrice != null ? fcfa(p.defaultPrice) : '—'}</span>
              </span>
              <span className="sp-pv-add" aria-hidden><Plus size={12} /></span>
            </div>
          ))}
        </div>
        <div className="sp-pv-cta">{draft.open ? 'Commander' : 'Boutique en pause'}</div>
      </div>
    </div>
  )
}

// ── Paiement des commandes du lien (réglage de la boutique) ──────────────────
const PAY_ERRORS = {
  LINK_PAYMENT_REQUIRED: 'Gardez au moins un mode de paiement actif : vos clients doivent pouvoir payer.',
  LINK_PAY_NOW_NEEDS_IN_APP: 'Le paiement en ligne n\'est pas activé sur votre compte : activez-le dans Compte avant de n\'accepter que le paiement avant.',
}

function PaymentSettings() {
  const notify = useNotify()
  const [plan, setPlan] = useState(null)
  const [pickup, setPickup] = useState(undefined)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let alive = true
    proApi.get('/dem-pro/me/plan').then(r => alive && setPlan(r.data ?? {}), () => alive && setPlan({}))
    proApi.get('/dem-pro/addresses').then(
      r => alive && setPickup((r.data ?? []).find(a => a.isDefault) ?? null),
      () => alive && setPickup(null),
    )
    return () => { alive = false }
  }, [])

  // Serveur sans la nouvelle règle : la section reste masquée
  if (!plan || plan.linkPayNow === undefined || plan.linkPayOnDelivery === undefined) return null

  const toggle = async (key, value) => {
    const other = key === 'linkPayNow' ? plan.linkPayOnDelivery : plan.linkPayNow
    if (!value && !other) { notify.error('Un mode de paiement est nécessaire', PAY_ERRORS.LINK_PAYMENT_REQUIRED); return }
    const prev = plan
    setPlan({ ...plan, [key]: value }); setBusy(key)
    try {
      const r = await proApi.patch('/dem-pro/me/payment-settings', { [key]: value })
      setPlan(p => ({ ...p, ...r.data }))
      notify.success('Réglage enregistré')
    } catch (e) {
      setPlan(prev)
      notify.error('Réglage non enregistré', PAY_ERRORS[errCode(e)] ?? errMsg(e))
    } finally { setBusy(null) }
  }

  return (
    <section className="card sp-sec sp-pay">
      <div className="sp-sec-head">
        <h3 className="section-title">Paiement des commandes</h3>
        <p className="muted">Ce que vos clients peuvent choisir sur votre boutique. Le prix affiché inclut la livraison depuis votre point de retrait par défaut. Enregistré automatiquement.</p>
      </div>
      <div className="sp-sec-body">
        <Switch checked={plan.linkPayNow} disabled={busy !== null} onChange={v => toggle('linkPayNow', v)}
          label="Paiement avant, en ligne" hint="Le client paie articles + livraison par Wave ou Orange Money en commandant." />
        <Switch checked={plan.linkPayOnDelivery} disabled={busy !== null} onChange={v => toggle('linkPayOnDelivery', v)}
          label="Paiement à l'arrivée du coursier" hint="Le client paie à la réception, en ligne ou en espèces." />
        <div className="sp-pickup">
          <MapPin size={15} aria-hidden />
          {pickup === undefined ? <Skeleton w={220} h={12} />
            : pickup
              ? <span>Point de retrait par défaut : <strong>{pickup.label}</strong> · <Link className="link" to="/compte">Modifier</Link></span>
              : <span>Aucun point de retrait par défaut : la livraison sera calculée à la validation. <Link className="link" to="/compte">Définir</Link></span>}
        </div>
      </div>
    </section>
  )
}
