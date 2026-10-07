import { useEffect, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { glass, glassInput } from '../lib/glassStyles'

// Version de l'app (dem-backend : utils/app-version.js). Au lancement, l'app
// compare sa version à ces réglages :
// - plus ancienne que « dernière version » → fenêtre « Nouvelle version
//   disponible » (refermable, revient à chaque ouverture) ;
// - plus ancienne que « version minimale » → mise à jour obligatoire.
// N'agit que sur les versions de l'app qui contiennent ce contrôle.

const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const EMPTY = { android: { latest: '', min: '' }, ios: { latest: '', min: '' }, message: '' }

function toForm(config) {
  if (!config) return EMPTY
  return {
    android: { latest: config.android?.latest ?? '', min: config.android?.min ?? '' },
    ios: { latest: config.ios?.latest ?? '', min: config.ios?.min ?? '' },
    message: config.message ?? '',
  }
}

export default function AppVersionTab() {
  const [saved, setSaved] = useState(undefined)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.get('/admin/app-version')
      .then(({ data }) => { setSaved(data.config); setForm(toForm(data.config)) })
      .catch(e => setError(e.response?.data?.message || 'Chargement impossible.'))
  }, [])

  const set = (platform, key, value) => setForm(f => ({ ...f, [platform]: { ...f[platform], [key]: value.trim() } }))
  const badField = v => v !== '' && !VERSION_RE.test(v)
  const invalid = ['android', 'ios'].some(p => badField(form[p].latest) || badField(form[p].min))
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(saved))

  async function save(config) {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data } = await api.put('/admin/app-version', { config })
      setSaved(data.config)
      setForm(toForm(data.config))
      setNotice(data.config ? 'Enregistré : les utilisateurs concernés verront la fenêtre à la prochaine ouverture de l\'app.' : 'Désactivé : plus aucune fenêtre de mise à jour.')
    } catch (e) {
      setError(e.response?.data?.message || 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (saved === undefined) {
    return <div style={{ ...glass, padding: 20, color: 'var(--text-muted)' }}>{error || 'Chargement…'}</div>
  }

  const input = (platform, key, placeholder) => (
    <input
      value={form[platform][key]} placeholder={placeholder}
      onChange={e => set(platform, key, e.target.value)}
      style={{ ...glassInput, borderColor: badField(form[platform][key]) ? 'var(--danger)' : undefined }}
    />
  )

  const row = (platform, label) => (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 12, alignItems: 'center', marginBottom: 10 }}>
      <strong style={{ fontSize: 13 }}>{label}</strong>
      {input(platform, 'latest', 'ex. 1.2.0')}
      {input(platform, 'min', 'vide = pas d\'obligation')}
    </div>
  )

  return (
    <div style={{ ...glass, padding: 20, maxWidth: 760 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>Version de l'app</h2>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: 1.6 }}>
        Indiquez la dernière version <strong>une fois validée par le store</strong> : les utilisateurs d'une version plus ancienne
        verront « Nouvelle version disponible » à chaque ouverture de l'app. En dessous de la version minimale, la mise à jour est
        obligatoire (à réserver aux correctifs critiques). Client, livreur et DEM Pro : même app, même réglage.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1fr', gap: 12, fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
        <span /> <span>Dernière version</span> <span>Version minimale (obligatoire)</span>
      </div>
      {row('android', 'Android')}
      {row('ios', 'iPhone')}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '12px 0 14px' }}>
        Message affiché (facultatif, 200 caractères)
        <textarea
          rows={2} maxLength={200} value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Ex. : nouveaux écrans de commande et suivi en direct."
          style={{ ...glassInput, resize: 'vertical' }}
        />
      </label>

      {error && <div style={{ fontSize: 12, color: 'var(--danger)', background: 'rgba(239,68,68,.08)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{error}</div>}
      {notice && <div style={{ fontSize: 12, color: '#15803d', background: 'rgba(34,197,94,.10)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>{notice}</div>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button" disabled={invalid || !dirty || busy}
          onClick={() => save({
            android: { latest: form.android.latest || null, min: form.android.min || null },
            ios: { latest: form.ios.latest || null, min: form.ios.min || null },
            message: form.message,
          })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none', background: !invalid && dirty ? 'var(--primary)' : 'var(--surface2)', color: !invalid && dirty ? '#fff' : 'var(--text-muted)', fontWeight: 600, fontSize: 13, cursor: !invalid && dirty ? 'pointer' : 'default' }}
        ><Save size={15} /> Enregistrer</button>
        {saved && (
          <button
            type="button" disabled={busy}
            onClick={() => { if (window.confirm('Désactiver ? Plus aucune fenêtre de mise à jour ne s\'affichera.')) save(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,.35)', background: 'rgba(255,255,255,.5)', color: 'var(--danger)', fontSize: 13, cursor: 'pointer' }}
          ><Trash2 size={15} /> Désactiver</button>
        )}
      </div>
    </div>
  )
}
