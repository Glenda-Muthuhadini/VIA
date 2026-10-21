import { ArrowLeft, ArrowRight, Save } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useOnboarding } from '../context/onboarding-context'
import { validateStep, type Step } from '../services/model'
import { flowPosition } from '../services/flow-engine'
import { validateJourneyStep } from '../services/journey-model'
import { grade9DraftError, validateGrade9Step } from '../services/grade9-model'
import { getFlow } from '../config/flows'

export function OnboardingControls() {
  const { flow, educationStage, record, answers, save, status, error, busy, reload, step, options } = useOnboarding()
  const confirming = educationStage==='grade_9' && record?.flow_version===4 && step==='confirm-results'
  const position = flowPosition(flow,answers,step)
  const back = position.previous
  const next = position.next
  const complete = next === 'building'||next==='ready'
  const navigate = useNavigate()
  const [validation, setValidation] = useState('')
  const [navigating, setNavigating] = useState(false)
  async function move(target: Step | 'dashboard', validate = false, skipped = false) {
    if (navigating || busy) return
    setValidation('')
    const message = validate ? confirming ? grade9DraftError(answers.grade9.results_draft,options) : step === 'current' ? educationStage ? '' : 'Choose where you are in your journey.' : record?.flow_version === 4 && educationStage==='grade_9' ? validateGrade9Step(step,answers) : record?.flow_version === 4 ? validateJourneyStep(step,educationStage,answers) : record?.flow_version === 3 ? '' : validateStep(step, answers) : ''
    if (message) { setValidation(message); return }
    setNavigating(true)
    try {
      if(step==='current'&&record?.completed_at){navigate('/dashboard');return}
      if(validate&&flow.directReady&&record?.completed_at){
        const saved=await save(step,false,false,confirming)
        if(saved.completed_at)navigate('/dashboard')
        else {
          const latest=saved.grade9?{...answers,...saved.journey_answers,grade9:saved.grade9}:answers
          const missing=getFlow(educationStage,4).steps.find(item=>!['welcome','current'].includes(item.id)&&(educationStage==='grade_9'?validateGrade9Step(item.id,latest):validateJourneyStep(item.id,educationStage,answers)))
          navigate(`/onboarding/${missing?.id??'current'}`)
        }
        return
      }
      const saved = educationStage ? await save(target === 'dashboard' ? step : target, validate && complete && !(educationStage==='grade_9'&&record?.flow_version===4), skipped, confirming && validate) : record
      navigate(target === 'dashboard' ? saved?.completed_at ? '/dashboard' : '/' : `/onboarding/${target}`)
    } catch { /* The shared save notice retains the draft and exposes retry. */ }
    finally { setNavigating(false) }
  }
  return <>
    {(validation || error) && <p className="via-onboarding-feedback" role="alert">{validation || error}{error && <button type="button" disabled={navigating || busy || status === 'saving'} onClick={reload}>Reload saved progress</button>}</p>}
    <footer className="via-onboarding-panel-footer">
      <button className="via-onboarding-secondary-action" type="button" disabled={navigating || busy} onClick={() => void move(back)}><ArrowLeft size={18} />Back</button>
      <button className="via-onboarding-save-action" type="button" disabled={navigating || busy} onClick={() => void move('dashboard')}><Save size={18} />Save & finish later</button>
      {position.optional && <button className="via-onboarding-save-action" type="button" disabled={navigating || busy} onClick={() => void move(next, true, true)}>Skip for now</button>}
      {step !== 'stage-pending' && <button className="via-onboarding-continue-action" type="button" disabled={navigating || busy} onClick={() => void move(next, true)}>{navigating ? 'Saving…' : confirming ? 'Confirm Results' : flow.directReady&&record?.completed_at?step==='current'?'Go to My Dashboard':'Save Changes':complete ? flow.directReady?educationStage==='grade_9'?'Continue':'Complete':'Build my VIA' : 'Continue'}<ArrowRight size={18} /></button>}
    </footer>
    <p className="via-onboarding-save-status" role="status" aria-live="polite">{busy ? 'Uploading report…' : status === 'saving' ? 'Saving your progress…' : status === 'saved' ? 'Progress saved' : status === 'unsaved' ? 'Changes waiting to save' : 'Progress has not been saved'}</p>
  </>
}
