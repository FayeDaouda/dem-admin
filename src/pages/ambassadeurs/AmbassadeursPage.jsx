import { useCallback, useEffect, useState } from 'react'
import { ClipboardCheck, Users, Settings2, RefreshCw, Search } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { canSee, isSuperRole, TAB_ROLES } from '../../lib/droits'
import { glass, glassInput, pageWrap, pageScroll } from '../../lib/glassStyles'
import PageHeader from '../../components/PageHeader'
import TabBar from '../../components/TabBar'
import { useUrlTab } from '../../lib/useUrlTab'
import AmbassadorDrawer from './AmbassadorDrawer'
import AmbassadorSettings from './AmbassadorSettings'
import { STATUS, MEDAL, ROLE, fcfa, dateShort } from './ambassadorUi'

// ── Programme Ambassadeurs ────────────────────────────────────────────────────
// Dossiers à valider, suivi des ambassadeurs (Pro, médailles, gains),
// réglages de la campagne (Super). Serveur : ambassadors/ambassador.admin.js.
const TABS = [
  { key: 'dossiers', label: 'Dossiers à valider', icon: ClipboardCheck },
  { key: 'suivi',    label: 'Ambassadeurs',       icon: Users },
  { key: 'reglages', label: 'Réglages',           icon: Settings2 },
]

export default function AmbassadeursPage() {
  const { user } = useAuth()
  const role = user?.adminRole
  const tabs = TABS.filter(t => t.key === 'reglages' ? isSuperRole(role) || canSee(role, TAB_ROLES.ambassadeurs?.reglages) : canSee(role, TAB_ROLES.ambassadeurs?.[t.key]))
  const [tab, setTab] = useUrlTab(tabs)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
  const [q, setQ] = useState('')

  const load = useCallback(() => {
    setError('')
    api.get('/admin/ambassadors', { params: { q: q || undefined } })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.status === 404 ? 'Le serveur n\'a pas encore le programme Ambassadeurs.' : (e.response?.data?.message ?? 'Erreur de chargement.')))
  }, [q])
  useEffect(() => { if (tab !== 'reglages') load() }, [tab, load])

  const rows = data?.rows ?? []
  const pending = rows.filter(r => r.status === 'PENDING')
  const others = rows.filter(r => r.status !== 'PENDING')

  return (
    <div style={pageWrap}>
      <PageHeader title="Ambassadeurs"
        subtitle={data ? `${data.active} / ${data.places} places prises · programme ${data.programActive ? 'ouvert' : 'fermé'}` : 'Programme Ambassadeurs DEM Pro'}
        actions={tab !== 'reglages' ? (
          <button onClick={load} style={btnGhost}><RefreshCw size={14} /> Actualiser</button>
        ) : null} />
      <TabBar tabs={tabs.map(t => t.key === 'dossiers' && pending.length ? { ...t, label: `${t.label} (${pending.length})` } : t)} active={tab} onChange={setTab} />
      <div style={pageScroll}>
        {error && <div style={{ ...glass, padding: 16, color: '#b91c1c', fontSize: 13 }}>{error}</div>}

        {tab === 'reglages' && <AmbassadorSettings canEdit={isSuperRole(role)} />}

        {tab !== 'reglages' && !error && (
          <>
            {tab === 'suivi' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, maxWidth: 360 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                  <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                    placeholder="Nom ou numéro" style={{ ...glassInput, padding: '8px 10px 8px 30px', width: '100%', fontSize: 13 }} />
                </div>
              </div>
            )}
            {!data ? <div style={{ ...glass, padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Chargement…</div>
              : (tab === 'dossiers' ? pending : others).length === 0
                ? <div style={{ ...glass, padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  {tab === 'dossiers' ? 'Aucun dossier à valider.' : 'Aucun ambassadeur pour le moment.'}
                </div>
                : <Table rows={tab === 'dossiers' ? pending : others} pending={tab === 'dossiers'} onOpen={setOpen} />}
          </>
        )}
      </div>
      {open && <AmbassadorDrawer id={open} role={role} onClose={() => setOpen(null)} onChanged={load} />}
    </div>
  )
}

function Table({ rows, pending, onOpen }) {
  return (
    <div style={{ ...glass, padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            <th style={th}>Ambassadeur</th>
            <th style={th}>Compte</th>
            <th style={th}>Statut</th>
            {pending ? <><th style={th}>Pièce d'identité</th><th style={th}>Inscrit le</th></> : (
              <><th style={th}>Pro</th><th style={th}>Courses</th><th style={th}>Médailles</th><th style={{ ...th, textAlign: 'right' }}>En vérification</th><th style={{ ...th, textAlign: 'right' }}>Versé</th></>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => onOpen(r.id)} style={{ cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,.06)' }}>
              <td style={td}><div style={{ fontWeight: 600 }}>{r.name || '—'}</div><div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.phone}</div></td>
              <td style={td}>{ROLE[r.role] ?? r.role}</td>
              <td style={td}><StatusPill status={r.status} training={!!r.trainingPassedAt} /></td>
              {pending ? (
                <><td style={td}>{r.documents ? 'Recto et verso' : <span style={{ color: '#b45309' }}>Incomplète</span>}</td><td style={td}>{dateShort(r.createdAt)}</td></>
              ) : (
                <>
                  <td style={td}>{r.merchants} · {r.unlocked} débloqué{r.unlocked > 1 ? 's' : ''}</td>
                  <td style={td}>{r.courses}</td>
                  <td style={td}>{r.medals.length ? r.medals.map(m => MEDAL[m]?.emoji ?? '').join(' ') : '—'}{r.boosterActive ? ' · booster' : ''}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{fcfa(r.pending)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600 }}>{fcfa(r.released)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatusPill({ status, training }) {
  const s = STATUS[status] ?? STATUS.PENDING
  const label = status === 'ACTIVE' && !training ? 'Validé · formation à faire' : s.label
  return <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, color: s.color, background: s.bg }}>{label}</span>
}

const th = { padding: '12px 14px', fontWeight: 700 }
const td = { padding: '12px 14px', verticalAlign: 'middle' }
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)', background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
