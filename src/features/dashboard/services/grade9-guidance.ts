import type { AcademicResult } from './dashboard-model'
import type { Opportunity } from '../../discovery/services/model'

// Editorial planning examples are kept separate from the live programme catalogue.
// These are exploration prompts, never an admission or eligibility calculation.
export const pathways = [
  { id: 'technology', name: 'Software Engineering', pattern: /technolog|comput|software|data|coding|digital/i, subjects: ['Mathematics'], explore: ['Computer Science', 'Software Development', 'Information Technology', 'Data Science'], description: 'Mathematics appears in many computing pathways. English and science requirements depend on the programme.', source: 'https://www.wits.ac.za/undergraduate/entry-requirements/' },
  { id: 'engineering', name: 'Engineering', pattern: /engineer|building|construction|robot|architect/i, subjects: ['Mathematics', 'Physical Sciences'], explore: ['Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering'], description: 'Strongly consider keeping Mathematics and Physical Sciences. For example, Wits Civil Engineering lists both, along with English.', source: 'https://www.wits.ac.za/course-finder/undergraduate/ebe/civil-engineering/' },
  { id: 'health', name: 'Medicine & Health Sciences', pattern: /medic|health|doctor|nurs|biology|life science|environment/i, subjects: ['Mathematics', 'Physical Sciences', 'Life Sciences'], explore: ['Health Sciences', 'Biological Sciences', 'Environmental Sciences'], description: 'Consider Mathematics and the sciences to preserve health pathways. Wits Medicine considers Mathematics, English and the better of Physical Sciences or Life Sciences. Other programmes differ; both sciences are not universally required.', source: 'https://www.wits.ac.za/course-finder/undergraduate/health/medicine-and-surgery/' },
  { id: 'business', name: 'Business & Accounting', pattern: /business|account|finance|commerce|econom|entrepreneur/i, subjects: [], explore: ['Accounting', 'Finance', 'Business', 'Economics', 'Entrepreneurship'], description: 'Compare the Mathematics requirements of individual commerce programmes. Accounting and Business Studies can be useful subjects to explore, but are not universal admission requirements.', source: 'https://www.wits.ac.za/undergraduate/entry-requirements/' },
]
export function relevantPathways(signals: string[]) {
  return pathways.filter(pathway => signals.some(signal => pathway.pattern.test(signal) && !(pathway.id === 'engineering' && /software|data engineer/i.test(signal))))
}
export function buildGrade9Guidance(results: AcademicResult[], signals: string[], offerings: Opportunity[]) {
  const relevant = relevantPathways(signals)
  const evidence = offerings.filter(item => {
    if (item.is_demo) return false
    const description = [item.title, item.field, ...(item.career_keywords ?? [])].join(' ')
    return relevant.some(pathway => pathway.pattern.test(description)) || signals.some(signal => signal.trim().length >= 3 && description.toLowerCase().includes(signal.trim().toLowerCase()))
  })
  const subjects = new Map<string, { subject: string; reasons: string[]; sources: { label: string; url: string }[] }>()
  function add(subject: string, reason: string, source?: { label: string; url: string }) {
    const item = subjects.get(subject) ?? { subject, reasons: [], sources: [] }
    if (!item.reasons.includes(reason)) item.reasons.push(reason)
    if (source && /^https:\/\//.test(source.url) && !item.sources.some(s => s.url === source.url)) item.sources.push(source)
    subjects.set(subject, item)
  }
  for (const pathway of relevant) for (const subject of pathway.subjects) add(subject, `${pathway.name}: ${pathway.description}`, { label: 'Official planning example', url: pathway.source })
  for (const offering of evidence) for (const requirement of offering.requirements ?? []) {
    if (requirement.is_demo || !requirement.subject) continue
    const subject = requirement.subject.trim()
    add(subject, `${offering.title} at ${offering.institution_name || 'this institution'} lists ${subject}${requirement.recommended ? ' as recommended' : ' in its subject requirements'}.`, { label: `${offering.institution_name || 'Institution'} requirements`, url: requirement.source_url || offering.source_url || '' })
  }
  if (relevant.some(p => p.id === 'technology')) add('Computer Applications Technology', 'Your technology interests may make CAT worth exploring for practical computer skills. It is an optional interest suggestion, not a general computing admission requirement.')
  return [...subjects.values()].map(item => {
    const foundation = results.find(result => ['Physical Sciences', 'Life Sciences'].includes(item.subject) ? /^natural sciences$/i.test(result.subject) : item.subject === 'Computer Applications Technology' ? /^technology$/i.test(result.subject) : result.subject.toLowerCase() === item.subject.toLowerCase())
    return { ...item, foundation: foundation ? `${foundation.subject}: ${foundation.percentage}%. ${foundation.percentage >= 70 ? 'This is a current strength you can build on.' : foundation.percentage >= 50 ? 'Keep building this foundation.' : 'Ask your teacher for support with this foundation; an interest does not disappear because a mark needs attention.'}` : null }
  })
}
