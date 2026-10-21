import {
  ArrowRight,
  Building2,
  ChartNoAxesColumnIncreasing,
  Compass,
  FileText,
  FolderLock,
  GraduationCap,
  MessagesSquare,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import heroBackground from '../../../assets/images/via-hero.png'
import { PublicHeader } from '../../discovery/components/PublicHeader'
import './Hero.css'

const products = [
  { name: 'My VIA', description: 'My personalised journey', icon: UserRound },
  { name: 'VIA Scan', description: 'Upload your results', icon: FileText },
  { name: 'VIA Match', description: 'Courses that fit me', icon: Compass },
  { name: 'VIA Money', description: 'Bursaries and funding', icon: WalletCards },
  { name: 'VIA Vault', description: 'Keep your documents', icon: FolderLock },
  { name: 'VIA Assist', description: 'Your intelligent guide', icon: MessagesSquare },
  { name: 'VIA Progress', description: 'Track your journey', icon: ChartNoAxesColumnIncreasing },
]

const opportunities = [
  { label: <>Find the right<br />courses for you</>, icon: GraduationCap, trusted: true, to: '/programmes' },
  { label: <>Explore universities<br />and colleges</>, icon: Building2, to: '/institutions' },
  { label: <>Discover funding<br />options</>, icon: WalletCards, to: '/bursaries' },
]

export function Hero() {
  const { user } = useAuth()
  return (
    <section
      aria-labelledby="via-hero-title"
      className="via-cinematic-hero"
      style={{ backgroundImage: `url("${heroBackground}")` }}
    >
      {/* The supplied photograph already includes the single decorative trajectory arc. */}
      <PublicHeader />

      <div className="via-cinematic-stage">
        <div className="via-cinematic-copy">
          <p className="via-cinematic-eyebrow">
            Your higher education journey,<br />in one place
          </p>
          <h1 id="via-hero-title">
            Plan today<br />
            for a brighter<br />
            <span>tomorrow</span>
          </h1>
          <p className="via-cinematic-description">
            Explore study options, understand what you qualify for, find funding,
            and take your next step towards higher education.
          </p>
          <div className="via-cinematic-ctas">
            <Link className="via-cinematic-button via-cinematic-primary" to={user ? '/dashboard' : '/signup'}>
              Get Started <ArrowRight size={19} aria-hidden="true" />
            </Link>
            <a className="via-cinematic-button via-cinematic-glass" href="#explore-options">Explore Options<ArrowRight size={19} aria-hidden="true" /></a>
          </div>
        </div>

        <div className="via-cinematic-opportunities" aria-label="Explore your opportunities">
          {opportunities.map(({ label, icon: Icon, trusted, to }, index) => (
            <Link className="via-cinematic-opportunity via-cinematic-glass" to={to} key={index}>
              <span className="via-cinematic-opportunity-main">
                <span className="via-cinematic-card-icon"><Icon size={26} strokeWidth={1.7} aria-hidden="true" /></span>
                <span>{label}</span>
                <span className="via-cinematic-card-arrow"><ArrowRight size={20} aria-hidden="true" /></span>
              </span>
              {trusted && (
                <span className="via-cinematic-trust">
                  <span>Explore programmes<br /><strong>No account needed</strong></span>
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>


      <nav className="via-cinematic-products via-cinematic-glass" aria-label="VIA products" tabIndex={0}>
        {products.map(({ name, description, icon: Icon }) => (
          <Link className="via-cinematic-product" to={user ? '/dashboard' : '/signup'} key={name}>
            <span className="via-cinematic-product-icon"><Icon size={25} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="via-cinematic-product-copy">
              <span>{name}</span>
              <small>{description}</small>
            </span>
          </Link>
        ))}
      </nav>
    </section>
  )
}
