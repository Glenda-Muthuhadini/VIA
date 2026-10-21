// Browser/SDK integration tests. Supabase HTTP calls are intercepted with fixtures;
// this runner never creates real accounts, changes real passwords or sends emails.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { options } from '../tests/onboarding-fixture.mjs'

const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const api = new URL(env.VITE_SUPABASE_URL)
const storageKey = `sb-${api.hostname.split('.')[0]}-auth-token`
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const output = path.resolve('node_modules/.tmp/via-auth-qa')
await fs.mkdir(output, { recursive: true })
const browser = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--remote-debugging-port=9338',
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
const profile = { id: user.id, first_name: 'TestUser', last_name: 'VIA', education_stage: 'grade_12', education_stage_confirmation_required: false, created_at: user.created_at, updated_at: user.created_at }
const calls = { signup: [], recovery: [], resend: 0, update: 0, logout: 0 }
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
  const responseHeaders = [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'X-Supabase-Api-Version', value: '2024-01-01' },
    { name: 'Access-Control-Allow-Origin', value: '*' },
    { name: 'Access-Control-Expose-Headers', value: 'X-Supabase-Api-Version' },
    { name: 'Access-Control-Allow-Headers', value: Object.entries(params.request.headers).find(([key]) => key.toLowerCase() === 'access-control-request-headers')?.[1] || 'authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer,x-retry-count' },
    { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
  ]
  if (params.request.method === 'OPTIONS') {
    await send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: 204, responseHeaders })
    return
  }
  const url = new URL(params.request.url)
  const body = params.request.postData ? JSON.parse(params.request.postData) : {}
  let status = 200
  let response = {}
  if (url.pathname.endsWith('/token')) {
    if (body.password === 'Unconfirmed123!') { status = 400; response = { code: 'email_not_confirmed', message: 'Email not confirmed' } }
    else if (body.password !== 'Password123!') { status = 400; response = { code: 'invalid_credentials', message: 'Invalid login credentials' } }
    else response = session
  } else if (url.pathname.endsWith('/signup')) {
    calls.signup.push({ firstName: body.data?.first_name, lastName: body.data?.last_name, redirect: url.searchParams.get('redirect_to') })
    response = { ...user, email: body.email, email_confirmed_at: null }
  } else if (url.pathname.endsWith('/recover')) {
    calls.recovery.push(url.searchParams.get('redirect_to'))
  } else if (url.pathname.endsWith('/resend')) {
    calls.resend += 1
  } else if (url.pathname.endsWith('/logout')) {
    calls.logout += 1
    status = 204
  } else if (url.pathname.endsWith('/user')) {
    if (params.request.method === 'PUT') calls.update += 1
    response = user
  } else if (url.pathname.endsWith('/via_profiles')) {
    response = [profile]
  } else if (url.pathname.endsWith('/via_onboarding_options')) {
    response = options
  } else if (url.pathname.endsWith('/via_onboarding')) {
    response = [{ user_id: user.id, flow_version: 2, answers: {}, current_step: 'ready', revision: 1, completed_at: user.created_at }]
  } else if (url.pathname.endsWith('/via_onboarding_reports') || url.pathname.endsWith('/via_saved_opportunities')) {
    response = []
  } else { status = 400; response = { message: 'Unexpected fixture endpoint' }; errors.push(`Unexpected API endpoint ${url.pathname}`) }
  await send('Fetch.fulfillRequest', { requestId: params.requestId, responseCode: status,
    responseHeaders,
    body: status === 204 ? '' : Buffer.from(JSON.stringify(response)).toString('base64') })
}
async function go(route, signedIn = false) {
  await evaluate(`localStorage.clear();sessionStorage.clear();${signedIn ? `localStorage.setItem(${JSON.stringify(storageKey)},${JSON.stringify(JSON.stringify(session))});` : ''}`)
  await send('Page.navigate', { url: origin + route })
  await until(`document.readyState === 'complete' && document.querySelector('.via-product-page,.via-workspace') !== null`)
  await pause(100)
}
async function fill(selector, value) {
  await evaluate(`(() => {const input=document.querySelector(${JSON.stringify(selector)});input.focus();input.value='';})()`)
  await send('Input.insertText', { text: value })
}
async function submit() { await evaluate(`document.querySelector('button[type="submit"]').click()`) }

try {
  let target
  for (let attempt = 0; attempt < 60; attempt++) {
    try { target = (await (await fetch('http://127.0.0.1:9338/json/list')).json()).find(item => item.type === 'page'); if (target) break } catch {}
    await pause(150)
  }
  if (!target) throw new Error('Headless Chrome did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
    if (message.method === 'Fetch.requestPaused') void fulfill(message.params).catch(error => errors.push(error.message))
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timeout)
      if (message.error) item.reject(new Error(message.error.message))
      else item.resolve(message.result)
    }
  })
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  await send('Page.enable'); await send('Runtime.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: `${api.origin}/*` }] })
  await send('Page.navigate', { url: origin + '/login' })
  await until(`document.readyState === 'complete' && location.origin === ${JSON.stringify(origin)}`)
  await evaluate('localStorage.clear();sessionStorage.clear()')
  await send('Page.navigate', { url: origin + '/login' })
  await pause(200)
  await until(`document.readyState === 'complete' && document.querySelector('input[type="email"]') !== null`)

  await go('/dashboard')
  await until(`location.pathname === '/login' && new URLSearchParams(location.search).get('next') === '/dashboard'`)
  await fill('input[type="email"]', user.email)
  await fill('input[autocomplete="current-password"]', 'WrongPassword123!')
  await submit()
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('incorrect')`)
  assert.equal(await evaluate(`document.querySelector('button[type="submit"]').disabled`), false)
  await fill('input[autocomplete="current-password"]', 'Password123!')
  await submit()
  await until(`location.pathname === '/dashboard' && document.querySelector('h1')?.textContent.includes('TestUser')`)
  await send('Page.reload')
  await pause(400)
  await until(`location.pathname === '/dashboard' && document.querySelector('h1')?.textContent.includes('TestUser')`)
  await evaluate(`document.querySelector('.via-workspace-profile summary').click();[...document.querySelectorAll('.via-workspace-profile button')].find(button=>button.textContent==='Log out').click()`)
  await until(`location.pathname === '/login'`)
  assert(calls.logout > 0)
  console.log('PASS: private-route guard, invalid login, successful login, profile name, reload and logout')

  await go('/signup?next=%2Fdashboard')
  await fill('input[autocomplete="given-name"]', 'Test')
  await fill('input[autocomplete="family-name"]', 'User')
  await fill('input[type="email"]', 'new-user@example.invalid')
  await fill('input[autocomplete="new-password"]', 'Password123!')
  await fill('input[placeholder="Confirm password"]', 'Password123!')
  await evaluate(`document.querySelector('input[type="checkbox"]').click()`)
  await submit()
  await until(`document.querySelector('[role="status"]')?.textContent.includes('check your email')`)
  assert.equal(calls.signup.at(-1).firstName, 'Test')
  assert.equal(calls.signup.at(-1).lastName, 'User')
  assert.equal(new URL(calls.signup.at(-1).redirect).pathname, '/auth/callback')
  console.log('PASS: signup validation, metadata and confirmation-email path')

  const fragment = `#access_token=${jwt}&refresh_token=fixture-refresh-token&expires_in=3600&token_type=bearer&type=`
  await go('/auth/callback?next=%2Fdashboard' + fragment + 'signup')
  await until(`location.pathname === '/dashboard' && document.querySelector('h1')?.textContent.includes('TestUser')`)
  console.log('PASS: email-confirmation callback establishes session and restores destination')

  await go('/forgot-password')
  await fill('input[type="email"]', user.email)
  await submit()
  await until(`document.querySelector('[role="status"]')?.textContent.includes('If an account exists')`)
  assert.equal(new URL(calls.recovery.at(-1)).pathname, '/reset-password')
  await go('/reset-password' + fragment + 'recovery')
  await until(`document.querySelector('button[type="submit"]')?.textContent.includes('Update password')`)
  await fill('input[placeholder="New password"]', 'DifferentPassword123!')
  await fill('input[placeholder="Confirm new password"]', 'NotMatching123!')
  await submit()
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('do not match')`)
  assert.equal(calls.update, 0)
  await fill('input[placeholder="Confirm new password"]', 'DifferentPassword123!')
  await submit()
  await until(`location.pathname === '/login' && new URLSearchParams(location.search).get('reset') === 'success'`)
  assert.equal(calls.update, 1)
  await go('/reset-password#error=access_denied&error_code=otp_expired')
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('expired')`)
  assert.equal(await evaluate(`document.querySelectorAll('input').length`), 0)
  console.log('PASS: reset-email destination, recovery callback, mismatch validation, password update, logout and expired links')

  await go('/login')
  await fill('input[type="email"]', user.email)
  await fill('input[autocomplete="current-password"]', 'Unconfirmed123!')
  await submit()
  await until(`document.querySelector('[role="alert"]')?.textContent.includes('confirm')`)
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Resend confirmation email').click()`)
  await until(`document.querySelector('[role="status"]')?.textContent.includes('new link')`)
  assert.equal(calls.resend, 1)
  console.log('PASS: unconfirmed email and resend flow')

  const sizes = [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]
  const layouts = []
  for (const route of ['/login','/signup','/forgot-password','/reset-password']) {
    for (const [width,height] of sizes) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      await send('Emulation.setTouchEmulationEnabled', { enabled: width <= 1024 })
      await go(route, route === '/reset-password')
      await until(`document.querySelector('button[type="submit"]') !== null && [...document.images].every(image=>image.complete&&image.naturalWidth>0)`)
      const result = await evaluate(`(() => {
        const elements=[...document.querySelectorAll('form input,form button,.via-login-card,.via-signup-card')].filter(element=>element.getClientRects().length);
        const outside=elements.filter(element=>{const r=element.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(element=>element.tagName);
        const clipped=elements.filter(element=>{const r=element.getBoundingClientRect();let ancestor=element.parentElement;while(ancestor){const style=getComputedStyle(ancestor);if(['hidden','clip'].includes(style.overflowY)){const a=ancestor.getBoundingClientRect();if(r.bottom>a.bottom+1 || r.top<a.top-1)return true}ancestor=ancestor.parentElement}return false}).map(element=>element.tagName);
        return {route:location.pathname,width:innerWidth,height:innerHeight,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,outside,clipped};
      })()`)
      assert.equal(result.route, route)
      assert.equal(result.horizontalOverflow, false, JSON.stringify(result))
      assert.deepEqual(result.outside, [], JSON.stringify(result))
      assert.deepEqual(result.clipped, [], JSON.stringify(result))
      const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
      await fs.writeFile(path.join(output,`${route.slice(1)}-${width}x${height}.png`),Buffer.from(screenshot.data,'base64'))
      layouts.push(result)
    }
    console.log(`PASS: ${route} at seven required widths and two additional height cases`)
  }
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify({mode:'mocked Supabase HTTP; no real emails/accounts',functionalFlows:'passed',layouts,runtimeErrors:errors},null,2))
  console.log(`PASS: 36 responsive cases, no runtime errors. Screenshots and report: ${output}`)
} catch (error) {
  if (socket?.readyState === WebSocket.OPEN) {
    console.error(await evaluate(`JSON.stringify({url:location.pathname,text:document.body.innerText,errors:${JSON.stringify(errors)}})`))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await fs.writeFile(path.join(output, 'failure.png'), Buffer.from(shot.data, 'base64'))
  }
  throw error
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  browser.kill()
}
