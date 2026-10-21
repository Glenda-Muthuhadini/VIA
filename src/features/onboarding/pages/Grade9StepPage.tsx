import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Camera, FileUp, PencilLine, X } from 'lucide-react'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { useOnboarding } from '../context/onboarding-context'
import { SubjectResultsEditor, type ResultRow } from '../../../components/academic/SubjectResultsEditor'
import { curricula, experiences, futureAreas, futureClarities, consideringFuture, grade9Electives, reportMetadata, reportPeriods, schoolProvinces, subjectChoiceStatuses, type Grade9Draft } from '../services/grade9-model'
import { interestAreas } from '../services/journey-model'
import { toggleId, type Step } from '../services/model'
import { supabase } from '../../../services/supabase'
import { reportUrl } from '../services/onboarding'
import './JourneyStepPage.css'
import './Grade9StepPage.css'

const periodLabel=(value:string)=>value==='latest'?'Latest report':value==='final'?'Final / year-end':value.replace('term_','Term ')
export function Grade9StepPage({kind}:{kind:Step}) {
 const {answers,patch,choices,options,save,record,storeGrade9Report,reports}=useOnboarding(),g=answers.grade9
 const navigate=useNavigate()
 const [searchParams]=useSearchParams(),mode=searchParams.get('mode'),modeApplied=useRef(false)
 const update=(value:Partial<typeof g>)=>patch({grade9:{...g,...value,...('results_draft' in value?{results_confirmed:false}:{})}})
 const [schoolQuery,setSchoolQuery]=useState(''),[schools,setSchools]=useState<{id:string;name:string}[]>([]),[schoolStatus,setSchoolStatus]=useState(''),[schoolRetry,setSchoolRetry]=useState(0)
 const [processing,setProcessing]=useState(''),[error,setError]=useState(''),[controller,setController]=useState<AbortController|null>(null)
 useEffect(()=>{
  if(kind!=='school-details'||!g.province||g.school_manual)return
  const control=new AbortController()
  const timer=setTimeout(()=>{setSchoolStatus('Searching schools…');let request=supabase.from('via_schools').select('id,name').eq('province',g.province).eq('active',true).order('name').limit(30)
   const query=schoolQuery.trim().replace(/[%_\\]/g,'').slice(0,100)
   if(query)request=request.ilike('name',`%${query}%`)
   void request.abortSignal(control.signal).then(({data,error})=>{if(!control.signal.aborted){setSchools(data??[]);setSchoolStatus(error?'School search could not be loaded. Try again or enter your school manually.':data?.length?'':'No schools found. You can enter your school manually.')}})
  },250)
  return()=>{clearTimeout(timer);control.abort()}
 },[kind,g.province,g.school_manual,schoolQuery,schoolRetry])
 useEffect(()=>()=>controller?.abort(),[controller])
 const subjects=choices('subject')
 const blankDraft=():Grade9Draft=>({report_id:null,school_name:g.school_name,academic_year:'',report_period:'',detected_grade:null,grade_corrected:false,rows:[{subject_id:'',mark:''}]})
 useEffect(()=>{
  if(kind!=='results'||modeApplied.current||!mode)return
  modeApplied.current=true
  if(mode==='manual'){
   patch({grade9:{...g,results_draft:blankDraft(),results_confirmed:false}})
   navigate('/onboarding/confirm-results',{replace:true})
  }else if(mode==='scan'||mode==='upload'){
   document.querySelector<HTMLInputElement>(mode==='scan'?'input[capture]':'input[accept*="pdf"]')?.focus()
  }
  // Apply this explicit navigation intent once; editing remains in existing onboarding.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[kind,mode])
 async function readFile(file:File,storedId?:string){
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||!file.size||file.size>10485760){setError('Choose a PDF, JPG, JPEG or PNG up to 10 MB.');return}
  const control=new AbortController();setController(control);setError('');setProcessing('Saving the original report…')
  let base:Grade9Draft|undefined
  try{
   const report=storedId?reports.find(row=>row.id===storedId):await storeGrade9Report(file)
   if(!report||control.signal.aborted)return
   base={...blankDraft(),report_id:report.id,rows:[]}
   // A review draft is private and resumable; it never replaces confirmed marks.
   patch({grade9:{...g,results_draft:base,results_confirmed:false}})
   await save('results')
   if(control.signal.aborted)return
   const {extractReport}=await import('../../discovery/services/report-reader')
   const extracted=await extractReport(file,subjects,control.signal,setProcessing,true,Number.POSITIVE_INFINITY)
   if(control.signal.aborted)return
   const metadata=reportMetadata(extracted.text??'')
   const draft={...base,...metadata,school_name:metadata.school_name||g.school_name,detected_grade:extracted.grade,rows:extracted.results}
   patch({grade9:{...g,results_draft:draft,results_confirmed:false}})
   await save('confirm-results')
   if(!control.signal.aborted)navigate('/onboarding/confirm-results')
  }catch(reason){if(!control.signal.aborted)setError(reason instanceof Error?reason.message:'The report could not be read. Try again or enter the marks manually.')}
  finally{if(!control.signal.aborted)setProcessing('')}
 }
 async function readSaved(){
  const report=reports.find(row=>row.id===g.results_draft?.report_id)
  if(!report)return
  setError('');setProcessing('Opening your saved report…')
  try{const url=await reportUrl(report),response=await fetch(url);if(!response.ok)throw Error('The saved report could not be opened.');await readFile(new File([await response.blob()],report.file_name,{type:report.mime_type}),report.id)}catch{setError('The saved report could not be opened. Retry or upload it again.');setProcessing('')}
 }
 const titles:Partial<Record<Step,string>>={'school-details':'Tell us about your school',results:'Add your latest Grade 9 results','confirm-results':"Let's make sure we got everything right",'subject-experience':'How do your subjects feel right now?',interests:'What kinds of things are you interested in?','subject-choice':'Have you started thinking about your Grade 10 subjects?','subjects-considering':'Which subjects are you considering?','future-interests':'Have you thought about what you might want to do one day?'}
 const copy=kind==='results'?"We'll use your results to understand your strengths and help you prepare for Grade 10 subject choices.":kind==='subject-experience'?"Tell us how you feel about the subjects you're currently taking.":kind==='interests'?'Choose anything that sounds like you.':kind==='subjects-considering'?'These are possible Grade 10 choices, separate from your current Grade 9 subjects.':undefined
 const radios=(name:string,values:string[],selected:string,change:(value:string)=>void)=><div className="via-journey-options">{values.map(value=><label key={value}><input type="radio" name={name} checked={selected===value} onChange={()=>change(value)}/><span>{value}</span></label>)}</div>
 const draft=g.results_draft
 const updateDraft=(changes:Partial<Grade9Draft>)=>update({results_draft:{...(draft??blankDraft()),...changes}})
 return <OnboardingStepLayout title={titles[kind]??'Your next step'} copy={copy} navigation={!processing}>
  <div className="via-journey-question via-grade9-question" data-question={kind}>
   {kind==='school-details'&&<>
    <label className="via-journey-field">Province<select value={g.province} onChange={event=>{setSchools([]);setSchoolQuery('');update({school_name:'',province:event.target.value,school_id:null,school_manual:false})}}><option value="">Select province</option>{schoolProvinces.map(value=><option key={value}>{value}</option>)}</select></label>
    {!g.school_manual&&<><label className="via-journey-field">Search for school<input type="search" disabled={!g.province} placeholder="Search for school" value={schoolQuery} onChange={event=>setSchoolQuery(event.target.value)}/></label>{g.school_id&&<p>Selected school: <strong>{g.school_name}</strong></p>}<div className="via-grade9-school-results" aria-label="School search results">{schools.map(school=><button type="button" key={school.id} aria-pressed={g.school_id===school.id} onClick={()=>update({school_name:school.name,school_id:school.id,school_manual:false})}>{school.name}</button>)}</div>{schoolStatus&&<p role="status">{schoolStatus}{schoolStatus.includes('could not')&&<button className="via-journey-inline-button" onClick={()=>setSchoolRetry(value=>value+1)}>Retry school search</button>}</p>}</>}
    <label className="via-journey-uncertain"><input type="checkbox" checked={g.school_manual} onChange={event=>update({school_name:'',school_manual:event.target.checked,school_id:null})}/>I can’t find my school</label>
    {g.school_manual&&<label className="via-journey-field">School name<input maxLength={200} value={g.school_name} onChange={event=>update({school_name:event.target.value})} placeholder="Enter your school name"/></label>}
    <fieldset className="via-grade9-fieldset"><legend>Curriculum</legend>{radios('curriculum',curricula,g.curriculum,value=>update({curriculum:value}))}</fieldset>
   </>}
   {kind==='results'&&<>
    {(mode==='scan'||mode==='upload')&&<p className="via-grade9-saved-report">{mode==='scan'?'Select Scan Printed Report to use your camera or choose a clear photograph.':'Select Upload Report to choose your PDF or image.'} You will review and confirm the marks before they are saved.</p>}
    <div className="via-grade9-methods"><label className="via-grade9-method"><Camera size={24}/><strong>Scan Printed Report</strong><span>Photograph your report, then review the extracted results.</span><input aria-label="Scan printed Grade 9 report" type="file" accept="image/jpeg,image/png" capture="environment" disabled={!!processing} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void readFile(file)}}/></label><label className="via-grade9-method"><FileUp size={24}/><strong>Upload Report</strong><span>PDF, JPG, JPEG or PNG · Up to 10 MB</span><input aria-label="Upload Grade 9 report" type="file" accept="application/pdf,image/jpeg,image/png" disabled={!!processing} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void readFile(file)}}/></label><button className="via-grade9-method" type="button" disabled={!!processing} onClick={()=>{update({results_draft:blankDraft()});navigate('/onboarding/confirm-results')}}><PencilLine size={24}/><strong>Enter Marks Manually</strong><span>Select subjects, enter percentages, then confirm.</span></button></div>
    {draft?.report_id&&<p className="via-grade9-saved-report">Original report saved: {reports.find(row=>row.id===draft.report_id)?.file_name??'School report'} <button className="via-journey-inline-button" disabled={!!processing} onClick={()=>void readSaved()}>Read Saved Report</button></p>}
    {draft&&<p>Your review draft is saved. Continue to check and confirm the subjects and marks.</p>}
    {g.results_confirmed&&<p>{answers.results.length} confirmed subjects are saved. Adding another report keeps these results until you confirm its replacement.</p>}
   </>}
   {kind==='confirm-results'&&<>
    <div className="via-grade9-report-fields"><label className="via-journey-field">Grade<input value="Grade 9" readOnly/></label><label className="via-journey-field">School<input maxLength={200} value={draft?.school_name??g.school_name} onChange={event=>updateDraft({school_name:event.target.value})}/></label><label className="via-journey-field">Academic year<input type="number" min={2000} max={2100} value={draft?.academic_year??''} onChange={event=>updateDraft({academic_year:event.target.value})}/></label><label className="via-journey-field">Term / report period<select value={draft?.report_period??''} onChange={event=>updateDraft({report_period:event.target.value})}><option value="">Select report period</option>{reportPeriods.map(value=><option key={value} value={value}>{periodLabel(value)}</option>)}</select></label></div>
    {draft?.detected_grade&&draft.detected_grade!==9&&<label className="via-journey-uncertain"><input type="checkbox" checked={draft.grade_corrected} onChange={event=>updateDraft({grade_corrected:event.target.checked})}/>The reader detected Grade {draft.detected_grade}. I have checked the report: that detection is incorrect and this is a Grade 9 report.</label>}
    <p>Check every subject and percentage. Add missing subjects and correct or remove anything the reader got wrong. Only Confirm Results saves these as academic results.</p>
    <SubjectResultsEditor rows={(draft?.rows??[]).map((row,index)=>({...row,key:String(index)}))} subjects={subjects} onChange={(rows:ResultRow[])=>updateDraft({rows:rows.map(({subject_id,mark})=>({subject_id,mark}))})}/>
   </>}
   {kind==='subject-experience'&&<>{answers.results.map(result=><fieldset className="via-grade9-experience" key={result.subject_id}><legend>{options.find(option=>option.id===result.subject_id)?.label} · {result.mark}%</legend>{radios('experience-'+result.subject_id,experiences,g.subject_experience[result.subject_id]??'',value=>update({subject_experience:{...g.subject_experience,[result.subject_id]:value}}))}</fieldset>)}{!answers.results.length&&<p>Confirm your results first so we can load your subjects automatically.</p>}</>}
   {kind==='interests'&&<><div className="via-journey-options">{interestAreas.map(value=><label key={value}><input type="checkbox" checked={answers.journey.interests.includes(value)} onChange={()=>patch({journey:{...answers.journey,interests:toggleId(answers.journey.interests,value),interests_unsure:false}})}/><span>{value}</span></label>)}</div><label className="via-journey-uncertain"><input type="checkbox" checked={answers.journey.interests_unsure} onChange={event=>patch({journey:{...answers.journey,interests:[],interests_unsure:event.target.checked}})}/>I’m still figuring it out</label></>}
   {kind==='subject-choice'&&radios('subject-choice',subjectChoiceStatuses,g.subject_choice_status,value=>update({subject_choice_status:value,subjects_considering:subjectChoiceStatuses.slice(0,2).includes(value)?g.subjects_considering:[]}))}
   {kind==='subjects-considering'&&<div className="via-journey-options">{grade9Electives(options).map(option=><label key={option.id}><input type="checkbox" checked={g.subjects_considering.includes(option.id)} onChange={()=>update({subjects_considering:toggleId(g.subjects_considering,option.id)})}/><span>{option.label}</span></label>)}</div>}
   {kind==='future-interests'&&<>{radios('future-clarity',futureClarities,g.future_clarity,value=>update({future_clarity:value,future_interest_areas:futureClarities.slice(0,2).includes(value)?g.future_interest_areas:[],future_unsure:false}))}{consideringFuture(g)&&<fieldset className="via-grade9-fieldset"><legend>What areas are you interested in?</legend><div className="via-journey-options">{futureAreas.map(value=><label key={value}><input type="checkbox" checked={g.future_interest_areas.includes(value)} onChange={()=>update({future_interest_areas:toggleId(g.future_interest_areas,value),future_unsure:false})}/><span>{value}</span></label>)}</div><label className="via-journey-uncertain"><input type="checkbox" checked={g.future_unsure} onChange={event=>update({future_unsure:event.target.checked,future_interest_areas:[]})}/>I’m not sure yet</label></fieldset>}</>}
   {processing&&<div className="via-grade9-processing"><p role="status">{processing}</p><button className="via-journey-inline-button" onClick={()=>{controller?.abort();setProcessing('');setError('Reading cancelled. Your original report and review draft remain saved.')}}><X size={18}/>Cancel reading</button></div>}
   {error&&<p role="alert" className="via-onboarding-feedback">{error}</p>}
   {record?.completed_at&&<p>Your existing completed profile is preserved while you review your answers.</p>}
  </div>
 </OnboardingStepLayout>
}
