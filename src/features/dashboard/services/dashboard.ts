import { loadOnboarding } from '../../onboarding/services/onboarding'
import type { DashboardData } from './dashboard-model'

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const onboarding = await loadOnboarding(userId)
  return { ...onboarding, matches: null, funding: null, saved: null, savedLoading: true, tasks: null }
}
