// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-journey-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9375', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9375/json')).json(); break } catch { await pause(100) } }
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
  const stages=['grade_10','grade_11','grade_12','post_matric','accepted','tertiary']
  const user={id:'91000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'journey-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'}
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url'),now=Math.floor(Date.now()/1000)
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})+'.'+encode({fixture:true})
  const session={user,access_token:token,refresh_token:'fixture-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer'}
  const institution={id:'81000000-0000-4000-8000-000000000001',kind:'institutions',title:'Fixture University'}
  const programme={id:'82000000-0000-4000-8000-000000000001',kind:'programmes',title:'BSc Computer Science',institution_id:institution.id,institution_name:institution.title,campus:'Fixture Campus',qualification:'Bachelor',duration:'3 years',field:'Technology',career_keywords:['Software developer'],cycles:[],requirements:[],is_demo:false}
  let profile,draft,reports=[],failSave=false,writes=0,uploads=0
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
    else if(url.pathname.endsWith('/via_grade9_onboarding')||url.pathname.endsWith('/via_grade9_plans'))body=[]
    else if(url.pathname.endsWith('/via_onboarding'))body=draft?[draft]:[]
    else if(url.pathname.endsWith('/via_onboarding_reports')){
      if(request.method==='POST'){const row=await payload();reports=[{...row,created_at:'2026-10-20T12:00:00Z'},...reports];body=reports[0]}else body=reports
    }else if(url.pathname.endsWith('/via_public_opportunities'))body=[institution,programme].filter(row=>!url.searchParams.has('kind')||url.searchParams.get('kind')==='eq.'+row.kind).map(document=>({document}))
    else if(url.pathname.endsWith('/via_saved_opportunities'))body=[]
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
  const ready=async()=>until('!!document.querySelector(".via-onboarding-panel,.via-onboarding-content,.via-ready-panel")')
  const next=async()=>{await click('.via-onboarding-continue-action');await pause(150)}
  const layout=async(width,height,label)=>{
    await until('!!document.querySelector("main h1")')
    const result=await evaluate('(()=>{const h=document.querySelector("h1"),r=h.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1,titleWidth:r.width,invalid:[...document.querySelectorAll("main :is(h1,h2,label,button,input:not([type=checkbox]):not([type=radio]):not([hidden]),select,fieldset)")].some(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)})}})()')
    if(result.overflow){await screenshot('layout-failure');console.log(await evaluate('JSON.stringify({page:document.documentElement.scrollWidth,main:document.querySelector("main").scrollWidth,offenders:[...document.querySelectorAll("main *")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}).map(e=>({class:e.className,text:e.innerText?.slice(0,60),width:e.getBoundingClientRect().width})).slice(0,20)})'))}
    assert(!result.overflow&&!result.invalid&&result.titleWidth>0,JSON.stringify({width,height,label,...result}))
    const button=await evaluate('(()=>{const b=document.querySelector(".via-onboarding-continue-action,.via-ready-action,.via-onboarding-start");b.scrollIntoView({block:"center"});const r=b.getBoundingClientRect();return {visible:r.top>=0&&r.bottom<=innerHeight+1,height:r.height}})()')
    assert(button.visible&&button.height>=44,JSON.stringify({width,height,label,...button}))
  }
  if(!process.argv.includes('--flows-only'))for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]].filter(([width,height])=>!process.argv.includes('--remaining-layouts')||width>=1280||height===480)){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    initialise(null,false);await navigate('/onboarding/welcome');await ready();await layout(width,height,'welcome')
    await click('.via-onboarding-start');await until('location.pathname==="/onboarding/current"&&document.querySelectorAll(".via-adaptive-stage-options button").length===7');await layout(width,height,'stage')
    for(const stage of stages){
      const flow=getFlow(stage)
      for(const {id} of flow.steps.filter(row=>!['welcome','current'].includes(row.id))){
        initialise(stage,true,id);await navigate('/onboarding/'+id);await ready()
        await until('!document.querySelector(".via-journey-question [role=status]")')
        await layout(width,height,stage+'/'+id)
        if((width===375&&height===812||width===1440)&&['applications','funding','institution','support'].includes(id))await screenshot(stage+'-'+id+'-'+width)
        if(id==='results'){
          await click('.via-onboarding-manual-card button');await until('!!document.querySelector(".via-manual-results-dialog[open]")')
          const fits=await evaluate('(()=>{const d=document.querySelector(".via-manual-results-dialog"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1})()');assert(fits,'Manual results at '+width+'x'+height)
          await click('button[aria-label="Close results"]')
        }
      }
      initialise(stage,true,'ready',true);await navigate('/onboarding/ready');await ready();await layout(width,height,stage+'/ready')
    }
    console.log('PASS layouts: '+width+'x'+height)
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false})
  for(const stage of stages){
    initialise(stage,true);await navigate('/onboarding/current');await ready();await next()
    for(const {id} of getFlow(stage).steps.filter(row=>!['welcome','current'].includes(row.id))){await until('location.pathname==='+JSON.stringify('/onboarding/'+id));await next()}
    await until('location.pathname==="/onboarding/ready"&&!!document.querySelector(".via-ready-action")')
    assert(draft.completed_at);assert.equal(await evaluate('document.querySelector(".via-ready-action").textContent.trim()'),'Go to My Dashboard')
    await click('.via-ready-action');await until('location.pathname==="/dashboard"&&!!document.querySelector(".via-workspace")')
    await navigate('/onboarding/welcome');await ready();assert.equal(await evaluate('document.querySelector(".via-onboarding-start").getAttribute("href")'),'/dashboard')
  }
  initialise('grade_10',false,'results');await navigate('/onboarding/results');await ready()
  await evaluate(`(()=>{const input=[...document.querySelectorAll('input[type=file]')].find(e=>e.accept.includes('pdf'));const data=new DataTransfer();data.items.add(new File(['%PDF-1.4 fixture only'], 'fixture-report.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until('document.querySelector(".via-onboarding-report-summary")?.textContent.includes("fixture-report.pdf")')
  assert.equal(uploads,1);assert.equal(draft.journey_answers.report_id,reports[0].id);assert.equal(draft.journey_answers.report_grade,10)
  initialise('grade_12',true,'results');await navigate('/onboarding/results');await ready()
  const original=JSON.stringify(draft.journey_answers)
  const addLatest=async()=>evaluate('[...document.querySelectorAll("button")].find(button=>button.textContent.includes("Add Latest Grade 12 Results")).click()')
  await addLatest();await until('!!document.querySelector(".via-manual-results-dialog[open]")')
  assert.equal(await evaluate('document.querySelector(".via-manual-school-fields select").value'),'12')
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Mark 1"]').value`),'')
  await click('button[aria-label="Close results"]');await pause(800);assert.equal(JSON.stringify(draft.journey_answers),original,'Cancelling an additional Grade 12 report must preserve Grade 11 results')
  await addLatest();await until('!!document.querySelector(".via-manual-results-dialog[open]")')
  await send('Emulation.setDeviceMetricsOverride',{width:375,height:360,deviceScaleFactor:1,mobile:false})
  await evaluate(`(()=>{const select=document.querySelector('select[aria-label="Subject 1"]');select.value='subject-1';select.dispatchEvent(new Event('change',{bubbles:true}));const input=document.querySelector('input[aria-label="Mark 1"]');input.focus();input.scrollIntoView({block:'center'});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'75');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  assert(await evaluate('(()=>{const d=document.querySelector(".via-manual-results-dialog"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1})()'),'Manual form remains usable with reduced keyboard height')
  await click('.via-manual-results-dialog button[type=submit]');await until('!document.querySelector(".via-manual-results-dialog")')
  assert.equal(draft.journey_answers.report_grade,12);assert.equal(draft.journey_answers.results[0].mark,75);assert.equal(draft.journey_answers.academic_year,null)
  initialise('tertiary',true,'year-of-study',true);await navigate('/onboarding/year-of-study');await ready();await click('input[value="Second year"]');await next();await until('location.pathname==="/dashboard"')
  assert.equal(draft.journey_answers.journey.year_of_study,'Second year');assert.equal(draft.journey_answers.journey.support[0],'Academic support')
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    for(const stage of ['grade_9','post_matric','accepted','tertiary']){
      initialise(stage,true,'ready',true);await navigate('/dashboard');await until('!!document.querySelector(".via-workspace")')
      const fits=await evaluate('document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll(".via-workspace-journey-card h2,.via-workspace-greeting h1")].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})')
      assert(fits,'Stage dashboard layout: '+stage+' '+width+'x'+height)
      if(['accepted','tertiary'].includes(stage))assert.equal(await evaluate('document.body.innerText.includes("Upload your latest results to unlock")'),false)
      if(stage==='tertiary'&&(width===375&&height===812||width===1440))await screenshot('student-dashboard-'+width)
    }
  }
  console.log('PASS: additional Grade 12 report cancellation/save, reduced keyboard viewport and student year update without repeating support questions.')
  console.log('PASS: six unchanged non-Grade-9 complete flows, dashboard return without repeated onboarding, report upload, additional Grade 12 results and student progression. Grade 9 is tested by check-grade9-onboarding-browser.mjs. Intercepted writes: '+writes)
  assert.deepEqual(errors,[])
  await evaluate('(async()=>{const {supabase}=await import("/src/services/supabase.ts");await supabase.auth.signOut({scope:"local"})})()')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
