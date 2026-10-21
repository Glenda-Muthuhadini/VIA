import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyAnswers, normaliseAnswers } from '../src/features/onboarding/services/model.ts'
import { getFlow } from '../src/features/onboarding/config/flows.ts'
import { flowPosition } from '../src/features/onboarding/services/flow-engine.ts'
import { grade9DraftError, validateGrade9Step, reportMetadata, grade9Electives } from '../src/features/onboarding/services/grade9-model.ts'
const options=[{id:'math',category:'subject',label:'Mathematics'},{id:'science9',category:'subject',label:'Natural Sciences',education_stages:['grade_9']},{id:'physics',category:'subject',label:'Physical Sciences',education_stages:['grade_10']},{id:'english',category:'subject',label:'English Home Language'},{id:'lo',category:'subject',label:'Life Orientation'}]
const validDraft=()=>({report_id:null,school_name:'My School',academic_year:'2026',report_period:'term_3',detected_grade:9,grade_corrected:false,rows:[{subject_id:'math',mark:'72'}]})
test('Grade 9 conditional steps do not alter any other branch',()=>{
 const a=emptyAnswers(),flow=getFlow('grade_9')
 assert.equal(flowPosition(flow,a,'current').next,'school-details')
 assert.equal(flowPosition(flow,a,'subject-choice').next,'future-interests')
 a.grade9.subject_choice_status='I have some ideas'
 assert.equal(flowPosition(flow,a,'subject-choice').next,'subjects-considering')
 assert.equal(flowPosition(flow,a,'future-interests').previous,'subjects-considering')
 assert.deepEqual(getFlow('grade_10').steps.map(s=>s.id),['welcome','current','school-subjects','results','interests','career-interests'])
 assert.deepEqual(getFlow('accepted').steps.map(s=>s.id),['welcome','current','institution','enrolled-programme','campus','starting-year','funding','accommodation-status','registration'])
})
test('drafts and possible electives are separate from academic subjects and marks',()=>{
 const a=emptyAnswers();a.grade9.results_draft=validDraft();a.grade9.subjects_considering=['physics'];a.grade9.subject_choice_status='I have some ideas'
 const restored=normaliseAnswers(a,options,[])
 assert.deepEqual(restored.results,[]);assert.deepEqual(restored.school_subject_ids,[])
 assert.equal(restored.grade9.results_draft.rows[0].mark,'72')
 assert.deepEqual(restored.grade9.subjects_considering,['physics'])
 assert(validateGrade9Step('confirm-results',restored))
})
test('confirmation validates metadata, zero marks, duplicate subjects and detected grade conflicts',()=>{
 const d=validDraft();assert.equal(grade9DraftError(d,options),'')
 d.rows[0].mark='0';assert.equal(grade9DraftError(d,options),'')
 d.rows[0].mark='101';assert(grade9DraftError(d,options));d.rows[0].mark='72'
 d.rows.push({...d.rows[0]});assert.match(grade9DraftError(d,options),/once/);d.rows.pop()
 d.detected_grade=10;assert.match(grade9DraftError(d,options),/another grade/);d.grade_corrected=true;assert.equal(grade9DraftError(d,options),'')
 d.academic_year='';assert.match(grade9DraftError(d,options),/year/)
})
test('subject experience and explicit uncertainty satisfy only their own questions',()=>{
 const a=emptyAnswers();a.results=[{subject_id:'math',mark:72}];a.grade9.results_confirmed=true
 assert(validateGrade9Step('subject-experience',a));a.grade9.subject_experience.math='I enjoy it';assert.equal(validateGrade9Step('subject-experience',a),'')
 a.journey.interests_unsure=true;assert.equal(validateGrade9Step('interests',a),'')
 a.grade9.subject_choice_status='I need help choosing';assert.equal(validateGrade9Step('subjects-considering',a),'')
 a.grade9.future_clarity='Not yet — I want to explore';assert.equal(validateGrade9Step('future-interests',a),'')
 a.grade9.future_clarity='Yes, I have some ideas';assert(validateGrade9Step('future-interests',a));a.grade9.future_unsure=true;assert.equal(validateGrade9Step('future-interests',a),'')
})
test('metadata extraction uses actual text, leaving ambiguous or missing fields blank',()=>{
 assert.deepEqual(reportMetadata('School: VIA Test School\nGrade 9\nAcademic year: 2026\nTerm 3\nMathematics 72%'),{school_name:'VIA Test School',academic_year:'2026',report_period:'term_3'})
 assert.equal(reportMetadata('2025 2026 Term 1 Term 2').academic_year,'')
 assert.equal(reportMetadata('2025 2026 Term 1 Term 2').report_period,'')
 assert.equal(reportMetadata('School report').school_name,'')
 assert.equal(reportMetadata('2026 Final report').report_period,'final')
})
test('Grade 10 consideration list excludes current Grade 9-only subjects and compulsory language/LO entries',()=>{
 assert.deepEqual(grade9Electives(options).map(o=>o.id),['math','physics'])
})
