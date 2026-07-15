import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { RefreshCw, Plus, Trash2, Search, Users, Bike, Briefcase, UserCog } from 'lucide-react'
import { glass, glassInput, pageWrap, pageScroll, stickyTh, stickyCol, stickyThCol } from '../lib/glassStyles'

const PROFILES = [
  ['CLIENT',         'Client',         Users],
  ['DRIVER',         'Livreur',        Bike],
  ['DEM_PRO',        'DEM Pro',        Briefcase],
  ['CHEF_DE_FLOTTE', 'Chef de flotte', UserCog],
]

const STATUS_OPTIONS = [
  ['A_APPELER',     'À appeler'],
  ['INTERESSE',     'Intéressé'],
  ['PAS_INTERESSE', 'Pas intéressé'],
  ['A_RAPPELER',    'À rappeler'],
  ['CONVERTI',      'Converti'],
]

const TRISTATE_OPTIONS = [['', '—'], ['true', 'Oui'], ['false', 'Non']]

export default function OutreachTable() {
  const [role, setRole]         = useState('DEM_PRO')
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [saving, setSaving]     = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/outreach', { params: { role } })
      setRows(res.data ?? [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [role])

  useEffect(() => { fetch() }, [fetch])

  function setLocal(id, field, value) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function save(id, field, value) {
    setSaving(true)
    try {
      await api.patch(`/admin/outreach/${id}`, { [field]: value })
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur de sauvegarde.')
      fetch()
    } finally {
      setSaving(false)
    }
  }

  async function addRow() {
    try {
      const res = await api.post('/admin/outreach', { role, companyName: 'Nouvelle entrée' })
      setRows(rs => [...rs, res.data])
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  async function deleteRow(id) {
    if (!confirm('Supprimer cette ligne ?')) return
    try {
      await api.delete(`/admin/outreach/${id}`)
      setRows(rs => rs.filter(r => r.id !== id))
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur.')
    }
  }

  const visible = rows
    .filter(r => statusFilter === 'all' || r.status === statusFilter)
    .filter(r => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return (r.companyName ?? '').toLowerCase().includes(q) || (r.contactedBy ?? '').toLowerCase().includes(q)
    })

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Tableau</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Suivi des appels de prospection et de support.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetch} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
          <button onClick={addRow} style={btnPrimary}><Plus size={14} /> Nouvelle ligne</button>
        </div>
      </div>

      {/* Onglets profil */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: 'rgba(255,255,255,.45)', borderRadius: 'var(--radius)', padding: 4, width: 'fit-content', flexWrap: 'wrap', flexShrink: 0 }}>
        {PROFILES.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setRole(key)} style={{
            padding: '7px 16px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
            background: role === key ? 'var(--primary)' : 'transparent',
            color: role === key ? '#fff' : 'var(--text-muted)',
            fontWeight: role === key ? 700 : 500, fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Entreprise ou contacté par…"
            style={{ ...glassInput, paddingLeft: 36, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setStatusFilter('all')} style={statusPill(statusFilter === 'all')}>Tous</button>
          {STATUS_OPTIONS.map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)} style={statusPill(statusFilter === key)}>{label}</button>
          ))}
        </div>
        {saving && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enregistrement…</span>}
      </div>

      <div style={pageScroll}>
        <div style={{ ...glass, padding: '16px 18px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
          ) : visible.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucune ligne pour ce profil.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1700 }}>
              <thead>
                <tr>
                  {[
                    ['#', 40], ['Nom entreprise', 160], ['Contacté par', 110], ['Date appel', 130],
                    ['Problème identifié', 220], ['Solution proposée', 200], ['Geste commercial', 130],
                    ['Statut', 150], ['1ère commande ?', 110], ['Nb courses générées', 100],
                    ['Retour collecté ?', 110], ['Score /10', 80], ['Notes', 200], ['', 36],
                  ].map(([h, w], i) => (
                    <th key={h + i} style={{ ...thStyle, width: w, ...(i === 1 ? stickyThCol : stickyTh) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r, idx) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ ...tdStyle, ...stickyCol }}>
                      <TextCell value={r.companyName ?? ''} onChange={v => setLocal(r.id, 'companyName', v)} onSave={v => save(r.id, 'companyName', v)} />
                    </td>
                    <td style={tdStyle}>
                      <TextCell value={r.contactedBy ?? ''} onChange={v => setLocal(r.id, 'contactedBy', v)} onSave={v => save(r.id, 'contactedBy', v)} />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="date"
                        value={r.callDate ? r.callDate.slice(0, 10) : ''}
                        onChange={e => { setLocal(r.id, 'callDate', e.target.value); save(r.id, 'callDate', e.target.value || null) }}
                        style={cellInput}
                      />
                    </td>
                    <td style={tdStyle}>
                      <TextAreaCell value={r.problem ?? ''} onChange={v => setLocal(r.id, 'problem', v)} onSave={v => save(r.id, 'problem', v)} />
                    </td>
                    <td style={tdStyle}>
                      <TextAreaCell value={r.solution ?? ''} onChange={v => setLocal(r.id, 'solution', v)} onSave={v => save(r.id, 'solution', v)} />
                    </td>
                    <td style={tdStyle}>
                      <TextCell value={r.commercialGesture ?? ''} onChange={v => setLocal(r.id, 'commercialGesture', v)} onSave={v => save(r.id, 'commercialGesture', v)} />
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={r.status}
                        onChange={e => { setLocal(r.id, 'status', e.target.value); save(r.id, 'status', e.target.value) }}
                        style={{ ...cellInput, fontWeight: 600, color: statusColor(r.status) }}
                      >
                        {STATUS_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={r.firstOrder === true ? 'true' : r.firstOrder === false ? 'false' : ''}
                        onChange={e => { const v = e.target.value === '' ? null : e.target.value === 'true'; setLocal(r.id, 'firstOrder', v); save(r.id, 'firstOrder', v) }}
                        style={cellInput}
                      >
                        {TRISTATE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number" min="0"
                        value={r.coursesGenerated ?? ''}
                        onChange={e => setLocal(r.id, 'coursesGenerated', e.target.value)}
                        onBlur={e => save(r.id, 'coursesGenerated', e.target.value === '' ? null : Number(e.target.value))}
                        style={cellInput}
                      />
                    </td>
                    <td style={tdStyle}>
                      <select
                        value={r.feedbackCollected === true ? 'true' : r.feedbackCollected === false ? 'false' : ''}
                        onChange={e => { const v = e.target.value === '' ? null : e.target.value === 'true'; setLocal(r.id, 'feedbackCollected', v); save(r.id, 'feedbackCollected', v) }}
                        style={cellInput}
                      >
                        {TRISTATE_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number" min="0" max="10"
                        value={r.score ?? ''}
                        onChange={e => setLocal(r.id, 'score', e.target.value)}
                        onBlur={e => save(r.id, 'score', e.target.value === '' ? null : Number(e.target.value))}
                        style={{ ...cellInput, fontWeight: 700, textAlign: 'center' }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <TextAreaCell value={r.notes ?? ''} onChange={v => setLocal(r.id, 'notes', v)} onSave={v => save(r.id, 'notes', v)} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <button onClick={() => deleteRow(r.id)} style={btnIcon} title="Supprimer la ligne">
                        <Trash2 size={13} color="var(--danger)" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function statusColor(status) {
  return { A_APPELER: '#f59e0b', INTERESSE: '#0077b6', PAS_INTERESSE: '#dc2626', A_RAPPELER: '#7c3aed', CONVERTI: '#22c55e' }[status] ?? 'var(--text)'
}

function statusPill(active) {
  return {
    padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
    background: active ? 'var(--primary)' : 'rgba(255,255,255,.5)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  }
}

// Cellules texte : édition locale immédiate, sauvegarde au blur.
function TextCell({ value, onChange, onSave }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onSave(e.target.value)}
      style={cellInput}
    />
  )
}

function TextAreaCell({ value, onChange, onSave }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onSave(e.target.value)}
      rows={2}
      style={{ ...cellInput, resize: 'vertical', minHeight: 40 }}
    />
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnIcon    = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4, borderRadius: 6 }
const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,0.12)', whiteSpace: 'nowrap' }
const tdStyle    = { padding: '6px 8px', verticalAlign: 'top' }
const cellInput  = { width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
