// ============================================================
//  IMPORT DE LIVRAISONS — lecture du fichier (Excel .xlsx ou CSV),
//  correspondance des colonnes, lecture des valeurs (téléphone
//  sénégalais, montant, type de colis) et modèle Excel à télécharger.
//  Aucune requête ici : la vérification (adresse, prix) et la création
//  sont faites par la page (pages/ImportDeliveries.jsx).
// ============================================================

import { PACKAGE_CATEGORIES } from './packageCategories'

// Une livraison par ligne, une à la fois : le quota du serveur (500
// requêtes / 15 min par compte) est partagé avec le téléphone.
export const MAX_ROWS = 100
const MAX_FILE_BYTES = 5 * 1024 * 1024

// Champs reconnus. `aliases` : en-têtes acceptés (sans accents, minuscules).
export const FIELDS = [
  { key: 'name', label: 'Nom du destinataire', required: true, aliases: ['nom', 'nom du destinataire', 'destinataire', 'client', 'nom du client', 'nom client', 'name', 'nom complet', 'prenom et nom', 'receveur', 'beneficiaire'] },
  { key: 'phone', label: 'Téléphone', required: true, aliases: ['telephone', 'tel', 'phone', 'numero', 'numero de telephone', 'numero telephone', 'mobile', 'portable', 'contact', 'gsm', 'whatsapp', 'telephone du destinataire', 'telephone client'] },
  { key: 'address', label: 'Adresse', required: true, aliases: ['adresse', 'adresse de livraison', 'address', 'quartier', 'lieu', 'destination', 'localisation', 'zone', 'ville'] },
  { key: 'landmark', label: 'Repère', aliases: ['repere', 'reperes', 'indication', 'indications', 'landmark', 'precision', 'precisions', 'complement', 'complement d adresse'] },
  { key: 'amount', label: 'Montant à encaisser', aliases: ['montant', 'montant a encaisser', 'a encaisser', 'encaisser', 'prix', 'total', 'cod', 'amount', 'valeur', 'somme', 'prix articles', 'montant articles'] },
  { key: 'items', label: 'Articles', aliases: ['articles', 'article', 'produit', 'produits', 'items', 'contenu', 'designation', 'commande'] },
  { key: 'note', label: 'Note', aliases: ['note', 'notes', 'commentaire', 'commentaires', 'consigne', 'consignes', 'instructions', 'remarque', 'remarques', 'description'] },
  { key: 'category', label: 'Type de colis', aliases: ['type de colis', 'type', 'colis', 'categorie', 'category', 'type colis'] },
  { key: 'fragile', label: 'Fragile', aliases: ['fragile'] },
]

// ── Lecture du fichier ───────────────────────────────────────────────────────

export class ImportFileError extends Error {}

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// A, B, … Z, AA…
export function columnLetter(i) {
  let s = ''
  let n = i + 1
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s
}

// Valeur lisible d'une cellule Excel (texte riche, lien, formule, date…)
function cellValue(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100)
  if (typeof v === 'boolean') return v ? 'oui' : 'non'
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t?.text ?? '').join('')
    if ('result' in v) return cellValue(v.result)
    if (v.text != null) return cellValue(v.text)
    if (v.error) return ''
  }
  return String(v)
}

async function readXlsx(file) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(await file.arrayBuffer())
  } catch {
    throw new ImportFileError('Ce fichier Excel n\'a pas pu être lu. Enregistrez-le de nouveau au format .xlsx, ou en CSV.')
  }
  // Première feuille (celle du modèle) ; une feuille vide en tête est sautée
  const ws = wb.worksheets.find(s => s.actualRowCount > 0) ?? wb.worksheets[0]
  const rows = []
  ws?.eachRow({ includeEmpty: false }, (row) => {
    const cells = []
    for (let c = 1; c <= row.cellCount; c++) cells.push(cellValue(row.getCell(c).value).trim())
    rows.push({ line: row.number, cells })
  })
  return rows
}

// Excel (réglages français) enregistre souvent ses CSV en Windows-1252
function decodeText(buf) {
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.includes('\ufffd')) {
    try { text = new TextDecoder('windows-1252').decode(buf) } catch { /* utf-8 gardé */ }
  }
  return text.replace(/^\ufeff/, '')
}

// CSV : « ; », « , » ou tabulation (détecté sur la première ligne), guillemets
function parseCsv(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim()) ?? ''
  const count = (ch) => firstLine.split(ch).length - 1
  const delim = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0]
  const out = []
  let row = []
  let cell = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { row.push(cell.trim()); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(c => c !== '')) out.push({ line: rowLine, cells: row })
      row = []
      line++
      rowLine = line
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some(c => c !== '')) out.push({ line: rowLine, cells: row })
  return out
}

// → { fileName, rows: [{ line, cells }] } (lignes non vides, numéro de ligne du fichier)
export async function readSpreadsheet(file) {
  if (!file) throw new ImportFileError('Aucun fichier choisi.')
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (file.size > MAX_FILE_BYTES) throw new ImportFileError('Fichier trop lourd (5 Mo au plus). Gardez seulement la feuille des livraisons.')
  let rows
  if (ext === 'xlsx' || ext === 'xlsm') rows = await readXlsx(file)
  else if (ext === 'csv' || ext === 'txt') rows = parseCsv(decodeText(await file.arrayBuffer()))
  else if (ext === 'xls') throw new ImportFileError('Ancien format Excel (.xls) : dans Excel, faites « Enregistrer sous » puis choisissez .xlsx ou CSV.')
  else throw new ImportFileError('Format non pris en charge. Utilisez un fichier Excel (.xlsx) ou CSV.')
  rows = rows.filter(r => r.cells.some(c => c !== ''))
  if (!rows.length) throw new ImportFileError('Le fichier est vide.')
  return { fileName: file.name, rows }
}

// En-têtes (première ligne) ou « Colonne A, B… » sans ligne de titres
export function columnsOf(rows, hasHeader) {
  const width = Math.max(0, ...rows.slice(0, 200).map(r => r.cells.length))
  return Array.from({ length: width }, (_, i) => {
    const title = hasHeader ? String(rows[0]?.cells[i] ?? '').trim() : ''
    return { index: i, letter: columnLetter(i), title, label: title || `Colonne ${columnLetter(i)}` }
  })
}

// ── Correspondance automatique des colonnes ─────────────────────────────────
function scoreFor(header, field) {
  let best = 0
  for (const a of field.aliases) {
    if (header === a) best = Math.max(best, 3)
    else if (header.startsWith(`${a} `)) best = Math.max(best, 2.5)
    else if (a.length > 3 && ` ${header} `.includes(` ${a} `)) best = Math.max(best, 2)
  }
  return best
}

export function autoMap(columns) {
  const cands = []
  columns.forEach((c) => {
    const h = norm(c.title)
    if (!h) return
    FIELDS.forEach((f, fi) => { const s = scoreFor(h, f); if (s) cands.push({ col: c.index, key: f.key, s, fi }) })
  })
  cands.sort((a, b) => b.s - a.s || a.fi - b.fi || a.col - b.col)
  const map = {}
  const used = new Set()
  for (const c of cands) {
    if (map[c.key] != null || used.has(c.col)) continue
    map[c.key] = c.col
    used.add(c.col)
  }
  return map
}

// ── Valeurs ─────────────────────────────────────────────────────────────────

// Mobile sénégalais : 9 chiffres (70, 75, 76, 77, 78), indicatif retiré
export function normPhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('00221')) d = d.slice(5)
  else if (d.startsWith('221') && d.length === 12) d = d.slice(3)
  return d
}
export const phoneValid = (d) => /^7[015678]\d{7}$/.test(String(d ?? ''))

// « 15 000 », « 15000 F », « 15.000 FCFA » → 15000 ; vide → null
export function parseAmount(raw) {
  const s = String(raw ?? '').replace(/[\s\u00a0\u202f]/g, '')
  if (!s || s === '-' || s === '0') return { value: null }
  const t = s.replace(/(fcfa|cfa|xof|francs?|f)$/i, '')
  let v = null
  if (/^\d+([.,]\d{1,2})?$/.test(t)) v = Math.round(Number(t.replace(',', '.')))
  else if (/^\d{1,3}([.,]\d{3})+$/.test(t)) v = Number(t.replace(/[.,]/g, ''))
  if (v == null || !Number.isFinite(v)) return { error: 'Montant illisible' }
  if (v > 5_000_000) return { error: 'Montant trop élevé (5 000 000 F au plus)' }
  return { value: v > 0 ? v : null }
}

// Mots acceptés pour chaque type de colis (ordre : du plus précis au plus vague)
const CATEGORY_WORDS = [
  ['DOCUMENTS', ['documents', 'document', 'doc', 'docs', 'enveloppe', 'enveloppes', 'papier', 'papiers', 'courrier', 'pli']],
  ['LARGE', ['grand colis', 'grand', 'gros colis', 'gros', 'large', 'lourd', 'encombrant', 'volumineux']],
  ['FOOD', ['repas', 'nourriture', 'food', 'plat', 'plats', 'alimentaire', 'courses', 'restaurant', 'gateau']],
  ['VALUABLE', ['objet de valeur', 'valeur', 'valuable', 'precieux', 'bijou', 'bijoux']],
  ['OTHER', ['autre', 'autres', 'other', 'divers']],
  ['SMALL', ['petit colis', 'petit', 'small', 'leger', 'colis', 'paquet', 'sac']],
]

export function parseCategory(raw) {
  const n = norm(raw)
  if (!n) return { key: null, fragile: false, unknown: false }
  const fragile = /\bfragile\b/.test(n)
  const rest = n.replace(/\bfragile\b/g, ' ').replace(/\s+/g, ' ').trim()
  if (!rest) return { key: null, fragile, unknown: false }
  const direct = PACKAGE_CATEGORIES.find(c => norm(c.key) === rest || norm(c.label) === rest)
  if (direct) return { key: direct.key, fragile, unknown: false }
  for (const [key, words] of CATEGORY_WORDS) {
    if (words.some(w => rest === w || ` ${rest} `.includes(` ${w} `))) return { key, fragile, unknown: false }
  }
  return { key: null, fragile, unknown: true }
}

export const parseYes = (raw) => ['oui', 'o', 'yes', 'y', 'x', '1', 'vrai', 'true', 'fragile'].includes(norm(raw))

// Lignes du fichier → lignes de l'import (sans adresse ni prix : vérifiés ensuite)
export function buildRows(dataRows, map, { defaultCategory }) {
  return dataRows.slice(0, MAX_ROWS).map((r, i) => {
    const get = (k) => (map[k] != null ? String(r.cells[map[k]] ?? '').replace(/\s+/g, ' ').trim() : '')
    const amount = parseAmount(get('amount'))
    const cat = parseCategory(get('category'))
    return {
      uid: `l${r.line}-${i}`,
      line: r.line,
      name: get('name').slice(0, 100),
      phone: normPhone(get('phone')),
      phoneRaw: get('phone'),
      addressText: get('address').slice(0, 200),
      landmark: get('landmark').slice(0, 160),
      amount: amount.value ?? null,
      amountError: amount.error ?? null,
      amountRaw: get('amount').slice(0, 40),
      itemsText: get('items').slice(0, 200),
      note: get('note').slice(0, 300),
      category: cat.key ?? defaultCategory,
      categoryFromFile: !!cat.key,
      categoryUnknown: cat.unknown ? get('category').slice(0, 40) : null,
      fragile: cat.fragile || parseYes(get('fragile')),
      // Vérification
      place: null, suggestions: [], geo: 'idle', geoError: null,
      quote: null, quoteState: 'idle', quoteError: null,
      excluded: false,
      // Création
      status: 'idle', orderId: null, order: null, error: null,
    }
  })
}

// ── Modèle Excel à télécharger ──────────────────────────────────────────────
const TEMPLATE = [
  ['Nom du destinataire', 24, 'Obligatoire', 'Fatou Sow'],
  ['Téléphone', 16, 'Obligatoire · 9 chiffres', '77 123 45 67'],
  ['Adresse', 34, 'Obligatoire · quartier, rue ou lieu connu', 'Sicap Liberté 6, Dakar'],
  ['Repère', 28, 'Conseillé', 'Face pharmacie, portail bleu'],
  ['Montant à encaisser', 18, 'Articles, en F (vide si rien)', 15000],
  ['Articles', 26, 'Facultatif', '2 robes wax'],
  ['Note', 26, 'Facultatif', 'Appeler avant de passer'],
  ['Type de colis', 18, 'Liste · Petit colis par défaut', 'Petit colis'],
  ['Fragile', 10, 'Oui ou vide', 'Oui'],
]

export async function downloadTemplate() {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DEM Pro'
  wb.created = new Date()
  const navy = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF021520' } }
  const head = (row) => {
    row.height = 26
    row.eachCell((c) => {
      c.fill = navy
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      c.alignment = { vertical: 'middle' }
      c.border = { bottom: { style: 'medium', color: { argb: 'FF00D2FF' } } }
    })
  }

  // Feuille 1 : celle qui est importée (titres seulement)
  const ws = wb.addWorksheet('Livraisons', { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = TEMPLATE.map(([header, width]) => ({ header, width }))
  head(ws.getRow(1))
  ws.getColumn(2).numFmt = '@' // téléphone en texte : le 0 et les espaces sont gardés
  ws.getColumn(5).numFmt = '#,##0'
  const cats = PACKAGE_CATEGORIES.map(c => c.label).join(',')
  for (let r = 2; r <= MAX_ROWS + 1; r++) {
    ws.getCell(r, 8).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${cats}"`], showErrorMessage: true, errorTitle: 'Type de colis', error: 'Choisissez un type dans la liste.' }
    ws.getCell(r, 9).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Oui,Non"'] }
  }

  // Feuille 2 : exemple rempli (jamais importé)
  const ex = wb.addWorksheet('Exemple')
  ex.columns = TEMPLATE.map(([header, width]) => ({ header, width }))
  head(ex.getRow(1))
  ex.addRow(TEMPLATE.map(t => t[3]))
  ex.addRow(['Moussa Diop', '78 456 12 34', 'Almadies, Dakar', 'Immeuble Kër Yaay, 3e étage', 32000, 'Téléphone', '', 'Objet de valeur', ''])
  ex.addRow(['Awa Ndiaye', '70 987 65 43', 'Parcelles Assainies Unité 15', 'Près du marché', '', '', 'Documents à signer', 'Documents', ''])
  ex.getColumn(5).numFmt = '#,##0'
  ex.addRow([])
  const tip = ex.addRow(['Remplissez la feuille « Livraisons » : une ligne par livraison, 100 lignes au plus.'])
  tip.font = { italic: true, color: { argb: 'FF5B6B82' } }

  // Feuille 3 : mode d'emploi
  const help = wb.addWorksheet('Mode d\'emploi')
  help.columns = [{ width: 26 }, { width: 70 }]
  const title = help.addRow(['Import de livraisons · DEM Pro'])
  title.font = { bold: true, size: 14, color: { argb: 'FF021520' } }
  help.addRow([])
  TEMPLATE.forEach(([h, , rule]) => { const r = help.addRow([h, rule]); r.getCell(1).font = { bold: true } })
  help.addRow([])
  help.addRow(['Téléphone', 'Mobile sénégalais : 70, 75, 76, 77 ou 78 puis 7 chiffres. L\'indicatif +221 est accepté.'])
  help.addRow(['Adresse', 'Chaque adresse est cherchée sur la carte. Vous pourrez corriger une adresse mal placée avant de lancer les livraisons.'])
  help.addRow(['Montant à encaisser', 'Prix des articles payé par votre client au coursier. Le prix de la livraison est calculé par DEM.'])

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'modele-import-livraisons-dem-pro.xlsx'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
