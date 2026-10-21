// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-guides-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9363', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9363/json')).json(); break } catch { await pause(100) } }
  assert(tabs, 'Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result) } }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  await send('Page.enable'); await send('Runtime.enable')
  if (process.argv.includes('--visual-only')) {
    for (const [width,height] of [[375,812],[1440,900]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
      await navigate('/?guide=university-applications')
      assert.deepEqual(await evaluate('(()=>{const s=getComputedStyle(document.querySelector(".via-guide-dialog article a"));return [s.backgroundColor,s.color]})()'),['rgb(214, 232, 174)','rgb(18, 62, 48)'])
      await screenshot('guide-popup-final-'+width)
    }
    console.log('PASS: final guide action contrast and mobile/desktop screenshots.')
  } else {

  const slugs=['choosing-grade-10-subjects','understanding-aps','university-applications','funding-and-bursaries','nsfas','accommodation','preparing-for-higher-education']
  for (const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('/')
    await until('document.querySelector(".via-landing-opportunity-grid").getAttribute("aria-busy")==="false"')
    await evaluate('document.querySelector("#guides .via-landing-centered-action a").scrollIntoView({block:"center"})')
    const before=await evaluate('scrollY')
    await evaluate('document.querySelector("#guides .via-landing-centered-action a").focus();document.querySelector("#guides .via-landing-centered-action a").click()')
    await until('!!document.querySelector(".via-guide-dialog[open]")')
    assert.equal(await evaluate('location.pathname'),'/')
    assert.equal(await evaluate('document.querySelectorAll(".via-guide-dialog .via-student-guide-card").length'),7)
    async function check(){
      const result=await evaluate('(()=>{const d=document.querySelector(".via-guide-dialog"),r=d.getBoundingClientRect(),c=d.querySelector(".via-public-dialog-header button").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,overflow:d.scrollWidth>d.clientWidth+1,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,closeVisible:c.top>=0&&c.bottom<=innerHeight,focusInside:d.contains(document.activeElement)}})()')
      assert(result.left>=0&&result.right<=width+1&&result.top>=0&&result.bottom<=height+1&&!result.overflow&&!result.pageOverflow&&result.closeVisible&&result.focusInside,JSON.stringify({width,height,...result}))
      layouts.push({width,height,...result})
    }
    await check()
    for(const slug of slugs){
      await evaluate(`document.querySelector(${JSON.stringify('.via-guide-dialog a[href*="guide=' + slug + '"]')}).click()`)
      await until('!!document.querySelector(".via-guide-dialog article")')
      await check()
      // The dialog traps keyboard focus and the guide action stays reachable by scrolling.
      await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8})
      assert(await evaluate('document.querySelector(".via-guide-dialog").contains(document.activeElement)'), JSON.stringify({width,height,slug,active:await evaluate('document.activeElement.outerHTML.slice(0,300)')}))
      await evaluate('document.querySelector(".via-guide-dialog article a").scrollIntoView({block:"center"})')
      assert(await evaluate('(()=>{const r=document.querySelector(".via-guide-dialog article a").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()'))
      if(slug==='university-applications'&&(width===375&&height===812||width===1440))await screenshot('guide-popup-'+width)
      await evaluate('document.querySelector(".via-guide-dialog .via-student-back").click()')
      await until('document.querySelectorAll(".via-guide-dialog .via-student-guide-card").length===7')
    }
    await evaluate('document.querySelector(".via-guide-dialog .via-public-dialog-header button").click()')
    await until('!document.querySelector(".via-guide-dialog")')
    assert.equal(await evaluate('document.activeElement===document.querySelector("#guides .via-landing-centered-action a")'),true)
    assert(Math.abs((await evaluate('scrollY'))-before)<2,JSON.stringify({message:'Closing restores page position',width,height,before,after:await evaluate('scrollY')}))
    assert.notEqual(await evaluate('document.documentElement.style.overflow'),'hidden')
  }
  for(const route of ['/about','/contact']){
    await navigate(route)
    await evaluate('document.querySelector("a[aria-haspopup=dialog]").focus();document.querySelector("a[aria-haspopup=dialog]").click()')
    await until('!!document.querySelector(".via-guide-dialog[open]")')
    assert.equal(await evaluate('location.pathname'),route)
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27})
    await until('!document.querySelector(".via-guide-dialog")')
    assert.equal(await evaluate('location.pathname'),route)
  }
  await navigate('/')
  for(let i=0;i<4;i++){
    await evaluate('document.querySelectorAll(".via-landing-guide")['+i+'].click()')
    await until('!!document.querySelector(".via-guide-dialog article")')
    assert.equal(await evaluate('location.pathname'),'/')
    await evaluate('document.querySelector(".via-guide-dialog .via-public-dialog-header button").click()')
    await until('!document.querySelector(".via-guide-dialog")')
  }
  await navigate('/guides/understanding-aps')
  assert(await evaluate('!!document.querySelector(".via-guide-dialog[open] article")'))
  await evaluate('document.querySelector(".via-guide-dialog .via-public-dialog-header button").click()')
  await until('location.pathname==="/"&&!document.querySelector(".via-guide-dialog")')
  await navigate('/guides')
  assert.equal(await evaluate('document.querySelectorAll(".via-guide-dialog .via-student-guide-card").length'),7)
  await navigate('/?guide=understanding-aps')
  await evaluate('document.querySelector(".via-guide-dialog article a").click()')
  await until('location.pathname==="/programmes"&&!document.querySelector(".via-guide-dialog")')
  assert.deepEqual(errors,[])
  await fs.writeFile(path.join(output,'guide-layouts.json'),JSON.stringify(layouts,null,2))
  console.log('PASS: all 7 guides and directory in pop-ups at 9 viewport sizes; landing, About and Contact launchers; deep links, actions, Escape, focus trapping/restoration and page scroll preservation.')
  }
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for (const request of pending.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
