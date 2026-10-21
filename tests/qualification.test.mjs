import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {confirmedResults} from '../src/features/discovery/services/qualification-input.ts'
const records=JSON.parse(fs.readFileSync('supabase/catalogue/public_catalogue_v5.json','utf8'))
test('exactly 40 unique, source-backed database records preserve existing public IDs',()=>{
 assert.equal(records.length,40);assert.equal(new Set(records.map(r=>r.id)).size,40)
 for(const kind of ['institutions','programmes','bursaries','accommodation'])assert.equal(records.filter(r=>r.kind===kind).length,10)
 for(const r of records){assert(r.source_name);assert(Number.isFinite(Date.parse(r.last_verified_at)));assert(r.source_url.startsWith('https://'));if(r.application_url)assert(r.application_url.startsWith('https://'))}
 for(const group of Object.values(JSON.parse(fs.readFileSync('tests/fixtures/discovery.json','utf8'))))for(const old of group.items)assert(records.some(r=>r.id===old.id))
 for(const r of records.filter(r=>r.kind==='programmes'))assert(records.some(i=>i.kind==='institutions'&&i.id===r.institution_id))
})
test('supported rules have verified subject thresholds, intake years and institution-specific APS; no fabricated accreditation',()=>{
 const supported=records.filter(r=>r.admission_rule?.requirements_complete);assert.equal(supported.length,4)
 for(const r of supported){assert.equal(r.institution_name,'University of Johannesburg');assert.equal(r.admission_rule.scoring_system,'uj_nsc_six_v1');assert.equal(r.admission_rule.academic_year,2027);assert.equal(r.admission_rule.minimum_aps,r.minimum_aps);assert(r.admission_rule.subject_rules.some(s=>s.subject_ids.includes('subject-1')&&s.minimum_percentage===70));assert(r.admission_rule.subject_rules.some(s=>s.subject_ids.includes('subject-3')&&s.minimum_percentage===60));assert.equal(r.admission_rule.requires_bachelor_pass,true)}
 for(const r of records.filter(r=>r.kind==='accommodation')){assert.equal(r.nsfas_compatible,null);if(r.starting_price!==null)assert.equal(r.academic_year,2026)}
})
test('blank, duplicate, non-finite and out-of-range marks never become confirmed results',()=>{
 for(const mark of ['',' ','NaN','Infinity','-1','101'])assert.throws(()=>confirmedResults([{subject_id:'subject-1',mark}]))
 assert.throws(()=>confirmedResults([{subject_id:'',mark:'50'}]));assert.throws(()=>confirmedResults([]));assert.throws(()=>confirmedResults([{subject_id:'subject-1',mark:'50'},{subject_id:'subject-1',mark:'80'}]))
 assert.deepEqual(confirmedResults([{subject_id:'subject-1',mark:'0'},{subject_id:'subject-3',mark:'100'}]),[{subject_id:'subject-1',mark:0},{subject_id:'subject-3',mark:100}])
})
