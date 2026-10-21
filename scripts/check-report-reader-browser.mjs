// Real browser OCR/PDF tests with synthetic reports; public Supabase reads only.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
const output = path.resolve('node_modules/.tmp/via-report-reader-qa')
await fs.mkdir(output, { recursive: true })
const origin = process.env.VIA_TEST_ORIGIN || 'http://localhost:5175'
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9348','--user-data-dir='+path.join(output,'profile'),'about:blank'], { windowsHide: true, stdio: 'ignore' })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
let socket, sequence=0
const pending=new Map(), errors=[], network=[]
function send(method,params={}) { return new Promise((resolve,reject)=>{ const id=++sequence; const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method))},120000); pending.set(id,{resolve,reject:error=>reject(Error(method+': '+error.message)),timer});socket.send(JSON.stringify({id,method,params})) }) }
async function evaluate(expression) { const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value }
async function until(expression,timeout=30000) { const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await pause(100)}throw Error('Condition: '+expression+'\n'+await evaluate(`document.querySelector('.via-qualification-content')?.innerText`)) }
async function click(selector){await until(`document.querySelector(${JSON.stringify(selector)})!==null`);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)}
async function fill(selector,value){await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))})()`)}
async function open(){await evaluate(`window.__viaLeaving=true`);await send('Page.navigate',{url:origin+'/programmes?check=1'});await until(`!window.__viaLeaving && document.readyState==='complete' && document.querySelectorAll('.via-qualification-methods button:not(:disabled)').length===3`)}
async function file(selector,name){const root=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:root.root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[path.join(output,name)]})}
function pdf(objects){const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.concat(parts).length);parts.push(Buffer.from((i+1)+' 0 obj\n'),Buffer.isBuffer(objects[i])?objects[i]:Buffer.from(objects[i]),Buffer.from('\nendobj\n'))}const start=Buffer.concat(parts).length;parts.push(Buffer.from('xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF'));return Buffer.concat(parts)}
const reportLines=['Grade 12','Subject Mark (%)','Mathematics 75%','English Home Language 70%','Afrikaans First Additional Language 65%','Physical Sciences 75%','Life Sciences 75%','Geography 75%','Life Orientation 90%']
const expected=[['subject-1','75'],['subject-3','70'],['subject-6','65'],['subject-17','75'],['subject-18','75'],['subject-22','75'],['subject-16','90']]
try{
 let tabs;for(let i=0;i<100;i++){try{tabs=await(await fetch('http://127.0.0.1:9348/json')).json();break}catch{await pause(100)}}
 socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}))
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(JSON.stringify(m.error)));else p.resolve(m.result)}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.requestWillBeSent')network.push(m.params.request.url)})
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('DOM.enable');await send('Page.setInterceptFileChooserDialog',{enabled:true});await open()
 assert.equal(await evaluate(`document.querySelector('.via-qualification-content form')===null`),true)
 assert.equal(await evaluate(`document.querySelectorAll('.via-qualification-content input[type=checkbox]').length`),0)
 const png=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=1600;c.height=1500;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='42px Arial';${JSON.stringify(reportLines)}.forEach((line,i)=>x.fillText(line,70,110+i*125));window.__reportCanvas=c;return c.toDataURL('image/png')})()`)
 const jpg=await evaluate(`window.__reportCanvas.toDataURL('image/jpeg',.95)`)
 await fs.writeFile(path.join(output,'report.png'),Buffer.from(png.split(',')[1],'base64'));await fs.writeFile(path.join(output,'report.jpg'),Buffer.from(jpg.split(',')[1],'base64'))
 const content='BT /F1 16 Tf 45 780 Td 30 TL '+reportLines.map((line,i)=>(i?'T* ':'')+'('+line+') Tj').join(' ')+' ET'
 const base=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>']
 await fs.writeFile(path.join(output,'text-report.pdf'),pdf([...base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream']))
 const jpeg=Buffer.from(jpg.split(',')[1],'base64'),paint='q 580 0 0 544 16 150 cm /I1 Do Q'
 await fs.writeFile(path.join(output,'scanned-report.pdf'),pdf([...base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /XObject << /I1 4 0 R >> >> /Contents 5 0 R >>',Buffer.concat([Buffer.from('<< /Type /XObject /Subtype /Image /Width 1600 /Height 1500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n'),jpeg,Buffer.from('\nendstream')]),'<< /Length '+paint.length+' >>\nstream\n'+paint+'\nendstream']))
 async function assertExtracted(){await until(`document.querySelectorAll('.via-manual-result-row').length===7`,120000);const values=await evaluate(`[...document.querySelectorAll('.via-manual-result-row')].map(row=>[row.querySelector('select').value,row.querySelector('input').value])`);assert.deepEqual(values,expected);assert.equal(await evaluate(`document.querySelector('.via-qualification-grade-detected span').textContent`),'Grade 12 results')}
 for(const [name,method,selector] of [['text-report.pdf',0,'input[aria-label="Upload report file"]'],['report.png',0,'input[aria-label="Upload report file"]'],['report.jpg',1,'input[aria-label="Take or upload report photo"]'],['scanned-report.pdf',0,'input[aria-label="Upload report file"]']]){
  await open();await click('.via-qualification-methods button:nth-child('+(method+1)+')');await file(selector,name);await assertExtracted();console.log('PASS: actual extraction from '+name)
 }
 // Unknown grade is requested only after actual extraction, never before upload.
 const noGrade=content.replace('(Grade 12) Tj','(Academic report) Tj');await fs.writeFile(path.join(output,'unknown-grade.pdf'),pdf([...base,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+noGrade.length+' >>\nstream\n'+noGrade+'\nendstream']));
 await open();await click('.via-qualification-methods button:first-child');assert.equal(await evaluate(`document.querySelector('.via-qualification-grades')===null`),true);await file('input[aria-label="Upload report file"]','unknown-grade.pdf');await until(`document.querySelector('.via-qualification-grades')!==null`);assert.equal(await evaluate(`document.querySelector('form')===null`),true);await click('.via-qualification-grades button:nth-child(4)');await until(`document.querySelectorAll('.via-manual-result-row').length===7`);
 assert.equal(network.some(url=>url.includes('/storage/v1/object/')),false,'guest report must not be stored remotely')
 await click('.via-qualification-submit');await until(`document.querySelectorAll('.via-qualification-outcome').length===5`)
 await fill('[aria-label="Mark 1"]','66');await click('.via-qualification-submit');await until(`document.querySelector('.via-qualification-results')!==null`);assert.equal(await evaluate(`[...document.querySelectorAll('.via-qualification-outcome h4')].some(x=>x.textContent.includes('Mathematical Sciences'))`),false,'high APS cannot bypass Mathematics')
 await open();await click('.via-qualification-methods button:nth-child(3)');assert.equal(await evaluate(`document.querySelector('form')===null`),true);await click('.via-qualification-grades button:nth-child(4)');await until(`document.querySelector('[aria-label="Subject 1"]')!==null`)
 for(let index=0;index<expected.length;index++){if(index)await click('.via-manual-add');await evaluate(`(()=>{const s=document.querySelector('[aria-label="Subject ${index+1}"]');s.value=${JSON.stringify(expected[index][0])};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await fill('[aria-label="Mark '+(index+1)+'"]',expected[index][1])}
 await click('.via-qualification-submit');await until(`document.querySelectorAll('.via-qualification-outcome').length===5`)
 await click('.via-qualification-outcome button');await until(`document.querySelector('.via-public-detail-heading')!==null`)
 await until(`document.querySelector('.via-public-related .is-institutions button')!==null`)
 await click('.via-public-related .is-institutions button');await until(`location.pathname==='/institutions'&&document.querySelector('.via-institution-faculty summary')!==null`)
 await click('.via-institution-faculty summary');await click('.via-institution-faculty li button');await until(`location.pathname==='/programmes'&&document.querySelector('.via-public-related .is-funding button')!==null`)
 await click('.via-public-related .is-funding button');await until(`location.pathname==='/bursaries'&&document.querySelector('.via-public-related .is-programmes button')!==null`)
 await click('.via-public-related .is-programmes button');await until(`location.pathname==='/programmes'&&document.querySelector('.via-public-related .is-accommodation button')!==null`)
 await click('.via-public-related .is-accommodation button');await until(`location.pathname==='/accommodation'&&document.querySelector('.via-public-related .is-institutions button')!==null`)
 console.log('PASS: real programme → institution → programmes → funding → programme → accommodation navigation')
 async function manualProfile(grade,profile){await open();await click('.via-qualification-methods button:nth-child(3)');await click('.via-qualification-grades button:nth-child('+(grade-8)+')');for(let index=0;index<profile.length;index++){if(index)await click('.via-manual-add');await evaluate(`(()=>{const s=document.querySelector('[aria-label="Subject ${index+1}"]');s.value=${JSON.stringify(profile[index][0])};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await fill('[aria-label="Mark '+(index+1)+'"]',String(profile[index][1]))}await click('.via-qualification-submit');await until(`document.querySelector('.via-qualification-results')!==null`)}
 for(const grade of [9,10]){await manualProfile(grade,grade===9?[['subject-1',72],['subject-3',65],['subject-g9-natural-sciences',75]]:expected);assert.equal(await evaluate(`document.querySelector('.via-qualification-aps')===null`),true);assert(await evaluate(`document.querySelectorAll('.via-qualification-outcome.is-pathway').length>=3`))}
 await manualProfile(12,[['subject-2',60],['subject-3',45],['subject-7',55],['subject-19',55],['subject-20',50],['subject-22',50],['subject-16',70]])
 assert.equal(await evaluate(`document.querySelector('.via-qualification-aps strong').textContent`),'24');assert.equal(await evaluate(`document.querySelectorAll('.via-qualification-outcome.is-close').length`),2);assert((await evaluate(`document.querySelector('.via-qualification-close').innerText`)).includes('English needs 50%; you entered 45%'))
 await manualProfile(11,expected);assert.equal(await evaluate(`document.querySelector('.via-qualification-aps strong').textContent`),'35')
 console.log('PASS: Grade 9/10 pathways, Grade 11 APS and Grade 12 exact/close explanations')
 await open();await click('.via-qualification-methods button:first-child')
 for(const [name,type,size] of [['notes.txt','text/plain',8],['large.png','image/png',10485761]]){
  await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Upload report file"]'),files=new DataTransfer();files.items.add(new File([new Uint8Array(${size})],${JSON.stringify(name)},{type:${JSON.stringify(type)}}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await until(`document.querySelector('.via-qualification-content [role="alert"]')?.textContent.includes('Choose a PDF')`)
 }
 await fs.writeFile(path.join(output,'broken.pdf'),'%PDF-1.4\nbroken report')
 await file('input[aria-label="Upload report file"]','broken.pdf');await until(`document.querySelector('.via-qualification-content [role="alert"]')?.textContent.includes('could not read')`)
 await file('input[aria-label="Upload report file"]','report.png');await until(`document.querySelector('.via-qualification-reading')!==null`)
 await click('.via-qualification-methods button:nth-child(3)');await pause(1500)
 assert.equal(await evaluate(`document.querySelectorAll('.via-manual-result-row').length`),0,'switching cannot reveal stale extraction before a grade is chosen')
 await click('.via-qualification-grades button:nth-child(4)');assert.equal(await evaluate(`document.querySelectorAll('.via-manual-result-row').length`),1)
 assert.equal(await evaluate(`document.querySelector('.via-qualification-reading')===null`),true)
 const layouts=[]
 for(const [width,height] of [[375,812],[430,932],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[375,480],[1280,650]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await open()
  const initial=await evaluate(`(()=>{const d=document.querySelector('.via-qualification-dialog'),r=d.getBoundingClientRect();return {height:r.height,noForm:!d.querySelector('form'),equal:new Set([...d.querySelectorAll('.via-qualification-methods button')].map(b=>Math.round(b.getBoundingClientRect().width))).size<=2,overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,visible:r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth,hiddenScrollbar:getComputedStyle(d).scrollbarWidth==='none'}})()`)
  assert(initial.noForm&&initial.equal&&!initial.overflow&&initial.visible&&initial.hiddenScrollbar,JSON.stringify(initial));assert(initial.height<450)
  if(width===375||width===1440){const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'initial-'+width+'.png'),Buffer.from(shot.data,'base64'))}
  await click('.via-qualification-methods button:nth-child(3)');await click('.via-qualification-grades button:nth-child(4)');await until(`document.querySelector('.via-qualification-submit')!==null`)
  for(let index=0;index<6;index++)await click('.via-manual-add')
  const manual=await evaluate(`(()=>{const d=document.querySelector('.via-qualification-dialog'),b=d.querySelector('.via-qualification-submit');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1,buttonVisible:r.top>=0&&r.bottom<=innerHeight}})()`);assert(!manual.overflow&&manual.buttonVisible)
  await click('.via-qualification-methods button:first-child');assert.equal(await evaluate(`document.querySelector('.via-qualification-content form')===null`),true)
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until(`document.querySelector('.via-qualification-dialog')===null`)
  await manualProfile(12,expected)
  const results=await evaluate(`(()=>{const d=document.querySelector('.via-qualification-dialog'),b=d.querySelector('.via-qualification-outcome button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,buttonVisible:r.top>=0&&r.bottom<=innerHeight,count:d.querySelectorAll('.via-qualification-outcome').length}})()`);assert(!results.overflow&&results.buttonVisible&&results.count===5)
  if(width===375||width===1440){const shot=await send('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'results-'+width+'.png'),Buffer.from(shot.data,'base64'))}
  await click('.via-qualification-outcome button');await until(`document.querySelector('.via-public-related .is-funding button')!==null`)
  const detail=await evaluate(`(()=>{const d=document.querySelector('.via-public-dialog'),b=d.querySelector('.via-public-related .is-accommodation button');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,buttonVisible:r.top>=0&&r.bottom<=innerHeight}})()`);assert(!detail.overflow&&detail.buttonVisible)
  layouts.push({width,height,initial,manual,results,detail})
 }
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({extraction:['text PDF','PNG','JPEG camera input','scanned PDF'],liveQualification:'top five verified programmes; mandatory Mathematics enforced',layouts,errors},null,2));console.log('PASS: guest extraction, manual entry, grade selection, no checkboxes, verified qualification logic, programme details, method switching, scrolling and nine responsive viewport cases')
}finally{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Browser closed'))}socket?.close();chrome.kill()}
