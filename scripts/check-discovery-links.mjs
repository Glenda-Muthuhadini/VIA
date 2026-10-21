// Read-only HTTP verification of every external destination in the release.
import fs from 'node:fs/promises'
const records=JSON.parse(await fs.readFile('supabase/catalogue/public_catalogue_v5.json','utf8'))
const connected=process.argv.includes('--connected')
const urls=new Set()
function collect(value){if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){if((key.endsWith('_url')||key==='url'||key==='apply')&&typeof child==='string')urls.add(child);else collect(child)}}
collect(records)
if(connected)collect(JSON.parse(await fs.readFile('supabase/catalogue/connected_catalogue_v7.json','utf8')))
const pending=[...urls],results=[]
async function worker(){while(pending.length){const url=pending.shift();let result
 try{const r=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 VIA official catalogue link verification'}});const text=(await r.text()).slice(0,300000),title=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()??'';result={url,status:r.status,final_url:r.url,title,ok:r.ok&&r.url.startsWith('https://')&&!/^(404|page not found|not found)/i.test(title),checked_at:new Date().toISOString()}}
 catch(error){result={url,ok:false,error:error.message,checked_at:new Date().toISOString()}}
 results.push(result);if(!result.ok)console.log('NEEDS REVIEW:',url,result.status??result.error)
}}
await Promise.all([worker(),worker(),worker(),worker()])
await fs.mkdir('supabase/catalogue',{recursive:true})
await fs.writeFile(connected?'supabase/catalogue/link_verification_v7.json':'supabase/catalogue/link_verification_v5.json',JSON.stringify(results.sort((a,b)=>a.url.localeCompare(b.url)),null,2)+'\n')
console.log(`${results.filter(r=>r.ok).length}/${results.length} destinations returned successful HTTPS responses. Failed/blocked checks require review; do not label them verified working.`)
if(results.some(r=>!r.ok))process.exitCode=1
