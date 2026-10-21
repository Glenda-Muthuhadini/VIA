import type { EducationStage } from '../../onboarding/config/education-stages'
import { supabase } from '../../../services/supabase'

export type ViaProfile = {
  education_stage: EducationStage | null
  education_stage_confirmation_required: boolean
  id: string
  first_name: string
  last_name: string
  created_at: string
  updated_at: string
}

const pendingProfiles = new Map<string, Promise<ViaProfile | null>>()

// Share concurrent reads only. Never cache a previous account's resolved profile.
export function getProfile(userId: string): Promise<ViaProfile | null> {
  const pending = pendingProfiles.get(userId)
  if (pending) return pending
  const request = fetchProfile(userId).finally(() => {
    if (pendingProfiles.get(userId) === request) pendingProfiles.delete(userId)
  })
  pendingProfiles.set(userId, request)
  return request
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from('via_profiles')
    .select('id, first_name, last_name, created_at, updated_at, education_stage, education_stage_confirmation_required')
    .eq('id', userId).maybeSingle<ViaProfile>()
  if (error) throw error
  if (data && data.id !== userId) throw new Error('Profile owner changed')
  return data
}
