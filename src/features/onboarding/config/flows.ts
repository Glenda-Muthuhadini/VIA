import { consideringSubjects } from '../services/grade9-model.ts'
import type { Answers, Step } from '../services/model'
import type { EducationStage } from './education-stages'
export type FlowStep = { id: Step; optional?: boolean; when?: (answers: Answers) => boolean }
export type Flow = { steps: FlowStep[]; implemented: boolean; completionLabel: string; completionCopy: string; completionTitle?:string; directReady?:boolean; destination: string }
const grade9: Flow = {
  steps: [{ id: 'welcome' }, { id: 'current' }, ...(['interests','personality','results','school-subjects','future-curiosity'] as Step[]).map(id => ({ id, optional: true }))],
  implemented: true, completionLabel: 'Build my subject plan',
  completionCopy: "We've used your interests and what you've told us about school to start building your Grade 10 Subject Guide.",
  destination: '/dashboard?panel=subject-guide',
}
export const legacyFlow: Flow = { steps: ['welcome','current','interests','results','personality','study-plan','preferences'].map(id => ({ id: id as Step })), implemented: true, completionLabel: 'Go to my VIA', completionCopy: 'Your interests, strengths, study goals and any results you provided are saved. You can return to update your VIA whenever you need to.', destination: '/dashboard' }
const pending: Flow = { steps: [{ id: 'welcome' }, { id: 'current' }, { id: 'stage-pending' }], implemented: false, completionLabel: 'Continue', completionCopy: '', destination: '/dashboard' }
function getLegacyFlow(stage: EducationStage | null, version = 3): Flow {
  if (!stage) return { ...pending, steps: [{ id: 'welcome' }, { id: 'current' }] }
  if (version === 2) return legacyFlow
  return stage === 'grade_9' ? grade9 : pending
}
const branchSteps: Record<EducationStage,Step[]>={
  grade_9:['results','interests','career-interests'],
  grade_10:['school-subjects','results','interests','career-interests'],
  grade_11:['results','study-interests','programmes','study-location'],
  grade_12:['results','study-interests','study-location','applications','funding'],
  post_matric:['matric-year','results','current-activity','study-interests','study-location','applications','funding'],
  accepted:['institution','enrolled-programme','campus','starting-year','funding','accommodation-status','registration'],
  tertiary:['institution','campus','enrolled-programme','year-of-study','funding','support'],
  graduate:[],
}
const completion:Record<EducationStage,[string,string]>={
  grade_9:["You're all set.","We'll use your results and interests to help you prepare for your Grade 10 subject choices."],
  grade_10:["You're all set.","We'll help you understand where your subjects could take you."],
  grade_11:['Your VIA profile is ready.',"We'll use your results and interests to help you explore study options and prepare for applications."],
  grade_12:["You're ready.",'VIA will help you organise your study options, applications and funding journey.'],
  post_matric:['Your VIA profile is ready.',''],
  accepted:["You're ready for your next chapter.",''],
  tertiary:['Your student profile is ready.',''],
  graduate:['Your VIA profile is ready.','Your profile and study history stay with you as you take your next step.'],
}
export function getFlow(stage:EducationStage|null,version=4,carried:Step[]=[]):Flow {
  if(version<4)return getLegacyFlow(stage,version)
  if(stage==='grade_9')return {steps:[{id:'welcome'},{id:'current'},{id:'school-details'},{id:'results'},{id:'confirm-results'},{id:'subject-experience'},{id:'interests'},{id:'subject-choice'},{id:'subjects-considering',when:a=>consideringSubjects(a.grade9)},{id:'future-interests'}],implemented:true,directReady:true,completionTitle:"You're all set.",completionCopy:'VIA can now use your results, interests and subject preferences to help you explore your strengths and prepare for your Grade 10 subject choices.',completionLabel:'Go to My Dashboard',destination:'/dashboard'}
  const [completionTitle,completionCopy]=completion[stage??'graduate']
  return {steps:[{id:'welcome'},{id:'current'},...(stage?branchSteps[stage]:[]).filter(id=>!carried.includes(id)).map(id=>({id}))],implemented:true,directReady:true,completionTitle,completionCopy,completionLabel:'Go to My Dashboard',destination:'/dashboard'}
}
