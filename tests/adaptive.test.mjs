import test from 'node:test'
import assert from 'node:assert/strict'
import { educationStages,legacyStages } from '../src/features/onboarding/config/education-stages.ts'
import { getFlow as versionedFlow } from '../src/features/onboarding/config/flows.ts'
const getFlow=(stage,version=3)=>versionedFlow(stage,version)
import { activeSteps,flowPosition,validResume } from '../src/features/onboarding/services/flow-engine.ts'
import { emptyAnswers } from '../src/features/onboarding/services/model.ts'
import { journeyStages } from '../src/features/journey/journey.ts'
import { deriveDashboard } from '../src/features/dashboard/services/dashboard-model.ts'
import { options } from './adaptive-fixture.mjs'
test('canonical stages retain accepted and graduate; ambiguous legacy grade is never guessed',()=>{
 assert.equal(educationStages.length,8);assert.equal(legacyStages['current-1'],undefined)
 assert.equal(legacyStages['current-2'],'grade_11');assert.equal(legacyStages['current-5'],'tertiary')
 assert.deepEqual(journeyStages.map(stage=>stage.id),['discover','choose','prepare','match','apply','fund','stay','study','graduate'])
})
test('Grade 9 navigation uses only its visible optional questions',()=>{
 const flow=getFlow('grade_9');const answers=emptyAnswers()
 assert.deepEqual(activeSteps(flow,answers).map(step=>step.id),['welcome','current','interests','personality','results','school-subjects','future-curiosity'])
 for(const id of ['interests','personality','results','school-subjects','future-curiosity']) assert.equal(flowPosition(flow,answers,id).optional,true)
 assert.equal(flowPosition(flow,answers,'results').previous,'personality')
 assert.equal(flowPosition(flow,answers,'results').next,'school-subjects')
 assert.equal(flowPosition(flow,answers,'future-curiosity').next,'building')
 assert.equal(flowPosition(flow,answers,'current').optional,false)
 assert.equal(flow.destination,'/dashboard?panel=subject-guide')
})
test('stage changes and conditional answers recalculate navigation and valid resume',()=>{
 const answers=emptyAnswers();const flow=getFlow('grade_9')
 assert.equal(validResume(flow,answers,{current_step:'preferences',answered_steps:['welcome','current','interests'],skipped_steps:['personality']}),'results')
 assert.equal(validResume(getFlow('grade_11'),answers,{current_step:'school-subjects',answered_steps:['welcome','current']}),'stage-pending')
 const conditional={...flow,steps:[{id:'welcome'},{id:'current'},{id:'results',optional:true,when:value=>value.interest_ids.length>0},{id:'school-subjects',optional:true}]}
 assert.equal(flowPosition(conditional,answers,'current').next,'school-subjects')
 answers.interest_ids=['fixture'];assert.equal(flowPosition(conditional,answers,'current').next,'results')
})
test('other new branches remain pending; existing v2 flow and completion remain supported',()=>{
 for(const stage of educationStages.filter(item=>item.value!=='grade_9')) assert.equal(getFlow(stage.value).implemented,false)
 assert.equal(getFlow('grade_11',2).implemented,true)
 assert.equal(validResume(getFlow('grade_9'),emptyAnswers(),{completed_at:'fixture'}),'ready')
 assert.deepEqual(activeSteps(getFlow(null),emptyAnswers()).map(step=>step.id),['welcome','current'])
})
test('Grade 9 prioritises subject planning with skipped results and excludes hidden legacy answers',()=>{
 const input={profile:{education_stage:'grade_9'},record:{flow_version:3,completed_at:'fixture',answers:{...emptyAnswers(),goal_ids:['study_goal-3'],preference_ids:['preference-1'],results:[{subject_id:'subject-1',mark:99}]}},options,reports:[],matches:null,funding:null,saved:null,tasks:null}
 let view=deriveDashboard(input)
 assert.equal(view.nextMove.feature,'subject-guide');assert.equal(view.nextMove.title,'Build your Grade 10 subject plan')
 assert.deepEqual(view.results,[]);assert.deepEqual(view.goals,[]);assert.equal(view.incomplete,false)
 input.activeAnswers={...emptyAnswers(),results:[{subject_id:'subject-1',mark:64}],interest_ids:['g9-interest-1']}
 input.record.skipped_steps=['results','interests'];view=deriveDashboard(input)
 assert.deepEqual(view.results,[]);assert.deepEqual(view.interests,[])
 assert.equal(input.activeAnswers.results[0].mark,64)
 input.record.skipped_steps=[];view=deriveDashboard(input);assert.equal(view.results[0].percentage,64)
 assert.equal(view.banner,null)
})
