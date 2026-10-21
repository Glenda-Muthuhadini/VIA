import test from 'node:test'
import assert from 'node:assert/strict'
import { accommodationContacts, accommodationDistance, accommodationLocation, accommodationPrice, accommodationType } from '../src/features/discovery/services/accommodation-model.ts'
import { authPageLink, getAuthDestination } from '../src/features/auth/services/redirects.ts'
import { discoveryContext } from '../src/features/discovery/services/model.ts'

test('missing prices and distances stay absent; zero and stored billing periods are preserved',()=>{
  for(const starting_price of [null,undefined,-1,NaN])assert.equal(accommodationPrice({starting_price,price_period:'month'}),null)
  assert.match(accommodationPrice({starting_price:4500,price_period:'month'}),/^From R.*4.*500.*\/ month$/)
  assert.equal(accommodationPrice({starting_price:4500,price_period:null}).includes('/'),false)
  assert.match(accommodationPrice({starting_price:0,price_period:'month'}),/^From R.*0.*\/ month$/)
  for(const value of [null,undefined,-1,NaN])assert.equal(accommodationDistance(value),null)
  assert.equal(accommodationDistance(0),'0 km away');assert.equal(accommodationDistance(2.5),'2.5 km away')
})

test('type labels never infer accreditation or campus status from ownership or NSFAS compatibility',()=>{
  assert.equal(accommodationType({accommodation_type:'Private residence'}),'Private student accommodation')
  assert.equal(accommodationType({accommodation_type:'On-campus residence'}),'On-campus residence')
  assert.equal(accommodationType({accommodation_type:'Institution-accredited accommodation'}),'Institution-accredited accommodation')
  assert.equal(accommodationType({accommodation_type:'Institution residence',nsfas_compatible:true}),'Institution residence')
  assert.equal(accommodationType({accommodation_type:null,nsfas_compatible:true}),null)
  assert.equal(accommodationLocation({location:'Hatfield, Pretoria',province:'Gauteng'}),'Hatfield, Pretoria, Gauteng')
  assert.equal(accommodationLocation({location:'Pretoria, Gauteng',province:'Gauteng'}),'Pretoria, Gauteng')
})

test('contacts only expose stored addresses and safe official URLs',()=>{
  const contact=accommodationContacts({contact:'Phone: 012 000 0000; Email: residence@example.com',application_url:'https://residence.example/apply',website_url:'https://residence.example/'})
  assert.deepEqual(contact.phones,['012 000 0000']);assert.deepEqual(contact.emails,['residence@example.com'])
  assert.equal(contact.website,'https://residence.example/apply');assert.equal(contact.application,true)
  const missing=accommodationContacts({contact:null,application_url:'javascript:alert(1)',website_url:null})
  assert.deepEqual(missing,{phones:[],emails:[],other:'',website:null,application:false})
  assert.equal(accommodationContacts({contact:'Ask the institution residence office.',application_url:null,website_url:null}).other,'Ask the institution residence office.')
})

test('login/signup return context retains the selected accommodation and save intent',()=>{
  const destination=discoveryContext({kind:'accommodation',id:'40000000-0000-4000-8000-000000000001'},'save')
  for(const path of ['/login','/signup']){
    const url=new URL(authPageLink(path,destination),'https://via.invalid')
    assert.equal(getAuthDestination(url.search),destination)
    assert.equal(new URL(url.searchParams.get('next'),'https://via.invalid').searchParams.get('intent'),'save')
  }
})
