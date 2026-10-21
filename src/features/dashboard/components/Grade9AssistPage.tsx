import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Search } from 'lucide-react'
import { assistQuestions, educationSources } from '../services/grade9-education'
import './Grade9Dashboard.css'
import './Grade9LearningPages.css'

export function Grade9AssistPage() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = assistQuestions.filter(item => tokens.every(token => `${item.question} ${item.answer}`.toLowerCase().includes(token)))
  const current = assistQuestions.find(item => item.id === selected)
  const source = educationSources.find(item => item.id === current?.sourceId)
  const shown = tokens.length || showAll ? filtered : filtered.slice(0, 4)
  return <div className="g9-assist-page">
    <header className="g9-welcome"><div><span className="g9-eyebrow">TOOLS / VIA ASSIST</span><h1>VIA Assist</h1><p>What would you like help with?</p></div><Link className="g9-button" to="/dashboard/subject-choices">My Subject Choices <ArrowRight size={17} /></Link></header>
    <section className="g9-section" aria-labelledby="g9-assist-questions-heading"><h2 id="g9-assist-questions-heading">What would you like to understand?</h2><label className="g9-select-label" htmlFor="g9-assist-search">Search explanations</label><div className="g9-assist-search"><Search size={19} aria-hidden="true" /><input id="g9-assist-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Try Maths Lit, CAPS or reports" /></div><div className="g9-assist-question-list">{shown.map(item => <a className={`g9-button${current?.id === item.id ? ' g9-learning-selected' : ''}`} key={item.id} href="#grade9-assist-answer" onClick={() => setSelected(item.id)} aria-current={current?.id === item.id ? 'true' : undefined}>{item.question}<ArrowRight size={16} /></a>)}</div>{!tokens.length && filtered.length > 4 && <button className="g9-text-button" onClick={() => setShowAll(value => !value)} aria-expanded={showAll}>{showAll ? 'Show fewer questions' : 'View all questions'}</button>}{!filtered.length && <p role="status">No matching explanation yet. Try a shorter phrase, or <button className="g9-text-button" onClick={() => { setSearch(''); setShowAll(true) }}>show all questions</button>.</p>}</section>
    {current && <section className="g9-section" id="grade9-assist-answer" tabIndex={-1} aria-labelledby="g9-assist-answer-heading"><span className="g9-eyebrow">VIA EXPLAINS</span><div aria-live="polite"><h2 id="g9-assist-answer-heading">{current.question}</h2><p>{current.answer}</p></div><div className="g9-actions"><Link className="g9-button primary" to={current.to}>{current.action}<ArrowRight size={16} /></Link>{source && <a className="g9-button" href={source.url} target="_blank" rel="noopener noreferrer">Check Official Source ↗</a>}</div><p className="g9-disclaimer">These explanations help you understand your options. Use your Subject Choices page to work on your own plan, and speak to your school about its subjects and rules.</p></section>}
  </div>
}
