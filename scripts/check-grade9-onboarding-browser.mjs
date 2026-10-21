// Authenticated Grade 9 browser checks. Supabase requests use fixtures; no real accounts or database writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const output = path.resolve('node_modules/.tmp/via-grade9-onboarding-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9381', '--user-data-dir=' + path.join(output, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket, sequence = 0, shuttingDown = false
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
  for (let i = 0; i < 1200; i++) { if (await evaluate(expression)) return; await pause(100) }
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
const {createGrade9QaDatabase}=await import('./grade9-onboarding-qa-db.mjs')
const qa=await createGrade9QaDatabase()
let selectedUser=qa.id,currentUploadPath='',failComplete=false,chooserEvents=0
const originals=new Map()
const userFor=id=>({id,aud:'authenticated',role:'authenticated',email:id===qa.id?'grade9-browser@example.invalid':'grade9-legacy@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:id===qa.id?'Learner':'Existing',last_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'})
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
const sessionFor=id=>{const now=Math.floor(Date.now()/1000),user=userFor(id);return {user,access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})+'.fixture',refresh_token:'qa-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer'}}
const rows=(sql,params=[])=>qa.query(selectedUser,sql,params)
const stored=async()=> (await rows('select journey_answers,completed_at,current_step,revision from public.via_onboarding where user_id=auth.uid()'))[0]
const countAcademic=async()=>Number((await rows('select count(*)::integer as count from public.via_academic_records where user_id=auth.uid()'))[0].count)
function pdf(objects){const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.concat(parts).length);parts.push(Buffer.from((i+1)+' 0 obj\n'),Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(objects[i]),Buffer.from('\nendobj\n'))}const start=Buffer.concat(parts).length;parts.push(Buffer.from('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF'));return Buffer.concat(parts)}
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9381/json')).json();break}catch{await pause(100)}}
 assert(tabs,'Chrome did not start')
 socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(request){clearTimeout(request.timer);pending.delete(message.id);if(message.error)request.reject(Error(JSON.stringify(message.error)));else request.resolve(message.result)}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);else if(message.method==='Page.fileChooserOpened')chooserEvents++})
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('DOM.enable');await send('Page.setInterceptFileChooserDialog',{enabled:true})
 const {loadEnv}=await import('vite'),env=loadEnv('development',process.cwd(),'VITE_')
 socket.addEventListener('message',event=>{void (async()=>{
  const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return
  const {requestId,request}=m.params,url=new URL(request.url)
  const headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'X-Supabase-Api-Version',value:'2024-01-01'}]
  let body,status=200
  if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
  const payload=async()=>JSON.parse(request.postData||(await send('Network.getRequestPostData',{requestId:m.params.networkId})).postData)
  const token=request.headers.Authorization?.replace(/^Bearer /,'')||request.headers.authorization?.replace(/^Bearer /,'')
  let owner=selectedUser;try{owner=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub||selectedUser}catch{}
  const query=(sql,values=[])=>qa.query(owner,sql,values)
  try{
   if(url.pathname.endsWith('/auth/v1/token'))body=sessionFor(selectedUser)
   else if(url.pathname.endsWith('/auth/v1/user'))body=userFor(owner)
   else if(url.pathname.endsWith('/auth/v1/logout'))body={}
   else if(url.pathname.endsWith('/via_profiles'))body=await query('select * from public.via_profiles where id=auth.uid()')
   else if(url.pathname.endsWith('/via_onboarding_options'))body=await query('select id,category,label,description,icon,tone,sort_order,education_stages from public.via_onboarding_options where active order by sort_order')
   else if(url.pathname.endsWith('/via_onboarding'))body=await query('select * from public.via_onboarding where user_id=auth.uid()')
   else if(url.pathname.endsWith('/via_grade9_onboarding'))body=await query('select * from public.via_grade9_onboarding where user_id=auth.uid()')
   else if(url.pathname.endsWith('/via_grade9_plans'))body=[]
   else if(url.pathname.endsWith('/via_saved_opportunities'))body=[]
   else if(url.pathname.endsWith('/via_schools'))body=await query('select id,name from public.via_schools where province=$1 and name ilike $2 and active order by name limit 30',[url.searchParams.get('province')?.slice(3),url.searchParams.get('name')?.slice(6)||'%'])
   else if(url.pathname.endsWith('/via_public_opportunities'))body=await query('select document from public.via_public_opportunities where kind=$1 order by id limit 500',[url.searchParams.get('kind')?.slice(3)||'programmes'])
   else if(url.pathname.endsWith('/via_onboarding_reports')){
    if(request.method==='POST'){const p=await payload();body=(await query('insert into public.via_onboarding_reports(user_id,storage_path,file_name,mime_type,file_size) values(auth.uid(),$1,$2,$3,$4) returning *',[p.storage_path,p.file_name,p.mime_type,p.file_size]))[0]}
    else body=await query('select * from public.via_onboarding_reports where user_id=auth.uid() order by created_at desc')
   }else if(url.pathname.endsWith('/set_my_education_stage')){const p=await payload();body=(await query('select to_jsonb(public.set_my_education_stage($1,$2)) as value',[p.p_stage,p.p_expected_revision]))[0].value}
   else if(url.pathname.endsWith('/save_my_grade9_onboarding')){
    const p=await payload();if(failComplete&&p.p_complete){failComplete=false;throw Object.assign(Error('Fixture save failure'),{code:'XX000'})}
    body=(await query('select public.save_my_grade9_onboarding($1,$2::jsonb,$3::jsonb,$4,$5::text[],$6::text[],$7,$8,$9) as value',[p.p_stage,JSON.stringify(p.p_answers),JSON.stringify(p.p_grade9),p.p_current_step,p.p_answered_steps,p.p_skipped_steps,p.p_expected_revision,p.p_complete,p.p_confirm_results]))[0].value
   }else if(url.pathname.includes('/storage/v1/object/sign/')){const key=decodeURIComponent(url.pathname.split('/object/sign/')[1]);body={signedURL:'/object/qa-original/'+encodeURIComponent(key)}}
   else if(url.pathname.includes('/storage/v1/object/qa-original/')){
    const key=decodeURIComponent(url.pathname.split('/object/qa-original/')[1]),original=originals.get(key)
    assert(original,'Original report bytes not stored')
    headers[0].value=original.type;await send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:headers,body:original.bytes.toString('base64')});return
   }else if(url.pathname.includes('/storage/v1/object/')){
    const key=decodeURIComponent(url.pathname.split('/object/')[1]),slash=key.indexOf('/'),bucket=key.slice(0,slash),name=key.slice(slash+1)
    await query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,name])
    originals.set(key,{bytes:await fs.readFile(currentUploadPath),type:request.headers['Content-Type']||request.headers['content-type']||'application/pdf'})
    body={Key:key}
   }else{errors.push('Unexpected API request '+url.pathname);throw Error('Unexpected request')}
  }catch(reason){status=400;body={code:reason.code||'XX000',message:reason.message};if(!/Fixture save failure/.test(reason.message))console.log('API error',url.pathname,reason.message)}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
 })().catch(reason=>{if(!shuttingDown)errors.push(reason.message)})})
 await send('Fetch.enable',{patterns:[{urlPattern:env.VITE_SUPABASE_URL+'/*'}]})
 const click=async selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
 const textButton=async text=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}||b.querySelector('strong')?.textContent===${JSON.stringify(text)}).click()`)
 const fill=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 const choose=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 const next=async()=>{await click('.via-onboarding-continue-action');await pause(150)}
 const waitStep=async step=>until(`location.pathname===${JSON.stringify('/onboarding/'+step)}&&document.querySelector('.via-grade9-question')?.getAttribute('data-question')===${JSON.stringify(step)}`)
 const file=async(selector,name)=>{currentUploadPath=path.join(output,name);const root=await send('DOM.getDocument'),input=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[currentUploadPath]})}
 const signIn=async()=>{await navigate('/login');await fill('input[type=email]',userFor(selectedUser).email);await fill('input[type=password]','Fixture-only-123');await click('button[type=submit]');await until(selectedUser===qa.legacyId?'location.pathname==="/dashboard"&&!!document.querySelector(".grade9-dashboard")':'location.pathname==="/onboarding/welcome"&&!!document.querySelector(".via-onboarding-start")')}
 await navigate('/login');await evaluate('localStorage.clear();sessionStorage.clear()');await signIn()
 await click('.via-onboarding-start');await until('!!document.querySelector(".via-adaptive-stage-options")');await evaluate('[...document.querySelectorAll(".via-adaptive-stage-options button")].find(b=>b.textContent.includes("Grade 9")).click()');await until('document.querySelector(".via-adaptive-stage-options button[aria-pressed=true]")&&!document.querySelector(".via-onboarding-continue-action").disabled');await next();await waitStep('school-details')
 await next();assert(await evaluate('document.querySelector("[role=alert]").textContent.includes("province")'))
 await choose('.via-grade9-question select','Gauteng');await fill('input[type=search]','PRETORIA');await until('document.querySelectorAll(".via-grade9-school-results button").length>0')
 await click('.via-grade9-school-results button');await click('.via-grade9-fieldset input');await click('.via-onboarding-save-action');await until('location.pathname==="/"');assert.equal(await evaluate('!!document.querySelector(".via-workspace")'),false)
 await navigate('/onboarding/welcome');await click('.via-onboarding-start');await waitStep('school-details');assert.equal(await evaluate('document.querySelector(".via-grade9-question select").value'),'Gauteng');assert(await evaluate('document.body.textContent.includes("Selected school:")'))
 await click('.via-journey-uncertain input');await fill('input[placeholder="Enter your school name"]','VIA Test School');await next();await waitStep('results')
 const reportLines=['School: VIA Test School','Academic year: 2026','Grade 9','Term 3','Subject Mark (%)','Mathematics 72%','English Home Language 68%','Natural Sciences 75%']
 const png=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=1800;c.height=1500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='42px Arial';${JSON.stringify(reportLines)}.forEach((line,i)=>x.fillText(line,70,100+i*145));window.__g9ReportCanvas=c;return c.toDataURL('image/png')})()`)
 const jpg=await evaluate('window.__g9ReportCanvas.toDataURL("image/jpeg",.95)')
 await fs.writeFile(path.join(output,'report.png'),Buffer.from(png.split(',')[1],'base64'));await fs.writeFile(path.join(output,'report.jpg'),Buffer.from(jpg.split(',')[1],'base64'))
 const content='BT /F1 16 Tf 45 780 Td 45 TL '+reportLines.map((line,i)=>(i?'T* ':'')+'('+line.replace(/[()]/g,'')+') Tj').join(' ')+' ET',base=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>']
 await fs.writeFile(path.join(output,'report.pdf'),pdf([...base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream']))
 await fs.writeFile(path.join(output,'six-page-report.pdf'),pdf(['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R 7 0 R 8 0 R] /Count 6 >>',...Array.from({length:6},()=> '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 9 0 R >> >> /Contents 10 0 R >>'),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream']))
 const jpeg=Buffer.from(jpg.split(',')[1],'base64'),paint='q 580 0 0 484 16 150 cm /I1 Do Q'
 await fs.writeFile(path.join(output,'scanned-report.pdf'),pdf([...base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /XObject << /I1 4 0 R >> >> /Contents 5 0 R >>',Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1800 /Height 1500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'),jpeg,Buffer.from('\nendstream')]),'<< /Length '+paint.length+' >>\nstream\n'+paint+'\nendstream']))
 await file('input[aria-label="Upload Grade 9 report"]','report.pdf');await waitStep('confirm-results')
 assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-manual-result-row input")].map(e=>e.value)'),['72','68','75'])
 assert.equal(await countAcademic(),0);assert.equal((await stored()).journey_answers.results.length,0)
 assert.equal(await evaluate('document.querySelector(".via-grade9-report-fields input[type=number]").value'),'2026')
 await click('.via-onboarding-save-action');await until('location.pathname==="/"');await navigate('/onboarding/welcome');await until('!!document.querySelector(".via-onboarding-start")');await click('.via-onboarding-start');await waitStep('confirm-results');assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-manual-result-row input")].map(e=>e.value)'),['72','68','75'])
 await fill('input[aria-label="Mark 1"]','101');await next();assert(await evaluate('!!document.querySelector("[role=alert]")'));assert.equal(await countAcademic(),0)
 await fill('input[aria-label="Mark 1"]','73');await click('.via-manual-add');await choose('select[aria-label="Subject 4"]','subject-16');await fill('input[aria-label="Mark 4"]','80')
 await click('.via-manual-add');await choose('select[aria-label="Subject 5"]','subject-1');await fill('input[aria-label="Mark 5"]','70');await next();assert(await evaluate('document.querySelector("[role=alert]").textContent.includes("once")'));await click('button[aria-label="Remove subject 5"]')
 await fill('.via-grade9-report-fields input[type=number]','2027');await fill('.via-grade9-report-fields input[type=number]','2026');await choose('.via-grade9-report-fields select','term_2');await choose('.via-grade9-report-fields select','term_3')
 await next();await waitStep('subject-experience');assert.equal(await countAcademic(),1);assert.equal((await stored()).journey_answers.results[0].mark,73)
 for(let index=0;index<4;index++)await evaluate(`document.querySelectorAll(".via-grade9-experience")[${index}].querySelector("input").click()`);await next();await waitStep('interests');await click('.via-journey-options input');await next();await waitStep('subject-choice')
 await evaluate('[...document.querySelectorAll(".via-journey-options label")].find(e=>e.textContent==="I have some ideas").querySelector("input").click()');await next();await waitStep('subjects-considering');await click('.via-journey-options input');await next();await waitStep('future-interests')
 await click('.via-onboarding-secondary-action');await waitStep('subjects-considering');await click('.via-onboarding-secondary-action');await waitStep('subject-choice');await evaluate('[...document.querySelectorAll(".via-journey-options label")].find(e=>e.textContent==="Not yet").querySelector("input").click()');await next();await waitStep('future-interests')
 await click('.via-onboarding-secondary-action');await waitStep('subject-choice');await evaluate('[...document.querySelectorAll(".via-journey-options label")].find(e=>e.textContent==="I need help choosing").querySelector("input").click()');await next();await waitStep('future-interests')
 await evaluate('[...document.querySelectorAll(".via-journey-options label")].find(e=>e.textContent.includes("Not yet —")).querySelector("input").click()');await next();await until('location.pathname==="/onboarding/ready"&&!!document.querySelector(".via-ready-action")');assert.equal((await stored()).completed_at,null)
 failComplete=true;await click('.via-ready-action');await until('!!document.querySelector(".via-onboarding-feedback[role=alert]")');assert.equal((await stored()).completed_at,null)
 await click('.via-ready-action');await until('location.pathname==="/dashboard"&&!!document.querySelector(".grade9-dashboard")');assert((await stored()).completed_at)
 await navigate('/onboarding/welcome');assert.equal(await evaluate('document.querySelector(".via-onboarding-start").textContent.trim()'),'Go to My Dashboard')
 console.log('PASS: real SQL + browser login, school search/manual fallback, autosave/resume, PDF extraction/corrections, explicit confirmation, experience, conditionals, save retry and final-CTA completion.')
 for(const [name,method] of [['report.png','upload'],['report.jpg','camera'],['scanned-report.pdf','upload'],['six-page-report.pdf','upload']]){
  await navigate('/onboarding/results');await waitStep('results');const before=await countAcademic()
  if(method==='camera'){assert.equal(await evaluate('document.querySelector("input[capture]").getAttribute("capture")'),'environment');await click('input[capture]');await until('true');assert(chooserEvents>0)}
  await file(method==='camera'?'input[capture]':'input[aria-label="Upload Grade 9 report"]',name);await waitStep('confirm-results')
  assert.deepEqual(await evaluate('[...document.querySelectorAll(".via-manual-result-row input")].map(e=>e.value)'),['72','68','75']);assert.equal(await countAcademic(),before)
  console.log('PASS: actual OCR extraction and unconfirmed-draft isolation from '+name)
 }
 await navigate('/onboarding/results');await waitStep('results')
 for(const [name,type,size] of [['notes.txt','text/plain',8],['large.png','image/png',10485761]]){
  const before=originals.size
  await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Upload Grade 9 report"]'),files=new DataTransfer();files.items.add(new File([new Uint8Array(${size})],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until('document.querySelector(".via-grade9-question [role=alert]")?.textContent.includes("10 MB")');assert.equal(originals.size,before)
 }
 await textButton('Enter Marks Manually');await waitStep('confirm-results');assert.equal(await evaluate('document.querySelector(".via-manual-result-row input").value'),'')
 await choose('select[aria-label="Subject 1"]','subject-1');await fill('input[aria-label="Mark 1"]','0');await fill('.via-grade9-report-fields input[type=number]','2026');await choose('.via-grade9-report-fields select','final');await next();await waitStep('subject-experience');assert.equal((await stored()).journey_answers.results[0].mark,0)
 const allSubjects=(await rows('select id from public.via_onboarding_options where category=\'subject\' and active order by id')).map(r=>r.id)
 assert(allSubjects.includes('subject-17'))
 // Prepare a complete editable fixture through the real RPC for every layout screen.
 let state=await stored(),g=(await rows('select * from public.via_grade9_onboarding where user_id=auth.uid()'))[0]
 const {emptyGrade9}=await import('../src/features/onboarding/services/grade9-model.ts'),normalKeys=Object.keys(emptyGrade9())
 g=Object.fromEntries(normalKeys.map(k=>[k,g[k]]));g.subject_experience={'subject-1':'I enjoy it'};g.subject_choice_status='I have some ideas';g.subjects_considering=['subject-17'];g.future_clarity='Yes, I have some ideas';g.future_interest_areas=['Technology & Computing']
 await rows('select public.save_my_grade9_onboarding($1,$2::jsonb,$3::jsonb,$4,$5::text[],$6::text[],$7,false,false)',['grade_9',JSON.stringify(state.journey_answers),JSON.stringify(g),'future-interests',['welcome','current'],[],state.revision])
 for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  for(const step of ['school-details','results','confirm-results','subject-experience','interests','subject-choice','subjects-considering','future-interests']){
   await navigate('/onboarding/'+step);await waitStep(step)
   const layout=await evaluate('(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll(".via-grade9-question :is(input,select,button,label,fieldset),h1,.via-onboarding-panel-footer")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.className||e.tagName)}))()')
   assert.deepEqual(layout,{overflow:false,offenders:[]},width+'x'+height+' '+step)
   const action=await evaluate('(()=>{const b=document.querySelector(".via-onboarding-continue-action");b.scrollIntoView({block:"center"});const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.height>=44})()');assert(action,'Accessible action '+width+' '+step)
   if((width===375&&height===812||width===1440)&&['confirm-results','subject-experience','school-details'].includes(step)){await evaluate('window.scrollTo(0,0)');await screenshot(step+'-'+width,true)}
  }
  await navigate('/onboarding/ready');await until('!!document.querySelector(".via-ready-action")')
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
  assert(await evaluate('(()=>{const b=document.querySelector(".via-ready-action");b.scrollIntoView({block:"center"});const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&r.height>=44})()'),'Completion action '+width+'x'+height)
 }
 await navigate('/onboarding/confirm-results');await waitStep('confirm-results');await send('Emulation.setDeviceMetricsOverride',{width:375,height:360,deviceScaleFactor:1,mobile:false});await evaluate('document.querySelector(".via-manual-result-row input").focus();document.querySelector(".via-manual-result-row input").scrollIntoView({block:"center"})');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
 // Existing completed Grade 9 users keep their original completion and marks.
 await evaluate('(async()=>{const {supabase}=await import("/src/services/supabase.ts");await supabase.auth.signOut({scope:"local"})})()');selectedUser=qa.legacyId;await signIn();assert.equal((await stored()).journey_answers.results[0].mark,64)
 await navigate('/onboarding/interests');await waitStep('interests');await click('.via-journey-uncertain input');await next();await until('location.pathname==="/dashboard"');assert.equal((await stored()).journey_answers.results[0].mark,64);assert((await stored()).completed_at)
 assert.deepEqual(errors,[]);console.log('PASS: all Grade 9 screens at nine required viewport sizes, reduced keyboard height, manual zero mark, existing-user preservation. Original reports stored separately: '+originals.size)
} finally{
 shuttingDown = true
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
 for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser closed'))}
 chrome.kill();await qa.flush();await qa.db.close()
}
