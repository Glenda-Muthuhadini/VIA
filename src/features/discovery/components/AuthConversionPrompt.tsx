import { Link } from 'react-router'
import { Bookmark, ArrowRight } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import { authPageLink } from '../../auth/services/redirects'
import { discoveryContext,type Opportunity } from '../services/model'
import { PublicDialog } from './PublicDialog'
export type ConversionIntent = 'save'|'match'|'money'|'profile'
export function AuthConversionPrompt({item,intent,onClose,onSave,saving,error}: {item:Opportunity;intent:ConversionIntent;onClose:()=>void;onSave:()=>void;saving:boolean;error:string}) {
 const {user}=useAuth()
 const title=intent==='save'?'Save this to your VIA':intent==='money'?'Your VIA Money':intent==='match'?'Your VIA Match':'Your personalised VIA'
 const destination=discoveryContext(item,intent)
 return <PublicDialog title={title} onClose={onClose} compact><div className="via-public-conversion"><span className="via-public-card-icon"><Bookmark size={25}/></span><h2>{title}</h2><p className="via-public-selected-title">{item.title}</p>
  {intent==='save'?<p>{user?'Keep this opportunity in your VIA for later.':'Create your free VIA profile to save opportunities, track deadlines and see personalised matches as they become available.'}</p>:<p>{intent==='money'?'Personalised funding matching':'Personalised programme matching'} is not available yet. You can explore the official details, save this opportunity and build your VIA profile.</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="via-public-conversion-actions">{user?<>{intent==='save'?<button className="via-public-button is-primary" type="button" disabled={saving} onClick={onSave}>{saving?'Saving…':'Save to my VIA'}<Bookmark size={17}/></button>:<Link className="via-public-button is-primary" to="/onboarding/welcome">Build my VIA profile<ArrowRight size={17}/></Link>}<button className="via-public-button" type="button" onClick={onClose}>Keep exploring</button></>:<><Link className="via-public-button is-primary" to={authPageLink('/signup',destination)}>Create my VIA<ArrowRight size={17}/></Link><Link className="via-public-button" to={authPageLink('/login',destination)}>Log in</Link><button className="via-public-text-button" type="button" onClick={onClose}>Keep exploring without an account</button></>}</div>
 </div></PublicDialog>
}
