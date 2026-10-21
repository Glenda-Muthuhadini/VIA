import test from 'node:test'
import assert from 'node:assert/strict'
import { safeExternalUrl,parseDiscoveryQuery,discoveryContext,applicationStatus,validOpportunityId,discoveryConfig } from '../src/features/discovery/services/model.ts'
import { safeAuthDestination,authPageLink } from '../src/features/auth/services/redirects.ts'
test('only safe https URLs are usable external destinations',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','http://example.com','https://user:pass@example.com','/login','//evil.test']) assert.equal(safeExternalUrl(url),null)
 assert.equal(safeExternalUrl('https://www.wits.ac.za/applications/'),'https://www.wits.ac.za/applications/')
})
test('only supported filters are queried, with bounded query/page and valid numeric values',()=>{
 const params=new URLSearchParams({q:'a'.repeat(200),province:'Gauteng',fee:'free',admin:'true',page:'-1',aps_max:'NaN'})
 const parsed=parseDiscoveryQuery('institutions',params)
 assert.equal(parsed.query.length,160);assert.equal(parsed.page,1);assert.deepEqual(parsed.filters,{province:'Gauteng',fee:'free'})
 assert.deepEqual(parseDiscoveryQuery('programmes',new URLSearchParams('aps_max=35&aps_min=bad&mathematics=false&page=2')).filters,{aps_max:'35',mathematics:'false'})
 assert.equal(parseDiscoveryQuery('institutions',new URLSearchParams('page=99999999')).page,1)
 assert.deepEqual(parseDiscoveryQuery('accommodation',new URLSearchParams('nsfas=unknown')).filters,{})
})
test('opportunity/auth context survives login and signup without opening redirect loopholes',()=>{
 const item={id:'20000000-0000-4000-8000-000000000001',kind:'programmes'}
 const destination=discoveryContext(item,'match')
 assert.equal(safeAuthDestination(destination),destination)
 assert.equal(new URL(authPageLink('/signup',destination),'https://via.invalid').searchParams.get('next'),destination)
 for(const path of ['/programmes/evil','https://evil.test/programmes','//evil.test/programmes','/accommodation/../login']) assert.equal(safeAuthDestination(path),'/onboarding/welcome')
 assert(validOpportunityId(item.id));assert.equal(validOpportunityId('bad-id'),false)
})
test('unknown dates are never presented as open and closing dates are inclusive in South Africa',()=>{
 const now=new Date('2026-10-16T08:00:00Z')
 assert.equal(applicationStatus([],now),'Check application dates')
 assert.equal(applicationStatus([{opens_on:null,closes_on:'2026-10-31'}],now),'Check application dates')
 assert.equal(applicationStatus([{opens_on:'2026-09-18',closes_on:'2026-10-31'}],now),'Applications open')
 assert.equal(applicationStatus([{opens_on:null,closes_on:'2026-09-30'}],now),'Applications closed')
 assert.equal(applicationStatus([{opens_on:'2026-09-18',closes_on:'2026-10-16'}],new Date('2026-10-16T21:59:00Z')),'Applications open')
 assert.equal(applicationStatus([{opens_on:'2026-09-18',closes_on:'2026-10-16'}],new Date('2026-10-16T22:01:00Z')),'Applications closed')
})
test('all four catalogues provide separate public searches and relevant filter definitions',()=>{
 assert.equal(Object.keys(discoveryConfig).length,4)
 assert(discoveryConfig.institutions.filters.some(item=>item.key==='institution_type'))
 assert(discoveryConfig.accommodation.filters.some(item=>item.key==='nsfas'))
 assert(discoveryConfig.programmes.filters.some(item=>item.key==='aps_max'))
})
