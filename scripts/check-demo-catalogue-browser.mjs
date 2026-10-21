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
const good=['subject-1','subject-3','subject-6','subject-17','subject-18','subject-22','subject-16'].map(subject_id=>({subject_id,mark:80}))
const checked=await rpc('check_connected_qualification',{p_results:good,p_grade:12})
assert(checked.exact.total>=150,'Apply demo v10 first');assert.equal(checked.exact.items.length,5)
assert(checked.exact.items.every(item=>item.programme.is_demo))
const selected=checked.exact.items[0].programme
const output=path.resolve('node_modules/.tmp/via-demo-qa');await fs.mkdir(output,{recursive:true})
const origin=process.env.VIA_TEST_ORIGIN||'http://localhost:5175'
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9356','--user-data-dir='+path.join(output,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket,sequence=0;const pending=new Map(),errors=[]
function send(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))})}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value}
async function until(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;await pause(100)}throw Error(expression+'\n'+await evaluate(`document.body.innerText`))}
async function click(selector){await until(`document.querySelector(${JSON.stringify(selector)})!==null`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}
async function fill(selector,value){await evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
async function go(route){await evaluate(`window.__viaLeaving=true`);await send('Page.navigate',{url:origin+route});await until(`!window.__viaLeaving&&document.readyState==='complete'&&document.querySelector('.via-site-header')!==null`)}
async function institution(id){await go('/institutions?opportunity='+id);await until(`document.querySelectorAll('.via-institution-faculty').length>0&&!document.querySelector('.via-institution-faculties[aria-busy=true]')`)}
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9356/json')).json();break}catch{await pause(100)}}
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)})
 await send('Page.enable');await send('Runtime.enable')
 await go('/programmes?check=1');await until(`document.querySelectorAll('.via-qualification-methods button:not(:disabled)').length===3`)
 await click('.via-qualification-methods button:nth-child(3)');await click('.via-qualification-grades button:nth-child(4)')
 for(let i=0;i<good.length;i++){if(i)await click('.via-manual-add');await evaluate(`(()=>{const s=document.querySelector('[aria-label="Subject ${i+1}"]');s.value=${JSON.stringify(good[i].subject_id)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await fill('[aria-label="Mark '+(i+1)+'"]','80')}
 await click('.via-qualification-submit');await until(`document.querySelectorAll('.via-qualification-outcome').length===5`)
 assert.equal(await evaluate(`document.querySelector('.via-qualification-aps strong').textContent`),'42')
 assert((await evaluate(`document.querySelector('.via-qualification-results').innerText`)).includes('Meets demo requirements'))
 await click('.via-qualification-outcome button');await until(`document.querySelector('.via-public-related .is-institutions button')!==null`)
 assert((await evaluate(`document.querySelector('.via-public-detail-content').innerText`)).includes('Study mode'))
 assert.equal(await evaluate(`document.querySelector('.via-public-external-actions button')?.disabled`),true)
 await click('.via-public-tabs button:nth-child(2)');assert((await evaluate(`document.querySelector('#via-detail-panel').innerText`)).includes('Synthetic demo'))
 await click('.via-public-related .is-institutions button');await until(`document.querySelectorAll('.via-institution-faculty').length===5`)
 assert.equal(await evaluate(`document.querySelectorAll('.via-institution-faculty li').length`),15)
 for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false})
  await click('.via-institution-faculty summary')
  const bounds=await evaluate(`(()=>{const d=document.querySelector('dialog[open]');return {overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,rows:d.querySelectorAll('.via-institution-faculty li').length}})()`);assert(!bounds.overflow&&bounds.rows===15)
 }
 await go('/programmes?opportunity='+selected.id);await until(`document.querySelector('.via-public-related .is-funding button')!==null`)
 await click('.via-public-related .is-funding button');await until(`location.pathname==='/bursaries'&&document.querySelector('.via-public-related .is-accommodation button')!==null`)
 assert((await evaluate(`document.querySelector('.via-public-detail-heading').innerText`)).includes('Demo'))
 await click('.via-public-related .is-accommodation button');await until(`location.pathname==='/accommodation'&&document.querySelector('.via-public-detail-heading')?.innerText.includes('Demo')`)
 assert.deepEqual(errors,[]);console.log('PASS: live dynamic Top 5 → programme/requirements → five faculties/15 programmes → demo funding → demo accommodation; seven responsive widths, no invented Apply URLs')
}finally{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'))}socket?.close();chrome.kill()}
