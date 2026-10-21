import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardCheck,
  Compass,
  FileText,
  GraduationCap,
  HeartHandshake,
  Route,
  Search,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router'
import { useAuth } from '../../../hooks/useAuth'
import ctaBackground from '../../../assets/images/Contemplative Valley Horizon.png'
import { GlassCard, IconCircle } from '../../../components/ui'
import { Hero } from '../components/Hero'
import { LandingProgrammes } from '../components/LandingProgrammes'
import { ExploreOptions } from '../../discovery/components/ExploreOptions'
import { QualificationLauncher } from '../../discovery/components/QualificationChecker'
import { GuideLink } from '../components/GuideLink'
import { SiteFooter } from '../../../components/layout/SiteFooter'
import './LandingPage.css'


const journeySteps = [
  { title: 'GRADE 9', description: 'Choose the right Grade 10 subjects.', icon: GraduationCap },
  { title: 'GRADE 10', description: 'See where your subjects can take you.', icon: Compass },
  { title: 'GRADE 11', description: 'Explore programmes and prepare to apply.', icon: BookOpenCheck },
  { title: 'GRADE 12', description: 'Apply, find funding and prepare for higher education.', icon: ClipboardCheck },
  { title: 'STUDENT', description: 'Stay supported through your studies.', icon: HeartHandshake },
]
const guides = [
  { title: 'Choosing Grade 10 Subjects', slug: 'choosing-grade-10-subjects', icon: BookOpenCheck },
  { title: 'Understanding APS', slug: 'understanding-aps', icon: BarChart3 },
  { title: 'How Applications Work', slug: 'university-applications', icon: ClipboardCheck },
  { title: 'Understanding NSFAS', slug: 'nsfas', icon: WalletCards },
]
const ecosystem = [
  { title: 'My Journey', description: 'See where you are and what comes next.', icon: Route },
  { title: 'My Results', description: 'Keep your academic history in one place.', icon: FileText },
  { title: 'My Matches', description: 'See programmes that match your subjects and results.', icon: Sparkles },
  { title: 'My Applications', description: "Keep track of where you've applied.", icon: ClipboardCheck },
  { title: 'My Funding', description: 'Save and track relevant funding opportunities.', icon: WalletCards },
  { title: 'My Support', description: 'Access academic and student support when you need it.', icon: HeartHandshake },
]

export function LandingPage() {
  const { user } = useAuth()
  const accountDestination = user ? '/dashboard' : '/signup'
  return (
    <main className="via-landing-page">
      <Hero />

      <div className="via-landing-continuation">
        <ExploreOptions/>
        <section className="via-landing-section" id="how-it-works">
          <div className="via-landing-section-heading">
            <p>Your journey, organised</p>
            <h2>Your journey starts <em>before matric.</em></h2>

          </div>

          <div className="via-landing-steps">
            {journeySteps.map((step, index) => {
              const Icon = step.icon

              return (
                <div className="via-landing-step-wrap" key={step.title}>
                  <GlassCard className="via-landing-step-card" variant="light">
                    <IconCircle className="via-landing-step-icon">
                      <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                    </IconCircle>
                    <span className="via-landing-step-number">0{index + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </GlassCard>
                  {index < journeySteps.length - 1 ? (
                    <ArrowRight className="via-landing-step-arrow" size={26} />
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="via-landing-centered-action"><Link className="via-landing-button via-landing-button-primary" to={accountDestination}>Create My VIA Profile<ArrowRight size={18} aria-hidden="true" /></Link></div>
        </section>

        <section className="via-landing-discover" id="discover">
          <div className="via-landing-discover-copy">
            <p className="via-landing-kicker">A world of possibilities</p>
            <h2>Find what fits.<br /><em>Then see where it leads.</em></h2>
            <p>
              Explore programmes, understand their requirements and discover
              the careers they can lead to.
            </p>
            <div className="via-landing-discover-actions">
              <Link className="via-landing-button via-landing-button-primary" to="/programmes">
                Explore Programmes
                <ArrowRight size={18} />
              </Link>

            </div>
          </div>

          <GlassCard className="via-landing-search-panel" variant="light">
            <Link className="via-landing-search-box" to="/programmes">
              <Search size={19} strokeWidth={1.6} aria-hidden="true" />
              <span>Explore programmes and requirements</span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <LandingProgrammes />
          </GlassCard>
        </section>

        <section className="via-landing-qualification">
          <div className="via-landing-section-heading">
            <p>Qualification matching</p>
            <h2>Your results.<br /><em>Your possibilities.</em></h2>
            <span>
              Add your subjects and results to discover study pathways
            </span>
          </div>
          <div className="via-landing-qualification-grid">
            <GlassCard className="via-landing-results-card" variant="light">
              <span className="via-landing-panel-label">EXAMPLE SCHOOL RESULTS</span>
              <h3>Your results</h3>
              <p><span>Mathematics</span><strong>71%</strong></p>
              <p><span>Physical Sciences</span><strong>68%</strong></p>
              <p><span>English</span><strong>74%</strong></p>
            </GlassCard>
            <ArrowRight className="via-landing-match-arrow" size={32} />
            <GlassCard className="via-landing-results-card" variant="light">
              <span className="via-landing-panel-label">EXAMPLE PROGRAMME MATCHES</span>
              <h3>Your VIA matches</h3>
              <p><span>Computer Science</span><strong>Match</strong></p>
              <p><span>Information Technology</span><strong>Match</strong></p>
              <p><span>Data Science</span><strong>Match</strong></p>
              <p><span>Engineering</span><em>Math requirement not yet met</em></p>
            </GlassCard>
          </div>
          <div className="via-landing-centered-action">
            <QualificationLauncher className="via-landing-button via-landing-button-primary">
              Check What I Qualify For
              <ArrowRight size={18} />
            </QualificationLauncher>
          </div>
        </section>

        <section className="via-landing-section via-landing-why" id="guides">
          <div className="via-landing-section-heading"><p>A little guidance</p><h2>Need help <em>getting started?</em></h2></div>
          <div className="via-landing-reasons via-landing-guides">
            {guides.map(({ title, slug, icon: Icon }) => <GuideLink className="via-glass via-landing-reason-card via-landing-guide" slug={slug} key={slug}>
              <IconCircle className="via-landing-reason-icon"><Icon size={26} strokeWidth={1.6} aria-hidden="true" /></IconCircle><h3>{title}</h3><ArrowRight size={20} aria-hidden="true" />
            </GuideLink>)}
          </div>
          <div className="via-landing-centered-action"><GuideLink className="via-landing-button via-landing-button-primary">View All Guides<ArrowRight size={18} aria-hidden="true" /></GuideLink></div>
        </section>

        <section className="via-landing-section via-landing-ecosystem" id="about">
          <div className="via-landing-section-heading">
            <p>One VIA</p>
            <h2>One account.<br /><em>Your whole journey.</em></h2>
            <span>
              VIA changes with you as you move from school into higher education.
            </span>
          </div>
          <div className="via-landing-reasons">
            {ecosystem.map((item) => {
              const Icon = item.icon

              return (
                <GlassCard className="via-landing-reason-card" key={item.title}>
                  <IconCircle className="via-landing-reason-icon">
                      <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                  </IconCircle>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </GlassCard>
              )
            })}
          </div>
          <div className="via-landing-centered-action"><Link className="via-landing-button via-landing-button-primary" to={accountDestination}>Create My VIA Profile<ArrowRight size={18} aria-hidden="true" /></Link></div>
        </section>

        <section className="via-landing-cta">
          <img src={ctaBackground} alt="" loading="lazy" />
          <div className="via-landing-cta-overlay" />
          <div className="via-landing-cta-content">
            <h2>Your next step <em>starts here.</em></h2>
            <p>
              From choosing subjects to applying, finding funding and succeeding
              in higher education, VIA helps you know what comes next.
            </p>
            <div className="via-landing-cta-actions">
              <Link className="via-landing-button via-landing-button-primary via-landing-button-wide" to={accountDestination}>
                Get Started
                <ArrowRight size={18} />
              </Link>
              <a className="via-landing-button via-landing-button-outline via-landing-button-wide" href="#explore-options">Explore Without an Account</a>
            </div>
            <small>Free to get started.</small>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  )
}
