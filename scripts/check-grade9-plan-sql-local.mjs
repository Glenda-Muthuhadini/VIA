import fs from 'node:fs/promises'
import {createGrade9QaDatabase} from './grade9-onboarding-qa-db.mjs'

const {db}=await createGrade9QaDatabase()
try{
 await db.exec(await fs.readFile('supabase/sql/grade9_dashboard_setup_v13.sql','utf8'))
 const onboarding=await db.exec(await fs.readFile('supabase/tests/grade9_onboarding.sql','utf8'))
 for(const row of onboarding.flatMap(item=>item.rows??[]).filter(row=>row.result))console.log(row.result)
 const result=await db.exec(await fs.readFile('supabase/tests/grade9_dashboard.sql','utf8'))
 for(const row of result.flatMap(item=>item.rows??[]).filter(row=>row.result))console.log(row.result)
 console.log('PASS: v13 executed after v1-v12 in disposable PostgreSQL. No live Supabase writes.')
}catch(error){console.error(error.message,error.where??'',error.detail??'');process.exitCode=1}
finally{await db.close()}
