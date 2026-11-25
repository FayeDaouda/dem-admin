import { useMemo, useState } from 'react'
import { Printer, Download, QrCode, Check } from 'lucide-react'
import proApi from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { Button, Modal } from './ui'
import { useNotify } from './notifyContext'
import { LABEL_FORMATS, buildLabelsPdf, labelsFileName } from './LabelsPdf'
import '../styles/import.css'

// Bons de livraison à imprimer (étiquettes PDF avec QR code de suivi) :
//   <PrintLabelsButton orders={[o]} />                 bouton + fenêtre de choix
//   <PrintLabelsModal open orders={list} onClose />    fenêtre seule (menus, sélection)
// Les livraisons annulées sont laissées de côté.

const FORMAT_KEY = 'dem-pro:format-bons'
const readFormat = () => {
  try {
    const v = localStorage.getItem(FORMAT_KEY)
    return LABEL_FORMATS.some(f => f.key === v) ? v : 'a4x4'
  } catch { return 'a4x4' }
}
const saveFormat = (v) => { try { localStorage.setItem(FORMAT_KEY, v) } catch { /* stockage indisponible */ } }

// Liens de suivi (QR code). GET /orders/:id/share-link → { shareUrl } ; le
// serveur le construit à partir du seul identifiant (orders.service.js:
// getShareLink) : un appel suffit, les autres liens suivent le même modèle
// (quota de requêtes partagé avec le téléphone). Modèle différent : un appel
// par livraison.
async function trackingLinks(orders) {
  const out = {}
  const [first, ...rest] = orders
  if (!first) return out
  const res = await proApi.get(`/orders/${first.id}/share-link`)
  const url = res.data?.shareUrl
  if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return out
  out[first.id] = url
  const at = url.lastIndexOf(first.id)
  if (at > 0 && at + first.id.length === url.length) {
    const prefix = url.slice(0, at)
    for (const o of rest) out[o.id] = `${prefix}${o.id}`
  } else {
    for (const o of rest) {
      try {
        const r = await proApi.get(`/orders/${o.id}/share-link`)
        if (typeof r.data?.shareUrl === 'string') out[o.id] = r.data.shareUrl
      } catch { /* bon sans QR code */ }
    }
  }
  return out
}

const shopNameOf = (user) => user?.proBusinessName || user?.companyName || user?.name || ''

export function PrintLabelsModal({ open, orders, onClose }) {
  const { user } = useProAuth() ?? {}
  const notify = useNotify()
  const [format, setFormat] = useState(readFormat)
  const [withQr, setWithQr] = useState(true)
  const [busy, setBusy] = useState(null) // 'print' | 'download'

  const printable = useMemo(() => (orders ?? []).filter(o => o?.id && o.status !== 'CANCELLED'), [orders])
  const skipped = (orders?.length ?? 0) - printable.length
  const fmt = LABEL_FORMATS.find(f => f.key === format) ?? LABEL_FORMATS[0]
  const pages = Math.ceil(printable.length / (fmt.cols * fmt.rows))
  const n = printable.length

  const choose = (k) => { setFormat(k); saveFormat(k) }

  const run = async (mode) => {
    if (busy || !n) return
    // Fenêtre ouverte tout de suite (sinon bloquée après l'attente)
    let win = null
    if (mode === 'print') {
      try { win = window.open('', '_blank') } catch { win = null }
      try { if (win) win.document.body.innerHTML = '<p style="font:15px system-ui,sans-serif;padding:32px;color:#021520">Préparation des bons de livraison…</p>' } catch { /* fenêtre d'un autre domaine */ }
    }
    setBusy(mode)
    try {
      let links = {}
      let qrFailed = false
      if (withQr) {
        try { links = await trackingLinks(printable) } catch { qrFailed = true }
        if (!qrFailed && !Object.keys(links).length) qrFailed = true
      }
      const doc = await buildLabelsPdf(printable, { format, shopName: shopNameOf(user), links })
      if (mode === 'print' && win && !win.closed) {
        doc.autoPrint()
        const url = doc.output('bloburl')
        win.location.href = url
        setTimeout(() => URL.revokeObjectURL(url), 120_000)
        notify.success(n > 1 ? `${n} bons prêts à imprimer` : 'Bon prêt à imprimer', 'Ils s\'ouvrent dans un nouvel onglet.')
      } else {
        doc.save(labelsFileName(n))
        notify.success(n > 1 ? `${n} bons téléchargés` : 'Bon téléchargé',
          mode === 'print' ? 'Votre navigateur a bloqué le nouvel onglet : ouvrez le PDF pour l\'imprimer.' : null)
      }
      if (qrFailed) notify.info('Bons sans QR code', 'Le lien de suivi n\'a pas pu être obtenu. Le reste du bon est complet.')
      onClose?.()
    } catch {
      try { win?.close() } catch { /* déjà fermée */ }
      notify.error('Bons impossibles', 'Le PDF n\'a pas pu être créé. Réessayez dans un instant.')
    } finally { setBusy(null) }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} width={560}
      title={n > 1 ? `Imprimer ${n} bons de livraison` : 'Imprimer le bon de livraison'}
      subtitle={n === 0
        ? 'Aucune livraison à imprimer : les livraisons annulées n\'ont pas de bon.'
        : `À coller sur ${n > 1 ? 'chaque colis' : 'le colis'} : destinataire, adresse, montant à encaisser et QR code de suivi.${skipped > 0 ? ` ${skipped} annulée${skipped > 1 ? 's' : ''} laissée${skipped > 1 ? 's' : ''} de côté.` : ''}`}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={!!busy}>Annuler</Button>
        <Button variant="ghost" icon={Download} loading={busy === 'download'} disabled={!n || !!busy} onClick={() => run('download')}>Télécharger</Button>
        <Button icon={Printer} loading={busy === 'print'} disabled={!n || !!busy} onClick={() => run('print')}>Imprimer</Button>
      </>}>
      <fieldset className="lb-fieldset">
        <legend className="label-caps">Format</legend>
        <div className="lb-formats" role="radiogroup" aria-label="Format des bons">
          {LABEL_FORMATS.map(f => {
            const on = f.key === format
            return (
              <button key={f.key} type="button" role="radio" aria-checked={on} className={`lb-format ${on ? 'is-on' : ''}`} onClick={() => choose(f.key)}>
                <span className={`lb-prev lb-prev-${f.key}`} aria-hidden>
                  {Array.from({ length: f.cols * f.rows }, (_, i) => <i key={i} />)}
                </span>
                <span className="lb-format-txt">
                  <b>{f.title}</b>
                  <span>{f.hint}</span>
                </span>
                {on && <Check size={15} className="lb-format-ok" aria-hidden />}
              </button>
            )
          })}
        </div>
      </fieldset>

      <label className={`dv-check lb-qr ${withQr ? 'is-on' : ''}`}>
        <input type="checkbox" checked={withQr} onChange={e => setWithQr(e.target.checked)} />
        <span className="dv-box" aria-hidden />
        <QrCode size={16} className="dv-check-ico" aria-hidden />
        <span className="dv-check-txt"><b>QR code de suivi</b><span>Votre client le scanne pour suivre le coursier en direct.</span></span>
      </label>

      {n > 0 && (
        <p className="muted lb-count num">
          {n} bon{n > 1 ? 's' : ''} · {pages} page{pages > 1 ? 's' : ''} {fmt.key === 'label' ? 'de 10 × 15 cm' : 'A4'}
        </p>
      )}
    </Modal>
  )
}

export default function PrintLabelsButton({ orders, children = 'Imprimer le bon', variant = 'ghost', size = 'sm', icon = Printer, className, disabled }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size={size} icon={icon} className={className}
        disabled={disabled || !orders?.length} onClick={() => setOpen(true)}>{children}</Button>
      {open && <PrintLabelsModal open orders={orders} onClose={() => setOpen(false)} />}
    </>
  )
}
