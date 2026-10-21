import type { Opportunity, Requirement } from '../../discovery/services/model'
import { groupProgrammes } from '../../discovery/services/programme-model.ts'
import { deriveDashboard, type DashboardData } from './dashboard-model.ts'

export const grade10Insight = (mark: number) => mark >= 70 ? 'Strong' : mark >= 60 ? 'Doing well' : mark >= 50 ? 'Keep working' : 'Needs attention'
const normalize = (text: string) => text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
export function subjectName(text: string) {
  const name = normalize(text).replace(/\bmaths\b/g, 'mathematics').replace(/\bhl\b/g,'home language').replace(/\bfal\b/g,'first additional language')
  return ({ 'physical science': 'physical sciences', 'life science': 'life sciences', 'mathematics lit': 'mathematical literacy', 'mathematics literacy': 'mathematical literacy', cat: 'computer applications technology', it: 'information technology' } as Record<string,string>)[name] || name
}
export type SchoolSubject = { id: string; label: string; mark: number | null }
function matchesSubject(requirement: string, subject: string) {
  const target = subjectName(requirement), actual = subjectName(subject)
  if (target === actual) return true
  // A generic language requirement can use HL/FAL marks. A specific language
  // level must never silently use an unlabelled language or another level.
  return ['english','afrikaans'].includes(target) && [target + ' home language',target + ' first additional language',target + ' hl',target + ' fal'].includes(actual)
}
function alternatives(label: string) {
  if (/^english (?:home language|hl) or (?:first additional language|fal)$/i.test(label)) return ['English Home Language','English First Additional Language']
  return label.split(/\s+or\s+|\s*\/\s*/i).map(value => value.trim()).filter(Boolean)
}
export function compareSubjectRequirement(requirement: Requirement, subjects: SchoolSubject[]) {
  const options = requirement.subject ? alternatives(requirement.subject) : []
  const taken = subjects.filter(subject => options.some(option => matchesSubject(option,subject.label)))
  const marked = taken.filter(subject => subject.mark !== null).sort((a,b) => b.mark! - a.mark!)
  const selected = marked[0] ?? taken[0]
  const minimum = typeof requirement.minimum_percentage === 'number' && Number.isFinite(requirement.minimum_percentage) && requirement.minimum_percentage >= 0 && requirement.minimum_percentage <= 100 ? requirement.minimum_percentage : null
  const mark = selected?.mark ?? null
  const status = requirement.recommended ? 'recommended' : !options.length ? 'unknown' : !selected ? 'not_taken' : mark === null || minimum === null ? 'unknown' : mark >= minimum ? 'on_track' : 'improve'
  return { requirement, subject: selected ?? null, mark, minimum, status }
}
const signalFamilies = [
  /technolog|comput|software|data|coding|digital/i,
  /engineer|construction|infrastructure/i,
  /medic|health|doctor|nurs|biolog/i,
  /business|account|finance|commerce|econom|entrepreneur/i,
  /law|legal|lawyer/i,
  /educat|teach/i,
  /creativ|design|art\b|music/i,
  /agricultur|farm/i,
]
export function interestConnection(item: Opportunity, signals: string[]) {
  const text = [item.title,item.field,...(item.career_keywords ?? [])].join(' ')
  return signals.some(signal => normalize(signal).length >= 3 && normalize(text).includes(normalize(signal)) || signalFamilies.some((family,index) => family.test(signal) && family.test(text) && !(index === 1 && /software|data engineer/i.test(signal))))
}
export function buildGrade10Guidance(data: DashboardData, offerings: Opportunity[]) {
  const view = deriveDashboard(data)
  const currentResults = view.answers.report_grade === 10 ? view.results : []
  const ids = [...new Set([...view.answers.school_subject_ids, ...currentResults.map(result => result.subjectId)])]
  const subjects: SchoolSubject[] = ids.flatMap(id => {
    const option = data.options.find(option => option.id === id && option.category === 'subject')
    return option ? [{id,label:option.label,mark:currentResults.find(result => result.subjectId === id)?.percentage ?? null}] : []
  })
  const signals = [...view.interests,...view.goals]
  const groups = groupProgrammes(offerings.filter(item => !item.is_demo))
  const suggested = groups.map(item => {
    const rows = item.programme_group!.offerings
    const connections = rows.flatMap(row => row.requirements.filter(req => !req.is_demo).map(req => compareSubjectRequirement(req,subjects))).filter(check => check.subject)
    const shared = [...new Set(connections.map(check => check.subject!.label))]
    const subjectSpecific = shared.some(label => !/language|english|afrikaans|orientation/i.test(label))
    const interests = rows.some(row => interestConnection(row,signals))
    return {item,shared,interests,score:shared.length + Number(subjectSpecific) * 3 + Number(interests) * 6,subjectSpecific}
  }).filter(item => item.shared.length > 0 && (item.subjectSpecific || item.interests)).sort((a,b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
  const has = (name: string) => subjects.some(subject => subjectName(subject.label) === subjectName(name))
  const maths = has('Mathematics'), physics = has('Physical Sciences'), biology = has('Life Sciences')
  const pathways = [
    {id:'engineering',name:'Engineering',search:'Engineering',available:maths && physics,reason:'Your Mathematics and Physical Sciences are commonly important subjects for engineering programmes.'},
    {id:'technology',name:'Computer Science & Technology',search:'Computer Science',available:maths,reason:'Mathematics can help keep many computing and technology pathways open.'},
    {id:'science',name:'Science',search:'Science',available:maths && (physics || biology),reason:`Your ${['Mathematics',physics && 'Physical Sciences',biology && 'Life Sciences'].filter(Boolean).join(', ')} can support a range of science pathways.`},
    {id:'health',name:'Health Sciences',search:'Health',available:maths && (physics || biology),reason:'Your Mathematics and science subjects may support pathways into health-related programmes.'},
    {id:'business',name:'Business & Finance',search:'Business',available:has('Accounting') || has('Business Studies') || has('Economics'),reason:'Your commerce subjects are a starting point for exploring business and finance. Check each programme’s Mathematics requirements.'},
  ].filter(pathway => pathway.available)
  // Targets retain the exact offering and requirement that supplied the mark.
  // Never manufacture a generic 60% target or blend two institutions' rules.
  const improvements = suggested.flatMap(group => group.item.programme_group!.offerings.flatMap(offering => offering.requirements.filter(req => !req.is_demo && !req.recommended).map(requirement => ({...compareSubjectRequirement(requirement,subjects),offering}))))
    .filter(check => check.status === 'improve')
    .sort((a,b) => a.minimum! - b.minimum! || a.offering.title.localeCompare(b.offering.title))
    .filter((item,index,items) => items.findIndex(other => other.subject?.id === item.subject?.id) === index)
  return {view,subjects,pathways,groups,suggested,improvements,currentResults,signals}
}
