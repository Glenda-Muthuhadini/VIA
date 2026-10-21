import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveDashboard, getGrade, gradePriorities, academicInsight } from '../src/features/dashboard/services/dashboard-model.ts'
import { options, fullAnswers } from './onboarding-fixture.mjs'

function snapshot(changes={}) {
  return {profile:{education_stage:'grade_12'},record:{user_id:'fixture',answers:fullAnswers(),current_step:'ready',revision:1,completed_at:'2026-10-16T08:00:00Z'},options,reports:[],matches:null,funding:null,saved:null,tasks:null,...changes}
}
test('uses actual learner grade, study interest and marks without generated opportunities',()=>{
  const view=deriveDashboard(snapshot())
  assert.equal(view.stage,'Grade 12')
  assert.equal(view.grade,'12')
  assert.deepEqual(view.goals,['Data Science'])
  assert.equal(view.results[0].percentage,64)
  assert.equal(view.matches,null)
  assert.equal(view.banner,null)
  assert.equal(view.nextMove.feature,'applications')
  assert(view.tasks.every(task=>task.dueAt===null))
})
test('incomplete, missing-results and complete profiles have distinct banners',()=>{
  assert(deriveDashboard(snapshot({record:null})).banner.text.includes('Finish'))
  const data=snapshot();data.record.answers.results=[]
  const view=deriveDashboard(data)
  assert.equal(view.incomplete,false)
  assert(view.banner.text.includes('Upload your latest results'))
  assert.equal(view.nextMove.feature,'scan')
  assert.equal(view.results.length,0)
  assert.equal(deriveDashboard(snapshot()).banner,null)
})
test('a Grade 11 focus area proposes a scenario without inventing a saved target',()=>{
  const data=snapshot();data.profile.education_stage='grade_11';data.record.answers.current_id='current-2';data.record.answers.results[0].mark=45
  const original=JSON.stringify(data.record.answers)
  const view=deriveDashboard(data)
  assert.equal(view.nextMove.feature,'whatif')
  assert.equal(view.nextMove.subjectId,'subject-1')
  assert(view.nextMove.title.includes('45%'))
  assert.equal(JSON.stringify(data.record.answers),original)
  assert.equal(academicInsight(45),'Focus area')
  assert.equal(academicInsight(64),'On track')
  assert.equal(academicInsight(72),'Strong')
})
test('supports separate grade priorities without guessing from Grade 9–10',()=>{
  assert.equal(getGrade(null),'other')
  assert.equal(getGrade(null),'other')
  assert.equal(getGrade('grade_9'),'9')
  assert.equal(getGrade('grade_10'),'10')
  assert.equal(getGrade('grade_11'),'11')
  assert.equal(getGrade('grade_12'),'12')
  assert.equal(getGrade('post_matric'),'other')
  assert.equal(gradePriorities['9'].priority,'subjects')
  assert.equal(gradePriorities['10'].priority,'trajectory')
  assert.equal(gradePriorities['12'].priority,'applications')
})
test('only accepts available calculated match scores, sorted highest first',()=>{
  const matches=[{id:'a',programme:'A',institution:'I',percentage:80,reason:'Verified fixture'},{id:'b',programme:'B',institution:'I',percentage:95,reason:'Verified fixture'},{id:'bad',programme:'C',institution:'I',percentage:101,reason:'Invalid'}]
  const view=deriveDashboard(snapshot({matches}))
  assert.deepEqual(view.matches.map(match=>match.id),['b','a'])
  assert.equal(matches[0].id,'a')
})
test('retired selections do not produce a false completed profile or guessed grade',()=>{
  const data=snapshot();data.profile.education_stage=null;data.record.answers.current_id='Other';data.record.answers.results[0].mark=999
  const view=deriveDashboard(data)
  assert.equal(view.stage,'')
  assert.equal(view.grade,'other')
  assert.equal(view.results.length,0)
  assert.equal(view.incomplete,true)
})
