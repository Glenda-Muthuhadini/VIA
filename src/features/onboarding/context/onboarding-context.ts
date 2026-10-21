import type { Flow } from '../config/flows'
import type { EducationStage } from '../config/education-stages'
import { createContext, useContext } from 'react'
import type { Answers, Category, OnboardingOption, OnboardingRecord, Report, Step } from '../services/model'
export type OnboardingState = {
  flow: Flow; educationStage: EducationStage | null; changeStage: (stage: EducationStage) => Promise<void>; confirmationRequired: boolean
  answers: Answers; record: OnboardingRecord | null; reports: Report[]; options: OnboardingOption[]
  status: 'saved' | 'saving' | 'unsaved' | 'error'; error: string; busy: boolean; step: Step
  choices: (category: Category) => OnboardingOption[]
  patch: (changes: Partial<Answers>) => void
  save: (step?: Step, complete?: boolean, skipped?: boolean, confirmResults?: boolean) => Promise<OnboardingRecord>
  reload: () => void
  storeGrade9Report: (file: File) => Promise<Report>
  addReport: (file: File) => Promise<void>
}
export const OnboardingContext = createContext<OnboardingState | null>(null)
export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('OnboardingProvider is required')
  return context
}
