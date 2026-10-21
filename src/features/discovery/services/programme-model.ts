import type { Opportunity, SearchResult } from './model.ts'
import { safeExternalUrl } from './model.ts'

const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => !!value?.trim()).map(value => value.trim()))]
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// Strip qualification prefixes, never specialisations or subject combinations.
// For example, a Computer Science major remains distinct from Mathematical Sciences.
export function programmeName(item: Pick<Opportunity, 'title' | 'qualification'>) {
  return item.title
    .replace(/^(?:BSc|BCom|BEng|BEd|BA)\b[\s–—-]*(?:in\s+)?/i, '')
    .replace(/^(?:Bachelor(?:'s)?(?:\s+Degree)?\s+(?:of\s+(?:Science|Arts|Commerce|Engineering|Education|Business Science)(?:\s+in)?|of|in)|Diploma\s+in|Higher Certificate\s+in|NC\(V\))\s+/i, '')
    .replace(/\s+major$/i, '').trim() || item.title
}

export function programmeKey(item: Opportunity) {
  return `${item.is_demo ? 'demo' : 'published'}:${normalize(item.qualification || 'unknown')}:${normalize(programmeName(item))}`
}

function typicalDuration(offerings: Opportunity[]) {
  const durations = unique(offerings.map(item => item.duration))
  if (!durations.length) return 'Duration not listed'
  if (durations.every(value => /^\d+(?:\.\d+)?\s+years?$/i.test(value))) {
    const years = durations.map(value => Number.parseFloat(value))
    const min = Math.min(...years), max = Math.max(...years)
    return min === max ? `${min} ${min === 1 ? 'year' : 'years'}` : `${min}–${max} years`
  }
  return durations.length === 1 ? durations[0] : 'Duration varies by offering'
}

export function groupProgrammes(offerings: Opportunity[]): Opportunity[] {
  const groups = new Map<string, Opportunity[]>()
  for (const item of offerings) {
    const key = programmeKey(item)
    groups.set(key, [...(groups.get(key) || []), item])
  }
  return [...groups.values()].map(rows => {
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id))
    const first = sorted[0]
    const group = {
      name: programmeName(first),
      qualification: first.qualification === 'Bachelor' ? "Bachelor's Degree" : first.qualification || 'Qualification not listed',
      duration: typicalDuration(sorted),
      fields: unique(sorted.flatMap(item => [item.field, ...(item.career_keywords || [])])),
      careers: unique(sorted.flatMap(item => item.career_keywords || [])),
      institution_count: new Set(sorted.map(item => item.institution_id).filter(Boolean)).size,
      offerings: sorted.sort((a,b) => (a.institution_name || '').localeCompare(b.institution_name || '') || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)),
    }
    return { ...first, title: group.name, programme_group: group }
  }).sort((a,b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
}

export function programmeSearch(offerings: Opportunity[], query: string, filters: Record<string,string>, page: number): SearchResult {
  const groups = groupProgrammes(offerings)
  const institutions = [...new Map(offerings.filter(item=>item.institution_id).map(item=>[item.institution_id!,{value:item.institution_id!,label:item.institution_name || 'Institution name not listed'}])).values()].sort((a,b)=>a.label.localeCompare(b.label))
  const facets: Record<string,string[]> = {}
  for (const key of ['field','qualification','province'] as const) facets[key] = unique(offerings.map(item=>item[key])).sort()
  const filtered = groups.filter(item => item.programme_group!.offerings.some(offering => {
    const text = [programmeName(offering),offering.title,offering.field,offering.qualification,...(offering.career_keywords||[])].join(' ').toLowerCase()
    if (query.trim() && !text.includes(query.trim().toLowerCase())) return false
    return Object.entries(filters).every(([key,value]) => {
      if (key === 'institution') return offering.institution_id === value
      if (key === 'aps_min' || key === 'aps_max') return offering.minimum_aps != null && (key === 'aps_min' ? offering.minimum_aps >= Number(value) : offering.minimum_aps <= Number(value))
      if (key === 'mathematics') return offering.mathematics_required != null && String(offering.mathematics_required) === value
      if (key === 'applications') {
        const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
        return offering.cycles.some(cycle=>cycle.opens_on && cycle.closes_on && cycle.opens_on<=today && cycle.closes_on>=today)
      }
      return offering[key as 'field'|'qualification'|'province'] === value
    })
  }))
  return {items:filtered.slice((page-1)*12,page*12),total:filtered.length,facets,institutions}
}

export function programmeApplicationUrl(offering: Opportunity) {
  return safeExternalUrl(offering.application_url)
}

export function offeringDestination(kind: 'bursaries'|'accommodation', offering: Opportunity) {
  const params = new URLSearchParams()
  if (offering.institution_id) params.set('institution',offering.institution_id)
  if (kind === 'bursaries') params.set('programme',offering.id)
  else if (offering.campus) params.set('campus',offering.campus)
  return `/${kind}?${params}`
}
