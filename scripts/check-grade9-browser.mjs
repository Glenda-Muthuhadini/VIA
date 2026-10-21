// Real v1–v13 SQL/RLS with disposable PGlite and intercepted HTTP. No live writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createGrade9QaDatabase } from './grade9-onboarding-qa-db.mjs'
import { emptyGrade9 } from '../src/features/onboarding/services/grade9-model.ts'

const output=path.resolve('node_modules/.tmp/via-grade9-qa'),origin=process.env.VIA_TEST_ORIGIN||'http://localhost:5175',port=Number(process.env.VIA_GRADE9_DEBUG_PORT||9376)
await fs.mkdir(output,{recursive:true})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),pending=new Map(),inFlight=new Set(),errors=[],planRequests=[]
let chrome,socket,sequence=0,shuttingDown=false,failPlanOnce=false
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'))},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
async function until(expression){for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(80)}throw Error('Condition not met: '+expression+'\n'+await evaluate('document.body.innerText.slice(0,4500)'))}
async function navigate(route){await evaluate('window.__leaving=true');await send('Page.navigate',{url:origin+route});await until('!window.__leaving&&document.readyState==="complete"&&!!document.querySelector("h1")');await evaluate('document.fonts.ready')}
async function screenshot(name){const width=await evaluate('innerWidth'),height=await evaluate('document.documentElement.scrollHeight'),shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});await fs.writeFile(path.join(output,name+'.png'),Buffer.from(shot.data,'base64'))}
const qa=await createGrade9QaDatabase(),rows=(sql,params=[])=>qa.query(qa.id,sql,params)
const plan=async()=>(await rows('select * from public.via_grade9_plans where user_id=auth.uid()'))[0]??null
async function seedLearner(){
 if(!(await qa.db.query("select to_regclass('public.via_grade9_plans') is not null as value")).rows[0].value)await qa.db.exec(await fs.readFile('supabase/sql/grade9_dashboard_setup_v13.sql','utf8'))
 const options=await rows("select * from public.via_onboarding_options where category='subject' and active order by sort_order"),find=label=>{const option=options.find(row=>row.label===label);assert(option,'Missing actual subject '+label);return option.id}
 const subjects=['Mathematics','Natural Sciences','English Home Language','Technology','Social Sciences'].map(find),science=find('Physical Sciences')
 let record=(await rows('select to_jsonb(public.set_my_education_stage($1,0)) as value',['grade_9']))[0].value,answers=record.journey_answers
 answers.journey.interests=['Technology','Engineering'];answers.journey.careers=['Software developer']
 const g={...emptyGrade9(),province:'Gauteng',school_name:'VIA QA School',curriculum:'CAPS',school_manual:true,subject_choice_status:'I need help choosing',future_clarity:'Yes, I have some ideas',future_interest_areas:['Technology & Computing','Engineering'],subject_experience:Object.fromEntries(subjects.map(id=>[id,'I enjoy it']))}
 for(const[term,marks]of[['term_1',[59,68,75,77,45]],['term_2',[64,71,78,82,48]]]){
  g.results_draft={report_id:null,school_name:g.school_name,academic_year:'2026',report_period:term,detected_grade:9,grade_corrected:false,rows:subjects.map((subject_id,index)=>({subject_id,mark:String(marks[index])}))}
  record=(await rows('select public.save_my_grade9_onboarding($1,$2::jsonb,$3::jsonb,$4,$5::text[],$6::text[],$7,false,true) as value',['grade_9',JSON.stringify(answers),JSON.stringify(g),'subject-experience',['welcome','current'],[],record.revision]))[0].value
  answers=record.journey_answers;g.results_confirmed=true
 }
 record=(await rows('select public.save_my_grade9_onboarding($1,$2::jsonb,$3::jsonb,$4,$5::text[],$6::text[],$7,true,false) as value',['grade_9',JSON.stringify(answers),JSON.stringify(g),'ready',['welcome','current'],[],record.revision]))[0].value
 assert(record.completed_at);assert.equal((await rows('select count(*)::int as total from public.via_academic_records where user_id=auth.uid()'))[0].total,2)
 return{subjects,science}
}
const user={id:qa.id,aud:'authenticated',role:'authenticated',email:'grade9-browser@example.invalid',app_metadata:{provider:'email',providers:['email']},user_metadata:{first_name:'Learner',last_name:'Fixture'},created_at:'2026-01-01T00:00:00Z'},encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url')
const session=()=>{const now=Math.floor(Date.now()/1000);return{user,access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:qa.id,aud:'authenticated',role:'authenticated',iat:now,exp:now+3600})+'.fixture',refresh_token:'grade9-qa-refresh',expires_in:3600,expires_at:now+3600,token_type:'bearer'}}
const routes=[['home','Home','/dashboard'],['results','My Results','/dashboard/results'],['subject-choices','Subject Choices','/dashboard/subject-choices'],['study-pathways','Study Pathways','/dashboard/study-pathways'],['next-steps','Next Steps','/dashboard/next-steps'],['assist','VIA Assist','/dashboard/assist']]
try{
 chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${port}`,'--user-data-dir='+path.join(output,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'})
 const fixture=await seedLearner();let tabs
 for(let i=0;i<100;i++){try{tabs=await(await fetch(`http://127.0.0.1:${port}/json`)).json();break}catch{await pause(100)}}assert(tabs,'Chrome did not start')
 socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=pending.get(message.id);if(request){clearTimeout(request.timer);pending.delete(message.id);if(message.error)request.reject(Error(JSON.stringify(message.error)));else request.resolve(message.result)}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails)})
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable')
 const{loadEnv}=await import('vite'),env=loadEnv('development',process.cwd(),'VITE_')
 async function intercept(message){
  const{requestId,request}=message.params,url=new URL(request.url),headers=[{name:'Content-Type',value:'application/json'},{name:'Access-Control-Allow-Origin',value:'*'},{name:'Access-Control-Allow-Headers',value:'*'},{name:'Access-Control-Allow-Methods',value:'GET,POST,DELETE,OPTIONS'},{name:'X-Supabase-Api-Version',value:'2024-01-01'}]
  if(request.method==='OPTIONS'){await send('Fetch.fulfillRequest',{requestId,responseCode:204,responseHeaders:headers});return}
  const payload=async()=>JSON.parse(request.postData||(await send('Network.getRequestPostData',{requestId:message.params.networkId})).postData)
  let body,status=200
  try{
   if(url.pathname.endsWith('/auth/v1/token'))body=session()
   else if(url.pathname.endsWith('/auth/v1/user'))body=user
   else if(url.pathname.endsWith('/auth/v1/logout'))body={}
   else if(url.pathname.endsWith('/via_profiles'))body=await rows('select * from public.via_profiles where id=auth.uid()')
   else if(url.pathname.endsWith('/via_onboarding_options'))body=await rows('select id,category,label,description,icon,tone,sort_order,education_stages from public.via_onboarding_options where active order by sort_order')
   else if(url.pathname.endsWith('/via_onboarding'))body=await rows('select * from public.via_onboarding where user_id=auth.uid()')
   else if(url.pathname.endsWith('/via_grade9_onboarding'))body=await rows('select * from public.via_grade9_onboarding where user_id=auth.uid()')
   else if(url.pathname.endsWith('/via_grade9_plans')){assert.equal(url.searchParams.get('user_id'),'eq.'+qa.id);body=await rows('select * from public.via_grade9_plans where user_id=auth.uid()')}
   else if(url.pathname.endsWith('/via_onboarding_reports'))body=await rows('select * from public.via_onboarding_reports where user_id=auth.uid() order by created_at desc')
   else if(url.pathname.endsWith('/via_saved_opportunities'))body=[]
   else if(url.pathname.endsWith('/via_academic_records')){assert.equal(url.searchParams.get('user_id'),'eq.'+qa.id);body=await rows('select * from public.via_academic_records where user_id=auth.uid() and grade in (8,9) order by created_at desc,id limit $1 offset $2',[Number(url.searchParams.get('limit')??200),Number(url.searchParams.get('offset')??0)])}
   else if(url.pathname.endsWith('/via_academic_results')){assert.equal(url.searchParams.get('user_id'),'eq.'+qa.id);const ids=(url.searchParams.get('record_id')??'').replace(/^in\.\(/,'').replace(/\)$/,'').split(',').map(value=>value.replaceAll('"',''));body=await rows('select * from public.via_academic_results where user_id=auth.uid() and record_id=any($1::uuid[]) order by record_id,subject_id limit $2 offset $3',[ids,Number(url.searchParams.get('limit')??500),Number(url.searchParams.get('offset')??0)])}
   else if(url.pathname.endsWith('/via_public_opportunities'))body=await rows('select document from public.via_public_opportunities where kind=$1 order by id limit 500',[url.searchParams.get('kind')?.slice(3)||'programmes'])
   else if(url.pathname.endsWith('/save_my_grade9_plan')){const value=await payload();planRequests.push(structuredClone(value));if(failPlanOnce){failPlanOnce=false;throw Object.assign(Error('QA plan save failed. Retry this change.'),{code:'XX000'})}body=(await rows('select to_jsonb(public.save_my_grade9_plan($1::jsonb,$2)) as value',[JSON.stringify(value.p_patch),value.p_expected_revision]))[0].value}
   else{errors.push('Unexpected intercepted API: '+url.pathname);throw Error('Unexpected fixture request')}
  }catch(reason){status=400;body={code:reason.code||'XX000',message:reason.message};if(!reason.message.startsWith('QA plan save'))errors.push({request:url.pathname,message:reason.message})}
  await send('Fetch.fulfillRequest',{requestId,responseCode:status,responseHeaders:headers,body:Buffer.from(JSON.stringify(body)).toString('base64')})
 }
 socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method!=='Fetch.requestPaused')return;const request=intercept(message).catch(reason=>{if(!shuttingDown&&!/Invalid InterceptionId|Invalid interceptionId|No resource with given identifier/.test(reason.message))errors.push(reason.message)}).finally(()=>inFlight.delete(request));inFlight.add(request)})
 await send('Fetch.enable',{patterns:[{urlPattern:env.VITE_SUPABASE_URL+'/*'}]});await navigate('/login')
 const storageKey='sb-'+new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]+'-auth-token'
 await evaluate('localStorage.clear();sessionStorage.clear();localStorage.setItem('+JSON.stringify(storageKey)+','+JSON.stringify(JSON.stringify(session()))+')')
 const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
 const button=text=>evaluate(`(()=>{const e=[...document.querySelectorAll('.grade9-dashboard button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(text)});e.click()})()`)
 const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`)
 const waitPage=async page=>{await until(`document.querySelector('.grade9-dashboard[data-page]')?.getAttribute('data-page')===${JSON.stringify(page)}`);await until('!document.querySelector(".g9-saving")');if(page==='results')await until('!document.body.textContent.includes("Loading your report history")');if(page==='home')await until('!document.body.textContent.includes("Loading your saved plan")');if(page==='subject-choices')await until('!![...document.querySelectorAll("#other-subjects button")].find(b=>b.textContent.includes("Explore Subject")&&!b.disabled)');if(page==='next-steps')await until('!!document.querySelector(".g9-readiness strong")')}
 const loadPage=async page=>{await navigate(routes.find(row=>row[0]===page)[2]);await waitPage(page)}
 const saved=async predicate=>{for(let i=0;i<150;i++){const value=await plan();if(predicate(value)){await until('!document.querySelector(".g9-saving")');return value}await pause(60)}throw Error('SQL planning state was not saved: '+JSON.stringify({plan:await plan(),requests:planRequests.slice(-3),errors})+'\n'+await evaluate('document.querySelector(".grade9-dashboard[data-page]").innerText.slice(0,6000)'))}
 const readiness=async expected=>{await loadPage('next-steps');assert.equal(await evaluate('document.querySelector(".g9-readiness strong").textContent'),`${expected}%`)}
 const scienceAction=action=>evaluate(`(()=>{const card=[...document.querySelectorAll('#other-subjects .g9-tile')].find(e=>e.querySelector('h3')?.textContent==='Physical Sciences'),button=[...card.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(action)});if(!button||button.disabled)throw Error('Unavailable Physical Sciences action');button.click()})()`)
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await loadPage('home')
 assert.equal(await evaluate('document.querySelectorAll(".grade9-dashboard[data-page] section").length'),3)
 assert.equal(await evaluate('document.querySelectorAll(".grade9-dashboard .g9-button.primary").length'),1)
 assert.equal(await evaluate('document.querySelectorAll(".grade9-dashboard .g9r-table,.grade9-dashboard .g9-grid,.grade9-dashboard select,.grade9-dashboard textarea").length'),0)
 assert(await evaluate('document.querySelector(".grade9-dashboard").textContent.includes("68.6%")'));assert.equal(await plan(),null)
 await click('a.g9-button.primary[href="/dashboard/results"]');await waitPage('results')
 assert(await evaluate('document.querySelector(".g9r-overview").textContent.includes("VIA QA School")&&document.querySelector(".g9r-overview").textContent.includes("Term 2")'))
 assert.equal(await evaluate('document.querySelectorAll(".g9r-table li").length'),5);assert(await evaluate('document.querySelector(".g9r-table").textContent.includes("Level 5")'))
 await until('document.querySelectorAll(".g9r-history-item").length===2')
 await click('#grade9-report-history > summary')
 assert(await evaluate('document.querySelector(".g9r-progress-list").textContent.includes("59%")&&document.querySelector(".g9r-progress-list").textContent.includes("64%")&&document.querySelector(".g9r-progress-list").textContent.includes("+5 percentage points")'))
 await evaluate('[...document.querySelectorAll(".g9r-history-item")].find(e=>e.textContent.includes("Term 1")).click()')
 assert(await evaluate('document.querySelector(".g9r-table").textContent.includes("59%")'));assert.equal(await evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent==="Mark Results Reviewed")'),false)
 await button('Return to latest confirmed results')
 for(const[mode,label]of[['scan','Scan Report'],['upload','Upload Report'],['manual','Enter Marks Manually']])assert.equal(await evaluate(`[...document.querySelectorAll('.g9-actions a')].find(a=>a.textContent.trim()===${JSON.stringify(label)})?.getAttribute('href')`),'/onboarding/results?mode='+mode)
 // Page visits alone must not acknowledge or complete planning actions.
 for(const[page]of routes)await loadPage(page)
 assert.equal(planRequests.length,0);await readiness(25)
 await loadPage('home');await click('a[href="/dashboard/subject-choices#maths"]');await waitPage('subject-choices')
 assert.equal(await evaluate('location.hash'),'#maths');assert(await evaluate('document.querySelector("#maths").textContent.includes("64%")'));assert(await evaluate('document.querySelector(".g9-switch-rule").textContent.includes("school")'))
 assert.equal(await evaluate('document.querySelector("#maths").open'),true)
 await evaluate('document.querySelector("#maths > summary").focus()')
 await until('document.activeElement===document.querySelector("#maths > summary")')
 for(const expected of [false,true]){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await until(`document.querySelector("#maths").open===${expected}`)}
 console.log('PASS: concise Home, six distinct pages and CTAs, actual results, term history, +5 percentage-point progress; page visits do not complete actions.')
 await loadPage('results');failPlanOnce=true;await button('Mark Results Reviewed');await until('!!document.querySelector(".g9-save-error[role=alert]")')
 assert.equal(await plan(),null);assert(!await evaluate('[...document.querySelectorAll("button")].some(e=>e.textContent.trim()==="Results Reviewed")'))
 await button('Retry plan');await saved(value=>value?.reviewed_results);assert(planRequests.some(request=>request.p_patch.reviewed_results===true));await readiness(38)
 await loadPage('subject-choices');await click('#maths > summary');await fill('.g9-diagnostic textarea','Engineering and software development')
 await evaluate('[...document.querySelectorAll(".g9-radio-grid label")].find(e=>e.textContent==="It\'s okay").querySelector("input").click()')
 await button('Save My Reflection');await saved(value=>value?.algebra_feeling==="It's okay"&&value.dream_areas==='Engineering and software development');assert.equal((await plan()).maths_reviewed,false)
 await evaluate('[...document.querySelectorAll("#maths button")].find(e=>e.textContent.includes("Reviewed This Comparison")).click()');await saved(value=>value?.maths_reviewed);await readiness(50)
 await loadPage('subject-choices');assert.equal(await evaluate('document.querySelector(".g9-diagnostic textarea").value'),'Engineering and software development');assert.equal(await evaluate('document.querySelector(".g9-radio-grid input:checked").parentElement.textContent'),"It's okay")
 await scienceAction('Explore Subject');await saved(value=>value?.explored_subject_ids.includes(fixture.science));await scienceAction('Add to My Plan');await saved(value=>value?.shortlisted_subject_ids.includes(fixture.science));await readiness(75)
 await loadPage('subject-choices');await scienceAction('Remove from My Plan');await saved(value=>!value?.shortlisted_subject_ids.includes(fixture.science));await readiness(63)
 await loadPage('subject-choices');await scienceAction('Add to My Plan');await saved(value=>value?.shortlisted_subject_ids.includes(fixture.science))
 await evaluate('(()=>{const e=document.querySelector("#subject-comparison select");e.value="sciences";e.dispatchEvent(new Event("change",{bubbles:true}))})()')
 assert(await evaluate('document.querySelector("#subject-comparison").textContent.includes("physical and chemical")&&document.querySelector("#subject-comparison").textContent.includes("living organisms")'))
 await loadPage('study-pathways');await evaluate('[...document.querySelectorAll(".g9-disclosure > summary")].find(e=>e.textContent.includes("subject combinations")).click()');await evaluate('document.querySelector(".g9-pathway button").click()');await until('location.search.includes("pathway=engineering")&&document.querySelector("#g9-study-field").value==="engineering"');assert.equal((await plan()).explored_pathway_ids.length,0);assert(await evaluate('document.querySelector("#pathway-detail").textContent.includes("TVET")'))
 await button("I've explored this pathway");await saved(value=>value?.explored_pathway_ids.includes('engineering'));await readiness(88)
 await loadPage('subject-choices');await evaluate('[...document.querySelectorAll("#my-plan button")].find(e=>e.textContent.includes("Reviewed My Grade 10 Plan")).click()');await saved(value=>value?.plan_reviewed);await readiness(100)
 await loadPage('assist');await fill('#g9-assist-search','CAPS Level 6');await until('document.querySelectorAll(".g9-assist-question-list a").length===1');await click('.g9-assist-question-list a')
 assert(await evaluate('document.querySelector("#grade9-assist-answer").textContent.includes("70")&&document.querySelector("#grade9-assist-answer").textContent.includes("79%")'))
 await click('#grade9-assist-answer a[href="/dashboard/results"]');await waitPage('results');await loadPage('assist');await fill('#g9-assist-search','unmatched-search-xyz');await until('document.body.textContent.includes("No matching explanation")');await button('show all questions');assert(await evaluate('document.querySelectorAll(".g9-assist-question-list a").length>=7'))
 console.log('PASS: real SQL review/reflection/comparison/explore/shortlist/remove/reload; failed save preserves completion state; retry works; readiness 25→38→50→75→63→88→100%; Assist search/cross-links.')
 const layoutResults=[]
 for(const[width,height]of[[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  for(const[page,label,route]of routes){
   const openMenu=await evaluate(`(()=>{const e=document.querySelector('button[aria-label="Open navigation"]');return !!e&&e.getBoundingClientRect().width>0})()`);let scope='.via-workspace-sidebar'
   if(openMenu){await click('button[aria-label="Open navigation"]');await until('!!document.querySelector(".via-workspace-navigation-dialog[open]")');scope='.via-workspace-navigation-dialog[open]'}
   const selector=`${scope} a[aria-label="${label}"]`
   if(width===375){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})}else await click(selector)
   await waitPage(page);await until(`location.pathname===${JSON.stringify(route)}`);assert.equal(await evaluate('!!document.querySelector(".via-workspace-navigation-dialog[open]")'),false)
   assert.equal(await evaluate('document.querySelector(\'.via-workspace-sidebar a[aria-current="page"]\')?.getAttribute("href")'),route);assert.equal(await evaluate('document.querySelector(\'.via-workspace-navigation-dialog a[aria-current="page"]\')?.getAttribute("href")'),route)
   const layout=await evaluate(`(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll('.grade9-dashboard[data-page] :is(h1,h2,h3,button,input,textarea,select,a,.g9-section,.g9-tile)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+1)}).map(e=>({text:e.textContent.slice(0,55),tag:e.tagName})),smallControls:[...document.querySelectorAll('.grade9-dashboard[data-page] :is(button,.g9-button,.g9-text-button,input:not([type=radio]),select,textarea)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height<43}).map(e=>({text:e.textContent.slice(0,55),height:e.getBoundingClientRect().height}))}))()`)
   assert.deepEqual(layout,{overflow:false,offenders:[],smallControls:[]},`${width}x${height} ${page}: ${JSON.stringify(layout)}`);layoutResults.push({width,height,page,...layout})
   if(width===375&&height===812||width===1440){await evaluate('window.scrollTo(0,0)');await screenshot(`${page}-${width}`)}
   // Check the full content too, including the subject catalogue and answers.
   await evaluate(`(()=>{for(const text of ['View all subjects','View all questions']){const e=[...document.querySelectorAll('.grade9-dashboard button')].find(b=>b.textContent.trim()===text);e?.click()}})()`)
   if(page==='assist')await click('.g9-assist-question-list a')
   await evaluate('document.querySelectorAll(".grade9-dashboard details").forEach(e=>{e.open=true})')
   const expanded=await evaluate(`(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll('.grade9-dashboard[data-page] :is(h1,h2,h3,summary,button,input,textarea,select,a,.g9-section,.g9-tile)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+1)}).map(e=>e.textContent.slice(0,55)),smallControls:[...document.querySelectorAll('.grade9-dashboard[data-page] :is(summary,button,.g9-button,.g9-text-button,input:not([type=radio]),select,textarea)')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height<43}).map(e=>({text:e.textContent.slice(0,55),height:e.getBoundingClientRect().height}))}))()`)
   assert.deepEqual(expanded,{overflow:false,offenders:[],smallControls:[]},`${width}x${height} expanded ${page}: ${JSON.stringify(expanded)}`)
   if(width===375&&height===812||width===1440)await screenshot(`${page}-${width}-expanded`)
  }
 }
 await loadPage('subject-choices');await click('#maths > summary');await send('Emulation.setDeviceMetricsOverride',{width:375,height:360,deviceScaleFactor:1,mobile:false})
 assert(await evaluate('(()=>{const e=document.querySelector(".g9-diagnostic textarea");e.focus();e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()'))
 await loadPage('assist');assert(await evaluate('(()=>{const e=document.querySelector("#g9-assist-search");e.focus();e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1})()'))
 await fs.writeFile(path.join(output,'layout-results.json'),JSON.stringify(layoutResults,null,2));assert.deepEqual(errors,[])
 console.log(`PASS: ${layoutResults.length} responsive route checks in collapsed and expanded states at nine viewport sizes, keyboard disclosures/mobile navigation, active links, touch controls and reduced keyboard-height forms. All writes remained local.`)
}finally{
 shuttingDown=true
 // Destroy the app document while interception stays enabled. Disabling Fetch
 // first would release paused fixture requests to the real project endpoint.
 if(socket?.readyState===WebSocket.OPEN){try{await send('Page.navigate',{url:'about:blank'})}catch{}}
 await Promise.allSettled([...inFlight]);await qa.flush()
 if(socket?.readyState===WebSocket.OPEN){try{await send('Browser.close')}catch{}socket.close()}
 for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Browser closed'))}
 chrome?.kill();await qa.db.close()
}
