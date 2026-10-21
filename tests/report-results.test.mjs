import test from 'node:test'
import assert from 'node:assert/strict'
import {parseReportResults,meetsBachelorAcademicMinimum} from '../src/features/discovery/services/report-results.ts'
const subjects=[
 {id:'math',label:'Mathematics'},{id:'lit',label:'Mathematical Literacy'},
 {id:'english',label:'English Home Language'},{id:'afrikaans',label:'Afrikaans First Additional Language'},
 {id:'science',label:'Physical Sciences'},{id:'life',label:'Life Sciences'},
 {id:'geo',label:'Geography'},{id:'lo',label:'Life Orientation'},
]
test('detects Grades 9–12 and asks for clarification when grade evidence is missing or conflicting',()=>{
 for(const grade of [9,10,11,12])assert.equal(parseReportResults('Grade '+grade+'\nMathematics 75%',subjects).grade,grade)
 for(const header of ['Results','Grade 11/12','Grade 9 or 10','Grade 11\nGrade 12'])assert.equal(parseReportResults(header+'\nMathematics 75%',subjects).grade,null)
})
test('extracts actual subjects, percentages, decimal marks and grade from report text',()=>{
 const result=parseReportResults('Grade 11\nSubject Mark (%)\nMathematics 75%\nEnglish HL 70%\nPhysical Science 72.5%\nLife Orientation 80%',subjects)
 assert.equal(result.grade,11);assert.equal(result.needsReview,false)
 assert.deepEqual(result.results,[{subject_id:'math',mark:'75'},{subject_id:'english',mark:'70'},{subject_id:'science',mark:'72.5'},{subject_id:'lo',mark:'80'}])
})
test('does not invent marks from term columns, invalid values, levels, or conflicting pages',()=>{
 for(const text of ['Mathematics 65% 78%','Mathematics 75 6','Mathematics Level 6','Mathematics 101%','Mathematics 75%\nMathematics 76%']){
  const parsed=parseReportResults(text,subjects);assert.equal(parsed.results[0]?.mark,'',text);assert.equal(parsed.needsReview,true,text)
 }
 assert.equal(parseReportResults('English 70%',subjects).results.length,0,'ambiguous English level must not be guessed')
 assert.deepEqual(parseReportResults('Mathematical Literacy 70%',subjects).results,[{subject_id:'lit',mark:'70'}])
 assert.deepEqual(parseReportResults('Subject Mark\nGeography 0',subjects).results,[{subject_id:'geo',mark:'0'}])
})
test('grade choice does not automatically assert a bachelor pass; require a complete strong subject set',()=>{
 const results=[['math',75],['english',70],['afrikaans',65],['science',75],['life',75],['geo',75],['lo',90]].map(([subject_id,mark])=>({subject_id,mark}))
 assert.equal(meetsBachelorAcademicMinimum(results,subjects),true)
 assert.equal(meetsBachelorAcademicMinimum(results.slice(0,6),subjects),false)
 assert.equal(meetsBachelorAcademicMinimum(results.map(r=>r.subject_id==='afrikaans'?{...r,subject_id:'lit'}:r),subjects),false,'a missing second language cannot establish the NSC academic threshold')
 assert.equal(meetsBachelorAcademicMinimum(results.map(r=>r.subject_id==='english'?{...r,mark:39}:r),subjects),false)
 assert.equal(meetsBachelorAcademicMinimum(results.map(r=>({...r,mark:r.subject_id==='lo'?100:49})),subjects),false)
})
