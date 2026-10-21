// Authenticated Grade 10 browser checks. Supabase requests use fixtures; no real accounts or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-grade10-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9377', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9377/json')).json(); break } catch { await pause(100) } }
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
  const {options}=await import('../tests/adaptive-fixture.mjs')
  const {emptyAnswers}=await import('../src/features/onboarding/services/model.ts')
  const {getFlow}=await import('../src/features/onboarding/config/flows.ts')
  const {validateJourneyStep}=await import('../src/features/onboarding/services/journey-model.ts')
  const user={id:'91000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'journey-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'}
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000)
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})+'.'+encode({fixture:true})
  const session={user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer'}
  const institution={id:'81000000-0000-4000-8000-000000000001',kind:'institutions',title:'Fixture University'}
  const programme={id:'82000000-0000-4000-8000-000000000001',kind:'programmes',title:'BSc Computer Science',institution_id:institution.id,institution_name:institution.title,campus:'Fixture Campus',qualification:'Bachelor',duration:'3 years',field:'Technology',career_keywords:['Software developer'],cycles:[],requirements:[],is_demo:false}
  let catalogueFixtures=[],saved=[];
  let failRequirements=false;let profile,draft,reports=[],failSave=false,writes=0,uploads=0
  const initialise=(stage,full=true,step='current',completed=false)=>{
    profile={id:user.id,first_name:'Fixture',last_name:'Student',education_stage:stage,education_stage_confirmation_required:!stage}
    const a=emptyAnswers()
    if(full){
      Object.assign(a,{school_subject_ids:['subject-1'],report_grade:stage==='grade_9'?9:stage==='grade_10'?10:stage==='post_matric'?12:11,report_type:'final',results:[{subject_id:'subject-1',mark:64}],academic_year:2026})
      Object.assign(a.journey,{interests:['Technology'],careers:['Software developer'],fields:['Technology & Computing'],programme_ids:[programme.id],matric_year:2025,current_activity:'Preparing to apply',application_progress:stage==='post_matric'?'Yes':"I've submitted applications",applications:[{institution_id:institution.id,programme:'Computer Science',status:'Submitted'}],funding_methods:['NSFAS'],funding_situation:"I'm looking for funding",institution_id:institution.id,programme_id:programme.id,campus:'Fixture Campus',starting_year:2027,year_of_study:'First year',accommodation_status:'Not yet',registration_status:'Not yet',support:['Academic support']})
    }
    draft=stage?{user_id:user.id,flow_version:4,current_step:step,revision:0,answered_steps:['welcome','current'],skipped_steps:[],carried_steps:[],journey_answers:a,answers:emptyAnswers(),completed_at:completed?'2026-10-20T12:00:00Z':null}:null
    reports=[]
  }
  initialise(null,false)
  socket.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return
    const {requestId,request}=m.params,url=new URL(request.url)
    const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'X-Supabase-Api-Version',value:'2024-01-01'},{name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'}]
    if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
    let body,code=200
    const payload=async()=>JSON.parse(request.postData||(await send('Network.getRequestPostData',{requestId:m.params.networkId})).postData)
    if(url.pathname.endsWith('/via_profiles'))body=[profile]
    else if(url.pathname.endsWith('/via_onboarding_options'))body=options
    else if(url.pathname.endsWith('/via_onboarding'))body=draft?[draft]:[]
    else if(url.pathname.endsWith('/via_onboarding_reports')){
      if(request.method==='POST'){const row=await payload();reports=[{...row,created_at:'2026-10-20T12:00:00Z'},...reports];body=reports[0]}else body=reports
    }else if(url.pathname.endsWith('/via_public_opportunities')&&failRequirements){code=500;body={message:'Fixture requirements unavailable'}}else if(url.pathname.endsWith('/via_public_opportunities'))body=[institution,...catalogueFixtures].filter(row=>(!url.searchParams.has('kind')||url.searchParams.get('kind')==='eq.'+row.kind)&&(!url.searchParams.has('id')||url.searchParams.get('id').includes(row.id))).map(document=>({document}))
    else if(url.pathname.endsWith('/via_saved_opportunities')){if(request.method==='POST'){const row=await payload();saved=[...new Set([...saved,row.opportunity_id])];writes++;body=[]}else if(request.method==='DELETE'){const id=url.searchParams.get('opportunity_id')?.slice(3);saved=saved.filter(value=>value!==id);writes++;body=[]}else body=saved.map(opportunity_id=>({opportunity_id}))}
    else if(url.pathname.endsWith('/set_my_education_stage')){
      const value=await payload();assert.equal(value.p_expected_revision,draft?.revision??0)
      initialise(value.p_stage,false);body=draft;writes++
    }else if(url.pathname.endsWith('/save_my_journey_onboarding')){
      const value=await payload();assert.equal(value.p_stage,profile.education_stage)
      if(failSave){code=500;body={message:'Fixture save failure'}}else{
        assert.equal(value.p_expected_revision,draft.revision)
        if(value.p_complete)for(const step of getFlow(profile.education_stage).steps.filter(row=>!['welcome','current'].includes(row.id)))assert.equal(validateJourneyStep(step.id,profile.education_stage,value.p_answers),'')
        draft={...draft,journey_answers:structuredClone(value.p_answers),current_step:value.p_current_step,revision:draft.revision+1,answered_steps:value.p_answered_steps,skipped_steps:value.p_skipped_steps,completed_at:value.p_complete?'2026-10-20T12:00:00Z':draft.completed_at};body=draft;writes++
      }
    }else if(url.pathname.includes('/storage/v1/object/sign/'))body={signedURL:'/fixture-report.pdf'}
    else if(url.pathname.includes('/storage/v1/object/')){uploads++;body={Key:url.pathname.split('/object/')[1]}}
    else if(url.pathname.endsWith('/auth/v1/token'))body=session
    else if(url.pathname.endsWith('/auth/v1/user'))body=user
    else if(url.pathname.endsWith('/auth/v1/logout'))body={}
    if(body===undefined){code=400;body={message:'Unexpected fixture-only request'};errors.push(url.pathname)}
    await send('Fetch.fulfillRequest',{requestId,responseCode:code,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
  })
  await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:env.VITE_SUPABASE_URL+'/*'}]})
  await navigate('/login')
  const storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
  await evaluate('localStorage.clear();sessionStorage.clear();localStorage.setItem('+JSON.stringify(storageKey)+','+JSON.stringify(JSON.stringify(session))+')')
  const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()')
  options.push(...['Mathematics','Physical Sciences','Life Sciences','Geography','English','Afrikaans','Life Orientation','Mathematical Literacy'].map((label,i)=>({id:'g10-qa-'+i,category:'subject',label,education_stages:['grade_10'],sort_order:200+i})))
  const req=(subject,minimum)=>({id:subject,subject,minimum_percentage:minimum,detail:'Fixture published subject requirement',recommended:false,is_demo:false,source_url:'https://example.edu/requirements'})
  Object.assign(programme,{overview:'Fixture computing degree',academic_year:2027,location:'Pretoria',province:'Gauteng',source_url:'https://example.edu/computing',source_name:'Fixture official source',requirements:[req('Mathematics',60),req('English',50)]})
  const second={...programme,id:'82000000-0000-4000-8000-000000000002',institution_id:'81000000-0000-4000-8000-000000000002',institution_name:'Second Fixture University',requirements:[req('Mathematics',75),req('English',60)]}
  const civil={...programme,id:'82000000-0000-4000-8000-000000000003',title:'BEng Civil Engineering',field:'Engineering',duration:'4 years',career_keywords:['Civil Engineer','Structural Engineer'],requirements:[req('Mathematics',70),req('Physical Sciences',70)]}
  const biological={...programme,id:'82000000-0000-4000-8000-000000000004',title:'BSc Biological Sciences',field:'Science',career_keywords:['Research','Biotechnology'],requirements:[req('Life Sciences',60)]}
  const demo={...programme,id:'82000000-0000-4000-8000-000000000005',title:'Fake Published Programme',is_demo:true,requirements:[req('Mathematics',99)]}
  catalogueFixtures=[programme,second,civil,biological,demo]
  const normalCatalogue=[...catalogueFixtures]
  const setup=(marks=true)=>{
    initialise('grade_10',true,'ready',true)
    draft.journey_answers.school_subject_ids=Array.from({length:7},(_,i)=>'g10-qa-'+i)
    draft.journey_answers.results=marks?[72,65,71,62,68,59,75].map((mark,i)=>({subject_id:'g10-qa-'+i,mark})):[]
    draft.journey_answers.journey.interests=['Technology','Engineering','Science'];draft.journey_answers.journey.careers=['Software Developer']
    draft.journey_answers.journey.fields=[];draft.journey_answers.journey.programme_name=''
  }
  const readyDashboard=async()=>{await until('!!document.querySelector(".grade10-dashboard h1")');await until('!document.querySelector("#grade10-programmes [role=status]")');await evaluate('document.fonts.ready')}
  const choose=async(selector,value)=>{await evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await pause(80)}
  const buttonText=async(text)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`)
  const clickProgrammeBody=async()=>{
    const point=await evaluate('(()=>{const card=[...document.querySelectorAll(".g10-programme-card")].find(e=>e.querySelector("h3").textContent==="Computer Science");card.scrollIntoView({block:"center"});const r=card.getBoundingClientRect();return {x:r.left+20,y:r.top+r.height*.6}})()')
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
  }
  const fits=async()=>evaluate(`(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,sections:document.querySelectorAll('.grade10-dashboard > section').length,offenders:[...document.querySelectorAll('.grade10-dashboard :is(h1,h2,h3,h4,button,select,a,.g9-tile)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.textContent.slice(0,60)),smallButtons:[...document.querySelectorAll('.grade10-dashboard .g9-button,.grade10-dashboard button.g9-text-button,.grade10-dashboard .via-shared-save')].filter(e=>e.getBoundingClientRect().height<43).length}))()`)
  const modalFits=async()=>evaluate('(()=>{const d=document.querySelector(".g10-programme-dialog"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1})()')
  const savedNavigation=async()=>{if(await evaluate('getComputedStyle(document.querySelector(".via-workspace-mobile-menu")).display!=="none"')){await click('button[aria-label="Open navigation"]');await click('.via-workspace-navigation-dialog button[aria-label="Saved Programmes"]')}else await click('.via-workspace-sidebar button[aria-label="Saved Programmes"]');await until('!!document.querySelector(".via-workspace-feature-dialog[open]")')}
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    saved=[];setup();await navigate('/dashboard');await readyDashboard()
    assert.deepEqual(await fits(),{overflow:false,sections:8,offenders:[],smallButtons:0},width+'x'+height)
    const text=await evaluate('document.querySelector(".grade10-dashboard").innerText')
    assert(text.includes('Hi, Fixture')&&text.includes('Afrikaans — 59%')&&text.includes('Keep working'))
    assert(text.includes('Health Sciences')&&text.includes('Your subjects open different pathways.'))
    assert(!/NSFAS|Application Readiness|Top VIA Matches|application deadlines|Fake Published Programme/.test(await evaluate('document.body.innerText')))
    await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="View All Results").click()');await until('!!document.querySelector(".via-workspace-feature-dialog[open]")')
    assert(await evaluate('document.querySelector(".via-workspace-feature-dialog").textContent.includes("Afrikaans · 59% · Keep working")'))
    await click('button[aria-label="Close details"]')
    await choose('#g10-programme-select',programme.id);await choose('#g10-offering-select',programme.id)
    assert(await evaluate('document.querySelector(".g9-check-result").textContent.includes("72%")&&document.querySelector(".g9-check-result").textContent.includes("60%+")&&document.querySelector(".g9-check-result").textContent.includes("on track for this subject")'))
    await choose('#g10-offering-select',second.id)
    assert(await evaluate('document.querySelector(".g9-check-result").textContent.includes("75%+")&&document.querySelector(".g9-check-result").textContent.includes("Work towards this example")'))
    await clickProgrammeBody();await until('!!document.querySelector(".g10-programme-dialog[open]")')
    assert(await modalFits(),'Programme modal '+width+'x'+height)
    await click('.g10-programme-dialog .via-programme-offering-toggle')
    assert(await modalFits(),'Expanded programme modal '+width+'x'+height)
    if(width===375&&height===812||width===1440)await screenshot('programme-modal-'+width)
    await evaluate('document.querySelectorAll(".g10-programme-dialog .via-programme-offering-toggle")[1].click()')
    assert.equal(await evaluate('document.querySelectorAll(".g10-programme-dialog .via-programme-offering.is-expanded").length'),1)
    await click('button[aria-label="Close Programme details"]')
    await buttonText('Explore More Careers');assert.equal(await evaluate('document.querySelectorAll("#grade10-careers .g9-tile").length'),6)
    assert.deepEqual(await fits(),{overflow:false,sections:8,offenders:[],smallButtons:0})
    if(width===375&&height===812||width===1440){
      await click('.g10-programme-card button[aria-label="Save Computer Science"]');await until('[...document.querySelectorAll(".g10-programme-card .via-shared-save")].find(b=>b.getAttribute("aria-label")==="Unsave Computer Science")?.disabled===false')
      assert(!await evaluate('!!document.querySelector(".g10-programme-dialog[open]")'),'Heart must not open modal')
      await buttonText('Computer Science');await until('!!document.querySelector(".g10-programme-dialog[open]")')
      assert(await evaluate('document.querySelector(".g10-programme-dialog .via-shared-save").getAttribute("aria-pressed")==="true"'))
      await click('.g10-programme-dialog .via-shared-save');await until('document.querySelector(".g10-programme-dialog .via-shared-save").getAttribute("aria-pressed")==="false"&&!document.querySelector(".g10-programme-dialog .via-shared-save").disabled')
      await click('button[aria-label="Close Programme details"]')
      assert(await evaluate('[...document.querySelectorAll(".g10-programme-card .via-shared-save")].find(b=>b.getAttribute("aria-label")==="Save Computer Science").getAttribute("aria-pressed")==="false"'))
      await click('.g10-programme-card button[aria-label="Save Computer Science"]');await until('[...document.querySelectorAll(".g10-programme-card .via-shared-save")].find(b=>b.getAttribute("aria-label")==="Unsave Computer Science")?.disabled===false');await pause(300)
      await savedNavigation();await until('document.querySelector(".via-saved-groups").textContent.includes("Computer Science")')
      assert(!await evaluate('document.querySelector(".via-workspace-feature-dialog").textContent.includes("Saved Funding")'))
      await click('button[aria-label="Close details"]')
      await evaluate('window.scrollTo(0,0)');await screenshot('grade10-'+width,true)
    }
    if(width<=760){await click('button[aria-label="Open navigation"]');await click('.via-workspace-navigation-dialog button[aria-label="Requirement Check"]');await until('!document.querySelector(".via-workspace-navigation-dialog[open]")');assert(!await evaluate('!!document.querySelector(".via-workspace-feature-dialog[open]")'))}
  }
  setup(false);await navigate('/dashboard');await readyDashboard()
  assert(await evaluate('document.querySelector("#grade10-results").textContent.includes("Add your latest Grade 10 results")'))
  assert(!await evaluate('document.querySelector("#grade10-results").textContent.includes("No major areas")'))
  assert(!await evaluate('document.querySelector(".g9-check-result").textContent.includes("currently on track")'))
  setup();draft.journey_answers.report_grade=9;await navigate('/dashboard');await readyDashboard()
  assert(await evaluate('document.querySelector("#grade10-results").textContent.includes("Grade 9")'))
  assert(!await evaluate('document.querySelector(".g9-check-result").textContent.includes("currently on track")'))
  setup();draft.journey_answers.school_subject_ids=['g10-qa-7','g10-qa-4'];draft.journey_answers.results=[{subject_id:'g10-qa-7',mark:90},{subject_id:'g10-qa-4',mark:70}];await navigate('/dashboard');await readyDashboard()
  assert.equal(await evaluate('document.querySelectorAll("#grade10-pathways .g9-tile").length'),0)
  await choose('#g10-programme-select',programme.id);assert(await evaluate('document.querySelector(".g9-check-result").textContent.includes("not in your saved subjects")'))
  setup(false);draft.journey_answers.school_subject_ids=[];await navigate('/dashboard');await readyDashboard()
  assert.equal(await evaluate('document.querySelectorAll(".g10-programme-card").length'),0)
  failRequirements=true;setup();await navigate('/dashboard');await readyDashboard();await until('!!document.querySelector("#grade10-programmes [role=alert]")')
  failRequirements=false;await buttonText('Retry programmes');await until('!!document.querySelector(".g10-programme-card")')
  catalogueFixtures=[];await navigate('/dashboard');await readyDashboard();assert(await evaluate('document.querySelector("#grade10-check").textContent.includes("No published programme examples")'))
  catalogueFixtures=normalCatalogue;setup();await navigate('/dashboard');await readyDashboard();await choose('#g10-programme-select',programme.id)
  await evaluate('[...document.querySelectorAll("a")].find(a=>a.textContent.includes("Compare Institutions")).click()');await until('location.pathname==="/programmes"&&!!document.querySelector(".via-programme-details")');assert.equal(await evaluate('new URLSearchParams(location.search).get("opportunity")'),programme.id)
  await navigate('/dashboard');await readyDashboard();await evaluate('[...document.querySelectorAll("a")].find(a=>a.textContent.includes("Update My Subjects")).click()');await until('location.pathname==="/onboarding/school-subjects"&&!!document.querySelector(".via-journey-question")');await pause(800)
  assert.equal(uploads,0);assert.equal(writes,6);assert.deepEqual(errors,[])
  console.log('PASS: Grade 10 eight sections at nine viewport sizes, programme/expanded modals, card/modal/save-dashboard synchronisation, institution-specific comparisons, subject/mark gaps, previous-grade protection, catalogue failure/retry, empty data and navigation. All writes intercepted.')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
