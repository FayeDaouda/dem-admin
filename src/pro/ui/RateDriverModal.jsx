import { useEffect, useId, useRef, useState } from 'react'
import { Star } from 'lucide-react'
import proApi, { errMsg } from '../lib/proApi'
import { Button, Modal } from './ui'
import { useNotify } from './notifyContext'
import { SCORE_LABELS } from './ratingLabels'

// « Notez votre livreur » — même envoi que l'app
// (orders_repository.dart:rateDriver) : POST /ratings
// { orderId, ratedId, score 1-5, comment }. Le serveur retrouve lui-même le
// coursier de la course ; 409 (ALREADY_RATED) = déjà noté, pas une erreur.

// Étoiles cliquables (flèches du clavier comme un groupe radio)
export function StarInput({ value, onChange, size = 30, label = 'Note du coursier' }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  const refs = useRef([])
  const onKey = (e) => {
    const next = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? Math.min(5, value + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? Math.max(1, value - 1) : null
    if (next == null) return
    e.preventDefault()
    onChange(next)
    refs.current[next - 1]?.focus()
  }
  return (
    <div className="dv-stars" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)} onKeyDown={onKey}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} ref={el => { refs.current[n - 1] = el }} type="button" role="radio" aria-checked={value === n}
          aria-label={`${n} étoile${n > 1 ? 's' : ''} · ${SCORE_LABELS[n]}`} tabIndex={value ? (value === n ? 0 : -1) : (n === 1 ? 0 : -1)}
          className={`dv-star ${n <= shown ? 'is-on' : ''}`} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}>
          <Star size={size} aria-hidden />
        </button>
      ))}
    </div>
  )
}

export default function RateDriverModal({ open, order, initialScore = 5, onClose, onRated }) {
  const notify = useNotify()
  const [score, setScore] = useState(initialScore)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const sending = useRef(false)
  const commentId = useId()

  useEffect(() => {
    if (open) { setScore(initialScore || 5); setComment('') }
  }, [open, initialScore])

  const send = async () => {
    if (sending.current || !order?.id || !score) return
    sending.current = true
    setBusy(true)
    const text = comment.trim()
    try {
      await proApi.post('/ratings', { orderId: order.id, ratedId: order.driver?.id ?? null, score, comment: text || null })
      notify.success('Merci pour votre avis', 'Votre note aide DEM à garder les meilleurs coursiers.')
      onRated?.({ score, comment: text || null })
    } catch (e) {
      if (e?.response?.status === 409) {
        notify.info('Déjà notée', 'Votre avis sur cette livraison est déjà enregistré.')
        onRated?.(null)
      } else notify.error('Note non envoyée', errMsg(e, 'Impossible d\'envoyer la note.'))
    } finally { setBusy(false); sending.current = false }
  }

  const first = String(order?.driver?.name ?? '').trim().split(/\s+/)[0]
  return (
    <Modal open={open} onClose={onClose} width={460}
      title="Notez votre coursier"
      subtitle={first ? `Comment s'est passée la livraison avec ${first} ?` : 'Comment s\'est passée la livraison ?'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Plus tard</Button>
        <Button loading={busy} disabled={!score} onClick={send}>Envoyer ma note</Button>
      </>}>
      <div className="dv-rate">
        <StarInput value={score} onChange={setScore} size={34} />
        <p className="dv-rate-label" aria-live="polite">{SCORE_LABELS[score] ?? ''}</p>
        <label htmlFor={commentId} className="nd-label">Un commentaire <span className="muted dv-opt">facultatif</span></label>
        <textarea id={commentId} className="input dv-textarea" rows={3} maxLength={500} value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={score <= 3 ? 'Qu\'est-ce qui n\'allait pas ?' : 'Ponctuel, aimable, colis en parfait état…'} />
        <span className="muted dv-count num">{comment.length}/500</span>
      </div>
    </Modal>
  )
}
