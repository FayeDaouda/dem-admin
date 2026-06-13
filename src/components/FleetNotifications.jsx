import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check } from 'lucide-react'
import fleetApi from '../lib/fleetApi'
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

export default function FleetNotifications() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const ref = useRef(null)

  const fetchUnreadCount = useCallback(() => {
    fleetApi.get('/notifications/unread-count')
      .then(r => setUnreadCount(r.data?.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const id = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(id)
  }, [fetchUnreadCount])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleOpen() {
    if (!open) {
      setLoadingList(true)
      fleetApi.get('/notifications')
        .then(r => setItems(Array.isArray(r.data) ? r.data : []))
        .catch(() => {})
        .finally(() => setLoadingList(false))
    }
    setOpen(v => !v)
  }

  function markAsRead(item) {
    if (item.read) return
    fleetApi.patch(`/notifications/${item.id}/read`).catch(() => {})
    setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    setUnreadCount(c => Math.max(0, c - 1))
  }

  function markAllRead() {
    fleetApi.patch('/notifications/read-all').catch(() => {})
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={toggleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%', color: '#0077b6',
        }}
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          ...glassSolid, position: 'absolute', top: 44, right: 0, width: 340, maxWidth: '90vw',
          borderRadius: 14, overflow: 'hidden', zIndex: 250, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(0,119,182,.12)' }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 11, fontWeight: 600 }}>
                <Check size={12} /> Tout marquer comme lu
              </button>
            )}
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Chargement…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Aucune notification.</div>
            ) : items.map(n => (
              <div
                key={n.id}
                onClick={() => markAsRead(n)}
                style={{
                  display: 'flex', gap: 8, padding: '10px 14px', cursor: n.read ? 'default' : 'pointer',
                  borderBottom: '1px solid rgba(0,119,182,.06)',
                  background: n.read ? 'transparent' : 'rgba(0,180,216,.06)',
                }}
              >
                <span style={{
                  marginTop: 5, width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: n.read ? 'transparent' : '#0077b6',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'pre-line' }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
