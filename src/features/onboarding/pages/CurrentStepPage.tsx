import { educationStages } from '../config/education-stages'
import { OnboardingProgress } from '../components/OnboardingProgress'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingControls } from '../components/OnboardingControls'
import { CatalogIcon } from '../components/CatalogIcon'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import { Check, ChevronRight, Clock } from 'lucide-react'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'

export function CurrentStepPage() {
  const { educationStage, changeStage, busy, confirmationRequired } = useOnboarding()
  const currentOptions = educationStages.filter(stage=>stage.value!=='graduate'||educationStage==='graduate').map(stage => ({ ...stage, id: stage.value, icon: 'GraduationCap', tone: 'emerald' }))
  return (
    <main className="via-product-page via-onboarding-choice">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-choice-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <section className="via-onboarding-panel">
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
          <h1>Where are you in your journey?</h1>
          <p>
            This helps VIA understand your journey and give you the most
            relevant guidance.
          </p>
        </div>

        {confirmationRequired && <p role="status">Please confirm your education stage. Your existing answers and reports are preserved.</p>}
        <div className="via-onboarding-options via-onboarding-current-options via-adaptive-stage-options">
          {currentOptions.map((option) => {

            return (
              <button className={`via-onboarding-option ${educationStage === option.id ? 'is-selected' : ''}`} aria-pressed={educationStage === option.id} disabled={busy} onClick={() => void changeStage(option.value).catch(() => {})} key={option.id} type="button">
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
                {educationStage === option.value ? <Check size={20} aria-label="Selected" /> : <ChevronRight className="via-onboarding-option-arrow" size={22} />}
              </button>
            )
          })}
        </div>

        {educationStage==='tertiary'&&<button type="button" className="via-onboarding-save-action" disabled={busy} onClick={()=>void changeStage('graduate').catch(()=>{})}>I have completed my qualification — move to Graduate</button>}
        <OnboardingControls />
      </section>
    </main>
  )
}
