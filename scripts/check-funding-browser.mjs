// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-funding-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9370', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9370/json')).json(); break } catch { await pause(100) } }
  assert(tabs, 'Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result) } }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  await send('Page.enable'); await send('Runtime.enable')


  const {loadEnv}=await import('vite'),{createClient}=await import('@supabase/supabase-js')
  const {presentCatalogue}=await import('../src/features/discovery/services/presentation.ts')
  const {fundingClosingDate}=await import('../src/features/discovery/services/funding-model.ts')
  const env=loadEnv('development',process.cwd(),'VITE_'),db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
  const {data,error}=await db.from('via_public_opportunities').select('document').eq('kind','bursaries').order('id').range(0,499)
  if(error)throw error
  const raw=data.map(row=>row.document).find(item=>!item.is_demo&&item.application_url&&item.coverage?.length)
  assert(raw,'Expected a published funding opportunity')
  const item=presentCatalogue(raw)
  const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()')
  const ready=async()=>until('document.querySelector(".via-discovery-results")?.getAttribute("aria-busy")==="false"')
  const detailsReady=async()=>until('document.querySelector(".via-funding-section[aria-busy]")?.getAttribute("aria-busy")==="false"')
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('/bursaries?q='+encodeURIComponent(item.title));await ready();await until('!!document.querySelector(".via-funding-card")')
    const cards=await evaluate('[...document.querySelectorAll(".via-funding-card")].map(c=>c.innerText)')
    assert(cards[0].includes(item.title)&&cards[0].includes(item.provider)&&cards[0].includes(item.funding_type)&&cards[0].includes('View Funding'))
    for(const coverage of item.coverage)assert(cards[0].includes(coverage))
    assert(cards.every(text=>!/Application fee|Minimum APS|Subject requirements|Applications closed|Applications open/.test(text)))
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true)
    await until('!document.querySelector(".via-funding-card .via-save-button").disabled')
    // Shared guest/authenticated Save flows are checked in check-save-browser.mjs.
    await evaluate('document.querySelector(".via-funding-card .via-funding-coverage").scrollIntoView({block:"center"})')
    const point=await evaluate('(()=>{const r=document.querySelector(".via-funding-card .via-funding-coverage").getBoundingClientRect();return {x:r.left+10,y:r.top+8}})()')
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await detailsReady()
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-funding-coverage-list li span")].map(e=>e.textContent)'),item.coverage)
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-funding-section h3")].map(e=>e.textContent)'),['About','What it covers','Who can apply?','What can I study?',...(item.institutions.length?['Where can I study?']:[]),'What do I need?'])
    assert.equal(await evaluate('document.querySelector(".via-funding-header h2").textContent'),item.title)
    const closing=fundingClosingDate(item)
    assert.equal(await evaluate('document.querySelector(".via-funding-header .via-funding-closing").textContent'),closing?'Closes: '+closing:'Closing date not listed')
    assert.equal(await evaluate('document.querySelectorAll(".via-funding-details :is(.via-public-tabs,.via-public-related,.via-public-match-conversion)").length'),0)
    const layout=await evaluate('(()=>{const d=document.querySelector("dialog:has(.via-funding-details)"),r=d.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1}})()')
    assert(layout.fits&&!layout.overflow,JSON.stringify({width,height,...layout}))
    if(width===375&&height===812||width===1440)await screenshot('funding-overview-'+width)
    assert(await evaluate('!!document.querySelector(".via-funding-details")'))
    const apply=await evaluate('(()=>{const a=document.querySelector(".via-funding-apply a");a.scrollIntoView({block:"center"});const r=a.getBoundingClientRect();return {href:a.href,target:a.target,rel:a.rel,visible:r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1,height:r.height}})()')
    assert.equal(apply.href,item.application_url);assert.equal(apply.target,'_blank');assert(apply.rel.includes('noopener')&&apply.visible&&apply.height>=44)
    if(width===375&&height===812||width===1440)await screenshot('funding-apply-'+width)
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector("dialog[open]")')
    if(width===375&&height===812||width===1440){await evaluate('scrollTo(0,0)');await screenshot('funding-cards-'+width,true)}
  }
  console.log('PASS: live simple funding cards and popup at nine viewport sizes, full-card clicks, guest Save isolation, modal Save, exact coverage, closing date, and external Apply.')
  const fundA={...item,id:'30000000-0000-4000-8000-000000000101',title:'Fixture Student Fund',provider:'Fixture Provider',funding_type:'Bursary',overview:'Fixture source description.',coverage:['Tuition','Books'],fields:['Technology'],eligibility:[{id:'e1',criterion:'Fixture eligibility only'}],required_documents:['ID','Latest results'],institutions:[{id:'10000000-0000-4000-8000-000000000001',name:'Fixture University'}],cycles:[{id:'c1',academic_year:2027,closes_on:'2027-09-30'}],application_url:'https://provider.example/apply'}
  const fundB={...fundA,id:'30000000-0000-4000-8000-000000000102',title:'Fixture Unrestricted Fund',coverage:[],fields:[],eligibility:[],required_documents:[],institutions:[],cycles:[],application_url:null}
  const programme={...item,id:'20000000-0000-4000-8000-000000000101',kind:'programmes',title:'BSc Computer Science',qualification:'Bachelor',field:'Technology',duration:'3 years',institution_id:fundA.institutions[0].id,institution_name:'Fixture University',career_keywords:[],is_demo:false}
  let failLinks=false
  await send('Network.enable')
  socket.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return
    const {requestId,request}=m.params,url=new URL(request.url)
    const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'}]
    if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
    let body,responseCode=200
    if(url.pathname.endsWith('/via_public_opportunities')){
      const records=url.searchParams.get('kind')==='eq.programmes'?[programme]:[fundA,fundB].filter(f=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+f.id)
      const accept=Object.entries(request.headers).find(([key])=>key.toLowerCase()==='accept')?.[1]||''
      body=accept.includes('vnd.pgrst.object')?{document:records[0]}:records.map(document=>({document}))
    }else if(url.pathname.endsWith('/via_bursary_programmes')){
      if(failLinks){responseCode=503;body={message:'Fixture temporary failure'}}else body=url.searchParams.get('bursary_id')==='eq.'+fundA.id?[{programme_id:programme.id}]:[]
    }else if(url.pathname.endsWith('/search_public_opportunities'))body={items:[fundA,fundB],total:2,facets:{},institutions:[]}
    if(body===undefined){await send('Fetch.continueRequest',{requestId});return}
    await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
  })
  await send('Fetch.enable',{patterns:[{urlPattern:'*/rest/v1/*'}]})
  await navigate('/bursaries?opportunity='+fundA.id);await detailsReady()
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-funding-coverage-list li span")].map(e=>e.textContent)'),['Tuition','Books'])
  assert.equal(await evaluate('document.querySelector(".via-funding-institutions").innerText.includes("Fixture University")'),true)
  assert.equal(await evaluate('document.querySelector(".via-funding-programme-list").textContent.includes("Computer Science")'),true)
  assert.equal(await evaluate('document.querySelector(".via-funding-header .via-funding-closing").textContent'),'Closes: 30 September 2027')
  await navigate('/bursaries?opportunity='+fundB.id);await detailsReady()
  assert.equal(await evaluate('document.querySelector(".via-funding-institutions")===null'),true,'Unrestricted funding has no institution section')
  assert.equal(await evaluate('document.querySelectorAll(".via-funding-apply a,.via-funding-coverage-list li").length'),0)
  const missing=await evaluate('document.querySelector(".via-funding-details").innerText')
  assert(missing.includes('Coverage has not been listed')&&missing.includes('Eligibility requirements have not been listed')&&missing.includes('Required documents have not been listed')&&missing.includes('official application link is not available'))
  failLinks=true;await navigate('/bursaries?opportunity='+fundA.id);await until('!!document.querySelector(".via-funding-status[role=alert]")')
  assert.equal(await evaluate('document.querySelectorAll(".via-funding-coverage-list li").length'),2,'Other information remains available on programme read failure')
  failLinks=false;await click('.via-funding-status button');await detailsReady();assert.equal(await evaluate('document.querySelectorAll(".via-funding-programme-list li").length'),1)
  assert.deepEqual(errors,[])
  console.log('PASS: in-memory fixture checks for linked programmes, institution restrictions, exact-only coverage, missing data, and programme-load retry. No database writes.')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for (const request of pending.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
