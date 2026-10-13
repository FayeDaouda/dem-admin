import PageHeader from '../components/PageHeader'
import AppVersionTab from './AppVersionTab'

// Version de l'app (Administration) — ancien onglet de Tarifs (plan de
// refonte, étape 3.5). Lecture Super + Dev, modification Super (serveur).
export default function AppVersion() {
  return (
    <div>
      <PageHeader title="Version de l'app" subtitle="Version minimale et invitation à mettre à jour l'application" />
      <AppVersionTab />
    </div>
  )
}
