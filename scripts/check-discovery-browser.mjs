// Browser/SDK integration tests. Supabase HTTP calls are intercepted with fixtures;
// this runner never creates real accounts, changes real passwords or sends emails.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'


const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const api = new URL(env.VITE_SUPABASE_URL)
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const output = path.resolve('node_modules/.tmp/via-discovery-qa')
await fs.mkdir(output, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=9342',
  `--user-data-dir=${path.join(output, 'chrome-profile')}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const user = {
  id: '11111111-2222-4333-8444-555555555555', aud: 'authenticated', role: 'authenticated',
  email: 'via-browser-test@example.invalid', email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { first_name: 'TestUser', last_name: 'VIA' }, identities: [{ id: 'fixture' }],
}
const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ sub: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })).toString('base64url'), 'fixture-signature'].join('.')
const session = { access_token: jwt, refresh_token: 'fixture-refresh-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }
const profile = {education_stage: "grade_9",education_stage_confirmation_required:false, id: user.id, first_name: 'TestUser', last_name: 'VIA', created_at: user.created_at, updated_at: user.created_at }
const snapshot=JSON.parse(await fs.readFile('tests/fixtures/discovery.json','utf8'))
const livePublic=process.argv.includes('--functional-v6')
const publicDb=livePublic?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}}):null
if(publicDb)for(const kind of Object.keys(snapshot)){const {data,error}=await publicDb.rpc('search_public_opportunities',{p_kind:kind,p_page_size:12});if(error)throw error;snapshot[kind]=data}
let uploadCount=0,reportCount=0,failUpload=false,qualificationRequests=[]
const ownAcademicResults=[['subject-1',75],['subject-3',70],['subject-7',75],['subject-17',75],['subject-18',75],['subject-22',75],['subject-16',100]].map(([subject_id,mark])=>({subject_id,mark}))
let failSearch=false,failDetail=false,failSave=false,paginated=false,empty=false
let saved=new Set(),privateReads=0,writes=0,delay=0
const errors=[],requests=[],pending=new Map()
let socket,requestId=0
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++requestId
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)) }, 20000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text)
  return response.result.value
}
async function until(expression) {
  for (let attempt = 0; attempt < 90; attempt++) {
    if (await evaluate(expression)) return
    await pause(100)
  }
  throw new Error(`Condition failed: ${expression}`)
}
async function fulfill(params) {
 const url=new URL(params.request.url),method=params.request.method
 const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},
 {name:'Access-Control-Allow-Headers',value:Object.entries(params.request.headers).find(([key])=>key.toLowerCase()==='access-control-request-headers')?.[1]||'authorization,apikey,content-type,x-client-info,accept-profile,content-profile,prefer'},
 {name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'X-Supabase-Api-Version',value:'2024-01-01'},{name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'}]
 let response={},status=200
 const body=params.request.postData?.startsWith('{')?JSON.parse(params.request.postData):{}
 if(method==='OPTIONS') status=204
 else if(livePublic&&['/rpc/search_public_opportunities','/rpc/public_qualification_subjects','/rpc/check_public_qualification','/rpc/check_connected_qualification','/rpc/public_institution_summaries','/rpc/public_institution_faculties','/rpc/related_public_opportunities','/via_bursary_programmes','/via_admission_rules','/via_public_opportunities'].some(path=>url.pathname.endsWith(path))){
  if(url.pathname.endsWith('/check_public_qualification')||url.pathname.endsWith('/check_connected_qualification'))qualificationRequests.push(body)
  const remote=await fetch(url,{method,headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}`,'Content-Type':'application/json',Accept:'application/json'},body:method==='POST'?params.request.postData:undefined,signal:AbortSignal.timeout(20000)})
  status=remote.status;response=await remote.json()
 }
 else if(url.pathname.endsWith('/rpc/public_institution_summaries'))response=Object.fromEntries(body.p_ids.map(id=>[id,{aps_min:null,aps_max:null}]))
 else if(url.pathname.endsWith('/rpc/public_institution_faculties')){const programmes=snapshot.programmes.items.filter(p=>p.institution_id===body.p_institution&&p.title.toLowerCase().includes((body.p_query||'').toLowerCase()));response=programmes.length?[{id:'fixture-faculty',name:'Faculty of Science',aps_min:null,aps_max:null,programme_count:programmes.length,programmes:programmes.map(p=>({id:p.id,title:p.title,aps_min:p.minimum_aps,aps_max:p.minimum_aps}))}]:[]}
 else if(url.pathname.endsWith('/rpc/related_public_opportunities'))response={institutions:[],programmes:[],funding:[],accommodation:[]}
 else if(url.pathname.endsWith('/via_bursary_programmes'))response=[]
 else if(url.pathname.includes('/storage/v1/object/via-school-reports/')){
  assert(url.pathname.includes(user.id));if(failUpload){status=503;response={message:'Fixture upload unavailable'}}else{uploadCount++;response={Key:url.pathname.split('/object/')[1]}}
 }
 else if(url.pathname.endsWith('/via_onboarding_reports')&&method==='POST'){
  assert.equal(body.user_id,user.id);reportCount++;response={...body,created_at:new Date().toISOString()}
 }
 else if(url.pathname.endsWith('/via_onboarding'))response=[{user_id:user.id,flow_version:2,academic_record_id:null,answers:{results:ownAcademicResults}}]
 else if(url.pathname.endsWith('/rpc/search_public_opportunities')) {
  requests.push(body);assert(body.p_page_size<=24);if(delay)await pause(delay)
  if(failSearch){status=503;response={message:'Fixture network failure'}}
  else {
   let data=structuredClone(snapshot[body.p_kind]);let items=data.items
   if(paginated&&body.p_kind==='programmes')items=Array.from({length:17},(_,index)=>({...items[index%items.length],id:`20000000-0000-4000-8000-${String(index+100).padStart(12,'0')}`,title:`Test fixture ${index+1}: ${items[index%items.length].title}`}))
   const q=(body.p_query??'').toLowerCase();if(q)items=items.filter(item=>[item.title,item.abbreviation,item.location,item.institution_name,item.field,item.provider,...(item.career_keywords??[])].filter(Boolean).join(' ').toLowerCase().includes(q))
   for(const [key,value] of Object.entries(body.p_filters??{}))items=items.filter(item=>key==='institution'?item.institutions.some(inst=>inst.id===value):key==='field'?item.field===value||item.fields?.includes(value):key==='aps_max'?item.minimum_aps!==null&&item.minimum_aps<=Number(value):key==='nsfas'?item.nsfas_compatible===true:key==='amenity'?item.amenities?.includes(value):key==='coverage'?item.coverage?.includes(value):key==='study_level'?item.study_levels?.includes(value):key==='price_max'?item.starting_price!==null&&item.starting_price<=Number(value):item[key]===value)
   if(empty)items=[]
   const total=items.length,start=((body.p_page??1)-1)*12
   response={...data,items:items.slice(start,start+12),total}
  }
 } else if(url.pathname.endsWith('/via_public_opportunities')) {
  if(failDetail){status=503;response={message:'Fixture details unavailable'}}
  else {const id=url.searchParams.get('id')?.slice(3),kind=url.searchParams.get('kind')?.slice(3),item=snapshot[kind]?.items.find(item=>item.id===id);response=item?[{document:item}]:[]}
 } else if(url.pathname.endsWith('/via_saved_opportunities')) {
  if(method==='GET'){privateReads++;response=[...saved].map(opportunity_id=>({opportunity_id}))}
  else if(failSave){status=503;response={message:'Fixture save failed'}}
  else if(method==='POST'){assert.equal(body.user_id,user.id);saved.add(body.opportunity_id);writes++;response=[]}
  else if(method==='DELETE'){assert.equal(url.searchParams.get('user_id'),'eq.'+user.id);saved.delete(url.searchParams.get('opportunity_id').slice(3));writes++;response=[]}
 } else if(url.pathname.endsWith('/via_profiles'))response=[profile]
 else if(url.pathname.endsWith('/user'))response=user
 else if(url.pathname.endsWith('/token'))response=session
 else if(url.pathname.endsWith('/logout'))status=204
 else {status=400;response={message:'Unexpected endpoint'};errors.push(url.pathname)}
 await send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:status,responseHeaders:headers,body:status===204?'':Buffer.from(JSON.stringify(response)).toString('base64')})
}

async function go(route, signedIn = false) {
  await evaluate(`window.__viaLeavingDocument=true;localStorage.clear();sessionStorage.clear();${signedIn ? `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))});` : ''}`)
  await send('Page.navigate', { url: origin + route })
  await until(`!window.__viaLeavingDocument && document.readyState === 'complete' && document.querySelector('.via-site-header,.via-public,.via-product-page') !== null`)
  await pause(100)
}
async function fill(selector, value) {
  await evaluate(`(() => {const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.value='';})()`)
  await send('Input.insertText', { text: value })
}

try {
  let target
  for (let attempt = 0; attempt < 60; attempt++) {
    try { target = (await (await fetch('http://127.0.0.1:9342/json/list')).json()).find(item => item.type === 'page'); if (target) break } catch {}
    await pause(150)
  }
  if (!target) throw new Error('Headless Chrome did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
    if (message.method === 'Log.entryAdded' && message.params.entry.text.includes('CORS')) errors.push('Browser CORS failure')
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    // A navigation can cancel a paused request before the fixture responds.
    if (message.method === 'Fetch.requestPaused') void fulfill(message.params).catch(error => { if (!error.message.includes('Invalid InterceptionId')) errors.push(error.message) })
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timeout)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    }
  })
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: `${api.origin}/*` }] })
  const cleanStart=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear()'})
  await send('Page.navigate', { url: origin + '/login' })
  await until(`document.readyState === 'complete' && location.origin === ${JSON.stringify(origin)}`)
  await evaluate('localStorage.clear();sessionStorage.clear()')
  await send('Page.navigate', { url: origin + '/login' })
  await pause(200)
  await until(`document.readyState === 'complete' && document.querySelector('input[type="email"]') !== null`)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:cleanStart.identifier})

  async function click(selector) { await evaluate(`(()=>{const button=document.querySelector(${JSON.stringify(selector)});button.focus();button.click()})()`) }
  async function loaded(){await until(`document.querySelector('.via-opportunity-card')!==null && document.querySelector('.via-discovery-results')?.getAttribute('aria-busy')==='false'`)}
  async function reload(){await evaluate('window.__viaLeavingDocument=true');await send('Page.reload');await until(`!window.__viaLeavingDocument && document.readyState==='complete'`);await loaded()}
  async function closeDialog(){await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await pause(100)}
  async function openFirst(){await click('.via-opportunity-card h2 button');await until(`document.querySelector('dialog[open] .via-public-detail-heading')!==null`)}
  async function tab(name){await evaluate(`[...document.querySelectorAll('dialog[open] [role="tab"]')].find(item=>item.textContent===${JSON.stringify(name)}).click()`)}
  if(process.argv.includes('--links-only')){
   const previous=JSON.parse(await fs.readFile('supabase/catalogue/link_verification_v5.json','utf8')),review=[]
   for(const link of previous.filter(link=>!link.ok)){
    try{
     await send('Page.navigate',{url:link.url});await pause(2500)
     let page=await evaluate(`({url:location.href,title:document.title,text:document.body?.innerText?.slice(0,1400)??''})`)
     for(let wait=0;wait<4&&page.text.length<=100&&!/just a moment|cloudflare|privacy error|access denied/i.test(page.title);wait++){await pause(2000);page=await evaluate(`({url:location.href,title:document.title,text:document.body?.innerText?.slice(0,1400)??''})`)}
     const success=page.url.startsWith('https://')&&new URL(page.url).hostname.replace(/^www\./,'')===new URL(link.url).hostname.replace(/^www\./,'')&&!/just a moment|cloudflare|attention required|privacy error|not found|access denied|unavailable/i.test(page.title)&&page.text.length>100
     review.push({requested:link.url,...page,browser_content_loaded:success,checked_at:new Date().toISOString()});console.log(success?'BROWSER CONTENT LOADED:':'STILL NEEDS REVIEW:',link.url,page.title)
    }catch(error){review.push({requested:link.url,browser_content_loaded:false,error:error.message})}
   }
   await fs.writeFile('supabase/catalogue/browser_link_review_v6.json',JSON.stringify(review,null,2)+'\n');console.log(`${review.filter(r=>r.browser_content_loaded).length}/${review.length} previously blocked destinations loaded readable content in Chrome; this does not certify future availability.`)
  } else if(livePublic){
   await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false})
   if(!process.argv.includes('--checker-only')){
   // Every public record and its real official URLs is read from live Supabase.
   for(const kind of Object.keys(snapshot)){
    await go('/'+kind);await loaded();assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),10)
    for(let index=0;index<10;index++){
     await click(`.via-discovery-grid .via-opportunity-card:nth-child(${index+1}) h2 button`);await until(`document.querySelector('dialog[open] .via-public-detail-heading')!==null`)
     assert.equal(await evaluate(`document.querySelector('.via-public-detail-heading h2').textContent`),snapshot[kind].items[index].title)
     assert.equal(await evaluate(`[...document.querySelectorAll('.via-public-external-actions a')].every(a=>a.href.startsWith('https://')&&a.target==='_blank'&&a.rel.includes('noopener'))`),true)
     await tab('Requirements');await tab('Application Info');await closeDialog()
    }
    await fill('.via-discovery-search input',snapshot[kind].items[0].title);await until(`document.querySelectorAll('.via-opportunity-card').length===1`)
   }
   await go('/institutions?province=Gauteng');await loaded();assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),snapshot.institutions.items.filter(item=>item.province==='Gauteng').length)
   await go('/programmes?institution=10000000-0000-4000-8000-000000000005');await loaded();assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),8)
   await go('/programmes');await loaded();await openFirst();await click('.via-public-match-conversion button');await until(`document.querySelector('.via-qualification-content')!==null`);await closeDialog();assert.equal(await evaluate(`document.querySelector('.via-public-detail-heading')!==null`),true);await closeDialog()
   await go('/programmes');await loaded();await click('.via-save-button');await until(`document.querySelector('.via-public-conversion')!==null`)
   assert.equal(writes,0);assert.equal(await evaluate(`document.querySelector('.via-public-conversion a[href^="/login"]').getAttribute('href').includes('intent%3Dsave')`),true);await closeDialog()
   await go('/programmes',true);await loaded();await click('.via-save-button');await until(`document.body.innerText.includes('Saved to your VIA.')`);await reload();await until(`document.querySelector('.via-save-button[aria-pressed="true"]')!==null`);await click('.via-save-button[aria-pressed="true"]');await until(`document.body.innerText.includes('Removed from saved opportunities.')`)
   await go('/bursaries',true);await loaded();await openFirst();await click('.via-public-match-conversion button');await until(`document.querySelector('.via-public-match-conversion button').textContent.includes('Remove from saved funding')`);await click('.via-public-match-conversion button');await until(`document.querySelector('.via-public-match-conversion button').textContent.includes('Save this funding')`);await closeDialog()
   console.log('PASS: all 40 live Supabase records, search, filters, details, requirements, application panels, safe external anchors and private-save SDK behavior (private writes mocked)')
   }
   // The compact popup and real OCR are covered by the dedicated browser suite.
   if(!process.argv.includes('--skip-reader'))await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/check-report-reader-browser.mjs'],{stdio:'inherit',windowsHide:true})
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Report-reader browser checks failed')))
   })
   await send('DOM.enable');await send('Page.setInterceptFileChooserDialog',{enabled:true})
   async function checker(){await until(`document.querySelectorAll('.via-qualification-methods button:not(:disabled)').length===3`)}
   async function compare(){await click('.via-qualification-submit');await until(`document.querySelector('.via-qualification-results')!==null`)}
   await go('/programmes?check=1',true);await checker()
   await click('.via-qualification-methods button:nth-child(3)');await click('.via-qualification-grades button:nth-child(4)')
   await until(`[...document.querySelectorAll('.via-qualification-results-heading button')].some(b=>b.textContent==='Use my VIA results')`)
   await evaluate(`[...document.querySelectorAll('.via-qualification-results-heading button')].find(b=>b.textContent==='Use my VIA results').click()`)
   await compare()
   assert.equal(await evaluate(`document.querySelectorAll('.via-qualification-outcome').length`),5)
   await fill('[aria-label="Mark 1"]','66');await compare();assert.equal(await evaluate(`[...document.querySelectorAll('.via-qualification-outcome h4')].some(x=>x.textContent.includes('Mathematical Sciences'))`),false)
   assert.equal(ownAcademicResults[0].mark,75,'exploratory edits must not overwrite saved marks')
   async function uploadFile(selector,name){
    const root=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector})
    await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.resolve('node_modules/.tmp/via-report-reader-qa',name)]})
   }
   const comparisonsBeforeUpload=qualificationRequests.length
   await click('.via-qualification-methods button:first-child')
   await uploadFile('input[aria-label="Upload report file"]','text-report.pdf')
   await until(`document.querySelectorAll('.via-manual-result-row').length===7 && !document.querySelector('.via-qualification-reading')`)
   assert.equal(uploadCount,1);assert.equal(reportCount,1);assert.equal(qualificationRequests.length,comparisonsBeforeUpload)
   failUpload=true;await click('.via-qualification-methods button:nth-child(2)')
   await uploadFile('input[aria-label="Take or upload report photo"]','report.png')
   await until(`document.querySelector('.via-qualification-content').textContent.includes('Your report could not be saved')`)
   await until(`!document.querySelector('.via-qualification-reading')`);assert.equal(reportCount,1);failUpload=false
   assert.equal(await evaluate(`document.querySelectorAll('.via-manual-result-row').length`),7)
   assert.deepEqual(errors,[])
   console.log('PASS: saved-result reuse, isolated edits, authenticated private-report SDK upload and usable extracted results after storage failure (private writes mocked)')
  } else if(process.argv.includes('--accounts-only')) {
   const checks=[]
   for(const signedIn of [false,true])for(const route of ['/','/institutions','/programmes','/bursaries','/accommodation'])for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await go(route,signedIn)
    const header='.via-site-header'
    await until(`document.querySelector('${header} a[href="${signedIn?'/dashboard':'/signup'}"]')!==null`)
    const check=await evaluate(`(()=>{const h=document.querySelector('${header}'),buttons=[...h.querySelectorAll('.via-site-actions a')],rects=buttons.map(a=>a.getBoundingClientRect()),pill=h.querySelector('.via-site-pill'),p=pill.getBoundingClientRect(),brand=h.querySelector('.via-site-brand').getBoundingClientRect();return {route:location.pathname,width:innerWidth,height:innerHeight,headerCount:document.querySelectorAll('.via-site-header').length,backLink:document.body.innerText.includes('Back to VIA'),logo:!!h.querySelector('img[alt="VIA"]'),links:buttons.map(a=>a.getAttribute('href')),navigation:[...pill.querySelectorAll('a')].map(a=>a.getAttribute('href')),active:[...pill.querySelectorAll('[aria-current="page"]')].map(a=>a.getAttribute('href')),centered:innerWidth<=1150||Math.abs((p.left+p.right)/2-document.documentElement.clientWidth/2)<2,pillFits:innerWidth<=1150||(p.left>=brand.right&&p.right<=rects[0].left),guestLinks:document.querySelectorAll('a[href="/login"],a[href="/signup"]').length,horizontal:document.documentElement.scrollWidth>innerWidth+1,accessible:rects.every(r=>r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&r.height>=44),overlap:rects.length>1&&rects[0].right>rects[1].left}})()`)
    assert.equal(check.logo,true);assert.deepEqual(check.links,signedIn?['/dashboard']:['/login','/signup']);if(signedIn)assert.equal(check.guestLinks,0)
    assert.equal(check.horizontal,false,JSON.stringify(check));assert.equal(check.accessible,true,JSON.stringify(check));assert.equal(check.overlap,false,JSON.stringify(check));checks.push({...check,signedIn})
    assert.equal(check.headerCount,1);assert.equal(check.backLink,false);assert.equal(check.centered,true,JSON.stringify(check));assert.equal(check.pillFits,true,JSON.stringify(check))
    assert.deepEqual(check.navigation,['/institutions','/programmes','/bursaries','/accommodation']);assert.deepEqual(check.active,route==='/'?[]:[route])
    if(width<=1150){await click('.via-site-menu-toggle');await until(`document.querySelector('dialog[open] .via-site-mobile-links')!==null`);assert.equal(await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth})()`),true);assert.deepEqual(await evaluate(`[...document.querySelectorAll('.via-site-mobile-links [aria-current="page"]')].map(a=>a.getAttribute('href'))`),route==='/'?[]:[route]);await closeDialog();assert.equal(await evaluate(`document.activeElement.classList.contains('via-site-menu-toggle')`),true)}
   }
   assert.deepEqual(errors,[])
   await fs.writeFile(path.join(output,'accounts-report.json'),JSON.stringify({checks,errors},null,2))
   console.log('PASS: landing and all four explorers show the correct guest/account links, logo and accessible header controls at seven widths and two short heights (90 checks)')
  } else {
  if(!process.argv.includes('--hero-only')) {
  await go('/institutions');await loaded();assert.equal(privateReads,0)
  assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),4)
  await click('.via-discovery-filter-toggle');await until(`document.querySelector('dialog[open] select')!==null`)
  await evaluate(`(()=>{const select=document.querySelector('dialog select');select.value='Gauteng';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await click('.via-public-filter-done button');await until(`document.querySelectorAll('.via-opportunity-card').length===2`)
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('province')`),'Gauteng')
  assert.equal(await evaluate(`document.querySelector('.via-discovery-active-filters').textContent.includes('Gauteng')`),true)
  await reload();assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),2)
  await click('.via-discovery-active-filters button');await until(`document.querySelectorAll('.via-opportunity-card').length===4`)
  assert.equal(await evaluate(`new URLSearchParams(location.search).has('province')`),false)
  await fill('.via-discovery-search input','Wits');await until(`document.querySelectorAll('.via-opportunity-card').length===1`)
  assert.equal(await evaluate(`new URLSearchParams(location.search).get('q')`),'Wits')
  await reload();assert.equal(await evaluate(`document.querySelector('.via-discovery-search input').value`),'Wits')
  await openFirst();await until(`document.querySelector('.via-institution-faculty summary')!==null`);await click('.via-institution-faculty summary')
  await click('.via-institution-faculty li button');await until(`location.pathname==='/programmes' && document.querySelector('.via-public-detail-heading')?.textContent.includes('BSc Computer Science')`)
  await tab('Requirements');assert.equal(await evaluate(`document.querySelector('[role="tabpanel"]').textContent.includes('NSC Level 6')`),true)
  await tab('Application Info');assert.equal(await evaluate(`document.querySelector('[role="tabpanel"]').textContent.includes('2027')`),true)
  assert.equal(await evaluate(`[...document.querySelectorAll('.via-public-external-actions a')].every(item=>item.target==='_blank'&&item.rel.includes('noopener'))`),true)
  // Qualification CTAs now use the live-engine suite (--functional-v6), rather
  // than the removed "matching unavailable" conversion placeholder.
  await closeDialog()
  await go('/programmes');await loaded();await click('.via-save-button');await until(`document.querySelector('.via-public-conversion')!==null`)
  assert.equal(privateReads,0);assert.equal(writes,0)
  const login=await evaluate(`document.querySelector('.via-public-conversion a[href^="/login"]').getAttribute('href')`)
  await go(login);await until(`document.querySelector('input[type="email"]')!==null`);await fill('input[type="email"]',user.email);await fill('input[type="password"]','Fixture-only-password-123!');await click('button[type="submit"]')
  await until(`location.pathname==='/programmes' && document.querySelector('.via-public-conversion')!==null`)
  await until(`document.querySelector('.via-discovery-results').getAttribute('aria-busy')==='false'`);await pause(200)
  await click('.via-public-conversion .is-primary');await until(`document.body.innerText.includes('Saved to your VIA.')`)
  assert.equal(saved.size,1)
  await reload();await until(`document.querySelector('.via-save-button[aria-pressed="true"]')!==null`)
  await click('.via-save-button[aria-pressed="true"]');await until(`document.body.innerText.includes('Removed from saved opportunities.')`);assert.equal(saved.size,0)
  failSave=true;await click('.via-save-button');await until(`document.body.innerText.includes('could not update your saved opportunities')`);assert.equal(saved.size,0);failSave=false
  await click('.via-save-button');await until(`document.body.innerText.includes('Saved to your VIA.')`)
  await go('/institutions',true);await loaded();await until(`document.querySelector('.via-institution-card .via-save-button:not(:disabled)')!==null`);await click('.via-institution-card .via-save-button');await until(`document.body.innerText.includes('Saved to your VIA.')`);assert.equal(await evaluate(`document.querySelector('.via-institution-details')===null`),true);await reload();await until(`document.querySelector('.via-institution-card .via-save-button[aria-pressed=true]:not(:disabled)')!==null`);await click('.via-institution-card .via-save-button[aria-pressed=true]');await until(`document.body.innerText.includes('Removed from saved opportunities.')`);console.log('PASS: authenticated institution Save/reload/unsave stays isolated from card navigation (private writes mocked)')
  console.log('PASS: anonymous browsing, search/reload, institution programmes, requirements/dates/external links, truthful conversion, context-preserving login, private save/reload/unsave and save-error recovery')
  await go('/programmes');await loaded();await fill('.via-discovery-search input','no-such-programme');await until(`document.body.innerText.includes('No programmes matched')`);await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent==='Clear filters').click()`);await loaded()
  failSearch=true;await go('/bursaries');await until(`document.body.innerText.includes('Let’s try that again')`);failSearch=false;await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent==='Try again').click()`);await loaded()
  failDetail=true;await click('.via-opportunity-card h2 button');await until(`document.body.innerText.includes('couldn’t be opened')`);failDetail=false;await evaluate(`[...document.querySelectorAll('dialog button')].find(item=>item.textContent==='Try again').click()`);await until(`document.querySelector('.via-public-detail-heading')!==null`);await closeDialog()
  paginated=true;await go('/programmes');await loaded();assert.equal(await evaluate(`document.querySelectorAll('.via-opportunity-card').length`),12)
  await evaluate(`[...document.querySelectorAll('.via-public-pagination button')].find(item=>item.textContent.includes('Next')).click()`);await until(`document.querySelectorAll('.via-opportunity-card').length===5`);assert.equal(await evaluate(`new URLSearchParams(location.search).get('page')`),'2');paginated=false
  empty=true;await go('/accommodation');await until(`document.body.innerText.includes('More possibilities are on their way.')`);empty=false
  console.log('PASS: no-results and empty-catalogue states, retryable search/detail failures and bounded pagination')
  }
  const sizes=[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]],layouts=[]
  async function layout(name){
   const result=await evaluate(`(()=>{const elements=[...document.querySelectorAll('main button,main a,main input,main select,.via-public-header a,.via-public-header button')].filter(item=>item.getClientRects().length&&!item.closest('.via-cinematic-products'));return {route:location.pathname,width:innerWidth,height:innerHeight,horizontal:document.documentElement.scrollWidth>innerWidth+1,outside:elements.filter(item=>{const r=item.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(item=>item.tagName)}})()`)
   assert.equal(result.horizontal,false,JSON.stringify(result));assert.deepEqual(result.outside,[],JSON.stringify(result));layouts.push({name,...result})
   const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`${name}-${result.width}x${result.height}.png`),Buffer.from(shot.data,'base64'))
  }
  async function dialogBounds(){assert.equal(await evaluate(`(()=>{const d=[...document.querySelectorAll('dialog[open]')].at(-1),r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1})()`),true)}
  for(const kind of (process.argv.includes('--hero-only')?[]:['institutions','programmes','bursaries','accommodation'])){
   for(const [width,height] of sizes){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Emulation.setTouchEmulationEnabled',{enabled:width<=1024});await go('/'+kind);await loaded();await until(`[...document.images].every(item=>item.complete&&item.naturalWidth>0)`);assert.equal(await evaluate(`location.pathname`),'/'+kind)
    await layout(kind)
    assert.equal(await evaluate(`document.querySelectorAll('.via-site-header').length`),1)
    assert.equal(await evaluate(`document.querySelectorAll('.via-discovery-return,.via-discovery-filters').length`),0)
    assert.equal(await evaluate(`document.querySelector('h1').textContent`),{institutions:'Find your institution',programmes:'Explore programmes',bursaries:'Find funding',accommodation:'Find student accommodation'}[kind])
    await click('.via-discovery-filter-toggle');await until(`document.querySelector('dialog[open] select')!==null`);await dialogBounds();await layout(kind+'-filters');await evaluate(`document.querySelector('.via-public-filter-done button').scrollIntoView({block:'center'})`);assert.equal(await evaluate(`document.querySelector('.via-public-filter-done button').getBoundingClientRect().bottom<=innerHeight+1`),true);await closeDialog();await until(`document.querySelector('dialog[open]')===null`)
    await evaluate(`window.scrollTo(0,0)`);await openFirst();await dialogBounds();await layout(kind+'-details')
    await evaluate(`(()=>{const d=document.querySelector('dialog[open]');d.scrollTop=d.scrollHeight;})()`)
    const lastReachable=await evaluate(`(()=>{const d=document.querySelector('dialog[open]'),a=[...d.querySelectorAll('a,button')].at(-1);a.scrollIntoView({block:'center'});const r=a.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1})()`);assert.equal(lastReachable,true)
    await closeDialog();await until(`document.querySelector('dialog[open]')===null`);assert.equal(await evaluate(`document.activeElement?.tagName`),'BUTTON')
   }
   console.log(`PASS: ${kind} focused hero, back link, list, details, filter dialog and reachable actions at every required width and two short heights`)
  }
  for(const [width,height] of sizes){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await go('/');await until(`document.querySelector('.via-cinematic-hero')!==null`);await layout('landing')
   assert.deepEqual(await evaluate(`[...document.querySelectorAll('.via-cinematic-opportunity')].map(item=>item.getAttribute('href'))`),['/programmes','/institutions','/bursaries'])
   assert.equal(await evaluate(`document.body.innerText.includes('10K+')`),false)
   assert.equal(await evaluate(`document.querySelectorAll('.via-explore-option').length`),4)
   assert.equal(await evaluate(`document.querySelector('.via-cinematic-hero').getBoundingClientRect().height`),height)
   assert.equal(await evaluate(`(()=>{const stage=document.querySelector('.via-cinematic-stage'),header=document.querySelector('.via-site-header'),copy=document.querySelector('.via-cinematic-copy');if(innerWidth>760||innerHeight>650)return true;const startsBelowHeader=copy.getBoundingClientRect().top>=header.getBoundingClientRect().bottom;const cta=copy.querySelector('.via-cinematic-ctas a');cta.scrollIntoView({block:'nearest'});const a=cta.getBoundingClientRect(),r=stage.getBoundingClientRect();const reachable=a.top>=r.top&&a.bottom<=r.bottom+1;stage.scrollTop=0;window.scrollTo(0,0);return startsBelowHeader&&reachable})()`),true)
  }
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(output,process.argv.includes('--hero-only')?'hero-report.json':'report.json'),JSON.stringify({mode:'Mocked HTTP using a snapshot of the applied public catalogue; no real accounts modified',layouts,requests:requests.length,privateReads,writes,errors},null,2))
  console.log('PASS: approved hero intact, three public hero links, four discovery entry links, and no runtime errors')
  }

} catch(error) {
  if(socket?.readyState===WebSocket.OPEN) {
    console.error(await evaluate(`JSON.stringify({route:location.pathname,text:document.body.innerText,errors:${JSON.stringify(errors)}})`))
    const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'failure.png'),Buffer.from(shot.data,'base64'))
  }
  throw error
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser.kill()
}
