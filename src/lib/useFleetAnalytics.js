import { useState, useEffect, useCallback } from 'react'
import api from './api'
import { useAutoRefresh } from './useAutoRefresh'

// Analyse des courses et des coursiers (Dashboard, Responsable de flottes) —
// GET /admin/stats/fleet-analytics ; période 7 ou 30 jours.
export function useFleetAnalytics(enabled) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    if (!enabled) return
    return api.get('/admin/stats/fleet-analytics', { params: { days } })
      .then(r => { setData(r.data); setFailed(false) })
      .catch(() => setFailed(true))
  }, [days, enabled])
  useEffect(() => { load() }, [load])
  useAutoRefresh(load, 120_000)
  return { data, failed, days, setDays }
}
