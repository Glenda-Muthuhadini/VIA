import { supabase } from '../../../services/supabase'
import type { Opportunity } from './model'

export type ApsRange = { aps_min: number | null; aps_max: number | null }
export type FacultyProgramme = ApsRange & { id: string; title: string }
export type InstitutionFaculty = ApsRange & { id: string; name: string; programme_count: number; programmes: FacultyProgramme[] }

export function institutionCardData(item: Opportunity) {
 const complete = (cycle: Opportunity['cycles'][number]) => cycle.fee != null && Number.isFinite(cycle.fee) && !!cycle.closes_on && Number.isFinite(Date.parse(cycle.closes_on))
 const cycle = item.cycles.find(cycle => cycle.is_demo && complete(cycle)) ?? item.cycles.find(complete)
 const range = item.aps_range
 if (!cycle || range?.aps_min == null || range.aps_max == null || !Number.isFinite(range.aps_min) || !Number.isFinite(range.aps_max)) return null
 return { fee: cycle.fee!, deadline: cycle.closes_on!, aps: range.aps_min === range.aps_max ? String(range.aps_min) : `${range.aps_min}–${range.aps_max}` }
}

export function apsLabel(range: ApsRange | undefined) {
 if (range?.aps_min == null || range.aps_max == null) return 'Varies by programme'
 return range.aps_min === range.aps_max ? String(range.aps_min) : `${range.aps_min}–${range.aps_max}`
}
export function institutionName(item: Pick<Opportunity, 'title' | 'abbreviation'>) {
 const abbreviation = item.abbreviation
 return abbreviation && !item.title.toLowerCase().includes(abbreviation.toLowerCase()) ? `${item.title} (${abbreviation})` : item.title
}
export async function institutionSummaries(ids: string[], signal?: AbortSignal): Promise<Record<string, ApsRange>> {
 let request = supabase.rpc('public_institution_summaries', { p_ids: ids })
 if (signal) request = request.abortSignal(signal)
 const { data, error } = await request
 if (error) throw error
 if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid institution summary')
 return data
}
export async function institutionFaculties(id: string, query: string, signal: AbortSignal): Promise<InstitutionFaculty[]> {
 const { data, error } = await supabase.rpc('public_institution_faculties', { p_institution: id, p_query: query }).abortSignal(signal)
 if (error) throw error
 if (!Array.isArray(data) || data.some(faculty => !Array.isArray(faculty.programmes))) throw new Error('Invalid faculty response')
 return data
}
