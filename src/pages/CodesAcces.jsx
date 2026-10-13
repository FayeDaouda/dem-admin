import { pageWrap, pageScroll } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import OtpUnblockPanel from '../components/OtpUnblockPanel'

// Codes et accès (Comptes) — l'écran unique du déblocage des codes SMS et de
// la sécurité d'un compte (dégel, code secret, sessions). Réunit l'ancien
// onglet Codes SMS du Poste Service Client et le bloc de Maintenance (même
// composant, mêmes actions) — Super Admin et Service Client, comme le serveur.
export default function CodesAcces() {
  return (
    <div style={pageWrap}>
      <PageHeader title="Codes et accès" subtitle="Débloquer les codes SMS d'un numéro et gérer la sécurité d'un compte" />
      <div style={pageScroll}>
        <OtpUnblockPanel />
      </div>
    </div>
  )
}
