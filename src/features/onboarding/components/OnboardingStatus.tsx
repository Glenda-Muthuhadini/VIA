import { Link } from 'react-router'
import { Button, GlassCard, LoadingState } from '../../../components/ui'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'

export function OnboardingStatus({ retry }: { retry?: () => void }) {
  return <main className="via-product-page via-auth-page">
    <img src={backgroundImage} alt="" className="via-auth-background" />
    <div className="via-auth-wash" /><div className="via-auth-glow" />
    <section className="via-login-shell grid place-items-center">
      <GlassCard className="via-login-card">
        <Link to="/" aria-label="VIA home"><img className="via-card-logo" src={viaLogo} alt="VIA" /></Link>
        {retry ? <>
          <h1 className="via-card-title">Let’s try that again</h1>
          <p className="via-message via-message-error" role="alert">We could not load your onboarding progress. Please check your connection and try again.</p>
          <Button className="via-onboarding-retry w-full" type="button" onClick={retry}>Retry onboarding</Button>
        </> : <LoadingState label="Loading your VIA journey…" />}
      </GlassCard>
    </section>
  </main>
}
