// ============================================================
//  REÇUS ET FACTURES PDF — espace web DEM Pro
//
//  Générés dans le navigateur (jsPDF + jspdf-autotable, chargés au premier
//  téléchargement seulement), aux couleurs du site dem.sn : bandeau bleu
//  nuit, filet cyan, angles vifs. Mêmes contenus que l'app :
//   - reçu d'une livraison (dem_pro_receipt_screen.dart) : document DEM ;
//   - facture d'une commande (utils/dem_pro_invoice.dart) : document au nom
//     du commerçant (NINEA, RCCM), articles + livraison ;
//   - facture récapitulative d'une période (GET /dem-pro/me/invoice-batch,
//     offre Premium).
//  Heure de Dakar (UTC) quel que soit le réglage de l'ordinateur.
// ============================================================

import logoUrl from '../../assets/logo-export.png'
import { ORDER_STATUS, TZ, num, orderTotal } from '../lib/format'
import { itemsTotal } from './csv'

const NAVY = [2, 21, 32]
const CYAN = [0, 210, 255]
const INK = [2, 21, 32]
const MUTED = [91, 107, 130]
const LIGHT = [148, 163, 184]
const LINE = [226, 232, 240]
const SOFT = [244, 247, 250]
const W = 210
const H = 297
const M = 16

// Polices standard du PDF : jeu Latin-1 seulement. Espaces fines, guillemets
// courbes, tirets longs, flèches… remplacés par leur équivalent simple.
const clean = (s) => String(s ?? '')
  .replace(/[\u202f\u00a0\u2009\u2007]/g, ' ')
  .replace(/[‘’ʼ]/g, '\'')
  .replace(/[“”]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/→/g, '->')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
  .replace(/€/g, 'EUR')
  // eslint-disable-next-line no-control-regex
  .replace(/[^\x00-\xff]/g, '')
  .trim()

const money = (n) => `${num(n).replace(/\u00a0/g, ' ')} FCFA`
const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()
const valid = (d) => d && !Number.isNaN(new Date(d).getTime())
const dateTimeLong = (d) => valid(d)
  ? clean(new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }))
  : '-'
const dateLong = (d) => valid(d)
  ? clean(new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }))
  : '-'
const dateShort = (d) => valid(d)
  ? clean(new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }))
  : '-'
const phoneTxt = (p) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^221/, '')
  return d.length === 9 ? `+221 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : clean(p)
}
function duration(a, b) {
  if (!valid(a) || !valid(b)) return null
  const min = Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

// Identité du commerçant (GET /users/me) — nom commercial, NINEA, RCCM
function merchantOf(user, extra = {}) {
  return {
    name: clean(extra.businessName || user?.proBusinessName || user?.companyName || extra.name || user?.name || ''),
    contact: clean(extra.businessName || user?.proBusinessName ? (extra.name || user?.name || '') : ''),
    phone: extra.phone || user?.phone || null,
    ninea: clean(extra.ninea || user?.proNinea || user?.ninea || ''),
    rccm: clean(user?.rccm || ''),
  }
}

// ── Mise en page commune ─────────────────────────────────────────────────────

async function newDoc() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new JsPDF({ unit: 'mm', format: 'a4', compress: true })
  doc.setFont('helvetica', 'normal')
  return { doc, autoTable }
}

let logoData = null
async function loadLogo() {
  if (logoData !== null) return logoData
  try {
    const blob = await (await fetch(logoUrl)).blob()
    logoData = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result)
      fr.onerror = reject
      fr.readAsDataURL(blob)
    })
  } catch { logoData = false }
  return logoData
}

// Texte aligné à droite avec espacement des lettres (capitales espacées)
function textRight(doc, str, x, y, charSpace = 0) {
  const s = clean(str)
  const w = doc.getTextWidth(s) + charSpace * Math.max(0, s.length - 1)
  doc.text(s, x - w, y, charSpace ? { charSpace } : undefined)
}

function caps(doc, str, x, y, { color = MUTED, size = 7.5 } = {}) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...color)
  doc.text(clean(str).toUpperCase(), x, y, { charSpace: 0.45 })
}

// Bandeau : marque DEM Pro (reçu, récapitulatif) ou nom du commerçant (facture)
async function band(doc, { brand, merchantName, title, ref, date }) {
  doc.setFillColor(...NAVY); doc.rect(0, 0, W, 36, 'F')
  doc.setFillColor(...CYAN); doc.rect(0, 36, W, 1.1, 'F')

  if (brand === 'dem') {
    const logo = await loadLogo()
    let x = M
    if (logo) { doc.addImage(logo, 'PNG', M, 10, 16, 16, 'dem-logo', 'FAST'); x = M + 21 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(255, 255, 255)
    doc.text('DEM', x, 19.5)
    const w = doc.getTextWidth('DEM ')
    doc.setTextColor(...CYAN); doc.text('Pro', x + w, 19.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT)
    doc.text('Livraison à Dakar  ·  dem.sn', x, 25.5)
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(255, 255, 255)
    const name = doc.splitTextToSize(clean(merchantName) || 'Mon entreprise', 112)[0]
    doc.text(name, M, 19.5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...LIGHT)
    doc.text('Facture émise avec DEM Pro', M, 25.5)
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255)
  textRight(doc, title.toUpperCase(), W - M, 16, 0.7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...CYAN)
  textRight(doc, ref, W - M, 22.5)
  if (date) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...LIGHT)
    textRight(doc, date, W - M, 28)
  }
}

// Bloc d'identité : surtitre, nom en gras, lignes secondaires. Renvoie le bas.
function block(doc, x, y, width, label, name, lines) {
  caps(doc, label, x, y)
  let cy = y + 6
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK)
  for (const l of doc.splitTextToSize(clean(name) || '-', width)) { doc.text(l, x, cy); cy += 4.8 }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED)
  for (const raw of lines.filter(Boolean)) {
    for (const l of doc.splitTextToSize(clean(raw), width)) { doc.text(l, x, cy); cy += 4.3 }
  }
  return cy
}

const tableBase = {
  theme: 'plain',
  margin: { left: M, right: M, top: 20, bottom: 24 },
  styles: { font: 'helvetica', fontSize: 9, textColor: INK, cellPadding: { top: 2.6, bottom: 2.6, left: 3, right: 3 }, overflow: 'linebreak', valign: 'middle' },
  headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
  bodyStyles: { lineColor: LINE, lineWidth: { bottom: 0.2 } },
  alternateRowStyles: { fillColor: SOFT },
  footStyles: { fillColor: [255, 255, 255], textColor: INK, fontStyle: 'bold', lineColor: NAVY, lineWidth: { top: 0.4 } },
}

// Lignes « libellé / valeur » (détails d'une course)
function details(doc, autoTable, y, rows) {
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: rows.filter(r => r && r[1]).map(([k, v]) => [clean(k), clean(v)]),
    alternateRowStyles: {},
    columnStyles: { 0: { cellWidth: 42, textColor: MUTED }, 1: { fontStyle: 'bold' } },
  })
  return doc.lastAutoTable.finalY
}

function ensureRoom(doc, y, need) {
  if (y + need <= H - 26) return y
  doc.addPage()
  return 22
}

// Totaux à droite ; dernière ligne sur fond bleu nuit, filet cyan
function totals(doc, y, rows, grand) {
  const bw = 86
  const x = W - M - bw
  y = ensureRoom(doc, y, rows.length * 6.5 + 18)
  doc.setFontSize(9.5)
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED)
    doc.text(clean(label), x + 3, y)
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK)
    textRight(doc, value, W - M - 3, y)
    y += 6.5
  }
  y -= 2
  doc.setFillColor(...NAVY); doc.rect(x, y, bw, 12, 'F')
  doc.setFillColor(...CYAN); doc.rect(x, y, 1.2, 12, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255)
  doc.text(clean(grand[0]).toUpperCase(), x + 5, y + 7.6, { charSpace: 0.5 })
  doc.setFontSize(12.5)
  textRight(doc, grand[1], W - M - 4, y + 8)
  return y + 12
}

function note(doc, y, text) {
  if (!text) return y
  y = ensureRoom(doc, y, 12)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED)
  const lines = doc.splitTextToSize(clean(text), W - 2 * M)
  doc.text(lines, M, y)
  return y + lines.length * 4
}

function footer(doc, text) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 16, W - M, H - 16)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...LIGHT)
    doc.text(clean(text), M, H - 11)
    textRight(doc, `Page ${i} / ${n}`, W - M, H - 11)
  }
}

function itemRows(items) {
  return items.map(it => {
    const q = Number(it?.quantity) || 1
    const p = Number(it?.price) || 0
    return [clean(it?.name) || 'Article', String(q), p ? money(p) : '-', p ? money(p * q) : '-']
  })
}

const itemColumns = {
  0: { cellWidth: 'auto' },
  1: { cellWidth: 16, halign: 'center' },
  2: { cellWidth: 34, halign: 'right' },
  3: { cellWidth: 36, halign: 'right', fontStyle: 'bold' },
}

// ── Reçu de livraison (document DEM) ─────────────────────────────────────────
export async function downloadReceiptPdf(order, user) {
  const o = order ?? {}
  const { doc, autoTable } = await newDoc()
  const ref = shortRef(o.id)
  const items = Array.isArray(o.items) ? o.items : []
  const me = merchantOf(user)

  await band(doc, { brand: 'dem', title: 'Reçu de livraison', ref: `N° ${ref}`, date: `Émis le ${dateLong(Date.now())}` })

  // Statut
  const st = ORDER_STATUS[o.status] ?? { label: o.status ?? '', color: '#475569', bg: '#F1F5F9' }
  const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  let y = 46
  const statusText = o.status === 'DELIVERED' && o.deliveredAt ? `${st.label} le ${dateTimeLong(o.deliveredAt)}` : st.label
  doc.setFillColor(...hex(st.bg)); doc.rect(M, y - 5, W - 2 * M, 9, 'F')
  doc.setFillColor(...hex(st.color)); doc.rect(M, y - 5, 1.2, 9, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...hex(st.color))
  doc.text(clean(statusText), M + 5, y + 0.8)

  y = 60
  const colW = (W - 2 * M - 10) / 2
  const left = block(doc, M, y, colW, 'Client DEM Pro', me.name || 'Compte DEM Pro', [
    me.contact, me.phone && phoneTxt(me.phone), me.ninea && `NINEA : ${me.ninea}`, me.rccm && `RCCM : ${me.rccm}`,
  ])
  const right = block(doc, M + colW + 10, y, colW, 'Destinataire', o.receiverName || 'Client', [
    o.receiverPhone && phoneTxt(o.receiverPhone), o.deliveryAddress,
  ])
  y = Math.max(left, right) + 6

  caps(doc, 'Course', M, y)
  const driver = o.driver?.name ? [o.driver.name, o.driver.vehiclePlate].filter(Boolean).join(' · ') : null
  y = details(doc, autoTable, y + 2, [
    ['Départ', o.pickupAddress],
    ['Arrivée', o.deliveryAddress],
    ['Colis', o.description],
    ['Coursier', driver],
    ['Créée le', dateTimeLong(o.createdAt)],
    ['Créée par', o.createdByName],
    ['Programmée pour', o.scheduledAt ? dateTimeLong(o.scheduledAt) : null],
    ['Livrée le', o.deliveredAt ? dateTimeLong(o.deliveredAt) : null],
    ['Durée', duration(o.createdAt, o.deliveredAt)],
  ]) + 8

  if (items.length) {
    y = ensureRoom(doc, y, 30)
    caps(doc, 'Articles', M, y)
    autoTable(doc, {
      ...tableBase,
      startY: y + 2,
      head: [['Article', 'Qté', 'Prix unitaire', 'Total']],
      body: itemRows(items),
      foot: [[{ content: 'Total articles', colSpan: 3 }, { content: money(itemsTotal(o)), styles: { halign: 'right' } }]],
      columnStyles: itemColumns,
      headStyles: { ...tableBase.headStyles, halign: 'left' },
    })
    y = doc.lastAutoTable.finalY + 10
  }

  const rows = [['Course', money(o.price)]]
  if (Number(o.demFee) > 0) rows.push(['Frais de mise en relation', money(o.demFee)])
  if (Number(o.discountAmount) > 0) rows.push(['Réduction', `- ${money(o.discountAmount)}`])
  y = totals(doc, y, rows, ['Total livraison', money(orderTotal(o))]) + 8
  note(doc, y, o.paymentMode === 'merchant'
    ? (o.paymentStatus === 'PAID' ? 'Livraison réglée en ligne par la boutique.' : 'Livraison à régler en ligne par la boutique.')
    : `Livraison payée par le destinataire au coursier${o.paymentStatus === 'PAID' ? ' (réglée)' : ''}.`)

  footer(doc, 'DEM · Plateforme de livraison à Dakar · dem.sn — Reçu généré depuis l\'espace DEM Pro.')
  doc.save(`recu-dem-${ref}.pdf`)
}

// ── Facture d'une commande (document du commerçant) ──────────────────────────
export async function downloadInvoicePdf(order, user) {
  const o = order ?? {}
  const { doc, autoTable } = await newDoc()
  const ref = shortRef(o.id)
  const items = Array.isArray(o.items) ? o.items : []
  const me = merchantOf(user)
  const delivery = orderTotal(o)
  const products = itemsTotal(o)

  await band(doc, { brand: 'merchant', merchantName: me.name, title: 'Facture', ref: `N° FACT-${ref}`, date: dateLong(o.createdAt) })

  let y = 48
  const colW = (W - 2 * M - 10) / 2
  const left = block(doc, M, y, colW, 'Émetteur', me.name || 'Mon entreprise', [
    me.contact, me.phone && phoneTxt(me.phone), me.ninea && `NINEA : ${me.ninea}`, me.rccm && `RCCM : ${me.rccm}`,
  ])
  const right = block(doc, M + colW + 10, y, colW, 'Facturé à', o.receiverName || 'Client', [
    o.receiverPhone && phoneTxt(o.receiverPhone), o.deliveryAddress,
  ])
  y = Math.max(left, right) + 4

  // Repères : date, livraison, référence
  const metas = [['Date de facture', dateLong(o.createdAt)], ['Livrée le', o.deliveredAt ? dateLong(o.deliveredAt) : '-'], ['Référence livraison', ref]]
  const mw = (W - 2 * M) / 3
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3)
  doc.line(M, y, W - M, y); doc.line(M, y + 14, W - M, y + 14)
  metas.forEach(([k, v], i) => {
    caps(doc, k, M + i * mw, y + 5.5, { size: 7 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK)
    doc.text(clean(v), M + i * mw, y + 10.8)
  })
  y += 22

  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Total']],
    body: items.length ? [...itemRows(items), ['Livraison', '1', money(delivery), money(delivery)]] : [['Livraison', '1', money(delivery), money(delivery)]],
    columnStyles: itemColumns,
  })
  y = doc.lastAutoTable.finalY + 10

  const rows = items.length ? [['Sous-total articles', money(products)], ['Frais de livraison', money(delivery)]] : []
  y = totals(doc, y, rows, ['Total à payer', money(products + delivery)]) + 8
  note(doc, y, 'Montants en francs CFA (FCFA).')

  footer(doc, `${me.name || 'Facture'} — facture générée avec DEM Pro · dem.sn`)
  doc.save(`facture-${ref}.pdf`)
}

// ── Facture récapitulative d'une période (offre Premium) ─────────────────────
// `batch` = réponse de GET /dem-pro/me/invoice-batch?period=…
export async function downloadInvoiceBatchPdf(batch, user) {
  const b = batch ?? {}
  const lines = Array.isArray(b.lines) ? b.lines : []
  const { doc, autoTable } = await newDoc()
  const me = merchantOf(user, b.business ?? {})
  const from = b.period?.from
  const to = b.period?.to
  const ymd = (d) => (valid(d) ? new Date(d).toISOString().slice(0, 10).replace(/-/g, '') : '')
  const ref = `REC-${ymd(from)}-${ymd(to)}`

  await band(doc, { brand: 'dem', title: 'Facture récapitulative', ref: `N° ${ref}`, date: `Émise le ${dateLong(Date.now())}` })

  let y = 48
  const colW = (W - 2 * M - 10) / 2
  const left = block(doc, M, y, colW, 'Client DEM Pro', me.name || 'Compte DEM Pro', [
    me.contact, me.phone && phoneTxt(me.phone), me.ninea && `NINEA : ${me.ninea}`, me.rccm && `RCCM : ${me.rccm}`,
  ])
  const right = block(doc, M + colW + 10, y, colW, 'Période', b.period?.label || '-', [
    `Du ${dateLong(from)} au ${dateLong(to)}`,
    `${b.lineCount ?? lines.length} livraison${(b.lineCount ?? lines.length) > 1 ? 's' : ''} effectuée${(b.lineCount ?? lines.length) > 1 ? 's' : ''}`,
  ])
  y = Math.max(left, right) + 6

  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Date', 'Réf.', 'Destinataire', 'Adresse de livraison', 'Montant']],
    body: lines.map(l => [
      dateShort(l.date), shortRef(l.orderId),
      [clean(l.receiverName) || '-', l.receiverPhone ? phoneTxt(l.receiverPhone) : null].filter(Boolean).join('\n'),
      clean(l.deliveryAddress) || '-', money(l.amount),
    ]),
    foot: [[{ content: `Total · ${lines.length} livraison${lines.length > 1 ? 's' : ''}`, colSpan: 4 }, { content: money(b.grandTotal), styles: { halign: 'right' } }]],
    columnStyles: {
      0: { cellWidth: 22 }, 1: { cellWidth: 20, font: 'courier', fontSize: 8.5 }, 2: { cellWidth: 42 },
      3: { cellWidth: 'auto' }, 4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  })
  y = doc.lastAutoTable.finalY + 10
  y = totals(doc, y, [['Livraisons', String(lines.length)]], ['Total de la période', money(b.grandTotal)]) + 8
  note(doc, y, 'Montant des livraisons effectuées (course et frais de mise en relation), en francs CFA (FCFA).')

  footer(doc, 'DEM · Plateforme de livraison à Dakar · dem.sn — Facture récapitulative générée depuis l\'espace DEM Pro.')
  doc.save(`facture-recapitulative-${b.period?.key ?? 'periode'}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
