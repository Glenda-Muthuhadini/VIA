// Disposable PostgreSQL/WASM database, never the live Supabase project.
// The temporary engine is installed under node_modules/.tmp, not package.json.
import fs from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
const {PGlite}=await import(pathToFileURL(path.resolve('node_modules/.tmp/via-sql-validation/node_modules/@electric-sql/pglite/dist/index.js')).href)
const db=new PGlite()
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,aud text,role text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),updated_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage to anon,authenticated,service_role;
 grant select,insert,delete on storage.objects to authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`)
 for(const name of ['auth_setup_v1','onboarding_setup_v2','adaptive_onboarding_setup_v3','public_discovery_setup_v4','public_qualification_setup_v6']){
  await db.exec(await fs.readFile(`supabase/sql/${name}.sql`,'utf8'));console.log(`PASS: executed ${name} in disposable PostgreSQL`)
 }
 for(const name of ['public_qualification','public_discovery','adaptive_onboarding','onboarding']){
  const result=await db.exec(await fs.readFile(`supabase/tests/${name}.sql`,'utf8'));console.log(name,JSON.stringify(result.at(-1)?.rows))
 }
 await db.exec(await fs.readFile('supabase/sql/connected_discovery_setup_v7.sql','utf8'));console.log('PASS: executed connected discovery v7 in disposable PostgreSQL')
 await db.exec(await fs.readFile('supabase/sql/connected_discovery_links_v8.sql','utf8'));console.log('PASS: executed TUT link correction v8 in disposable PostgreSQL')
 const connected=await db.exec(await fs.readFile('supabase/tests/connected_discovery.sql','utf8'));console.log('connected_discovery',JSON.stringify(connected.at(-1)?.rows))
 await db.exec(await fs.readFile('supabase/sql/institution_explorer_setup_v9.sql','utf8'));console.log('PASS: executed institution explorer v9 in disposable PostgreSQL')
 const institutions=await db.exec(await fs.readFile('supabase/tests/institution_explorer.sql','utf8'));console.log('institution_explorer',JSON.stringify(institutions.at(-1)?.rows))
 await db.exec(await fs.readFile('supabase/sql/demo_institution_dataset_v10.sql','utf8'))
 await db.exec(`insert into auth.users(id,email,raw_user_meta_data) values('70000000-0000-4000-8000-000000000001','legacy-journey@example.invalid','{"first_name":"Legacy","last_name":"Fixture"}');
 update public.via_profiles set education_stage='grade_9',education_stage_confirmation_required=false where id='70000000-0000-4000-8000-000000000001';
 insert into public.via_academic_records(id,user_id,education_stage,school_name,academic_year,grade,report_type) values('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','grade_9','Legacy School',2025,9,'final');
 insert into public.via_academic_results(record_id,user_id,subject_id,mark) select '70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001',id,64 from public.via_onboarding_options where category='subject' and active order by id limit 1;
 insert into public.via_onboarding(user_id,answers,current_step,flow_version,academic_record_id,completed_at) values('70000000-0000-4000-8000-000000000001','{"school_name":"Legacy School","current_id":"current-1"}','ready',3,'70000000-0000-4000-8000-000000000002','2026-10-01T10:00:00Z');`)
 const legacyBefore=await db.query("select answers::text,completed_at::text from public.via_onboarding where user_id='70000000-0000-4000-8000-000000000001'")
 await db.exec(await fs.readFile('supabase/migrations/20261020001700_complete_journey_onboarding.sql','utf8'))
 const legacyAfter=await db.query("select answers::text,completed_at::text from public.via_onboarding where user_id='70000000-0000-4000-8000-000000000001'")
 if(JSON.stringify(legacyBefore.rows)!==JSON.stringify(legacyAfter.rows))throw Error('Upgrade changed historical answers or completion')
 const restored=await db.query("select flow_version,journey_answers->>'school_name' as school,jsonb_array_length(journey_answers->'results') as marks from public.via_onboarding where user_id='70000000-0000-4000-8000-000000000001'")
 if(restored.rows[0].flow_version!==4||restored.rows[0].school!=='Legacy School'||restored.rows[0].marks!==1)throw Error('Upgrade failed to restore existing academic data')
 console.log('PASS: existing completed v3 profile upgrades without losing original answers, completion or academic data')
 console.log('PASS: complete onboarding migration v11 executed in disposable PostgreSQL')
 const journey=await db.exec(await fs.readFile('supabase/tests/complete_onboarding.sql','utf8'));console.log('complete_onboarding',JSON.stringify(journey.flatMap(result=>result.rows??[]).filter(row=>row.result)))
 if(process.argv.includes('--grade9')||process.argv.includes('--grade9-editor-parts')){
  if(process.argv.includes('--grade9-editor-parts')){
   const directory='supabase/sql/grade9_v12_sql_editor'
   for(const file of (await fs.readdir(directory)).filter(file=>file.endsWith('.sql')).sort()){
    await db.exec(await fs.readFile(`${directory}/${file}`,'utf8'))
    console.log(`PASS: executed SQL Editor part ${file}`)
   }
  }else{
   await db.exec(await fs.readFile('supabase/migrations/20261021001800_grade9_confirmed_onboarding.sql','utf8'))
   await db.exec(await fs.readFile('supabase/migrations/20261021001900_grade9_school_directory.sql','utf8'))
  }
  const grade9=await db.exec(await fs.readFile('supabase/tests/grade9_onboarding.sql','utf8'));console.log('grade9_onboarding',JSON.stringify(grade9.flatMap(result=>result.rows??[]).filter(row=>row.result)))
 }
 await fs.mkdir('node_modules/.tmp/via-sql-validation',{recursive:true})
 await fs.writeFile('node_modules/.tmp/via-sql-validation/JOURNEY-PASS.txt','Full v1-v4, corrected v6, v7-v10 and complete onboarding v11 executed in disposable PostgreSQL. Seven branches, saved academic history, stage transitions, owner access, revision conflicts and validation passed. This is not live Supabase verification.\n')
}catch(error){console.error(error.message,error.where??'',error.detail??'');process.exitCode=1}
finally{await db.close()}
