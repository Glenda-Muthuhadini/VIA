import { Link } from 'react-router'
import { GlassCard, LoadingState } from '../../../components/ui'
import backgroundImage from '../../../assets/images/Contemplative Valley Horizon.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'

export function AuthStatus({ message, error = false, retry }: { message: string; error?: boolean; retry?: () => void }) {
  return (
    <main className="via-product-page via-auth-page">
      <img src={backgroundImage} alt="" className="via-auth-background" />
      <div className="via-auth-wash" /><div className="via-auth-glow" />
      <section className="via-login-shell grid place-items-center">
        <GlassCard className="via-login-card">
          <Link to="/" aria-label="VIA home"><img className="via-card-logo" src={viaLogo} alt="VIA" /></Link>
          {error ? <><h1 className="via-card-title">Let’s try that again</h1><p className="via-message via-message-error" role="alert">{message}</p>{retry ? <button type="button" className="via-onboarding-start" onClick={retry}>Try again</button> : <p className="via-login-link"><Link className="via-login-action" to="/login">Back to login</Link>{' · '}<Link className="via-login-action" to="/forgot-password">Request a new reset link</Link></p>}</> : <LoadingState label={message} />}
        </GlassCard>
      </section>
    </main>
  )
}
