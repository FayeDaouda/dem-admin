import { useState, useEffect } from 'react'
import { KeyRound, AlertTriangle, CheckCircle2, Save } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// ── Interrupteurs du code secret (SUPER) ──────────────────────────────────────
// Tout est éteint par défaut : l'app garde la connexion par SMS. On active
// d'abord quelques numéros pilotes, puis rôle par rôle. Désactiver un rôle
// ramène l'app au SMS sans effacer les codes déjà créés.

const ROLE_LABELS = { DRIVER: 'Livreurs', DEM_PRO: 'DEM Pro', CLIENT: 'Clients', CHEF_DE_FLOTTE: 'Chefs de flotte' }

export default function PinSettingsPanel() {
  const [settings, setSettings] = useState(null)
  const [roles, setRoles]       = useState([])
  const [pilots, setPilots]     = useState('')
  const [error, setError]       = useState('')
  const [done, setDone]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    api.get('/admin/auth-settings')
      .then(({ data }) => {
        setSettings(data)
        setRoles(data.roles)
        setPilots(data.pilotPhones.join('\n'))
      })
      .catch(err => {
        if (err.response?.status === 404) setUnavailable(true) // backend sans code secret
        else setError(err.response?.data?.message ?? 'Erreur de chargement.')
      })
  }, [])

  const pilotList = pilots.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean)
  const changed = settings && (
    [...roles].sort().join() !== [...settings.roles].sort().join() ||
    pilotList.join() !== settings.pilotPhones.join()
  )

  function toggle(role) {
    setRoles(r => (r.includes(role) ? r.filter(x => x !== role) : [...r, role]))
    setDone('')
  }

  async function save() {
    const summary = roles.length
      ? `Code secret ACTIVÉ pour : ${roles.map(r => ROLE_LABELS[r] ?? r).join(', ')}`
      : 'Code secret désactivé pour tous les rôles'
    if (!window.confirm(`${summary}\nNuméros pilotes : ${pilotList.length}\n\nConfirmer ?`)) return
    setSaving(true); setError(''); setDone('')
    try {
      const { data } = await api.put('/admin/auth-settings', { roles, pilotPhones: pilotList })
      setSettings(data)
      setRoles(data.roles)
      setPilots(data.pilotPhones.join('\n'))
      setDone('Réglages enregistrés. Ils s\'appliquent en moins d\'une minute.')
    } catch (err) {
      setError(err.response?.data?.message ?? 'Enregistrement impossible.')
    } finally { setSaving(false) }
  }

  if (unavailable) return null

  return (
    <div style={{ ...glass, padding: '18px 20px', maxWidth: 760 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <KeyRound size={16} /> Code secret : activation
      </h2>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Connexion par numéro + code à 6 chiffres, sans SMS. Commencez par quelques numéros pilotes, puis activez rôle
        par rôle en suivant la baisse des SMS. Il faut l'app 1.1.3 ou plus récente ; les anciennes versions gardent le SMS.
      </p>

      {!settings && !error && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement…</div>}

      {settings && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>RÔLES ACTIVÉS</div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            {settings.availableRoles.map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={roles.includes(role)} onChange={() => toggle(role)} />
                {ROLE_LABELS[role] ?? role}
              </label>
            ))}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
            NUMÉROS PILOTES ({pilotList.length}) — actifs quel que soit leur rôle, un par ligne
          </div>
          <textarea
            value={pilots}
            onChange={e => { setPilots(e.target.value); setDone('') }}
            rows={4}
            placeholder={'77 123 45 67\n78 765 43 21'}
            style={{ ...glassInput, fontFamily: 'monospace', resize: 'vertical' }}
          />

          <button onClick={save} disabled={!changed || saving} style={{ ...btnPrimary, marginTop: 12, opacity: !changed || saving ? 0.5 : 1 }}>
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      )}

      {done && <div style={{ ...notice, background: 'rgba(34,197,94,.08)', color: '#15803d' }}><CheckCircle2 size={14} /> {done}</div>}
      {error && <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>}
    </div>
  )
}

const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const notice     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
