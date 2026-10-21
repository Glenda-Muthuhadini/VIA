import { Link } from 'react-router'
import { ArrowRight, Building2, GraduationCap, WalletCards, BookOpenCheck, House } from 'lucide-react'
import { landingNavigation } from '../../landing/navigation'
import '../discovery.css'
const options = [
 { description: 'Explore universities, universities of technology and colleges.', icon: Building2 },
 { description: 'Discover programmes, requirements and the careers they can lead to.', icon: GraduationCap },
 { description: 'Find bursaries, scholarships and other funding opportunities.', icon: WalletCards },
 { description: 'Understand NSFAS eligibility, funding and applications.', icon: BookOpenCheck },
 { description: 'Explore student accommodation and residence options.', icon: House },
]
export function ExploreOptions() {
 return <section className="via-explore-options" id="explore-options"><div className="via-landing-section-heading"><p>Start with possibility</p><h2>Explore your <em>options.</em></h2><span>Discover institutions, programmes, funding and student accommodation.</span></div><div className="via-explore-options-grid">{landingNavigation.map(({ label, to },index)=>{const { icon: Icon, description }=options[index];return <Link to={to} className="via-explore-option" key={label}><span className="via-explore-option-number">0{index+1}</span><Icon size={30} strokeWidth={1.4} aria-hidden="true"/><h3>{label}</h3><p>{description}</p><span className="via-explore-option-cta">Explore<ArrowRight size={20} aria-hidden="true"/></span></Link>})}</div></section>
}
