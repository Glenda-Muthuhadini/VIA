import test from 'node:test'
import assert from 'node:assert/strict'
import {getFlow} from '../src/features/onboarding/config/flows.ts'
import {flowPosition,validResume} from '../src/features/onboarding/services/flow-engine.ts'
import {emptyAnswers} from '../src/features/onboarding/services/model.ts'
import {normaliseJourney,validateJourneyStep} from '../src/features/onboarding/services/journey-model.ts'
import {deriveDashboard} from '../src/features/dashboard/services/dashboard-model.ts'
import {options} from './adaptive-fixture.mjs'
const expected={grade_9:['school-details','results','confirm-results','subject-experience','interests','subject-choice','subjects-considering','future-interests'],grade_10:['school-subjects','results','interests','career-interests'],grade_11:['results','study-interests','programmes','study-location'],grade_12:['results','study-interests','study-location','applications','funding'],post_matric:['matric-year','results','current-activity','study-interests','study-location','applications','funding'],accepted:['institution','enrolled-programme','campus','starting-year','funding','accommodation-status','registration'],tertiary:['institution','campus','enrolled-programme','year-of-study','funding','support']}
test('all seven requested branches follow the specified order and complete directly',()=>{
 for(const [stage,steps] of Object.entries(expected)){
  const flow=getFlow(stage),answers=emptyAnswers()
  assert(flow.implemented&&flow.directReady)
  assert.deepEqual(flow.steps.map(item=>item.id),['welcome','current',...steps])
  assert.equal(flowPosition(flow,answers,'current').next,steps[0])
  assert.equal(flowPosition(flow,answers,steps.at(-1)).next,'ready')
  assert.equal(flow.destination,'/dashboard');assert.equal(flow.completionLabel,'Go to My Dashboard')
 }
})
test('transitions omit carried answers and completed profiles do not repeat onboarding',()=>{
 const flow=getFlow('tertiary',4,['institution','enrolled-programme','campus','funding'])
 assert.deepEqual(flow.steps.map(item=>item.id),['welcome','current','year-of-study','support'])
 assert.equal(validResume(flow,emptyAnswers(),{completed_at:'saved'}),'ready')
 assert.deepEqual(getFlow('graduate').steps.map(item=>item.id),['welcome','current'])
})
test('explicit uncertainty satisfies interest questions; results and conditional applications are required',()=>{
 const a=emptyAnswers()
 assert(validateJourneyStep('interests','grade_9',a));a.journey.interests_unsure=true
 assert.equal(validateJourneyStep('interests','grade_9',a),'')
 assert(validateJourneyStep('results','grade_9',a));a.results=[{subject_id:'subject-1',mark:60}]
 assert.equal(validateJourneyStep('results','grade_9',a),'')
 a.journey.application_progress="I've submitted applications"
 assert(validateJourneyStep('applications','grade_12',a))
 a.journey.applications=[{institution_id:'fixture',programme:'Computer Science',status:'Submitted'}]
 assert.equal(validateJourneyStep('applications','grade_12',a),'')
 a.journey.application_progress='Not yet';a.journey.applications=[]
 assert.equal(validateJourneyStep('applications','grade_12',a),'')
 a.journey.application_progress='Yes';assert(validateJourneyStep('applications','post_matric',a))
})
test('restore preserves valid journey history and rejects malformed form values',()=>{
 const j=normaliseJourney({interests:['Technology',42,'Technology'],starting_year:'2027',applications:[null,{}, {institution_id:'fixture',programme:'BSc',status:'Submitted'}]})
 assert.deepEqual(j.interests,['Technology']);assert.equal(j.starting_year,null);assert.equal(j.applications.length,1)
})
test('accepted and current students have relevant dashboard next steps without school-results prompts',()=>{
 for(const stage of ['accepted','tertiary']){
  const a=emptyAnswers();a.journey.support=['Funding']
  const view=deriveDashboard({profile:{education_stage:stage},record:{flow_version:4,completed_at:'saved',journey_answers:a},options,reports:[],matches:null,funding:null,saved:[],tasks:null})
  assert.equal(view.incomplete,false);assert.equal(view.banner,null);assert.notEqual(view.nextMove.feature,'scan');assert(!view.tasks.some(task=>task.id==='add-results'))
 }
})
