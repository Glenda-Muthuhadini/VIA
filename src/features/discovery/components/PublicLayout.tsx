import { Outlet } from 'react-router'
import { SiteFooter } from '../../../components/layout/SiteFooter'
import { PublicHeader } from './PublicHeader'
import '../discovery.css'
import '../discovery-experience.css'
export function PublicLayout() {
 return <div className="via-public via-discovery-experience">
  <a className="via-public-skip" href="#discovery-main">Skip to content</a>
  <PublicHeader/>
  <Outlet/>
  <SiteFooter/>
 </div>
}
