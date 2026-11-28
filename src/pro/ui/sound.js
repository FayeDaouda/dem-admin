import { useSyncExternalStore } from 'react'
import { PREF, readPref, writePref } from './prefs'

// Son du comptoir : un carillon à chaque nouvelle commande reçue, pour la
// tablette posée dans la boutique. Généré avec Web Audio (aucun fichier).
//
// Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur
// (toucher, clic, touche) : le son est « débloqué » au premier geste sur la
// page, ou par le bouton « Activer le son ». Après un rechargement, il faut
// de nouveau un geste : un simple toucher de l'écran suffit.

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
let ctx = null
let pref = readPref(PREF.sound) // 'on' | 'off' | null (pas encore choisi)
let lastPlay = 0
const listeners = new Set()
let snapshot = { pref, unlocked: false, supported: !!AC }

function emit() {
  snapshot = { pref, unlocked: ctx?.state === 'running', supported: !!AC }
  listeners.forEach(l => l())
}

function context() {
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
      ctx.onstatechange = emit
    } catch { ctx = null }
  }
  return ctx
}

// À appeler pendant un geste de l'utilisateur
export async function unlockSound() {
  const c = context()
  if (!c) return false
  try { if (c.state !== 'running') await c.resume() } catch { /* refusé hors geste */ }
  // iOS : un son muet joué pendant le geste ouvre la sortie audio
  try {
    const b = c.createBuffer(1, 1, 22050)
    const s = c.createBufferSource()
    s.buffer = b; s.connect(c.destination); s.start(0)
  } catch { /* ignoré */ }
  emit()
  return c.state === 'running'
}

// Geste sur la page : débloque le son s'il est activé et pas encore (ou
// plus : tablette mise en veille, iPad) autorisé par le navigateur
export function bindSoundUnlock() {
  if (typeof window === 'undefined') return () => {}
  const onGesture = () => {
    if (pref !== 'on' || ctx?.state === 'running') return
    unlockSound()
  }
  window.addEventListener('pointerdown', onGesture, true)
  window.addEventListener('keydown', onGesture, true)
  return () => {
    window.removeEventListener('pointerdown', onGesture, true)
    window.removeEventListener('keydown', onGesture, true)
  }
}

// Carillon : arpège montant la–do♯–mi–la, timbre de cloche (fondamentale +
// partiel inharmonique), assez présent pour s'entendre dans une boutique
function ring(c) {
  const t0 = c.currentTime + 0.02
  const out = c.createDynamicsCompressor()
  const master = c.createGain()
  master.gain.value = 0.32
  master.connect(out).connect(c.destination)
  const notes = [880, 1108.73, 1318.51, 1760]
  notes.forEach((f, i) => {
    const t = t0 + i * 0.13
    const last = i === notes.length - 1
    const dur = last ? 1.5 : 0.9
    for (const [ratio, level, type] of [[1, 1, 'sine'], [2.76, 0.18, 'sine'], [2, 0.12, 'triangle']]) {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = type
      o.frequency.value = f * ratio
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(level * (last ? 0.9 : 0.7), t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (ratio > 1 ? 2.2 : 1))
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + dur + 0.05)
    }
  })
}

// Nouvelle commande : carillon si le son est activé et débloqué (au plus un
// toutes les 3 secondes, même si le direct et le relevé arrivent ensemble)
export function playOrderChime({ force = false } = {}) {
  if (!force && pref !== 'on') return
  const now = Date.now()
  if (!force && now - lastPlay < 3000) return
  const c = ctx
  if (!c) return
  if (c.state !== 'running') { c.resume().catch(() => {}); if (c.state !== 'running') return }
  lastPlay = now
  try { ring(c) } catch { /* son indisponible */ }
}

export async function enableSound() {
  pref = 'on'
  writePref(PREF.sound, 'on')
  emit()
  const ok = await unlockSound()
  if (ok) playOrderChime({ force: true })
  return ok
}

export function disableSound() {
  pref = 'off'
  writePref(PREF.sound, 'off')
  emit()
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
const getSnapshot = () => snapshot

// { pref, unlocked, supported } — se met à jour quand le son change d'état
export function useCounterSound() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
