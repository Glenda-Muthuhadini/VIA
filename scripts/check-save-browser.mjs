// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-save-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9373', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket, sequence = 0
const pending = new Map(), errors = []
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(Error(method + ' timed out')) }, 20000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(expression) {
  for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await pause(100) }
  throw Error('Condition not met: ' + expression + '\n' + await evaluate('document.body.innerText.slice(0,3500)'))
}
async function navigate(route) {
  await evaluate('window.__leaving = true')
  await send('Page.navigate', { url: origin + route })
  await until(`!window.__leaving && document.readyState === 'complete' && !!document.querySelector('h1')`)
  await evaluate('document.fonts.ready'); await pause(200)
}
async function screenshot(name, full = false) {
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: await evaluate('innerWidth'), height: await evaluate('document.documentElement.scrollHeight'), scale: 1 } } : {}) })
  await fs.writeFile(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64'))
}
try {
  let tabs
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9373/json')).json(); break } catch { await pause(100) } }
  assert(tabs, 'Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result) } }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  await send('Page.enable');await send('Runtime.enable')
  const {loadEnv}=await import('vite'),env=loadEnv('development',process.cwd(),'VITE_')
  const kinds=['institutions','programmes','bursaries','accommodation']
  const records=kinds.map((kind,index)=>({id:`40000000-0000-4000-8000-00000000010${index}`,kind,title:['Fixture University','Computer Science','Fixture Bursary','Fixture Residence'][index],slug:kind,overview:'Fixture description',location:'Pretoria',province:'Gauteng',website_url:'https://example.com',application_url:'https://example.com/apply',image_url:null,logo_url:null,abbreviation:null,institution_type:'University',programme_count:1,institution_id:'40000000-0000-4000-8000-000000000100',institution_name:'Fixture University',campus:'Fixture Campus',faculty:'Science',field:'Technology',qualification:'Bachelor',duration:'3 years',minimum_aps:30,mathematics_required:true,requirements:[],provider:'Fixture Provider',funding_type:'Bursary',fields:['Technology'],study_levels:[],coverage:['Tuition'],required_documents:[],eligibility:[],accommodation_type:'Private student residence',starting_price:4500,price_period:'month',room_types:[],amenities:['Wi-Fi'],nsfas_compatible:null,nsfas_source_url:null,nsfas_verified_at:null,contact:null,institutions:[],cycles:[{id:'cycle',closes_on:'2027-09-30',fee:100,opens_on:'2026-01-01',source_name:'Fixture'}],source_name:'Fixture',source_url:'https://example.com',last_verified_at:null,academic_year:2027,is_demo:false}))
  const user={id:'90000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'save-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'}
  const profile={id:user.id,first_name:'Fixture',last_name:'Student',education_stage:'grade_12',education_stage_confirmation_required:false}
  const saved=new Set(),writes=[]
  socket.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return
    const {requestId,request}=m.params,url=new URL(request.url)
    const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'X-Supabase-Api-Version',value:'2024-01-01'},{name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'}]
    if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
    let body,responseCode=200
    const payload=async()=>JSON.parse(request.postData||(await send('Network.getRequestPostData',{requestId:m.params.networkId})).postData)
    if(url.pathname.endsWith('/search_public_opportunities')){const input=await payload();body={items:records.filter(row=>row.kind===input.p_kind),total:1,facets:{},institutions:[]}}
    else if(url.pathname.endsWith('/public_institution_summaries'))body={[records[0].id]:{aps_min:30,aps_max:30}}
    else if(url.pathname.endsWith('/public_institution_faculties')||url.pathname.endsWith('/via_bursary_programmes'))body=[]
    else if(url.pathname.endsWith('/via_public_opportunities'))body=records.filter(row=>(!url.searchParams.has('kind')||url.searchParams.get('kind')==='eq.'+row.kind)&&(!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+row.id||url.searchParams.get('id').includes(row.id))).map(document=>({document}))
    else if(url.pathname.endsWith('/via_saved_opportunities')){
      if(request.method==='POST'){const value=await payload();assert.equal(value.user_id,user.id);assert(records.some(row=>row.id===value.opportunity_id));writes.push({method:'POST',id:value.opportunity_id});saved.add(value.opportunity_id);body=[]}
      else if(request.method==='DELETE'){const id=url.searchParams.get('opportunity_id').replace('eq.','');saved.delete(id);writes.push({method:'DELETE',id});body=[]}
      else body=[...saved].map(opportunity_id=>({opportunity_id}))
    }else if(url.pathname.endsWith('/via_profiles'))body=[profile]
    else if(url.pathname.endsWith('/via_onboarding_options'))body=['current','interest','personality','preference','institution_type','province','study_goal','subject','journey'].map((category,index)=>({id:'option-'+index,category,label:category,sort_order:index}))
    else if(url.pathname.endsWith('/via_onboarding')||url.pathname.endsWith('/via_onboarding_reports'))body=[]
    else if(url.pathname.endsWith('/auth/v1/user'))body=user
    else if(url.pathname.endsWith('/auth/v1/logout'))body={}
    if(body===undefined){responseCode=400;body={message:'Unexpected fixture request'};errors.push(url.pathname)}
    await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
  })
  await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:env.VITE_SUPABASE_URL+'/*'}]})
  await navigate('/institutions');await evaluate('localStorage.clear();sessionStorage.clear()');await navigate('/login')
  const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()')
  const ready=async()=>until('document.querySelector(".via-discovery-results")?.getAttribute("aria-busy")==="false"&&!!document.querySelector(".via-opportunity-card .via-shared-save:not(:disabled)")')
  const openCard=async()=>{
    await evaluate('document.querySelector(".via-opportunity-card").scrollIntoView({block:"center"})')
    const point=await evaluate('(()=>{const r=document.querySelector(".via-opportunity-card").getBoundingClientRect();return {x:r.left+r.width/2,y:Math.min(r.bottom-20,innerHeight-20)}})()')
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
    await until('!!document.querySelector("dialog[open] .via-save-heading .via-shared-save")')
  }
  const close=async()=>{await click('dialog[open] .via-public-dialog-header button');await until('!document.querySelector("dialog[open]")')}
  for(const [width,height] of process.argv.includes('--auth-only')?[]:[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    for(const item of records){
      await navigate('/'+item.kind);await ready()
      const card=await evaluate('(()=>{const c=document.querySelector(".via-opportunity-card"),b=c.querySelector(".via-shared-save"),r=c.getBoundingClientRect(),s=b.getBoundingClientRect();return {top:s.top-r.top,right:r.right-s.right,width:s.width,height:s.height,heart:b.querySelector("svg").getAttribute("width"),overflow:document.documentElement.scrollWidth>innerWidth+1}})()')
      assert(!card.overflow&&card.width===46&&card.height===46&&card.heart==='22'&&Math.abs(card.top-21)<3&&Math.abs(card.right-21)<3,JSON.stringify({kind:item.kind,width,...card}))
      await click('.via-opportunity-card .via-shared-save');await until('location.pathname==="/login"')
      assert.equal(await evaluate('!!document.querySelector(".via-public-conversion,dialog[open]")'),false)
      const next=await evaluate('new URLSearchParams(location.search).get("next")')
      assert.equal(new URL(next,origin).pathname,'/'+item.kind);assert.equal(new URL(next,origin).searchParams.get('opportunity'),item.id);assert.equal(new URL(next,origin).searchParams.get('intent'),'save');assert.equal(writes.length,0)
      await navigate('/'+item.kind);await ready();await openCard()
      const layout=await evaluate('(()=>{const d=document.querySelector("dialog[open]"),r=d.getBoundingClientRect(),b=d.querySelector(".via-shared-save");return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,noOverflow:d.scrollWidth<=d.clientWidth+1,heart:b.querySelector("svg").getAttribute("width"),pressed:b.getAttribute("aria-pressed")}})()')
      assert(layout.fits&&layout.noOverflow&&layout.heart==='22'&&layout.pressed==='false',JSON.stringify({kind:item.kind,width,...layout}))
      if(width===375&&height===812||width===1440)await screenshot(item.kind+'-'+width)
      await click('dialog[open] .via-shared-save');await until('location.pathname==="/login"');assert.equal(writes.length,0)
    }
  }
  if(!process.argv.includes('--auth-only'))console.log('PASS: all four card/modal types at nine viewports; consistent hearts, full-card clicks, isolated guest Save directly to login, preserved context and no guest writes.')
  await navigate('/accommodation');await ready();await click('.via-opportunity-card .via-shared-save');await until('location.pathname==="/login"')
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000)
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})+'.'+encode({fixture:true})
  const session=await evaluate('(async()=>{const {supabase}=await import("/src/services/supabase.ts");const {error}=await supabase.auth.setSession({access_token:'+JSON.stringify(token)+',refresh_token:"fixture-refresh"});return {error:error?.message}})()')
  assert(!session.error,JSON.stringify(session))
  await until('document.querySelector("dialog[open] .via-shared-save")?.getAttribute("aria-pressed")==="true"')
  assert(saved.has(records[3].id)&&writes.length===1,'Login resumes selected accommodation save exactly once')
  for(const item of records){
    await navigate('/'+item.kind);await ready()
    if(saved.has(item.id)){await click('.via-opportunity-card .via-shared-save');await until('document.querySelector(".via-opportunity-card .via-shared-save")?.getAttribute("aria-pressed")==="false"')}
    await click('.via-opportunity-card .via-shared-save');await until('document.querySelector(".via-opportunity-card .via-shared-save")?.getAttribute("aria-pressed")==="true"')
    assert.equal(await evaluate('!!document.querySelector("dialog[open]")'),false,'Heart must not open details')
    await openCard();assert.equal(await evaluate('document.querySelector("dialog[open] .via-shared-save").getAttribute("aria-pressed")'),'true')
    await click('dialog[open] .via-shared-save');await until('document.querySelector("dialog[open] .via-shared-save")?.getAttribute("aria-pressed")==="false"')
    assert.equal(await evaluate('document.querySelector(".via-opportunity-card .via-shared-save").getAttribute("aria-pressed")'),'false')
    await close();await click('.via-opportunity-card .via-shared-save');await until('document.querySelector(".via-opportunity-card .via-shared-save")?.getAttribute("aria-pressed")==="true"')
    await navigate('/'+item.kind);await ready();assert.equal(await evaluate('document.querySelector(".via-opportunity-card .via-shared-save").getAttribute("aria-pressed")'),'true','Saved state survives page reload')
  }
  assert.equal(saved.size,4)
  await navigate('/dashboard');await until('!!document.querySelector(".via-workspace")')
  await evaluate('(async()=>{const {loadSavedOpportunities}=await import("/src/features/dashboard/services/saved.ts");window.__saved=await loadSavedOpportunities('+JSON.stringify(user.id)+')})()')
  assert.deepEqual((await evaluate('window.__saved.map(item=>item.kind).sort()')),['accommodation','funding','institution','programme'])
  await click('button[aria-label="Open saved"]')
  await until('document.querySelectorAll(".via-saved-groups section").length===4')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-saved-groups h3")].map(el=>el.textContent)'),['Saved Institutions','Saved Programmes','Saved Funding','Saved Accommodation'])
  assert.equal(await evaluate('document.querySelectorAll(".via-saved-groups li a").length'),4)
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    const fits=await evaluate('(()=>{const d=document.querySelector(".via-workspace-feature-dialog"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()')
    assert(fits,'Saved dashboard layout at '+width+'x'+height)
    const last=await evaluate('(()=>{const a=[...document.querySelectorAll(".via-saved-groups a")].at(-1);a.scrollIntoView({block:"center"});const r=a.getBoundingClientRect();return {visible:r.top>=0&&r.bottom<=innerHeight,height:r.height}})()')
    assert(last.visible&&last.height>=44,'Saved accommodation remains accessible at '+width+'x'+height)
    if(width===375||width===1440)await screenshot('dashboard-saved-'+width)
  }
  await evaluate('(async()=>{const {supabase}=await import("/src/services/supabase.ts");await supabase.auth.signOut({scope:"local"})})()')
  assert.deepEqual(errors,[])
  console.log('PASS: login resume, authenticated Save/Unsave and card/modal synchronisation for every type, persisted reload state and four linked dashboard categories. All auth and writes intercepted in memory.')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
