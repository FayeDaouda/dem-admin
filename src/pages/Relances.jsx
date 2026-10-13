import { pageWrap } from '../lib/glassStyles'
import PageHeader from '../components/PageHeader'
import TabBar from '../components/TabBar'
import { useUrlTab } from '../lib/useUrlTab'
import NewProfiles from './NewProfiles'
import OutreachTable from './OutreachTable'

// Relances (Croissance) — qui appeler et le suivi des appels, au même endroit
// (plan de refonte, étape 3.8) : nouveaux inscrits (ancienne page Nouveaux
// profils) et journal des appels (ancienne page Tableau). Mêmes rôles pour
// les deux : Super, Service Client, Assistance exécutive.
const TABS = [
  { key: 'inscrits', label: 'Nouveaux inscrits' },
  { key: 'appels',   label: 'Journal des appels' },
]

export default function Relances() {
  const [tab, setTab] = useUrlTab(TABS)
  return (
    <div style={pageWrap}>
      <PageHeader title="Relances" subtitle="Nouveaux inscrits à contacter et suivi des appels de prospection et de support" />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === 'inscrits' ? <NewProfiles embedded /> : <OutreachTable embedded />}
      </div>
    </div>
  )
}
