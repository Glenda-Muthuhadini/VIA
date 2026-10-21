import type { EducationStage } from '../config/education-stages'
export const interestAreas=['Technology','Science','Health','Engineering','Business','Finance','Law','Education','Creative fields','Agriculture','Environment','Social sciences']
export const studyFields=['Technology & Computing','Engineering','Health Sciences','Science','Business & Commerce','Finance & Accounting','Law','Education','Humanities','Creative fields','Agriculture']
export const careerOptions=['Software developer','Data scientist','Engineer','Doctor','Nurse','Accountant','Financial analyst','Entrepreneur','Lawyer','Teacher','Designer','Architect','Agricultural scientist','Environmental scientist','Social worker']
export const fundingMethods=['NSFAS','Bursary','Scholarship','Student loan','Family / Self-funded']
export const supportOptions=['Academic progress','Funding','Managing study costs','Academic support','Student wellness','Societies & student life','Opportunities & events','Accommodation']
export const applicationStatuses=['Preparing','Submitted','Awaiting outcome','Accepted','Waitlisted','Unsuccessful']
export const applicationProgress=['Not yet',"I'm preparing to apply","I've started applying","I've submitted applications"]
export const currentActivities=['Looking for something to study','Preparing to apply','Improving my results','Looking for funding','Waiting for application outcomes']
export const fundingSituations=["I'm looking for funding","I've applied for funding",'I already have funding',"I'm not sure yet"]
export const yearsOfStudy=['First year','Second year','Third year','Fourth year','Fifth year+','Postgraduate']
export type ApplicationEntry={institution_id:string;programme:string;status:string}
export type JourneyAnswers={interests:string[];interests_unsure:boolean;careers:string[];careers_unsure:boolean;fields:string[];programme_ids:string[];study_unsure:boolean;programmes_exploring:boolean;preferred_institution_ids:string[];matric_year:number|null;current_activity:string;application_progress:string;applications:ApplicationEntry[];funding_methods:string[];funding_situation:string;institution_id:string;programme_id:string;programme_name:string;campus:string;starting_year:number|null;year_of_study:string;accommodation_status:string;registration_status:string;support:string[]}
export const emptyJourney=():JourneyAnswers=>({interests:[],interests_unsure:false,careers:[],careers_unsure:false,fields:[],programme_ids:[],study_unsure:false,programmes_exploring:false,preferred_institution_ids:[],matric_year:null,current_activity:'',application_progress:'',applications:[],funding_methods:[],funding_situation:'',institution_id:'',programme_id:'',programme_name:'',campus:'',starting_year:null,year_of_study:'',accommodation_status:'',registration_status:'',support:[]})
export function normaliseJourney(value:Partial<JourneyAnswers>|null|undefined):JourneyAnswers {
  const base=emptyJourney(),source=value||{}
  for(const key of Object.keys(base) as (keyof JourneyAnswers)[]){
    const candidate=source[key]
    if(Array.isArray(base[key])){
      if(key==='applications')base.applications=Array.isArray(candidate)?candidate.filter((row):row is ApplicationEntry=>!!row&&typeof row==='object'&&'institution_id' in row&&typeof row.institution_id==='string'&&'programme' in row&&typeof row.programme==='string'&&'status' in row&&typeof row.status==='string').slice(0,20):[]
      else (base[key] as string[])=Array.isArray(candidate)?[...new Set(candidate.filter((item):item is string=>typeof item==='string'))].slice(0,100):[]
    }else if(typeof base[key]==='boolean')Object.assign(base,{[key]:candidate===true})
    else if(key==='matric_year'||key==='starting_year')Object.assign(base,{[key]:typeof candidate==='number'&&Number.isInteger(candidate)&&candidate>=2000&&candidate<=2100?candidate:null})
    else if(typeof candidate==='string')Object.assign(base,{[key]:candidate.slice(0,200)})
  }
  return base
}
export const hasApplied=(stage:EducationStage|null,j:JourneyAnswers)=>stage==='post_matric'?j.application_progress==='Yes':["I've started applying","I've submitted applications"].includes(j.application_progress)
export function validateJourneyStep(step:string,stage:EducationStage|null,answers:{journey:JourneyAnswers;results:{subject_id:string;mark:number}[];report_id:string|null;school_subject_ids:string[];location_mode:string;province_ids:string[]}):string {
  const j=answers.journey
  if(step==='results'&&!answers.results.length&&!answers.report_id)return 'Upload your report or enter your marks to continue.'
  if(step==='school-subjects'&&!answers.school_subject_ids.length)return 'Select the subjects you are taking.'
  if(step==='interests'&&!j.interests.length&&!j.interests_unsure)return 'Select interests or choose “I’m still figuring it out”.'
  if(step==='career-interests'&&!j.careers.length&&!j.careers_unsure)return 'Select careers or choose “I’m not sure yet”.'
  if(step==='study-interests'&&!j.fields.length&&!j.programme_ids.length&&!j.study_unsure)return 'Select fields or programmes, or choose that you are still exploring.'
  if(step==='programmes'&&!j.programme_ids.length&&!j.programmes_exploring)return 'Select programmes or choose “Help Me Explore”.'
  if(step==='study-location'&&answers.location_mode==='provinces'&&!answers.province_ids.length&&!j.preferred_institution_ids.length)return 'Select provinces or institutions, or choose anywhere in South Africa.'
  if(step==='matric-year'&&!j.matric_year)return 'Select the year you completed Grade 12.'
  if(step==='current-activity'&&!j.current_activity)return 'Select what you are doing now.'
  if(step==='applications'){
    if(!j.application_progress)return 'Select your application progress.'
    if(hasApplied(stage,j)&&(!j.applications.length||j.applications.some(row=>!row.institution_id||!row.programme.trim()||!row.status)))return 'Add the institution, programme and status for each application.'
  }
  if(step==='funding'&&(stage==='post_matric'?!j.funding_situation:!j.funding_methods.length))return 'Select your funding situation.'
  if(step==='institution'&&!j.institution_id)return 'Select your institution.'
  if(step==='enrolled-programme'&&!j.programme_id&&!j.programme_name.trim())return 'Select or enter your programme.'
  if(step==='campus'&&!j.campus.trim())return 'Select or enter your campus.'
  if(step==='starting-year'&&!j.starting_year)return 'Select your starting year.'
  if(step==='year-of-study'&&!j.year_of_study)return 'Select your year of study.'
  if(step==='accommodation-status'&&!j.accommodation_status)return 'Select your accommodation status.'
  if(step==='registration'&&!j.registration_status)return 'Select your registration status.'
  if(step==='support'&&!j.support.length)return 'Select at least one area where you would like help.'
  return ''
}
