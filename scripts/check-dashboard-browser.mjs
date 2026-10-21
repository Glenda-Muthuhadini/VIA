// Browser/SDK integration tests. Supabase HTTP calls are intercepted with fixtures;
// this runner never creates real accounts, changes real passwords or sends emails.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { options, fullAnswers } from '../tests/onboarding-fixture.mjs'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const api = new URL(env.VITE_SUPABASE_URL)
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const output = path.resolve('node_modules/.tmp/via-dashboard-content-qa')
await fs.mkdir(output, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=9340',
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
const profile = { id: user.id, first_name: 'TestUser', last_name: 'VIA', created_at: user.created_at, updated_at: user.created_at }
function makeLearner(stage='current-2', marks=true, completed=true) {
  profile.education_stage=stage==='current-2'?'grade_11':stage==='current-3'?'grade_12':null
  profile.education_stage_confirmation_required=!profile.education_stage
  const answers=fullAnswers();answers.current_id=stage;
  answers.results=marks ? [{subject_id:'subject-1',mark:45},{subject_id:'subject-17',mark:72},{subject_id:'subject-16',mark:60}] : [];
  return {user_id:user.id,answers,current_step:'ready',revision:1,completed_at:completed?new Date().toISOString():null,created_at:user.created_at,updated_at:user.created_at}
}
let learner=makeLearner()
let failLoad=false
let readDelay=0
let unexpectedWrites=0
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
  const url=new URL(params.request.url)
  const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},
    {name:'Access-Control-Allow-Headers',value:Object.entries(params.request.headers).find(([key])=>key.toLowerCase()==='access-control-request-headers')?.[1]||'authorization,apikey,content-type,x-client-info,accept-profile'},
    {name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'X-Supabase-Api-Version',value:'2024-01-01'},{name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'}]
  let response={},status=200
  if(params.request.method==='OPTIONS') status=204
  else if(url.pathname.endsWith('/via_profiles')) response=[{...profile,education_stage:({'current-2':'grade_11','current-3':'grade_12','current-4':'post_matric','current-5':'tertiary'})[learner?.answers.current_id]??null,education_stage_confirmation_required:false}]
  else if(url.pathname.endsWith('/via_onboarding_options')) {
    if(readDelay) await pause(readDelay)
    if(failLoad) {status=400;response={code:'PGRST205',message:'Fixture load failure'}} else response=options
  } else if(url.pathname.endsWith('/via_onboarding')) response=learner?[learner]:[]
  else if(url.pathname.endsWith('/via_onboarding_reports')||url.pathname.endsWith('/via_saved_opportunities')) response=[]
  else if(url.pathname.endsWith('/user')) response=user
  else if(url.pathname.endsWith('/logout')) status=204
  else if(url.pathname.endsWith('/token')) response=session
  else {status=400;response={message:'Unexpected endpoint'};errors.push(url.pathname)}
  if(params.request.method!=='GET'&&params.request.method!=='OPTIONS'&&!url.pathname.endsWith('/logout')&&!url.pathname.endsWith('/token')) unexpectedWrites++
  await send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:status,responseHeaders:headers,body:status===204?'':Buffer.from(JSON.stringify(response)).toString('base64')})
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
    try { target = (await (await fetch('http://127.0.0.1:9340/json/list')).json()).find(item => item.type === 'page'); if (target) break } catch {}
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
  await send('Page.navigate', { url: origin + '/login' })
  await until(`document.readyState === 'complete' && location.origin === ${JSON.stringify(origin)}`)
  await evaluate('localStorage.clear();sessionStorage.clear()')
  await send('Page.navigate', { url: origin + '/login' })
  await pause(200)
  await until(`document.readyState === 'complete' && document.querySelector('input[type="email"]') !== null`)

  async function click(selector) { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`) }
  async function dashboard() {
    await go('/dashboard')
    await until(`document.querySelector('.via-workspace-journey-card h2')?.textContent.includes(${JSON.stringify('Grade')}) || document.querySelector('[role="alert"]')!==null`)
    await until(`!document.querySelector('.via-workspace-journey-card h2')?.textContent.includes('Loading')`)
  }
  async function closeDialog() {
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27})
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27})
    await until(`!document.querySelector('.via-workspace-feature-dialog').open && !document.querySelector('.via-workspace-navigation-dialog').open && document.querySelector('#via-feature-title')===null`)
  }
  await dashboard()
  assert.equal(await evaluate(`document.querySelector('.via-workspace-journey-card h2').textContent.includes('Grade 11')`),true)
  assert.equal(await evaluate(`document.querySelector('.via-workspace-journey-card h2').textContent.includes('Data Science')`),true)
  assert.equal(await evaluate(`document.querySelectorAll('.via-workspace-auth-notice').length`),0)
  assert.equal(await evaluate(`document.querySelector('.via-workspace-academic-results').textContent.includes('45%')`),true)
  assert.equal(await evaluate(`document.body.innerText.includes('92%')||document.body.innerText.includes('64%')||/sample|demo|Computer Science/.test(document.body.innerText)`),false)
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.via-workspace-stat-copy h2')].map(element=>element.textContent)`),['VIA Matches','Application Readiness','Funding','Saved'])
  assert.equal(await evaluate(`document.querySelectorAll('.via-workspace-stat-copy strong').length`),4)
  await until(`document.querySelectorAll('.via-workspace-stat-copy strong')[3]?.textContent==='0'`)
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.via-workspace-stat-copy strong')].map(element=>element.textContent)`),['\u2014','\u2014','\u2014','0'])
  await click('.via-workspace-journey-card > .via-workspace-primary')
  await until(`document.querySelector('.via-workspace-feature-dialog').open && document.querySelector('.via-workspace-whatif')!==null`)
  const answersBefore=JSON.stringify(learner.answers)
  await evaluate(`(()=>{const slider=document.querySelector('#via-whatif-target');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(slider,'75');slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelector('output')?.textContent==='75%'`)
  assert.equal(await evaluate(`document.querySelector('.via-workspace-whatif-outcome').textContent.includes('No new matches or eligibility changes')`),true)
  assert.equal(JSON.stringify(learner.answers),answersBefore)
  await closeDialog()
  await click('.via-workspace-academic-results button');await until(`document.querySelector('.via-workspace-whatif')!==null`);await closeDialog()
  await fill('.via-workspace-search input','Data Science')
  await until(`document.querySelector('.via-workspace-search-results button')?.textContent.includes('Data Science')`)
  await click('.via-workspace-search-results button');await until(`document.querySelector('#via-feature-title')?.textContent==='Saved Programmes'`);await closeDialog()
  for(const label of ['VIA Match','VIA Scan','VIA Progress','Institutions','Programmes','Funding','Accommodation','VIA Vault','Settings']) {
    await evaluate(`document.querySelector(${JSON.stringify(`.via-workspace-sidebar button[aria-label="${label}"]`)}).click()`)
    await until(`document.querySelector('.via-workspace-feature-dialog').open`)
    await closeDialog()
  }
  console.log('PASS: real learner fields, no sample data/counts, grouped navigation, conditional banner, academic insights, read-only What-If and search')

  learner=makeLearner('current-3',false,true);await dashboard()
  assert.equal(await evaluate(`document.querySelector('.via-workspace-auth-notice').textContent.includes('Upload your latest results')`),true)
  assert.equal(await evaluate(`document.querySelector('[aria-labelledby="via-academic-title"]').textContent.includes('Upload your latest results to unlock your academic analysis.')`),true)
  learner=null;await go('/dashboard');await until(`location.pathname==='/onboarding/welcome'`)
  assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
  failLoad=true;await dashboard()
  assert.equal(await evaluate(`document.querySelector('[role="alert"]').textContent.includes('could not load')`),true)
  failLoad=false;learner=makeLearner();await click('button')
  await until(`document.querySelector('.via-workspace-academic-results')!==null && document.querySelectorAll('.via-workspace-auth-notice').length===0`)
  console.log('PASS: missing-results and incomplete setup states, load error/retry, no invented grade or marks')

  const sizes=[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]
  const layouts=[]
  for(const scenario of ['grade11','grade12','no-results','incomplete']) {
    for(const [width,height] of sizes) {
      learner=scenario==='incomplete'?null:makeLearner(scenario==='grade12'?'current-3':'current-2',scenario!=='no-results')
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
      await send('Emulation.setTouchEmulationEnabled',{enabled:width<=1024})
      if(scenario==='incomplete'){
        await go('/dashboard');await until(`location.pathname==='/onboarding/welcome' && !!document.querySelector('.via-onboarding-welcome')`)
        assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
      }else await dashboard()
      await until(`[...document.images].every(image=>image.complete&&image.naturalWidth>0)`)
      const result=await evaluate(`(()=>{const elements=[...document.querySelectorAll('.via-workspace-main button,.via-workspace-stat-card,.via-workspace-detail-card,.via-workspace-search')].filter(element=>element.getClientRects().length);const outside=elements.filter(element=>{const r=element.getBoundingClientRect();return r.left < -1||r.right>innerWidth+1}).map(element=>element.className);const overlaps=[];const cards=[...document.querySelectorAll('.via-workspace-stat-card,.via-workspace-detail-card')];for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i].getBoundingClientRect(),b=cards[j].getBoundingClientRect();if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1)overlaps.push([i,j])}return {width:innerWidth,height:innerHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,outside,overlaps}})()`)
      assert.equal(result.horizontalOverflow,false,JSON.stringify(result));assert.deepEqual(result.outside,[],JSON.stringify(result));assert.deepEqual(result.overlaps,[],JSON.stringify(result))
      const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await fs.writeFile(path.join(output,`${scenario}-${width}x${height}.png`),Buffer.from(shot.data,'base64'))
      layouts.push({scenario,...result})
      if(scenario==='grade11') {
        await evaluate(`document.querySelector('.via-workspace-academic-results button').click()`)
        await until(`document.querySelector('.via-workspace-whatif')!==null`)
        const modal=await evaluate(`(()=>{const d=document.querySelector('.via-workspace-feature-dialog'),r=d.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth+1}})()`)
        assert(modal.left>=0&&modal.right<=width&&modal.top>=0&&modal.bottom<=height&&!modal.overflow,JSON.stringify(modal))
        await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9})
        assert.equal(await evaluate(`document.querySelector('.via-workspace-feature-dialog').contains(document.activeElement)`),true)
        const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`whatif-${width}x${height}.png`),Buffer.from(shot.data,'base64'))
        await closeDialog()
        if(width<=760) {
          await click('.via-workspace-mobile-menu');await until(`document.querySelector('.via-workspace-navigation-dialog').open`)
          await evaluate(`document.querySelector('.via-workspace-navigation-dialog button[aria-label="Settings"]').scrollIntoView()`)
          assert.equal(await evaluate(`(()=>{const d=document.querySelector('.via-workspace-navigation-dialog'),r=d.getBoundingClientRect(),b=d.querySelector('button[aria-label="Settings"]').getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom+1})()`),true)
          await closeDialog()
        }
      }
    }
    console.log(`PASS: ${scenario} at seven required widths and two additional heights`)
  }
  const originalStage=options.find(option=>option.id==='current-1').label
  for(const grade of ['9','10','9 - 10']) {
    options.find(option=>option.id==='current-1').label='Grade '+grade;learner=makeLearner('current-1');await go('/dashboard')
    await until(`location.pathname==='/onboarding/current'`)
    assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
  }
  options.find(option=>option.id==='current-1').label=originalStage
  assert.equal(unexpectedWrites,0)
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({mode:'Mocked Supabase fixtures; no real account changes',functionalFlows:'passed',layouts,whatIfLayouts:9,runtimeErrors:errors,unexpectedWrites},null,2))
  console.log('PASS: 36 dashboard layouts + 9 What-If dialogs; keyboard/mobile navigation, grade-aware states, no runtime errors or writes')
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
