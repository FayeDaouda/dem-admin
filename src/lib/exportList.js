// ============================================================
//  EXPORT DES LISTES — PDF, Word, Excel, même mise en page
//
//  En-tête DEM (logo, titre, filtres appliqués, nombre de lignes, date et
//  auteur), tableau aux couleurs de l'admin, pied « confidentiel » avec
//  numéro de page. Les bibliothèques sont chargées au premier export
//  seulement (elles pèsent lourd et la plupart des pages n'en ont pas besoin).
//
//  columns : [{ header, key, type?: 'text'|'number'|'date', decimals?: n,
//              width?: poids relatif, align?: 'left'|'center'|'right',
//              color?: row => hex }]
//  rows    : objets bruts (nombres en nombres, dates en Date ou ISO) — Excel
//            les garde typés (tri, filtres, sommes), PDF et Word les formatent.
// ============================================================

import logoUrl from '../assets/logo-export.png'

const NAVY  = '0F2942'
const CYAN  = '00B4D8'
const MUTED = '5A7A96'
const ZEBRA = 'F3F8FB'
const LINE  = 'DCE6EE'

export const EXPORT_FORMATS = [
  { key: 'pdf',  label: 'PDF',   ext: 'pdf' },
  { key: 'docx', label: 'Word',  ext: 'docx' },
  { key: 'xlsx', label: 'Excel', ext: 'xlsx' },
]

const CONFIDENTIAL = 'Document confidentiel : données personnelles, réservé à un usage interne DEM.'

// ── Valeurs ───────────────────────────────────────────────────────────────────

function toDate(v) {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

// Espaces insécables de toLocaleString('fr-FR') (U+202F, U+00A0) : absentes
// des polices standard du PDF, elles s'y afficheraient en caractères parasites.
const plainSpaces = s => s.replace(/[\u202f\u00a0]/g, ' ')

function display(col, row) {
  const v = row[col.key]
  if (v == null || v === '') return '—'
  if (col.type === 'date') return toDate(v)?.toLocaleDateString('fr-FR') ?? '—'
  if (col.type === 'number') return plainSpaces(Number(v).toLocaleString('fr-FR', { maximumFractionDigits: col.decimals ?? 0 }))
  return plainSpaces(String(v))
}

function cellValue(col, row) {
  const v = row[col.key]
  if (v == null || v === '') return null
  if (col.type === 'date') return toDate(v)
  if (col.type === 'number') return Number(v)
  return String(v)
}

const hexToRgb = hex => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
const cleanHex = c => (c ?? '').replace('#', '').toUpperCase() || null

function stamp(date = new Date()) {
  const d = date.toLocaleDateString('fr-FR')
  const t = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${d} à ${t}`
}

export function exportFileName(base, ext, date = new Date()) {
  const iso = date.toISOString().slice(0, 10)
  return `DEM-${base}-${iso}.${ext}`
}

function metaLine({ rows, unit, author, date }) {
  const n = rows.length
  const count = `${plainSpaces(n.toLocaleString('fr-FR'))} ${n > 1 ? unit.plural : unit.one}`
  return [count, `Exporté le ${stamp(date)}`, author ? `par ${author}` : null].filter(Boolean).join(' · ')
}

async function loadLogo() {
  const res = await fetch(logoUrl)
  return new Uint8Array(await res.arrayBuffer())
}

function bytesToDataUrl(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return `data:image/png;base64,${btoa(bin)}`
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── PDF ───────────────────────────────────────────────────────────────────────

async function toPdf(spec, logo) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const { title, filters, columns, rows } = spec
  const landscape = columns.length > 5
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 14

  // Bandeau
  doc.setFillColor(...hexToRgb(NAVY))
  doc.rect(0, 0, W, 30, 'F')
  doc.setFillColor(...hexToRgb(CYAN))
  doc.rect(0, 30, W, 1.2, 'F')
  doc.addImage(bytesToDataUrl(logo), 'PNG', M, 6, 18, 18, 'logo', 'FAST')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(plainSpaces(title), M + 24, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...hexToRgb('9FD8EA'))
  doc.text('DEM · Administration', M + 24, 21.5)

  // Filtres et résumé
  let y = 40
  doc.setTextColor(...hexToRgb(NAVY))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(plainSpaces(metaLine(spec)), M, y)
  y += 5.5
  doc.setFont('helvetica', filters.length ? 'normal' : 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...hexToRgb(MUTED))
  const lines = doc.splitTextToSize(plainSpaces(filters.length ? `Filtres : ${filters.join(' · ')}` : 'Aucun filtre : liste complète'), W - 2 * M)
  doc.text(lines, M, y)
  y += (lines.length - 1) * 4

  const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
  const usable = W - 2 * M
  autoTable(doc, {
    startY: y + 5,
    margin: { left: M, right: M, top: 18, bottom: 16 },
    head: [columns.map(c => c.header)],
    body: rows.map(r => columns.map(c => display(c, r))),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.9, bottom: 1.9, left: 2.6, right: 2.6 }, textColor: hexToRgb(NAVY), lineColor: hexToRgb(LINE), overflow: 'linebreak' },
    headStyles: { fillColor: hexToRgb(NAVY), textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: hexToRgb(ZEBRA) },
    bodyStyles: { lineWidth: { bottom: 0.15 } },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, {
      cellWidth: usable * (c.width ?? 1) / totalWeight,
      halign: c.align ?? (c.type === 'number' ? 'right' : 'left'),
      ...(i === 0 ? { fontStyle: 'bold' } : {}),
    }])),
    didParseCell: data => {
      if (data.section === 'head') data.cell.styles.halign = columns[data.column.index].align ?? (columns[data.column.index].type === 'number' ? 'right' : 'left')
      if (data.section !== 'body') return
      const col = columns[data.column.index]
      const color = cleanHex(col.color?.(rows[data.row.index]))
      if (color) { data.cell.styles.textColor = hexToRgb(color); data.cell.styles.fontStyle = 'bold' }
    },
    // Rappel du titre en haut des pages suivantes
    didDrawPage: data => {
      if (data.pageNumber === 1) return
      doc.setFillColor(...hexToRgb(NAVY))
      doc.rect(0, 0, W, 10, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(255, 255, 255)
      doc.text(plainSpaces(`DEM · ${title}`), M, 6.5)
    },
  })

  // Pieds de page (une fois le nombre total de pages connu)
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...hexToRgb(LINE))
    doc.setLineWidth(0.2)
    doc.line(M, H - 11, W - M, H - 11)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...hexToRgb(MUTED))
    doc.text(CONFIDENTIAL, M, H - 6.5)
    doc.text(`Page ${p} / ${pages}`, W - M, H - 6.5, { align: 'right' })
  }

  doc.setProperties({ title: `DEM · ${title}`, author: spec.author ?? 'DEM', creator: 'DEM Admin' })
  return doc.output('blob')
}

// ── Excel ─────────────────────────────────────────────────────────────────────

async function toXlsx(spec, logo) {
  const { default: ExcelJS } = await import('exceljs')
  const { title, filters, columns, rows } = spec
  const wb = new ExcelJS.Workbook()
  wb.creator = spec.author ?? 'DEM Admin'
  wb.created = spec.date
  wb.title = `DEM · ${title}`

  const ws = wb.addWorksheet(title.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: { orientation: columns.length > 5 ? 'landscape' : 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '5:5', margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
    headerFooter: { oddFooter: `&L&8${CONFIDENTIAL}&R&8Page &P / &N` },
  })
  const last = columns.length

  // En-tête : logo à gauche, titre décalé à sa droite
  ws.getRow(1).height = 28
  ws.getRow(2).height = 16
  ws.getRow(3).height = 16
  ws.getRow(4).height = 8
  const logoId = wb.addImage({ base64: bytesToDataUrl(logo), extension: 'png' })
  ws.addImage(logoId, { tl: { col: 0.15, row: 0.2 }, ext: { width: 52, height: 52 } })
  for (let r = 1; r <= 3; r++) ws.mergeCells(r, 1, r, last)
  const indent = 9
  Object.assign(ws.getCell(1, 1), {
    value: title,
    font: { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF' + NAVY } },
    alignment: { vertical: 'middle', indent },
  })
  Object.assign(ws.getCell(2, 1), {
    value: metaLine(spec),
    font: { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + CYAN } },
    alignment: { vertical: 'middle', indent },
  })
  Object.assign(ws.getCell(3, 1), {
    value: filters.length ? `Filtres : ${filters.join(' · ')}` : 'Aucun filtre : liste complète',
    font: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF' + MUTED } },
    alignment: { vertical: 'middle', indent },
  })

  // Tableau
  const headRow = ws.getRow(5)
  headRow.height = 24
  columns.forEach((c, i) => {
    const cell = headRow.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + NAVY } }
    cell.alignment = { vertical: 'middle', horizontal: c.align ?? (c.type === 'number' ? 'right' : 'left'), indent: 1 }
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF' + CYAN } } }
  })

  rows.forEach((r, ri) => {
    const row = ws.getRow(6 + ri)
    row.height = 20
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1)
      cell.value = cellValue(c, r)
      const color = cleanHex(c.color?.(r))
      cell.font = { name: 'Calibri', size: 10, bold: i === 0 || !!color, color: { argb: 'FF' + (color ?? NAVY) } }
      cell.alignment = { vertical: 'middle', horizontal: c.align ?? (c.type === 'number' ? 'right' : 'left'), indent: 1, wrapText: false }
      if (c.type === 'date') cell.numFmt = 'dd/mm/yyyy'
      if (c.type === 'number') cell.numFmt = c.decimals ? `#,##0.${'0'.repeat(c.decimals)}` : '#,##0'
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + ZEBRA } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF' + LINE } } }
    })
  })

  // Largeurs : selon le contenu le plus long, bornées
  columns.forEach((c, i) => {
    const longest = Math.max(c.header.length, ...rows.slice(0, 2000).map(r => display(c, r).length))
    ws.getColumn(i + 1).width = Math.min(48, Math.max(i === 0 ? 26 : 12, longest + 4))
  })

  if (rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + rows.length, column: last } }

  const buffer = await wb.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ── Word ──────────────────────────────────────────────────────────────────────

async function toDocx(spec, logo) {
  const d = await import('docx')
  const { title, filters, columns, rows } = spec
  const landscape = columns.length > 5
  const FONT = 'Calibri'

  // Largeur utile en twips (A4 : 11906 × 16838 ; marges 720 = 1,27 cm)
  const pageW = landscape ? 16838 : 11906
  const margin = 720
  const usable = pageW - 2 * margin
  const totalWeight = columns.reduce((s, c) => s + (c.width ?? 1), 0)
  const widths = columns.map(c => Math.floor(usable * (c.width ?? 1) / totalWeight))

  const noBorder = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const thin = { style: d.BorderStyle.SINGLE, size: 4, color: LINE }
  const align = c => ({ center: d.AlignmentType.CENTER, right: d.AlignmentType.RIGHT })[c.align ?? (c.type === 'number' ? 'right' : 'left')] ?? d.AlignmentType.LEFT

  const headerRow = new d.TableRow({
    tableHeader: true,
    height: { value: 440, rule: d.HeightRule.ATLEAST },
    children: columns.map((c, i) => new d.TableCell({
      width: { size: widths[i], type: d.WidthType.DXA },
      shading: { type: d.ShadingType.CLEAR, fill: NAVY, color: 'auto' },
      verticalAlign: d.VerticalAlign.CENTER,
      margins: { left: 100, right: 100 },
      borders: { top: noBorder, left: noBorder, right: noBorder, bottom: { style: d.BorderStyle.SINGLE, size: 12, color: CYAN } },
      children: [new d.Paragraph({ alignment: align(c), children: [new d.TextRun({ text: c.header, bold: true, color: 'FFFFFF', size: 18, font: FONT })] })],
    })),
  })

  const bodyRows = rows.map((r, ri) => new d.TableRow({
    cantSplit: true,
    height: { value: 360, rule: d.HeightRule.ATLEAST },
    children: columns.map((c, i) => {
      const color = cleanHex(c.color?.(r))
      return new d.TableCell({
        width: { size: widths[i], type: d.WidthType.DXA },
        shading: ri % 2 === 1 ? { type: d.ShadingType.CLEAR, fill: ZEBRA, color: 'auto' } : undefined,
        verticalAlign: d.VerticalAlign.CENTER,
        margins: { left: 100, right: 100 },
        borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin },
        children: [new d.Paragraph({ alignment: align(c), children: [new d.TextRun({ text: display(c, r), bold: i === 0 || !!color, color: color ?? NAVY, size: 17, font: FONT })] })],
      })
    }),
  }))

  const banner = new d.Table({
    width: { size: usable, type: d.WidthType.DXA },
    layout: d.TableLayoutType.FIXED,
    columnWidths: [1100, usable - 1100],
    borders: { top: noBorder, bottom: { style: d.BorderStyle.SINGLE, size: 18, color: CYAN }, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [new d.TableRow({
      children: [
        new d.TableCell({
          width: { size: 1100, type: d.WidthType.DXA },
          shading: { type: d.ShadingType.CLEAR, fill: NAVY, color: 'auto' },
          verticalAlign: d.VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 160, right: 0 },
          children: [new d.Paragraph({ children: [new d.ImageRun({ type: 'png', data: logo, transformation: { width: 46, height: 46 } })] })],
        }),
        new d.TableCell({
          width: { size: usable - 1100, type: d.WidthType.DXA },
          shading: { type: d.ShadingType.CLEAR, fill: NAVY, color: 'auto' },
          verticalAlign: d.VerticalAlign.CENTER,
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new d.Paragraph({ children: [new d.TextRun({ text: title, bold: true, color: 'FFFFFF', size: 36, font: FONT })] }),
            new d.Paragraph({ children: [new d.TextRun({ text: 'DEM · Administration', color: '9FD8EA', size: 18, font: FONT })] }),
          ],
        }),
      ],
    })],
  })

  const footer = () => new d.Footer({ children: [new d.Paragraph({
    border: { top: { style: d.BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
    tabStops: [{ type: d.TabStopType.RIGHT, position: usable }],
    children: [
      new d.TextRun({ text: CONFIDENTIAL, color: MUTED, size: 14, font: FONT }),
      new d.TextRun({ children: ['\tPage ', d.PageNumber.CURRENT, ' / ', d.PageNumber.TOTAL_PAGES], color: MUTED, size: 14, font: FONT }),
    ],
  })] })

  const doc = new d.Document({
    creator: spec.author ?? 'DEM Admin',
    title: `DEM · ${title}`,
    styles: { default: { document: { run: { font: FONT, size: 18, color: NAVY } } } },
    sections: [{
      properties: {
        titlePage: true, // 1re page : le bandeau suffit, pas de rappel du titre en haut
        page: {
          size: { orientation: landscape ? d.PageOrientation.LANDSCAPE : d.PageOrientation.PORTRAIT, width: 11906, height: 16838 },
          margin: { top: margin, bottom: margin, left: margin, right: margin, header: 360, footer: 360 },
        },
      },
      headers: {
        first: new d.Header({ children: [new d.Paragraph({ children: [] })] }),
        default: new d.Header({ children: [new d.Paragraph({ alignment: d.AlignmentType.RIGHT, children: [new d.TextRun({ text: `DEM · ${title}`, color: MUTED, size: 14, font: FONT })] })] }),
      },
      footers: { first: footer(), default: footer() },
      children: [
        banner,
        new d.Paragraph({ spacing: { before: 220, after: 60 }, children: [new d.TextRun({ text: metaLine(spec), bold: true, color: NAVY, size: 20, font: FONT })] }),
        new d.Paragraph({ spacing: { after: 200 }, children: [new d.TextRun({ text: filters.length ? `Filtres : ${filters.join(' · ')}` : 'Aucun filtre : liste complète', italics: true, color: MUTED, size: 17, font: FONT })] }),
        new d.Table({
          width: { size: usable, type: d.WidthType.DXA },
          layout: d.TableLayoutType.FIXED,
          columnWidths: widths,
          borders: { top: noBorder, left: noBorder, right: noBorder, insideVertical: noBorder, bottom: thin, insideHorizontal: thin },
          rows: [headerRow, ...bodyRows],
        }),
      ],
    }],
  })
  return d.Packer.toBlob(doc)
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

/**
 * @param {'pdf'|'docx'|'xlsx'} format
 * @param {{ title, fileBase, unit: {one, plural}, filters?: string[], columns, rows, author? }} spec
 */
export async function exportList(format, spec) {
  const full = { filters: [], ...spec, date: new Date() }
  const logo = await loadLogo()
  const blob = format === 'pdf'  ? await toPdf(full, logo)
    : format === 'docx'          ? await toDocx(full, logo)
    :                              await toXlsx(full, logo)
  const ext = EXPORT_FORMATS.find(f => f.key === format)?.ext ?? format
  download(blob, exportFileName(spec.fileBase, ext, full.date))
}

// Toutes les pages d'une liste paginée par le serveur, avec les mêmes filtres.
export async function fetchAllPages(api, url, params, listKey, pageSize = 200) {
  const out = []
  for (let page = 1; ; page++) {
    const res = await api.get(url, { params: { ...params, page, limit: pageSize } })
    const items = res.data?.[listKey] ?? []
    out.push(...items)
    const total = res.data?.total ?? out.length
    if (items.length < pageSize || out.length >= total) return out
  }
}
