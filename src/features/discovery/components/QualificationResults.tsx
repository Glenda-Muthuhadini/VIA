import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router'
import type { ConnectedOutcome, ConnectedResponse, QualificationCheck } from '../services/qualification'

function missingRequirement(check:QualificationCheck) {
 if(check.minimum===null||check.actual===null)return check.label+' needs attention.'
 const unit=check.label==='APS'?' points':'%'
 return check.label+' needs '+check.minimum+unit+'; you entered '+check.actual+unit+'.'
}
function ProgrammeResult({item,onView,close=false}:{item:ConnectedOutcome;onView:(id:string)=>void;close?:boolean}) {
 return <article className={'via-qualification-outcome'+(close?' is-close':'')}>
  <span className="via-qualification-match">{!close&&<Check size={14} aria-hidden="true"/>}{close?'A requirement to work on':'Meets listed requirements'}</span>
  <h4>{item.programme.title}</h4><p>{item.programme.institution_name}</p>
  <dl className="via-qualification-score-comparison"><div><dt>Your APS</dt><dd>{item.learner_aps??'Not verified'}</dd></div><div><dt>APS required</dt><dd>{item.required_aps??'Check institution'}</dd></div></dl>
  <ul className="via-qualification-requirement-list">{item.checks.filter(check=>check.minimum!==null&&check.label!=='APS').map((check,index)=><li key={index}>{check.label}: {check.minimum}% required{check.actual!==null?' · your mark '+check.actual+'%':''}</li>)}</ul>
  {close?<ul className="via-qualification-missing">{item.missing.map((check,index)=><li key={index}>{missingRequirement(check)}</li>)}</ul>:<p className="via-qualification-match-reason">{item.reason}</p>}
  <button className="via-public-button" type="button" onClick={()=>onView(item.programme.id)}>View programme<ArrowRight size={17}/></button>
 </article>
}
export function QualificationResults({response,onView,onClose,busy}:{response:ConnectedResponse;onView:(id:string)=>void;onClose:()=>void;busy:boolean}) {
 const junior=response.mode==='pathways'
 return <section className="via-qualification-results" aria-live="polite" aria-busy={busy}>
  {junior?<><h3>Your academic snapshot</h3><div className="via-qualification-insights">{response.insights.map(row=><div key={row.subject_id}><span>{row.subject}</span><strong>{row.mark}%</strong><small>{row.insight}</small></div>)}</div><h3>Pathways you’re working toward</h3><p className="via-qualification-note">Grade {response.grade} results help you explore. They do not establish university eligibility.</p>
   {response.pathways.map(item=><article className="via-qualification-outcome is-pathway" key={item.programme.id}><span className="via-qualification-match">Future study pathway</span><h4>{item.programme.title}</h4><p>{item.programme.institution_name}</p><p>{item.reason}</p>{item.future_subjects.length>0&&<p className="via-qualification-note">Subjects to keep building: {item.future_subjects.map(subject=>subject.subject).join(', ')}.</p>}<button className="via-public-button" type="button" onClick={()=>onView(item.programme.id)}>Explore programme<ArrowRight size={17}/></button></article>)}
   {!response.pathways.length&&<p>Keep building your subjects and interests. Explore the catalogue for future study ideas.</p>}
  </>:<>
   <div className="via-qualification-aps"><span>YOUR APS</span><strong>{response.score?.value??'—'}</strong><small>{response.score?.context??'Enter six academic subjects, plus Life Orientation, to calculate the supported APS.'}</small></div>
   <h3>Programmes to explore</h3>
   {response.exact.items.map(item=><ProgrammeResult item={item} onView={onView} key={item.programme.id}/>)}
   {!response.exact.items.length&&<p>No verified minimums are met yet. Your results can still help identify your next step.</p>}
   {response.close.items.length>0&&<div className="via-qualification-close"><h3>Close matches</h3>{response.close.items.map(item=><ProgrammeResult key={item.programme.id} item={item} onView={onView} close/>)}</div>}
   {!response.exact.items.length&&!response.close.items.length&&<div className="via-qualification-insights">{response.insights.map(row=><div key={row.subject_id}><span>{row.subject}</span><strong>{row.mark}%</strong><small>{row.insight}</small></div>)}</div>}
   <p className="via-qualification-note">{response.grade===11?'Based on Grade 11 results. ':''}Meeting minimum requirements does not guarantee admission. Some programmes still need an institution check.</p>
  </>}
  <Link className="via-public-text-button" to="/programmes" onClick={onClose}>Explore all programmes<ArrowRight size={16}/></Link>
 </section>
}
