import test from 'node:test'
import assert from 'node:assert/strict'
import { grade9Planning, grade9ResultsKey } from '../src/features/dashboard/services/grade9-planning-model.ts'
import { emptyAnswers } from '../src/features/onboarding/services/model.ts'
import { options } from './onboarding-fixture.mjs'

function learner() {
  const answers=emptyAnswers()
  answers.report_grade=9;answers.report_type='term_2';answers.academic_year=2026
  answers.results=[{subject_id:'subject-1',mark:64}]
  answers.journey.interests=['Technology']
  return {options,reports:[],activeAnswers:answers,profile:{education_stage:'grade_9'},record:{flow_version:4,completed_at:'2026-10-21',answered_steps:[],skipped_steps:[]},saved:null,tasks:null,matches:null,funding:null}
}
const emptyPlan=()=>({shortlisted_subject_ids:[],explored_subject_ids:[],explored_pathway_ids:[],maths_reviewed:false,reviewed_results:false,reviewed_results_key:'',plan_reviewed:false})

test('planning starts from actual results and interests, with one next useful action',()=>{
  const data=learner(),result=grade9Planning(data,emptyPlan())
  assert.equal(result.percentage,25)
  assert.equal(result.next.id,'strengths')
  assert.equal(result.steps.length,8)
  assert.equal(grade9Planning(data,null).percentage,null)
})

test('only saved planning actions advance readiness; merely opening pages cannot do so',()=>{
  const data=learner(),plan=emptyPlan()
  assert.equal(grade9Planning(data,plan).completed,2)
  Object.assign(plan,{reviewed_results:true,reviewed_results_key:grade9ResultsKey(data),maths_reviewed:true,explored_subject_ids:['subject-17'],explored_pathway_ids:['technology'],shortlisted_subject_ids:['subject-17'],plan_reviewed:true})
  assert.equal(grade9Planning(data,plan).percentage,100)
  assert.equal(grade9Planning(data,plan).next.to,'/dashboard/subject-choices#my-plan')
  plan.shortlisted_subject_ids=[]
  assert.equal(grade9Planning(data,plan).steps.find(step=>step.id==='review').done,false)
})

test('new or corrected results invalidate an older academic review',()=>{
  const data=learner(),plan={...emptyPlan(),reviewed_results:true,reviewed_results_key:grade9ResultsKey(data)}
  assert.equal(grade9Planning(data,plan).steps[1].done,true)
  data.activeAnswers.results[0].mark=65
  assert.equal(grade9Planning(data,plan).steps[1].done,false)
  data.activeAnswers.results=[]
  assert.equal(grade9Planning(data,plan).next.id,'results')
})

test('explicit interest uncertainty counts as an answered question without inventing a career',()=>{
  const data=learner()
  data.activeAnswers.journey.interests=[]
  data.activeAnswers.journey.interests_unsure=true
  assert.equal(grade9Planning(data,emptyPlan()).steps.find(step=>step.id==='interests').done,true)
  assert.deepEqual(data.activeAnswers.journey.careers,[])
})
