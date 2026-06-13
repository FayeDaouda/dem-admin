import { useState, useEffect, useCallback } from 'react'
import fleetApi from '../../lib/fleetApi'
import { RefreshCw, Plus, X, Star } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh } from '../../lib/glassStyles'

const STATUS_TABS = [
  ['all',       'Tous'],
  ['active',    '✓ Actifs'],
  ['pending',   '⏳ En attente'],
  ['rejected',  '✗ Refusés'],
  ['suspended', '⚠ Suspendus'],
]

function driverStatusLabel(d) {
  if (d.chefDeFlotteStatus === 'PENDING')  return { text: '⏳ En attente', color: '#f59e0b' }
  if (d.chefDeFlotteStatus === 'REJECTED') return { text: '✗ Refusé',     color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE' && !d.isActive) return { text: '⚠ Suspendu', color: '#ef4444' }
  if (d.chefDeFlotteStatus === 'ACTIVE')   return { text: '✓ Actif',       color: '#22c55e' }
  return { text: d.chefDeFlotteStatus ?? '—', color: '#888' }
}

// ── Modal Nouveau livreur ──────────────────────────────────────────────────────
function NewDriverModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ phone: '', name: '', vehicleType: 'MOTO' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.phone.trim()) { setError('Le numéro est obligatoire.'); return }
    setSaving(true); setError('')
    try {
      await fleetApi.post('/chefs-de-flotte/me/drivers', form)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur.')
    } finally { setSaving(false) }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...glass, width: 420, maxWidth: '92vw', borderRadius: 16, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700 }}>Nouveau livreur</h2>
          <button onClick={onClose} style={btnIcon}><X size={16} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Téléphone *</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            placeholder="+221 77 000 00 00"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nom complet</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex : Moussa Diop"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Type de véhicule</label>
          <select value={form.vehicleType} onChange={e => set('vehicleType', e.target.value)} style={inputStyle}>
            <option value="MOTO">Moto</option>
            <option value="VELO">Vélo</option>
            <option value="VOITURE">Voiture</option>
          </select>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Le livreur sera créé en attente de validation par l'administrateur. Les documents (permis, pièces du véhicule) pourront être ajoutés ensuite.
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ ...btnOutline, flex: 1 }}>Annuler</button>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, flex: 1 }}>
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function FleetDrivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)

  const fetchDrivers = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter }
      const res = await fleetApi.get('/chefs-de-flotte/me/drivers', { params })
      setDrivers(Array.isArray(res.data?.drivers) ? res.data.drivers : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchDrivers() }, [fetchDrivers])

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Mes livreurs</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchDrivers} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={() => setShowNew(true)} style={btnPrimary}><Plus size={14} /> Nouveau livreur</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', flexShrink: 0 }}>
        {STATUS_TABS.map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            padding: '4px 14px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: statusFilter === key ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: statusFilter === key ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={pageScroll}>
        <div style={card}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          ) : drivers.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Aucun livreur pour ce filtre.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  {['Livreur', 'Téléphone', 'Véhicule', 'Statut', 'Note', 'Courses livrées', 'Inscription'].map(h => (
                    <th key={h} style={{ ...thStyle, ...stickyTh }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => {
                  const status = driverStatusLabel(d)
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(124,58,237,.15),rgba(6,113,186,.15))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#7c3aed', fontSize: 13, flexShrink: 0 }}>
                            {d.avatar ? <img src={d.avatar} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} /> : (d.name?.trim() || d.phone || '?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{d.name?.trim() || '—'}</span>
                        </div>
                      </td>
                      <td style={tdStyle}>{d.phone}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>{d.vehicleType}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: status.color }}>{status.text}</span>
                        {d.chefDeFlotteStatus === 'REJECTED' && d.rejectionReason && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.rejectionReason}</div>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {d.avgRating != null ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}>
                            <Star size={12} fill="#f59e0b" color="#f59e0b" /> {d.avgRating}
                          </span>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 600 }}>{d.deliveredCourses}</td>
                      <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12 }}>
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showNew && (
        <NewDriverModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchDrivers() }}
        />
      )}
    </div>
  )
}

const overlay     = { position: 'fixed', inset: 0, background: 'rgba(0,40,80,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const card        = { ...glass, padding: '20px 24px' }
const tableStyle  = { width: '100%', borderCollapse: 'collapse' }
const thStyle     = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle     = { padding: '10px 10px', verticalAlign: 'middle' }
const labelStyle  = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5 }
const inputStyle  = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }
const errorStyle  = { fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '7px 10px', marginTop: 4 }
const btnOutline  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary  = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnIcon     = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
