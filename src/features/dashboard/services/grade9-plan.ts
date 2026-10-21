import { supabase } from '../../../services/supabase'

export type Grade9Plan = {
  user_id: string
  shortlisted_subject_ids: string[]
  explored_subject_ids: string[]
  reviewed_results: boolean
  reviewed_results_key: string
  maths_reviewed: boolean
  explored_pathway_ids: string[]
  plan_reviewed: boolean
  algebra_feeling: string
  dream_areas: string
  revision: number
  updated_at: string | null
}
export type Grade9PlanPatch = Partial<Omit<Grade9Plan, 'user_id' | 'revision' | 'updated_at'>>

export function defaultGrade9Plan(initialIds: string[] = []): Grade9Plan {
  return { user_id: '', shortlisted_subject_ids: [...new Set(initialIds)], explored_subject_ids: [], reviewed_results: false, reviewed_results_key: '', maths_reviewed: false, explored_pathway_ids: [], plan_reviewed: false, algebra_feeling: '', dream_areas: '', revision: 0, updated_at: null }
}

function planError(error: { code?: string; message?: string }) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')) return new Error('Your subject plan is temporarily unavailable. Your results are safe. Please try again later.')
  if (error.code === '40001') return new Error('Your plan changed in another tab. Retry to reload the latest plan and save this change.')
  if (error.code === '42501') return new Error('Please sign in to your Grade 9 account again before saving your plan.')
  return new Error(error.message || 'We could not save your Grade 10 plan. Check your connection and retry.')
}

export async function loadGrade9Plan(userId: string): Promise<Grade9Plan | null> {
  const { data, error } = await supabase.from('via_grade9_plans').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw planError(error)
  if (data && data.user_id !== userId) throw new Error('This plan does not belong to the signed-in learner.')
  return data as Grade9Plan | null
}

export async function saveGrade9Plan(userId: string, patch: Grade9PlanPatch, revision: number): Promise<Grade9Plan> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user.id !== userId) throw new Error('Your account changed. Reload your plan before saving.')
  const { data, error } = await supabase.rpc('save_my_grade9_plan', { p_patch: patch, p_expected_revision: revision })
  if (error) throw planError(error)
  if (!data || data.user_id !== userId) throw new Error('Your plan could not be verified. Reload before trying again.')
  return data as Grade9Plan
}
