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
 await fs.mkdir('node_modules/.tmp/via-sql-validation',{recursive:true})
 await fs.writeFile('node_modules/.tmp/via-sql-validation/PASS.txt','Full v1-v4 + corrected v6 + connected v7/v8 executed in disposable PostgreSQL. Connected qualification, discovery, adaptive and legacy onboarding SQL tests passed. This is not live Supabase verification.\n')
}catch(error){console.error(error.message,error.where??'',error.detail??'');process.exitCode=1}
finally{await db.close()}
