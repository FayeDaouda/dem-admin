import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { Phone, Plus } from 'lucide-react'
import { glass, stickyTh, stickyCol, stickyThCol } from '../../lib/glassStyles'
import StatusBadge from '../../components/StatusBadge'
import ExportPdfButton from '../../components/ExportPdfButton'
import SubmitRequestModal from './components/SubmitRequestModal'

const SECTOR_LABELS = { commerce: 'Commerce', restauration: 'Restauration', services: 'Services', artisanat: 'Artisanat', autre: 'Autre' }

export default function DemProTab() {
  const [accounts, setAccounts] = useState([])
  const [details, setDetails]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [modal, setModal]       = useState(null) // { kind, targetUser }

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/dem-pro', { params: filter === 'all' ? {} : { status: filter } })
      const list = res.data?.accounts ?? []
      setAccounts(list)
      const pairs = await Promise.all(list.map(async a => {
        try {
          const d = await api.get(`/admin/dem-pro/${a.id}`)
          return [a.id, d.data]
        } catch { return [a.id, null] }
      }))
      setDetails(Object.fromEntries(pairs))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetch() }, [fetch])

  const rows = accounts.map(a => {
    const d = details[a.id]
    return {
      businessName: a.proBusinessName ?? '—',
      name: a.name ?? '—',
      phone: a.phone ?? '—',
      status: a.isActive ? (a.proStatus ?? 'ACTIVE') : 'SUSPENDED',
      volume: d?.stats?.deliveriesToday?.completed ?? '…',
      spend: d ? `${(d.stats?.spendingMonth ?? 0).toLocaleString()} F` : '…',
      cancellationRate: d ? `${d.cancellationRate}%` : '…',
    }
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['all', 'Tous'], ['ACTIVE', 'Actifs'], ['PENDING', 'En attente'], ['SUSPENDED', 'Suspendus']].map(([s, label]) => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(0,119,182,.25)',
            background: filter === s ? 'var(--primary)' : 'rgba(255,255,255,.5)',
            color: filter === s ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <ExportPdfButton
            title="Comptes DEM Pro"
            filename={`dem-pro-${new Date().toISOString().slice(0, 10)}.pdf`}
            columns={[
              { header: 'Entreprise', key: 'businessName' },
              { header: 'Responsable', key: 'name' },
              { header: 'Téléphone', key: 'phone' },
              { header: 'Statut', key: 'status' },
              { header: 'Livraisons/jour', key: 'volume' },
              { header: 'Dépenses (mois)', key: 'spend' },
              { header: "Taux d'annulation", key: 'cancellationRate' },
            ]}
            rows={rows}
          />
          <button onClick={() => setModal({ kind: 'DEM_PRO_CREATE', targetUser: null })} style={btnPrimary}>
            <Plus size={14} /> Demander une création
          </button>
        </div>
      </div>

      <div style={{ ...glass, padding: '16px 18px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', padding: 20 }}>Chargement…</div>
        ) : accounts.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center' }}>Aucun compte DEM Pro.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr>
                {['Entreprise', 'Responsable', 'Téléphone', 'Secteur', 'Statut', 'Livraisons/jour', 'Dépenses (mois)', "Taux d'annulation", 'Actions'].map((h, i) => (
                  <th key={h} style={{ ...thStyle, ...(i === 0 ? stickyThCol : stickyTh) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => {
                const d = details[a.id]
                const label = a.proBusinessName ?? a.name ?? a.phone
                return (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, ...stickyCol, fontWeight: 600 }}>{a.proBusinessName ?? '—'}</td>
                    <td style={tdStyle}>{a.name ?? '—'}</td>
                    <td style={tdStyle}>{a.phone ? <a href={`tel:${a.phone}`} style={{ color: '#0077b6' }}>{a.phone}</a> : '—'}</td>
                    <td style={tdStyle}>{SECTOR_LABELS[a.proSector] ?? a.proSector ?? '—'}</td>
                    <td style={tdStyle}><StatusBadge status={a.isActive ? (a.proStatus ?? 'ACTIVE') : 'SUSPENDED'} /></td>
                    <td style={tdStyle}>{d?.stats?.deliveriesToday?.completed ?? '…'}</td>
                    <td style={tdStyle}>{d ? `${(d.stats?.spendingMonth ?? 0).toLocaleString()} F` : '…'}</td>
                    <td style={tdStyle}>{d ? `${d.cancellationRate}%` : '…'}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.isActive ? (
                          <button onClick={() => setModal({ kind: 'DEM_PRO_SUSPEND', targetUser: { id: a.id, label } })} style={{ ...btnSmall, color: '#dc2626', borderColor: '#dc2626' }}>
                            Demander suspension
                          </button>
                        ) : (
                          <button onClick={() => setModal({ kind: 'DEM_PRO_ACTIVATE', targetUser: { id: a.id, label } })} style={{ ...btnSmall, color: '#15803d', borderColor: '#15803d' }}>
                            Demander réactivation
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <SubmitRequestModal
          kind={modal.kind}
          targetUser={modal.targetUser}
          onClose={() => setModal(null)}
          onSubmitted={() => { setModal(null); alert('Demande envoyée pour validation.') }}
        />
      )}
    </div>
  )
}

const thStyle    = { textAlign: 'left', padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const tdStyle    = { padding: '10px 10px', verticalAlign: 'middle' }
const btnSmall   = { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)', background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }
const btnPrimary = { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
