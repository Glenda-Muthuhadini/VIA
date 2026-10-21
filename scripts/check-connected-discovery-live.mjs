// Read-only anonymous checks against the configured Supabase project.
import assert from 'node:assert/strict'
import {loadEnv} from 'vite'
import {createClient} from '@supabase/supabase-js'
const env={...loadEnv('development',process.cwd(),'VITE_'),...process.env}
const db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw Error(name+': '+error.message);return data}
const catalogue={}
for(const [kind,count] of Object.entries({institutions:10,programmes:21,bursaries:10,accommodation:17})){
 const page=await rpc('search_public_opportunities',{p_kind:kind,p_page_size:24})
 assert(page.total>=count);catalogue[kind]=page.items
 assert(page.items.every(item=>item.source_url&&item.source_name&&item.last_verified_at))
 console.log('PASS: anonymous '+kind+' ('+page.total+')')
}
for(const institution of catalogue.institutions)assert(catalogue.programmes.some(p=>p.institution_id===institution.id),'Institution has no programme: '+institution.title)
for(const programme of catalogue.programmes){
 assert(catalogue.institutions.some(i=>i.id===programme.institution_id));assert(programme.requirements.length);assert(programme.cycles.length)
 const related=await rpc('related_public_opportunities',{p_id:programme.id})
 assert.equal(related.institutions[0].id,programme.institution_id);assert(related.funding.length)
}
for(const funding of catalogue.bursaries){const related=await rpc('related_public_opportunities',{p_id:funding.id});assert(related.programmes.length)}
assert.equal(catalogue.programmes.find(p=>p.id.endsWith('000019')).source_url,'https://devwww.tut.ac.za/media/tshwane-interim/site-content/documents/First-Year-Course_Information.pdf')
assert.equal(catalogue.accommodation.find(p=>p.id.endsWith('000016')).website_url,'https://www.tut.ac.za/accommodation/')
console.log('PASS: v8 TUT official link correction is live')
const good=[['subject-1',75],['subject-3',70],['subject-6',65],['subject-17',75],['subject-18',75],['subject-22',75],['subject-16',90]].map(([subject_id,mark])=>({subject_id,mark}))
const lit=[['subject-2',60],['subject-3',45],['subject-7',55],['subject-19',55],['subject-20',50],['subject-22',50],['subject-16',70]].map(([subject_id,mark])=>({subject_id,mark}))
async function check(results,grade){return rpc('check_connected_qualification',{p_results:results,p_grade:grade})}
let r=await check(good,12);assert.equal(r.score.value,35);assert.equal(r.exact.items.length,5);assert(r.exact.items.every(i=>i.checks.every(c=>c.status==='met')))
r=await check(good.map((s,i)=>i? s:{...s,mark:66}),11);assert.equal(r.score.value,34);assert(r.exact.items.every(i=>!['007','008','009','010'].some(end=>i.programme.id.endsWith(end))))
r=await check(lit,12);assert.equal(r.score.value,24);assert.equal(r.exact.items.length,3);assert.equal(r.close.items.length,2);assert(r.close.items.every(i=>i.missing.some(c=>c.label==='English'&&c.minimum===50&&c.actual===45)))
for(const grade of [9,10]){r=await check(grade===9?[{subject_id:'subject-1',mark:72},{subject_id:'subject-3',mark:65},{subject_id:'subject-g9-natural-sciences',mark:75}]:good,grade);assert.equal(r.mode,'pathways');assert.equal(r.score,null);assert.equal(r.exact.total,0);assert(r.pathways.length>=3)}
const bad=await db.rpc('check_connected_qualification',{p_results:[{subject_id:'subject-1',mark:101}],p_grade:12});assert.equal(bad.error?.code,'22023')
console.log('PASS: every institution/programme/funding connected; Grade 9/10 pathways, Grade 11/12 APS, mandatory marks, exact/close ranking and invalid-input rejection')
