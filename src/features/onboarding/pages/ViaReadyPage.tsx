import { Grade9CompletePage } from './Grade9CompletePage'
import { ArrowRight, BookOpenCheck, BriefcaseBusiness, GraduationCap } from 'lucide-react'
import { Link } from 'react-router'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
import { IconCircle } from '../../../components/ui'
import { useOnboarding } from '../context/onboarding-context'

export function ViaReadyPage(){const {record,educationStage}=useOnboarding();return record?.flow_version===4&&educationStage==='grade_9'?<Grade9CompletePage/>:<ExistingViaReadyPage/>}
function ExistingViaReadyPage() {
  const { answers, options, flow, educationStage } = useOnboarding()
  const labels = (ids: string[]) => options.filter(option => ids.includes(option.id)).map(option => option.label).join(', ')
  return (
    <main className="via-product-page via-payoff-page">
      <img className="via-onboarding-bg" src={backgroundImage} alt="" />
      <div className="via-onboarding-choice-wash" />
      <div className="via-onboarding-arc via-onboarding-arc-one" />
      <div className="via-onboarding-arc via-onboarding-arc-two" />
      <div className="via-onboarding-arc via-onboarding-arc-three" />

      <section className="via-payoff-panel via-ready-panel">
        <img className="via-payoff-logo" src={viaLogo} alt="VIA" />

        <div className="via-payoff-copy">
          <h1>{flow.completionTitle||'Your VIA is ready.'}</h1>
          <p>{flow.completionCopy}</p>
        </div>

        {!flow.directReady&&<div className="via-ready-summary">
          <article>
            <IconCircle className="via-onboarding-step-emerald" size="large">
              <GraduationCap size={26} />
            </IconCircle>
            <h2>Saved interests</h2>
            <p>{labels(answers.interest_ids) || 'You can add this later.'}</p>
          </article>
          <article>
            <IconCircle className="via-onboarding-step-blue" size="large">
              <BookOpenCheck size={26} />
            </IconCircle>
            <h2>{educationStage === 'grade_9' ? 'Future curiosity' : 'Study interests'}</h2>
            <p>{labels(educationStage === 'grade_9' ? answers.future_interest_ids : answers.goal_ids) || 'You can add this later.'}</p>
          </article>
          <article>
            <IconCircle className="via-onboarding-step-gold" size="large">
              <BriefcaseBusiness size={26} />
            </IconCircle>
            <h2>Next steps</h2>
            <p>{educationStage === 'grade_9' ? 'Review your saved subjects and interests in your Grade 10 Subject Guide. Recommendations are not calculated yet.' : answers.results.length ? `${answers.results.length} subjects saved. Compare courses, requirements, funding and institutions.` : 'Add your subject results to help inform your next steps.'}</p>
          </article>
        </div>}

        <Link className="via-ready-action" to={flow.destination}>
          {flow.completionLabel}
          <ArrowRight size={20} />
        </Link>
      </section>
    </main>
  )
}
