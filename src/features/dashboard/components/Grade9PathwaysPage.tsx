import { Grade9Disclosure } from './Grade9Disclosure'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowDown, ArrowRight, Check, Compass } from 'lucide-react'
import { deriveDashboard, type DashboardData } from '../services/dashboard-model'
import { relevantPathways } from '../services/grade9-guidance'
import { educationSources, pathwayDetails } from '../services/grade9-education'
import './Grade9Dashboard.css'
import './Grade9LearningPages.css'

const combinations = [
  { subjects: 'Mathematics + Physical Sciences', fields: ['Engineering', 'Computer Science', 'Data Science', 'Physical Sciences', 'Architecture'], id: 'engineering' },
  { subjects: 'Accounting + Business Studies', fields: ['Accounting', 'Finance', 'Business', 'Economics', 'Entrepreneurship'], id: 'business' },
  { subjects: 'Life Sciences + Physical Sciences', fields: ['Health Sciences', 'Biological Sciences', 'Environmental Sciences', 'Pharmacy'], id: 'health' },
]

export function Grade9PathwaysPage({ data, onExplore, exploredPathwayIds = [], busy = false }: { data: DashboardData; onExplore: (id: string) => void; exploredPathwayIds?: string[]; busy?: boolean }) {
  const view = deriveDashboard(data)
  const location = useLocation()
  const navigate = useNavigate()
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const [showAll, setShowAll] = useState(false)
  const signals = [...view.interests, ...view.goals, ...data.options.filter(option => view.answers.future_interest_ids.includes(option.id)).map(option => option.label)]
  const savedCareers = [...new Set(view.answers.journey.careers)]
  const futureRoute = data.record?.flow_version === 4 ? "/onboarding/future-interests" : "/onboarding/future-curiosity"
  const relevantIds = new Set([
    ...relevantPathways(signals).map(pathway => pathway.id),
    ...pathwayDetails.filter(pathway => signals.some(signal => pathway.pattern.test(signal) && !(pathway.id === 'engineering' && /software|data engineer/i.test(signal)))).map(pathway => pathway.id),
  ])
  const startingFields = ['technology', 'business', 'creative', 'services']
  const ordered = [...pathwayDetails].sort((a, b) => {
    if (relevantIds.size) return Number(relevantIds.has(b.id)) - Number(relevantIds.has(a.id))
    const order = (id: string) => startingFields.includes(id) ? startingFields.indexOf(id) : startingFields.length
    return order(a.id) - order(b.id)
  })
  const requested = new URLSearchParams(location.search).get('pathway')
  const selected = pathwayDetails.find(pathway => pathway.id === requested) ?? ordered[0]
  const explored = exploredPathwayIds.includes(selected.id)
  const shown = showAll ? ordered : ordered.slice(0, 4)
  const careerSuggestions = ordered.flatMap(pathway => pathway.careers.slice(0, 1).map(career => ({ ...career, pathwayId: pathway.id, field: pathway.title })))

  useEffect(() => {
    if (location.hash !== '#pathway-detail') return
    const frame = requestAnimationFrame(() => {
      detailHeading.current?.scrollIntoView({ block: 'start' })
      detailHeading.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.search])

  function choose(id: string) {
    navigate(`/dashboard/study-pathways?pathway=${encodeURIComponent(id)}#pathway-detail`)
  }

  return <div className="g9-pathways-page">
    <header className="g9-welcome"><div><span className="g9-eyebrow">MY JOURNEY / STUDY PATHWAYS</span><h1>Where could your choices take you?</h1><p>Start with one field. See the careers and subjects it connects to.</p></div><Link className="g9-button" to="/dashboard/subject-choices">My Subject Choices <ArrowRight size={17} /></Link></header>
    <section className="g9-section" id="pathway-detail" aria-labelledby="g9-pathway-detail-heading"><span className="g9-eyebrow">YOUR PATHWAY EXPLORER</span><h2 id="g9-pathway-detail-heading" tabIndex={-1} ref={detailHeading}>Explore a study field</h2>{savedCareers.length ? <p><strong>Your saved career interests:</strong> {savedCareers.join(' · ')}. Use the field explorer to look into the subjects and routes that could support them.</p> : view.goals.length ? <p><strong>Your saved study and career interests:</strong> {view.goals.join(' · ')}. Explore the areas that interest you; choosing a career is optional.</p> : <p>Choose an area you are curious about. You can compare pathways without committing to one.</p>}<label className="g9-select-label" htmlFor="g9-study-field">I want to explore</label><select id="g9-study-field" value={selected.id} onChange={event => choose(event.target.value)}>{ordered.map(pathway => <option key={pathway.id} value={pathway.id}>{pathway.title}</option>)}</select><div className="g9-check-result" key={selected.id}><h3>{selected.title}</h3><p>{selected.description}</p><div className="g9-grid g9-learning-two-columns"><article className="g9-tile"><h3>Careers inside this field</h3><ul className="g9-learning-detail-list">{selected.careers.map(career => <li key={career.name}><strong>{career.name}</strong><p>{career.description}</p></li>)}</ul></article><article className="g9-tile"><h3>Grade 10 subjects to explore</h3><ul>{selected.supportingSubjects.map(subject => <li key={subject}>{subject}</li>)}</ul><p>Discuss these with your school. You do not need every subject listed for every route.</p></article></div><Grade9Disclosure title="Study routes & requirements"><div><h3>Looking ahead to Grades 11–12</h3><p>{selected.laterSubjects}</p></div><h3>Different routes into this field</h3><div className="g9-grid">{selected.routes.map(route => <article className="g9-tile" key={route.name}><h3>{route.name}</h3><p>{route.description}</p></article>)}</div><div className="g9-note"><h3>Subjects that matter</h3><p>{selected.requirements}</p><p>These routes lead to different qualifications and roles. Progression between them has conditions; no route guarantees entry into another qualification.</p><a href={selected.source} target="_blank" rel="noopener noreferrer">Check the official planning source ↗</a></div><div><h3>Related study areas</h3><ul className="g9-learning-tags">{selected.programmes.map(programme => <li key={programme}>{programme}</li>)}</ul></div></Grade9Disclosure><div className="g9-actions"><Link className="g9-button primary" to="/dashboard/subject-choices#other-subjects">Explore Required Subjects <ArrowRight size={16} /></Link><button className="g9-button" onClick={() => onExplore(selected.id)} disabled={explored || busy}>{explored ? <><Check size={17} aria-hidden="true" />Explored</> : "I've explored this pathway"}</button></div><p className="g9-disclaimer">Mark a pathway explored once you have considered its subjects and routes. Opening a field does not complete this step for you.</p></div></section>

    <Grade9Disclosure title="Explore subject combinations"><p>These combinations are starting points for exploration. Each programme has its own requirements, and useful subjects are not always compulsory subjects.</p><div className="g9-grid">{combinations.map(combination => <article className="g9-tile g9-pathway" key={combination.id}><h3>{combination.subjects}</h3><ArrowDown aria-hidden="true" /><ul>{combination.fields.map(field => <li key={field}>{field}</li>)}</ul><button className="g9-text-button" onClick={() => choose(combination.id)}>Explore this pathway <ArrowRight size={16} /></button></article>)}</div></Grade9Disclosure>

    <Grade9Disclosure title="My saved interests" id="interests">{view.interests.length ? <><p>Your saved interests:</p><ul className="g9-learning-tags">{view.interests.map(interest => <li key={interest}><Compass size={15} aria-hidden="true" />{interest}</li>)}</ul></> : <p>You have not saved interests yet. It is okay to still be exploring.</p>}{view.answers.journey.fields.length > 0 && <p><strong>Areas you want to explore:</strong> {view.answers.journey.fields.join(' · ')}</p>}<p>Areas connected to your interests appear first below. You can explore any field, and change your interests as you learn more.</p><div className="g9-actions"><Link className="g9-button" to="/onboarding/interests">Update My Interests <ArrowRight size={16} /></Link><Link className="g9-button" to={futureRoute}>Update My Future Interests</Link></div></Grade9Disclosure>

    <Grade9Disclosure title="Browse more fields"><div className="g9-grid">{shown.map(pathway => <article className={`g9-tile${selected.id === pathway.id ? ' g9-learning-selected' : ''}`} key={pathway.id}>{relevantIds.has(pathway.id) && <span className="g9-eyebrow">CONNECTED TO YOUR INTERESTS</span>}<h3>{pathway.title}</h3><p>{pathway.description}</p><button className="g9-text-button" onClick={() => choose(pathway.id)} aria-controls="pathway-detail">Explore field <ArrowRight size={16} /></button>{exploredPathwayIds.includes(pathway.id) && <span className="g9-learning-status"><Check size={16} aria-hidden="true" />Explored</span>}</article>)}</div><button className="g9-button" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? 'Show Fewer Fields' : 'Explore More Fields'}</button></Grade9Disclosure>



    <Grade9Disclosure title="Not sure yet? Discover careers" id="grade9-careers"><p>That is okay. Start with a few possibilities{relevantIds.size ? ' connected to your interests' : ''}, and notice what you would like to understand better.</p><div className="g9-grid">{careerSuggestions.slice(0, 3).map(career => <article className="g9-tile" key={career.pathwayId}><span className="g9-eyebrow">{career.field}</span><h3>{career.name}</h3><p>{career.description}</p><button className="g9-text-button" onClick={() => choose(career.pathwayId)}>Explore Career <ArrowRight size={16} /></button></article>)}</div><p className="g9-disclaimer">These are examples to investigate, not a prediction of the career you should choose.</p></Grade9Disclosure>

    <Grade9Disclosure title="Understand the different study routes"><p>Universities, universities of technology and TVET colleges offer different kinds of learning. Explore both the work you would enjoy and the qualification that prepares you for it. For now, focus on understanding subjects and possibilities.</p><div className="g9-learning-sources">{educationSources.filter(source => ['subject-choice', 'technology-routes', 'vocational-routes'].includes(source.id)).map(source => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a>)}</div><div className="g9-actions"><Link className="g9-button" to="/dashboard/subject-choices">See My Subject Plan <ArrowRight size={16} /></Link><Link className="g9-button" to="/dashboard/next-steps">Review My Next Steps</Link></div></Grade9Disclosure>
  </div>
}

