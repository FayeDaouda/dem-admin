import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, Ban, ChevronRight, GripVertical, Inbox, Truck, Check, ChefHat, PackageCheck } from 'lucide-react'
import { fcfa, timeAgo } from '../lib/format'
import { Button, Skeleton } from './ui'
import { stepOf, STEP_LABEL, PREP, itemCount, articlesTotal, grandTotal, lastAt, nextAction, moveRule } from './requestSteps'
import { PayBadge, StepBadge } from './RequestBadges'

// Commandes reçues en colonnes (comptoir, tablette, ordinateur) :
//   Nouvelles → En cours (Acceptée / En préparation / Prête) → En livraison
//   → Terminées (7 derniers jours).
// Une carte avance par glisser-déposer (souris, glisser natif du navigateur),
// par son bouton d'action ou par le menu « Déplacer » (clavier, toucher).
// Jamais de retour en arrière ; « En livraison » ouvre la création de la
// livraison pré-remplie, comme le bouton « Lancer la livraison ».

const COLUMNS = [
  { key: 'new', title: 'Nouvelles', lanes: [{ id: 'NEW', steps: ['NEW'] }] },
  {
    key: 'active', title: 'En cours', lanes: [
      { id: 'CONFIRMED', label: 'Acceptée', icon: Check, steps: ['CONFIRMED'] },
      { id: 'PREPARING', label: 'En préparation', icon: ChefHat, steps: ['PREPARING'] },
      { id: 'READY', label: 'Prête', icon: PackageCheck, steps: ['READY'] },
    ],
  },
  { key: 'delivery', title: 'En livraison', lanes: [{ id: 'IN_DELIVERY', steps: ['IN_DELIVERY'] }] },
  { key: 'done', title: 'Terminées', hint: '7 derniers jours', lanes: [{ id: 'DONE', steps: ['DELIVERED', 'CANCELLED'] }] },
]
const DONE_DAYS = 7
const DONE_MAX = 12
const LANE_LABEL = { NEW: 'Nouvelles', CONFIRMED: 'Acceptée', PREPARING: 'En préparation', READY: 'Prête', IN_DELIVERY: 'En livraison', DONE: 'Terminées' }
// Libellés courts du bouton d'action d'une carte
const SHORT = { NEW: 'Accepter', CONFIRMED: 'Préparer', PREPARING: 'Prête', READY: 'Livrer' }
const MOVE_TARGETS = ['CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY']
const moveLabel = (step, target) => ({
  CONFIRMED: 'Accepter',
  PREPARING: step === 'NEW' ? 'Accepter et préparer' : 'En préparation',
  READY: step === 'NEW' ? 'Accepter, déjà prête' : 'Prête',
  IN_DELIVERY: 'Lancer la livraison',
}[target])

const ts = (d) => new Date(d ?? 0).getTime()

export default function RequestsBoard({ requests, busyId, openId, onOpen, onMove, onAct, onReject, onShowHistory }) {
  const hintId = useId()
  const [drag, setDrag] = useState(null)   // { id, step }
  const [over, setOver] = useState(null)   // { lane, ok }
  // Horloge du tableau : « il y a 5 min », attente trop longue, colonne
  // Terminées — remis à jour toutes les 30 secondes (tablette du comptoir)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const lanes = useMemo(() => {
    const by = Object.fromEntries(COLUMNS.flatMap(c => c.lanes).map(l => [l.id, []]))
    const since = now - DONE_DAYS * 86_400_000
    for (const r of requests ?? []) {
      const step = stepOf(r)
      if (step === 'DELIVERED' || step === 'CANCELLED') { if (ts(lastAt(r)) >= since) by.DONE.push(r) }
      else by[step]?.push(r)
    }
    // File d'attente : la plus ancienne en haut ; terminées : la plus récente
    for (const k of ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'IN_DELIVERY']) by[k].sort((a, b) => ts(a.createdAt) - ts(b.createdAt))
    by.DONE.sort((a, b) => ts(lastAt(b)) - ts(lastAt(a)))
    return by
  }, [requests, now])

  const endDrag = useCallback(() => { setDrag(null); setOver(null) }, [])

  if (!requests) {
    return (
      <div className="rb" aria-busy="true" aria-label="Chargement des commandes">
        {COLUMNS.map(c => (
          <section key={c.key} className="rb-col">
            <header className="rb-col-head"><Skeleton w={110} h={14} /></header>
            <div className="rb-lane"><div className="rb-cards">{[0, 1].map(i => <Skeleton key={i} h={92} />)}</div></div>
          </section>
        ))}
      </div>
    )
  }

  const laneProps = (laneId) => {
    const rule = drag ? moveRule(drag.step, laneId) : null
    return {
      onDragOver: (e) => {
        if (!drag) return
        if (rule.ok) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
        if (over?.lane !== laneId) setOver({ lane: laneId, ok: rule.ok, same: !!rule.same, why: rule.why })
      },
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return
        setOver(o => (o?.lane === laneId ? null : o))
      },
      onDrop: (e) => {
        e.preventDefault()
        const id = drag?.id ?? e.dataTransfer.getData('text/plain')
        const r = (requests ?? []).find(x => x.id === id)
        endDrag()
        if (r) onMove(r, laneId)
      },
      'data-drop': !drag ? undefined : rule.same ? 'same' : rule.ok ? 'ok' : 'no',
      'data-over': over?.lane === laneId ? 'true' : undefined,
    }
  }

  return (
    <>
      <p id={hintId} className="sr-only">Faites glisser la carte vers une autre colonne, ou utilisez le bouton Déplacer.</p>
      <div className={`rb ${drag ? 'is-dragging' : ''}`} role="region" aria-label="Commandes par étape, en colonnes">
        {COLUMNS.map(col => {
          const count = col.lanes.reduce((n, l) => n + lanes[l.id].length, 0)
          return (
            <section key={col.key} className={`rb-col rb-col-${col.key}`} aria-labelledby={`rb-h-${col.key}`}>
              <header className="rb-col-head">
                <h2 id={`rb-h-${col.key}`} className="rb-col-title">{col.title}</h2>
                <span className="rb-count num" aria-label={`${count} commande${count > 1 ? 's' : ''}`}>{count}</span>
                {col.hint && <span className="rb-col-hint">{col.hint}</span>}
              </header>
              {col.lanes.map(lane => {
                const list = lane.id === 'DONE' ? lanes.DONE.slice(0, DONE_MAX) : lanes[lane.id]
                const LaneIcon = lane.icon
                const props = laneProps(lane.id)
                return (
                  <div key={lane.id} className={`rb-lane ${lane.label ? 'rb-sub' : ''}`} {...props}>
                    {lane.label && (
                      <div className="rb-sub-head">
                        {LaneIcon && <LaneIcon size={14} aria-hidden />}
                        <span>{lane.label}</span>
                        <span className="rb-sub-count num">{lanes[lane.id].length}</span>
                      </div>
                    )}
                    {props['data-over'] && props['data-drop'] === 'no' && (
                      <div className="rb-refuse" role="presentation"><Ban size={14} aria-hidden />{over?.why ?? 'Déplacement impossible'}</div>
                    )}
                    {props['data-over'] && props['data-drop'] === 'ok' && lane.id === 'IN_DELIVERY' && (
                      <div className="rb-drop-note" role="presentation"><Truck size={14} aria-hidden />Déposer ici ouvre la création de la livraison</div>
                    )}
                    <ul className="rb-cards">
                      {list.map(r => (
                        <BoardCard key={r.id} r={r} now={now} hintId={hintId} busy={busyId === r.id} disabled={!!busyId && busyId !== r.id}
                          open={openId === r.id} dragging={drag?.id === r.id}
                          onDragStart={(step) => requestAnimationFrame(() => setDrag({ id: r.id, step }))}
                          onDragEnd={endDrag} onOpen={() => onOpen(r.id)} onAct={() => onAct(r)}
                          onMove={(t) => onMove(r, t)} onReject={() => onReject(r)} />
                      ))}
                    </ul>
                    {list.length === 0 && (
                      <div className="rb-empty">
                        {drag && props['data-drop'] === 'ok' ? 'Déposer ici'
                          : lane.id === 'NEW' ? <><Inbox size={16} aria-hidden /><span>Les nouvelles commandes arrivent ici en direct.</span></>
                          : lane.id === 'DONE' ? 'Aucune commande terminée ces 7 derniers jours'
                          : 'Aucune commande'}
                      </div>
                    )}
                    {lane.id === 'DONE' && (
                      <button type="button" className="rb-more" onClick={onShowHistory}>
                        {lanes.DONE.length > DONE_MAX ? `Voir les ${lanes.DONE.length} commandes terminées` : 'Voir tout l’historique'}
                        <ChevronRight size={14} aria-hidden />
                      </button>
                    )}
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </>
  )
}

function BoardCard({ r, now, hintId, busy, disabled, open, dragging, onDragStart, onDragEnd, onOpen, onAct, onMove, onReject }) {
  const step = stepOf(r)
  const movable = step === 'NEW' || PREP.includes(step)
  const action = nextAction(step)
  const name = r.customerName || 'Client'
  const n = itemCount(r)
  const items = (r.items ?? []).map(it => `${it.name}${(it.quantity ?? 1) > 1 ? ` ×${it.quantity}` : ''}`).join(', ')
  const waitedMin = (now - ts(r.createdAt)) / 60_000
  const late = step === 'NEW' && waitedMin > 15
  const fresh = step === 'NEW' && waitedMin < 10
  const total = grandTotal(r) ?? articlesTotal(r)
  const ActIcon = action?.icon

  return (
    <li className={`rb-card ${open ? 'is-open' : ''} ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''} ${fresh ? 'is-fresh' : ''}`}
      draggable={movable && !busy && !disabled}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        try { e.dataTransfer.setData('text/plain', r.id) } catch { /* ignoré */ }
        onDragStart(step)
      }}
      onDragEnd={onDragEnd}>
      <button type="button" className="rb-card-main" onClick={onOpen}
        aria-label={`${name}, ${STEP_LABEL[step]}, ${fcfa(total)}, ${n} article${n > 1 ? 's' : ''}. Ouvrir le détail.`}
        aria-describedby={movable ? hintId : undefined}>
        <span className="rb-card-top">
          <span className="rb-name">{name}</span>
          <span className="rb-amount num">{fcfa(total)}</span>
        </span>
        <span className="rb-items">{n} article{n > 1 ? 's' : ''}{items ? ` · ${items}` : ''}</span>
        <span className="rb-card-meta">
          {step === 'DELIVERED' || step === 'CANCELLED' ? <StepBadge step={step} /> : <PayBadge r={r} />}
          <span className={`rb-time ${late ? 'is-late' : ''}`} title={late ? 'En attente depuis plus de 15 minutes' : undefined}>
            {step === 'NEW' ? timeAgo(r.createdAt) : timeAgo(lastAt(r))}
          </span>
        </span>
        {movable && <GripVertical size={14} className="rb-grip" aria-hidden />}
      </button>

      {movable && (
        <div className="rb-card-foot">
          <MoveMenu step={step} name={name} disabled={busy || disabled} onMove={onMove} onReject={onReject} />
          <Button size="sm" variant={step === 'READY' ? 'primary' : 'ghost'} icon={ActIcon} loading={busy} disabled={disabled}
            onClick={onAct} aria-label={action.label} className="rb-act">
            {SHORT[step]}
          </Button>
        </div>
      )}
      {step === 'IN_DELIVERY' && r.orderId && (
        <div className="rb-card-foot">
          <Link to={`/livraisons?id=${r.orderId}`} className="rb-follow">Suivre la livraison<ChevronRight size={14} aria-hidden /></Link>
        </div>
      )}
    </li>
  )
}

// Menu « Déplacer » : les étapes possibles (vers l'avant), puis Refuser /
// Annuler. Ouvert dans une couche au-dessus du tableau (jamais coupé par le
// défilement des colonnes), navigation aux flèches, Échap pour fermer.
function MoveMenu({ step, name, disabled, onMove, onReject }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const menu = useRef(null)
  const menuId = useId()
  const targets = MOVE_TARGETS.filter(t => moveRule(step, t).ok)
  const items = [
    ...targets.map(t => ({ key: t, label: moveLabel(step, t), run: () => onMove(t) })),
    { key: 'reject', label: step === 'NEW' ? 'Refuser la commande' : 'Annuler la commande', danger: true, run: onReject },
  ]

  const close = useCallback((focusBack = true) => {
    setOpen(false)
    if (focusBack) btn.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const b = btn.current?.getBoundingClientRect()
      if (!b) return
      const h = menu.current?.offsetHeight ?? 220
      const w = 232
      const below = b.bottom + 6 + h < window.innerHeight
      setPos({
        top: below ? b.bottom + 6 : Math.max(8, b.top - 6 - h),
        left: Math.min(Math.max(8, b.left), window.innerWidth - w - 8),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector('[role="menuitem"]')?.focus()
    const onDown = (e) => {
      if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) close(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown) }
  }, [open, close])

  const onKey = (e) => {
    const els = [...(menu.current?.querySelectorAll('[role="menuitem"]') ?? [])]
    const i = els.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') close(false)
  }

  return (
    <>
      <button ref={btn} type="button" className="rb-move" disabled={disabled}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={`Déplacer la commande de ${name}`}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}>
        <ArrowRightLeft size={14} aria-hidden /><span>Déplacer</span>
      </button>
      {open && createPortal(
        <div className="pro" style={{ background: 'transparent', minHeight: 0 }}>
          <div ref={menu} id={menuId} role="menu" aria-label={`Déplacer la commande de ${name}`} className="card rb-menu"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} onKeyDown={onKey}>
            <p className="rb-menu-label">Passer à</p>
            {items.map((it, i) => (
              <button key={it.key} type="button" role="menuitem" tabIndex={-1}
                className={`rb-menu-item ${it.danger ? 'is-danger' : ''} ${it.danger && i > 0 ? 'has-sep' : ''}`}
                onClick={() => { close(); it.run() }}>
                {it.danger ? <Ban size={15} aria-hidden /> : it.key === 'IN_DELIVERY' ? <Truck size={15} aria-hidden /> : <span className="rb-menu-dot" aria-hidden />}
                {it.label}
                {!it.danger && <span className="rb-menu-to">{LANE_LABEL[it.key]}</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
