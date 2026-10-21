import { educationStages, type EducationStage } from '../../onboarding/config/education-stages.ts'
import type { ViaProfile } from '../../auth/services/profile'
import { emptyAnswers, normaliseAnswers, type OnboardingOption, type OnboardingRecord, type Report } from '../../onboarding/services/model.ts'

export type Feature = 'match' | 'scan' | 'progress' | 'institutions' | 'programmes' | 'fund' | 'stay' | 'vault' | 'assist' | 'applications' | 'saved' | 'profile' | 'settings' | 'whatif' | 'subject-guide'
export type Grade = '9' | '10' | '11' | '12' | 'early' | 'other'
export type AcademicResult = { subjectId: string; subject: string; percentage: number; insight: 'Strong' | 'On track' | 'Focus area' }
export type ProgrammeMatch = { id: string; programme: string; institution: string; percentage: number | null; reason: string }
export type FundingOpportunity = { id: string; title: string; provider: string }
export type SavedOpportunity = { id: string; title: string; kind: 'programme' | 'institution' | 'funding' | 'accommodation' }
export type ProgressTask = { id: string; title: string; kind: 'academic' | 'application' | 'funding' | 'planning'; dueAt: string | null; feature: Feature }
export type DashboardData = {
  profile?: ViaProfile | null; activeAnswers?: ReturnType<typeof emptyAnswers>
  record: OnboardingRecord | null; options: OnboardingOption[]; reports: Report[]
  // null means this source/calculation is unavailable, not a verified zero count.
  matches: ProgrammeMatch[] | null; funding: FundingOpportunity[] | null
  saved: SavedOpportunity[] | null; savedLoading?: boolean; tasks: ProgressTask[] | null
}
export type NextMove = { title: string; action: string; feature: Feature; subjectId?: string }

export const gradePriorities: Record<Grade, { focus: string; priority: 'subjects' | 'trajectory' | 'matches' | 'applications' | 'explore'; nextSteps: string[] }> = {
  '9': { focus: 'Subject choices and future pathways', priority: 'subjects', nextSteps: ['Explore Grade 10 subject choices', 'Review your interests and future pathways'] },
  '10': { focus: 'Your academic trajectory', priority: 'trajectory', nextSteps: ['Review your academic strengths and focus areas', 'Explore future study pathways'] },
  '11': { focus: 'Results, possibilities and preparation', priority: 'matches', nextSteps: ['Review programme requirements and application basics', 'Prepare your funding preferences'] },
  '12': { focus: 'Applications and your next step', priority: 'applications', nextSteps: ['Review application requirements and documents', 'Plan funding and accommodation'] },
  early: { focus: 'Subjects, interests and future pathways', priority: 'subjects', nextSteps: ['Explore your subjects and future pathways', 'Review your interests'] },
  other: { focus: 'Your next study opportunity', priority: 'explore', nextSteps: ['Review your study interests', 'Explore institution and funding preferences'] },
}
export function getGrade(stage: EducationStage | null): Grade {
  const grades: Partial<Record<EducationStage,Grade>> = { grade_9: '9', grade_10: '10', grade_11: '11', grade_12: '12' }
  return stage ? grades[stage] ?? 'other' : 'other'
}
export function academicInsight(percentage: number): AcademicResult['insight'] {
  return percentage >= 70 ? 'Strong' : percentage >= 50 ? 'On track' : 'Focus area'
}
export function deriveDashboard(data: DashboardData) {
  const answers = normaliseAnswers(data.activeAnswers ?? (data.record?.flow_version === 4 ? data.record.journey_answers : data.record?.flow_version === 3 ? emptyAnswers() : data.record?.answers) ?? emptyAnswers(), data.options, data.reports)
  // Keep historical selections stored, but omit explicitly skipped questions
  // from the current experience until the learner chooses Continue on them.
  const skipped = data.record?.skipped_steps ?? []
  if (skipped.includes('interests')) answers.interest_ids = []
  if (skipped.includes('personality')) answers.personality_ids = []
  if (skipped.includes('results')) { answers.results = []; answers.report_id = null }
  if (skipped.includes('school-subjects')) { answers.school_subject_ids = []; answers.school_subjects_unknown = false }
  if (skipped.includes('future-curiosity')) { answers.future_interest_ids = []; answers.future_exploring = false }
  const labels = (ids: string[]) => data.options.filter(option => ids.includes(option.id)).map(option => option.label)
  const canonicalStage = data.profile?.education_stage ?? null
  const stage = educationStages.find(item => item.value === canonicalStage)?.label ?? ''
  const grade = getGrade(canonicalStage)
  const higherEducation=['accepted','tertiary','graduate'].includes(canonicalStage??'')
  const config = canonicalStage==='accepted'?{focus:'Getting ready for higher education',priority:'explore' as const,nextSteps:['Confirm registration, funding and accommodation','Prepare for orientation']}:canonicalStage==='tertiary'?{focus:'Your studies and student life',priority:'explore' as const,nextSteps:['Review your academic and student support','Keep track of funding and study costs']}:canonicalStage==='post_matric'?{focus:'Your applications and next study opportunity',priority:'applications' as const,nextSteps:['Review your applications and funding','Explore study options and prepare for applications']}:gradePriorities[grade]
  const interests = answers.journey.interests.length?answers.journey.interests:labels(answers.interest_ids)
  const goals = [...new Set([...answers.journey.fields,...answers.journey.careers,...(answers.journey.programme_name?[answers.journey.programme_name]:[]),...labels(answers.goal_ids)])]
  const results: AcademicResult[] = answers.results.map(result => ({ subjectId: result.subject_id, subject: data.options.find(option => option.id === result.subject_id)!.label, percentage: result.mark, insight: academicInsight(result.mark) }))
  const weakest = [...results].sort((a,b) => a.percentage - b.percentage || a.subject.localeCompare(b.subject))[0]
  const incomplete = !canonicalStage || !data.record?.completed_at
  const banner = incomplete
    ? { text: 'Finish your VIA setup to personalise your journey.', action: 'Continue my VIA setup', to: '/onboarding/welcome' }
    : !higherEducation&&!results.length ? { text: 'Upload your latest results to unlock personalised VIA Matches.', action: 'Add my results', to: '/onboarding/results' } : null
  let nextMove: NextMove
  if (incomplete) nextMove = { title: 'Finish your VIA setup so your next steps reflect you.', action: 'Continue my setup', feature: 'profile' }
  else if (canonicalStage === 'grade_9') nextMove = { title: 'Build your Grade 10 subject plan', action: 'Build my subject plan', feature: 'subject-guide' }
  else if (canonicalStage==='accepted') nextMove={title:'Prepare for registration, funding, accommodation and orientation.',action:'Review my next steps',feature:'progress'}
  else if (canonicalStage==='tertiary') nextMove={title:'Stay supported through your studies and student life.',action:'View my support',feature:'assist'}
  else if (canonicalStage==='graduate') nextMove={title:'Your profile and history stay with you for your next chapter.',action:'View my profile',feature:'profile'}
  else if (!results.length) nextMove = { title: 'Add your latest subjects and marks to understand your academic starting point.', action: 'Scan my results', feature: 'scan' }
  else if (config.priority === 'subjects') nextMove = { title: config.nextSteps[0], action: 'Explore my pathways', feature: 'programmes' }
  else if (config.priority === 'applications') nextMove = { title: goals.length ? `Review application requirements for ${goals[0]} and prepare your documents.` : config.nextSteps[0], action: 'Review application readiness', feature: 'applications' }
  else if (weakest && weakest.percentage < 70) nextMove = { title: `Explore how improving ${weakest.subject} from ${weakest.percentage}% could shape your next steps.`, action: 'See what this could unlock', feature: 'whatif', subjectId: weakest.subjectId }
  else nextMove = { title: config.nextSteps[0], action: 'Explore my VIA Matches', feature: 'match' }

  // Suggestions are derived from known gaps/grade, not assigned tasks or deadlines.
  const suggested: ProgressTask[] = []
  if (incomplete) suggested.push({ id: 'complete-setup', title: 'Finish your VIA setup', kind: 'planning', dueAt: null, feature: 'profile' })
  if (!higherEducation&&!results.length) suggested.push({ id: 'add-results', title: 'Add your latest school results', kind: 'academic', dueAt: null, feature: 'scan' })
  else if (weakest?.insight === 'Focus area') suggested.push({ id: `focus-${weakest.subjectId}`, title: `Explore a study target for ${weakest.subject}`, kind: 'academic', dueAt: null, feature: 'whatif' })
  suggested.push({ id: `grade-${canonicalStage}`, title: config.nextSteps[0], kind: config.priority === 'applications' ? 'application' : 'planning', dueAt: null, feature: higherEducation?'assist':canonicalStage === 'grade_9' ? 'subject-guide' : config.priority === 'applications' ? 'applications' : 'programmes' })
  if (!['grade_9','grade_10'].includes(canonicalStage ?? '') && answers.preference_ids.some(id => data.options.find(option => option.id === id)?.icon === 'GraduationCap')) suggested.push({ id: 'funding-preferences', title: 'Review your funding preferences', kind: 'funding', dueAt: null, feature: 'fund' })
  const tasks = data.tasks ?? suggested.slice(0,3)
  const matches = data.matches === null ? null : data.matches.filter(match => match.percentage === null || (Number.isFinite(match.percentage) && match.percentage >= 0 && match.percentage <= 100)).sort((a,b) => (b.percentage ?? -1) - (a.percentage ?? -1))
  const basics = [
    { label: 'VIA setup', ready: !incomplete }, { label: 'Academic results', ready: results.length > 0 },
    { label: 'Study interests', ready: goals.length > 0 },
  ]
  return { answers, stage, grade, config, interests, goals, results, weakest, incomplete, banner, nextMove, tasks, suggestedTasks: data.tasks === null, matches, basics }
}
