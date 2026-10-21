export type Category = 'current' | 'interest' | 'personality' | 'preference' | 'institution_type' | 'province' | 'study_goal' | 'subject' | 'journey' | 'future_interest'
export type OnboardingOption = { id: string; category: Category; label: string; description: string; icon: string; tone: string; sort_order: number; education_stages?: string[] | null }
import { emptyGrade9, normaliseGrade9, type Grade9Answers } from './grade9-model.ts'
import { emptyJourney, normaliseJourney, type JourneyAnswers } from './journey-model.ts'
export type SubjectResult = { subject_id: string; mark: number }
export type Answers = {
  journey: JourneyAnswers
  grade9: Grade9Answers
  school_subject_ids: string[]; school_subjects_unknown: boolean; future_interest_ids: string[]; future_exploring: boolean; report_grade: number | null; report_type: string | null
  current_id: string; interest_ids: string[]; personality_ids: string[]; goal_ids: string[]
  preference_ids: string[]; institution_type_ids: string[]; location_mode: 'anywhere' | 'provinces'; province_ids: string[]
  school_name: string; academic_year: number | null; results: SubjectResult[]; report_id: string | null
}
export type OnboardingRecord = { user_id: string; grade9?: Grade9Answers; flow_version?: number; carried_steps?: Step[]; journey_answers?: Partial<Answers>; answered_steps?: Step[]; skipped_steps?: Step[]; branch_state?: { school_subjects_unknown?: boolean; future_exploring?: boolean }; academic_record_id?: string | null; answers: Answers; current_step: Step; revision: number; completed_at: string | null; created_at: string; updated_at: string }
export type Report = { id: string; user_id: string; storage_path: string; file_name: string; mime_type: string; file_size: number; created_at: string }
export const steps = ['welcome', 'current', 'interests', 'results', 'personality', 'study-plan', 'preferences', 'building', 'ready', 'school-subjects', 'future-curiosity', 'stage-pending','career-interests','study-interests','programmes','study-location','applications','funding','matric-year','current-activity','institution','enrolled-programme','campus','starting-year','year-of-study','accommodation-status','registration','support','school-details','confirm-results','subject-experience','subject-choice','subjects-considering','future-interests'] as const
export type Step = typeof steps[number]
export function emptyAnswers(): Answers {
  return { grade9: emptyGrade9(), journey: emptyJourney(), school_subject_ids: [], school_subjects_unknown: false, future_interest_ids: [], future_exploring: false, report_grade: null, report_type: null, current_id: '', interest_ids: [], personality_ids: [], goal_ids: [], preference_ids: [], institution_type_ids: [], location_mode: 'anywhere', province_ids: [], school_name: '', academic_year: null, results: [], report_id: null }
}
export function normaliseAnswers(value: Partial<Answers> | null, options: OnboardingOption[], reports: Report[]): Answers {
  const source = value ?? {}
  const valid = (id: unknown, category: Category) => typeof id === 'string' && options.some(option => option.id === id && option.category === category)
  const ids = (value: unknown, category: Category) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => valid(id, category)))] : []
  return {
    journey: normaliseJourney(source.journey),
    grade9: normaliseGrade9(source.grade9),
    school_subject_ids: ids(source.school_subject_ids, 'subject'), school_subjects_unknown: source.school_subjects_unknown === true, future_interest_ids: ids(source.future_interest_ids, 'future_interest'), future_exploring: source.future_exploring === true, report_grade: [9,10,11,12].includes(source.report_grade??0) ? source.report_grade! : null, report_type: typeof source.report_type === 'string' ? source.report_type : null,
    current_id: valid(source.current_id, 'current') ? source.current_id! : '',
    interest_ids: ids(source.interest_ids, 'interest'), personality_ids: ids(source.personality_ids, 'personality'),
    goal_ids: ids(source.goal_ids, 'study_goal'), preference_ids: ids(source.preference_ids, 'preference'),
    institution_type_ids: ids(source.institution_type_ids, 'institution_type'), province_ids: ids(source.province_ids, 'province'),
    location_mode: source.location_mode === 'provinces' ? 'provinces' : 'anywhere',
    school_name: typeof source.school_name === 'string' ? source.school_name.slice(0, 200) : '',
    academic_year: typeof source.academic_year === 'number' && Number.isInteger(source.academic_year) && source.academic_year >= 2000 && source.academic_year <= 2100 ? source.academic_year : null,
    results: Array.isArray(source.results) ? source.results.filter((result, index, all) => result && valid(result.subject_id, 'subject') && Number.isFinite(result.mark) && result.mark >= 0 && result.mark <= 100 && all.findIndex(other => other?.subject_id === result.subject_id) === index).slice(0, 20) : [],
    report_id: reports.some(report => report.id === source.report_id) ? source.report_id! : null,
  }
}
export function validateStep(step: Step, answers: Answers): string {
  if (step === 'current' && !answers.current_id) return 'Choose where you are in your journey.'
  if (step === 'interests' && !answers.interest_ids.length) return 'Choose at least one area that interests you.'
  if (step === 'personality' && !answers.personality_ids.length) return 'Choose at least one thing that sounds like you.'
  if (step === 'study-plan' && !answers.goal_ids.length) return 'Add at least one career, course or field you are considering.'
  if (step === 'preferences') {
    if (!answers.institution_type_ids.length) return 'Choose at least one institution option.'
    if (answers.location_mode === 'provinces' && !answers.province_ids.length) return 'Choose at least one province or select anywhere in South Africa.'
  }
  return ''
}
export function firstIncomplete(answers: Answers): Step {
  return (['current','interests','personality','study-plan','preferences'] as Step[]).find(step => validateStep(step, answers)) ?? 'preferences'
}
export function resumeStep(record: OnboardingRecord | null, answers: Answers): Step {
  if (!record) return 'current'
  const saved = steps.includes(record.current_step) ? record.current_step : 'current'
  const first = firstIncomplete(answers)
  return steps.indexOf(saved) > steps.indexOf(first) ? first : saved === 'welcome' ? 'current' : saved
}
export function toggleId(ids: string[], id: string) { return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] }
export function saveError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === '40001') return 'Your VIA changed in another tab. Reload the saved progress before making more changes.'
  return 'We could not save your progress. Your changes are still on this screen. Check your connection and try again.'
}
