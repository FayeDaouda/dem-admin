import { Fragment } from 'react'
import { formatF, formatCount } from '../../../lib/format'

// Décomposition des revenus DEM (réponse de computeRevenue côté backend,
// admin.revenue.service.js) — une colonne par période. Même tableau dans le
// modal "Revenus" et l'onglet Revenus : un seul rendu, une seule lecture.
const ROWS = [
  { label: 'Frais de mise en relation sur les courses (facturés)', value: r => r.commission.billed, strong: true },
  { label: 'dont encaissée en ligne', value: r => r.commission.collectedOnline, indent: 1 },
  { label: 'dont reprise sur le wallet des coursiers (espèces)', value: r => r.commission.recoveredFromCash ?? 0, indent: 1 },
  { label: 'dont à recouvrer', value: r => r.commission.toRecover, indent: 1 },
  { label: 'cash, restée chez les coursiers', value: r => r.commission.toRecoverByChannel.cash, indent: 2 },
  { label: 'course pas encore payée', value: r => r.commission.toRecoverByChannel.unpaid, indent: 2 },
  { label: 'paiement en litige', value: r => r.commission.toRecoverByChannel.disputed, indent: 2 },
  { label: 'Pass coursiers achetés', value: r => r.pass.amount, detail: r => `${formatCount(r.pass.count)} achat(s)`, strong: true },
  { label: 'Abonnements DEM Pro', value: r => r.subscriptions.amount, detail: r => `${formatCount(r.subscriptions.count)} achat(s)`, strong: true },
  { label: 'Commission ventes DEM Pro (paiement intégré)', value: r => r.proSales.commission, detail: r => `${formatCount(r.proSales.count)} vente(s)`, strong: true },
  { label: 'Revenus facturés', value: r => r.totals.billed, total: true },
  { label: 'dont encaissés', value: r => r.totals.collected, indent: 1 },
  { label: 'Remises promo accordées (coût DEM)', value: r => -r.promoCost },
  { label: 'Net après remises', value: r => r.totals.net, total: true },
]

// `extra` (facultatif) : blocs supplémentaires dans les mêmes colonnes, ex.
// { title: 'Courses livrées', rows: [{ label, values: [...] }] } — une valeur
// null s'affiche « — » (période non fournie par le serveur).
export default function RevenueBreakdownTable({ columns, extra = [] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 360 + columns.length * 90 }}>
        <thead>
          <tr>
            <th style={th} />
            {columns.map(c => <th key={c.label} style={{ ...th, textAlign: 'right' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(row => (
            <tr key={row.label} style={{ borderTop: row.total ? '2px solid rgba(0,119,182,0.18)' : '1px solid rgba(0,0,0,0.04)' }}>
              <td style={{
                ...td,
                paddingLeft: 10 + (row.indent ?? 0) * 16,
                fontWeight: row.total ? 800 : row.strong ? 600 : 400,
                color: row.indent ? 'var(--text-muted)' : 'var(--text)',
              }}>
                {row.indent ? '↳ ' : ''}{row.label}
              </td>
              {columns.map(c => (
                <td key={c.label} style={{ ...td, textAlign: 'right', fontWeight: row.total ? 800 : row.strong ? 600 : 400, whiteSpace: 'nowrap' }}>
                  {formatF(row.value(c.rev))}
                  {row.detail && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{row.detail(c.rev)}</div>}
                </td>
              ))}
            </tr>
          ))}
          {extra.map(block => (<Fragment key={block.title}>
            <tr>
              <td colSpan={columns.length + 1} style={{ ...td, paddingTop: 18, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: '1px solid rgba(0,119,182,0.12)' }}>
                {block.title}
              </td>
            </tr>
            {block.rows.map(row => (
              <tr key={row.label} style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                <td style={{ ...td, fontWeight: row.strong ? 600 : 400 }}>{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={columns[i].label} style={{ ...td, textAlign: 'right', fontWeight: row.strong ? 600 : 400, whiteSpace: 'nowrap', color: v == null ? 'var(--text-muted)' : 'var(--text)' }}>
                    {v == null ? '—' : v}
                  </td>
                ))}
              </tr>
            ))}
          </Fragment>))}
        </tbody>
      </table>
    </div>
  )
}

const th = { textAlign: 'left', padding: '6px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, borderBottom: '1px solid rgba(0,119,182,0.12)' }
const td = { padding: '7px 10px', fontSize: 12.5 }
