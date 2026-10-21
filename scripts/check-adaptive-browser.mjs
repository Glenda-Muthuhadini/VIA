// Browser/SDK integration tests. Supabase HTTP calls are intercepted with fixtures;
// this runner never creates real accounts, changes real passwords or sends emails.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { options } from '../tests/adaptive-fixture.mjs'
import { fullAnswers } from '../tests/onboarding-fixture.mjs'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const api = new URL(env.VITE_SUPABASE_URL)
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const output = path.resolve('node_modules/.tmp/via-adaptive-qa')
await fs.mkdir(output, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=9341',
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
let profile = { education_stage: null, education_stage_confirmation_required: true, id: user.id, first_name: 'TestUser', last_name: 'VIA', created_at: user.created_at, updated_at: user.created_at }
let selections = []; let academic = null; let marks = []; const histories = new Map();
let draft = null
let reports = []
let failSave = false
let conflictSave = false
let failLoad = false
let failVerification = false
let saves = 0
const errors = []
const pending = new Map()
let socket
let requestId = 0

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
  const url = new URL(params.request.url)
  const responseHeaders = [
    {name:'Content-Type',value:'application/json'}, {name:'Access-Control-Allow-Origin',value:'*'},
    {name:'X-Supabase-Api-Version',value:'2024-01-01'}, {name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'},
    {name:'Access-Control-Allow-Headers',value:Object.entries(params.request.headers).find(([key])=>key.toLowerCase()==='access-control-request-headers')?.[1] || 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,x-upsert,cache-control,accept-profile,content-profile,prefer,x-retry-count'},
    {name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE,OPTIONS'},
  ]
  let status=200, response={}
  let body={}
  if(params.request.postData?.trim().startsWith('{')) body=JSON.parse(params.request.postData)
  if(params.request.method==='OPTIONS') status=204
  else if(url.pathname.endsWith('/via_onboarding_options')) {
    if(failLoad) {status=503;response={message:'Fixture catalog unavailable'}} else response=options
  } else if(url.pathname.endsWith('/via_onboarding')) {
    if(failVerification && url.searchParams.get('select')==='completed_at') {status=503;response={message:'Fixture verification unavailable'}}
    else response=url.searchParams.get('select')==='completed_at' ? {completed_at:draft?.completed_at} : draft?[draft]:[]
  } else if(url.pathname.endsWith('/via_learner_selections')) response=selections.filter(item=>item.education_stage===profile.education_stage)
  else if(url.pathname.endsWith('/via_academic_records')) response=academic?[academic]:[]
  else if(url.pathname.endsWith('/via_academic_results')) response=marks
  else if(url.pathname.endsWith('/rpc/set_my_education_stage')) {
    if(failSave){status=503;response={message:'Failure'}}
    else if(body.p_expected_revision!==(draft?.revision??0)){status=409;response={code:'40001'}}
    else if(body.p_stage===profile.education_stage&&draft) response=draft
    else {
      if(profile.education_stage) histories.set(profile.education_stage,{academic,marks,selections:structuredClone(selections),branch_state:draft?.branch_state??{}})
      profile.education_stage=body.p_stage;profile.education_stage_confirmation_required=false
      const restored=histories.get(body.p_stage);academic=restored?.academic??null;marks=restored?.marks??[];selections=restored?.selections??[]
      draft={user_id:user.id,answers:draft?.answers??{},flow_version:3,current_step:'current',revision:(draft?.revision??0)+1,answered_steps:['welcome','current'],skipped_steps:[],academic_record_id:academic?.id??null,branch_state:restored?.branch_state??{},completed_at:null,created_at:user.created_at,updated_at:user.created_at};response=draft
    }
  } else if(url.pathname.endsWith('/rpc/save_my_adaptive_onboarding')) {
    if(conflictSave){status=409;response={code:'40001'}}
    else if(failSave){status=503;response={message:'Failure'}}
    else if(body.p_expected_revision!==draft.revision){status=409;response={code:'40001'}}
    else {
      saves++
      if(profile.education_stage==='grade_9') {
        const answer=body.p_answers
        selections=Object.entries({interest:'interest_ids',strength:'personality_ids',available_subject:'school_subject_ids',future_interest:'future_interest_ids'}).flatMap(([kind,key])=>answer[key].map(option_id=>({kind,option_id,education_stage:'grade_9'})))
        academic={id:'academic-fixture',school_name:answer.school_name,academic_year:answer.academic_year,grade:answer.report_grade,report_type:answer.report_type,report_id:answer.report_id};marks=answer.results
      }
      draft={...draft,current_step:body.p_current_step,revision:draft.revision+1,completed_at:body.p_complete?new Date().toISOString():null,answered_steps:body.p_answered_steps,skipped_steps:body.p_skipped_steps,academic_record_id:academic?.id??null,branch_state:{school_subjects_unknown:body.p_answers.school_subjects_unknown??false,future_exploring:body.p_answers.future_exploring??false}};response=draft
    }
  } else if(url.pathname.endsWith('/rpc/save_my_onboarding')) {
    if(conflictSave) {status=409;response={code:'40001',message:'Changed in another tab'}}
    else if(failSave) {status=503;response={message:'Fixture network failure'}}
    else if(body.p_expected_revision!==(draft?.revision??0)) {status=409;response={code:'40001',message:'Stale revision'}}
    else {
      saves++
      draft={user_id:user.id,answers:body.p_answers,current_step:body.p_current_step,revision:(draft?.revision??0)+1,completed_at:body.p_complete?new Date().toISOString():null,created_at:draft?.created_at??new Date().toISOString(),updated_at:new Date().toISOString()}
      response=draft
    }
  } else if(url.pathname.endsWith('/via_onboarding_reports')) {
    if(params.request.method==='POST') reports.unshift({...body,created_at:new Date().toISOString()})
    response=params.request.method==='POST'?reports[0]:reports
  } else if(url.pathname.includes('/storage/v1/object/sign/')) response={signedURL:'/object/sign/via-school-reports/fixture.png?token=fixture'}
  else if(url.pathname.includes('/storage/v1/object/')) response={Key:'fixture',Id:'fixture'}
  else if(url.pathname.endsWith('/via_profiles')) response=[profile]
  else if(url.pathname.endsWith('/user')) response=user
  else if(url.pathname.endsWith('/logout')) status=204
  else if(url.pathname.endsWith('/token')) response=session
  else { status=400;response={message:'Unexpected endpoint'};errors.push(url.pathname) }
  await send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:status,responseHeaders,body:status===204?'':Buffer.from(JSON.stringify(response)).toString('base64')})
}

async function go(route, signedIn = true) {
  await evaluate(`localStorage.clear();sessionStorage.clear();${signedIn ? `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))});` : ''}`)
  await send('Page.navigate', { url: origin + route })
  await until(`document.readyState === 'complete' && document.querySelector('.via-product-page,.via-workspace') !== null`)
  await pause(100)
}
async function fill(selector, value) {
  await evaluate(`(() => {const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.value='';})()`)
  await send('Input.insertText', { text: value })
}

try {
  let target
  for (let attempt = 0; attempt < 60; attempt++) {
    try { target = (await (await fetch('http://127.0.0.1:9341/json/list')).json()).find(item => item.type === 'page'); if (target) break } catch {}
    await pause(150)
  }
  if (!target) throw new Error('Headless Chrome did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
    if (message.method === 'Log.entryAdded' && message.params.entry.text.includes('CORS')) errors.push('Browser CORS failure')
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') void fulfill(message.params).catch(error => {if(!error.message.includes('Invalid InterceptionId')) errors.push(error.message)})
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timeout)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    }
  })
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: `${api.origin}/*` }] })
  await send('Page.navigate', { url: origin + '/login' })
  await until(`document.readyState === 'complete' && location.origin === ${JSON.stringify(origin)}`)
  await evaluate('localStorage.clear();sessionStorage.clear()')
  await send('Page.navigate', { url: origin + '/login' })
  await pause(200)
  await until(`document.readyState === 'complete' && document.querySelector('input[type="email"]') !== null`)

  async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`) }
  async function route(step) { await until(`location.pathname==='/onboarding/${step}' && document.querySelector('${step==='welcome'?'.via-onboarding-content':step==='ready'?'.via-ready-panel':'.via-onboarding-panel'}')!==null`) }
  async function next(step) { await click('.via-onboarding-continue-action');await route(step) }
  async function skip(step) { await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent==='Skip for now').click()`);await route(step) }
  async function chooseStage(label) { await evaluate(`[...document.querySelectorAll('.via-onboarding-option')].find(item=>item.querySelector('strong')?.textContent===${JSON.stringify(label)}).click()`);await until(`document.querySelector('.via-onboarding-save-status')?.textContent==='Progress saved'`); }
  await go('/onboarding/welcome');await route('welcome')
  assert.equal(await evaluate(`document.querySelectorAll('.via-onboarding-step').length`),9)
  await click('.via-onboarding-start');await route('current')
  assert.equal(await evaluate(`document.querySelectorAll('.via-onboarding-option').length`),7)
  await next('current');assert.equal(profile.education_stage,null)
  await chooseStage('Grade 9');assert.equal(profile.education_stage,'grade_9')
  await next('interests');await click('input[aria-label="Technology & Computing"]')
  await next('personality');await click('input[aria-label="Solving problems"]')
  await next('results');assert.equal(selections.length,2)
  await click('.via-onboarding-manual-card button');await until(`document.querySelector('dialog')?.open`)
  await evaluate(`(()=>{let select=document.querySelector('select[aria-label="Subject 1"]');select.value='subject-1';select.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await fill('input[aria-label="Mark 1"]','64');await click('dialog button[type="submit"]');await until(`document.querySelector('dialog')===null`)
  assert.equal(marks[0].mark,64)
  const fixture=path.join(output,'fixture-report.png');await fs.writeFile(fixture,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'))
  const dom=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:dom.root.nodeId,selector:'input[type="file"][accept^="application"]'})
  await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});await until(`document.body.innerText.includes('fixture-report.png') && document.querySelector('.via-onboarding-save-status')?.textContent==='Progress saved'`)
  assert.equal(academic.report_id,reports[0].id);assert.equal(marks[0].mark,64)
  await next('school-subjects');await click('input[aria-label="Mathematics"]');await next('future-curiosity');await click('input[aria-label="Engineering"]')
  await evaluate(`[...document.querySelectorAll('button')].find(item=>item.textContent.includes('Save & finish later')).click()`);await until(`location.pathname==='/dashboard'`)
  assert.equal(draft.current_step,'future-curiosity');assert(selections.some(item=>item.kind==='future_interest'))
  await go('/onboarding/welcome');await click('.via-onboarding-start');await route('future-curiosity')
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Engineering"]').checked`),true)
  await click('.via-onboarding-secondary-action');await route('school-subjects');await next('future-curiosity')
  await next('ready');assert(draft.completed_at)
  assert.equal(await evaluate(`document.querySelector('.via-ready-action').textContent.includes('Build my subject plan')`),true)
  await click('.via-ready-action');await until(`document.querySelector('.via-workspace-feature-dialog')?.open && document.body.innerText.includes('Your Grade 10 Subject Guide')`)
  assert.equal(await evaluate(`document.body.innerText.includes('Build your Grade 10 subject plan')`),true)
  assert.equal(await evaluate(`document.querySelector('.via-workspace-feature-dialog').textContent.includes('Mathematics')`),true)
  const completed=structuredClone(draft), savedAcademic=structuredClone(academic),savedMarks=structuredClone(marks),savedSelections=structuredClone(selections)
  // Authentication resume through the existing login form.
  await go('/onboarding/welcome',false);await until(`location.pathname==='/login'`)
  await fill('input[type="email"]',user.email);await fill('input[type="password"]','Fixture-password-only-123!');await click('button[type="submit"]')
  await route('welcome');await click('.via-onboarding-start');await route('current')
  assert.equal(profile.education_stage,'grade_9')
  await chooseStage('Grade 11');await next('stage-pending');assert.equal(profile.education_stage,'grade_11')
  assert.equal(await evaluate(`document.body.innerText.includes('later update')`),true)
  await go('/onboarding/preferences');await route('stage-pending')
  await click('.via-onboarding-secondary-action');await route('current');await chooseStage('Grade 9');await next('interests')
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Technology & Computing"]').checked`),true)
  assert.equal(reports.length,1)
  // Skip all optional questions; stage alone is sufficient for Grade 9.
  selections=[];academic=null;marks=[];draft={...draft,current_step:'interests',academic_record_id:null,answered_steps:['welcome','current'],skipped_steps:[],completed_at:null}
  await go('/onboarding/interests');await skip('personality');await skip('results');await skip('school-subjects');await skip('future-curiosity');await skip('ready')
  assert.equal(draft.skipped_steps.length,5);assert(draft.completed_at)
  await go('/dashboard');await until(`document.body.innerText.includes('Build your Grade 10 subject plan')`)
  assert.equal(await evaluate(`document.body.innerText.includes('Upload your latest results to unlock your academic analysis.')`),true)
  // Legacy ambiguous stage forces confirmation and retains private report metadata.
  profile.education_stage=null;profile.education_stage_confirmation_required=true;draft={...completed,flow_version:2,answers:{...fullAnswers(),current_id:'current-1'},current_step:'preferences'}
  await go('/onboarding/preferences');await route('current');assert.equal(await evaluate(`document.body.innerText.includes('Please confirm')`),true)
  await chooseStage('Grade 9');assert.equal(draft.answers.current_id,'current-1');assert.equal(reports.length,1)
  await go('/onboarding/results');await route('results');assert.equal(await evaluate(`document.body.innerText.includes('fixture-report.png')`),true)
  // Known legacy profiles keep their v2 flow and historical completion.
  profile.education_stage='grade_11';profile.education_stage_confirmation_required=false;draft={...completed,flow_version:2,answers:{...fullAnswers(),current_id:'current-2'},current_step:'preferences'}
  await go('/onboarding/preferences');await route('preferences');assert.equal(await evaluate(`document.querySelector('.via-onboarding-panel-progress > span').textContent`),'Step 7 of 7')
  console.log('PASS: Grade 9 save/resume, manual results, private upload, Back/Continue/Skip, optional completion, dashboard, login, stage changes, legacy confirmation and legacy flow')
  profile.education_stage='grade_9';profile.education_stage_confirmation_required=false;draft=completed;academic=savedAcademic;marks=savedMarks;selections=savedSelections
  await go('/onboarding/interests');await route('interests')
  failSave=true;await click('input[aria-label="Business & Money"]');await until(`document.querySelector('[role="alert"]')?.textContent.includes('could not save')`)
  await click('.via-onboarding-continue-action');await pause(200);assert.equal(await evaluate(`location.pathname`),'/onboarding/interests')
  failSave=false;await next('personality')
  conflictSave=true;await click('input[aria-label="Working with numbers"]');await until(`document.querySelector('[role="alert"]')?.textContent.includes('another tab')`)
  conflictSave=false;await evaluate(`document.querySelector('.via-onboarding-feedback button').click()`);await until(`document.querySelector('input[aria-label="Working with numbers"]')!==null`)
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Working with numbers"]').checked`),false)
  failLoad=true;await go('/onboarding/welcome');await until(`document.querySelector('.via-onboarding-retry')!==null`);failLoad=false;await click('.via-onboarding-retry');await route('welcome')
  console.log('PASS: failed-save recovery, revision conflict isolation, reload and load-error retry')
  const sizes=[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]
  const layouts=[]
  for(const step of ['welcome','current','interests','personality','results','school-subjects','future-curiosity','ready','stage-pending','dashboard']) {
    profile.education_stage=step==='stage-pending'?'grade_11':'grade_9'
    for(const [width,height] of sizes) {
      draft={...draft,current_step:step==='dashboard'?'ready':step,completed_at:['ready','dashboard'].includes(step)?completed.completed_at:null}
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await send('Emulation.setTouchEmulationEnabled',{enabled:width<=1024})
      await go(step==='dashboard'?'/dashboard':'/onboarding/'+step)
      await until(`document.querySelector('.via-onboarding-content,.via-onboarding-panel,.via-ready-panel,.via-workspace-journey-card')!==null && [...document.images].every(image=>image.complete&&image.naturalWidth>0)`)
      if(step==='dashboard') await until(`document.querySelector('.via-workspace-journey-card h2')?.textContent.includes('Grade 9')`)
      const layout=await evaluate(`(()=>{const elements=[...document.querySelectorAll('button,a,input,.via-onboarding-option')].filter(item=>item.getClientRects().length);return {route:location.pathname,width:innerWidth,height:innerHeight,horizontal:document.documentElement.scrollWidth>innerWidth+1,outside:elements.filter(item=>{const r=item.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(item=>item.tagName),pageHeight:document.documentElement.scrollHeight,mainHeight:document.querySelector('main')?.scrollHeight}})()`)
      assert.equal(layout.route,step==='dashboard'?'/dashboard':'/onboarding/'+step)
      assert.equal(layout.horizontal,false,JSON.stringify(layout));assert.deepEqual(layout.outside,[],JSON.stringify(layout))
      assert.equal(await evaluate(`(()=>{const cards=[...document.querySelectorAll('.via-onboarding-options > *')].map(item=>item.getBoundingClientRect());return cards.every((a,index)=>cards.every((b,other)=>index===other||a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1))})()`),true)
      assert.equal(await evaluate(`(()=>{const action=[...document.querySelectorAll('button,a')].filter(item=>item.getClientRects().length).at(-1);if(!action)return true;action.scrollIntoView({block:'center'});const r=action.getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1})()`),true)
      await evaluate(`window.scrollTo(0,0);document.querySelector('main').scrollTop=0`)
      const screenshot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`${step}-${width}x${height}.png`),Buffer.from(screenshot.data,'base64'));layouts.push(layout)
      if(step==='results') {
        await click('.via-onboarding-manual-card button');await until(`document.querySelector('dialog')?.open`)
        assert.equal(await evaluate(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();d.scrollTop=d.scrollHeight;return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth+1&&d.querySelector('button[type="submit"]').getBoundingClientRect().bottom<=d.getBoundingClientRect().bottom+1})()`),true)
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await until(`document.querySelector('dialog')===null`)
      }
      if(step==='dashboard') {
        await click('.via-workspace-journey-card > .via-workspace-primary');await until(`document.querySelector('.via-workspace-feature-dialog').open`)
        assert.equal(await evaluate(`(()=>{const d=document.querySelector('.via-workspace-feature-dialog'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&d.scrollWidth<=d.clientWidth+1})()`),true)
        await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await until(`!document.querySelector('.via-workspace-feature-dialog').open`)
      }
    }
    console.log(`PASS: ${step} at all seven widths and two short heights`)
  }
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({mode:'Intercepted Supabase fixture; SQL tested separately',functional:'passed',saves,layouts,errors},null,2))


} catch(error) {
  if(socket?.readyState===WebSocket.OPEN) {
    console.error(await evaluate(`JSON.stringify({route:location.pathname,text:document.body.innerText,errors:${JSON.stringify(errors)}})`))
    const shot=await send('Page.captureScreenshot',{format:'png'})
    await fs.writeFile(path.join(output,'failure.png'),Buffer.from(shot.data,'base64'))
  }
  throw error
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser.kill()
}
