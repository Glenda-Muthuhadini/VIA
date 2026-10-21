import type { Answers, OnboardingOption } from './model'
export const schoolProvinces=['Gauteng','Limpopo','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape']
export const curricula=['CAPS','IEB','Other',"I'm not sure"]
export const experiences=['I enjoy it',"It's okay",'I find it difficult']
export const subjectChoiceStatuses=['Yes, I already know what I want to choose','I have some ideas','Not yet','I need help choosing']
export const futureClarities=['Yes, I have some ideas',"I have a few interests but I'm not sure",'Not yet — I want to explore']
export const futureAreas=['Technology & Computing','Engineering','Health Sciences','Science','Business & Commerce','Finance & Accounting','Law','Education','Humanities & Social Sciences','Creative fields','Agriculture','Environment']
export const reportPeriods=['term_1','term_2','term_3','term_4','final','latest']
export type Grade9Draft={report_id:string|null;school_name:string;academic_year:string;report_period:string;detected_grade:number|null;grade_corrected:boolean;rows:{subject_id:string;mark:string}[]}
export type Grade9Answers={current_grade:9;province:string;school_name:string;school_id:string|null;curriculum:string;school_manual:boolean;results_draft:Grade9Draft|null;subject_experience:Record<string,string>;subject_choice_status:string;subjects_considering:string[];future_clarity:string;future_interest_areas:string[];future_unsure:boolean;results_confirmed:boolean}
export const emptyGrade9=():Grade9Answers=>({current_grade:9,province:'',school_name:'',school_id:null,curriculum:'',school_manual:false,results_draft:null,subject_experience:{},subject_choice_status:'',subjects_considering:[],future_clarity:'',future_interest_areas:[],future_unsure:false,results_confirmed:false})
export function normaliseGrade9(value:Partial<Grade9Answers>|null|undefined):Grade9Answers {
 const source=value??{},base=emptyGrade9(),strings=(v:unknown)=>Array.isArray(v)?[...new Set(v.filter((s):s is string=>typeof s==='string'))]:[]
 for(const key of ['province','school_name','curriculum','subject_choice_status','future_clarity'] as const)if(typeof source[key]==='string')base[key]=source[key].slice(0,200)
 base.school_id=typeof source.school_id==='string'?source.school_id:null
 base.school_manual=source.school_manual===true;base.future_unsure=source.future_unsure===true;base.results_confirmed=source.results_confirmed===true
 base.subjects_considering=strings(source.subjects_considering);base.future_interest_areas=strings(source.future_interest_areas)
 if(source.subject_experience&&typeof source.subject_experience==='object'&&!Array.isArray(source.subject_experience))base.subject_experience=Object.fromEntries(Object.entries(source.subject_experience).filter(([,v])=>typeof v==='string'))
 const d=source.results_draft
 if(d&&typeof d==='object'&&Array.isArray(d.rows))base.results_draft={report_id:typeof d.report_id==='string'?d.report_id:null,school_name:typeof d.school_name==='string'?d.school_name:'',academic_year:typeof d.academic_year==='string'?d.academic_year:'',report_period:typeof d.report_period==='string'?d.report_period:'',detected_grade:typeof d.detected_grade==='number'?d.detected_grade:null,grade_corrected:d.grade_corrected===true,rows:d.rows.filter(r=>r&&typeof r.subject_id==='string'&&typeof r.mark==='string').slice(0,20)}
 return base
}
export const consideringSubjects=(a:Grade9Answers)=>subjectChoiceStatuses.slice(0,2).includes(a.subject_choice_status)
export const consideringFuture=(a:Grade9Answers)=>futureClarities.slice(0,2).includes(a.future_clarity)
export function grade9DraftError(draft:Grade9Draft|null,options:OnboardingOption[]=[]){
 if(!draft||!draft.rows.length)return 'Add at least one subject and percentage mark.'
 if(!draft.school_name.trim())return 'Enter the school name for this report.'
 if(!/^\d{4}$/.test(draft.academic_year)||Number(draft.academic_year)<2000||Number(draft.academic_year)>2100)return 'Enter an academic year between 2000 and 2100.'
 if(!reportPeriods.includes(draft.report_period))return 'Choose the term or report period.'
 if(draft.detected_grade!==null&&draft.detected_grade!==9&&!draft.grade_corrected)return 'The report shows another grade. Use a Grade 9 report or confirm that the detected grade is incorrect.'
 if(draft.rows.some(row=>!row.subject_id||!/^[0-9]+([.][0-9]+)?$/.test(row.mark)||!Number.isFinite(Number(row.mark))||Number(row.mark)<0||Number(row.mark)>100))return 'Select a subject and enter a percentage from 0 to 100 for every row.'
 if(new Set(draft.rows.map(row=>row.subject_id)).size!==draft.rows.length)return 'List each subject only once.'
 if(options.length&&draft.rows.some(row=>!options.some(o=>o.id===row.subject_id&&o.category==='subject'&&(!o.education_stages||o.education_stages.includes('grade_9')))))return 'Choose valid Grade 9 subjects.'
 return ''
}
export function validateGrade9Step(step:string,a:Answers){
 const g=a.grade9
 if(step==='school-details'&&(!schoolProvinces.includes(g.province)||!g.school_name.trim()||!curricula.includes(g.curriculum)||(!g.school_id&&!g.school_manual)))return 'Select a province, select or enter your school, and choose your curriculum.'
 if(step==='results'&&!g.results_draft&&!g.results_confirmed)return 'Scan, upload or enter your Grade 9 results.'
 if(step==='confirm-results'&&!g.results_confirmed)return 'Review and confirm your Grade 9 results before continuing.'
 if(step==='subject-experience'&&(!g.results_confirmed||a.results.some(r=>!experiences.includes(g.subject_experience[r.subject_id]))))return 'Tell us how each of your confirmed subjects feels.'
 if(step==='interests'&&!a.journey.interests.length&&!a.journey.interests_unsure)return 'Choose interests or select “I’m still figuring it out”.'
 if(step==='subject-choice'&&!subjectChoiceStatuses.includes(g.subject_choice_status))return 'Tell us whether you have started thinking about Grade 10 subjects.'
 if(step==='subjects-considering'&&consideringSubjects(g)&&!g.subjects_considering.length)return 'Select the Grade 10 subjects you are considering.'
 if(step==='future-interests'&&(!futureClarities.includes(g.future_clarity)||(consideringFuture(g)&&!g.future_interest_areas.length&&!g.future_unsure)))return 'Choose how clear your future plans feel, then select areas or “I’m not sure yet”.'
 return ''
}
export function grade9Electives(options:OnboardingOption[]){return options.filter(o=>o.category==='subject'&&(!o.education_stages||o.education_stages.includes('grade_10'))&&!/home language|additional language|life orientation/i.test(o.label)&&!o.id.startsWith('subject-g9-'))}
export function reportMetadata(text:string){
 const years=[...new Set([...text.matchAll(/\b(?:academic\s+year|school\s+year|year)\s*[:-]?\s*(20\d{2})\b/gi)].map(m=>m[1]))]
 const fallback=[...new Set([...text.matchAll(/\b(20\d{2})\b/g)].map(m=>m[1]))]
 const terms=[...new Set([...text.matchAll(/\b(?:term|quarter)\s*[:-]?\s*([1-4])\b/gi)].map(m=>'term_'+m[1]))]
 const school=text.match(/^\s*(?:school(?:\s+name)?)\s*:\s*(.{2,200})$/im)?.[1]?.trim()??''
 return {school_name:school,academic_year:years.length===1?years[0]:fallback.length===1?fallback[0]:'',report_period:terms.length===1?terms[0]:/\b(?:final|year[ -]end)\s+(?:report|results)\b/i.test(text)?'final':''}
}
