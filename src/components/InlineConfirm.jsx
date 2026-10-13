// Confirmation affichée dans la page, à l'endroit de l'action (remplace les
// fenêtres window.confirm). `lines` : une phrase ou une liste de lignes ; une
// ligne vide sépare deux paragraphes.
export default function InlineConfirm({ lines, confirmLabel = 'Confirmer', danger = false, busy = false, onConfirm, onCancel }) {
  const list = Array.isArray(lines) ? lines : [lines]
  return (
    <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((l, i) => l === ''
        ? <div key={i} style={{ height: 2 }} />
        : <div key={i} style={{ fontSize: i === 0 ? 13 : 12.5, fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--text)' : 'var(--text-muted)' }}>{l}</div>)}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" onClick={onCancel} disabled={busy} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(0,119,182,.25)', background: 'rgba(255,255,255,.6)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
          Retour
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} style={{ padding: '7px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: danger ? 'var(--danger)' : 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'En cours…' : confirmLabel}
        </button>
      </div>
    </div>
  )
}
