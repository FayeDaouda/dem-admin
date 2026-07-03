import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Download } from 'lucide-react'

// props: { title, columns: [{header, key}], rows, filename }
export default function ExportPdfButton({ title, columns, rows, filename }) {
  function handleExport() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text(title, 14, 16)
    doc.setFontSize(9)
    doc.text(new Date().toLocaleString('fr-FR'), 14, 22)
    autoTable(doc, {
      startY: 26,
      head: [columns.map(c => c.header)],
      body: rows.map(r => columns.map(c => r[c.key] ?? '—')),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 119, 182] },
    })
    doc.save(filename)
  }

  return (
    <button onClick={handleExport} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
      borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,0.25)',
      background: 'rgba(255,255,255,0.5)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
    }}>
      <Download size={14} /> Exporter PDF
    </button>
  )
}
