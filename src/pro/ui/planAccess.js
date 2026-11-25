import proApi from '../lib/proApi'

// Droits de l'offre du compte, lus comme dans l'app (DemProPlanInfo,
// dem_pro_plan_gate.dart) depuis GET /dem-pro/me/plan.
//  - comptes sur un palier (planSystem 'tiers') : valeur du palier ;
//  - ancien système : `legacyOk` (offre PRO ou BUSINESS, comme isProPlan).
// Lecture gardée 2 minutes : un clic sur « Facture » ne relit pas l'offre.

let cache = null

export function loadPlan({ fresh = false } = {}) {
  if (fresh || !cache || Date.now() - cache.at > 120_000) {
    const promise = proApi.get('/dem-pro/me/plan').then(r => r.data ?? {})
    cache = { at: Date.now(), promise }
    promise.catch(() => { if (cache?.promise === promise) cache = null })
  }
  return cache.promise
}

export const isProPlan = (plan) => plan === 'PRO' || plan === 'BUSINESS'

export function featureUnlocked(info, key, { legacyOk } = {}) {
  if (info?.planSystem === 'tiers') return info?.tierLimits?.[key] === true
  return legacyOk ?? isProPlan(info?.plan)
}

// Offre la plus basse qui débloque `key` (« Débloquez … avec Business »)
export function unlockTierLabel(info, key) {
  const tiers = Array.isArray(info?.allTiers) ? info.allTiers : []
  const offersTiers = info?.planSystem === 'tiers' || (info?.tiersPurchasable && tiers.length > 0)
  if (!offersTiers) return 'Pro'
  const t = tiers.find(x => x?.limits?.[key] === true)
  return t?.label ?? 'Premium'
}
