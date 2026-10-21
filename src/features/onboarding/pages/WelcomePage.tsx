import { OnboardingProgress } from '../components/OnboardingProgress'
import { journeyStages } from '../../journey/journey'
import { validResume } from '../services/flow-engine'
import { educationStages } from '../config/education-stages'
import { useOnboarding } from '../context/onboarding-context'
import { CatalogIcon } from '../components/CatalogIcon'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import { ArrowRight, Clock, Lock } from 'lucide-react'
import { Link } from 'react-router'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'

export function WelcomePage() {
  const { flow, educationStage, record, answers } = useOnboarding()
  const onboardingSteps = journeyStages.map(stage => ({ ...stage, tone: 'emerald', description: educationStages.find(item => item.value === educationStage)?.journey.some(id => id === stage.id) ? 'Your focus now' : 'Future journey' }))
  const destination = record?.completed_at?'/dashboard':'/onboarding/' + validResume(flow, answers, record)
  return (
    <main className="via-product-page via-onboarding-welcome">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <header className="via-onboarding-header">
        <OnboardingHomeLink>
          <img className="via-onboarding-logo" src={viaLogo} alt="VIA" />
        </OnboardingHomeLink>

        <OnboardingProgress welcome />
      </header>

      <section className="via-onboarding-content">
        <div className="via-onboarding-copy">
          <h1>
            Welcome to VIA
          </h1>
          <p className="via-onboarding-lede">
            Let&apos;s personalise your journey.
          </p>
          <p className="via-onboarding-body">
            First, tell us where you are right now.
          </p>
        </div>

        {!flow.directReady&&<div className="via-onboarding-journey" aria-label="Your VIA journey">
          {onboardingSteps.map((step, index) => {

            return (
              <div className="via-onboarding-step" key={step.label}>
                <IconCircle
                  className={`via-onboarding-step-icon via-onboarding-step-${step.tone}`}
                  size="large"
                >
                  <CatalogIcon name={step.icon} size={26} />
                </IconCircle>
                <h2>{step.label}</h2>
                <p>{step.description}</p>
                {index < onboardingSteps.length - 1 ? (
                  <ArrowRight className="via-onboarding-step-arrow" size={14} />
                ) : null}
              </div>
            )
          })}
        </div>}

        <Link className="via-onboarding-start" to={destination}>
          {record?.completed_at ? 'Go to My Dashboard' : record ? 'Continue' : 'Get Started'}
          <ArrowRight size={22} />
        </Link>

        <div className="via-onboarding-meta">
          <span>
            <Clock size={18} />
            About 3 minutes
          </span>
          <span>
            <Lock size={18} />
            Your progress saves automatically
          </span>
        </div>
      </section>
    </main>
  )
}
