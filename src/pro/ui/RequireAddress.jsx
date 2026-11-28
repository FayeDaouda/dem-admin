import { useCallback, useEffect, useState } from 'react'
import { MapPin } from 'lucide-react'
import proApi from '../lib/proApi'
import { memberRoleOf, useProAuth } from '../proAuthContext'
import { Button, Modal } from './ui'
import { AddAddressModal } from '../pages/Account'

// Adresse d'expédition obligatoire (comme l'app, dem_pro_home_screen.dart) :
// sans adresse de retrait, le prix de livraison ne peut pas être annoncé au
// client du lien de commande. Fenêtre impossible à fermer tant qu'aucune
// adresse n'existe ; responsable et gérants seulement (un employé ne peut
// pas en ajouter). En cas d'erreur réseau, rien ne bloque.
export default function RequireAddress() {
  const { user } = useProAuth()
  const role = memberRoleOf(user)
  const allowed = role !== 'STAFF'
  const [missing, setMissing] = useState(false)
  const [adding, setAdding] = useState(false)

  const check = useCallback(() => {
    if (!allowed) return
    proApi.get('/dem-pro/addresses')
      .then(r => setMissing(Array.isArray(r.data) ? r.data.length === 0 : (r.data?.addresses ?? []).length === 0))
      .catch(() => setMissing(false))
  }, [allowed])
  useEffect(() => { check() }, [check])

  if (!missing) return null
  return (
    <>
      <Modal open={!adding} width={480}
        title="Ajoutez votre adresse d'expédition"
        subtitle="Là où les coursiers viennent chercher vos colis."
        footer={<Button icon={MapPin} onClick={() => setAdding(true)}>Ajouter mon adresse</Button>}>
        <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.55 }}>
          Elle sert à calculer le prix de livraison à l'avance : vos clients le voient avant de commander
          sur votre lien. Vous pourrez la modifier ou en ajouter d'autres dans Compte › Adresses.
        </p>
      </Modal>
      <AddAddressModal open={adding} hasDefault={false}
        onClose={() => setAdding(false)}
        onSaved={() => { setAdding(false); check() }} />
    </>
  )
}
