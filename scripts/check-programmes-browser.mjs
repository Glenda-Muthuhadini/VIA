// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-programmes-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9368', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9368/json')).json(); break } catch { await pause(100) } }
  assert(tabs, 'Chrome did not start')
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) { const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); if (message.error) request.reject(Error(JSON.stringify(message.error))); else request.resolve(message.result) } }
    else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  await send('Page.enable'); await send('Runtime.enable')

  const {loadEnv}=await import('vite'), {createClient}=await import('@supabase/supabase-js')
  const {groupProgrammes,programmeApplicationUrl}=await import('../src/features/discovery/services/programme-model.ts')
  const env=loadEnv('development',process.cwd(),'VITE_'),db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
  const {data:documents,error:readError}=await db.from('via_public_opportunities').select('document').eq('kind','programmes').order('id').range(0,999)
  if(readError)throw readError
  const groups=groupProgrammes(documents.map(row=>row.document))
  const computer=groups.find(group=>group.title==='Computer Science'&&!group.is_demo)
  assert(computer&&computer.programme_group.institution_count>1)
  const click=async selector=>{await evaluate('document.querySelector('+JSON.stringify(selector)+').click()')}
  const waitResults=async(kind='programmes')=>until(`document.querySelector('#discovery-main.is-${kind} .via-discovery-results')?.getAttribute('aria-busy')==='false'`)
  async function checkModal(width,height){
    const result=await evaluate('(()=>{const d=document.querySelector("dialog[open]"),r=d.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,within:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,expanded:d.querySelectorAll(".via-programme-offering-toggle[aria-expanded=true]").length,small:[...d.querySelectorAll(".via-programme-offering-toggle")].some(b=>b.getBoundingClientRect().height<44)}})()')
    assert(!result.overflow&&result.within&&!result.small&&result.expanded<=1,JSON.stringify({width,height,...result}))
  }
  for(const [width,height] of process.argv.includes('--fixtures-only') ? [] : [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('/programmes?q=Computer%20Science');await waitResults();await until('document.querySelectorAll(".via-programme-card").length>0')
    const cardTexts=await evaluate('[...document.querySelectorAll(".via-programme-card")].map(c=>c.innerText)')
    assert(cardTexts.every(text=>!(/Minimum APS|Subject requirements|Campus|University of|Witwatersrand|Cape Town|Pretoria/i.test(text))))
    await evaluate('[...document.querySelectorAll(".via-programme-card")].find(c=>c.querySelector("h2").textContent==="Computer Science").querySelector(".via-programme-fields").scrollIntoView({block:"center"})')
    const point=await evaluate('(()=>{const r=[...document.querySelectorAll(".via-programme-card")].find(c=>c.querySelector("h2").textContent==="Computer Science").querySelector(".via-programme-fields").getBoundingClientRect();return {x:r.left+12,y:r.top+8}})()')
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
    await until('!!document.querySelector(".via-programme-details")')
    if(width===375&&height===812||width===1440)await screenshot('programme-modal-overview-'+width)
    assert.equal(await evaluate('document.querySelectorAll(".via-programme-offering").length'),computer.programme_group.institution_count)
    await checkModal(width,height)
    const offers=computer.programme_group.offerings
    for(let index=0;index<offers.length;index++){
      await click('.via-programme-offering:nth-child('+(index+1)+') .via-programme-offering-toggle')
      assert.equal(await evaluate('document.querySelectorAll(".via-programme-offering-toggle[aria-expanded=true]").length'),1)
      const facts=await evaluate('Object.fromEntries([...document.querySelectorAll(".via-programme-offering.is-expanded dl>div")].map(row=>[row.querySelector("dt").textContent,row.querySelector("dd").textContent]))')
      assert.equal(facts['Official programme name'],offers[index].title)
      if (offers[index].minimum_aps == null) assert(facts['APS requirement'].startsWith('Not listed'))
      else assert.equal(facts['APS requirement'],String(offers[index].minimum_aps))
      assert.equal(facts.Duration,offers[index].duration||'Not listed')
      assert.equal(facts.Campus,offers[index].campus||'Not listed')
      const link=await evaluate('document.querySelector(".via-programme-offering.is-expanded a[target=_blank]")?.href||null')
      assert.equal(link,programmeApplicationUrl(offers[index]))
      await checkModal(width,height)
      await evaluate('document.querySelector(".via-programme-offering.is-expanded .via-programme-offering-actions").scrollIntoView({block:"end"})')
      assert(await evaluate('[...document.querySelectorAll(".via-programme-offering.is-expanded .via-programme-offering-actions a")].every(a=>{const r=a.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.height>=44})'))
    }
    if(width===375&&height===812||width===1440)await screenshot('programme-modal-'+width)
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector("dialog[open]")')
    if(width===375&&height===812||width===1440){await evaluate('scrollTo(0,0)');await screenshot('programme-cards-'+width,true)}
  }
  if (!process.argv.includes('--fixtures-only')) console.log('PASS: live grouped programme cards, full-card click, all institutions and per-offering facts/URLs at nine viewport sizes.')
  if (!process.argv.includes('--fixtures-only')) {
    const relatedOffering=documents.map(row=>row.document).find(item=>item.is_demo&&item.institution_id)
    const [direct,institutional]=await Promise.all([
      db.from('via_bursary_programmes').select('bursary_id').eq('programme_id',relatedOffering.id),
      db.from('via_bursary_institutions').select('bursary_id').eq('institution_id',relatedOffering.institution_id),
    ])
    if(direct.error||institutional.error)throw direct.error||institutional.error
    const ids=[...new Set([...direct.data,...institutional.data].map(row=>row.bursary_id))]
    const {data:visibleFunding,error:fundingError}=await db.from('via_public_opportunities').select('id').eq('kind','bursaries').in('id',ids)
    if(fundingError)throw fundingError
    await navigate('/bursaries?'+new URLSearchParams({programme:relatedOffering.id,institution:relatedOffering.institution_id}));await waitResults('bursaries')
    assert.equal(await evaluate('document.querySelectorAll(".via-opportunity-card").length'),Math.min(12,visibleFunding.length))
    assert.equal(await evaluate('document.querySelector(".via-discovery-results [role=alert]")===null'),true)
    console.log('PASS: live institution/programme funding search agrees with the database relationship records.')
  }
  // In-memory HTTP fixtures exercise campus and distinct requirements without writes.
  const first=documents.find(row=>row.document.id===computer.programme_group.offerings[0].id).document
  const institutionA='10000000-0000-4000-8000-000000000001',institutionB='10000000-0000-4000-8000-000000000002'
  const offerA={...first,id:'20000000-0000-4000-8000-000000000101',title:'BSc Computer Science',institution_id:institutionA,institution_name:'Fixture University A',campus:'North Campus',minimum_aps:28,duration:'3 years',requirements:[{id:'req-a',subject:'Mathematics',minimum_percentage:60,detail:'North offering requirement'}],website_url:'https://university.example/north-cs'}
  const offerB={...offerA,id:'20000000-0000-4000-8000-000000000102',campus:'South Campus',minimum_aps:36,duration:'4 years',requirements:[{id:'req-b',subject:'Mathematics',minimum_percentage:80,detail:'South offering requirement'}],website_url:'https://university.example/south-cs'}
  const offerC={...offerA,id:'20000000-0000-4000-8000-000000000103',title:'Bachelor of Science in Computer Science',institution_id:institutionB,institution_name:'Fixture University B',campus:null,minimum_aps:null,duration:null,requirements:[],website_url:null,source_url:null,application_url:null}
  const fId=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0')
  const funding=[1,2,3].map(n=>({...first,id:fId(n),kind:'bursaries',title:'Fixture Funding '+n,provider:'Fixture Provider',institutions:[{id:institutionA,name:'Fixture University A'}],requirements:[],eligibility:[],cycles:[]}))
  const housing=[['South Campus',institutionA],['North Campus',institutionA],[null,institutionA],['South Campus',institutionB]].map(([campus,id],n)=>({...first,id:fId(n+10),kind:'accommodation',title:'Fixture Residence '+n,requirements:[],cycles:[],institutions:[{id,name:'Fixture University',campus}],amenities:[],starting_price:null}))
  const fixtureRequests=[]
  socket.addEventListener('message',async event=>{
    const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return
    const {requestId,request}=message.params;const url=new URL(request.url);let body
    fixtureRequests.push({path:url.pathname,method:request.method})
    if(request.method==='OPTIONS') {
      await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:[{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'}]})
      return
    }
    if(url.pathname.endsWith('/via_public_opportunities'))body=[offerA,offerB,offerC].map(document=>({document}))
    else if(url.pathname.endsWith('/via_bursary_programmes'))body=[{bursary_id:fId(1)}]
    else if(url.pathname.endsWith('/via_bursary_institutions'))body=[{bursary_id:fId(2)}]
    else if(url.pathname.endsWith('/search_public_opportunities')){
      const postData=request.postData || (await send('Network.getRequestPostData',{requestId:message.params.networkId})).postData
      const args=JSON.parse(postData);let items=args.p_kind==='bursaries'?funding:housing
      if(args.p_filters.institution)items=items.filter(item=>item.institutions.some(i=>i.id===args.p_filters.institution))
      body={items,total:items.length,facets:{},institutions:[{value:institutionA,label:'Fixture University A'},{value:institutionB,label:'Fixture University B'}]}
    }
    if(body===undefined){await send('Fetch.continueRequest',{requestId});return}
    await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'}],body:Buffer.from(JSON.stringify(body)).toString('base64')})
  })
  await send('Network.enable')
  await send('Fetch.enable',{patterns:[{urlPattern:'*/rest/v1/*'}]})
  await navigate('/programmes?opportunity='+offerA.id);await until('document.querySelectorAll(".via-programme-offering").length===2')
  await click('.via-programme-offering-toggle')
  await evaluate('(()=>{const s=document.querySelector(".via-programme-offering-select select");s.value='+JSON.stringify(offerB.id)+';s.dispatchEvent(new Event("change",{bubbles:true}))})()')
  assert((await evaluate('document.querySelector(".via-programme-offering.is-expanded").innerText')).includes('80%+'))
  assert(!(await evaluate('document.querySelector(".via-programme-offering.is-expanded").innerText')).includes('60%+'))
  assert.equal(await evaluate('document.querySelector(".via-programme-offering.is-expanded a[target=_blank]").href'),offerB.application_url)
  await click('.via-programme-offering.is-expanded a[href^="/bursaries"]');await waitResults('bursaries')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("programme")'),offerB.id)
  assert.equal(await evaluate('new URLSearchParams(location.search).get("institution")'),institutionA)
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-opportunity-card h2")].map(e=>e.textContent)'),['Fixture Funding 1','Fixture Funding 2'],JSON.stringify({text:await evaluate('document.querySelector(".via-discovery-results").innerText'),fixtureRequests}))
  await navigate('/programmes?opportunity='+offerA.id);await until('document.querySelectorAll(".via-programme-offering").length===2');await click('.via-programme-offering-toggle')
  await evaluate('(()=>{const s=document.querySelector(".via-programme-offering-select select");s.value='+JSON.stringify(offerB.id)+';s.dispatchEvent(new Event("change",{bubbles:true}))})()')
  await click('.via-programme-offering.is-expanded a[href^="/accommodation"]');await waitResults('accommodation')
  assert.equal(await evaluate('new URLSearchParams(location.search).get("campus")'),'South Campus')
  assert.equal(await evaluate('new URLSearchParams(location.search).has("programme")'),false)
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-opportunity-card h2")].map(e=>e.textContent)'),['Fixture Residence 0'],JSON.stringify({text:await evaluate('document.querySelector(".via-discovery-results").innerText'),fixtureRequests}))
  await navigate('/programmes?opportunity='+offerC.id);await until('document.querySelectorAll(".via-programme-offering").length===2');await click('.via-programme-offering:nth-child(2) .via-programme-offering-toggle')
  const missing=await evaluate('document.querySelector(".via-programme-offering.is-expanded").innerText')
  assert(missing.includes('Not listed')&&missing.includes('Subject requirements have not been listed')&&missing.includes('online application link is not available'))
  assert.equal(await evaluate('document.querySelectorAll(".via-programme-offering.is-expanded a[target=_blank]").length'),0)
  for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    for(const [kind,params] of [['bursaries',{institution:institutionA,programme:offerB.id}],['accommodation',{institution:institutionA,campus:'South Campus'}]]){
      await navigate('/'+kind+'?'+new URLSearchParams(params));await waitResults(kind)
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
      await click('.via-discovery-filter-toggle');await until('!!document.querySelector("dialog[open] .via-discovery-filter-controls")')
      const result=await evaluate('(()=>{const d=document.querySelector("dialog[open]"),r=d.getBoundingClientRect();d.querySelector(".via-public-filter-done button").scrollIntoView({block:"center"});const b=d.querySelector(".via-public-filter-done button").getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1,visible:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,buttonVisible:b.top>=0&&b.bottom<=innerHeight+1}})()')
      assert(!result.overflow&&result.visible&&result.buttonVisible,JSON.stringify({width,height,kind,...result}))
      await click('dialog[open] .via-public-dialog-header button')
    }
  }
  assert.deepEqual(errors,[])
  console.log('PASS: fixture-only multi-campus offering selection, distinct APS/subject marks/URLs, missing values, actual relationship-based funding filters and institution+campus accommodation matching. No writes.')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for (const request of pending.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
