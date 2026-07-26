import { pageWrap, pageScroll } from '../lib/glassStyles'
import PromotionsTab from './marketing/PromotionsTab'

// Page autonome (SUPER + MARKETING) — le contenu vient de PromotionsTab,
// déjà utilisé comme onglet dans /marketing, mais ce lien direct est
// nécessaire car /marketing est masqué pour SUPER (voir Layout.jsx).
export default function Promotions() {
  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Promotions</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Campagnes de réduction pour clients/DEM Pro et récompenses passe gratuite pour les livreurs.
        </p>
      </div>
      <div style={pageScroll}>
        <PromotionsTab />
      </div>
    </div>
  )
}
