import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MapPin, Package, Share2, Bike, X, ArrowRight } from 'lucide-react'
import proApi from '../lib/proApi'
import { orderLink } from '../lib/format'
import { useNotify } from './notifyContext'
import { Corners, IconButton, Skeleton } from './ui'
import { PREF, readPref, writePref, markShopShared } from './prefs'

// Liste de démarrage d'un compte récent (tableau de bord) : 4 étapes,
// chacune cochée d'après les données réelles du compte :
//  1. adresse de retrait  → GET /dem-pro/addresses
//  2. premier produit     → GET /dem-pro/products
//  3. lien partagé        → une commande reçue par le lien, ou le lien
//                           partagé / copié depuis ce navigateur
//  4. première livraison  → livraisons du compte (déjà lues par le tableau de bord)
// Masquable (mémorisé dans ce navigateur). Réservée au responsable du compte.
const RECENT_DAYS = 45

export default function StartChecklist({ user, orders }) {
  const notify = useNotify()
  const uid = user?.id
  const [hidden, setHidden] = useState(() => readPref(PREF.startHidden(uid)) === '1')
  const [shared, setShared] = useState(() => readPref(PREF.shopShared(uid)) === '1')
  const [facts, setFacts] = useState(null) // { addresses, products, requests }

  const [now] = useState(() => Date.now())
  const createdAt = user?.createdAt ? new Date(user.createdAt).getTime() : null
  const recent = createdAt == null || now - createdAt < RECENT_DAYS * 86_400_000
  const relevant = !hidden && recent

  const load = useCallback(async () => {
    const [a, p, r] = await Promise.allSettled([
      proApi.get('/dem-pro/addresses'),
      proApi.get('/dem-pro/products'),
      proApi.get('/dem-pro/order-requests'),
    ])
    const len = (x) => (x.status === 'fulfilled' && Array.isArray(x.value.data) ? x.value.data.length : null)
    setFacts({ addresses: len(a), products: len(p), requests: len(r) })
  }, [])
  useEffect(() => { if (relevant) load() }, [relevant, load])
  // Retour sur l'onglet (produit ajouté dans un autre onglet…) : relu
  useEffect(() => {
    if (!relevant) return
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    const onShared = () => setShared(readPref(PREF.shopShared(uid)) === '1')
    window.addEventListener('dem-pro:shop-shared', onShared)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('dem-pro:shop-shared', onShared) }
  }, [relevant, load, uid])

  if (!relevant) return null

  const link = uid ? orderLink(uid) : null
  const share = async () => {
    if (!link) return
    const name = user?.proBusinessName || user?.name || 'ma boutique'
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: `Commandez chez ${name} en ligne, livraison par un coursier DEM :`, url: link })
      } else {
        await navigator.clipboard.writeText(link)
        notify.success('Lien copié', 'Collez-le dans WhatsApp, Instagram ou un SMS.')
      }
      markShopShared(uid); setShared(true)
    } catch (e) {
      if (e?.name === 'AbortError') return // partage annulé
      notify.error('Partage impossible', 'Ouvrez Boutique pour copier le lien.')
    }
  }

  const steps = [
    {
      key: 'address', icon: MapPin, done: (facts?.addresses ?? 0) > 0, title: 'Ajouter votre adresse de retrait',
      text: 'Là où les coursiers viennent chercher vos colis. Elle sert aussi au prix de livraison de votre boutique.',
      action: { label: 'Ajouter l’adresse', to: '/compte?onglet=adresses' },
    },
    {
      key: 'product', icon: Package, done: (facts?.products ?? 0) > 0, title: 'Ajouter votre premier produit',
      text: 'Nom, prix et photo : vos clients le voient sur votre boutique en ligne.',
      action: { label: 'Ajouter un produit', to: '/boutique' },
    },
    {
      key: 'share', icon: Share2, done: shared || (facts?.requests ?? 0) > 0, title: 'Partager le lien de votre boutique',
      text: 'Sur WhatsApp, Instagram ou par SMS : vos clients commandent, vous validez, DEM livre.',
      action: { label: navigator.share ? 'Partager le lien' : 'Copier le lien', run: share },
    },
    {
      key: 'delivery', icon: Bike, done: (orders?.length ?? 0) > 0, title: 'Lancer votre première livraison',
      text: 'Un coursier DEM récupère le colis chez vous et le livre à votre client.',
      action: { label: 'Nouvelle livraison', to: '/livraisons/nouvelle' },
    },
  ]
  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length
  const loading = !facts || orders === undefined
  const firstTodo = steps.find(s => !s.done)?.key

  const hide = () => {
    writePref(PREF.startHidden(uid), '1'); setHidden(true)
    notify.info('Liste de démarrage masquée', 'Tout reste accessible depuis le menu.')
  }

  return (
    <section className="card has-corners sc" aria-labelledby="sc-title">
      <Corners />
      <header className="sc-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>Bien démarrer</p>
          <h2 id="sc-title" className="sc-title">
            {allDone ? 'Votre boutique est prête.' : 'Votre boutique en 4 étapes'}
          </h2>
          <p className="muted sc-sub">
            {allDone ? 'Tout est en place : vos clients peuvent commander et vous pouvez livrer.' : `${doneCount} sur ${steps.length} terminée${doneCount > 1 ? 's' : ''}`}
          </p>
        </div>
        <IconButton icon={X} label="Masquer la liste de démarrage" size="sm" variant="plain" onClick={hide} />
      </header>
      <div className="sc-bar" role="progressbar" aria-label="Progression" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}
        aria-valuetext={`${doneCount} étape${doneCount > 1 ? 's' : ''} sur ${steps.length}`}>
        {steps.map(s => <span key={s.key} className={s.done ? 'on' : ''} />)}
      </div>

      <ol className="sc-list">
        {steps.map((s, i) => {
          const Icon = s.icon
          const next = s.key === firstTodo
          return (
            <li key={s.key} className={`sc-step ${s.done ? 'is-done' : ''} ${next ? 'is-next' : ''}`}>
              <span className="sc-check" aria-hidden>{loading && !s.done ? <span className="sc-num">{i + 1}</span> : s.done ? <Check size={14} strokeWidth={3} /> : <span className="sc-num">{i + 1}</span>}</span>
              <div className="sc-body">
                <div className="sc-step-title">
                  <Icon size={15} aria-hidden />
                  <span>{s.title}</span>
                  <span className="sr-only">{s.done ? ' : fait' : ' : à faire'}</span>
                </div>
                {!s.done && <p className="sc-text">{s.text}</p>}
              </div>
              {loading && !s.done ? <Skeleton w={120} h={34} />
                : s.done ? <span className="sc-done">Fait</span>
                : s.action.to
                  ? <Link to={s.action.to} className={`btn btn-sm ${next ? 'btn-primary' : 'btn-ghost'} sc-cta`}>{s.action.label}{next && <ArrowRight size={15} className="arrow" aria-hidden />}</Link>
                  : <button type="button" onClick={s.action.run} className={`btn btn-sm ${next ? 'btn-primary' : 'btn-ghost'} sc-cta`}>{s.action.label}{next && <ArrowRight size={15} className="arrow" aria-hidden />}</button>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
