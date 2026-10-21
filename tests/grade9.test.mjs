import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGrade9Guidance } from '../src/features/dashboard/services/grade9-guidance.ts'

const result = (subject, percentage) => ({subject, percentage, subjectId:subject, insight:'Strong'})
const offering = (subject, changes={}) => ({title:'Computer Science',field:'Technology',institution_name:'Example University',requirements:[{subject,recommended:false,source_url:'https://example.edu/requirements'}],is_demo:false, ...changes})
test('medicine interest combines future subjects with current mathematics and science results',()=>{
 const suggestions=buildGrade9Guidance([result('Mathematics',78),result('Natural Sciences',71)],['Medicine'],[])
 assert.deepEqual(suggestions.map(s=>s.subject),['Mathematics','Physical Sciences','Life Sciences'])
 assert.match(suggestions[0].reasons[0],/Health/)
 assert.match(suggestions[0].foundation,/78%/)
 assert.match(suggestions[1].foundation,/Natural Sciences: 71%/)
 assert(suggestions.every(s=>s.sources.length>0))
})
test('marks alone do not choose a career or recommend a subject combination',()=>{
 assert.deepEqual(buildGrade9Guidance([result('Mathematics',99)],[],[offering('Mathematics')]),[])
})
test('weaker foundations invite support rather than closing a pathway',()=>{
 const suggestions=buildGrade9Guidance([result('Mathematics',42)],['Engineering'],[])
 assert(suggestions.some(s=>s.subject==='Physical Sciences'))
 assert.match(suggestions.find(s=>s.subject==='Mathematics').foundation,/support/)
})
test('requirements are tied to relevant non-demo programme offerings, with alternatives intact',()=>{
 const suggestions=buildGrade9Guidance([],['Technology'],[offering('English'),offering('Mathematics or Mathematical Literacy'),offering('Fake subject',{is_demo:true}),offering('Fake requirement',{requirements:[{subject:'Fake requirement',is_demo:true}]})])
 assert(suggestions.some(s=>s.subject==='English'&&s.reasons[0].includes('Example University')))
 assert(suggestions.some(s=>s.subject==='Mathematics or Mathematical Literacy'))
 assert(!suggestions.some(s=>s.subject.startsWith('Fake')))
 assert(suggestions.some(s=>s.subject==='Computer Applications Technology'&&s.reasons[0].includes('not a general')))
 assert(suggestions.every(s=>s.foundation===null))
})
test('mathematical literacy marks are not presented as mathematics strength',()=>{
 assert.equal(buildGrade9Guidance([result('Mathematical Literacy',90)],['Engineering'],[])[0].foundation,null)
})
test('software engineering does not inherit civil engineering science requirements',()=>{
 const suggestions=buildGrade9Guidance([],['Software Engineer'],[])
 assert(suggestions.some(s=>s.subject==='Mathematics'))
 assert(!suggestions.some(s=>s.subject==='Physical Sciences'))
 assert(buildGrade9Guidance([],['Software Engineer','Civil Engineering'],[]).some(s=>s.subject==='Physical Sciences'))
})
test('interests outside editorial examples use relevant catalogue requirements',()=>{
 const suggestions=buildGrade9Guidance([],['Law'],[offering('English',{title:'Bachelor of Laws',field:'Law'})])
 assert.deepEqual(suggestions.map(s=>s.subject),['English'])
 assert.match(suggestions[0].reasons[0],/Bachelor of Laws/)
})
