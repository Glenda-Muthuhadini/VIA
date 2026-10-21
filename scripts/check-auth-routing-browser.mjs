// Actual React/Supabase SDK, intercepted HTTP. No real accounts or writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { options } from '../tests/onboarding-fixture.mjs'
import { emptyAnswers } from '../src/features/onboarding/services/model.ts'

const env = loadEnv('development', process.cwd(), 'VITE_')
const api = new URL(env.VITE_SUPABASE_URL)
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`
const output = path.resolve('node_modules/.tmp/via-auth-routing-qa')
await fs.mkdir(output, { recursive: true })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const accounts = new Map()
function account(index, stage, completed = true) {
  const id = `81000000-0000-4000-8000-${String(index).padStart(12, '0')}`
  const name = ['Asha', 'Bongi', 'NewLearner', 'Returning'][index - 1]
  const user = { id, aud: 'authenticated', role: 'authenticated', email: `${name}@example.invalid`, email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { first_name: name, last_name: 'Fixture' }, identities: [{ id }] }
  const jwt = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'fixture'].join('.')
  const session = { user, access_token: jwt, refresh_token: id, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600 }
  const profile = { id, first_name: name, last_name: 'Fixture', education_stage: stage, education_stage_confirmation_required: !stage }
  const answers = emptyAnswers()
  answers.journey.interests = ['Technology']
  const record = stage ? { user_id: id, flow_version: 4, current_step: completed ? 'ready' : 'school-details', completed_at: completed ? user.created_at : null, revision: 1, journey_answers: answers, answers, answered_steps: ['welcome','current'], skipped_steps: [], carried_steps: [] } : null
  const result = { id, user, session, profile, record }
  accounts.set(id, result)
  return result
}
const a = account(1, 'grade_9'), b = account(2, 'grade_10'), fresh = account(3, null), unfinished = account(4, 'grade_9', false)
const delays = new Map()
const reads = []
const errors = []
let failRecord = false, wrongOwner = false
let socket, sequence = 0
const pending = new Map()
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--remote-debugging-port=9357', `--user-data-dir=${path.join(output,'chrome-profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`Timed out: ${method}`)) }, 25000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function until(expression) {
  for (let i=0;i<120;i++) { if (await evaluate(expression)) return; await pause(60) }
  throw Error(`Condition failed: ${expression}`)
}
async function fulfill(params) {
  const headers = [{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer,x-retry-count'},{name:'Access-Control-Allow-Methods',value:'GET,POST,PUT,PATCH,DELETE,OPTIONS'}]
  if (params.request.method === 'OPTIONS') return send('Fetch.fulfillRequest', {requestId:params.requestId,responseCode:204,responseHeaders:headers})
  const url = new URL(params.request.url)
  const authorization = Object.entries(params.request.headers).find(([key])=>key.toLowerCase()==='authorization')?.[1]
  let owner
  try { owner = JSON.parse(Buffer.from(authorization.split(' ')[1].split('.')[1], 'base64url')).sub } catch {}
  const id = url.searchParams.get('id')?.replace(/^eq\./,'') || url.searchParams.get('user_id')?.replace(/^eq\./,'') || owner
  const current = accounts.get(id) || a
  let response = [], status = 200
  const body = params.request.postData ? JSON.parse(params.request.postData) : {}
  const endpoint = url.pathname.split('/').at(-1)
  const read = {id,endpoint,start:Date.now(),done:false}
  reads.push(read)
  if (endpoint === 'token') response = [...accounts.values()].find(item=>item.user.email===body.email || item.id===body.refresh_token)?.session || a.session
  else if (endpoint === 'user') response = current.user
  else if (endpoint === 'signup') response = fresh.session
  else if (endpoint === 'logout') status = 204
  else if (endpoint === 'via_profiles') response = [current.profile]
  else if (endpoint === 'via_onboarding') {
    response = current.record ? [wrongOwner ? {...current.record,user_id:fresh.id} : current.record] : []
    if (failRecord) {status=400;response={code:'42501',message:'Fixture read failed'}}
  } else if (endpoint === 'via_onboarding_options') response = options
  else if (['via_onboarding_reports','via_grade9_onboarding','via_grade9_plans','via_saved_opportunities','via_public_opportunities'].includes(endpoint)) response = []
  else { errors.push(`Unexpected endpoint ${endpoint}`); status=400 }
  const delay = delays.get(`${id}:${endpoint}`) ?? delays.get(endpoint) ?? 0
  if (delay) await pause(delay)
  read.done=true
  await send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:status,responseHeaders:headers,body:status===204?'':Buffer.from(JSON.stringify(response)).toString('base64')})
}
async function go(route, current) {
  await evaluate(`localStorage.clear(); sessionStorage.clear(); ${current ? `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(current.session))});` : ''}`)
  await send('Page.navigate',{url:origin+route})
  await until(`document.readyState==='complete' && document.querySelector('main') !== null`)
}
async function dashboard(current) {
  await until(`document.querySelector('.via-workspace')?.dataset.userId===${JSON.stringify(current.id)}`)
  assert.equal(await evaluate(`document.querySelector('.via-workspace').dataset.educationStage`),current.profile.education_stage)
  assert.equal(await evaluate(`document.querySelector('.via-workspace-profile summary').textContent.includes(${JSON.stringify(current.profile.first_name)})`),true)
}
async function switchTo(current) {
  await evaluate(`import('/src/services/supabase.ts').then(({supabase})=>supabase.auth.setSession(${JSON.stringify({access_token:current.session.access_token,refresh_token:current.id})}))`)
}
async function fill(selector, value) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await send('Input.insertText',{text:value})
}
async function checkAudit() {
  const audit = await evaluate('window.dashboardAudit')
  for (const entry of audit) {
    const expected = accounts.get(entry.owner)
    assert(expected?.record?.completed_at, `Unfinished/unknown account rendered: ${JSON.stringify(entry)}`)
    assert.equal(entry.stage, expected.profile.education_stage, JSON.stringify(entry))
    assert(entry.name.includes(expected.profile.first_name), JSON.stringify(entry))
  }
  return audit
}
try {
  let target
  for(let i=0;i<60;i++){try{target=(await(await fetch('http://127.0.0.1:9357/json/list')).json()).find(item=>item.type==='page');if(target)break}catch{}await pause(100)}
  assert(target,'Chrome did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data)
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text)
    if(message.method==='Fetch.requestPaused')void fulfill(message.params).catch(error=>{if(!/Invalid InterceptionId|Session closed/.test(error.message))errors.push(error.message)})
    if(message.id&&pending.has(message.id)){const item=pending.get(message.id);pending.delete(message.id);clearTimeout(item.timer);if(message.error)item.reject(Error(message.error.message));else item.resolve(message.result)}
  })
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
  await send('Page.enable');await send('Runtime.enable')
  await send('Fetch.enable',{patterns:[{urlPattern:`${api.origin}/*`}]})
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.dashboardAudit=[];new MutationObserver(()=>{const root=document.querySelector('.via-workspace');if(root)window.dashboardAudit.push({owner:root.dataset.userId,stage:root.dataset.educationStage,name:root.querySelector('.via-workspace-profile summary')?.textContent||''})}).observe(document,{childList:true,subtree:true,attributes:true,characterData:true});`})
  const initialCleanup = await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear()'})
  await send('Page.navigate',{url:origin+'/login'});await until(`location.origin===${JSON.stringify(origin)} && document.readyState==='complete' && !!document.querySelector('input[type="email"]')`)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:initialCleanup.identifier})

  delays.set('via_profiles',800);delays.set('via_onboarding',600);delays.set('via_saved_opportunities',3500)
  const baseline=reads.length
  await go('/dashboard',a)
  await until(`document.querySelector('[role="status"]') !== null`)
  assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
  await dashboard(a)
  const initial=reads.slice(baseline)
  assert.equal(initial.filter(row=>row.endpoint==='via_profiles').length,1,'Concurrent profile reads must be shared')
  const start=endpoint=>initial.find(row=>row.endpoint===endpoint).start
  assert(Math.abs(start('via_profiles')-start('via_onboarding'))<300,'Profile and onboarding must load in parallel')
  assert.equal(initial.find(row=>row.endpoint==='via_saved_opportunities').done,false,'Slow saved items must not block dashboard rendering')
  await checkAudit()
  console.log('PASS: no default dashboard flash; profile/record reads parallel, one profile request; slow saved items do not block dashboard')

  // An older account's focus refresh resolves after the next account is ready.
  delays.set(`${a.id}:via_onboarding`,2200)
  await evaluate(`window.dispatchEvent(new Event('focus'))`)
  await pause(80)
  await switchTo(b)
  assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
  await dashboard(b);await pause(2400);await dashboard(b);await checkAudit()
  await evaluate(`import('/src/services/supabase.ts').then(({supabase})=>supabase.auth.signOut({scope:'local'}))`)
  await until(`location.pathname==='/login' && !!document.querySelector('input[type="email"]')`)
  assert.equal(await evaluate(`!!document.querySelector('.via-workspace')`),false)
  await fill('input[type="email"]',a.user.email);await fill('input[autocomplete="current-password"]','Password123!')
  await evaluate(`document.querySelector('button[type="submit"]').click()`)
  await dashboard(a);await checkAudit()
  console.log('PASS: account switch, late old responses, logout/login and synchronized card/profile ownership')

  delays.clear()
  await go('/dashboard',fresh)
  await until(`location.pathname==='/onboarding/welcome' && !!document.querySelector('.via-onboarding-welcome')`)
  assert.equal((await checkAudit()).length,0)
  await go('/dashboard',unfinished)
  await until(`location.pathname==='/onboarding/school-details' && !!document.querySelector('select')`)
  assert.equal((await checkAudit()).length,0)
  await go('/auth/callback?next=%2Fdashboard#access_token='+fresh.session.access_token+'&refresh_token='+fresh.id+'&expires_in=3600&token_type=bearer&type=signup')
  await until(`location.pathname==='/onboarding/welcome' && !!document.querySelector('.via-onboarding-welcome')`)
  assert.equal((await checkAudit()).length,0)
  console.log('PASS: direct dashboard and email-confirmation links cannot bypass new or unfinished onboarding')

  await go('/signup?next=%2Fprogrammes')
  await until(`!!document.querySelector('input[autocomplete="given-name"]')`)
  for(const [selector,value] of [['input[autocomplete="given-name"]','NewLearner'],['input[autocomplete="family-name"]','Fixture'],['input[type="email"]',fresh.user.email],['input[autocomplete="new-password"]','Password123!'],['input[placeholder="Confirm password"]','Password123!']])await fill(selector,value)
  await evaluate(`document.querySelector('input[type="checkbox"]').click();document.querySelector('button[type="submit"]').click()`)
  await until(`location.pathname==='/onboarding/welcome' && !!document.querySelector('.via-onboarding-welcome')`)
  assert.equal((await checkAudit()).length,0)
  console.log('PASS: auto-confirm signup always opens onboarding even with a public next destination')

  failRecord=true
  await go('/dashboard',b)
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('could not load')`)
  assert.equal((await checkAudit()).length,0)
  failRecord=false
  await evaluate(`document.querySelector('button').click()`)
  await dashboard(b)
  wrongOwner=true;await go('/dashboard',a)
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('could not load')`)
  assert.equal((await checkAudit()).length,0)
  wrongOwner=false
  console.log('PASS: failed reads and wrong-owner responses fail closed, with working retry')

  const layouts=[]
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,360],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    delays.set('via_onboarding',800)
    await go('/dashboard',a)
    await until(`!!document.querySelector('[role="status"]')`)
    const overflow=await evaluate(`document.documentElement.scrollWidth>innerWidth+1`)
    assert.equal(overflow,false,`${width}x${height} loading overflow`)
    await dashboard(a)
    await checkAudit()
    assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth+1`),false,`${width}x${height} dashboard overflow`)
    failRecord=true;await go('/dashboard',a)
    await until(`!!document.querySelector('[role="alert"]')`)
    assert.equal(await evaluate(`(()=>{const r=document.querySelector('button').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&r.width>=44&&r.height>=44&&r.left>=0&&r.right<=innerWidth})()`),true,`${width}x${height} retry layout`)
    const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,`retry-${width}x${height}.png`),Buffer.from(shot.data,'base64'))
    failRecord=false;layouts.push({width,height,loading:true,dashboard:true,retry:true})
  }
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({mode:'Actual SDK; intercepted HTTP; no real account writes',layouts,errors,checks:'ownership, delayed reads, account switching, signup, confirmation, resume, failure/retry, parallel reads'},null,2))
  console.log('PASS: loading, Grade 9 dashboard and retry at all seven required widths plus two short heights')
}catch(error){if(socket?.readyState===WebSocket.OPEN)console.error(await evaluate(`JSON.stringify({url:location.pathname,text:document.body.innerText,audit:window.dashboardAudit,errors:${JSON.stringify(errors)}})`));throw error}
finally{if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}browser.kill()}
