import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyAnswers } from '../src/features/onboarding/services/model.ts'
import { buildGrade10Guidance, compareSubjectRequirement, grade10Insight, subjectName, interestConnection } from '../src/features/dashboard/services/grade10-guidance.ts'

const labels=['Mathematics','Physical Sciences','Life Sciences','Geography','English','Afrikaans','Life Orientation','Mathematical Literacy','English Home Language','English First Additional Language']
const options=labels.map((label,id)=>({id:'s'+id,label,category:'subject'}))
const requirement=(subject,minimum_percentage,changes={})=>({id:subject,subject,minimum_percentage,recommended:false,detail:'Stored requirement',is_demo:false,...changes})
const programme=(id,title,requirements,changes={})=>({id,kind:'programmes',title,qualification:'Bachelor',duration:'3 years',field:'Technology',career_keywords:['Software Developer'],institution_id:'i'+id,institution_name:'Institution '+id,requirements,is_demo:false,...changes})
function fixture(marks=[72,65,71,62,68,59,75]) {
 const answers=emptyAnswers();answers.school_subject_ids=options.slice(0,7).map(o=>o.id);answers.report_grade=10;answers.results=marks.map((mark,i)=>({subject_id:'s'+i,mark}));answers.journey.interests=['Technology'];answers.journey.careers=['Software Developer']
 return {profile:{education_stage:'grade_10'},activeAnswers:answers,record:{flow_version:4,completed_at:'2026-10-21'},options,reports:[],matches:null,funding:null,saved:[],tasks:null}
}
test('real selected subjects open four exploratory pathways without calculating eligibility',()=>{
 const model=buildGrade10Guidance(fixture(),[])
 assert.deepEqual(model.pathways.map(p=>p.id),['engineering','technology','science','health'])
 assert.equal(model.subjects[0].mark,72)
 assert.equal(model.groups.length,0)
 assert.deepEqual([75,65,59,45].map(grade10Insight),['Strong','Doing well','Keep working','Needs attention'])
})
test('Mathematical Literacy is distinct from Mathematics; aliases and language levels are conservative',()=>{
 assert.equal(subjectName('Maths'),'mathematics')
 const subjects=[{id:'m',label:'Mathematical Literacy',mark:90},{id:'e',label:'English FAL',mark:70}]
 assert.equal(compareSubjectRequirement(requirement('Mathematics',60),subjects).status,'not_taken')
 assert.equal(compareSubjectRequirement(requirement('Mathematics or Mathematical Literacy',60),subjects).status,'on_track')
 assert.equal(compareSubjectRequirement(requirement('English',50),subjects).status,'on_track')
 assert.equal(compareSubjectRequirement(requirement('English Home Language',60),subjects).status,'not_taken')
 assert.equal(compareSubjectRequirement(requirement('English Home Language or First Additional Language',60),subjects).status,'on_track')
})
test('comparison preserves missing marks, unknown thresholds, recommended subjects and zero marks',()=>{
 const subjects=[{id:'m',label:'Mathematics',mark:null}]
 assert.equal(compareSubjectRequirement(requirement('Mathematics',60),subjects).status,'unknown')
 subjects[0].mark=0
 assert.equal(compareSubjectRequirement(requirement('Mathematics',60),subjects).status,'improve')
 assert.equal(compareSubjectRequirement(requirement('Mathematics',null),subjects).status,'unknown')
 assert.equal(compareSubjectRequirement(requirement('Mathematics',101),subjects).minimum,null)
 assert.equal(compareSubjectRequirement(requirement('Mathematics',60,{recommended:true}),subjects).status,'recommended')
})
test('improvement targets belong to exact real offering and exclude demo/recommended requirements',()=>{
 const a=programme('a','BSc Computer Science',[requirement('Mathematics',60),requirement('English',50)])
 const b=programme('b','BSc Computer Science',[requirement('Mathematics',75),requirement('Physical Sciences',70,{recommended:true}),requirement('English',90,{is_demo:true})])
 const demo=programme('c','Civil Engineering',[requirement('Physical Sciences',99)],{is_demo:true})
 const model=buildGrade10Guidance(fixture([58,54,71,62,68,59,75]),[a,b,demo])
 assert.equal(model.groups.length,1)
 assert.equal(model.groups[0].programme_group.offerings.length,2)
 assert.equal(model.improvements.length,1)
 assert.equal(model.improvements[0].minimum,60)
 assert.equal(model.improvements[0].offering.id,'a')
 assert.equal(compareSubjectRequirement(b.requirements[0],model.subjects).minimum,75)
 assert.equal(compareSubjectRequirement(b.requirements[0],model.subjects).status,'improve')
})
test('previous-grade results never become current Grade 10 marks or targets',()=>{
 const data=fixture();data.activeAnswers.report_grade=9
 const model=buildGrade10Guidance(data,[programme('a','BSc Computer Science',[requirement('Mathematics',80)])])
 assert.equal(model.currentResults.length,0)
 assert(model.subjects.every(s=>s.mark===null))
 assert.equal(model.improvements.length,0)
 assert.equal(model.view.results[0].percentage,72)
})
test('programme suggestions prioritise interests without admitting learners or inventing programmes',()=>{
 const items=[programme('b','BCom Accounting',[requirement('Mathematics',60)],{field:'Commerce',career_keywords:['Accountant']}),programme('a','BSc Computer Science',[requirement('Mathematics',80)])]
 const model=buildGrade10Guidance(fixture(),items)
 assert.equal(model.suggested[0].item.title,'Computer Science')
 assert.equal(model.suggested[0].interests,true)
 assert.equal(model.improvements[0].minimum,80)
 const empty=fixture([]);empty.activeAnswers.school_subject_ids=[]
 assert.equal(buildGrade10Guidance(empty,items).suggested.length,0)
 assert.equal(buildGrade10Guidance(fixture(),[programme('a','BSc Computer Science',[])]).suggested.length,0)
})
test('software engineering interest is not treated as civil engineering interest',()=>{
 assert.equal(interestConnection(programme('a','BEng Civil Engineering',[],{field:'Engineering',career_keywords:['Civil Engineer']}),['Software Engineer']),false)
 assert.equal(interestConnection(programme('b','BSc Computer Science',[]),['Software Engineer']),true)
})
