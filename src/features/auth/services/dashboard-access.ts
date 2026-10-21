import type { ViaProfile } from './profile'
import type { Answers, OnboardingRecord } from '../../onboarding/services/model'
import { getFlow } from '../../onboarding/config/flows.ts'
import { validResume } from '../../onboarding/services/flow-engine.ts'

// A session alone does not make a learner ready for their dashboard.
// Missing and unfinished records must go through the existing onboarding flow.
export function dashboardOnboardingRedirect(profile: ViaProfile, record: OnboardingRecord | null, answers: Answers) {
  if (!record) return '/onboarding/welcome'
  const version = record.flow_version ?? 2
  if (!profile.education_stage || profile.education_stage_confirmation_required) return '/onboarding/current'
  if (record.completed_at) return null
  const flow = getFlow(profile.education_stage, version, record.carried_steps)
  return `/onboarding/${validResume(flow, answers, record)}`
}
