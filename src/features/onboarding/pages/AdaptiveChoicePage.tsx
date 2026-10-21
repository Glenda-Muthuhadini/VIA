import { useState } from 'react'
import { Link } from 'react-router'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { OnboardingControls } from '../components/OnboardingControls'
import { CatalogIcon } from '../components/CatalogIcon'
import { IconCircle } from '../../../components/ui'
import { toggleId } from '../services/model'
import { educationStages } from '../config/education-stages'
export function AdaptiveChoicePage({ kind }: { kind: 'school-subjects' | 'future-curiosity' | 'stage-pending' }) {
  const { answers, choices, patch, educationStage, status, error, save } = useOnboarding()
  const [search,setSearch] = useState('')
  if (kind === 'stage-pending') return <OnboardingStepLayout title="Your stage is saved" copy={`Your ${educationStages.find(stage => stage.value === educationStage)?.label ?? ''} setup will be available in a later update. You can return to your VIA or change your education stage.`} navigation={false}><p>No additional questions are required for this pending branch.</p><OnboardingControls /><Link className="via-onboarding-start" to="/dashboard" onClick={event => { if (status !== 'saved') { event.preventDefault(); void save().then(() => { window.location.assign('/dashboard') }).catch(() => {}) } }}>Return to my VIA</Link>{error && <p role="alert">{error}</p>}</OnboardingStepLayout>
  const school = kind === 'school-subjects'
  const ids = school ? answers.school_subject_ids : answers.future_interest_ids
  const uncertain = school ? answers.school_subjects_unknown : answers.future_exploring
  return <OnboardingStepLayout title={school ? 'What subjects can you choose from at your school?' : 'What are you curious about for your future?'} copy={school ? 'This helps VIA suggest options that are actually available to you.' : undefined}>
    {school && <label className="via-school-subject-search">Search available subjects<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subjects..." /></label>}
    <div className="via-onboarding-options via-onboarding-interest-options">
      {choices(school ? 'subject' : 'future_interest').filter(option => !school || option.label.toLowerCase().includes(search.toLowerCase())).map(option => <label className="via-onboarding-option via-onboarding-interest-option" key={option.id}><IconCircle className="via-onboarding-option-icon via-onboarding-step-emerald" size="large"><CatalogIcon name={option.icon} /></IconCircle><span><strong>{option.label}</strong></span><input type="checkbox" aria-label={option.label} checked={ids.includes(option.id)} onChange={() => patch(school ? { school_subject_ids: toggleId(ids,option.id), school_subjects_unknown: false } : { future_interest_ids: toggleId(ids,option.id), future_exploring: false })} /></label>)}
    </div>
    <label className="via-onboarding-uncertain"><input type="checkbox" checked={uncertain} onChange={event => patch(school ? { school_subjects_unknown: event.target.checked, school_subject_ids: [] } : { future_exploring: event.target.checked, future_interest_ids: [] })} />{school ? "I don't know yet" : "I'm still exploring"}</label>
  </OnboardingStepLayout>
}
