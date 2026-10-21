import { supabase } from '../../../services/supabase'
import type { Opportunity } from './model'
import type { SubjectResult } from '../../onboarding/services/model'
import type { ResultsGrade } from './report-results'
import { presentCatalogue } from './presentation'
export { confirmedResults } from './qualification-input'

export type QualificationCheck = { label:string; status:'met'|'not_met'|'unknown'; actual:number|null; minimum:number|null }
export type QualificationOutcome = { programme:Opportunity; status:string; learner_aps:number|null; required_aps:number|null; checks:QualificationCheck[]; reason:string; notes:string|null; rule_source_url:string|null; rule_source_name:string|null }
export const qualificationGroups=['meets','close','not_met','unverified'] as const
export type QualificationGroup=typeof qualificationGroups[number]
export type QualificationResponse={groups:Record<QualificationGroup,{total:number;items:QualificationOutcome[]}>;academic_year:number;page:number;page_size:number}
export type ConnectedOutcome = Pick<QualificationOutcome,'programme'|'status'|'learner_aps'|'checks'|'reason'|'rule_source_url'> & {
 required_aps:number|null; missing:QualificationCheck[]; scoring_system:string
}
export type PathwayOutcome = {programme:Opportunity;status:'pathway';reason:string;future_subjects:{subject_id:string;subject:string}[]}
export type ConnectedResponse = {
 grade:ResultsGrade; mode:'pathways'|'eligibility'; academic_year:number;
 score:{value:number;label:string;context:string}|null;
 insights:{subject_id:string;subject:string;mark:number;insight:'Strong'|'On track'|'Focus area'}[];
 exact:{total:number;items:ConnectedOutcome[]}; close:{total:number;items:ConnectedOutcome[]};pathways:PathwayOutcome[];unverified_count?:number
}
export async function checkConnectedQualification(results:SubjectResult[],grade:ResultsGrade,year:number,signal:AbortSignal):Promise<ConnectedResponse> {
 const {data,error}=await supabase.rpc('check_connected_qualification',{p_results:results,p_grade:grade,p_year:year,p_limit:5}).abortSignal(signal)
 if(error)throw error
 if(!data||!['pathways','eligibility'].includes(data.mode)||!Array.isArray(data.insights)||!Array.isArray(data.exact?.items)||!Array.isArray(data.close?.items)||!Array.isArray(data.pathways))throw new Error('Invalid analysis response')
 return presentCatalogue(data) as ConnectedResponse
}
export async function qualificationMetadata(signal:AbortSignal) {
 const [subjects,years]=await Promise.all([
  supabase.rpc('public_qualification_subjects').abortSignal(signal),
  supabase.from('via_admission_rules').select('academic_year').order('academic_year',{ascending:false}).limit(100).abortSignal(signal),
 ])
 if(subjects.error||years.error)throw subjects.error??years.error
 if(!Array.isArray(subjects.data)||!subjects.data.length)throw new Error('Subject catalogue unavailable')
 return {subjects:subjects.data as {id:string;label:string}[],years:[...new Set((years.data??[]).map(row=>Number(row.academic_year)))]}
}
export async function checkQualification(results:SubjectResult[],nsc:boolean,bachelorPass:boolean,year:number,page:number,signal:AbortSignal):Promise<QualificationResponse> {
 const {data,error}=await supabase.rpc('check_public_qualification',{p_results:results,p_nsc:nsc,p_bachelor_pass:bachelorPass,p_year:year,p_page:page,p_page_size:12}).abortSignal(signal)
 if(error)throw error
 if(!data?.groups||!qualificationGroups.every(key=>Array.isArray(data.groups[key]?.items)&&Number.isFinite(data.groups[key]?.total)))throw new Error('Invalid qualification response')
 return data as QualificationResponse
}
// Read current, owner-only academic records; exploratory edits never write them.
export async function myQualificationResults(userId:string) {
 const {data:{session}}=await supabase.auth.getSession()
 if(session?.user.id!==userId)throw new Error('Your account changed. Please try again.')
 const {data:record,error}=await supabase.from('via_onboarding').select('academic_record_id,answers,flow_version').eq('user_id',userId).maybeSingle()
 if(error)throw error
 if(record?.flow_version===3&&record.academic_record_id){
  const {data,error}=await supabase.from('via_academic_results').select('subject_id,mark').eq('user_id',userId).eq('record_id',record.academic_record_id)
  if(error)throw error
  return (data??[]).map(row=>({subject_id:String(row.subject_id),mark:Number(row.mark)}))
 }
 return record?.flow_version!==3&&Array.isArray(record?.answers?.results)?record.answers.results as SubjectResult[]:[]
}
