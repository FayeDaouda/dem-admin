// Export CSV — zéro dépendance, s'ouvre nativement dans Excel/Google Sheets
// props: { filename, columns: [{header, key}], rows }
function csvEscape(value) {
  const str = String(value ?? '')
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function exportCsv({ filename, columns, rows }) {
  const header = columns.map(c => csvEscape(c.header)).join(',')
  const body = rows.map(r => columns.map(c => csvEscape(r[c.key])).join(',')).join('\n')
  const csv = '﻿' + header + '\n' + body // BOM pour un accentuation correcte dans Excel

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
