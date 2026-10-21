import { supabase } from '../../../services/supabase'
import { getProfile } from '../../auth/services/profile'
import { emptyAnswers, normaliseAnswers } from './model'
import type { EducationStage } from '../config/education-stages'
import type { Answers, OnboardingOption, OnboardingRecord, Report, Step } from './model'

export async function loadOnboarding(userId: string) {
  const results = await Promise.all([
    supabase.from('via_onboarding_options').select('id,category,label,description,icon,tone,sort_order,education_stages').eq('active', true).order('sort_order'),
    supabase.from('via_onboarding').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('via_onboarding_reports').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    getProfile(userId),
  ])
  for (const result of [results[0], results[1], results[2]]) if (result.error) throw result.error
  const options = results[0].data as OnboardingOption[]
  for (const category of ['current','interest','personality','preference','institution_type','province','study_goal','subject','journey']) {
    if (!options.some(option => option.category === category)) throw new Error('Onboarding catalog is unavailable')
  }
  const record = results[1].data as OnboardingRecord | null
  const reports = results[2].data as Report[]
  const profile = results[3]
  if (!profile || (record && record.user_id !== userId) || reports.some(report => report.user_id !== userId)) throw new Error('Learner account could not be verified')
  let activeAnswers = normaliseAnswers(record?.answers ?? null, options, reports)
  if (record?.flow_version === 4) {
    activeAnswers = normaliseAnswers(record.journey_answers ?? null, options, reports)
  } else if (record?.flow_version === 3) {
    activeAnswers = emptyAnswers()
    if (profile?.education_stage === 'grade_9') {
      const selections = await supabase.from('via_learner_selections').select('kind,option_id').eq('user_id',userId).eq('education_stage','grade_9')
      if (selections.error) throw selections.error
      const ids = (kind: string) => selections.data.filter(item => item.kind === kind).map(item => item.option_id as string)
      Object.assign(activeAnswers, { interest_ids: ids('interest'), personality_ids: ids('strength'), school_subject_ids: ids('available_subject'), future_interest_ids: ids('future_interest'), school_subjects_unknown: record.branch_state?.school_subjects_unknown === true, future_exploring: record.branch_state?.future_exploring === true })
      if (record.academic_record_id) {
        const [academic, marks] = await Promise.all([supabase.from('via_academic_records').select('*').eq('user_id',userId).eq('education_stage','grade_9').eq('id',record.academic_record_id).maybeSingle(),supabase.from('via_academic_results').select('subject_id,mark').eq('user_id',userId).eq('record_id',record.academic_record_id)])
        if (academic.error || marks.error) throw academic.error || marks.error
        if (academic.data) Object.assign(activeAnswers, { school_name: academic.data.school_name, academic_year: academic.data.academic_year, report_grade: academic.data.grade, report_type: academic.data.report_type, report_id: academic.data.report_id, results: marks.data.map(item => ({ ...item, mark: Number(item.mark) })) })
      }
    }
  }
  if(profile?.education_stage==='grade_9' && record?.flow_version===4){
    const {data,error}=await supabase.from('via_grade9_onboarding').select('*').eq('user_id',userId).maybeSingle()
    // Keep existing Grade 9 dashboard reads available during schema rollout.
    // New onboarding saves still require the v12 RPC and never fall back to v11.
    if(error&&!['PGRST205','42P01'].includes(error.code))throw error
    activeAnswers=normaliseAnswers({...activeAnswers,grade9:data??undefined},options,reports)
  }
  return { options, record, reports, profile, activeAnswers }
}
export async function saveOnboarding(userId: string, answers: Answers, step: Step, revision: number, complete = false) {
  // Queued requests must not cross an account change.
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user.id !== userId) throw new Error('Session changed')
  const { data, error } = await supabase.rpc('save_my_onboarding', { p_answers: legacyAnswers(answers), p_current_step: step, p_expected_revision: revision, p_complete: complete })
  if (error) throw error
  return data as OnboardingRecord
}
export async function uploadReport(userId: string, file: File): Promise<Report> {
  const extensions: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' }
  if (!extensions[file.type] || !file.size || file.size > 10485760) throw new Error('Choose a PDF, JPG or PNG file up to 10 MB.')
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user.id !== userId) throw new Error('Please log in again before uploading.')
  const id = crypto.randomUUID()
  const path = `${userId}/${id}.${extensions[file.type]}`
  const { error: storageError } = await supabase.storage.from('via-school-reports').upload(path, file, { contentType: file.type, upsert: false })
  if (storageError) throw new Error('We could not upload your report. Check your connection and try again.')
  const { data, error } = await supabase.from('via_onboarding_reports').insert({ id, user_id: userId, storage_path: path, file_name: file.name.slice(0, 255), file_size: file.size, mime_type: file.type }).select('*').single()
  if (error) {
    await supabase.storage.from('via-school-reports').remove([path])
    throw new Error('We could not save your report. Please try uploading it again.')
  }
  return data as Report
}
export async function reportUrl(report: Report) {
  const { data, error } = await supabase.storage.from('via-school-reports').createSignedUrl(report.storage_path, 300)
  if (error) throw new Error('We could not open your report. Please try again.')
  return data.signedUrl
}

function legacyAnswers(answers: Answers) {
  const keys = ['current_id','interest_ids','personality_ids','goal_ids','preference_ids','institution_type_ids','location_mode','province_ids','school_name','academic_year','results','report_id'] as const
  return Object.fromEntries(keys.map(key => [key,answers[key]]))
}
async function requireSessionOwner(userId: string) {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user.id !== userId) throw new Error('Session changed')
}
export async function setEducationStage(userId: string, stage: EducationStage, revision: number) {
  await requireSessionOwner(userId)
  const { data, error } = await supabase.rpc('set_my_education_stage',{p_stage:stage,p_expected_revision:revision})
  if (error) throw error
  return data as OnboardingRecord
}
export async function saveAdaptive(userId: string, stage: EducationStage, answers: Answers, step: Step, revision: number, complete: boolean, answered: Step[], skipped: Step[], confirmResults = false) {
  await requireSessionOwner(userId)
  const { grade9, ...sharedAnswers }=answers
 const { data, error } = await supabase.rpc(stage==='grade_9'?'save_my_grade9_onboarding':'save_my_journey_onboarding',{p_stage:stage,p_answers:sharedAnswers,...(stage==='grade_9'?{p_grade9:grade9,p_confirm_results:confirmResults}:{}),p_current_step:step,p_expected_revision:revision,p_complete:complete,p_answered_steps:answered,p_skipped_steps:skipped})
  if (error) throw error
  return data as OnboardingRecord
}
