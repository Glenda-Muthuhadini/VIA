import { Check } from 'lucide-react'
import { useOnboarding } from '../context/onboarding-context'
import { flowPosition } from '../services/flow-engine'
export function OnboardingProgress({ welcome = false }: { welcome?: boolean }) {
  const { flow, answers, step, record } = useOnboarding()
  const position = flowPosition(flow,answers,step)
  const shown=flow.directReady?position.steps.filter(item=>!['welcome','current'].includes(item.id)):position.steps
  const shownIndex=shown.findIndex(item=>item.id===step)
  return <div className={welcome ? 'via-onboarding-progress' : 'via-onboarding-panel-progress'} aria-label="Onboarding progress">
    <span>{shownIndex>=0 ? `Step ${shownIndex+1} of ${shown.length}` : 'Getting started'}</span>
    <div>{shown.map((item,index) => <span key={item.id} className={index === shownIndex ? 'is-active' : record?.answered_steps?.includes(item.id) || record?.skipped_steps?.includes(item.id) || index < shownIndex ? 'is-complete' : ''}>{index < shownIndex && <Check size={10} strokeWidth={3} />}</span>)}</div>
  </div>
}
