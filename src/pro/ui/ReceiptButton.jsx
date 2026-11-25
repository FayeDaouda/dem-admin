import { useState } from 'react'
import { FileDown, FileText, Lock } from 'lucide-react'
import { errMsg } from '../lib/proApi'
import { useProAuth } from '../proAuthContext'
import { Button, IconButton, Modal } from './ui'
import { useNotify } from './notifyContext'
import { featureUnlocked, loadPlan, unlockTierLabel } from './planAccess'
import '../styles/clients-stats.css'

// Boutons « Reçu » et « Facture » d'une livraison livrée, prêts à brancher :
//   <ReceiptActions order={o} />            reçu + facture (tiroir Livraisons)
//   <ReceiptButton order={o} kind="invoice" />
//   <ReceiptButton order={o} iconOnly />     icône seule (listes)
// Le reçu DEM est ouvert à tous ; la facture au nom du commerçant suit
// l'offre (invoiceEnabled, comme dem_pro_receipt_screen.dart).

export function ReceiptButton({ order, kind = 'receipt', iconOnly, size = 'sm', variant = 'ghost', className }) {
  const { user } = useProAuth()
  const notify = useNotify()
  const [busy, setBusy] = useState(false)
  const [locked, setLocked] = useState(null)
  const invoice = kind === 'invoice'
  const label = invoice ? 'Facture PDF' : 'Reçu PDF'
  const title = invoice ? 'Télécharger la facture' : 'Télécharger le reçu'

  const run = async () => {
    if (!order || busy) return
    setBusy(true)
    try {
      if (invoice) {
        let info
        try { info = await loadPlan() } catch (e) { notify.error('Facture indisponible', errMsg(e)); return }
        if (!featureUnlocked(info, 'invoiceEnabled')) {
          setLocked(unlockTierLabel(info, 'invoiceEnabled'))
          return
        }
        const { downloadInvoicePdf } = await import('./ReceiptPdf')
        await downloadInvoicePdf(order, user)
        notify.success('Facture téléchargée', `Facture de la livraison ${String(order.id ?? '').slice(0, 8).toUpperCase()}.`)
      } else {
        const { downloadReceiptPdf } = await import('./ReceiptPdf')
        await downloadReceiptPdf(order, user)
        notify.success('Reçu téléchargé')
      }
    } catch {
      notify.error(invoice ? 'Facture impossible' : 'Reçu impossible', 'Le document n\'a pas pu être créé. Réessayez dans un instant.')
    } finally { setBusy(false) }
  }

  const Icon = invoice ? FileText : FileDown
  return (
    <>
      {iconOnly
        ? <IconButton icon={Icon} label={title} size="sm" variant="plain" className={className} disabled={busy}
            onClick={(e) => { e.stopPropagation(); run() }} />
        : <Button variant={variant} size={size} icon={Icon} loading={busy} className={className} onClick={run} title={title}>{label}</Button>}
      <Modal open={!!locked} onClose={() => setLocked(null)} width={460}
        title={`Factures incluses avec l'offre ${locked ?? ''}`}
        subtitle="Vos reçus de livraison restent téléchargeables avec votre offre actuelle."
        footer={<>
          <Button variant="ghost" onClick={() => setLocked(null)}>Plus tard</Button>
          <Button to="/compte" arrow="right" onClick={() => setLocked(null)}>Voir les offres</Button>
        </>}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span className="cs-lock-ico" aria-hidden><Lock size={18} /></span>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>
            La facture au nom de votre boutique (NINEA, RCCM, articles et livraison) est incluse à partir de
            l'offre {locked}. Changez d'offre depuis votre compte.
          </p>
        </div>
      </Modal>
    </>
  )
}

// Reçu + facture, seulement pour une livraison livrée (comme l'app)
export function ReceiptActions({ order, style }) {
  if (order?.status !== 'DELIVERED') return null
  return (
    <div className="cs-receipt-actions" style={style}>
      <ReceiptButton order={order} />
      <ReceiptButton order={order} kind="invoice" />
    </div>
  )
}

export default ReceiptButton
