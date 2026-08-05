import { useState } from 'react'

// Miniature cliquable pour une image (document, photo de preuve...) avec
// zoom plein écran — état vide si l'URL est absente. Partagé entre Drivers
// (documents véhicule/CNI) et Orders (preuve de livraison).
export default function DocThumb({ url, label }) {
  const [zoomed, setZoomed] = useState(false)
  if (!url) return (
    <div style={{ width: 80, height: 64, borderRadius: 8, background: 'var(--surface2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      <span style={{ fontSize: 20 }}>📄</span>
      <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
  return (
    <>
      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setZoomed(true)} title={label}>
        <img src={url} alt={label} style={{ width: 80, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,119,182,.15)', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,.45)', borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: '2px 4px', textAlign: 'center' }}>
          <span style={{ fontSize: 9, color: '#fff' }}>{label}</span>
        </div>
      </div>
      {zoomed && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setZoomed(false)}>
          <img src={url} alt={label} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12 }} />
        </div>
      )}
    </>
  )
}
