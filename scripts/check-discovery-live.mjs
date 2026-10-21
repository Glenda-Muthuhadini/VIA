import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const env=loadEnv('development',process.cwd(),'VITE_')
const client=createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const kinds=['institutions','programmes','bursaries','accommodation']
const snapshot={}
for(const kind of kinds){
 const {data,error}=await client.rpc('search_public_opportunities',{p_kind:kind,p_page_size:12})
 if(error) throw new Error(`${kind}: ${error.code} ${error.message}`)
 assert(Array.isArray(data.items));assert(data.items.length>0);assert(data.items.length<=12)
 snapshot[kind]=data
 console.log(`PASS: anonymous ${kind} browsing (${data.total} records)`)
}
const cases=[['programmes','computer',{institution:'10000000-0000-4000-8000-000000000001'}],['institutions','Wits',{}],['institutions','',{province:'Western Cape'}],['programmes','',{aps_max:'35'}],['bursaries','',{applications:'true'}],['accommodation','',{price_max:'5200'}],['accommodation','',{nsfas:'true'}]]
for(const [kind,p_query,p_filters] of cases){const {data,error}=await client.rpc('search_public_opportunities',{p_kind:kind,p_query,p_filters});if(error)throw error;console.log(`PASS: ${kind} query ${JSON.stringify({p_query,p_filters})} (${data.total} results)`)}
const {error:privateError}=await client.from('via_saved_opportunities').select('opportunity_id').limit(1)
assert(privateError,'Anonymous saved-data access must be denied')
console.log('PASS: anonymous private saved-data access denied')
fs.mkdirSync('node_modules/.tmp',{recursive:true})
fs.writeFileSync('node_modules/.tmp/via-discovery-live.json',JSON.stringify(snapshot,null,2))
