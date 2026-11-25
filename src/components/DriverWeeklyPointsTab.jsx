import { useState, useEffect, useCallback } from 'react'
import { Trophy, Save } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'
import { useAuth } from '../contexts/AuthContext'
import { isSuperRole } from '../lib/droits'

// ── Points de la semaine des coursiers ───────────────────────────────────────
// Classement (semaine en cours en direct, ou semaines figées chaque lundi) et
// barème (Super Admin). Serveur : drivers/driver-points.service.js. Le badge
// « carrière » (onglet Coursiers) ne change pas.

const DAY = 86400000
const mondayOf = (d) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return new Date(x.getTime() - ((x.getUTCDay() + 6) % 7) * DAY)
}
const fmt = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const SCALE = [
  ['delivered', 'Course livrée', 0, 100],
  ['chained', 'Course enchaînée (en plus)', 0, 100],
  ['rating5', 'Note 5★', 0, 100],
  ['ratingLow', 'Note 1-2★', -100, 0],
  ['cancel', 'Annulation par le coursier', -200, 0],
  ['claim', 'Réclamation fondée (faute du coursier)', -200, 0],
  ['incompleteFactor', 'Profil sans photo : coefficient des gains', 0, 1],
  ['priorityWeight', 'Poids dans le choix du coursier (0 à 0,2)', 0, 0.2],
]

export default function DriverWeeklyPointsTab() {
  const { user } = useAuth()
  const canEdit = isSuperRole(user?.adminRole)
  const thisMonday = mondayOf(new Date())
  const [weekOffset, setWeekOffset] = useState(0) // 0 = en cours, 1 = passée…
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [scale, setScale] = useState(null)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')

  const week = new Date(thisMonday.getTime() - weekOffset * 7 * DAY)

  const load = useCallback(async () => {
    setError('')
    try {
      const { data } = await api.get('/admin/drivers/points', { params: weekOffset ? { week: week.toISOString() } : {} })
      setBoard(data)
    } catch (e) {
      setError(e.response?.status === 404 ? 'Serveur pas encore à jour.' : (e.response?.data?.message ?? 'Erreur de chargement.'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.get('/admin/driver-points/settings').then(({ data }) => { setScale(data); setDraft(data) }).catch(() => {})
  }, [])

  async function save() {
    setSaving(true); setDone(''); setError('')
    try {
      const body = Object.fromEntries(SCALE.map(([k]) => [k, Number(draft[k])]))
      const { data } = await api.put('/admin/driver-points/settings', body)
      setScale(data); setDraft(data); setDone('Barème enregistré.')
      load()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Enregistrement impossible.')
    } finally { setSaving(false) }
  }

  const changed = scale && draft && SCALE.some(([k]) => Number(draft[k]) !== scale[k])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...glass, padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <Trophy size={16} color="var(--primary)" />
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Classement de la semaine</h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            du {fmt(week)} au {fmt(new Date(week.getTime() + 6 * DAY))}{board?.live ? ' · en direct' : ' · figé le lundi'}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3].map(o => (
              <button key={o} onClick={() => setWeekOffset(o)} style={{
                padding: '4px 10px', borderRadius: 16, border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer',
                background: weekOffset === o ? 'var(--primary)' : 'transparent', color: weekOffset === o ? '#fff' : 'var(--text-muted)',
              }}>{o === 0 ? 'En cours' : o === 1 ? 'Passée' : `−${o} sem.`}</button>
            ))}
          </div>
        </div>
        {error && <div style={{ fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
        {board && board.rows.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucun coursier classé pour cette semaine.</div>}
        {board && board.rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                  {['#', 'Coursier', 'Points', 'Courses', 'Enchaînées', '5★', '1-2★', 'Annul.', 'Récl.', 'Photo'].map(h => (
                    <th key={h} style={{ padding: '6px 8px', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.rows.map(r => {
                  const b = r.breakdown ?? {}
                  return (
                    <tr key={r.driver?.id ?? r.rank} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 800 }}>{r.rank}</td>
                      <td style={{ padding: '6px 8px' }}>{r.driver?.name || r.driver?.phone || '—'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 800 }}>{r.points}</td>
                      <td style={{ padding: '6px 8px' }}>{b.delivered ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>{b.chained ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>{b.rating5 ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>{b.ratingLow ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>{b.cancels ?? 0}</td>
                      <td style={{ padding: '6px 8px' }}>{b.claims ?? 0}</td>
                      <td style={{ padding: '6px 8px', color: b.incomplete ? '#b45309' : '#15803d' }}>{b.incomplete ? 'Manque (× ' + (scale?.incompleteFactor ?? 0.5) + ')' : 'OK'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft && (
        <div style={{ ...glass, padding: '18px 22px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px' }}>Barème</h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Du lundi 00:00 au dimanche 23:59. Le lundi, la semaine est figée, chaque coursier reçoit son résultat et le compteur
            repart à zéro. Les points de la semaine passée donnent une petite priorité sur les courses, la distance restant le
            premier critère. {canEdit ? '' : 'Modification réservée au Super Admin.'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {SCALE.map(([k, label, min, max]) => (
              <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                {label}
                <input type="number" min={min} max={max} step={k === 'incompleteFactor' || k === 'priorityWeight' ? 0.05 : 1}
                  value={draft[k]} disabled={!canEdit}
                  onChange={e => { setDraft({ ...draft, [k]: e.target.value }); setDone('') }}
                  style={{ ...glassInput, padding: '7px 10px' }} />
              </label>
            ))}
          </div>
          {canEdit && (
            <button onClick={save} disabled={!changed || saving} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', border: 'none', marginTop: 12,
              background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !changed || saving ? 0.5 : 1,
            }}>
              <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer le barème'}
            </button>
          )}
          {done && <div style={{ fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 8 }}>{done}</div>}
        </div>
      )}
    </div>
  )
}
