import { useState, useEffect } from 'react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import WhatsAppButton from './WhatsAppButton'

// ── Proposer, attribuer ou réattribuer une course (Courses, Carte live) ──
// Coursiers en ligne et libres, le plus proche du point de retrait d'abord
// (GET /admin/orders/:id/assignable-drivers).
//  - Proposer : offre que le coursier accepte ou refuse dans l'app
//    (course en attente seulement) ;
//  - Attribuer : la course lui arrive directement ;
//  - Réattribuer (course qui a déjà un coursier) : motif obligatoire, le
//    premier coursier est prévenu.
export default function DispatchPicker({ order, onClose, onDone }) {
  const reassigning = !!order.driver
  const canPropose = order.status === 'PENDING' && !order.driver
  const [state, setState] = useState({ drivers: [], reasons: [], lock: null, loading: true, error: null })
  const [reasonCode, setReasonCode] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    api.get(`/admin/orders/${order.id}/assignable-drivers`)
      .then(res => alive && setState({ drivers: res.data?.drivers ?? [], reasons: res.data?.reassignReasons ?? [], lock: res.data?.lock ?? null, loading: false, error: null }))
      .catch(e => alive && setState(s => ({ ...s, loading: false, error: e.response?.data?.message ?? 'Erreur de chargement des coursiers.' })))
    // Fenêtre fermée : le verrou d'attribution est rendu (C13)
    return () => { alive = false; api.delete(`/admin/orders/${order.id}/dispatch-lock`).catch(() => {}) }
  }, [order.id])

  const setError = error => setState(s => ({ ...s, error }))

  async function run(request, okText) {
    setBusy(true); setError(null)
    try {
      const res = await request()
      onDone({ text: okText, order: res.data?.order ?? null })
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setBusy(false) }
  }

  function assign(d) {
    if (reassigning && !reasonCode) { setError('Choisissez le motif de la réattribution.'); return }
    if (reasonCode === 'OTHER' && !note.trim()) { setError('Précisez le motif.'); return }
    const body = { driverId: d.id, ...(reassigning && { reasonCode, note: note.trim() }) }
    run(() => api.patch(`/admin/orders/${order.id}/reassign`, body),
      reassigning ? `Course confiée à ${d.name ?? 'ce coursier'} ; message envoyé à ${order.driver?.name ?? 'son premier coursier'}.` : `Course attribuée à ${d.name ?? 'ce coursier'}.`)
  }

  function propose(d) {
    run(() => api.patch(`/admin/orders/${order.id}/suggest`, { driverId: d.id }), `Course proposée à ${d.name ?? 'ce coursier'}.`)
  }

  return (
    <div style={overlay} onClick={() => !busy && onClose()}>
      <div style={box} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: 4, fontSize: 16 }}>{reassigning ? 'Réattribuer la course' : 'Choisir un coursier'}</h2>
        <p style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          {reassigning ? (
            <>La course est retirée à <strong>{order.driver.name ?? 'son coursier'}</strong> (message avec le motif) et confiée directement au coursier choisi.</>
          ) : (
            <><strong>Proposer</strong> envoie une offre que le coursier accepte ou refuse dans l’app. <strong>Attribuer</strong> lui donne la course directement (il a déjà dit oui, par exemple sur WhatsApp).</>
          )}
          {order.pickupAddress && <span style={{ display: 'block', marginTop: 4 }}>Retrait : {order.pickupAddress}</span>}
        </p>

        {state.lock && !state.lock.mine && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#b45309', background: 'rgba(245,158,11,.10)', padding: '8px 10px', borderRadius: 8, marginBottom: 12 }}>
            En cours d'attribution par {state.lock.byName ?? 'un autre admin'} : vérifiez avant d'agir.
          </div>
        )}

        {reassigning && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Motif *</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {state.reasons.map(r => (
                <button key={r.code} type="button" onClick={() => setReasonCode(r.code)} style={chip(reasonCode === r.code)}>{r.label}</button>
              ))}
            </div>
            {reasonCode === 'OTHER' && (
              <input value={note} onChange={e => setNote(e.target.value)} maxLength={255} placeholder="Précisez le motif" style={{ ...glassInput, marginTop: 8, fontSize: 13 }} />
            )}
          </div>
        )}

        {state.error && <div style={{ color: '#dc2626', padding: '0 0 10px', fontSize: 12.5 }}>{state.error}</div>}
        {state.loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 12 }}>Chargement des coursiers libres…</div>
        ) : state.drivers.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 12 }}>Aucun coursier en ligne et libre pour le moment.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
            {state.drivers.map(d => (
              <div key={d.id} style={row}>
                <span style={{ minWidth: 0 }}>
                  <strong>{d.name ?? 'Sans nom'}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{d.phone}</span>
                  <span style={{ display: 'block', color: d.distanceKm == null ? 'var(--text-muted)' : '#0077b6', fontSize: 11.5, fontWeight: 600 }}>
                    {d.distanceKm == null ? 'Position inconnue' : `À ${d.distanceKm.toLocaleString('fr-FR')} km du retrait`}
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  <WhatsAppButton phone={d.phone} compact />
                  {canPropose && <button onClick={() => propose(d)} disabled={busy} style={actionBtn('#0077b6')}>Proposer</button>}
                  <button onClick={() => assign(d)} disabled={busy} style={actionBtn('#16a34a')}>{reassigning ? 'Réattribuer' : 'Attribuer'}</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={busy} style={btnOutline}>{busy ? 'En cours…' : 'Fermer'}</button>
        </div>
      </div>
    </div>
  )
}

const overlay    = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }
const box        = { ...glass, background: 'rgba(255,255,255,0.97)', padding: '22px 26px', width: 480, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto' }
const row        = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.2)', background: 'rgba(255,255,255,0.5)', fontSize: 13 }
const labelStyle = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }
const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const actionBtn  = color => ({ ...btnOutline, padding: '6px 10px', fontSize: 12, color, borderColor: color, background: color + '14' })
const chip       = on => ({ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? '#dc2626' : 'rgba(0,0,0,.1)'}`, background: on ? 'rgba(239,68,68,.08)' : 'transparent', color: on ? '#dc2626' : 'var(--text)' })
