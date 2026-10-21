import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import { ArrowRight, Menu } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { landingNavigation } from '../../landing/navigation'
import { PublicDialog } from './PublicDialog'
import './PublicHeader.css'

export function PublicHeader() {
 const [open, setOpen] = useState(false)
 const { user, isLoading } = useAuth()
 const links = landingNavigation.map(({ label, to }) => <NavLink key={label} to={to} onClick={() => setOpen(false)}>{label}</NavLink>)
 return <header className="via-site-header">
  <Link className="via-site-brand" to="/" aria-label="VIA home"><img src={viaLogo} alt="VIA" width="80" height="56"/></Link>
  <nav className="via-site-pill" aria-label="Public navigation">{links}</nav>
  <div className="via-site-actions">
   {user ? <Link className="via-site-action is-primary" to="/dashboard">My VIA<ArrowRight size={16} aria-hidden="true"/></Link> : !isLoading && <><Link className="via-site-action" to="/login">Sign In</Link><Link className="via-site-action is-primary" to="/signup">Get Started</Link></>}
   <button className="via-site-menu-toggle" type="button" aria-label="Open public navigation" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} aria-hidden="true"/></button>
  </div>
  {open && <PublicDialog title="Explore VIA" onClose={() => setOpen(false)} compact className="via-site-menu"><nav className="via-site-mobile-links" aria-label="Mobile public navigation">{links}</nav></PublicDialog>}
 </header>
}
