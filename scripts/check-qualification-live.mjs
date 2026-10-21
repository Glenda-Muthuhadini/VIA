// Anonymous read-only integration checks. No accounts or saved results modified.
import assert from 'node:assert/strict'
import {loadEnv} from 'vite'
import {createClient} from '@supabase/supabase-js'
const env={...loadEnv('development',process.cwd(),'VITE_'),...process.env}
const db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
for(const kind of ['institutions','programmes','bursaries','accommodation']){
 const {data,error}=await db.rpc('search_public_opportunities',{p_kind:kind,p_page_size:24})
 if(error)throw new Error(`Public ${kind}: ${error.message}`)
 assert.equal(data.total,10,`Apply v5: expected ten ${kind}`);assert.equal(data.items.length,10)
 assert(data.items.every(r=>r.source_url&&r.source_name&&r.last_verified_at));console.log(`PASS: ten real ${kind} loaded anonymously from Supabase`)
}
const good=[['subject-1',75],['subject-3',70],['subject-7',75],['subject-17',75],['subject-18',75],['subject-22',75],['subject-16',100]].map(([subject_id,mark])=>({subject_id,mark}))
async function check(results,nsc=true,bachelor=true,year=2027){const {data,error}=await db.rpc('check_public_qualification',{p_results:results,p_nsc:nsc,p_bachelor_pass:bachelor,p_year:year});if(error)throw new Error(error.message);return data}
let r=await check(good);assert.equal(r.groups.meets.total,4);assert(r.groups.meets.items.every(i=>i.learner_aps===36));assert.equal(r.groups.unverified.total,6)
r=await check(good.map((s,i)=>i===0?{...s,mark:66}:s));assert.equal(r.groups.meets.total,0);assert.equal(r.groups.close.total,4)
assert.equal((await check(good,false)).groups.meets.total,0);assert.equal((await check(good,true,false)).groups.meets.total,0);assert.equal((await check(good,true,true,2026)).groups.meets.total,0)
const bad=await db.rpc('check_public_qualification',{p_results:[{subject_id:'subject-1',mark:101}],p_nsc:true,p_bachelor_pass:true});assert.equal(bad.error?.code,'22023')
console.log('PASS: real Supabase APS, mandatory subject failure, conservative unknowns, intake/endorsement checks and invalid input rejection')
