import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardOnboardingRedirect } from '../src/features/auth/services/dashboard-access.ts'
import { emptyAnswers } from '../src/features/onboarding/services/model.ts'

const profile = { id: 'owner', education_stage: 'grade_9', education_stage_confirmation_required: false }
const record = { user_id: 'owner', flow_version: 4, current_step: 'school-details', answered_steps: ['welcome', 'current'], skipped_steps: [], carried_steps: [], completed_at: null }

test('missing and unfinished onboarding cannot enter dashboard, including ready without completion', () => {
  assert.equal(dashboardOnboardingRedirect(profile, null, emptyAnswers()), '/onboarding/welcome')
  assert.equal(dashboardOnboardingRedirect(profile, record, emptyAnswers()), '/onboarding/school-details')
  assert.equal(dashboardOnboardingRedirect(profile, { ...record, current_step: 'ready' }, emptyAnswers()), '/onboarding/school-details')
})

test('completion and confirmed stage are required for modern users', () => {
  const completed = { ...record, completed_at: '2026-10-21T12:00:00Z' }
  for (const stage of ['grade_9', 'grade_10', 'grade_11', 'grade_12', 'post_matric', 'accepted', 'tertiary', 'graduate']) {
    assert.equal(dashboardOnboardingRedirect({ ...profile, education_stage: stage }, completed, emptyAnswers()), null)
  }
  assert.equal(dashboardOnboardingRedirect({ ...profile, education_stage: null }, completed, emptyAnswers()), '/onboarding/current')
  assert.equal(dashboardOnboardingRedirect({ ...profile, education_stage_confirmation_required: true }, completed, emptyAnswers()), '/onboarding/current')
})

test('completed legacy users keep access; incomplete legacy users must resume', () => {
  const legacy = { ...record, flow_version: 2, current_step: 'ready', completed_at: '2026-10-21T12:00:00Z' }
  assert.equal(dashboardOnboardingRedirect(profile, legacy, emptyAnswers()), null)
  assert.equal(dashboardOnboardingRedirect({ ...profile, education_stage: null }, legacy, emptyAnswers()), '/onboarding/current')
  assert.equal(dashboardOnboardingRedirect(profile, { ...legacy, completed_at: null }, emptyAnswers()), '/onboarding/current')
})
