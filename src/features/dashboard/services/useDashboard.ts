import { useEffect, useState } from 'react'
import { loadDashboard } from './dashboard'
import type { DashboardData } from './dashboard-model'
import { loadSavedOpportunities } from './saved'

export function useDashboard(userId: string | undefined) {
  const [state, setState] = useState<{ userId: string; data: DashboardData | null; error: boolean } | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!userId) return
    let active = true
    let requestVersion = 0
    const load = () => {
      const version = ++requestVersion
      // Optional saved items load concurrently, without blocking the learner's dashboard.
      const saved = loadSavedOpportunities(userId).catch(() => null)
      void loadDashboard(userId).then(data => {
        if (!active || version !== requestVersion) return
        setState({ userId, data, error: false })
        void saved.then(items => {
          if (active && version === requestVersion) setState({ userId, data: { ...data, saved: items, savedLoading: false }, error: false })
        })
      })
        .catch(() => { if (active && version === requestVersion) setState({ userId, data: null, error: true }) })
    }
    load()
    window.addEventListener('focus', load)
    return () => { active = false; window.removeEventListener('focus', load) }
  }, [userId, revision])
  const current = state?.userId === userId ? state : null
  return { data: current?.data ?? null, error: current?.error ?? false, loading: !current, retry: () => { setState(value => value?.error ? null : value); setRevision(value => value + 1) } }
}
