// ============================================================
//  BONS DE LIVRAISON À IMPRIMER — espace web DEM Pro
//
//  Une étiquette par livraison, à coller sur le colis : boutique,
//  référence, destinataire, téléphone, adresse et repère, type de colis
//  (Fragile en évidence), montant à encaisser et QR code du lien de suivi
//  (GET /orders/:id/share-link, fourni par l'appelant).
//  Formats : A4 avec 4 bons (A6) ou 6 bons par page, ou étiquette
//  10 × 15 cm (imprimante thermique). Couleurs du site dem.sn, angles vifs.
//  Généré dans le navigateur (jsPDF + qrcode chargés à la demande).
//  Heure de Dakar quel que soit le réglage de l'ordinateur.
// ============================================================

import { TZ, num, orderTotal } from '../lib/format'
import { itemsTotal } from './csv'
import { categoryOf } from './packageCategories'

const NAVY = [2, 21, 32]
const CYAN = [0, 210, 255]
const INK = [2, 21, 32]
const MUTED = [91, 107, 130]
const LIGHT = [148, 163, 184]
const LINE = [203, 213, 225]
const SOFT = [244, 247, 250]
const DANGER = [185, 28, 28]

export const LABEL_FORMATS = [
  { key: 'a4x4', title: 'A4 · 4 par page', hint: 'Bons au format A6, à découper', cols: 2, rows: 2 },
  { key: 'a4x6', title: 'A4 · 6 par page', hint: 'Plus compact, moins de papier', cols: 2, rows: 3 },
  { key: 'label', title: 'Étiquette 10 × 15 cm', hint: 'Imprimante d\'étiquettes, un bon par étiquette', cols: 1, rows: 1 },
]
const PAGE = { a4x4: 'a4', a4x6: 'a4', label: [100, 150] }

// Polices standard du PDF : jeu Latin-1 seulement (mêmes remplacements
// que les reçus, ReceiptPdf.js)
const clean = (s) => String(s ?? '')
  .replace(/[\u202f\u00a0\u2009\u2007]/g, ' ')
  .replace(/[‘’ʼ]/g, '\'')
  .replace(/[“”]/g, '"')
  .replace(/[–—−]/g, '-')
  .replace(/…/g, '...')
  .replace(/→/g, '->')
  .replace(/œ/g, 'oe').replace(/Œ/g, 'OE')
  // eslint-disable-next-line no-control-regex
  .replace(/[^\x00-\xff]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const money = (n) => `${num(n).replace(/\u00a0/g, ' ')} FCFA`
const shortRef = (id) => String(id ?? '').slice(0, 8).toUpperCase()
const phoneTxt = (p) => {
  const d = String(p ?? '').replace(/\D/g, '').replace(/^221/, '')
  return d.length === 9 ? `+221 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : clean(p)
}
const valid = (d) => d && !Number.isNaN(new Date(d).getTime())
const stampOf = (d) => valid(d)
  ? clean(new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TZ }))
  : ''

// Ce que le coursier demande au destinataire : articles (sauf déjà payés en
// ligne) + livraison quand le client la paie et ne l'a pas encore réglée.
export function dueOf(o) {
  const paidByClient = o?.paymentMode !== 'merchant' && o?.paymentStatus === 'PAID'
  const prepaid = o?.proPaymentMode === 'PREPAID_LINK' || paidByClient
  const articles = prepaid ? 0 : Math.max(0, itemsTotal(o))
  const delivery = o?.paymentMode === 'merchant' || paidByClient ? 0 : Math.max(0, orderTotal(o))
  return { articles, delivery, total: articles + delivery, prepaid }
}

// Description écrite à la création : articles · note · Repère : … · Adresse indiquée : …
function splitDescription(o) {
  const items = Array.isArray(o?.items) ? o.items : []
  const itemsText = items.map(i => `${i.name} ×${i.quantity ?? 1}`).join(', ')
  const out = { landmark: '', typed: '', notes: [] }
  for (const raw of String(o?.description ?? '').split(' · ')) {
    const t = raw.trim()
    if (!t) continue
    let m
    if ((m = t.match(/^Repère\s*:\s*(.*)$/))) out.landmark = m[1]
    else if ((m = t.match(/^Adresse indiquée\s*:\s*(.*)$/))) out.typed = m[1]
    else if (t !== itemsText) out.notes.push(t)
  }
  return out
}

// Lignes coupées à la largeur, `max` au plus (« ... » sur la dernière)
function lines(doc, text, width, max) {
  const s = clean(text)
  if (!s) return []
  const all = doc.splitTextToSize(s, width)
  if (all.length <= max) return all
  const kept = all.slice(0, max)
  let last = kept[max - 1]
  while (last.length > 1 && doc.getTextWidth(`${last}...`) > width) last = last.slice(0, -1)
  kept[max - 1] = `${last.trimEnd()}...`
  return kept
}

const lh = (pt) => pt * 0.3528 * 1.18 // hauteur de ligne (mm) pour une taille en points

function textRight(doc, str, x, y, charSpace = 0) {
  const s = clean(str)
  const w = doc.getTextWidth(s) + charSpace * Math.max(0, s.length - 1)
  doc.text(s, x - w, y, charSpace ? { charSpace } : undefined)
}

function caps(doc, str, x, y, { color = MUTED, size = 6.5 } = {}) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(...color)
  doc.text(clean(str).toUpperCase(), x, y, { charSpace: 0.35 })
}

// Petite pastille (type de colis, Fragile) ; renvoie sa largeur
function tag(doc, text, x, y, { filled, color = INK, size = 7 }) {
  const s = clean(text).toUpperCase()
  doc.setFont('helvetica', 'bold'); doc.setFontSize(size)
  const w = doc.getTextWidth(s) + 0.3 * (s.length - 1) + 5
  const h = size * 0.3528 + 3
  if (filled) { doc.setFillColor(...color); doc.rect(x, y, w, h, 'F'); doc.setTextColor(255, 255, 255) }
  else { doc.setDrawColor(...color); doc.setLineWidth(0.35); doc.rect(x, y, w, h, 'S'); doc.setTextColor(...color) }
  doc.text(s, x + 2.5, y + h - 1.55, { charSpace: 0.3 })
  return w
}

// ── Un bon ───────────────────────────────────────────────────────────────────
function drawLabel(doc, o, box, { compact, shopName, qr }) {
  const pad = compact ? 5 : 6
  const X = box.x + pad
  const Y = box.y + pad
  const W = box.w - 2 * pad
  const H = box.h - 2 * pad
  const R = X + W

  // Cadre fin (repère de découpe et de collage)
  doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.rect(X, Y, W, H, 'S')

  // Bandeau : boutique à gauche, référence à droite
  const bh = compact ? 11.5 : 13.5
  doc.setFillColor(...NAVY); doc.rect(X, Y, W, bh, 'F')
  doc.setFillColor(...CYAN); doc.rect(X, Y + bh, W, 0.8, 'F')
  const ref = `N° ${shortRef(o.id)}`
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 9 : 10)
  const refW = doc.getTextWidth(ref)
  doc.setFontSize(compact ? 9.5 : 11); doc.setTextColor(255, 255, 255)
  const shop = lines(doc, shopName || 'Ma boutique', W - refW - 12, 1)[0] ?? ''
  doc.text(shop, X + 3.5, Y + (compact ? 5.2 : 6))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...LIGHT)
  doc.text('Bon de livraison DEM  ·  dem.sn', X + 3.5, Y + (compact ? 8.9 : 10.3))
  doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 9 : 10); doc.setTextColor(...CYAN)
  textRight(doc, ref, R - 3.5, Y + (compact ? 5.2 : 6))
  const created = stampOf(o.createdAt)
  if (created) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...LIGHT)
    textRight(doc, created, R - 3.5, Y + (compact ? 8.9 : 10.3))
  }

  // Zone du bas : montant à encaisser + pied (réservée d'abord)
  const due = dueOf(o)
  const blockH = compact ? 12 : 14
  const footH = 4.5
  const blockY = Y + H - footH - blockH - 1.5
  const breakdown = due.articles > 0 && due.delivery > 0
    ? `Articles ${money(due.articles)} + livraison ${money(due.delivery)}`
    : null
  const bottomLimit = blockY - (breakdown ? 5 : 2.5)

  // Corps
  const inner = 3.5
  const bx = X + inner
  const bw = W - 2 * inner
  const qs = qr ? (compact ? 22 : 28) : 0
  let cy = Y + bh + 0.8 + (compact ? 5 : 6)
  const tw = qr ? bw - qs - 4 : bw

  if (qr) {
    const qy = cy - 2.5
    doc.addImage(qr, 'PNG', R - inner - qs, qy, qs, qs, `qr-${o.id}`, 'FAST')
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...MUTED)
    const cap = 'Suivi en direct'
    doc.text(cap, R - inner - qs / 2 - doc.getTextWidth(cap) / 2, qy + qs + 3)
  }
  const qrBottom = qr ? cy - 2.5 + qs + 4.5 : 0

  caps(doc, 'Destinataire', bx, cy)
  cy += compact ? 4.2 : 4.8
  const nameSize = compact ? 12 : 14.5
  doc.setFont('helvetica', 'bold'); doc.setFontSize(nameSize); doc.setTextColor(...INK)
  for (const l of lines(doc, o.receiverName || 'Client', tw, compact ? 1 : 2)) { doc.text(l, bx, cy); cy += lh(nameSize) }
  const phoneSize = compact ? 10.5 : 12
  doc.setFontSize(phoneSize)
  if (o.receiverPhone) { doc.text(phoneTxt(o.receiverPhone), bx, cy); cy += lh(phoneSize) }

  cy += compact ? 1.2 : 2
  caps(doc, 'Adresse', bx, cy)
  cy += compact ? 3.9 : 4.4
  const desc = splitDescription(o)
  const addrSize = compact ? 8.5 : 9.5
  doc.setFont('helvetica', 'bold'); doc.setFontSize(addrSize); doc.setTextColor(...INK)
  for (const l of lines(doc, o.deliveryAddress, tw, 2)) { doc.text(l, bx, cy); cy += lh(addrSize) }
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED)
  if (desc.typed && clean(desc.typed).toLowerCase() !== clean(o.deliveryAddress).toLowerCase()) {
    for (const l of lines(doc, desc.typed, tw, 1)) { doc.text(l, bx, cy); cy += lh(addrSize) }
  }
  if (desc.landmark) {
    doc.setTextColor(...INK)
    for (const l of lines(doc, `Repère : ${desc.landmark}`, tw, compact ? 1 : 2)) { doc.text(l, bx, cy); cy += lh(addrSize) }
  }

  // Sous le QR : pleine largeur
  cy = Math.max(cy + 1.5, qrBottom)

  // Type de colis, Fragile, Express
  const cat = categoryOf(o.packageCategory)
  const tags = [
    cat ? [cat.label, { filled: false }] : null,
    o.isFragile ? ['Fragile', { filled: true, color: DANGER }] : null,
    o.priority === 'EXPRESS' ? ['Express', { filled: true, color: NAVY }] : null,
  ].filter(Boolean)
  if (tags.length && cy + 6 <= bottomLimit) {
    let tx = bx
    for (const [t, opt] of tags) tx += tag(doc, t, tx, cy - 1, { ...opt, size: compact ? 6.5 : 7 }) + 2
    cy += compact ? 7 : 8
  }

  // Articles et note, tant qu'il reste de la place
  const small = compact ? 7.5 : 8.5
  const items = Array.isArray(o.items) ? o.items : []
  const blocks = [
    items.length ? `Articles : ${items.map(i => `${i.name} ×${i.quantity ?? 1}`).join(', ')}` : null,
    desc.notes.length ? `Note : ${desc.notes.join(' · ')}` : null,
  ].filter(Boolean)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(small); doc.setTextColor(...MUTED)
  for (const b of blocks) {
    const room = Math.floor((bottomLimit - cy + 1) / lh(small))
    if (room < 1) break
    for (const l of lines(doc, b, bw, Math.min(2, room))) { doc.text(l, bx, cy); cy += lh(small) }
    cy += 0.8
  }

  // Montant à encaisser
  if (breakdown) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED)
    textRight(doc, breakdown, R - inner, blockY - 1.8)
  }
  const bX = X + inner
  const bW = W - 2 * inner
  if (due.total > 0) {
    doc.setFillColor(...NAVY); doc.rect(bX, blockY, bW, blockH, 'F')
    doc.setFillColor(...CYAN); doc.rect(bX, blockY, 1.2, blockH, 'F')
    caps(doc, 'À encaisser', bX + 4.5, blockY + blockH / 2 + 1.1, { color: [255, 255, 255], size: compact ? 7 : 7.5 })
    doc.setFont('helvetica', 'bold'); doc.setFontSize(compact ? 13 : 16); doc.setTextColor(255, 255, 255)
    textRight(doc, money(due.total), bX + bW - 4, blockY + blockH / 2 + (compact ? 1.7 : 2.1))
  } else {
    doc.setFillColor(...SOFT); doc.rect(bX, blockY, bW, blockH, 'F')
    doc.setDrawColor(...LINE); doc.setLineWidth(0.25); doc.rect(bX, blockY, bW, blockH, 'S')
    caps(doc, 'Rien à encaisser', bX + 4.5, blockY + blockH / 2 + 1.1, { color: INK, size: compact ? 7 : 7.5 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(compact ? 7.5 : 8); doc.setTextColor(...MUTED)
    textRight(doc, due.prepaid ? 'Déjà payé en ligne' : 'Livraison payée par la boutique', bX + bW - 4, blockY + blockH / 2 + 1.1)
  }

  // Pied
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...LIGHT)
  doc.text(qr ? 'Scannez le QR code pour suivre le coursier en direct.' : 'Livraison DEM à Dakar.', bX, Y + H - 2.6)
  textRight(doc, 'dem.sn', R - inner, Y + H - 2.6)
}

// Traits de découpe entre les bons (pointillés)
function cutLines(doc, f, pw, ph) {
  doc.setDrawColor(...LIGHT); doc.setLineWidth(0.2)
  doc.setLineDashPattern([1.6, 1.6], 0)
  for (let c = 1; c < f.cols; c++) doc.line((pw / f.cols) * c, 0, (pw / f.cols) * c, ph)
  for (let r = 1; r < f.rows; r++) doc.line(0, (ph / f.rows) * r, pw, (ph / f.rows) * r)
  doc.setLineDashPattern([], 0)
}

async function qrImage(QRCode, url) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 0, width: 320, color: { dark: '#021520', light: '#FFFFFF' } })
}

/**
 * @param {object[]} orders livraisons (forme de GET /orders/my ou de POST /orders)
 * @param {{ format?: 'a4x4'|'a4x6'|'label', shopName?: string, links?: Record<string,string> }} opts
 *   links : id de livraison → lien de suivi (QR code) ; sans lien, pas de QR.
 */
export async function buildLabelsPdf(orders, { format = 'a4x4', shopName = '', links = {} } = {}) {
  const f = LABEL_FORMATS.find(x => x.key === format) ?? LABEL_FORMATS[0]
  const needQr = orders.some(o => links[o.id])
  const [{ default: JsPDF }, qrMod] = await Promise.all([import('jspdf'), needQr ? import('qrcode') : Promise.resolve(null)])
  const QRCode = qrMod ? (qrMod.default ?? qrMod) : null
  const page = PAGE[f.key]
  const doc = new JsPDF({ unit: 'mm', format: page, orientation: 'portrait', compress: true })
  doc.setProperties({ title: 'Bons de livraison', creator: 'DEM Pro' })
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  const cw = pw / f.cols
  const ch = ph / f.rows
  const per = f.cols * f.rows
  const compact = f.key === 'a4x6'

  for (let i = 0; i < orders.length; i++) {
    const o = orders[i]
    const slot = i % per
    if (i > 0 && slot === 0) doc.addPage(page, 'portrait')
    if (slot === 0 && per > 1) cutLines(doc, f, pw, ph)
    let qr = null
    if (QRCode && links[o.id]) { try { qr = await qrImage(QRCode, links[o.id]) } catch { qr = null } }
    drawLabel(doc, o, { x: (slot % f.cols) * cw, y: Math.floor(slot / f.cols) * ch, w: cw, h: ch }, { compact, shopName, qr })
  }
  return doc
}

export const labelsFileName = (count) => {
  const day = new Date().toISOString().slice(0, 10) // jour à Dakar (UTC)
  return count === 1 ? `bon-livraison-dem-${day}.pdf` : `bons-livraison-dem-${day}.pdf`
}
