import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { OnboardingHomeLink } from './OnboardingHomeLink'
import { OnboardingProgress } from './OnboardingProgress'
import { OnboardingControls } from './OnboardingControls'
export function OnboardingStepLayout({ title, copy, children, navigation = true }: { title: string; copy?: string; children: ReactNode; navigation?: boolean }) {
  return <main className="via-product-page via-onboarding-choice via-adaptive-question">
    <img className="via-onboarding-bg" src={backgroundImage} alt="" /><div className="via-onboarding-choice-wash" />
    {[1,2,3].map((value,index) => <div key={value} className={`via-onboarding-arc via-onboarding-arc-${['one','two','three'][index]}`} />)}
    <section className="via-onboarding-panel via-onboarding-panel-wide">
      <header className="via-onboarding-panel-header"><OnboardingHomeLink><img className="via-onboarding-panel-logo" src={viaLogo} alt="VIA" /></OnboardingHomeLink><OnboardingProgress /><div className="via-onboarding-panel-time"><Clock size={18} />About 3 minutes</div></header>
      <div className="via-onboarding-panel-copy"><h1>{title}</h1>{copy && <p>{copy}</p>}</div>
      {children}{navigation && <OnboardingControls />}
    </section>
  </main>
}
