import { Link } from 'react-router'
import viaLogo from '../../assets/images/VIA LOGO LIGHT.png'
import { landingNavigation } from '../../features/landing/navigation'
import { GuideLink } from '../../features/landing/components/GuideLink'
import './SiteFooter.css'

const copyrightYear = new Date().getFullYear()

export function SiteFooter() {
  return (
        <footer className="via-site-footer">
          <div className="via-site-footer-brand">
            <Link className="via-site-footer-logo" aria-label="VIA home" to="/">
              <img src={viaLogo} alt="VIA" width="96" height="64" />
            </Link>
            <p>Your future. All in one place.</p>
          </div>
          <nav aria-label="Footer navigation" className="via-site-footer-columns">
            <div><h3>EXPLORE</h3>{landingNavigation.map(({ label, to }) => <Link key={label} to={to}>{label}</Link>)}</div>
            <div><h3>VIA</h3><Link to="/about">About</Link><GuideLink>Guides</GuideLink><Link to="/contact">Contact</Link></div>
            <div><h3>ACCOUNT</h3><Link to="/login">Sign In</Link><Link to="/signup">Create Account</Link></div>
          </nav>
          <div className="via-site-footer-bottom">
            <p>&copy; {copyrightYear} VIA. All rights reserved.</p>
            <span>Your higher education journey, in one place.</span>
          </div>
        </footer>
  )
}
