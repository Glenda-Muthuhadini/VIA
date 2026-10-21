import { OnboardingProgress } from '../components/OnboardingProgress'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import {
  ArrowRight,
  Clock,
  Search,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingControls } from '../components/OnboardingControls'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'

export function StudyPlanStepPage() {
  const { answers, choices, patch } = useOnboarding()
  const [query, setQuery] = useState('')
  const goals = choices('study_goal')
  const suggestions = goals.filter(option => !answers.goal_ids.includes(option.id) && `${option.label} ${option.description}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
  return (
    <main className="via-product-page via-onboarding-choice via-onboarding-study-plan">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-choice-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <section className="via-onboarding-panel via-onboarding-panel-wide">
        <header className="via-onboarding-panel-header">
          <OnboardingHomeLink>
            <img className="via-onboarding-panel-logo" src={viaLogo} alt="VIA" />
          </OnboardingHomeLink>

          <OnboardingProgress />

          <div className="via-onboarding-panel-time">
            <Clock size={18} />
            About 3 minutes
          </div>
        </header>

        <div className="via-onboarding-panel-copy">
          <h1>
            Do you have something <span>in mind?</span>
          </h1>
          <p>
            Tell us how clear you are about what you want to study. You can
            always change this later.
          </p>
        </div>

        <section className="via-onboarding-considering-card">
          <h2>What are you considering?</h2>
          <p>
            Search for careers, courses or fields that interest you. You can add
            more than one.
          </p>

          <label className="via-onboarding-search-field">
            <Search size={22} />
            <input
              aria-label="Search careers, courses or fields"
              placeholder="Search careers, courses or fields..."
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              aria-controls="via-study-suggestions"
            />
          </label>
          <ul id="via-study-suggestions" className="via-onboarding-suggestions" aria-label="Study interests">
            {suggestions.map(option => <li key={option.id}><button type="button" onClick={() => { patch({ goal_ids: [...answers.goal_ids, option.id] }); setQuery('') }}>{option.label}<ArrowRight size={16} /></button></li>)}
          </ul>
          {!suggestions.length && query.trim() && <p role="status">No interests matched your search. Try another term.</p>}

          <div className="via-onboarding-tags">
            {goals.filter(option => answers.goal_ids.includes(option.id)).map((tag) => (
              <span key={tag.id}>
                {tag.label}
                <button type="button" aria-label={`Remove ${tag.label}`} onClick={() => patch({ goal_ids: answers.goal_ids.filter(id => id !== tag.id) })}><X size={14} /></button>
              </span>
            ))}
          </div>
        </section>

        <OnboardingControls />
      </section>
    </main>
  )
}
