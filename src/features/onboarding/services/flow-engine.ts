import type { Flow } from '../config/flows'
import type { Answers, OnboardingRecord, Step } from './model'
import { validateStep } from './model.ts'
export function activeSteps(flow: Flow, answers: Answers) { return flow.steps.filter(step => !step.when || step.when(answers)) }
export function flowPosition(flow: Flow, answers: Answers, step: Step) {
  const steps = activeSteps(flow, answers)
  const index = steps.findIndex(item => item.id === step)
  return { steps, index, total: steps.length, current: Math.max(1, index + 1), previous: steps[Math.max(0,index-1)]?.id ?? 'welcome', next: steps[index+1]?.id ?? (flow.implemented ? flow.directReady?'ready':'building' : 'stage-pending'), optional: steps[index]?.optional === true }
}
export function validResume(flow: Flow, answers: Answers, record: OnboardingRecord | null): Step {
  if (record?.completed_at && flow.implemented) return 'ready'
  const steps = activeSteps(flow, answers)
  if (record?.flow_version === 2 && !record.completed_at) {
    const missing = steps.findIndex(step => !!validateStep(step.id,answers))
    const saved = steps.findIndex(step => step.id === record.current_step)
    if (missing >= 0 && (saved < 0 || saved > missing)) return steps[missing].id
  }
  if (record && steps.some(step => step.id === record.current_step) && record.current_step !== 'welcome') return record.current_step
  return steps.find(step => step.id !== 'welcome' && !record?.answered_steps?.includes(step.id) && !record?.skipped_steps?.includes(step.id))?.id ?? 'current'
}
