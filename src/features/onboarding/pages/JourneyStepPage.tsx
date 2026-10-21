import { Grade9StepPage } from './Grade9StepPage'
import { useEffect, useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useOnboarding } from '../context/onboarding-context'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { toggleId, type Step } from '../services/model'
import { applicationProgress, applicationStatuses, careerOptions, currentActivities, fundingMethods, fundingSituations, hasApplied, interestAreas, studyFields, supportOptions, yearsOfStudy, type JourneyAnswers } from '../services/journey-model'
import { programmeOfferings } from '../../discovery/services/programmes'
import { supabase } from '../../../services/supabase'
import type { Opportunity } from '../../discovery/services/model'
import './JourneyStepPage.css'
export function JourneyQuestion({kind,legacy}:{kind:Step;legacy:ReactNode}) { const {record,educationStage}=useOnboarding();if(record?.flow_version===4&&educationStage==='grade_9')return <Grade9StepPage kind={kind}/>;return record?.flow_version===4?<JourneyStepPage kind={kind}/>:legacy }

export function JourneyStepPage({kind}:{kind:Step}) {
  const {answers,patch,choices,educationStage:stage}=useOnboarding(),j=answers.journey
  const [catalogue,setCatalogue]=useState<{key:number;institutions:Opportunity[];offerings:Opportunity[];failed:boolean}|null>(null),[retry,setRetry]=useState(0),[search,setSearch]=useState(''),[currentYear]=useState(()=>new Date().getFullYear())
  const needsCatalogue=['programmes','study-interests','study-location','institution','enrolled-programme','campus','applications'].includes(kind)
  const institutions=catalogue?.institutions??[],offerings=catalogue?.offerings??[],loading=needsCatalogue&&catalogue?.key!==retry,failed=catalogue?.key===retry&&catalogue.failed
  useEffect(()=>{
    if(!needsCatalogue)return
    const controller=new AbortController()
    void Promise.all([supabase.from('via_public_opportunities').select('document').eq('kind','institutions').order('id').range(0,499).abortSignal(controller.signal),programmeOfferings(controller.signal)]).then(([result,programmes])=>{
      if(controller.signal.aborted)return
      if(result.error)throw result.error
      setCatalogue({key:retry,institutions:result.data.map(row=>row.document as Opportunity),offerings:programmes,failed:false})
    }).catch(()=>{if(!controller.signal.aborted)setCatalogue({key:retry,institutions:[],offerings:[],failed:true})})
    return()=>controller.abort()
  },[needsCatalogue,retry])
  const update=(value:Partial<JourneyAnswers>)=>patch({journey:{...j,...value}})
  const checkboxes=(items:string[],selected:string[],onChange:(items:string[])=>void)=><div className="via-journey-options">{items.map(label=><label key={label}><input type="checkbox" checked={selected.includes(label)} onChange={()=>onChange(toggleId(selected,label))}/><span>{label}</span></label>)}</div>
  const radios=(items:string[],value:string,onChange:(value:string)=>void)=><div className="via-journey-options">{items.map(label=><label key={label}><input type="radio" name={kind} value={label} checked={value===label} onChange={()=>onChange(label)}/><span>{label}</span></label>)}</div>
  const uncertain=(label:string,checked:boolean,onChange:(value:boolean)=>void)=><label className="via-journey-uncertain"><input type="checkbox" checked={checked} onChange={event=>onChange(event.target.checked)}/>{label}</label>
  const filteredProgrammes=offerings.filter(item=>(item.title+' '+item.institution_name).toLowerCase().includes(search.toLowerCase()))
  const programmeChoices=<><label className="via-journey-field">Search programmes<input type="search" placeholder="Search programmes or institutions" value={search} onChange={event=>setSearch(event.target.value)}/></label><div className="via-journey-options via-journey-catalogue">{filteredProgrammes.map(item=><label key={item.id}><input type="checkbox" checked={j.programme_ids.includes(item.id)} onChange={()=>update({programme_ids:toggleId(j.programme_ids,item.id),programmes_exploring:false,study_unsure:false})}/><span>{item.title}<small>{item.institution_name}{item.is_demo?' · Demo programme':''}</small></span></label>)}</div>{!loading&&!failed&&!filteredProgrammes.length&&<p>No programmes match this search. You can choose a field or explore later.</p>}</>
  const institutionSelect=(value:string,onChange:(value:string)=>void,label='Institution')=><label className="via-journey-field">{label}<select value={value} onChange={event=>onChange(event.target.value)} disabled={loading}><option value="">Select Institution</option>{institutions.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
  const yearSelect=(label:string,value:number|null,onChange:(value:number|null)=>void,future=false)=>{
    const now=currentYear,years=Array.from({length:future?8:now-1999},(_,index)=>future?now-1+index:now-index)
    if(value&&!years.includes(value))years.push(value)
    return <label className="via-journey-field">{label}<select value={value??''} onChange={event=>onChange(event.target.value?Number(event.target.value):null)}><option value="">Select Year</option>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
  }
  const titles:Partial<Record<Step,string>>={
    'school-subjects':'What subjects are you taking?',interests:'What are you interested in?','career-interests':stage==='grade_9'?"Are there any careers you're interested in?":"Are there any careers you're considering?",
    'study-interests':'What would you like to study?',programmes:'Do you already have programmes in mind?','study-location':stage==='grade_11'?'Where would you study?':'Where would you consider studying?',
    applications:stage==='post_matric'?'Have you already applied?':'Have you started applying?',funding:stage==='post_matric'?'What is your funding situation?':stage==='accepted'?'How will your studies be funded?':stage==='tertiary'?'How are your studies currently funded?':'How are you planning to fund your studies?',
    'matric-year':'When did you complete Grade 12?','current-activity':'What are you doing now?',institution:stage==='accepted'?'Where have you been accepted?':'Where are you studying?',
    'enrolled-programme':stage==='accepted'?'What will you be studying?':'What are you studying?',campus:stage==='accepted'?'Which campus will you attend?':'Which campus are you studying at?',
    'starting-year':'When are you starting?','year-of-study':'What year of study are you in?','accommodation-status':'Have you sorted out accommodation?',registration:'Have you completed registration?',support:'What would you like help with?',
  }
  const campusOptions=[...new Set(offerings.filter(item=>item.institution_id===j.institution_id).map(item=>item.campus).filter((value):value is string=>!!value))]
  return <OnboardingStepLayout title={titles[kind]||'Your next step'} copy={kind==='institution'&&stage==='accepted'?'Congratulations!':kind==='support'?'Select all that apply.':undefined}>
    <div className="via-journey-question" data-question={kind}>
      {needsCatalogue&&loading&&<p role="status">Loading institutions and programmes…</p>}
      {needsCatalogue&&failed&&<p role="alert">The catalogue could not be loaded. <button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></p>}
      {kind==='school-subjects'&&<><label className="via-journey-field">Search subjects<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Select Subjects"/></label><div className="via-journey-options">{choices('subject').filter(item=>item.label.toLowerCase().includes(search.toLowerCase())).map(item=><label key={item.id}><input type="checkbox" checked={answers.school_subject_ids.includes(item.id)} onChange={()=>patch({school_subject_ids:toggleId(answers.school_subject_ids,item.id)})}/><span>{item.label}</span></label>)}</div></>}
      {kind==='interests'&&<>{checkboxes(interestAreas,j.interests,value=>update({interests:value,interests_unsure:false}))}{uncertain("I'm still figuring it out",j.interests_unsure,value=>update({interests_unsure:value,interests:[]}))}</>}
      {kind==='career-interests'&&<>{checkboxes(careerOptions,j.careers,value=>update({careers:value,careers_unsure:false}))}{uncertain("I'm not sure yet",j.careers_unsure,value=>update({careers_unsure:value,careers:[]}))}</>}
      {kind==='study-interests'&&<>{checkboxes(studyFields,j.fields,value=>update({fields:value,study_unsure:false}))}{stage!=='grade_11'&&<details className="via-journey-more"><summary>Select Programmes</summary>{programmeChoices}</details>}{uncertain(stage==='grade_11'?"I'm not sure yet":"I'm Still Exploring",j.study_unsure,value=>update({study_unsure:value,fields:[],programme_ids:[]}))}</>}
      {kind==='programmes'&&<>{programmeChoices}{uncertain('Help Me Explore',j.programmes_exploring,value=>update({programmes_exploring:value,programme_ids:[]}))}</>}
      {kind==='study-location'&&<>{radios(['Anywhere in South Africa','Select preferred provinces'],answers.location_mode==='anywhere'?'Anywhere in South Africa':'Select preferred provinces',value=>patch({location_mode:value==='Anywhere in South Africa'?'anywhere':'provinces'}))}{answers.location_mode==='provinces'&&<><div className="via-journey-options">{choices('province').map(item=><label key={item.id}><input type="checkbox" checked={answers.province_ids.includes(item.id)} onChange={()=>patch({province_ids:toggleId(answers.province_ids,item.id)})}/><span>{item.label}</span></label>)}</div>{stage!=='grade_11'&&<details className="via-journey-more"><summary>Select preferred institutions</summary><div className="via-journey-options">{institutions.map(item=><label key={item.id}><input type="checkbox" checked={j.preferred_institution_ids.includes(item.id)} onChange={()=>update({preferred_institution_ids:toggleId(j.preferred_institution_ids,item.id)})}/><span>{item.title}</span></label>)}</div></details>}</>}</>}
      {kind==='matric-year'&&yearSelect('Grade 12 completion year',j.matric_year,value=>update({matric_year:value}))}
      {kind==='current-activity'&&radios(currentActivities,j.current_activity,value=>update({current_activity:value}))}
      {kind==='applications'&&<>{radios(stage==='post_matric'?['Yes','No']:applicationProgress,j.application_progress,value=>update({application_progress:value}))}{hasApplied(stage,j)&&<section className="via-journey-applications"><h2>Where have you applied?</h2>{j.applications.map((application,index)=><fieldset key={index}><legend>Application {index+1}</legend>{institutionSelect(application.institution_id,value=>update({applications:j.applications.map((row,i)=>i===index?{...row,institution_id:value}:row)}))}<label className="via-journey-field">Programme<input maxLength={200} value={application.programme} onChange={event=>update({applications:j.applications.map((row,i)=>i===index?{...row,programme:event.target.value}:row)})}/></label><label className="via-journey-field">Application status<select value={application.status} onChange={event=>update({applications:j.applications.map((row,i)=>i===index?{...row,status:event.target.value}:row)})}><option value="">Select status</option>{applicationStatuses.map(value=><option key={value}>{value}</option>)}</select></label><button type="button" className="via-journey-inline-button" aria-label={`Remove application ${index+1}`} onClick={()=>update({applications:j.applications.filter((_,i)=>i!==index)})}><Trash2 size={18}/>Remove</button></fieldset>)}<button className="via-journey-inline-button" type="button" disabled={j.applications.length>=20} onClick={()=>update({applications:[...j.applications,{institution_id:'',programme:'',status:''}]})}><Plus size={18}/>Add Application</button></section>}</>}
      {kind==='funding'&&(stage==='post_matric'?radios(fundingSituations,j.funding_situation,value=>update({funding_situation:value})):checkboxes([...fundingMethods,...(stage==='accepted'?['Funding not confirmed','Other']:stage==='tertiary'?['Other','I currently need funding']:["I'm looking for funding","I'm not sure yet"])],j.funding_methods,value=>update({funding_methods:value})))}
      {kind==='institution'&&institutionSelect(j.institution_id,value=>update({institution_id:value,programme_id:'',programme_name:'',campus:''}))}
      {kind==='enrolled-programme'&&<><label className="via-journey-field">Select Programme<select value={j.programme_id} onChange={event=>update({programme_id:event.target.value,programme_name:''})}><option value="">Select Programme</option>{offerings.filter(item=>item.institution_id===j.institution_id).map(item=><option key={item.id} value={item.id}>{item.title}{item.is_demo?' (Demo programme)':''}</option>)}</select></label><p>OR</p><label className="via-journey-field">Enter Programme<input placeholder="Official programme name" maxLength={200} value={j.programme_name} onChange={event=>update({programme_name:event.target.value,programme_id:''})}/></label></>}
      {kind==='campus'&&<><label className="via-journey-field">Select Campus<select value={campusOptions.includes(j.campus)?j.campus:''} onChange={event=>update({campus:event.target.value})}><option value="">Select Campus</option>{campusOptions.map(value=><option key={value}>{value}</option>)}</select></label><label className="via-journey-field">Campus not listed? Enter its name<input maxLength={200} value={j.campus} onChange={event=>update({campus:event.target.value})}/></label></>}
      {kind==='starting-year'&&yearSelect('Starting year',j.starting_year,value=>update({starting_year:value}),true)}
      {kind==='year-of-study'&&radios(yearsOfStudy,j.year_of_study,value=>update({year_of_study:value}))}
      {kind==='accommodation-status'&&radios(['Yes','Not yet',"I don't need accommodation"],j.accommodation_status,value=>update({accommodation_status:value}))}
      {kind==='registration'&&radios(['Yes','Not yet',"Registration hasn't opened yet"],j.registration_status,value=>update({registration_status:value}))}
      {kind==='support'&&checkboxes(supportOptions,j.support,value=>update({support:value}))}
    </div>
  </OnboardingStepLayout>
}
