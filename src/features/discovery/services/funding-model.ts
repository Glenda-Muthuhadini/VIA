import type { Opportunity } from './model.ts'

export function fundingClosingDate(item: Pick<Opportunity,'cycles'>) {
  const cycles = item.cycles || []
  if (!cycles.length) return null
  const year = Math.max(...cycles.map(cycle=>cycle.academic_year || 0))
  const date = cycles.filter(cycle=>(cycle.academic_year || 0)===year).map(cycle=>cycle.closes_on).filter((value): value is string=>!!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))).sort()[0]
  if (!date) return null
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric',timeZone:'Africa/Johannesburg'})
}

export function fundingList(values: (string | null | undefined)[] | null | undefined) {
  return [...new Set((values || []).filter((value): value is string=>!!value?.trim()).map(value=>value.trim()))]
}
