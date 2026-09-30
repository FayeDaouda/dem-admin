import { useState, useEffect, useCallback } from 'react'
import { Wrench, Eye, Play, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import api from '../lib/api'
import { glass, pageWrap, pageScroll } from '../lib/glassStyles'
import { formatF, formatCount } from '../lib/format'
import OtpUnblockPanel from '../components/OtpUnblockPanel'
import SmsRoutingPanel from '../components/SmsRoutingPanel'
import PinSettingsPanel from '../components/PinSettingsPanel'

// ── Maintenance des données (SUPER) ───────────────────────────────────────────
// Tâches ponctuelles exécutées CÔTÉ SERVEUR (qui accède à la base par le réseau
// interne de Render) — liste fermée, voir admin.maintenance.service.js.
// Parcours imposé : Aperçu (lecture seule) → Exécuter (confirmation).

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export default function Maintenance() {
  const [tasks, setTasks] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.get('/admin/maintenance/tasks')
      .then(r => { setTasks(r.data.tasks); setError('') })
      .catch(e => setError(e.response?.data?.message ?? 'Erreur de chargement.'))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wrench size={22} /> Maintenance des données
        </h1>
        <button onClick={load} style={btnOutline}><RefreshCw size={14} /> Actualiser</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, flexShrink: 0, maxWidth: 860 }}>
        Corrections ponctuelles exécutées sur le serveur. Chaque tâche se lance en deux temps : un <strong>aperçu</strong> qui
        n'écrit rien, puis l'<strong>exécution</strong> après confirmation. Toutes sont sans effet si on les relance, s'exécutent
        entièrement ou pas du tout, et chaque exécution est enregistrée dans l'audit.
      </p>

      <div style={pageScroll}>
        {error ? (
          <div style={{ color: 'var(--danger)' }}>{error}</div>
        ) : !tasks ? (
          <div style={{ color: 'var(--text-muted)' }}>Chargement…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 980 }}>
            {tasks.map((t, i) => <TaskCard key={t.id} index={i + 1} task={t} onDone={load} />)}
          </div>
        )}
        {/* Fournisseurs SMS des codes OTP (masqué tant que le backend n'a pas le routeur SMS) */}
        <div style={{ marginTop: 24 }}><SmsRoutingPanel /></div>
        {/* Code secret : activation (SUPER uniquement) */}
        <div style={{ marginTop: 24 }}><PinSettingsPanel /></div>
        {/* Outil support aussi accessible au SUPER (le tableau Service Client lui est masqué) */}
        <div style={{ marginTop: 24 }}><OtpUnblockPanel /></div>
      </div>
    </div>
  )
}

function TaskCard({ index, task, onDone }) {
  const [preview, setPreview]   = useState(null)
  const [result, setResult]     = useState(null)
  const [busy, setBusy]         = useState('') // 'preview' | 'run' | ''
  const [error, setError]       = useState('')
  const [notify, setNotify]     = useState(false)

  async function runPreview() {
    setBusy('preview'); setError(''); setResult(null)
    try {
      const r = await api.post(`/admin/maintenance/tasks/${task.id}/preview`)
      setPreview(r.data)
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur pendant l\'aperçu.')
    } finally { setBusy('') }
  }

  async function runTask() {
    const label = task.requiresExpectedTotal
      ? `Verser ${formatF(preview.total)} aux livreurs${notify ? ' et les notifier' : ''} ?`
      : `Exécuter « ${task.title} » ?\n\n${preview.summary}`
    if (!confirm(`${label}\n\nCette action modifie les données de production.`)) return
    setBusy('run'); setError('')
    try {
      const body = { confirm: true }
      if (task.requiresExpectedTotal) { body.expectedTotal = preview.total; body.notify = notify }
      const r = await api.post(`/admin/maintenance/tasks/${task.id}/run`, body)
      setResult(r.data)
      setPreview(null)
      onDone()
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur pendant l\'exécution.')
    } finally { setBusy('') }
  }

  const canRun = preview && !preview.nothingToDo && busy === '' && !task.running

  return (
    <div style={{ ...glass, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,119,182,.12)', color: 'var(--primary)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{task.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{task.description}</div>
          <div style={{ fontSize: 12, marginTop: 8, color: task.lastRun ? 'var(--success)' : 'var(--text-muted)' }}>
            {task.lastRun
              ? <>✓ Dernière exécution : {fmtDateTime(task.lastRun.at)} par {task.lastRun.by}{task.lastRun.summary ? ` — ${task.lastRun.summary}` : ''}</>
              : 'Jamais exécutée'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={runPreview} disabled={busy !== ''} style={btnOutline}>
            <Eye size={14} /> {busy === 'preview' ? 'Aperçu…' : 'Aperçu'}
          </button>
          <button onClick={runTask} disabled={!canRun} title={!preview ? 'Faites d\'abord un aperçu' : undefined}
            style={{ ...btnPrimary, opacity: canRun ? 1 : 0.45, cursor: canRun ? 'pointer' : 'not-allowed' }}>
            <Play size={14} /> {busy === 'run' ? 'Exécution…' : task.requiresExpectedTotal ? 'Verser' : 'Exécuter'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ ...notice, background: '#ef444412', color: '#b91c1c' }}><AlertTriangle size={14} /> {error}</div>
      )}

      {preview && (
        <div style={{ ...notice, background: preview.nothingToDo ? 'rgba(34,197,94,.08)' : 'rgba(0,119,182,.06)', color: 'var(--text)', flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ fontWeight: 600 }}>
            {preview.nothingToDo ? '✓ Rien à faire — ' : 'Aperçu (rien n\'a été modifié) : '}{preview.summary}
          </div>
          {task.requiresExpectedTotal && !preview.nothingToDo && (
            <SubsidyPreview preview={preview} notify={notify} onNotify={setNotify} />
          )}
          {preview.accounts?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>{preview.accounts.join(' · ')}</div>
          )}
        </div>
      )}

      {result && (
        <div style={{ ...notice, background: 'rgba(34,197,94,.1)', color: '#15803d' }}>
          <CheckCircle2 size={14} /> Terminé : {result.summary}
        </div>
      )}
    </div>
  )
}

function SubsidyPreview({ preview, notify, onNotify }) {
  return (
    <div style={{ marginTop: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>{['Livreur', 'Téléphone', 'Commandes', 'Montant dû'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {preview.byDriver.map(d => (
            <tr key={d.driverId} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={td}>{d.name ?? '—'}</td>
              <td style={td}>{d.phone ?? '—'}</td>
              <td style={td}>{formatCount(d.orders)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{formatF(d.amount)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Total</td>
            <td style={{ ...td, fontWeight: 800, color: 'var(--primary)' }}>{formatF(preview.total)}</td>
          </tr>
        </tbody>
      </table>
      {preview.beforeSubsidy?.count > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          {formatCount(preview.beforeSubsidy.count)} commande(s) livrée(s) avant le 26/07/2026 ({formatF(preview.beforeSubsidy.total)}) ne sont pas incluses :
          la compensation n'existait pas encore à l'époque — à décider au cas par cas.
        </div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={notify} onChange={e => onNotify(e.target.checked)} />
        Notifier chaque livreur du montant crédité
      </label>
    </div>
  )
}

const btnOutline = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600 }
const notice     = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '10px 14px', borderRadius: 10, fontSize: 13 }
const th         = { textAlign: 'left', padding: '6px 8px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--border)' }
const td         = { padding: '8px', verticalAlign: 'middle' }
