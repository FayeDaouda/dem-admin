import { pageWrap, pageScroll } from '../lib/glassStyles'
import AcquisitionTab from './marketing/AcquisitionTab'

// Vue lecture seule de l'acquisition (Assistant Exécutif) — réutilise les
// graphiques d'évolution Clients/Livreurs/DEM Pro/Chefs de flotte déjà
// construits pour le dashboard Marketing, sans les actions de gestion
// (Pass, 100 Clients, Frais) réservées à SUPER sur /acquisition.
export default function AcquisitionOverview() {
  return (
    <div style={pageWrap}>
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Acquisition</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Évolution des inscriptions — Clients, Livreurs, DEM Pro, Chefs de flotte.
        </p>
      </div>

      <div style={pageScroll}>
        <AcquisitionTab />
      </div>
    </div>
  )
}
