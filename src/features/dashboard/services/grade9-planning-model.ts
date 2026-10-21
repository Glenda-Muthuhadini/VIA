import { deriveDashboard, type DashboardData } from './dashboard-model.ts'
import type { Grade9Plan } from './grade9-plan'

export const grade9Routes = {home:'/dashboard',results:'/dashboard/results',choices:'/dashboard/subject-choices',pathways:'/dashboard/study-pathways',next:'/dashboard/next-steps',assist:'/dashboard/assist'} as const
export const reportLabel=(period:string|null|undefined)=>period?.startsWith('term_')?`Term ${period.slice(-1)}`:period==='final'?'Final report':period==='latest'?'Latest report':'Report period not recorded'
export function grade9ResultsKey(data:DashboardData) {
  const a=deriveDashboard(data).answers
  const text=JSON.stringify([a.report_grade,a.academic_year,a.report_type,a.school_name,[...a.results].sort((a,b)=>a.subject_id.localeCompare(b.subject_id))])
  let hash=2166136261
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)
  return `results-${(hash>>>0).toString(16)}`
}
export function grade9Planning(data:DashboardData,plan:Grade9Plan|null) {
  const view=deriveDashboard(data),a=view.answers
  const steps=[
    {id:'results',label:'Add latest results',done:view.results.length>0,to:grade9Routes.results,action:'Add your latest results'},
    {id:'strengths',label:'Review academic strengths',done:!!plan?.reviewed_results&&plan.reviewed_results_key===grade9ResultsKey(data),to:grade9Routes.results,action:'Review your academic strengths'},
    {id:'interests',label:'Complete interests',done:view.interests.length>0||a.journey.interests_unsure,to:grade9Routes.pathways+'#interests',action:'Explore your interests'},
    {id:'maths',label:'Understand Maths vs Maths Lit',done:!!plan?.maths_reviewed,to:grade9Routes.choices+'#maths',action:'Compare Mathematics and Mathematical Literacy'},
    {id:'subjects',label:'Explore Grade 10 subjects',done:!!plan?.explored_subject_ids.length,to:grade9Routes.choices+'#other-subjects',action:'Explore Grade 10 subjects'},
    {id:'pathways',label:'Explore study pathways',done:!!plan?.explored_pathway_ids.length,to:grade9Routes.pathways,action:'Explore study pathways'},
    {id:'shortlist',label:'Shortlist Grade 10 subjects',done:!!plan?.shortlisted_subject_ids.length,to:grade9Routes.choices+'#my-plan',action:'Shortlist your Grade 10 subjects'},
    {id:'review',label:'Review Grade 10 plan',done:!!plan?.plan_reviewed&&!!plan.shortlisted_subject_ids.length,to:grade9Routes.choices+'#my-plan',action:'Review your Grade 10 plan'},
  ]
  const completed=steps.filter(step=>step.done).length
  return {steps,completed,percentage:plan?Math.round(completed/steps.length*100):null,next:steps.find(step=>!step.done)??{id:'review',label:'Keep your plan up to date',done:true,to:grade9Routes.choices+'#my-plan',action:'Review your Grade 10 plan'}}
}
