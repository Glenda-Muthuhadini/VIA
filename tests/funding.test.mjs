import test from 'node:test'
import assert from 'node:assert/strict'
import { fundingClosingDate, fundingList } from '../src/features/discovery/services/funding-model.ts'

test('funding deadline uses the newest application year regardless of array order',()=>{
  const item={cycles:[{academic_year:2026,closes_on:'2026-09-01'},{academic_year:2027,closes_on:'2027-09-30'}]}
  assert.equal(fundingClosingDate(item),'30 September 2027')
  assert.equal(fundingClosingDate({cycles:[...item.cycles].reverse()}),'30 September 2027')
})

test('missing current deadlines never fall back to a previous intake or invented date',()=>{
  for(const item of [{cycles:[]},{cycles:[{academic_year:2027,closes_on:null}]},{cycles:[{academic_year:2027,closes_on:'not-a-date'}]},{cycles:[{academic_year:2027,closes_on:null},{academic_year:2026,closes_on:'2026-09-30'}]}])assert.equal(fundingClosingDate(item),null)
})

test('coverage/documents retain source wording without adding or duplicating benefits',()=>{
  assert.deepEqual(fundingList(['Tuition',' Books ',null,'Tuition','']),['Tuition','Books'])
  assert.deepEqual(fundingList(null),[])
  assert.deepEqual(fundingList(['Study materials']),['Study materials'])
})
