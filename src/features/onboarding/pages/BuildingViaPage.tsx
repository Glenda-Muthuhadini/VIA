import { Check, Circle, Orbit } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { useOnboarding } from '../context/onboarding-context'
import { useAuth } from '../../../hooks/useAuth'
import { supabase } from '../../../services/supabase'

export function BuildingViaPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { answers, educationStage } = useOnboarding()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const buildItems = educationStage === 'grade_9' ? [{ title: 'Checking your saved subject planning information', description: 'Optional answers can be added later.', state: 'active' }] : [
    { title: answers.results.length ? 'Results saved' : 'Results can be added later', description: `${answers.results.length} subjects entered`, state: answers.results.length ? 'complete' : 'pending' },
    { title: 'Interests saved', description: `${answers.interest_ids.length} areas selected`, state: 'complete' },
    { title: 'Strengths saved', description: `${answers.personality_ids.length} selected`, state: 'complete' },
    { title: 'Study goals saved', description: `${answers.goal_ids.length} interests selected`, state: 'complete' },
    { title: 'Preferences saved', description: 'Your location and institution choices', state: 'complete' },
    { title: 'Checking your saved VIA…', description: '', state: 'active' },
  ]

  useEffect(() => {
    let active = true
    void Promise.resolve(supabase.from('via_onboarding').select('completed_at').eq('user_id', user!.id).single()).then(({ data, error }) => {
      if (!active) return
      if (error || !data?.completed_at) setError('We could not verify your saved VIA. Please try again.')
      else navigate('/onboarding/ready', { replace: true })
    }).catch(() => { if (active) setError('We could not connect to VIA. Please try again.') })
    return () => { active = false }
  }, [navigate, user, attempt])

  return (
    <main className="via-product-page via-payoff-page">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-choice-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <section className="via-payoff-panel">
        <img className="via-payoff-logo" src={viaLogo} alt="VIA" />

        <div className="via-payoff-copy">
          <h1>Building your VIA...</h1>
          <p>
            We&apos;re checking that your information has been saved to your VIA.
          </p>
        </div>

        <div className="via-build-layout">
          <div className="via-orbit-graphic" aria-hidden="true">
            <span className="via-orbit-ring via-orbit-ring-one" />
            <span className="via-orbit-ring via-orbit-ring-two" />
            <span className="via-orbit-dot via-orbit-dot-one" />
            <span className="via-orbit-dot via-orbit-dot-two" />
            <span className="via-orbit-core">
              <Orbit size={54} strokeWidth={1.9} />
              <img src={viaLogo} alt="" />
            </span>
          </div>

          <div className="via-build-list">
            {buildItems.map((item) => (
              <div className={`via-build-item is-${item.state}`} key={item.title}>
                <span>
                  {item.state === 'complete' ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <Circle size={16} />
                  )}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  {item.description ? <p>{item.description}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="via-payoff-note">This will only take a moment.</p>
        {error && <p className="via-onboarding-feedback" role="alert">{error}<button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button></p>}
      </section>
    </main>
  )
}
