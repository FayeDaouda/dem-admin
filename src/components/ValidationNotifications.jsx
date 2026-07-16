import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import api from '../lib/api'
import { glassSolid } from '../lib/glassStyles'

function timeAgo(dateStr) {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.floor(h / 24)
  return `il y a ${j} j`
}

// Cloche de notifications — résumé de tout ce qui attend une décision du
// Super Admin sur la page Validation (profils + demandes Service Client/Finance)
export default function ValidationNotifications() {
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const fetchSummary = useCallback(() => {
    api.get('/admin/validations/summary')
      .then(r => { setTotal(r.data?.total ?? 0); setItems(r.data?.items ?? []) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchSummary()
    const id = setInterval(fetchSummary, 30000)
    return () => clearInterval(id)
  }, [fetchSummary])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleOpen() {
    if (!open) {
      setLoading(true)
      fetchSummary()
      setLoading(false)
    }
    setOpen(v => !v)
  }

  function goTo(item) {
    setOpen(false)
    navigate(`/validation?tab=${item.tab}&highlight=${item.id}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%', color: 'var(--primary)',
        }}
        title="Demandes en attente de validation"
      >
        <Bell size={20} />
        {total > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          ...glassSolid, position: 'absolute', top: 44, right: 0, width: 340, maxWidth: '90vw',
          borderRadius: 14, overflow: 'hidden', zIndex: 250, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(0,119,182,.12)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Validations en attente</span>
            {total > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} au total</span>}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Chargement…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Aucune demande en attente.</div>
            ) : items.map(n => (
              <div
                key={`${n.type}-${n.id}`}
                onClick={() => goTo(n)}
                style={{
                  display: 'flex', gap: 8, padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(0,119,182,.06)',
                }}
              >
                <span style={{ marginTop: 5, width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#0077b6' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{n.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{n.detail}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <button
              onClick={() => { setOpen(false); navigate('/validation') }}
              style={{ padding: '10px 14px', border: 'none', borderTop: '1px solid rgba(0,119,182,.12)', background: 'transparent', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Voir toute la page Validation
            </button>
          )}
        </div>
      )}
    </div>
  )
}
