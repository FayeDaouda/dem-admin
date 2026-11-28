// Export CSV de l'espace DEM Pro : « ; » + BOM pour qu'Excel (réglages
// français) ouvre le fichier en colonnes, accents compris — même format que
// l'export des livraisons.
export function downloadCsv(filename, head, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/[\u202f\u00a0]/g, ' ').replace(/"/g, '""')}"`
  const lines = [head, ...rows].map(r => r.map(cell).join(';'))
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Date et heure de Dakar lisibles dans un tableur : « 25/11/2026 14:05 »
export function csvDate(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`
}

// Montant des articles d'une course (prix × quantité)
export const itemsTotal = (o) => (Array.isArray(o?.items) ? o.items : [])
  .reduce((s, it) => s + (Number(it?.price) || 0) * (Number(it?.quantity) || 1), 0)
