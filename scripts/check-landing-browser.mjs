// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-landing-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9362', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket, sequence = 0
const pending = new Map(), errors = [], layouts = []
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
  throw Error('Condition not met: ' + expression)
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9362/json')).json(); break } catch { await pause(100) } }
  assert(tabs, 'Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result) } }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  await send('Page.enable'); await send('Runtime.enable')
  for (const [width, height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    for (const route of ['/', '/nsfas', '/guides', '/guides/understanding-aps', '/about', '/contact']) {
      await navigate(route)
      const result = await evaluate(`(() => {
        const visible = e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 }
        const outside = [...document.querySelectorAll('h1,h2,h3,p,section,article,form,input,textarea,.via-explore-option,.via-landing-reason-card')].filter(visible).filter(e => {const r=e.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(e=>e.className||e.tagName)
        const clipped = [...document.querySelectorAll('h1,h2,h3,p,input,textarea')].filter(visible).filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className||e.tagName)
        return {overflow:document.documentElement.scrollWidth>innerWidth+1,outside,clipped,h1:document.querySelector('h1').innerText}
      })()`)
      layouts.push({ width, height, route, ...result })
      assert(!result.overflow && !result.outside.length && !result.clipped.length, JSON.stringify(layouts.at(-1)))
      if (route === '/') {
        assert.equal(await evaluate(`document.querySelectorAll('.via-explore-option').length`), 5)
        assert.equal(await evaluate(`document.querySelectorAll('.via-landing-step-card').length`), 5)
        assert.equal(await evaluate(`document.querySelectorAll('.via-landing-choice-risk').length`), 0)
        assert.equal(await evaluate(`document.querySelectorAll('.via-landing-ecosystem .via-landing-reason-card').length`), 6)
        const menuVisible = await evaluate(`getComputedStyle(document.querySelector('.via-site-menu-toggle')).display !== 'none'`)
        if (menuVisible) {
          await evaluate(`document.querySelector('.via-site-menu-toggle').click()`)
          await until(`!!document.querySelector('dialog[open]')`)
          assert.equal(await evaluate(`document.querySelectorAll('.via-site-mobile-links a').length`), 5)
          assert(await evaluate(`(() => { const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1 })()`))
          await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
          await until(`!document.querySelector('dialog[open]')`)
        }
        if (width === 375 && height === 812 || width === 1440) {
          await until(`document.querySelector('.via-landing-opportunity-grid').getAttribute('aria-busy') === 'false'`)
          console.log('Programme cards at ' + width + ': ' + await evaluate(`document.querySelectorAll('.via-landing-opportunity-card').length + ' | ' + (document.querySelector('.via-landing-programme-state')?.innerText || 'loaded')`))
          await evaluate(`Promise.all([...document.images].map(img => {img.loading='eager';return img.decode().catch(()=>{})}))`)
          await screenshot('landing-' + width, true)
          await screenshot('hero-' + width)
          for (const [name,selector] of [['programmes','.via-landing-discover'],['explore','.via-explore-options']]) {
            const clip = await evaluate(`(() => {const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1}})()`)
            const shot = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})
            await fs.writeFile(path.join(output,name+'-'+width+'.png'),Buffer.from(shot.data,'base64'))
          }
        }
      }
      if (['/contact','/nsfas','/guides'].includes(route) && (width === 375 && height === 812 || width === 1440)) await screenshot(route.slice(1) + '-' + width, true)
    }
  }
  // Internal landing links must lead to a rendered route, not a blank page.
  await navigate('/')
  const routes = await evaluate(`[...new Set([...document.querySelectorAll('a[href^="/"]')].map(a=>a.getAttribute('href')))]`)
  for (const route of routes) { await navigate(route); assert(await evaluate(`!!document.querySelector('h1')`), route) }
  await navigate('/contact')
  await evaluate(`localStorage.removeItem('via-contact-draft')`)
  assert.equal(await evaluate(`document.querySelector('form').checkValidity()`), false)
  for (const [key,value] of Object.entries({name:'QA Example',email:'qa@example.invalid',subject:'Synthetic draft',message:'Browser verification draft. Do not send.'})) {
    await evaluate(`(() => { const input=document.querySelector('#contact-${key}');Object.getOwnPropertyDescriptor(${key === 'message' ? 'HTMLTextAreaElement' : 'HTMLInputElement'}.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true})) })()`)
  }
  await evaluate(`document.querySelector('form').requestSubmit()`)
  await until(`document.querySelector('[role="status"]').textContent.includes('has not been sent')`)
  await navigate('/contact')
  assert.equal(await evaluate(`document.querySelector('#contact-subject').value`),'Synthetic draft')
  await evaluate(`localStorage.removeItem('via-contact-draft')`)
  assert.deepEqual(errors, [])
  await fs.writeFile(path.join(output,'layouts.json'),JSON.stringify(layouts,null,2))
  console.log('PASS: 54 page/viewport layouts, mobile navigation, landing destinations, contact validation and draft persistence; no uncaught browser errors.')
  console.log('Screenshots and results: ' + output)
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for (const request of pending.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
