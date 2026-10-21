import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import { useOnboarding } from '../context/onboarding-context'
import { validateGrade9Step } from '../services/grade9-model'
import backgroundImage from '../../../assets/images/Dreamy Sunrise Valley Vista.png'
import viaLogo from '../../../assets/images/VIA LOGO LIGHT.png'
export function Grade9CompletePage(){
 const {answers,record,save,flow,error}=useOnboarding(),navigate=useNavigate(),[saving,setSaving]=useState(false)
 const missing=flow.steps.find(step=>!['welcome','current'].includes(step.id)&&validateGrade9Step(step.id,answers))
 if(missing&&!record?.completed_at)return <Navigate to={`/onboarding/${missing.id}`} replace/>
 return <main className="via-product-page via-payoff-page"><img className="via-onboarding-bg" src={backgroundImage} alt=""/><div className="via-onboarding-choice-wash"/><section className="via-payoff-panel via-ready-panel"><img className="via-payoff-logo" src={viaLogo} alt="VIA"/><div className="via-payoff-copy"><h1>You’re all set.</h1><p>VIA can now use your results, interests and subject preferences to help you explore your strengths and prepare for your Grade 10 subject choices.</p></div>{error&&<p className="via-onboarding-feedback" role="alert">{error}</p>}<button className="via-ready-action" disabled={saving} onClick={()=>{setSaving(true);void save('ready',true).then(()=>navigate('/dashboard')).catch(()=>setSaving(false))}}>{saving?'Saving…':'Go to My Dashboard'}<ArrowRight size={20}/></button></section></main>
}
