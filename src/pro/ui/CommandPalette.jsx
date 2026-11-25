import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, Bike, Plus, Route as RouteIcon, Inbox, Store, Users, ChartColumn, Wallet, Plug,
  UserRound, MapPin, Gift, UsersRound, Keyboard, Package, CornerDownLeft, Palette, BadgeCheck,
} from 'lucide-react'
import proApi from '../lib/proApi'
import { dateTime, fcfa, phoneFmt, ORDER_STATUS } from '../lib/format'
import { useProAuth } from '../proAuthContext'
import { Spinner } from './ui'

// Recherche globale (fenêtre « palette de commandes ») : pages, livraisons
// (100 dernières : référence, nom, téléphone, adresse), clients, produits.
// Ouverte par « / », Ctrl+K / Cmd+K ou le champ de la barre du haut.
// Données lues à l'ouverture et gardées une minute (le quota de requêtes du
// serveur est partagé avec l'app mobile du même compte).

const PAGES = [
  { title: 'Tableau de bord', to: '/', icon: LayoutDashboard, area: 'dashboard', words: 'accueil' },
  { title: 'Nouvelle livraison', to: '/livraisons/nouvelle', icon: Plus, key: 'N', words: 'creer envoyer colis course' },
  { title: 'Nouvelle tournée', to: '/tournees/nouvelle', icon: Plus, key: 'T', words: 'creer plusieurs colis groupee' },
  { title: 'Livraisons', to: '/livraisons', icon: Bike, words: 'courses historique suivi' },
  { title: 'Tournées', to: '/tournees', icon: RouteIcon, words: 'groupees' },
  { title: 'Commandes reçues', to: '/commandes', icon: Inbox, words: 'demandes lien boutique accepter' },
  { title: 'Boutique · produits', to: '/boutique', icon: Store, words: 'catalogue articles lien' },
  { title: 'Boutique · apparence', to: '/boutique?onglet=apparence', icon: Palette, words: 'couleur logo banniere' },
  { title: 'Clients', to: '/clients', icon: Users, words: 'reguliers fichier' },
  { title: 'Statistiques', to: '/statistiques', icon: ChartColumn, area: 'dashboard', words: 'chiffres ventes rapport' },
  { title: 'Wallet', to: '/wallet', icon: Wallet, area: 'wallet', words: 'solde retrait argent paiement' },
  { title: 'Compte', to: '/compte', icon: UserRound, words: 'profil reglages' },
  { title: 'Adresses de retrait', to: '/compte?onglet=adresses', icon: MapPin, words: 'point retrait magasin' },
  { title: 'Offre et paiement', to: '/compte?onglet=offre', icon: BadgeCheck, area: 'offers', words: 'abonnement premium business starter' },
  { title: 'Équipe', to: '/compte/equipe', icon: UsersRound, area: 'team', words: 'membres employes gerant' },
  { title: 'API DEM', to: '/compte/api', icon: Plug, area: 'api', words: 'cle webhook site integration' },
  { title: 'Parrainage', to: '/compte/parrainage', icon: Gift, area: 'referral', words: 'inviter code' },
]

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const digits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^221/, '')
const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()

// Score simple : début de mot > contient ; 0 = pas de correspondance
function score(needle, fields) {
  let best = 0
  for (const f of fields) {
    const h = norm(f)
    if (!h) continue
    if (h.startsWith(needle)) best = Math.max(best, 3)
    else if (h.includes(` ${needle}`)) best = Math.max(best, 2)
    else if (h.includes(needle)) best = Math.max(best, 1)
  }
  return best
}

let cache = null // { at, promise }
function loadIndex(canClients) {
  if (cache && Date.now() - cache.at < 60_000 && cache.canClients === canClients) return cache.promise
  const promise = Promise.allSettled([
    proApi.get('/orders/my', { params: { page: 1, limit: 100 } }),
    canClients ? proApi.get('/dem-pro/me/clients') : Promise.resolve({ data: [] }),
    proApi.get('/dem-pro/products'),
  ]).then(([o, c, p]) => ({
    orders: o.status === 'fulfilled' ? (o.value.data?.orders ?? []) : null,
    clients: c.status === 'fulfilled' ? (Array.isArray(c.value.data) ? c.value.data.filter(x => !x.locked) : []) : null,
    products: p.status === 'fulfilled' ? (p.value.data ?? []) : null,
  }))
  cache = { at: Date.now(), promise, canClients }
  promise.then(d => { if (!d.orders && cache?.promise === promise) cache = null })
  return promise
}

export default function CommandPalette({ open, onClose, onHelp }) {
  const { can } = useProAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [data, setData] = useState(null)
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const list = useRef(null)
  const panel = useRef(null)
  const listId = useId()
  const canClients = can('clients')

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    setQ(''); setActive(0)
    let alive = true
    loadIndex(canClients).then(d => { if (alive) setData(d) })
    requestAnimationFrame(() => input.current?.focus())
    return () => { alive = false; prev?.focus?.() }
  }, [open, canClients])

  const groups = useMemo(() => {
    const needle = norm(q.trim())
    const nd = digits(q)
    const pages = PAGES.filter(p => !p.area || can(p.area))
    const actions = [{ title: 'Raccourcis clavier', icon: Keyboard, run: onHelp, key: '?', words: 'aide clavier touches' }]
    const out = []
    if (!needle) {
      out.push({ label: 'Aller à', items: pages.slice(0, 8).map(p => ({ ...p, id: `p-${p.to}` })) })
      if (data?.orders?.length) {
        out.push({ label: 'Livraisons récentes', items: data.orders.slice(0, 5).map(orderItem) })
      }
      out.push({ label: 'Aide', items: actions.map(a => ({ ...a, id: 'a-help' })) })
      return out
    }
    const pageHits = [...pages, ...actions]
      .map(p => ({ p, s: score(needle, [p.title, p.words]) })).filter(x => x.s).sort((a, b) => b.s - a.s)
      .slice(0, 5).map(({ p }) => ({ ...p, id: p.to ? `p-${p.to}` : 'a-help' }))
    if (pageHits.length) out.push({ label: 'Pages', items: pageHits })

    if (data?.orders) {
      const hits = data.orders.map(o => {
        let s = score(needle, [o.receiverName, o.deliveryAddress, o.description, o.driver?.name])
        if (norm(o.id).startsWith(needle.replace(/\s/g, ''))) s = Math.max(s, 4)
        if (nd.length >= 3 && digits(o.receiverPhone).includes(nd)) s = Math.max(s, 3)
        return { o, s }
      }).filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 6).map(({ o }) => orderItem(o))
      if (hits.length) out.push({ label: 'Livraisons', items: hits })
    }
    if (data?.clients) {
      const hits = data.clients.map(c => {
        let s = score(needle, [c.name, c.lastAddress])
        if (nd.length >= 3 && digits(c.phone).includes(nd)) s = Math.max(s, 3)
        return { c, s }
      }).filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 5).map(({ c }) => ({
        id: `c-${c.phone}`, icon: UserRound, title: c.name || phoneFmt(c.phone),
        sub: [c.name ? phoneFmt(c.phone) : null, c.orderCount != null ? `${c.orderCount} livraison${c.orderCount > 1 ? 's' : ''}` : null, c.lastAddress].filter(Boolean).join(' · '),
        to: `/clients?client=${encodeURIComponent(c.phone)}`,
      }))
      if (hits.length) out.push({ label: 'Clients', items: hits })
    }
    if (data?.products) {
      const hits = data.products.map(p => ({ p, s: score(needle, [p.name, p.category]) }))
        .filter(x => x.s).sort((a, b) => b.s - a.s).slice(0, 5).map(({ p }) => ({
          id: `pr-${p.id}`, icon: Package, image: p.image, title: p.name,
          sub: [p.defaultPrice != null ? fcfa(p.defaultPrice) : 'Prix non défini', p.category].filter(Boolean).join(' · '),
          to: '/boutique',
        }))
      if (hits.length) out.push({ label: 'Produits', items: hits })
    }
    return out
  }, [q, data, can, onHelp])

  const flat = useMemo(() => groups.flatMap(g => g.items), [groups])
  const safeActive = Math.min(active, Math.max(0, flat.length - 1))

  useEffect(() => {
    list.current?.querySelector(`[data-index="${safeActive}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [safeActive])

  const choose = useCallback((item) => {
    if (!item) return
    onClose()
    if (item.run) item.run()
    else if (item.to) navigate(item.to)
  }, [navigate, onClose])

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (flat.length ? (Math.min(i, flat.length - 1) + 1) % flat.length : 0)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (flat.length ? (Math.min(i, flat.length - 1) - 1 + flat.length) % flat.length : 0)) }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0) }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(flat.length - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[safeActive]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'Tab') e.preventDefault()
  }

  if (!open) return null
  const loading = !data
  const needle = q.trim()
  const failed = data && !data.orders
  let index = -1

  return createPortal(
    <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
      <div className="cp-scrim" onMouseDown={onClose}>
        <div ref={panel} className="card cp" role="dialog" aria-modal="true" aria-label="Recherche" data-palette
          onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
          <div className="cp-field">
            <Search size={18} aria-hidden />
            <input ref={input} className="cp-input" value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }}
              placeholder="Rechercher une livraison, un client, un produit, une page…"
              role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
              aria-activedescendant={flat.length ? `${listId}-${safeActive}` : undefined}
              autoComplete="off" spellCheck={false} enterKeyHint="go" />
            {loading && <Spinner size={16} />}
            <kbd className="kb-key cp-esc" aria-hidden>Échap</kbd>
          </div>

          <div ref={list} id={listId} role="listbox" aria-label="Résultats" className="cp-list scroll-y">
            {groups.map(g => (
              <div key={g.label} role="group" aria-label={g.label}>
                <div className="cp-group" aria-hidden>{g.label}</div>
                {g.items.map(item => {
                  index++
                  const i = index
                  const Icon = item.icon
                  const on = i === safeActive
                  return (
                    <div key={item.id} id={`${listId}-${i}`} role="option" aria-selected={on} data-index={i}
                      className={`cp-item ${on ? 'is-on' : ''}`}
                      onMouseMove={() => { if (!on) setActive(i) }} onClick={() => choose(item)}>
                      {item.image
                        ? <img src={item.image} alt="" className="cp-thumb" loading="lazy" />
                        : <span className="cp-ico" aria-hidden>{Icon && <Icon size={16} />}</span>}
                      <span className="cp-text">
                        <span className="cp-title">{item.title}</span>
                        {item.sub && <span className="cp-sub">{item.sub}</span>}
                      </span>
                      {item.badge}
                      {item.key && <kbd className="kb-key" aria-hidden>{item.key}</kbd>}
                      {on && <CornerDownLeft size={14} className="cp-enter" aria-hidden />}
                    </div>
                  )
                })}
              </div>
            ))}
            {needle && !loading && flat.length === 0 && (
              <div className="cp-empty" role="status">
                <strong>Aucun résultat pour « {needle} »</strong>
                <span>Essayez un nom, un numéro de téléphone ou une référence de livraison (8 caractères).</span>
              </div>
            )}
            {failed && <div className="cp-note" role="status">Livraisons indisponibles pour le moment : seules les pages sont proposées.</div>}
          </div>

          <div className="cp-foot" aria-hidden>
            <span><kbd className="kb-key">↑</kbd><kbd className="kb-key">↓</kbd> choisir</span>
            <span><kbd className="kb-key">Entrée</kbd> ouvrir</span>
            <span className="cp-foot-hint">Livraisons : les 100 plus récentes</span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function orderItem(o) {
  const st = ORDER_STATUS[o.status]
  return {
    id: `o-${o.id}`, icon: Bike,
    title: `${o.receiverName || 'Client'}`,
    sub: [shortRef(o.id), phoneFmt(o.receiverPhone), dateTime(o.createdAt)].filter(Boolean).join(' · '),
    badge: st ? <span className="badge cp-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span> : null,
    to: `/livraisons?id=${o.id}`,
  }
}
