import test from 'node:test'
import assert from 'node:assert/strict'
import { groupProgrammes, programmeSearch, programmeApplicationUrl, offeringDestination } from '../src/features/discovery/services/programme-model.ts'

const offering = (id, institution, values={}) => ({
  id, kind:'programmes', title:'BSc Computer Science', qualification:'Bachelor', duration:'3 years',
  field:'Technology', career_keywords:['software development'], institution_id:institution, institution_name:`Institution ${institution}`,
  location:'Pretoria', province:'Gauteng', campus:null, minimum_aps:30, mathematics_required:true,
  requirements:[{id:`r-${id}`,subject:'Mathematics',minimum_percentage:60}],cycles:[],is_demo:false,
  website_url:'https://institution.example/programmes/computer-science',source_url:null,application_url:'https://institution.example/apply',
  ...values,
})

test('groups equivalent names across institutions without combining qualifications, specialisations or demo records',()=>{
  const rows=[offering('a','one'),offering('b','two',{title:'Bachelor of Science in Computer Science',duration:'4 years',minimum_aps:35,requirements:[{id:'r-b',subject:'English',minimum_percentage:70}]}),offering('c','three',{title:'BSc — Computer Science major',duration:null}),offering('d','four',{title:'Diploma in Computer Science',qualification:'Diploma'}),offering('e','five',{title:'BSc Mathematical Sciences (Mathematics and Computer Science)'}),offering('f','six',{is_demo:true})]
  const groups=groupProgrammes(rows)
  assert.equal(groups.length,4)
  const group=groups.find(item=>item.id==='a').programme_group
  assert.equal(group.name,'Computer Science');assert.equal(group.institution_count,3);assert.equal(group.duration,'3–4 years')
  assert.equal(group.offerings.find(item=>item.id==='b').minimum_aps,35)
  assert.equal(group.offerings.find(item=>item.id==='b').requirements[0].minimum_percentage,70)
  assert.equal(group.offerings.find(item=>item.id==='a').requirements[0].minimum_percentage,60)
  assert.equal(rows[0].title,'BSc Computer Science','source records remain intact')
  assert.equal(groupProgrammes([offering('business','seven',{title:'BBusSc specialising in Computer Science'})])[0].title,'BBusSc specialising in Computer Science')
})

test('institution count is unique and grouping completes before pagination and offering filters',()=>{
  const rows=Array.from({length:30},(_,index)=>offering(`x-${index}`,`i-${index}`))
  rows.push(offering('duplicate-campus','i-0',{campus:'Second Campus'}))
  const result=programmeSearch(rows,'Computer Science',{institution:'i-29'},1)
  assert.equal(result.total,1);assert.equal(result.items.length,1)
  assert.equal(result.items[0].programme_group.institution_count,30)
  assert.equal(result.items[0].programme_group.offerings.length,31)
  assert.equal(programmeSearch(rows,'unrelated',{},1).total,0)
  assert.equal(programmeSearch(rows,'',{aps_min:'31'},1).total,0)
})

test('missing fields are not replaced with invented durations, careers or programme URLs',()=>{
  const item=offering('a','one',{duration:null,career_keywords:[],website_url:'https://institution.example/',source_url:null})
  const group=groupProgrammes([item])[0].programme_group
  assert.equal(group.duration,'Duration not listed');assert.deepEqual(group.careers,[])
  assert.equal(programmeApplicationUrl(item),'https://institution.example/apply')
  assert.equal(programmeApplicationUrl({...item,application_url:'https://applications.institution.example/'}),'https://applications.institution.example/')
  assert.equal(programmeApplicationUrl({...item,application_url:null,source_url:'https://institution.example/courses/cs.pdf'}),null)
  assert.equal(programmeApplicationUrl({...item,application_url:'javascript:alert(1)'}),null)
  assert.equal(programmeApplicationUrl({...item,is_demo:true,application_url:null}),null)
})

test('funding uses the specific offering and institution; accommodation uses institution and campus only',()=>{
  const item=offering('offering-1','institution-1',{campus:'Hatfield Campus'})
  const funding=new URL(offeringDestination('bursaries',item),'https://via.invalid')
  assert.equal(funding.searchParams.get('programme'),'offering-1');assert.equal(funding.searchParams.get('institution'),'institution-1')
  const accommodation=new URL(offeringDestination('accommodation',item),'https://via.invalid')
  assert.equal(accommodation.searchParams.get('institution'),'institution-1');assert.equal(accommodation.searchParams.get('campus'),'Hatfield Campus');assert.equal(accommodation.searchParams.has('programme'),false)
  assert.equal(new URL(offeringDestination('accommodation',{...item,campus:null}),'https://via.invalid').searchParams.has('campus'),false)
})
