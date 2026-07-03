import { useState, useEffect, useCallback } from 'react'
import { Send } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import StatusBadge from '../../components/StatusBadge'

const KIND_LABELS = { TARIFF_CHANGE: 'Modification tarifaire' }

function Section({ title, children }) {
  return (
    <div style={{ ...glass, padding: '18px 20px', marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, value, unit }) {
  return (
    <div style={{ flex: '1 1 140px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value != null ? `${value}${unit ?? ''}` : '—'}</div>
    </div>
  )
}

function ProposeForm({ fields, onSubmit, submitting }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(f => [f.key, f.current ?? ''])))
  const [reason, setReason] = useState('')

  if (!open) {
    return <button onClick={() => setOpen(true)} style={btnOutline}>Proposer une modification</button>
  }

  return (
    <div style={{ marginTop: 14, padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {fields.map(f => (
          <div key={f.key} style={{ flex: '1 1 140px' }}>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{f.label}</label>
            <input
              type="number"
              value={values[f.key]}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              style={glassInput}
            />
          </div>
        ))}
      </div>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Motif de la proposition…"
        rows={2}
        style={{ ...glassInput, resize: 'vertical', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={btnOutline}>Annuler</button>
        <button
          onClick={() => onSubmit(values, reason).then(() => setOpen(false))}
          disabled={submitting}
          style={btnPrimary}
        >
          <Send size={13} /> {submitting ? 'Envoi…' : 'Soumettre pour validation'}
        </button>
      </div>
    </div>
  )
}

export default function TariffsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/finance/tariffs')
      setData(res.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function submitProposal(target, changes, reason) {
    setSubmitting(true); setError('')
    try {
      await api.post('/admin/requests', { kind: 'TARIFF_CHANGE', payload: { target, changes }, reason: reason || undefined })
      await load()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSubmitting(false) }
  }

  if (loading || !data) return <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>

  return (
    <div>
      {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 14 }}>{error}</div>}

      <Section title="Tarif de base des courses">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <Field label="Course (base)" value={data.baseFare.ride} unit=" F" />
          <Field label="Livraison (base)" value={data.baseFare.delivery} unit=" F" />
          <Field label="Prix par km" value={data.baseFare.perKm} unit=" F/km" />
        </div>
        <ProposeForm
          submitting={submitting}
          fields={[
            { key: 'base_fare_ride', label: 'Course (base)', current: data.baseFare.ride },
            { key: 'base_fare_delivery', label: 'Livraison (base)', current: data.baseFare.delivery },
            { key: 'price_per_km', label: 'Prix par km', current: data.baseFare.perKm },
          ]}
          onSubmit={(values, reason) => {
            const changes = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
            return submitProposal('base_fare', changes, reason)
          }}
        />
      </Section>

      <Section title="Pass livreurs">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
          <Field label="Statut" value={data.forfait.active ? 'Actif' : 'Inactif'} />
          <Field label="Montant standard" value={data.forfait.amount} unit=" F" />
          <Field label="Montant M3+" value={data.forfait.amountM3} unit=" F" />
        </div>
        <ProposeForm
          submitting={submitting}
          fields={[
            { key: 'amount', label: 'Montant standard', current: data.forfait.amount },
            { key: 'amountM3', label: 'Montant M3+', current: data.forfait.amountM3 },
          ]}
          onSubmit={(values, reason) => {
            const changes = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]))
            return submitProposal('forfait', changes, reason)
          }}
        />
      </Section>

      <Section title="Grille de commissions">
        <div style={{ overflowX: 'auto', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
            <thead>
              <tr>
                {['Prix min', 'Prix max', 'Commission'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.feesGrid.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                  <td style={{ padding: '6px 10px', fontSize: 13 }}>{row.min.toLocaleString()} F</td>
                  <td style={{ padding: '6px 10px', fontSize: 13 }}>{row.max.toLocaleString()} F</td>
                  <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 600 }}>{row.fee.toLocaleString()} F</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          La grille complète se modifie ligne par ligne côté Super Admin — décris ici la modification souhaitée, elle sera appliquée après validation.
        </p>
        <ProposeGridForm submitting={submitting} onSubmit={(reason) => submitProposal('fees_grid', { grid: data.feesGrid }, reason)} />
      </Section>

      <Section title="Mes propositions">
        {data.myProposals.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune proposition soumise.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.myProposals.map(r => (
              <div key={r.id} style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_LABELS[r.kind] ?? r.kind} — {r.payload?.target}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(r.createdAt).toLocaleString('fr-FR')}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.reason && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>« {r.reason} »</div>}
                {r.status !== 'PENDING' && r.reviewNotes && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}><strong>Réponse :</strong> {r.reviewNotes}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function ProposeGridForm({ onSubmit, submitting }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) return <button onClick={() => setOpen(true)} style={btnOutline}>Proposer une modification</button>

  return (
    <div style={{ padding: '14px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Décris la modification souhaitée sur la grille (ex : tranche 900-1250F → commission 70F au lieu de 65F)…"
        rows={3}
        style={{ ...glassInput, resize: 'vertical', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setOpen(false)} style={btnOutline}>Annuler</button>
        <button onClick={() => onSubmit(reason).then(() => setOpen(false))} disabled={submitting || !reason.trim()} style={btnPrimary}>
          <Send size={13} /> {submitting ? 'Envoi…' : 'Soumettre pour validation'}
        </button>
      </div>
    </div>
  )
}

const btnOutline = { padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.5)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
