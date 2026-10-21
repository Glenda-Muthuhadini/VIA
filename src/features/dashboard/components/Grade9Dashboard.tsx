import { Grade9Disclosure } from './Grade9Disclosure'
import { useEffect } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ArrowRight, Check, BookOpen, GraduationCap, Split, Compass } from 'lucide-react'
import { deriveDashboard, type DashboardData } from '../services/dashboard-model'
import { useGrade9Plan } from '../services/useGrade9Plan'
import type { Grade9Plan, Grade9PlanPatch } from '../services/grade9-plan'
import { grade9Planning, grade9ResultsKey, grade9Routes, reportLabel } from '../services/grade9-planning-model'
import { Grade9ResultsPage } from './Grade9ResultsPage'
import { Grade9PathwaysPage } from './Grade9PathwaysPage'
import { Grade9AssistPage } from './Grade9AssistPage'
import { Grade9SubjectChoices } from './Grade9SubjectChoices'
import './Grade9Dashboard.css'

export function Grade9Dashboard({data,name,page='home'}:{data:DashboardData;name:string;page?:string}) {
  const view=deriveDashboard(data),location=useLocation()
  const {plan,loading,saving,error,retry,update}=useGrade9Plan(data.profile?.id,view.answers.grade9.subjects_considering)
  const planning=grade9Planning(data,plan)
  useEffect(()=>{
    const target=location.hash?document.getElementById(location.hash.slice(1)):null
    if(target){let ancestor:HTMLElement|null=target;while(ancestor){if(ancestor instanceof HTMLDetailsElement)ancestor.open=true;ancestor=ancestor.parentElement}target.scrollIntoView({block:'start'});target.focus({preventScroll:true})}else window.scrollTo({top:0,behavior:'auto'})
  },[page,location.hash,location.key])
  const save=(patch:Grade9PlanPatch)=>{void update(patch).catch(()=>{})}
  if(!['home','results','subject-choices','study-pathways','next-steps','assist'].includes(page))return <Navigate to="/dashboard" replace/>
  if(page==='home'&&new URLSearchParams(location.search).get('panel')==='subject-guide')return <Navigate to="/dashboard/subject-choices" replace/>
  return <div className="grade9-dashboard" data-page={page}>
    {error&&<p className="g9-note g9-save-error" role="alert">{error} <button type="button" disabled={saving} onClick={retry}>Retry plan</button></p>}
    {saving&&<p className="g9-saving" role="status">Saving your plan…</p>}
    {page==='home'&&<Grade9Home data={data} name={name} plan={plan} loading={loading}/>}
    {page==='results'&&<Grade9ResultsPage data={data} onReviewed={()=>update({reviewed_results:true,reviewed_results_key:grade9ResultsKey(data)})}/>}
    {page==='subject-choices'&&<Grade9SubjectChoices data={data} plan={plan} busy={loading||saving||!plan} save={save}/>}
    {page==='study-pathways'&&<Grade9PathwaysPage data={data} busy={loading||saving||!plan} exploredPathwayIds={plan?.explored_pathway_ids??[]} onExplore={id=>{if(plan)save({explored_pathway_ids:[...new Set([...plan.explored_pathway_ids,id])]})}}/>}
    {page==='next-steps'&&<><header className="g9-page-heading"><span className="g9-eyebrow">MY JOURNEY / NEXT STEPS</span><h1>One step at a time.</h1><p>Pick up where you left off.</p></header><section className="g9-section"><h2>Your Grade 10 plan</h2>{plan?<><p className="g9-readiness"><strong>{planning.percentage}%</strong><span>{planning.completed} of {planning.steps.length} actions complete</span></p><progress aria-label="Grade 10 Planning Readiness" max={100} value={planning.percentage??0}/></>:<p role="status">{loading?'Loading your saved planning progress…':'Your planning progress is unavailable. Retry your plan above.'}</p>}<div className="g9-next-action"><span className="g9-eyebrow">YOUR NEXT STEP</span><h3>{planning.next.action}</h3><Link className="g9-button primary" to={planning.next.to}>Continue <ArrowRight size={16}/></Link></div><p className="g9-disclaimer">Planning progress, not an admission score or confirmed subject choice.</p></section><Grade9Disclosure title="View my planning checklist"><ul className="g9-checklist">{planning.steps.map(step=><li key={step.id}>{step.done?<Check size={19} aria-label="Completed"/>:<span aria-label="Still to do">○</span>}<Link to={step.to}>{step.label} <ArrowRight size={15}/></Link></li>)}</ul></Grade9Disclosure></>}
    {page==='assist'&&<Grade9AssistPage/>}
  </div>
}

function Grade9Home({data,name,plan,loading}:{data:DashboardData;name:string;plan:Grade9Plan|null;loading:boolean}) {
  const view=deriveDashboard(data),a=view.answers,planning=grade9Planning(data,plan)
  const average=view.results.length?Math.round(view.results.reduce((sum,r)=>sum+r.percentage,0)/view.results.length*10)/10:null
  const ids=plan?.shortlisted_subject_ids??a.grade9.subjects_considering
  const selected=data.options.filter(option=>ids.includes(option.id))
  return <><header className="g9-welcome g9-calm-welcome"><div><span className="g9-eyebrow">YOUR VIA · GRADE 9</span><h1>Hi, {name}</h1><p>One step closer to your Grade 10 choices.</p><div className="g9-calm-next"><span>Your next step</span><strong>{planning.next.action}</strong></div><Link className="g9-button primary" to={planning.next.to}>Continue My Plan <ArrowRight size={17}/></Link></div><div className="g9-calm-motif" aria-hidden="true"><span/><span/><span/><GraduationCap size={58} strokeWidth={1.1}/></div></header>
    <div className="g9-calm-grid">
      <section className="g9-section g9-calm-card"><div className="g9-calm-card-heading"><span className="g9-calm-icon"><BookOpen size={21}/></span><h2>My results</h2></div><div className="g9-calm-stat"><strong>{average!==null?`${average}%`:'—'}</strong><span>{average!==null?'Overall average':'No results yet'}</span></div><p>{average!==null?`${reportLabel(a.report_type)} · Grade ${a.report_grade??9}`:'Add a report to see how you’re doing.'}</p><Link className="g9-text-button" to={grade9Routes.results}>View My Results <ArrowRight size={16}/></Link></section>
      <section className="g9-section g9-calm-card"><div className="g9-calm-card-heading"><span className="g9-calm-icon"><GraduationCap size={22}/></span><h2>My subject plan</h2></div><div className="g9-calm-stat"><strong>{selected.length}</strong><span>{selected.length===1?'subject shortlisted':'subjects shortlisted'}</span></div><p>{loading?'Loading your saved plan…':selected.length?'Keep exploring. You can change your mind.':'Start with a subject you’re curious about.'}</p><Link className="g9-text-button" to={grade9Routes.choices}>Continue Choosing Subjects <ArrowRight size={16}/></Link></section>
    </div>
    <section className="g9-section g9-calm-comparison"><span className="g9-calm-icon"><Split size={22}/></span><div><h2>Maths or Maths Lit?</h2><p>Understand the difference before you choose.</p></div><Link className="g9-text-button" to={grade9Routes.choices+'#maths'}>Compare Maths &amp; Maths Lit <ArrowRight size={16}/></Link></section>
    <footer className="g9-calm-footer"><p>You don’t need to figure everything out today.</p><Link className="g9-text-button" to={grade9Routes.pathways}><Compass size={17}/>Explore Study Pathways <ArrowRight size={16}/></Link></footer>
  </>
}
