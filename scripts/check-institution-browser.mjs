// Real anonymous Supabase reads. No real account, catalogue or saved-data writes.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'
const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const db = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
async function rpc(name,args) { const {data,error}=await db.rpc(name,args);if(error)throw Error(name+': '+error.message);return data }
const catalogue=await rpc('search_public_opportunities',{p_kind:'institutions',p_page_size:24})
const summaries=await rpc('public_institution_summaries',{p_ids:catalogue.items.map(i=>i.id)})
for(const item of catalogue.items){const faculties=await rpc('public_institution_faculties',{p_institution:item.id});assert(faculties.length);assert.equal(faculties.reduce((n,f)=>n+f.programmes.length,0),item.programme_count);assert(item.application_url);assert(summaries[item.id])}
assert.equal(summaries['10000000-0000-4000-8000-000000000005'].aps_min,22)
assert.equal(summaries['10000000-0000-4000-8000-000000000005'].aps_max,33)
assert.equal(summaries['10000000-0000-4000-8000-000000000009'].aps_min,null)
console.log('PASS: live v9, all ten institutions have faculties/programmes/apply links, comparable APS ranges')
const output=path.resolve('node_modules/.tmp/via-institution-qa');await fs.mkdir(output,{recursive:true})
const origin=process.env.VIA_TEST_ORIGIN||'http://localhost:5175'
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9354','--user-data-dir='+path.join(output,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,sequence=0;const pending=new Map(),errors=[]
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function until(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;await pause(100)}throw Error(expression+'\n'+await evaluate(`document.body.innerText`))}
async function click(selector){await until(`document.querySelector(${JSON.stringify(selector)})!==null`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}
async function fill(selector,value){await evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
async function go(route){await evaluate(`window.__viaLeaving=true`);await send('Page.navigate',{url:origin+route});await until(`!window.__viaLeaving&&document.readyState==='complete'&&document.querySelector('.via-site-header')!==null`)}
async function institution(id){await go('/institutions?opportunity='+id);await until(`document.querySelectorAll('.via-institution-faculty').length>0&&!document.querySelector('.via-institution-faculties[aria-busy=true]')`)}
const uj='10000000-0000-4000-8000-000000000005'
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9354/json')).json();break}catch{await pause(100)}}
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)})
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable')
 await go('/institutions');await until(`document.querySelectorAll('.via-institution-card').length===10`)
 const card=await evaluate(`(()=>{const c=document.querySelector('.via-institution-card');return {text:c.innerText,apply:c.querySelector('a').getAttribute('href'),title:c.querySelector('h2').textContent}})()`)
 assert(!/Official source|Source:|Checked |programmes listed|Explore college/i.test(card.text));assert(card.text.includes('Application Fee')&&card.text.includes('APS Range'));assert(card.apply.startsWith('https://'))
 await click('.via-institution-card .via-save-button');await until(`document.querySelector('.via-public-conversion')!==null`);assert.equal(await evaluate(`document.querySelector('.via-institution-details')===null`),true);await click('.via-public-dialog[open] .via-public-dialog-header button');await until(`document.querySelector('.via-public-conversion')===null`)
 // A click on the card facts hits the stretched native details button.
 const point=await evaluate(`(()=>{const d=document.querySelector('.via-institution-card-facts');d.scrollIntoView({block:'center'});const r=d.getBoundingClientRect();return {x:r.left+20,y:r.top+20}})()`)
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await until(`document.querySelector('.via-institution-details')!==null`)
 await institution(uj)
 assert.equal(await evaluate(`document.querySelectorAll('.via-institution-details .via-public-tabs,.via-institution-details .via-public-source,.via-institution-details .via-public-match-conversion').length`),0)
 assert.equal(await evaluate(`document.querySelectorAll('.via-institution-faculty').length`),4);assert.equal(await evaluate(`document.querySelectorAll('.via-institution-faculty[open]').length`),0)
 await evaluate(`document.querySelector('.via-institution-faculty summary').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});await until(`document.querySelector('.via-institution-faculty[open]')!==null`)
 assert.equal(await evaluate(`document.querySelectorAll('.via-institution-faculty li :is(dl,p,a,input)').length`),0)
 await fill('.via-institution-programme-search input','Accounting');await until(`document.querySelector('.via-institution-faculties[aria-busy=false]')!==null&&document.querySelectorAll('.via-institution-faculty').length===1`)
 assert.equal(await evaluate(`document.querySelectorAll('.via-institution-faculty li').length`),1);assert((await evaluate(`document.querySelector('.via-institution-faculty h4').textContent`)).includes('Accounting'))
 await click('.via-institution-faculty li button');await until(`location.pathname==='/programmes'&&document.querySelector('.via-public-tabs')!==null`)
 assert((await evaluate(`document.querySelector('.via-public-detail-heading h2').textContent`)).includes('Accounting'))
 const apply=await evaluate(`[...document.querySelectorAll('.via-public-external-actions a')].map(a=>({text:a.firstChild.textContent,href:a.href,rel:a.rel,target:a.target}))`);assert.equal(apply.length,1);assert.equal(apply[0].text,'Apply');assert.equal(apply[0].target,'_blank');assert(apply[0].rel.includes('noopener'))
 await click('.via-public-tabs button:nth-child(2)');assert((await evaluate(`document.querySelector('#via-detail-panel').innerText`)).includes('Mathematics'))
 console.log('PASS: card hit area, isolated guest Save prompt, faculty keyboard accordion, cross-faculty search, reused programme requirements and safe Apply')
 const layouts=[]
 for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await go('/institutions');await until(`document.querySelectorAll('.via-institution-card').length===10`)
  const cards=await evaluate(`(()=>{const cards=[...document.querySelectorAll('.via-institution-card')];return {overflow:document.documentElement.scrollWidth>innerWidth+1,columns:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().left))).size,buttons:cards.every(c=>[...c.querySelectorAll('.via-institution-card-actions :is(a,button),.via-save-button')].every(b=>b.getBoundingClientRect().height>=44))}})()`);assert(!cards.overflow&&cards.buttons)
  if(width===375||width===1440){const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'cards-'+width+'.png'),Buffer.from(shot.data,'base64'))}
  await institution(uj);await click('.via-institution-faculty summary')
  const modal=await evaluate(`(()=>{const d=document.querySelector('.via-public-dialog[open]'),r=d.getBoundingClientRect(),b=d.querySelector('.via-institution-apply a');b.scrollIntoView({block:'center'});const a=b.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,within:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,applyVisible:a.top>=0&&a.bottom<=innerHeight+1,hiddenScrollbar:getComputedStyle(d).scrollbarWidth==='none'}})()`);assert(!modal.overflow&&modal.within&&modal.applyVisible&&modal.hiddenScrollbar,JSON.stringify({width,...modal}))
  await evaluate(`document.querySelector('.via-institution-faculty summary').scrollIntoView({block:'start'})`)
  if(width===375||width===1440){const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'faculty-'+width+'.png'),Buffer.from(shot.data,'base64'))}
  await fill('.via-institution-programme-search input','zz-no-programme');await until(`document.querySelector('.via-institution-faculties').innerText.includes('No programmes matched')`);await click('.via-institution-faculties button');await until(`document.querySelectorAll('.via-institution-faculty').length===4`)
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`document.querySelector('.via-public-dialog[open]')===null`)
  layouts.push({width,height,cards,modal})
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({liveInstitutions:catalogue.total,layouts,errors},null,2));console.log('PASS: institution cards, faculties, compact rows, search/empty/reset and modal accessibility across nine viewport cases')
}finally{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'))}socket?.close();chrome.kill()}
