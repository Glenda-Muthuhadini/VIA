// Public-page browser checks. No accounts, messages or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-accommodation-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9371', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
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
  for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9371/json')).json(); break } catch { await pause(100) } }
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
  const {accommodationLocation,accommodationType,accommodationPrice,accommodationContacts}=await import('../src/features/discovery/services/accommodation-model.ts')
  const env=loadEnv('development',process.cwd(),'VITE_'),db=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
  const {data,error}=await db.from('via_public_opportunities').select('document').eq('kind','accommodation').order('id').range(0,499)
  if(error)throw error
  const raw=data.map(row=>row.document).find(item=>!item.is_demo&&item.title)
  assert(raw,'Expected stored accommodation data')
  const item=presentCatalogue(raw)
  const ready=async()=>until('document.querySelector(".via-discovery-results")?.getAttribute("aria-busy")==="false"')
  for(const [width,height] of process.argv.includes('--fixtures-only')?[]:[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    await navigate('/accommodation?q='+encodeURIComponent(item.title));await ready();await until('!!document.querySelector(".via-accommodation-card")')
    const text=await evaluate('document.querySelector(".via-accommodation-card").innerText')
    assert(text.includes(item.title)&&text.includes('View Accommodation'))
    assert(!text.includes('Published starting price')&&!text.includes('NSFAS compatible'))
    assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true)
    await until('!document.querySelector(".via-accommodation-card .via-save-button").disabled')
    // Shared guest/authenticated Save flows are checked in check-save-browser.mjs.
    await evaluate('document.querySelector(".via-accommodation-card-media").scrollIntoView({block:"center"})')
    const point=await evaluate('(()=>{const r=document.querySelector(".via-accommodation-card-media").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()')
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await until('!!document.querySelector(".via-accommodation-details")')
    const expected=[...(accommodationLocation(item)||item.address?['Location']:[]),...(accommodationType(item)?['Accommodation type']:[]),...(item.amenities?.length?['included']:[]),...(item.institutions.length?['Nearby institutions']:[]),...(accommodationPrice(item)?['Price']:[])]
    const contacts=accommodationContacts(item)
    if(contacts.website||contacts.phones.length||contacts.emails.length||contacts.other)expected.push('Contact / Apply')
    const headings=await evaluate('[...document.querySelectorAll(".via-accommodation-section h3")].map(h=>h.textContent.includes("included")?"included":h.textContent)')
    assert.deepEqual(headings,expected)
    assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-accommodation-features li span")].map(e=>e.textContent)'),[...new Set(item.amenities||[])])
    assert.equal(await evaluate('document.querySelectorAll(".via-accommodation-details :is(.via-public-tabs,.via-public-related,.via-public-match-conversion)").length'),0)
    const layout=await evaluate('(()=>{const d=document.querySelector("dialog:has(.via-accommodation-details)"),r=d.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1}})()')
    assert(layout.fits&&!layout.overflow,JSON.stringify({width,height,...layout}))
    if(width===375&&height===812||width===1440)await screenshot('accommodation-overview-'+width)
    if(contacts.website){
      const link=await evaluate('(()=>{const a=document.querySelector(".via-accommodation-contact .via-public-button");a.scrollIntoView({block:"center"});const r=a.getBoundingClientRect();return {href:a.href,target:a.target,rel:a.rel,visible:r.top>=0&&r.bottom<=innerHeight+1,height:r.height}})()')
      assert.equal(link.href,contacts.website);assert(link.target==='_blank'&&link.rel.includes('noopener')&&link.visible&&link.height>=44)
    }
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector("dialog[open]")')
    if(width===375&&height===812||width===1440){await evaluate('scrollTo(0,0)');await screenshot('accommodation-cards-'+width,true)}
  }
  if(!process.argv.includes('--fixtures-only'))console.log('PASS: live accommodation cards/popups at nine viewport sizes; image-area card click, source-only sections, exact amenities, safe official links and no horizontal overflow.')
  // All subsequent auth and save requests are intercepted in memory.
  const fixture={...item,id:'40000000-0000-4000-8000-000000000101',title:'Fixture Campus Residence',location:'Hatfield, Pretoria',province:'Gauteng',address:'123 Fixture Street',accommodation_type:'Private student residence',starting_price:4500,price_period:'month',amenities:['Wi-Fi','Laundry'],image_url:'https://images.example/residence.png',contact:'012 000 0000; residence@example.com',application_url:'https://residence.example/apply',website_url:null,nsfas_compatible:true,institutions:[{id:'10000000-0000-4000-8000-000000000001',name:'Fixture University',distance_km:2},{id:'10000000-0000-4000-8000-000000000002',name:'Second Fixture Institution',distance_km:null}],is_demo:false}
  const empty={...fixture,id:'40000000-0000-4000-8000-000000000102',title:'Fixture Unlisted Details',location:null,province:null,address:null,accommodation_type:null,starting_price:null,price_period:null,amenities:[],image_url:'https://images.example/missing.png',contact:null,application_url:'javascript:alert(1)',website_url:null,institutions:[]}
  const user={id:'90000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'accommodation-qa@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'}
  const saved=new Set()
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+yJ3sAAAAASUVORK5CYII=','base64')
  await send('Network.enable')
  socket.addEventListener('message',async event=>{
    const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return
    const {requestId,request}=m.params,url=new URL(request.url)
    const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'X-Supabase-Api-Version',value:'2024-01-01'},{name:'Access-Control-Expose-Headers',value:'X-Supabase-Api-Version'}]
    if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
    if(url.hostname==='images.example'){await send('Fetch.fulfillRequest',{requestId,responseCode:url.pathname.includes('missing')?404:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:url.pathname.includes('missing')?'':png.toString('base64')});return}
    let body,responseCode=200
    if(url.pathname.endsWith('/via_public_opportunities')){
      const records=[fixture,empty].filter(record=>!url.searchParams.has('id')||url.searchParams.get('id')==='eq.'+record.id)
      const accept=Object.entries(request.headers).find(([key])=>key.toLowerCase()==='accept')?.[1]||''
      body=accept.includes('vnd.pgrst.object')?{document:records[0]}:records.map(document=>({document}))
    }else if(url.pathname.endsWith('/search_public_opportunities'))body={items:[fixture,empty],total:2,facets:{},institutions:[]}
    else if(url.pathname.endsWith('/via_saved_opportunities')){
      if(request.method==='POST'){
        const payload=JSON.parse(request.postData||(await send('Network.getRequestPostData',{requestId:m.params.networkId})).postData)
        assert.equal(payload.user_id,user.id);assert.equal(payload.opportunity_id,fixture.id);saved.add(payload.opportunity_id);body=[]
      }else if(request.method==='DELETE'){saved.delete(url.searchParams.get('opportunity_id').replace('eq.',''));body=[]}
      else body=[...saved].map(opportunity_id=>({opportunity_id}))
    }else if(url.pathname.endsWith('/via_profiles'))body=[{id:user.id,first_name:'Fixture',last_name:'Student',education_stage:'grade12'}]
    else if(url.pathname.endsWith('/auth/v1/user'))body=user
    else if(url.pathname.endsWith('/auth/v1/logout'))body={}
    if(body===undefined){responseCode=400;body={message:'Unexpected fixture-only request'}}
    await send('Fetch.fulfillRequest',{requestId,responseCode,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
  })
  await send('Fetch.enable',{patterns:[{urlPattern:env.VITE_SUPABASE_URL+'/*'},{urlPattern:'https://images.example/*'}]})
  await navigate('/accommodation?opportunity='+fixture.id);await until('!!document.querySelector(".via-accommodation-details")')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-accommodation-features li span")].map(e=>e.textContent)'),['Wi-Fi','Laundry'])
  assert.equal(await evaluate('document.querySelectorAll(".via-accommodation-institutions li span").length'),1,'Only the stored distance is shown')
  assert((await evaluate('document.querySelector(".via-accommodation-institutions").innerText')).includes('2 km away'))
  assert((await evaluate('document.querySelector(".via-accommodation-contact").innerText')).includes('012 000 0000'))
  assert.equal(await evaluate('document.querySelector(".via-accommodation-contact a[href^=mailto]").textContent'),'residence@example.com')
  assert.equal(await evaluate('document.querySelector(".via-accommodation-type").textContent'),'Private student accommodation','NSFAS flag does not imply accreditation')
  assert.equal(await evaluate('document.querySelector(".via-accommodation-section .via-accommodation-price").textContent'),accommodationPrice(fixture))
  for(const [width,height] of [[375,480],[430,932],[768,1024],[1024,768],[1280,650],[1440,900],[1920,1080]]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
    const fits=await evaluate('(()=>{const d=document.querySelector("dialog:has(.via-accommodation-details)"),r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1})()')
    assert(fits,'Photo/contact fixture layout at '+width+'x'+height)
    if(width===430||width===1440)await screenshot('accommodation-photo-fixture-'+width)
  }
  await navigate('/accommodation?opportunity='+empty.id);await until('!!document.querySelector(".via-accommodation-details")')
  await until('document.querySelector(".via-accommodation-details > img")===null')
  assert.equal(await evaluate('document.querySelectorAll(".via-accommodation-section").length'),0,'Missing values do not produce empty sections')
  assert.deepEqual(errors,[])
  console.log('PASS: in-memory fixture checks for exact amenities, prices, distances, contacts, image failure, hidden missing sections, source-only section rendering. All auth/writes intercepted; no real accounts or database writes.')
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
  for (const request of pending.values()) {clearTimeout(request.timer);request.reject(Error('Browser closed'))}
  chrome.kill()
}
