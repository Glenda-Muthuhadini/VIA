import { OnboardingProgress } from '../components/OnboardingProgress'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingControls } from '../components/OnboardingControls'
import { CatalogIcon } from '../components/CatalogIcon'
import { toggleId } from '../services/model'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import { Clock } from 'lucide-react'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'

export function InterestsStepPage() {
  const { educationStage, answers, choices, patch } = useOnboarding()
  const interestOptions = choices('interest')
  return (
    <main className="via-product-page via-onboarding-choice" data-education-stage={educationStage}>
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
          <h1>{educationStage === 'grade_9' ? "What are you naturally drawn to?" : <>
            What are you <span>interested in?</span>
          </>}</h1>
          <p>{educationStage === 'grade_9' ? "Choose as many as you like. You don't need to know exactly what you want to become yet." : <>
            Choose the areas that interest you. You can select more than one.
          </>}</p>
        </div>

        <div className="via-onboarding-options via-onboarding-interest-options">
          {interestOptions.map((option) => {

            return (
              <label className="via-onboarding-option via-onboarding-interest-option" key={option.id}>
                <IconCircle
                  className={`via-onboarding-option-icon via-onboarding-step-${option.tone}`}
                  size="large"
                >
                  <CatalogIcon name={option.icon} />
                </IconCircle>
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <input aria-label={option.label} type="checkbox" checked={answers.interest_ids.includes(option.id)} onChange={() => patch({ interest_ids: toggleId(answers.interest_ids, option.id) })} />
              </label>
            )
          })}
        </div>

        <OnboardingControls />
      </section>
    </main>
  )
}
