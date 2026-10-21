// Reproducible public-school-name import. No contacts, people or coordinates are retained.
// Input: DBE EMIS National, Quarter 3 of 2025, downloaded from the documented URL.
import fs from 'node:fs'
import {inflateRawSync} from 'node:zlib'
const sourceUrl='https://www.education.gov.za/LinkClick.aspx?fileticket=cF64WfdfGD0%3d&tabid=466&portalid=0&mid=10308&forcedownload=true'
const bytes=fs.readFileSync(process.argv.find(a=>a.endsWith('.xlsx'))||'node_modules/.tmp/dbe-schools-2025.xlsx')
const entries=new Map()
let end=bytes.length-22;while(end>=0&&bytes.readUInt32LE(end)!==0x06054b50)end--
if(end<0)throw Error('Expected an XLSX ZIP archive')
let pos=bytes.readUInt32LE(end+16)
for(let index=0;index<bytes.readUInt16LE(end+10);index++){
 if(bytes.readUInt32LE(pos)!==0x02014b50)throw Error('Invalid ZIP directory')
 const method=bytes.readUInt16LE(pos+10),size=bytes.readUInt32LE(pos+20),length=bytes.readUInt16LE(pos+28),extra=bytes.readUInt16LE(pos+30),comment=bytes.readUInt16LE(pos+32),offset=bytes.readUInt32LE(pos+42),name=bytes.subarray(pos+46,pos+46+length).toString()
 const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28)
 entries.set(name,()=>{const data=bytes.subarray(start,start+size);return (method===8?inflateRawSync(data):data).toString('utf8')});pos+=46+length+extra+comment
}
const decode=text=>text.replace(/<[^>]*>/g,'').replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,number,name)=>hex?String.fromCodePoint(parseInt(hex,16)):number?String.fromCodePoint(Number(number)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[name.toLowerCase()])
const shared=[...entries.get('xl/sharedStrings.xml')().matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match=>decode(match[1]))
const sheet=entries.get('xl/worksheets/sheet1.xml')()
const rows=[]
for(const match of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
 const row={}
 for(const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
  const col=cell[1].match(/\br="([A-Z]+)\d+"/)?.[1],content=cell[2]??'',value=content.match(/<v>([\s\S]*?)<\/v>/)?.[1]
  if(col)row[col]=/\bt="s"/.test(cell[1])&&value!==undefined?shared[Number(value)]:value??decode(content)
 }
 rows.push(row)
}
if(process.argv.includes('--inspect')){console.log(JSON.stringify({headers:rows[0],sample:rows.slice(1,3).map(row=>Object.fromEntries(Object.entries(row).filter(([col])=>['A','B','C','E','F'].includes(col))))},null,2));process.exit(0)}
const headers=rows.shift(),find=regex=>Object.entries(headers).find(([,label])=>regex.test(label))?.[0]
const idCol=find(/^NatEmis|^EMIS|^National.*EMIS/i),nameCol=find(/^Official.*Name|^School.*Name|^Institution.*Name/i),provinceCol=find(/^Province$/i),statusCol=find(/^Status$/i)
if(!idCol||!nameCol||!provinceCol)throw Error('DBE header format changed. Run --inspect before updating the importer.')
const provinces={EC:'Eastern Cape',FS:'Free State',GP:'Gauteng',GT:'Gauteng',KZN:'KwaZulu-Natal',LP:'Limpopo',MP:'Mpumalanga',NW:'North West',NC:'Northern Cape',WC:'Western Cape','KwaZulu Natal':'KwaZulu-Natal'}
const valid=['Gauteng','Limpopo','Mpumalanga','North West','Free State','KwaZulu-Natal','Eastern Cape','Western Cape','Northern Cape']
const records=new Map()
for(const row of rows){
 if(statusCol&&row[statusCol]&&!/^(open|operational|active)$/i.test(row[statusCol].trim()))continue
 const id=row[idCol]?.trim(),name=row[nameCol]?.trim(),province=provinces[row[provinceCol]?.trim()]??row[provinceCol]?.trim()
 if(!/^\d{6,12}$/.test(id??'')||!name||name.length>200||!valid.includes(province))continue
 if(records.has(id)&&JSON.stringify(records.get(id))!==JSON.stringify({id,name,province}))throw Error('Conflicting EMIS identifier '+id)
 records.set(id,{id,name,province})
}
if(records.size<15000||valid.some(p=>![...records.values()].some(r=>r.province===p)))throw Error('Incomplete school-name import')
const quote=value=>"'"+value.replaceAll("'","''")+"'"
const sql='-- Official DBE EMIS National school-name directory, Quarter 3 of 2025.\n-- Source: '+sourceUrl+'\n-- Imported 21 October 2026. Names/provinces/EMIS IDs only; no personal/contact data.\nbegin;\n'+Array.from({length:Math.ceil(records.size/500)},(_,i)=>'insert into public.via_schools(id,name,province,source_url,source_year) values\n'+[...records.values()].slice(i*500,(i+1)*500).map(r=>'('+[r.id,r.name,r.province,sourceUrl].map(quote).join(',')+',2025)').join(',\n')+';').join('\n')+'\ncommit;\n'
const output='supabase/migrations/20261021001900_grade9_school_directory.sql'
if(fs.existsSync(output)&&fs.readFileSync(output,'utf8')!==sql)throw Error('School migration already released. Create a new timestamped version.')
fs.writeFileSync(output,sql)
console.log(JSON.stringify({output,schools:records.size,provinces:Object.fromEntries(valid.map(p=>[p,[...records.values()].filter(r=>r.province===p).length]))}))
