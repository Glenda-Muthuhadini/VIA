import { OnboardingProgress } from '../components/OnboardingProgress'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingControls } from '../components/OnboardingControls'
import { CatalogIcon } from '../components/CatalogIcon'
import { toggleId } from '../services/model'
import { OnboardingHomeLink } from '../components/OnboardingHomeLink'
import { Check, ChevronDown, Clock, Info } from 'lucide-react'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'

export function PreferencesStepPage() {
  const { answers, choices, patch } = useOnboarding()
  const preferenceOptions = choices('preference')
  return (
    <main className="via-product-page via-onboarding-choice">
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
            What <span>matters</span> to you?
          </h1>
          <p>
            Help VIA understand what matters when choosing where and how you
            study. Select everything that applies.
          </p>
        </div>

        <div className="via-onboarding-options via-onboarding-preference-options">
          {preferenceOptions.map((option) => {

            return (
              <label
                className={[
                  'via-onboarding-option',
                  'via-onboarding-interest-option',
                  answers.preference_ids.includes(option.id) ? 'is-selected' : '',
                ].join(' ')}
                key={option.id}
              >
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
                <input
                  aria-label={option.label}
                  checked={answers.preference_ids.includes(option.id)}
                  onChange={() => patch({ preference_ids: toggleId(answers.preference_ids, option.id) })}
                  type="checkbox"
                />
              </label>
            )
          })}
        </div>

        <section className="via-onboarding-final-preferences">
          <div className="via-onboarding-preference-card">
            <h2>Where are you open to studying?</h2>
            <p>You can select more than one option.</p>
            <label>
              <input checked={answers.location_mode === 'anywhere'} onChange={() => patch({ location_mode: 'anywhere', province_ids: [] })} name="location-preference" type="radio" />
              Anywhere in South Africa
            </label>
            <label>
              <input checked={answers.location_mode === 'provinces'} onChange={() => patch({ location_mode: 'provinces' })} name="location-preference" type="radio" />
              Choose provinces
              <ChevronDown size={16} />
            </label>
            {answers.location_mode === 'provinces' && <div className="via-onboarding-provinces">
              {choices('province').map(option => <label key={option.id}><input type="checkbox" checked={answers.province_ids.includes(option.id)} onChange={() => patch({ province_ids: toggleId(answers.province_ids, option.id) })} />{option.label}</label>)}
            </div>}
          </div>

          <div className="via-onboarding-preference-card">
            <h2>What institutions are you open to?</h2>
            <p>Select all that apply.</p>
            <div className="via-onboarding-choice-pills">
              {choices('institution_type').map(option => <button type="button" key={option.id} className={answers.institution_type_ids.includes(option.id) ? 'is-selected' : ''} aria-pressed={answers.institution_type_ids.includes(option.id)} onClick={() => patch({ institution_type_ids: option.id === 'institution_type-5' ? (answers.institution_type_ids.includes(option.id) ? [] : [option.id]) : toggleId(answers.institution_type_ids.filter(id => id !== 'institution_type-5'), option.id) })}>{answers.institution_type_ids.includes(option.id) && <Check size={13} />}{option.label}</button>)}
            </div>
          </div>
        </section>

        <div className="via-onboarding-note">
          <Info size={17} />
          Not sure? You can update these preferences later.
        </div>

        <OnboardingControls />
      </section>
    </main>
  )
}
