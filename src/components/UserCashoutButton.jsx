import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isSuperRole } from '../lib/droits'
import AdminCashoutModal from './AdminCashoutModal'

// Bouton « Faire un retrait pour lui » (fiches livreur, client, DEM Pro) —
// SUPER seul, comme la route serveur POST /admin/users/:id/cashout.
// Rien d'affiché pour les autres rôles.
export default function UserCashoutButton({ userId, label = 'Faire un retrait pour lui', onDone, style }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  if (!isSuperRole(user?.adminRole)) return null
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={{ ...btn, ...style }}>{label}</button>
      {open && (
        <AdminCashoutModal
          userId={userId}
          onClose={() => setOpen(false)}
          onDone={(r) => { setOpen(false); onDone?.(r) }}
        />
      )}
    </>
  )
}

const btn = { padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(21,128,61,.45)', background: 'rgba(21,128,61,.06)', color: '#15803d', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }
