import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyAnswers, firstIncomplete, normaliseAnswers, resumeStep, toggleId, validateStep } from '../src/features/onboarding/services/model.ts'
const options = [
  ['current-1','current'],['interest-1','interest'],['personality-1','personality'],
  ['study_goal-1','study_goal'],['institution_type-1','institution_type'],['province-1','province'],['subject-1','subject'],
].map(([id,category]) => ({id,category,label:id,description:'',icon:'Compass',tone:'emerald',sort_order:0}))
test('new users have no invented selections, marks or report', () => {
  const answers = emptyAnswers()
  assert.equal(answers.current_id, '')
  assert.deepEqual(answers.interest_ids, [])
  assert.deepEqual(answers.personality_ids, [])
  assert.deepEqual(answers.goal_ids, [])
  assert.deepEqual(answers.results, [])
  assert.equal(answers.report_id, null)
  assert.equal(firstIncomplete(answers), 'current')
})
test('obsolete choices and unowned reports are removed safely on restore', () => {
  const result = normaliseAnswers({ current_id:'Other',interest_ids:['interest-1','Other','interest-1'],personality_ids:['Not sure yet'],goal_ids:['study_goal-1'],report_id:'foreign',results:[{subject_id:'subject-1',mark:64},{subject_id:'subject-1',mark:80},{subject_id:'subject-1',mark:101},{subject_id:'unknown',mark:50}] }, options, [])
  assert.equal(result.current_id,'')
  assert.deepEqual(result.interest_ids,['interest-1'])
  assert.deepEqual(result.personality_ids,[])
  assert.equal(result.report_id,null)
  assert.deepEqual(result.results,[{subject_id:'subject-1',mark:64}])
})
test('step validation uses real inputs and reports remain optional', () => {
  const answers=emptyAnswers()
  assert(validateStep('current',answers))
  assert.equal(validateStep('results',answers),'')
  assert(validateStep('study-plan',answers))
  answers.current_id='current-1';answers.interest_ids=['interest-1'];answers.personality_ids=['personality-1'];answers.goal_ids=['study_goal-1']
  assert.equal(firstIncomplete(answers),'preferences')
  assert(validateStep('preferences',answers))
  answers.institution_type_ids=['institution_type-1']
  assert.equal(validateStep('preferences',answers),'')
  answers.location_mode='provinces'
  assert(validateStep('preferences',answers))
  answers.province_ids=['province-1']
  assert.equal(validateStep('preferences',answers),'')
})
test('resume cannot skip missing required answers, including obsolete saved values', () => {
  const answers=emptyAnswers()
  assert.equal(resumeStep(null,answers),'current')
  assert.equal(resumeStep({current_step:'preferences'},answers),'current')
  answers.current_id='current-1'
  assert.equal(resumeStep({current_step:'results'},answers),'interests')
  assert.equal(resumeStep({current_step:'welcome'},answers),'current')
})
test('multi-select toggles without mutating saved answers', () => {
  const ids=['a']
  assert.deepEqual(toggleId(ids,'b'),['a','b'])
  assert.deepEqual(toggleId(ids,'a'),[])
  assert.deepEqual(ids,['a'])
})
